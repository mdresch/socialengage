/**
 * Story 6.23 (ADR-0059 Decision §3/§4) — Facebook's own OAuth dialog URL and
 * the short-lived cookie names the start/callback/pending route handlers
 * share. This repo never talks to graph.facebook.com for the token exchange
 * itself (see core-client.ts's exchangeFacebookOAuthCode()) — this file's
 * only Meta-facing responsibility is building the authorize URL the browser
 * is redirected to, the same "admin builds the authorize URL, core does the
 * token exchange" split entra.ts/the Entra sign-in flow already establishes
 * for a different provider. See .claude/skills/connector-connect-disconnect/SKILL.md.
 */

const GRAPH_API_VERSION = 'v21.0';

/** CSRF-proof state cookie for the start -> callback round trip. 5 minutes, mirrors OAUTH_STATE_COOKIE_NAME's own lifetime (entra.ts). */
export const FACEBOOK_OAUTH_STATE_COOKIE_NAME = 'se_fb_oauth_state';

/** Carries the callback's own {sessionToken, pages} result to the picker (pending/route.ts). Single-use, deleted on read — mirrors the backend's own single-use session Map (facebookOAuthRouter.ts). */
export const FACEBOOK_OAUTH_PENDING_COOKIE_NAME = 'se_fb_oauth_pending';

// Story 6.27 (ADR-0060 Decision §5): the Story 6.23-era
// FACEBOOK_CONNECTED_PAGE_COOKIE_NAME cosmetic Page-name cache was retired
// here — GET /v1/connectors/facebook/pages (core-client.ts's
// listFacebookPages()) now returns real per-Page names/status/health
// directly, making the cookie workaround obsolete rather than merely
// redundant.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example (Story 6.23 / ADR-0059).`);
  }
  return value;
}

/** The exact-match redirect_uri Facebook must be configured to allow, and the one this repo's own callback route handles. */
export function facebookRedirectUri(): string {
  return requireEnv('FACEBOOK_OAUTH_REDIRECT_URI');
}

/**
 * Facebook Login for Business's own authorize URL (ADR-0059 Decision §3/§4)
 * — pages_show_list/pages_read_engagement only, the two permissions Story
 * 2.15's own exchange/select-page endpoints actually use. `client_id` is
 * FACEBOOK_APP_ID — public, non-secret, the same category as any OAuth
 * client id — never the app secret, which stays social-listening-core-side
 * only (facebookOAuthRouter.ts).
 */
export function facebookAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('FACEBOOK_APP_ID'),
    redirect_uri: facebookRedirectUri(),
    state,
    scope: 'pages_show_list,pages_read_engagement',
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}
