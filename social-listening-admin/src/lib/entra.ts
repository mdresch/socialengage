/**
 * Story 6.1 / ADR-0036 §3 — Entra External ID discovery/config, via the generic
 * `openid-client` OIDC library, not Auth.js/NextAuth.js. Checked directly at
 * implementation time per ADR-0036's own instruction: Auth.js's documented
 * `microsoft-entra-id` provider names only ordinary workforce issuer forms
 * (login.microsoftonline.com/...) and no text addresses External ID/CIAM tenants or the
 * ciamlogin.com issuer format; a follow-up search on Auth.js's generic custom-OIDC-provider
 * path likewise surfaced no confirmed, documented support for this project's actual tenant
 * type. This confirms, rather than overturns, ADR-0036 §3's own web-search-level finding —
 * the bespoke Authorization Code + PKCE default stands.
 *
 * Real tenant used throughout — the same one Story 5.6 provisioned for
 * social-listening-core (getsocialengage.onmicrosoft.com) — never a mock or a second tenant.
 */

import * as client from 'openid-client';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example (Story 6.1 / ADR-0036).`);
  }
  return value;
}

function issuerUrl(): URL {
  const tenantId = requireEnv('ENTRA_TENANT_ID');
  return new URL(`https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`);
}

let configPromise: Promise<client.Configuration> | null = null;

/** Builds exactly one Configuration (openid-client caches discovery internally). */
export function getEntraConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client.discovery(
      issuerUrl(),
      requireEnv('ENTRA_ADMIN_CLIENT_ID'),
      requireEnv('ENTRA_ADMIN_CLIENT_SECRET')
    );
  }
  return configPromise;
}

/**
 * ADR-0036 §3 — must be the exact, pre-registered value on this app's own Entra app
 * registration, never a wildcard or pattern. One distinct value per real environment.
 */
export function redirectUri(): string {
  return requireEnv('ENTRA_ADMIN_REDIRECT_URI');
}

export const ENTRA_SCOPES = 'openid profile email offline_access';

/** Short-lived cookie carrying the PKCE code_verifier + CSRF state between login and callback. */
export const OAUTH_STATE_COOKIE_NAME = 'se_admin_oauth_state';
