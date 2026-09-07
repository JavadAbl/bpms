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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/use-categories';
import { OptionSelect, CategoryChip } from '@/components/common/option-select';
import { FileUploadField } from '@/components/common/file-upload-field';
import { t } from '@/lib/i18n';
import { formsApi } from '@/lib/api';
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
  Eye,
  Code2,
  Lock,
  Paperclip,
} from 'lucide-react';

export interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  /** Reference to a global reusable category (takes precedence over options). */
  categoryId?: string;
  variable?: string;
  placeholder?: string;
  defaultValue?: any;
  /** Read-only at runtime: shows data filled in previous tasks, user cannot edit. */
  readOnly?: boolean;
  /** File fields only: allow multiple attachments (value is always an array of metas). */
  multiple?: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'متن کوتاه', icon: Type, color: 'bg-primary/15 text-primary' },
  { value: 'textarea', label: 'متن بلند', icon: AlignLeft, color: 'bg-primary-container text-primary' },
  { value: 'number', label: 'عدد', icon: Hash, color: 'bg-success/15 text-success' },
  { value: 'date', label: 'تاریخ', icon: Calendar, color: 'bg-warning/15 text-warning' },
  { value: 'select', label: 'لیست انتخاب', icon: ListChecks, color: 'bg-primary/15 text-primary' },
  { value: 'checkbox', label: 'چک‌باکس', icon: CheckSquare, color: 'bg-destructive/10 text-destructive' },
  { value: 'file', label: 'فایل', icon: Paperclip, color: 'bg-success/15 text-success' },
];

interface FormBuilderDialogProps {
  form: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FormBuilderDialog({ form, onClose, onSaved }: FormBuilderDialogProps) {
  const [name, setName] = useState(form?.name || '');
  const [description, setDescription] = useState(form?.description || '');
  const [fields, setFields] = useState<FormField[]>(
    (form?.fields || []).map((f: any) => ({ ...f, variable: f.variable || f.name }))
  );
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { categories } = useCategories();

  const addField = (type: string) => {
    const typeLabel = FIELD_TYPES.find((ft) => ft.value === type)?.label || type;
    const idx = fields.length + 1;
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

  const updateField = (index: number, key: keyof FormField, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    if (selectedField === index) setSelectedField(null);
    else if (selectedField !== null && selectedField > index) setSelectedField(selectedField - 1);
  };

  const moveField = (index: number, dir: 'up' | 'down') => {
    const newFields = [...fields];
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newFields.length) return;
    [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
    setFields(newFields);
    if (selectedField === index) setSelectedField(target);
    else if (selectedField === target) setSelectedField(index);
  };

  const handleSave = async () => {
    if (!name) {
      toast({ title: 'خطا', description: 'نام فرم الزامی است', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const data = { name, description, fields };
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0" dir="rtl">
        <DialogHeader className="p-4 pe-12 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle>{form ? 'ویرایش فرم' : 'ایجاد فرم جدید'}</DialogTitle>
            {/* pe-12 on the header reserves the top-left corner for the dialog's X (RTL: end side) */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showPreview ? 'default' : 'outline'}
                onClick={() => { setShowPreview(!showPreview); setShowXml(false); }}
              >
                <Eye className="w-3.5 h-3.5 ml-1" />
                پیش‌نمایش
              </Button>
              <Button
                size="sm"
                variant={showXml ? 'default' : 'outline'}
                onClick={() => { setShowXml(!showXml); setShowPreview(false); }}
              >
                <Code2 className="w-3.5 h-3.5 ml-1" />
                JSON
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3 border-b border-border">
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

        <div className="flex" style={{ height: '420px' }}>
          {/* Left: Field Palette */}
          <div className="w-48 shrink-0 border-l border-border bg-muted/50 p-3 space-y-1 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">انواع فیلد</p>
            {FIELD_TYPES.map((ft) => {
              const Icon = ft.icon;
              return (
                <button
                  key={ft.value}
                  onClick={() => addField(ft.value)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm text-foreground transition-all border border-transparent hover:border-primary/40 hover:bg-primary/8 hover:text-primary cursor-pointer"
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ft.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs">{ft.label}</span>
                </button>
              );
            })}
            <div className="pt-3 mt-2 border-t border-border">
              <p className="text-xs text-muted-foreground/80">
                برای افزودن فیلد، روی نوع مورد نظر کلیک کنید
              </p>
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 overflow-y-auto p-4 bg-card">
            {showPreview ? (
              <PreviewForm fields={fields} />
            ) : showXml ? (
              <pre className="text-xs text-foreground bg-muted/50 p-3 rounded-lg overflow-auto" dir="ltr">
                {JSON.stringify({ name, description, fields }, null, 2)}
              </pre>
            ) : fields.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground/80">
                <div className="text-center">
                  <p className="text-sm">هنوز فیلدی اضافه نشده</p>
                  <p className="text-xs mt-1">از پنل سمت راست فیلد اضافه کنید</p>
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
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(i, 'up'); }}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(i, 'down'); }}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeField(i); }}
                          className="p-1 hover:bg-destructive/10 text-destructive rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Preview of the field */}
                    <div className="mt-2 opacity-60">
                      {renderFieldPreview(field)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Properties Panel */}
          <div className="w-64 shrink-0 border-r border-border bg-muted/50 p-3 overflow-y-auto">
            {selectedFieldData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">ویژگی‌های فیلد</p>
                  <button onClick={() => setSelectedField(null)} className="text-muted-foreground/80 hover:text-muted-foreground">
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">برچسب (نمایش)</Label>
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
                    <Input
                      value={selectedFieldData.variable || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        updateField(selectedField!, 'variable', val);
                        updateField(selectedField!, 'name', val);
                      }}
                      className="h-8 mt-1 font-mono text-xs"
                      dir="ltr"
                      placeholder="مثال: leaveType"
                    />
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      این نام در شرط‌های دروازه قابل استفاده است
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">نوع فیلد</Label>
                    <Select
                      value={selectedFieldData.type}
                      onValueChange={(v) => updateField(selectedField!, 'type', v)}
                    >
                      <SelectTrigger className="h-8 mt-1 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedFieldData.type !== 'file' && (
                    <div>
                      <Label className="text-xs">مقدار پیش‌فرض (اختیاری)</Label>
                      <Input
                        value={selectedFieldData.defaultValue || ''}
                        onChange={(e) => updateField(selectedField!, 'defaultValue', e.target.value)}
                        className="h-8 mt-1"
                      />
                    </div>
                  )}

                  {selectedFieldData.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">{t.optionsSource}</Label>
                      <Select
                        value={selectedFieldData.categoryId || '__inline__'}
                        onValueChange={(v) => {
                          if (v === '__inline__') {
                            updateField(selectedField!, 'categoryId', undefined);
                          } else {
                            updateField(selectedField!, 'categoryId', v);
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
                          <Label className="text-xs">گزینه‌ها (با کاما جدا کنید)</Label>
                          <Textarea
                            value={(selectedFieldData.options || []).join(', ')}
                            onChange={(e) =>
                              updateField(selectedField!, 'options', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                            }
                            className="mt-1 text-sm min-h-[60px]"
                            placeholder="گزینه۱, گزینه۲, گزینه۳"
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
                        کاربر می‌تواند چند فایل پیوست کند؛ مقدار ذخیره‌شده فهرستی از پیوست‌هاست
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
                <p className="text-xs">یک فیلد را برای ویرایش انتخاب کنید</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره فرم'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderFieldPreview(field: FormField) {
  switch (field.type) {
    case 'textarea':
      return <Textarea disabled placeholder={field.label} className="h-16 text-sm" />;
    case 'number':
      return <Input disabled type="number" placeholder={field.label} className="text-sm" dir="ltr" />;
    case 'date':
      return <Input disabled type="date" className="text-sm" dir="ltr" />;
    case 'file':
      return (
        <FileUploadField
          value={[]}
          onChange={() => {}}
          multiple={!!field.multiple}
          previewMode
        />
      );
    case 'select':
      return (
        <Select disabled value="">
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={field.label} /></SelectTrigger>
        </Select>
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox disabled />
          <span className="text-sm">{field.label}</span>
        </div>
      );
    default:
      return <Input disabled placeholder={field.label} className="text-sm" />;
  }
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

function PreviewForm({ fields }: { fields: FormField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});

  return (
    <div className="max-w-md mx-auto space-y-4">
      <p className="text-sm font-medium text-muted-foreground mb-4">پیش‌نمایش فرم (نحوه نمایش به کاربر)</p>
      {fields.map((field, i) => (
        <div key={i} className="space-y-1">
          <Label className="text-sm">
            {field.label}
            {field.required && <span className="text-destructive mr-1">*</span>}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea
              value={values[field.name] || ''}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              placeholder={field.label}
            />
          ) : field.type === 'number' ? (
            <Input
              type="number"
              value={values[field.name] ?? ''}
              onChange={(e) => setValues({ ...values, [field.name]: Number(e.target.value) })}
              dir="ltr"
            />
          ) : field.type === 'date' ? (
            <Input
              type="date"
              value={values[field.name] || ''}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              dir="ltr"
            />
          ) : field.type === 'select' ? (
            <OptionSelect
              categoryId={field.categoryId}
              options={field.options}
              value={values[field.name] || ''}
              onChange={(v) => setValues({ ...values, [field.name]: v })}
              placeholder="انتخاب کنید"
            />
          ) : field.type === 'file' ? (
            <FileUploadField
              value={values[field.name] || []}
              onChange={(v) => setValues({ ...values, [field.name]: v })}
              multiple={!!field.multiple}
              previewMode
            />
          ) : field.type === 'checkbox' ? (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={values[field.name] || false}
                onCheckedChange={(checked) => setValues({ ...values, [field.name]: checked === true })}
              />
              <span className="text-sm">{field.label}</span>
            </div>
          ) : (
            <Input
              value={values[field.name] || ''}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              placeholder={field.label}
            />
          )}
        </div>
      ))}
    </div>
  );
}
