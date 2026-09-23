import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import Joi from 'joi';
import { appConfig, appConfigValidationSchema } from '#common/config/configs/app.config.js';
import {
  databaseConfig,
  databaseConfigValidationSchema,
} from '#common/config/configs/database.config.js';
import { jwtConfig, jwtConfigValidationSchema } from '#common/config/configs/jwt.config.js';
import {
  loggerConfig,
  loggerConfigValidationSchema,
} from '#common/config/configs/logger.config.js';
import { getLoggerAsyncConfig } from '#common/libs/pino/pino.config.js';
import { Configs } from '#common/config/config.type.js';
import { PrismaModule } from '#common/infrastructure/database/prisma.module.js';

import { HealthModule } from '#modules/health/health.module.js';
import { AuthModule } from '#modules/auth/auth.module.js';
import { UserModule } from '#modules/user/user.module.js';
import { DepartmentModule } from '#modules/department/department.module.js';
import { PositionModule } from '#modules/position/position.module.js';
import { CategoryModule } from '#modules/category/category.module.js';
import { FormModule } from '#modules/form/form.module.js';
import { BpmnModule } from '#modules/bpmn/bpmn.module.js';
import { ProcessModule } from '#modules/process/process.module.js';
import { ProcessInstanceModule } from '#modules/process-instance/process-instance.module.js';
import { ProcessDraftModule } from '#modules/process-draft/process-draft.module.js';
import { TaskModule } from '#modules/task/task.module.js';
import { FileModule } from '#modules/file/file.module.js';
import { DashboardModule } from '#modules/dashboard/dashboard.module.js';
import { ReportModule } from '#modules/report/report.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, loggerConfig],
      validationSchema: Joi.object({
        ...appConfigValidationSchema,
        ...databaseConfigValidationSchema,
        ...jwtConfigValidationSchema,
        ...loggerConfigValidationSchema,
      }),
      validationOptions: {
        libraryOptions: {
          allowUnknown: true, // Allows variables not defined in schema
          abortEarly: true, // Stops validation on the first error
        },
      },
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Configs, true>) => getLoggerAsyncConfig(config),
    }),

    PrismaModule,

    HealthModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    PositionModule,
    CategoryModule,
    FormModule,
    BpmnModule,
    ProcessModule,
    ProcessInstanceModule,
    ProcessDraftModule,
    TaskModule,
    FileModule,
    DashboardModule,
    ReportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
