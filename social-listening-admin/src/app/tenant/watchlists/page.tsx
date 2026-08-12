import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { listWatchlists, getConnectorStatus } from '@/lib/core-client';
import { WatchlistForm } from './WatchlistForm';
import { WatchlistRow } from './WatchlistRow';

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
    <main>
      <h1>Watchlists</h1>
      <p>
        Create, edit, and remove your own watchlists. Watchlists are private to you — even a Tenant-Admin cannot see
        or manage another user&apos;s watchlists here.
      </p>

      <section>
        <h2>Your watchlists</h2>
        {watchlists.length === 0 ? (
          <p>No watchlists yet.</p>
        ) : (
          <ul>
            {watchlists.map((watchlist) => (
              <WatchlistRow key={watchlist.id} watchlist={watchlist} connectedPlatforms={connectedPlatforms} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Create a watchlist</h2>
        <WatchlistForm mode="create" connectedPlatforms={connectedPlatforms} />
      </section>
    </main>
  );
}
