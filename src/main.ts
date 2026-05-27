import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
  });

  app.setGlobalPrefix(config.get<string>('app.apiPrefix') || 'api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: (config.get<string>('app.apiVersion') || 'v1').replace(
      /^v/,
      '',
    ),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  if (config.get<string>('app.nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HR System API')
      .setDescription('Sri Lankan HR Platform Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', in: 'header', name: 'x-company-id' },
        'company-id',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('app.port') || 3000;
  await app.listen(port);
  console.log(`HR Backend running on port ${port}`);
}

void bootstrap();
