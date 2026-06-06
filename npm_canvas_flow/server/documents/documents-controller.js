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
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const documents_service_1 = require("./documents-service");
let DocumentsController = class DocumentsController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async actorScope(authorization, headerToken, xApiKey) {
        const actor = await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
        return { organizationId: actor?.organizationId || '' };
    }
    async list(body, authorization, headerToken, xApiKey) {
        const actor = await this.actorScope(authorization, headerToken, xApiKey);
        return await this.service.list({
            ...actor,
            agentId: body?.agentId,
            flowId: body?.flowId,
            conversationId: body?.conversationId,
        }, body?.limit);
    }
    async generate(body, authorization, headerToken, xApiKey) {
        const actor = await this.actorScope(authorization, headerToken, xApiKey);
        return await this.service.createArtifact({
            format: String(body?.format || 'txt').toLowerCase(),
            filename: body?.filename,
            content: body?.content,
            replacements: body?.replacements,
            templateDocumentId: body?.templateDocumentId,
            docxEdits: body?.docxEdits,
            xlsxEdits: body?.xlsxEdits,
            parentDocumentId: body?.parentDocumentId,
            scope: {
                ...actor,
                agentId: body?.agentId,
                flowId: body?.flowId,
                conversationId: body?.conversationId,
            },
        });
    }
    async downloadUrl(documentId, authorization, headerToken, xApiKey) {
        return await this.service.getDownloadInfo(documentId, await this.actorScope(authorization, headerToken, xApiKey));
    }
    async download(documentId, response, authorization, headerToken, xApiKey) {
        const scope = await this.actorScope(authorization, headerToken, xApiKey);
        const { record, buffer } = await this.service.getFile(documentId, scope);
        response.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
        response.setHeader('Content-Length', String(buffer.length));
        response.setHeader('Content-Disposition', `attachment; filename="${String(record.filename || 'arquivo.bin').replace(/"/g, '')}"`);
        response.send(buffer);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Post)('list'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(':documentId/download-url'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "downloadUrl", null);
__decorate([
    (0, common_1.Get)(':documentId/download'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "download", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, swagger_1.ApiTags)('documents'),
    (0, common_1.Controller)('api/documents'),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService,
        auth_service_1.AuthService])
], DocumentsController);
//# sourceMappingURL=documents-controller.js.map