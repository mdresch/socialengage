// Contract: Story 4.3 (ADR-0009) — ConnectorHealth derived from IngestionRun
// history, never separately stored mutable state.
// See docs/user-stories/epic-4-derived-data-analytics-and-health.md#story-43--derived-connector-health-from-ingestionrun-history
//
// Intent: Story 4.3 — Derived connector health from IngestionRun history (ADR-0009)
// Scope: src/connectors/connectorHealth.ts (deriveConnectorHealth),
// migrations/0007_add_platform_credentials_status.sql
// Contract to encode: (1) no connector_health (or equivalent) table exists at all —
// there is nothing to write to, so "no separate health-table writes" is true by
// construction; (2) the four derivation rules — disconnected (no runs),
// healthy (no recent failures), degraded (recent failures + a recent success),
// failing (enough recent failures to cross the connector-level threshold) — each
// verified by manually inserting a known IngestionRun sequence via the sanctioned
// store functions, no other writes; (3) credentialStatus is read from
// platform_credentials.status directly, independent of run history (an expired
// credential reads as 'expired' even when the run-derived status is otherwise
// healthy).
// Explicitly out of scope: the read-through cache (Story 4.4, ADR-0022, accepted
// 2026-07-29, not yet built); the exact rate/floor/ceiling numbers of the
// `failing` rule (Story 2.5's own contract owns those specifics); auto-disable
// *behavior* built on top of this derivation (Story 2.3's own contract, which
// consumes deriveConnectorHealth via shouldAttemptIngestion rather than
// re-deriving health itself).
//
// 2026-07-30 (dated note, ADR-0023): the `failing` derivation rule changed from a
// flat "≥10 failures/hour" placeholder to a rate-relative rule (see ADR-0009's
// "Supersession update" note) — this is the one thing ADR-0023 changes;
// degraded/disconnected/healthy and credentialStatus are unaffected. AC2's
// "failing" test below still uses 10 pure failures and its assertion is
// unchanged: 10/10 attempts is 100% failure with 10 attempts, which trivially
// clears the new rule's 50%-rate/5-attempt-floor too, just for a different
// underlying reason than before. It is a superset case, not a test of the new
// rule's exact boundary — that precision lives in Story 2.5's own contract.

import { randomUUID } from 'crypto';
import { getPool, closePool } from '../../src/db/pool';
import { deriveConnectorHealth } from '../../src/connectors/connectorHealth';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { withTenant } from '../../src/db/withTenant';

jest.setTimeout(20000);

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
  await closePool();
});

const platformId = 'example-poll';

async function recordRun(
  tenantId: string,
  status: 'succeeded' | 'failed',
  errorSummary?: string
): Promise<void> {
  const run = await startIngestionRun(tenantId, {
    platformId,
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  await completeIngestionRun(tenantId, run.id, {
    status,
    postsIngested: status === 'succeeded' ? 1 : 0,
    postsSkipped: 0,
    errorSummary,
  });
}

describe('Story 4.3 — derived ConnectorHealth contract', () => {
  it('AC1: no connector_health table exists — nothing to write to, by construction', async () => {
    const { rows } = await getPool().query(
      `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%connector_health%'`
    );
    expect(rows).toHaveLength(0);
  });

  it('AC2: disconnected — zero recorded runs', async () => {
    const tenantId = randomUUID();
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('disconnected');
    expect(health.lastAttemptAt).toBeNull();
  });

  it('AC2: healthy — a successful run, no recent failures', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('healthy');
    expect(health.lastSuccessfulFetchAt).toBeTruthy();
  });

  it('AC2: degraded — recent failures, but a successful run within the last hour', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'failed', 'blip 1');
    await recordRun(tenantId, 'succeeded');
    await recordRun(tenantId, 'failed', 'blip 2');
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('degraded');
  });

  it('AC2: failing — enough recent failures to cross the connector-level threshold (10/10 clears Story 2.5\'s rate+floor rule, a superset case — see this file\'s dated ADR-0023 note)', async () => {
    const tenantId = randomUUID();
    for (let i = 0; i < 10; i++) {
      await recordRun(tenantId, 'failed', `failure ${i}`);
    }
    const health = await deriveConnectorHealth(tenantId, platformId);
    expect(health.status).toBe('failing');
  });

  it('AC3: credentialStatus is read from platform_credentials directly, independent of run history', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded'); // otherwise-healthy run history

    // No credential stored yet: credentialStatus is null, run-derived status unaffected.
    const beforeCredential = await deriveConnectorHealth(tenantId, platformId);
    expect(beforeCredential.status).toBe('healthy');
    expect(beforeCredential.credentialStatus).toBeNull();

    const { id: credentialId } = await storeCredential(tenantId, platformId, 'dummy-secret', testKeyId);
    await withTenant(tenantId, async (client) => {
      await client.query(`UPDATE platform_credentials SET status = 'expired' WHERE id = $1`, [credentialId]);
    });

    const afterCredential = await deriveConnectorHealth(tenantId, platformId);
    expect(afterCredential.credentialStatus).toBe('expired');
    // Run-derived status is untouched by the credential's status — they're independent axes.
    expect(afterCredential.status).toBe('healthy');
  });
});
