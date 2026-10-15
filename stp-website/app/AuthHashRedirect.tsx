'use client';

import { useEffect } from 'react';

/**
 * When a Supabase email link is not allow-listed, Supabase sends the user to the site root with the session in the URL
 * #fragment (invite / reset links). The server never sees it, so forward recovery and invite links to the set-password page.
 */
export default function AuthHashRedirect() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname.startsWith('/auth/set-password') || !hash.includes('access_token=')) return;
    const type = new URLSearchParams(hash.slice(1)).get('type');
    if (type === 'recovery' || type === 'invite') window.location.replace(`/auth/set-password${hash}`);
  }, []);
  return null;
}
