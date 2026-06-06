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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasFlowApiKeyEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const api_key_constants_model_1 = require("./api-key-constants-model");
exports.EntitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    tokenPrefix: { type: String, required: true },
    flowId: { type: String, index: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    scopes: { type: [String], default: ['run:flow'] },
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
    totalUses: { type: Number, default: 0 },
    createdBy: String,
}, {
    collection: api_key_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ flowId: 1, active: 1, createdAt: -1 });
exports.EntitySchema.index({ agentId: 1, active: 1, createdAt: -1 });
let CanvasFlowApiKeyEntity = class CanvasFlowApiKeyEntity extends mongoose_2.Document {
};
exports.CanvasFlowApiKeyEntity = CanvasFlowApiKeyEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, select: false }),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "tokenHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "tokenPrefix", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "flowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: ['run:flow'] }),
    __metadata("design:type", Array)
], CanvasFlowApiKeyEntity.prototype, "scopes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], CanvasFlowApiKeyEntity.prototype, "active", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasFlowApiKeyEntity.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasFlowApiKeyEntity.prototype, "revokedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasFlowApiKeyEntity.prototype, "lastUsedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], CanvasFlowApiKeyEntity.prototype, "totalUses", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowApiKeyEntity.prototype, "createdBy", void 0);
exports.CanvasFlowApiKeyEntity = CanvasFlowApiKeyEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: api_key_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowApiKeyEntity);
//# sourceMappingURL=api-key-schema.js.map