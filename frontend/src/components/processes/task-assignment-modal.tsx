'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Declarative assignment strategies — the high-level, no-code alternative to
 * ProcessMaker-style triggers. The backend resolves the strategy to concrete
 * users at task-creation time (see ProcessInstancesService.resolveAssignment).
 * Starter-based strategies are TASK-scoped: the designer picks which earlier
 * task's performer the routing follows — not the whole process starter — so
 * different branches can each route to their own performer's manager.
 */
const STRATEGY_OPTIONS = [
  {
    value: 'FIXED_USER',
    label: 'کاربر مشخص',
    hint: 'یک کاربر ثابت که در همین‌جا انتخاب می‌شود',
  },
  {
    value: 'POSITION',
    label: 'سمت مشخص',
    hint: 'هر کاربری که این سمت را دارد می‌تواند وظیفه را انجام دهد',
  },
  {
    value: 'TASK_STARTER',
    label: 'انجام‌دهنده یک وظیفه',
    hint: 'وظیفه به کسی که وظیفه مبدأ را تکمیل کرده است اختصاص می‌یابد',
  },
  {
    value: 'TASK_STARTER_MANAGER',
    label: 'مدیر واحدِ انجام‌دهنده وظیفه',
    hint: 'مدیر واحدِ کسی که وظیفه مبدأ را تکمیل کرده — به‌صورت خودکار از ساختار سازمانی در زمان اجرا پیدا می‌شود',
  },
] as const;

const STARTER_STRATEGIES = ['TASK_STARTER', 'TASK_STARTER_MANAGER'];

interface AssignmentData {
  strategy?: string;
  sourceTaskName?: string;
  positionId?: string;
  assigneeId?: string;
  formId?: string;
  selfService?: boolean;
}

interface Props {
  open: boolean;
  taskName: string;
  assignment: AssignmentData;
  positions: any[];
  users: any[];
  forms: any[];
  // All userTasks of the process — source candidates for starter-based strategies
  tasks: any[];
  onChange: (field: string, value: any) => void;
  onClose: () => void;
}

export function TaskAssignmentModal({
  open,
  taskName,
  assignment,
  positions,
  users,
  forms,
  tasks,
  onChange,
  onClose,
}: Props) {
  const strategy =
    assignment.strategy ||
    (assignment.assigneeId ? 'FIXED_USER' : assignment.positionId ? 'POSITION' : 'FIXED_USER');
  const currentOption = STRATEGY_OPTIONS.find((s) => s.value === strategy);
  const isStarterBased = STARTER_STRATEGIES.includes(strategy);
  // A task cannot reference itself — its performer is unknown when it is created
  const sourceCandidates = tasks.filter((t) => t.name !== taskName);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تخصیص — {taskName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Assignment strategy — declarative, no triggers needed */}
          <div>
            <label className="text-xs text-gray-500">تخصیص به</label>
            <Select
              value={strategy}
              onValueChange={(v) => onChange('strategy', v)}
            >
              <SelectTrigger className="h-9 text-sm mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentOption && (
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                {currentOption.hint}
              </p>
            )}
          </div>

          {isStarterBased && (
            <div>
              <label className="text-xs text-gray-500">وظیفه مبدأ</label>
              <Select
                value={assignment.sourceTaskName || 'none'}
                onValueChange={(v) => onChange('sourceTaskName', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {sourceCandidates.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceCandidates.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5">
                  وظیفه دیگری در این فرآیند وجود ندارد — ابتدا یک وظیفه دیگر اضافه کنید
                </p>
              )}
              {sourceCandidates.length > 0 && !assignment.sourceTaskName && (
                <p className="text-[11px] text-amber-600 mt-1.5">
                  انتخاب وظیفه مبدأ الزامی است — تخصیص بر اساس انجام‌دهنده همان وظیفه حل می‌شود
                </p>
              )}
            </div>
          )}

          {strategy === 'FIXED_USER' && (
            <div>
              <label className="text-xs text-gray-500">کاربر</label>
              <Select
                value={assignment.assigneeId || 'none'}
                onValueChange={(v) => onChange('assigneeId', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {strategy === 'POSITION' && (
            <div>
              <label className="text-xs text-gray-500">سمت</label>
              <Select
                value={assignment.positionId || 'none'}
                onValueChange={(v) => onChange('positionId', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.department?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">فرم</label>
            <Select
              value={assignment.formId || 'none'}
              onValueChange={(v) => onChange('formId', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {strategy === 'POSITION' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={assignment.selfService || false}
                onCheckedChange={(checked) => onChange('selfService', checked === true)}
              />
              خودخدمت (نیاز به ادعا)
            </label>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700">
            تأیید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
