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
exports.ProviderConfigEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const provider_config_constants_model_1 = require("./provider-config-constants-model");
exports.EntitySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    settings: { type: Object, default: {} },
    updatedBy: String,
}, {
    collection: provider_config_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
let ProviderConfigEntity = class ProviderConfigEntity extends mongoose_2.Document {
};
exports.ProviderConfigEntity = ProviderConfigEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], ProviderConfigEntity.prototype, "key", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], ProviderConfigEntity.prototype, "settings", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ProviderConfigEntity.prototype, "updatedBy", void 0);
exports.ProviderConfigEntity = ProviderConfigEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: provider_config_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], ProviderConfigEntity);
//# sourceMappingURL=provider-config-schema.js.map