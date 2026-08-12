import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';

/**
 * Story 2.11 (ADR-0050 Decision §3) — DNS TXT domain-ownership verification,
 * the same protocol Google Workspace and Microsoft 365 use for domain
 * verification (both primary-sourced in ADR-0050's own Context section).
 * See .claude/skills/tenant-owned-feed-connector/SKILL.md.
 */

/** ADR-0050's own implementation default: 7-day token TTL. */
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** ADR-0050 Decision §3's own chosen prefix — isolated from the apex zone, the GitHub/Stripe-style pattern. */
const TXT_RECORD_PREFIX = '_socialengage-verify';

/** 32+ URL-safe characters (ADR-0050's own implementation default) — non-guessable. */
export function generateVerificationToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * ADR-0050 Open Question 1 (host-level scoping) resolved here as an
 * implementation default: subdomain-level, at the domain the tenant
 * actually supplied — the Stripe pattern (`_stripe.<subdomain>`) named in
 * ADR-0050 Decision §3 as the more precise option, not the apex-level
 * alternative.
 */
export function buildTxtRecordHost(domain: string): string {
  return `${TXT_RECORD_PREFIX}.${domain}`;
}

export function buildTxtRecordValue(token: string): string {
  return `socialengage-verify=${token}`;
}

/**
 * A real DNS TXT lookup (`dns.promises.resolveTxt`, default) — never
 * mocked; the `resolveTxt` parameter exists solely so a contract test can
 * inject a fake resolver for the one scenario this project has no way to
 * exercise against real infrastructure (a domain we don't actually control
 * successfully publishing a matching record). The "no match / missing
 * record" path is proven against a real DNS lookup of a real domain this
 * project doesn't control — see the contract's own AC4 tests.
 */
export async function checkTxtRecord(
  txtRecordHost: string,
  expectedValue: string,
  resolveTxt: (host: string) => Promise<string[][]> = dns.resolveTxt
): Promise<boolean> {
  let records: string[][];
  try {
    records = await resolveTxt(txtRecordHost);
  } catch {
    // NXDOMAIN / no records at all — not yet propagated, not a hard failure.
    return false;
  }
  return records.some((chunks) => chunks.join('') === expectedValue);
}
