import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/supabase/logger';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase can send either a PKCE `code` or a legacy `token_hash` + `type`
  const code       = searchParams.get('code');
  const tokenHash  = searchParams.get('token_hash');
  const type       = searchParams.get('type');           // 'invite' | 'recovery' | 'email' | null
  const next       = searchParams.get('next') ?? '/dashboard';

  const supabase = await createClient();
  let sessionError: string | null = null;

  // ── PKCE flow (code) ───────────────────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) sessionError = error.message;
  }
  // ── Legacy token_hash flow (invite / recovery emails) ─────────────────────
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'invite' | 'recovery' | 'email' | 'signup' | 'magiclink',
    });
    if (error) sessionError = error.message;
  } else {
    sessionError = 'No auth token found in callback URL.';
  }

  if (sessionError) {
    console.error('[auth/callback] Error:', sessionError);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // ── Session established — decide where to send the user ───────────────────
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // If this is an invite or password-recovery, send user to set-password page
  const isSettingPassword = type === 'invite' || type === 'recovery';
  const destination = isSettingPassword ? '/auth/set-password' : next;

  // Log the event (fire-and-forget)
  try {
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
      action:     isSettingPassword ? 'LOGIN' : 'LOGIN',
      details:    isSettingPassword
        ? `User accepted invite — redirected to set password`
        : `User logged in via email link`,
      request,
    });
  } catch {
    // Never block redirect for a logging failure
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
