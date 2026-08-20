import { runIngestionAttempt, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';
import { readCredential } from '../../credentials/credentialStore';
import { listConnectedPages, FacebookConnectedPage } from './facebookConnectedPagesStore';
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
 * Story 6.27 (ADR-0060 Decision §3) / Story 2.23 (ADR-0067) — runs a single poll cycle against one
 * connected Page, creating one IngestionRun record carrying the specific
 * `pageId` in `connectorInfo` — the load-bearing piece that makes Decision
 * §4's per-Page health possible. This is the exact body `pollFacebook()`'s
 * own single-Page version already ran; only the credential lookup changed
 * (reads the already-known `credentialId` from the connected-Page row
 * directly, never `getLatestCredentialId()` — this function's own caller
 * already knows exactly which credential belongs to which Page).
 */
export async function pollFacebookPage(tenantId: string, userId: string, page: FacebookConnectedPage): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: FACEBOOK_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
      userId,
      pageId: page.pageId,
    },
    attempt: async (runId) => {
      // A status='connected' row (the only kind listConnectedPages() ever
      // returns) always has a real credentialId — it is only ever nulled
      // by the DELETE .../pages/:id path, which also sets status='removed'
      // in the same call. Still a real, classified failure rather than a
      // crash if that invariant is ever violated.
      if (!page.credentialId) {
        throw new ClassifiableError('http_401', 'Connected Facebook Page has no credential (already removed).');
      }
      const credentialPlaintext = await readCredential(tenantId, page.credentialId);
      const { pageId, pageAccessToken } = parseFacebookCredential(credentialPlaintext);

      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(FACEBOOK_PROVIDER_ID)
      );

      await gatedAcquire(tenantId);
      const [posts, pageMeta] = await Promise.all([
        fetchFacebookPagePosts(pageId, pageAccessToken),
        fetchFacebookPageMetadata(pageId, pageAccessToken),
      ]);

      // ADR-0059 Decision §5 — default Page Author (organization-as-
      // Author, a fourth instance of ADR-0004's already-generalized
      // clause), upserted once per poll regardless of how many posts this
      // batch contains — the same "author upserted once, reused per post"
      // shape every other connector's own ingest loop already establishes.
      // ADR-0060's own "A standing check applied, not skipped: author
      // rights" section confirms this stays per-Page and unmerged across a
      // user's several connected Pages.
      const defaultPageAuthor = await upsertAuthor(tenantId, FACEBOOK_PROVIDER_ID, pageMeta.id, {
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

        // Story 2.23 (ADR-0067) — Two-tier author resolution hierarchy:
        // Tier 1: True Author (from.name) when Graph API returns a distinct creator
        // Tier 2: Page Fallback when from is absent or from.id === pageMeta.id
        let resolvedAuthorId = defaultPageAuthor.id;
        let resolvedAuthorName = pageMeta.name;
        let resolvedAuthorExternalId = normalized.authorExternalId;

        if (post.from?.id && post.from.name && post.from.id !== pageMeta.id) {
          const individualAuthor = await upsertAuthor(tenantId, FACEBOOK_PROVIDER_ID, post.from.id, {
            displayName: post.from.name,
            rawProfile: post.from,
          });
          resolvedAuthorId = individualAuthor.id;
          resolvedAuthorName = post.from.name;
          resolvedAuthorExternalId = `facebook:${post.from.id}`;
        }

        const convertedBody = post.message ? htmlToMarkdown(post.message) : '';
        const bodyMarkdown = convertedBody.length > 0 ? convertedBody : undefined;
        const bodyMarkdownVersion = bodyMarkdown !== undefined ? BODY_MARKDOWN_VERSION : undefined;

        const enrichmentText = post.message ?? '';
        const enrichment = enrichmentText ? await enrichPost(tenantId, enrichmentText) : undefined;

        const inserted = await insertSocialPost({
          tenantId,
          authorId: resolvedAuthorId,
          acquisitionId: runId,
          // Story 2.23 (ADR-0067) — Explicit hosting Facebook Page dependency (pageId/pageName)
          // and resolved author recorded in rawPayload.
          rawPayload: {
            providerId: FACEBOOK_PROVIDER_ID,
            externalId: normalized.externalId,
            pageId: pageMeta.id,
            pageName: pageMeta.name,
            author: resolvedAuthorName,
            ...(post.from ? { from: post.from } : {}),
            ...post,
          },
          publishedAt: normalized.publishedAt,
          enrichment: enrichment as unknown as Record<string, unknown> | undefined,
          bodyMarkdown,
          bodyMarkdownVersion,
        });

        await publishSocialPostIngestedEvents(tenantId, FACEBOOK_PROVIDER_ID, watchlists, {
          postId: inserted.id,
          text: enrichmentText || post.permalink_url || normalized.externalId,
          authorExternalId: resolvedAuthorExternalId,
          publishedAt: normalized.publishedAt,
        });

        postsIngested += 1;
      }

      return { postsIngested, postsSkipped };
    },
  });
}

/**
 * ADR-0060 Decision §3 — lists every `status = 'connected'` row in
 * `facebook_connected_pages` for `(tenantId, userId)` and runs one
 * independent `pollFacebookPage()` call per row, **sequentially** (one
 * Page's entire attempt, including its own `gatedAcquire()` call,
 * completes before the next begins — never `Promise.all()`-style
 * concurrent fan-out). This reuses `RequestGate`'s own already-existing
 * per-`(tenantId, providerId)` serialization/pacing (`requestGate.ts`) as
 * its sole mitigation for the increased call-volume risk (ADR-0060
 * Consequences) — a second, redundant jitter/delay layer here would
 * duplicate work `RequestGate` already does.
 *
 * One Page's `ClassifiableError` does not prevent the next Page in the
 * loop from being attempted — `runIngestionAttempt()` itself already
 * catches `ClassifiableError` internally and *resolves* (never rejects),
 * so this loop needs no extra try/catch for that case; only a genuine raw,
 * non-`ClassifiableError` exception could reject a single page's promise,
 * and that is explicitly not caught here either — the same
 * "runIngestionAttempt() only catches ClassifiableError" load-bearing rule
 * every other connector's own poll function already honors (see
 * connector-health-and-error-handling/SKILL.md). A raw exception from one
 * Page therefore does still stop this function's own loop; the Tier-3
 * scheduler's own per-user `try`/`catch` (ADR-0061, `pollScheduler.ts`) is
 * what isolates that from other users/tenants in the same tick — this
 * function's own isolation guarantee is scoped to `ClassifiableError`-class
 * per-Page failures, exactly as ADR-0060 Decision §3 states.
 *
 * `userId` is a required parameter (not optional the way tenant-wide
 * connectors' `poll(tenantId)` is) because there is structurally no
 * tenant-wide credential to fall back to for this connector (ADR-0059
 * Decision §4) — this is the function registered as `pollUser` in
 * `bootstrapConnectors.ts` (Story 1.15, ADR-0061).
 *
 * Returns a single aggregate `RunIngestionAttemptResult` for callers that
 * need one value (the Tier-3 scheduler discards it; the "no connected
 * Pages" fast path and this project's own existing direct-call tests rely
 * on it): `status` is `'succeeded'` only if every Page's own attempt
 * succeeded, `runId` is the last Page's own run id.
 */
export async function pollFacebook(tenantId: string, userId: string): Promise<RunIngestionAttemptResult> {
  const pages = await listConnectedPages(tenantId, userId);

  if (pages.length === 0) {
    // No connected Pages at all — a real, single IngestionRun (no pageId,
    // matching every pre-Story-6.27 row's own shape) records this as a
    // clear, classified failure rather than silently no-op'ing, the same
    // fast-path treatment the prior single-credential version gave "no
    // credential connected."
    return runIngestionAttempt({
      tenantId,
      connectorInfo: { platformId: FACEBOOK_PROVIDER_ID, triggerType: 'poll', connectorVersion: '1.0.0', userId },
      attempt: async () => {
        throw new ClassifiableError('http_401', 'No Facebook Pages connected for this user.');
      },
    });
  }

  const results: RunIngestionAttemptResult[] = [];
  for (const page of pages) {
    results.push(await pollFacebookPage(tenantId, userId, page));
  }

  const allSucceeded = results.every((r) => r.status === 'succeeded');
  const failed = results.filter((r) => r.status === 'failed');
  return {
    runId: results[results.length - 1].runId,
    status: allSucceeded ? 'succeeded' : 'failed',
    errorSummary: failed.length > 0 ? failed.map((r) => r.errorSummary).filter(Boolean).join('; ') : undefined,
  };
}
