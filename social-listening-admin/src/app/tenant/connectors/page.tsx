import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus } from '@/lib/core-client';
import { ConnectForm, type CredentialField } from './ConnectForm';
import { DisconnectButton } from './DisconnectButton';

interface PlatformDefinition {
  id: string;
  name: string;
  authMode: 'api_key' | 'none';
  credentialFields?: CredentialField[];
}

/**
 * Story 6.3 (healed 2026-08-10) — the real, shipped connectors as of this
 * pass. `newswire` is `authMode: 'none'` (ADR-0024) — no credential exists
 * to submit, so it renders as always-active with no connect/disconnect
 * action. Adding a fifth connector here later is additive: one more entry
 * in this array, no other file needs to change (mirrors
 * `azure-openai-connector/SKILL.md`'s own "adding a third provider" guidance
 * on the core side).
 */
const PLATFORMS: PlatformDefinition[] = [
  { id: 'gnews', name: 'GNews', authMode: 'api_key', credentialFields: [{ key: 'apiKey', label: 'API key' }] },
  { id: 'newswire', name: 'Newswire', authMode: 'none' },
  {
    id: 'azure-ai-language',
    name: 'Azure AI Language',
    authMode: 'api_key',
    credentialFields: [
      { key: 'endpoint', label: 'Endpoint' },
      { key: 'key', label: 'Key' },
    ],
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI Service',
    authMode: 'api_key',
    credentialFields: [
      { key: 'endpoint', label: 'Endpoint' },
      { key: 'key', label: 'Key' },
      { key: 'deployment', label: 'Deployment name' },
    ],
  },
];

/**
 * Story 6.3 (healed 2026-08-10) — each platform's connection state is a
 * real `getConnectorStatus()` call (`GET /v1/connectors/:platformId`),
 * derived as `credentialStatus !== null` — the same derivation
 * `deriveConnectorHealth()` itself uses server-side (ADR-0009). A failed
 * status call degrades to "not connected" for that one platform, not a
 * failed page render — a transient core-side issue on one platform must not
 * block a tenant from seeing or acting on the others.
 */
async function loadConnectorState(platform: PlatformDefinition) {
  if (platform.authMode === 'none') {
    return { platform, connected: true, credentialStatus: null as ConnectorState['credentialStatus'] };
  }
  try {
    const status = await getConnectorStatus(platform.id);
    return { platform, connected: status.credentialStatus !== null, credentialStatus: status.credentialStatus };
  } catch {
    return { platform, connected: false, credentialStatus: null as ConnectorState['credentialStatus'] };
  }
}

interface ConnectorState {
  platform: PlatformDefinition;
  connected: boolean;
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked' | null;
}

export default async function ConnectorsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';

  const states: ConnectorState[] = await Promise.all(PLATFORMS.map(loadConnectorState));

  return (
    <main>
      <h1>Connect a platform</h1>
      <p>
        Before you submit a credential, please confirm that you are creating your own account or API key directly with the provider under that provider&apos;s own terms. This is not a SocialEngage-managed signup and SocialEngage is not the billing intermediary for the provider terms.
      </p>
      <section>
        <h2>Available connectors</h2>
        <ul>
          {states.map(({ platform, connected, credentialStatus }) => (
            <li key={platform.id}>
              <strong>{platform.name}</strong>{' '}
              {platform.authMode === 'none'
                ? 'Active (no credential required)'
                : connected
                  ? `Connected${credentialStatus ? ` (${credentialStatus})` : ''}`
                  : 'Not connected'}
              {platform.authMode === 'api_key' && !connected && (
                <ConnectForm
                  platformId={platform.id}
                  fields={platform.credentialFields ?? []}
                  allowTenantWide={isTenantAdmin}
                />
              )}
              {platform.authMode === 'api_key' && connected && (
                <DisconnectButton platformId={platform.id} ownerType={isTenantAdmin ? 'tenant' : 'user'} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
