import { createClient } from '@/lib/supabase/server';
import { canViewDept } from '@/lib/access';
import { NextResponse } from 'next/server';
import { PHOTO_FILE, PHOTO_TYPES, readLabPhoto } from '@/lib/lab-export/photos';

/**
 * GET /api/lab/photo/2026-09/15-olms.jpeg
 *
 * Lab sample / OLMS photographs carry GPS coordinates of the plant, so they are never in public/. They are served only
 * to signed-in users who may view the Laboratory page, from either
 *   1. the private Supabase Storage bucket `lab-photos` (photos uploaded through the daily entry form), or
 *   2. data/lab/photos (history extracted from the Word reports by scripts/build-lab-data.py).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ month: string; file: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('department').eq('id', user.id).single();
  if (!canViewDept(profile?.department ?? 'Unknown', 'laboratory')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Strict whitelist: no path separators or dots can reach storage or the filesystem
  const { month, file } = await params;
  const match = PHOTO_FILE.exec(file);
  const bytes = match ? await readLabPhoto(month, file) : null;
  if (!match || !bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': PHOTO_TYPES[match[2]], 'Cache-Control': 'private, max-age=3600' },
  });
}
