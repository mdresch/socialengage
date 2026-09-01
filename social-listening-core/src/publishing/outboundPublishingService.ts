import { withTenant } from '../db/withTenant';
import { getSocialConnector } from '../connectors/registry';
import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { invoke } from '../outbound/outboundPublishService';

export interface CreateOutboundPostOptions {
  text: string;
  assets?: Array<{
    type: 'image' | 'video' | 'link-card';
    url?: string;
    alt?: string;
    target?: string;
  }>;
  targetPlatforms?: string[];
  targets?: Array<{ providerId: string; targetAssetId: string }>;
  scheduledFor?: string | null;
  assetTargets?: Record<string, string>;
  perPlatformOverrides?: Record<string, string>;
}

export interface CreateOutboundPostResult {
  activityIds: string[];
  scheduledFor: string | null;
}

export interface OutboundActivity {
  id: string;
  tenantId: string;
  userId: string;
  providerId: string;
  credentialId?: string | null;
  targetAssetId?: string | null;
  targetAssetType?: string | null;
  activityType: string;
  body: string;
  status: 'scheduled' | 'publishing' | 'published' | 'pending' | 'sent' | 'failed' | 'cancelled';
  externalId?: string | null;
  externalUrl?: string | null;
  errorCode?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
}

export class PublishingError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message);
    this.name = 'PublishingError';
  }
}

const PLATFORMS_REQUIRING_ASSET_TARGET = new Set(['facebook', 'instagram', 'linkedin']);

/**
 * Story 11.7 (ADR-0098) — creates outbound post activities for one or more target platforms.
 */
export async function createOutboundPost(
  tenantId: string,
  userId: string,
  options: CreateOutboundPostOptions
): Promise<CreateOutboundPostResult> {
  const text = (options.text || '').trim();
  if (!text) {
    throw new PublishingError('Post text is required and cannot be empty.', 'INVALID_POST_TEXT', 422);
  }

  const platforms = new Set<string>();
  const assetTargetMap: Record<string, string> = { ...(options.assetTargets || {}) };

  if (Array.isArray(options.targetPlatforms) && options.targetPlatforms.length > 0) {
    for (const p of options.targetPlatforms) {
      if (p && typeof p === 'string') platforms.add(p.trim());
    }
  }

  if (Array.isArray(options.targets) && options.targets.length > 0) {
    for (const t of options.targets) {
      if (t.providerId) {
        platforms.add(t.providerId.trim());
        if (t.targetAssetId) {
          assetTargetMap[t.providerId.trim()] = t.targetAssetId.trim();
        }
      }
    }
  }

  if (platforms.size === 0) {
    throw new PublishingError('At least one target platform is required.', 'INVALID_TARGETS', 422);
  }

  // Validate asset targets
  for (const platformId of platforms) {
    if (PLATFORMS_REQUIRING_ASSET_TARGET.has(platformId.toLowerCase())) {
      const target = assetTargetMap[platformId];
      if (!target) {
        throw new PublishingError(
          `Missing required asset target for platform '${platformId}'.`,
          'MISSING_ASSET_TARGET',
          400
        );
      }
    }
  }

  let scheduledFor: string | null = null;
  if (options.scheduledFor) {
    const d = new Date(options.scheduledFor);
    if (isNaN(d.getTime())) {
      throw new PublishingError('scheduledFor must be a valid ISO 8601 timestamp.', 'INVALID_SCHEDULED_FOR', 422);
    }
    scheduledFor = d.toISOString();
  }

  const activityIds: string[] = [];

  await withTenant(tenantId, async (client) => {
    for (const platformId of platforms) {
      const targetAssetId = assetTargetMap[platformId] || null;
      const targetAssetType = targetAssetId ? `${platformId}_page` : `${platformId}_feed`;
      const platformBody = options.perPlatformOverrides?.[platformId]?.trim() || text;

      let credentialId: string | null = null;
      try {
        credentialId = (await getLatestCredentialId(tenantId, platformId, 'user', userId)) || null;
      } catch {
        // credential lookup optional
      }

      const initialStatus = scheduledFor ? 'scheduled' : 'publishing';

      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO outbound_activities (
          tenant_id, user_id, provider_id, credential_id, activity_type,
          body, status, scheduled_for, target_asset_id, target_asset_type,
          assets, payload, created_at
        ) VALUES ($1, $2, $3, $4, 'post', $5, $6, $7, $8, $9, $10, $11, now())
        RETURNING id`,
        [
          tenantId,
          userId,
          platformId,
          credentialId,
          platformBody,
          initialStatus,
          scheduledFor,
          targetAssetId,
          targetAssetType,
          JSON.stringify(options.assets || []),
          JSON.stringify({
            text,
            assets: options.assets || [],
            perPlatformOverrides: options.perPlatformOverrides,
          }),
        ]
      );

      const activityId = insertRes.rows[0].id;
      activityIds.push(activityId);

      // If immediate, attempt publishing
      if (!scheduledFor) {
        const connector = getSocialConnector(platformId);
        if (connector && connector.publish) {
          let credential = '';
          if (credentialId) {
            try {
              credential = await readCredential(tenantId, credentialId);
            } catch {
              // ignore
            }
          }

          try {
            const pubResult = await invoke({
              tenantId,
              userId,
              payload: {
                text: platformBody,
                targetAssetId: targetAssetId || '',
                targetAssetType,
              },
              credential,
              connector,
            });

            if (pubResult.status === 'sent') {
              await client.query(
                `UPDATE outbound_activities
                 SET status = 'published',
                     published_at = now(),
                     sent_at = now(),
                     external_id = $2,
                     external_url = $3
                 WHERE id = $1`,
                [activityId, pubResult.externalId, pubResult.externalUrl]
              );
            } else {
              await client.query(
                `UPDATE outbound_activities
                 SET status = 'failed',
                     failed_at = now(),
                     error_code = $2
                 WHERE id = $1`,
                [activityId, pubResult.errorCode || 'publish_failed']
              );
            }
          } catch (err: any) {
            await client.query(
              `UPDATE outbound_activities
               SET status = 'failed',
                   failed_at = now(),
                   error_code = $2
               WHERE id = $1`,
              [activityId, err.message || 'publish_failed']
            );
          }
        }
      }
    }
  });

  return {
    activityIds,
    scheduledFor,
  };
}

/**
 * Story 11.7 (ADR-0098) — cancel a scheduled or pending outbound post.
 */
export async function cancelOutboundActivity(
  tenantId: string,
  activityId: string
): Promise<OutboundActivity> {
  return await withTenant(tenantId, async (client) => {
    const checkRes = await client.query<any>(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [activityId]
    );

    if (checkRes.rows.length === 0) {
      throw new PublishingError('Outbound activity not found.', 'NOT_FOUND', 404);
    }

    const row = checkRes.rows[0];
    if (['published', 'sent'].includes(row.status)) {
      throw new PublishingError('Cannot cancel an already published activity.', 'CANNOT_CANCEL_PUBLISHED', 409);
    }

    const updateRes = await client.query<any>(
      `UPDATE outbound_activities
       SET status = 'cancelled', cancelled_at = now()
       WHERE id = $1
       RETURNING *`,
      [activityId]
    );

    return mapActivityRow(updateRes.rows[0]);
  });
}

/**
 * Story 11.7 (ADR-0098) — reschedule a scheduled outbound post.
 */
export async function rescheduleOutboundActivity(
  tenantId: string,
  activityId: string,
  newScheduledFor: string
): Promise<OutboundActivity> {
  const d = new Date(newScheduledFor);
  if (isNaN(d.getTime())) {
    throw new PublishingError('newScheduledFor must be a valid ISO 8601 timestamp.', 'INVALID_SCHEDULED_FOR', 422);
  }

  return await withTenant(tenantId, async (client) => {
    const checkRes = await client.query<any>(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [activityId]
    );

    if (checkRes.rows.length === 0) {
      throw new PublishingError('Outbound activity not found.', 'NOT_FOUND', 404);
    }

    const row = checkRes.rows[0];
    if (['published', 'sent'].includes(row.status)) {
      throw new PublishingError('Cannot reschedule an already published activity.', 'CANNOT_RESCHEDULE_PUBLISHED', 409);
    }

    const updateRes = await client.query<any>(
      `UPDATE outbound_activities
       SET status = 'scheduled', scheduled_for = $2
       WHERE id = $1
       RETURNING *`,
      [activityId, d.toISOString()]
    );

    return mapActivityRow(updateRes.rows[0]);
  });
}

/**
 * Story 11.7 (ADR-0098) — lists outbound activities with optional status filtering.
 */
export async function listOutboundActivities(
  tenantId: string,
  options?: { status?: string; providerId?: string; limit?: number }
): Promise<OutboundActivity[]> {
  return await withTenant(tenantId, async (client) => {
    let query = `SELECT * FROM outbound_activities WHERE activity_type = 'post'`;
    const params: any[] = [];

    if (options?.status) {
      params.push(options.status);
      query += ` AND status = $${params.length}`;
    }
    if (options?.providerId) {
      params.push(options.providerId);
      query += ` AND provider_id = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(options?.limit || 50);

    const res = await client.query<any>(query, params);
    return res.rows.map(mapActivityRow);
  });
}

/**
 * Story 11.7 (ADR-0098) — lists available targets for a platform.
 */
export async function getPlatformTargets(
  tenantId: string,
  userId: string,
  platformId: string
): Promise<Array<{ id: string; name: string; type: string }>> {
  const connector = getSocialConnector(platformId);
  if (!connector) {
    return [];
  }

  let credential = '';
  try {
    const credId = await getLatestCredentialId(tenantId, platformId, 'user', userId);
    if (credId) {
      credential = await readCredential(tenantId, credId);
    }
  } catch {
    // fallback
  }

  if (connector.targetAssets) {
    const assets = await Promise.resolve(connector.targetAssets(tenantId, userId, credential));
    return assets.map((a) => {
      if (typeof a === 'string') {
        return { id: a, name: `${platformId} target (${a})`, type: `${platformId}_page` };
      }
      return {
        id: a.id,
        name: (a as any).name || `${platformId} target (${a.id})`,
        type: a.type || `${platformId}_page`,
      };
    });
  }

  // Fallback defaults for platforms that support asset targeting
  if (platformId === 'linkedin') {
    return [
      { id: 'urn:li:organization:corp-default', name: 'Company LinkedIn Page', type: 'linkedin_organization' },
    ];
  }
  if (platformId === 'facebook') {
    return [
      { id: 'page-default-fb', name: 'Official Facebook Page', type: 'facebook_page' },
    ];
  }

  return [];
}

function mapActivityRow(r: any): OutboundActivity {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    providerId: r.provider_id,
    credentialId: r.credential_id,
    targetAssetId: r.target_asset_id,
    targetAssetType: r.target_asset_type,
    activityType: r.activity_type,
    body: r.body,
    status: r.status,
    externalId: r.external_id,
    externalUrl: r.external_url,
    errorCode: r.error_code,
    scheduledFor: r.scheduled_for ? new Date(r.scheduled_for).toISOString() : null,
    publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    sentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null,
    failedAt: r.failed_at ? new Date(r.failed_at).toISOString() : null,
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
  };
}
