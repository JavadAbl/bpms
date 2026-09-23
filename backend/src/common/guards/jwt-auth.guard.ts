import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT bearer guard. Cross-cutting infrastructure — lives in common so any
 * controller can use it via @UseGuards(JwtAuthGuard) without importing the
 * auth module (avoids circular module imports).
 *
 * The explicit zero-arg constructor strips the inherited DI metadata
 * (AuthModuleOptions) so the guard instantiates in any module context.
 * The 'jwt' strategy is registered globally by JwtStrategy in the auth
 * module at boot time.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }
}
