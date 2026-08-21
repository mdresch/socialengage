/**
 * Story 6.35 (ADR-0069) — LinkedIn OAuth dialog URL and short-lived cookie names.
 * Scopes: openid, profile, email, w_member_social, r_member_social.
 */

export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';

export const LINKEDIN_OAUTH_STATE_COOKIE_NAME = 'se_li_oauth_state';

export const LINKEDIN_MEMBER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example (Story 6.35 / ADR-0069).`);
  }
  return value;
}

export function linkedinRedirectUri(): string {
  return process.env.LINKEDIN_OAUTH_REDIRECT_URI || 'https://socialengage.test:3000/api/connectors/linkedin/oauth/callback';
}

export function linkedinAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('LINKEDIN_CLIENT_ID'),
    redirect_uri: linkedinRedirectUri(),
    state,
    scope: LINKEDIN_MEMBER_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}
