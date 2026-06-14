import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
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
export declare class AuthService implements OnModuleInit {
    private model;
    private organizationModel;
    private readonly configService;
    private readonly loginAttempts;
    constructor(model: Model<CanvasFlowUserEntity>, organizationModel: Model<CanvasFlowOrganizationEntity>, configService: ConfigService);
    onModuleInit(): void;
    isLoginRequired(): boolean;
    private slugify;
    private hashPassword;
    private verifyPassword;
    private tokenSecret;
    private base64url;
    private signToken;
    private verifyToken;
    private toSafeUser;
    private extractToken;
    private isDuplicateKeyError;
    private loginThrottleWindowMs;
    private loginThrottleMaxAttempts;
    private loginThrottleKey;
    private pruneLoginAttempts;
    private assertLoginAllowed;
    private registerLoginFailure;
    private clearLoginFailures;
    private organizationSlugExists;
    private ensureOrganizationForUser;
    getConfig(): Promise<{
        loginRequired: boolean;
        hasUsers: boolean;
        apiToken: string;
        apiTokenConfigured: boolean;
    }>;
    private createOwnerSession;
    bootstrap(body: any): Promise<{
        token: string;
        user: CanvasFlowAuthUser;
    }>;
    createOrganization(body: any): Promise<{
        token: string;
        user: CanvasFlowAuthUser;
    }>;
    login(body: any): Promise<{
        token: string;
        user: CanvasFlowAuthUser;
    }>;
    private createSession;
    resolveUserFromToken(token: string): Promise<CanvasFlowAuthUser | null>;
    resolveUserFromHeaders(authorization?: string, headerToken?: string, xApiKey?: string): Promise<CanvasFlowAuthUser>;
    assertUiAuth(authorization?: string, headerToken?: string, xApiKey?: string): Promise<CanvasFlowAuthUser>;
    createUser(body: any, actor: CanvasFlowAuthUser): Promise<CanvasFlowAuthUser>;
}
