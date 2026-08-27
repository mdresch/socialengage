import { NextResponse } from 'next/server';
import { getOnboardingChecklist, patchOnboardingChecklist } from '@/lib/core-client';

/**
 * Story 9.6 — Next.js Route Handlers proxying GET and PATCH /v1/tenants/:id/onboarding-checklist.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const checklist = await getOnboardingChecklist(id);
    return NextResponse.json(checklist);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load onboarding checklist' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const body = await request.json();
    const result = await patchOnboardingChecklist(id, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update onboarding checklist' },
      { status: 500 }
    );
  }
}
