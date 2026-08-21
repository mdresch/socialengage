import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import {
  bingSearchConnector,
  BING_SEARCH_PROVIDER_ID,
  fetchBingSearch,
  BingSearchItem,
  extractDomainFromUrl,
  lookbackToFreshness,
  calculateAzureSearchCost,
} from './bingSearchConnector';
import { buildBingSearchQuery, validateCandidateMatch } from './bingSearchQueryBuilder';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant, Watchlist } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';

let pacingDelayMs = 1200;

/** Sets pacing delay in ms (used by tests to avoid real 1.2s waits). */
export function setPacingDelayForTests(ms: number): void {
  pacingDelayMs = ms;
}

async function sleep(ms: number): Promise<void> {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, bingSearchConnector);
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

async function getBingApiKey(tenantId: string): Promise<string> {
  const credentialId = await getLatestCredentialId(tenantId, BING_SEARCH_PROVIDER_ID, 'tenant');
  if (!credentialId) {
    throw new ClassifiableError('http_401', `No Bing Search credential registered for tenant ${tenantId}`);
  }
  return readCredential(tenantId, credentialId);
}

/**
 * Normalizes, in-process validates, dedups, and inserts a batch of Bing Search candidate results
 * for a specific active Watchlist.
 */
export async function ingestBingSearchResults(
  tenantId: string,
  runId: string,
  results: BingSearchItem[],
  watchlist: Watchlist
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  for (const item of results) {
    // Dual Discovery & AST Validation: strictly test candidate snippet against watchlist criteria
    if (!validateCandidateMatch(watchlist, item)) {
      continue;
    }

    const normalized = bingSearchConnector.normalize(item);

    const existing = await findSocialPostByExternalId(tenantId, BING_SEARCH_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    const domain = extractDomainFromUrl(item.url);
    const providerName = item.provider?.[0]?.name;
    const displayName = providerName && providerName.trim().length > 0 ? providerName : domain;

    const author = await upsertAuthor(tenantId, BING_SEARCH_PROVIDER_ID, normalized.authorExternalId, {
      displayName,
      rawProfile: { domain, provider: item.provider },
    });

    const rawBody = item.description || item.snippet || item.name;
    const convertedBody = htmlToMarkdown(rawBody);
    const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
    const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

    const enrichmentText = [item.name, bodyMarkdown].filter(Boolean).join('. ');
    const enrichment = await enrichPost(tenantId, enrichmentText);

    const inserted = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: {
        providerId: BING_SEARCH_PROVIDER_ID,
        externalId: normalized.externalId,
        watchlistId: watchlist.id,
        ...item,
      },
      publishedAt: normalized.publishedAt,
      enrichment: enrichment as Record<string, unknown> | undefined,
      bodyMarkdown,
      bodyMarkdownVersion,
    });

    // Publish event & persist in post_watchlist_matches junction table
    await publishSocialPostIngestedEvents(tenantId, BING_SEARCH_PROVIDER_ID, [watchlist], {
      postId: inserted.id,
      text: enrichmentText,
      authorExternalId: normalized.authorExternalId,
      publishedAt: normalized.publishedAt,
      discoveringWatchlistId: watchlist.id,
    });

    postsIngested += 1;
  }

  return { postsIngested, postsSkipped };
}

/**
 * Executes a full Bing Search active watchlist sourcing cycle for a tenant.
 */
export async function pollBingSearch(tenantId: string): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: BING_SEARCH_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId: string) => {
      await gatedAcquire(tenantId);
      const apiKey = await getBingApiKey(tenantId);

      const activeWatchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(BING_SEARCH_PROVIDER_ID)
      );

      let totalIngested = 0;
      let totalSkipped = 0;
      let totalApiCalls = 0;

      for (let i = 0; i < activeWatchlists.length; i++) {
        const watchlist = activeWatchlists[i];
        const query = buildBingSearchQuery(watchlist);
        if (!query) {
          continue;
        }

        if (i > 0 && pacingDelayMs > 0) {
          await sleep(pacingDelayMs);
        }

        const freshness = lookbackToFreshness(24);

        // Phase 1: Call News Search endpoint first (count = 25)
        totalApiCalls += 1;
        const newsCandidates = await fetchBingSearch(query, apiKey, {
          endpoint: 'news',
          freshness,
          count: 25,
        });

        // Filter and count matching candidates
        let matchingNews = newsCandidates.filter((c) => validateCandidateMatch(watchlist, c));
        let candidatesToIngest = newsCandidates;

        // Phase 2: Deterministic Auto Fallback to Web Search if news yield < 5 validated items
        if (matchingNews.length < 5) {
          totalApiCalls += 1;
          const webCandidates = await fetchBingSearch(query, apiKey, {
            endpoint: 'web',
            freshness,
            count: 25,
          });
          candidatesToIngest = [...newsCandidates, ...webCandidates];
        }

        const result = await ingestBingSearchResults(tenantId, runId, candidatesToIngest, watchlist);
        totalIngested += result.postsIngested;
        totalSkipped += result.postsSkipped;
      }

      const estimatedCostUsd = calculateAzureSearchCost(totalApiCalls);

      return {
        postsIngested: totalIngested,
        postsSkipped: totalSkipped,
        details: {
          totalApiCalls,
          estimatedCostUsd,
        },
      };
    },
  });
}
