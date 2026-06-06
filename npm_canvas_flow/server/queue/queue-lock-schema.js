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
exports.QueueLockEntity = exports.EntitySchema = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose = require("mongoose");
const mongoose_2 = require("mongoose");
const queue_lock_constants_model_1 = require("./queue-lock-constants-model");
exports.EntitySchema = new mongoose.Schema({
    lockKey: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
}, {
    collection: queue_lock_constants_model_1.COLLECTION_NAME,
    timestamps: true,
});
exports.EntitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
let QueueLockEntity = class QueueLockEntity extends mongoose_2.Document {
};
exports.QueueLockEntity = QueueLockEntity;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true, index: true }),
    __metadata("design:type", String)
], QueueLockEntity.prototype, "lockKey", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], QueueLockEntity.prototype, "ownerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", Date)
], QueueLockEntity.prototype, "expiresAt", void 0);
exports.QueueLockEntity = QueueLockEntity = __decorate([
    (0, mongoose_1.Schema)({
        collection: queue_lock_constants_model_1.COLLECTION_NAME,
        timestamps: true,
    })
], QueueLockEntity);
//# sourceMappingURL=queue-lock-schema.js.map