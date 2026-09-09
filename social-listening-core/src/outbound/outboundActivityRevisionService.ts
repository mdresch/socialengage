import { getById, updateBodyInPlace, setEdited, setDeleted, cancel } from './outboundActivityStore';
import {
  createRevision,
  setRevisionApplied,
  setRevisionFailed,
  listRevisionsForActivity,
  getLatestAppliedEditRevision,
  OutboundActivityRevisionRow,
} from './outboundActivityRevisionStore';
import { getSocialConnector } from '../connectors/registry';
import { readCredential, getLatestCredentialId } from '../credentials/credentialStore';
import { acquireForOutboundPost } from '../connectors/requestGate';
import { ClassifiableError } from '../ingestion/errorClassification';
import { OutboundActivitySummary, OutboundPostPayload } from '../connectors/types';

export class OutboundRevisionError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message);
    this.name = 'OutboundRevisionError';
  }
}

export interface EditActivityOptions {
  tenantId: string;
  userId: string;
  role: string;
  activityId: string;
  body: string;
  payload?: OutboundPostPayload;
  targetAssetId?: string;
}

export interface DeleteActivityOptions {
  tenantId: string;
  userId: string;
  role: string;
  activityId: string;
}

export async function editActivity(
  options: EditActivityOptions
): Promise<{ revision: OutboundActivityRevisionRow }> {
  const { tenantId, userId, role, activityId, body, payload, targetAssetId } = options;

  const parent = await getById(tenantId, activityId);
  if (!parent) {
    throw new OutboundRevisionError('Activity not found.', 'ACTIVITY_NOT_FOUND', 404);
  }

  // AC 7 / BRU-001 / BRU-002: only original author or tenant_admin in same tenant
  if (parent.userId !== userId && role !== 'tenant_admin') {
    throw new OutboundRevisionError('Only the original author or a tenant admin may edit this activity.', 'FORBIDDEN', 403);
  }

  // AC / BR-011: target_asset_id is read-only on edit
  if (targetAssetId && parent.targetAssetId && targetAssetId !== parent.targetAssetId) {
    throw new OutboundRevisionError('Target asset is read-only and cannot be changed on edit.', 'TARGET_ASSET_READ_ONLY', 422);
  }

  // AC 3: If parent is pending, update body in place without connector
  if (parent.status === 'pending') {
    await updateBodyInPlace(tenantId, activityId, body, payload as Record<string, unknown> | undefined);
    const revision = await createRevision({
      tenantId,
      activityId,
      userId,
      revisionType: 'edit',
      body,
      payload: payload as Record<string, unknown> | undefined,
      status: 'applied',
    });
    return { revision };
  }

  // AC 3: If parent is sent, invoke connector.edit?()
  if (parent.status === 'sent') {
    const connector = getSocialConnector(parent.providerId);
    if (!connector || !connector.edit) {
      throw new OutboundRevisionError('Editing is not supported for this platform.', 'edit_not_supported', 422);
    }

    let credential = '';
    if (parent.credentialId) {
      try {
        credential = await readCredential(tenantId, parent.credentialId);
      } catch {
        // Fallback to caller's credential
      }
    }
    if (!credential) {
      const fallbackCredId = await getLatestCredentialId(tenantId, parent.providerId, 'user', userId);
      if (fallbackCredId) {
        try {
          credential = await readCredential(tenantId, fallbackCredId);
        } catch {
          // Leave empty
        }
      }
    }

    const revision = await createRevision({
      tenantId,
      activityId,
      userId,
      revisionType: 'edit',
      body,
      payload: payload as Record<string, unknown> | undefined,
      status: 'pending',
    });

    try {
      await acquireForOutboundPost(tenantId, connector);
    } catch (gateErr) {
      const errCode = gateErr instanceof ClassifiableError ? gateErr.kind : 'network';
      const failedRev = await setRevisionFailed(tenantId, revision.id, errCode);
      return { revision: failedRev! };
    }

    const activitySummary: OutboundActivitySummary = {
      id: parent.id,
      tenantId: parent.tenantId,
      userId: parent.userId,
      providerId: parent.providerId,
      activityType: parent.activityType,
      targetAssetId: parent.targetAssetId,
      targetAssetType: parent.targetAssetType,
      externalId: parent.externalId,
      externalUrl: parent.externalUrl,
      body: parent.body,
      payload: parent.payload,
    };

    try {
      const editResult = await connector.edit(activitySummary, body, payload, credential);
      const applied = await setRevisionApplied(
        tenantId,
        revision.id,
        editResult.externalId ?? parent.externalId,
        editResult.externalUrl ?? parent.externalUrl
      );
      await setEdited(tenantId, activityId);
      return { revision: applied! };
    } catch (err) {
      const errorCode = err instanceof ClassifiableError ? err.kind : 'network';
      const failed = await setRevisionFailed(tenantId, revision.id, errorCode);
      return { revision: failed! };
    }
  }

  throw new OutboundRevisionError(`Cannot edit activity with status '${parent.status}'.`, 'CANNOT_EDIT_ACTIVITY', 409);
}

export async function deleteActivity(
  options: DeleteActivityOptions
): Promise<{ status: string; id?: string; revision?: OutboundActivityRevisionRow }> {
  const { tenantId, userId, role, activityId } = options;

  const parent = await getById(tenantId, activityId);
  if (!parent) {
    throw new OutboundRevisionError('Activity not found.', 'ACTIVITY_NOT_FOUND', 404);
  }

  // AC 7 / BRU-001 / BRU-002: only original author or tenant_admin in same tenant
  if (parent.userId !== userId && role !== 'tenant_admin') {
    throw new OutboundRevisionError('Only the original author or a tenant admin may delete this activity.', 'FORBIDDEN', 403);
  }

  // AC 4: If parent is pending, cancel without creating a revision
  if (parent.status === 'pending') {
    const cancelled = await cancel(tenantId, activityId);
    if (!cancelled) {
      throw new OutboundRevisionError('Failed to cancel pending activity.', 'CANCEL_FAILED', 409);
    }
    return { status: 'cancelled', id: activityId };
  }

  // AC 4: If parent is sent, create delete revision and call connector.delete?()
  if (parent.status === 'sent') {
    if (parent.deletedAt) {
      throw new OutboundRevisionError('Activity is already deleted.', 'ALREADY_DELETED', 409);
    }

    const connector = getSocialConnector(parent.providerId);
    if (!connector || !connector.delete) {
      throw new OutboundRevisionError('Deletion is not supported for this platform.', 'delete_not_supported', 422);
    }

    let credential = '';
    if (parent.credentialId) {
      try {
        credential = await readCredential(tenantId, parent.credentialId);
      } catch {
        // Fallback
      }
    }
    if (!credential) {
      const fallbackCredId = await getLatestCredentialId(tenantId, parent.providerId, 'user', userId);
      if (fallbackCredId) {
        try {
          credential = await readCredential(tenantId, fallbackCredId);
        } catch {
          // Leave empty
        }
      }
    }

    const revision = await createRevision({
      tenantId,
      activityId,
      userId,
      revisionType: 'delete',
      status: 'pending',
    });

    try {
      await acquireForOutboundPost(tenantId, connector);
    } catch (gateErr) {
      const errCode = gateErr instanceof ClassifiableError ? gateErr.kind : 'network';
      const failedRev = await setRevisionFailed(tenantId, revision.id, errCode);
      return { status: 'failed', revision: failedRev! };
    }

    const activitySummary: OutboundActivitySummary = {
      id: parent.id,
      tenantId: parent.tenantId,
      userId: parent.userId,
      providerId: parent.providerId,
      activityType: parent.activityType,
      targetAssetId: parent.targetAssetId,
      targetAssetType: parent.targetAssetType,
      externalId: parent.externalId,
      externalUrl: parent.externalUrl,
      body: parent.body,
      payload: parent.payload,
    };

    try {
      const delResult = await connector.delete(activitySummary, credential);
      const applied = await setRevisionApplied(
        tenantId,
        revision.id,
        delResult?.externalId ?? parent.externalId,
        delResult?.externalUrl ?? parent.externalUrl
      );
      await setDeleted(tenantId, activityId);
      return { status: 'applied', revision: applied! };
    } catch (err) {
      const errorCode = err instanceof ClassifiableError ? err.kind : 'network';
      const failed = await setRevisionFailed(tenantId, revision.id, errorCode);
      return { status: 'failed', revision: failed! };
    }
  }

  throw new OutboundRevisionError(`Cannot delete activity with status '${parent.status}'.`, 'CANNOT_DELETE_ACTIVITY', 409);
}

export async function getRevisions(
  tenantId: string,
  activityId: string
): Promise<OutboundActivityRevisionRow[]> {
  const parent = await getById(tenantId, activityId);
  if (!parent) {
    throw new OutboundRevisionError('Activity not found.', 'ACTIVITY_NOT_FOUND', 404);
  }
  return listRevisionsForActivity(tenantId, activityId);
}
