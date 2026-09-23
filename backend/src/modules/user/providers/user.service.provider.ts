import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository.js';
import { UserServiceContract } from '../contracts/user-service.contract.js';
import { User, UserRole } from '#common/infrastructure/database/generated/prisma/client.js';

/** Contract implementation consumed by other modules (auth, process, ...). */
@Injectable()
export class UserProvider implements UserServiceContract {
  constructor(private readonly userRep: UserRepository) {}

  userGetById(id: string): Promise<User | null> {
    return this.userRep.findUnique({ where: { id } });
  }

  userGetByUsername(username: string): Promise<User | null> {
    return this.userRep.findUnique({ where: { username: username.trim().toLowerCase() } });
  }

  userGetByEmail(email: string): Promise<User | null> {
    return this.userRep.findUnique({ where: { email } });
  }

  async userCreate(payload: {
    username: string;
    email: string;
    name: string;
    password: string;
    role?: UserRole;
  }): Promise<User> {
    const username = payload.username.trim().toLowerCase();
    await this.userRep.checkDuplicateBy(
      { where: { username } },
      'username',
      username,
      'Username already registered',
    );
    await this.userRep.checkDuplicateBy(
      { where: { email: payload.email } },
      'email',
      payload.email,
      'Email already registered',
    );

    const password = await bcrypt.hash(payload.password, 10);
    return this.userRep.create({
      data: {
        username,
        email: payload.email,
        name: payload.name,
        password,
        role: payload.role ?? UserRole.USER,
      },
    });
  }

  async userCheckManyExist(ids: string[]): Promise<string[]> {
    const found = await this.userRep.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return found.items.map((user) => user.id);
  }
}
