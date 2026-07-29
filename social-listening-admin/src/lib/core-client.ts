/**
 * The sole sanctioned path from social-listening-admin to social-listening-core (ADR-0001).
 * Every call reaches core over HTTP against a configurable base URL — never a database
 * driver, never an in-process import of core's source. See
 * .claude/skills/core-api-client/SKILL.md before adding calls here.
 */

function coreBaseUrl(): string {
  const baseUrl = process.env.CORE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('CORE_API_BASE_URL is not set — social-listening-admin cannot reach social-listening-core.');
  }
  return baseUrl;
}

/**
 * Placeholder call proving the REST-only mechanism works end to end. Real endpoint
 * calls (connect/disconnect a platform, manage watchlists, connector status, ...)
 * are added here as Phase 1 stories build the corresponding core routes and admin
 * features — see docs/implementation-plan.md.
 */
export async function checkCoreHealth(): Promise<Response> {
  return fetch(`${coreBaseUrl()}/health`);
}
