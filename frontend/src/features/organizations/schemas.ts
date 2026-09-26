import { z } from 'zod';

/** Department form — name required, description optional. */
export const departmentSchema = z.object({
  name: z.string().trim().min(1, 'نام الزامی است'),
  description: z.string(),
});

/** Position form (always scoped to a department). */
export const positionSchema = z.object({
  name: z.string().trim().min(1, 'نام موقعیت الزامی است'),
  description: z.string(),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
export type PositionFormValues = z.infer<typeof positionSchema>;
