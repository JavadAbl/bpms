/**
 * Auth — session types shared by the provider, the login form and the shell.
 */

/**
 * Roles as understood by the backend (Prisma UserRole enum).
 * Single source of truth for every role check in the frontend.
 */
export const ROLES = ['ADMIN', 'SENIOR_EXPERT', 'USER'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Coerce an untrusted value (decoded JWT payload, raw API reply) to a Role.
 * Unknown/legacy values fall back to 'USER' — least privilege.
 */
export function asRole(v: unknown): Role {
  return ROLES.includes(v as Role) ? (v as Role) : 'USER';
}

/** POST /auth/login reply. */
export interface LoginReply {
  accessToken: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: Role;
}

/** Authenticated user as exposed through AuthContext. */
export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: Role;
}
