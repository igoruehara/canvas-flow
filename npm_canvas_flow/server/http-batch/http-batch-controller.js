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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpBatchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_batch_service_1 = require("./http-batch-service");
let HttpBatchController = class HttpBatchController {
    constructor(service) {
        this.service = service;
    }
    async execute(body) {
        return await this.service.execute(body?.requests || []);
    }
};
exports.HttpBatchController = HttpBatchController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HttpBatchController.prototype, "execute", null);
exports.HttpBatchController = HttpBatchController = __decorate([
    (0, swagger_1.ApiTags)('http-batch'),
    (0, common_1.Controller)('api/http-batch'),
    __metadata("design:paramtypes", [http_batch_service_1.HttpBatchService])
], HttpBatchController);
//# sourceMappingURL=http-batch-controller.js.map