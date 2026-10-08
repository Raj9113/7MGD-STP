'use client';

import { useState } from 'react';
import { SITE_MAP, ACCESS_LABELS } from '@/lib/sitemap';

const BADGE: Record<string, string> = {
  public: 'bg-green-100 text-green-700',
  all: 'bg-blue-100 text-blue-700',
  department: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-purple-100 text-purple-700',
};

/** Public site map: lets visitors see what the portal contains before signing in. */
export default function SiteMap() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        id="site-map-button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-semibold text-[#0062b8] hover:underline"
      >
        🗺️ View Site Map
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Site map"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl border-2 border-[#ffcc00] shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-[#0062b8] px-6 py-4 border-b-2 border-[#ffcc00]">
              <h2 className="text-white text-lg font-bold">🗺️ Site Map — 7 MGD STP Portal</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close site map"
                className="text-white text-2xl leading-none hover:text-[#ffcc00]"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {SITE_MAP.map((section) => (
                <section key={section.title}>
                  <h3 className="font-bold text-gray-800">{section.title}</h3>
                  <p className="text-xs text-gray-500 mb-2">{section.note}</p>
                  <ul className="space-y-2">
                    {section.entries.map((e) => (
                      <li key={e.href} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                        <span className="text-xl leading-none">{e.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {e.label} <code className="ml-1 text-xs font-normal text-gray-400">{e.href}</code>
                          </p>
                          <p className="text-xs text-gray-500">{e.description}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE[e.access]}`}>
                          {ACCESS_LABELS[e.access]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="text-xs text-gray-400">Pages other than those under “Before you sign in” will ask you to log in first.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
