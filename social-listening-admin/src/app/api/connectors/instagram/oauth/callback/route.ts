import { NextResponse } from 'next/server';
import { exchangeInstagramOAuthCode } from '@/lib/core-client';
import {
  instagramRedirectUri,
  INSTAGRAM_OAUTH_STATE_COOKIE_NAME,
  INSTAGRAM_OAUTH_PENDING_COOKIE_NAME,
} from '@/lib/instagramOAuth';

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
  const expectedState = readCookie(request, INSTAGRAM_OAUTH_STATE_COOKIE_NAME);

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    const response = NextResponse.redirect(new URL('/tenant/connectors?igError=invalid_state', request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const outcome = await exchangeInstagramOAuthCode(code, instagramRedirectUri());

  if (outcome.status !== 200) {
    const response = NextResponse.redirect(new URL('/tenant/connectors?igError=exchange_failed', request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.redirect(new URL('/tenant/connectors?igConnect=1', request.url));
  response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE_NAME);
  response.cookies.set(INSTAGRAM_OAUTH_PENDING_COOKIE_NAME, JSON.stringify(outcome.body), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return response;
}
