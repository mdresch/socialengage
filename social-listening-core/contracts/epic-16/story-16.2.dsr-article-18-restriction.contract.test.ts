// Contract: Story 16.2 (ADR-0126, BRD-0126, FDD-0126, TDS-0126) — DSR Article 18 Restriction Quarantining and Verified Receipts (Backend)
// Intent:
// - Story: Story 16.2 (Epic 16)
// - ADR: ADR-0126 (DSR Self-Service Portal Refinements — Article 18 Restriction Flags and Verified Receipts)
// - BRD/FDD/TDS: BRD-0126, FDD-0126, TDS-0126
// - Scope:
//   1. AC1: Mandatory bot mitigation (CAPTCHA) & HMAC-SHA256 receipt generation on public DSR submission (POST /public/v1/dsr/requests).
//   2. AC2: Public constant-time receipt verification & anti-tamper validation (GET /public/v1/dsr/verify-receipt).
//   3. AC3: Role-gated Article 18 quarantine (POST /v1/dsr/requests/:id/quarantine) and reverse remediation (POST /v1/dsr/requests/:id/unquarantine).
//   4. AC4: Automatic exclusion of processing-restricted posts from analytics overview, CSV data exports, and RAG vector search, while preserving underlying post rows and relational integrity.
// - Out of scope:
//   - DSR portal frontend UI (separate admin UI story).
//   - Irreversible hard erasure cascade (governed by Story 10.12 / ADR-0093).
//   - Certified PDF receipt generation (Q-0126-2).

import { randomUUID, createHmac } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { getRagConnector } from '../../src/rag/ragConnectorRegistry';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createPostFixture(
  tenantId: string,
  overrides: {
    body?: string;
    enrichment?: Record<string, any>;
    platformPostUrl?: string;
    processingRestricted?: boolean;
  } = {}
): Promise<{ id: string; url: string }> {
  const postId = randomUUID();
  const postUrl = overrides.platformPostUrl || `https://linkedin.com/post/${randomUUID()}`;
  const body = overrides.body || 'Post subject to contested processing under GDPR Article 18.';
  const enrichment = overrides.enrichment || {
    sentiment: 'negative',
    sentimentConfidence: 0.88,
    keyPhrases: ['gdpr', 'article18', 'quarantine'],
    topicClusters: ['regulatory_dispute'],
    detectedLanguage: 'en',
  };

  await getAdminPool().query(
    `INSERT INTO social_posts (
      id, tenant_id, body_markdown, raw_payload, enrichment, processing_restricted, published_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [
      postId,
      tenantId,
      body,
      JSON.stringify({ text: body, platform: 'linkedin', postUrl, providerId: 'linkedin' }),
      JSON.stringify(enrichment),
      overrides.processingRestricted ?? false,
    ]
  );

  return { id: postId, url: postUrl };
}

describe('Story 16.2 — DSR Article 18 Restriction Quarantining and Verified Receipts Contract', () => {
  const app = createApp();

  describe('AC1: Mandatory Bot Mitigation & HMAC-SHA256 Receipt Issuance on Public DSR Submission', () => {
    it('rejects public DSR requests missing captchaToken with 400 CAPTCHA_VERIFICATION_FAILED', async () => {
      const tenant = await createTenantFixture(`ac1-nocap-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'contestant@example.com',
          requestType: 'restriction',
          reason: 'Accuracy of personal facts contested under GDPR Article 18.',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_VERIFICATION_FAILED');
    });

    it('rejects public DSR requests with invalid captchaToken with 400 CAPTCHA_VERIFICATION_FAILED', async () => {
      const tenant = await createTenantFixture(`ac1-badcap-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'contestant@example.com',
          requestType: 'restriction',
          captchaToken: 'fraudulent-bot-token',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CAPTCHA_VERIFICATION_FAILED');
    });

    it('accepts valid restriction request returning 201 Created with cryptographically signed HMAC-SHA256 receipt', async () => {
      const tenant = await createTenantFixture(`ac1-valid-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'Author.Jane@Company.com',
          requesterName: 'Jane Doe',
          requestType: 'restriction',
          reason: 'Contesting public claims made in this post.',
          captchaToken: 'mock-valid-captcha-token',
        });

      expect(res.status).toBe(201);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.status).toBe('received');
      expect(res.body.receipt).toBeDefined();

      const { receipt } = res.body;
      expect(receipt.receiptId).toBeDefined();
      expect(receipt.issuedAt).toBeDefined();
      expect(receipt.signature).toBeDefined();
      expect(receipt.payload).toBeDefined();

      // Ensure subjectHash is a 64-char hex SHA256, protecting raw email address
      expect(receipt.payload.subjectHash).toHaveLength(64);
      expect(receipt.payload.subjectHash).not.toContain('Author.Jane');
      expect(receipt.payload.requestType).toBe('restriction');
      expect(receipt.payload.tenantId).toBe(tenant.id);
      expect(receipt.payload.requestId).toBe(res.body.requestId);

      // Verify persistence in dsr_receipts table
      const { rows } = await getAdminPool().query(
        `SELECT * FROM dsr_receipts WHERE request_id = $1`,
        [res.body.requestId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].receipt_signature).toBe(receipt.signature);
    });
  });

  describe('AC2: Public Constant-Time Receipt Verification & Anti-Tamper Protection', () => {
    it('validates genuine HMAC-SHA256 receipt successfully returning verified: true', async () => {
      const tenant = await createTenantFixture(`ac2-verify-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      // 1. Submit request to obtain valid signed receipt
      const subRes = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'verified.subject@privacy.eu',
          requestType: 'restriction',
          captchaToken: 'mock-valid-captcha-token',
        });

      expect(subRes.status).toBe(201);
      const { receipt } = subRes.body;

      // 2. Verify receipt via public endpoint
      const verifyRes = await request(app)
        .get('/public/v1/dsr/verify-receipt')
        .query({
          requestId: receipt.payload.requestId,
          tenantId: receipt.payload.tenantId,
          subjectHash: receipt.payload.subjectHash,
          requestType: receipt.payload.requestType,
          timestamp: receipt.payload.timestamp,
          signature: receipt.signature,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verified).toBe(true);
      expect(verifyRes.body.payload.requestId).toBe(receipt.payload.requestId);
    });

    it('rejects tampered receipt payload with 400 INVALID_RECEIPT_SIGNATURE', async () => {
      const tenant = await createTenantFixture(`ac2-tamper-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const subRes = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'tamper.target@privacy.eu',
          requestType: 'restriction',
          captchaToken: 'mock-valid-captcha-token',
        });

      const { receipt } = subRes.body;

      // Alter payload (attempting to convert restriction to erasure)
      const verifyRes = await request(app)
        .get('/public/v1/dsr/verify-receipt')
        .query({
          requestId: receipt.payload.requestId,
          tenantId: receipt.payload.tenantId,
          subjectHash: receipt.payload.subjectHash,
          requestType: 'erasure', // TAMPERED!
          timestamp: receipt.payload.timestamp,
          signature: receipt.signature,
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.code).toBe('INVALID_RECEIPT_SIGNATURE');
    });

    it('rejects invalid or forged receipt signature with 400 INVALID_RECEIPT_SIGNATURE', async () => {
      const tenant = await createTenantFixture(`ac2-forged-${randomUUID()}`);

      const verifyRes = await request(app)
        .get('/public/v1/dsr/verify-receipt')
        .query({
          requestId: randomUUID(),
          tenantId: tenant.id,
          subjectHash: 'a'.repeat(64),
          requestType: 'restriction',
          timestamp: new Date().toISOString(),
          signature: 'deadbeef'.repeat(8),
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.code).toBe('INVALID_RECEIPT_SIGNATURE');
    });
  });

  describe('AC3: Role-Gated Article 18 Quarantine & Remediation Reversibility', () => {
    it('forbids non-admin / unauthorized tenant users from executing quarantine', async () => {
      const tenant = await createTenantFixture(`ac3-forbidden-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const user = await createInvitedUser(tenant.id, { email: `regular-${randomUUID()}@example.com` });

      const subRes = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'authcheck@example.com',
          requestType: 'restriction',
          captchaToken: 'mock-valid-captcha-token',
        });

      const res = await request(app)
        .post(`/v1/dsr/requests/${subRes.body.requestId}/quarantine`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, {
          userId: user.id,
          role: 'tenant_user',
        }))
        .send();

      expect(res.status).toBe(403);
    });

    it('allows tenant_admin to quarantine contested post and reverse via unquarantine', async () => {
      const tenant = await createTenantFixture(`ac3-quarantine-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

      const subRes = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          requesterEmail: 'author@legalcontest.org',
          requestType: 'restriction',
          captchaToken: 'mock-valid-captcha-token',
        });

      const requestId = subRes.body.requestId;

      // 1. Execute quarantine
      const quarantineRes = await request(app)
        .post(`/v1/dsr/requests/${requestId}/quarantine`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, {
          userId: admin.id,
          role: 'tenant_admin',
        }))
        .send();

      expect(quarantineRes.status).toBe(200);
      expect(quarantineRes.body.processingRestricted).toBe(true);

      // Verify DB column updated
      const { rows: quarantinedRows } = await getAdminPool().query(
        `SELECT processing_restricted FROM social_posts WHERE id = $1`,
        [post.id]
      );
      expect(quarantinedRows[0].processing_restricted).toBe(true);

      // 2. Reverse quarantine (unquarantine upon settlement)
      const unquarantineRes = await request(app)
        .post(`/v1/dsr/requests/${requestId}/unquarantine`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, {
          userId: admin.id,
          role: 'tenant_admin',
        }))
        .send();

      expect(unquarantineRes.status).toBe(200);
      expect(unquarantineRes.body.processingRestricted).toBe(false);

      const { rows: restoredRows } = await getAdminPool().query(
        `SELECT processing_restricted FROM social_posts WHERE id = $1`,
        [post.id]
      );
      expect(restoredRows[0].processing_restricted).toBe(false);
    });
  });

  describe('AC4: Automatic Processing Exclusion from Analytics, Exports, and RAG Vector Retrieval', () => {
    it('excludes processing_restricted posts from analytics overview, exports, and RAG search without deleting underlying row', async () => {
      const tenant = await createTenantFixture(`ac4-cascade-${randomUUID()}`);
      const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

      // Create two posts: one normal, one to be quarantined
      const normalPost = await createPostFixture(tenant.id, {
        body: 'Normal business post for analytics analysis.',
        enrichment: { sentiment: 'positive', sentimentScore: 0.85 },
      });
      const contestedPost = await createPostFixture(tenant.id, {
        body: 'Contested sensitive post requiring Article 18 restriction.',
        enrichment: { sentiment: 'negative', sentimentScore: 0.15 },
      });

      // Index both posts in RAG connector
      const rag = getRagConnector();
      await rag.upsert(tenant.id, [
        {
          id: `chunk-${normalPost.id}`,
          values: generateMockEmbedding('Normal business post', 1536),
          metadata: {
            tenant_id: tenant.id,
            post_id: normalPost.id,
            chunk_index: 0,
            content: 'Normal business post',
            platform_id: 'linkedin',
            published_at: new Date().toISOString(),
          },
        },
        {
          id: `chunk-${contestedPost.id}`,
          values: generateMockEmbedding('Contested sensitive post', 1536),
          metadata: {
            tenant_id: tenant.id,
            post_id: contestedPost.id,
            chunk_index: 0,
            content: 'Contested sensitive post',
            platform_id: 'linkedin',
            published_at: new Date().toISOString(),
          },
        },
      ]);

      const authHeaders = {
        'x-test-identity': testIdentityHeaderValue(tenant.id, {
          userId: admin.id,
          role: 'tenant_admin',
        }),
      };

      // 1. Initial State: Analytics overview should see 2 posts
      const initialOverview = await request(app)
        .get('/v1/analytics/overview')
        .set(authHeaders);
      expect(initialOverview.status).toBe(200);
      expect(initialOverview.body.totalPosts).toBe(2);

      // 2. Initial State: CSV export should contain both posts
      const initialExport = await request(app)
        .get('/v1/posts/export.csv')
        .set(authHeaders);
      expect(initialExport.status).toBe(200);
      expect(initialExport.text).toContain(normalPost.id);
      expect(initialExport.text).toContain(contestedPost.id);

      // 3. Initial State: RAG search can retrieve contested post
      const initialRagResults = await rag.search(tenant.id, generateMockEmbedding('Contested sensitive post', 1536), {
        topK: 5,
      });
      expect(initialRagResults.some((r) => r.metadata.post_id === contestedPost.id)).toBe(true);

      // 4. Submit DSR and quarantine the contested post
      const dsrRes = await request(app)
        .post('/public/v1/dsr/requests')
        .send({
          tenantId: tenant.id,
          postUrl: contestedPost.url,
          requesterEmail: 'contester@author.com',
          requestType: 'restriction',
          captchaToken: 'mock-valid-captcha-token',
        });

      await request(app)
        .post(`/v1/dsr/requests/${dsrRes.body.requestId}/quarantine`)
        .set(authHeaders)
        .send();

      // 5. Verify Exclusion: Analytics overview must now only count 1 post
      const postQuarantineOverview = await request(app)
        .get('/v1/analytics/overview')
        .set(authHeaders);
      expect(postQuarantineOverview.status).toBe(200);
      expect(postQuarantineOverview.body.totalPosts).toBe(1);

      // 6. Verify Exclusion: CSV export must omit contested post
      const postQuarantineExport = await request(app)
        .get('/v1/posts/export.csv')
        .set(authHeaders);
      expect(postQuarantineExport.status).toBe(200);
      expect(postQuarantineExport.text).toContain(normalPost.id);
      expect(postQuarantineExport.text).not.toContain(contestedPost.id);

      // 7. Verify Exclusion: RAG vector search must filter out contested post
      const postQuarantineRagResults = await rag.search(tenant.id, generateMockEmbedding('Contested sensitive post', 1536), {
        topK: 5,
      });
      expect(postQuarantineRagResults.some((r) => r.metadata.post_id === contestedPost.id)).toBe(false);

      // 8. Invariant: Underlying row remains intact in database (NOT deleted)
      const { rows: postRows } = await getAdminPool().query(
        `SELECT id, body_markdown, processing_restricted FROM social_posts WHERE id = $1`,
        [contestedPost.id]
      );
      expect(postRows).toHaveLength(1);
      expect(postRows[0].processing_restricted).toBe(true);
      expect(postRows[0].body_markdown).toContain('Contested sensitive post requiring Article 18 restriction.');
    });
  });
});
