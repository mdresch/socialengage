import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { gnewsConnector, fetchGNewsSearch, GNEWS_PROVIDER_ID, GNewsArticle } from './gnewsConnector';

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
  const credentialId = await getLatestCredentialId(tenantId, GNEWS_PROVIDER_ID);
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

    await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { providerId: GNEWS_PROVIDER_ID, externalId: normalized.externalId, ...article },
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
