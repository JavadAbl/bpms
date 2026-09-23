// get-many-query.request.ts
import { IsOptional, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '#common/infrastructure/database/generated/prisma/client.js';

export class GetManyQuery {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsString()
  search?: string;
}

export type GetManyQueryType<T extends keyof Prisma.TypeMap['model']> = {
  page?: number;
  pageSize?: number;
  sortBy?: keyof Prisma.TypeMap['model'][T]['fields'];
  sortOrder?: 'asc' | 'desc';
  search?: string;
};
