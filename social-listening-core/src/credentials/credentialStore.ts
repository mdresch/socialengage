import { withTenant } from '../db/withTenant';
import { generateDataEncryptionKey, encryptWithDek, decryptWithDek } from './envelopeEncryption';
import { wrapDek, unwrapDek } from './keyVaultProvider';

export interface StoredCredential {
  id: string;
}

export type CredentialOwnerType = 'tenant' | 'user';

/**
 * Envelope-encrypts `plaintext` (an OAuth token or API key) and stores it: a fresh
 * per-credential DEK encrypts the value locally (AES-256-GCM), and the DEK itself is
 * wrapped by the given Key Vault key — the plaintext and the unwrapped DEK never
 * touch storage or a log line. See
 * .claude/skills/credential-envelope-encryption/SKILL.md.
 *
 * `ownerType`/`userId` (Story 1.7, ADR-0034) default to `'tenant'`/`undefined` —
 * deliberately backward-compatible so pre-ownership-tier callers (Stories
 * 5.3/2.7/4.3) keep working unchanged. Authorization for who may pass
 * `ownerType: 'user'` and which `userId` is used lives in the caller
 * (connectorsRouter.ts), never here — see
 * .claude/skills/connector-connect-disconnect/SKILL.md.
 */
export async function storeCredential(
  tenantId: string,
  platformId: string,
  plaintext: string,
  keyVaultKeyId: string,
  ownerType: CredentialOwnerType = 'tenant',
  userId?: string
): Promise<StoredCredential> {
  const dek = generateDataEncryptionKey();
  const { ciphertext, iv, authTag } = encryptWithDek(plaintext, dek);
  const wrappedDek = await wrapDek(keyVaultKeyId, dek);

  const id = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO platform_credentials
         (tenant_id, platform_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext, owner_type, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [tenantId, platformId, wrappedDek, keyVaultKeyId, iv, authTag, ciphertext, ownerType, userId ?? null]
    );
    return rows[0].id;
  });

  return { id };
}

/**
 * Most recently stored credential id for (tenantId, platformId, ownerType[, userId]),
 * or null if none registered. `ownerType` is required (Story 1.7, ADR-0034) —
 * once a tenant-wide and one or more user-bound credentials can coexist for
 * the same (tenant, platform), "most recently created" is no longer a safe
 * proxy without also knowing which owner's credential is wanted.
 */
export async function getLatestCredentialId(
  tenantId: string,
  platformId: string,
  ownerType: CredentialOwnerType,
  userId?: string
): Promise<string | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      ownerType === 'user'
        ? `SELECT id FROM platform_credentials
           WHERE platform_id = $1 AND owner_type = 'user' AND user_id = $2
           ORDER BY created_at DESC LIMIT 1`
        : `SELECT id FROM platform_credentials
           WHERE platform_id = $1 AND owner_type = 'tenant'
           ORDER BY created_at DESC LIMIT 1`,
      ownerType === 'user' ? [platformId, userId] : [platformId]
    );
    return rows.length > 0 ? rows[0].id : null;
  });
}

/** Unwraps the DEK via Key Vault, then decrypts. Throws if the wrapping key is unusable. */
export async function readCredential(tenantId: string, credentialId: string): Promise<string> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext
       FROM platform_credentials WHERE id = $1`,
      [credentialId]
    );
    if (rows.length === 0) {
      throw new Error('Credential not found (or not visible to this tenant).');
    }

    const row = rows[0];
    const dek = await unwrapDek(row.key_vault_key_id, row.wrapped_dek);
    return decryptWithDek(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag },
      dek
    );
  });
}

/**
 * Deletes the credential matching (tenantId, platformId, ownerType[, userId])
 * — scoped, never a blanket delete of every credential for a (tenant,
 * platform) pair. Story 1.7 (ADR-0034) reworked this from an indiscriminate
 * (tenantId, platformId) delete, which would otherwise let an ordinary
 * tenant-wide disconnect silently destroy an unrelated user's personal
 * credential for the same platform once Tier 3 credentials exist — see
 * .claude/skills/connector-connect-disconnect/SKILL.md's own "Load-bearing
 * constraints".
 */
export async function deleteCredential(
  tenantId: string,
  platformId: string,
  ownerType: CredentialOwnerType,
  userId?: string
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    if (ownerType === 'user') {
      await client.query(
        `DELETE FROM platform_credentials
         WHERE tenant_id = $1 AND platform_id = $2 AND owner_type = 'user' AND user_id = $3`,
        [tenantId, platformId, userId]
      );
    } else {
      await client.query(
        `DELETE FROM platform_credentials
         WHERE tenant_id = $1 AND platform_id = $2 AND owner_type = 'tenant'`,
        [tenantId, platformId]
      );
    }
  });
}

/**
 * Story 6.27 (ADR-0060 Decision §2) — deletes exactly one row by its own
 * primary key, tenant-scoped via `withTenant()` like every other function
 * in this file. A new, narrowly-scoped, additive function — Facebook's own
 * per-Page disconnect path (`facebookPagesRouter.ts`) calls this, never the
 * existing tuple-scoped `deleteCredential()`, which would delete every
 * credential row matching the 4-tuple (a real latent gap found while
 * designing multi-Page support: today, before this function existed,
 * disconnecting one Page would have destroyed every other Page's own
 * credential too). `getLatestCredentialId()`/`deleteCredential()` above are
 * completely unchanged by this addition — every other caller (GNews's
 * connect/disconnect, tenant-wide credential flows generally) is
 * unaffected.
 */
export async function deleteCredentialById(tenantId: string, credentialId: string): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(`DELETE FROM platform_credentials WHERE tenant_id = $1 AND id = $2`, [tenantId, credentialId]);
  });
}
