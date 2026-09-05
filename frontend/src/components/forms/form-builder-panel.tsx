'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/use-categories';
import { CategoryChip } from '@/components/common/option-select';
import { t } from '@/lib/i18n';
import { formsApi, processesApi } from '@/lib/api';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Type,
  Hash,
  Calendar,
  ListChecks,
  CheckSquare,
  AlignLeft,
  Variable,
  X,
  Lock,
  Paperclip,
} from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  /** Reference to a global reusable category (takes precedence over options). */
  categoryId?: string;
  variable?: string;
  defaultValue?: any;
  /** Read-only at runtime: shows data filled in previous tasks, user cannot edit. */
  readOnly?: boolean;
  /** File fields only: allow multiple attachments (value is always an array of metas). */
  multiple?: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'متن', icon: Type, color: 'bg-primary/15 text-primary' },
  { value: 'textarea', label: 'متن بلند', icon: AlignLeft, color: 'bg-primary-container text-primary' },
  { value: 'number', label: 'عدد', icon: Hash, color: 'bg-success/15 text-success' },
  { value: 'date', label: 'تاریخ', icon: Calendar, color: 'bg-warning/15 text-warning' },
  { value: 'select', label: 'لیست', icon: ListChecks, color: 'bg-primary/15 text-primary' },
  { value: 'checkbox', label: 'چک‌باکس', icon: CheckSquare, color: 'bg-destructive/10 text-destructive' },
  { value: 'file', label: 'فایل', icon: Paperclip, color: 'bg-success/15 text-success' },
];

interface ProcessVariableRef {
  name: string;
  type: string;
  label?: string;
}

interface Props {
  form: any | null;
  processId: string;
  /** Process-level predefined variables (متغیرها tab) */
  processVariables?: ProcessVariableRef[];
  /** All bindable variables including other forms */
  existingVariables?: { name: string; type: string; formName: string; label: string }[];
  onProcessVariablesChange?: (vars: ProcessVariableRef[]) => void;
  onClose: () => void;
  onSaved: () => void;
}

const PICKER_NONE = '__none__';

export function FormBuilderPanel({
  form,
  processId,
  processVariables = [],
  existingVariables = [],
  onProcessVariablesChange,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(form?.name || '');
  const [description, setDescription] = useState(form?.description || '');
  const [fields, setFields] = useState<FormField[]>(
    (form?.fields || []).map((f: any) => ({ ...f, variable: f.variable || f.name }))
  );
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  const addField = (type: string) => {
    const idx = fields.length + 1;
    const typeLabel = FIELD_TYPES.find((ft) => ft.value === type)?.label || type;
    const newField: FormField = {
      name: `var_${idx}`,
      label: `${typeLabel} جدید`,
      type,
      required: false,
      variable: `var_${idx}`,
    };
    setFields([...fields, newField]);
    setSelectedField(fields.length);
  };

  const patchField = (index: number, patch: Partial<FormField>) => {
    setFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const updateField = (index: number, key: keyof FormField, value: any) => {
    patchField(index, { [key]: value });
  };

  const predefinedOptions = [
    ...processVariables.map((v) => ({
      name: v.name,
      type: v.type,
      formName: 'فرآیند',
      label: v.label || v.name,
    })),
    ...existingVariables.filter(
      (v) => !processVariables.some((pv) => pv.name === v.name),
    ),
  ].filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i);

  const bindFieldToVariable = (index: number, varName: string) => {
    const picked = predefinedOptions.find((v) => v.name === varName);
    patchField(index, {
      variable: varName,
      name: varName,
      ...(picked ? { type: picked.type, label: picked.label } : {}),
    });
  };

  const ensureProcessVariables = async (fieldList: FormField[]) => {
    const known = new Set(processVariables.map((v) => v.name));
    const toAdd: ProcessVariableRef[] = [];
    for (const field of fieldList) {
      const varName = (field.variable || field.name || '').trim();
      if (!varName || known.has(varName)) continue;
      known.add(varName);
      toAdd.push({ name: varName, label: field.label, type: field.type });
    }
    if (toAdd.length === 0) return;
    const merged = [...processVariables, ...toAdd];
    await processesApi.setVariables(processId, merged);
    onProcessVariablesChange?.(merged);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    if (selectedField === index) setSelectedField(null);
  };

  const moveField = (index: number, dir: 'up' | 'down') => {
    const newFields = [...fields];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newFields.length) return;
    [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!name) {
      toast({ title: 'خطا', description: 'نام فرم الزامی است', variant: 'destructive' });
      return;
    }
    if (!processId) {
      toast({ title: 'خطا', description: 'فرم باید به یک فرآیند تعلق داشته باشد', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await ensureProcessVariables(fields);
      const data = { name, description, fields, processId };
      if (form) {
        await formsApi.update(form.id, data);
      } else {
        await formsApi.create(data);
      }
      toast({ title: 'موفقیت', description: 'فرم ذخیره شد' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldData = selectedField !== null ? fields[selectedField] : null;

  return (
    <div className="fixed inset-0 z-[60] flex" dir="rtl" onClick={onClose}>
      <div className="flex-1 bg-black/30 backdrop-blur-[1px]" />
      <div
        className="w-[640px] max-w-full bg-card shadow-elev-3 flex flex-col h-full ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-medium flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <ListChecks className="w-4 h-4" />
            </span>
            {form ? 'ویرایش فرم' : 'ایجاد فرم جدید'}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form info */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">نام فرم *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">توضیحات</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8" />
            </div>
          </div>
        </div>

        {/* Field palette */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-1.5 flex-wrap bg-muted/40">
          <span className="text-xs text-muted-foreground ml-1">افزودن فیلد:</span>
          {FIELD_TYPES.map((ft) => {
            const Icon = ft.icon;
            return (
              <button
                key={ft.value}
                onClick={() => addField(ft.value)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-card border border-border hover:border-primary/40 hover:bg-primary/8 hover:text-primary transition-colors"
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${ft.color}`}>
                  <Icon className="w-3 h-3" />
                </span>
                {ft.label}
              </button>
            );
          })}
        </div>

        {/* Main content: fields list + properties */}
        <div className="flex-1 flex overflow-hidden">
          {/* Fields list */}
          <div className="flex-1 overflow-y-auto p-4">
            {fields.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground/80">
                <div className="text-center">
                  <p className="text-sm">هنوز فیلدی اضافه نشده</p>
                  <p className="text-xs mt-1">از پالت بالا فیلد اضافه کنید</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedField(i)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedField === i
                        ? 'border-primary/60 bg-primary/8 ring-2 ring-primary/25'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground/80">{i + 1}.</span>
                        <span className="font-medium text-sm">{field.label}</span>
                        {field.required && <Badge variant="destructive" className="text-xs">اجباری</Badge>}
                        {field.readOnly && (
                          <Badge variant="secondary" className="text-xs gap-1 bg-muted text-muted-foreground">
                            <Lock className="w-3 h-3" />
                            {t.readOnlyField}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {FIELD_TYPES.find((ft) => ft.value === field.type)?.label || field.type}
                        </Badge>
                        {field.type === 'select' && (
                          <CategoryChip categoryId={field.categoryId} />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs font-mono" dir="ltr">
                          <Variable className="w-3 h-3 ml-1" />
                          {field.variable || field.name}
                        </Badge>
                        <button onClick={(e) => { e.stopPropagation(); moveField(i, 'up'); }} className="p-1 hover:bg-accent rounded">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveField(i, 'down'); }} className="p-1 hover:bg-accent rounded">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeField(i); }} className="p-1 hover:bg-destructive/10 text-destructive rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Properties panel */}
          <div className="w-64 shrink-0 border-r border-border bg-muted/50 p-3 overflow-y-auto">
            {selectedFieldData ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">ویژگی‌های فیلد</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">برچسب</Label>
                    <Input
                      value={selectedFieldData.label}
                      onChange={(e) => updateField(selectedField!, 'label', e.target.value)}
                      className="h-8 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Variable className="w-3 h-3" />
                      متغیر فرآیند
                    </Label>

                    {predefinedOptions.length > 0 ? (
                      <Select
                        value={
                          selectedFieldData.variable &&
                          predefinedOptions.some((v) => v.name === selectedFieldData.variable)
                            ? selectedFieldData.variable
                            : PICKER_NONE
                        }
                        onValueChange={(v) => {
                          if (v === PICKER_NONE) return;
                          bindFieldToVariable(selectedField!, v);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="انتخاب از متغیرهای تعریف‌شده" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PICKER_NONE}>— انتخاب متغیر —</SelectItem>
                          {predefinedOptions.map((v) => (
                            <SelectItem key={v.name} value={v.name}>
                              <span className="font-mono text-xs" dir="ltr">{v.name}</span>
                              <span className="text-muted-foreground/80 text-xs mr-2">
                                ({v.label} — {v.formName})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/80 mt-1">
                        متغیر از تب «متغیرها» تعریف نشده — نام جدید در ذخیره ثبت می‌شود
                      </p>
                    )}

                    <p className="text-[10px] text-muted-foreground/80 mt-2 mb-1">یا نام متغیر جدید:</p>
                    <Input
                      value={selectedFieldData.variable || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        patchField(selectedField!, { variable: val, name: val });
                      }}
                      className="h-8 font-mono text-xs"
                      dir="ltr"
                      placeholder="مثال: leaveType"
                    />
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      اگر از لیست انتخاب نکنید، متغیر جدید هنگام ذخیره فرم ایجاد می‌شود
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">نوع</Label>
                    <Select
                      value={selectedFieldData.type}
                      onValueChange={(v) => updateField(selectedField!, 'type', v)}
                    >
                      <SelectTrigger className="h-8 mt-1 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedFieldData.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">{t.optionsSource}</Label>
                      <Select
                        value={selectedFieldData.categoryId || '__inline__'}
                        onValueChange={(v) => {
                          if (v === '__inline__') {
                            patchField(selectedField!, { categoryId: undefined });
                          } else {
                            patchField(selectedField!, { categoryId: v });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 mt-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__inline__">{t.sourceInline}</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              <span className="font-mono text-[10px] text-muted-foreground/80 mr-1" dir="ltr">
                                ({c.key})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedFieldData.categoryId ? (
                        <CategoryOptionsPreview categoryId={selectedFieldData.categoryId} />
                      ) : (
                        <div>
                          <Label className="text-xs">گزینه‌ها</Label>
                          <Textarea
                            value={(selectedFieldData.options || []).join(', ')}
                            onChange={(e) =>
                              updateField(selectedField!, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                            }
                            className="mt-1 text-sm min-h-[60px]"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedFieldData.type === 'file' && (
                    <div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={!!selectedFieldData.multiple}
                          onCheckedChange={(checked) => updateField(selectedField!, 'multiple', checked === true)}
                        />
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                        چند فایل
                      </label>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">
                        مقدار ذخیره‌شده فهرستی از پیوست‌هاست — وظیفه‌های بعدی می‌توانند دانلود کنند
                      </p>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
                    <Checkbox
                      checked={selectedFieldData.required}
                      onCheckedChange={(checked) => updateField(selectedField!, 'required', checked === true)}
                    />
                    اجباری
                  </label>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!selectedFieldData.readOnly}
                      onCheckedChange={(checked) => updateField(selectedField!, 'readOnly', checked === true)}
                    />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.readOnlyField}
                  </label>
                  {selectedFieldData.readOnly && (
                    <p className="text-[10px] text-muted-foreground/80 -mt-1">
                      {t.readOnlyHint}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground/80 mt-8">
                <p className="text-xs">یک فیلد را انتخاب کنید</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره فرم'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Shows the live items of the referenced category inside the properties panel. */
function CategoryOptionsPreview({ categoryId }: { categoryId: string }) {
  const { categories } = useCategories();
  const category = categories.find((c) => c.id === categoryId);

  if (!category) {
    return (
      <p className="text-[10px] text-destructive">
        دسته‌بندی مرجع یافت نشد — ممکن است حذف شده باشد
      </p>
    );
  }

  return (
    <div className="pt-1">
      <p className="text-[10px] text-muted-foreground/80 mb-1">
        گزینه‌ها از دسته‌بندی «{category.name}» خوانده می‌شود
        {category.items.length > 0 ? ` (${category.items.length} مورد)` : ''}
      </p>
      <div className="flex flex-wrap gap-1">
        {category.items.length === 0 ? (
          <span className="text-[10px] text-muted-foreground/80">{t.noItems}</span>
        ) : (
          category.items.map((it) => (
            <Badge key={it.id} variant="secondary" className="text-[10px] font-normal">
              {it.label}
              <span className="text-muted-foreground/80 mr-1" dir="ltr">({it.value})</span>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
