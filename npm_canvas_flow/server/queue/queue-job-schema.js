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
exports.QueueJobEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const queue_job_constants_model_1 = require("./queue-job-constants-model");
exports.EntitySchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    conversationId: { type: String, index: true },
    messageId: String,
    payload: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    error: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    queuedAt: { type: Date, default: Date.now, index: true },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    expiresAt: { type: Date, index: true },
}, {
    collection: queue_job_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ organizationId: 1, jobId: 1 });
exports.EntitySchema.index({ organizationId: 1, agentId: 1, conversationId: 1, queuedAt: -1 });
exports.EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
let QueueJobEntity = class QueueJobEntity extends mongoose_2.Document {
};
exports.QueueJobEntity = QueueJobEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "jobId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'queued', index: true }),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "flowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "conversationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "messageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed }),
    __metadata("design:type", Object)
], QueueJobEntity.prototype, "payload", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed }),
    __metadata("design:type", Object)
], QueueJobEntity.prototype, "result", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueJobEntity.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed, default: {} }),
    __metadata("design:type", Object)
], QueueJobEntity.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueJobEntity.prototype, "queuedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueJobEntity.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueJobEntity.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueJobEntity.prototype, "failedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueJobEntity.prototype, "expiresAt", void 0);
exports.QueueJobEntity = QueueJobEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: queue_job_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], QueueJobEntity);
//# sourceMappingURL=queue-job-schema.js.map