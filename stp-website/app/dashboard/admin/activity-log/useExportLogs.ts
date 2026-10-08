'use client';

import { useState } from 'react';
import { exportLogsToExcel } from '@/app/actions/logs';
import { downloadBase64Xlsx } from './downloadBase64';

export function useExportLogs() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await exportLogsToExcel();
      if (result.success && result.base64 && result.filename) {
        downloadBase64Xlsx(result.base64, result.filename);
      } else {
        setExportError(result.message ?? 'Export failed.');
      }
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportError, handleExport };
}
