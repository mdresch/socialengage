import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { isConnectorActive } from '../../../connectors/connectorActivationStore';
import { getLatestCredentialId, readCredential } from '../../../credentials/credentialStore';
import { getSocialConnector } from '../../../connectors/registry';
import { insertPending, setSent, setFailed, getById, cancel, listPosts, OutboundActivityRow } from '../../../outbound/outboundActivityStore';
import { invoke } from '../../../outbound/outboundPublishService';

export const outboundPostsRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUS_FILTERS = new Set(['pending', 'sent', 'failed', 'cancelled']);

interface TargetInput {
  providerId: string;
  targetAssetId: string;
}

interface PerTargetResult {
  providerId: string;
  targetAssetId: string;
  status: string;
  errorCode?: string;
  externalId?: string | null;
  externalUrl?: string | null;
}

/**
 * Story 3.15 (ADR-0075) — create and dispatch new, original outbound posts
 * to the caller's connected platform assets.
 */
outboundPostsRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(422).json({ error: 'Post text is required and cannot be empty.', code: 'INVALID_POST_TEXT' });
    return;
  }

  const rawTargets = Array.isArray(req.body?.targets) ? req.body.targets : [];
  if (rawTargets.length === 0) {
    res.status(422).json({ error: 'At least one target is required.', code: 'INVALID_TARGETS' });
    return;
  }

  const targets: TargetInput[] = [];
  for (const t of rawTargets) {
    const providerId = typeof t?.providerId === 'string' ? t.providerId.trim() : '';
    const targetAssetId = typeof t?.targetAssetId === 'string' ? t.targetAssetId.trim() : '';
    if (!providerId || !targetAssetId) {
      res.status(422).json({ error: 'Each target must have a non-empty providerId and targetAssetId.', code: 'INVALID_TARGETS' });
      return;
    }
    targets.push({ providerId, targetAssetId });
  }

  let scheduledFor: string | null = null;
  if (typeof req.body?.scheduledFor === 'string' && req.body.scheduledFor) {
    const parsed = new Date(req.body.scheduledFor);
    if (isNaN(parsed.getTime())) {
      res.status(422).json({ error: 'scheduledFor must be a valid ISO 8601 timestamp.', code: 'INVALID_SCHEDULED_FOR' });
      return;
    }
    scheduledFor = parsed.toISOString();
  }

  const perPlatformOverrides: Record<string, string> =
    req.body?.perPlatformOverrides && typeof req.body.perPlatformOverrides === 'object'
      ? (req.body.perPlatformOverrides as Record<string, string>)
      : {};
  const linkPreview = req.body?.linkPreview ?? null;
  const media = Array.isArray(req.body?.media) ? req.body.media : [];

  // Validate every target before persisting anything.
  const targetDetails: Array<{
    providerId: string;
    targetAssetId: string;
    targetAssetType: string;
    credentialId: string;
    credential: string;
    connector: ReturnType<typeof getSocialConnector>;
    body: string;
  }> = [];

  for (const target of targets) {
    const { providerId, targetAssetId } = target;

    const active = await isConnectorActive(tenantId, providerId, 'user', userId);
    if (!active) {
      res.status(422).json({ error: 'Publishing is not available for this provider.', code: 'PUBLISH_NOT_AVAILABLE' });
      return;
    }

    const credentialId = await getLatestCredentialId(tenantId, providerId, 'user', userId);
    if (!credentialId) {
      res.status(422).json({ error: 'Publishing is not available for this provider.', code: 'PUBLISH_NOT_AVAILABLE' });
      return;
    }

    const connector = getSocialConnector(providerId);
    if (!connector || !connector.publish) {
      res.status(422).json({ error: 'Publishing is not available for this provider.', code: 'PUBLISH_NOT_AVAILABLE' });
      return;
    }

    let credential: string;
    try {
      credential = await readCredential(tenantId, credentialId);
    } catch {
      res.status(422).json({ error: 'Publishing is not available for this provider.', code: 'PUBLISH_NOT_AVAILABLE' });
      return;
    }

    let targetAssetType: string | undefined;
    const targetAssets = connector.targetAssets
      ? await Promise.resolve(connector.targetAssets(tenantId, userId, credential))
      : null;

    if (targetAssets && targetAssets.length > 0) {
      const match = targetAssets.find((a) =>
        typeof a === 'string' ? a === targetAssetId : a.id === targetAssetId
      );
      if (!match) {
        res.status(422).json({ error: 'The requested target asset is not available.', code: 'PUBLISH_NOT_AVAILABLE' });
        return;
      }
      targetAssetType =
        typeof match === 'string'
          ? `${providerId}_page`
          : match.type ?? `${providerId}_page`;
    }

    const body =
      perPlatformOverrides[providerId]?.trim() || text;

    targetDetails.push({
      providerId,
      targetAssetId,
      targetAssetType: targetAssetType ?? `${providerId}_page`,
      credentialId,
      credential,
      connector,
      body,
    });
  }

  // Insert a pending row for every target.
  const pendingRows: OutboundActivityRow[] = [];
  for (const detail of targetDetails) {
    const payload: Record<string, unknown> = {
      text,
      perPlatformOverrides,
      media,
      linkPreview,
      targetAssetId: detail.targetAssetId,
      targetAssetType: detail.targetAssetType,
    };

    const row = await insertPending({
      tenantId,
      userId,
      postId: null,
      providerId: detail.providerId,
      credentialId: detail.credentialId,
      activityType: 'post',
      targetAssetId: detail.targetAssetId,
      targetAssetType: detail.targetAssetType,
      body: detail.body,
      payload,
      scheduledFor,
    });
    pendingRows.push(row);
  }

  // Scheduled posts are persisted as pending and not dispatched by this call.
  if (scheduledFor) {
    res.status(201).json({ posts: pendingRows, nextCursor: null });
    return;
  }

  // Immediate posts: attempt dispatch for each target and update the row.
  const results: PerTargetResult[] = [];
  const updatedRows: OutboundActivityRow[] = [];
  let anySent = false;
  let anyFailed = false;
  let allFailedAreRateLimited = true;

  for (let i = 0; i < targetDetails.length; i++) {
    const detail = targetDetails[i];
    const pending = pendingRows[i];

    const result = await invoke({
      tenantId,
      userId,
      payload: {
        text: detail.body,
        perPlatformOverrides,
        media,
        linkPreview,
        targetAssetId: detail.targetAssetId,
        targetAssetType: detail.targetAssetType,
      },
      credential: detail.credential,
      connector: detail.connector!,
    });

    let row: OutboundActivityRow;
    if (result.status === 'sent') {
      row = await setSent(tenantId, pending.id, result.externalId!, result.externalUrl!, result.sentAt!);
      anySent = true;
    } else {
      row = await setFailed(tenantId, pending.id, result.errorCode!, result.failedAt!);
      anyFailed = true;
      if (result.errorCode !== 'rate_limited' && result.errorCode !== 'queue_ttl_exceeded' && result.errorCode !== 'queue_depth_exceeded') {
        allFailedAreRateLimited = false;
      }
    }

    updatedRows.push(row);
    results.push({
      providerId: detail.providerId,
      targetAssetId: detail.targetAssetId,
      status: row.status,
      errorCode: row.errorCode ?? undefined,
      externalId: row.externalId,
      externalUrl: row.externalUrl,
    });
  }

  if (anySent && anyFailed) {
    res.status(207).json({ posts: updatedRows, results, status: 'partial' });
    return;
  }

  if (!anySent && anyFailed) {
    if (allFailedAreRateLimited) {
      res.status(429).json({ posts: updatedRows, results });
      return;
    }
    res.status(502).json({ posts: updatedRows, results });
    return;
  }

  res.status(201).json({ posts: updatedRows, nextCursor: null });
});

/**
 * Story 3.15 (ADR-0075) — list the caller's outbound post activity rows.
 */
outboundPostsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const status =
    typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status && !ALLOWED_STATUS_FILTERS.has(status)) {
    res.status(400).json({ error: 'Invalid status filter.', code: 'INVALID_STATUS_FILTER' });
    return;
  }

  const providerId =
    typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  const posts = await listPosts(tenantId, { status, providerId, limit });
  res.json({ posts, nextCursor: null });
});

/**
 * Story 3.15 (ADR-0075) — cancel a pending scheduled post.
 */
outboundPostsRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const row = await getById(tenantId, id);
  if (!row || row.activityType !== 'post') {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  if (row.status !== 'pending') {
    res.status(409).json({ error: 'Only pending posts can be cancelled.', code: 'NOT_CANCELABLE' });
    return;
  }

  if (row.scheduledFor && new Date(row.scheduledFor) <= new Date()) {
    res.status(409).json({ error: 'The scheduled time has already passed.', code: 'NOT_CANCELABLE' });
    return;
  }

  const cancelled = await cancel(tenantId, id);
  if (!cancelled) {
    res.status(409).json({ error: 'Only pending posts can be cancelled.', code: 'NOT_CANCELABLE' });
    return;
  }

  res.status(200).json(cancelled);
});
