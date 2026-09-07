/**
 * Story 13.4 (ADR-0111) — Posts Data Export Engine.
 *
 * Provides:
 * 1. Synchronous streaming CSV export for requests <= 5,000 rows (GET /v1/posts/export.csv).
 * 2. Asynchronous job-backed CSV/JSON export up to 100,000 CSV / 10,000 JSON rows (POST /v1/posts/export).
 * 3. Status tracking and presigned download resolution (GET /v1/posts/exports/:id, /:id/download).
 */

import { createHash } from 'crypto';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';
import { uploadExportBlob, generatePresignedDownloadUrl } from '../archival/blobArchiveClient';
import { checkExportRateLimit, ExportRateScope } from './exportRateLimit';

const activeExportJobs = new Set<Promise<void>>();

export async function drainActiveExportJobs(): Promise<void> {
  if (activeExportJobs.size === 0) return;
  await Promise.all([...activeExportJobs]);
}

export interface ExportFilters {
  watchlistId?: string;
  platformId?: string;
  startDate?: string;
  endDate?: string;
  sentiment?: string;
  sample?: boolean;
}

export const MAX_EXPORT_LOOKBACK_MONTHS = 24;

export function validateLookbackWindow(
  start?: string,
  end?: string
): { valid: boolean; code?: string; error?: string } {
  if (!start && !end) {
    return { valid: true };
  }

  let startDate: Date;
  let endDate: Date;

  if (start) {
    startDate = new Date(start);
    if (isNaN(startDate.getTime())) {
      return { valid: false, code: 'INVALID_DATE_FORMAT', error: `Invalid start date format: ${start}` };
    }
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - MAX_EXPORT_LOOKBACK_MONTHS);
  }

  if (end) {
    endDate = new Date(end);
    if (isNaN(endDate.getTime())) {
      return { valid: false, code: 'INVALID_DATE_FORMAT', error: `Invalid end date format: ${end}` };
    }
  } else {
    endDate = new Date();
  }

  if (startDate.getTime() > endDate.getTime()) {
    return { valid: false, code: 'INVALID_DATE_RANGE', error: 'Start date cannot be after end date.' };
  }

  const maxAllowedEnd = new Date(startDate);
  maxAllowedEnd.setMonth(maxAllowedEnd.getMonth() + MAX_EXPORT_LOOKBACK_MONTHS);
  const maxAllowedEndMs = maxAllowedEnd.getTime() + 86400000; // 1-day margin for DST/TZ

  if (endDate.getTime() > maxAllowedEndMs) {
    return {
      valid: false,
      code: 'EXPORT_RANGE_TOO_LARGE',
      error: `Date range exceeds maximum lookback of ${MAX_EXPORT_LOOKBACK_MONTHS} months.`,
    };
  }

  return { valid: true };
}

export interface ExportJobRecord {
  id: string;
  tenant_id: string;
  requested_by_user_id: string;
  status: 'pending' | 'running' | 'ready' | 'expired' | 'failed' | 'processing' | 'completed';
  format: 'csv' | 'json';
  filters: ExportFilters;
  row_count: number | null;
  blob_path: string | null;
  sha256: string | null;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateExportJobInput {
  format: 'csv' | 'json';
  limit: number;
  filters?: ExportFilters;
}

const CSV_SYNC_LIMIT = 5000;
const CSV_HARD_CAP = 100000;
const JSON_HARD_CAP = 10000;
const DEFAULT_FILE_SIZE_CAP_BYTES = 100 * 1024 * 1024;

function syncRowLimit(): number {
  return Number(process.env.EXPORT_SYNC_ROW_LIMIT ?? CSV_SYNC_LIMIT);
}

function asyncCsvMaxRows(): number {
  return Number(process.env.EXPORT_ASYNC_CSV_MAX_ROWS ?? CSV_HARD_CAP);
}

function asyncJsonMaxRows(): number {
  return Number(process.env.EXPORT_ASYNC_JSON_MAX_ROWS ?? JSON_HARD_CAP);
}

function maxFileBytes(): number {
  return Number(process.env.EXPORT_MAX_FILE_BYTES ?? DEFAULT_FILE_SIZE_CAP_BYTES);
}

function formatCap(format: 'csv' | 'json'): number {
  return format === 'csv' ? CSV_HARD_CAP : JSON_HARD_CAP;
}

function shouldBeAsync(format: 'csv' | 'json', limit: number): boolean {
  if (format === 'json') return true; // JSON is always async
  return limit > syncRowLimit();
}

function validateLimit(format: 'csv' | 'json', limit: number): { valid: boolean; code?: 'INVALID_LIMIT' } {
  if (!Number.isFinite(limit) || limit < 1) {
    return { valid: false, code: 'INVALID_LIMIT' };
  }
  if (limit > formatCap(format)) {
    return { valid: false, code: 'INVALID_LIMIT' };
  }
  return { valid: true };
}

export class ExportValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ExportValidationError';
  }
}

export class ExportRateLimitError extends Error {
  constructor(public readonly scope: ExportRateScope) {
    super(`Export rate limit exceeded for scope ${scope}`);
    this.name = 'ExportRateLimitError';
  }
}

export class ExportTooLargeError extends Error {
  constructor() {
    super('Matched set exceeds the export cap');
    this.name = 'ExportTooLargeError';
  }
}

export class ExportFileTooLargeError extends Error {
  constructor() {
    super('Export file exceeds the maximum allowed size');
    this.name = 'ExportFileTooLargeError';
  }
}

function buildWhereClauses(filters: ExportFilters, params: any[]): { whereClauses: string[]; join: string } {
  const whereClauses: string[] = ['sp.tenant_id = $1'];
  let paramIdx = params.length + 1;

  if (filters.startDate) {
    whereClauses.push(`sp.published_at >= $${paramIdx++}::timestamptz`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    whereClauses.push(`sp.published_at <= $${paramIdx++}::timestamptz`);
    params.push(filters.endDate);
  }
  if (filters.platformId) {
    whereClauses.push(`COALESCE(sp.raw_payload->>'providerId', 'unknown') = $${paramIdx++}`);
    params.push(filters.platformId);
  }
  if (filters.sentiment) {
    whereClauses.push(`COALESCE(sp.enrichment->>'sentiment', 'neutral') = $${paramIdx++}`);
    params.push(filters.sentiment);
  }

  let join = '';
  if (filters.watchlistId) {
    join = `JOIN post_watchlist_matches pwm ON pwm.post_id = sp.id AND pwm.watchlist_id = $${paramIdx++}::uuid`;
    params.push(filters.watchlistId);
  }

  return { whereClauses, join };
}

/**
 * Counts the matched posts for an export, bounded by the requested limit plus one
 * to detect overflow without a full count scan.
 */
async function countMatchedPosts(
  tenantId: string,
  userId: string,
  filters: ExportFilters,
  limit: number
): Promise<number> {
  return withTenant<number>(
    tenantId,
    async (client: PoolClient) => {
      const params: any[] = [tenantId];
      const { whereClauses, join } = buildWhereClauses(filters, params);
      params.push(limit + 1);
      const limitIdx = params.length;

      const sql = `
        SELECT COUNT(*)::int as count
        FROM (
          SELECT 1
          FROM social_posts sp
          ${join}
          WHERE ${whereClauses.join(' AND ')}
          LIMIT $${limitIdx}
        ) sub
      `;
      const { rows } = await client.query<{ count: number }>(sql, params);
      return rows[0].count;
    },
    getPool(),
    userId
  );
}

/**
 * Queries the posts for an export. Uses a Postgres cursor to stream rows back
 * without fully materializing the result set in memory (ADR-0111 streaming).
 */
async function* exportPostRows(
  tenantId: string,
  userId: string,
  filters: ExportFilters,
  limit: number
): AsyncGenerator<Record<string, unknown>> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    if (userId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    }

    const params: any[] = [tenantId];
    const { whereClauses, join } = buildWhereClauses(filters, params);
    const cursorName = `export_cursor_${tenantId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const limitIdx = params.length + 1;
    params.push(limit);

    const declareSql = `
      DECLARE ${cursorName} CURSOR FOR
      SELECT
        sp.id,
        sp.published_at,
        COALESCE(sp.raw_payload->>'providerId', 'unknown') AS platform,
        COALESCE(sp.enrichment->>'sentiment', 'neutral') AS sentiment,
        sp.author_follower_count_at_publish AS author_followers,
        sp.body_markdown AS content
      FROM social_posts sp
      ${join}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY sp.published_at DESC
      LIMIT $${limitIdx}
    `;

    await client.query(declareSql, params);

    let more = true;
    while (more) {
      const { rows } = await client.query<{ id: string; published_at: Date; platform: string; sentiment: string; author_followers: number | null; content: string | null }>(
        `FETCH 100 FROM ${cursorName}`
      );
      if (rows.length === 0) {
        more = false;
        break;
      }
      for (const row of rows) {
        yield row;
      }
    }

    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function csvLineFromRow(row: Record<string, unknown>): string {
  const publishedAt = row.published_at ? new Date(row.published_at as string | Date).toISOString() : '';
  const line = [
    row.id,
    publishedAt,
    row.platform || '',
    row.sentiment || '',
    row.author_followers ?? '',
    escapeCsvField((row.content as string) || ''),
  ];
  return line.join(',');
}

function jsonRowFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    published_at: row.published_at ? new Date(row.published_at as string | Date).toISOString() : null,
    platform: row.platform || 'unknown',
    sentiment: row.sentiment || 'neutral',
    author_followers: row.author_followers ?? null,
    body_markdown: row.content || '',
  };
}

async function countTotalMatchedPosts(
  tenantId: string,
  userId: string,
  filters: ExportFilters
): Promise<number> {
  return withTenant<number>(
    tenantId,
    async (client: PoolClient) => {
      const params: any[] = [tenantId];
      const { whereClauses, join } = buildWhereClauses(filters, params);

      const sql = `
        SELECT COUNT(*)::int as count
        FROM social_posts sp
        ${join}
        WHERE ${whereClauses.join(' AND ')}
      `;
      const { rows } = await client.query<{ count: number }>(sql, params);
      return rows[0].count;
    },
    getPool(),
    userId
  );
}

async function* exportSampledPostRows(
  tenantId: string,
  userId: string,
  filters: ExportFilters,
  stride: number,
  limit: number
): AsyncGenerator<Record<string, unknown>> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    if (userId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    }

    const params: any[] = [tenantId];
    const { whereClauses, join } = buildWhereClauses(filters, params);
    const cursorName = `export_sample_cursor_${tenantId.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const strideIdx = params.length + 1;
    params.push(stride);
    const limitIdx = params.length + 1;
    params.push(limit);

    const declareSql = `
      DECLARE ${cursorName} CURSOR FOR
      WITH ranked_posts AS (
        SELECT
          sp.id,
          sp.published_at,
          COALESCE(sp.raw_payload->>'providerId', 'unknown') AS platform,
          COALESCE(sp.enrichment->>'sentiment', 'neutral') AS sentiment,
          sp.author_follower_count_at_publish AS author_followers,
          sp.body_markdown AS content,
          ROW_NUMBER() OVER (ORDER BY sp.published_at DESC) AS row_num
        FROM social_posts sp
        ${join}
        WHERE ${whereClauses.join(' AND ')}
      )
      SELECT
        id,
        published_at,
        platform,
        sentiment,
        author_followers,
        content
      FROM ranked_posts
      WHERE (row_num % $${strideIdx}) = 0
      ORDER BY published_at DESC
      LIMIT $${limitIdx}
    `;

    await client.query(declareSql, params);

    let more = true;
    while (more) {
      const { rows } = await client.query<{
        id: string;
        published_at: Date;
        platform: string;
        sentiment: string;
        author_followers: number | null;
        content: string | null;
      }>(`FETCH 100 FROM ${cursorName}`);
      if (rows.length === 0) {
        more = false;
        break;
      }
      for (const row of rows) {
        yield row;
      }
    }

    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface SyncExportResult {
  csv: string;
  isSampled: boolean;
  sampleFraction?: number;
  totalMatched?: number;
  sampleSize?: number;
}

/**
 * Synchronous CSV export. Returns the full CSV string (headers + rows) for
 * requests within the sync limit, or a representative systematic sample if sample=true.
 */
export async function fetchPostsForSyncExport(
  tenantId: string,
  userId: string,
  filters: ExportFilters,
  limit = 5000,
  sample = false
): Promise<SyncExportResult> {
  const syncCap = syncRowLimit();
  if (limit > syncCap) {
    throw new ExportValidationError('INVALID_LIMIT', `Synchronous CSV limit cannot exceed ${syncCap}`);
  }

  if (sample) {
    const totalMatched = await countTotalMatchedPosts(tenantId, userId, filters);

    if (totalMatched <= limit) {
      const lines: string[] = [
        `# socialengage_export: sampled=false; sample_fraction=1.0; total_matched=${totalMatched}; sample_size=${totalMatched}`,
        'id,published_at,platform,sentiment,author_followers,content',
      ];
      for await (const row of exportPostRows(tenantId, userId, filters, limit)) {
        lines.push(csvLineFromRow(row));
      }
      return {
        csv: lines.join('\n'),
        isSampled: false,
        sampleFraction: 1.0,
        totalMatched,
        sampleSize: totalMatched,
      };
    }

    const stride = Math.max(1, Math.floor(totalMatched / limit));
    const sampleFraction = Number((limit / totalMatched).toFixed(4));
    const lines: string[] = [
      `# socialengage_export: sampled=true; sample_fraction=${sampleFraction}; total_matched=${totalMatched}; sample_size=${limit}`,
      'id,published_at,platform,sentiment,author_followers,content',
    ];
    let count = 0;
    for await (const row of exportSampledPostRows(tenantId, userId, filters, stride, limit)) {
      lines.push(csvLineFromRow(row));
      count++;
    }

    return {
      csv: lines.join('\n'),
      isSampled: true,
      sampleFraction,
      totalMatched,
      sampleSize: count,
    };
  }

  const cap = asyncCsvMaxRows();
  const matched = await countMatchedPosts(tenantId, userId, filters, limit);
  if (matched > cap) {
    throw new ExportTooLargeError();
  }

  const lines: string[] = ['id,published_at,platform,sentiment,author_followers,content'];
  for await (const row of exportPostRows(tenantId, userId, filters, limit)) {
    lines.push(csvLineFromRow(row));
  }
  return {
    csv: lines.join('\n'),
    isSampled: false,
    sampleFraction: 1.0,
    totalMatched: lines.length - 1,
    sampleSize: lines.length - 1,
  };
}

function makeBlobPath(tenantId: string, jobId: string, format: 'csv' | 'json'): string {
  const extension = format === 'csv' ? 'csv' : 'json';
  return `tenant-${tenantId}/exports/${jobId}.${extension}`;
}

async function renderExportContent(
  tenantId: string,
  userId: string,
  format: 'csv' | 'json',
  filters: ExportFilters,
  limit: number
): Promise<{ content: string; rowCount: number }> {
  if (format === 'csv') {
    const lines: string[] = ['id,published_at,platform,sentiment,author_followers,content'];
    let rowCount = 0;
    for await (const row of exportPostRows(tenantId, userId, filters, limit)) {
      lines.push(csvLineFromRow(row));
      rowCount++;
      if (Buffer.byteLength(lines.join('\n')) > maxFileBytes()) {
        throw new ExportFileTooLargeError();
      }
    }
    return { content: lines.join('\n'), rowCount };
  }

  // JSON format
  const rows: Record<string, unknown>[] = [];
  for await (const row of exportPostRows(tenantId, userId, filters, limit)) {
    rows.push(jsonRowFromRow(row));
    if (Buffer.byteLength(JSON.stringify(rows)) > maxFileBytes()) {
      throw new ExportFileTooLargeError();
    }
  }
  return { content: JSON.stringify(rows, null, 2), rowCount: rows.length };
}

/**
 * Create an async export job and return the pending record. The actual streaming
 * to Blob happens in the background so the HTTP response can return 202 immediately.
 */
export async function createAsyncExportJob(
  tenantId: string,
  userId: string,
  input: CreateExportJobInput
): Promise<ExportJobRecord> {
  const format = input.format ?? 'csv';
  const limit = input.limit ?? (format === 'csv' ? syncRowLimit() : 1000);

  const limitCheck = validateLimit(format, limit);
  if (!limitCheck.valid) {
    throw new ExportValidationError(limitCheck.code!, `Invalid limit: ${limit}`);
  }

  const rate = checkExportRateLimit(tenantId, 'async');
  if (!rate.allowed) {
    throw new ExportRateLimitError('async');
  }

  const cap = format === 'csv' ? asyncCsvMaxRows() : asyncJsonMaxRows();
  const matched = await countMatchedPosts(tenantId, userId, input.filters ?? {}, limit);
  if (matched > cap) {
    throw new ExportTooLargeError();
  }

  return withTenant<ExportJobRecord>(
    tenantId,
    async (client: PoolClient) => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { rows } = await client.query<ExportJobRecord>(
        `INSERT INTO export_jobs (
           tenant_id, requested_by_user_id, status, format, filters, expires_at, created_at
         ) VALUES ($1, $2, 'pending', $3, $4, $5, now())
         RETURNING *`,
        [tenantId, userId, format, JSON.stringify(input.filters ?? {}), expiresAt]
      );

      const job = rows[0];

      // Process in the background so the HTTP 202 response is sent immediately.
      // Track the promise so contract tests can drain active jobs before closing pools.
      const jobPromise = processExportJob(tenantId, userId, job.id, format, input.filters ?? {}, limit).catch((err) => {
        console.error(`Export job ${job.id} failed:`, err);
      });
      activeExportJobs.add(jobPromise);
      jobPromise.finally(() => activeExportJobs.delete(jobPromise));

      return job;
    },
    getPool(),
    userId
  );
}

async function processExportJob(
  tenantId: string,
  userId: string,
  jobId: string,
  format: 'csv' | 'json',
  filters: ExportFilters,
  limit: number
): Promise<void> {
  const blobPath = makeBlobPath(tenantId, jobId, format);

  try {
    await withTenant<void>(
      tenantId,
      async (client: PoolClient) => {
        await client.query(
          `UPDATE export_jobs SET status = 'running' WHERE id = $1 AND tenant_id = $2`,
          [jobId, tenantId]
        );
      },
      getPool(),
      userId
    );

    const { content, rowCount } = await renderExportContent(tenantId, userId, format, filters, limit);
    const sha256 = createHash('sha256').update(content).digest('hex');

    await uploadExportBlob(blobPath, content, tenantId, jobId);

    await withTenant<void>(
      tenantId,
      async (client: PoolClient) => {
        await client.query(
          `UPDATE export_jobs
           SET status = 'ready',
               row_count = $1,
               blob_path = $2,
               sha256 = $3,
               completed_at = now()
           WHERE id = $4 AND tenant_id = $5`,
          [rowCount, blobPath, sha256, jobId, tenantId]
        );
      },
      getPool(),
      userId
    );
  } catch (err: any) {
    await withTenant<void>(
      tenantId,
      async (client: PoolClient) => {
        await client.query(
          `UPDATE export_jobs SET status = 'failed', error_message = $1 WHERE id = $2 AND tenant_id = $3`,
          [err?.message || 'Export processing failed', jobId, tenantId]
        );
      },
      getPool(),
      userId
    );
  }
}

export async function getExportJobStatus(
  tenantId: string,
  userId: string,
  jobId: string
): Promise<ExportJobRecord | null> {
  const rate = checkExportRateLimit(tenantId, 'status');
  if (!rate.allowed) {
    throw new ExportRateLimitError('status');
  }

  return withTenant<ExportJobRecord | null>(
    tenantId,
    async (client: PoolClient) => {
      const { rows } = await client.query<ExportJobRecord>(
        `SELECT * FROM export_jobs WHERE id = $1 AND tenant_id = $2`,
        [jobId, tenantId]
      );
      const job = rows[0] || null;

      if (job && job.expires_at && new Date(job.expires_at).getTime() < Date.now()) {
        await client.query(`UPDATE export_jobs SET status = 'expired' WHERE id = $1`, [jobId]);
        job.status = 'expired';
      }

      return job;
    },
    getPool(),
    userId
  );
}

/**
 * Returns a 24-hour presigned download URL for a ready export job. The caller
 * must ensure the caller has already passed tenant authorization.
 */
export async function getExportJobDownloadUrl(
  tenantId: string,
  userId: string,
  jobId: string
): Promise<{ blobPath: string; downloadUrl: string } | null> {
  const rate = checkExportRateLimit(tenantId, 'download');
  if (!rate.allowed) {
    throw new ExportRateLimitError('download');
  }

  const job = await getExportJobStatus(tenantId, userId, jobId);
  if (!job) return null;
  if (job.status !== 'ready') {
    throw new ExportValidationError('EXPORT_NOT_READY', 'Export job is not ready for download');
  }
  if (!job.blob_path) {
    return null;
  }

  const downloadUrl = await generatePresignedDownloadUrl(job.blob_path);

  // Cache the generated URL on the job row for the legacy status endpoint.
  await withTenant<void>(
    tenantId,
    async (client: PoolClient) => {
      await client.query(
        `UPDATE export_jobs SET download_url = $1 WHERE id = $2 AND tenant_id = $3`,
        [downloadUrl, jobId, tenantId]
      );
    },
    getPool(),
    userId
  );

  return { blobPath: job.blob_path, downloadUrl };
}
