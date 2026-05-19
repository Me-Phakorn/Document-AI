import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createBasicAuthMiddleware } from './auth/basic-auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', '/api/v1').replace(/^\//, '');
  const bodyParserApp = app as typeof app & {
    useBodyParser: (parser: 'json' | 'urlencoded', options: { limit: string; extended?: boolean }) => void;
  };

  bodyParserApp.useBodyParser('json', { limit: config.get<string>('API_JSON_BODY_LIMIT', '50mb') });
  bodyParserApp.useBodyParser('urlencoded', { limit: config.get<string>('API_JSON_BODY_LIMIT', '50mb'), extended: true });

  app.use(createBasicAuthMiddleware(config));

  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DocAI API')
    .setDescription('Document intelligence, review, rulebook, compliance, and reporting API')
    .setVersion('0.1.0')
    .addBasicAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = config.get<number>('API_PORT', 4000);
  await app.listen(port);
}

void bootstrap();