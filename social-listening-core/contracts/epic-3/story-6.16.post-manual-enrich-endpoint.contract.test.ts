/**
 * Contract: Story 6.16 — Manual "run enrichment now" endpoint.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-616--manual-run-enrichment-now-button-on-the-post-detail-screen
 *
 * Intent: Story 6.16 (backend half) — POST /v1/posts/:id/enrich
 * Scope: src/http/versions/v1/postsRouter.ts (extended — new route),
 *   src/posts/socialPostStore.ts (extended — deriveEnrichmentText(),
 *   setPostEnrichment()).
 * Contract to encode: a tenant-scoped POST /v1/posts/:id/enrich derives the
 *   post's enrichment text from its own real, stored rawPayload the same
 *   way GNews's/Newswire's own ingest functions already do (title, plus
 *   description when present — a single rule that already covers both real
 *   shapes without branching on providerId, confirmed directly against
 *   pollGNewsSearch.ts's own `[title, description].filter(Boolean).join('. ')`
 *   and pollNewswireFeeds.ts's own bare `item.title`), calls the real,
 *   unchanged enrichPost() (Story 2.8/2.9), and persists a real result onto
 *   the post's own enrichment column; 404s for an unknown/cross-tenant id
 *   (RLS), matching GET /v1/posts/:id's own existing behavior exactly;
 *   enrichPost() resolving to undefined (no AI provider currently
 *   credentialed and active) is a real, honest 200 with enrichment still
 *   null, never an error status.
 *
 * Real infrastructure used: the same real, dedicated Azure AI Language
 * test-fixture credential (AZURE_AI_LANGUAGE_ENDPOINT/KEY) Story 2.8/2.9's
 * own contracts already use — a real API call proves this endpoint reaches
 * the real, unmodified enrichPost() path, not a mock standing in for it.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving enrichPost()'s own provider-selection/activation-gating
 *     logic (Story 2.9's own contract already proves that exhaustively);
 *     this contract only proves the new route calls it correctly with the
 *     right derived text and persists/returns what it gets back.
 *   - Re-enrichment of an already-enriched post (Story 6.16's own AC —
 *     the admin UI never offers the button for one; this endpoint itself
 *     has no such restriction baked in structurally, since a tenant
 *     calling it directly via the real API is a legitimate "I want this
 *     specific post re-run" case the backend has no reason to forbid —
 *     the UI-side gate is a UX choice, not a security boundary, per this
 *     project's own established ADR-0036 §4/ADR-0041 pattern).
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { AZURE_AI_LANGUAGE_PROVIDER_ID } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';

jest.setTimeout(30000);

const REAL_LANGUAGE_ENDPOINT = process.env.AZURE_AI_LANGUAGE_ENDPOINT as string;
const REAL_LANGUAGE_KEY = process.env.AZURE_AI_LANGUAGE_KEY as string;

if (!REAL_LANGUAGE_ENDPOINT || !REAL_LANGUAGE_KEY) {
  throw new Error('AZURE_AI_LANGUAGE_ENDPOINT/AZURE_AI_LANGUAGE_KEY must be set (see .env) — this contract requires the real resource.');
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

async function seedRealAzureAiLanguageCredential(tenantId: string): Promise<void> {
  await storeCredential(
    tenantId,
    AZURE_AI_LANGUAGE_PROVIDER_ID,
    JSON.stringify({ endpoint: REAL_LANGUAGE_ENDPOINT, key: REAL_LANGUAGE_KEY }),
    testKeyId,
    'tenant'
  );
  await setConnectorActivation(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, 'tenant', true);
}

describe('Story 6.16 — POST /v1/posts/:id/enrich', () => {
  it('AC1/AC4 (real call): derives text from a GNews-shaped rawPayload (title+description), calls the real enrichPost(), and persists the result', async () => {
    const app = createApp();
    const tenantId = await createTenantFixture(`Enrich-GNews-${randomUUID()}`);
    await seedRealAzureAiLanguageCredential(tenantId);
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });
    const { id } = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: {
        providerId: 'gnews',
        title: 'AcmeCorp announces strong quarterly earnings',
        description: 'The company reported a tremendous quarter, delighting investors across Europe.',
      },
    });

    const res = await request(app).post(`/v1/posts/${id}/enrich`).set('X-Test-Identity', testIdentityHeaderValue(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.enrichment).toBeTruthy();
    expect(['positive', 'neutral', 'negative', 'mixed']).toContain(res.body.enrichment.sentiment);
    expect(res.body.enrichment.modelUsed).toContain('azure-ai-language');

    const rows = await withTenant(tenantId, (client) =>
      client.query<{ enrichment: { sentiment: string } }>(`SELECT enrichment FROM social_posts WHERE id = $1`, [id])
    );
    expect(rows.rows[0].enrichment.sentiment).toBe(res.body.enrichment.sentiment);
  });

  it('AC1 (real call): derives text from a Newswire-shaped rawPayload (title only, no description field)', async () => {
    const app = createApp();
    const tenantId = await createTenantFixture(`Enrich-Newswire-${randomUUID()}`);
    await seedRealAzureAiLanguageCredential(tenantId);
    const run = await startIngestionRun(tenantId, { platformId: 'newswire', triggerType: 'poll', connectorVersion: '1.0.0' });
    const { id } = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'newswire', title: 'GlobalTech reports positive expansion into new markets', link: 'https://example.com/x' },
    });

    const res = await request(app).post(`/v1/posts/${id}/enrich`).set('X-Test-Identity', testIdentityHeaderValue(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.enrichment).toBeTruthy();
    expect(res.body.enrichment.modelUsed).toContain('azure-ai-language');
  });

  it('AC2: 404s for an unknown post id', async () => {
    const app = createApp();
    const tenantId = await createTenantFixture(`Enrich-Unknown-${randomUUID()}`);

    const res = await request(app)
      .post(`/v1/posts/${randomUUID()}/enrich`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId));

    expect(res.status).toBe(404);
  });

  it('AC2: never enriches another tenant\'s post, even by the right id (RLS) — 404, not a cross-tenant leak', async () => {
    const app = createApp();
    const ownerTenantId = await createTenantFixture(`Enrich-Owner-${randomUUID()}`);
    const otherTenantId = await createTenantFixture(`Enrich-Other-${randomUUID()}`);
    const run = await startIngestionRun(ownerTenantId, { platformId: 'newswire', triggerType: 'poll', connectorVersion: '1.0.0' });
    const { id } = await insertSocialPost({
      tenantId: ownerTenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'newswire', title: 'Owner-only post' },
    });

    const res = await request(app)
      .post(`/v1/posts/${id}/enrich`)
      .set('X-Test-Identity', testIdentityHeaderValue(otherTenantId));

    expect(res.status).toBe(404);
  });

  it('AC3: enrichPost() resolving to undefined (no AI provider connected) is a real 200 with enrichment still null, never an error', async () => {
    const app = createApp();
    const tenantId = await createTenantFixture(`Enrich-NoProvider-${randomUUID()}`);
    // Deliberately no credential, no activation — the real "nothing is
    // connected" case.
    const run = await startIngestionRun(tenantId, { platformId: 'newswire', triggerType: 'poll', connectorVersion: '1.0.0' });
    const { id } = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { providerId: 'newswire', title: 'A post with no connected AI provider' },
    });

    const res = await request(app).post(`/v1/posts/${id}/enrich`).set('X-Test-Identity', testIdentityHeaderValue(tenantId));

    expect(res.status).toBe(200);
    expect(res.body.enrichment).toBeNull();

    const rows = await withTenant(tenantId, (client) =>
      client.query<{ enrichment: unknown }>(`SELECT enrichment FROM social_posts WHERE id = $1`, [id])
    );
    expect(rows.rows[0].enrichment).toBeNull();
  });
});
