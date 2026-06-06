import { AuthService } from '../auth/auth-service';
import { ProviderConfigService } from './provider-config-service';
export declare class ProviderConfigController {
    private readonly service;
    private readonly authService;
    constructor(service: ProviderConfigService, authService: AuthService);
    private assertAuth;
    getConfig(agentId?: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        providerStatus?: Record<import("./provider-config-service").ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
    updateConfig(body: any, agentId?: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        providerStatus?: Record<import("./provider-config-service").ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
    clearConfigSection(section: string, agentId?: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<{
        providerStatus?: Record<import("./provider-config-service").ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
}
