import type { Handler } from 'aws-lambda';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express = require('express');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertProductionSafety } from './production-guard';
import { RunnerQueueProcessor } from './runner/runner-queue-processor';
import { RunnerService } from './runner/runner-service';

const serverlessExpress = require('@codegenie/serverless-express');

let server: Handler | undefined;
let nestApp: INestApplication | undefined;

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

async function bootstrap() {
  assertProductionSafety();
  const expressApp = express();

  expressApp.disable('x-powered-by');
  expressApp.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  expressApp.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
  expressApp.use(express.urlencoded({ limit: process.env.REQUEST_BODY_LIMIT || '2mb', extended: true }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });
  app.enableCors({
    origin: resolveCorsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-canvas-flow-token',
    credentials: false,
  });

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Canvas Flow API')
      .setDescription('Standalone Canvas Flow backend')
      .setVersion('0.1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.init();
  nestApp = app;

  server = serverlessExpress({
    app: expressApp,
    binarySettings: {
      contentTypes: ['*/*'],
      shouldConvertResponse: true,
    },
    respondWithErrors: process.env.NODE_ENV !== 'production',
  });
}

function isCronEvent(event: any): boolean {
  return event?.source === 'canvas-flow.cron' || event?.detail?.source === 'canvas-flow.cron' || event?.['detail-type'] === 'Scheduled Event';
}

function isSqsEvent(event: any): boolean {
  return Array.isArray(event?.Records) && event.Records.some((record: any) => record?.eventSource === 'aws:sqs' || record?.EventSource === 'aws:sqs');
}

function isHttpLikeEvent(event: any): boolean {
  if (event?.requestContext?.http || event?.version === '2.0') return true;
  if (event?.httpMethod || event?.requestContext?.stage) return true;
  if (event?.requestContext?.elb) return true;
  return false;
}

export const handler: Handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!server) {
    await bootstrap();
  }

  if (!isHttpLikeEvent(event)) {
    if (isSqsEvent(event)) {
      const processor = nestApp!.get(RunnerQueueProcessor);
      const result = await processor.processRecords(event.Records || []);
      return {
        batchItemFailures: result.batchItemFailures,
        results: result.results,
      };
    }

    if (isCronEvent(event)) {
      const service = nestApp!.get(RunnerService);
      const detail = event?.detail || {};
      return await service.runDueCronFlows({
        agentId: event?.agentId || detail?.agentId,
        dryRun: event?.dryRun === true || detail?.dryRun === true,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        service: 'canvas-flow-backend',
      }),
    };
  }

  return server!(event, context, () => undefined);
};
