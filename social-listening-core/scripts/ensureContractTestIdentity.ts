import { createTenant, listTenants } from '../src/tenants/tenantStore';
import { createInvitedUser } from '../src/identity/identityResolution';
import { getIdentityResolverPool, closeIdentityResolverPool } from '../src/db/identityResolverPool';

/**
 * Idempotent dev/test-DB seeding utility — finds or creates a dedicated,
 * stable tenant and an invited `users` row for a given email, so a contract
 * test that needs a real, resolvable identity (not a mock) doesn't depend
 * on hand-seeded state existing on whatever machine runs it.
 *
 * Added 2026-08-12 for Story 6.1's contract test, which needs
 * ENTRA_ADMIN_TEST_USER_EMAIL to actually resolve to a real identity once
 * that contract also starts a real social-listening-core instance
 * (cross-component fix for the role-gating healing pass — see
 * docs/implementation-log.md). Not tenant-specific to that one caller;
 * any contract needing a real resolvable test identity can reuse this.
 *
 * Usage: ts-node scripts/ensureContractTestIdentity.ts <email> [role]
 * role defaults to 'tenant_admin'.
 */
const TENANT_NAME = 'Contract Test Tenant';

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] as 'tenant_admin' | 'tenant_user') || 'tenant_admin';
  if (!email) {
    console.error('Usage: ts-node scripts/ensureContractTestIdentity.ts <email> [role]');
    process.exit(1);
  }

  const { rows: existing } = await getIdentityResolverPool().query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (existing.length > 0) {
    console.log(`Already exists: ${email} (users.id=${existing[0].id})`);
    await closeIdentityResolverPool();
    return;
  }

  const tenants = await listTenants();
  let tenant = tenants.find((t) => t.name === TENANT_NAME);
  if (!tenant) {
    tenant = await createTenant('ensureContractTestIdentity-script', {
      name: TENANT_NAME,
      licenseSeatCount: 10,
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  }

  const user = await createInvitedUser(tenant.id, { email, role });
  console.log(`Invited: ${user.email} as ${user.role} in tenant ${tenant.id}`);
  await closeIdentityResolverPool();
}

main().catch((err) => {
  console.error('ensureContractTestIdentity failed:', err.message);
  process.exit(1);
});
