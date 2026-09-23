import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { GetManyQuery } from '#common/dto/request/get-many-query.js';

/** forms are scoped to a process — processId is required on the list endpoint. */
export class FormGetManyQuery extends GetManyQuery {
  @ApiProperty({ description: 'Process ID — forms are scoped to a process' })
  @IsUUID()
  processId: string;
}
