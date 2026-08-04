import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';

/**
 * Story 6.1 — the first real page this project has shipped. Deliberately renders no
 * token value anywhere (ADR-0036 §1's "never a value browser-side JavaScript, or a
 * server-rendered HTML payload, can read" requirement) — only a boolean signed-in state.
 */
export default async function HomePage() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;

  return (
    <main>
      <h1>SocialEngage Admin</h1>
      {session ? (
        <>
          <p data-testid="signed-in-state">Signed in.</p>
          <a href="/api/auth/signout">Sign out</a>
        </>
      ) : (
        <p>Not signed in.</p>
      )}
    </main>
  );
}
