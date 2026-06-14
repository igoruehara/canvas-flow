import { AuthService } from './auth-service';
export declare class AuthController {
    private readonly service;
    constructor(service: AuthService);
    config(): Promise<{
        loginRequired: boolean;
        hasUsers: boolean;
        apiToken: string;
        apiTokenConfigured: boolean;
    }>;
    bootstrap(body: any): Promise<{
        token: string;
        user: import("./auth-service").CanvasFlowAuthUser;
    }>;
    createOrganization(body: any): Promise<{
        token: string;
        user: import("./auth-service").CanvasFlowAuthUser;
    }>;
    login(body: any): Promise<{
        token: string;
        user: import("./auth-service").CanvasFlowAuthUser;
    }>;
    me(authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        user: import("./auth-service").CanvasFlowAuthUser;
    }>;
    createUser(body: any, authorization?: string, headerToken?: string, xApiKey?: string): Promise<import("./auth-service").CanvasFlowAuthUser>;
}
