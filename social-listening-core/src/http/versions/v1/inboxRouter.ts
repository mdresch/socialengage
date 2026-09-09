import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import {
  listInboxItems,
  getInboxItem,
  createInboxItem,
  updateInboxItem,
  assignInboxItem,
  snoozeInboxItem,
  resolveInboxItem,
  replyToInboxItem,
  InboxError,
} from '../../../inbox/inboxItemStore';

export const inboxRouter = Router();

/**
 * Story 11.9 (ADR-0099) — GET /v1/inbox (or /v1/inbox/items): lists filtered inbox items.
 */
inboxRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const assignedTo = typeof req.query.assignedTo === 'string' ? req.query.assignedTo : undefined;
  const providerId = typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
  const watchlistId = typeof req.query.watchlistId === 'string' ? req.query.watchlistId : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

  try {
    const result = await listInboxItems(tenantId, {
      status,
      priority,
      assignedTo,
      providerId,
      watchlistId,
      limit,
      offset,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list inbox items' });
  }
});

/**
 * Story 11.9 (ADR-0099) — POST /v1/inbox: creates a new inbox item.
 */
inboxRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const { postId, providerId, watchlistId, priority, sentiment, reach, notes, tags } = req.body || {};
  if (!postId || !providerId) {
    res.status(422).json({ error: 'postId and providerId are required.', code: 'INVALID_INPUT' });
    return;
  }

  try {
    const item = await createInboxItem(tenantId, {
      postId,
      providerId,
      watchlistId,
      priority,
      sentiment,
      reach,
      notes,
      tags,
    });
    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — GET /v1/inbox/:id: gets single inbox item.
 */
inboxRouter.get('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;
  const { id } = req.params as { id: string };

  try {
    const item = await getInboxItem(tenantId, id);
    res.json(item);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to get inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — PATCH /v1/inbox/:id: updates notes/tags/priority.
 */
inboxRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;
  const { id } = req.params as { id: string };
  const { notes, tags, priority } = req.body || {};

  try {
    const updated = await updateInboxItem(tenantId, id, { notes, tags, priority });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to update inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — POST /v1/inbox/:id/assign: assigns item to agent.
 */
inboxRouter.post('/:id/assign', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;
  const { id } = req.params as { id: string };
  const assignedTo = req.body?.assignedTo ?? null;

  try {
    const item = await assignInboxItem(tenantId, id, assignedTo);
    res.json(item);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to assign inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — POST /v1/inbox/:id/snooze: snoozes item.
 */
inboxRouter.post('/:id/snooze', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;
  const { id } = req.params as { id: string };
  const snoozedUntil = req.body?.snoozedUntil;

  if (!snoozedUntil) {
    res.status(422).json({ error: 'snoozedUntil timestamp is required.', code: 'INVALID_SNOOZE_TIME' });
    return;
  }

  try {
    const item = await snoozeInboxItem(tenantId, id, snoozedUntil);
    res.json(item);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to snooze inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — POST /v1/inbox/:id/resolve: resolves item.
 */
inboxRouter.post('/:id/resolve', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;
  const { id } = req.params as { id: string };
  const notes = req.body?.notes;

  try {
    const item = await resolveInboxItem(tenantId, id, notes);
    res.json(item);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to resolve inbox item' });
  }
});

/**
 * Story 11.9 (ADR-0099) — POST /v1/inbox/:id/reply: replies to post and resolves item.
 */
inboxRouter.post('/:id/reply', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;
  const { id } = req.params as { id: string };
  const body = req.body?.body;

  if (!body || !body.trim()) {
    res.status(422).json({ error: 'Reply body cannot be empty.', code: 'INVALID_REPLY_BODY' });
    return;
  }

  try {
    const result = await replyToInboxItem(tenantId, userId, id, body);
    res.json(result);
  } catch (err: any) {
    if (err instanceof InboxError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to reply to inbox item' });
  }
});
