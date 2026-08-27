import { getAdminPool } from '../db/adminPool';
import { indexPostForRAG } from './ragIndexingPipeline';

/**
 * Backfills existing social_posts into the RAG vector store (rag_chunks table).
 */
export async function backfillRAG(tenantId?: string): Promise<{ indexed: number; failed: number }> {
  const pool = getAdminPool();
  let query = `
    SELECT sp.id,
           sp.tenant_id,
           sp.raw_payload,
           sp.body_markdown,
           sp.published_at,
           sp.enrichment,
           COALESCE(array_agg(pwm.watchlist_id) FILTER (WHERE pwm.watchlist_id IS NOT NULL), '{}') as watchlist_ids
    FROM social_posts sp
    LEFT JOIN post_watchlist_matches pwm ON sp.tenant_id = pwm.tenant_id AND sp.id = pwm.post_id
  `;
  const params: any[] = [];
  if (tenantId) {
    query += ' WHERE sp.tenant_id = $1';
    params.push(tenantId);
  }
  query += ' GROUP BY sp.id, sp.tenant_id, sp.raw_payload, sp.body_markdown, sp.published_at, sp.enrichment';

  const res = await pool.query(query, params);
  let indexed = 0;
  let failed = 0;

  console.log(`[RAG Backfill] Found ${res.rows.length} posts to index into RAG vector store...`);

  for (const row of res.rows) {
    try {
      const raw = row.raw_payload && typeof row.raw_payload === 'object' ? row.raw_payload : {};
      const title = raw.title || raw.text || null;
      const platformId = raw.providerId || raw.platformId || raw.provider || 'unknown';
      const enrichment = row.enrichment && typeof row.enrichment === 'object' ? row.enrichment : {};
      const sentiment = enrichment.sentiment || raw.sentiment || null;
      const topics = Array.isArray(enrichment.topics) ? enrichment.topics : [];

      const post = {
        id: row.id,
        tenant_id: row.tenant_id,
        title,
        body_markdown: row.body_markdown || title || '',
        platform_id: platformId,
        published_at: row.published_at instanceof Date ? row.published_at.toISOString() : (row.published_at || new Date().toISOString()),
        watchlist_ids: row.watchlist_ids || [],
        sentiment,
        topics,
      };

      const result = await indexPostForRAG(row.tenant_id, post);
      if (result.status === 'synced') {
        indexed++;
      } else {
        failed++;
      }
      if ((indexed + failed) % 250 === 0) {
        console.log(`[RAG Backfill] Progress: ${indexed + failed} / ${res.rows.length} posts processed (Synced: ${indexed}, Failed: ${failed})...`);
      }
    } catch (err: any) {
      failed++;
    }
  }

  console.log(`[RAG Backfill] Finished indexing. Synced: ${indexed} | Failed: ${failed}`);
  return { indexed, failed };
}

if (require.main === module) {
  const tenantId = process.argv[2];
  backfillRAG(tenantId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backfill error:', err);
      process.exit(1);
    });
}
