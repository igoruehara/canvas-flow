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
exports.RagController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth-service");
const rag_service_1 = require("./rag-service");
let RagController = class RagController {
    constructor(service, authService) {
        this.service = service;
        this.authService = authService;
    }
    async assertAuth(authorization, headerToken, xApiKey) {
        return await this.authService.assertUiAuth(authorization, headerToken, xApiKey);
    }
    async createCollection(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.createCollection(body?.collectionName);
    }
    async createIndex(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.createIndex(body?.collectionName);
    }
    async addDocuments(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.addDocuments(body?.collectionName, body?.documents || [], body?.options || {});
    }
    async addDocumentsFromFile(arquivos, req, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.addDocumentsFromFiles(arquivos || [], req.body || {});
    }
    async extractFiles(arquivos, req, authorization, headerToken, xApiKey) {
        const actor = await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.extractFiles(arquivos || [], {
            ...(req.body || {}),
            organizationId: actor?.organizationId || req.body?.organizationId || '',
        });
    }
    async listDocuments(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.listDocuments(body?.collectionName, body?.agentId, body?.query, body || {});
    }
    async getDocument(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.getDocument(body?.collectionName, body?.id || body?.embeddingId, body?.agentId);
    }
    async updateDocument(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.updateDocument(body?.collectionName, body?.id || body?.embeddingId, body || {});
    }
    async deleteDocument(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.deleteDocument(body?.collectionName, body?.id || body?.embeddingId, body?.agentId);
    }
    async embeddingCreate(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.embeddingCreate(body?.text || '', body?.embeddingProvider || body?.provider);
    }
    async searchHybrid(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.searchHybrid(body?.query, body?.collectionName, body?.agentId, body?.params || {});
    }
    async chatLlmRag(body, authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        const params = {
            ...(body?.params || {}),
            ...(body?.turnHistoricMessages !== undefined ? { turnHistoricMessages: body.turnHistoricMessages } : {}),
            ...(body?.tools !== undefined ? { tools: body.tools } : {}),
            ...(body?.allowHttpBatchTool !== undefined ? { allowHttpBatchTool: body.allowHttpBatchTool === true } : {}),
            ...(body?.enableHttpBatchTool !== undefined ? { enableHttpBatchTool: body.enableHttpBatchTool === true } : {}),
        };
        return await this.service.chatLlmRag(body?.text, body?.agentId, params);
    }
    async listCollections(authorization, headerToken, xApiKey) {
        await this.assertAuth(authorization, headerToken, xApiKey);
        return await this.service.listCollections();
    }
};
exports.RagController = RagController;
__decorate([
    (0, common_1.Post)('create-collection'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "createCollection", null);
__decorate([
    (0, common_1.Post)('create-index'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "createIndex", null);
__decorate([
    (0, common_1.Post)('add-documents'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "addDocuments", null);
__decorate([
    (0, common_1.Post)('add-documents-from-file'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('arquivos', 8, { limits: { fileSize: 30 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "addDocumentsFromFile", null);
__decorate([
    (0, common_1.Post)('extract-files'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('arquivos', 8, { limits: { fileSize: 30 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "extractFiles", null);
__decorate([
    (0, common_1.Post)('documents/list'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Post)('documents/get'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "getDocument", null);
__decorate([
    (0, common_1.Post)('documents/update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "updateDocument", null);
__decorate([
    (0, common_1.Post)('documents/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Post)('embedding-create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "embeddingCreate", null);
__decorate([
    (0, common_1.Post)('search-hybrid'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "searchHybrid", null);
__decorate([
    (0, common_1.Post)('chat-llm-rag'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "chatLlmRag", null);
__decorate([
    (0, common_1.Get)('collections'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(2, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RagController.prototype, "listCollections", null);
exports.RagController = RagController = __decorate([
    (0, swagger_1.ApiTags)('rag'),
    (0, common_1.Controller)('api/rag'),
    __metadata("design:paramtypes", [rag_service_1.RagService,
        auth_service_1.AuthService])
], RagController);
//# sourceMappingURL=rag-controller.js.map