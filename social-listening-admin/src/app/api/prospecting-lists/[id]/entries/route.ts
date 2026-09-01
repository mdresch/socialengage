import { NextResponse } from 'next/server';
import { listProspectingEntries, addProspectingEntry } from '@/lib/core-client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
  const cursor = searchParams.get('cursor') || undefined;
  try {
    const result = await listProspectingEntries(id, { limit, cursor });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list entries' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await addProspectingEntry(id, {
      author_id: body.author_id,
      platform_id: body.platform_id,
      topic: body.topic,
      engagement_score: body.engagement_score,
      authenticity_score: body.authenticity_score,
      influence_score: body.influence_score,
      reach_score: body.reach_score,
      relationship_stage: body.relationship_stage,
      notes: body.notes,
      tags: body.tags,
      custom_attributes: body.custom_attributes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const status = (err as any)?.status === 409 ? 409 : 500;
    return NextResponse.json({ error: err?.message || 'Failed to add entry' }, { status });
  }
}
