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
exports.CanvasFlowOrganizationEntity = exports.OrganizationEntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const auth_constants_model_1 = require("./auth-constants-model");
exports.OrganizationEntitySchema = new mongoose.Schema({
    organizationId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    ownerUserId: { type: String },
    createdByEmail: { type: String, lowercase: true, trim: true },
}, {
    collection: auth_constants_model_1.ORGANIZATION_COLLECTION_NAME,
    timestamps: true,
});
exports.OrganizationEntitySchema.index({ slug: 1 }, { unique: true });
let CanvasFlowOrganizationEntity = class CanvasFlowOrganizationEntity extends mongoose_2.Document {
};
exports.CanvasFlowOrganizationEntity = CanvasFlowOrganizationEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowOrganizationEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowOrganizationEntity.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasFlowOrganizationEntity.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], CanvasFlowOrganizationEntity.prototype, "active", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowOrganizationEntity.prototype, "ownerUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasFlowOrganizationEntity.prototype, "createdByEmail", void 0);
exports.CanvasFlowOrganizationEntity = CanvasFlowOrganizationEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: auth_constants_model_1.ORGANIZATION_COLLECTION_NAME,
        timestamps: true,
    })
], CanvasFlowOrganizationEntity);
//# sourceMappingURL=auth-organization-schema.js.map