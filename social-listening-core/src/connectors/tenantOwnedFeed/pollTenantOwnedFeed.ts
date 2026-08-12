import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { tenantOwnedFeedConnector, fetchTenantOwnedFeed, TENANT_OWNED_FEED_PROVIDER_ID } from './tenantOwnedFeedConnector';
import { getVerifiedActivations, TenantOwnedFeedActivationRow } from './tenantOwnedFeedStore';
import { ParsedFeedItem } from './feedItemParser';
import { enrichPost } from '../azureAiLanguage/enrichPost';

/** Same reclassification pattern every other real connector's own poll function establishes. */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, tenantOwnedFeedConnector);
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
 * one verified activation, within one IngestionRun. Split out from
 * pollTenantOwnedFeed() so it can be exercised directly against a synthetic
 * batch without a live HTTP fetch (same pattern as Newswire's
 * ingestNewswireItems()).
 */
export async function ingestTenantOwnedFeedItems(
  tenantId: string,
  runId: string,
  activation: TenantOwnedFeedActivationRow,
  items: ParsedFeedItem[]
): Promise<IngestionAttemptResult> {
  let postsIngested = 0;
  let postsSkipped = 0;

  for (const item of items) {
    const normalized = tenantOwnedFeedConnector.normalize({ item, verifiedDomain: activation.domain });

    const existing = await findSocialPostByExternalId(tenantId, TENANT_OWNED_FEED_PROVIDER_ID, normalized.externalId);
    if (existing) {
      postsSkipped += 1;
      continue;
    }

    // ADR-0050 Decision §4: Author is the verified domain itself, never an
    // individual — organization-as-Author, per ADR-0004's generalized clause.
    const author = await upsertAuthor(tenantId, TENANT_OWNED_FEED_PROVIDER_ID, activation.domain, {
      displayName: activation.domain,
      rawProfile: { domain: activation.domain },
    });

    const enrichment = await enrichPost(tenantId, item.title);

    await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { providerId: TENANT_OWNED_FEED_PROVIDER_ID, externalId: normalized.externalId, ...item },
      publishedAt: normalized.publishedAt,
      enrichment: enrichment as unknown as Record<string, unknown> | undefined,
    });

    postsIngested += 1;
  }

  return { postsIngested, postsSkipped };
}

/**
 * One poll cycle across every one of a tenant's verified activations
 * (ADR-0050 Decision §5 — a tenant may verify more than one domain).
 * **Never polls a `pending` or `expired` activation's feed** —
 * getVerifiedActivations() only ever returns `status = 'verified'` rows,
 * which is what actually enforces "polling never begins while verification
 * is pending" (this story's own AC3), not a check inside the fetch loop
 * itself. If a tenant has zero verified activations, this is a correct
 * no-op: runIngestionAttempt() still runs (so its own accounting/health
 * derivation stays consistent with every other connector), but the fetch
 * loop body never executes. See
 * .claude/skills/tenant-owned-feed-connector/SKILL.md.
 */
export async function pollTenantOwnedFeed(tenantId: string): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: TENANT_OWNED_FEED_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId) => {
      const activations = await getVerifiedActivations(tenantId);
      let postsIngested = 0;
      let postsSkipped = 0;

      for (const activation of activations) {
        await gatedAcquire(tenantId);
        const items = await fetchTenantOwnedFeed(activation.feed_url);
        const result = await ingestTenantOwnedFeedItems(tenantId, runId, activation, items);
        postsIngested += result.postsIngested;
        postsSkipped += result.postsSkipped;
      }

      return { postsIngested, postsSkipped };
    },
  });
}
