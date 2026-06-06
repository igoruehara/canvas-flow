"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeForLog = sanitizeForLog;
exports.logEvent = logEvent;
exports.getErrorDetails = getErrorDetails;
const SENSITIVE_KEY_PATTERN = /(api[-_]?key|authorization|password|passwd|secret|token|access[-_]?token|refresh[-_]?token|connection[-_]?string|credential|private[-_]?key|client[-_]?secret)/i;
const MAX_STRING_LENGTH = 1200;
const MAX_ARRAY_LENGTH = 50;
const MAX_DEPTH = 6;
function sanitizeForLog(value, depth = 0) {
    if (value === null || value === undefined)
        return value;
    if (depth > MAX_DEPTH)
        return '[MaxDepth]';
    if (typeof value === 'string') {
        return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}]` : value;
    }
    if (typeof value !== 'object')
        return value;
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeForLog(item, depth + 1));
        return value.length > MAX_ARRAY_LENGTH ? [...items, `[truncated:${value.length - MAX_ARRAY_LENGTH}]`] : items;
    }
    const clean = {};
    for (const [key, raw] of Object.entries(value)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            clean[key] = raw ? '[redacted]' : raw;
            continue;
        }
        clean[key] = sanitizeForLog(raw, depth + 1);
    }
    return clean;
}
function logEvent(level, event, data = {}) {
    const payload = {
        level,
        event,
        service: 'canvas-flow',
        timestamp: new Date().toISOString(),
        ...sanitizeForLog(data),
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
        console.error(line);
    }
    else if (level === 'warn') {
        console.warn(line);
    }
    else {
        console.log(line);
    }
}
function getErrorDetails(error) {
    return sanitizeForLog({
        name: error?.name,
        message: error?.message || String(error || ''),
        stack: error?.stack,
    });
}
//# sourceMappingURL=observability.js.map