import { ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { GetManyReply } from '#common/dto/response/get-many-reply.js';
import { GetManyQueryType } from '#common/dto/request/get-many-query.js';
import { buildFindManyArgs } from '#common/utils/prisma-util.js';
import { UserDto } from '../dto/response/user.dto.js';
import { UserCreateDto } from '../dto/request/user-create.dto.js';
import { UserUpdateDto } from '../dto/request/user-update.dto.js';
import { UserRepository } from '../repositories/user.repository.js';

@Injectable()
export class UserService {
  constructor(private readonly userRep: UserRepository) {}

  async userGetMany(query: GetManyQueryType<'User'>): Promise<GetManyReply<UserDto>> {
    const predicate = buildFindManyArgs(query, {
      searchableFields: ['name', 'username', 'email'],
    });
    predicate.orderBy = predicate.orderBy ?? { createdAt: 'asc' };
    const { items, totalCount } = await this.userRep.findMany(predicate);
    return { items: items.map((item) => plainToInstance(UserDto, item)), totalCount };
  }

  async userGetById(id: string): Promise<UserDto> {
    const user = await this.userRep.findAndCheckExistsBy(
      {
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      'id',
      id,
    );
    return plainToInstance(UserDto, user);
  }

  async userCreate(payload: UserCreateDto): Promise<string> {
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
    const user = await this.userRep.create({
      data: {
        username,
        email: payload.email,
        name: payload.name,
        password,
        role: payload.role,
      },
    });
    return user.id;
  }

  async userUpdate(userId: string, payload: UserUpdateDto): Promise<void> {
    const data: UserUpdateDto & { username?: string; password?: string } = { ...payload };

    if (payload.username) {
      const username = payload.username.trim().toLowerCase();
      const existing = await this.userRep.findUnique({ where: { username } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already in use');
      }
      data.username = username;
    }

    if (payload.email) {
      const existing = await this.userRep.findUnique({ where: { email: payload.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, 10);
    }

    await this.userRep.findAndCheckExistsBy({ where: { id: userId } }, 'id', userId);
    await this.userRep.update({ data, where: { id: userId } });
  }

  async userDelete(userId: string): Promise<void> {
    await this.userRep.findAndCheckExistsBy({ where: { id: userId } }, 'id', userId);
    await this.userRep.remove({ where: { id: userId } });
  }
}
