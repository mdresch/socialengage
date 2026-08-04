/**
 * Story 6.1 / ADR-0036 §1 — clears the session cookie server-side, deletes the
 * corresponding server-side session record (session.ts's own reference/session-ID
 * pattern), and redirects to a signed-out state. This clears *this browser's* session
 * entirely — a copy of the raw cookie value used elsewhere would no longer resolve to
 * anything either, since the server-side record it referenced is now gone too.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, deleteSession } from '@/lib/session';

export async function GET(request: Request) {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    await deleteSession(raw);
  }

  const response = NextResponse.redirect(new URL('/signed-out', request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
