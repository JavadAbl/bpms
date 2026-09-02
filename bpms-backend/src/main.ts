import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Use global prefix so all routes live under /api
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({ origin: true, credentials: true });

  // Swagger setup
  const config = new DocumentBuilder()
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
        '- `admin@bpms.local` / `admin123` (ADMIN)\n' +
        '- `john@bpms.local` / `user123` (USER)\n' +
        '- `jane@bpms.local` / `user123` (USER)\n' +
        '- `bob@bpms.local` / `user123` (USER)\n\n' +
        '## Seeded processes\n' +
        '- **Leave Approval** (exclusive gateway): Sick → auto-approve, Annual → manager approval\n' +
        '- **Expense Approval** (inclusive + parallel gateways): amount ≤ 1000 → manager, > 1000 → director, > 5000 → also compliance; then parallel payment + archive',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  new Logger('Bootstrap').log(`🚀 BPMS backend ready at http://localhost:${port}/api`);
  new Logger('Bootstrap').log(`📚 Swagger UI at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap', err);
  process.exit(1);
});
