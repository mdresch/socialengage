import { getTenantSignupPool } from '../db/tenantSignupPool';
import { withTenant } from '../db/withTenant';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';
import { Tenant, TenantRow, mapRowToTenant } from './tenantStore';
import { checkAndLogDomainEscalation } from './domainSignupAttempts';

/**
 * Static, maintained list (ADR-0037 §4) — not a database table, not a
 * third-party domain-classification service. Permanently incomplete by
 * construction; a real, accepted limitation, not a false completeness
 * claim. See .claude/skills/self-service-tenant-signup/SKILL.md.
 */
export const PUBLIC_EMAIL_PROVIDER_DENYLIST: readonly string[] = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'gmx.com',
  'mail.com',
];

/** Implementation-time default (not decided by ADR-0037) — self-service tenants start small; Platform Admin can adjust via PATCH /v1/admin/tenants (Story 5.12). */
const DEFAULT_SELF_SERVICE_SEAT_COUNT = 5;

export interface SelfServiceSignupClaims {
  sub: string;
  email: string;
}

export interface SelfServiceSignupInput {
  name: string;
}

export interface SelfServiceSignupResult {
  tenant: Tenant;
  userId: string;
}

/** Thrown when the captured domain already matches an existing tenant (ADR-0037 §3) — the router maps this to its own vague, non-org-naming response. */
export class DomainMatchRejectionError extends Error {
  constructor() {
    super('domain_match');
    this.name = 'DomainMatchRejectionError';
  }
}

function extractDomain(email: string): string {
  return email.toLowerCase().split('@')[1] ?? '';
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

/**
 * Provisions a new tenant and its first tenant_admin user for a caller
 * resolveIdentity() found no match for (ADR-0037 §1–§9). Callers must
 * already have confirmed resolveIdentity(claims) returned null before
 * calling this — see selfServiceSignupRouter.ts, which is also where
 * ADR-0037 §6's must-check-first invited-row routing actually happens (via
 * that same resolveIdentity() call, not duplicated here).
 */
export async function provisionTenantViaSignup(
  claims: SelfServiceSignupClaims,
  input: SelfServiceSignupInput
): Promise<SelfServiceSignupResult> {
  const domain = extractDomain(claims.email);
  const capturedDomain = domain && !PUBLIC_EMAIL_PROVIDER_DENYLIST.includes(domain) ? domain : null;

  let tenant: Tenant;
  try {
    const { rows } = await getTenantSignupPool().query<TenantRow>(
      `INSERT INTO tenants (name, license_seat_count, domain) VALUES ($1, $2, $3) RETURNING *`,
      [input.name, DEFAULT_SELF_SERVICE_SEAT_COUNT, capturedDomain]
    );
    tenant = mapRowToTenant(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err) && capturedDomain) {
      await recordDomainSignupAttempt(capturedDomain, claims.email);
      throw new DomainMatchRejectionError();
    }
    throw err;
  }

  await logPlatformAdminAction(
    {
      actorIdentity: `self-service-signup:${claims.sub}`,
      operation: 'self_service_signup',
      targetTenantId: tenant.id,
      detail: { name: input.name },
    },
    getTenantSignupPool()
  );

  const userId = await withTenant(tenant.id, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, external_subject, role, status, activated_at)
       VALUES ($1, $2, $3, 'tenant_admin', 'active', now())
       RETURNING id`,
      [tenant.id, claims.email, claims.sub]
    );
    return rows[0].id;
  });

  return { tenant, userId };
}

/**
 * ADR-0037 §8b: the matched tenant's id is looked up via tenant_signup_role's
 * own SELECT grant on tenants (migrations/0021 — widened from an initial
 * column-scoped SELECT(id) draft during this story's own healing pass, see
 * that migration's own comment) — a unique-violation error doesn't carry the
 * conflicting row's id itself.
 *
 * Story 5.16 (ADR-0037 §8c): checkAndLogDomainEscalation() runs right after
 * the insert — the only place "whenever a domain's attempt count crosses the
 * escalation threshold" can be detected inline, since this is the sole
 * writer of domain_signup_attempts. See
 * .claude/skills/same-domain-invite-assist/SKILL.md.
 */
async function recordDomainSignupAttempt(domain: string, email: string): Promise<void> {
  const { rows } = await getTenantSignupPool().query<{ id: string }>(`SELECT id FROM tenants WHERE domain = $1`, [
    domain,
  ]);
  if (rows.length === 0) return;

  await getTenantSignupPool().query(
    `INSERT INTO domain_signup_attempts (tenant_id, email) VALUES ($1, $2)`,
    [rows[0].id, email]
  );

  await checkAndLogDomainEscalation(rows[0].id, domain);
}
