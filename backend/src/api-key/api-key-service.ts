import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { MODEL_NAME } from './api-key-constants-model';
import { CanvasFlowApiKeyEntity } from './api-key-schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export interface RunKeyContext {
  flowId?: string;
  agentId?: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(MODEL_NAME) private model: Model<CanvasFlowApiKeyEntity>,
    private readonly configService: ConfigService,
  ) {}

  extractToken(authorization?: string, headerToken?: string, xApiKey?: string) {
    const auth = String(authorization || '').trim();
    const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
    return String(bearerMatch?.[1] || headerToken || xApiKey || '').trim();
  }

  getMasterToken() {
    return String(this.configService.get<string>('CANVAS_FLOW_API_TOKEN') || '').trim();
  }

  isMasterToken(token: string) {
    const expected = this.getMasterToken();
    if (!expected || !token) return false;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(token);
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  assertMasterToken(authorization?: string, headerToken?: string, xApiKey?: string) {
    const expected = this.getMasterToken();
    if (!expected) {
      throw new UnauthorizedException('CANVAS_FLOW_API_TOKEN precisa estar configurado para gerenciar API keys.');
    }

    const received = this.extractToken(authorization, headerToken, xApiKey);
    if (!this.isMasterToken(received)) {
      throw new UnauthorizedException('Invalid Canvas Flow master API token');
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeRecord(record: any) {
    if (!record) return record;
    const { tokenHash, __v, ...safeRecord } = record;
    return safeRecord;
  }

  async create(createDto: CreateApiKeyDto, auth?: { organizationId?: string; userId?: string }) {
    const name = String(createDto.name || '').trim();
    if (!name) {
      throw new HttpException('Nome da API key e obrigatorio', HttpStatus.BAD_REQUEST);
    }

    const flowId = String(createDto.flowId || '').trim() || undefined;
    const agentId = String(createDto.agentId || '').trim() || undefined;
    const scopePrefix = flowId ? 'flow' : 'global';
    const token = `cf_${scopePrefix}_${randomBytes(32).toString('base64url')}`;
    const tokenHash = this.hashToken(token);
    const expiresAt = createDto.expiresAt ? new Date(createDto.expiresAt) : undefined;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new HttpException('expiresAt inválido', HttpStatus.BAD_REQUEST);
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

  async list(filters?: { flowId?: string; agentId?: string; organizationId?: string }) {
    const query: Record<string, any> = {};
    if (filters?.flowId) query.$or = [{ flowId: filters.flowId }, { flowId: { $exists: false } }, { flowId: '' }];
    if (filters?.agentId) query.agentId = filters.agentId;
    if (filters?.organizationId) query.organizationId = filters.organizationId;

    const rows = await this.model.find(query).sort({ createdAt: -1 }).lean().exec();
    return rows.map((row) => this.normalizeRecord(row));
  }

  async revoke(id: string, organizationId?: string) {
    const query: Record<string, any> = { _id: id };
    if (organizationId) query.organizationId = organizationId;
    const updated = await this.model
      .findOneAndUpdate(
        query,
        {
          active: false,
          revokedAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new HttpException('API key not found', HttpStatus.NOT_FOUND);
    }

    return this.normalizeRecord(updated);
  }

  async validateRunToken(token: string, context: RunKeyContext) {
    const trimmedToken = String(token || '').trim();
    if (!trimmedToken) return { valid: false, reason: 'missing-token' };
    if (this.isMasterToken(trimmedToken)) return { valid: true, kind: 'master' as const };

    const tokenHash = this.hashToken(trimmedToken);
    const key = await this.model.findOne({ tokenHash, active: true }).lean().exec();
    if (!key) return { valid: false, reason: 'invalid-token' };

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
    return { valid: true, kind: 'generated' as const, key: this.normalizeRecord(key) };
  }
}
