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
exports.FlowTagEventEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const flow_tag_constants_model_1 = require("./flow-tag-constants-model");
exports.EntitySchema = new mongoose.Schema({
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    flowName: String,
    entryFlowId: { type: String, index: true },
    activeFlowId: { type: String, index: true },
    conversationId: { type: String, required: true, index: true },
    channel: { type: String, index: true },
    stepId: { type: String, index: true },
    stepTitle: String,
    stepType: String,
    tag: { type: String, required: true, index: true },
    label: String,
    mode: { type: String, enum: ['once', 'always'], default: 'always', index: true },
    value: mongoose.Schema.Types.Mixed,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    input: String,
    idempotencyKey: { type: String, unique: true, sparse: true },
}, {
    collection: flow_tag_constants_model_1.COLLECTION_NAME,
    timestamps: { createdAt: true, updatedAt: false },
});
exports.EntitySchema.index({ organizationId: 1, createdAt: -1 });
exports.EntitySchema.index({ agentId: 1, flowId: 1, createdAt: -1 });
exports.EntitySchema.index({ conversationId: 1, createdAt: -1 });
exports.EntitySchema.index({ tag: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, tag: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, agentId: 1, tag: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, conversationId: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, flowId: 1, tag: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, entryFlowId: 1, tag: 1, createdAt: -1 });
exports.EntitySchema.index({ organizationId: 1, activeFlowId: 1, tag: 1, createdAt: -1 });
let FlowTagEventEntity = class FlowTagEventEntity extends mongoose_2.Document {
};
exports.FlowTagEventEntity = FlowTagEventEntity;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "flowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "flowName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "entryFlowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "activeFlowId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "conversationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "channel", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "stepId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "stepTitle", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "stepType", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "tag", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "label", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "mode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed }),
    __metadata("design:type", Object)
], FlowTagEventEntity.prototype, "value", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], FlowTagEventEntity.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "input", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], FlowTagEventEntity.prototype, "idempotencyKey", void 0);
exports.FlowTagEventEntity = FlowTagEventEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: flow_tag_constants_model_1.COLLECTION_NAME,
        timestamps: { createdAt: true, updatedAt: false },
    })
], FlowTagEventEntity);
//# sourceMappingURL=flow-tag-schema.js.map