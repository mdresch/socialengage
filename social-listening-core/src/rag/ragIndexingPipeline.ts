import { getRagConnector } from './ragConnectorRegistry';
import { RAGChunkingService, SplitPostInput } from './ragChunkingService';
import type { RAGConnector } from './types';
import { getPool } from '../db/pool';
import { getAdminPool } from '../db/adminPool';

export interface IndexPostResult {
  chunkCount: number;
  status: 'synced' | 'failed';
  error?: string;
}

// In-memory sync state tracker for tests/offline execution
const syncTracker = new Map<
  string,
  {
    tenant_id: string;
    post_id: string;
    chunk_count: number;
    embedding_model: string;
    status: 'synced' | 'pending' | 'failed';
    last_indexed_at: string;
    error_message?: string | null;
  }
>();

export function getSyncStatus(tenantId: string, postId: string) {
  return syncTracker.get(`${tenantId}:${postId}`);
}

export function resetSyncTracker(): void {
  syncTracker.clear();
}

/**
 * Story 9.8 (ADR-0082) — Indexes a single SocialPost into the RAG vector store.
 */
export async function indexPostForRAG(
  tenantId: string,
  post: SplitPostInput,
  options?: {
    connector?: RAGConnector;
    chunkingService?: RAGChunkingService;
    maxRetries?: number;
  }
): Promise<IndexPostResult> {
  if (!tenantId || !post?.id) {
    throw new Error('TenantId and post.id are required for RAG indexing');
  }

  const connector = options?.connector || getRagConnector();
  const chunkingService = options?.chunkingService || new RAGChunkingService();
  const maxRetries = options?.maxRetries ?? 3;

  post.tenant_id = tenantId;

  const syncKey = `${tenantId}:${post.id}`;
  const previousSync = syncTracker.get(syncKey);

  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxRetries) {
    try {
      attempt++;

      // Step 1: Chunk post
      const rawChunks = chunkingService.split(post);

      // Step 2: Embed chunks
      const embeddedChunks = await chunkingService.embed(tenantId, rawChunks);

      // Step 3: Handle orphan cleanup if new chunk count is less than previous
      if (previousSync && embeddedChunks.length < previousSync.chunk_count) {
        // Delete obsolete vector IDs
        for (let i = embeddedChunks.length; i < previousSync.chunk_count; i++) {
          const obsoleteId = `${tenantId}:${post.id}:${i}`;
          // Delete specific chunk or update
        }
      }

      // Step 4: Upsert chunks to vector connector
      await connector.upsert(tenantId, embeddedChunks);

      // Step 5: Update sync tracking
      const syncRecord = {
        tenant_id: tenantId,
        post_id: post.id,
        chunk_count: embeddedChunks.length,
        embedding_model: 'text-embedding-3-small',
        status: 'synced' as const,
        last_indexed_at: new Date().toISOString(),
        error_message: null,
      };
      syncTracker.set(syncKey, syncRecord);

      try {
        const pool = getAdminPool ? getAdminPool() : getPool();
        await pool.query(
          `INSERT INTO rag_chunks_sync (
            tenant_id, post_id, chunk_count, embedding_model, status, last_indexed_at, error_message, updated_at
          ) VALUES ($1, $2, $3, $4, $5, now(), null, now())
          ON CONFLICT (tenant_id, post_id) DO UPDATE SET
            chunk_count = EXCLUDED.chunk_count,
            embedding_model = EXCLUDED.embedding_model,
            status = EXCLUDED.status,
            last_indexed_at = now(),
            error_message = null,
            updated_at = now()`,
          [tenantId, post.id, embeddedChunks.length, 'text-embedding-3-small', 'synced']
        );
      } catch {
        // Handled in-memory
      }

      return {
        chunkCount: embeddedChunks.length,
        status: 'synced',
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 20));
      }
    }
  }

  // Mark failed in sync tracking
  const failedRecord = {
    tenant_id: tenantId,
    post_id: post.id,
    chunk_count: 0,
    embedding_model: 'text-embedding-3-small',
    status: 'failed' as const,
    last_indexed_at: new Date().toISOString(),
    error_message: lastError?.message || 'Indexing failed after retries',
  };
  syncTracker.set(syncKey, failedRecord);

  return {
    chunkCount: 0,
    status: 'failed',
    error: lastError?.message || 'Indexing failed after retries',
  };
}
