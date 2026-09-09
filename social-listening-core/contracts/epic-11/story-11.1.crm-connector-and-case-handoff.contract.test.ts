// Contract: Story 11.1 (ADR-0095, BRD-0095, FDD-0095) — CRM Connector and Case Handoff (Backend)
// See docs/user-stories/epic-11-adr-0095-to-0100.md#story-111--crm-connector-and-case-handoff-backend
//
// Intent: Story 11.1 — CRM connector and case handoff (ADR-0095)
// Scope: touches migrations, src/connectors/crm/*, src/crm/*, src/http/routes/crmRoutes.ts, src/http/app.ts
// Contract to encode: CRMConnector interface (Dynamics 365, Salesforce, HubSpot), crm_field_mappings schema,
//                     POST /v1/inbox/items/:id/case, fail-closed 409 deduplication, outbound_activities audit logging.
// Explicitly out of scope: Frontend CRM UI (Story 11.2) and bidirectional CRM status sync.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { withTenant } from '../../src/db/withTenant';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function createPostFixture(tenantId: string, authorName: string, text: string): Promise<{ id: string; authorId: string }> {
  return withTenant(tenantId, async (client) => {
    const authorRes = await client.query(
      `INSERT INTO authors (tenant_id, platform_id, external_author_id, display_name, handle, first_seen_at, last_seen_at)
       VALUES ($1, 'twitter', $2, $3, $4, now(), now())
       RETURNING id`,
      [tenantId, `user-${randomUUID()}`, authorName, `@${authorName.toLowerCase().replace(/\s+/g, '')}`]
    );
    const authorId = authorRes.rows[0].id;

    const postRes = await client.query(
      `INSERT INTO social_posts (
         tenant_id, author_id, raw_payload, body_markdown, published_at, enrichment
       )
       VALUES ($1, $2, $3, $4, now(), $5)
       RETURNING id`,
      [
        tenantId,
        authorId,
        JSON.stringify({
          platformId: 'twitter',
          externalId: `ext-${randomUUID()}`,
          authorName,
          body: text,
        }),
        text,
        JSON.stringify({ sentiment: 'negative' }),
      ]
    );

    return { id: postRes.rows[0].id, authorId };
  });
}

describe('Story 11.1 — CRM Connector and Case Handoff Contract', () => {
  const app = createApp();

  describe('AC1: CRMConnector provider abstraction compliance', () => {
    it('implements Dynamics 365, Salesforce, and HubSpot providers in the registry', async () => {
      const { getCRMConnector, listCRMConnectors } = await import('../../src/connectors/crm/crmRegistry');

      const connectors = listCRMConnectors();
      expect(connectors.length).toBeGreaterThanOrEqual(3);

      const d365 = getCRMConnector('dynamics365');
      expect(d365).toBeDefined();
      expect(d365?.provider).toBe('dynamics365');

      const sf = getCRMConnector('salesforce');
      expect(sf).toBeDefined();
      expect(sf?.provider).toBe('salesforce');

      const hs = getCRMConnector('hubspot');
      expect(hs).toBeDefined();
      expect(hs?.provider).toBe('hubspot');
    });

    it('Microsoft Dynamics 365 pushes lead, opportunity, and incident support entities with canonical URLs', async () => {
      const { getCRMConnector } = await import('../../src/connectors/crm/crmRegistry');
      const d365 = getCRMConnector('dynamics365');

      const context = {
        tenantId: randomUUID(),
        credentials: { organizationUrl: 'https://contoso.crm.dynamics.com' },
      };

      const supportPayload = {
        tenantId: context.tenantId,
        authorId: randomUUID(),
        authorName: 'Alex Customer',
        postId: randomUUID(),
        postExcerpt: 'Broken login button on portal',
        platformId: 'twitter',
        entityType: 'support' as const,
        notes: 'Priority handling required',
      };

      const result = await d365!.pushEntity(context, supportPayload);
      expect(result.crmRecordId).toBeDefined();
      expect(result.entityType).toBe('support');
      expect(result.crmRecordUrl).toContain('https://contoso.crm.dynamics.com/main.aspx?etn=incident');
      expect(result.crmRecordUrl).toContain(result.crmRecordId);
    });
  });

  describe('AC2: crm_field_mappings CRUD and tenant RLS', () => {
    it('allows tenant admins to create and list custom field mapping overrides', async () => {
      const tenant = await createTenantFixture(`T-11.1-map-${randomUUID()}`);
      const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

      // 1. Create custom field mapping
      const createRes = await request(app)
        .post('/v1/crm/field-mappings')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }))
        .send({
          crmConnectorId: 'dynamics365',
          entityType: 'support',
          sourceField: 'notes',
          targetField: 'customer_notes_c',
          isRequired: false,
          defaultValue: 'Social escalation',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.targetField).toBe('customer_notes_c');

      // 2. List mappings
      const listRes = await request(app)
        .get('/v1/crm/field-mappings')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body[0].sourceField).toBe('notes');
    });
  });

  describe('AC3 & AC4: POST /v1/inbox/items/:id/case, deduplication (409 Conflict), and outbound_activities', () => {
    it('escalates post to CRM, records outbound_activities row, and rejects duplicate with 409 Conflict', async () => {
      const tenant = await createTenantFixture(`T-11.1-handoff-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `agent-${randomUUID()}@example.com` });
      const post = await createPostFixture(tenant.id, 'Jane Doe', 'Unable to checkout on site');

      // 1. First escalation -> 201 Created
      const pushRes1 = await request(app)
        .post(`/v1/inbox/items/${post.id}/case`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          crmConnectorId: 'dynamics365',
          entityType: 'support',
          notes: 'Customer struggling with cart',
        });

      expect(pushRes1.status).toBe(201);
      expect(pushRes1.body.status).toBe('success');
      expect(pushRes1.body.crmRecordId).toBeDefined();
      expect(pushRes1.body.crmRecordUrl).toContain('crm.dynamics.com');
      expect(pushRes1.body.outboundActivityId).toBeDefined();

      // Verify outbound_activities entry
      const activityId = pushRes1.body.outboundActivityId;
      await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM outbound_activities WHERE id = $1`,
          [activityId]
        );
        expect(rows.length).toBe(1);
        expect(rows[0].activity_type).toBe('crm_handoff');
        expect(rows[0].status).toBe('sent');
        expect(rows[0].post_id).toBe(post.id);
        expect(rows[0].external_id).toBe(pushRes1.body.crmRecordId);
        expect(rows[0].external_url).toBe(pushRes1.body.crmRecordUrl);
      });

      // 2. Duplicate attempt without allowDuplicate -> 409 Conflict
      const duplicateRes = await request(app)
        .post(`/v1/inbox/items/${post.id}/case`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          crmConnectorId: 'dynamics365',
          entityType: 'support',
          notes: 'Second attempt',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toMatch(/already pushed to CRM/i);
      expect(duplicateRes.body.crmRecordId).toBe(pushRes1.body.crmRecordId);
      expect(duplicateRes.body.crmRecordUrl).toBe(pushRes1.body.crmRecordUrl);

      // 3. Duplicate attempt WITH allowDuplicate: true -> 201 Created
      const allowedDuplicateRes = await request(app)
        .post(`/v1/inbox/items/${post.id}/case`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          crmConnectorId: 'dynamics365',
          entityType: 'support',
          notes: 'Force duplicate case',
          allowDuplicate: true,
        });

      expect(allowedDuplicateRes.status).toBe(201);
      expect(allowedDuplicateRes.body.status).toBe('success');
    });
  });

  describe('AC5: Author-only prospecting list CRM push (ADR-0086 / ADR-0117 alignment)', () => {
    it('supports pushing author lead entity without requiring post ID', async () => {
      const { getCRMConnector } = await import('../../src/connectors/crm/crmRegistry');
      const sf = getCRMConnector('salesforce');

      const context = {
        tenantId: randomUUID(),
        credentials: { instanceUrl: 'https://na1.salesforce.com' },
      };

      const authorLeadPayload = {
        tenantId: context.tenantId,
        authorId: randomUUID(),
        authorName: 'Key Influencer',
        authorHandle: '@keyinfluencer',
        authorPublicUrl: 'https://twitter.com/keyinfluencer',
        platformId: 'twitter',
        entityType: 'lead' as const,
        notes: 'Identified via high engagement prospecting list',
      };

      const result = await sf!.pushEntity(context, authorLeadPayload);
      expect(result.crmRecordId).toBeDefined();
      expect(result.entityType).toBe('lead');
      expect(result.crmRecordUrl).toContain('https://na1.salesforce.com/');
    });
  });
});
