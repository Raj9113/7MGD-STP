'use client';

import { useState } from 'react';
import { fetchFile, saveBlob } from '@/lib/download';
import type { Format } from '../../FormatPicker';

export function useExportLogs() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(format: Format) {
    setIsExporting(true);
    setExportError(null);
    try {
      const { blob, name } = await fetchFile(`/api/admin/activity-log/export?format=${format}`);
      saveBlob(blob, name ?? `7MGD-STP-Activity-Log.${format}`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportError, handleExport };
}
