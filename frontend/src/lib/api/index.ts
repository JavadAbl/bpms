/**
 * API layer barrel — re-exports every domain module so `@/lib/api` imports
 * keep working exactly as they did when this was a single api.ts file.
 *
 * Layout:
 * - client.ts             fetch core: token, headers, error normalization, 401 handling
 * - envelope.ts           GetMany envelope + auto-paginating fetchAll
 * - <domain>.ts           one module per backend domain
 */
export * from './client';
export * from './envelope';
export * from './auth';
export * from './dashboard';
export * from './tasks';
export * from './process-instances';
export * from './process-drafts';
export * from './processes';
export * from './forms';
export * from './categories';
export * from './departments';
export * from './positions';
export * from './users';
export * from './reports';
export * from './files';
