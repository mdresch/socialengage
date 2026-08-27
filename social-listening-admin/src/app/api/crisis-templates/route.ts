import { NextResponse } from 'next/server';
import { listCrisisTemplates } from '@/lib/core-client';

/**
 * Story 9.4 — Next.js Route Handler proxying GET /v1/crisis-templates.
 */
export async function GET() {
  try {
    const templates = await listCrisisTemplates();
    return NextResponse.json({ templates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to list crisis templates' },
      { status: 500 }
    );
  }
}
