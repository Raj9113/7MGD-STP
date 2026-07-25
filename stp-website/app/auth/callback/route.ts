import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/supabase/logger';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Log the LOGIN event (fire-and-forget — never blocks the redirect)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, department')
            .eq('id', user.id)
            .single();

          await logActivity({
            userId:     user.id,
            userName:   profile?.full_name ?? user.email ?? null,
            userEmail:  user.email ?? null,
            department: profile?.department ?? null,
            action:     'LOGIN',
            details:    `User logged in via email link`,
            request,
          });
        }
      } catch {
        // Never block the redirect for a logging failure
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login page on error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

