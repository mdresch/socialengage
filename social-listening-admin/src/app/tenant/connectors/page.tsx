import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus } from '@/lib/core-client';
import { ConnectForm, type CredentialField } from './ConnectForm';
import { DisconnectButton } from './DisconnectButton';
import { ActivateDeactivateButton } from './ActivateDeactivateButton';

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
 *
 * Story 6.15 (ADR-0051) — every platform, including `authMode: 'none'`
 * ones, now calls `getConnectorStatus()` for real, since `isActive`
 * (Story 1.12) is the sole source of activation state; `authMode: 'none'`
 * no longer short-circuits to a hardcoded `connected: true` with no real
 * call at all.
 */
async function loadConnectorState(platform: PlatformDefinition) {
  try {
    const status = await getConnectorStatus(platform.id);
    const connected = platform.authMode === 'none' || status.credentialStatus !== null;
    return { platform, connected, credentialStatus: status.credentialStatus, isActive: status.isActive };
  } catch {
    return { platform, connected: false, credentialStatus: null as ConnectorState['credentialStatus'], isActive: false };
  }
}

interface ConnectorState {
  platform: PlatformDefinition;
  connected: boolean;
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked' | null;
  isActive: boolean;
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
          {states.map(({ platform, connected, credentialStatus, isActive }) => (
            <li key={platform.id}>
              <strong>{platform.name}</strong>{' '}
              {platform.authMode === 'none'
                ? 'No credential required'
                : connected
                  ? `Connected${credentialStatus ? ` (${credentialStatus})` : ''}`
                  : 'Not connected'}
              {' — '}
              {isActive ? 'Active' : 'Inactive'}
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
              {isTenantAdmin && (
                <ActivateDeactivateButton platformId={platform.id} ownerType="tenant" isActive={isActive} />
              )}
              {platform.authMode !== 'none' && (
                // Story 1.12 only exposes tenant-wide isActive — no
                // per-user read exists yet (named gap, ADR-0051), so this
                // control's own initial state is deliberately unknown
                // (assumed false) rather than reusing the tenant-wide
                // value, which would be actively misleading.
                <ActivateDeactivateButton platformId={platform.id} ownerType="user" isActive={false} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
