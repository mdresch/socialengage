// Contract: Story 17.4 (ADR-0132) — Parameterized AST query templates with budget governor (backend)
// See docs/user-stories/epic-17-adr-0129-to-0133.md#story-174--parameterized-ast-query-templates-with-budget-governor-backend
//
// Intent: Story 17.4 — Parameterized AST query templates with budget governor
// Source: ADR-0132, BRD-0132, FDD-0132, TDS-0132 (ADR/BRD/FDD are terse stubs; the
//         Story's AC list and TDS-0132 are the real spec source — same pattern as
//         Story 17.2).
// Scope:
//   src/analytics/queryGovernor.ts (new)
//   src/analytics/adHocQueryEngine.ts (AST compile refactor + governed execution)
//   src/http/versions/v1/analyticsViewsRouter.ts (role gate + 422 mapping)
//   social-listening-core/.claude/skills/ad-hoc-query-engine/SKILL.md
// Contract to encode:
//   AC1: Query generation compiles requests into an immutable AST template whose
//        emitted SQL binds every user-supplied value via positional $N parameters —
//        no dynamic string interpolation of request data into SQL text.
//   AC2: Pre-execution governor runs EXPLAIN (FORMAT JSON) against the real planner;
//        Plan['Total Cost'] > 10,000 rejects with HTTP 422 QUERY_COST_EXCEEDED
//        carrying estimatedCost, budgetLimit, and suggested filter adjustments.
//   AC3: Execution runs under SET LOCAL statement_timeout = '3000ms' and
//        SET LOCAL work_mem = '32MB' (verified via real session readback).
//   AC4: Returned rows hard-capped at 5,000.
//   AC5: Role gating permits ad-hoc queries only for analytics-authorized roles per
//        ADR-0107's RBAC matrix (hasPermission(role,'analytics','read') — which
//        covers the AC-named tenant_admin and analyst); tenant isolation via the
//        withTenant() transaction-local session context.
// Out of scope: the unmounted dead-code twin analyticsQueryRouter.ts (flagged in
//   SKILL.md, not deleted here); adding 'analyst' to the users.role CHECK
//   constraint (DB-level role assignment is a separate concern — the gate reads
//   the resolved identity's role, which the RBAC matrix already defines).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import {
  compileAdHocQuery,
  executeAdHocQuery,
} from '../../src/analytics/adHocQueryEngine';
import { QueryCostExceededError } from '../../src/analytics/queryGovernor';

jest.setTimeout(60000);

const app = createApp();

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedPostForTenant(tenantId: string, platformId: string, sentiment: string, publishedAt: string) {
  await getAdminPool().query(
    `INSERT INTO social_posts (
       tenant_id, raw_payload, published_at, body_markdown, enrichment
     ) VALUES ($1, $2, $3::timestamptz, 'Test post body', $4)`,
    [
      tenantId,
      JSON.stringify({ providerId: platformId, externalId: `ext-${randomUUID()}` }),
      publishedAt,
      JSON.stringify({ sentiment, modelUsed: 'azure-ai-language' }),
    ]
  );
}

describe('Story 17.4 — Parameterized AST query templates with budget governor', () => {
  describe('AC1: immutable AST templates with positional placeholders only', () => {
    it('compileAdHocQuery returns a deeply frozen template; user values appear only in params, never in SQL text', () => {
      const hostile = `x' OR '1'='1' -- DROP TABLE social_posts;`;
      const compiled = compileAdHocQuery({
        dimensions: ['platform', 'date'],
        metrics: ['post_count'],
        timeGrain: 'day',
        filters: { platforms: [hostile], startDate: '2026-01-01T00:00:00Z' },
        limit: 10,
      });

      expect(Object.isFrozen(compiled)).toBe(true);
      expect(Object.isFrozen(compiled.ast)).toBe(true);
      expect(Object.isFrozen(compiled.ast.dimensions)).toBe(true);
      expect(Object.isFrozen(compiled.ast.filters)).toBe(true);

      // Hostile value is bound as a parameter, never interpolated into SQL.
      // Array filters bind whole arrays via = ANY($n), so check the bind values.
      expect(compiled.sql).not.toContain(hostile);
      expect(compiled.params).toContainEqual([hostile]);
      expect(compiled.sql).toMatch(/\$\d+/);
      // LIMIT is itself a bound positional parameter.
      expect(compiled.sql).toMatch(/LIMIT \$\d+/);
    });
  });

  describe('AC2: pre-execution cost governor', () => {
    afterEach(() => {
      delete process.env.QUERY_GOVERNOR_MAX_COST;
    });

    it('rejects queries whose planner-estimated cost exceeds the budget — real 422 through POST /v1/analytics/query', async () => {
      const tenant = await createTenantFixture(`T-17.4-gov-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedPostForTenant(tenant.id, 'twitter', 'positive', new Date().toISOString());

      // Drive the real budget down so the real planner's estimate trips it.
      process.env.QUERY_GOVERNOR_MAX_COST = '0.0001';

      const res = await request(app)
        .post('/v1/analytics/query')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
        .send({ dimensions: ['platform'], metrics: ['post_count'] });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('QUERY_COST_EXCEEDED');
      expect(res.body.estimatedCost).toEqual(expect.any(Number));
      expect(res.body.budgetLimit).toBe(0.0001);
      expect(res.body.suggestedAdjustments).toEqual(expect.any(Array));
      expect(res.body.suggestedAdjustments.length).toBeGreaterThan(0);
    });

    it('QueryCostExceededError carries estimatedCost, budgetLimit, and suggestions', async () => {
      const tenant = await createTenantFixture(`T-17.4-gov2-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedPostForTenant(tenant.id, 'twitter', 'neutral', new Date().toISOString());

      await expect(
        executeAdHocQuery(
          tenant.id,
          user.id,
          { dimensions: ['platform'], metrics: ['post_count'] },
          { maxEstimatedCost: 0.0001 }
        )
      ).rejects.toMatchObject({
        name: 'QueryCostExceededError',
        estimatedCost: expect.any(Number),
        budgetLimit: 0.0001,
      });
      await expect(
        executeAdHocQuery(
          tenant.id,
          user.id,
          { dimensions: ['platform'], metrics: ['post_count'] },
          { maxEstimatedCost: 0.0001 }
        )
      ).rejects.toBeInstanceOf(QueryCostExceededError);
    });
  });

  describe('AC3/AC4: transactional safeguards and row cap', () => {
    it('applies statement_timeout=3000ms and work_mem=32MB inside the governed transaction (real session readback)', async () => {
      const tenant = await createTenantFixture(`T-17.4-sess-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });
      await seedPostForTenant(tenant.id, 'twitter', 'positive', new Date().toISOString());

      const res = await request(app)
        .post('/v1/analytics/query')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
        .send({ dimensions: ['platform'], metrics: ['post_count'] });

      expect(res.status).toBe(200);
      // Postgres normalizes '3000ms' to '3s' and '32MB' may surface as '32768kB'.
      expect(['3000ms', '3s']).toContain(res.body.governor.appliedSettings.statement_timeout);
      expect(['32MB', '32768kB']).toContain(res.body.governor.appliedSettings.work_mem);
    });

    it('hard-caps the LIMIT bind at 5,000 rows regardless of the requested limit', () => {
      const compiled = compileAdHocQuery({
        dimensions: ['platform'],
        metrics: ['post_count'],
        limit: 999999,
      });
      const limitValue = compiled.params[compiled.params.length - 1];
      expect(limitValue).toBe(5000);
    });
  });

  describe('AC5: analytics role gating and tenant isolation', () => {
    it('permits tenant_admin and analyst; rejects roles without analytics permission; isolates tenant data', async () => {
      const tenant = await createTenantFixture(`T-17.4-roles-${randomUUID()}`);
      const otherTenant = await createTenantFixture(`T-17.4-other-${randomUUID()}`);
      const admin = await createInvitedUser(tenant.id, { email: `a-${randomUUID()}@example.com` });

      const today = new Date().toISOString();
      await seedPostForTenant(tenant.id, 'twitter', 'positive', today);
      await seedPostForTenant(otherTenant.id, 'twitter', 'positive', today);

      const body = { dimensions: ['platform'], metrics: ['post_count'] };

      const adminRes = await request(app)
        .post('/v1/analytics/query')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
        .send(body);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.rowCount).toBe(1); // own tenant's single post only

      const analystRes = await request(app)
        .post('/v1/analytics/query')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'analyst' }))
        .send(body);
      expect(analystRes.status).toBe(200);

      const deniedRes = await request(app)
        .post('/v1/analytics/query')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'field_technician' }))
        .send(body);
      expect(deniedRes.status).toBe(403);
    });
  });
});
