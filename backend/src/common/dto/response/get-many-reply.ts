import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export interface GetManyReply<T> {
  totalCount: number;
  items: T[];
}

export const ApiGetManyResponse = (itemType: Function) => {
  return ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        totalCount: { type: 'number', example: 100 },
        items: { type: 'array', items: { $ref: getSchemaPath(itemType) } },
      },
    },
  });
};
