import { runIngestionAttempt, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import {
  facebookConnector,
  fetchFacebookPagePosts,
  fetchFacebookPageMetadata,
  parseFacebookCredential,
  FACEBOOK_PROVIDER_ID,
  FacebookPagePost,
} from './facebookConnector';

/** Same reclassification pattern every other real connector's own poll function establishes. */
async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, facebookConnector);
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
 * ADR-0059 Decision §4 — this connector's credential is Tier 3 (user-bound),
 * never Tier 2 (tenant-wide) — the only real connector in this project's
 * roster where getLatestCredentialId()/readCredential() are called with
 * ownerType:'user' from a poll path, not 'tenant'. `userId` is a required
 * parameter (not optional the way tenant-wide connectors' poll(tenantId)
 * is) because there is structurally no tenant-wide credential to fall back
 * to for this connector — see facebookConnector.ts's own doc comment for
 * why this can't be wired into the scheduler's generic poll(tenantId)
 * invocation yet.
 */
export async function pollFacebook(tenantId: string, userId: string): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: FACEBOOK_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId) => {
      const credentialId = await getLatestCredentialId(tenantId, FACEBOOK_PROVIDER_ID, 'user', userId);
      if (!credentialId) {
        throw new ClassifiableError('http_401', 'No Facebook credential connected for this user.');
      }
      const credentialPlaintext = await readCredential(tenantId, credentialId);
      const { pageId, pageAccessToken } = parseFacebookCredential(credentialPlaintext);

      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(FACEBOOK_PROVIDER_ID)
      );

      await gatedAcquire(tenantId);
      const [posts, pageMeta] = await Promise.all([
        fetchFacebookPagePosts(pageId, pageAccessToken),
        fetchFacebookPageMetadata(pageId, pageAccessToken),
      ]);

      // ADR-0059 Decision §5 — the Page is the Author (organization-as-
      // Author, a fourth instance of ADR-0004's already-generalized
      // clause), upserted once per poll regardless of how many posts this
      // batch contains — the same "author upserted once, reused per post"
      // shape every other connector's own ingest loop already establishes.
      const author = await upsertAuthor(tenantId, FACEBOOK_PROVIDER_ID, pageMeta.id, {
        displayName: pageMeta.name,
        followerCount: typeof pageMeta.fan_count === 'number' ? pageMeta.fan_count : undefined,
        rawProfile: { id: pageMeta.id, name: pageMeta.name, fan_count: pageMeta.fan_count },
      });

      let postsIngested = 0;
      let postsSkipped = 0;

      for (const post of posts as FacebookPagePost[]) {
        const normalized = facebookConnector.normalize({ ...post, pageId: pageMeta.id });

        const existing = await findSocialPostByExternalId(tenantId, FACEBOOK_PROVIDER_ID, normalized.externalId);
        if (existing) {
          postsSkipped += 1;
          continue;
        }

        const convertedBody = post.message ? htmlToMarkdown(post.message) : '';
        const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
        const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

        const enrichmentText = post.message ?? '';
        const enrichment = enrichmentText ? await enrichPost(tenantId, enrichmentText) : undefined;

        const inserted = await insertSocialPost({
          tenantId,
          authorId: author.id,
          acquisitionId: runId,
          rawPayload: { providerId: FACEBOOK_PROVIDER_ID, externalId: normalized.externalId, ...post },
          publishedAt: normalized.publishedAt,
          enrichment: enrichment as unknown as Record<string, unknown> | undefined,
          bodyMarkdown,
          bodyMarkdownVersion,
        });

        await publishSocialPostIngestedEvents(tenantId, FACEBOOK_PROVIDER_ID, watchlists, {
          postId: inserted.id,
          text: enrichmentText || post.permalink_url || normalized.externalId,
          authorExternalId: normalized.authorExternalId,
          publishedAt: normalized.publishedAt,
        });

        postsIngested += 1;
      }

      return { postsIngested, postsSkipped };
    },
  });
}
