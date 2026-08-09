/**
 * Story 6.1 / ADR-0036 §1, §3, §5 — completes the Authorization Code + PKCE exchange,
 * establishes the server-side session cookie, and attempts to hydrate it with core's
 * resolved identity (ADR-0036 §5). Tokens never leave this server-side handler — the
 * only thing sent to the browser is the encrypted session cookie itself.
 *
 * Story 6.7 / ADR-0037 — also the shared landing point for the sign-up flow
 * (src/app/api/auth/signup/route.ts): the OAuth state cookie's own `mode` field
 * (absent for ordinary sign-in) is the one branch point between the two. No
 * second, parallel token-exchange mechanism is introduced — see
 * .claude/skills/self-service-signup-ui/SKILL.md.
 */

import { NextResponse } from 'next/server';
import * as client from 'openid-client';
import { getEntraConfig } from '@/lib/entra';
import {
  encryptSession,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/session';
import { fetchResolvedIdentity } from '@/lib/core-client';
import { OAUTH_STATE_COOKIE_NAME } from '@/lib/entra';
import { completeSelfServiceSignup } from '@/lib/signupFlow';

export async function GET(request: Request) {
  const stateCookie = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));

  if (!stateCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const { codeVerifier, state, mode, tenantName } = JSON.parse(
    decodeURIComponent(stateCookie.slice(OAUTH_STATE_COOKIE_NAME.length + 1))
  ) as { codeVerifier: string; state: string; mode?: 'signup'; tenantName?: string };

  const config = await getEntraConfig();
  const tokens = await client.authorizationCodeGrant(config, new URL(request.url), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
  });

  if (!tokens.id_token) {
    throw new Error('Entra token response carried no id_token.');
  }

  if (mode === 'signup') {
    const result = await completeSelfServiceSignup({
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tenantName: tenantName ?? '',
    });

    const response = NextResponse.redirect(new URL(result.redirectPath, request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    if (result.kind === 'success') {
      response.cookies.set(SESSION_COOKIE_NAME, result.sessionCookieValue, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: SESSION_ABSOLUTE_LIFETIME_SECONDS,
      });
    }
    return response;
  }

  // ADR-0036 §5 — resolve the caller's real identity from core (GET /v1/me, Story 5.11),
  // never from the Entra token's own claims (ADR-0029 §2). A failure here must not block
  // sign-in itself; see fetchResolvedIdentity()'s own note in core-client.ts. The raw
  // result is validated downstream (role-routing.ts's isResolvedIdentity()), never
  // trusted as shaped just because this call succeeded.
  const identity = await fetchResolvedIdentity(tokens.access_token);

  const issuedAt = Math.floor(Date.now() / 1000);
  const sessionCookieValue = await encryptSession(
    {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      identity,
    },
    issuedAt
  );

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookieValue, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_ABSOLUTE_LIFETIME_SECONDS,
  });
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}
