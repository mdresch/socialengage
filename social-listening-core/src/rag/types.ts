/**
 * Story 9.7 (ADR-0081, BRD-0081, FDD-0081) — RAGConnector provider abstraction types.
 */

export interface RAGChunkMetadata {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  content: string; // chunk text payload
  platform_id: string;
  published_at: string;
  watchlist_ids?: string[];
  sentiment?: string;
  topics?: string[];
}

export interface RAGChunk {
  id: string; // format: ${tenantId}:${postId}:${chunkIndex}
  values: number[]; // embedding vector
  metadata: RAGChunkMetadata;
}

export interface RAGFilter {
  platformId?: string | string[];
  sentiment?: string | string[];
  watchlistIds?: string[];
  topics?: string[];
  dateRange?: { from?: string; to?: string };
}

export interface RAGSearchOptions {
  topK: number;
  filter?: RAGFilter;
  textQuery?: string; // hybrid search
  minScore?: number; // score threshold cutoff [0..1]
}

export interface RAGSearchResult {
  id: string;
  score: number; // normalized similarity score [0..1]
  metadata: RAGChunkMetadata;
}

export interface RAGConnectorStatus {
  provider: string;
  isAvailable: boolean;
  dimension: number;
  indexedChunksCount?: number;
  lastError?: string | null;
}

export interface RAGConnector {
  id: string;
  upsert(tenantId: string, vectors: RAGChunk[]): Promise<void>;
  search(tenantId: string, query: number[], options: RAGSearchOptions): Promise<RAGSearchResult[]>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<RAGConnectorStatus>;
  updateMetadata?(tenantId: string, postId: string, partialMetadata: Partial<RAGChunkMetadata>): Promise<void>;
}
