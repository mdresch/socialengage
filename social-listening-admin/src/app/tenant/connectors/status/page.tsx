import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getConnectorStatus, type ConnectorStatus } from '@/lib/core-client';

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
  connected: boolean;
  health: ConnectorStatus | null;
}

/**
 * Story 6.5 (enhanced 2026-08-12, Menno's own direct request) — always
 * keeps the real fetched health, even for an unconnected platform: a
 * successful GET /v1/connectors/:platformId call for a never-connected
 * platform still returns real, honest data (lastSuccessfulFetchAt: null,
 * consecutiveFailures: 0, etc., per deriveConnectorHealth()'s own
 * zero-ingestion-runs branch) — discarding it was wasteful and, once
 * inactive platforms are rendered too, would have thrown that real data
 * away for no reason. `health` is only null on a genuine fetch failure.
 */
async function loadConnectorStatusRow(platform: PlatformDefinition): Promise<ConnectorStatusRow> {
  try {
    const health = await getConnectorStatus(platform.id);
    const connected = platform.authMode === 'none' || health.credentialStatus !== null;
    return { platform, connected, health };
  } catch {
    return { platform, connected: false, health: null };
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

  const rows = await Promise.all(PLATFORMS.map(loadConnectorStatusRow));

  return (
    <main>
      <h1>Connector status</h1>
      <p>Health and status only — no post content or other tenant data is shown here.</p>

      <section>
        <h2>Platforms</h2>
        <ul>
          {rows.map(({ platform, connected, health }) => (
            <li key={platform.id} data-active={connected} data-status={health?.status ?? 'unknown'}>
              <strong>{platform.name}</strong> —{' '}
              {!connected ? (
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
