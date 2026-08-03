// Contract: Story 5.3 (ADR-0014) — envelope-encrypted credential storage with OAuth-first auth.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-53--envelope-encrypted-credential-storage-with-oauth-first-auth
//
// Intent: Story 5.3 — Envelope-encrypted credential storage with OAuth-first auth (ADR-0014)
// Scope: migrations/0003_create_platform_credentials.sql, src/credentials/envelopeEncryption.ts,
// src/credentials/keyVaultProvider.ts, src/credentials/credentialStore.ts,
// src/credentials/platformAuth.ts
// Contract to encode: (1) a stored credential's row never contains the plaintext value
// anywhere, and storeCredential() never logs it to the console either; (2) connecting a
// platform that supports OAuth (X, LinkedIn, YouTube/Google, Meta) is offered OAuth, every
// other platform (e.g. RSS/newswire) only API-key entry; (3) disabling the Azure Key Vault
// key used to wrap a credential's data-encryption-key renders that credential unreadable,
// proving the envelope-encryption dependency on Key Vault is real, not cosmetic.
// Explicitly out of scope: an actual OAuth flow against any real platform's API (no
// connector exists yet — Phase 1 builds the first one, RSS/News, which is API-key-only
// anyway per spec §10; the OAuth-capable platforms aren't built until a later phase); Key
// Vault throttling/outage handling as a connector error-classification concern (ADR-0010,
// a future story); credential rotation/refresh (ADR-0010's automatic-refresh-before-fail
// behavior — a connector-level concern once a real OAuth connector exists).
//
// Requires a real Azure Key Vault reachable via `az login` (DefaultAzureCredential picks up
// the CLI session) — see .claude/skills/credential-envelope-encryption/SKILL.md.

import { randomUUID } from 'crypto';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { storeCredential, readCredential } from '../../src/credentials/credentialStore';
import { authMethodFor } from '../../src/credentials/platformAuth';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';

// Bumped from 30000, 2026-08-03, via heal-contract-failure during Story 1.7's
// own full-suite validation: AC3's real Key Vault key-disable/read-attempt
// round trip timed out at 30000ms under this session's cumulative real
// Key Vault load (unrelated to Story 1.7's own code — storeCredential()'s
// Key Vault interaction is unchanged; only its new, optional
// ownerType/userId parameters were added, not used by this file's calls).
// No assertion changed. See this component's own "Known gaps" for the
// fuller account.
jest.setTimeout(60000);

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

describe('Story 5.3 — envelope-encrypted credential storage contract', () => {
  it('AC1: a stored credential row never contains the plaintext anywhere', async () => {
    const tenantId = randomUUID();
    const plaintext = 'super-secret-oauth-token-abc123';

    const { id } = await storeCredential(tenantId, 'x', plaintext, testKeyId);

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM platform_credentials WHERE id = $1',
        [id]
      );
      return rows[0];
    });

    const serialized = JSON.stringify(row, (_key, value) =>
      Buffer.isBuffer(value) ? value.toString('base64') : value
    );
    expect(serialized).not.toContain(plaintext);

    const decrypted = await readCredential(tenantId, id);
    expect(decrypted).toBe(plaintext);
  });

  it('AC1: storeCredential never logs the plaintext to the console', async () => {
    const tenantId = randomUUID();
    const plaintext = 'another-secret-value-xyz789';
    const calls: string[] = [];
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map((method) =>
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        calls.push(args.map(String).join(' '));
      })
    );

    try {
      await storeCredential(tenantId, 'x', plaintext, testKeyId);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }

    expect(calls.join('\n')).not.toContain(plaintext);
  });

  it('AC2: OAuth-supporting platforms are offered OAuth; others get API-key entry only', () => {
    expect(authMethodFor('x')).toBe('oauth');
    expect(authMethodFor('linkedin')).toBe('oauth');
    expect(authMethodFor('youtube')).toBe('oauth');
    expect(authMethodFor('meta')).toBe('oauth');
    expect(authMethodFor('rss')).toBe('api_key');
  });

  it('AC3: disabling the Key Vault key renders the credential unreadable', async () => {
    const tenantId = randomUUID();
    const plaintext = 'revocation-test-secret';
    const { id } = await storeCredential(tenantId, 'x', plaintext, testKeyId);

    await expect(readCredential(tenantId, id)).resolves.toBe(plaintext);

    await getKeyClient().updateKeyProperties(testKeyName, { enabled: false });

    await expect(readCredential(tenantId, id)).rejects.toThrow();
  });
});
