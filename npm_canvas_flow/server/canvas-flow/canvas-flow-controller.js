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
exports.CanvasFlowController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const canvas_flow_service_1 = require("./canvas-flow-service");
const create_canvas_flow_dto_1 = require("./dto/create-canvas-flow.dto");
const update_canvas_flow_dto_1 = require("./dto/update-canvas-flow.dto");
let CanvasFlowController = class CanvasFlowController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async create(createDto, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.create(createDto, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async findAll(agentId, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.findAll(agentId, user?.organizationId);
    }
    async listAgents(authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.listAgents(user?.organizationId);
    }
    async createAgent(body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.createAgent(body?.name, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async reorderAgents(body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        const orderedAgentIds = Array.isArray(body?.orderedAgentIds)
            ? body.orderedAgentIds.map((id) => String(id))
            : Array.isArray(body?.orderedNames)
                ? body.orderedNames.map((name) => String(name))
                : [];
        return await this.service.reorderAgents(orderedAgentIds, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async updateAgentConfig(name, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.updateAgentConfig(name, body?.config || body || {}, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async exportAgentWorkspace(name, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.exportAgentWorkspace(name, user?.organizationId);
    }
    async importAgentWorkspace(name, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.importAgentWorkspace(name, body, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async renameAgent(name, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.renameAgent(name, body?.name, user ? { organizationId: user.organizationId } : undefined);
    }
    async removeAgent(name, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.removeAgent(name, body?.confirmationName, user ? { organizationId: user.organizationId } : undefined);
    }
    async getAgentReleases(name, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.getAgentReleases(name, user ? { organizationId: user.organizationId, userId: user.id } : undefined);
    }
    async deployAgentRelease(name, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.deployAgentRelease(name, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async activateAgentRelease(name, release, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.activateAgentRelease(name, release, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async renameAgentRelease(name, release, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.renameAgentRelease(name, release, body, user ? { organizationId: user.organizationId } : undefined);
    }
    async overwriteAgentRelease(name, release, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.overwriteAgentRelease(name, release, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async deleteAgentRelease(name, release, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.deleteAgentRelease(name, release, user ? { organizationId: user.organizationId } : undefined);
    }
    async getVersions(id, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.getVersions(id, user ? { organizationId: user.organizationId } : undefined);
    }
    async findOne(id, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.findOne(id, user?.organizationId);
    }
    async deployVersion(id, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.deployVersion(id, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async activateVersion(id, version, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.activateVersion(id, version, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async renameVersion(id, version, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.renameVersion(id, version, body, user ? { organizationId: user.organizationId } : undefined);
    }
    async overwriteVersion(id, version, body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.overwriteVersion(id, version, body, user ? { organizationId: user.organizationId, userId: user.id, userEmail: user.email } : undefined);
    }
    async deleteVersion(id, version, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.deleteVersion(id, version, user ? { organizationId: user.organizationId } : undefined);
    }
    async reorder(body, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.map((id) => String(id)) : [];
        return await this.service.reorder(orderedIds, body?.agentId, user?.organizationId);
    }
    async update(id, updateDto, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.update(id, updateDto, user ? { organizationId: user.organizationId } : undefined);
    }
    async remove(id, authorization, headerToken, xApiKey) {
        const user = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return await this.service.remove(id, user?.organizationId);
    }
};
exports.CanvasFlowController = CanvasFlowController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_canvas_flow_dto_1.CreateCanvasFlowDto, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('agentId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('agents'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(2, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "listAgents", null);
__decorate([
    (0, common_1.Post)('agents'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "createAgent", null);
__decorate([
    (0, common_1.Patch)('agents/reorder'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "reorderAgents", null);
__decorate([
    (0, common_1.Patch)('agents/:name/config'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "updateAgentConfig", null);
__decorate([
    (0, common_1.Get)('agents/:name/workspace'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "exportAgentWorkspace", null);
__decorate([
    (0, common_1.Put)('agents/:name/workspace'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "importAgentWorkspace", null);
__decorate([
    (0, common_1.Patch)('agents/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "renameAgent", null);
__decorate([
    (0, common_1.Delete)('agents/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "removeAgent", null);
__decorate([
    (0, common_1.Get)('agents/:name/releases'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "getAgentReleases", null);
__decorate([
    (0, common_1.Post)('agents/:name/releases/deploy'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "deployAgentRelease", null);
__decorate([
    (0, common_1.Patch)('agents/:name/releases/:release/activate'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Param)('release')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "activateAgentRelease", null);
__decorate([
    (0, common_1.Patch)('agents/:name/releases/:release'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Param)('release')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "renameAgentRelease", null);
__decorate([
    (0, common_1.Patch)('agents/:name/releases/:release/overwrite'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Param)('release')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "overwriteAgentRelease", null);
__decorate([
    (0, common_1.Delete)('agents/:name/releases/:release'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Param)('release')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "deleteAgentRelease", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "getVersions", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/versions/deploy'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "deployVersion", null);
__decorate([
    (0, common_1.Patch)(':id/versions/:version/activate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "activateVersion", null);
__decorate([
    (0, common_1.Patch)(':id/versions/:version'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "renameVersion", null);
__decorate([
    (0, common_1.Patch)(':id/versions/:version/overwrite'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "overwriteVersion", null);
__decorate([
    (0, common_1.Delete)(':id/versions/:version'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "deleteVersion", null);
__decorate([
    (0, common_1.Patch)('reorder'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "reorder", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_canvas_flow_dto_1.UpdateCanvasFlowDto, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], CanvasFlowController.prototype, "remove", null);
exports.CanvasFlowController = CanvasFlowController = __decorate([
    (0, swagger_1.ApiTags)('canvas-flow'),
    (0, common_1.Controller)('api/canvas-flows'),
    __metadata("design:paramtypes", [canvas_flow_service_1.CanvasFlowService,
        auth_service_1.AuthService])
], CanvasFlowController);
//# sourceMappingURL=canvas-flow-controller.js.map