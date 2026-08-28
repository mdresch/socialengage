import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity, isShellAllowed } from '@/lib/role-routing';
import { getUserDigestPreferences, listWatchlists } from '@/lib/core-client';
import { DigestPreferencesView } from './DigestPreferencesView';

export default async function DigestSettingsPage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!isShellAllowed(identity, 'tenant')) {
    redirect('/');
  }

  const [preferences, watchlists] = await Promise.all([
    getUserDigestPreferences().catch(() => ({
      id: '',
      tenantId: '',
      userId: '',
      isEnabled: true,
      sendAtLocal: '08:00:00',
      timezone: 'Europe/Amsterdam',
      watchlistIds: [],
      includeAiSummary: true,
      includeTopPosts: true,
      includeTopicBreakdown: true,
      lastSentAt: null,
      createdAt: '',
      updatedAt: '',
    })),
    listWatchlists().catch(() => []),
  ]);

  return (
    <main className="p-6">
      <DigestPreferencesView
        initialPreferences={preferences}
        watchlists={watchlists.map((w: any) => ({ id: w.id, name: w.name }))}
      />
    </main>
  );
}
