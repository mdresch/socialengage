import type { RAGChunk, RAGChunkMetadata } from './types';

export interface SplitPostInput {
  id: string;
  tenant_id: string;
  body_markdown?: string | null;
  title?: string | null;
  platform_id?: string;
  published_at?: string;
  watchlist_ids?: string[];
  sentiment?: string;
  topics?: string[];
  [key: string]: any;
}

/**
 * Deterministic word-token-based 1536-dimensional mock embedding generator for test/offline execution.
 * Preserves semantic keyword overlap similarity for unit/contract tests.
 */
export function generateMockEmbedding(text: string, dimension = 1536): number[] {
  const vector: number[] = new Array(dimension).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return vector;

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimension;
    vector[idx] += 1;
    const secondaryIdx = Math.abs(hash * 31 + 7) % dimension;
    vector[secondaryIdx] += 0.5;
  }

  // Normalize to unit vector
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

/**
 * Story 9.8 (ADR-0082) — RAG Chunking and Embedding Service.
 */
export class RAGChunkingService {
  private readonly targetChunkChars: number;
  private readonly overlapChars: number;
  private readonly minChunkChars: number;

  constructor(targetChunkTokens = 256, overlapPercent = 0.2) {
    // Approx 4 characters per token
    this.targetChunkChars = targetChunkTokens * 4;
    this.overlapChars = Math.round(this.targetChunkChars * overlapPercent);
    this.minChunkChars = 64 * 4; // 256 chars
  }

  /**
   * Splits a post's body_markdown into overlapping chunks.
   * Prepends title if available, respects sentence/paragraph boundaries,
   * and preserves short posts as a single chunk.
   */
  public split(post: SplitPostInput): Array<{
    tenant_id: string;
    post_id: string;
    chunk_index: number;
    content: string;
    metadata: RAGChunkMetadata;
  }> {
    const rawBody = (post.body_markdown || post.body || post.text || '').trim();
    const titlePrefix = post.title?.trim() ? `Title: ${post.title.trim()}\n\n` : '';

    const tenantId = post.tenant_id;
    const postId = post.id;
    const platformId = post.platform_id || 'gnews';
    const publishedAt = post.published_at || new Date().toISOString();

    // Short post rule: if total text is short or fits within one chunk target, keep as single chunk
    if (!rawBody || rawBody.length <= this.targetChunkChars) {
      const fullContent = `${titlePrefix}${rawBody}`.trim();
      return [
        {
          tenant_id: tenantId,
          post_id: postId,
          chunk_index: 0,
          content: fullContent,
          metadata: {
            tenant_id: tenantId,
            post_id: postId,
            chunk_index: 0,
            content: fullContent,
            platform_id: platformId,
            published_at: publishedAt,
            watchlist_ids: post.watchlist_ids || [],
            sentiment: post.sentiment,
            topics: post.topics || [],
          },
        },
      ];
    }

    // Split on paragraphs and sentences
    const paragraphs = rawBody.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedPara = paragraph.trim();
      if (!trimmedPara) continue;

      if ((currentChunk + '\n\n' + trimmedPara).length <= this.targetChunkChars) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedPara}` : trimmedPara;
      } else {
        // Paragraph causes overflow: push current chunk if non-empty
        if (currentChunk) {
          chunks.push(currentChunk);
          // Calculate overlap from tail of currentChunk
          const overlapText = currentChunk.slice(-this.overlapChars);
          currentChunk = `${overlapText}\n\n${trimmedPara}`.trim();
        } else {
          // Single paragraph is larger than chunk size: split into sentences
          const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s+|$)/g) || [trimmedPara];
          for (const sentence of sentences) {
            if ((currentChunk + ' ' + sentence).length <= this.targetChunkChars) {
              currentChunk = currentChunk ? `${currentChunk} ${sentence.trim()}` : sentence.trim();
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = sentence.trim();
            }
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Assemble structured chunks
    return chunks.map((chunkText, index) => {
      const content = `${titlePrefix}${chunkText}`.trim();
      return {
        tenant_id: tenantId,
        post_id: postId,
        chunk_index: index,
        content,
        metadata: {
          tenant_id: tenantId,
          post_id: postId,
          chunk_index: index,
          content,
          platform_id: platformId,
          published_at: publishedAt,
          watchlist_ids: post.watchlist_ids || [],
          sentiment: post.sentiment,
          topics: post.topics || [],
        },
      };
    });
  }

  /**
   * Generates embedding vectors for the given chunks.
   */
  public async embed(
    tenantId: string,
    chunks: Array<{ tenant_id: string; post_id: string; chunk_index: number; content: string; metadata: RAGChunkMetadata }>
  ): Promise<Array<{ id: string; values: number[]; metadata: RAGChunkMetadata }>> {
    if (!tenantId) {
      throw new Error('TenantId is required for RAG embedding');
    }

    return chunks.map((chunk) => ({
      id: `${tenantId}:${chunk.post_id}:${chunk.chunk_index}`,
      values: generateMockEmbedding(chunk.content, 1536),
      metadata: { ...chunk.metadata },
    }));
  }
}
