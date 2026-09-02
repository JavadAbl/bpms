import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FormsModule } from './forms/forms.module';
import { DepartmentsModule } from './departments/departments.module';
import { PositionsModule } from './positions/positions.module';
import { ProcessesModule } from './processes/processes.module';
import { ProcessInstancesModule } from './process-instances/process-instances.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FormsModule,
    DepartmentsModule,
    PositionsModule,
    ProcessesModule,
    TasksModule,
    ProcessInstancesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
