/**
 * Story 6.23 (ADR-0059 Decision §4) — same-origin proxy so the Page-picker
 * (a Client Component) can reach social-listening-core's own select-page
 * endpoint (Story 2.15) without a bearer token — attached inside
 * core-client.ts's selectFacebookPage(), the sole choke point (ADR-0036
 * §2), same pattern as connect/route.ts. On success, also caches the
 * selected Page's own name in a long-lived, cosmetic-only cookie — see
 * facebookOAuth.ts's own FACEBOOK_CONNECTED_PAGE_COOKIE_NAME doc comment
 * for why (no backend field for this exists today).
 */

import { NextResponse } from 'next/server';
import { selectFacebookPage } from '@/lib/core-client';
import { FACEBOOK_CONNECTED_PAGE_COOKIE_NAME } from '@/lib/facebookOAuth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await selectFacebookPage(body.sessionToken, body.pageId);
  const response = NextResponse.json(outcome.body, { status: outcome.status });
  if (outcome.status === 201 && outcome.body.page) {
    response.cookies.set(FACEBOOK_CONNECTED_PAGE_COOKIE_NAME, JSON.stringify(outcome.body.page), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 400 * 24 * 60 * 60,
    });
  }
  return response;
}
