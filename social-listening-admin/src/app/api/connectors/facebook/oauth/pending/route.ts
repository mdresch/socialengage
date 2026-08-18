/**
 * Story 6.23 (ADR-0059 Decision §3) — reads and clears the callback route's
 * own stashed {sessionToken, pages} result, for the Page-picker to render.
 * Single-use by construction (the cookie is deleted on every read,
 * regardless of whether one was present) — never a direct call to Meta;
 * the pages list was already fetched by social-listening-core during the
 * exchange (Story 2.15) and carried here only via the pending cookie.
 */

import { NextResponse } from 'next/server';
import { FACEBOOK_OAUTH_PENDING_COOKIE_NAME } from '@/lib/facebookOAuth';

export async function GET(request: Request) {
  const raw = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${FACEBOOK_OAUTH_PENDING_COOKIE_NAME}=`));

  const value = raw ? JSON.parse(decodeURIComponent(raw.slice(FACEBOOK_OAUTH_PENDING_COOKIE_NAME.length + 1))) : null;

  const response = NextResponse.json(value);
  response.cookies.delete(FACEBOOK_OAUTH_PENDING_COOKIE_NAME);
  return response;
}
