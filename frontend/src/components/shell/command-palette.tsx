'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { tasksApi, processesApi } from '@/lib/api';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  ClipboardList,
  GitBranch,
  History,
  Workflow,
  Building2,
  Tags,
  Users,
  SunMoon,
  LogOut,
  Play,
} from 'lucide-react';

/**
 * Global command palette (UI redesign Phase 2).
 * Ctrl/Cmd+K or the app-bar search trigger opens it: navigation,
 * my pending tasks, active processes (start instance) and actions
 * (toggle theme, logout). Persian labels throughout.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<any[]>([]);

  const isAdmin = user?.role === 'ADMIN';

  // Note: the Ctrl/Cmd+K hotkey lives in AppShell (single owner) to avoid
  // double-toggle when both handlers would fire on the same event.

  // Fetch palette data when opened
  useEffect(() => {
    if (!open) return;
    let alive = true;
    tasksApi
      .mine()
      .then((data) => {
        if (!alive) return;
        setPendingTasks(
          (data || []).filter((x: any) => x.status === 'PENDING').slice(0, 6)
        );
      })
      .catch(() => {});
    processesApi
      .findAll()
      .then((data) => {
        if (!alive) return;
        setActiveProcesses(
          (data || []).filter((p: any) => p.status === 'ACTIVE').slice(0, 6)
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const navItems = [
    { href: '/dashboard', label: t.dashboard, icon: LayoutDashboard, show: true },
    { href: '/tasks', label: t.myTasks, icon: ClipboardList, show: true },
    { href: '/tasks/participated', label: t.participatedTasks, icon: History, show: true },
    { href: '/instances', label: t.instances, icon: GitBranch, show: isAdmin },
    { href: '/processes', label: t.processes, icon: Workflow, show: isAdmin },
    { href: '/admin/departments', label: t.departments, icon: Building2, show: isAdmin },
    { href: '/admin/categories', label: t.categories, icon: Tags, show: isAdmin },
    { href: '/admin/users', label: t.users, icon: Users, show: isAdmin },
  ].filter((item) => item.show);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.commandPaletteTitle}
      description={t.commandPaletteDesc}
      className="rounded-[28px]"
    >
      <CommandInput placeholder={t.searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{t.noResults}</CommandEmpty>

        <CommandGroup heading={t.navigationGroup}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                onSelect={() => run(() => router.push(item.href))}
              >
                <Icon className="mr-2 rtl:ml-2 rtl:mr-0" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {pendingTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.myPendingTasksGroup}>
              {pendingTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task-${task.id}-${task.name || ''}`}
                  onSelect={() => run(() => router.push(`/tasks/${task.id}`))}
                >
                  <ClipboardList className="mr-2 rtl:ml-2 rtl:mr-0" />
                  <span className="truncate">{task.name}</span>
                  {task.processInstance?.process?.name && (
                    <span className="text-xs text-muted-foreground ms-2 truncate">
                      — {task.processInstance.process.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {activeProcesses.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.startInstanceGroup}>
              {activeProcesses.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`process-${p.id}-${p.name || ''}`}
                  onSelect={() =>
                    run(() => router.push(`/instances?start=${p.id}`))
                  }
                >
                  <Play className="mr-2 rtl:ml-2 rtl:mr-0" />
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground ms-2">
                    (v{p.version})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading={t.actionsGroup}>
          <CommandItem
            onSelect={() =>
              run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))
            }
          >
            <SunMoon className="mr-2 rtl:ml-2 rtl:mr-0" />
            {t.toggleThemeAction}
            <span className="text-xs text-muted-foreground ms-2">
              ({resolvedTheme === 'dark' ? t.themeLight : t.themeDark})
            </span>
          </CommandItem>
          <CommandItem onSelect={() => run(logout)}>
            <LogOut className="mr-2 rtl:ml-2 rtl:mr-0" />
            {t.logoutAction}
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-3">
        <span>↑↓ حرکت</span>
        <span>Enter انتخاب</span>
        <span>Esc بستن</span>
        <span className="ms-auto font-mono">Ctrl K</span>
      </div>
    </CommandDialog>
  );
}
