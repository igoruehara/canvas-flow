"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpOAuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth-module");
const database_module_1 = require("../database/database.module");
const mcp_oauth_connect_provider_1 = require("./mcp-oauth-connect-provider");
const mcp_oauth_controller_1 = require("./mcp-oauth-controller");
const mcp_oauth_service_1 = require("./mcp-oauth-service");
let McpOAuthModule = class McpOAuthModule {
};
exports.McpOAuthModule = McpOAuthModule;
exports.McpOAuthModule = McpOAuthModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, auth_module_1.AuthModule],
        controllers: [mcp_oauth_controller_1.McpOAuthController],
        providers: [mcp_oauth_service_1.McpOAuthService, ...mcp_oauth_connect_provider_1.connectProviders],
        exports: [mcp_oauth_service_1.McpOAuthService],
    })
], McpOAuthModule);
//# sourceMappingURL=mcp-oauth-module.js.map