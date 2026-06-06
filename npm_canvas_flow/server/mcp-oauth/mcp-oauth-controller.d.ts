import { AuthService } from '../auth/auth-service';
import { McpOAuthService } from './mcp-oauth-service';
export declare class McpOAuthController {
    private readonly service;
    private readonly authService;
    constructor(service: McpOAuthService, authService: AuthService);
    private assertAuth;
    private requestBaseUrl;
    private html;
    start(body: any, req: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        connected: boolean;
        status: "error" | "connected" | "pending";
        serverUrl: any;
        agentId: any;
        organizationId: any;
        connectionScope: import("./mcp-oauth-service").McpOAuthConnectionScope;
        label: any;
        scope: any;
        authorizationUrl: any;
        expiresAt: string;
        authenticatedAt: string;
        updatedAt: string;
        error: any;
    }>;
    status(serverUrl: string, agentId?: string, connectionScope?: 'agent' | 'user', authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        connected: boolean;
        status: "error" | "connected" | "pending";
        serverUrl: any;
        agentId: any;
        organizationId: any;
        connectionScope: import("./mcp-oauth-service").McpOAuthConnectionScope;
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
        connectionScope: import("./mcp-oauth-service").McpOAuthConnectionScope;
        error: string;
    }>;
    disconnect(serverUrl: string, agentId?: string, connectionScope?: 'agent' | 'user', authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        connected: boolean;
        status: string;
        serverUrl: string;
        agentId: string;
        organizationId: string;
        connectionScope: import("./mcp-oauth-service").McpOAuthConnectionScope;
        error: string;
    }>;
    callback(state: string, code: string, error: string, res: any): Promise<void>;
}
