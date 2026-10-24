'use client';

import { useEffect, useState } from 'react';

type Photo = { src: string; kind: string };

export default function PhotoGallery({ photos, dateLabel }: { photos: Photo[]; dateLabel: string }) {
  const [open, setOpen] = useState<Photo | null>(null);
  const label = (p: Photo) => (p.kind === 'olms' ? 'OLMS analyser display' : 'Inlet & outlet samples');

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ photo: true }, '');
    const onPop = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') window.history.back(); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => window.history.back();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p) => (
          <button key={p.src} type="button" onClick={() => setOpen(p)} className="group block text-left">
            <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <img
                src={p.src}
                alt={`${label(p)}, ${dateLabel}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 group-hover:text-[#0062b8]">{label(p)}</p>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3" onClick={close} role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={close}
            aria-label="Close photo"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold text-gray-800 shadow-lg"
          >
            ×
          </button>
          <img
            src={open.src}
            alt={`${label(open)}, ${dateLabel}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
