/**
 * Story 6.34 (ADR-0068 Decision §2) — Instagram Business OAuth dialog URL and
 * short-lived cookie names shared by start/callback/pending handlers.
 * Scopes: instagram_basic, pages_show_list, pages_read_engagement.
 */

const GRAPH_API_VERSION = 'v21.0';

/** CSRF-proof state cookie for the Instagram start -> callback round trip. */
export const INSTAGRAM_OAUTH_STATE_COOKIE_NAME = 'se_ig_oauth_state';

/** Carries the callback's own {sessionToken, accounts} result to the picker. Single-use, deleted on read. */
export const INSTAGRAM_OAUTH_PENDING_COOKIE_NAME = 'se_ig_oauth_pending';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example (Story 6.34 / ADR-0068).`);
  }
  return value;
}

/** The exact-match redirect_uri Meta must be configured to allow for Instagram OAuth. */
export function instagramRedirectUri(): string {
  return process.env.INSTAGRAM_OAUTH_REDIRECT_URI || 'https://socialengage.test:3000/api/connectors/instagram/oauth/callback';
}

/**
 * Facebook Login for Business authorize URL requesting Instagram permissions.
 */
export function instagramAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('FACEBOOK_APP_ID'),
    redirect_uri: instagramRedirectUri(),
    state,
    scope: 'instagram_basic,pages_show_list,pages_read_engagement',
    response_type: 'code',
    auth_type: 'rerequest',
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}
