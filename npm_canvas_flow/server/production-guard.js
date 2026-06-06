"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductionSafetyFindings = getProductionSafetyFindings;
exports.assertProductionSafety = assertProductionSafety;
const observability_1 = require("./observability/observability");
function asBool(value) {
    return ['true', '1', 'yes', 'sim'].includes(String(value || '').trim().toLowerCase());
}
function isProduction(env) {
    return String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
}
function isStrongSecret(value) {
    const text = String(value || '');
    return text.length >= 32 && !/^(changeme|change-me|secret|password|token|123456|canvas-flow)$/i.test(text);
}
function parseOrigins(env) {
    return String(env.CORS_ORIGINS || env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function parseBodyLimitBytes(value) {
    const raw = String(value || '').trim().toLowerCase();
    const match = raw.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    if (!match)
        return 0;
    const amount = Number(match[1]);
    const unit = match[2] || 'b';
    const multiplier = unit === 'gb' ? 1024 * 1024 * 1024 : unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
    return Math.floor(amount * multiplier);
}
function getProductionSafetyFindings(env = process.env) {
    if (!isProduction(env))
        return [];
    const findings = [];
    const loginEnabled = asBool(env.CANVAS_FLOW_LOGIN);
    const origins = parseOrigins(env);
    if (!isStrongSecret(env.CANVAS_FLOW_API_TOKEN)) {
        findings.push({
            level: 'fail',
            code: 'missing_api_token',
            message: 'CANVAS_FLOW_API_TOKEN must be set to a strong value in production.',
        });
    }
    if (loginEnabled && !isStrongSecret(env.CANVAS_FLOW_JWT_SECRET)) {
        findings.push({
            level: 'fail',
            code: 'missing_jwt_secret',
            message: 'CANVAS_FLOW_JWT_SECRET must be set to a strong value when production login is enabled.',
        });
    }
    if (!loginEnabled) {
        findings.push({
            level: 'warn',
            code: 'login_disabled',
            message: 'CANVAS_FLOW_LOGIN is disabled in production; expose the admin UI only behind a trusted private boundary.',
        });
    }
    if (asBool(env.ENABLE_SWAGGER)) {
        findings.push({
            level: 'warn',
            code: 'swagger_enabled',
            message: 'ENABLE_SWAGGER is true in production.',
        });
    }
    if (origins.some((origin) => origin === '*')) {
        findings.push({
            level: 'fail',
            code: 'cors_wildcard',
            message: 'CORS_ORIGINS must not contain * in production.',
        });
    }
    const bodyLimit = parseBodyLimitBytes(env.REQUEST_BODY_LIMIT || '2mb');
    if (bodyLimit > 10 * 1024 * 1024) {
        findings.push({
            level: 'warn',
            code: 'large_body_limit',
            message: 'REQUEST_BODY_LIMIT is above 10mb in production.',
        });
    }
    if (String(env.CANVAS_FLOW_FILES_STORAGE || '').trim().toLowerCase() === 's3' && !String(env.CANVAS_FLOW_FILES_S3_BUCKET || '').trim()) {
        findings.push({
            level: 'fail',
            code: 'missing_files_s3_bucket',
            message: 'CANVAS_FLOW_FILES_S3_BUCKET must be configured when CANVAS_FLOW_FILES_STORAGE=s3.',
        });
    }
    return findings;
}
function assertProductionSafety(env = process.env) {
    const findings = getProductionSafetyFindings(env);
    if (!findings.length)
        return;
    findings.forEach((finding) => {
        (0, observability_1.logEvent)(finding.level === 'fail' ? 'error' : 'warn', `production_guard.${finding.code}`, {
            message: finding.message,
        });
    });
    const strict = asBool(env.CANVAS_FLOW_STRICT_PRODUCTION);
    const blocking = findings.filter((finding) => finding.level === 'fail' || strict);
    if (blocking.length) {
        throw new Error(`Unsafe production configuration: ${blocking.map((finding) => finding.code).join(', ')}`);
    }
}
//# sourceMappingURL=production-guard.js.map