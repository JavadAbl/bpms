import { z } from 'zod';
import { ROLES } from '@/features/auth/types';

/**
 * Roles for the user dialog — alias of the canonical auth ROLES.
 * (Deep import: importing the auth barrel here would cycle, since
 * auth-provider already imports the users slice.)
 */
export const USER_ROLES = ROLES;

/** Shared shape of the create/edit user form. */
export const userFormSchema = z.object({
  name: z.string().trim().min(1, 'نام الزامی است'),
  username: z.string().trim().min(1, 'نام کاربری الزامی است'),
  email: z
    .string()
    .trim()
    .min(1, 'ایمیل الزامی است')
    .pipe(z.email('ایمیل نامعتبر است')),
  /** Sent only when set — required on create, optional on edit. */
  password: z.string(),
  role: z.enum(ROLES),
});

/** Creating a user requires a password. */
export const createUserSchema = userFormSchema.refine(
  (v) => v.password.length > 0,
  { path: ['password'], message: 'رمز عبور الزامی است' },
);

/** Updating: password stays optional (empty = keep current). */
export const updateUserSchema = userFormSchema;

export type UserFormValues = z.infer<typeof userFormSchema>;
