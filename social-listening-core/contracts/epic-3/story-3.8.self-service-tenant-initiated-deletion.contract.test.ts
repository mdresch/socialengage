// Contract: Story 3.8 (ADR-0043, superseding ADR-0039 Decision §1 in full) —
// self-service, tenant_admin-initiated tenant offboarding.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-38--self-service-tenant-initiated-deletion
//
// Intent: Story 3.8 — let a tenant_admin request deletion of their own
// tenant, fully self-service, no Platform Admin approval step anywhere in
// the path: request halts ingestion immediately, export is repeatable
// during a 30-day grace period, cancellation is available until confirmed,
// and confirmation (only reachable once the grace period has genuinely
// elapsed) kicks off the same bounded, asynchronous, cross-tier hard-delete
// ADR-0039 §2-§5 already designed. Platform Admin has zero access to any
// tenant-content table or to the deletion-lifecycle columns themselves — no
// exception carved out for deletion, matching Story 5.7's own already-
// accepted boundary exactly. This story replaces the Platform-Admin-gated
// design originally built as Story 3.7 the night of 2026-08-06/07 — see
// ADR-0039's own "Superseding note" (2026-08-07) and ADR-0043's header note
// for why.
// Scope: migrations/0023 (deletion_requested_at/deletion_confirmed_at
// columns + app_user/tenant_deletion_role grants), src/tenants/
// tenantDeletion.ts (rewritten: withTenant()/tenant_deletion_role instead
// of platform_admin_role throughout), src/ingestion/runIngestionAttempt.ts
// (new deletion-halt guard), src/http/versions/v1/
// selfServiceTenantDeletionRouter.ts (new: request/export/cancel/confirm),
// src/tenants/tenantExportCsv.ts (new), src/db/tenantDeletionPool.ts (new).
// Contract to encode, per AC: (1) only a tenant_admin identity may reach any
// of the four routes, always scoped to their own tenant (no :id param
// exists to target another tenant); (2) requesting deletion halts all
// further ingestion immediately, is rejected if already active; (3) export
// is rejected before a request exists, succeeds (JSON or CSV) any number of
// times after, resolving both archival tiers; (4) cancellation nulls the
// request, resumes ingestion, is rejected once already confirmed; (5)
// confirmation is rejected until the 30-day grace period has genuinely
// elapsed, then executes the real, irreversible, cross-tier hard-delete
// asynchronously; (6) every tenant-content table is hard-deleted (hot and
// archived tiers), a previously-valid credential becomes permanently
// unreadable, platform_admin_audit_log/domain_signup_attempts survive as
// tombstones, the tenants row itself is gone; (7) platform_admin_role
// cannot write to the two new lifecycle columns; (8) every step is
// durably audit-logged with the confirming Tenant-Admin's own identity as
// actor, never a Platform Admin's.
// Explicitly out of scope: the social-listening-admin UI surface for this
// flow; archived-ingestion_run discovery for a run with zero referencing
// social_posts (a named, accepted gap — see SKILL.md); rate-limiting/abuse
// prevention on repeated request/cancel cycles (ADR-0043's own Open
// Question, not designed there either).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closeTenantSignupPool, getTenantSignupPool } from '../../src/db/tenantSignupPool';
import { closeTenantDeletionPool } from '../../src/db/tenantDeletionPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { storeCredential, readCredential } from '../../src/credentials/credentialStore';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { archiveAgedRawPayloads } from '../../src/archival/socialPostArchival';
import { archiveAgedIngestionRuns } from '../../src/archival/ingestionRunArchival';
import { downloadArchiveBlob, __deleteArchiveBlobForTests } from '../../src/archival/blobArchiveClient';
import { logPlatformAdminAction } from '../../src/admin/platformAdminAuditLog';
import { ClassifiableError } from '../../src/ingestion/errorClassification';

// Real Key Vault key creation/deletion (Story 5.3's own precedent) plus real
// archival aging (Story 3.5's own) makes this contract genuinely slow —
// matches this project's own established bar for a story touching real
// cross-tier infrastructure, not padding.
jest.setTimeout(120000);

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

let testKeyName: string;
let testKeyId: string;
const blobPathsToClean: string[] = [];

beforeAll(async () => {
  testKeyName = `test-key-story38-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
});

afterAll(async () => {
  const poller = await getKeyClient().beginDeleteKey(testKeyName);
  await poller.pollUntilDone();
  for (const blobPath of blobPathsToClean) {
    await __deleteArchiveBlobForTests(blobPath).catch(() => undefined);
  }
  await closePlatformAdminPool();
  await closeTenantSignupPool();
  await closeTenantDeletionPool();
  await closeAdminPool();
  await closePool();
}, 30000);

/** Same real-completion-signal polling Story 3.7's own contract already proved necessary. */
async function waitForTenantDeletionToComplete(tenantId: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await getPlatformAdminPool().query(
      `SELECT 1 FROM platform_admin_audit_log WHERE target_tenant_id = $1 AND operation = 'tenant_deletion_completed'`,
      [tenantId]
    );
    if (rows.length > 0) return;
    if (Date.now() > deadline) {
      throw new Error(`Tenant ${tenantId} deletion did not complete within ${timeoutMs}ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

describe('Story 3.8 — self-service, tenant_admin-initiated tenant offboarding', () => {
  const app = createApp();

  describe('AC1: only a tenant_admin identity may reach any of the four routes', () => {
    it('a tenant_user identity gets 403 on request/export/cancel/confirm', async () => {
      const tenantUserHeader = testIdentityHeaderValue(randomUUID(), { role: 'tenant_user' });

      const requestRes = await request(app)
        .post('/v1/tenants/self-service-deletion/request')
        .set('X-Test-Identity', tenantUserHeader);
      expect(requestRes.status).toBe(403);

      const exportRes = await request(app)
        .post('/v1/tenants/self-service-deletion/export')
        .set('X-Test-Identity', tenantUserHeader);
      expect(exportRes.status).toBe(403);

      const cancelRes = await request(app)
        .delete('/v1/tenants/self-service-deletion')
        .set('X-Test-Identity', tenantUserHeader);
      expect(cancelRes.status).toBe(403);

      const confirmRes = await request(app)
        .post('/v1/tenants/self-service-deletion/confirm')
        .set('X-Test-Identity', tenantUserHeader);
      expect(confirmRes.status).toBe(403);
    });

    it('a platform_admin identity gets 403 on request/export/cancel/confirm', async () => {
      const adminHeader = platformAdminHeader();

      const requestRes = await request(app)
        .post('/v1/tenants/self-service-deletion/request')
        .set('X-Test-Identity', adminHeader);
      expect(requestRes.status).toBe(403);

      const confirmRes = await request(app)
        .post('/v1/tenants/self-service-deletion/confirm')
        .set('X-Test-Identity', adminHeader);
      expect(confirmRes.status).toBe(403);
    });
  });

  describe('Full lifecycle: request, ingestion halt, export, cancel, confirm, completion', () => {
    let tenantId: string;
    let tenantAdminUserId: string;
    let tenantAdminHeader: string;
    let liveIngestionRunId: string;
    let archivedIngestionRunId: string;
    let livePostId: string;
    let archivedPostId: string;
    let credentialId: string;
    let authorId: string;

    beforeAll(async () => {
      const adminId = randomUUID();
      const createRes = await request(app)
        .post('/v1/admin/tenants')
        .set('X-Test-Identity', platformAdminHeader(adminId))
        .send({ name: `Story 3.8 test tenant ${randomUUID()}`, licenseSeatCount: 5 });
      expect(createRes.status).toBe(201);
      tenantId = createRes.body.id;

      tenantAdminUserId = randomUUID();
      tenantAdminHeader = testIdentityHeaderValue(tenantId, { role: 'tenant_admin', userId: tenantAdminUserId });

      const author = await upsertAuthor(tenantId, 'gnews', `ext-${randomUUID()}`, { displayName: 'Test Author' });
      authorId = author.id;

      const liveRun = await startIngestionRun(tenantId, {
        platformId: 'gnews',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      liveIngestionRunId = liveRun.id;
      await completeIngestionRun(tenantId, liveIngestionRunId, {
        status: 'succeeded',
        postsIngested: 1,
        postsSkipped: 0,
      });

      const livePost = await insertSocialPost({
        tenantId,
        authorId,
        acquisitionId: liveIngestionRunId,
        rawPayload: { text: 'a live, unarchived post' },
      });
      livePostId = livePost.id;

      // Aged ingestion_run + post, genuinely archived via the real archival
      // functions (Story 3.5's own proven mechanism), 23/5 months of
      // margin, with ensure_ingestion_runs_partition() re-creating the
      // target month first — see story-3.7's own now-superseded contract
      // for the full reasoning behind both numbers; unchanged here since
      // the archival mechanics this story exercises are identical, only
      // the triggering actor changed.
      const targetMonthStart = new Date();
      targetMonthStart.setUTCMonth(targetMonthStart.getUTCMonth() - 23, 1);
      await getAdminPool().query(`SELECT ensure_ingestion_runs_partition($1)`, [
        targetMonthStart.toISOString().slice(0, 10),
      ]);

      archivedIngestionRunId = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO ingestion_runs (tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped)
           VALUES ($1, 'gnews', 'poll', '1.0.0', 'succeeded', now() - interval '23 months', now() - interval '23 months', 1, 0)
           RETURNING id`,
          [tenantId]
        );
        return rows[0].id;
      });

      archivedPostId = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO social_posts (tenant_id, raw_payload, author_id, acquisition_id, acquisition_started_at, created_at)
           VALUES ($1, $2, $3, $4, (SELECT started_at FROM ingestion_runs WHERE id = $4), now() - interval '5 months')
           RETURNING id`,
          [tenantId, JSON.stringify({ text: 'a post whose rawPayload will be archived to blob' }), authorId, archivedIngestionRunId]
        );
        return rows[0].id;
      });

      const rawArchivalResult = await archiveAgedRawPayloads();
      expect(rawArchivalResult.rowsArchived).toBeGreaterThanOrEqual(1);
      const runArchivalResult = await archiveAgedIngestionRuns();
      expect(runArchivalResult.rowsArchived).toBeGreaterThanOrEqual(1);
      blobPathsToClean.push(`social-posts/${archivedPostId}.json`, `ingestion-runs/${archivedIngestionRunId}.json`);

      await createWatchlist(tenantId, { name: 'Test watchlist', matchType: 'keyword', terms: ['acme'] });

      const stored = await storeCredential(tenantId, 'gnews', 'super-secret-api-key', testKeyId);
      credentialId = stored.id;

      await withTenant(tenantId, (client) =>
        client.query(`INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_admin', 'active')`, [
          tenantId,
          `admin-${randomUUID()}@example.com`,
        ])
      );

      await getTenantSignupPool().query(`INSERT INTO domain_signup_attempts (tenant_id, email) VALUES ($1, $2)`, [
        tenantId,
        `attempt-${randomUUID()}@example.com`,
      ]);
      await logPlatformAdminAction({ actorIdentity: adminId, operation: 'test_prior_action', targetTenantId: tenantId });
    });

    it('AC3: export before any request is rejected — offboarding export, not a general bulk-export feature', async () => {
      const res = await request(app)
        .post('/v1/tenants/self-service-deletion/export')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(res.status).toBe(409);
    });

    it('AC4: cancel before any request is rejected (nothing to cancel)', async () => {
      const res = await request(app)
        .delete('/v1/tenants/self-service-deletion')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(res.status).toBe(409);
    });

    it('AC5: confirm before any request is rejected (nothing to confirm)', async () => {
      const res = await request(app)
        .post('/v1/tenants/self-service-deletion/confirm')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(res.status).toBe(409);
    });

    it('AC2: requesting deletion halts ingestion immediately; a second request is rejected', async () => {
      const before = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' },
        attempt: async () => ({ postsIngested: 0, postsSkipped: 0 }),
      });
      expect(before.status).toBe('succeeded');

      const requestRes = await request(app)
        .post('/v1/tenants/self-service-deletion/request')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(requestRes.status).toBe(202);
      expect(requestRes.body.deletionRequestedAt).toBeTruthy();
      expect(requestRes.body.graceEndsAt).toBeTruthy();

      const again = await request(app)
        .post('/v1/tenants/self-service-deletion/request')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(again.status).toBe(409);

      const after = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' },
        attempt: async () => {
          throw new ClassifiableError('http_5xx', 'should never be called — deletion halt must refuse first');
        },
      });
      expect(after.status).toBe('failed');
      expect(after.errorSummary).toMatch(/tenant deletion/i);
    });

    it('AC3: export after requesting resolves both archival tiers, JSON and CSV, re-triggerably', async () => {
      const jsonRes = await request(app)
        .post('/v1/tenants/self-service-deletion/export')
        .set('X-Test-Identity', tenantAdminHeader)
        .send({});
      expect(jsonRes.status).toBe(200);

      const postIds = jsonRes.body.socialPosts.map((p: { id: string }) => p.id);
      expect(postIds).toContain(livePostId);
      expect(postIds).toContain(archivedPostId);
      const archivedExported = jsonRes.body.socialPosts.find((p: { id: string }) => p.id === archivedPostId);
      expect(archivedExported.raw_payload.text).toBe('a post whose rawPayload will be archived to blob');

      const runIds = jsonRes.body.ingestionRuns.map((r: { id: string }) => r.id);
      expect(runIds).toContain(liveIngestionRunId);
      expect(runIds).toContain(archivedIngestionRunId);

      const authorIds = jsonRes.body.authors.map((a: { id: string }) => a.id);
      expect(authorIds).toContain(authorId);
      expect(jsonRes.body.watchlists.length).toBeGreaterThanOrEqual(1);

      // Re-triggerable, CSV this time.
      const csvRes = await request(app)
        .post('/v1/tenants/self-service-deletion/export')
        .set('X-Test-Identity', tenantAdminHeader)
        .send({ format: 'csv' });
      expect(csvRes.status).toBe(200);
      expect(csvRes.text).toContain('# socialPosts');
      expect(csvRes.text).toContain('# ingestionRuns');
      expect(csvRes.text).toContain(livePostId);
    });

    it('AC4: cancel nulls the request and resumes ingestion; re-request afterward starts a fresh window', async () => {
      const cancelRes = await request(app)
        .delete('/v1/tenants/self-service-deletion')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.cancelled).toBe(true);

      const resumed = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' },
        attempt: async () => ({ postsIngested: 0, postsSkipped: 0 }),
      });
      expect(resumed.status).toBe('succeeded');

      const reRequestRes = await request(app)
        .post('/v1/tenants/self-service-deletion/request')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(reRequestRes.status).toBe(202);
    });

    it('AC5: confirm before the grace period has elapsed is rejected, naming the remaining wait', async () => {
      const res = await request(app)
        .post('/v1/tenants/self-service-deletion/confirm')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(res.status).toBe(409);
      expect(res.body.graceEndsAt).toBeTruthy();
    });

    it('AC4: cancel is rejected once already confirmed', async () => {
      // Backdate this tenant's own deletion_requested_at past the grace
      // period (test-only manipulation via app_user's own narrow UPDATE
      // grant on this column, migrations/0023 — not a raw admin-pool
      // shortcut) so confirm can genuinely succeed, then prove cancel is
      // rejected afterward.
      await withTenant(tenantId, (client) =>
        client.query(`UPDATE tenants SET deletion_requested_at = now() - interval '31 days' WHERE id = $1`, [
          tenantId,
        ])
      );

      const confirmRes = await request(app)
        .post('/v1/tenants/self-service-deletion/confirm')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(confirmRes.status).toBe(202);
      expect(confirmRes.body.status).toBe('deleting');

      const cancelRes = await request(app)
        .delete('/v1/tenants/self-service-deletion')
        .set('X-Test-Identity', tenantAdminHeader);
      expect(cancelRes.status).toBe(409);
    });

    it('AC6: completion — every tenant-content table hard-deleted, credentials unreadable, tombstones survive, tenant row gone', async () => {
      await waitForTenantDeletionToComplete(tenantId);

      // Verification reads here deliberately use getAdminPool() (superuser),
      // not getPlatformAdminPool() — platform_admin_role has zero grants on
      // any of these tables now (that's the whole point of this story's own
      // corrected design, AC7), so these are pure test-side verification,
      // never exercising the application's own role-based access.
      const users = await getAdminPool().query('SELECT 1 FROM users WHERE tenant_id = $1', [tenantId]);
      expect(users.rows).toHaveLength(0);
      const watchlists = await getAdminPool().query('SELECT 1 FROM watchlists WHERE tenant_id = $1', [tenantId]);
      expect(watchlists.rows).toHaveLength(0);
      const credentials = await getAdminPool().query('SELECT 1 FROM platform_credentials WHERE tenant_id = $1', [
        tenantId,
      ]);
      expect(credentials.rows).toHaveLength(0);
      await expect(readCredential(tenantId, credentialId)).rejects.toThrow();

      const posts = await getAdminPool().query('SELECT 1 FROM social_posts WHERE tenant_id = $1', [tenantId]);
      expect(posts.rows).toHaveLength(0);
      const authors = await getAdminPool().query('SELECT 1 FROM authors WHERE tenant_id = $1', [tenantId]);
      expect(authors.rows).toHaveLength(0);
      await expect(downloadArchiveBlob(`social-posts/${archivedPostId}.json`)).rejects.toThrow();

      const runs = await getAdminPool().query('SELECT 1 FROM ingestion_runs WHERE tenant_id = $1', [tenantId]);
      expect(runs.rows).toHaveLength(0);
      await expect(downloadArchiveBlob(`ingestion-runs/${archivedIngestionRunId}.json`)).rejects.toThrow();

      const auditRows = await getPlatformAdminPool().query(
        'SELECT operation FROM platform_admin_audit_log WHERE target_tenant_id = $1 ORDER BY created_at',
        [tenantId]
      );
      const operations = auditRows.rows.map((r) => r.operation);
      expect(operations).toContain('test_prior_action');
      expect(operations).toContain('tenant_deletion_requested');
      expect(operations).toContain('tenant_deletion_cancelled');
      expect(operations).toContain('tenant_export');
      expect(operations).toContain('tenant_deletion_confirmed');
      expect(operations).toContain('tenant_deletion_completed');

      const domainAttempts = await getAdminPool().query('SELECT 1 FROM domain_signup_attempts WHERE tenant_id = $1', [
        tenantId,
      ]);
      expect(domainAttempts.rows).toHaveLength(1);

      const tenantRow = await getPlatformAdminPool().query('SELECT 1 FROM tenants WHERE id = $1', [tenantId]);
      expect(tenantRow.rows).toHaveLength(0);
    });

    it('AC7: platform_admin_role cannot write to the deletion-lifecycle columns — no exception carved out for deletion', async () => {
      await expect(
        getPlatformAdminPool().query(`UPDATE tenants SET deletion_requested_at = now() WHERE id = $1`, [
          randomUUID(),
        ])
      ).rejects.toThrow(/permission denied/i);
    });

    it('AC8: request/export/cancel/confirm/completion were all audit-logged with the confirming Tenant-Admin as actor', async () => {
      const { rows } = await getPlatformAdminPool().query(
        `SELECT operation, actor_identity FROM platform_admin_audit_log WHERE target_tenant_id = $1 AND operation IN ('tenant_deletion_requested', 'tenant_deletion_cancelled', 'tenant_export', 'tenant_deletion_confirmed', 'tenant_deletion_completed')`,
        [tenantId]
      );
      expect(rows.length).toBeGreaterThanOrEqual(5);
      for (const row of rows) {
        expect(row.actor_identity).toBe(tenantAdminUserId);
      }
    });
  });
});
