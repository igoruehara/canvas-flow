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
exports.CanvasFlowAgentEntity = exports.AgentSchema = exports.CanvasFlowVersionEntity = exports.VersionSchema = exports.CanvasFlowEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const canvas_flow_constants_model_1 = require("./canvas-flow-constants-model");
exports.EntitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    description: String,
    sortOrder: { type: Number, index: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    versions: { type: [mongoose.Schema.Types.Mixed], default: undefined, select: false },
    latestVersion: { type: Number, default: 0 },
    activeVersion: { type: Number },
    createdBy: String,
}, {
    collection: canvas_flow_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ organizationId: 1, agentId: 1, sortOrder: 1, updatedAt: -1 });
exports.EntitySchema.index({ organizationId: 1, agentId: 1, 'config.channel': 1, 'config.isMainFlow': 1, updatedAt: -1 });
exports.EntitySchema.index({ agentId: 1, 'config.channel': 1, 'config.isMainFlow': 1, updatedAt: -1 });
exports.EntitySchema.index({ organizationId: 1, activeVersion: 1, updatedAt: -1 });
let CanvasFlowEntity = class CanvasFlowEntity extends mongoose_2.Document {
};
exports.CanvasFlowEntity = CanvasFlowEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowEntity.prototype, "description", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowEntity.prototype, "sortOrder", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], CanvasFlowEntity.prototype, "config", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose.Schema.Types.Mixed], default: undefined, select: false }),
    __metadata("design:type", Array)
], CanvasFlowEntity.prototype, "versions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowEntity.prototype, "latestVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowEntity.prototype, "activeVersion", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowEntity.prototype, "createdBy", void 0);
exports.CanvasFlowEntity = CanvasFlowEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: canvas_flow_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowEntity);
exports.VersionSchema = new mongoose.Schema({
    flowId: { type: String, required: true, index: true },
    agentId: { type: String, index: true },
    organizationId: { type: String, index: true },
    version: { type: Number, required: true, index: true },
    name: String,
    notes: String,
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    deployedAt: String,
    deployedBy: String,
    deployedByEmail: String,
    activatedAt: String,
    activatedBy: String,
    activatedByEmail: String,
    agentReleaseCandidate: Boolean,
    overwrittenAgentRelease: Number,
}, {
    collection: canvas_flow_constants_model_1.VERSION_COLLECTION_NAME,
    timestamps: true,
});
exports.VersionSchema.index({ organizationId: 1, flowId: 1, version: -1 }, { unique: true });
exports.VersionSchema.index({ organizationId: 1, agentId: 1, version: -1 });
exports.VersionSchema.index({ flowId: 1, version: -1 });
let CanvasFlowVersionEntity = class CanvasFlowVersionEntity extends mongoose_2.Document {
};
exports.CanvasFlowVersionEntity = CanvasFlowVersionEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "flowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], CanvasFlowVersionEntity.prototype, "version", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "notes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], CanvasFlowVersionEntity.prototype, "config", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "deployedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "deployedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "deployedByEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "activatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "activatedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowVersionEntity.prototype, "activatedByEmail", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Boolean)
], CanvasFlowVersionEntity.prototype, "agentReleaseCandidate", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowVersionEntity.prototype, "overwrittenAgentRelease", void 0);
exports.CanvasFlowVersionEntity = CanvasFlowVersionEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: canvas_flow_constants_model_1.VERSION_COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowVersionEntity);
exports.AgentSchema = new mongoose.Schema({
    agentId: { type: String, index: true },
    name: { type: String, required: true },
    organizationId: { type: String, index: true },
    sortOrder: { type: Number, index: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    releases: { type: [mongoose.Schema.Types.Mixed], default: [] },
    latestRelease: { type: Number, default: 0 },
    activeRelease: { type: Number },
    createdBy: String,
}, {
    collection: canvas_flow_constants_model_1.AGENT_COLLECTION_NAME,
    timestamps: true,
});
exports.AgentSchema.index({ organizationId: 1, agentId: 1 }, { unique: true, sparse: true });
exports.AgentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
exports.AgentSchema.index({ organizationId: 1, sortOrder: 1, updatedAt: -1 });
let CanvasFlowAgentEntity = class CanvasFlowAgentEntity extends mongoose_2.Document {
};
exports.CanvasFlowAgentEntity = CanvasFlowAgentEntity;
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowAgentEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowAgentEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowAgentEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowAgentEntity.prototype, "sortOrder", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], CanvasFlowAgentEntity.prototype, "config", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [mongoose.Schema.Types.Mixed], default: [] }),
    __metadata("design:type", Array)
], CanvasFlowAgentEntity.prototype, "releases", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowAgentEntity.prototype, "latestRelease", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], CanvasFlowAgentEntity.prototype, "activeRelease", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowAgentEntity.prototype, "createdBy", void 0);
exports.CanvasFlowAgentEntity = CanvasFlowAgentEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: canvas_flow_constants_model_1.AGENT_COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowAgentEntity);
//# sourceMappingURL=canvas-flow-schema.js.map