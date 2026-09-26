import { z } from 'zod';
import {
  buildFinalBody,
  type ConditionRow,
  type ConditionVariable,
} from './condition-expression';

/* ================= Process designer (meta form + save gates) ================= */

/**
 * The designer's save-time contract, applied before the mutation fires:
 *  - a name and a drawn diagram are mandatory
 *  - a restricted process must name at least one starter (else nobody but
 *    admins could ever start it)
 */
export const processDesignSchema = z
  .object({
    name: z.string().trim().min(1, 'نام فرآیند الزامی است'),
    description: z.string(),
    bpmnXml: z.string().min(1, 'طراحی فرآیند الزامی است — ابتدا نمودار را ترسیم کنید'),
    startersRestricted: z.boolean(),
    starterIds: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.startersRestricted && v.starterIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['starterIds'],
        message: 'اگر شروع فرآیند محدود است، حداقل یک کاربر را انتخاب کنید',
      });
    }
  });

export type ProcessDesignValues = z.infer<typeof processDesignSchema>;

/* ================= Form builder (no-code form definitions) ================= */

const VARIABLE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * A field row in the form builder. `looseObject` keeps unknown/runtime keys
 * (e.g. per-field extras the engine stores) so parsing never drops data,
 * while the known keys stay strongly typed for the builder UI.
 */
export const formFieldSchema = z.looseObject({
  name: z.string(),
  label: z.string().trim().min(1, 'برچسب فیلد الزامی است'),
  type: z.string().min(1),
  variable: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  /** Reference to a global reusable category (takes precedence over options). */
  categoryId: z.string().optional(),
  placeholder: z.string().optional(),
  /** Read-only at runtime: shows data filled in previous tasks. */
  readOnly: z.boolean().optional(),
  /** File fields only: allow multiple attachments. */
  multiple: z.boolean().optional(),
  /** Runtime-only: default value applied when prefilling empty fields. */
  defaultValue: z.any().optional(),
});

export type FormBuilderField = z.infer<typeof formFieldSchema>;

/**
 * Save contract for the form builder panel:
 *  - the form itself needs a name
 *  - every field needs a label and a valid, unique process-variable name
 *    (duplicates would silently overwrite each other in process variables)
 */
export const formBuilderSchema = z
  .object({
    name: z.string().trim().min(1, 'نام فرم الزامی است'),
    description: z.string(),
    fields: z.array(formFieldSchema),
  })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.fields.forEach((f, i) => {
      const varName = (f.variable || f.name || '').trim();
      if (!varName) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', i, 'variable'],
          message: 'نام متغیر الزامی است',
        });
        return;
      }
      if (!VARIABLE_RE.test(varName)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', i, 'variable'],
          message: 'نام متغیر فقط می‌تواند از حرف انگلیسی، عدد و ـ تشکیل شود',
        });
        return;
      }
      const firstAt = seen.get(varName);
      if (firstAt !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', i, 'variable'],
          message: `متغیر «${varName}» تکراری است — هر فیلد باید متغیر یکتایی داشته باشد`,
        });
      } else {
        seen.set(varName, i);
      }
    });
  });

export type FormBuilderValues = z.infer<typeof formBuilderSchema>;

/* ================= Gateway condition rows (save-time PASS 1) ================= */

/**
 * Validates the gateway modal's flow rows with the exact historical rules:
 *  1. simple mode: a numeric variable rejects non-numeric values; a half-filled
 *     row (variable or value alone) is invalid
 *  2. the FINAL script body must compile — `new Function` performs the same
 *     syntax check the engine's vm would, so a SyntaxError here means the
 *     gateway would throw at runtime
 *
 * Returns errors keyed by flowId (the modal renders one message per row).
 */
export function validateGatewayRows(
  rows: ConditionRow[],
  variables: ConditionVariable[],
): Record<string, string> {
  const rowSchema = z
    .array(z.any())
    .superRefine((list, ctx) => {
      (list as ConditionRow[]).forEach((row, i) => {
        const finalBody = buildFinalBody(row, variables);

        // Simple mode with partial/invalid input
        if (!row.isDefault && !row.rawScript && row.mode === 'simple') {
          const meta = variables.find((v) => v.name === row.variable);
          const invalidNumber =
            meta &&
            ['number', 'integer', 'float'].includes(meta.type) &&
            row.value.trim() !== '' &&
            !/^-?\d+(\.\d+)?$/.test(row.value.trim());
          if (invalidNumber) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'value'],
              message: 'مقدار عددی نامعتبر است',
            });
            return;
          }
          const hasPartial = row.variable !== '' || row.value.trim() !== '';
          if (hasPartial && !finalBody) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'variable'],
              message: 'انتخاب متغیر و مقدار الزامی است',
            });
            return;
          }
        }

        // Syntax-check the exact script body the engine will compile.
        // new Function compiles WITHOUT running — a SyntaxError here means the
        // engine would throw at runtime, so the save is rejected.
        if (finalBody) {
          try {
            // eslint-disable-next-line no-new-func
            new Function('next', 'environment', finalBody);
          } catch (e: any) {
            ctx.addIssue({
              code: 'custom',
              path: [i, 'expression'],
              message: `عبارت جاوااسکریپت نامعتبر است: ${e?.message || e}`,
            });
          }
        }
      });
    });

  const res = rowSchema.safeParse(rows);
  if (res.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const idx = Number(issue.path[0]);
    const row = rows[idx];
    if (row && !(row.flowId in errors)) errors[row.flowId] = issue.message;
  }
  return errors;
}
