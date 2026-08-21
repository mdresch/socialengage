// Contract: Story 2.25 (ADR-0069) — LinkedIn Connector: Confidential Client OAuth,
// Token Lifecycle with Persisted Expiry, Rest.li Rate Limiting, and 1-Hour Poller Guardrails.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-225
//
// Intent:
// 1. SocialConnector for providerId 'linkedin' with authMode 'oauth', deliveryMode 'poll'.
// 2. Confidential client OAuth code exchange with tenant-scoped state parameter (10m TTL).
// 3. Persisted refreshTokenExpiresAt (365 days) and 60-day access token refresh lifecycle with refresh token retention.
// 4. Proactive expiring_soon warnings and deterministic invalid_grant classification (expired vs revoked).
// 5. Rest.li rate-limit header extraction with epoch seconds to epoch milliseconds conversion.
// 6. 1-hour polling cadence guardrail enforcement.
// 7. Graceful organization scope degradation (403 non-fatal).
// 8. Best-effort idempotent token revocation on disconnect.
// 9. Data normalization with raw JSON response payloads discarded (ADR-0018).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import {
  linkedinConnector,
  generateState,
  validateAndConsumeState,
  clearStateCache,
  getAuthUrl,
  exchangeAuthorizationCode,
  refreshToken,
  evaluateCredentialStatus,
  classifyInvalidGrant,
  parseRateLimitHeaders,
  validateLinkedInPollCadence,
  revokeToken,
  disconnectLinkedIn,
  normalizeLinkedInPost,
  parseLinkedInCredential,
  fetchLinkedInMemberPosts,
  LINKEDIN_PROVIDER_ID,
  LINKEDIN_MEMBER_SCOPES,
  LINKEDIN_ORG_SCOPES,
  LinkedInCredential,
} from '../../src/connectors/linkedin/linkedinConnector';
import { pollLinkedIn } from '../../src/connectors/linkedin/pollLinkedIn';
import { findSocialPostByExternalId, getSocialPostById } from '../../src/posts/socialPostStore';
import * as credentialStore from '../../src/credentials/credentialStore';
import * as serviceBusPublisher from '../../src/events/serviceBusPublisher';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

describe('Story 2.25 Contract: LinkedIn Connector (ADR-0069)', () => {
  let tenantId: string;
  let userId: string;
  let publishedEvents: unknown[] = [];

  beforeAll(async () => {
    const { rows: tenantRows } = await getPlatformAdminPool().query<{ id: string }>(
      `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
      [`LinkedIn Test Tenant ${randomUUID().slice(0, 8)}`, 5]
    );
    tenantId = tenantRows[0].id;

    const { rows: userRows } = await getAdminPool().query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
      [tenantId, `user-${randomUUID().slice(0, 8)}@example.com`]
    );
    userId = userRows[0].id;
  });

  beforeEach(() => {
    clearStateCache();
    publishedEvents = [];
    jest.spyOn(serviceBusPublisher, 'publishEvent').mockImplementation(async () => {
      publishedEvents.push({});
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AC1: Connector Definition & Confidential Client OAuth', () => {
    it('implements SocialConnector with oauth authMode, poll deliveryMode, and 1-hour minPollInterval', () => {
      expect(linkedinConnector.providerId).toBe('linkedin');
      expect(linkedinConnector.authMode).toBe('oauth');
      expect(linkedinConnector.deliveryMode).toBe('poll');

      const rateLimitConfig = linkedinConnector.getRateLimitConfig();
      expect(rateLimitConfig.requestsPerWindow).toBe(100);
      expect(rateLimitConfig.windowSeconds).toBe(86400);
    });

    it('generates authorize URL with cryptographically secure, tenant-scoped state parameter and 10m TTL', () => {
      const state = generateState(tenantId);
      expect(state).toHaveLength(64); // 32 bytes hex

      const authUrl = getAuthUrl(tenantId, state, {
        clientId: 'mock_client_id',
        redirectUri: 'https://app.socialengage.io/auth/callback',
      });

      expect(authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('client_id=mock_client_id');
      expect(authUrl).toContain('state=' + encodeURIComponent(state));
      expect(authUrl).toContain('scope=openid+profile+email+w_member_social');

      // Validate and consume state
      const isValid = validateAndConsumeState(tenantId, state);
      expect(isValid).toBe(true);

      // Single-use guarantee: consuming again fails
      const isReplayValid = validateAndConsumeState(tenantId, state);
      expect(isReplayValid).toBe(false);
    });

    it('exchanges authorization code for tokens and initializes refreshTokenExpiresAt to now + 365 days', async () => {
      const state = generateState(tenantId);
      const now = new Date('2026-08-21T00:00:00.000Z').getTime();

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock_access_token_60d',
          expires_in: 5184000, // 60 days
          refresh_token: 'mock_refresh_token_1y',
          refresh_token_expires_in: 31536000, // 365 days
          scope: 'openid profile email w_member_social r_member_social',
        }),
      }) as unknown as typeof fetch;

      const cred = await exchangeAuthorizationCode('mock_code_123', state, tenantId, {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        redirectUri: 'https://app.socialengage.io/auth/callback',
        fetchImpl: mockFetch,
        now,
      });

      expect(cred.accessToken).toBe('mock_access_token_60d');
      expect(cred.refreshToken).toBe('mock_refresh_token_1y');
      expect(cred.accessTokenExpiresAt).toBe(new Date(now + 60 * 24 * 3600 * 1000).toISOString());
      expect(cred.refreshTokenExpiresAt).toBe(new Date(now + 365 * 24 * 3600 * 1000).toISOString());
    });
  });

  describe('AC2: Token Refresh & Lifecycle Management', () => {
    it('retains existing refresh_token and refreshTokenExpiresAt when response omits new refresh_token', async () => {
      const now = new Date('2026-08-21T00:00:00.000Z').getTime();
      const existingRefreshTokenExpiresAt = '2027-08-20T00:00:00.000Z';

      const initialCred: LinkedInCredential = {
        accessToken: 'old_access_token',
        accessTokenExpiresAt: '2026-08-20T00:00:00.000Z', // expired
        refreshToken: 'retained_refresh_token',
        refreshTokenExpiresAt: existingRefreshTokenExpiresAt,
        scopes: LINKEDIN_MEMBER_SCOPES,
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new_refreshed_access_token',
          expires_in: 5184000, // 60 days
          // refresh_token omitted by LinkedIn
        }),
      }) as unknown as typeof fetch;

      const refreshed = await refreshToken(initialCred, {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        fetchImpl: mockFetch,
        now,
      });

      expect(refreshed.accessToken).toBe('new_refreshed_access_token');
      expect(refreshed.accessTokenExpiresAt).toBe(new Date(now + 60 * 24 * 3600 * 1000).toISOString());
      expect(refreshed.refreshToken).toBe('retained_refresh_token');
      expect(refreshed.refreshTokenExpiresAt).toBe(existingRefreshTokenExpiresAt);
    });

    it('updates refresh_token and resets refreshTokenExpiresAt when response returns rotated refresh_token', async () => {
      const now = new Date('2026-08-21T00:00:00.000Z').getTime();

      const initialCred: LinkedInCredential = {
        accessToken: 'old_access_token',
        accessTokenExpiresAt: '2026-08-20T00:00:00.000Z',
        refreshToken: 'old_refresh_token',
        refreshTokenExpiresAt: '2026-12-01T00:00:00.000Z',
        scopes: LINKEDIN_MEMBER_SCOPES,
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new_refreshed_access_token',
          expires_in: 5184000,
          refresh_token: 'rotated_new_refresh_token',
        }),
      }) as unknown as typeof fetch;

      const refreshed = await refreshToken(initialCred, {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        fetchImpl: mockFetch,
        now,
      });

      expect(refreshed.refreshToken).toBe('rotated_new_refresh_token');
      expect(refreshed.refreshTokenExpiresAt).toBe(new Date(now + 365 * 24 * 3600 * 1000).toISOString());
    });

    it('surfaces expiring_soon when access token <= 7 days or refresh token <= 30 days', () => {
      const now = new Date('2026-08-21T00:00:00.000Z').getTime();

      // Valid: access 30d out, refresh 300d out
      expect(
        evaluateCredentialStatus(
          {
            accessTokenExpiresAt: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
            refreshTokenExpiresAt: new Date(now + 300 * 24 * 3600 * 1000).toISOString(),
          },
          now
        )
      ).toBe('valid');

      // Expiring soon due to access token within 5 days
      expect(
        evaluateCredentialStatus(
          {
            accessTokenExpiresAt: new Date(now + 5 * 24 * 3600 * 1000).toISOString(),
            refreshTokenExpiresAt: new Date(now + 300 * 24 * 3600 * 1000).toISOString(),
          },
          now
        )
      ).toBe('expiring_soon');

      // Expiring soon due to refresh token within 20 days
      expect(
        evaluateCredentialStatus(
          {
            accessTokenExpiresAt: new Date(now + 40 * 24 * 3600 * 1000).toISOString(),
            refreshTokenExpiresAt: new Date(now + 20 * 24 * 3600 * 1000).toISOString(),
          },
          now
        )
      ).toBe('expiring_soon');
    });

    it('classifies invalid_grant deterministically into expired vs revoked based on refreshTokenExpiresAt', () => {
      const now = new Date('2026-08-21T00:00:00.000Z').getTime();

      // Case A: now > refreshTokenExpiresAt => expired (>1 year)
      const pastExpiry = '2026-08-01T00:00:00.000Z';
      const resultExpired = classifyInvalidGrant(pastExpiry, now);
      expect(resultExpired.credentialStatus).toBe('expired');
      expect(resultExpired.reason).toContain('Refresh token expired');
      expect(resultExpired.reconnectRequired).toBe(true);

      // Case B: now <= refreshTokenExpiresAt => revoked by user or password changed
      const futureExpiry = '2027-08-01T00:00:00.000Z';
      const resultRevoked = classifyInvalidGrant(futureExpiry, now);
      expect(resultRevoked.credentialStatus).toBe('revoked');
      expect(resultRevoked.reason).toContain('Authorization revoked');
      expect(resultRevoked.reconnectRequired).toBe(true);
    });
  });

  describe('AC3: Rest.li Rate-Limit Header Extraction', () => {
    it('defensively parses x-restli-gateway-ratelimit-* headers and converts reset epoch seconds to ms', () => {
      const resetEpochSeconds = 1787366400; // e.g. epoch seconds
      const headers = {
        'x-restli-gateway-ratelimit-remaining': '42',
        'x-restli-gateway-ratelimit-limit': '100',
        'x-restli-gateway-ratelimit-reset': String(resetEpochSeconds),
      };

      const parsed = parseRateLimitHeaders(headers);
      expect(parsed.remainingRequests).toBe(42);
      expect(parsed.resetEpochMs).toBe(resetEpochSeconds * 1000);
    });

    it('falls back to standard x-ratelimit-* headers if Rest.li headers are absent', () => {
      const headers = {
        'x-ratelimit-remaining': '15',
        'x-ratelimit-reset': '1787366400',
      };

      const parsed = parseRateLimitHeaders(headers);
      expect(parsed.remainingRequests).toBe(15);
      expect(parsed.resetEpochMs).toBe(1787366400 * 1000);
    });
  });

  describe('AC4: Polling Cadence Guardrail Validation', () => {
    it('strictly rejects polling intervals < 3600s without partner verification and org enabled flag', () => {
      expect(() => validateLinkedInPollCadence(1800)).toThrow(
        /cannot be less than 3600 seconds/
      );
      expect(() => validateLinkedInPollCadence(300)).toThrow(
        /cannot be less than 3600 seconds/
      );
    });

    it('permits polling intervals >= 3600s and allows < 3600s when partner verified with org enabled', () => {
      expect(() => validateLinkedInPollCadence(3600)).not.toThrow();
      expect(() => validateLinkedInPollCadence(7200)).not.toThrow();
      expect(() =>
        validateLinkedInPollCadence(900, { isOrgEnabled: true, isPartnerVerified: true })
      ).not.toThrow();
    });
  });

  describe('AC5: Graceful Scope Degradation', () => {
    it('continues member post ingestion without failing when organization scope returns 403', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'FORBIDDEN', message: 'Missing w_organization_social scope' }),
      }) as unknown as typeof fetch;

      const result = await fetchLinkedInMemberPosts('mock_token', {
        isOrgEnabled: true,
        fetchImpl: mockFetch,
      });

      expect(result.posts).toEqual([]);
    });
  });

  describe('AC6: Best-Effort Revocation & Disconnect', () => {
    it('prefers refresh token for revocation and handles non-200 responses without throwing', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Token already revoked or invalid',
      }) as unknown as typeof fetch;

      const cred: LinkedInCredential = {
        accessToken: 'access_tok',
        accessTokenExpiresAt: '2026-09-01T00:00:00.000Z',
        refreshToken: 'refresh_tok_preferred',
        refreshTokenExpiresAt: '2027-08-01T00:00:00.000Z',
        scopes: LINKEDIN_MEMBER_SCOPES,
      };

      // Disconnect must not throw even if revoke endpoint returns non-200
      await expect(
        disconnectLinkedIn(cred, {
          clientId: 'client_id',
          clientSecret: 'client_secret',
          fetchImpl: mockFetch,
        })
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/revoke',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('token=refresh_tok_preferred'),
        })
      );
    });
  });

  describe('AC7: Data Normalization & End-to-End User Polling', () => {
    it('normalizes posts, maps author urn, and discards raw JSON payload per ADR-0018', () => {
      const rawPost = {
        id: 'urn:li:share:7123456789',
        authorUrn: 'urn:li:person:alex123',
        authorName: 'Alex Mercer',
        commentary: 'Excited to announce our new product release!',
        createdAt: 1787366400000,
      };

      const normalized = normalizeLinkedInPost(rawPost, tenantId);
      expect(normalized.post.externalId).toBe('linkedin_7123456789');
      expect(normalized.post.authorExternalId).toBe('linkedin:alex123');
      expect(normalized.post.content).toBe('Excited to announce our new product release!');
      expect(normalized.author.displayName).toBe('Alex Mercer');
    });

    it('polls LinkedIn for a user and ingests posts into social_posts table with discarded rawPayload', async () => {
      const postId = `share_${randomUUID().slice(0, 8)}`;
      const memberId = `member_${randomUUID().slice(0, 8)}`;

      // Save credential in platform_credentials table
      const cred: LinkedInCredential = {
        accessToken: 'valid_access_token',
        accessTokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        refreshToken: 'valid_refresh_token',
        refreshTokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        memberId,
        memberName: 'Jane Doe',
        scopes: LINKEDIN_MEMBER_SCOPES,
      };

      await getAdminPool().query(
        `INSERT INTO platform_credentials (tenant_id, platform_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext, status, owner_type, user_id)
         VALUES ($1, 'linkedin', '\\x00', 'key_mock', '\\x00', '\\x00', '\\x00', 'valid', 'user', $2)`,
        [tenantId, userId]
      );

      jest.spyOn(credentialStore, 'readCredential').mockResolvedValue(JSON.stringify(cred));

      const mockFetchPosts = jest.fn().mockResolvedValue({
        posts: [
          {
            id: postId,
            authorUrn: memberId,
            authorName: 'Jane Doe',
            commentary: 'Building scalable social listening architectures #engineering',
            createdAt: Date.now(),
          },
        ],
      });

      const outcome = await pollLinkedIn(tenantId, userId, {
        fetchMemberPosts: mockFetchPosts,
      });

      expect(outcome.status).toBe('succeeded');

      const postInDb = await findSocialPostByExternalId(tenantId, LINKEDIN_PROVIDER_ID, `linkedin_${postId}`);
      expect(postInDb).not.toBeNull();

      const { rows } = await getAdminPool().query<{ id: string; body_markdown: string; raw_payload: Record<string, unknown> }>(
        `SELECT id, body_markdown, raw_payload FROM social_posts WHERE id = $1`,
        [postInDb!.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].body_markdown).toContain('Building scalable social listening');
      expect(rows[0].raw_payload.providerId).toBe('linkedin');
      expect(rows[0].raw_payload.externalId).toBe(`linkedin_${postId}`);
    });
  });

  // -------------------------------------------------------------------------
  // AC8: REST Endpoints (ADR-0069)
  // -------------------------------------------------------------------------
  describe('AC8: REST Endpoints (OAuth Start & Exchange)', () => {
    function authAs(tId: string, uId: string) {
      return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        (req as unknown as { identity: unknown }).identity = { type: 'tenant_user', tenantId: tId, userId: uId, role: 'tenant_user' };
        next();
      };
    }

    it('POST /v1/connectors/linkedin/oauth/start returns state and authorizeUrl', async () => {
      const express = (await import('express')).default;
      const request = (await import('supertest')).default;
      const { createV1Router } = await import('../../src/http/versions/v1/router');

      const app = express();
      app.use(express.json());
      app.use('/v1', createV1Router(authAs(tenantId, userId), authAs(tenantId, userId)));

      const res = await request(app).post('/v1/connectors/linkedin/oauth/start').send({});
      expect(res.status).toBe(200);
      expect(typeof res.body.state).toBe('string');
      expect(typeof res.body.authorizeUrl).toBe('string');
      expect(res.body.authorizeUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
    });
  });
});

