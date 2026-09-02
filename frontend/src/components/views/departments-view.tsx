'use client';

import { useState, useEffect, useCallback } from 'react';
import { departmentsApi, positionsApi, usersApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Building2, Plus, RefreshCw, Trash2, ChevronDown, ChevronLeft, User, X } from 'lucide-react';

export function DepartmentsView() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showCreatePos, setShowCreatePos] = useState<string | null>(null);
  const [showAssignUser, setShowAssignUser] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, usrs] = await Promise.all([departmentsApi.findAll(), usersApi.findAll()]);
      setDepartments(depts);
      setUsers(usrs);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpanded(newExpanded);
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('آیا از حذف این دپارتمان مطمئن هستید؟')) return;
    try {
      await departmentsApi.remove(id);
      toast({ title: 'موفقیت', description: 'دپارتمان حذف شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeletePos = async (id: string) => {
    if (!confirm('آیا از حذف این موقعیت مطمئن هستید؟')) return;
    try {
      await positionsApi.remove(id);
      toast({ title: 'موفقیت', description: 'موقعیت حذف شد' });
      await load();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveUser = async (positionId: string, userId: string) => {
    try {
      await positionsApi.removeUser(positionId, userId);
      toast({ title: 'موفقیت', description: 'کاربر از موقعیت حذف شد' });
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
          <Building2 className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold">{t.departments}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateDept(true)}>
            <Plus className="w-4 h-4 ml-2" />
            {t.addDepartment}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {departments.map((dept) => (
          <Card key={dept.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleExpand(dept.id)}
                  className="flex items-center gap-2 flex-1 text-right"
                >
                  {expanded.has(dept.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">{dept.name}</p>
                    {dept.description && (
                      <p className="text-xs text-gray-500">{dept.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="mr-2">
                    {dept.positions?.length || 0} موقعیت
                  </Badge>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDept(dept.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {expanded.has(dept.id) && (
                <div className="mt-4 space-y-3 pr-6 border-r-2 border-gray-100">
                  {(dept.positions || []).map((pos: any) => (
                    <div key={pos.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{pos.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {pos.userPositions?.length || 0} نفر
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setShowAssignUser(pos.id)}
                          >
                            <User className="w-3 h-3 ml-1" />
                            افزودن فرد
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-red-600"
                            onClick={() => handleDeletePos(pos.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {pos.userPositions && pos.userPositions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {pos.userPositions.map((up: any) => (
                            <Badge key={up.id} variant="secondary" className="text-xs gap-1">
                              {up.user.name}
                              <button
                                onClick={() => handleRemoveUser(pos.id, up.user.id)}
                                className="mr-1 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCreatePos(dept.id)}
                  >
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    {t.addPosition}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {showCreateDept && (
        <CreateDeptDialog
          onClose={() => setShowCreateDept(false)}
          onCreated={() => {
            setShowCreateDept(false);
            load();
          }}
        />
      )}

      {showCreatePos && (
        <CreatePosDialog
          deptId={showCreatePos}
          onClose={() => setShowCreatePos(null)}
          onCreated={() => {
            setShowCreatePos(null);
            load();
          }}
        />
      )}

      {showAssignUser && (
        <AssignUserDialog
          positionId={showAssignUser}
          users={users}
          onClose={() => setShowAssignUser(null)}
          onAssigned={() => {
            setShowAssignUser(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateDeptDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name) {
      toast({ title: 'خطا', description: 'نام الزامی است', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await departmentsApi.create({ name, description });
      toast({ title: 'موفقیت', description: 'دپارتمان ایجاد شد' });
      onCreated();
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
          <DialogTitle>{t.addDepartment}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>نام *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'در حال ذخیره...' : 'ایجاد'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreatePosDialog({ deptId, onClose, onCreated }: { deptId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name) {
      toast({ title: 'خطا', description: 'نام الزامی است', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await positionsApi.create(deptId, { name, description });
      toast({ title: 'موفقیت', description: 'موقعیت ایجاد شد' });
      onCreated();
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
          <DialogTitle>{t.addPosition}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>نام موقعیت *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مدیر مهندسی" />
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'در حال ذخیره...' : 'ایجاد'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignUserDialog({ positionId, users, onClose, onAssigned }: { positionId: string; users: any[]; onClose: () => void; onAssigned: () => void }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleAssign = async () => {
    if (!selectedUser) {
      toast({ title: 'خطا', description: 'کاربر را انتخاب کنید', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await positionsApi.assignUsers(positionId, [selectedUser]);
      toast({ title: 'موفقیت', description: 'کاربر به موقعیت اضافه شد' });
      onAssigned();
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
          <DialogTitle>افزودن کاربر به موقعیت</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>انتخاب کاربر</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="کاربر را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'در حال ذخیره...' : 'افزودن'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
