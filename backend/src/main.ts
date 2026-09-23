import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import chalk from 'chalk';
import { AppConfigs, isDev, isProd } from '#common/config/configs/app.config.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Configs } from '#common/config/config.type.js';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.set('query parser', 'extended');

  const configService = app.get(ConfigService<Configs, true>);

  // =========================================================
  // configure swagger
  // =========================================================
  if (!isProd()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BPMS Backend API')
      .setDescription(
        'MVP Business Process Management System backend.\n\n' +
          '## Overview\n' +
          '- **Admin** creates process definitions by uploading BPMN 2.0 XML.\n' +
          '- Admin binds each userTask (by name) to a **user** and/or a **dynamic form**.\n' +
          '- Users **start** instances of a process; the BPMN engine executes it.\n' +
          '- When the engine reaches a userTask, a **Task** is created and assigned.\n' +
          '- Assigned users **complete** the task by submitting the bound form; the engine advances.\n\n' +
          '## Auth\n' +
          'Use `POST /api/auth/login` to obtain a JWT, then click **Authorize** and paste it.\n\n' +
          '## Seeded accounts\n' +
          '- `admin` / `admin123` (ADMIN)\n' +
          '- `john` / `user123` (USER — requester)\n' +
          '- `jane` / `user123` (USER — IT expert)\n' +
          '- `ali` / `user123` (USER — IT expert)\n' +
          '- `bob` / `user123` (USER — IT manager)\n\n' +
          '## Conventions\n' +
          '- List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder`, `search` query params\n' +
          '  and return the envelope `{ items, totalCount }`.\n',
      )
      .setVersion('0.2.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
        'access-token',
      )
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, documentFactory, { swaggerOptions: { persistAuthorization: true } });
  }

  // ======================================================
  // security and middlewares
  // ======================================================

  app.enable('trust proxy');
  app.set('etag', 'strong');

  // Next.js (:3000) and the OA extension (https://oa.*) call this API
  // cross-origin. Chrome Local Network Access also sends a private-network
  // preflight when a public HTTPS page talks to localhost — allow that.
  app.use((req: any, res: any, next: any) => {
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // =====================================================
  // configure global pipes, filters, interceptors
  // =====================================================
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      validateCustomDecorators: true,
      enableDebugMessages: isDev(),
    }),
  );

  // =========================================================
  // configure shutdown hooks
  // =========================================================

  app.enableShutdownHooks();

  process.on('SIGINT', async () => {
    await gracefulShutdown(app, 'SIGINT');
  });

  process.on('SIGTERM', async () => {
    await gracefulShutdown(app, 'SIGTERM');
  });

  const port = configService.get<AppConfigs>('app').port;

  await app.listen(port);

  const appUrl = `http://localhost:${port}/${globalPrefix}`;

  logger.log(`==========================================================`);
  logger.log(`🚀 Application is running on: ${chalk.green(appUrl)}`);

  logger.log(`==========================================================`);

  if (!isProd()) {
    const swaggerUrl = `http://localhost:${port}/api/docs`;
    logger.log(`==========================================================`);
    logger.log(`📑 Swagger is running on: ${chalk.green(swaggerUrl)}`);
  }

  async function gracefulShutdown(app: INestApplication, code: string) {
    setTimeout(() => process.exit(1), 5000);
    logger.verbose(`Signal received with code ${code} ⚡.`);
    logger.log('❗Closing http server with grace.');

    try {
      await app.close();
      logger.log('✅ Http server closed.');
      process.exit(0);
    } catch (error: unknown) {
      logger.error(`❌ Http server closed with error: ${error}`);
      process.exit(1);
    }
  }
}

try {
  (async () => bootstrap())();
} catch (error) {
  logger.error(error);
}
