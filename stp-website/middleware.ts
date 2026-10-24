import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.startsWith('your_') || supabaseKey.startsWith('your_')) {
    console.warn('[middleware] Supabase env vars not configured — skipping auth check');
    return NextResponse.next({ request });
  }

  const stray = request.nextUrl;
  if (stray.searchParams.has('code') && !stray.pathname.startsWith('/auth/callback')) {
    const cb = stray.clone();
    cb.pathname = '/auth/callback';
    cb.searchParams.set('next', '/auth/set-password');
    return NextResponse.redirect(cb);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/auth/callback', '/auth/set-password', '/auth/forgot-password', '/request-access'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  if (user && !pathname.startsWith('/auth/set-password')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .single();
    if (profile?.must_change_password) {
      const spUrl = request.nextUrl.clone();
      spUrl.pathname = '/auth/set-password';
      return NextResponse.redirect(spUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
