'use client';

/**
 * useZodForm — minimal zod-backed form state for the hand-rolled MUI/shadcn
 * dialogs. Holds values + per-field errors (keyed by dot-path, e.g.
 * 'email' or 'items.0.value'), validates via the slice's zod schema and
 * returns the PARSED (normalized — trimmed, defaulted) values on success.
 *
 * Intentionally framework-free: no re-render gymnastics, no form library —
 * the schema in each feature slice stays the single source of truth.
 */

import { useCallback, useState } from 'react';
import type { ZodType } from 'zod';

/** Field errors keyed by dot-path ('email', 'items.0.value', …). */
export type ZodFormErrors = Record<string, string>;

export interface ZodForm<T extends object> {
  values: T;
  setValue: <K extends keyof T & string>(key: K, value: T[K]) => void;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  errors: ZodFormErrors;
  /** Message for a field at the given dot-path, if the last validate() flagged it. */
  errorFor: (path: string) => string | undefined;
  /**
   * Validate current values; returns parsed values or null (errors set).
   * Optional overrides let a dialog switch schemas (e.g. create vs update)
   * or validate a derived copy (e.g. rows filtered before checking).
   */
  validate: (overrideSchema?: ZodType<T, any>, overrideValues?: T) => T | null;
  /** Reset to the initial (or given) values, clearing errors. */
  reset: (next?: T) => void;
}

export function useZodForm<T extends object>(
  schema: ZodType<T, any>,
  initial: T,
): ZodForm<T> {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<ZodFormErrors>({});

  const setValue = useCallback(<K extends keyof T & string>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // clear the field's own error (and any nested 'key.*' errors) on edit
    setErrors((e) => {
      const stale = Object.keys(e).filter((k) => k === key || k.startsWith(`${key}.`));
      if (!stale.length) return e;
      const next = { ...e };
      for (const k of stale) delete next[k];
      return next;
    });
  }, []);

  const errorFor = useCallback((path: string) => errors[path], [errors]);

  const validate = useCallback(
    (overrideSchema?: ZodType<T, any>, overrideValues?: T): T | null => {
      const res = (overrideSchema ?? schema).safeParse(overrideValues ?? values);
      if (!res.success) {
        const next: ZodFormErrors = {};
        for (const issue of res.error.issues) {
          const key = issue.path.map(String).join('.') || '_form';
          if (!(key in next)) next[key] = issue.message;
        }
        setErrors(next);
        return null;
      }
      setErrors({});
      return res.data;
    },
    [schema, values],
  );

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initial);
      setErrors({});
    },
    [initial],
  );

  return { values, setValue, setValues, errors, errorFor, validate, reset };
}
