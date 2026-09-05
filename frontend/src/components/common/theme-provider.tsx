'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Dark/light theme provider (UI redesign Phase 1).
 * - class strategy: adds `.dark` to <html> (globals.css token blocks)
 * - persisted in localStorage by next-themes
 * - default: follow system
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
