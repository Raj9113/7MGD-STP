// Shown instantly while a dashboard page is being prepared on the server (Next.js loading UI)
export default function DashboardLoading() {
  return (
    <div className="max-w-6xl space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 font-semibold text-[#0062b8]">
        <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading…
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-gray-200/70" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200/70" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-gray-200/70" />
    </div>
  );
}
