import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { UserCreateDto } from './user-create.dto.js';

export class UserUpdateDto extends PartialType(OmitType(UserCreateDto, ['password'] as const)) {
  @ApiPropertyOptional({ example: 'password123', description: 'Leave empty to keep current password' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
