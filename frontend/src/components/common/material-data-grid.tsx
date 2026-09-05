'use client';

import * as React from 'react';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { MUIRTLProvider } from './mui-rtl-provider';

export interface MaterialDataGridProps {
  rows: Record<string, unknown>[];
  columns: GridColDef[];
  getRowId?: (row: Record<string, unknown>) => string;
  onRowClick?: (row: Record<string, unknown>) => void;
  loading?: boolean;
  /** 'cozy' = compact (default), 'comfortable' = taller rows */
  density?: 'cozy' | 'comfortable';
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyTitle?: string;
  /** Minimum grid height in px (autoHeight grids collapse with few/no rows) */
  minHeight?: number;
}

/**
 * MD3-styled MUI X DataGrid with RTL emotion cache, faIR locale and theme
 * tokens. Mounted lazily (next/dynamic, ssr:false) via data-table.tsx so MUI
 * bundles only load on list routes.
 *
 * Column definitions are supplied by the consuming view — renderCell closures
 * run INSIDE this provider, so MUI components (Chip/IconButton) get the theme.
 * Inside MUI components always style via sx + `var(--token)` — never Tailwind
 * classes (emotion×Tailwind order conflict, plan §6).
 */
export default function MaterialDataGrid({
  rows,
  columns,
  getRowId,
  onRowClick,
  loading = false,
  density = 'cozy',
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  emptyTitle = 'موردی یافت نشد',
  minHeight = 320,
}: MaterialDataGridProps) {
  return (
    <MUIRTLProvider>
      <div className="[&_.MuiDataGrid-main]:bg-card [&_.MuiDataGrid-main]:rounded-xl overflow-hidden rounded-xl border border-border/70">
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          onRowClick={(params) => onRowClick?.(params.row as Record<string, unknown>)}
          loading={loading}
          density={density === 'cozy' ? 'standard' : 'comfortable'}
          autoHeight
          pageSizeOptions={pageSizeOptions}
          initialState={{
            pagination: { paginationModel: { pageSize, page: 0 } },
          }}
          disableColumnMenu
          hideFooterSelectedRowCount
          sx={{
            // Apply the height floor only when the list is empty — with rows,
            // autoHeight must hug the content, otherwise the root stretches
            // and the pagination drifts away from the last row (blank gap).
            ...(rows.length === 0 ? { minHeight } : {}),
            '& .MuiDataGrid-row': {
              cursor: onRowClick ? 'pointer' : 'default',
            },
          }}
          slots={{
            noRowsOverlay: () => (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                {emptyTitle}
              </div>
            ),
          }}
          showCellVerticalBorder={false}
        />
      </div>
    </MUIRTLProvider>
  );
}
