import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { isConnectorActive } from '../connectors/connectorActivationStore';
import { acquireForAiModel, QueueTtlExceededError, QueueDepthExceededError } from '../connectors/requestGate';
import { ClassifiableError } from '../ingestion/errorClassification';
import { azureOpenAiConnector } from '../connectors/azureOpenAi/azureOpenAiConnector';
import { searchForResearch as searchBrave, BRAVE_SEARCH_PROVIDER_ID } from '../connectors/braveSearch/braveSearchConnector';
import { searchForResearch as searchBing, BING_SEARCH_PROVIDER_ID } from '../connectors/bingSearch/bingSearchConnector';
import { ResearchSearchResult } from '../connectors/braveSearch/braveSearchConnector';

const DEFAULT_MAX_SEARCH_RESULTS = 5;
const HARD_MAX_SEARCH_RESULTS = 10;
const MAX_KEY_PHRASES = 10;
const MAX_SEARCH_QUERIES = 5;
const AI_OPTIONS = { maxKeyPhrases: 10, maxRelatedTopics: 10, maxSearchQueries: 5 };

export interface ComposerResearchRequest {
  text: string;
  targetPlatforms?: string[];
  maxSearchResultsPerQuery?: number;
}

export interface ComposerResearchResult {
  keyPhrases: string[];
  relatedTopics: string[];
  searchQueries: string[];
  sources: ResearchSearchResult[];
  contextSummary: string;
  comparison: string;
}

export class ComposerResearchError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function resolveMaxSearchResultsPerQuery(raw: unknown): number {
  if (raw === undefined) return DEFAULT_MAX_SEARCH_RESULTS;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return DEFAULT_MAX_SEARCH_RESULTS;
  if (raw > HARD_MAX_SEARCH_RESULTS) {
    throw new ComposerResearchError(422, 'RESEARCH_TOO_LARGE', `maxSearchResultsPerQuery cannot exceed ${HARD_MAX_SEARCH_RESULTS}`);
  }
  if (raw < 1) return DEFAULT_MAX_SEARCH_RESULTS;
  return raw;
}

async function gatedAcquireForAiModel(tenantId: string): Promise<void> {
  try {
    await acquireForAiModel(tenantId, azureOpenAiConnector, 'research');
  } catch (err) {
    if (err instanceof QueueTtlExceededError) {
      throw new ClassifiableError('queue_ttl_exceeded', err.message);
    }
    if (err instanceof QueueDepthExceededError) {
      throw new ClassifiableError('queue_depth_exceeded', err.message);
    }
    throw err;
  }
}

async function loadAiCredential(tenantId: string): Promise<string> {
  const active = await isConnectorActive(tenantId, azureOpenAiConnector.providerId, 'tenant');
  if (!active) {
    throw new ComposerResearchError(422, 'AI_PROVIDER_NOT_CAPABLE', 'No research-capable AI provider is active for this tenant.');
  }

  const credentialId = await getLatestCredentialId(tenantId, azureOpenAiConnector.providerId, 'tenant');
  if (!credentialId) {
    throw new ComposerResearchError(422, 'AI_PROVIDER_NOT_CAPABLE', 'No research-capable AI provider credential is available.');
  }

  return readCredential(tenantId, credentialId);
}

async function discoverActiveSearchProviders(tenantId: string): Promise<Array<{ providerId: string; search: typeof searchBrave }>> {
  const providers: Array<{ providerId: string; search: typeof searchBrave }> = [];
  for (const { id, search } of [
    { id: BRAVE_SEARCH_PROVIDER_ID, search: searchBrave },
    { id: BING_SEARCH_PROVIDER_ID, search: searchBing },
  ]) {
    if (await isConnectorActive(tenantId, id, 'tenant')) {
      providers.push({ providerId: id, search });
    }
  }
  return providers;
}

/**
 * Story 3.17 (ADR-0076) — pure orchestration for the composer Deep Research
 * pipeline. Runs extraction (Azure OpenAI), one-off web searches (Brave/Bing),
 * and synthesis (Azure OpenAI) for the caller's own tenant. Read-only: never
 * inserts social_posts or post_watchlist_matches.
 */
export async function performResearch(
  tenantId: string,
  request: ComposerResearchRequest
): Promise<ComposerResearchResult> {
  const { text } = request;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new ComposerResearchError(400, 'BAD_REQUEST', 'text is required and cannot be empty');
  }

  const maxSearchResultsPerQuery = resolveMaxSearchResultsPerQuery(request.maxSearchResultsPerQuery);

  const credential = await loadAiCredential(tenantId);

  const activeSearchProviders = await discoverActiveSearchProviders(tenantId);
  if (activeSearchProviders.length === 0) {
    throw new ComposerResearchError(422, 'SEARCH_PROVIDER_UNAVAILABLE', 'No active Brave/Bing search provider for this tenant.');
  }

  // Extraction stage
  await gatedAcquireForAiModel(tenantId);
  const extraction = await azureOpenAiConnector.research!(text, [], AI_OPTIONS, credential);

  const keyPhrases = (extraction.keyPhrases ?? []).slice(0, MAX_KEY_PHRASES);
  const relatedTopics = extraction.relatedTopics ?? [];
  let searchQueries = (extraction.searchQueries ?? []).slice(0, MAX_SEARCH_QUERIES);

  // Search stage
  const collectedSources: ResearchSearchResult[] = [];
  let lastSearchError: Error | undefined;

  for (const query of searchQueries) {
    for (const provider of activeSearchProviders) {
      try {
        const results = await provider.search(tenantId, query, maxSearchResultsPerQuery);
        collectedSources.push(...results.slice(0, maxSearchResultsPerQuery));
      } catch (err) {
        lastSearchError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  if (collectedSources.length === 0) {
    if (lastSearchError instanceof ClassifiableError) {
      const status = lastSearchError.kind === 'rate_limit' ? 429 : 502;
      throw new ComposerResearchError(status, lastSearchError.kind, lastSearchError.message);
    }
    if (lastSearchError) {
      throw new ComposerResearchError(502, 'SEARCH_PROVIDER_UNAVAILABLE', lastSearchError.message);
    }
    // No results and no errors means every query returned empty for every provider.
  }

  // Synthesis stage
  await gatedAcquireForAiModel(tenantId);
  const synthesis = await azureOpenAiConnector.research!(text, collectedSources, AI_OPTIONS, credential);

  return {
    keyPhrases,
    relatedTopics,
    searchQueries,
    sources: collectedSources,
    contextSummary: synthesis.contextSummary ?? '',
    comparison: synthesis.comparison ?? '',
  };
}
