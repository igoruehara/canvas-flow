"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const database_module_1 = require("./database/database.module");
const health_controller_1 = require("./health.controller");
const canvas_flow_module_1 = require("./canvas-flow/canvas-flow-module");
const memory_module_1 = require("./memory/memory-module");
const rag_module_1 = require("./rag/rag-module");
const http_batch_module_1 = require("./http-batch/http-batch-module");
const runner_module_1 = require("./runner/runner-module");
const api_key_module_1 = require("./api-key/api-key-module");
const auth_module_1 = require("./auth/auth-module");
const provider_config_module_1 = require("./provider-config/provider-config-module");
const flow_tag_module_1 = require("./flow-tag/flow-tag-module");
const mcp_oauth_module_1 = require("./mcp-oauth/mcp-oauth-module");
const documents_module_1 = require("./documents/documents-module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            axios_1.HttpModule,
            database_module_1.DatabaseModule,
            canvas_flow_module_1.CanvasFlowModule,
            memory_module_1.MemoryModule,
            http_batch_module_1.HttpBatchModule,
            auth_module_1.AuthModule,
            provider_config_module_1.ProviderConfigModule,
            mcp_oauth_module_1.McpOAuthModule,
            documents_module_1.DocumentsModule,
            flow_tag_module_1.FlowTagModule,
            rag_module_1.RagModule,
            api_key_module_1.ApiKeyModule,
            runner_module_1.RunnerModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map