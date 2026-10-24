export default function CenterSpinner() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="rounded-full border border-[#ffcc00] bg-white p-3 shadow-xl">
        <svg className="h-9 w-9 animate-spin text-[#0062b8]" fill="none" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    </div>
  );
}
