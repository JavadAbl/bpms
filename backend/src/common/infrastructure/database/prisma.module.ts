import { Global, Module } from '@nestjs/common';
import { PrismaProvider } from './prisma.provider.js';

@Global()
@Module({ imports: [], providers: [PrismaProvider], exports: [PrismaProvider] })
export class PrismaModule {}
