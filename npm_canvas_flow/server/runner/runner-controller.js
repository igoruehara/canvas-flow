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
exports.RunnerController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const crypto_1 = require("crypto");
const api_key_service_1 = require("../api-key/api-key-service");
const auth_service_1 = require("../auth/auth-service");
const sqs_transition_service_1 = require("../queue/sqs-transition-service");
const flow_templates_1 = require("./flow-templates");
const runner_queue_processor_1 = require("./runner-queue-processor");
const runner_service_1 = require("./runner-service");
let RunnerController = class RunnerController {
    constructor(service, apiKeyService, authService, sqsTransitionService, runnerQueueProcessor) {
        this.service = service;
        this.apiKeyService = apiKeyService;
        this.authService = authService;
        this.sqsTransitionService = sqsTransitionService;
        this.runnerQueueProcessor = runnerQueueProcessor;
    }
    async assertApiToken(body, authorization, headerToken, xApiKey) {
        if (this.authService.isLoginRequired()) {
            const user = await this.authService.resolveUserFromHeaders(authorization, headerToken, xApiKey);
            if (user)
                return { organizationId: user.organizationId, userId: user.id };
        }
        const expected = this.apiKeyService.getMasterToken();
        if (!expected && !authorization && !headerToken && !xApiKey)
            return;
        const received = this.apiKeyService.extractToken(authorization, headerToken, xApiKey);
        const validation = await this.apiKeyService.validateRunToken(received, {
            flowId: body?.flowId,
            agentId: body?.agentId,
        });
        if (!validation.valid) {
            throw new common_1.UnauthorizedException('Invalid Canvas Flow API token');
        }
        return {
            organizationId: validation.kind === 'generated' ? validation.key?.organizationId : undefined,
            userId: validation.kind === 'generated' ? validation.key?.createdBy : undefined,
        };
    }
    async test(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        const runBody = {
            ...body,
            _organizationId: auth?.organizationId,
            _oauthUserId: auth?.userId,
            _conversationOwnerId: auth?.userId || '',
            _langGraphRunId: (0, crypto_1.randomUUID)(),
        };
        const channel = runBody.channel || runBody.config?.channel || 'webWidget';
        await this.sqsTransitionService.assertRateLimit({
            scope: [
                auth?.organizationId || 'global',
                runBody.agentId || 'default-agent',
                channel || 'api',
            ].join(':'),
            limit: this.sqsTransitionService.getRateLimit(channel === 'webWidget' ? 'webwidget' : 'api'),
        });
        if (this.sqsTransitionService.isEnabled() && (body?.queue === true || body?.async === true)) {
            return await this.sqsTransitionService.enqueue('canvas-flow.run', { ...runBody, skipQueue: true }, { trackResult: true });
        }
        return await this.service.run(runBody);
    }
    async templates(authorization, headerToken, xApiKey) {
        await this.assertApiToken({}, authorization, headerToken, xApiKey);
        return { templates: (0, flow_templates_1.getCanvasFlowTemplates)() };
    }
    async agentOpsDashboard(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.getAgentOpsDashboard({ ...body, _organizationId: auth?.organizationId });
    }
    async mcpTools(agentId, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ agentId }, authorization, headerToken, xApiKey);
        const tools = await this.service.listMcpTools(agentId, auth?.organizationId);
        return {
            name: `canvas-flow-${agentId || 'default-agent'}`,
            protocol: 'mcp-json-rpc',
            transport: 'http-json-rpc-post',
            endpoint: `/api/canvas-flow/mcp/${encodeURIComponent(agentId || 'default-agent')}`,
            authentication: {
                headers: {
                    Authorization: 'Bearer <CANVAS_FLOW_API_KEY>',
                    'x-api-key': '<CANVAS_FLOW_API_KEY>',
                },
                note: 'Use uma API Key gerada no Canvas Flow. O token master deve ficar reservado para administracao.',
            },
            consumption: {
                description: 'Este endpoint e um MCP server HTTP: envie JSON-RPC 2.0 por POST para initialize, tools/list e tools/call.',
                sequence: ['initialize', 'tools/list', 'tools/call'],
                toolNameSource: 'Sempre chame tools/list primeiro e use o campo result.tools[].name no tools/call.',
                callArguments: {
                    text: 'Mensagem ou tarefa de entrada para executar o flow.',
                    conversationId: 'Opcional. Reutilize para preservar memoria entre chamadas.',
                    slots: 'Opcional. Objeto usado como context.slots inicial.',
                    flowVersion: 'Opcional. Versao especifica do flow.',
                    agentRelease: 'Opcional. Release especifico do agente.',
                    approvals: 'Opcional. Decisoes humanas pre-aprovadas por stepId ou responseName.',
                },
            },
            clientExample: {
                initialize: {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'meu-mcp-client', version: '1.0.0' } },
                },
                listTools: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
                callTool: {
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'tools/call',
                    params: {
                        name: tools?.[0]?.name || '<NOME_RETORNADO_EM_TOOLS_LIST>',
                        arguments: { text: 'Preciso de ajuda', conversationId: 'mcp-cliente-123', slots: {} },
                    },
                },
            },
            tools,
        };
    }
    async mcpJsonRpc(agentId, body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ agentId }, authorization, headerToken, xApiKey);
        return await this.service.handleMcpJsonRpc(agentId, body, auth?.organizationId, auth?.userId);
    }
    async listExternalMcpTools(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.listExternalMcpTools({ ...body, _organizationId: auth?.organizationId, _oauthUserId: auth?.userId });
    }
    async replaySimulation(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.replaySimulation({ ...body, _organizationId: auth?.organizationId, _oauthUserId: auth?.userId });
    }
    async testStream(body, res, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        const write = (event, payload) => {
            res.write(`${JSON.stringify({ event, ...payload })}\n`);
            if (typeof res.flush === 'function')
                res.flush();
        };
        try {
            const result = await this.service.run({
                ...body,
                _organizationId: auth?.organizationId,
                _oauthUserId: auth?.userId,
                _conversationOwnerId: auth?.userId || '',
                _langGraphRunId: (0, crypto_1.randomUUID)(),
                _onMessage: (message) => write('message', { message }),
            });
            write('result', { result: { ...result, messages: [] } });
            res.end();
        }
        catch (error) {
            write('error', { message: error?.message || String(error) });
            res.end();
        }
    }
    async generateContextScript(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.generateContextScriptWithLlm({ ...body, _organizationId: auth?.organizationId });
    }
    async generateMongoConfig(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.generateMongoConfigWithLlm({ ...body, _organizationId: auth?.organizationId });
    }
    async generateFlowWithAssistant(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.generateFlowConfigWithLlm({ ...body, _organizationId: auth?.organizationId });
    }
    async generatePromptField(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.generatePromptFieldWithLlm({ ...body, _organizationId: auth?.organizationId });
    }
    async createWhatsappFlow(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.createWhatsappFlow({ ...body, _organizationId: auth?.organizationId });
    }
    async listWhatsappFlows(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.listWhatsappFlows({ ...body, _organizationId: auth?.organizationId });
    }
    async deleteWhatsappFlow(flowId, body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
        return await this.service.deleteWhatsappFlow({ ...body, flowId, _organizationId: auth?.organizationId });
    }
    async uploadWhatsappFlowJson(flowId, body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
        return await this.service.uploadWhatsappFlowJson({ ...body, flowId, _organizationId: auth?.organizationId });
    }
    async publishWhatsappFlow(flowId, body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ ...body, flowId }, authorization, headerToken, xApiKey);
        return await this.service.publishWhatsappFlow({ ...body, flowId, _organizationId: auth?.organizationId });
    }
    async tagDashboard(body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.getTagDashboard({ ...body, _organizationId: auth?.organizationId });
    }
    async runDueCron(body, authorization, headerToken, xApiKey) {
        await this.assertApiToken(body, authorization, headerToken, xApiKey);
        return await this.service.runDueCronFlows({
            agentId: body?.agentId,
            dryRun: body?.dryRun === true,
        });
    }
    async consumeSqsMessages(body, authorization, headerToken, xApiKey) {
        await this.assertApiToken(body, authorization, headerToken, xApiKey);
        const records = Array.isArray(body?.Records) ? body.Records : [body];
        return await this.runnerQueueProcessor.processRecords(records);
    }
    async getSqsJob(jobId, agentId, flowId, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken({ agentId, flowId }, authorization, headerToken, xApiKey);
        return await this.sqsTransitionService.getJob(jobId, auth?.organizationId);
    }
    async retrySqsJob(jobId, body, authorization, headerToken, xApiKey) {
        const auth = await this.assertApiToken(body || {}, authorization, headerToken, xApiKey);
        return await this.sqsTransitionService.retryJob(jobId, auth?.organizationId);
    }
    async getSqsHealth(authorization, headerToken, xApiKey) {
        await this.assertApiToken({}, authorization, headerToken, xApiKey);
        return await this.sqsTransitionService.getQueueHealth();
    }
    async getReport(fileName, res) {
        const filePath = this.service.getReportFilePath(fileName);
        return res.download(filePath, fileName);
    }
    async getWhatsappMedia(flowId, mediaId, expiresAt, signature, res) {
        const media = await this.service.downloadWhatsappMedia(flowId, mediaId, expiresAt, signature);
        res.setHeader('Content-Type', media.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.status(200).send(media.buffer);
    }
    async receiveCustomWebhookGet(flowId, webhookId, query, headers) {
        await this.sqsTransitionService.assertRateLimit({
            scope: ['custom-webhook', flowId, webhookId].join(':'),
            limit: this.sqsTransitionService.getRateLimit('api'),
        });
        return await this.service.runCustomWebhook(flowId, webhookId, {
            method: 'GET',
            query,
            headers,
        });
    }
    async receiveCustomWebhookPost(flowId, webhookId, body, query, headers) {
        await this.sqsTransitionService.assertRateLimit({
            scope: ['custom-webhook', flowId, webhookId].join(':'),
            limit: this.sqsTransitionService.getRateLimit('api'),
        });
        return await this.service.runCustomWebhook(flowId, webhookId, {
            method: 'POST',
            body,
            query,
            headers,
        });
    }
    async verifyWhatsappWebhook(flowId, mode, verifyToken, challenge, res) {
        const verifiedChallenge = await this.service.verifyWhatsappWebhook(flowId, mode, verifyToken, challenge);
        return res.status(200).send(verifiedChallenge);
    }
    async verifyWhatsappMainWebhook(agentId, mode, verifyToken, challenge, res) {
        const verifiedChallenge = await this.service.verifyWhatsappMainWebhook(agentId, mode, verifyToken, challenge);
        return res.status(200).send(verifiedChallenge);
    }
    async receiveWhatsappWebhook(flowId, body) {
        await this.sqsTransitionService.assertRateLimit({
            scope: ['whatsapp', flowId].join(':'),
            limit: this.sqsTransitionService.getRateLimit('whatsapp'),
        });
        if (this.sqsTransitionService.isEnabled() && body?.skipQueue !== true) {
            return await this.sqsTransitionService.enqueue('canvas-flow.whatsapp', { flowId, body, skipQueue: true }, { trackResult: true });
        }
        return await this.service.runWhatsappWebhook(flowId, body);
    }
    async receiveWhatsappMainWebhook(agentId, body) {
        await this.sqsTransitionService.assertRateLimit({
            scope: ['whatsapp-main', agentId].join(':'),
            limit: this.sqsTransitionService.getRateLimit('whatsapp'),
        });
        if (this.sqsTransitionService.isEnabled() && body?.skipQueue !== true) {
            return await this.sqsTransitionService.enqueue('canvas-flow.whatsapp-main', { agentId, body, skipQueue: true }, { trackResult: true });
        }
        return await this.service.runWhatsappMainWebhook(agentId, body);
    }
};
exports.RunnerController = RunnerController;
__decorate([
    (0, common_1.Post)('test'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "test", null);
__decorate([
    (0, common_1.Get)('templates'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(2, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "templates", null);
__decorate([
    (0, common_1.Post)('agentops/dashboard'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "agentOpsDashboard", null);
__decorate([
    (0, common_1.Get)('mcp/:agentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Descreve o MCP server HTTP de um agente',
        description: [
            'Retorna metadados para um MCP client consumir os flows salvos do agente.',
            'O transporte exposto e JSON-RPC 2.0 sobre HTTP POST no mesmo endpoint.',
            'Cada flow salvo com steps vira uma tool MCP retornada em tools/list.',
        ].join(' '),
    }),
    (0, swagger_1.ApiParam)({ name: 'agentId', description: 'Agente cujos flows serao expostos como tools MCP.' }),
    (0, swagger_1.ApiHeader)({
        name: 'Authorization',
        required: false,
        description: 'Bearer <CANVAS_FLOW_API_KEY>. Alternativas aceitas: x-api-key ou x-canvas-flow-token.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Metadados do MCP server e catalogo inicial de tools.',
        schema: {
            example: {
                name: 'canvas-flow-default-agent',
                protocol: 'mcp-json-rpc',
                transport: 'http-json-rpc-post',
                endpoint: '/api/canvas-flow/mcp/default-agent',
                authentication: {
                    headers: {
                        Authorization: 'Bearer <CANVAS_FLOW_API_KEY>',
                        'x-api-key': '<CANVAS_FLOW_API_KEY>',
                    },
                },
                consumption: {
                    sequence: ['initialize', 'tools/list', 'tools/call'],
                    toolNameSource: 'Use result.tools[].name retornado por tools/list.',
                    callArguments: {
                        text: 'Mensagem ou tarefa para executar o flow.',
                        conversationId: 'Opcional, preserva memoria entre chamadas.',
                        slots: 'Opcional, contexto inicial em context.slots.',
                    },
                },
                tools: [
                    {
                        name: 'atendimento_inicial',
                        title: 'Atendimento inicial',
                        description: 'Executa o fluxo "Atendimento inicial".',
                        inputSchema: { type: 'object', required: ['text'] },
                    },
                ],
            },
        },
    }),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "mcpTools", null);
__decorate([
    (0, common_1.Post)('mcp/:agentId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Executa chamadas MCP JSON-RPC para o agente',
        description: [
            'Endpoint de consumo para MCP clients.',
            'Aceita JSON-RPC 2.0 simples ou batch por HTTP POST.',
            'Metodos suportados: initialize, ping, notifications/initialized, tools/list e tools/call.',
        ].join(' '),
    }),
    (0, swagger_1.ApiParam)({ name: 'agentId', description: 'Agente cujos flows serao expostos como tools MCP.' }),
    (0, swagger_1.ApiHeader)({
        name: 'Authorization',
        required: false,
        description: 'Bearer <CANVAS_FLOW_API_KEY>. Alternativas aceitas: x-api-key ou x-canvas-flow-token.',
    }),
    (0, swagger_1.ApiBody)({
        description: 'Requisicao MCP JSON-RPC 2.0. Para tools/call, use params.name vindo de tools/list.',
        schema: {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        jsonrpc: { type: 'string', example: '2.0' },
                        id: { oneOf: [{ type: 'string' }, { type: 'number' }], example: 2 },
                        method: { type: 'string', example: 'tools/call' },
                        params: {
                            type: 'object',
                            example: {
                                name: 'atendimento_inicial',
                                arguments: {
                                    text: 'Preciso de ajuda',
                                    conversationId: 'mcp-cliente-123',
                                    slots: {},
                                },
                            },
                        },
                    },
                    required: ['jsonrpc', 'method'],
                },
                { type: 'array', items: { type: 'object' } },
            ],
        },
        examples: {
            initialize: {
                summary: 'Inicializar cliente MCP',
                value: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'meu-mcp-client', version: '1.0.0' } } },
            },
            listTools: {
                summary: 'Listar tools expostas pelos flows',
                value: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
            },
            callTool: {
                summary: 'Chamar uma tool retornada por tools/list',
                value: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'atendimento_inicial', arguments: { text: 'Preciso de ajuda', conversationId: 'mcp-cliente-123', slots: {} } } },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Resposta MCP JSON-RPC.',
        schema: {
            example: {
                jsonrpc: '2.0',
                id: 3,
                result: {
                    content: [{ type: 'text', text: 'assistant: Ola, como posso ajudar?' }],
                    structuredContent: {
                        messages: [{ role: 'assistant', text: 'Ola, como posso ajudar?' }],
                        slots: {},
                        ended: false,
                        conversationId: 'mcp-cliente-123',
                        flowId: '665f...',
                        flowName: 'Atendimento inicial',
                    },
                },
            },
        },
    }),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "mcpJsonRpc", null);
__decorate([
    (0, common_1.Post)('mcp-external/tools'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "listExternalMcpTools", null);
__decorate([
    (0, common_1.Post)('simulations/replay'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "replaySimulation", null);
__decorate([
    (0, common_1.Post)('test/stream'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "testStream", null);
__decorate([
    (0, common_1.Post)('context/script/generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "generateContextScript", null);
__decorate([
    (0, common_1.Post)('mongodb/config/generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "generateMongoConfig", null);
__decorate([
    (0, common_1.Post)('assistant/generate-flow'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "generateFlowWithAssistant", null);
__decorate([
    (0, common_1.Post)('prompt-field/generate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "generatePromptField", null);
__decorate([
    (0, common_1.Post)('whatsapp-flows'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "createWhatsappFlow", null);
__decorate([
    (0, common_1.Post)('whatsapp-flows/list'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "listWhatsappFlows", null);
__decorate([
    (0, common_1.Delete)('whatsapp-flows/:flowId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "deleteWhatsappFlow", null);
__decorate([
    (0, common_1.Post)('whatsapp-flows/:flowId/assets'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "uploadWhatsappFlowJson", null);
__decorate([
    (0, common_1.Post)('whatsapp-flows/:flowId/publish'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "publishWhatsappFlow", null);
__decorate([
    (0, common_1.Post)('tags/dashboard'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "tagDashboard", null);
__decorate([
    (0, common_1.Post)('cron/run-due'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "runDueCron", null);
__decorate([
    (0, common_1.Post)('sqs/consume'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __param(2, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(3, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "consumeSqsMessages", null);
__decorate([
    (0, common_1.Get)('sqs/jobs/:jobId'),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Query)('agentId')),
    __param(2, (0, common_1.Query)('flowId')),
    __param(3, (0, common_1.Headers)('authorization')),
    __param(4, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(5, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "getSqsJob", null);
__decorate([
    (0, common_1.Post)('sqs/jobs/:jobId/retry'),
    __param(0, (0, common_1.Param)('jobId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __param(3, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(4, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "retrySqsJob", null);
__decorate([
    (0, common_1.Get)('sqs/health'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Headers)('x-canvas-flow-token')),
    __param(2, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "getSqsHealth", null);
__decorate([
    (0, common_1.Get)('reports/:fileName'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)('whatsapp-media/:flowId/:mediaId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Param)('mediaId')),
    __param(2, (0, common_1.Query)('exp')),
    __param(3, (0, common_1.Query)('sig')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "getWhatsappMedia", null);
__decorate([
    (0, common_1.Get)('webhook/custom/:flowId/:webhookId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Param)('webhookId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "receiveCustomWebhookGet", null);
__decorate([
    (0, common_1.Post)('webhook/custom/:flowId/:webhookId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Param)('webhookId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)()),
    __param(4, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "receiveCustomWebhookPost", null);
__decorate([
    (0, common_1.Get)('webhook/whatsapp/:flowId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Query)('hub.mode')),
    __param(2, (0, common_1.Query)('hub.verify_token')),
    __param(3, (0, common_1.Query)('hub.challenge')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "verifyWhatsappWebhook", null);
__decorate([
    (0, common_1.Get)('webhook/whatsapp-main/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Query)('hub.mode')),
    __param(2, (0, common_1.Query)('hub.verify_token')),
    __param(3, (0, common_1.Query)('hub.challenge')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "verifyWhatsappMainWebhook", null);
__decorate([
    (0, common_1.Post)('webhook/whatsapp/:flowId'),
    __param(0, (0, common_1.Param)('flowId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "receiveWhatsappWebhook", null);
__decorate([
    (0, common_1.Post)('webhook/whatsapp-main/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RunnerController.prototype, "receiveWhatsappMainWebhook", null);
exports.RunnerController = RunnerController = __decorate([
    (0, swagger_1.ApiTags)('runner'),
    (0, common_1.Controller)('api/canvas-flow'),
    __metadata("design:paramtypes", [runner_service_1.RunnerService,
        api_key_service_1.ApiKeyService,
        auth_service_1.AuthService,
        sqs_transition_service_1.SqsTransitionService,
        runner_queue_processor_1.RunnerQueueProcessor])
], RunnerController);
//# sourceMappingURL=runner-controller.js.map