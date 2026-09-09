import { NextRequest, NextResponse } from 'next/server';
import { getUserDigestPreferences, upsertUserDigestPreferences } from '@/lib/core-client';

export async function GET() {
  try {
    const prefs = await getUserDigestPreferences();
    return NextResponse.json(prefs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch digest preferences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await upsertUserDigestPreferences(body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update digest preferences' }, { status: 500 });
  }
}
