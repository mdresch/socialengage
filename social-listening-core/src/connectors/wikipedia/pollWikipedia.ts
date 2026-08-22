import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor, listAuthorsByPlatform } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant, Watchlist } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';
import {
  wikipediaConnector,
  fetchWikipediaSearch,
  fetchWikipediaRecentChanges,
  fetchWikipediaRevision,
  WIKIPEDIA_PROVIDER_ID,
  WikipediaRevision,
} from './wikipediaConnector';

interface DiscoveryQueryItem {
  watchlistId?: string;
  query: string;
}

/**
 * Story 2.14 (ADR-0042 §5) — one discovery query per active watchlist
 * targeting 'wikipedia' whose matchType is keyword/hashtag/account, built
 * from that watchlist's own terms (space-joined). boolean-typed watchlists
 * are skipped here (real AST-to-CirrusSearch translation is still ADR-0042's
 * own unverified open question, see wikipedia-connector/SKILL.md) — they
 * remain fully evaluated for event-matching once content is discovered by
 * some other watchlist's own query.
 */
function buildDiscoveryQueries(watchlists: Watchlist[]): DiscoveryQueryItem[] {
  return watchlists
    .filter((w) => w.matchType !== 'boolean' && w.terms && w.terms.length > 0)
    .map((w) => ({
      watchlistId: w.id,
      query: (w.terms as string[]).join(' '),
    }));
}

/** Same reclassification pattern every other real connector's own poll function establishes. */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, wikipediaConnector);
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

/**
 * Normalizes, dedups, and inserts an already-fetched batch of revisions for
 * one IngestionRun. Split out from pollWikipedia() so it can be exercised
 * directly against a synthetic/live-fetched batch, same pattern as every
 * other real connector's own ingestXItems(). `watchlists` must already be
 * loaded once per poll batch by the caller (ADR-0058 Decision §6) — never
 * reloaded here per revision. See .claude/skills/wikipedia-connector/SKILL.md.
 */
export async function ingestWikipediaRevisions(
  tenantId: string,
  runId: string,
  revisions: WikipediaRevision[],
  watchlists: Watchlist[],
  discoveringWatchlistId?: string
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  for (const revision of revisions) {
    const normalized = wikipediaConnector.normalize(revision);

    const existing = await findSocialPostByExternalId(tenantId, WIKIPEDIA_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    // ADR-0042 Decision §3: Author is the article itself, keyed by the
    // page's stable pageid — not its title, which can change on a page
    // move. displayName is the article's current title.
    const author = await upsertAuthor(tenantId, WIKIPEDIA_PROVIDER_ID, normalized.authorExternalId, {
      displayName: revision.title,
      rawProfile: { pageid: revision.pageid, title: revision.title },
    });

    const convertedBody = htmlToMarkdown(revision.html);
    const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
    const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

    // Story 2.8/2.9 (ADR-0038) — same best-effort, additive enrichment hook
    // as every other real connector. ADR-0042's own CC BY-SA "Adapted
    // Material" Open Question is named, not analyzed — enrichment applies
    // completely unmodified.
    const enrichmentText = [revision.title, bodyMarkdown].filter(Boolean).join('. ');
    const enrichment = await enrichPost(tenantId, enrichmentText);

    const effectiveWatchlistId =
      discoveringWatchlistId ||
      watchlists.find(
        (w) =>
          w.platformIds.includes(WIKIPEDIA_PROVIDER_ID) &&
          (w.terms || []).some((t) => revision.title.toLowerCase().includes(t.toLowerCase()))
      )?.id ||
      watchlists.find((w) => w.platformIds.includes(WIKIPEDIA_PROVIDER_ID))?.id;

    const inserted = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: {
        providerId: WIKIPEDIA_PROVIDER_ID,
        externalId: normalized.externalId,
        discoveringWatchlistId: effectiveWatchlistId,
        watchlistId: effectiveWatchlistId,
        ...revision,
      },
      publishedAt: normalized.publishedAt,
      enrichment: enrichment as unknown as Record<string, unknown> | undefined,
      bodyMarkdown,
      bodyMarkdownVersion,
    });

    // ADR-0058 Decision §1/§5/§6 & Story 3.12 — post-commit, adopting Story 5.19's
    // already-built wiring as part of this connector's own original build.
    await publishSocialPostIngestedEvents(tenantId, WIKIPEDIA_PROVIDER_ID, watchlists, {
      postId: inserted.id,
      text: enrichmentText,
      authorExternalId: normalized.authorExternalId,
      publishedAt: normalized.publishedAt,
      discoveringWatchlistId: effectiveWatchlistId,
    });

    postsIngested += 1;
  }

  return { postsIngested, postsSkipped };
}

/**
 * One poll cycle: discovery (search for articles matching one or more
 * queries, ingest any genuinely new pageid's current revision) followed by
 * re-poll (fetch recentchanges for every already-tracked article's own
 * current title, ingest any qualifying revision not already stored) —
 * ADR-0042 Decision §2's own re-poll-on-edit cadence, never a one-shot
 * snapshot. `query`, when explicitly supplied, runs exactly one search for
 * that literal (Story 2.13's own original shape, unchanged). When omitted —
 * the real production call site, bootstrapConnectors.ts, never supplies one
 * — discovery is derived from the tenant's own active watchlists targeting
 * 'wikipedia' instead (Story 2.14, ADR-0042 §5) — see
 * .claude/skills/wikipedia-connector/SKILL.md.
 */
export async function pollWikipedia(
  tenantId: string,
  query?: string
): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: WIKIPEDIA_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId) => {
      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(WIKIPEDIA_PROVIDER_ID)
      );

      let postsIngested = 0;
      let postsSkipped = 0;

      // Phase 1: discovery.
      const alreadyTracked = await listAuthorsByPlatform(tenantId, WIKIPEDIA_PROVIDER_ID);
      const trackedPageIds = new Set(alreadyTracked.map((a) => a.externalAuthorId));

      const discoveryQueries: DiscoveryQueryItem[] =
        query !== undefined ? [{ query }] : buildDiscoveryQueries(watchlists);
      for (const discoveryItem of discoveryQueries) {
        await gatedAcquire(tenantId);
        const searchResults = await fetchWikipediaSearch(discoveryItem.query);
        for (const result of searchResults) {
          const pageIdStr = String(result.pageid);
          if (trackedPageIds.has(pageIdStr)) continue;

          await gatedAcquire(tenantId);
          const revision = await fetchWikipediaRevision(result.title);
          const discovered = await ingestWikipediaRevisions(
            tenantId,
            runId,
            [revision],
            watchlists,
            discoveryItem.watchlistId
          );
          postsIngested += discovered.postsIngested;
          postsSkipped += discovered.postsSkipped;
          trackedPageIds.add(pageIdStr);
        }
      }

      // Phase 2: re-poll every already-tracked article for new revisions.
      for (const author of alreadyTracked) {
        const title = author.displayName ?? author.handle;
        if (!title) continue;

        await gatedAcquire(tenantId);
        const changes = await fetchWikipediaRecentChanges(title);
        for (const change of changes) {
          const existing = await findSocialPostByExternalId(tenantId, WIKIPEDIA_PROVIDER_ID, String(change.revid));
          if (existing) {
            postsSkipped += 1;
            continue;
          }
          await gatedAcquire(tenantId);
          const revision = await fetchWikipediaRevision(change.title, change.revid);
          const repolled = await ingestWikipediaRevisions(tenantId, runId, [revision], watchlists);
          postsIngested += repolled.postsIngested;
          postsSkipped += repolled.postsSkipped;
        }
      }

      return { postsIngested, postsSkipped };
    },
  });
}
