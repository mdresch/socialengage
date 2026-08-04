/**
 * Story 6.1 / ADR-0036 §3 — starts the Authorization Code + PKCE flow against the real
 * Entra External ID tenant. Runs entirely server-side (Route Handler); the PKCE code
 * verifier and CSRF state are held only in a short-lived, httpOnly cookie the callback
 * route consumes and deletes — never exposed to client-side JavaScript.
 */

import { NextResponse } from 'next/server';
import * as client from 'openid-client';
import { getEntraConfig, redirectUri, ENTRA_SCOPES, OAUTH_STATE_COOKIE_NAME } from '@/lib/entra';

export async function GET() {
  const config = await getEntraConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: ENTRA_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    OAUTH_STATE_COOKIE_NAME,
    JSON.stringify({ codeVerifier, state }),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    }
  );
  return response;
}
