'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, CheckCheck, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Process starters — the "assign" dialog of the BPMN START event.
 *
 * Opened from the designer (right-click on the start element → «تعیین
 * شروع‌کنندگان», or the «شروع: …» chip in the designer header). A process
 * with NO starters can be started by every user; selecting specific users
 * restricts starting to that group (admins always may, so flows never
 * dead-end). The choice is declarative data on the process — no triggers.
 *
 * Edits are staged in the designer state and applied when the user presses
 * «ذخیره» (the same flow as assignments/variables).
 */

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدیر سیستم',
  SENIOR_EXPERT: 'کارشناس ارشد',
  USER: 'کاربر',
};

interface Props {
  open: boolean;
  users: any[];
  /** false = every user may start (empty starter list) */
  restricted: boolean;
  starterIds: string[];
  onChange: (restricted: boolean, starterIds: string[]) => void;
  onClose: () => void;
}

export function ProcessStartersModal({
  open,
  users,
  restricted,
  starterIds,
  onChange,
  onClose,
}: Props) {
  const [localRestricted, setLocalRestricted] = useState(restricted);
  const [localIds, setLocalIds] = useState<string[]>(starterIds);
  const [search, setSearch] = useState('');
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // Re-seed local state each time the dialog (re)opens for a new target state
  const seedKey = `${restricted}|${starterIds.join(',')}`;
  if (open && initializedFor !== seedKey) {
    setInitializedFor(seedKey);
    setLocalRestricted(restricted);
    setLocalIds(starterIds);
    setSearch('');
  }
  if (!open && initializedFor !== null) {
    setInitializedFor(null);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.email}`.includes(q));
  }, [users, search]);

  const toggleUser = (id: string) => {
    setLocalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => setLocalIds(users.map((u) => u.id));
  const clearAll = () => setLocalIds([]);

  const handleConfirm = () => {
    if (localRestricted && localIds.length === 0) {
      // do not close — the user must pick at least one starter
      return;
    }
    onChange(localRestricted, localIds);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              <Users className="w-4 h-4" />
            </span>
            <span className="min-w-0">شروع‌کنندگان فرآیند</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[11px] text-muted-foreground/90 leading-relaxed bg-muted/60 rounded-lg px-2.5 py-2">
            مشخص کنید چه کسانی مجاز به شروع این فرآیند هستند. مدیر سیستم همیشه
            می‌تواند فرآیند را شروع کند. تغییرات با دکمه «ذخیره» در طراح اعمال
            می‌شوند.
          </p>

          {/* Who may start: everyone vs. selected group */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLocalRestricted(false)}
              className={`state-layer p-3 rounded-xl border text-start transition-colors ${
                !localRestricted
                  ? 'border-primary/60 bg-primary/8 text-primary'
                  : 'border-border/60 bg-card text-foreground hover:border-primary/30'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-4 h-4" />
                همه کاربران
              </span>
              <span className="block text-[11px] text-muted-foreground mt-1 leading-relaxed">
                هر کاربری می‌تواند نمونه جدیدی از این فرآیند را شروع کند
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLocalRestricted(true)}
              className={`state-layer p-3 rounded-xl border text-start transition-colors ${
                localRestricted
                  ? 'border-primary/60 bg-primary/8 text-primary'
                  : 'border-border/60 bg-card text-foreground hover:border-primary/30'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <CheckCheck className="w-4 h-4" />
                کاربران منتخب
              </span>
              <span className="block text-[11px] text-muted-foreground mt-1 leading-relaxed">
                فقط کاربران انتخاب‌شده (و مدیر سیستم) مجاز به شروع هستند
              </span>
            </button>
          </div>

          {localRestricted && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="جستجوی کاربر…"
                    className="h-8 text-xs ps-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] px-2.5"
                  onClick={selectAll}
                >
                  انتخاب همه
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] px-2.5"
                  onClick={clearAll}
                >
                  <X className="w-3 h-3 ml-1" />
                  هیچ‌کدام
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40 bg-card">
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    کاربری یافت نشد
                  </p>
                )}
                {filteredUsers.map((u) => {
                  const checked = localIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/60 transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleUser(u.id)}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {u.name}
                        </span>
                        <span
                          className="block text-[11px] text-muted-foreground truncate"
                          dir="ltr"
                        >
                          {u.email}
                        </span>
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </label>
                  );
                })}
              </div>

              <p
                className={`text-[11px] ${
                  localIds.length === 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {localIds.length === 0
                  ? 'حداقل یک کاربر را برای شروع فرآیند انتخاب کنید'
                  : `${localIds.length.toLocaleString('fa-IR')} کاربر انتخاب شده است`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            انصراف
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={localRestricted && localIds.length === 0}
          >
            تأیید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
