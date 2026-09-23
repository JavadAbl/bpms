import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthLoginDto } from '../dto/request/auth-login.dto.js';
import { AuthRegisterDto } from '../dto/request/auth-register.dto.js';
import { AuthReplyDto } from '../dto/response/auth-reply.dto.js';
import { UserServiceContract } from '#modules/user/contracts/user-service.contract.js';
import { UserRole } from '#common/infrastructure/database/generated/prisma/client.js';
import type { User } from '#common/infrastructure/database/generated/prisma/client.js';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserServiceContract,
    private readonly jwt: JwtService,
  ) {}

  async authRegister(dto: AuthRegisterDto): Promise<AuthReplyDto> {
    const username = dto.username.trim().toLowerCase();
    const existing = await this.userService.userGetByUsername(username);
    if (existing) throw new ConflictException('Username already registered');

    const user = await this.userService.userCreate({
      username,
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: UserRole.USER,
    });
    return this.buildReply(user);
  }

  async authLogin(dto: AuthLoginDto): Promise<AuthReplyDto> {
    const username = dto.username.trim().toLowerCase();
    const user = await this.userService.userGetByUsername(username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildReply(user);
  }

  private buildReply(user: User): AuthReplyDto {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
