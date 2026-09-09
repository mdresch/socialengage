import { NextResponse } from 'next/server';
import { uploadOutboundMedia } from '@/lib/core-client';

/**
 * Story 13.10 (ADR-0115) — BFF proxy for POST /v1/outbound/media.
 * Receives a multipart form from the browser, forwards the file to
 * social-listening-core, and returns the presigned media payload.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const coreForm = new FormData();
    const filename = (file as any).name || 'upload';
    coreForm.append('file', file, filename);

    const result = await uploadOutboundMedia(coreForm);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Media upload failed.' }, { status: 500 });
  }
}
