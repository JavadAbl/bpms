import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class UserDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty({ example: 'alice' })
  username: string;

  @Expose()
  @ApiProperty({ example: 'alice@bpms.local' })
  email: string;

  @Expose()
  @ApiProperty({ example: 'Alice Lee' })
  name: string;

  @Expose()
  @ApiProperty({ enum: ['ADMIN', 'SENIOR_EXPERT', 'USER'] })
  role: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
