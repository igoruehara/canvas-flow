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
exports.CanvasMcpOAuthConnectionEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const mcp_oauth_constants_model_1 = require("./mcp-oauth-constants-model");
exports.EntitySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    agentId: { type: String, index: true },
    connectionScope: { type: String, enum: ['agent', 'user'], default: 'agent', index: true },
    oauthUserId: { type: String, index: true },
    serverUrl: { type: String, required: true },
    serverUrlHash: { type: String, required: true, index: true },
    label: String,
    scope: String,
    redirectUrl: String,
    state: { type: String, index: true },
    authorizationUrl: String,
    status: { type: String, enum: ['pending', 'connected', 'error'], default: 'pending', index: true },
    error: String,
    clientMetadata: { type: mongoose.Schema.Types.Mixed },
    clientInformation: String,
    tokens: String,
    codeVerifier: String,
    discoveryState: String,
    expiresAt: Date,
    authenticatedAt: Date,
    createdBy: String,
    updatedBy: String,
}, {
    collection: mcp_oauth_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ organizationId: 1, agentId: 1, connectionScope: 1, oauthUserId: 1, serverUrlHash: 1 }, { name: 'mcp_oauth_scope_lookup' });
exports.EntitySchema.index({ state: 1 }, { sparse: true });
let CanvasMcpOAuthConnectionEntity = class CanvasMcpOAuthConnectionEntity extends mongoose_2.Document {
};
exports.CanvasMcpOAuthConnectionEntity = CanvasMcpOAuthConnectionEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "key", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "organizationId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "agentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'agent' }),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "connectionScope", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "oauthUserId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "serverUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "serverUrlHash", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "label", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "scope", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "redirectUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "state", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "authorizationUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 'pending' }),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "error", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose.Schema.Types.Mixed }),
    __metadata("design:type", Object)
], CanvasMcpOAuthConnectionEntity.prototype, "clientMetadata", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "clientInformation", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "tokens", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "codeVerifier", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "discoveryState", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasMcpOAuthConnectionEntity.prototype, "expiresAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], CanvasMcpOAuthConnectionEntity.prototype, "authenticatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], CanvasMcpOAuthConnectionEntity.prototype, "updatedBy", void 0);
exports.CanvasMcpOAuthConnectionEntity = CanvasMcpOAuthConnectionEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: mcp_oauth_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], CanvasMcpOAuthConnectionEntity);
//# sourceMappingURL=mcp-oauth-schema.js.map