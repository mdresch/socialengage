import { runIngestionAttempt, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';
import { readCredential } from '../../credentials/credentialStore';
import { publishConnectorAlertEvent } from '../../events/publishConnectorAlertEvents';
import { buildGeoEnrichment } from '../geo/geoCountryUtils';
import {
  listConnectedAccounts,
  updateAccountStatus,
  InstagramConnectedAccount,
} from './instagramConnectedAccountsStore';
import {
  instagramConnector,
  fetchInstagramMedia,
  fetchInstagramAccountMetadata,
  parseInstagramCredential,
  captionToMarkdown,
  INSTAGRAM_PROVIDER_ID,
  InstagramMediaItem,
} from './instagramConnector';

/** Pacing delay between multiple Instagram accounts in the same user tick. */
const INTER_ACCOUNT_PACING_MS = 1200;
/** Hard lookback boundary: 30 days per ADR-0068 §3. */
const MAX_LOOKBACK_DAYS = 30;
/** Hard fetch item ceiling: 100 items per ADR-0068 §3. */
const MAX_FETCH_ITEMS = 100;

async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, instagramConnector);
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
 * Runs a single poll cycle against one connected Instagram Business/Creator account.
 * Follows ADR-0068: single-row carousel modeling, 30-day/100-item pagination precedence,
 * newest-first existing ID short-circuit, and error reclassification with alert emission.
 */
export async function pollInstagramAccount(
  tenantId: string,
  userId: string,
  account: InstagramConnectedAccount
): Promise<RunIngestionAttemptResult> {
  const result = await runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: INSTAGRAM_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
      userId,
      pageId: account.pageId,
    },
    attempt: async (runId) => {
      if (!account.credentialId) {
        throw new ClassifiableError('http_401', 'Connected Instagram account has no credential (already removed).');
      }

      let credentialPlaintext: string;
      try {
        credentialPlaintext = await readCredential(tenantId, account.credentialId);
      } catch (err) {
        throw new ClassifiableError('http_401', `Failed to read Instagram credential: ${(err as Error).message}`);
      }

      const { igUserId, pageAccessToken } = parseInstagramCredential(credentialPlaintext);

      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(INSTAGRAM_PROVIDER_ID)
      );

      await gatedAcquire(tenantId);

      let accountMeta = { id: igUserId, username: account.username, followers_count: undefined as number | undefined };
      try {
        const fetchedMeta = await fetchInstagramAccountMetadata(igUserId, pageAccessToken);
        if (fetchedMeta) {
          accountMeta = {
            id: fetchedMeta.id ?? igUserId,
            username: fetchedMeta.username ?? account.username,
            followers_count: typeof fetchedMeta.followers_count === 'number' ? fetchedMeta.followers_count : undefined,
          };
        }
      } catch {
        // Best-effort metadata fetch
      }

      const author = await upsertAuthor(tenantId, INSTAGRAM_PROVIDER_ID, igUserId, {
        displayName: account.username,
        followerCount: accountMeta.followers_count,
        rawProfile: accountMeta,
      });

      const lookbackCeilingMs = Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      let totalFetched = 0;
      let postsIngested = 0;
      let postsSkipped = 0;
      let cursor: string | undefined = undefined;
      let stopPagination = false;

      while (!stopPagination && totalFetched < MAX_FETCH_ITEMS) {
        const fetchLimit = Math.min(25, MAX_FETCH_ITEMS - totalFetched);
        const mediaResponse = await fetchInstagramMedia(igUserId, pageAccessToken, {
          limit: fetchLimit,
          after: cursor,
        });

        const items: InstagramMediaItem[] = mediaResponse.data ?? [];
        if (items.length === 0) {
          break;
        }

        for (const item of items) {
          totalFetched += 1;

          // 1. Lookback ceiling check
          const itemPublishedMs = new Date(item.timestamp).getTime();
          if (!isNaN(itemPublishedMs) && itemPublishedMs < lookbackCeilingMs) {
            stopPagination = true;
            break;
          }

          const externalId = `instagram_${igUserId}_${item.id}`;

          // 2. Incremental short-circuit check
          const existing = await findSocialPostByExternalId(tenantId, INSTAGRAM_PROVIDER_ID, externalId);
          if (existing) {
            postsSkipped += 1;
            stopPagination = true; // Short-circuit further pagination per ADR-0068 §3
            break;
          }

          // 3. Carousel album modeling (ADR-0068 §4.B)
          let children: unknown[] | undefined = undefined;
          let childrenTruncated: boolean | undefined = undefined;
          if (item.media_type === 'CAROUSEL_ALBUM' && item.children?.data) {
            const rawChildren = item.children.data;
            childrenTruncated = rawChildren.length > 10;
            children = rawChildren.slice(0, 10);
          }

          // 4. Caption & canonical markdown
          const bodyMarkdown = captionToMarkdown(item.caption, item.media_type);
          const bodyMarkdownVersion = BODY_MARKDOWN_VERSION;

          // 5. Enrichment & Geospatial
          const enrichmentText = item.caption ?? '';
          let enrichment = enrichmentText ? await enrichPost(tenantId, enrichmentText) : undefined;

          if (item.location?.country) {
            const geo = buildGeoEnrichment(item.location.country, 'post', 'high');
            if (geo.geoCountry) {
              enrichment = {
                ...(enrichment ?? {}),
                ...geo,
              };
            }
          }

          // 6. Insert SocialPost with single-row carousel and hosting profile dependency
          const inserted = await insertSocialPost({
            tenantId,
            authorId: author.id,
            acquisitionId: runId,
            rawPayload: {
              ...item,
              providerId: INSTAGRAM_PROVIDER_ID,
              externalId,
              mediaId: item.id,
              igUserId,
              username: account.username,
              pageId: account.pageId,
              pageName: account.pageName,
              mediaType: item.media_type,
              mediaUrl: item.media_url,
              thumbnailUrl: item.thumbnail_url,
              likeCount: item.like_count,
              commentsCount: item.comments_count,
              ...(children ? { children, childrenTruncated } : {}),
              ...(item.location ? { location: item.location } : {}),
            },
            publishedAt: item.timestamp,
            enrichment: enrichment as unknown as Record<string, unknown> | undefined,
            bodyMarkdown,
            bodyMarkdownVersion,
          });

          // 7. Watchlist match events
          await publishSocialPostIngestedEvents(tenantId, INSTAGRAM_PROVIDER_ID, watchlists, {
            postId: inserted.id,
            text: enrichmentText || item.permalink || externalId,
            authorExternalId: `instagram:${igUserId}`,
            publishedAt: item.timestamp,
          });

          postsIngested += 1;

          if (totalFetched >= MAX_FETCH_ITEMS) {
            stopPagination = true;
            break;
          }
        }

        if (mediaResponse.paging?.cursors?.after && !stopPagination) {
          cursor = mediaResponse.paging.cursors.after;
        } else {
          break;
        }
      }

      return { postsIngested, postsSkipped };
    },
  });

  if (
    result.status === 'failed' &&
    result.errorSummary &&
    (result.errorSummary.includes('401') ||
      result.errorSummary.includes('auth error') ||
      result.errorSummary.includes('reconnect') ||
      result.errorSummary.includes('OAuthException') ||
      result.errorSummary.includes('access token'))
  ) {
    await updateAccountStatus(tenantId, userId, account.igUserId, 'reconnect_required');
    await publishConnectorAlertEvent({
      tenantId,
      platformId: INSTAGRAM_PROVIDER_ID,
      userId,
      alertType: 'reconnect_required',
      severity: 'warning',
      message: `Instagram account @${account.username} (${account.igUserId}) requires reconnection: ${result.errorSummary}`,
      metadata: { igUserId: account.igUserId, username: account.username },
    });
  }

  return result;
}

/**
 * Iterates through all connected Instagram accounts for a user sequentially,
 * running one independent poll cycle per account with 1.2s inter-account pacing delay.
 */
export async function pollInstagram(tenantId: string, userId: string): Promise<RunIngestionAttemptResult> {
  const accounts = await listConnectedAccounts(tenantId, userId);
  if (accounts.length === 0) {
    return {
      runId: 'none',
      status: 'succeeded',
    };
  }

  let anyFailed = false;
  let lastResult: RunIngestionAttemptResult | undefined = undefined;

  for (let i = 0; i < accounts.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, INTER_ACCOUNT_PACING_MS));
    }
    const account = accounts[i];
    const result = await pollInstagramAccount(tenantId, userId, account);
    lastResult = result;
    if (result.status === 'failed') {
      anyFailed = true;
    }
  }

  return {
    runId: lastResult?.runId ?? 'aggregate',
    status: anyFailed ? 'failed' : 'succeeded',
    errorSummary: lastResult?.errorSummary,
  };
}
