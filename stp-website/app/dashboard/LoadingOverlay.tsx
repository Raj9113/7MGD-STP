'use client';

/** Full-screen "working" screen: dims the page, blocks clicks and says what is happening (saving, preparing a download…). */
export default function LoadingOverlay({ show, text = 'Please wait…' }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div role="alert" aria-live="assertive" aria-busy="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-[#ffcc00] bg-white px-10 py-7 shadow-2xl">
        <svg className="h-10 w-10 animate-spin text-[#0062b8]" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm font-semibold text-gray-700">{text}</p>
        <p className="text-xs text-gray-400">Please do not close or refresh this page.</p>
      </div>
    </div>
  );
}
