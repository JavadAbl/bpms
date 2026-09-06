'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { t, statusColors, roleLabel } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { CommandPalette } from '@/components/shell/command-palette';
import { StartProcessDialog } from '@/components/processes/start-process-dialog';
import {
  ClipboardList,
  GitBranch,
  Workflow,
  Building2,
  Users,
  LogOut,
  LayoutDashboard,
  Tags,
  Search,
  Menu,
  PanelRight,
  PanelRightClose,
  Play,
} from 'lucide-react';

/**
 * MD3 app shell (UI redesign Phase 2):
 * top app bar (brand, palette trigger, theme toggle, user menu) +
 * collapsible sidebar (w-64 drawer ⇄ 72px icon rail, mobile sheet) +
 * command palette. Replaces the old useState view-switcher.
 */

const RAIL_KEY = 'bpms.sidebar.rail';

function useNavItems(isAdmin: boolean) {
  return [
    { href: '/dashboard', label: t.dashboard, icon: LayoutDashboard, show: true },
    { href: '/tasks', label: t.myTasks, icon: ClipboardList, show: true },
    { href: '/instances', label: t.instances, icon: GitBranch, show: isAdmin },
    { href: '/processes', label: t.processes, icon: Workflow, show: isAdmin },
    { href: '/admin/departments', label: t.departments, icon: Building2, show: isAdmin },
    { href: '/admin/categories', label: t.categories, icon: Tags, show: isAdmin },
    { href: '/admin/users', label: t.users, icon: Users, show: isAdmin },
  ].filter((item) => item.show);
}

function isActiveHref(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const [rail, setRail] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const navItems = useNavItems(isAdmin);

  // Restore persisted rail state
  useEffect(() => {
    try {
      setRail(localStorage.getItem(RAIL_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  // Global Ctrl/Cmd + K → command palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleRail = () => {
    setRail((r) => {
      try {
        localStorage.setItem(RAIL_KEY, r ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !r;
    });
  };

  const brand = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
        <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="min-w-0">
        <h1 className="text-sm font-bold text-foreground leading-tight">{t.appShort}</h1>
        <p className="text-xs text-muted-foreground truncate">{t.appName}</p>
      </div>
    </div>
  );

  const navButtonClass = (active: boolean, iconOnly = false) =>
    cn(
      'state-layer flex items-center rounded-full text-sm font-medium transition-colors',
      iconOnly ? 'h-10 w-10 justify-center mx-auto' : 'w-full gap-3 px-3 py-2.5',
      active
        ? 'bg-primary-container text-on-primary-container font-semibold'
        : 'text-muted-foreground hover:bg-accent/60'
    );

  const renderNavList = (onNavigate?: () => void, iconOnly = false) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActiveHref(pathname, item.href);
        const button = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={navButtonClass(active, iconOnly)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!iconOnly && item.label}
          </Link>
        );
        return iconOnly ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="left">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      })}
    </>
  );

  const userBox = (
    <div className={cn('flex items-center gap-3', rail && 'justify-center')}>
      <Avatar className="w-9 h-9">
        <AvatarFallback className="bg-primary-container text-on-primary-container text-sm">
          {user?.name?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>
      {!rail && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
          <Badge
            variant="secondary"
            className={`text-xs ${statusColors[user?.role || 'USER']}`}
          >
            {roleLabel(user?.role)}
          </Badge>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar (right side in RTL) */}
      {!isMobile && (
        <aside
          className={cn(
            'sticky top-0 h-screen shrink-0 bg-sidebar border-l border-sidebar-border flex flex-col transition-[width] duration-200 ease-out',
            rail ? 'w-[72px]' : 'w-64'
          )}
        >
          <TooltipProvider delayDuration={200}>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
              {renderNavList(undefined, rail)}
            </nav>
          </TooltipProvider>
          <Separator />
          <div className="p-4">{userBox}</div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* MD3 top app bar */}
        <header className="sticky top-0 z-30 h-16 shrink-0 bg-background/90 backdrop-blur border-b border-border/70 flex items-center gap-2 px-4 md:px-6">
          {/* Start: nav toggles */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t.openMenu}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={rail ? t.expandSidebar : t.collapseSidebar}
            title={rail ? t.expandSidebar : t.collapseSidebar}
            onClick={toggleRail}
          >
            {rail ? <PanelRight className="size-5" /> : <PanelRightClose className="size-5" />}
          </Button>

          {brand}

          {/* End: start process, search, theme, user */}
          <div className="ms-auto flex items-center gap-1.5">
            {/* Start a process — available to every user from the top bar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStartOpen(true)}
              className="gap-1.5 rounded-full h-9 border-primary/30 text-primary hover:bg-primary/8 hover:text-primary"
              aria-label={t.startProcess}
              title={t.startProcess}
            >
              <Play className="size-4" />
              <span className="hidden md:inline text-sm font-medium">{t.startProcess}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex gap-2 rounded-full text-muted-foreground border-border/80 font-normal h-9 ps-3 pe-2"
              aria-label={t.search}
            >
              <Search className="size-4" />
              <span className="text-sm">{t.searchPlaceholder}</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ms-2">
                Ctrl K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label={t.search}
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-5" />
            </Button>
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="state-layer flex items-center gap-2 rounded-full p-1 ps-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={user?.name || t.openMenu}
                >
                  <div className="hidden md:block text-end min-w-0">
                    <p className="text-sm font-medium text-foreground truncate max-w-32">
                      {user?.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {roleLabel(user?.role)}
                    </p>
                  </div>
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-primary-container text-on-primary-container text-sm">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    {user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  {t.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile navigation drawer (right side in RTL) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="w-72 p-0 bg-sidebar flex flex-col">
          <SheetHeader className="p-4 border-b border-sidebar-border">
            <SheetTitle asChild>
              <div>{brand}</div>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {renderNavList(() => setMobileNavOpen(false))}
          </nav>
          <Separator />
          <div className="p-4 space-y-3">
            {userBox}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 ml-2" />
              {t.logout}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Global command palette (Ctrl+K) */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Global start-process dialog (top bar) */}
      <StartProcessDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
