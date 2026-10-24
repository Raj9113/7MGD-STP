import CenterSpinner from './Spinner';

export default function DashboardLoading() {
  return (
    <div className="max-w-6xl space-y-5" aria-busy="true" aria-live="polite">
      <CenterSpinner />
      <div className="h-24 animate-pulse rounded-xl bg-gray-200/70" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200/70" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-gray-200/70" />
    </div>
  );
}
