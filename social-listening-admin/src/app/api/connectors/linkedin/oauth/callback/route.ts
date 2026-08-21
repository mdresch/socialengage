import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeLinkedInOAuthCode } from '@/lib/core-client';
import {
  linkedinRedirectUri,
  LINKEDIN_OAUTH_STATE_COOKIE_NAME,
} from '@/lib/linkedinOAuth';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    if (errorParam) {
      // eslint-disable-next-line no-console
      console.error(`[LinkedIn Callback] OAuth error from provider: ${errorParam} - ${errorDesc}`);
      const response = NextResponse.redirect(new URL(`/tenant/connectors?liError=${encodeURIComponent(errorParam)}`, request.url));
      response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(LINKEDIN_OAUTH_STATE_COOKIE_NAME)?.value;

    // eslint-disable-next-line no-console
    console.log(`[LinkedIn Callback] code: ${Boolean(code)}, returnedState: ${returnedState}, expectedState: ${expectedState}`);

    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      // eslint-disable-next-line no-console
      console.error(`[LinkedIn Callback] State mismatch: returnedState=${returnedState} vs expectedState=${expectedState}`);
      const response = NextResponse.redirect(new URL('/tenant/connectors?liError=invalid_state', request.url));
      response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const outcome = await exchangeLinkedInOAuthCode(code, returnedState, linkedinRedirectUri());
    // eslint-disable-next-line no-console
    console.log(`[LinkedIn Callback] core exchange status: ${outcome.status}, body:`, outcome.body);

    if (outcome.status !== 200) {
      const response = NextResponse.redirect(new URL('/tenant/connectors?liError=exchange_failed', request.url));
      response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const response = NextResponse.redirect(new URL('/tenant/connectors?liConnected=1', request.url));
    response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[LinkedIn Callback] Unexpected exception:', err);
    const response = NextResponse.redirect(new URL('/tenant/connectors?liError=server_error', request.url));
    response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
    return response;
  }
}
