import type { RAGConnector, RAGFilter, RAGSearchOptions, RAGSearchResult } from './types';
import { getRagConnector } from './ragConnectorRegistry';
import { generateMockEmbedding } from './ragChunkingService';

export interface SemanticSearchInput {
  query: string;
  topK?: number;
  filter?: RAGFilter;
  minScore?: number;
  overfetchFactor?: number;
  textQuery?: string;
}

/**
 * Story 9.9 (ADR-0083) / Story 9.10 (ADR-0084) — RAG Semantic Search Service.
 */
export class RAGSearchService {
  private readonly connector: RAGConnector;

  constructor(connector?: RAGConnector) {
    this.connector = connector || getRagConnector();
  }

  /**
   * Executes a tenant-scoped semantic search.
   * Embeds the text query, enforces mandatory tenant pre-filtering,
   * over-fetches (topK * overfetchFactor) if needed, and applies filters.
   */
  public async search(
    tenantId: string,
    input: SemanticSearchInput
  ): Promise<RAGSearchResult[]> {
    if (!tenantId) {
      throw new Error('Mandatory tenantId required for RAG search');
    }
    if (!input.query || input.query.trim().length === 0) {
      return [];
    }

    const topK = input.topK ?? 10;
    const minScore = input.minScore ?? 0.0;
    const overfetchFactor = input.overfetchFactor ?? 1;

    // Generate query embedding
    const queryVector = generateMockEmbedding(input.query, 1536);

    const searchOptions: RAGSearchOptions = {
      topK: topK * overfetchFactor,
      filter: input.filter,
      minScore,
      textQuery: input.textQuery || input.query,
    };

    // Execute vector search with strict tenant pre-filtering
    const results = await this.connector.search(tenantId, queryVector, searchOptions);

    // Ensure results never exceed requested topK
    return results.slice(0, topK);
  }
}
