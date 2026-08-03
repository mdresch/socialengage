import { randomUUID } from 'crypto';
import { ResolvedIdentity } from '../identity/identityResolution';

/**
 * Builds the JSON string contract tests set as `X-Test-Identity`, read by
 * `testAuthBypassMiddleware` (only ever mounted when NODE_ENV === 'test').
 * See .claude/skills/tenant-auth-middleware/SKILL.md.
 */
export function testIdentityHeaderValue(
  tenantId: string,
  opts: { userId?: string; role?: string } = {}
): string {
  const identity: ResolvedIdentity = {
    type: 'tenant_user',
    tenantId,
    userId: opts.userId ?? randomUUID(),
    role: opts.role ?? 'tenant_user',
  };
  return JSON.stringify(identity);
}
