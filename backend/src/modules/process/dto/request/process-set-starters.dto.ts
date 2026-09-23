import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ProcessSetStartersDto {
  @ApiProperty({
    type: [String],
    description:
      'User ids allowed to start this process. An EMPTY array removes the ' +
      'restriction — every user may start (admins always may either way).',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];
}
