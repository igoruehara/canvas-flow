import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { CanvasFlowApiKeyEntity } from './api-key-schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
export interface RunKeyContext {
    flowId?: string;
    agentId?: string;
}
export declare class ApiKeyService {
    private model;
    private readonly configService;
    constructor(model: Model<CanvasFlowApiKeyEntity>, configService: ConfigService);
    extractToken(authorization?: string, headerToken?: string, xApiKey?: string): string;
    getMasterToken(): string;
    isMasterToken(token: string): boolean;
    assertMasterToken(authorization?: string, headerToken?: string, xApiKey?: string): void;
    private hashToken;
    private normalizeRecord;
    create(createDto: CreateApiKeyDto, auth?: {
        organizationId?: string;
        userId?: string;
    }): Promise<any>;
    list(filters?: {
        flowId?: string;
        agentId?: string;
        organizationId?: string;
    }): Promise<any[]>;
    revoke(id: string, organizationId?: string): Promise<any>;
    validateRunToken(token: string, context: RunKeyContext): Promise<{
        valid: boolean;
        reason: string;
        kind?: undefined;
        key?: undefined;
    } | {
        valid: boolean;
        kind: "master";
        reason?: undefined;
        key?: undefined;
    } | {
        valid: boolean;
        kind: "generated";
        key: any;
        reason?: undefined;
    }>;
}
