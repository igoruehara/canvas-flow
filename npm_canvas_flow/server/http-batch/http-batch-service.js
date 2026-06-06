"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpBatchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let HttpBatchService = class HttpBatchService {
    constructor(configService) {
        this.configService = configService;
    }
    redactHeaders(headers) {
        const result = {};
        Object.entries(headers || {}).forEach(([key, value]) => {
            if (/authorization|token|api-key|x-api-key|cookie/i.test(key)) {
                result[key] = '[redacted]';
            }
            else {
                result[key] = value;
            }
        });
        return result;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    limitNumber(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return fallback;
        return Math.max(min, Math.min(Math.floor(parsed), max));
    }
    getByPath(source, path) {
        const normalized = String(path || '')
            .replace(/\[(\d+)\]/g, '.$1')
            .replace(/^result\./, '')
            .trim();
        if (!normalized)
            return source;
        return normalized
            .split('.')
            .filter(Boolean)
            .reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
    }
    hasValue(value) {
        if (value === undefined || value === null || value === '')
            return false;
        if (Array.isArray(value))
            return value.length > 0;
        if (typeof value === 'object')
            return Object.keys(value).length > 0;
        return true;
    }
    renderTemplate(value, scope) {
        if (typeof value === 'string') {
            return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
                const trimmed = String(expr || '').trim();
                const root = {
                    ...scope,
                    slots: scope?.context?.slots || {},
                };
                const resolved = trimmed.startsWith('context.')
                    ? this.getByPath(scope?.context || {}, trimmed.replace(/^context\./, ''))
                    : this.getByPath(root, trimmed);
                return resolved === undefined || resolved === null
                    ? ''
                    : typeof resolved === 'string'
                        ? resolved
                        : JSON.stringify(resolved);
            });
        }
        if (Array.isArray(value))
            return value.map((item) => this.renderTemplate(item, scope));
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.renderTemplate(item, scope)]));
        }
        return value;
    }
    getRequestData(request) {
        return request?.bodyType === 'none'
            ? undefined
            : request?.body !== undefined
                ? request.body
                : request?.data;
    }
    async executeOne(request, index, timeoutMs) {
        const url = String(request?.url || '').trim();
        const method = String(request?.method || 'GET').toUpperCase();
        const data = this.getRequestData(request);
        if (!url) {
            return { index, error: 'httpBatch: url is required' };
        }
        try {
            const response = await (0, axios_1.default)({
                url,
                method: method,
                headers: request?.headers,
                params: request?.params,
                data,
                timeout: timeoutMs,
                validateStatus: () => true,
            });
            return {
                index,
                status: response.status,
                statusText: response.statusText,
                headers: this.redactHeaders(response.headers),
                data: response.data,
            };
        }
        catch (error) {
            return {
                index,
                error: 'httpRequest_failed',
                message: error?.message || String(error),
                code: error?.code,
            };
        }
    }
    checkPollingStop(polling, result, initialResult, attempt, context) {
        const stopPath = String(polling.stopPath || polling.resultPath || '').trim();
        if (stopPath) {
            const value = this.getByPath(result, stopPath);
            if (this.hasValue(value)) {
                return { completed: true, reason: 'stopPath', stopPath, value };
            }
        }
        const rawCondition = String(polling.stopCondition || '').trim();
        if (rawCondition) {
            try {
                const body = rawCondition.startsWith('return') ? rawCondition : `return (${rawCondition});`;
                const matched = Boolean(new Function('result', 'initialResult', 'attempt', 'context', body)(result, initialResult, attempt, context || {}));
                if (matched)
                    return { completed: true, reason: 'stopCondition', stopCondition: rawCondition };
            }
            catch (error) {
                return { completed: false, conditionError: error?.message || String(error) };
            }
        }
        return { completed: false };
    }
    buildPollingRequest(request, result, initialResult, attempt, context) {
        const polling = request.polling || {};
        const pollingRequest = {
            url: String(polling.url || request.url || ''),
            method: polling.method || 'GET',
            headers: polling.headers || request.headers || {},
            params: polling.params || {},
            bodyType: polling.bodyType || 'none',
            body: polling.body,
            data: polling.data,
        };
        return this.renderTemplate(pollingRequest, { result, initialResult, attempt, context });
    }
    summarizePollingResult(attempt, result, stop) {
        return {
            attempt,
            status: result?.status,
            error: result?.error,
            code: result?.code,
            completed: stop?.completed === true,
            reason: stop?.reason,
            conditionError: stop?.conditionError,
        };
    }
    async executeWithPolling(request, index, timeoutMs, context) {
        const initialResult = await this.executeOne(request, index, timeoutMs);
        const polling = request.polling;
        if (polling?.enabled !== true || initialResult?.error)
            return initialResult;
        const maxAttemptsCap = this.limitNumber(this.configService.get('HTTP_BATCH_POLLING_MAX_ATTEMPTS'), 20, 1, 100);
        const intervalCap = this.limitNumber(this.configService.get('HTTP_BATCH_POLLING_MAX_INTERVAL_SECONDS'), 60, 1, 600);
        const maxAttempts = this.limitNumber(polling.maxAttempts, 10, 1, maxAttemptsCap);
        const intervalSeconds = this.limitNumber(polling.intervalSeconds, 5, 1, intervalCap);
        const historyLimit = this.limitNumber(this.configService.get('HTTP_BATCH_POLLING_HISTORY_LIMIT'), 8, 1, 50);
        const history = [];
        const initialStop = this.checkPollingStop(polling, initialResult, initialResult, 0, context);
        if (initialStop.completed) {
            return {
                ...initialResult,
                polling: {
                    enabled: true,
                    completed: true,
                    attempts: 0,
                    intervalSeconds,
                    maxAttempts,
                    reason: initialStop.reason,
                    stopPath: initialStop.stopPath,
                    value: initialStop.value,
                    finalResult: initialResult,
                    history,
                },
                finalStatus: initialResult.status,
                finalData: initialResult.data,
            };
        }
        let lastResult = initialResult;
        let lastStop = initialStop;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            await this.sleep(intervalSeconds * 1000);
            const pollRequest = this.buildPollingRequest(request, lastResult, initialResult, attempt, context);
            lastResult = await this.executeOne(pollRequest, index, timeoutMs);
            lastStop = this.checkPollingStop(polling, lastResult, initialResult, attempt, context);
            history.push(this.summarizePollingResult(attempt, lastResult, lastStop));
            if (history.length > historyLimit)
                history.shift();
            if (lastStop.completed) {
                return {
                    ...initialResult,
                    polling: {
                        enabled: true,
                        completed: true,
                        attempts: attempt,
                        intervalSeconds,
                        maxAttempts,
                        reason: lastStop.reason,
                        stopPath: lastStop.stopPath,
                        value: lastStop.value,
                        finalResult: lastResult,
                        history,
                    },
                    finalStatus: lastResult.status,
                    finalData: lastResult.data,
                };
            }
        }
        return {
            ...initialResult,
            polling: {
                enabled: true,
                completed: false,
                attempts: maxAttempts,
                intervalSeconds,
                maxAttempts,
                reason: lastStop.conditionError ? 'conditionError' : 'maxAttempts',
                conditionError: lastStop.conditionError,
                finalResult: lastResult,
                history,
            },
            finalStatus: lastResult?.status,
            finalData: lastResult?.data,
        };
    }
    async execute(requests, context) {
        const maxRequests = Number(this.configService.get('HTTP_BATCH_MAX_REQUESTS') || 10);
        const timeoutMs = Number(this.configService.get('HTTP_BATCH_TIMEOUT_MS') || 120000);
        const safeRequests = Array.isArray(requests) ? requests.slice(0, maxRequests) : [];
        if (!safeRequests.length) {
            return { error: 'httpBatch: requests[] is required', results: [] };
        }
        const results = await Promise.all(safeRequests.map((request, index) => this.executeWithPolling(request, index, timeoutMs, context)));
        return { results };
    }
};
exports.HttpBatchService = HttpBatchService;
exports.HttpBatchService = HttpBatchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], HttpBatchService);
//# sourceMappingURL=http-batch-service.js.map