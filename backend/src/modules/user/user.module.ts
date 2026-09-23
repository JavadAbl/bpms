import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller.js';
import { UserService } from './services/user.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserServiceContract } from './contracts/user-service.contract.js';
import { UserProvider } from './providers/user.service.provider.js';

@Module({
  imports: [],
  controllers: [UserController],
  providers: [UserService, UserRepository, { provide: UserServiceContract, useClass: UserProvider }],
  exports: [UserServiceContract],
})
export class UserModule {}
