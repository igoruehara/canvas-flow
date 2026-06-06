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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const mongoose_1 = require("mongoose");
const auth_constants_model_1 = require("./auth-constants-model");
let AuthService = class AuthService {
    constructor(model, organizationModel, configService) {
        this.model = model;
        this.organizationModel = organizationModel;
        this.configService = configService;
        this.loginAttempts = new Map();
    }
    onModuleInit() {
        void this.organizationModel.createIndexes().catch(() => undefined);
    }
    isLoginRequired() {
        return ['true', '1', 'yes', 'sim'].includes(String(this.configService.get('CANVAS_FLOW_LOGIN') || '').toLowerCase());
    }
    slugify(value) {
        return String(value || 'org')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'org';
    }
    hashPassword(password) {
        const salt = (0, crypto_1.randomBytes)(16).toString('hex');
        const hash = (0, crypto_1.scryptSync)(password, salt, 64).toString('hex');
        return `scrypt:${salt}:${hash}`;
    }
    verifyPassword(password, stored) {
        const [, salt, expected] = String(stored || '').split(':');
        if (!salt || !expected)
            return false;
        const actual = (0, crypto_1.scryptSync)(password, salt, 64);
        const expectedBuffer = Buffer.from(expected, 'hex');
        return actual.length === expectedBuffer.length && (0, crypto_1.timingSafeEqual)(actual, expectedBuffer);
    }
    tokenSecret() {
        return (this.configService.get('CANVAS_FLOW_JWT_SECRET') ||
            this.configService.get('CANVAS_FLOW_API_TOKEN') ||
            'canvas-flow-dev-secret');
    }
    base64url(value) {
        return Buffer.from(value).toString('base64url');
    }
    signToken(payload) {
        const header = this.base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const body = this.base64url(JSON.stringify(payload));
        const signature = (0, crypto_1.createHmac)('sha256', this.tokenSecret()).update(`${header}.${body}`).digest('base64url');
        return `${header}.${body}.${signature}`;
    }
    verifyToken(token) {
        const parts = String(token || '').split('.');
        if (parts.length !== 3)
            return null;
        const [header, body, signature] = parts;
        const expected = (0, crypto_1.createHmac)('sha256', this.tokenSecret()).update(`${header}.${body}`).digest('base64url');
        const expectedBuffer = Buffer.from(expected);
        const signatureBuffer = Buffer.from(signature);
        if (expectedBuffer.length !== signatureBuffer.length || !(0, crypto_1.timingSafeEqual)(expectedBuffer, signatureBuffer))
            return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
        if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    toSafeUser(row) {
        return {
            id: String(row?._id || row?.id || ''),
            organizationId: String(row?.organizationId || ''),
            organizationName: String(row?.organizationName || ''),
            organizationSlug: String(row?.organizationSlug || ''),
            email: String(row?.email || ''),
            name: String(row?.name || ''),
            role: row?.role || 'member',
        };
    }
    extractToken(authorization, headerToken, xApiKey) {
        const auth = String(authorization || '').trim();
        const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
        return String(bearerMatch?.[1] || headerToken || xApiKey || '').trim();
    }
    isDuplicateKeyError(err) {
        return Number(err?.code) === 11000 || String(err?.message || '').includes('E11000');
    }
    loginThrottleWindowMs() {
        return Math.max(Number(this.configService.get('CANVAS_FLOW_LOGIN_THROTTLE_WINDOW_MS') || 10 * 60 * 1000), 60 * 1000);
    }
    loginThrottleMaxAttempts() {
        return Math.max(Number(this.configService.get('CANVAS_FLOW_LOGIN_MAX_ATTEMPTS') || 8), 3);
    }
    loginThrottleKey(email, organizationSlug) {
        return `${organizationSlug || '-'}:${email || '-'}`;
    }
    pruneLoginAttempts(now = Date.now()) {
        for (const [key, attempt] of this.loginAttempts.entries()) {
            if (attempt.resetAt <= now)
                this.loginAttempts.delete(key);
        }
    }
    assertLoginAllowed(email, organizationSlug) {
        const now = Date.now();
        this.pruneLoginAttempts(now);
        const attempt = this.loginAttempts.get(this.loginThrottleKey(email, organizationSlug));
        if (!attempt || attempt.count < this.loginThrottleMaxAttempts())
            return;
        throw new common_1.HttpException('Muitas tentativas de login. Aguarde alguns minutos e tente novamente.', common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
    registerLoginFailure(email, organizationSlug) {
        const now = Date.now();
        const key = this.loginThrottleKey(email, organizationSlug);
        const current = this.loginAttempts.get(key);
        if (!current || current.resetAt <= now) {
            this.loginAttempts.set(key, { count: 1, resetAt: now + this.loginThrottleWindowMs() });
            return;
        }
        this.loginAttempts.set(key, { ...current, count: current.count + 1 });
    }
    clearLoginFailures(email, organizationSlug) {
        this.loginAttempts.delete(this.loginThrottleKey(email, organizationSlug));
    }
    async organizationSlugExists(organizationSlug) {
        const organizationExists = await this.organizationModel.exists({ slug: organizationSlug }).exec();
        if (organizationExists)
            return true;
        const legacyUserWithSlug = await this.model.exists({ organizationSlug }).exec();
        return Boolean(legacyUserWithSlug);
    }
    async ensureOrganizationForUser(user) {
        const organizationId = String(user?.organizationId || '');
        const organizationSlug = String(user?.organizationSlug || '');
        if (!organizationId || !organizationSlug)
            return;
        const insert = {
            organizationId,
            name: String(user?.organizationName || organizationSlug),
            slug: organizationSlug,
            active: true,
            createdByEmail: String(user?.email || '').toLowerCase(),
        };
        if (user?.role === 'owner')
            insert.ownerUserId = String(user?._id || user?.id || '');
        try {
            await this.organizationModel.updateOne({ slug: organizationSlug }, { $setOnInsert: insert }, { upsert: true }).exec();
        }
        catch (err) {
            if (!this.isDuplicateKeyError(err))
                throw err;
        }
    }
    async getConfig() {
        const usersCount = await this.model.countDocuments({ active: true }).exec().catch(() => 0);
        return {
            loginRequired: this.isLoginRequired(),
            hasUsers: usersCount > 0,
        };
    }
    async createOwnerSession(body) {
        const organizationName = String(body?.organizationName || 'Organizacao').trim();
        const organizationSlug = this.slugify(body?.organizationSlug || organizationName);
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        const name = String(body?.name || email).trim();
        if (!organizationName || !email || !password || password.length < 8) {
            throw new common_1.HttpException('Informe organizacao, email e senha com pelo menos 8 caracteres.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (await this.organizationSlugExists(organizationSlug)) {
            throw new common_1.HttpException('Esta organizacao ja existe. Escolha outro identificador.', common_1.HttpStatus.CONFLICT);
        }
        let organization = null;
        let userCreated = false;
        try {
            organization = await new this.organizationModel({
                organizationId: (0, crypto_1.randomBytes)(12).toString('hex'),
                name: organizationName,
                slug: organizationSlug,
                active: true,
                createdByEmail: email,
            }).save();
            const user = await new this.model({
                organizationId: organization.organizationId,
                organizationName: organization.name,
                organizationSlug: organization.slug,
                email,
                name,
                role: 'owner',
                passwordHash: this.hashPassword(password),
                active: true,
            }).save();
            userCreated = true;
            await this.organizationModel.updateOne({ _id: organization._id }, { $set: { ownerUserId: String(user._id) } }).exec().catch(() => undefined);
            return this.createSession(this.toSafeUser(user.toObject()));
        }
        catch (err) {
            if (organization && !userCreated) {
                await this.organizationModel.deleteOne({ _id: organization._id }).exec().catch(() => undefined);
            }
            if (this.isDuplicateKeyError(err)) {
                throw new common_1.HttpException('Esta organizacao ja existe. Escolha outro identificador.', common_1.HttpStatus.CONFLICT);
            }
            throw err;
        }
    }
    async bootstrap(body) {
        const usersCount = await this.model.countDocuments({}).exec();
        if (usersCount > 0) {
            throw new common_1.HttpException('Login ja foi inicializado.', common_1.HttpStatus.CONFLICT);
        }
        return await this.createOwnerSession(body);
    }
    async createOrganization(body) {
        return await this.createOwnerSession(body);
    }
    async login(body) {
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        const rawOrganizationSlug = String(body?.organizationSlug || '').trim();
        const organizationSlug = rawOrganizationSlug ? this.slugify(rawOrganizationSlug) : '';
        this.assertLoginAllowed(email, organizationSlug);
        const query = { email, active: true };
        if (organizationSlug) {
            const organization = await this.organizationModel.findOne({ slug: organizationSlug }).lean().exec().catch(() => null);
            if (organization && organization.active === false) {
                this.registerLoginFailure(email, organizationSlug);
                throw new common_1.UnauthorizedException('Email, organizacao ou senha invalidos.');
            }
            if (organization?.organizationId) {
                query.organizationId = organization.organizationId;
            }
            else {
                query.organizationSlug = organizationSlug;
            }
        }
        const candidates = organizationSlug
            ? await this.model.find(query).select('+passwordHash').limit(1).lean().exec()
            : await this.model.find(query).select('+passwordHash').limit(2).lean().exec();
        if (!organizationSlug && candidates.length > 1) {
            throw new common_1.HttpException('Informe o identificador da organizacao para continuar.', common_1.HttpStatus.BAD_REQUEST);
        }
        const user = candidates[0];
        if (!user || !this.verifyPassword(password, user.passwordHash)) {
            this.registerLoginFailure(email, organizationSlug);
            throw new common_1.UnauthorizedException('Email, organizacao ou senha invalidos.');
        }
        await this.ensureOrganizationForUser(user);
        await this.model.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();
        this.clearLoginFailures(email, organizationSlug);
        return this.createSession(this.toSafeUser(user));
    }
    createSession(user) {
        const ttlHours = Math.max(Number(this.configService.get('CANVAS_FLOW_LOGIN_TTL_HOURS') || 24), 1);
        const token = this.signToken({
            sub: user.id,
            org: user.organizationId,
            role: user.role,
            exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
        });
        return { token, user };
    }
    async resolveUserFromToken(token) {
        const payload = this.verifyToken(token);
        if (!payload?.sub)
            return null;
        const user = await this.model.findOne({ _id: payload.sub, active: true }).lean().exec();
        if (!user)
            return null;
        if (payload.org && String(payload.org) !== String(user.organizationId))
            return null;
        const organization = await this.organizationModel
            .findOne({ organizationId: user.organizationId })
            .lean()
            .exec()
            .catch(() => null);
        if (organization && organization.active === false)
            return null;
        return this.toSafeUser(user);
    }
    async resolveUserFromHeaders(authorization, headerToken, xApiKey) {
        const token = this.extractToken(authorization, headerToken, xApiKey);
        if (!token)
            return null;
        return await this.resolveUserFromToken(token);
    }
    async assertUiAuth(authorization, headerToken, xApiKey) {
        if (!this.isLoginRequired())
            return null;
        const user = await this.resolveUserFromHeaders(authorization, headerToken, xApiKey);
        if (!user)
            throw new common_1.UnauthorizedException('Login obrigatorio.');
        return user;
    }
    async createUser(body, actor) {
        if (!['owner', 'admin'].includes(actor.role)) {
            throw new common_1.UnauthorizedException('Apenas admins podem criar usuarios.');
        }
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        const name = String(body?.name || email).trim();
        if (!email || !password || password.length < 8) {
            throw new common_1.HttpException('Informe email e senha com pelo menos 8 caracteres.', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.ensureOrganizationForUser(actor);
        const saved = await new this.model({
            organizationId: actor.organizationId,
            organizationName: actor.organizationName,
            organizationSlug: actor.organizationSlug,
            email,
            name,
            role: body?.role === 'admin' ? 'admin' : 'member',
            passwordHash: this.hashPassword(password),
            active: true,
        }).save();
        return this.toSafeUser(saved.toObject());
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_constants_model_1.MODEL_NAME)),
    __param(1, (0, common_1.Inject)(auth_constants_model_1.ORGANIZATION_MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        mongoose_1.Model,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth-service.js.map