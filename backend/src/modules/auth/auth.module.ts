import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RolesGuard } from '#common/guards/roles.guard.js';
import { JwtAuthGuard } from '#common/guards/jwt-auth.guard.js';
import { UserModule } from '#modules/user/user.module.js';
import { JwtConfigs } from '#common/config/configs/jwt.config.js';
import { Configs } from '#common/config/config.type.js';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Configs>) => {
        const jwt = config.getOrThrow<JwtConfigs>('jwt');
        return {
          secret: jwt.secret,
          signOptions: {
            expiresIn: jwt.expiresIn as SignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, JwtAuthGuard],
  exports: [],
})
export class AuthModule {}
