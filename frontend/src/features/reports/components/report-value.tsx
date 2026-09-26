'use client';

import { Chip } from '@mui/material';
import { t } from '@/lib/i18n';
import { formatPersianDateOnly } from '@/lib/format';
import { type ReportResultColumn } from '../types';

/**
 * Shared value formatting for the report builder (v6).
 *
 * One formatter feeds every surface so they can never disagree:
 *  - the runner dialog's MUI grid cells (rich: status chips)
 *  - the builder's inline preview table (plain strings)
 *  - the CSV export (plain strings, empty instead of «—»)
 */

export interface FormatOptions {
  /** CSV mode: empty string instead of the «—» placeholder */
  csv?: boolean;
}

/** Plain-string formatting of one raw cell value by its column type. */
export function formatReportValue(
  col: Pick<ReportResultColumn, 'type' | 'options' | 'label'>,
  raw: any,
  opts: FormatOptions = {},
): string {
  const empty = opts.csv ? '' : '—';
  if (raw === null || raw === undefined || raw === '') return empty;

  switch (col.type) {
    case 'status':
      return (t as Record<string, string>)[String(raw)] ?? String(raw);
    case 'date':
      return formatPersianDateOnly(raw) === '—' ? empty : formatPersianDateOnly(raw);
    case 'duration':
      return `${Number(raw).toLocaleString('fa-IR')} ${t.days}`;
    case 'number': {
      const n = Number(raw);
      return isNaN(n) ? String(raw) : n.toLocaleString('fa-IR');
    }
    case 'checkbox':
      return raw === true || raw === 'true' ? 'بله' : 'خیر';
    case 'select': {
      const hit = (col.options || []).find((o) => o.value === String(raw));
      return hit ? hit.label : String(raw);
    }
    case 'file': {
      const metas = Array.isArray(raw) ? raw : [raw];
      const names = metas.filter((m: any) => m?.name).map((m: any) => m.name);
      if (!names.length) return empty;
      return opts.csv
        ? names.join(' | ')
        : `${names.length.toLocaleString('fa-IR')} ${t.filesCount}: ${names.join('، ')}`;
    }
    default:
      return String(raw);
  }
}

/** Status → MUI Chip colors, sourced from the MD3 tokens (theme-aware). */
const statusChipSx: Record<string, Record<string, unknown>> = {
  RUNNING: {
    bgcolor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    color: 'var(--primary)',
    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
  },
  COMPLETED: {
    bgcolor: 'color-mix(in srgb, var(--success) 12%, transparent)',
    color: 'var(--success)',
    border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
  },
  FAILED: {
    bgcolor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
    color: 'var(--destructive)',
    border: '1px solid color-mix(in srgb, var(--destructive) 30%, transparent)',
  },
  TERMINATED: {
    bgcolor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--border)',
  },
};

/**
 * Rich cell renderer for MUI DataGrid renderCell — status columns become
 * outlined chips (MD3 token colors), everything else formatted text.
 * Run inside the grid so MUI theming applies (same pattern as instances-view).
 */
export function ReportGridCell({
  col,
  raw,
}: {
  col: Pick<ReportResultColumn, 'type' | 'options' | 'label'>;
  raw: any;
}) {
  if (col.type === 'status' && raw) {
    const label = (t as Record<string, string>)[String(raw)] ?? String(raw);
    return (
      <Chip
        size="small"
        label={label}
        variant="outlined"
        sx={{
          ...statusChipSx[String(raw)],
          fontWeight: 600,
          fontSize: 12,
          height: 26,
        }}
      />
    );
  }
  const text = formatReportValue(col, raw);
  if (text === '—') {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="truncate text-sm">{text}</span>;
}
