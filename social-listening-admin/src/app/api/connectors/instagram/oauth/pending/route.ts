import { NextResponse } from 'next/server';
import { INSTAGRAM_OAUTH_PENDING_COOKIE_NAME } from '@/lib/instagramOAuth';

export async function GET(request: Request) {
  const raw = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${INSTAGRAM_OAUTH_PENDING_COOKIE_NAME}=`));

  const value = raw ? JSON.parse(decodeURIComponent(raw.slice(INSTAGRAM_OAUTH_PENDING_COOKIE_NAME.length + 1))) : null;

  const response = NextResponse.json(value);
  response.cookies.delete(INSTAGRAM_OAUTH_PENDING_COOKIE_NAME);
  return response;
}
