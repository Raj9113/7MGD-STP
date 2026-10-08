import { createClient } from '@/lib/supabase/server';
import { canViewDept } from '@/lib/access';
import { NextResponse } from 'next/server';

/** Only signed-in users who may view the Laboratory page can download its reports (Laboratory, Admin, Viewer). */
export async function requireLabViewer(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('department').eq('id', user.id).single();
  if (!canViewDept(profile?.department ?? 'Unknown', 'laboratory')) {
    return NextResponse.json({ error: 'You do not have access to Laboratory reports.' }, { status: 403 });
  }
  return null;
}
