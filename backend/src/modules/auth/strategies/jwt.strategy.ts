import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserServiceContract } from '#modules/user/contracts/user-service.contract.js';
import { JwtConfigs } from '#common/config/configs/jwt.config.js';
import { Configs } from '#common/config/config.type.js';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Configs>,
    private readonly userService: UserServiceContract,
  ) {
    const jwt = config.getOrThrow<JwtConfigs>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.secret,
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<{ id: string; username: string; email: string; name: string; role: string }> {
    const user = await this.userService.userGetById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
