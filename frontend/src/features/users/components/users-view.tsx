'use client';

import { useState, useMemo } from 'react';
import { usersApi } from '../api';
import { useUsers, useDeleteUser, useInvalidateUsers } from '../hooks';
import { createUserSchema, updateUserSchema, USER_ROLES } from '../schemas';
import type { UserFormValues } from '../schemas';
import { useZodForm } from '@/hooks/use-zod-form';
import { t, roleLabel } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
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
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import type { GridColDef } from '@mui/x-data-grid';
import { Chip, IconButton } from '@mui/material';
import { Users, UserPlus, Pencil, Plus, RefreshCw, Trash2, Edit, Search } from 'lucide-react';

const roleChipSx: Record<string, Record<string, unknown>> = {
  ADMIN: {
    bgcolor: 'var(--primary-container)',
    color: 'var(--on-primary-container)',
  },
  SENIOR_EXPERT: {
    bgcolor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    color: 'var(--primary)',
  },
  USER: {
    bgcolor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
  },
};

export function UsersView() {
  const [editUser, setEditUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const { users, loading, refetch } = useUsers();
  const invalidateUsers = useInvalidateUsers();

  const deleteMutation = useDeleteUser({
    onSuccess: () => toast({ title: 'موفقیت', description: 'کاربر حذف شد' }),
  });

  const handleDelete = (id: string) => {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    deleteMutation.mutate(id);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (search) {
        const q = search.trim();
        if (q && !`${u.name} ${u.username} ${u.email}`.includes(q)) return false;
      }
      return true;
    });
  }, [users, roleFilter, search]);

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t.userName,
      flex: 1.2,
      minWidth: 160,
      renderCell: (p) => <span className="truncate font-semibold">{p.value as string}</span>,
    },
    {
      field: 'username',
      headerName: t.username,
      flex: 1,
      minWidth: 120,
      renderCell: (p) => (
        <span className="truncate text-muted-foreground" dir="ltr">
          {p.value as string}
        </span>
      ),
    },
    {
      field: 'email',
      headerName: t.email,
      flex: 1.4,
      minWidth: 200,
      renderCell: (p) => (
        <span className="truncate text-muted-foreground" dir="ltr">
          {p.value as string}
        </span>
      ),
    },
    {
      field: 'role',
      headerName: t.role,
      width: 130,
      renderCell: (p) => {
        const role = p.row.role as string;
        return (
          <Chip
            size="small"
            label={roleLabel(role)}
            sx={{
              ...(roleChipSx[role] || roleChipSx.USER),
              fontWeight: 600,
              fontSize: 12,
              height: 26,
            }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: t.actions,
      width: 110,
      sortable: false,
      renderCell: (p) => (
        <span className="flex items-center gap-1">
          <IconButton
            size="small"
            aria-label={t.edit}
            title={t.edit}
            sx={{ color: 'var(--primary)' }}
            onClick={() => setEditUser(p.row)}
          >
            <Edit size={16} />
          </IconButton>
          <IconButton
            size="small"
            aria-label={t.delete}
            title={t.delete}
            sx={{
              color: 'var(--destructive)',
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
              },
            }}
            onClick={() => handleDelete(p.row.id)}
          >
            <Trash2 size={16} />
          </IconButton>
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{t.users}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 ml-2" />
            {t.addUser}
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام یا ایمیل…"
              className="ps-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t.role} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.all}</SelectItem>
              <SelectItem value="ADMIN">{t.ADMIN}</SelectItem>
              <SelectItem value="SENIOR_EXPERT">{t.SENIOR_EXPERT}</SelectItem>
              <SelectItem value="USER">{t.USER}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Data grid */}
      <DataTable
        rows={filteredUsers}
        columns={columns}
        getRowId={(row) => row.id as string}
        emptyTitle={t.noUsers}
      />

      {(showCreate || editUser) && (
        <UserDialog
          user={editUser}
          onClose={() => {
            setShowCreate(false);
            setEditUser(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditUser(null);
            invalidateUsers();
          }}
        />
      )}
    </div>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { values, setValue, errorFor, validate } = useZodForm<UserFormValues>(updateUserSchema, {
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    role: (user?.role as UserFormValues['role']) || 'USER',
  });

  const handleSave = async () => {
    // create requires a password; update keeps it optional
    const parsed = validate(user ? updateUserSchema : createUserSchema);
    if (!parsed) return;
    setSaving(true);
    try {
      if (user) {
        const data: Record<string, unknown> = {
          name: parsed.name,
          username: parsed.username,
          email: parsed.email,
          role: parsed.role,
        };
        if (parsed.password) data.password = parsed.password;
        await usersApi.update(user.id, data);
      } else {
        await usersApi.create(parsed);
      }
      toast({ title: 'موفقیت', description: 'کاربر ذخیره شد' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof UserFormValues) =>
    errorFor(key) ? <p className="text-xs text-destructive">{errorFor(key)}</p> : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              {user ? <Pencil className="size-4.5" /> : <UserPlus className="size-4.5" />}
            </span>
            {user ? t.editUser : t.addUser}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-medium">نام *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValue('name', e.target.value)}
              aria-invalid={!!errorFor('name')}
            />
            {fieldError('name')}
          </div>
          <div className="space-y-2">
            <Label className="font-medium">{t.username} *</Label>
            <Input
              value={values.username}
              onChange={(e) => setValue('username', e.target.value)}
              aria-invalid={!!errorFor('username')}
              dir="ltr"
              className="text-left"
              autoComplete="off"
            />
            {fieldError('username')}
          </div>
          <div className="space-y-2">
            <Label className="font-medium">ایمیل *</Label>
            <Input
              value={values.email}
              onChange={(e) => setValue('email', e.target.value)}
              aria-invalid={!!errorFor('email')}
              dir="ltr"
              className="text-left"
            />
            {fieldError('email')}
          </div>
          <div className="space-y-2">
            <Label className="font-medium">رمز عبور {user ? '(اختیاری برای تغییر)' : '*'}</Label>
            <Input
              type="password"
              value={values.password}
              onChange={(e) => setValue('password', e.target.value)}
              aria-invalid={!!errorFor('password')}
              dir="ltr"
              className="text-left"
            />
            {fieldError('password')}
          </div>
          <div className="space-y-2">
            <Label className="font-medium">نقش</Label>
            <Select value={values.role} onValueChange={(v) => setValue('role', v as UserFormValues['role'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
