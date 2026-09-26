/**
 * Auth — session types shared by the provider, the login form and the shell.
 */

/** POST /auth/login reply. */
export interface LoginReply {
  accessToken: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

/** Authenticated user as exposed through AuthContext. */
export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
}
