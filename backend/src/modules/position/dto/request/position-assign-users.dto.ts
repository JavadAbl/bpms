import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class PositionAssignUsersDto {
  @ApiProperty({ type: [String], description: 'User IDs to assign to this position' })
  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];
}
