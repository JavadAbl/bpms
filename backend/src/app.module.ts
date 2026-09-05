import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FormsModule } from './forms/forms.module';
import { DepartmentsModule } from './departments/departments.module';
import { CategoriesModule } from './categories/categories.module';
import { PositionsModule } from './positions/positions.module';
import { ProcessesModule } from './processes/processes.module';
import { ProcessInstancesModule } from './process-instances/process-instances.module';
import { TasksModule } from './tasks/tasks.module';
import { FilesModule } from './files/files.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FormsModule,
    DepartmentsModule,
    CategoriesModule,
    PositionsModule,
    ProcessesModule,
    TasksModule,
    ProcessInstancesModule,
    FilesModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
