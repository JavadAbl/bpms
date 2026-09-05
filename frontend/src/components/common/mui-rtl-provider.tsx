'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { useTheme } from 'next-themes';
import { createMuiTheme, type MuiMode } from './mui-theme';

/**
 * MUI provider with RTL emotion cache + MD3 indigo theme (UI redesign Phase 4).
 *
 * IMPORTANT: this provider is intentionally NOT mounted app-wide. It wraps only
 * the MaterialDataGrid subtree (src/components/common/material-data-grid.tsx)
 * so that:
 *   - MUI/emotion bundles load exclusively on list routes (next/dynamic)
 *   - emotion-generated styles can never reorder against Tailwind's global
 *     stylesheet outside the grid (known conflict, plan §6)
 */
export function MUIRTLProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mode: MuiMode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const theme = React.useMemo(() => createMuiTheme(mode), [mode]);

  return (
    <AppRouterCacheProvider
      options={{ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] }}
    >
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
