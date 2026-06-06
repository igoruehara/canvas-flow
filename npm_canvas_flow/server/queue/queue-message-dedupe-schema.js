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
exports.QueueMessageDedupeEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const queue_message_dedupe_constants_model_1 = require("./queue-message-dedupe-constants-model");
exports.EntitySchema = new mongoose.Schema({
    dedupeKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing', index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    flowId: { type: String, index: true },
    conversationId: { type: String, index: true },
    channel: { type: String, index: true },
    provider: { type: String, index: true },
    providerMessageId: { type: String, index: true },
    attempts: { type: Number, default: 1 },
    error: String,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    failedAt: Date,
    expiresAt: { type: Date, required: true, index: true },
}, {
    collection: queue_message_dedupe_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.EntitySchema.index({ organizationId: 1, provider: 1, providerMessageId: 1 });
let QueueMessageDedupeEntity = class QueueMessageDedupeEntity extends mongoose_2.Document {
};
exports.QueueMessageDedupeEntity = QueueMessageDedupeEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "dedupeKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'processing', index: true }),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "flowId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "conversationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "channel", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "providerMessageId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 1 }),
    __metadata("design:type", Number)
], QueueMessageDedupeEntity.prototype, "attempts", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], QueueMessageDedupeEntity.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueMessageDedupeEntity.prototype, "startedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueMessageDedupeEntity.prototype, "completedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], QueueMessageDedupeEntity.prototype, "failedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], QueueMessageDedupeEntity.prototype, "expiresAt", void 0);
exports.QueueMessageDedupeEntity = QueueMessageDedupeEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: queue_message_dedupe_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], QueueMessageDedupeEntity);
//# sourceMappingURL=queue-message-dedupe-schema.js.map