"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasFlowModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const auth_module_1 = require("../auth/auth-module");
const canvas_flow_controller_1 = require("./canvas-flow-controller");
const canvas_flow_service_1 = require("./canvas-flow-service");
const canvas_flow_connect_provider_1 = require("./canvas-flow-connect-provider");
let CanvasFlowModule = class CanvasFlowModule {
};
exports.CanvasFlowModule = CanvasFlowModule;
exports.CanvasFlowModule = CanvasFlowModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, auth_module_1.AuthModule],
        controllers: [canvas_flow_controller_1.CanvasFlowController],
        providers: [canvas_flow_service_1.CanvasFlowService, ...canvas_flow_connect_provider_1.connectProviders],
        exports: [canvas_flow_service_1.CanvasFlowService],
    })
], CanvasFlowModule);
//# sourceMappingURL=canvas-flow-module.js.map