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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const mongoose_1 = require("mongoose");
const api_key_constants_model_1 = require("./api-key-constants-model");
let ApiKeyService = class ApiKeyService {
    constructor(model, configService) {
        this.model = model;
        this.configService = configService;
    }
    extractToken(authorization, headerToken, xApiKey) {
        const auth = String(authorization || '').trim();
        const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
        return String(bearerMatch?.[1] || headerToken || xApiKey || '').trim();
    }
    getMasterToken() {
        return String(this.configService.get('CANVAS_FLOW_API_TOKEN') || '').trim();
    }
    isMasterToken(token) {
        const expected = this.getMasterToken();
        if (!expected || !token)
            return false;
        const expectedBuffer = Buffer.from(expected);
        const receivedBuffer = Buffer.from(token);
        return expectedBuffer.length === receivedBuffer.length && (0, crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer);
    }
    assertMasterToken(authorization, headerToken, xApiKey) {
        const expected = this.getMasterToken();
        if (!expected) {
            throw new common_1.UnauthorizedException('CANVAS_FLOW_API_TOKEN precisa estar configurado para gerenciar API keys.');
        }
        const received = this.extractToken(authorization, headerToken, xApiKey);
        if (!this.isMasterToken(received)) {
            throw new common_1.UnauthorizedException('Invalid Canvas Flow master API token');
        }
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    normalizeRecord(record) {
        if (!record)
            return record;
        const { tokenHash, __v, ...safeRecord } = record;
        return safeRecord;
    }
    async create(createDto, auth) {
        const name = String(createDto.name || '').trim();
        if (!name) {
            throw new common_1.HttpException('Nome da API key e obrigatorio', common_1.HttpStatus.BAD_REQUEST);
        }
        const flowId = String(createDto.flowId || '').trim() || undefined;
        const agentId = String(createDto.agentId || '').trim() || undefined;
        const scopePrefix = flowId ? 'flow' : 'global';
        const token = `cf_${scopePrefix}_${(0, crypto_1.randomBytes)(32).toString('base64url')}`;
        const tokenHash = this.hashToken(token);
        const expiresAt = createDto.expiresAt ? new Date(createDto.expiresAt) : undefined;
        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
            throw new common_1.HttpException('expiresAt inválido', common_1.HttpStatus.BAD_REQUEST);
        }
        const saved = await new this.model({
            name,
            tokenHash,
            tokenPrefix: token.slice(0, 18),
            flowId,
            agentId,
            organizationId: auth?.organizationId || createDto.organizationId,
            scopes: ['run:flow'],
            expiresAt,
            createdBy: auth?.userId || createDto.createdBy,
        }).save();
        return {
            ...this.normalizeRecord(saved.toObject()),
            token,
        };
    }
    async list(filters) {
        const query = {};
        if (filters?.flowId)
            query.$or = [{ flowId: filters.flowId }, { flowId: { $exists: false } }, { flowId: '' }];
        if (filters?.agentId)
            query.agentId = filters.agentId;
        if (filters?.organizationId)
            query.organizationId = filters.organizationId;
        const rows = await this.model.find(query).sort({ createdAt: -1 }).lean().exec();
        return rows.map((row) => this.normalizeRecord(row));
    }
    async revoke(id, organizationId) {
        const query = { _id: id };
        if (organizationId)
            query.organizationId = organizationId;
        const updated = await this.model
            .findOneAndUpdate(query, {
            active: false,
            revokedAt: new Date(),
        }, { new: true })
            .lean()
            .exec();
        if (!updated) {
            throw new common_1.HttpException('API key not found', common_1.HttpStatus.NOT_FOUND);
        }
        return this.normalizeRecord(updated);
    }
    async validateRunToken(token, context) {
        const trimmedToken = String(token || '').trim();
        if (!trimmedToken)
            return { valid: false, reason: 'missing-token' };
        if (this.isMasterToken(trimmedToken))
            return { valid: true, kind: 'master' };
        const tokenHash = this.hashToken(trimmedToken);
        const key = await this.model.findOne({ tokenHash, active: true }).lean().exec();
        if (!key)
            return { valid: false, reason: 'invalid-token' };
        if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
            return { valid: false, reason: 'expired-token' };
        }
        if (key.flowId && key.flowId !== context.flowId) {
            return { valid: false, reason: 'flow-not-allowed' };
        }
        if (key.agentId && context.agentId && key.agentId !== context.agentId) {
            return { valid: false, reason: 'agent-not-allowed' };
        }
        if (Array.isArray(key.scopes) && key.scopes.length && !key.scopes.includes('run:flow') && !key.scopes.includes('*')) {
            return { valid: false, reason: 'scope-not-allowed' };
        }
        await this.model.updateOne({ _id: key._id }, { $inc: { totalUses: 1 }, $set: { lastUsedAt: new Date() } }).exec();
        return { valid: true, kind: 'generated', key: this.normalizeRecord(key) };
    }
};
exports.ApiKeyService = ApiKeyService;
exports.ApiKeyService = ApiKeyService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(api_key_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        config_1.ConfigService])
], ApiKeyService);
//# sourceMappingURL=api-key-service.js.map