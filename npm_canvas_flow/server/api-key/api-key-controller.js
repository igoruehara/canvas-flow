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
exports.ApiKeyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const api_key_service_1 = require("./api-key-service");
const create_api_key_dto_1 = require("./dto/create-api-key.dto");
let ApiKeyController = class ApiKeyController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async resolveManagementAccess(authorization, headerToken, xApiKey) {
        if (this.authService.isLoginRequired()) {
            const user = await this.authService.resolveUserFromHeaders(authorization, headerToken, xApiKey);
            if (user)
                return user;
        }
        this.service.assertMasterToken(authorization, headerToken, xApiKey);
        return null;
    }
    async list(authorization, headerToken, xApiKey, flowId, agentId) {
        const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
        return await this.service.list({ flowId, agentId, organizationId: user?.organizationId });
    }
    async create(createDto, authorization, headerToken, xApiKey) {
        const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
        return await this.service.create(createDto, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async revoke(id, authorization, headerToken, xApiKey) {
        const user = await this.resolveManagementAccess(authorization, headerToken, xApiKey);
        return await this.service.revoke(id, user?.organizationId);
    }
};
exports.ApiKeyController = ApiKeyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(2, (0, common_1.Headers)('x-api-key')),
    __param(3, (0, common_1.Query)('flowId')),
    __param(4, (0, common_1.Query)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_api_key_dto_1.CreateApiKeyDto, String, String, String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ApiKeyController.prototype, "revoke", null);
exports.ApiKeyController = ApiKeyController = __decorate([
    (0, swagger_1.ApiTags)('canvas-flow-api-keys'),
    (0, common_1.Controller)('api/canvas-flow-api-keys'),
    __metadata("design:paramtypes", [api_key_service_1.ApiKeyService,
        auth_service_1.AuthService])
], ApiKeyController);
//# sourceMappingURL=api-key-controller.js.map