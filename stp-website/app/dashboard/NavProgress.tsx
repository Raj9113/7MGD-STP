'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import CenterSpinner from './Spinner';
import { endNav, getNavTarget, startNav, subscribeNav } from '@/lib/nav-pending';

export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = pathname + (search ? `?${search}` : '');
  const target = useSyncExternalStore(subscribeNav, getNavTarget, () => null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      startNav(a.href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (target !== null && target === current) endNav();
  }, [target, current]);

  if (target === null || target === current) return null;
  return <CenterSpinner />;
}
