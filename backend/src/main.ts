import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express = require('express');
import helmet from 'helmet';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from './app.module';
import { assertProductionSafety } from './production-guard';

function parseAllowedOrigins() {
  return String(process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  const allowedOrigins = parseAllowedOrigins();
  if (!origin) return callback(null, true);
  if (!allowedOrigins.length && process.env.NODE_ENV !== 'production') return callback(null, true);
  return callback(null, allowedOrigins.includes(origin));
}

function setupStaticFrontend(app: INestApplication) {
  const configuredDir = String(process.env.CANVAS_FLOW_STATIC_DIR || '').trim();
  if (!configuredDir) return;

  const staticDir = resolve(configuredDir);
  const indexFile = join(staticDir, 'index.html');
  if (!existsSync(indexFile)) {
    console.warn(`Canvas Flow static frontend not found at ${indexFile}`);
    return;
  }

  const server = app.getHttpAdapter().getInstance();
  const shouldSkipFrontend = (pathname: string) => (
    pathname.startsWith('/api') ||
    pathname.startsWith('/docs') ||
    pathname === '/health'
  );

  server.use(express.static(staticDir));
  server.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
    const pathname = request.path || request.url.split('?')[0] || '/';
    if (!['GET', 'HEAD'].includes(request.method) || shouldSkipFrontend(pathname)) {
      return next();
    }
    return response.sendFile(indexFile);
  });
}

async function bootstrap() {
  assertProductionSafety();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
  app.use(express.urlencoded({ limit: process.env.REQUEST_BODY_LIMIT || '2mb', extended: true }));
  app.enableCors({
    origin: resolveCorsOrigin,
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-canvas-flow-token',
  });
  app.setGlobalPrefix('');

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Canvas Flow API')
      .setDescription('Standalone Canvas Flow backend')
      .setVersion('0.1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  setupStaticFrontend(app);

  const port = Number(process.env.PORT || 3333);
  await app.listen(port, '0.0.0.0');
  console.log(`Canvas Flow API running on port ${port}`);
}

void bootstrap();
