import { NextResponse } from 'next/server';
import { getPlatformDashboard } from '@/lib/core-client';

export async function GET() {
  try {
    const data = await getPlatformDashboard();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch platform dashboard' },
      { status: 500 }
    );
  }
}
