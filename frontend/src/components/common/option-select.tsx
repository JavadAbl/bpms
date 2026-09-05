'use client';

import { Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { useCategories } from '@/hooks/use-categories';

interface OptionSelectProps {
  /** When set, options come from this global category (item.value stored, item.label shown). */
  categoryId?: string | null;
  /** Inline options fallback (value === label) — used when categoryId is absent. */
  options?: string[];
  value?: any;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  triggerClassName?: string;
}

/**
 * Unified dropdown for form select fields.
 * Resolves options either from a reusable global category or from the
 * field's inline options — shared by form builders, previews and the
 * runtime task view so value/label semantics stay identical everywhere.
 */
export function OptionSelect({
  categoryId,
  options,
  value,
  onChange,
  disabled = false,
  placeholder,
  id,
  triggerClassName,
}: OptionSelectProps) {
  const { categories } = useCategories();

  const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
  const opts = categoryId
    ? (category?.items ?? []).map((it) => ({ value: it.value, label: it.label }))
    : (options ?? []).map((o) => ({ value: o, label: o }));

  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled || opts.length === 0}>
      <SelectTrigger id={id} className={triggerClassName}>
        <SelectValue placeholder={placeholder ?? (opts.length > 0 ? t.all : t.noOptions)} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Small chip showing the name of the category a select field references.
 * Renders nothing when no categoryId is provided.
 */
export function CategoryChip({ categoryId }: { categoryId?: string | null }) {
  const { categories } = useCategories();
  if (!categoryId) return null;
  const category = categories.find((c) => c.id === categoryId);
  return (
    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10 gap-1">
      <Tags className="w-2.5 h-2.5" />
      {category ? category.name : '؟'}
    </Badge>
  );
}
