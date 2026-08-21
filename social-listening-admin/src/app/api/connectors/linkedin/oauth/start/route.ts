import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { linkedinAuthorizeUrl, LINKEDIN_OAUTH_STATE_COOKIE_NAME } from '@/lib/linkedinOAuth';

export async function GET() {
  const state = randomBytes(32).toString('hex');
  const response = NextResponse.redirect(linkedinAuthorizeUrl(state));
  response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
