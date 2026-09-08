/**
 * Story 9.6 (ADR-0080) — same-origin proxy for the OnboardingChecklist
 * component (Client Component) to read and mutate checklist state without
 * needing direct CORE_API_BASE_URL access or attaching a bearer token itself.
 * All token attachment happens via core-client.ts / authenticatedCoreFetch()
 * (ADR-0036 §2).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, decryptSession } from '@/lib/session';
import { isResolvedIdentity } from '@/lib/role-routing';
import { getOnboardingChecklist, patchOnboardingChecklist, getRoleOnboardingChecklist } from '@/lib/core-client';

async function resolveCallerTenantUser() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await decryptSession(raw) : null;
  const identity = isResolvedIdentity(session?.identity) ? session!.identity : null;

  if (!identity || identity.type !== 'tenant_user') {
    return null;
  }
  return identity;
}

export async function GET(request: Request) {
  const identity = await resolveCallerTenantUser();
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized or not a tenant member.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  try {
    if (role) {
      const roleChecklist = await getRoleOnboardingChecklist(role);
      return NextResponse.json(roleChecklist, { status: 200 });
    }
    const checklist = await getOnboardingChecklist(identity.tenantId);
    return NextResponse.json(checklist, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch onboarding checklist.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const identity = await resolveCallerTenantUser();
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized or not a tenant member.' }, { status: 401 });
  }

  if (identity.role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Only a Tenant-Admin may modify the onboarding checklist.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const outcome = await patchOnboardingChecklist(identity.tenantId, body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
