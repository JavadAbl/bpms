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
} from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  variable?: string;
  defaultValue?: any;
}

const FIELD_TYPES = [
  { value: 'text', label: 'متن', icon: Type, color: 'bg-blue-100 text-blue-600' },
  { value: 'textarea', label: 'متن بلند', icon: AlignLeft, color: 'bg-purple-100 text-purple-600' },
  { value: 'number', label: 'عدد', icon: Hash, color: 'bg-green-100 text-green-600' },
  { value: 'date', label: 'تاریخ', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  { value: 'select', label: 'لیست', icon: ListChecks, color: 'bg-cyan-100 text-cyan-600' },
  { value: 'checkbox', label: 'چک‌باکس', icon: CheckSquare, color: 'bg-pink-100 text-pink-600' },
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
      <div className="flex-1 bg-black/20" />
      <div
        className="w-[640px] bg-white shadow-2xl flex flex-col h-full ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">{form ? 'ویرایش فرم' : 'ایجاد فرم جدید'}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form info */}
        <div className="p-4 border-b border-gray-200 space-y-3">
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
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">افزودن فیلد:</span>
          {FIELD_TYPES.map((ft) => {
            const Icon = ft.icon;
            return (
              <button
                key={ft.value}
                onClick={() => addField(ft.value)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-gray-50 border border-transparent hover:border-gray-200"
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center ${ft.color}`}>
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
              <div className="flex items-center justify-center h-full text-gray-400">
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
                        <button onClick={(e) => { e.stopPropagation(); moveField(i, 'up'); }} className="p-1 hover:bg-gray-100 rounded">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveField(i, 'down'); }} className="p-1 hover:bg-gray-100 rounded">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeField(i); }} className="p-1 hover:bg-red-50 text-red-600 rounded">
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
          <div className="w-64 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
            {selectedFieldData ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500">ویژگی‌های فیلد</p>
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
                              <span className="text-gray-400 text-xs mr-2">
                                ({v.label} — {v.formName})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">
                        متغیر از تب «متغیرها» تعریف نشده — نام جدید در ذخیره ثبت می‌شود
                      </p>
                    )}

                    <p className="text-[10px] text-gray-400 mt-2 mb-1">یا نام متغیر جدید:</p>
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
                    <p className="text-xs text-gray-400 mt-1">
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
                <p className="text-xs">یک فیلد را انتخاب کنید</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'در حال ذخیره...' : 'ذخیره فرم'}
          </Button>
        </div>
      </div>
    </div>
  );
}
