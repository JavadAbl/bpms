'use client';

import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '@/lib/api';
import { t, statusColors } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Users, Plus, RefreshCw, Trash2, Edit } from 'lucide-react';

export function UsersView() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.findAll();
      setUsers(data);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return;
    try {
      await usersApi.remove(id);
      toast({ title: 'موفقیت', description: 'کاربر حذف شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

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
          <Users className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.users}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 ml-2" />
            {t.addUser}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-right p-4 font-medium text-gray-600">{t.userName}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.email}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.role}</th>
                  <th className="text-right p-4 font-medium text-gray-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-500 py-8">
                      کاربری یافت نشد
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4 font-medium">{u.name}</td>
                      <td className="p-4 text-gray-600" dir="ltr">{u.email}</td>
                      <td className="p-4">
                        <Badge className={statusColors[u.role]}>
                          {u.role === 'ADMIN' ? t.ADMIN : t.USER}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(u.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
            load();
          }}
        />
      )}
    </div>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'USER');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name || !email) {
      toast({ title: 'خطا', description: 'نام و ایمیل الزامی است', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (user) {
        const data: any = { name, email, role };
        if (password) data.password = password;
        await usersApi.update(user.id, data);
      } else {
        if (!password) {
          toast({ title: 'خطا', description: 'رمز عبور الزامی است', variant: 'destructive' });
          setSaving(false);
          return;
        }
        await usersApi.create({ name, email, password, role });
      }
      toast({ title: 'موفقیت', description: 'کاربر ذخیره شد' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? t.editUser : t.addUser}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>نام *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ایمیل *</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-left" />
          </div>
          <div className="space-y-2">
            <Label>رمز عبور {user ? '(اختیاری برای تغییر)' : '*'}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </div>
          <div className="space-y-2">
            <Label>نقش</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">{t.USER}</SelectItem>
                <SelectItem value="ADMIN">{t.ADMIN}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
