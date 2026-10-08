import Spinner from './Spinner';

interface ExportButtonProps {
  isExporting: boolean;
  onExport: () => void;
}

export default function ExportButton({ isExporting, onExport }: ExportButtonProps) {
  return (
    <button
      id="export-activity-log-btn"
      onClick={onExport}
      disabled={isExporting}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
    >
      {isExporting ? (
        <>
          <Spinner className="h-4 w-4" />
          Exporting…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </>
      )}
    </button>
  );
}
