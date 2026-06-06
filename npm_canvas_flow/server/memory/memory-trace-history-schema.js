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
exports.TraceHistoryEntity = exports.TraceHistoryEntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const memory_constants_model_1 = require("./memory-constants-model");
exports.TraceHistoryEntitySchema = new mongoose.Schema({
    agentId: { type: String, index: true },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, required: true },
    content: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    collection: memory_constants_model_1.TRACE_HISTORY_COLLECTION_NAME,
    timestamps: { createdAt: true, updatedAt: false },
});
exports.TraceHistoryEntitySchema.index({ agentId: 1, conversationId: 1, createdAt: -1 });
exports.TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.kind': 1, createdAt: -1 });
exports.TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, agentId: 1, conversationId: 1, 'metadata.kind': 1, createdAt: -1 });
exports.TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.flowId': 1, 'metadata.kind': 1, createdAt: -1 });
exports.TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.entryFlowId': 1, 'metadata.kind': 1, createdAt: -1 });
exports.TraceHistoryEntitySchema.index({ 'metadata.organizationId': 1, 'metadata.activeFlowId': 1, 'metadata.kind': 1, createdAt: -1 });
let TraceHistoryEntity = class TraceHistoryEntity extends mongoose_2.Document {
};
exports.TraceHistoryEntity = TraceHistoryEntity;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TraceHistoryEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TraceHistoryEntity.prototype, "conversationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TraceHistoryEntity.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TraceHistoryEntity.prototype, "content", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], TraceHistoryEntity.prototype, "metadata", void 0);
exports.TraceHistoryEntity = TraceHistoryEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: memory_constants_model_1.TRACE_HISTORY_COLLECTION_NAME,
        timestamps: { createdAt: true, updatedAt: false },
    })
], TraceHistoryEntity);
//# sourceMappingURL=memory-trace-history-schema.js.map