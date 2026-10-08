'use client';

import type { ActivityLog } from '@/app/actions/logs';
import BadgeLegend from './BadgeLegend';
import ExportButton from './ExportButton';
import LogFilters from './LogFilters';
import LogTable from './LogTable';
import Pagination from './Pagination';
import { useActivityLogs } from './useActivityLogs';
import { useExportLogs } from './useExportLogs';

interface ActivityLogProps {
  initialLogs: ActivityLog[];
  initialTotal: number;
}

export default function ActivityLogPanel({ initialLogs, initialTotal }: ActivityLogProps) {
  const {
    logs,
    total,
    page,
    totalPages,
    isPending,
    filterAction,
    filterDateFrom,
    filterDateTo,
    setFilterAction,
    setFilterDateFrom,
    setFilterDateTo,
    applyFilters,
    clearFilters,
    goToPage,
  } = useActivityLogs(initialLogs, initialTotal);
  const { isExporting, exportError, handleExport } = useExportLogs();

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">📋 Activity Audit Log</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString('en-IN')} event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <ExportButton isExporting={isExporting} onExport={handleExport} />
      </div>

      {exportError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          ⚠️ {exportError}
        </p>
      )}

      <LogFilters
        action={filterAction}
        dateFrom={filterDateFrom}
        dateTo={filterDateTo}
        isPending={isPending}
        onActionChange={setFilterAction}
        onDateFromChange={setFilterDateFrom}
        onDateToChange={setFilterDateTo}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <LogTable logs={logs} isPending={isPending} />
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            shown={logs.length}
            total={total}
            isPending={isPending}
            onPageChange={goToPage}
          />
        )}
      </div>

      <BadgeLegend />
    </div>
  );
}
