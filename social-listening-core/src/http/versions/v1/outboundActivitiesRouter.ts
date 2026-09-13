import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import {
  editActivity,
  deleteActivity,
  getRevisions,
  OutboundRevisionError,
} from '../../../outbound/outboundActivityRevisionService';

export const outboundActivitiesRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Story 14.2 (ADR-0119) — PATCH /v1/outbound/activities/:id
 * Edits a published or pending outbound activity.
 */
outboundActivitiesRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) {
    res.status(404).json({ error: 'Activity not found.', code: 'NOT_FOUND' });
    return;
  }

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!body) {
    res.status(422).json({ error: 'Body is required and cannot be empty.', code: 'INVALID_BODY' });
    return;
  }

  try {
    const result = await editActivity({
      tenantId,
      userId,
      role,
      activityId: id,
      body,
      payload: req.body?.payload,
      targetAssetId: req.body?.targetAssetId,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof OutboundRevisionError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: 'Internal server error editing activity.' });
  }
});

/**
 * Story 14.2 (ADR-0119) — DELETE /v1/outbound/activities/:id
 * Deletes a sent activity (via connector delete) or cancels a pending activity.
 */
outboundActivitiesRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) {
    res.status(404).json({ error: 'Activity not found.', code: 'NOT_FOUND' });
    return;
  }

  try {
    const result = await deleteActivity({
      tenantId,
      userId,
      role,
      activityId: id,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof OutboundRevisionError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: 'Internal server error deleting activity.' });
  }
});

/**
 * Story 14.2 (ADR-0119) — GET /v1/outbound/activities/:id/revisions
 * Lists all revisions for an activity in descending chronological order.
 */
outboundActivitiesRouter.get('/:id/revisions', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) {
    res.status(404).json({ error: 'Activity not found.', code: 'NOT_FOUND' });
    return;
  }

  try {
    const revisions = await getRevisions(tenantId, id);
    res.status(200).json({ revisions });
  } catch (err) {
    if (err instanceof OutboundRevisionError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: 'Internal server error listing revisions.' });
  }
});
