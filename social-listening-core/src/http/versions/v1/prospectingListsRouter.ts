import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { requireFeatureGate } from '../../auth/featureGates';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  createProspectingList,
  listProspectingLists,
  getProspectingList,
  updateProspectingList,
  deleteProspectingList,
  addEntry,
  listEntries,
  updateEntry,
  deleteEntry,
} from '../../../prospecting/prospectingListStore';
import {
  fetchProspectingListForSyncExport,
  createProspectingListAsyncExportJob,
  ExportValidationError,
  ExportRateLimitError,
  ExportTooLargeError,
} from '../../../prospecting/prospectingListExportEngine';
import { pushProspectsToCRM } from '../../../crm/prospectingCRMHandoffService';

export const prospectingListsRouter = Router();

const VALID_STAGES = ['new', 'contacted', 'engaged', 'converted', 'passed'];

// POST /v1/prospecting-lists
prospectingListsRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, description, shared } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name is required.' });
    return;
  }

  try {
    const list = await createProspectingList(identity.tenantId, identity.userId, {
      name,
      description,
      shared,
    });
    res.status(201).json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create prospecting list.' });
  }
});

// GET /v1/prospecting-lists
prospectingListsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const lists = await listProspectingLists(identity.tenantId, identity.userId);
    res.json({ lists });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve prospecting lists.' });
  }
});

// GET /v1/prospecting-lists/:id/export.csv (Story 13.13, ADR-0117 / ADR-0111)
prospectingListsRouter.get('/:id/export.csv', requireFeatureGate('exports'), async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const listId = String(req.params.id);

  try {
    const list = await getProspectingList(identity.tenantId, identity.userId, listId);
    if (!list || list.owner_id !== identity.userId) {
      res.status(404).json({ error: 'Prospecting list not found.' });
      return;
    }

    const requestedLimit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const csvContent = await fetchProspectingListForSyncExport(
      identity.tenantId,
      identity.userId,
      list.id,
      requestedLimit
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="prospecting-list-${list.id}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    if (err instanceof ExportValidationError) {
      res.status(400).json({ code: err.code, error: err.message });
      return;
    }
    if (err instanceof ExportRateLimitError) {
      res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
      return;
    }
    if (err instanceof ExportTooLargeError) {
      res.status(422).json({ code: 'EXPORT_TOO_LARGE' });
      return;
    }
    console.error('Error in GET /v1/prospecting-lists/:id/export.csv:', err);
    res.status(500).json({ error: err?.message || 'Failed to export prospecting list CSV.' });
  }
});

// POST /v1/prospecting-lists/:id/export (Story 13.13, ADR-0117 / ADR-0111) - Async export
prospectingListsRouter.post('/:id/export', requireFeatureGate('exports'), async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const listId = String(req.params.id);

  try {
    const list = await getProspectingList(identity.tenantId, identity.userId, listId);
    if (!list || list.owner_id !== identity.userId) {
      res.status(404).json({ error: 'Prospecting list not found.' });
      return;
    }

    const limit = req.body?.limit ? Number(req.body.limit) : undefined;
    const job = await createProspectingListAsyncExportJob(identity.tenantId, identity.userId, {
      listId: list.id,
      limit,
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      expiresAt: job.expires_at,
      statusUrl: `/v1/posts/exports/${job.id}`,
    });
  } catch (err: any) {
    if (err instanceof ExportValidationError) {
      res.status(400).json({ code: err.code, error: err.message });
      return;
    }
    if (err instanceof ExportRateLimitError) {
      res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
      return;
    }
    if (err instanceof ExportTooLargeError) {
      res.status(422).json({ code: 'EXPORT_TOO_LARGE' });
      return;
    }
    console.error('Error in POST /v1/prospecting-lists/:id/export:', err);
    res.status(500).json({ error: err?.message || 'Failed to initiate prospecting list export job.' });
  }
});

// POST /v1/prospecting-lists/:id/crm-handoff (Story 13.13, ADR-0117)
prospectingListsRouter.post('/:id/crm-handoff', requireFeatureGate('prospecting_crm'), async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { crmConnectorId, caseType, selectedEntryIds, customFields } = req.body || {};

  if (!crmConnectorId || typeof crmConnectorId !== 'string') {
    res.status(400).json({ error: 'crmConnectorId is required.' });
    return;
  }

  if (caseType !== 'lead') {
    res.status(400).json({ error: "caseType must be 'lead'." });
    return;
  }

  const listId = String(req.params.id);

  try {
    const list = await getProspectingList(identity.tenantId, identity.userId, listId);
    if (!list || list.owner_id !== identity.userId) {
      res.status(404).json({ error: 'Prospecting list not found.' });
      return;
    }

    const result = await pushProspectsToCRM({
      tenantId: identity.tenantId,
      userId: identity.userId,
      listId: list.id,
      crmConnectorId,
      selectedEntryIds,
      customFields,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error in POST /v1/prospecting-lists/:id/crm-handoff:', err);
    res.status(500).json({ error: err?.message || 'Failed to push prospects to CRM.' });
  }
});

// GET /v1/prospecting-lists/:id
prospectingListsRouter.get('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const list = await getProspectingList(identity.tenantId, identity.userId, req.params.id);
    if (!list) {
      res.status(404).json({ error: 'Prospecting list not found.' });
      return;
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve prospecting list.' });
  }
});

// PATCH /v1/prospecting-lists/:id
prospectingListsRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, description, shared } = req.body || {};

  try {
    const list = await updateProspectingList(identity.tenantId, identity.userId, req.params.id, {
      name,
      description,
      shared,
    });
    if (!list) {
      res.status(404).json({ error: 'Prospecting list not found or not authorized.' });
      return;
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update prospecting list.' });
  }
});

// DELETE /v1/prospecting-lists/:id
prospectingListsRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const deleted = await deleteProspectingList(identity.tenantId, identity.userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Prospecting list not found or not authorized.' });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete prospecting list.' });
  }
});

// POST /v1/prospecting-lists/:id/entries
prospectingListsRouter.post('/:id/entries', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const {
    author_id,
    platform_id,
    author_name,
    public_url,
    topic,
    engagement_score,
    authenticity_score,
    influence_score,
    reach_score,
    relationship_stage,
    notes,
    tags,
    custom_attributes,
  } = req.body || {};

  if (!author_id || typeof author_id !== 'string') {
    res.status(400).json({ error: 'author_id is required.' });
    return;
  }

  if (relationship_stage && !VALID_STAGES.includes(relationship_stage)) {
    res.status(400).json({ error: `Invalid relationship_stage. Must be one of: ${VALID_STAGES.join(', ')}` });
    return;
  }

  try {
    const entry = await addEntry(identity.tenantId, identity.userId, req.params.id, {
      author_id,
      platform_id,
      author_name,
      public_url,
      topic,
      engagement_score,
      authenticity_score,
      influence_score,
      reach_score,
      relationship_stage,
      notes,
      tags,
      custom_attributes,
    });
    res.status(201).json(entry);
  } catch (err: any) {
    if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('uq_prospecting_list_author')) {
      res.status(409).json({ error: 'Author is already in this prospecting list.' });
      return;
    }
    if (err.code === '23503') {
      res.status(404).json({ error: 'Prospecting list or author not found.' });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to add entry.' });
  }
});

// GET /v1/prospecting-lists/:id/entries
prospectingListsRouter.get('/:id/entries', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  try {
    const list = await getProspectingList(identity.tenantId, identity.userId, req.params.id);
    if (!list) {
      res.status(404).json({ error: 'Prospecting list not found.' });
      return;
    }

    const result = await listEntries(identity.tenantId, identity.userId, req.params.id, {
      limit,
      cursor,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve entries.' });
  }
});

// PATCH /v1/prospecting-lists/:id/entries/:entryId
prospectingListsRouter.patch('/:id/entries/:entryId', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { relationship_stage, notes, tags, custom_attributes } = req.body || {};

  if (relationship_stage && !VALID_STAGES.includes(relationship_stage)) {
    res.status(400).json({ error: `Invalid relationship_stage. Must be one of: ${VALID_STAGES.join(', ')}` });
    return;
  }

  try {
    const entry = await updateEntry(
      identity.tenantId,
      identity.userId,
      req.params.id,
      req.params.entryId,
      {
        relationship_stage,
        notes,
        tags,
        custom_attributes,
      }
    );
    if (!entry) {
      res.status(404).json({ error: 'Entry not found or not authorized.' });
      return;
    }
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update entry.' });
  }
});

// DELETE /v1/prospecting-lists/:id/entries/:entryId
prospectingListsRouter.delete('/:id/entries/:entryId', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const deleted = await deleteEntry(
      identity.tenantId,
      identity.userId,
      req.params.id,
      req.params.entryId
    );
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found or not authorized.' });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete entry.' });
  }
});
