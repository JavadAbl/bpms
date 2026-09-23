import { ConfigService } from '@nestjs/config';
import { Injectable, Scope } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import { DatabaseConfigs } from '#common/config/configs/database.config.js';
import { Configs } from '#common/config/config.type.js';

@Injectable({ scope: Scope.DEFAULT })
export class PrismaProvider extends PrismaClient {
  constructor(configService: ConfigService<Configs>) {
    const config = configService.getOrThrow<DatabaseConfigs>('database');

    const adapter = new PrismaBetterSqlite3({ url: config.DATABASE_URL });

    super({ adapter });
  }
}
