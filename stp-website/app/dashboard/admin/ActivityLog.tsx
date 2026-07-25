'use client';

import { useState, useCallback, useTransition } from 'react';
import { getLogs, exportLogsToExcel, type ActivityLog } from '@/app/actions/logs';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_TYPES = ['ALL', 'LOGIN', 'LOGOUT', 'INVITE_USER', 'UPDATE_ROLE', 'DELETE_USER', 'DATA_ENTRY', 'DATA_UPDATE', 'DATA_DELETE'];

const ACTION_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  LOGIN: { bg: 'bg-green-100', text: 'text-green-700', label: '🔑 Login' },
  LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-600', label: '🚪 Logout' },
  INVITE_USER: { bg: 'bg-blue-100', text: 'text-blue-700', label: '📨 Invite' },
  UPDATE_ROLE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '✏️ Role Change' },
  DELETE_USER: { bg: 'bg-red-100', text: 'text-red-700', label: '🗑 Delete User' },
  DATA_ENTRY: { bg: 'bg-purple-100', text: 'text-purple-700', label: '📝 Data Entry' },
  DATA_UPDATE: { bg: 'bg-orange-100', text: 'text-orange-700', label: '🔄 Data Update' },
  DATA_DELETE: { bg: 'bg-red-100', text: 'text-red-700', label: '❌ Data Delete' },
};

const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return '📱 Android';
    if (/iphone|ipad/i.test(ua)) return '📱 iOS';
    return '📱 Mobile';
  }
  if (/windows/i.test(ua)) return '🖥️ Windows';
  if (/mac/i.test(ua)) return '🖥️ macOS';
  if (/linux/i.test(ua)) return '🖥️ Linux';
  return '🖥️ Desktop';
}

function parseBrowser(ua: string | null): string {
  if (!ua) return '';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/opr\//i.test(ua)) return 'Opera';
  return 'Browser';
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ActivityLogProps {
  initialLogs: ActivityLog[];
  initialTotal: number;
}

export default function ActivityLogPanel({ initialLogs, initialTotal }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchLogs = useCallback(
    (nextPage: number, action: string, dateFrom: string, dateTo: string) => {
      startTransition(async () => {
        const result = await getLogs({
          limit: PAGE_SIZE,
          offset: nextPage * PAGE_SIZE,
          action: action !== 'ALL' ? action : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        if (result.success) {
          setLogs(result.logs);
          setTotal(result.total);
          setPage(nextPage);
        }
      });
    },
    []
  );

  function applyFilters() {
    fetchLogs(0, filterAction, filterDateFrom, filterDateTo);
  }

  function clearFilters() {
    setFilterAction('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    fetchLogs(0, 'ALL', '', '');
  }

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await exportLogsToExcel();
      if (result.success && result.base64 && result.filename) {
        // Decode base64 and trigger download
        const byteChars = atob(result.base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const bytes = new Uint8Array(byteNums);
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setExportError(result.message ?? 'Export failed.');
      }
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

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
        <button
          id="export-activity-log-btn"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
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
      </div>

      {exportError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          ⚠️ {exportError}
        </p>
      )}

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Action filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Type</label>
            <select
              id="log-filter-action"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
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
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To Date</label>
            <input
              id="log-filter-date-to"
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-[#0062b8] outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 justify-end">
            <div className="flex gap-2">
              <button
                id="log-filter-apply-btn"
                onClick={applyFilters}
                disabled={isPending}
                className="text-sm bg-[#0062b8] text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#004f96] transition-all disabled:opacity-60"
              >
                {isPending ? 'Loading…' : '🔍 Apply'}
              </button>
              <button
                id="log-filter-clear-btn"
                onClick={clearFilters}
                disabled={isPending}
                className="text-sm bg-white border border-gray-200 text-gray-600 font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date & Time', 'Action', 'User', 'Department', 'Details', 'Location', 'Device'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-400">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Loading logs…
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="space-y-2">
                      <p className="text-3xl">📭</p>
                      <p>No activity logs found.</p>
                      <p className="text-xs">Events will appear here once users start interacting with the system.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const { date, time } = formatDate(log.created_at);
                  const badge = ACTION_BADGE[log.action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: log.action };
                  const isExpanded = expandedId === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="hover:bg-blue-50/40 transition-colors border-b border-gray-100 cursor-pointer"
                    >
                      {/* Date & Time */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-gray-800 font-medium text-xs">{date}</p>
                        <p className="text-gray-400 text-xs font-mono">{time}</p>
                      </td>

                      {/* Action Badge */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* User */}
                      <td className="px-5 py-3">
                        <p className="text-gray-800 font-semibold text-xs">{log.user_name || '—'}</p>
                        <p className="text-gray-400 text-xs">{log.user_email || ''}</p>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-600">{log.department || '—'}</span>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3 max-w-50">
                        <p className={`text-xs text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {log.details || '—'}
                        </p>
                        {log.details && log.details.length > 80 && (
                          <span className="text-xs text-[#0062b8] font-medium mt-0.5 inline-block">
                            {isExpanded ? '▲ Less' : '▼ More'}
                          </span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-xs text-gray-700">
                          {log.city && log.country ? `${log.city}, ${log.country}` : log.city || log.country || '—'}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{log.ip_address || ''}</p>
                      </td>

                      {/* Device */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-xs text-gray-700">{parseDevice(log.user_agent)}</p>
                        <p className="text-xs text-gray-400">{parseBrowser(log.user_agent)}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page + 1} of {totalPages} · Showing {logs.length} of {total.toLocaleString('en-IN')} entries
            </p>
            <div className="flex gap-2">
              <button
                id="log-prev-page-btn"
                onClick={() => fetchLogs(page - 1, filterAction, filterDateFrom, filterDateTo)}
                disabled={page === 0 || isPending}
                className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
              >
                ← Prev
              </button>
              <button
                id="log-next-page-btn"
                onClick={() => fetchLogs(page + 1, filterAction, filterDateFrom, filterDateTo)}
                disabled={page >= totalPages - 1 || isPending}
                className="text-xs bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ACTION_BADGE).map(([key, val]) => (
          <span key={key} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${val.bg} ${val.text}`}>
            {val.label}
          </span>
        ))}
      </div>
    </div>
  );
}
