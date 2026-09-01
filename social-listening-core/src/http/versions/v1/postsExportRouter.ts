import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  fetchPostsForSyncExport,
  createAsyncExportJob,
  getExportJobStatus,
  getExportJobDownloadUrl,
  ExportFilters,
  ExportValidationError,
  ExportRateLimitError,
  ExportTooLargeError,
  ExportFileTooLargeError,
} from '../../../posts/postExportEngine';
import { checkExportRateLimit } from '../../../posts/exportRateLimit';
import { requireFeatureGate } from '../../auth/featureGates';

export const postsExportRouter = Router();

// GET /v1/posts/export.csv (Story 10.8 / 13.4, ADR-0090 / ADR-0111) - Sync streaming export
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

  const requestedLimit = req.query.limit ? Number(req.query.limit) : 1000;

  const rate = checkExportRateLimit(identity.tenantId, 'sync');
  if (!rate.allowed) {
    res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
    return;
  }

  try {
    const csvContent = await fetchPostsForSyncExport(identity.tenantId, identity.userId, filters, requestedLimit);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="posts-export-${Date.now()}.csv"`);
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
    if (err instanceof ExportFileTooLargeError) {
      res.status(413).json({ code: 'EXPORT_FILE_TOO_LARGE' });
      return;
    }
    console.error('Error in GET /v1/posts/export.csv:', err);
    res.status(500).json({ error: err?.message || 'Failed to export posts CSV.' });
  }
});

// POST /v1/posts/export (Story 13.4, ADR-0111) - Async large export job
postsExportRouter.post('/export', requireFeatureGate('exports'), async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const format = (req.body?.format as 'csv' | 'json') ?? 'csv';
  const limit = req.body?.limit ? Number(req.body.limit) : 1000;
  const filters: ExportFilters = req.body?.filters || {};

  try {
    const job = await createAsyncExportJob(identity.tenantId, identity.userId, {
      format,
      limit,
      filters,
    });
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      expiresAt: job.expires_at,
      statusUrl: `/v1/exports/${job.id}/status`,
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
    console.error('Error in POST /v1/posts/export:', err);
    res.status(500).json({ error: err?.message || 'Failed to initiate export job.' });
  }
});

// GET /v1/posts/exports/:id (Story 13.4, ADR-0111) - ADR-0111 job status
postsExportRouter.get('/exports/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const job = await getExportJobStatus(identity.tenantId, identity.userId, req.params.id);
    if (!job) {
      res.status(404).json({ code: 'EXPORT_JOB_NOT_FOUND' });
      return;
    }
    res.json({
      jobId: job.id,
      status: job.status,
      format: job.format,
      rowCount: job.row_count,
      blobPath: job.blob_path,
      sha256: job.sha256,
      expiresAt: job.expires_at,
      completedAt: job.completed_at,
    });
  } catch (err: any) {
    if (err instanceof ExportRateLimitError) {
      res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
      return;
    }
    console.error('Error in GET /v1/posts/exports/:id:', err);
    res.status(500).json({ error: err?.message || 'Failed to get export job status.' });
  }
});

// GET /v1/posts/exports/:id/download (Story 13.4, ADR-0111) - Presigned download URL
postsExportRouter.get('/exports/:id/download', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const result = await getExportJobDownloadUrl(identity.tenantId, identity.userId, req.params.id);
    if (!result) {
      res.status(404).json({ code: 'EXPORT_JOB_NOT_FOUND' });
      return;
    }
    res.setHeader('Location', result.downloadUrl);
    res.setHeader('X-Download-URL', result.downloadUrl);
    res.status(302).end();
  } catch (err: any) {
    if (err instanceof ExportRateLimitError) {
      res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
      return;
    }
    if (err instanceof ExportValidationError) {
      res.status(400).json({ code: err.code, error: err.message });
      return;
    }
    console.error('Error in GET /v1/posts/exports/:id/download:', err);
    res.status(500).json({ error: err?.message || 'Failed to get export download URL.' });
  }
});

export const exportsStatusRouter = Router();

// GET /v1/exports/:jobId/status (Story 10.8, ADR-0090) - legacy status endpoint
exportsStatusRouter.get('/:jobId/status', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const job = await getExportJobStatus(identity.tenantId, identity.userId, req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Export job not found.' });
      return;
    }

    // Map ADR-0111 statuses to legacy Story 10.8 statuses to keep the old contract green.
    const legacyStatus =
      job.status === 'running'
        ? 'processing'
        : job.status === 'ready'
        ? 'completed'
        : job.status;

    res.json({
      jobId: job.id,
      status: legacyStatus,
      rowCount: job.row_count,
      downloadUrl: job.download_url,
      expiresAt: job.expires_at,
      completedAt: job.completed_at,
    });
  } catch (err: any) {
    if (err instanceof ExportRateLimitError) {
      res.status(429).json({ code: 'EXPORT_RATE_LIMITED' });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to get export job status.' });
  }
});
