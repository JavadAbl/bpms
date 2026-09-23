import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import { AuthLoginDto } from '../dto/request/auth-login.dto.js';
import { AuthRegisterDto } from '../dto/request/auth-register.dto.js';
import { AuthReplyDto } from '../dto/response/auth-reply.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user (default role USER)' })
  @ApiBody({ type: AuthRegisterDto })
  @ApiOkResponse({ description: 'Registered user info + JWT', type: AuthReplyDto })
  authRegister(@Body() dto: AuthRegisterDto): Promise<AuthReplyDto> {
    return this.authService.authRegister(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with username + password to receive a JWT' })
  @ApiBody({ type: AuthLoginDto })
  @ApiOkResponse({ description: 'Authenticated user info + JWT', type: AuthReplyDto })
  authLogin(@Body() dto: AuthLoginDto): Promise<AuthReplyDto> {
    return this.authService.authLogin(dto);
  }
}
