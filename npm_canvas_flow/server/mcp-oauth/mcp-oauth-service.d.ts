import { ConfigService } from '@nestjs/config';
import { OAuthClientProvider, type OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { Model } from 'mongoose';
import { CanvasMcpOAuthConnectionEntity } from './mcp-oauth-schema';
type OAuthStatus = 'pending' | 'connected' | 'error';
export type McpOAuthConnectionScope = 'agent' | 'user';
export interface McpOAuthScope {
    organizationId?: string;
    agentId?: string;
    connectionScope?: McpOAuthConnectionScope;
    oauthUserId?: string;
}
declare class PersistentMcpOAuthProvider implements OAuthClientProvider {
    private readonly service;
    private readonly key;
    private readonly redirectUrlValue;
    private readonly clientMetadataValue;
    latestAuthorizationUrl: string;
    constructor(service: McpOAuthService, key: string, redirectUrlValue: string, clientMetadataValue: OAuthClientMetadata);
    get redirectUrl(): string;
    get clientMetadata(): {
        redirect_uris: string[];
        token_endpoint_auth_method?: string;
        grant_types?: string[];
        response_types?: string[];
        client_name?: string;
        client_uri?: string;
        logo_uri?: string;
        scope?: string;
        contacts?: string[];
        tos_uri?: string;
        policy_uri?: string;
        jwks_uri?: string;
        jwks?: any;
        software_id?: string;
        software_version?: string;
        software_statement?: string;
    };
    state(): Promise<string>;
    clientInformation(): Promise<OAuthClientInformationMixed>;
    saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void>;
    tokens(): Promise<{
        access_token: string;
        token_type: string;
        id_token?: string;
        expires_in?: number;
        scope?: string;
        refresh_token?: string;
    }>;
    saveTokens(tokens: OAuthTokens): Promise<void>;
    redirectToAuthorization(authorizationUrl: URL): Promise<void>;
    saveCodeVerifier(codeVerifier: string): Promise<void>;
    codeVerifier(): Promise<string>;
    saveDiscoveryState(state: OAuthDiscoveryState): Promise<void>;
    discoveryState(): Promise<OAuthDiscoveryState>;
    invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void>;
}
export declare class McpOAuthService {
    private model;
    private readonly configService;
    constructor(model: Model<CanvasMcpOAuthConnectionEntity>, configService: ConfigService);
    private normalizeAgentId;
    private normalizeOrganizationId;
    private normalizeConnectionScope;
    private normalizeOAuthUserId;
    normalizeServerUrl(value: string): string;
    private serverUrlHash;
    private connectionKey;
    private secretKey;
    private encryptText;
    private decryptText;
    private encryptJson;
    private decryptJson;
    private assertDbReady;
    private buildCallbackUrl;
    private buildClientMetadata;
    private defaultScopeForServer;
    private isFigmaServer;
    private isAtlassianServer;
    private getStaticClientInformation;
    private formatStartError;
    private inspectStoredTokens;
    private sanitize;
    getConnectionByKey(key: string): Promise<import("mongoose").FlattenMaps<CanvasMcpOAuthConnectionEntity> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    getEncryptedJson<T>(key: string, field: 'clientInformation' | 'tokens' | 'codeVerifier' | 'discoveryState'): Promise<T>;
    saveEncryptedJson(key: string, field: 'clientInformation' | 'tokens' | 'codeVerifier' | 'discoveryState', value: any): Promise<void>;
    saveTokens(key: string, tokens: OAuthTokens): Promise<void>;
    setAuthorizationUrl(key: string, authorizationUrl: string): Promise<void>;
    invalidateCredentials(key: string, scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void>;
    private createProvider;
    startAuthorization(params: {
        serverUrl: string;
        agentId?: string;
        organizationId?: string;
        userId?: string;
        connectionScope?: McpOAuthConnectionScope;
        oauthUserId?: string;
        baseUrl?: string;
        label?: string;
        scope?: string;
        clientName?: string;
    }): Promise<{
        connected: boolean;
        status: OAuthStatus;
        serverUrl: any;
        agentId: any;
        organizationId: any;
        connectionScope: McpOAuthConnectionScope;
        label: any;
        scope: any;
        authorizationUrl: any;
        expiresAt: string;
        authenticatedAt: string;
        updatedAt: string;
        error: any;
    }>;
    finishAuthorization(params: {
        state: string;
        code?: string;
        error?: string;
    }): Promise<{
        connected: boolean;
        status: OAuthStatus;
        serverUrl: any;
        agentId: any;
        organizationId: any;
        connectionScope: McpOAuthConnectionScope;
        label: any;
        scope: any;
        authorizationUrl: any;
        expiresAt: string;
        authenticatedAt: string;
        updatedAt: string;
        error: any;
    }>;
    getStatus(params: McpOAuthScope & {
        serverUrl: string;
    }): Promise<{
        connected: boolean;
        status: OAuthStatus;
        serverUrl: any;
        agentId: any;
        organizationId: any;
        connectionScope: McpOAuthConnectionScope;
        label: any;
        scope: any;
        authorizationUrl: any;
        expiresAt: string;
        authenticatedAt: string;
        updatedAt: string;
        error: any;
    } | {
        connected: boolean;
        status: string;
        error: string;
        serverUrl?: undefined;
        agentId?: undefined;
        organizationId?: undefined;
        connectionScope?: undefined;
    } | {
        connected: false;
        status: "pending";
        serverUrl: string;
        agentId: string;
        organizationId: string;
        connectionScope: McpOAuthConnectionScope;
        error: string;
    }>;
    disconnect(params: McpOAuthScope & {
        serverUrl: string;
    }): Promise<{
        connected: boolean;
        status: string;
        serverUrl: string;
        agentId: string;
        organizationId: string;
        connectionScope: McpOAuthConnectionScope;
        error: string;
    }>;
    createRuntimeProvider(params: McpOAuthScope & {
        serverUrl: string;
    }): Promise<PersistentMcpOAuthProvider>;
}
export {};
