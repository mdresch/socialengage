import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import {
  braveSearchConnector,
  BRAVE_SEARCH_PROVIDER_ID,
  fetchBraveSearch,
  BraveSearchResultItem,
  extractDomainFromUrl,
} from './braveSearchConnector';
import { buildBraveSearchQuery, validateCandidateMatch } from './braveSearchQueryBuilder';
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
    await acquireForProvider(tenantId, braveSearchConnector);
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

async function getBraveApiKey(tenantId: string): Promise<string> {
  const credentialId = await getLatestCredentialId(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant');
  if (!credentialId) {
    throw new ClassifiableError('http_401', `No Brave Search credential registered for tenant ${tenantId}`);
  }
  return readCredential(tenantId, credentialId);
}

/**
 * Normalizes, in-process validates, dedups, and inserts a batch of Brave Search candidate results
 * for a specific active Watchlist.
 */
export async function ingestBraveSearchResults(
  tenantId: string,
  runId: string,
  results: BraveSearchResultItem[],
  watchlist: Watchlist
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  for (const item of results) {
    // Dual Discovery & AST Validation: strictly test candidate snippet against watchlist criteria
    if (!validateCandidateMatch(watchlist, item)) {
      continue;
    }

    const normalized = braveSearchConnector.normalize(item);

    const existing = await findSocialPostByExternalId(tenantId, BRAVE_SEARCH_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    const domain = extractDomainFromUrl(item.url);
    const author = await upsertAuthor(tenantId, BRAVE_SEARCH_PROVIDER_ID, normalized.authorExternalId, {
      displayName: domain,
      rawProfile: { domain, metaUrl: item.meta_url },
    });

    const rawBody = item.description || item.title;
    const convertedBody = htmlToMarkdown(rawBody);
    const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
    const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

    const enrichmentText = [item.title, bodyMarkdown].filter(Boolean).join('. ');
    const enrichment = await enrichPost(tenantId, enrichmentText);

    const inserted = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: {
        providerId: BRAVE_SEARCH_PROVIDER_ID,
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
    await publishSocialPostIngestedEvents(tenantId, BRAVE_SEARCH_PROVIDER_ID, [watchlist], {
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
 * Executes a full Brave Search active watchlist sourcing cycle for a tenant.
 */
export async function pollBraveSearch(tenantId: string): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: BRAVE_SEARCH_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId: string) => {
      await gatedAcquire(tenantId);
      const apiKey = await getBraveApiKey(tenantId);

      const activeWatchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(BRAVE_SEARCH_PROVIDER_ID)
      );

      let totalIngested = 0;
      let totalSkipped = 0;

      for (let i = 0; i < activeWatchlists.length; i++) {
        const watchlist = activeWatchlists[i];
        const query = buildBraveSearchQuery(watchlist);
        if (!query) continue;

        const results = await fetchBraveSearch(query, apiKey, 'news');
        const batchResult = await ingestBraveSearchResults(tenantId, runId, results, watchlist);

        totalIngested += batchResult.postsIngested;
        totalSkipped += batchResult.postsSkipped;

        // Apply pacing delay between sequential watchlist searches
        if (i < activeWatchlists.length - 1) {
          await sleep(pacingDelayMs);
        }
      }

      return { postsIngested: totalIngested, postsSkipped: totalSkipped };
    },
  });
}
