interface PaginationProps {
  page: number;
  totalPages: number;
  shown: number;
  total: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, shown, total, isPending, onPageChange }: PaginationProps) {
  return (
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
      <p className="text-xs text-gray-500">
        Page {page + 1} of {totalPages} · Showing {shown} of {total.toLocaleString('en-IN')} entries
      </p>
      <div className="flex gap-2">
        <button
          id="log-prev-page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || isPending}
          className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
        >
          ← Prev
        </button>
        <button
          id="log-next-page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1 || isPending}
          className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
