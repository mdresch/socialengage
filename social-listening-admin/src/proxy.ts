/**
 * Story 6.1 / ADR-0036 §4 — coarse-grained proxy layer (Next.js 16's `proxy.ts`
 * convention, replacing the deprecated `middleware.ts`; runs in the Node.js runtime, not
 * Edge — chosen deliberately here, not just following the rename, since session.ts's
 * in-memory session store (this file's own header comment explains why) must run in the
 * same process as the Route Handlers that write to it, which the Node.js runtime
 * guarantees and Edge does not). Redirects an unauthenticated request to any route other
 * than sign-in/sign-out itself to sign-in. Decides only "signed in or not," never "which
 * role" (that needs a full request context and a resolved identity — Story 6.2's own
 * layer, ADR-0035).
 *
 * UX convenience only, never the real security boundary — social-listening-core's own
 * RLS/application-layer role checks remain that (ADR-0036 §4).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, decryptSession } from './lib/session';

const PUBLIC_PATHS = ['/sign-in', '/signed-out'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await decryptSession(cookie) : null;

  if (!session) {
    const signInUrl = new URL('/sign-in', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
