/**
 * Story 13.13 (ADR-0117 + ADR-0111) — Prospecting List Export Engine.
 *
 * Provides:
 * 1. Synchronous streaming CSV export for requests <= 5,000 rows (GET /v1/prospecting-lists/:id/export.csv).
 * 2. Asynchronous job-backed CSV export up to 100,000 rows (POST /v1/prospecting-lists/:id/export).
 */

import { createHash } from 'crypto';
import { withTenant } from '../db/withTenant';
import { getPool } from '../db/pool';
import { PoolClient } from 'pg';
import { uploadExportBlob, generatePresignedDownloadUrl } from '../archival/blobArchiveClient';
import { checkExportRateLimit, ExportRateScope } from '../posts/exportRateLimit';
import { listEntriesForExport, ProspectingListEntry } from './prospectingListStore';

const activeProspectingExportJobs = new Set<Promise<void>>();

export async function drainActiveProspectingExportJobs(): Promise<void> {
  if (activeProspectingExportJobs.size === 0) return;
  await Promise.all([...activeProspectingExportJobs]);
}

const CSV_SYNC_LIMIT = 5000;
const CSV_HARD_CAP = 100000;
const DEFAULT_FILE_SIZE_CAP_BYTES = 100 * 1024 * 1024;

const EXPORT_COLUMNS = [
  'author_id',
  'author_name',
  'platform_id',
  'public_url',
  'topic',
  'engagement_score',
  'authenticity_score',
  'influence_score',
  'relationship_stage',
  'notes',
  'tags',
];

function syncRowLimit(): number {
  return Number(process.env.EXPORT_SYNC_ROW_LIMIT ?? CSV_SYNC_LIMIT);
}

function asyncCsvMaxRows(): number {
  return Number(process.env.EXPORT_ASYNC_CSV_MAX_ROWS ?? CSV_HARD_CAP);
}

function maxFileBytes(): number {
  return Number(process.env.EXPORT_MAX_FILE_BYTES ?? DEFAULT_FILE_SIZE_CAP_BYTES);
}

function validateLimit(limit: number): { valid: boolean; code?: 'INVALID_LIMIT' } {
  if (!Number.isFinite(limit) || limit < 1) {
    return { valid: false, code: 'INVALID_LIMIT' };
  }
  if (limit > asyncCsvMaxRows()) {
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

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function formatCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return escapeCsvField(value.join(';'));
  return escapeCsvField(String(value));
}

function csvLineFromEntry(entry: ProspectingListEntry): string {
  const values = EXPORT_COLUMNS.map((col) => {
    const value = (entry as any)[col];
    return formatCsvValue(value);
  });
  return values.join(',');
}

async function* exportEntryRows(
  tenantId: string,
  userId: string,
  listId: string,
  limit: number
): AsyncGenerator<ProspectingListEntry> {
  let cursor: string | undefined;
  let yielded = 0;

  while (yielded < limit) {
    const batchLimit = Math.min(limit - yielded, 500);
    const { entries, nextCursor } = await listEntriesCursor(tenantId, userId, listId, batchLimit, cursor);
    for (const entry of entries) {
      yield entry;
      yielded++;
    }
    if (entries.length < batchLimit || !nextCursor) break;
    cursor = nextCursor;
  }
}

async function listEntriesCursor(
  tenantId: string,
  userId: string,
  listId: string,
  limit: number,
  cursor?: string
): Promise<{ entries: ProspectingListEntry[]; nextCursor: string | null }> {
  return withTenant<{ entries: ProspectingListEntry[]; nextCursor: string | null }>(
    tenantId,
    async (client: PoolClient) => {
      const params: any[] = [listId, tenantId, limit];
      let query = `
        SELECT * FROM prospecting_list_entries
        WHERE prospecting_list_id = $1 AND tenant_id = $2
      `;
      if (cursor) {
        query += ` AND added_at > $4`;
        params.push(cursor);
      }
      query += ` ORDER BY added_at ASC LIMIT $3`;

      const { rows } = await client.query(query, params);
      const hasMore = rows.length === limit;
      const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].added_at : null;
      return { entries: rows as ProspectingListEntry[], nextCursor };
    },
    getPool(),
    userId
  );
}

function makeBlobPath(tenantId: string, jobId: string): string {
  return `tenant-${tenantId}/prospecting-exports/${jobId}.csv`;
}

/**
 * Synchronous CSV export. Returns the full CSV string (headers + rows) for
 * requests within the sync limit.
 */
export async function fetchProspectingListForSyncExport(
  tenantId: string,
  userId: string,
  listId: string,
  limit = syncRowLimit()
): Promise<string> {
  if (limit > syncRowLimit()) {
    throw new ExportValidationError('INVALID_LIMIT', `Synchronous CSV limit cannot exceed ${syncRowLimit()}`);
  }

  const rate = checkExportRateLimit(tenantId, 'sync');
  if (!rate.allowed) {
    throw new ExportRateLimitError('sync');
  }

  const { total } = await listEntriesForExport(tenantId, userId, listId, { limit: asyncCsvMaxRows() + 1 });
  if (total > asyncCsvMaxRows()) {
    throw new ExportTooLargeError();
  }

  const lines: string[] = [EXPORT_COLUMNS.join(',')];
  for await (const entry of exportEntryRows(tenantId, userId, listId, limit)) {
    lines.push(csvLineFromEntry(entry));
  }
  return lines.join('\n');
}

async function renderExportContent(
  tenantId: string,
  userId: string,
  listId: string,
  limit: number
): Promise<{ content: string; rowCount: number }> {
  const lines: string[] = [EXPORT_COLUMNS.join(',')];
  let rowCount = 0;
  for await (const entry of exportEntryRows(tenantId, userId, listId, limit)) {
    lines.push(csvLineFromEntry(entry));
    rowCount++;
    if (Buffer.byteLength(lines.join('\n')) > maxFileBytes()) {
      throw new ExportFileTooLargeError();
    }
  }
  return { content: lines.join('\n'), rowCount };
}

interface ProspectingExportJobRecord {
  id: string;
  tenant_id: string;
  requested_by_user_id: string;
  status: 'pending' | 'running' | 'ready' | 'expired' | 'failed' | 'processing' | 'completed';
  format: 'csv';
  filters: Record<string, any>;
  row_count: number | null;
  blob_path: string | null;
  sha256: string | null;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateProspectingExportJobInput {
  listId: string;
  limit?: number;
}

/**
 * Create an async export job and return the pending record. The actual streaming
 * to Blob happens in the background so the HTTP response can return 202 immediately.
 */
export async function createProspectingListAsyncExportJob(
  tenantId: string,
  userId: string,
  input: CreateProspectingExportJobInput
): Promise<ProspectingExportJobRecord> {
  const limit = input.limit ?? asyncCsvMaxRows();

  if (!Number.isFinite(limit) || limit < 1) {
    throw new ExportValidationError('INVALID_LIMIT', `Invalid limit: ${limit}`);
  }
  if (limit > asyncCsvMaxRows()) {
    throw new ExportTooLargeError();
  }

  const rate = checkExportRateLimit(tenantId, 'async');
  if (!rate.allowed) {
    throw new ExportRateLimitError('async');
  }

  const { total } = await listEntriesForExport(tenantId, userId, input.listId, { limit: asyncCsvMaxRows() + 1 });
  if (total > asyncCsvMaxRows()) {
    throw new ExportTooLargeError();
  }

  return withTenant<ProspectingExportJobRecord>(
    tenantId,
    async (client: PoolClient) => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const filters = { prospectingListId: input.listId };

      const { rows } = await client.query<ProspectingExportJobRecord>(
        `INSERT INTO export_jobs (
           tenant_id, requested_by_user_id, status, format, filters, expires_at, created_at
         ) VALUES ($1, $2, 'pending', 'csv', $3, $4, now())
         RETURNING *`,
        [tenantId, userId, JSON.stringify(filters), expiresAt]
      );

      const job = rows[0];

      const jobPromise = processProspectingExportJob(tenantId, userId, job.id, input.listId, limit).catch((err) => {
        console.error(`Prospecting export job ${job.id} failed:`, err);
      });
      activeProspectingExportJobs.add(jobPromise);
      jobPromise.finally(() => activeProspectingExportJobs.delete(jobPromise));

      return job;
    },
    getPool(),
    userId
  );
}

async function processProspectingExportJob(
  tenantId: string,
  userId: string,
  jobId: string,
  listId: string,
  limit: number
): Promise<void> {
  const blobPath = makeBlobPath(tenantId, jobId);

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

    const { content, rowCount } = await renderExportContent(tenantId, userId, listId, limit);
    await uploadExportBlob(blobPath, content, tenantId, jobId);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const completedAt = new Date().toISOString();

    await withTenant<void>(
      tenantId,
      async (client: PoolClient) => {
        await client.query(
          `UPDATE export_jobs
           SET status = 'ready', row_count = $1, blob_path = $2, sha256 = $3, completed_at = $4
           WHERE id = $5 AND tenant_id = $6`,
          [rowCount, blobPath, sha256, completedAt, jobId, tenantId]
        );
      },
      getPool(),
      userId
    );
  } catch (err) {
    await withTenant<void>(
      tenantId,
      async (client: PoolClient) => {
        await client.query(
          `UPDATE export_jobs SET status = 'failed' WHERE id = $1 AND tenant_id = $2`,
          [jobId, tenantId]
        );
      },
      getPool(),
      userId
    );
    throw err;
  }
}
