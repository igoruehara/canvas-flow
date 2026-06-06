import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { MODEL_NAME, ORGANIZATION_MODEL_NAME } from './auth-constants-model';
import { CanvasFlowOrganizationEntity } from './auth-organization-schema';
import { CanvasFlowUserEntity } from './auth-schema';

export interface CanvasFlowAuthUser {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly loginAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(MODEL_NAME) private model: Model<CanvasFlowUserEntity>,
    @Inject(ORGANIZATION_MODEL_NAME) private organizationModel: Model<CanvasFlowOrganizationEntity>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    void this.organizationModel.createIndexes().catch(() => undefined);
  }

  isLoginRequired() {
    return ['true', '1', 'yes', 'sim'].includes(String(this.configService.get<string>('CANVAS_FLOW_LOGIN') || '').toLowerCase());
  }

  private slugify(value: string) {
    return String(value || 'org')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'org';
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string) {
    const [, salt, expected] = String(stored || '').split(':');
    if (!salt || !expected) return false;
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  }

  private tokenSecret() {
    return (
      this.configService.get<string>('CANVAS_FLOW_JWT_SECRET') ||
      this.configService.get<string>('CANVAS_FLOW_API_TOKEN') ||
      'canvas-flow-dev-secret'
    );
  }

  private base64url(value: string | Buffer) {
    return Buffer.from(value).toString('base64url');
  }

  private signToken(payload: Record<string, any>) {
    const header = this.base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this.base64url(JSON.stringify(payload));
    const signature = createHmac('sha256', this.tokenSecret()).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private verifyToken(token: string) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = createHmac('sha256', this.tokenSecret()).update(`${header}.${body}`).digest('base64url');
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  }

  private toSafeUser(row: any): CanvasFlowAuthUser {
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

  private extractToken(authorization?: string, headerToken?: string, xApiKey?: string) {
    const auth = String(authorization || '').trim();
    const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
    return String(bearerMatch?.[1] || headerToken || xApiKey || '').trim();
  }

  private isDuplicateKeyError(err: any) {
    return Number(err?.code) === 11000 || String(err?.message || '').includes('E11000');
  }

  private loginThrottleWindowMs() {
    return Math.max(Number(this.configService.get<string>('CANVAS_FLOW_LOGIN_THROTTLE_WINDOW_MS') || 10 * 60 * 1000), 60 * 1000);
  }

  private loginThrottleMaxAttempts() {
    return Math.max(Number(this.configService.get<string>('CANVAS_FLOW_LOGIN_MAX_ATTEMPTS') || 8), 3);
  }

  private loginThrottleKey(email: string, organizationSlug: string) {
    return `${organizationSlug || '-'}:${email || '-'}`;
  }

  private pruneLoginAttempts(now = Date.now()) {
    for (const [key, attempt] of this.loginAttempts.entries()) {
      if (attempt.resetAt <= now) this.loginAttempts.delete(key);
    }
  }

  private assertLoginAllowed(email: string, organizationSlug: string) {
    const now = Date.now();
    this.pruneLoginAttempts(now);
    const attempt = this.loginAttempts.get(this.loginThrottleKey(email, organizationSlug));
    if (!attempt || attempt.count < this.loginThrottleMaxAttempts()) return;

    throw new HttpException('Muitas tentativas de login. Aguarde alguns minutos e tente novamente.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private registerLoginFailure(email: string, organizationSlug: string) {
    const now = Date.now();
    const key = this.loginThrottleKey(email, organizationSlug);
    const current = this.loginAttempts.get(key);
    if (!current || current.resetAt <= now) {
      this.loginAttempts.set(key, { count: 1, resetAt: now + this.loginThrottleWindowMs() });
      return;
    }
    this.loginAttempts.set(key, { ...current, count: current.count + 1 });
  }

  private clearLoginFailures(email: string, organizationSlug: string) {
    this.loginAttempts.delete(this.loginThrottleKey(email, organizationSlug));
  }

  private async organizationSlugExists(organizationSlug: string) {
    const organizationExists = await this.organizationModel.exists({ slug: organizationSlug }).exec();
    if (organizationExists) return true;
    const legacyUserWithSlug = await this.model.exists({ organizationSlug }).exec();
    return Boolean(legacyUserWithSlug);
  }

  private async ensureOrganizationForUser(user: any) {
    const organizationId = String(user?.organizationId || '');
    const organizationSlug = String(user?.organizationSlug || '');
    if (!organizationId || !organizationSlug) return;

    const insert: Record<string, any> = {
      organizationId,
      name: String(user?.organizationName || organizationSlug),
      slug: organizationSlug,
      active: true,
      createdByEmail: String(user?.email || '').toLowerCase(),
    };
    if (user?.role === 'owner') insert.ownerUserId = String(user?._id || user?.id || '');

    try {
      await this.organizationModel.updateOne({ slug: organizationSlug }, { $setOnInsert: insert }, { upsert: true }).exec();
    } catch (err) {
      if (!this.isDuplicateKeyError(err)) throw err;
    }
  }

  async getConfig() {
    const usersCount = await this.model.countDocuments({ active: true }).exec().catch(() => 0);
    return {
      loginRequired: this.isLoginRequired(),
      hasUsers: usersCount > 0,
    };
  }

  private async createOwnerSession(body: any) {
    const organizationName = String(body?.organizationName || 'Organizacao').trim();
    const organizationSlug = this.slugify(body?.organizationSlug || organizationName);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const name = String(body?.name || email).trim();
    if (!organizationName || !email || !password || password.length < 8) {
      throw new HttpException('Informe organizacao, email e senha com pelo menos 8 caracteres.', HttpStatus.BAD_REQUEST);
    }

    if (await this.organizationSlugExists(organizationSlug)) {
      throw new HttpException('Esta organizacao ja existe. Escolha outro identificador.', HttpStatus.CONFLICT);
    }

    let organization: CanvasFlowOrganizationEntity | null = null;
    let userCreated = false;
    try {
      organization = await new this.organizationModel({
        organizationId: randomBytes(12).toString('hex'),
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
    } catch (err) {
      if (organization && !userCreated) {
        await this.organizationModel.deleteOne({ _id: organization._id }).exec().catch(() => undefined);
      }
      if (this.isDuplicateKeyError(err)) {
        throw new HttpException('Esta organizacao ja existe. Escolha outro identificador.', HttpStatus.CONFLICT);
      }
      throw err;
    }
  }

  async bootstrap(body: any) {
    const usersCount = await this.model.countDocuments({}).exec();
    if (usersCount > 0) {
      throw new HttpException('Login ja foi inicializado.', HttpStatus.CONFLICT);
    }

    return await this.createOwnerSession(body);
  }

  async createOrganization(body: any) {
    return await this.createOwnerSession(body);
  }

  async login(body: any) {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const rawOrganizationSlug = String(body?.organizationSlug || '').trim();
    const organizationSlug = rawOrganizationSlug ? this.slugify(rawOrganizationSlug) : '';
    this.assertLoginAllowed(email, organizationSlug);

    const query: Record<string, any> = { email, active: true };
    if (organizationSlug) {
      const organization = await this.organizationModel.findOne({ slug: organizationSlug }).lean().exec().catch(() => null);
      if (organization && organization.active === false) {
        this.registerLoginFailure(email, organizationSlug);
        throw new UnauthorizedException('Email, organizacao ou senha invalidos.');
      }
      if (organization?.organizationId) {
        query.organizationId = organization.organizationId;
      } else {
        query.organizationSlug = organizationSlug;
      }
    }

    const candidates = organizationSlug
      ? await this.model.find(query).select('+passwordHash').limit(1).lean().exec()
      : await this.model.find(query).select('+passwordHash').limit(2).lean().exec();
    if (!organizationSlug && candidates.length > 1) {
      throw new HttpException('Informe o identificador da organizacao para continuar.', HttpStatus.BAD_REQUEST);
    }

    const user = candidates[0];
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      this.registerLoginFailure(email, organizationSlug);
      throw new UnauthorizedException('Email, organizacao ou senha invalidos.');
    }

    await this.ensureOrganizationForUser(user);
    await this.model.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();
    this.clearLoginFailures(email, organizationSlug);
    return this.createSession(this.toSafeUser(user));
  }

  private createSession(user: CanvasFlowAuthUser) {
    const ttlHours = Math.max(Number(this.configService.get<string>('CANVAS_FLOW_LOGIN_TTL_HOURS') || 24), 1);
    const token = this.signToken({
      sub: user.id,
      org: user.organizationId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
    });
    return { token, user };
  }

  async resolveUserFromToken(token: string): Promise<CanvasFlowAuthUser | null> {
    const payload = this.verifyToken(token);
    if (!payload?.sub) return null;
    const user = await this.model.findOne({ _id: payload.sub, active: true }).lean().exec();
    if (!user) return null;
    if (payload.org && String(payload.org) !== String(user.organizationId)) return null;

    const organization = await this.organizationModel
      .findOne({ organizationId: user.organizationId })
      .lean()
      .exec()
      .catch(() => null);
    if (organization && organization.active === false) return null;

    return this.toSafeUser(user);
  }

  async resolveUserFromHeaders(authorization?: string, headerToken?: string, xApiKey?: string) {
    const token = this.extractToken(authorization, headerToken, xApiKey);
    if (!token) return null;
    return await this.resolveUserFromToken(token);
  }

  async assertUiAuth(authorization?: string, headerToken?: string, xApiKey?: string) {
    if (!this.isLoginRequired()) return null;
    const user = await this.resolveUserFromHeaders(authorization, headerToken, xApiKey);
    if (!user) throw new UnauthorizedException('Login obrigatorio.');
    return user;
  }

  async createUser(body: any, actor: CanvasFlowAuthUser) {
    if (!['owner', 'admin'].includes(actor.role)) {
      throw new UnauthorizedException('Apenas admins podem criar usuarios.');
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const name = String(body?.name || email).trim();
    if (!email || !password || password.length < 8) {
      throw new HttpException('Informe email e senha com pelo menos 8 caracteres.', HttpStatus.BAD_REQUEST);
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
}
