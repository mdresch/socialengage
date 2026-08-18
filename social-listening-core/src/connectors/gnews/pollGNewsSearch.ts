import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { gnewsConnector, fetchGNewsSearch, GNEWS_PROVIDER_ID, GNewsArticle, stripGNewsTruncationMarker } from './gnewsConnector';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';

const DEFAULT_QUERY = 'technology';

/**
 * acquireForProvider() has no ingestion-domain knowledge of its own (see
 * .claude/skills/provider-connector-framework/SKILL.md) — reclassifying its
 * queue-exhaustion errors into a ClassifiableError is the connector's job
 * (.claude/skills/connector-health-and-error-handling/SKILL.md), same
 * pattern as pollNewswireFeeds.ts's gatedAcquire().
 */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, gnewsConnector);
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
 * Resolves the connecting tenant's own stored GNews API key (ADR-0027: this
 * connector never uses a SocialEngage-held credential). A missing
 * credential is a credential-class failure (http_401), not a programming
 * error — runIngestionAttempt() classifies it the same way an actual 401
 * from GNews would be, and correctly does not blind-retry it.
 */
async function getGNewsApiKey(tenantId: string): Promise<string> {
  // GNews credentials are always tenant-wide (ADR-0026's "per-tenant
  // credential, not a shared pool" — ADR-0028 Tier 2), never user-bound —
  // ownerType is now required (Story 1.7, ADR-0034).
  const credentialId = await getLatestCredentialId(tenantId, GNEWS_PROVIDER_ID, 'tenant');
  if (!credentialId) {
    throw new ClassifiableError('http_401', `No GNews credential registered for tenant ${tenantId}`);
  }
  return readCredential(tenantId, credentialId);
}

/**
 * Normalizes, dedups, and inserts an already-fetched batch of GNews articles
 * for one IngestionRun. Split out from pollGNewsSearch() so it can be
 * exercised directly against a synthetic batch if a future story needs to,
 * mirroring pollNewswireFeeds.ts's ingestNewswireItems() split.
 */
export async function ingestGNewsArticles(
  tenantId: string,
  runId: string,
  articles: GNewsArticle[]
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  // ADR-0058 Decision §6 — loaded once per poll batch, never once per post.
  const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
    w.platformIds.includes(GNEWS_PROVIDER_ID)
  );

  for (const article of articles) {
    const normalized = gnewsConnector.normalize(article);

    const existing = await findSocialPostByExternalId(tenantId, GNEWS_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    const author = await upsertAuthor(tenantId, GNEWS_PROVIDER_ID, normalized.authorExternalId, {
      displayName: article.source.name,
      rawProfile: article.source,
    });

    // Story 3.10 (ADR-0053 Decision §5): content (free-tier truncation
    // marker trimmed) over description, null if neither present. See
    // .claude/skills/canonical-markdown-conversion/SKILL.md.
    const trimmedContent = article.content ? stripGNewsTruncationMarker(article.content) : null;
    const rawBodySource = (trimmedContent && trimmedContent.length > 0 ? trimmedContent : null) ?? article.description ?? null;
    const convertedBody = rawBodySource ? htmlToMarkdown(rawBodySource) : '';
    const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
    const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

    // Story 2.8 (ADR-0038) — best-effort, additive: enrichPost() never
    // throws, so a tenant with no Azure AI Language credential (or a
    // failed enrichment call) still gets this post ingested, just without
    // enrichment populated. See .claude/skills/azure-ai-language-connector/SKILL.md.
    // Story 3.10 (ADR-0053 Decision §6): enrichment input is now title +
    // body_markdown — description is no longer joined directly, it's
    // folded into body_markdown's own precedence rule above instead.
    const enrichmentText = [article.title, bodyMarkdown].filter(Boolean).join('. ');
    const enrichment = await enrichPost(tenantId, enrichmentText);

    const inserted = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { providerId: GNEWS_PROVIDER_ID, externalId: normalized.externalId, ...article },
      publishedAt: normalized.publishedAt,
      enrichment: enrichment as unknown as Record<string, unknown> | undefined,
      bodyMarkdown,
      bodyMarkdownVersion,
    });

    // ADR-0058 Decision §1/§6 — post-commit: insertSocialPost() has already
    // resolved (its own withTenant() transaction already committed) by the
    // time this runs.
    await publishSocialPostIngestedEvents(tenantId, GNEWS_PROVIDER_ID, watchlists, {
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
 * One poll cycle against GNews's Search endpoint for the given query,
 * wired through the shared ingestion pipeline (runIngestionAttempt ->
 * RequestGate -> fetch -> normalize -> Author upsert -> SocialPost insert),
 * same as any other real connector. See .claude/skills/gnews-connector/SKILL.md.
 */
export async function pollGNewsSearch(
  tenantId: string,
  query: string = DEFAULT_QUERY
): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: GNEWS_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId) => {
      const apiKey = await getGNewsApiKey(tenantId);
      await gatedAcquire(tenantId);
      const articles = await fetchGNewsSearch(query, apiKey);
      return ingestGNewsArticles(tenantId, runId, articles);
    },
  });
}
