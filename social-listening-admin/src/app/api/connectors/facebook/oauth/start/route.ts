/**
 * Story 6.23 (ADR-0059 Decision §3/§4) — starts the Facebook OAuth flow.
 * Mirrors src/app/api/auth/login/route.ts's own shape (Entra sign-in): a
 * server-side Route Handler builds the authorize URL and redirects,
 * carrying a fresh, short-lived, httpOnly CSRF state cookie the callback
 * route verifies and deletes. Also the target of the "Reconnect" action
 * when a connector's health is 'reconnect_required' (Story 2.15 AC7) — the
 * same entry point, re-entered from the top, per that story's own AC.
 */

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { facebookAuthorizeUrl, FACEBOOK_OAUTH_STATE_COOKIE_NAME } from '@/lib/facebookOAuth';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const response = NextResponse.redirect(facebookAuthorizeUrl(state));
  response.cookies.set(FACEBOOK_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return response;
}
