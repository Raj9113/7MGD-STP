'use client';

import { useState, useCallback, useTransition } from 'react';
import { getLogs, type ActivityLog } from '@/app/actions/logs';
import { PAGE_SIZE } from './constants';

export function useActivityLogs(initialLogs: ActivityLog[], initialTotal: number) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [isPending, startTransition] = useTransition();

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

  function goToPage(nextPage: number) {
    fetchLogs(nextPage, filterAction, filterDateFrom, filterDateTo);
  }

  return {
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
  };
}
