import { ApiProperty } from '@nestjs/swagger';

export class AuthReplyDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'admin' })
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['ADMIN', 'SENIOR_EXPERT', 'USER'] })
  role: string;
}
