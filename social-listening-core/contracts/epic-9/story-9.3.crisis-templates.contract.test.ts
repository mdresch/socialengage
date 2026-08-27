// Contract: Story 9.3 (ADR-0079, BRD-0079, FDD-0079) — Crisis Template Bundle & Activation (Backend)
// See docs/user-stories/epic-9-adr-0077-to-0085.md#story-93

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool, getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { deleteWatchlist } from '../../src/watchlists/watchlistStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

/** Helper: create a real tenant via platform_admin_role pool for test fixtures. */
async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 9.3 — Crisis Template Bundle & Activation Contract', () => {
  const app = createApp();

  it('AC1/AC3: GET /v1/crisis-templates returns 200 with seeded active templates and preview data', async () => {
    const tenant = await createTenantFixture(`T-9.3-list-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
    const res = await request(app)
      .get('/v1/crisis-templates')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(5);

    const brandCrisis = res.body.templates.find((t: any) => t.templateKey === 'brand-crisis');
    expect(brandCrisis).toBeDefined();
    expect(brandCrisis).toMatchObject({
      name: 'Brand Crisis & Controversy',
      defaultQuery: expect.stringContaining('{{brand_name}}'),
      defaultThresholds: expect.objectContaining({
        volume_spike_pct: 50,
        negative_sentiment_pct: 60,
      }),
      parameters: expect.arrayContaining([
        expect.objectContaining({ key: 'brand_name', required: true }),
      ]),
      playbook: expect.arrayContaining([
        expect.objectContaining({ step: 1, owner: 'PR Lead' }),
      ]),
    });
  });

  it('AC2: GET /v1/crisis-templates/:templateKey returns 200 for existing key and 404 for unknown key', async () => {
    const tenant = await createTenantFixture(`T-9.3-get-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
    const resSuccess = await request(app)
      .get('/v1/crisis-templates/data-breach')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.templateKey).toBe('data-breach');
    expect(resSuccess.body.name).toBe('Data Breach & Security Incident');

    const resNotFound = await request(app)
      .get('/v1/crisis-templates/non-existent-template')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(resNotFound.status).toBe(404);
  });

  it('AC4/AC5: POST /v1/crisis-templates/:templateKey/activate rejects when required variables or notificationChannelIds are missing', async () => {
    const tenant = await createTenantFixture(`T-9.3-val-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // 1. Missing required variable 'brand_name' for 'brand-crisis'
    const resMissingVar = await request(app)
      .post('/v1/crisis-templates/brand-crisis/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
      .send({
        variables: {},
        notificationChannelIds: ['channel-email-1'],
      });

    expect(resMissingVar.status).toBe(422);
    expect(resMissingVar.body.error).toContain('Missing required template parameter');

    // 2. Missing notificationChannelIds
    const resMissingChannels = await request(app)
      .post('/v1/crisis-templates/brand-crisis/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
      .send({
        variables: { brand_name: 'Acme Corp' },
        notificationChannelIds: [],
      });

    expect(resMissingChannels.status).toBe(422);
    expect(resMissingChannels.body.error).toContain('notification channel destination');
  });

  it('AC4/AC6/AC7: POST /v1/crisis-templates/:templateKey/activate successfully activates template and creates watchlist + activation row', async () => {
    const tenant = await createTenantFixture(`T-9.3-act-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

    const activationPayload = {
      name: 'Custom Acme Brand Protection',
      variables: { brand_name: 'Acme' },
      customThresholds: {
        volumeSpikePct: 75,
        negativeSentimentPct: 80,
        timeWindowMinutes: 45,
      },
      notificationChannelIds: ['webhook-slack-alerts', 'email-pr-lead'],
    };

    const res = await request(app)
      .post('/v1/crisis-templates/brand-crisis/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
      .send(activationPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'active',
      watchlistId: expect.any(String),
      tenantCrisisTemplateId: expect.any(String),
      playbook: expect.any(Array),
      thresholds: expect.objectContaining({
        volumeSpikePct: 75,
        negativeSentimentPct: 80,
        timeWindowMinutes: 45,
      }),
      notificationChannelIds: ['webhook-slack-alerts', 'email-pr-lead'],
    });

    const { watchlistId, tenantCrisisTemplateId } = res.body;

    // Verify watchlist was created with interpolated boolean query
    await withTenant(
      tenant.id,
      async (client) => {
        const wRes = await client.query('SELECT * FROM watchlists WHERE id = $1', [watchlistId]);
        expect(wRes.rows).toHaveLength(1);
        const wl = wRes.rows[0];
        expect(wl.name).toBe('Custom Acme Brand Protection');
        expect(wl.boolean_query).toContain('Acme AND (boycott OR scandal');
        expect(wl.boolean_query).not.toContain('{{brand_name}}');

        // Verify tenant_crisis_templates record
        const tRes = await client.query('SELECT * FROM tenant_crisis_templates WHERE id = $1', [tenantCrisisTemplateId]);
        expect(tRes.rows).toHaveLength(1);
        const row = tRes.rows[0];
        expect(row.watchlist_id).toBe(watchlistId);
        expect(row.template_key).toBe('brand-crisis');
        expect(row.variables).toEqual({ brand_name: 'Acme' });
        expect(row.notification_channel_ids).toEqual(['webhook-slack-alerts', 'email-pr-lead']);
        expect(row.created_by_user_id).toBe(user.id);
      },
      getPool(),
      user.id
    );
  });

  it('AC10: deleting the generated watchlist cascades and deletes the tenant_crisis_templates record', async () => {
    const tenant = await createTenantFixture(`T-9.3-cascade-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `ops-${randomUUID()}@example.com` });

    // Activate
    const res = await request(app)
      .post('/v1/crisis-templates/product-recall/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
      .send({
        variables: { brand_name: 'Gizmo' },
        notificationChannelIds: ['email-ops-team'],
      });

    expect(res.status).toBe(201);
    const { watchlistId, tenantCrisisTemplateId } = res.body;

    // Delete watchlist
    const deleted = await deleteWatchlist(tenant.id, user.id, watchlistId);
    expect(deleted).toBe(true);

    // Verify tenant_crisis_templates record was cascaded
    await withTenant(tenant.id, async (client) => {
      const tRes = await client.query('SELECT * FROM tenant_crisis_templates WHERE id = $1', [tenantCrisisTemplateId]);
      expect(tRes.rows).toHaveLength(0);
    });
  });

  it('AC11: Multi-tenant RLS isolation prevents cross-tenant access to activation records', async () => {
    const tenantA = await createTenantFixture(`T-9.3-rlsA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-9.3-rlsB-${randomUUID()}`);
    const userA = await createInvitedUser(tenantA.id, { email: `admin-${randomUUID()}@tenantA.com` });

    const resA = await request(app)
      .post('/v1/crisis-templates/data-breach/activate')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id, { userId: userA.id, role: 'tenant_admin' }))
      .send({
        variables: { brand_name: 'TenantA Brand' },
        notificationChannelIds: ['channel-tenant-a'],
      });

    expect(resA.status).toBe(201);
    const { tenantCrisisTemplateId } = resA.body;

    // Tenant B queries tenant_crisis_templates under their own RLS context
    await withTenant(tenantB.id, async (client) => {
      const bRes = await client.query('SELECT * FROM tenant_crisis_templates WHERE id = $1', [tenantCrisisTemplateId]);
      expect(bRes.rows).toHaveLength(0);
    });
  });
});
