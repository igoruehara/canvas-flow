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
exports.CanvasFlowUserEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const auth_constants_model_1 = require("./auth-constants-model");
exports.EntitySchema = new mongoose.Schema({
    organizationId: { type: String, required: true, index: true },
    organizationName: { type: String, required: true },
    organizationSlug: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    active: { type: Boolean, default: true, index: true },
    lastLoginAt: Date,
}, {
    collection: auth_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ organizationSlug: 1, email: 1 }, { unique: true });
let CanvasFlowUserEntity = class CanvasFlowUserEntity extends mongoose_2.Document {
};
exports.CanvasFlowUserEntity = CanvasFlowUserEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "organizationName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "organizationSlug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, select: false }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "passwordHash", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'member' }),
    __metadata("design:type", String)
], CanvasFlowUserEntity.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], CanvasFlowUserEntity.prototype, "active", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasFlowUserEntity.prototype, "lastLoginAt", void 0);
exports.CanvasFlowUserEntity = CanvasFlowUserEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: auth_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowUserEntity);
//# sourceMappingURL=auth-schema.js.map