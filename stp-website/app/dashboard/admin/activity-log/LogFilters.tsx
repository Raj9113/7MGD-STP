import { ACTION_TYPES } from './constants';

interface LogFiltersProps {
  action: string;
  dateFrom: string;
  dateTo: string;
  isPending: boolean;
  onActionChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export default function LogFilters({
  action,
  dateFrom,
  dateTo,
  isPending,
  onActionChange,
  onDateFromChange,
  onDateToChange,
  onApply,
  onClear,
}: LogFiltersProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Action filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Type</label>
          <select
            id="log-filter-action"
            value={action}
            onChange={(e) => onActionChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From Date</label>
          <input
            id="log-filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To Date</label>
          <input
            id="log-filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 justify-end">
          <div className="flex gap-2">
            <button
              id="log-filter-apply-btn"
              onClick={onApply}
              disabled={isPending}
              className="text-sm bg-[#0062b8] text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#004f96] transition-all disabled:opacity-60"
            >
              {isPending ? 'Loading…' : '🔍 Apply'}
            </button>
            <button
              id="log-filter-clear-btn"
              onClick={onClear}
              disabled={isPending}
              className="text-sm bg-white border border-gray-200 text-gray-600 font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
