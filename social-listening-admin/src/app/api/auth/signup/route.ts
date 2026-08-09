/**
 * Story 6.7 / ADR-0037 §5 — starts the exact same Authorization Code + PKCE flow
 * Story 6.1's own /api/auth/login route uses, with one addition: `prompt: 'create'`,
 * a standard OAuth authorization-request parameter Entra honors to trigger its
 * sign-up dialog rather than its sign-in view (confirmed directly against
 * Microsoft's own docs — see this component's own SKILL.md). The OAuth state
 * cookie also carries `mode: 'signup'` and the tenant name collected on /sign-up,
 * so the shared callback route (api/auth/callback/route.ts) knows to dispatch to
 * signupFlow.ts's completeSelfServiceSignup() instead of the ordinary sign-in path.
 */

import { NextResponse } from 'next/server';
import * as client from 'openid-client';
import { getEntraConfig, redirectUri, ENTRA_SCOPES, OAUTH_STATE_COOKIE_NAME } from '@/lib/entra';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantName = url.searchParams.get('tenantName')?.trim();

  if (!tenantName) {
    return NextResponse.redirect(new URL('/sign-up', request.url));
  }

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
    prompt: 'create',
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    OAUTH_STATE_COOKIE_NAME,
    JSON.stringify({ codeVerifier, state, mode: 'signup', tenantName }),
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
