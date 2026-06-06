"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const core_1 = require("@nestjs/core");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const express = require("express");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
const production_guard_1 = require("./production-guard");
const runner_queue_processor_1 = require("./runner/runner-queue-processor");
const runner_service_1 = require("./runner/runner-service");
const serverlessExpress = require('@codegenie/serverless-express');
let server;
let nestApp;
function parseAllowedOrigins() {
    return String(process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function resolveCorsOrigin(origin, callback) {
    const allowedOrigins = parseAllowedOrigins();
    if (!origin)
        return callback(null, true);
    if (!allowedOrigins.length && process.env.NODE_ENV !== 'production')
        return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
}
async function bootstrap() {
    (0, production_guard_1.assertProductionSafety)();
    const expressApp = express();
    expressApp.disable('x-powered-by');
    expressApp.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    expressApp.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
    expressApp.use(express.urlencoded({ limit: process.env.REQUEST_BODY_LIMIT || '2mb', extended: true }));
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_express_1.ExpressAdapter(expressApp), { bodyParser: false });
    app.enableCors({
        origin: resolveCorsOrigin,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-canvas-flow-token',
        credentials: false,
    });
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('Canvas Flow API')
            .setDescription('Standalone Canvas Flow backend')
            .setVersion('0.1.0')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('docs', app, document);
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
function isCronEvent(event) {
    return event?.source === 'canvas-flow.cron' || event?.detail?.source === 'canvas-flow.cron' || event?.['detail-type'] === 'Scheduled Event';
}
function isSqsEvent(event) {
    return Array.isArray(event?.Records) && event.Records.some((record) => record?.eventSource === 'aws:sqs' || record?.EventSource === 'aws:sqs');
}
function isHttpLikeEvent(event) {
    if (event?.requestContext?.http || event?.version === '2.0')
        return true;
    if (event?.httpMethod || event?.requestContext?.stage)
        return true;
    if (event?.requestContext?.elb)
        return true;
    return false;
}
const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    if (!server) {
        await bootstrap();
    }
    if (!isHttpLikeEvent(event)) {
        if (isSqsEvent(event)) {
            const processor = nestApp.get(runner_queue_processor_1.RunnerQueueProcessor);
            const result = await processor.processRecords(event.Records || []);
            return {
                batchItemFailures: result.batchItemFailures,
                results: result.results,
            };
        }
        if (isCronEvent(event)) {
            const service = nestApp.get(runner_service_1.RunnerService);
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
    return server(event, context, () => undefined);
};
exports.handler = handler;
//# sourceMappingURL=lambda.js.map