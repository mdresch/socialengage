/**
 * Contract: Story 6.27 (ADR-0060) — Facebook: support connecting more than
 * one Page per user (backend half — storage, credential, poll fan-out,
 * per-Page health, REST endpoints). See
 * docs/user-stories/epic-6-tenant-admin-ui.md#story-627 and
 * docs/adr/0060-facebook-connector-multiple-pages-per-user.md
 *
 * Intent: one Facebook OAuth grant (one user's own long-lived User token)
 * already returns every Page that person administers in a single
 * /me/accounts call, but Story 6.23's own Page picker was single-select and
 * pollFacebook() polled exactly one credential. This story lets one grant
 * result in more than one stored, independently-polled, independently-
 * monitored connected Page — see ADR-0060's own Context for the real
 * business need (Menno's own ~15 real Pages vs. a 5-seat license ceiling).
 *
 * Scope: migrations/0034_create_facebook_connected_pages.sql (new),
 * migrations/0035_add_ingestion_runs_page_id.sql (new),
 * src/connectors/facebook/facebookConnectedPagesStore.ts (new),
 * src/connectors/facebook/pollFacebook.ts (rewritten — per-Page sequential
 * fan-out, one runIngestionAttempt() per connected Page), src/credentials/
 * credentialStore.ts (deleteCredentialById, new, additive),
 * src/connectors/connectorHealth.ts (deriveConnectorHealth()'s reserved
 * pageId param now actually filters), src/ingestion/ingestionRunStore.ts
 * (StartIngestionRunInput.pageId?), src/ingestion/runIngestionAttempt.ts
 * (threads connectorInfo.pageId into both health-snapshot calls),
 * src/http/versions/v1/facebookOAuthRouter.ts (/exchange gains orphan
 * detection, /select-page becomes plural pageIds with partial-failure
 * response), src/http/versions/v1/facebookPagesRouter.ts (new — GET/DELETE
 * .../facebook/pages), src/http/versions/v1/router.ts (mounts it).
 *
 * Contract to encode: table/RLS/UNIQUE-collision (schema); deleteCredentialById
 * deletes exactly one row by id; upsert-on-reselect refreshes credential_id/
 * page_name without duplicating a row; orphan auto-transition on a
 * re-consent /exchange whose Page list no longer includes a previously-
 * connected page_id; orphaned rows excluded from the per-Page poll fan-out
 * (listConnectedPages only returns status='connected'); sequential per-Page
 * polling — one IngestionRun per connected Page, one Page's real (Graph-
 * API-classified) failure never blocks the next; ingestion_runs.page_id is
 * nullable/populated only by Facebook's own per-Page path;
 * deriveConnectorHealth(tenantId, 'facebook', pageId) returns independently
 * correct per-Page results; GET .../pages is scoped to the caller's own
 * userId (never cross-user) and returns a real parentConnectionActive;
 * DELETE .../pages/:id soft-removes, destroys the credential, and treats
 * another user's row as 404 never 403.
 *
 * Real infrastructure used: the same real Meta test Page/App this project's
 * other Facebook contracts already use (FACEBOOK_TEST_PAGE_ID/
 * FACEBOOK_TEST_PAGE_ACCESS_TOKEN) for the sequential-fan-out/isolation
 * test's one real, succeeding Page — its two sibling "failing" Pages use a
 * deliberately invalid pageId/token, so their own real (not mocked) Graph
 * API rejection is what proves per-Page isolation, the same "real
 * infrastructure over mocks wherever the real thing is reachable" bar
 * Story 2.15's own contract already set. The GET/DELETE endpoint tests and
 * the plural /select-page endpoint test use a real Express app + supertest,
 * with Meta's own OAuth boundary mocked only where Story 2.15's own AC2
 * already established that exception (no real interactive authorization
 * code is obtainable non-interactively).
 *
 * Explicitly out of scope, per ADR-0060's own named Open Questions/per this
 * story's own scope boundary (not tested): RequestGate re-keying beyond
 * (tenantId, providerId); the real per-Page Engaged-Users rate ceiling; the
 * two-different-users-connecting-the-same-underlying-Page health-blending
 * edge case; pagination on GET .../pages; comment/mention ingestion;
 * proactive orphaned notification; the Admin UI (a separate contract file,
 * social-listening-admin/contracts/epic-6/story-6.27...).
 */

import { randomUUID } from 'crypto';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { storeCredential, readCredential } from '../../src/credentials/credentialStore';
import { deleteCredentialById } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { FACEBOOK_PROVIDER_ID } from '../../src/connectors/facebook/facebookConnector';
import { pollFacebook } from '../../src/connectors/facebook/pollFacebook';
import { deriveConnectorHealth } from '../../src/connectors/connectorHealth';
import { completeIngestionRun, startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import {
  listConnectedPages,
  listPagesForUser,
  upsertConnectedPage,
  markMissingPagesOrphaned,
  removeConnectedPage,
} from '../../src/connectors/facebook/facebookConnectedPagesStore';

jest.setTimeout(60000);

const REAL_PAGE_ID = process.env.FACEBOOK_TEST_PAGE_ID as string;
const REAL_PAGE_TOKEN = process.env.FACEBOOK_TEST_PAGE_ACCESS_TOKEN as string;

if (!REAL_PAGE_ID || !REAL_PAGE_TOKEN) {
  throw new Error('FACEBOOK_TEST_PAGE_ID/FACEBOOK_TEST_PAGE_ACCESS_TOKEN must be set (see .env) — this contract requires the real resource.');
}

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
  process.env.KEY_VAULT_KEY_ID = testKeyId;
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

async function createUserFixture(tenantId: string, email: string): Promise<string> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
    [tenantId, email]
  );
  return rows[0].id;
}

async function seedConnectedPage(
  tenantId: string,
  userId: string,
  input: { pageId: string; pageAccessToken: string; pageName: string }
): Promise<string> {
  const credential = await storeCredential(
    tenantId,
    FACEBOOK_PROVIDER_ID,
    JSON.stringify({ pageId: input.pageId, pageAccessToken: input.pageAccessToken, pageName: input.pageName }),
    testKeyId,
    'user',
    userId
  );
  const row = await upsertConnectedPage(tenantId, userId, { pageId: input.pageId, pageName: input.pageName, credentialId: credential.id });
  await setConnectorActivation(tenantId, FACEBOOK_PROVIDER_ID, 'user', true, userId, userId);
  return row.id;
}

describe('Story 6.27 — Facebook: multiple Pages per user (backend)', () => {
  describe('Schema (ADR-0060 Decision §1): facebook_connected_pages table shape and constraint', () => {
    it('a second row for the same user with a different page_id succeeds; a colliding (tenant, user, page_id) INSERT is rejected at the constraint level', async () => {
      const tenantId = await createTenantFixture(`Fb627Schema-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const cred = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'x', testKeyId, 'user', userId);

      await withTenant(tenantId, (client) =>
        client.query(
          `INSERT INTO facebook_connected_pages (tenant_id, user_id, page_id, page_name, credential_id) VALUES ($1, $2, $3, $4, $5)`,
          [tenantId, userId, 'page-a', 'Page A', cred.id]
        )
      );
      // A second, distinct page_id for the same user — succeeds.
      await expect(
        withTenant(tenantId, (client) =>
          client.query(
            `INSERT INTO facebook_connected_pages (tenant_id, user_id, page_id, page_name, credential_id) VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, userId, 'page-b', 'Page B', cred.id]
          )
        )
      ).resolves.toBeDefined();

      // The same (tenant, user, page_id) again — rejected by the UNIQUE constraint.
      await expect(
        withTenant(tenantId, (client) =>
          client.query(
            `INSERT INTO facebook_connected_pages (tenant_id, user_id, page_id, page_name, credential_id) VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, userId, 'page-a', 'Page A Again', cred.id]
          )
        )
      ).rejects.toThrow();
    });
  });

  describe('credentialStore.ts (ADR-0060 Decision §2): deleteCredentialById deletes exactly one row by its own id', () => {
    it('leaves every sibling platform_credentials row (same tenant/platform/owner) untouched', async () => {
      const tenantId = await createTenantFixture(`Fb627DelCred-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const credA = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'plaintext-a', testKeyId, 'user', userId);
      const credB = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'plaintext-b', testKeyId, 'user', userId);

      await deleteCredentialById(tenantId, credA.id);

      await expect(readCredential(tenantId, credA.id)).rejects.toThrow();
      await expect(readCredential(tenantId, credB.id)).resolves.toBe('plaintext-b');
    });
  });

  describe('facebookConnectedPagesStore.ts (ADR-0060 Decision §1): upsert-on-reselect', () => {
    it('re-selecting an already-connected page_id refreshes credential_id/page_name, leaves status connected, never duplicates the row', async () => {
      const tenantId = await createTenantFixture(`Fb627Upsert-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const credA = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'first-token', testKeyId, 'user', userId);
      const credB = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'refreshed-token', testKeyId, 'user', userId);

      await upsertConnectedPage(tenantId, userId, { pageId: 'page-reselect', pageName: 'Original Name', credentialId: credA.id });
      const refreshed = await upsertConnectedPage(tenantId, userId, { pageId: 'page-reselect', pageName: 'Renamed', credentialId: credB.id });

      expect(refreshed.status).toBe('connected');
      expect(refreshed.credentialId).toBe(credB.id);
      expect(refreshed.pageName).toBe('Renamed');

      const all = await listPagesForUser(tenantId, userId);
      expect(all.filter((p) => p.pageId === 'page-reselect')).toHaveLength(1);
    });
  });

  describe('facebookConnectedPagesStore.ts (ADR-0060 Decision §1, added at review): orphaned-Page detection', () => {
    it('a re-consent whose returned Page list no longer includes a previously-connected page_id auto-transitions that row to orphaned; every other connected row is unchanged', async () => {
      const tenantId = await createTenantFixture(`Fb627Orphan-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const cred = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'x', testKeyId, 'user', userId);
      await upsertConnectedPage(tenantId, userId, { pageId: 'page-still-there', pageName: 'Still There', credentialId: cred.id });
      await upsertConnectedPage(tenantId, userId, { pageId: 'page-lost-access', pageName: 'Lost Access', credentialId: cred.id });

      await markMissingPagesOrphaned(tenantId, userId, ['page-still-there']);

      const all = await listPagesForUser(tenantId, userId);
      const stillThere = all.find((p) => p.pageId === 'page-still-there');
      const lostAccess = all.find((p) => p.pageId === 'page-lost-access');
      expect(stillThere?.status).toBe('connected');
      expect(lostAccess?.status).toBe('orphaned');
    });

    it('an orphaned row is never returned by listConnectedPages() — excluded from polling identically to a removed row', async () => {
      const tenantId = await createTenantFixture(`Fb627OrphanPoll-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const cred = await storeCredential(tenantId, FACEBOOK_PROVIDER_ID, 'x', testKeyId, 'user', userId);
      await upsertConnectedPage(tenantId, userId, { pageId: 'page-connected', pageName: 'Connected', credentialId: cred.id });
      await upsertConnectedPage(tenantId, userId, { pageId: 'page-to-orphan', pageName: 'Orphaned', credentialId: cred.id });
      await markMissingPagesOrphaned(tenantId, userId, ['page-connected']);

      const connected = await listConnectedPages(tenantId, userId);
      expect(connected.map((p) => p.pageId)).toEqual(['page-connected']);
    });
  });

  describe('pollFacebook.ts (ADR-0060 Decision §3): sequential per-Page fan-out, one IngestionRun per Page, isolated', () => {
    // Healed 2026-08-19: the file-level jest.setTimeout(60000) above was too
    // tight for this specific test alone (every other test in this file
    // stays well under it). Root-caused via instrumented timing, not assumed:
    // the real Graph API consistently takes ~18s to reject each deliberately
    // invalid Page/token — confirmed twice, 18276ms and 17842ms, close enough
    // to read as Meta's own anti-abuse throttling for invalid credentials,
    // not a client-side hang (graphApiFetch has no retry/backoff logic to
    // hang in). Two invalid Pages + one real Page's own real fetch, run
    // strictly sequentially per ADR-0060 Decision §3, land pollFacebook()
    // itself around ~44s before this test's own fixture setup and DB
    // assertions are even counted — leaving 60s essentially no margin. An
    // explicit, more generous per-test override (the same "explicit
    // jest.setTimeout(), not reliance on a default" fix docs/environment-
    // gotchas.md already establishes for slow real infrastructure) rather
    // than a code change — there is no bug in the fan-out logic itself.
    it('three connected Pages (one real, two deliberately invalid) produce three separate IngestionRun rows, one per Page, and one real classified failure never blocks the others', async () => {
      const tenantId = await createTenantFixture(`Fb627FanOut-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      await seedConnectedPage(tenantId, userId, { pageId: 'invalid-page-a', pageAccessToken: 'invalid-token-a', pageName: 'Invalid A' });
      await seedConnectedPage(tenantId, userId, { pageId: REAL_PAGE_ID, pageAccessToken: REAL_PAGE_TOKEN, pageName: 'Real Page' });
      await seedConnectedPage(tenantId, userId, { pageId: 'invalid-page-c', pageAccessToken: 'invalid-token-c', pageName: 'Invalid C' });

      await pollFacebook(tenantId, userId);

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ page_id: string | null; status: string }>(
          `SELECT page_id, status FROM ingestion_runs WHERE tenant_id = $1 AND platform_id = $2 AND user_id = $3 ORDER BY started_at ASC`,
          [tenantId, FACEBOOK_PROVIDER_ID, userId]
        )
      );

      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.page_id).sort()).toEqual(['invalid-page-a', 'invalid-page-c', REAL_PAGE_ID].sort());
      const realRow = rows.find((r) => r.page_id === REAL_PAGE_ID);
      const invalidA = rows.find((r) => r.page_id === 'invalid-page-a');
      const invalidC = rows.find((r) => r.page_id === 'invalid-page-c');
      expect(realRow?.status).toBe('succeeded');
      expect(invalidA?.status).toBe('failed');
      expect(invalidC?.status).toBe('failed');
    }, 180000);
  });

  describe('ingestion_runs.page_id (ADR-0060 Decision §3): nullable, populated only by Facebook\'s own per-Page path', () => {
    it('a non-Facebook tenant-wide run still writes page_id = NULL — no behavior change to any existing query or contract', async () => {
      const tenantId = await createTenantFixture(`Fb627PageIdNull-${randomUUID()}`);
      const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });
      const row = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ page_id: string | null }>(`SELECT page_id FROM ingestion_runs WHERE id = $1`, [run.id]);
        return rows[0];
      });
      expect(row.page_id).toBeNull();
    });
  });

  describe('deriveConnectorHealth() (ADR-0060 Decision §4): pageId now actually filters, independently correct per Page', () => {
    it('two connected Pages under one user — one healthy, one disabled — return different, independently correct statuses via deriveConnectorHealth(tenantId, "facebook", pageId)', async () => {
      const tenantId = await createTenantFixture(`Fb627Health-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);
      const pageA = 'page-healthy';
      const pageB = 'page-disabled';

      const runA = await startIngestionRun(tenantId, { platformId: FACEBOOK_PROVIDER_ID, triggerType: 'poll', connectorVersion: '1.0.0', userId, pageId: pageA });
      await completeIngestionRun(tenantId, runA.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

      // 2026-09-01: ADR-0109 supersedes ADR-0060's pre-0109 threshold-based
      // `failing` expectation for a Page whose latest run is a non-retryable,
      // non-credential failure. Such a Page now returns `disabled`.
      for (let i = 0; i < 20; i++) {
        const runB = await startIngestionRun(tenantId, { platformId: FACEBOOK_PROVIDER_ID, triggerType: 'poll', connectorVersion: '1.0.0', userId, pageId: pageB });
        await completeIngestionRun(tenantId, runB.id, { status: 'failed', postsIngested: 0, postsSkipped: 0, retryable: false });
      }

      const healthA = await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID, pageA);
      const healthB = await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID, pageB);
      expect(healthA.status).toBe('healthy');
      expect(healthB.status).toBe('disabled');
    });

    it('omitted pageId: behavior is byte-for-byte unchanged (existing 2-arg call still reads the platform-level rollup)', async () => {
      const tenantId = await createTenantFixture(`Fb627HealthDefault-${randomUUID()}`);
      const health = await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID);
      expect(health.status).toBe('disconnected');
    });
  });

  describe('REST endpoints (ADR-0060 Decision §5): GET/DELETE .../facebook/pages, scoped to the caller\'s own userId', () => {
    function authAs(tenantId: string, userId: string) {
      return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        (req as unknown as { identity: unknown }).identity = { type: 'tenant_user', tenantId, userId, role: 'tenant_user' };
        next();
      };
    }

    it('GET returns only the calling user\'s own rows, never another user\'s, and a real parentConnectionActive', async () => {
      const tenantId = await createTenantFixture(`Fb627GetPages-${randomUUID()}`);
      const userA = await createUserFixture(tenantId, `fb627-a-${randomUUID()}@example.com`);
      const userB = await createUserFixture(tenantId, `fb627-b-${randomUUID()}@example.com`);
      await seedConnectedPage(tenantId, userA, { pageId: 'page-a-owned', pageAccessToken: 'tok', pageName: 'A Owned' });
      await seedConnectedPage(tenantId, userB, { pageId: 'page-b-owned', pageAccessToken: 'tok', pageName: 'B Owned' });

      const express = (await import('express')).default;
      const request = (await import('supertest')).default;
      const { createV1Router } = await import('../../src/http/versions/v1/router');
      const app = express();
      app.use(express.json());
      app.use('/v1', createV1Router(authAs(tenantId, userA), authAs(tenantId, userA)));

      const res = await request(app).get('/v1/connectors/facebook/pages');
      expect(res.status).toBe(200);
      expect(res.body.pages).toHaveLength(1);
      expect(res.body.pages[0].pageId).toBe('page-a-owned');
      expect(res.body.parentConnectionActive).toBe(true);
    });

    it('DELETE soft-removes the caller\'s own Page and destroys its credential; another user\'s row is 404, never 403', async () => {
      const tenantId = await createTenantFixture(`Fb627DeletePage-${randomUUID()}`);
      const userA = await createUserFixture(tenantId, `fb627-a-${randomUUID()}@example.com`);
      const userB = await createUserFixture(tenantId, `fb627-b-${randomUUID()}@example.com`);
      const rowId = await seedConnectedPage(tenantId, userA, { pageId: 'page-to-delete', pageAccessToken: 'tok', pageName: 'To Delete' });
      const pages = await listPagesForUser(tenantId, userA);
      const credentialId = pages.find((p) => p.id === rowId)!.credentialId as string;

      const express = (await import('express')).default;
      const request = (await import('supertest')).default;
      const { createV1Router } = await import('../../src/http/versions/v1/router');

      const appAsB = express();
      appAsB.use(express.json());
      appAsB.use('/v1', createV1Router(authAs(tenantId, userB), authAs(tenantId, userB)));
      const crossUserRes = await request(appAsB).delete(`/v1/connectors/facebook/pages/${rowId}`);
      expect(crossUserRes.status).toBe(404);

      const appAsA = express();
      appAsA.use(express.json());
      appAsA.use('/v1', createV1Router(authAs(tenantId, userA), authAs(tenantId, userA)));
      const ownRes = await request(appAsA).delete(`/v1/connectors/facebook/pages/${rowId}`);
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.status).toBe('removed');
      await expect(readCredential(tenantId, credentialId)).rejects.toThrow();
    });
  });

  describe('facebookOAuthRouter.ts /select-page (ADR-0060 Decision §5): plural pageIds, independent per-Page processing, structured partial-failure response', () => {
    it('one nonexistent pageId among several never aborts the others — connected and errors both populated', async () => {
      const { createV1Router } = await import('../../src/http/versions/v1/router');
      const request = (await import('supertest')).default;
      const express = (await import('express')).default;

      const tenantId = await createTenantFixture(`Fb627SelectPage-${randomUUID()}`);
      const userId = await createUserFixture(tenantId, `fb627-${randomUUID()}@example.com`);

      const app = express();
      app.use(express.json());
      const testAuthMiddleware = (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        (req as unknown as { identity: unknown }).identity = { type: 'tenant_user', tenantId, userId, role: 'tenant_user' };
        next();
      };
      app.use('/v1', createV1Router(testAuthMiddleware, testAuthMiddleware));

      const realFetch = global.fetch;
      const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes('oauth/access_token') && url.includes('grant_type=fb_exchange_token')) {
          return new Response(JSON.stringify({ access_token: 'long-lived-user-token' }), { status: 200 });
        }
        if (url.includes('oauth/access_token')) {
          return new Response(JSON.stringify({ access_token: 'short-lived-user-token' }), { status: 200 });
        }
        if (url.includes('/me/accounts')) {
          return new Response(
            JSON.stringify({
              data: [
                { id: 'select-page-1', name: 'Selectable One', category: 'Business', access_token: 'tok-1' },
                { id: 'select-page-2', name: 'Selectable Two', category: 'Business', access_token: 'tok-2' },
              ],
            }),
            { status: 200 }
          );
        }
        return (realFetch as typeof fetch)(input as never);
      });

      const exchangeRes = await request(app)
        .post('/v1/connectors/facebook/oauth/exchange')
        .send({ code: 'mock-auth-code', redirectUri: 'https://example.com/callback' });
      const sessionToken = exchangeRes.body.sessionToken;

      const selectRes = await request(app)
        .post('/v1/connectors/facebook/oauth/select-page')
        .send({ sessionToken, pageIds: ['select-page-1', 'select-page-2', 'nonexistent-page'] });

      expect(selectRes.status).toBe(201);
      expect(selectRes.body.connected).toHaveLength(2);
      expect(selectRes.body.connected.map((c: { pageId: string }) => c.pageId).sort()).toEqual(['select-page-1', 'select-page-2']);
      expect(selectRes.body.errors).toHaveLength(1);
      expect(selectRes.body.errors[0].pageId).toBe('nonexistent-page');
      expect(typeof selectRes.body.errors[0].reason).toBe('string');
      expect(selectRes.body.errors[0].reason).not.toMatch(/Error:|stack|at Object/);

      fetchSpy.mockRestore();
    });
  });
});
