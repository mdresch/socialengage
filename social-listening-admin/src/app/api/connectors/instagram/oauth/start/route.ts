import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { instagramAuthorizeUrl, INSTAGRAM_OAUTH_STATE_COOKIE_NAME } from '@/lib/instagramOAuth';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const response = NextResponse.redirect(instagramAuthorizeUrl(state));
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
  return response;
}
