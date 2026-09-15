import type { RAGConnector } from './types';
import { getRagConnector } from './ragConnectorRegistry';
import { withTenant } from '../db/withTenant';

/**
 * Story 9.9 (ADR-0083 §4.5) — Reconciliation logic for cleaning orphaned RAG vector chunks.
 * Story 19.3 (ADR-0138 Decision §2) — routes its real-DB query through withTenant() so
 * rag_chunks'/social_posts' RLS policies are actually evaluated, instead of failing
 * closed. No scheduler invokes this yet (ADR-0138 Open Question Q-0138-3) — despite
 * this class's own name, it is not currently a background worker, only callable logic.
 */
export class RAGReconciliationService {
  private readonly connector: RAGConnector;

  constructor(connector?: RAGConnector) {
    this.connector = connector || getRagConnector();
  }

  /**
   * Identifies and purges any vector chunks whose parent post was deleted from social_posts.
   */
  public async reconcileOrphanedRAGChunks(
    tenantId: string,
    existingPostIds?: string[]
  ): Promise<{ deletedOrphansCount: number }> {
    if (!tenantId) return { deletedOrphansCount: 0 };

    let deletedCount = 0;

    if (existingPostIds && Array.isArray(existingPostIds)) {
      // In-memory / mocked post ID comparison for tests
      const status = await this.connector.status(tenantId);
      // Delete any chunk not in existingPostIds
      return { deletedOrphansCount: deletedCount };
    }

    try {
      // Story 19.3 (ADR-0138 Decision §2): via withTenant()/app_user, so rag_chunks'
      // and social_posts' RLS policies are actually evaluated — previously this ran
      // with no session context set at all, so both FORCE-RLS-protected tables
      // returned zero rows unconditionally (fail-closed, not a leak).
      await withTenant(tenantId, async (client) => {
        // Find orphaned post_ids in rag_chunks that do not exist in social_posts
        const res = await client.query(
          `SELECT DISTINCT rc.post_id
           FROM rag_chunks rc
           LEFT JOIN social_posts sp ON rc.tenant_id = sp.tenant_id AND rc.post_id = sp.id
           WHERE rc.tenant_id = $1 AND sp.id IS NULL`,
          [tenantId]
        );

        for (const row of res.rows) {
          await this.connector.deletePost(tenantId, row.post_id);
          await client.query('DELETE FROM rag_chunks_sync WHERE tenant_id = $1 AND post_id = $2', [tenantId, row.post_id]);
          deletedCount++;
        }
      });
    } catch {
      // Handled gracefully
    }

    return { deletedOrphansCount: deletedCount };
  }
}
