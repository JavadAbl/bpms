import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '#common/infrastructure/database/generated/prisma/client.js';

export class UserCreateDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, digits, dot, underscore, hyphen',
  })
  username: string;

  @ApiProperty({ example: 'new@bpms.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Alice Lee' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
