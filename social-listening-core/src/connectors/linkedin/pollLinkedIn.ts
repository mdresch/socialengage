import { runIngestionAttempt, RunIngestionAttemptResult } from '../../ingestion/runIngestionAttempt';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { upsertAuthor } from '../../authors/authorStore';
import { insertSocialPost, findSocialPostByExternalId } from '../../posts/socialPostStore';
import { enrichPost } from '../azureAiLanguage/enrichPost';
import { BODY_MARKDOWN_VERSION } from '../../content/htmlToMarkdown';
import { listActiveWatchlistsForTenant } from '../../watchlists/watchlistStore';
import { publishSocialPostIngestedEvents } from '../../events/publishSocialPostIngestedEvents';
import { getLatestCredentialId, readCredential, storeCredential } from '../../credentials/credentialStore';
import { publishConnectorAlertEvent } from '../../events/publishConnectorAlertEvents';
import {
  linkedinConnector,
  fetchLinkedInMemberPosts,
  fetchLinkedInProfile,
  parseLinkedInCredential,
  refreshToken,
  classifyInvalidGrant,
  normalizeLinkedInPost,
  LINKEDIN_PROVIDER_ID,
  LinkedInCredential,
  RawLinkedInPost,
} from './linkedinConnector';

async function gatedAcquire(tenantId: string): Promise<void> {
  try {
    await acquireForProvider(tenantId, linkedinConnector);
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
 * Poll LinkedIn for a specific user under a tenant (Tier-3 user-bound connector per ADR-0069).
 */
export async function pollLinkedIn(
  tenantId: string,
  userId: string,
  deps?: {
    fetchMemberPosts?: typeof fetchLinkedInMemberPosts;
    now?: number;
  }
): Promise<RunIngestionAttemptResult> {
  return runIngestionAttempt({
    tenantId,
    connectorInfo: {
      platformId: LINKEDIN_PROVIDER_ID,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
      userId,
    },
    attempt: async (runId) => {
      const credId = await getLatestCredentialId(tenantId, LINKEDIN_PROVIDER_ID, 'user', userId);
      if (!credId) {
        throw new ClassifiableError('http_401', 'No LinkedIn credential found for user.');
      }

      let credentialPlaintext: string;
      try {
        credentialPlaintext = await readCredential(tenantId, credId);
      } catch (err) {
        throw new ClassifiableError('http_401', `Failed to read LinkedIn credential: ${(err as Error).message}`);
      }

      let credential = parseLinkedInCredential(credentialPlaintext);
      const now = deps?.now ?? Date.now();

      // Proactive token refresh if access token is expired or within 5 minutes of expiry
      const tokenExpiryMs = new Date(credential.accessTokenExpiresAt).getTime();
      if (tokenExpiryMs - now <= 5 * 60 * 1000) {
        if (credential.refreshToken) {
          try {
            credential = await refreshToken(credential, {
              clientId: process.env.LINKEDIN_CLIENT_ID || '',
              clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
              now,
            });
            // Persist refreshed credential
            await storeCredential(
              tenantId,
              LINKEDIN_PROVIDER_ID,
              JSON.stringify(credential),
              process.env.KEY_VAULT_KEY_ID || 'social-listening-key',
              'user',
              userId
            );
          } catch (refreshErr) {
            const classification = classifyInvalidGrant(credential.refreshTokenExpiresAt, now);
            await publishConnectorAlertEvent({
              tenantId,
              platformId: LINKEDIN_PROVIDER_ID,
              userId,
              alertType: 'reconnect_required',
              severity: 'warning',
              message: `LinkedIn authorization ${classification.credentialStatus}: ${classification.reason}`,
              metadata: {
                credentialStatus: classification.credentialStatus,
                reason: classification.reason,
              },
            });
            throw refreshErr;
          }
        } else {
          await publishConnectorAlertEvent({
            tenantId,
            platformId: LINKEDIN_PROVIDER_ID,
            userId,
            alertType: 'reconnect_required',
            severity: 'warning',
            message: 'LinkedIn authorization expired: reconnect required',
            metadata: {
              credentialStatus: 'expired',
              reason: 'access_token_expired',
            },
          });
          throw new ClassifiableError('http_401', 'LinkedIn access token expired. Reconnection required.');
        }
      }

      const watchlists = (await listActiveWatchlistsForTenant(tenantId)).filter((w) =>
        w.platformIds.includes(LINKEDIN_PROVIDER_ID)
      );

      await gatedAcquire(tenantId);

      // Best-effort profile fetch to ensure author name
      let authorDisplayName = credential.memberName || 'LinkedIn Member';
      let memberId = credential.memberId || userId;

      if (!credential.memberName || !credential.memberId) {
        try {
          const profile = await fetchLinkedInProfile(credential.accessToken);
          if (profile) {
            memberId = profile.id;
            const firstName = profile.localizedFirstName || '';
            const lastName = profile.localizedLastName || '';
            authorDisplayName = `${firstName} ${lastName}`.trim() || 'LinkedIn Member';
          }
        } catch {
          // Non-blocking fallback
        }
      }

      const defaultAuthor = await upsertAuthor(tenantId, LINKEDIN_PROVIDER_ID, memberId, {
        displayName: authorDisplayName,
        rawProfile: { memberId, displayName: authorDisplayName },
      });

      const fetchImpl = deps?.fetchMemberPosts || fetchLinkedInMemberPosts;
      const { posts } = await fetchImpl(credential.accessToken, {
        memberId,
        isOrgEnabled: process.env.LINKEDIN_ORG_ENABLED === 'true',
      });

      let postsIngested = 0;
      let postsSkipped = 0;

      for (const rawPost of posts) {
        const normalized = normalizeLinkedInPost(
          {
            ...rawPost,
            authorUrn: rawPost.authorUrn || memberId,
            authorName: rawPost.authorName || authorDisplayName,
          },
          tenantId
        );

        const existing = await findSocialPostByExternalId(tenantId, LINKEDIN_PROVIDER_ID, normalized.post.externalId);
        if (existing) {
          postsSkipped += 1;
          continue;
        }

        const enrichmentText = normalized.post.content;
        const enrichment = await enrichPost(tenantId, enrichmentText);

        const inserted = await insertSocialPost({
          tenantId,
          authorId: defaultAuthor.id,
          acquisitionId: runId,
          publishedAt: new Date(normalized.post.createdAt),
          rawPayload: {
            providerId: LINKEDIN_PROVIDER_ID,
            externalId: normalized.post.externalId,
          },
          enrichment: enrichment as Record<string, unknown> | undefined,
          bodyMarkdown: normalized.post.content,
          bodyMarkdownVersion: BODY_MARKDOWN_VERSION,
        });

        postsIngested += 1;

        await publishSocialPostIngestedEvents(tenantId, LINKEDIN_PROVIDER_ID, watchlists, {
          postId: inserted.id,
          text: enrichmentText,
          authorExternalId: normalized.author.externalId,
          publishedAt: new Date(normalized.post.createdAt).toISOString(),
        });
      }

      return { postsIngested, postsSkipped };
    },
  });
}
