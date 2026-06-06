import { AuthService } from '../auth/auth-service';
import { ApiKeyService } from './api-key-service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
export declare class ApiKeyController {
    private readonly service;
    private readonly authService;
    constructor(service: ApiKeyService, authService: AuthService);
    private resolveManagementAccess;
    list(authorization?: string, headerToken?: string, xApiKey?: string, flowId?: string, agentId?: string): Promise<any[]>;
    create(createDto: CreateApiKeyDto, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
    revoke(id: string, authorization?: string, headerToken?: string, xApiKey?: string): Promise<any>;
}
