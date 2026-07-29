export type AuthMethod = 'oauth' | 'api_key';

/**
 * Platforms that support OAuth (ADR-0014, Story 5.3's Acceptance Criteria). Every
 * other platform (e.g. RSS/newswire providers — spec §10's first connector) only
 * offers API-key entry.
 */
const OAUTH_SUPPORTED_PLATFORMS: ReadonlySet<string> = new Set([
  'x',
  'linkedin',
  'youtube',
  'meta',
]);

export function authMethodFor(platformId: string): AuthMethod {
  return OAUTH_SUPPORTED_PLATFORMS.has(platformId) ? 'oauth' : 'api_key';
}
