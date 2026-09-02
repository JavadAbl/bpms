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
} from 'lucide-react';

export interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  variable?: string;
  placeholder?: string;
  defaultValue?: any;
}

const FIELD_TYPES = [
  { value: 'text', label: 'متن کوتاه', icon: Type, color: 'bg-blue-100 text-blue-600' },
  { value: 'textarea', label: 'متن بلند', icon: AlignLeft, color: 'bg-purple-100 text-purple-600' },
  { value: 'number', label: 'عدد', icon: Hash, color: 'bg-green-100 text-green-600' },
  { value: 'date', label: 'تاریخ', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  { value: 'select', label: 'لیست انتخاب', icon: ListChecks, color: 'bg-cyan-100 text-cyan-600' },
  { value: 'checkbox', label: 'چک‌باکس', icon: CheckSquare, color: 'bg-pink-100 text-pink-600' },
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
        <DialogHeader className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <DialogTitle>{form ? 'ویرایش فرم' : 'ایجاد فرم جدید'}</DialogTitle>
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

        <div className="p-4 space-y-3 border-b border-gray-200">
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
          <div className="w-48 border-l border-gray-200 bg-gray-50 p-3 space-y-1 overflow-y-auto">
            <p className="text-xs font-medium text-gray-500 mb-2">انواع فیلد</p>
            {FIELD_TYPES.map((ft) => {
              const Icon = ft.icon;
              return (
                <button
                  key={ft.value}
                  onClick={() => addField(ft.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-200 cursor-grab"
                >
                  <span className={`w-7 h-7 rounded flex items-center justify-center ${ft.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs">{ft.label}</span>
                </button>
              );
            })}
            <div className="pt-3 mt-2 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                برای افزودن فیلد، روی نوع مورد نظر کلیک کنید
              </p>
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {showPreview ? (
              <PreviewForm fields={fields} />
            ) : showXml ? (
              <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg overflow-auto" dir="ltr">
                {JSON.stringify({ name, description, fields }, null, 2)}
              </pre>
            ) : fields.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
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
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedField === i
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-gray-400">{i + 1}.</span>
                        <span className="font-medium text-sm">{field.label}</span>
                        {field.required && <Badge variant="destructive" className="text-xs">اجباری</Badge>}
                        <Badge variant="outline" className="text-xs">
                          {FIELD_TYPES.find((ft) => ft.value === field.type)?.label || field.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs font-mono" dir="ltr">
                          <Variable className="w-3 h-3 ml-1" />
                          {field.variable || field.name}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(i, 'up'); }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveField(i, 'down'); }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeField(i); }}
                          className="p-1 hover:bg-red-50 text-red-600 rounded"
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
          <div className="w-64 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
            {selectedFieldData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">ویژگی‌های فیلد</p>
                  <button onClick={() => setSelectedField(null)} className="text-gray-400 hover:text-gray-600">
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
                    <p className="text-xs text-gray-400 mt-1">
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

                  <div>
                    <Label className="text-xs">مقدار پیش‌فرض (اختیاری)</Label>
                    <Input
                      value={selectedFieldData.defaultValue || ''}
                      onChange={(e) => updateField(selectedField!, 'defaultValue', e.target.value)}
                      className="h-8 mt-1"
                    />
                  </div>

                  {selectedFieldData.type === 'select' && (
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

                  <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
                    <Checkbox
                      checked={selectedFieldData.required}
                      onCheckedChange={(checked) => updateField(selectedField!, 'required', checked === true)}
                    />
                    اجباری
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                <p className="text-xs">یک فیلد را برای ویرایش انتخاب کنید</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
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

function PreviewForm({ fields }: { fields: FormField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});

  return (
    <div className="max-w-md mx-auto space-y-4">
      <p className="text-sm font-medium text-gray-500 mb-4">پیش‌نمایش فرم (نحوه نمایش به کاربر)</p>
      {fields.map((field, i) => (
        <div key={i} className="space-y-1">
          <Label className="text-sm">
            {field.label}
            {field.required && <span className="text-red-500 mr-1">*</span>}
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
            <Select value={values[field.name] || ''} onValueChange={(v) => setValues({ ...values, [field.name]: v })}>
              <SelectTrigger><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
              <SelectContent>
                {(field.options || []).map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
