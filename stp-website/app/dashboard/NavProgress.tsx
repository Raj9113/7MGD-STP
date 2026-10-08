'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { endNav, getNavTarget, startNav, subscribeNav } from '@/lib/nav-pending';

/**
 * Shows a thin progress bar the moment any link is clicked, and a "Loading…" pill if the next page takes longer than a
 * moment, until the new page has arrived.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = pathname + (search ? `?${search}` : '');
  const target = useSyncExternalStore(subscribeNav, getNavTarget, () => null);

  // Catch clicks on any internal link (sidebar, tabs, buttons that are links, ...)
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

  // The new page has arrived
  useEffect(() => {
    if (target !== null && target === current) endNav();
  }, [target, current]);

  if (target === null || target === current) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-[#ffcc00]/40" role="progressbar" aria-label="Loading page">
        <div className="nav-bar h-full w-1/3 rounded-full bg-[#0062b8]" />
      </div>
      <div className="nav-pill pointer-events-none fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#ffcc00] bg-white px-4 py-2 text-sm font-semibold text-[#0062b8] shadow-lg">
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading…
      </div>
    </>
  );
}
