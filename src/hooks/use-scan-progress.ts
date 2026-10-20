/**
 * The progress of the library scans (folder scan, resynchronization, organization), for the sidebar.
 * @module
 */
import { useEffect, useState } from 'react';

import type { ScanProgress } from '@/shared/library';

/**
 * The latest progress pushed by the main process while a scan runs, `null` when none does. Follows
 * every run, including a resynchronization started at launch or from another window.
 */
export function useScanProgress(): ScanProgress | null {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  useEffect(() => window.tankobon.library.onScanProgress((p) => setProgress(p.phase === 'done' ? null : p)), []);
  return progress;
}
