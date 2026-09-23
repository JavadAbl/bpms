import { User, UserRole } from '#common/infrastructure/database/generated/prisma/client.js';

/**
 * Cross-module API of the user domain.
 *
 * Other modules (auth, process, ...) import UserModule and inject
 * UserServiceContract — never the concrete UserService.
 */
export abstract class UserServiceContract {
  /** Full entity (including password) — for auth flows only. */
  abstract userGetById(id: string): Promise<User | null>;

  /** Full entity (including password) — for auth login validation only. */
  abstract userGetByUsername(username: string): Promise<User | null>;

  /** @deprecated Prefer userGetByUsername for login. Kept for email lookups. */
  abstract userGetByEmail(email: string): Promise<User | null>;

  /** Create a user; password is hashed by the provider. Returns the full entity. */
  abstract userCreate(payload: {
    username: string;
    email: string;
    name: string;
    password: string;
    role?: UserRole;
  }): Promise<User>;

  /** Returns the subset of `ids` that exists (used for starter/assignment validation). */
  abstract userCheckManyExist(ids: string[]): Promise<string[]>;
}
