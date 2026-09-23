import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { Prisma } from '#common/infrastructure/database/generated/prisma/client.js';

/**
 * Builds Prisma findMany arguments based on query criteria.
 *
 * @param T The Prisma model name (e.g., "User", "Post").
 * @param criteria The query parameters from the request.
 * @param options Additional options, including searchable fields.
 * @returns A `PrismaFindManyArgs` object for the specified model.
 */
export function buildFindManyArgs<T extends keyof Prisma.TypeMap['model']>(
  criteria: GetManyQueryType<T>,
  options?: { searchableFields?: (keyof Prisma.TypeMap['model'][T]['fields'])[] },
): Prisma.TypeMap['model'][T]['operations']['findMany']['args'] {
  // Default page is now 1 (first page)
  const { page = 1, pageSize = 100, sortBy, sortOrder = 'asc', search } = criteria;

  // Guard against a zero or negative page value – treat it as the first page
  const safePage = Math.max(page, 1);

  const args: Prisma.TypeMap['model'][T]['operations']['findMany']['args'] = {
    skip: (safePage - 1) * pageSize,
    take: Math.min(pageSize, 100),
  };

  if (sortBy) {
    args.orderBy = { [sortBy]: sortOrder };
  }

  // Initialize a where clause to build upon
  const whereClause: Prisma.TypeMap['model'][T]['operations']['findMany']['args']['where'] = {};

  if (search && options?.searchableFields?.length) {
    whereClause.OR = options.searchableFields.map((field) => ({
      [field]: { contains: search /* mode: 'insensitive'  */ },
    }));
  }

  // If the whereClause has any conditions, attach it to the args
  if (Object.keys(whereClause).length > 0) {
    args.where = whereClause;
  }

  return args;
}
