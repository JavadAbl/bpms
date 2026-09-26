import { z } from 'zod';

/** Key must start with a letter; latin letters, digits and _ only. */
export const CATEGORY_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const KEY_MESSAGE =
  'کلید باید با حرف شروع شود و فقط شامل حروف انگلیسی، رقم و _ باشد';

/** One option row of a category. */
export const categoryItemSchema = z.object({
  value: z.string().trim().min(1, 'مقدار الزامی است'),
  label: z.string().trim().min(1, 'برچسب الزامی است'),
});

/** Category create/edit form. */
export const categorySchema = z
  .object({
    name: z.string().trim().min(1, 'نام دسته‌بندی الزامی است'),
    key: z.string().trim().regex(CATEGORY_KEY_PATTERN, KEY_MESSAGE),
    description: z.string(),
    items: z.array(categoryItemSchema),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    val.items.forEach((it, i) => {
      if (seen.has(it.value)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'value'],
          message: `مقدار «${it.value}» تکراری است`,
        });
      }
      seen.add(it.value);
    });
  });

export type CategoryItemFormValues = z.infer<typeof categoryItemSchema>;
export type CategoryFormValues = z.output<typeof categorySchema>;
