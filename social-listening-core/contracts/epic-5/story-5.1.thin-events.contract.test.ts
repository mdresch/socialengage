// Contract: Story 5.1 (ADR-0012) — thin SocialPostIngestedEvent/
// ConnectorHealthChangedEvent shapes + GET /v1/posts/:id for on-demand full fetch.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-51--thin-ingestion-events-with-rest-fetch-on-demand
//
// Intent: Story 5.1 — Thin ingestion events with REST fetch on demand (ADR-0012)
// Scope: src/events/socialPostIngestedEvent.ts, src/events/connectorHealthChangedEvent.ts,
// src/posts/socialPostStore.ts (getSocialPostById), src/http/versions/v1/postsRouter.ts
// Contract to encode: (1) buildSocialPostIngestedEvent() returns exactly
// tenantId/postId/platformId/watchlistId/sentiment/publishedAt/occurredAt — no
// post text, engagement metrics, or raw payload, even if such extra data is
// passed in; (2) buildConnectorHealthChangedEvent() returns exactly
// previousStatus/newStatus/tenantId/platformId/occurredAt; (3) GET
// /v1/posts/:id returns full post data (rawPayload, enrichment, publishedAt,
// authorId, acquisitionId, postGeoLocation) for a postId, tenant-scoped via
// the same X-Tenant-Id placeholder postsRouter already uses, 404s for an
// unknown id, and — via RLS — never returns another tenant's post even when
// queried by the right id.
// Explicitly out of scope: actually publishing either event to Azure Service
// Bus, or anything about delivery/filtering (Stories 5.2/5.5, ADR-0013/
// ADR-0019) — no Service Bus namespace is provisioned for this project yet,
// and ADR-0012's own text is about payload shape and REST-fetch-on-demand,
// not the transport. These builder functions are what a future publish step
// (once a namespace exists) would call to construct the message body from;
// that publish step itself is not built here.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { buildSocialPostIngestedEvent } from '../../src/events/socialPostIngestedEvent';
import { buildConnectorHealthChangedEvent } from '../../src/events/connectorHealthChangedEvent';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

describe('Story 5.1 — thin events + GET /v1/posts/:id contract', () => {
  it('AC1: buildSocialPostIngestedEvent() contains exactly the thin fields, no post text/engagement/raw payload', () => {
    const event = buildSocialPostIngestedEvent({
      tenantId: 'tenant-1',
      postId: 'post-1',
      platformId: 'example-poll',
      watchlistId: 'watchlist-1',
      sentiment: 'positive',
      publishedAt: '2026-01-01T00:00:00.000Z',
      occurredAt: '2026-01-01T00:05:00.000Z',
    });
    expect(Object.keys(event).sort()).toEqual(
      ['occurredAt', 'platformId', 'postId', 'publishedAt', 'sentiment', 'tenantId', 'watchlistId'].sort()
    );
    expect(event).not.toHaveProperty('rawPayload');
    expect(event).not.toHaveProperty('engagementMetrics');
    expect(event).not.toHaveProperty('text');
  });

  it('AC2: buildConnectorHealthChangedEvent() contains exactly the status-transition fields', () => {
    const event = buildConnectorHealthChangedEvent({
      tenantId: 'tenant-1',
      platformId: 'example-poll',
      previousStatus: 'healthy',
      newStatus: 'degraded',
      occurredAt: '2026-01-01T00:05:00.000Z',
    });
    expect(Object.keys(event).sort()).toEqual(
      ['newStatus', 'occurredAt', 'platformId', 'previousStatus', 'tenantId'].sort()
    );
  });

  it('AC3: GET /v1/posts/:id returns full post data for a known post, 404s for an unknown id', async () => {
    const app = createApp();
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const { id } = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { text: 'hello world' },
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      enrichment: { entities: ['acme'], keyPhrases: ['hello world'] },
    });

    const found = await request(app).get(`/v1/posts/${id}`).set('X-Tenant-Id', tenantId);
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(id);
    expect(found.body.rawPayload).toEqual({ text: 'hello world' });
    expect(found.body.enrichment).toEqual({ entities: ['acme'], keyPhrases: ['hello world'] });
    expect(found.body.publishedAt).toBe('2026-01-01T00:00:00.000Z');

    const notFound = await request(app).get(`/v1/posts/${randomUUID()}`).set('X-Tenant-Id', tenantId);
    expect(notFound.status).toBe(404);
  });

  it('AC3: GET /v1/posts/:id never returns another tenant\'s post, even by the right id (RLS)', async () => {
    const app = createApp();
    const ownerTenantId = randomUUID();
    const otherTenantId = randomUUID();
    const run = await startIngestionRun(ownerTenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const { id } = await insertSocialPost({
      tenantId: ownerTenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { text: 'owner only' },
    });

    const crossTenant = await request(app).get(`/v1/posts/${id}`).set('X-Tenant-Id', otherTenantId);
    expect(crossTenant.status).toBe(404);
  });
});
