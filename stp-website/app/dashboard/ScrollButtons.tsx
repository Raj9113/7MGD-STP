'use client';

import { useEffect, useState } from 'react';

const OFFSET = 120;

export default function ScrollButtons() {
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setCanUp(max > OFFSET && window.scrollY > OFFSET);
      setCanDown(max > OFFSET && window.scrollY < max - OFFSET);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  if (!canUp && !canDown) return null;

  const go = (top: number) => window.scrollTo({ top, behavior: 'smooth' });
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-[#ffcc00] bg-white text-[#0062b8] shadow-lg active:bg-gray-100';

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col gap-2 print:hidden">
      {canUp && (
        <button type="button" className={btn} aria-label="Scroll to top" onClick={() => go(0)}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
      {canDown && (
        <button type="button" className={btn} aria-label="Scroll to bottom" onClick={() => go(document.documentElement.scrollHeight)}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
