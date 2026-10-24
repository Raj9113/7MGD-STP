'use client';

import { useEffect } from 'react';

export default function AuthHashRedirect() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname.startsWith('/auth/set-password') || !hash.includes('access_token=')) return;
    const type = new URLSearchParams(hash.slice(1)).get('type');
    if (type === 'recovery' || type === 'invite') window.location.replace(`/auth/set-password${hash}`);
  }, []);
  return null;
}
