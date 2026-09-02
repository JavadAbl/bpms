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

interface AssignmentData {
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
  forms: any[];
  onChange: (field: string, value: any) => void;
  onClose: () => void;
}

export function TaskAssignmentModal({
  open,
  taskName,
  assignment,
  positions,
  forms,
  onChange,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تخصیص — {taskName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-gray-500">موقعیت</label>
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

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={assignment.selfService || false}
              onCheckedChange={(checked) => onChange('selfService', checked === true)}
            />
            خودخدمت (نیاز به ادعا)
          </label>
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
