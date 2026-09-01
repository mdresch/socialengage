import { CryptographyClient, KeyClient } from '@azure/keyvault-keys';
import { DefaultAzureCredential } from '@azure/identity';

/** The key-wrap algorithm Microsoft recommends for WRAPKEY/UNWRAPKEY with RSA keys. */
const WRAP_ALGORITHM = 'RSA-OAEP-256';

function vaultUrl(): string {
  return process.env.KEY_VAULT_URI ?? 'https://sociallistening-kv.vault.azure.net/';
}

/**
 * DefaultAzureCredential's chain includes AzureCliCredential, so local dev/test just
 * needs `az login` already done — no separate local credential setup. In a real
 * deployment this same chain resolves to Managed Identity instead.
 */
function credential(): DefaultAzureCredential {
  return new DefaultAzureCredential();
}

export function getKeyClient(): KeyClient {
  return new KeyClient(vaultUrl(), credential());
}

export function getKeyVaultKeyId(): string | undefined {
  return (
    process.env.KEY_VAULT_KEY_ID ||
    (process.env.NODE_ENV !== 'test' && process.env.KEY_VAULT_URI
      ? `${process.env.KEY_VAULT_URI.replace(/\/$/, '')}/keys/platform-credentials-dek-wrap`
      : undefined)
  );
}

/** Envelope-encrypts a data-encryption key (DEK) under a Key Vault key. */
export async function wrapDek(keyId: string, dek: Buffer): Promise<Buffer> {
  const cryptoClient = new CryptographyClient(keyId, credential());
  const { result } = await cryptoClient.wrapKey(WRAP_ALGORITHM, dek);
  return Buffer.from(result);
}

/**
 * Reverses wrapDek. Throws if the Key Vault key is disabled, deleted, or otherwise
 * unusable — that failure IS the envelope-encryption guarantee (Story 5.3 AC3), not
 * an error to work around.
 */
export async function unwrapDek(keyId: string, wrappedDek: Buffer): Promise<Buffer> {
  const cryptoClient = new CryptographyClient(keyId, credential());
  const { result } = await cryptoClient.unwrapKey(WRAP_ALGORITHM, wrappedDek);
  return Buffer.from(result);
}
