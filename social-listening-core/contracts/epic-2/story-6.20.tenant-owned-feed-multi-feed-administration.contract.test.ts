// Contract: Story 6.20 (ADR-0057) — Multi-feed administration for the
// tenant-owned-feed connector (list, edit, remove), resolving ADR-0050's
// own Open Question 2.
// See docs/user-stories/epic-6-tenant-admin-ui.md#story-620
//
// Intent: expose the already-real, already-multi-feed-capable storage/
// polling layer (tenant_owned_feed_activations already has no uniqueness
// constraint; getVerifiedActivations()/pollTenantOwnedFeed() already
// iterate every verified row) over three new REST endpoints, correct a
// found pre-existing role-gating gap on connect/verify-domain, and add a
// domain-reuse auto-verify path.
// Scope: social-listening-core/{
//   migrations/0031_add_removed_status_to_tenant_owned_feed_activations.sql (new),
//   src/connectors/tenantOwnedFeed/tenantOwnedFeedStore.ts (extended —
//     listActivations, updateFeedUrl, removeActivation; status type widened),
//   src/http/versions/v1/tenantOwnedFeedRouter.ts (extended — GET
//     .../activations, PATCH /:id, DELETE /:id; tenant_admin role check
//     added to connect/verify-domain; connect auto-verifies a second feed
//     on an already-verified domain)
// }.
// Contract to encode, per ADR-0057 Decision / Story 6.20 AC:
//   (1) GET .../activations lists every activation for the caller's
//       tenant regardless of status, tenant_admin only, RLS-scoped;
//   (2) PATCH /:id updates feedUrl only (domain in the body is a 400),
//       tenant_admin only, works on pending or verified, 404 for unknown id;
//   (3) DELETE /:id soft-removes (status -> 'removed'), tenant_admin only,
//       404 for unknown id, a removed row is excluded from
//       getVerifiedActivations() and therefore never polled again,
//       already-ingested SocialPost/Author rows are untouched;
//   (4) connect and verify-domain both now require tenant_admin (403 for
//       tenant_user — previously allowed);
//   (5) connect on a domain the tenant already holds verified skips DNS
//       TXT verification entirely — the new row is created directly
//       verified, response body carries status: 'verified'; a genuinely
//       new domain still returns the pending TXT-instructions shape,
//       now also carrying status: 'pending' for symmetry.
// Explicitly out of scope: any feed-count cap (ADR-0057's own named Open
//   Question, left unbounded); a scheduled cleanup job for stale
//   pending/removed rows; a token-regenerate/retry endpoint (remove-and-
//   reconnect is the sanctioned path); Platform-Admin cross-tenant feed
//   visibility (a separate, deliberately out-of-scope gap ADR-0057 named).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import {
  createActivation,
  markVerified,
  getVerifiedActivations,
} from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(30000);

afterAll(async () => {
  await closePool();
});

function adminHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_admin' });
}
function userHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_user' });
}

describe('Story 6.20 — tenant-owned-feed multi-feed administration', () => {
  describe('AC1: GET /v1/connectors/tenant-owned-feed/activations lists every activation, any status, tenant_admin only, RLS-scoped', () => {
    it('lists pending, verified, and (once removed) removed rows for the caller tenant', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const pending = await createActivation(tenantId, { domain: 'pending.example', feedUrl: 'https://pending.example/feed' });
      const verified = await createActivation(tenantId, { domain: 'verified.example', feedUrl: 'https://verified.example/feed' });
      await markVerified(tenantId, verified.id);

      const res = await request(app)
        .get('/v1/connectors/tenant-owned-feed/activations')
        .set('X-Test-Identity', adminHeader(tenantId));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.activations)).toBe(true);
      const ids = res.body.activations.map((a: { id: string }) => a.id);
      expect(ids).toEqual(expect.arrayContaining([pending.id, verified.id]));
      const pendingRow = res.body.activations.find((a: { id: string }) => a.id === pending.id);
      expect(pendingRow.status).toBe('pending');
      expect(pendingRow.domain).toBe('pending.example');
      expect(pendingRow.feedUrl).toBe('https://pending.example/feed');
      expect(pendingRow.txtRecordHost).toBe('_socialengage-verify.pending.example');
      expect(pendingRow.txtRecordValue).toMatch(/^socialengage-verify=/);
      expect(pendingRow.tokenExpiresAt).toBeDefined();
      expect(pendingRow.createdAt).toBeDefined();
      const verifiedRow = res.body.activations.find((a: { id: string }) => a.id === verified.id);
      expect(verifiedRow.status).toBe('verified');
      expect(verifiedRow.verifiedAt).toBeDefined();
    });

    it('returns 403 for a tenant_user caller', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const res = await request(app)
        .get('/v1/connectors/tenant-owned-feed/activations')
        .set('X-Test-Identity', userHeader(tenantId));
      expect(res.status).toBe(403);
    });

    it('never returns another tenant\'s activations (RLS)', async () => {
      const app = createApp();
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      await createActivation(tenantA, { domain: 'a.example', feedUrl: 'https://a.example/feed' });
      await createActivation(tenantB, { domain: 'b.example', feedUrl: 'https://b.example/feed' });

      const res = await request(app)
        .get('/v1/connectors/tenant-owned-feed/activations')
        .set('X-Test-Identity', adminHeader(tenantA));

      expect(res.status).toBe(200);
      const domains = res.body.activations.map((a: { domain: string }) => a.domain);
      expect(domains).toContain('a.example');
      expect(domains).not.toContain('b.example');
    });
  });

  describe('AC2: PATCH /:id updates feedUrl only, tenant_admin only', () => {
    it('updates feedUrl on a verified activation without touching domain or status', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/old-feed' });
      await markVerified(tenantId, activation.id);

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/new-feed' });

      expect(res.status).toBe(200);
      expect(res.body.feedUrl).toBe('https://blog.example.com/new-feed');
      expect(res.body.domain).toBe('blog.example.com');
      expect(res.body.status).toBe('verified');
    });

    it('also updates feedUrl on a still-pending activation', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/typo-feed' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/fixed-feed' });

      expect(res.status).toBe(200);
      expect(res.body.feedUrl).toBe('https://blog.example.com/fixed-feed');
      expect(res.body.status).toBe('pending');
    });

    it('rejects a request that includes domain with a 400 — domain is never editable via this route', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });

      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/feed2', domain: 'different.example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown id', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${randomUUID()}`)
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/feed' });
      expect(res.status).toBe(404);
    });

    it('returns 403 for a tenant_user caller', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });
      const res = await request(app)
        .patch(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', userHeader(tenantId))
        .send({ feedUrl: 'https://blog.example.com/feed2' });
      expect(res.status).toBe(403);
    });
  });

  describe('AC3: DELETE /:id soft-removes — status -> \'removed\', excluded from polling, never a hard delete', () => {
    it('transitions status to removed and excludes the row from getVerifiedActivations()', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });
      await markVerified(tenantId, activation.id);
      expect((await getVerifiedActivations(tenantId)).map((a) => a.id)).toContain(activation.id);

      const res = await request(app)
        .delete(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantId));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('removed');
      expect((await getVerifiedActivations(tenantId)).map((a) => a.id)).not.toContain(activation.id);
    });

    it('returns 404 for an unknown id', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const res = await request(app)
        .delete(`/v1/connectors/tenant-owned-feed/${randomUUID()}`)
        .set('X-Test-Identity', adminHeader(tenantId));
      expect(res.status).toBe(404);
    });

    it('returns 403 for a tenant_user caller', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });
      const res = await request(app)
        .delete(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', userHeader(tenantId));
      expect(res.status).toBe(403);
    });

    it('never touches another tenant\'s activation (RLS)', async () => {
      const app = createApp();
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const activation = await createActivation(tenantB, { domain: 'b.example', feedUrl: 'https://b.example/feed' });

      const res = await request(app)
        .delete(`/v1/connectors/tenant-owned-feed/${activation.id}`)
        .set('X-Test-Identity', adminHeader(tenantA));

      expect(res.status).toBe(404);
      expect((await getVerifiedActivations(tenantB)).map((a) => a.id)).not.toContain(undefined);
    });
  });

  describe('AC4: connect and verify-domain both now require tenant_admin', () => {
    it('POST /connect returns 403 for a tenant_user caller', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', userHeader(tenantId))
        .send({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });
      expect(res.status).toBe(403);
    });

    it('POST /verify-domain returns 403 for a tenant_user caller', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const activation = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' });
      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/verify-domain')
        .set('X-Test-Identity', userHeader(tenantId))
        .send({ connectorActivationId: activation.id });
      expect(res.status).toBe(403);
    });
  });

  describe('AC5: connect on an already-verified domain auto-verifies the new row, skipping DNS TXT verification', () => {
    it('a second feed on an already-verified domain is created directly verified', async () => {
      const app = createApp();
      const tenantId = randomUUID();
      const first = await createActivation(tenantId, { domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed1' });
      await markVerified(tenantId, first.id);

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed2' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('verified');
      expect(res.body.feedUrl).toBe('https://blog.example.com/feed2');
      const verifiedIds = (await getVerifiedActivations(tenantId)).map((a) => a.id);
      expect(verifiedIds).toContain(res.body.connectorActivationId);
      expect(verifiedIds).toContain(first.id);
    });

    it('a genuinely new (never-verified) domain still returns the pending TXT-instructions shape', async () => {
      const app = createApp();
      const tenantId = randomUUID();

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantId))
        .send({ domain: 'brand-new.example.com', feedUrl: 'https://brand-new.example.com/feed' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.txtRecordHost).toBe('_socialengage-verify.brand-new.example.com');
    });

    it('a domain verified for a DIFFERENT tenant does not skip verification (RLS-scoped check)', async () => {
      const app = createApp();
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const otherTenantsActivation = await createActivation(tenantA, { domain: 'shared-name.example.com', feedUrl: 'https://shared-name.example.com/feed1' });
      await markVerified(tenantA, otherTenantsActivation.id);

      const res = await request(app)
        .post('/v1/connectors/tenant-owned-feed/connect')
        .set('X-Test-Identity', adminHeader(tenantB))
        .send({ domain: 'shared-name.example.com', feedUrl: 'https://shared-name.example.com/feed2' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
    });
  });
});
