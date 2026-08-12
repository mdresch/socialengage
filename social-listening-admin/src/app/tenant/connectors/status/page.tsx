import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus, type ConnectorStatus } from '@/lib/core-client';
import { ActivateDeactivateButton } from '../ActivateDeactivateButton';

interface PlatformDefinition {
  id: string;
  name: string;
  authMode: 'api_key' | 'none';
}

/**
 * Story 6.5 (reworked 2026-08-12) — mirrors Story 6.3's own connected-
 * platform list (tenant/connectors/page.tsx's own PLATFORMS array), per
 * this story's own AC1 "per Story 6.3's own state" instruction — pending a
 * real "list this tenant's connectors" core endpoint (named, not built, see
 * this component's own SKILL.md Known gaps). Deliberately duplicated here
 * rather than imported (a page component exports nothing to import) — the
 * same small, intentional duplication tenant/watchlists/page.tsx (Story 6.4)
 * already made and documented for its own narrower purpose.
 */
const PLATFORMS: PlatformDefinition[] = [
  { id: 'gnews', name: 'GNews', authMode: 'api_key' },
  { id: 'newswire', name: 'Newswire', authMode: 'none' },
  { id: 'azure-ai-language', name: 'Azure AI Language', authMode: 'api_key' },
  { id: 'azure-openai', name: 'Azure OpenAI Service', authMode: 'api_key' },
];

interface ConnectorStatusRow {
  platform: PlatformDefinition;
  isActive: boolean;
  health: ConnectorStatus | null;
}

/**
 * Story 6.15 (ADR-0051) — the Active/Inactive signal now comes from real
 * `health.isActive` (Story 1.12), never `authMode === 'none'` or
 * `credentialStatus !== null` — closing the actual UI-visible instance of
 * the bug ADR-0051 was drafted to fix: Newswire is no longer hardcoded
 * "Active" regardless of whether a Tenant-Admin ever chose to turn it on.
 * `health` itself is still kept for every platform, connected or not, per
 * the 2026-08-12 enhancement — see this component's own SKILL.md.
 */
async function loadConnectorStatusRow(platform: PlatformDefinition): Promise<ConnectorStatusRow> {
  try {
    const health = await getConnectorStatus(platform.id);
    return { platform, isActive: health.isActive, health };
  } catch {
    return { platform, isActive: false, health: null };
  }
}

export default async function ConnectorStatusPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const isTenantAdmin = identity?.type === 'tenant_user' && identity.role === 'tenant_admin';

  const rows = await Promise.all(PLATFORMS.map(loadConnectorStatusRow));

  return (
    <main>
      <h1>Connector status</h1>
      <p>Health and status only — no post content or other tenant data is shown here.</p>

      <section>
        <h2>Platforms</h2>
        <ul>
          {rows.map(({ platform, isActive, health }) => (
            <li key={platform.id} data-active={isActive} data-status={health?.status ?? 'unknown'}>
              <strong>{platform.name}</strong> —{' '}
              {!isActive ? (
                <span>Inactive</span>
              ) : health?.status === 'failing' ? (
                <strong>⚠ Active — FAILING, needs attention</strong>
              ) : health?.status === 'disconnected' ? (
                <span>Active — no ingestion runs yet</span>
              ) : (
                <span>Active — {health?.status ?? 'status unavailable'}</span>
              )}
              <div>Last successful fetch: {health?.lastSuccessfulFetchAt ?? 'never'}</div>
              <div>Last attempt: {health?.lastAttemptAt ?? 'never'}</div>
              <div>Consecutive failures: {health?.consecutiveFailures ?? 0}</div>
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

      <section>
        <h2>Watchlist compatibility warnings</h2>
        <p>
          Not shown here yet — surfacing which of your watchlists&apos; boolean-query features aren&apos;t natively
          supported by a given connector requires a new core endpoint that doesn&apos;t exist yet. Deferred as a
          named, real gap, not silently dropped — see this screen&apos;s own component notes.
        </p>
      </section>
    </main>
  );
}
