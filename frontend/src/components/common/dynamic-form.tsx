'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/lib/i18n';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface DynamicFormProps {
  fields: FormField[];
  /** Initial values keyed by field name. */
  initialValues?: Record<string, any>;
  /** Controlled mode: parent passes value + onChange. */
  values?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  /** Read-only mode (used for previews / submission display). */
  readOnly?: boolean;
  /** Required to silence React warning when embedded in form. */
  id?: string;
}

const FIELD_TYPES: FormField['type'][] = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'checkbox',
];

export function DynamicForm({
  fields,
  initialValues,
  values: controlledValues,
  onChange,
  readOnly = false,
  id,
}: DynamicFormProps) {
  const [internalValues, setInternalValues] = useState<Record<string, any>>(
    () => ({ ...(initialValues ?? {}) }),
  );

  useEffect(() => {
    if (initialValues) {
      setInternalValues((prev) => ({ ...initialValues, ...prev }));
    }
  }, [JSON.stringify(initialValues)]);

  const values = controlledValues ?? internalValues;

  const setField = (name: string, value: any) => {
    const next = { ...values, [name]: value };
    if (controlledValues === undefined) {
      setInternalValues(next);
    }
    onChange?.(next);
  };

  // Hide the unknown-types from being rendered (silently)
  const visibleFields = useMemo(
    () => fields.filter((f) => FIELD_TYPES.includes(f.type) || f.type === 'radio'),
    [fields],
  );

  if (!visibleFields.length) {
    return (
      <p className="text-sm text-muted-foreground">{t.noForm}</p>
    );
  }

  return (
    <div id={id} className="grid gap-4">
      {visibleFields.map((field) => {
        const labelText = `${field.label}${field.required ? ' *' : ''}`;
        if (field.type === 'checkbox') {
          return (
            <div key={field.name} className="flex items-center gap-3">
              <Checkbox
                id={`field-${field.name}`}
                checked={!!values[field.name]}
                onCheckedChange={(v) => setField(field.name, v === true)}
                disabled={readOnly}
              />
              <Label htmlFor={`field-${field.name}`}>{labelText}</Label>
            </div>
          );
        }
        if (field.type === 'textarea') {
          return (
            <div key={field.name} className="grid gap-1.5">
              <Label htmlFor={`field-${field.name}`}>{labelText}</Label>
              <Textarea
                id={`field-${field.name}`}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => setField(field.name, e.target.value)}
                disabled={readOnly}
              />
            </div>
          );
        }
        if (field.type === 'select') {
          const opts = Array.isArray(field.options) ? field.options : [];
          return (
            <div key={field.name} className="grid gap-1.5">
              <Label htmlFor={`field-${field.name}`}>{labelText}</Label>
              <Select
                value={values[field.name] ?? ''}
                onValueChange={(v) => setField(field.name, v)}
                disabled={readOnly || opts.length === 0}
              >
                <SelectTrigger id={`field-${field.name}`} className="w-full">
                  <SelectValue placeholder={opts.length ? t.all : t.noOptions} />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        if (field.type === 'radio') {
          const opts = Array.isArray(field.options) ? field.options : [];
          return (
            <div key={field.name} className="grid gap-1.5">
              <Label>{labelText}</Label>
              <div className="flex flex-wrap gap-3">
                {opts.map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={`field-${field.name}`}
                      value={opt}
                      checked={values[field.name] === opt}
                      onChange={() => setField(field.name, opt)}
                      disabled={readOnly}
                      className="size-4"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          );
        }
        // text, number, date
        return (
          <div key={field.name} className="grid gap-1.5">
            <Label htmlFor={`field-${field.name}`}>{labelText}</Label>
            <Input
              id={`field-${field.name}`}
              type={field.type}
              value={values[field.name] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) =>
                setField(
                  field.name,
                  field.type === 'number'
                    ? e.target.value === ''
                      ? ''
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
              disabled={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Validate a dynamic form. Returns a map of fieldName -> error message.
 * Empty object means valid.
 */
export function validateDynamicForm(
  fields: FormField[],
  values: Record<string, any>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f.required) continue;
    const v = values[f.name];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      errors[f.name] = t.requiredField;
    }
  }
  return errors;
}
