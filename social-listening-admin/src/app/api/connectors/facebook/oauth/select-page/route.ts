/**
 * Story 6.27 (ADR-0060 Decision §5) — same-origin proxy so the Page-picker
 * (a Client Component) can reach social-listening-core's own select-page
 * endpoint without a bearer token — attached inside core-client.ts's
 * selectFacebookPages(), the sole choke point (ADR-0036 §2), same pattern
 * as connect/route.ts. Forwards a plural `pageIds` array (Story 6.23's own
 * singular `pageId` shape retired — a breaking change to this endpoint,
 * acceptable because its sole caller is this repo itself) and the real,
 * structured `{connected, errors}` partial-failure response straight
 * through. No longer caches a Page name in a cosmetic cookie (Story 6.23's
 * own FACEBOOK_CONNECTED_PAGE_COOKIE_NAME) — the real per-Page list
 * (`GET /v1/connectors/facebook/pages`, listFacebookPages()) makes that
 * cache obsolete.
 */

import { NextResponse } from 'next/server';
import { selectFacebookPages } from '@/lib/core-client';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await selectFacebookPages(body.sessionToken, body.pageIds);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
