import { withTenant } from '../db/withTenant';
import { generateDataEncryptionKey, encryptWithDek, decryptWithDek } from '../credentials/envelopeEncryption';
import { wrapDek, unwrapDek } from '../credentials/keyVaultProvider';

export interface CRMCredentialInput {
  organizationUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  [key: string]: any;
}

export interface CRMCredentialRow {
  id: string;
  tenantId: string;
  crmConnectorId: string;
  createdAt: string;
  updatedAt: string;
}

interface RawCRMCredentialRow {
  id: string;
  tenant_id: string;
  crm_connector_id: string;
  wrapped_dek: Buffer;
  key_vault_key_id: string;
  iv: Buffer;
  auth_tag: Buffer;
  ciphertext: Buffer;
  created_at: Date;
  updated_at: Date;
}

function getKeyVaultKeyId(): string | undefined {
  return (
    process.env.KEY_VAULT_KEY_ID ||
    (process.env.NODE_ENV !== 'test' && process.env.KEY_VAULT_URI
      ? `${process.env.KEY_VAULT_URI.replace(/\/$/, '')}/keys/platform-credentials-dek-wrap`
      : undefined)
  );
}

export async function upsertCRMCredential(
  tenantId: string,
  crmConnectorId: string,
  config: CRMCredentialInput
): Promise<CRMCredentialRow> {
  const keyId = getKeyVaultKeyId();
  if (!keyId) {
    throw new Error('KEY_VAULT_KEY_ID or KEY_VAULT_URI must be configured to store CRM credentials.');
  }

  const plaintext = JSON.stringify(config);
  const dek = generateDataEncryptionKey();
  const { ciphertext, iv, authTag } = encryptWithDek(plaintext, dek);
  const wrappedDek = await wrapDek(keyId, dek);

  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawCRMCredentialRow>(
      `INSERT INTO crm_credentials
         (tenant_id, crm_connector_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, crm_connector_id)
       DO UPDATE SET
         wrapped_dek = EXCLUDED.wrapped_dek,
         key_vault_key_id = EXCLUDED.key_vault_key_id,
         iv = EXCLUDED.iv,
         auth_tag = EXCLUDED.auth_tag,
         ciphertext = EXCLUDED.ciphertext,
         updated_at = now()
       RETURNING *`,
      [tenantId, crmConnectorId, wrappedDek, keyId, iv, authTag, ciphertext]
    );
    return toCamel(rows[0]);
  });
}

export async function readCRMCredential(
  tenantId: string,
  crmConnectorId: string
): Promise<CRMCredentialInput | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawCRMCredentialRow>(
      `SELECT * FROM crm_credentials
       WHERE tenant_id = $1 AND crm_connector_id = $2`,
      [tenantId, crmConnectorId]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const dek = await unwrapDek(row.key_vault_key_id, row.wrapped_dek);
    const plaintext = decryptWithDek(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag },
      dek
    );
    return JSON.parse(plaintext) as CRMCredentialInput;
  });
}

export async function getCRMCredentialRow(
  tenantId: string,
  crmConnectorId: string
): Promise<CRMCredentialRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawCRMCredentialRow>(
      `SELECT id, tenant_id, crm_connector_id, created_at, updated_at
       FROM crm_credentials
       WHERE tenant_id = $1 AND crm_connector_id = $2`,
      [tenantId, crmConnectorId]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

export async function deleteCRMCredential(tenantId: string, crmConnectorId: string): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `DELETE FROM crm_credentials WHERE tenant_id = $1 AND crm_connector_id = $2`,
      [tenantId, crmConnectorId]
    );
  });
}

function toCamel(row: RawCRMCredentialRow): CRMCredentialRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    crmConnectorId: row.crm_connector_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
