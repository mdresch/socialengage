import { withTenant } from '../db/withTenant';
import { getTenantSignupPool } from '../db/tenantSignupPool';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';

/** Template defaults, ADR-0037 §8b — "not deeply analyzed defaults, revisable via Amendment Log." */
const ESCALATION_THRESHOLD = 3;
const ESCALATION_WINDOW_DAYS = 30;

export interface DomainSignupAttemptSummary {
  domain: string;
  distinctEmailCount: number;
  escalated: boolean;
  emails: string[];
}

/**
 * ADR-0037 §8b: reads the caller's own tenant's domain_signup_attempts,
 * aggregated by domain, within the rolling window. Runs entirely through
 * the ordinary app_user/withTenant() path — RLS on both domain_signup_attempts
 * and tenants scopes this to the caller's own tenant; there is no
 * application-level tenant filter to bypass. See
 * .claude/skills/same-domain-invite-assist/SKILL.md.
 */
export async function listDomainSignupAttempts(tenantId: string): Promise<DomainSignupAttemptSummary[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ domain: string | null; email: string }>(
      `SELECT t.domain, dsa.email
       FROM domain_signup_attempts dsa
       JOIN tenants t ON t.id = dsa.tenant_id
       WHERE dsa.attempted_at >= now() - make_interval(days => $1)
       GROUP BY t.domain, dsa.email`,
      [ESCALATION_WINDOW_DAYS]
    );

    const byDomain = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.domain) continue;
      const emails = byDomain.get(row.domain) ?? new Set<string>();
      emails.add(row.email);
      byDomain.set(row.domain, emails);
    }

    return [...byDomain.entries()].map(([domain, emails]) => ({
      domain,
      distinctEmailCount: emails.size,
      escalated: emails.size >= ESCALATION_THRESHOLD,
      emails: [...emails],
    }));
  });
}

/**
 * ADR-0037 §8c: called from selfServiceSignup.ts's recordDomainSignupAttempt()
 * right after a new domain_signup_attempts row is inserted — the only place
 * "whenever a domain's attempt count crosses the escalation threshold" can
 * genuinely be detected inline, without a background job this project has
 * no infrastructure for. Fires exactly once per crossing (distinctCount ===
 * ESCALATION_THRESHOLD, not >=) — see this component's own SKILL.md for why
 * that's deliberate, not an off-by-one.
 */
export async function checkAndLogDomainEscalation(tenantId: string, domain: string): Promise<void> {
  const { distinctCount, emails } = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ email: string }>(
      `SELECT DISTINCT email FROM domain_signup_attempts
       WHERE tenant_id = $1 AND attempted_at >= now() - make_interval(days => $2)`,
      [tenantId, ESCALATION_WINDOW_DAYS]
    );
    return { distinctCount: rows.length, emails: rows.map((r) => r.email) };
  });

  if (distinctCount !== ESCALATION_THRESHOLD) return;

  await logPlatformAdminAction(
    {
      actorIdentity: 'system:domain-signup-escalation',
      operation: 'domain_signup_escalation',
      targetTenantId: tenantId,
      detail: { domain, distinctEmailCount: distinctCount, emails },
    },
    getTenantSignupPool()
  );
}
