import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import { faIR as dataGridFA } from '@mui/x-data-grid/locales';
import { faIR as materialFA } from '@mui/material/locale';

/**
 * MUI theme aligned to the MD3 indigo design tokens (ui-redesign-plan §3).
 * Hex values MIRROR src/app/globals.css — keep both in sync when the palette
 * changes. Values are mirrored (not read from computed style) so the DataGrid
 * renders with correct colors on first paint (the grid is dynamically
 * imported client-side; a computed-style read would flash default MUI).
 */

export type MuiMode = 'light' | 'dark';

const tokens: Record<MuiMode, Record<string, string>> = {
  light: {
    background: '#fbf9fe',
    foreground: '#1b1b21',
    card: '#ffffff',
    primary: '#3b5bdb',
    'primary-foreground': '#ffffff',
    'primary-container': '#e1e6ff',
    secondary: '#e3e5f3',
    'secondary-foreground': '#2a2d47',
    muted: '#f1eef9',
    'muted-foreground': '#5a5964',
    destructive: '#ba1a1a',
    'destructive-foreground': '#ffffff',
    success: '#2e7d32',
    'success-foreground': '#ffffff',
    warning: '#b26a00',
    'warning-foreground': '#ffffff',
    border: '#d9d9e3',
  },
  dark: {
    background: '#121317',
    foreground: '#e4e2f0',
    card: '#1e1f26',
    primary: '#bac3ff',
    'primary-foreground': '#1d2874',
    'primary-container': '#3e4cad',
    secondary: '#3f4356',
    'secondary-foreground': '#c4c9dd',
    muted: '#26282f',
    'muted-foreground': '#c0c1ce',
    destructive: '#ffb4ab',
    'destructive-foreground': '#601410',
    success: '#8fd694',
    'success-foreground': '#0d2b10',
    warning: '#ffc46b',
    'warning-foreground': '#4a2800',
    border: '#47464f',
  },
};

export function createMuiTheme(mode: MuiMode) {
  const tk = tokens[mode];
  return createTheme(
    {
    direction: 'rtl',
    palette: {
      mode,
      primary: { main: tk.primary, contrastText: tk['primary-foreground'] },
      secondary: { main: tk.secondary, contrastText: tk['secondary-foreground'] },
      success: { main: tk.success, contrastText: tk['success-foreground'] },
      warning: { main: tk.warning, contrastText: tk['warning-foreground'] },
      error: { main: tk.destructive, contrastText: tk['destructive-foreground'] },
      background: { default: tk.background, paper: tk.card },
      text: { primary: tk.foreground, secondary: tk['muted-foreground'] },
      divider: tk.border,
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        'Vazirmatn, "Segoe UI", Tahoma, Arial, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiDataGrid: {
        defaultProps: {
          localeText: dataGridFA.components.MuiDataGrid.defaultProps.localeText,
          // hide DataGrid's own right-side (LTR) padding tweaks; pagination in faIR
          density: 'standard',
        },
        styleOverrides: {
          root: {
            border: 'none',
            '--DataGrid-rowBorderColor': tk.border,
            '--DataGrid-cellOffsetMultiplier': 2,
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: 'var(--muted)',
              color: 'var(--muted-foreground)',
              fontWeight: 700,
              fontSize: 12.5,
            },
            '& .MuiDataGrid-columnHeader:first-of-type': {
              borderTopRightRadius: 11,
            },
            '& .MuiDataGrid-columnHeader:last-of-type': {
              borderTopLeftRadius: 11,
            },
            '& .MuiDataGrid-cell': {
              fontSize: 13.5,
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'var(--accent)',
              cursor: 'default',
            },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: 'var(--primary-container)',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: 'none',
              minHeight: 52,
            },
            '& .MuiDataGrid-overlay': {
              backgroundColor: 'transparent',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 999 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: { color: 'var(--muted-foreground)' },
        },
      },
    },
    },
    materialFA,
  );
}
