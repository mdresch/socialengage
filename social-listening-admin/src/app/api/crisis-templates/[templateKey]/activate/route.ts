import { NextResponse } from 'next/server';
import { activateCrisisTemplate } from '@/lib/core-client';

/**
 * Story 9.4 — Next.js Route Handler proxying POST /v1/crisis-templates/:templateKey/activate.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ templateKey: string }> }
) {
  const params = await props.params;
  const { templateKey } = params;

  try {
    const body = await request.json();
    const result = await activateCrisisTemplate(templateKey, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to activate crisis template' },
      { status: 500 }
    );
  }
}
