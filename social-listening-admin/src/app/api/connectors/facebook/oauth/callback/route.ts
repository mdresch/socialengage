/**
 * Story 6.23 (ADR-0059 Decision §3/§4) — completes the Facebook OAuth
 * redirect: verifies the CSRF state cookie set by start/route.ts, then
 * forwards the returned code to social-listening-core's own OAuth-exchange
 * endpoint (Story 2.15) via core-client.ts's exchangeFacebookOAuthCode() —
 * this route never talks to graph.facebook.com itself. On success, stashes
 * the returned {sessionToken, pages} in a short-lived, single-use pending
 * cookie (pending/route.ts) for the Page-picker to read, then redirects
 * back to the connectors screen. Mirrors src/app/api/auth/callback/route.ts's
 * own state-cookie-verification shape (Entra sign-in), a materially
 * simpler flow since core — not this route — does the actual token
 * exchange (no PKCE code verifier here, unlike Entra's).
 */

import { NextResponse } from 'next/server';
import { exchangeFacebookOAuthCode } from '@/lib/core-client';
import {
  facebookRedirectUri,
  FACEBOOK_OAUTH_STATE_COOKIE_NAME,
  FACEBOOK_OAUTH_PENDING_COOKIE_NAME,
} from '@/lib/facebookOAuth';

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${name}=`));
  return raw ? decodeURIComponent(raw.slice(name.length + 1)) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const expectedState = readCookie(request, FACEBOOK_OAUTH_STATE_COOKIE_NAME);

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    const response = NextResponse.redirect(new URL('/tenant/connectors?fbError=invalid_state', request.url));
    response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const outcome = await exchangeFacebookOAuthCode(code, facebookRedirectUri());

  if (outcome.status !== 200) {
    const response = NextResponse.redirect(new URL('/tenant/connectors?fbError=exchange_failed', request.url));
    response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.redirect(new URL('/tenant/connectors?fbConnect=1', request.url));
  response.cookies.delete(FACEBOOK_OAUTH_STATE_COOKIE_NAME);
  response.cookies.set(FACEBOOK_OAUTH_PENDING_COOKIE_NAME, JSON.stringify(outcome.body), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return response;
}
