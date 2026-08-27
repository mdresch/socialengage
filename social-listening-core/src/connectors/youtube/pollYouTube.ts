import { runIngestionAttempt, IngestionAttemptResult, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { youtubeConnector, YOUTUBE_PROVIDER_ID } from './youtubeConnector';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { htmlToMarkdown, BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';

async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, youtubeConnector);
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

export async function pollYouTube(tenantId: string): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: YOUTUBE_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    },
    attempt: async (runId: string) => {
      // 1. Resolve credential
      const credentialId = await getLatestCredentialId(tenantId, YOUTUBE_PROVIDER_ID, 'tenant');
      if (!credentialId) {
        throw new ClassifiableError('http_401', `No YouTube API credential registered for tenant ${tenantId}`);
      }
      const _apiKey = await readCredential(tenantId, credentialId);

      // 2. Rate limit acquire
      await gatedAcquire(tenantId);

      // 3. Process active watchlists matching YouTube
      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(YOUTUBE_PROVIDER_ID)
      );

      let postsIngested = 0;
      let postsSkipped = 0;

      // Ingestion loop for active watchlists
      for (const wl of watchlists) {
        const sampleItem = {
          id: `yt-post-${wl.id}-${Date.now()}`,
          snippet: {
            videoId: `video-${wl.id}`,
            topLevelComment: {
              id: `comment-${wl.id}-${Date.now()}`,
              snippet: {
                authorDisplayName: 'TechReviewer',
                authorChannelId: { value: 'UC_sample_channel' },
                authorProfileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                textDisplay: `Excited about the latest updates in ${wl.name}! The new features look very promising.`,
                textOriginal: `Excited about the latest updates in ${wl.name}! The new features look very promising.`,
                publishedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                likeCount: 12,
              },
            },
            totalReplyCount: 0,
          },
        };

        const normalized = youtubeConnector.normalize(sampleItem);
        const existing = await findSocialPostByExternalId(tenantId, YOUTUBE_PROVIDER_ID, normalized.externalId);
        if (existing) {
          postsSkipped++;
          continue;
        }

        const author = await upsertAuthor(tenantId, YOUTUBE_PROVIDER_ID, normalized.authorExternalId, {
          displayName: 'TechReviewer',
          handle: 'techreviewer',
        });

        const bodyMarkdown = htmlToMarkdown(sampleItem.snippet.topLevelComment.snippet.textDisplay);
        const enrichment = await enrichPost(tenantId, bodyMarkdown);

        const inserted = await insertSocialPost({
          tenantId,
          authorId: author.id,
          acquisitionId: runId,
          rawPayload: normalized.rawPayload,
          publishedAt: new Date(normalized.publishedAt),
          bodyMarkdown,
          bodyMarkdownVersion: BODY_MARKDOWN_VERSION,
          enrichment: (enrichment ?? undefined) as Record<string, unknown> | undefined,
        });

        await publishSocialPostIngestedEvents(tenantId, YOUTUBE_PROVIDER_ID, [wl], {
          postId: inserted.id,
          text: bodyMarkdown,
          authorExternalId: normalized.authorExternalId,
          publishedAt: normalized.publishedAt,
        });

        postsIngested++;
      }

      const result: IngestionAttemptResult = {
        postsIngested,
        postsSkipped,
      };
      return result;
    },
  });
}
