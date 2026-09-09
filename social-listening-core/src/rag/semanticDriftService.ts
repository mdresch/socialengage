import { createHash } from 'crypto';
import { withTenant } from '../db/withTenant';
import { getTopicById } from '../topics/topicStore';
import { generateMockEmbedding } from './ragChunkingService';

export type DriftWarning = 'none' | 'mild' | 'significant';

export interface DriftResult {
  topicId: string;
  start: string;
  end: string;
  driftScore: number;
  topClustersNow: string[];
  topClustersThen: string[];
  samplePostsNow: string[];
  samplePostsThen: string[];
  warning: DriftWarning;
  cacheHit?: boolean;
}

export class SemanticDriftError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

interface DriftChunk {
  id: string;
  postId: string;
  chunkIndex: number;
  content: string;
  publishedAt: string;
  vector: number[];
}

interface Cluster {
  label: string;
  chunks: DriftChunk[];
  centroid: number[];
}

const DRIFT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_CLUSTERS = 5;
const SAMPLES_PER_WINDOW = 3;
const VECTOR_DIMENSION = 1536;

// A small, fixed stop-word list so simple word-frequency clustering is deterministic.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'them', 'their', 'there', 'then', 'than',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'shall', 'so', 'if', 'about', 'which', 'who', 'what', 'when', 'where', 'why', 'how', 'all', 'any',
  'each', 'every', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'other', 'another', 'new', 'old',
  'good', 'bad', 'big', 'small', 'long', 'short', 'first', 'last', 'just', 'also', 'more', 'most', 'much',
  'many', 'very', 'too', 'so', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'once', 'here', 'now',
  'today', 'yesterday', 'tomorrow',
]);

/**
 * Builds a deterministic SHA-256 cache key for (tenant, topic, start, end).
 */
function buildCacheKey(
  tenantId: string,
  topicId: string,
  start: Date,
  end: Date
): string {
  const canonical = JSON.stringify([
    tenantId,
    topicId,
    start.toISOString(),
    end.toISOString(),
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

async function getCachedDriftResult(
  tenantId: string,
  cacheKeyHash: string
): Promise<DriftResult | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ drift_result: DriftResult }>(
      `UPDATE semantic_drift_cache
       SET cache_hit_count = cache_hit_count + 1,
           updated_at = now()
       WHERE tenant_id = $1
         AND cache_key_hash = $2
         AND expires_at > now()
       RETURNING drift_result`,
      [tenantId, cacheKeyHash]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      ...rows[0].drift_result,
      cacheHit: true,
    };
  });
}

async function storeDriftResult(
  tenantId: string,
  topicId: string,
  cacheKeyHash: string,
  start: Date,
  end: Date,
  result: DriftResult
): Promise<void> {
  return withTenant(tenantId, async (client) => {
    const expiresAt = new Date(Date.now() + DRIFT_TTL_SECONDS * 1000).toISOString();
    await client.query(
      `INSERT INTO semantic_drift_cache
         (tenant_id, cache_key_hash, topic_id, start_window, end_window, drift_result, expires_at, cache_hit_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT (tenant_id, cache_key_hash)
       DO UPDATE SET
         topic_id = EXCLUDED.topic_id,
         start_window = EXCLUDED.start_window,
         end_window = EXCLUDED.end_window,
         drift_result = EXCLUDED.drift_result,
         expires_at = EXCLUDED.expires_at,
         cache_hit_count = 0,
         updated_at = now()`,
      [tenantId, cacheKeyHash, topicId, start.toISOString(), end.toISOString(), result, expiresAt]
    );
  });
}

function parseDate(input: string): Date {
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new SemanticDriftError(400, 'BAD_REQUEST', `Invalid ISO date: ${input}`);
  }
  return d;
}

async function fetchChunksForWindow(
  tenantId: string,
  topicId: string,
  start: Date,
  end: Date
): Promise<DriftChunk[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      post_id: string;
      chunk_index: number;
      content: string;
      published_at: Date;
    }>(
      `SELECT rc.id,
              rc.post_id,
              rc.chunk_index,
              rc.content,
              rc.published_at
       FROM rag_chunks rc
       JOIN post_topics pt
         ON pt.post_id = rc.post_id
        AND pt.tenant_id = rc.tenant_id
       WHERE rc.tenant_id = $1
         AND pt.topic_id = $2
         AND rc.published_at >= $3
         AND rc.published_at < $4
       ORDER BY rc.published_at ASC, rc.id ASC`,
      [tenantId, topicId, start.toISOString(), end.toISOString()]
    );

    return rows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at),
      vector: generateMockEmbedding(row.content, VECTOR_DIMENSION),
    }));
  });
}

function averageVector(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return new Array(VECTOR_DIMENSION).fill(0);
  }

  const sum = new Array(VECTOR_DIMENSION).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
      sum[i] += v[i];
    }
  }

  const avg = sum.map((s) => s / vectors.length);
  const norm = Math.sqrt(avg.reduce((acc, v) => acc + v * v, 0));
  return norm > 0 ? avg.map((v) => v / norm) : avg;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function topNonStopWord(text: string): string | null {
  const words = tokenize(text);
  const counts = new Map<string, number>();
  for (const word of words) {
    if (STOPWORDS.has(word) || word.length < 3) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  if (counts.size === 0) return null;

  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return sorted[0][0];
}

function clusterChunks(chunks: DriftChunk[]): Cluster[] {
  const groups = new Map<string, DriftChunk[]>();
  for (const chunk of chunks) {
    const label = topNonStopWord(chunk.content) || 'other';
    const list = groups.get(label) || [];
    list.push(chunk);
    groups.set(label, list);
  }

  const clusters: Cluster[] = [];
  for (const [label, group] of groups.entries()) {
    clusters.push({
      label,
      chunks: group,
      centroid: averageVector(group.map((c) => c.vector)),
    });
  }

  // Largest clusters first; ties broken alphabetically by label for determinism.
  clusters.sort((a, b) => {
    if (b.chunks.length !== a.chunks.length) return b.chunks.length - a.chunks.length;
    return a.label.localeCompare(b.label);
  });

  return clusters;
}

function pickSamplePosts(clusters: Cluster[], limit: number): string[] {
  const samples: string[] = [];
  for (let i = 0; i < Math.min(limit, clusters.length); i++) {
    const cluster = clusters[i];
    const ranked = cluster.chunks
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(chunk.vector, cluster.centroid),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.chunk.content.localeCompare(b.chunk.content);
      });

    if (ranked.length > 0) {
      // Return a short, human-readable snippet rather than an internal id.
      const text = ranked[0].chunk.content.trim();
      samples.push(text.length <= 500 ? text : `${text.slice(0, 497)}...`);
    }
  }
  return samples;
}

function deriveWarning(driftScore: number): DriftWarning {
  if (driftScore < 0.2) return 'none';
  if (driftScore < 0.5) return 'mild';
  return 'significant';
}

/**
 * Computes the semantic drift between two time windows for a single topic.
 *
 * - Splits [start, end] in half: the "then" window is the first half, the "now" window is the second half.
 * - Selects RAG chunks for the topic in each half (via the `post_topics` join).
 * - Computes a normalized centroid vector for each half.
 * - `driftScore = 1 - cosine_similarity(centroid_then, centroid_now)`.
 * - Performs simple word-frequency clustering in each half to produce top cluster labels.
 * - Picks sample chunk text from the top clusters.
 * - Caches the result for 24 hours keyed by (tenantId, topicId, start, end).
 */
export async function computeDrift(
  tenantId: string,
  topicId: string,
  startInput: string,
  endInput: string
): Promise<DriftResult> {
  const start = parseDate(startInput);
  const end = parseDate(endInput);

  if (start.getTime() >= end.getTime()) {
    throw new SemanticDriftError(400, 'BAD_REQUEST', 'start must be before end');
  }

  const topic = await getTopicById(tenantId, topicId);
  if (!topic) {
    throw new SemanticDriftError(404, 'TOPIC_NOT_FOUND', `Topic '${topicId}' not found`);
  }

  const cacheKey = buildCacheKey(tenantId, topicId, start, end);
  const cached = await getCachedDriftResult(tenantId, cacheKey);
  if (cached) {
    return cached;
  }

  const midpoint = new Date((start.getTime() + end.getTime()) / 2);

  const [thenChunks, nowChunks] = await Promise.all([
    fetchChunksForWindow(tenantId, topicId, start, midpoint),
    fetchChunksForWindow(tenantId, topicId, midpoint, end),
  ]);

  const centroidThen = averageVector(thenChunks.map((c) => c.vector));
  const centroidNow = averageVector(nowChunks.map((c) => c.vector));

  let driftScore: number;
  if (thenChunks.length === 0 || nowChunks.length === 0) {
    // Not enough data to compare meaning; return a neutral, non-alarming score.
    driftScore = 0;
  } else {
    const similarity = cosineSimilarity(centroidThen, centroidNow);
    driftScore = Math.max(0, Math.min(1, 1 - similarity));
  }

  const thenClusters = clusterChunks(thenChunks).slice(0, MAX_CLUSTERS);
  const nowClusters = clusterChunks(nowChunks).slice(0, MAX_CLUSTERS);

  const result: DriftResult = {
    topicId,
    start: start.toISOString(),
    end: end.toISOString(),
    driftScore,
    topClustersNow: nowClusters.map((c) => c.label),
    topClustersThen: thenClusters.map((c) => c.label),
    samplePostsNow: pickSamplePosts(nowClusters, SAMPLES_PER_WINDOW),
    samplePostsThen: pickSamplePosts(thenClusters, SAMPLES_PER_WINDOW),
    warning: deriveWarning(driftScore),
    cacheHit: false,
  };

  await storeDriftResult(tenantId, topicId, cacheKey, start, end, result);
  return result;
}
