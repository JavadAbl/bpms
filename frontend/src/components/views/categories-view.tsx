'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoriesApi, type Category } from '@/lib/api';
import { invalidateCategories, useCategories } from '@/hooks/use-categories';
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
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import {
  Tags,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Database,
  FileText,
} from 'lucide-react';

interface ItemDraft {
  value: string;
  label: string;
}

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export function CategoriesView() {
  const { categories, loading, reload } = useCategories();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Dialog-local draft state
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    const q = search.trim();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.includes(q) || c.key.includes(q),
    );
  }, [categories, search]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setKey('');
    setKeyTouched(false);
    setDescription('');
    setItems([{ value: '', label: '' }]);
    setShowDialog(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setKey(category.key);
    setKeyTouched(true);
    setDescription(category.description || '');
    setItems(category.items.map((it) => ({ value: it.value, label: it.label })));
    setShowDialog(true);
  };

  /** Auto-slug the key from a latin name; Persian names get manual entry. */
  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyTouched) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setKey(slug);
    }
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, { value: '', label: '' }]);

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, dir: 'up' | 'down') => {
    setItems((prev) => {
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t.error, description: 'نام دسته‌بندی الزامی است', variant: 'destructive' });
      return;
    }
    if (!key.trim() || !KEY_PATTERN.test(key.trim())) {
      toast({ title: t.error, description: 'کلید باید با حرف شروع شود و فقط شامل حروف انگلیسی، رقم و _ باشد', variant: 'destructive' });
      return;
    }
    const cleanItems = items
      .map((it) => ({ value: it.value.trim(), label: it.label.trim() }))
      .filter((it) => it.value || it.label);
    for (const it of cleanItems) {
      if (!it.value || !it.label) {
        toast({ title: t.error, description: 'همه موارد باید مقدار و برچسب داشته باشند', variant: 'destructive' });
        return;
      }
    }
    const values = new Set<string>();
    for (const it of cleanItems) {
      if (values.has(it.value)) {
        toast({ title: t.error, description: `مقدار «${it.value}» تکراری است`, variant: 'destructive' });
        return;
      }
      values.add(it.value);
    }

    setSaving(true);
    try {
      const payload = { key: key.trim(), name: name.trim(), description: description.trim() || undefined, items: cleanItems };
      if (editing) {
        await categoriesApi.update(editing.id, payload);
      } else {
        await categoriesApi.create(payload);
      }
      await reload();
      invalidateCategories(); // refresh form builders / runtime selects
      toast({ title: t.success, description: t.categorySaved });
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: t.error, description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const usageNote = category.usage?.formCount
      ? `\n\n⚠️ این دسته‌بندی در ${category.usage.formCount} فرم استفاده شده: ${category.usage.formNames.join('، ')}`
      : '';
    if (!confirm(`${t.confirmDeleteCategory}${usageNote}`)) return;
    try {
      await categoriesApi.remove(category.id);
      await reload();
      invalidateCategories();
      toast({ title: t.success, description: t.categoryDeleted });
    } catch (err: any) {
      toast({ title: t.error, description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 text-primary" />
            {t.categories}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t.categoriesHint}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="w-3.5 h-3.5 ml-1" />
            {t.refresh}
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5 ml-1" />
            {t.addCategory}
          </Button>
        </div>
      </div>

      {/* Filter row (card layout keeps no grid — search only, plan §5 Phase 4) */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی دسته‌بندی…"
              className="ps-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground/80">
            <Tags className="w-10 h-10 mb-3" />
            <p className="text-sm">{t.noCategories}</p>
            <Button size="sm" variant="outline" onClick={openCreate} className="mt-3">
              <Plus className="w-3.5 h-3.5 ml-1" />
              {t.addCategory}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="md-stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="group transition-shadow hover:shadow-elev-1">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{category.name}</p>
                    <code className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-mono" dir="ltr">
                      {category.key}
                    </code>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(category)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      title={t.edit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="rounded-full p-1.5 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {category.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                )}

                <div className="flex flex-wrap gap-1">
                  {category.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground/80">{t.noItems}</span>
                  ) : (
                    category.items.map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-xs font-normal">
                        {item.label}
                        {item.value !== item.label && (
                          <span className="text-muted-foreground/80 mr-1" dir="ltr">({item.value})</span>
                        )}
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/70">
                  <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {t.itemCount}: {category.items.length}
                  </span>
                  {category.usage?.formCount ? (
                    <span
                      className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1"
                      title={category.usage.formNames.join('، ')}
                    >
                      <FileText className="w-3 h-3" />
                      {category.usage.formCount} فرم
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      {showDialog && (
        <Dialog open onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                  <Tags className="size-4.5" />
                </span>
                {editing ? t.editCategory : t.addCategory}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t.categoryName} *</Label>
                  <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="h-8"
                    placeholder="مثلاً انواع مرخصی"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.categoryKey} *</Label>
                  <Input
                    value={key}
                    onChange={(e) => {
                      setKeyTouched(true);
                      setKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').replace(/^([^a-zA-Z]*)/, ''));
                    }}
                    className="h-8 font-mono text-xs"
                    dir="ltr"
                    placeholder="leave_types"
                  />
                  <p className="text-[10px] text-muted-foreground/80">{t.categoryKeyHint}</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t.categoryDesc}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Items editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t.categoryItems}</Label>
                  <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                    <Plus className="w-3 h-3 ml-1" />
                    {t.addItem}
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground/80 py-3 text-center border border-dashed border-border rounded-lg">
                    {t.noItems}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/80 w-4 text-center">{i + 1}</span>
                        <Input
                          value={item.value}
                          onChange={(e) => updateItem(i, { value: e.target.value })}
                          className="h-8 font-mono text-xs"
                          dir="ltr"
                          placeholder="Sick"
                        />
                        <Input
                          value={item.label}
                          onChange={(e) => updateItem(i, { label: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="مرخصی استعلاجی"
                        />
                        <button
                          onClick={() => moveItem(i, 'up')}
                          disabled={i === 0}
                          className="rounded-full p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-30"
                          title={t.moveUp}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveItem(i, 'down')}
                          disabled={i === items.length - 1}
                          className="rounded-full p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-30"
                          title={t.moveDown}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeItem(i)}
                          className="rounded-full p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                          title={t.delete}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/80">
                  مقدار (value) در داده‌های فرم و متغیرهای فرآیند ذخیره می‌شود؛ برچسب (label) به کاربر نمایش داده می‌شود.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {t.cancel}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '...' : t.save}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
