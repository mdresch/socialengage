import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  fetchPostsForSyncExport,
  createAsyncExportJob,
  getExportJobStatus,
  ExportFilters,
} from '../../../posts/postExportEngine';

export const postsExportRouter = Router();

// GET /v1/posts/export.csv (Story 10.8, ADR-0090) - Sync streaming export
postsExportRouter.get('/export.csv', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const filters: ExportFilters = {
    watchlistId: req.query.watchlist_id ? String(req.query.watchlist_id) : undefined,
    platformId: req.query.platform_id ? String(req.query.platform_id) : undefined,
    startDate: req.query.start_date ? String(req.query.start_date) : undefined,
    endDate: req.query.end_date ? String(req.query.end_date) : undefined,
    sentiment: req.query.sentiment ? String(req.query.sentiment) : undefined,
  };

  try {
    const csvContent = await fetchPostsForSyncExport(identity.tenantId, identity.userId, filters, 5000);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="posts-export-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('Error in GET /v1/posts/export.csv:', err);
    res.status(500).json({ error: err?.message || 'Failed to export posts CSV.' });
  }
});

// POST /v1/posts/export (Story 10.8, ADR-0090) - Async large export job
postsExportRouter.post('/export', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const filters: ExportFilters = req.body?.filters || {};

  try {
    const job = await createAsyncExportJob(identity.tenantId, identity.userId, filters);
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      expiresAt: job.expires_at,
      statusUrl: `/v1/exports/${job.id}/status`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to initiate export job.' });
  }
});

export const exportsStatusRouter = Router();

// GET /v1/exports/:jobId/status (Story 10.8, ADR-0090)
exportsStatusRouter.get('/:jobId/status', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const job = await getExportJobStatus(identity.tenantId, identity.userId, req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Export job not found.' });
      return;
    }
    res.json({
      jobId: job.id,
      status: job.status,
      rowCount: job.row_count,
      downloadUrl: job.download_url,
      expiresAt: job.expires_at,
      completedAt: job.completed_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get export job status.' });
  }
});
