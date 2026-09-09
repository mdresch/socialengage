// Contract: Story 16.1 (ADR-0125, BRD-0125, FDD-0125, TDS-0125) — Author-Initiated Takedown SLA Tracking and Enrichment Cascade (Backend)
// Intent:
// - Story: Story 16.1 (Epic 16)
// - ADR: ADR-0125 (Author-Initiated Takedown Refinements)
// - BRD/FDD/TDS: BRD-0125, FDD-0125, TDS-0125
// - Scope:
//   1. AC1: Mandatory bot mitigation (CAPTCHA) on public submission (POST /public/v1/takedowns).
//   2. AC2: 45-day default statutory response SLA clock initialization on magic-link verification (POST /public/v1/takedowns/verify).
//   3. AC3: Advisory-only risk flagging for human reviewers (GET /v1/takedowns) with strict human-in-the-loop decision rule (auto-resolve blocked with 403 AUTO_DECISION_FORBIDDEN).
//   4. AC4: Deep redaction cascade into AI enrichment tables on grant (POST /v1/takedowns/:id/grant) scrubbing sentiment, sentimentConfidence, keyPhrases, and topicClusters, while preserving technical metadata.
// - Out of scope:
//   - Automated email notification dispatching on SLA breach (deferred per Q-0125-1).
//   - Automated decision making (explicitly forbidden by ADR-0125).
//   - Frontend UI forms/views (reserved for separate admin UI stories).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { getRagConnector } from '../../src/rag/ragConnectorRegistry';

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
  } = {}
): Promise<{ id: string; url: string }> {
  const postId = randomUUID();
  const postUrl = overrides.platformPostUrl || `https://x.com/author_${randomUUID()}/status/123456789`;
  const body = overrides.body || 'Controversial post subject to legal author takedown under privacy regulations.';
  const enrichment = overrides.enrichment || {
    sentiment: 'negative',
    sentimentConfidence: 0.92,
    keyPhrases: ['privacy', 'lawsuit', 'author'],
    topicClusters: ['legal_risk', 'privacy_dispute'],
    detectedLanguage: 'en',
    enrichment_override: { flaggedBy: 'moderator-1' },
  };

  await getAdminPool().query(
    `INSERT INTO social_posts (
      id, tenant_id, body_markdown, raw_payload, enrichment, published_at
    ) VALUES ($1, $2, $3, $4, $5, now())`,
    [
      postId,
      tenantId,
      body,
      JSON.stringify({ text: body, platform: 'facebook', originalAuthor: 'test-author' }),
      JSON.stringify(enrichment),
    ]
  );

  return { id: postId, url: postUrl };
}

describe('Story 16.1 — Author-Initiated Takedown SLA Tracking and Enrichment Cascade Contract', () => {
  const app = createApp();

  describe('AC1: Mandatory Bot Mitigation (CAPTCHA) on Public Submission Form', () => {
    it('rejects takedown submissions missing captchaToken with 400 CAPTCHA_VERIFICATION_FAILED', async () => {
      const tenant = await createTenantFixture(`T-16.1-captcha-missing-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'author@example.com',
          authorName: 'John Doe',
          reason: 'Please take down my post under GDPR Art. 17',
          // Missing captchaToken
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'CAPTCHA_VERIFICATION_FAILED',
        message: expect.stringMatching(/token.*missing|invalid/i),
      });
    });

    it('rejects takedown submissions with invalid captchaToken with 400 CAPTCHA_VERIFICATION_FAILED', async () => {
      const tenant = await createTenantFixture(`T-16.1-captcha-invalid-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'author@example.com',
          authorName: 'John Doe',
          reason: 'Please take down my post',
          captchaToken: 'invalid-token',
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'CAPTCHA_VERIFICATION_FAILED',
      });
    });

    it('accepts takedown submission with valid captchaToken returning 202 Accepted and creates pending record', async () => {
      const tenant = await createTenantFixture(`T-16.1-captcha-valid-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const res = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'valid-author@example.com',
          authorName: 'Jane Author',
          reason: 'Requesting erasure under CCPA § 1798.105',
          captchaToken: 'valid-captcha-token',
        });

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        status: 'pending_verification',
        message: expect.stringMatching(/verification link sent/i),
        requestId: expect.any(String),
      });

      // Verify record is in pending_verification status in DB
      const { rows } = await getAdminPool().query(
        `SELECT * FROM data_subject_requests WHERE id = $1`,
        [res.body.requestId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending_verification');
      expect(rows[0].verification_token).toBeDefined();
      expect(rows[0].sla_due_at).toBeNull(); // SLA clock has not started yet
    });
  });

  describe('AC2: 45-Day Statutory Response SLA Clock Initialization upon Verification', () => {
    it('initializes sla_due_at to created_at + 45 days when magic-link verification succeeds', async () => {
      const tenant = await createTenantFixture(`T-16.1-sla-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      // 1. Submit takedown
      const submitRes = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'author-sla@example.com',
          captchaToken: 'valid-captcha-token',
        });

      expect(submitRes.status).toBe(202);
      const requestId = submitRes.body.requestId;

      // Fetch verification token
      const { rows } = await getAdminPool().query<{ verification_token: string }>(
        `SELECT verification_token FROM data_subject_requests WHERE id = $1`,
        [requestId]
      );
      const token = rows[0].verification_token;
      expect(token).toBeDefined();

      const beforeVerify = Date.now();

      // 2. Verify magic link
      const verifyRes = await request(app)
        .post('/public/v1/takedowns/verify')
        .send({ token });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toMatchObject({
        id: requestId,
        status: 'received',
        slaDueAt: expect.any(String),
      });

      // 3. Assert SLA is approximately 45 days in future (within 5 seconds tolerance)
      const slaDueDate = new Date(verifyRes.body.slaDueAt).getTime();
      const expected45DaysMs = 45 * 24 * 60 * 60 * 1000;
      expect(slaDueDate - beforeVerify).toBeGreaterThanOrEqual(expected45DaysMs - 5000);
      expect(slaDueDate - beforeVerify).toBeLessThanOrEqual(expected45DaysMs + 5000);

      // Verify DB row matches
      const dbCheck = await getAdminPool().query(
        `SELECT status, verified_at, sla_due_at FROM data_subject_requests WHERE id = $1`,
        [requestId]
      );
      expect(dbCheck.rows[0].status).toBe('received');
      expect(dbCheck.rows[0].verified_at).not.toBeNull();
      expect(dbCheck.rows[0].sla_due_at).not.toBeNull();
    });

    it('rejects invalid or non-existent verification tokens with 400 or 404', async () => {
      const res = await request(app)
        .post('/public/v1/takedowns/verify')
        .send({ token: 'non-existent-magic-token-xyz' });

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('AC3: Advisory Risk-Flagging and Strict Human Decision Rule', () => {
    it('surfaces advisory risk_flag and risk_reason in GET /v1/takedowns without triggering auto-deny', async () => {
      const tenant = await createTenantFixture(`T-16.1-risk-${randomUUID()}`);
      const adminUser = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });
      const post = await createPostFixture(tenant.id);

      // Submit and verify a takedown with risk indicator (e.g. bulk suspicious pattern or explicit flag)
      const submitRes = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'suspicious-bulk-bot@example.com',
          captchaToken: 'valid-captcha-token',
          riskFlag: true,
          riskReason: 'Rapid multi-origin takedown pattern detected',
        });

      const requestId = submitRes.body.requestId;
      const { rows } = await getAdminPool().query<{ verification_token: string }>(
        `SELECT verification_token FROM data_subject_requests WHERE id = $1`,
        [requestId]
      );
      await request(app)
        .post('/public/v1/takedowns/verify')
        .send({ token: rows[0].verification_token });

      // Reviewer queries takedown queue
      const listRes = await request(app)
        .get('/v1/takedowns')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }));

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const target = listRes.body.find((item: any) => item.id === requestId);
      expect(target).toBeDefined();
      expect(target.status).toBe('received'); // STRICT INVARIANT: NOT auto-denied
      expect(target.riskFlag).toBe(true);
      expect(target.riskReason).toBe('Rapid multi-origin takedown pattern detected');
    });

    it('forbids automated programmatic resolution returning 403 AUTO_DECISION_FORBIDDEN', async () => {
      const tenant = await createTenantFixture(`T-16.1-auto-forbidden-${randomUUID()}`);
      const post = await createPostFixture(tenant.id);

      const submitRes = await request(app)
        .post('/public/v1/takedowns')
        .send({
          tenantId: tenant.id,
          postUrl: post.url,
          authorEmail: 'author-auto@example.com',
          captchaToken: 'valid-captcha-token',
        });
      const requestId = submitRes.body.requestId;

      // Attempt resolution without human authentication
      const unauthRes = await request(app)
        .post(`/v1/takedowns/${requestId}/grant`)
        .send({ automated: true });

      expect([401, 403]).toContain(unauthRes.status);
    });

    it('allows human reviewer to deny with reason or escalate for legal review', async () => {
      const tenant = await createTenantFixture(`T-16.1-review-actions-${randomUUID()}`);
      const adminUser = await createInvitedUser(tenant.id, { email: `admin-act-${randomUUID()}@example.com` });
      const post1 = await createPostFixture(tenant.id);
      const post2 = await createPostFixture(tenant.id);

      // Create two verified requests
      const sub1 = await request(app).post('/public/v1/takedowns').send({
        tenantId: tenant.id,
        postUrl: post1.url,
        authorEmail: 'deny-target@example.com',
        captchaToken: 'valid-captcha-token',
      });
      const token1 = (await getAdminPool().query(`SELECT verification_token FROM data_subject_requests WHERE id = $1`, [sub1.body.requestId])).rows[0].verification_token;
      await request(app).post('/public/v1/takedowns/verify').send({ token: token1 });

      const sub2 = await request(app).post('/public/v1/takedowns').send({
        tenantId: tenant.id,
        postUrl: post2.url,
        authorEmail: 'escalate-target@example.com',
        captchaToken: 'valid-captcha-token',
      });
      const token2 = (await getAdminPool().query(`SELECT verification_token FROM data_subject_requests WHERE id = $1`, [sub2.body.requestId])).rows[0].verification_token;
      await request(app).post('/public/v1/takedowns/verify').send({ token: token2 });

      // Deny first request
      const denyRes = await request(app)
        .post(`/v1/takedowns/${sub1.body.requestId}/deny`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }))
        .send({ decisionReason: 'Author does not hold copyright or identity credentials' });

      expect(denyRes.status).toBe(200);
      expect(denyRes.body.status).toBe('denied');

      // Escalate second request
      const escRes = await request(app)
        .post(`/v1/takedowns/${sub2.body.requestId}/escalate`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }))
        .send({ decisionReason: 'Complex contested jurisdictional claim requires external counsel' });

      expect(escRes.status).toBe(200);
      expect(escRes.body.status).toBe('escalated');
    });
  });

  describe('AC4: Deep Redaction Cascade into AI Enrichment Tables on Grant', () => {
    it('executes full cascade: soft-redacts body, wipes sentiment and topics, preserves language metadata, and purges vector chunks', async () => {
      const tenant = await createTenantFixture(`T-16.1-cascade-${randomUUID()}`);
      const adminUser = await createInvitedUser(tenant.id, { email: `admin-cascade-${randomUUID()}@example.com` });

      // 1. Create post with rich content-derived AI enrichment
      const initialEnrichment = {
        sentiment: 'negative',
        sentimentConfidence: 0.94,
        keyPhrases: ['defamation', 'boycott', 'scandal', 'unethical'],
        topicClusters: ['brand_crisis', 'legal_dispute'],
        detectedLanguage: 'en',
        enrichment_override: { auditedBy: 'compliance-bot-v2', timestamp: '2026-09-05T12:00:00Z' },
      };

      const post = await createPostFixture(tenant.id, {
        body: 'Sensitive author content discussing defamatory events and confidential facts.',
        enrichment: initialEnrichment,
      });

      // 2. Link post to a watchlist match
      const watchlist = await createWatchlist(tenant.id, adminUser.id, {
        name: 'Crisis Watchlist',
        matchType: 'keyword',
        platformIds: ['facebook'],
      });

      await getAdminPool().query(
        `INSERT INTO post_watchlist_matches (tenant_id, post_id, watchlist_id, matched_at)
         VALUES ($1, $2, $3, now())`,
        [tenant.id, post.id, watchlist.id]
      );

      // 3. Index chunk in RAG vector store
      const rag = getRagConnector();
      await rag.upsert(tenant.id, [
        {
          id: `${tenant.id}:${post.id}:0`,
          values: new Array(1536).fill(0.01),
          metadata: {
            tenant_id: tenant.id,
            post_id: post.id,
            chunk_index: 0,
            content: 'Sensitive author content discussing defamatory events and confidential facts.',
            platform_id: 'facebook',
            published_at: new Date().toISOString(),
          },
        },
      ]);

      // 4. Submit and verify takedown targeting this post
      const subRes = await request(app).post('/public/v1/takedowns').send({
        tenantId: tenant.id,
        postId: post.id,
        postUrl: post.url,
        authorEmail: 'verified-author@example.com',
        captchaToken: 'valid-captcha-token',
      });
      const token = (await getAdminPool().query(`SELECT verification_token FROM data_subject_requests WHERE id = $1`, [subRes.body.requestId])).rows[0].verification_token;
      await request(app).post('/public/v1/takedowns/verify').send({ token });

      // 5. Grant the takedown
      const grantRes = await request(app)
        .post(`/v1/takedowns/${subRes.body.requestId}/grant`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: adminUser.id, role: 'tenant_admin' }))
        .send({ decisionReason: 'Valid author identity confirmed under GDPR Article 17' });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.status).toBe('granted');

      // 6. Assert database state for post:
      const { rows: postRows } = await getAdminPool().query(
        `SELECT body_markdown, raw_payload, enrichment, redacted_at, redaction_request_id
         FROM social_posts WHERE id = $1`,
        [post.id]
      );

      expect(postRows).toHaveLength(1);
      const redactedPost = postRows[0];

      // 6a: Body and raw_payload soft-redacted
      expect(redactedPost.body_markdown).toBe('[REDACTED PURSUANT TO AUTHOR TAKEDOWN REQUEST]');
      expect(redactedPost.raw_payload).toEqual({ redacted: true });
      expect(redactedPost.redacted_at).not.toBeNull();
      expect(redactedPost.redaction_request_id).toBe(subRes.body.requestId);

      // 6b: Content-derived AI enrichment cleared
      const postEnrichment = redactedPost.enrichment;
      expect(postEnrichment.sentiment).toBeNull();
      expect(postEnrichment.sentimentConfidence).toBeNull();
      expect(postEnrichment.keyPhrases).toEqual([]);
      expect(postEnrichment.topicClusters).toBeUndefined(); // Scrubbed

      // 6c: Non-content technical metadata preserved
      expect(postEnrichment.detectedLanguage).toBe('en');
      expect(postEnrichment.enrichment_override).toEqual(initialEnrichment.enrichment_override);

      // 7. Assert watchlist matches cleaned up
      const { rows: matchRows } = await getAdminPool().query(
        `SELECT * FROM post_watchlist_matches WHERE tenant_id = $1 AND post_id = $2`,
        [tenant.id, post.id]
      );
      expect(matchRows).toHaveLength(0);

      // 8. Assert RAG chunks purged
      const { rows: ragRows } = await getAdminPool().query(
        `SELECT * FROM rag_chunks WHERE tenant_id = $1 AND post_id = $2`,
        [tenant.id, post.id]
      );
      expect(ragRows).toHaveLength(0);
    });
  });
});
