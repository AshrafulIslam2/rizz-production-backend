import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_ORIGINS = [
  'https://rizzleather.com',
  'https://www.rizzleather.com',
  'https://admin.rizzleather.com',
];

/** CORS_ORIGINS (comma-separated) overrides the defaults. Localhost is added outside production. */
function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const origins = fromEnv.length ? fromEnv : [...DEFAULT_ORIGINS];
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002');
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));
  const port = Number(process.env.PORT ?? 3000);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  // Only our own sites may call the API from a browser. Previously `origin: true`
  // reflected ANY origin, which let any website make requests on a visitor's behalf.
  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
}

void bootstrap();
