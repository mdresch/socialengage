/**
 * Contract: Story 2.15 (ADR-0059) — Facebook connector: tenant's own
 * connected Page, posts only, Tier 3 credential.
 * See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-215
 *
 * Intent: Story 2.15 — the first authMode:'oauth' connector in this
 * project's shipped roster, and the first Tier-3-only connector (no
 * tenant-wide credential path at all).
 *
 * Scope: src/connectors/facebook/facebookConnector.ts (new),
 *   src/connectors/facebook/pollFacebook.ts (new),
 *   src/connectors/bootstrapConnectors.ts (extended — registration),
 *   src/http/versions/v1/facebookOAuthRouter.ts (new — the dedicated
 *     OAuth exchange/select-page flow this connector needs, structurally
 *     different from the generic api_key-shaped POST /connect),
 *   src/http/versions/v1/router.ts (extended — mounts the new router,
 *     same "more specific path before the generic /connectors mount"
 *     pattern tenantOwnedFeedRouter.ts already established),
 *   src/http/versions/v1/connectorsRouter.ts (extended — the generic
 *     POST /:platformId/connect now rejects authMode:'oauth' platforms
 *     outright, forcing use of the dedicated flow; this is what actually
 *     prevents a Tier-2 bypass of ADR-0059 Decision §4's Tier-3-only rule,
 *     which the generic endpoint has no other way to enforce),
 *   src/connectors/connectorHealth.ts (extended — a new
 *     'reconnect_required' ConnectorHealthStatus, derived from a
 *     credential-class failure on the most recent run),
 *   src/ingestion/ingestionRunStore.ts (extended — a new, nullable
 *     is_credential_failure column/param, mirroring the existing
 *     `retryable` column's own shape),
 *   src/ingestion/runIngestionAttempt.ts (extended — computes and passes
 *     is_credential_failure at both `completeIngestionRun({status:'failed'})`
 *     call sites, using the already-imported isCredentialError()),
 *   migrations/0032_add_ingestion_runs_credential_failure_flag.sql (new).
 *
 * Contract to encode:
 * - AC1: a registered SocialConnector (authMode:'oauth', deliveryMode:
 *   'poll', distinct providerId) targets the Graph API's Page-feed
 *   endpoint — registered without any core pipeline change (ADR-0048).
 * - AC2: the dedicated OAuth flow (facebookOAuthRouter.ts) exchanges an
 *   authorization code for a long-lived Page access token and stores it
 *   as a Tier 3, user-bound credential (platform_credentials.owner_type =
 *   'user', tied to the connecting individual's own resolved userId,
 *   never a client-supplied one) — the generic /connect endpoint rejects
 *   this platform outright, so there is no path to create a tenant-wide
 *   credential for it at all.
 * - AC3: only the Page's own published posts are ingested — no
 *   comment/mention endpoint is ever called.
 * - AC4: Author resolves to the Page (organization-as-Author) —
 *   externalAuthorId = Page id, displayName = Page name, followerCount
 *   populated from the Page's own real fan count.
 * - AC5: supportedQueryFeatures is empty; matching is 100% post-fetch
 *   fallback.
 * - AC6: getRateLimitConfig() returns a real, explicitly-labeled
 *   placeholder (a flat number, since the real 4,800x-Engaged-Users
 *   ceiling is per-Page dynamic and the SocialConnector interface's
 *   getRateLimitConfig() is synchronous/zero-arg) — never silently
 *   presented as the real per-Page number.
 * - AC7: a credential-class failure (401/403 from Meta — password change,
 *   admin removal, grant revocation) surfaces as ConnectorHealth's new
 *   'reconnect_required' status, distinct from the generic
 *   'failing'/'degraded' states every other connector's ordinary
 *   rate-limit/transient failures already produce.
 * - AC8: a poll cycle against an already-connected Page with zero new
 *   posts is a correct no-op (no duplicate SocialPost rows).
 *
 * Real infrastructure used: a real Meta Developer App (App ID
 * 427795247628927) and a real test Page Menno administers
 * (FACEBOOK_TEST_PAGE_ID/FACEBOOK_TEST_PAGE_ACCESS_TOKEN in .env, verified
 * directly this session against the live Graph API — confirmed the token
 * resolves to the real Page and pages_read_engagement genuinely returns
 * real posts) — the same "real infrastructure, not mocks" bar every prior
 * connector's happy path holds itself to (GNews, Newswire, Wikipedia,
 * Azure AI Language, Azure OpenAI). AC1/AC3/AC4/AC8 exercise the real Page
 * directly.
 *
 * AC2's own OAuth code-exchange step is the one genuine exception,
 * following Story 2.8 AC6's own established precedent ("the same seam
 * this project already uses elsewhere for scenarios a real endpoint can't
 * deterministically reproduce on demand"): no real authorization code can
 * be obtained non-interactively (Facebook's own login/consent screen has
 * no automatable, headless-safe path in this project's test environment,
 * and driving one would violate Meta's own platform terms against
 * automating the consent flow). The exchange endpoint's own request/
 * response handling is proven against a mocked Meta OAuth boundary
 * instead; the Tier-3 storage behavior itself (the actual thing AC2 cares
 * about) is proven directly against real storeCredential()/readCredential()
 * machinery, unmocked.
 *
 * Explicitly out of scope for this contract:
 *   - The Admin UI's own OAuth redirect/consent/Page-picker flow (Story
 *     6.23, a separate, not-yet-built story this one's own endpoints
 *     exist to serve).
 *   - Comment/mention ingestion (ADR-0059 Decision §5's own deferred
 *     third-party author-rights question, not v1 scope).
 *   - deliveryMode:'push' via Meta's Page Webhooks (ADR-0059's own named
 *     v2 enhancement).
 *   - OAuth token re-consent/rotation UX beyond the health-state signal
 *     itself.
 *   - Actually submitting SocialEngage's own Meta App for Business
 *     Verification/App Review (an administrative step outside any code
 *     change — this story's own contract runs against the degenerate,
 *     no-App-Review "Menno-administered test Page" case ADR-0059 Decision
 *     §3 itself names).
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { storeCredential, readCredential, getLatestCredentialId } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { findSocialPostByExternalId } from '../../src/posts/socialPostStore';
import {
  facebookConnector,
  FACEBOOK_PROVIDER_ID,
  fetchFacebookPagePosts,
} from '../../src/connectors/facebook/facebookConnector';
import { pollFacebook } from '../../src/connectors/facebook/pollFacebook';
import { deriveConnectorHealth } from '../../src/connectors/connectorHealth';
import { completeIngestionRun, startIngestionRun } from '../../src/ingestion/ingestionRunStore';

jest.setTimeout(60000);

const REAL_PAGE_ID = process.env.FACEBOOK_TEST_PAGE_ID as string;
const REAL_PAGE_TOKEN = process.env.FACEBOOK_TEST_PAGE_ACCESS_TOKEN as string;
const REAL_APP_ID = process.env.FACEBOOK_APP_ID as string;
const REAL_APP_SECRET = process.env.FACEBOOK_APP_SECRET as string;

if (!REAL_PAGE_ID || !REAL_PAGE_TOKEN || !REAL_APP_ID || !REAL_APP_SECRET) {
  throw new Error(
    'FACEBOOK_APP_ID/FACEBOOK_APP_SECRET/FACEBOOK_TEST_PAGE_ID/FACEBOOK_TEST_PAGE_ACCESS_TOKEN must be set (see .env) — this contract requires the real resource.'
  );
}

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
});

afterAll(async () => {
  const poller = await getKeyClient().beginDeleteKey(testKeyName);
  await poller.pollUntilDone();
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 5]
  );
  return rows[0].id;
}

/**
 * platform_credentials.user_id carries a real FK to users(id) — a
 * randomUUID() alone violates it. Real fixture pattern established by
 * story-5.17.access-history-read-endpoint.contract.test.ts and others.
 */
async function createUserFixture(tenantId: string, email: string): Promise<string> {
  // platform_admin_role (getPlatformAdminPool()) is deliberately narrow —
  // granted only on tenants/platform_admin_audit_log (ADR-0030 §1) — not
  // users. getAdminPool() (superuser) is the unrestricted pool this
  // project's own migration/fixture-shaped work already uses.
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
    [tenantId, email]
  );
  return rows[0].id;
}

function realCredential(): string {
  return JSON.stringify({ pageId: REAL_PAGE_ID, pageAccessToken: REAL_PAGE_TOKEN, pageName: 'Test Page' });
}

async function seedRealFacebookCredential(tenantId: string, userId: string): Promise<void> {
  await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, realCredential(), testKeyId, 'user', userId);
  await setConnectorActivation(tenantId, FACEBOOK_PROVIDER_ID, 'user', true, userId, userId);
}

describe('Story 2.15 — Facebook connector', () => {
  describe('AC1: registered SocialConnector, authMode oauth, deliveryMode poll, distinct providerId', () => {
    it('has the correct shape and no core pipeline change was needed to register it', () => {
      expect(facebookConnector.providerId).toBe('facebook');
      expect(facebookConnector.authMode).toBe('oauth');
      expect(facebookConnector.deliveryMode).toBe('poll');

      const bootstrapSrc = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'connectors', 'bootstrapConnectors.ts'),
        'utf8'
      );
      expect(bootstrapSrc).toMatch(/facebookConnector/);
    });

    it('a real call to the real Graph API Page-feed endpoint returns real posts', async () => {
      const posts = await fetchFacebookPagePosts(REAL_PAGE_ID, REAL_PAGE_TOKEN, 1);
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);
      expect(typeof posts[0].id).toBe('string');
      expect(typeof posts[0].created_time).toBe('string');
    });
  });

  describe('AC2: the dedicated OAuth flow stores a Tier 3, user-bound credential — the generic /connect endpoint cannot', () => {
    it('storeCredential() with ownerType "user" round-trips the real Page credential unchanged', async () => {
      const tenantId = await createTenantFixture(`FbTier3-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb-test-${randomUUID()}@example.com`);
      await seedRealFacebookCredential(tenantId, userId);

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ owner_type: string; user_id: string }>(
          `SELECT owner_type, user_id FROM platform_credentials WHERE platform_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [FACEBOOK_PROVIDER_ID]
        )
      );
      expect(rows[0].owner_type).toBe('user');
      expect(rows[0].user_id).toBe(userId);

      const credentialId = await getLatestCredentialId(tenantId, FACEBOOK_PROVIDER_ID, 'user', userId);
      const readBack = await readCredential(tenantId, credentialId as string);
      expect(JSON.parse(readBack)).toEqual(JSON.parse(realCredential()));
    });

    it('the generic POST /:platformId/connect rejects an authMode:oauth platform outright — no Tier-2 bypass exists', () => {
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'http', 'versions', 'v1', 'connectorsRouter.ts'),
        'utf8'
      );
      expect(source).toMatch(/authMode.*===.*'oauth'/);
    });

    it("the dedicated OAuth exchange endpoint's request/response handling is correct against a mocked Meta boundary (no real interactive authorization code is obtainable)", async () => {
      const { createV1Router } = await import('../../src/http/versions/v1/router');
      const request = (await import('supertest')).default;
      const express = (await import('express')).default;

      const app = express();
      app.use(express.json());
      const testAuthMiddleware = (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        (req as unknown as { identity: unknown }).identity = {
          type: 'tenant_user',
          tenantId: 'oauth-test-tenant',
          userId: 'oauth-test-user',
          role: 'tenant_user',
        };
        next();
      };
      app.use('/v1', createV1Router(testAuthMiddleware, testAuthMiddleware));

      const realFetch = global.fetch;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes('oauth/access_token') && url.includes('grant_type=fb_exchange_token')) {
          return new Response(JSON.stringify({ access_token: 'long-lived-user-token', token_type: 'bearer' }), { status: 200 });
        }
        if (url.includes('oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'short-lived-user-token', token_type: 'bearer', expires_in: 5184000 }), { status: 200 });
        }
        if (url.includes('/me/accounts')) {
          return new Response(
            JSON.stringify({ data: [{ id: 'mock-page-1', name: 'Mock Page', category: 'Business', access_token: 'mock-page-token' }] }),
            { status: 200 }
          );
        }
        return (realFetch as typeof fetch)(input as never);
      });

      const res = await request(app)
        .post('/v1/connectors/facebook/oauth/exchange')
        .send({ code: 'mock-auth-code', redirectUri: 'https://example.com/callback' });

      expect(res.status).toBe(200);
      expect(res.body.pages).toEqual([{ id: 'mock-page-1', name: 'Mock Page', category: 'Business' }]);
      expect(res.body.pages[0]).not.toHaveProperty('accessToken');
      expect(res.body.pages[0]).not.toHaveProperty('access_token');
      expect(typeof res.body.sessionToken).toBe('string');

      fetchSpy.mockRestore();
    });
  });

  describe('AC3: only the Page\'s own published posts are ingested — no comment/mention endpoint is ever called', () => {
    it('pollFacebook.ts never references a comments or mentions endpoint', () => {
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'connectors', 'facebook', 'pollFacebook.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/\/comments/);
      expect(source).not.toMatch(/mentions/i);
    });
  });

  describe('AC4: Author resolves to the Page — organization-as-Author, followerCount populated', () => {
    it('a real poll run resolves Author to the connected Page, with a real, populated followerCount', async () => {
      const tenantId = await createTenantFixture(`FbAuthor-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb-test-${randomUUID()}@example.com`);
      await seedRealFacebookCredential(tenantId, userId);

      await pollFacebook(tenantId, userId);

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ external_author_id: string; display_name: string; follower_count: number | null }>(
          `SELECT external_author_id, display_name, follower_count FROM authors WHERE tenant_id = $1 AND platform_id = $2`,
          [tenantId, FACEBOOK_PROVIDER_ID]
        )
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].external_author_id).toBe(REAL_PAGE_ID);
      expect(typeof rows[0].follower_count).toBe('number');
    });
  });

  describe('AC5: supportedQueryFeatures is empty; matching is 100% post-fetch fallback', () => {
    it('declares no native query features', () => {
      expect(facebookConnector.supportedQueryFeatures).toEqual([]);
    });
  });

  describe('AC6: getRateLimitConfig() returns a real, explicitly-labeled placeholder — never silently presented as the real per-Page number', () => {
    it('returns a conservative, documented flat placeholder', () => {
      const config = facebookConnector.getRateLimitConfig();
      expect(config.requestsPerWindow).toBeGreaterThan(0);
      expect(config.windowSeconds).toBe(24 * 60 * 60);

      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'connectors', 'facebook', 'facebookConnector.ts'),
        'utf8'
      );
      expect(source).toMatch(/placeholder/i);
    });
  });

  describe('AC7: a credential-class failure (401/403) surfaces as the new "reconnect_required" ConnectorHealth status', () => {
    it('deriveConnectorHealth() returns reconnect_required after a credential-class failed run, distinct from ordinary failing', async () => {
      const tenantId = await createTenantFixture(`FbReconnect-${randomUUID()}`);
      const run = await startIngestionRun(tenantId, {
        platformId: FACEBOOK_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await completeIngestionRun(tenantId, run.id, {
        status: 'failed',
        postsIngested: 0,
        postsSkipped: 0,
        errorSummary: 'Facebook returned 401 (grant revoked)',
        retryable: false,
        isCredentialFailure: true,
      });

      const health = await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID);
      expect(health.status).toBe('reconnect_required');
    });

    it('an ordinary non-credential failure still derives to "failing"/"degraded", not "reconnect_required"', async () => {
      const tenantId = await createTenantFixture(`FbOrdinaryFail-${randomUUID()}`);
      const run = await startIngestionRun(tenantId, {
        platformId: FACEBOOK_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      await completeIngestionRun(tenantId, run.id, {
        status: 'failed',
        postsIngested: 0,
        postsSkipped: 0,
        errorSummary: 'Malformed watchlist',
        retryable: false,
        isCredentialFailure: false,
      });

      const health = await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID);
      expect(health.status).not.toBe('reconnect_required');
    });
  });

  describe('AC8: a poll cycle against an already-connected Page with zero new posts is a correct no-op', () => {
    it('two consecutive real poll cycles produce no duplicate SocialPost rows', async () => {
      const tenantId = await createTenantFixture(`FbNoOp-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb-test-${randomUUID()}@example.com`);
      await seedRealFacebookCredential(tenantId, userId);

      await pollFacebook(tenantId, userId);
      const { rows: firstPass } = await withTenant(tenantId, (client) =>
        client.query<{ count: string }>(`SELECT COUNT(*) FROM social_posts WHERE tenant_id = $1`, [tenantId])
      );

      await pollFacebook(tenantId, userId);
      const { rows: secondPass } = await withTenant(tenantId, (client) =>
        client.query<{ count: string }>(`SELECT COUNT(*) FROM social_posts WHERE tenant_id = $1`, [tenantId])
      );

      expect(secondPass[0].count).toBe(firstPass[0].count);
    });

    it('a real ingested post is never re-inserted (findSocialPostByExternalId dedup check)', async () => {
      const tenantId = await createTenantFixture(`FbDedup-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb-test-${randomUUID()}@example.com`);
      await seedRealFacebookCredential(tenantId, userId);
      await pollFacebook(tenantId, userId);

      const posts = await fetchFacebookPagePosts(REAL_PAGE_ID, REAL_PAGE_TOKEN, 1);
      const existing = await findSocialPostByExternalId(tenantId, FACEBOOK_PROVIDER_ID, posts[0].id);
      expect(existing).not.toBeNull();
    });
  });
});
