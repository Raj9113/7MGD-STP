import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/camera-url
 *
 * Returns the HLS stream URL only to authenticated users.
 * The CAMERA_HLS_URL env var is server-side only (no NEXT_PUBLIC_ prefix),
 * so it is never exposed in the browser bundle.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.CAMERA_HLS_URL;

  if (!url) {
    return NextResponse.json(
      { error: 'Camera stream is not configured on this server.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ url });
}
