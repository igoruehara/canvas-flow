"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const express = require("express");
const helmet_1 = require("helmet");
const fs_1 = require("fs");
const path_1 = require("path");
const app_module_1 = require("./app.module");
const production_guard_1 = require("./production-guard");
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
function setupStaticFrontend(app) {
    const configuredDir = String(process.env.CANVAS_FLOW_STATIC_DIR || '').trim();
    if (!configuredDir)
        return;
    const staticDir = (0, path_1.resolve)(configuredDir);
    const indexFile = (0, path_1.join)(staticDir, 'index.html');
    if (!(0, fs_1.existsSync)(indexFile)) {
        console.warn(`Canvas Flow static frontend not found at ${indexFile}`);
        return;
    }
    const server = app.getHttpAdapter().getInstance();
    const shouldSkipFrontend = (pathname) => (pathname.startsWith('/api') ||
        pathname.startsWith('/docs') ||
        pathname === '/health');
    server.use(express.static(staticDir));
    server.use((request, response, next) => {
        const pathname = request.path || request.url.split('?')[0] || '/';
        if (!['GET', 'HEAD'].includes(request.method) || shouldSkipFrontend(pathname)) {
            return next();
        }
        return response.sendFile(indexFile);
    });
}
async function bootstrap() {
    (0, production_guard_1.assertProductionSafety)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    app.getHttpAdapter().getInstance().disable('x-powered-by');
    app.use((0, helmet_1.default)({
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
        const config = new swagger_1.DocumentBuilder()
            .setTitle('Canvas Flow API')
            .setDescription('Standalone Canvas Flow backend')
            .setVersion('0.1.0')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
    setupStaticFrontend(app);
    const port = Number(process.env.PORT || 3333);
    await app.listen(port, '0.0.0.0');
    console.log(`Canvas Flow API running on port ${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map