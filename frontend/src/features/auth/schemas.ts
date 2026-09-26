import { z } from 'zod';

/** Login form — both fields required. */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export type LoginValues = z.infer<typeof loginSchema>;
