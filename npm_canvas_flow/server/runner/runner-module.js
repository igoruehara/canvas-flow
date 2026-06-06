"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunnerModule = void 0;
const common_1 = require("@nestjs/common");
const canvas_flow_module_1 = require("../canvas-flow/canvas-flow-module");
const api_key_module_1 = require("../api-key/api-key-module");
const http_batch_module_1 = require("../http-batch/http-batch-module");
const memory_module_1 = require("../memory/memory-module");
const rag_module_1 = require("../rag/rag-module");
const auth_module_1 = require("../auth/auth-module");
const queue_module_1 = require("../queue/queue-module");
const provider_config_module_1 = require("../provider-config/provider-config-module");
const flow_tag_module_1 = require("../flow-tag/flow-tag-module");
const mcp_oauth_module_1 = require("../mcp-oauth/mcp-oauth-module");
const langgraph_runtime_service_1 = require("./langgraph-runtime.service");
const documents_module_1 = require("../documents/documents-module");
const runner_controller_1 = require("./runner-controller");
const runner_queue_processor_1 = require("./runner-queue-processor");
const runner_service_1 = require("./runner-service");
let RunnerModule = class RunnerModule {
};
exports.RunnerModule = RunnerModule;
exports.RunnerModule = RunnerModule = __decorate([
    (0, common_1.Module)({
        imports: [canvas_flow_module_1.CanvasFlowModule, api_key_module_1.ApiKeyModule, http_batch_module_1.HttpBatchModule, memory_module_1.MemoryModule, rag_module_1.RagModule, auth_module_1.AuthModule, queue_module_1.QueueModule, provider_config_module_1.ProviderConfigModule, flow_tag_module_1.FlowTagModule, mcp_oauth_module_1.McpOAuthModule, documents_module_1.DocumentsModule],
        controllers: [runner_controller_1.RunnerController],
        providers: [langgraph_runtime_service_1.LangGraphRuntimeService, runner_service_1.RunnerService, runner_queue_processor_1.RunnerQueueProcessor],
        exports: [langgraph_runtime_service_1.LangGraphRuntimeService, runner_service_1.RunnerService, runner_queue_processor_1.RunnerQueueProcessor],
    })
], RunnerModule);
//# sourceMappingURL=runner-module.js.map