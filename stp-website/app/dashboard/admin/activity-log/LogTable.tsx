'use client';

import { useState } from 'react';
import type { ActivityLog } from '@/app/actions/logs';
import LogRow from './LogRow';
import Spinner from './Spinner';

const COLUMNS = ['Date & Time', 'Action', 'User', 'Department', 'Details', 'Location', 'Device'];

interface LogTableProps {
  logs: ActivityLog[];
  isPending: boolean;
}

export default function LogTable({ logs, isPending }: LogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {COLUMNS.map((h) => (
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
                  <Spinner className="h-5 w-5" />
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
            logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                isExpanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
