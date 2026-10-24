'use client';

import { useEffect, useRef, useState } from 'react';

const TRIGGER = 80;
const MAX_PULL = 120;

const atTop = (el: Element | null) => {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) return false;
  }
  return window.scrollY <= 0;
};

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      start.current = e.touches.length === 1 && atTop(e.target as Element) ? e.touches[0].clientY : null;
      distance.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) {
        distance.current = 0;
        setPull(0);
        return;
      }
      distance.current = Math.min(dy * 0.5, MAX_PULL);
      setPull(distance.current);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (distance.current >= TRIGGER) {
        setRefreshing(true);
        window.location.reload();
      } else {
        setPull(0);
      }
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center" style={{ transform: `translateY(${refreshing ? 24 : pull - 16}px)` }}>
      <div className="rounded-full border border-[#ffcc00] bg-white p-2 shadow-lg">
        <svg
          className={`h-6 w-6 text-[#0062b8] ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.6 }}
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    </div>
  );
}
