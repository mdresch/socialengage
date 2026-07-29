import { withTenant } from '../db/withTenant';
import { generateDataEncryptionKey, encryptWithDek, decryptWithDek } from './envelopeEncryption';
import { wrapDek, unwrapDek } from './keyVaultProvider';

export interface StoredCredential {
  id: string;
}

/**
 * Envelope-encrypts `plaintext` (an OAuth token or API key) and stores it: a fresh
 * per-credential DEK encrypts the value locally (AES-256-GCM), and the DEK itself is
 * wrapped by the given Key Vault key — the plaintext and the unwrapped DEK never
 * touch storage or a log line. See
 * .claude/skills/credential-envelope-encryption/SKILL.md.
 */
export async function storeCredential(
  tenantId: string,
  platformId: string,
  plaintext: string,
  keyVaultKeyId: string
): Promise<StoredCredential> {
  const dek = generateDataEncryptionKey();
  const { ciphertext, iv, authTag } = encryptWithDek(plaintext, dek);
  const wrappedDek = await wrapDek(keyVaultKeyId, dek);

  const id = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO platform_credentials
         (tenant_id, platform_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [tenantId, platformId, wrappedDek, keyVaultKeyId, iv, authTag, ciphertext]
    );
    return rows[0].id;
  });

  return { id };
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
