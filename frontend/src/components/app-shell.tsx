'use client';

import { useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList,
  GitBranch,
  Workflow,
  Building2,
  Users,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { TasksView } from '@/components/views/tasks-view';
import { TaskDetailView } from '@/components/views/task-detail-view';
import { InstancesView } from '@/components/views/instances-view';
import { InstanceDetailView } from '@/components/views/instance-detail-view';
import { ProcessesView } from '@/components/views/processes-view';
import { DepartmentsView } from '@/components/views/departments-view';
import { UsersView } from '@/components/views/users-view';
import { ProcessDesignerView } from '@/components/views/process-designer-view';

export type ViewName =
  | 'tasks'
  | 'task-detail'
  | 'instances'
  | 'instance-detail'
  | 'processes'
  | 'process-designer'
  | 'departments'
  | 'users';

interface AppState {
  view: ViewName;
  taskId?: string;
  instanceId?: string;
  processId?: string; // for process-designer (edit mode)
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [state, setState] = useState<AppState>({ view: 'tasks' });

  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { key: 'tasks' as ViewName, label: t.myTasks, icon: ClipboardList, admin: false },
    { key: 'instances' as ViewName, label: t.instances, icon: GitBranch, admin: false },
    { key: 'processes' as ViewName, label: t.processes, icon: Workflow, admin: true },
    { key: 'departments' as ViewName, label: t.departments, icon: Building2, admin: true },
    { key: 'users' as ViewName, label: t.users, icon: Users, admin: true },
  ];

  const navigate = (view: ViewName, taskId?: string, instanceId?: string, processId?: string) => {
    setState({ view, taskId, instanceId, processId });
  };

  // Full-page designer view — no sidebar, takes entire screen
  if (state.view === 'process-designer') {
    return (
      <ProcessDesignerView
        processId={state.processId}
        onBack={() => navigate('processes')}
      />
    );
  }

  const renderView = (): ReactNode => {
    switch (state.view) {
      case 'tasks':
        return <TasksView onViewTask={(id) => navigate('task-detail', id)} />;
      case 'task-detail':
        return state.taskId ? (
          <TaskDetailView
            taskId={state.taskId}
            onBack={() => navigate('tasks')}
          />
        ) : null;
      case 'instances':
        return (
          <InstancesView
            onViewInstance={(id) => navigate('instance-detail', undefined, id)}
          />
        );
      case 'instance-detail':
        return state.instanceId ? (
          <InstanceDetailView
            instanceId={state.instanceId}
            onBack={() => navigate('instances')}
          />
        ) : null;
      case 'processes':
        return isAdmin ? <ProcessesView onOpenDesigner={(pid) => navigate('process-designer', undefined, undefined, pid)} /> : <NoAccess />;
      case 'departments':
        return isAdmin ? <DepartmentsView /> : <NoAccess />;
      case 'users':
        return isAdmin ? <UsersView /> : <NoAccess />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      {/* Sidebar (right side in RTL) */}
      <aside className="w-64 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">{t.appShort}</h1>
              <p className="text-xs text-gray-500">{t.appName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.admin || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const isActive = state.view === item.key ||
                (item.key === 'tasks' && state.view === 'task-detail') ||
                (item.key === 'instances' && state.view === 'instance-detail') ||
                (item.key === 'processes' && state.view === 'process-designer');
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
        </nav>

        <Separator />
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">
                {user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <Badge
                variant="secondary"
                className={`text-xs ${statusColors[user?.role || 'USER']}`}
              >
                {user?.role === 'ADMIN' ? t.ADMIN : t.USER}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start text-gray-600 hover:text-red-600"
          >
            <LogOut className="w-4 h-4 ml-2" />
            {t.logout}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{renderView()}</div>
      </main>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex items-center justify-center h-96 text-gray-500">
      <p>شما به این بخش دسترسی ندارید</p>
    </div>
  );
}
