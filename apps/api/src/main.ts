import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SecurityBootstrapService } from './security/security-bootstrap.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const config = app.get(ConfigService);
  app.get(SecurityBootstrapService).validateProductionConfig(config);

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  const isProduction = config.get('NODE_ENV') === 'production';

  app.use(`/${prefix}/payments/webhook`, express.raw({ type: 'application/json' }));
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  app.use(cookieParser());

  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  const port = config.get<number>('PORT', 4000);

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProduction) {
    const swagger = new DocumentBuilder()
      .setTitle('Shiva Sakti API')
      .setDescription('Bus travel booking & management')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(port);
  console.log(`Shiva Sakti API listening on http://localhost:${port}/${prefix}`);
  if (!isProduction) {
    console.log(`Swagger docs: http://localhost:${port}/docs`);
  }
}

bootstrap();
