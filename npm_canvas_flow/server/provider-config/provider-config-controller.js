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
exports.ProviderConfigController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const provider_config_service_1 = require("./provider-config-service");
let ProviderConfigController = class ProviderConfigController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async assertAuth(authorization, headerToken, xApiKey) {
        return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    }
    async getConfig(agentId, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.getSafeSettings(agentId);
    }
    async updateConfig(body, agentId, authorization, headerToken, xApiKey) {
        const user = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.updateSettings(body?.settings || body || {}, user?.id, body?.agentId || agentId);
    }
    async completeWhatsappEmbeddedSignup(body, agentId, authorization, headerToken, xApiKey) {
        const user = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.completeWhatsappEmbeddedSignup(body || {}, user?.id, body?.agentId || agentId);
    }
    async clearConfigSection(section, agentId, authorization, headerToken, xApiKey) {
        const user = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.clearSection(section, user?.id, agentId);
    }
};
exports.ProviderConfigController = ProviderConfigController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('agentId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProviderConfigController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProviderConfigController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('whatsapp/embedded-signup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProviderConfigController.prototype, "completeWhatsappEmbeddedSignup", null);
__decorate([
    (0, common_1.Delete)(':section'),
    __param(0, (0, common_1.Param)('section')),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProviderConfigController.prototype, "clearConfigSection", null);
exports.ProviderConfigController = ProviderConfigController = __decorate([
    (0, swagger_1.ApiTags)('provider-config'),
    (0, common_1.Controller)('api/provider-config'),
    __metadata("design:paramtypes", [provider_config_service_1.ProviderConfigService,
        auth_service_1.AuthService])
], ProviderConfigController);
//# sourceMappingURL=provider-config-controller.js.map