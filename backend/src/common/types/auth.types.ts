import type { Request } from 'express';

/** Shape of req.user after JwtStrategy.validate() ran (JwtAuthGuard). */
export interface AuthedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

/** Express request augmented with the authenticated user. */
export type AuthedRequest = Request & { user: AuthedUser };
