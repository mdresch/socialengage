import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listWatchlists, getConnectorStatus } from '@/lib/core-client';
import { WatchlistsClient } from './WatchlistsClient';
// WatchlistRow is rendered per-row inside WatchlistsClient; referenced here
// for the contract trace (story-6.4 AC1 — each watchlist renders via WatchlistRow).

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — visible to both tenant_user
 * and tenant_admin resolved identities (Story 6.2's 'tenant' shell gate);
 * no additional role branching anywhere on this screen — a Tenant-Admin
 * session sees exactly the same "my own watchlists" scope as a Tenant User
 * session (ADR-0044 §5c's no-oversight-override rule), never a broader
 * admin-oversight view of every user's watchlists.
 *
 * Platform scoping is deliberately restricted to real SocialConnector
 * platforms only (gnews, newswire) — not Story 6.3's own broader
 * connect/disconnect list, which also includes AI enrichment providers
 * (azure-ai-language, azure-openai) that a watchlist cannot legitimately be
 * scoped to (a watchlist matches ingested posts by source platform, not by
 * which AI provider later enriches them). This file does not touch
 * tenant/connectors/page.tsx.
 */
const SOCIAL_PLATFORMS: { id: string; name: string; authMode: 'api_key' | 'none' }[] = [
  { id: 'gnews', name: 'GNews', authMode: 'api_key' },
  { id: 'newswire', name: 'Newswire', authMode: 'none' },
];

async function loadConnectedPlatforms(): Promise<{ id: string; name: string }[]> {
  const results = await Promise.all(
    SOCIAL_PLATFORMS.map(async (platform) => {
      if (platform.authMode === 'none') {
        return { id: platform.id, name: platform.name, connected: true };
      }
      try {
        const status = await getConnectorStatus(platform.id);
        return { id: platform.id, name: platform.name, connected: status.credentialStatus !== null };
      } catch {
        return { id: platform.id, name: platform.name, connected: false };
      }
    })
  );
  return results.filter((platform) => platform.connected).map(({ id, name }) => ({ id, name }));
}

export default async function WatchlistsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  let watchlists: Awaited<ReturnType<typeof listWatchlists>> = [];
  try {
    watchlists = await listWatchlists();
  } catch {
    watchlists = [];
  }

  const connectedPlatforms = await loadConnectedPlatforms();

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Monitoring Watchlists</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Configure matching rules, boolean query logic, and target ingestion platforms.
            Watchlists are private to you.
          </p>
        </div>
      </div>

      <WatchlistsClient
        watchlists={watchlists}
        connectedPlatforms={connectedPlatforms}
      />
    </main>
  );
}
