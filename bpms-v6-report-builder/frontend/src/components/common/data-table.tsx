'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '@/components/common/loaders';
import type { MaterialDataGridProps } from './material-data-grid';

export type { MaterialDataGridProps };

/**
 * Lazy-loaded DataGrid (client-only). Keeps MUI/emotion out of the initial
 * bundle and off every route that does not list tabular data (plan §4 Phase 4).
 */
const MaterialDataGrid = dynamic(() => import('./material-data-grid'), {
  ssr: false,
  loading: () => <TableSkeleton rows={6} cols={5} />,
});

export function DataTable(props: MaterialDataGridProps) {
  return <MaterialDataGrid {...props} />;
}
