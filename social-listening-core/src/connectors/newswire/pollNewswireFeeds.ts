import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { newswireConnector, fetchNewswireFeed, NEWSWIRE_PROVIDER_ID, DEFAULT_NEWSWIRE_FEED_URLS } from './newswireConnector';
import { ParsedRssItem } from './rssFeedParser';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';

/**
 * acquireForProvider() has no ingestion-domain knowledge of its own (see
 * .claude/skills/provider-connector-framework/SKILL.md) — reclassifying its
 * queue-exhaustion errors into a ClassifiableError is documented as "the
 * connector's job" in .claude/skills/connector-health-and-error-handling/SKILL.md,
 * so this connector does it rather than leaving the gap that SKILL.md already
 * flags for "whichever real connector is built first."
 */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, newswireConnector);
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
 * Normalizes, dedups, and inserts an already-fetched batch of feed items for
 * one IngestionRun. Split out from pollNewswireFeeds() so it can be exercised
 * directly against a synthetic batch (Story 2.6 AC5's cross-wire-duplicate
 * fixture) without a live HTTP fetch.
 */
export async function ingestNewswireItems(
  tenantId: string,
  runId: string,
  items: ParsedRssItem[]
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  // ADR-0058 Decision §6 — loaded once per poll batch, never once per post.
  const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
    w.platformIds.includes(NEWSWIRE_PROVIDER_ID)
  );

  for (const item of items) {
    const normalized = newswireConnector.normalize(item);

    const existing = await findSocialPostByExternalId(tenantId, NEWSWIRE_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    const author = await upsertAuthor(tenantId, NEWSWIRE_PROVIDER_ID, normalized.authorExternalId, {
      displayName: normalized.authorExternalId !== 'unknown' ? normalized.authorExternalId : undefined,
      rawProfile: item,
    });

    // Story 3.10 (ADR-0053): richest-available body source (content:encoded
    // over description, null if neither), converted once via the shared
    // htmlToMarkdown() utility. See
    // .claude/skills/canonical-markdown-conversion/SKILL.md.
    const rawBodySource = item.contentEncoded ?? item.description ?? null;
    const convertedBody = rawBodySource ? htmlToMarkdown(rawBodySource) : '';
    const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
    const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

    // Story 2.8 (ADR-0038) — same best-effort, additive enrichment hook as
    // pollGNewsSearch.ts. See .claude/skills/azure-ai-language-connector/SKILL.md.
    // Story 3.10 (ADR-0053): enrichment input is now title + body_markdown,
    // not title alone.
    const enrichmentText = [item.title, bodyMarkdown].filter(Boolean).join('. ');
    const enrichment = await enrichPost(tenantId, enrichmentText);

    const inserted = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { providerId: NEWSWIRE_PROVIDER_ID, externalId: normalized.externalId, ...item },
      publishedAt: normalized.publishedAt,
      enrichment: enrichment as unknown as Record<string, unknown> | undefined,
      bodyMarkdown,
      bodyMarkdownVersion,
    });

    // ADR-0058 Decision §1/§6 — post-commit, same as pollGNewsSearch.ts.
    await publishSocialPostIngestedEvents(tenantId, NEWSWIRE_PROVIDER_ID, watchlists, {
      postId: inserted.id,
      text: enrichmentText,
      authorExternalId: normalized.authorExternalId,
      publishedAt: normalized.publishedAt,
    });

    postsIngested += 1;
  }

  return { postsIngested, postsSkipped };
}

/**
 * One poll cycle across the given Newswire feed URLs (default: one
 * GlobeNewswire + one PR Newswire feed), wired through the shared ingestion
 * pipeline (runIngestionAttempt -> RequestGate -> normalize -> Author upsert
 * -> SocialPost insert), same as any other real connector would be. See
 * .claude/skills/newswire-connector/SKILL.md.
 */
export async function pollNewswireFeeds(
  tenantId: string,
  feedUrls: string[] = DEFAULT_NEWSWIRE_FEED_URLS
): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: NEWSWIRE_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId) => {
      let postsIngested = 0;
      let postsSkipped = 0;

      for (const feedUrl of feedUrls) {
        await gatedAcquire(tenantId);
        const items = await fetchNewswireFeed(feedUrl);
        const result = await ingestNewswireItems(tenantId, runId, items);
        postsIngested += result.postsIngested;
        postsSkipped += result.postsSkipped;
      }

      return { postsIngested, postsSkipped };
    },
  });
}
