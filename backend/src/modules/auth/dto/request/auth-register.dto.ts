import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class AuthRegisterDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, digits, dot, underscore, hyphen',
  })
  username: string;

  @ApiProperty({ example: 'newuser@bpms.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Alice Lee' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;
}
