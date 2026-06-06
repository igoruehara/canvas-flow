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
exports.RunnerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const canvas_flow_service_1 = require("../canvas-flow/canvas-flow-service");
const http_batch_service_1 = require("../http-batch/http-batch-service");
const memory_service_1 = require("../memory/memory-service");
const rag_service_1 = require("../rag/rag-service");
const crypto_1 = require("crypto");
const sha256_js_1 = require("@aws-crypto/sha256-js");
const credential_provider_node_1 = require("@aws-sdk/credential-provider-node");
const signature_v4_1 = require("@smithy/signature-v4");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const websocket_js_1 = require("@modelcontextprotocol/sdk/client/websocket.js");
const openai_provider_1 = require("../llm/openai-provider");
const provider_config_service_1 = require("../provider-config/provider-config-service");
const flow_tag_service_1 = require("../flow-tag/flow-tag-service");
const sqs_transition_service_1 = require("../queue/sqs-transition-service");
const mcp_oauth_service_1 = require("../mcp-oauth/mcp-oauth-service");
const observability_1 = require("../observability/observability");
const langgraph_runtime_service_1 = require("./langgraph-runtime.service");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const os = require("os");
const path = require("path");
const documents_service_1 = require("../documents/documents-service");
const WHATSAPP_LIMITS = {
    textBody: 4096,
    interactiveBody: 1024,
    footer: 60,
    buttons: 3,
    buttonLabel: 20,
    buttonId: 256,
    listButton: 20,
    listSections: 10,
    listRows: 10,
    sectionTitle: 24,
    rowTitle: 24,
    rowDescription: 72,
    rowId: 200,
    carouselCards: 10,
    carouselCardTitle: 80,
    carouselCardSubtitle: 160,
    imageUrl: 500,
};
const APPOINTMENT_FLOW_DATA_SOURCE_LIMIT = 100;
const ASSISTANT_MCP_REMOTE_PRESETS = [
    {
        id: 'gmail',
        label: 'Gmail',
        aliases: ['gmail', 'google mail'],
        serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
        authMode: 'oauth',
        capability: 'ler e organizar emails e criar rascunhos conforme as permissoes OAuth concedidas',
    },
    {
        id: 'google-drive',
        label: 'Google Drive',
        aliases: ['google drive', 'gdrive'],
        serverUrl: 'https://drivemcp.googleapis.com/mcp/v1',
        authMode: 'oauth',
        capability: 'pesquisar, ler, criar, copiar e baixar arquivos do Google Drive',
    },
    {
        id: 'onedrive',
        label: 'Microsoft OneDrive Work IQ',
        aliases: ['onedrive', 'one drive', 'microsoft one drive'],
        serverUrl: 'https://agent365.svc.cloud.microsoft/agents/tenants/SEU_TENANT_ID/servers/mcp_OneDriveRemoteServer',
        authMode: 'oauth',
        capability: 'pesquisar e operar arquivos do OneDrive com o tenant Microsoft Entra configurado',
    },
    {
        id: 'notion',
        label: 'Notion',
        aliases: ['notion'],
        serverUrl: 'https://mcp.notion.com/mcp',
        authMode: 'oauth',
        capability: 'ler ou alterar o workspace do Notion conforme as permissoes concedidas',
    },
    {
        id: 'github',
        label: 'GitHub',
        aliases: ['github', 'git hub'],
        serverUrl: 'https://api.githubcopilot.com/mcp/',
        authMode: 'bearer',
        capability: 'consultar e operar recursos do GitHub conforme o token concedido',
    },
    {
        id: 'gitlab-orbit',
        label: 'GitLab Orbit',
        aliases: ['gitlab', 'git lab', 'gitlab orbit'],
        serverUrl: 'https://gitlab.com/api/v4/orbit/mcp',
        authMode: 'oauth',
        capability: 'consultar o knowledge graph do GitLab Orbit',
    },
    {
        id: 'aws-knowledge',
        label: 'AWS Knowledge',
        aliases: ['aws', 'aws knowledge', 'amazon web services'],
        serverUrl: 'https://knowledge-mcp.global.api.aws',
        authMode: 'none',
        capability: 'consultar documentacao, referencias e disponibilidade regional da AWS',
    },
    {
        id: 'aws-mcp',
        label: 'AWS MCP Server',
        aliases: ['aws mcp server', 'agent toolkit for aws', 'infra aws', 'infraestrutura aws', 'aws infra', 'aws infrastructure'],
        serverUrl: 'https://aws-mcp.us-east-1.api.aws/mcp',
        authMode: 'aws_sigv4',
        capability: 'consultar documentacao e operar recursos reais da conta AWS conforme as permissoes IAM do backend',
    },
];
let RunnerService = class RunnerService {
    constructor(canvasFlowService, httpBatchService, memoryService, ragService, configService, providerConfigService, flowTagService, sqsTransitionService, mcpOAuthService, langGraphRuntimeService, documentsService) {
        this.canvasFlowService = canvasFlowService;
        this.httpBatchService = httpBatchService;
        this.memoryService = memoryService;
        this.ragService = ragService;
        this.configService = configService;
        this.providerConfigService = providerConfigService;
        this.flowTagService = flowTagService;
        this.sqsTransitionService = sqsTransitionService;
        this.mcpOAuthService = mcpOAuthService;
        this.langGraphRuntimeService = langGraphRuntimeService;
        this.documentsService = documentsService;
        this.openAISignature = '';
        this.operationalMongoSignature = '';
        this.cronRunning = false;
    }
    async refreshOpenAIClient() {
        const settings = await this.providerConfigService.getEffectiveSettings();
        const runtime = this.providerConfigService.toOpenAIRuntimeConfig(settings);
        const signature = JSON.stringify(runtime);
        if (!this.openAIClient || signature !== this.openAISignature) {
            this.openAIClient = (0, openai_provider_1.createOpenAIClient)(this.configService, runtime);
            this.openAIRuntimeConfig = runtime;
            this.openAISignature = signature;
        }
        return this.openAIClient;
    }
    async getOpenAIClient() {
        return await this.refreshOpenAIClient();
    }
    normalizeFlowLlmProvider(value) {
        const provider = String(value || '').trim().toLowerCase();
        if (provider === 'azure' || provider === 'azure_openai' || provider === 'azure-openai')
            return 'azure';
        if (provider === 'openai')
            return 'openai';
        if (provider === 'gemini')
            return 'gemini';
        if (provider === 'claude' || provider === 'anthropic')
            return 'claude';
        if (provider === 'grok' || provider === 'xai')
            return 'grok';
        if (provider === 'bedrock' || provider === 'aws_bedrock')
            return 'bedrock';
        return '';
    }
    async getOpenAIClientForProvider(provider, agentId) {
        const normalized = this.normalizeFlowLlmProvider(provider);
        if (!normalized && !agentId)
            return await this.getOpenAIClient();
        const settings = await this.getProviderSettings(agentId);
        const runtime = this.providerConfigService.toOpenAIRuntimeConfig(settings, normalized);
        return (0, openai_provider_1.createOpenAIClient)(this.configService, runtime);
    }
    async getChatModelForProvider(provider, model, agentId) {
        const normalized = this.normalizeFlowLlmProvider(provider);
        if (!normalized && !agentId)
            return await this.getChatModel(model);
        const settings = await this.getProviderSettings(agentId);
        const runtime = this.providerConfigService.toOpenAIRuntimeConfig(settings, normalized);
        return (0, openai_provider_1.getOpenAIChatModel)(this.configService, model, runtime);
    }
    flowLlmProvider(config, fallback) {
        return this.normalizeFlowLlmProvider(fallback || config?.llmProvider || '');
    }
    componentLlmProvider(component) {
        const provider = component?.ragLlmProvider && component.ragLlmProvider !== 'auto'
            ? component.ragLlmProvider
            : '';
        return this.normalizeFlowLlmProvider(provider);
    }
    normalizeAgentCatalogLoadMode(value, fallback = 'auto') {
        const mode = String(value || '').trim();
        if (mode === 'always' || mode === 'auto' || mode === 'on_demand' || mode === 'manual')
            return mode;
        return fallback;
    }
    agentCatalogItemId(item, fallback) {
        return String(item?.id || item?.key || item?.name || item?.label || fallback).trim() || fallback;
    }
    agentCatalogItemName(item, fallback) {
        return String(item?.name || item?.label || item?.title || this.agentCatalogItemId(item, fallback)).trim() || fallback;
    }
    normalizeAgentManifestRefs(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((item) => this.isPlainObject(item) && String(item.id || item.name || item.path || '').trim())
            .map((item) => this.cloneJson(item));
    }
    scopeAgentCatalog(catalog, refs, sourceType, fallbackLoad) {
        const items = Array.isArray(catalog)
            ? catalog.filter((item) => this.isPlainObject(item) && item.enabled !== false)
            : [];
        const manifestRefs = this.normalizeAgentManifestRefs(refs);
        const withLoad = (item, index, ref) => ({
            ...item,
            ...(ref || {}),
            id: this.agentCatalogItemId(ref || item, `${sourceType}-${index + 1}`),
            name: this.agentCatalogItemName(ref || item, this.agentCatalogItemName(item, `${sourceType}-${index + 1}`)),
            description: String(ref?.description || item.description || item.role || item.instructions || item.instruction || item.action || '').trim(),
            load: this.normalizeAgentCatalogLoadMode(ref?.load || ref?.loadMode || item.load || item.loadMode, fallbackLoad),
            manifestSelected: Boolean(ref),
            source: ref?.source || item.source || '',
            targetStepId: ref?.targetStepId || item.targetStepId || item.stepId || '',
            targetFlowId: ref?.targetFlowId || item.targetFlowId || item.flowId || '',
            targetAgentId: ref?.targetAgentId || item.targetAgentId || item.agentId || '',
        });
        if (!manifestRefs.length)
            return items.map((item, index) => withLoad(item, index));
        return manifestRefs
            .map((ref, index) => {
            const refId = String(ref.id || '').trim();
            const refPath = String(ref.path || '').trim();
            const match = items.find((item, itemIndex) => {
                const itemId = this.agentCatalogItemId(item, `${sourceType}-${itemIndex + 1}`);
                return itemId === refId
                    || String(item.path || '').trim() === refPath
                    || String(item.name || item.label || '').trim() === String(ref.name || '').trim();
            });
            return withLoad(match || ref, index, ref);
        })
            .filter((item) => item.enabled !== false);
    }
    withComponentAgentSpec(config, component) {
        const componentSpec = this.isPlainObject(component?.agentSpec) ? component?.agentSpec || {} : {};
        const manifest = this.isPlainObject(component?.agentManifest) ? component?.agentManifest || {} : {};
        const hasManifestSelection = ['rules', 'skills', 'subagents', 'mcpServers'].some((key) => (Array.isArray(manifest[key]) && manifest[key].length > 0));
        if (!Object.keys(componentSpec).length && !hasManifestSelection)
            return config;
        const flowSpec = this.isPlainObject(config.agentSpec) ? config.agentSpec || {} : {};
        const role = String(component?.agentRole || '').trim();
        const hasModernAgentRole = ['simple', 'orchestrator', 'subagent'].includes(role);
        const useWorkspaceCatalog = hasModernAgentRole && (component?.agentUseWorkspaceCatalog !== false || hasManifestSelection);
        const localAgentsMd = String(componentSpec.agentsMd || '').trim();
        const localGuardrails = String(componentSpec.guardrails || '').trim();
        const localBlockedTerms = Array.isArray(componentSpec.blockedTerms)
            ? componentSpec.blockedTerms.map((term) => String(term || '').trim()).filter(Boolean)
            : [];
        return {
            ...config,
            agentSpec: {
                ...flowSpec,
                agentsMd: localAgentsMd ? String(componentSpec.agentsMd || '') : flowSpec.agentsMd,
                guardrails: localGuardrails ? String(componentSpec.guardrails || '') : flowSpec.guardrails,
                blockedTerms: localBlockedTerms.length
                    ? localBlockedTerms
                    : (Array.isArray(flowSpec.blockedTerms) ? flowSpec.blockedTerms : []),
                rules: useWorkspaceCatalog
                    ? this.scopeAgentCatalog(flowSpec.rules, manifest.rules, 'rule', 'always')
                    : Array.isArray(componentSpec.rules) ? componentSpec.rules : (Array.isArray(flowSpec.rules) ? flowSpec.rules : []),
                skills: useWorkspaceCatalog
                    ? this.scopeAgentCatalog(flowSpec.skills, manifest.skills, 'skill', 'auto')
                    : Array.isArray(componentSpec.skills) ? componentSpec.skills : (Array.isArray(flowSpec.skills) ? flowSpec.skills : []),
                subagents: useWorkspaceCatalog
                    ? this.scopeAgentCatalog(flowSpec.subagents, manifest.subagents, 'subagent', 'auto')
                    : Array.isArray(componentSpec.subagents) ? componentSpec.subagents : (Array.isArray(flowSpec.subagents) ? flowSpec.subagents : []),
                mcpServers: useWorkspaceCatalog
                    ? this.scopeAgentCatalog(flowSpec.mcpServers, manifest.mcpServers, 'mcp', 'on_demand')
                    : Array.isArray(componentSpec.mcpServers) ? componentSpec.mcpServers : (Array.isArray(flowSpec.mcpServers) ? flowSpec.mcpServers : []),
            },
        };
    }
    buildAgentSystemPreamble(config) {
        const spec = config?.agentSpec || {};
        return [
            spec.agentsMd ? String(spec.agentsMd) : '',
            spec.guardrails ? String(spec.guardrails) : '',
        ].filter((part) => String(part || '').trim()).join('\n\n');
    }
    withAgentSystemPreamble(prompt, config) {
        const preamble = this.buildAgentSystemPreamble(config);
        return [preamble, prompt].filter((part) => String(part || '').trim()).join('\n\n');
    }
    evaluateAgentGuardrails(config, input) {
        const blockedTerms = Array.isArray(config?.agentSpec?.blockedTerms)
            ? config?.agentSpec?.blockedTerms || []
            : [];
        const normalizedInput = String(input || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const matched = blockedTerms
            .map((term) => String(term || '').trim())
            .filter(Boolean)
            .find((term) => normalizedInput.includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
        if (!matched)
            return null;
        return {
            blocked: true,
            matchedTerm: matched,
            text: 'Nao posso continuar com essa solicitacao por causa dos guardrails configurados para este agente.',
        };
    }
    async getProviderSettings(agentId) {
        return await this.providerConfigService.getEffectiveSettings(agentId);
    }
    getHeaderValue(headers, name) {
        const expected = String(name || '').trim().toLowerCase();
        if (!expected)
            return '';
        const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === expected);
        const value = entry?.[1];
        return Array.isArray(value) ? String(value[0] || '') : String(value || '');
    }
    redactIncomingHeaders(headers) {
        const safe = {};
        Object.entries(headers || {}).forEach(([key, value]) => {
            safe[key] = /authorization|token|api-key|x-api-key|cookie|secret/i.test(key) ? '[redacted]' : value;
        });
        return safe;
    }
    safeSecretEquals(received, expected) {
        const left = Buffer.from(String(received || ''));
        const right = Buffer.from(String(expected || ''));
        return left.length === right.length && left.length > 0 && (0, crypto_1.timingSafeEqual)(left, right);
    }
    getWebhookInputText(body, query) {
        const candidates = [
            body?.text,
            body?.message,
            body?.input,
            body?.userInput,
            query?.text,
            query?.message,
            query?.input,
        ];
        const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim() !== '');
        return value === undefined ? '' : String(value);
    }
    findCustomWebhookStep(config, webhookId) {
        const requested = String(webhookId || '').trim();
        return (config.steps || []).find((step) => {
            const component = step.component;
            if (step.type !== 'component' || component?.type !== 'webhook')
                return false;
            if ((component.webhookMode || 'inbound') !== 'inbound')
                return false;
            const id = String(component.webhookId || step.id || '').trim();
            return id === requested;
        });
    }
    assertCustomWebhookAuth(step, headers, query) {
        const component = (step.component || {});
        const mode = component.webhookAuthMode || 'none';
        if (mode === 'none')
            return;
        const secret = String(component.webhookSecret || '').trim();
        if (!secret) {
            throw new common_1.HttpException('Webhook sem segredo configurado.', common_1.HttpStatus.UNAUTHORIZED);
        }
        const received = (() => {
            if (mode === 'bearer') {
                const authorization = this.getHeaderValue(headers, 'authorization');
                const match = authorization.match(/^Bearer\s+(.+)$/i);
                return match?.[1] || '';
            }
            if (mode === 'query') {
                const param = String(component.webhookQueryParam || 'secret').trim();
                return String(query?.[param] || '');
            }
            const headerName = String(component.webhookHeaderName || 'x-canvas-flow-webhook-secret').trim();
            return this.getHeaderValue(headers, headerName);
        })();
        if (!this.safeSecretEquals(received, secret)) {
            throw new common_1.HttpException('Webhook não autorizado.', common_1.HttpStatus.UNAUTHORIZED);
        }
    }
    buildCustomWebhookRunPayload(flow, config, step, flowId, payload, savedState, versionInfo) {
        const responseName = step.component?.responseName || step.responseName || 'webhook';
        const event = {
            webhookId: step.component?.webhookId || step.id,
            flowId: String(flow?._id || flowId),
            flowName: flow?.name || config.title || '',
            stepId: step.id,
            method: String(payload.method || 'POST').toUpperCase(),
            receivedAt: new Date().toISOString(),
            headers: this.redactIncomingHeaders(payload.headers),
            query: payload.query || {},
            body: payload.body,
        };
        const bodySlots = this.isPlainObject(payload.body?.slots) ? payload.body.slots : {};
        const savedSlots = this.isPlainObject(savedState?.slots) ? savedState.slots : {};
        const requestedCurrentStepId = String(payload.body?.currentStepId || payload.body?.currentNodeId || '').trim();
        const savedCurrentStepId = String(savedState?.currentStepId || '').trim();
        const activeFlowId = String(savedState?.activeFlowId || flow?._id || flowId);
        const startAtNode = (step.component?.webhookStartMode || 'node') === 'node';
        return {
            flowId: String(flow?._id || flowId),
            activeFlowId,
            entryFlowId: String(flow?._id || flowId),
            _organizationId: flow?.organizationId,
            _langGraphRunId: (0, crypto_1.randomUUID)(),
            organizationId: flow?.organizationId,
            agentId: flow?.agentId,
            channel: config.channel || 'webWidget',
            flowVersion: versionInfo?.version,
            activeFlowVersion: versionInfo?.activeVersion,
            flowVersionSource: versionInfo?.source,
            conversationId: payload.body?.conversationId || payload.query?.conversationId,
            currentStepId: requestedCurrentStepId || savedCurrentStepId || (startAtNode ? step.id : undefined),
            text: this.getWebhookInputText(payload.body, payload.query),
            _deferInputUntilCurrentStep: !requestedCurrentStepId,
            slots: {
                ...savedSlots,
                ...bodySlots,
                webhook: event,
                [responseName]: event,
            },
            skipHistory: payload.body?.skipHistory === true,
        };
    }
    async deliverWebhookCallback(callback, result, error) {
        const url = String(callback?.url || '').trim();
        if (!url)
            return { skipped: true, reason: 'missing_callback_url' };
        const authMode = String(callback?.authMode || 'none');
        const secret = String(callback?.secret || '');
        const headers = { 'Content-Type': 'application/json' };
        if (authMode === 'bearer' && secret) {
            headers.Authorization = secret.toLowerCase().startsWith('bearer ') ? secret : `Bearer ${secret}`;
        }
        if (authMode === 'header' && secret) {
            headers[String(callback?.headerName || 'x-canvas-flow-callback-secret')] = secret;
        }
        const body = {
            jobId: callback?.jobId,
            status: error ? 'failed' : 'completed',
            flowId: callback?.flowId,
            webhookId: callback?.webhookId,
            completedAt: error ? undefined : new Date().toISOString(),
            failedAt: error ? new Date().toISOString() : undefined,
            result: error ? undefined : result,
            error: error ? this.getErrorMessage(error) : undefined,
        };
        return await this.httpBatchService.execute([{
                method: 'POST',
                url,
                headers,
                bodyType: 'jsonFields',
                body,
            }], {});
    }
    async persistWebhookRunState(runPayload, result) {
        if (!runPayload?.conversationId || !result)
            return;
        if (result.memoryClearRequested === true || result.memoryCleared === true)
            return;
        await this.saveCanvasFlowState({
            agentId: runPayload.agentId,
            organizationId: runPayload._organizationId || runPayload.organizationId,
            conversationId: result.conversationId || runPayload.conversationId,
            entryFlowId: result.entryFlowId || runPayload.entryFlowId || runPayload.flowId,
            activeFlowId: result.activeFlowId || runPayload.activeFlowId || runPayload.flowId,
            currentStepId: result.currentStepId || '',
            slots: result.slots || {},
            conversationOwnerId: runPayload._conversationOwnerId || runPayload._oauthUserId,
            langGraphThreadId: result.runtime?.threadId,
        });
    }
    getWebhookListenerSteps(config) {
        return (config.steps || []).filter((step) => step.type === 'component'
            && step.component?.type === 'webhook'
            && step.component.webhookMode === 'listener');
    }
    shouldDispatchWebhookListeners(body, config) {
        if (body?.skipWebhookListeners === true)
            return false;
        if (!this.getWebhookListenerSteps(config).length)
            return false;
        if (this.isPlainObject(body?.slots?.cron))
            return false;
        if (body?.forceWebhookListeners === true)
            return true;
        if (String(body?.text || '').trim())
            return true;
        if (this.isPlainObject(body?.slots?.webhook))
            return true;
        if (this.isPlainObject(body?.slots?.whatsapp))
            return true;
        if (this.isPlainObject(body?.slots?.webWidget))
            return true;
        if (this.isPlainObject(body?.slots?.webWidgetEvent))
            return true;
        return false;
    }
    createWebhookListenerEvent(options) {
        const { context, messages, waitingInput, ended, activeFlowId, activeFlowName } = options;
        return {
            type: 'client.interaction',
            firedAt: new Date().toISOString(),
            flowId: context.flowId,
            flowName: context.flowName,
            entryFlowId: context.entryFlowId,
            activeFlowId,
            activeFlowName,
            conversationId: context.conversationId,
            channel: context.channel,
            input: context.input || '',
            userInput: context.slots?.userInput || '',
            currentStepId: waitingInput || '',
            inputTargetStepId: context.inputTargetStepId || '',
            ended,
            messagesCount: messages.length,
            messages: this.cloneJson(messages),
            webhook: this.cloneJson(context.slots?.webhook),
        };
    }
    async executeWebhookListenerStep(step, context, event) {
        context.slots = context.slots || {};
        const responseName = step.component?.responseName || step.responseName || 'webhook';
        const previousEvent = context.slots.webhookEvent;
        context.slots.webhookEvent = event;
        try {
            const requests = this.renderTemplate(step.api?.requests || [], context);
            const result = await this.httpBatchService.execute(requests, context);
            context.slots[responseName] = result;
            return result;
        }
        finally {
            if (previousEvent === undefined) {
                delete context.slots.webhookEvent;
            }
            else {
                context.slots.webhookEvent = previousEvent;
            }
        }
    }
    async dispatchWebhookListeners(options) {
        const { body, config, context, messages, trace, waitingInput, ended, activeFlowId, activeFlowName } = options;
        if (!this.shouldDispatchWebhookListeners(body, config))
            return;
        const event = this.createWebhookListenerEvent({ context, messages, waitingInput, ended, activeFlowId, activeFlowName });
        const listeners = this.getWebhookListenerSteps(config);
        for (const step of listeners) {
            const fireAndForget = step.component?.webhookListenerFireAndForget !== false;
            if (fireAndForget) {
                trace.push({
                    stepId: step.id,
                    type: 'webhookListener',
                    mode: 'fireAndForget',
                    scheduled: true,
                });
                const listenerContext = {
                    ...context,
                    slots: this.cloneJson(context.slots || {}),
                };
                void this.executeWebhookListenerStep(step, listenerContext, event).catch((error) => {
                    console.warn('Canvas Flow webhook listener error', this.getErrorMessage(error));
                });
                continue;
            }
            try {
                const result = await this.executeWebhookListenerStep(step, context, event);
                trace.push({
                    stepId: step.id,
                    type: 'webhookListener',
                    mode: 'blocking',
                    result,
                });
            }
            catch (error) {
                trace.push({
                    stepId: step.id,
                    type: 'webhookListener',
                    mode: 'blocking',
                    error: this.getErrorMessage(error),
                });
            }
        }
    }
    async runCustomWebhook(flowId, webhookId, payload) {
        const flow = await this.canvasFlowService.findOne(flowId);
        const agentReleaseInfo = await this.canvasFlowService.resolveAgentRelease(flow?.agentId, flow?.organizationId, payload.body?.agentRelease || payload.body?.agentReleaseVersion || payload.query?.agentRelease || payload.query?.agentReleaseVersion);
        const releaseFlowVersion = agentReleaseInfo.versions?.[String(flow?._id || flowId)];
        const versionInfo = await this.canvasFlowService.resolveFlowVersionAsync(flow, payload.body?.flowVersion || payload.body?.version || payload.query?.flowVersion || payload.query?.version || releaseFlowVersion);
        const config = versionInfo.config;
        if (!config?.steps?.length) {
            throw new common_1.HttpException('Fluxo vazio ou inválido para webhook.', common_1.HttpStatus.BAD_REQUEST);
        }
        const step = this.findCustomWebhookStep(config, webhookId);
        if (!step) {
            throw new common_1.HttpException('Webhook de entrada não encontrado neste fluxo.', common_1.HttpStatus.NOT_FOUND);
        }
        this.assertCustomWebhookAuth(step, payload.headers, payload.query);
        const conversationId = String(payload.body?.conversationId || payload.query?.conversationId || '').trim();
        const conversationOwnerId = `webhook:${step.component?.webhookId || step.id}`;
        const savedState = conversationId ? await this.getCanvasFlowState(flow?.agentId, conversationId, String(flow?._id || flowId), {
            organizationId: flow?.organizationId,
            conversationOwnerId,
        }) : null;
        const runPayload = this.buildCustomWebhookRunPayload(flow, config, step, flowId, payload, savedState, versionInfo);
        runPayload._conversationOwnerId = conversationOwnerId;
        runPayload.agentRelease = agentReleaseInfo.release;
        runPayload.flowVersionMap = agentReleaseInfo.versions;
        const responseMode = step.component?.webhookResponseMode || 'sync';
        if (responseMode !== 'async' && responseMode !== 'async_job') {
            const result = await this.run(runPayload);
            await this.persistWebhookRunState(runPayload, result);
            return result;
        }
        const jobId = (0, crypto_1.randomUUID)();
        const callback = {
            jobId,
            flowId: String(flow?._id || flowId),
            webhookId: step.component?.webhookId || step.id,
            url: responseMode === 'async' ? step.component?.webhookCallbackUrl || '' : '',
            authMode: step.component?.webhookCallbackAuthMode || 'none',
            secret: step.component?.webhookCallbackSecret || '',
            headerName: step.component?.webhookCallbackHeaderName || 'x-canvas-flow-callback-secret',
        };
        const asyncPayload = {
            ...runPayload,
            async: true,
            _webhookAsync: callback,
        };
        if (this.sqsTransitionService.isEnabled()) {
            const queued = await this.sqsTransitionService.enqueue('canvas-flow.run', asyncPayload, {
                trackResult: true,
                jobId,
            });
            return {
                async: true,
                queued: true,
                jobId,
                status: queued.status || 'queued',
                retrieval: responseMode === 'async_job' ? 'jobId' : 'callback',
                callbackUrlConfigured: Boolean(callback.url),
            };
        }
        void this.run(asyncPayload)
            .then(async (result) => {
            await this.persistWebhookRunState(asyncPayload, result);
            await this.deliverWebhookCallback(callback, result).catch(() => undefined);
        })
            .catch((error) => this.deliverWebhookCallback(callback, undefined, error).catch(() => undefined));
        return {
            async: true,
            queued: false,
            jobId,
            status: 'accepted',
            retrieval: responseMode === 'async_job' ? 'jobId' : 'callback',
            callbackUrlConfigured: Boolean(callback.url),
        };
    }
    onModuleInit() {
        const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || this.configService.get('LOG_IS_LAMBDA') === 'true');
        const defaultAutoRun = isLambda ? 'false' : 'true';
        const autoRun = String(this.configService.get('CANVAS_FLOW_CRON_AUTORUN') ?? defaultAutoRun).toLowerCase() !== 'false';
        if (!autoRun)
            return;
        const intervalMs = Math.max(Number(this.configService.get('CANVAS_FLOW_CRON_SCAN_MS') || 30000), 5000);
        this.cronTimer = setInterval(() => {
            void this.runDueCronFlows({ suppressConnectionErrors: true }).catch((error) => {
                console.error('Canvas Flow CRON scheduler error', this.getErrorMessage(error));
            });
        }, intervalMs);
    }
    onModuleDestroy() {
        if (this.cronTimer)
            clearInterval(this.cronTimer);
        if (this.operationalMongoConnection)
            void this.operationalMongoConnection.close().catch(() => undefined);
    }
    getByPath(source, path) {
        return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
    }
    renderTemplate(value, context) {
        if (typeof value === 'string') {
            return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
                const trimmed = String(expr || '').trim();
                if (/^(result|initialResult|attempt)\b/.test(trimmed)) {
                    return _match;
                }
                if (trimmed.startsWith('context.')) {
                    const resolved = this.getByPath(context, trimmed.replace(/^context\./, ''));
                    return resolved === undefined || resolved === null
                        ? ''
                        : typeof resolved === 'string'
                            ? resolved
                            : JSON.stringify(resolved);
                }
                const resolved = this.getByPath(context.slots || {}, trimmed.replace(/^slots\./, ''));
                return resolved === undefined || resolved === null
                    ? ''
                    : typeof resolved === 'string'
                        ? resolved
                        : JSON.stringify(resolved);
            });
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.renderTemplate(item, context));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.renderTemplate(item, context)]));
        }
        return value;
    }
    parseJsonConfig(value, fallback) {
        if (value === undefined || value === null || value === '')
            return fallback;
        if (typeof value !== 'string')
            return value;
        const raw = value.trim();
        if (!raw)
            return fallback;
        try {
            return JSON.parse(raw);
        }
        catch {
            return fallback;
        }
    }
    parseTemplatedJsonConfig(value, fallback, context) {
        if (value === undefined || value === null || value === '')
            return fallback;
        if (typeof value !== 'string')
            return this.renderTemplate(value, context);
        const raw = value.trim();
        if (!raw)
            return fallback;
        try {
            return this.renderTemplate(JSON.parse(raw), context);
        }
        catch {
            return this.parseJsonConfig(this.renderTemplate(raw, context), fallback);
        }
    }
    toPlain(value) {
        return JSON.parse(JSON.stringify(value ?? null));
    }
    resolveTraceOptions(body) {
        const requestedMode = String(body?.traceMode || body?.trace?.mode || '').trim().toLowerCase();
        const mode = body?.trace === false
            ? 'off'
            : requestedMode === 'off' || requestedMode === 'none' || requestedMode === 'false'
                ? 'off'
                : requestedMode === 'debug'
                    ? 'debug'
                    : requestedMode === 'full'
                        ? 'full'
                        : 'compact';
        const defaultCollectLimit = mode === 'off' ? 0 : mode === 'compact' ? 500 : 2000;
        const defaultResponseLimit = mode === 'off' ? 0 : mode === 'compact' ? 80 : 200;
        return {
            mode,
            collectLimit: this.limitNumber(body?.traceCollectLimit ?? body?.trace?.collectLimit, defaultCollectLimit, 0, 5000),
            responseLimit: this.limitNumber(body?.traceLimit ?? body?.trace?.limit, defaultResponseLimit, 0, 1000),
            responseOffset: this.limitNumber(body?.traceOffset ?? body?.trace?.offset, 0, 0, 1000000),
        };
    }
    createTraceBuffer(options) {
        const buffer = [];
        buffer.__dropped = 0;
        buffer.__mode = options.mode;
        buffer.__collectLimit = options.collectLimit;
        const nativePush = Array.prototype.push;
        buffer.push = (...items) => {
            if (options.mode === 'off' || options.collectLimit <= 0) {
                buffer.__dropped = (buffer.__dropped || 0) + items.length;
                return buffer.length;
            }
            const compacted = items.map((item) => this.compactTraceEntry(item, options.mode));
            nativePush.apply(buffer, compacted);
            const overflow = buffer.length - options.collectLimit;
            if (overflow > 0) {
                buffer.splice(0, overflow);
                buffer.__dropped = (buffer.__dropped || 0) + overflow;
            }
            return buffer.length;
        };
        return buffer;
    }
    compactTraceEntry(entry, mode) {
        const limits = {
            maxDepth: mode === 'compact' ? 4 : 6,
            maxString: mode === 'compact' ? 1000 : mode === 'debug' ? 4000 : 8000,
            maxArray: mode === 'compact' ? 25 : 100,
            maxObjectKeys: mode === 'compact' ? 40 : 120,
        };
        return this.compactTraceValue(entry, limits, 0, new WeakSet(), '');
    }
    compactTraceValue(value, limits, depth, seen, key) {
        if (key && /authorization|api[-_]?key|token|secret|password|senha/i.test(key)) {
            return '[redacted]';
        }
        if (value === null || value === undefined)
            return value;
        if (typeof value === 'string') {
            return value.length > limits.maxString
                ? `${value.slice(0, limits.maxString)}...[truncated ${value.length - limits.maxString} chars]`
                : value;
        }
        if (typeof value === 'number' || typeof value === 'boolean')
            return value;
        if (typeof value === 'bigint')
            return String(value);
        if (typeof value === 'function' || typeof value === 'symbol')
            return `[${typeof value}]`;
        if (value instanceof Date)
            return value.toISOString();
        if (typeof value !== 'object')
            return String(value);
        if (seen.has(value))
            return '[circular]';
        if (depth >= limits.maxDepth)
            return this.traceValueSummary(value);
        seen.add(value);
        if (Array.isArray(value)) {
            const items = value
                .slice(0, limits.maxArray)
                .map((item, index) => this.compactTraceValue(item, limits, depth + 1, seen, String(index)));
            if (value.length > limits.maxArray) {
                items.push({ __truncated: `${value.length - limits.maxArray} item(ns)` });
            }
            seen.delete(value);
            return items;
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
            seen.delete(value);
            return `[buffer:${value.length}]`;
        }
        const entries = Object.entries(value);
        const result = {};
        entries.slice(0, limits.maxObjectKeys).forEach(([childKey, childValue]) => {
            if (childValue !== undefined) {
                result[childKey] = this.compactTraceValue(childValue, limits, depth + 1, seen, childKey);
            }
        });
        if (entries.length > limits.maxObjectKeys) {
            result.__truncated = `${entries.length - limits.maxObjectKeys} campo(s)`;
        }
        seen.delete(value);
        return result;
    }
    traceValueSummary(value) {
        if (Array.isArray(value))
            return `[array:${value.length}]`;
        if (value && typeof value === 'object') {
            const keys = Object.keys(value).slice(0, 8).join(',');
            return `[object${keys ? `:${keys}` : ''}]`;
        }
        return String(value);
    }
    paginateTrace(trace, options) {
        const buffer = trace;
        const buffered = Array.isArray(trace) ? trace.length : 0;
        const dropped = Math.max(0, Number(buffer.__dropped || 0));
        const total = dropped + buffered;
        const offset = Math.min(Math.max(0, options.responseOffset), buffered);
        const limit = Math.max(0, options.responseLimit);
        const end = Math.min(buffered, offset + limit);
        const page = options.mode === 'off' || limit <= 0 ? [] : trace.slice(offset, end);
        return {
            trace: page,
            tracePage: {
                mode: options.mode,
                total,
                buffered,
                dropped,
                offset,
                limit,
                returned: page.length,
                hasMore: options.mode !== 'off' && end < buffered,
                nextOffset: options.mode !== 'off' && end < buffered ? end : undefined,
            },
        };
    }
    async getOperationalMongoConnection() {
        const settings = await this.getProviderSettings();
        const uri = String(settings.mongodb?.connectionString || '').trim();
        const databaseName = String(settings.mongodb?.databaseName || '').trim();
        if (!uri) {
            if (mongoose.connection.readyState !== 1) {
                await this.waitForMongoConnection();
            }
            return mongoose.connection;
        }
        const signature = `${uri}::${databaseName}`;
        if (!this.operationalMongoConnection || signature !== this.operationalMongoSignature) {
            if (this.operationalMongoConnection) {
                await this.operationalMongoConnection.close().catch(() => undefined);
            }
            const connection = mongoose.createConnection(uri, {
                serverSelectionTimeoutMS: Number(this.configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS') || 8000),
                connectTimeoutMS: Number(this.configService.get('MONGO_CONNECT_TIMEOUT_MS') || 8000),
            });
            await connection.asPromise().catch((error) => {
                throw new common_1.HttpException(`MongoDB operacional indisponivel: ${this.getErrorMessage(error)}`, common_1.HttpStatus.SERVICE_UNAVAILABLE);
            });
            this.operationalMongoConnection = databaseName ? connection.useDb(databaseName, { useCache: true }) : connection;
            this.operationalMongoSignature = signature;
        }
        return this.operationalMongoConnection;
    }
    async getMongoCollection(collectionName) {
        const name = String(collectionName || '').trim();
        if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(name) || name.startsWith('system.')) {
            throw new common_1.HttpException('MongoDB collection invalida.', common_1.HttpStatus.BAD_REQUEST);
        }
        const connection = await this.getOperationalMongoConnection();
        return connection.collection(name);
    }
    async waitForMongoConnection() {
        if (mongoose.connection.readyState === 1)
            return;
        await mongoose.connection.asPromise().catch((error) => {
            throw new common_1.HttpException(`MongoDB indisponivel: ${this.getErrorMessage(error)}`, common_1.HttpStatus.SERVICE_UNAVAILABLE);
        });
    }
    limitNumber(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return fallback;
        return Math.max(min, Math.min(Math.floor(parsed), max));
    }
    limitDecimal(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            return fallback;
        return Math.max(min, Math.min(parsed, max));
    }
    sleep(ms) {
        const safeMs = Math.max(0, Math.min(Math.floor(ms), 3600000));
        if (!safeMs)
            return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, safeMs));
    }
    emitFlowMessage(messages, message, options) {
        const delayBeforeMs = Math.max(0, Math.floor(Number(options?.delayBeforeMs || 0)));
        const enriched = delayBeforeMs > 0 ? { ...message, delayBeforeMs } : message;
        messages.push(enriched);
        if (typeof options?.onMessage === 'function') {
            options.onMessage(this.toPlain(enriched));
        }
        return enriched;
    }
    maxParallelNodes() {
        return this.limitNumber(this.configService.get('CANVAS_FLOW_MAX_PARALLEL_NODES') || 50, 50, 1, 200);
    }
    async allSettledLimited(items, limit, worker) {
        const results = new Array(items.length);
        let cursor = 0;
        const workerCount = Math.min(Math.max(1, limit), items.length);
        await Promise.all(Array.from({ length: workerCount }, async () => {
            while (cursor < items.length) {
                const index = cursor;
                cursor += 1;
                try {
                    results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
                }
                catch (reason) {
                    results[index] = { status: 'rejected', reason };
                }
            }
        }));
        return results;
    }
    normalizeMongoUpdate(update) {
        const next = update && typeof update === 'object' && !Array.isArray(update) ? update : {};
        const hasOperator = Object.keys(next).some((key) => key.startsWith('$'));
        return hasOperator ? next : { $set: next };
    }
    normalizeMongoSort(sort) {
        const next = sort && typeof sort === 'object' && !Array.isArray(sort) ? sort : {};
        return Object.prototype.hasOwnProperty.call(next, '_id') ? next : { ...next, _id: 1 };
    }
    mergeMongoFilter(base, extra) {
        const baseFilter = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
        const extraFilter = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {};
        return { ...baseFilter, ...extraFilter };
    }
    getMongoEffectiveLlmMode(component, operation) {
        const fullOnlyOperations = new Set(['insertOne', 'insertMany', 'updateOne', 'updateMany', 'upsertOne']);
        if (component.mongoUseLlmFilter === true && fullOnlyOperations.has(operation))
            return 'full';
        return component.mongoLlmMode || 'filter';
    }
    hasMongoFilter(filter) {
        return Boolean(filter && typeof filter === 'object' && !Array.isArray(filter) && Object.keys(filter).length);
    }
    applyMongoDateRange(filter, component, context) {
        const field = String(component.mongoDateField || '').trim();
        if (!field)
            return filter;
        const timezone = String(component.mongoDateTimezone || 'America/Sao_Paulo').trim() || 'America/Sao_Paulo';
        const startRaw = this.renderTemplate(component.mongoDateStart || '', context);
        const endRaw = this.renderTemplate(component.mongoDateEnd || '', context);
        const start = this.parseCronDate(startRaw, timezone);
        const end = this.parseCronDate(endRaw, timezone);
        if (!start && !end)
            return filter;
        const currentFieldFilter = filter[field] && typeof filter[field] === 'object' && !Array.isArray(filter[field])
            ? filter[field]
            : {};
        return {
            ...filter,
            [field]: {
                ...currentFieldFilter,
                ...(start ? { $gte: start } : {}),
                ...(end ? { $lte: end } : {}),
            },
        };
    }
    getMongoEffectiveDateComponent(component, llmQuery, llmMode) {
        if (llmMode !== 'full' || !llmQuery?.dateRange)
            return component;
        const dateRange = llmQuery.dateRange || {};
        return {
            ...component,
            mongoDateField: dateRange.field || component.mongoDateField,
            mongoDateStart: dateRange.start || component.mongoDateStart,
            mongoDateEnd: dateRange.end || component.mongoDateEnd,
            mongoDateTimezone: dateRange.timezone || component.mongoDateTimezone,
        };
    }
    getMongoEffectivePagination(component, llmQuery, llmMode) {
        const llmPagination = llmMode === 'full' && llmQuery?.pagination
            ? llmQuery.pagination
            : {};
        const limit = this.limitNumber(llmPagination.limit ?? component.mongoLimit, 50, 1, 1000);
        const page = this.limitNumber(llmPagination.page ?? component.mongoPage, 1, 1, 100000);
        const skipBase = this.limitNumber(llmPagination.skip ?? component.mongoSkip, 0, 0, 1000000);
        const maxPages = this.limitNumber(llmPagination.maxPages ?? component.mongoMaxPages, 5, 1, 20);
        const paginationMode = llmPagination.mode === 'all' || llmPagination.mode === 'single'
            ? llmPagination.mode
            : component.mongoPaginationMode || 'single';
        return {
            limit,
            page,
            skip: skipBase + ((page - 1) * limit),
            maxPages,
            paginationMode,
        };
    }
    async buildMongoLlmQuery(component, config, context, operation) {
        if (component.mongoUseLlmFilter !== true)
            return {};
        const instruction = this.renderTemplate(component.mongoLlmInstruction || '', context);
        if (!String(instruction || '').trim())
            return {};
        const mode = this.getMongoEffectiveLlmMode(component, operation);
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), component.mongoLlmModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce gera consultas MongoDB em JSON para um fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        mode === 'full'
                            ? 'Formato permitido: {"filter": {}, "sort": {}, "projection": {}, "pipeline": [], "document": {}, "documents": [], "update": {}, "dateRange": {"field": "createdAt", "start": "ISO/local datetime", "end": "ISO/local datetime", "timezone": "America/Sao_Paulo"}, "pagination": {"mode": "single|all", "page": 1, "limit": 50, "skip": 0, "maxPages": 5}}.'
                            : 'Formato permitido: {"filter": {}, "sort": {}, "projection": {}, "pipeline": []}.',
                        mode === 'full'
                            ? 'Quando houver datas, prefira dateRange em vez de colocar $gte/$lte diretamente no filter.'
                            : 'Use datas ISO quando houver range de data.',
                        'Nao escolha a operacao; use a operation recebida.',
                        'Para insertOne use document. Para insertMany use documents. Para updateOne/updateMany/upsertOne use filter e update.',
                        'Para find/count/findOne/delete use filter/sort/projection quando fizer sentido. Para aggregate use pipeline e opcionalmente filter como $match inicial.',
                        'Nao use operadores destrutivos no aggregate como $out ou $merge.',
                        'Nunca use $where, javascript ou funcoes.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        operation,
                        mode,
                        instruction,
                        collectionName: component.mongoCollectionName || component.collectionName || 'flow_events',
                        manualFilter: component.mongoFilter,
                        manualPagination: {
                            mode: component.mongoPaginationMode,
                            page: component.mongoPage,
                            limit: component.mongoLimit,
                            skip: component.mongoSkip,
                            maxPages: component.mongoMaxPages,
                        },
                        manualDateRange: {
                            field: component.mongoDateField,
                            start: component.mongoDateStart,
                            end: component.mongoDateEnd,
                            timezone: component.mongoDateTimezone,
                        },
                        context: {
                            input: context.input,
                            slots: context.slots,
                            now: context.now,
                        },
                    }, null, 2),
                },
            ],
            temperature: 0,
        });
        return this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
    }
    createAnalyticsDocument(step, context) {
        return {
            agentId: context.agentId,
            flowId: context.flowId,
            flowName: context.flowName,
            conversationId: context.conversationId,
            channel: context.channel,
            stepId: step.id,
            stepTitle: step.title,
            userInput: context.input || context.slots?.userInput || '',
            slots: context.slots || {},
            createdAt: new Date(),
        };
    }
    async runMongoComponent(step, context, config) {
        const component = step.component;
        const collection = await this.getMongoCollection(component.mongoCollectionName || component.collectionName || 'flow_events');
        const operation = component.mongoOperation || 'insertOne';
        const llmQuery = await this.buildMongoLlmQuery(component, config, context, operation);
        const llmMode = this.getMongoEffectiveLlmMode(component, operation);
        const dateComponent = this.getMongoEffectiveDateComponent(component, llmQuery, llmMode);
        const pagination = this.getMongoEffectivePagination(component, llmQuery, llmMode);
        const manualFilter = this.parseTemplatedJsonConfig(component.mongoFilter, {}, context);
        const llmFilter = this.renderTemplate(llmQuery?.filter || {}, context);
        const filter = this.applyMongoDateRange(llmMode === 'full' && llmQuery?.filter ? this.mergeMongoFilter({}, llmFilter) : this.mergeMongoFilter(manualFilter, llmFilter), dateComponent, context);
        const projection = this.parseTemplatedJsonConfig(llmQuery?.projection || component.mongoProjection, {}, context);
        const sort = this.normalizeMongoSort(this.parseTemplatedJsonConfig(llmQuery?.sort || component.mongoSort, {}, context));
        const pipeline = this.parseTemplatedJsonConfig(llmQuery?.pipeline || component.mongoPipeline, [], context);
        const { limit, page, skip, maxPages, paginationMode } = pagination;
        const hasLlmDocument = llmMode === 'full' && (llmQuery?.document !== undefined || llmQuery?.documents !== undefined);
        const documentSource = hasLlmDocument
            ? (operation === 'insertMany' && llmQuery?.documents !== undefined ? llmQuery.documents : llmQuery.document ?? llmQuery.documents)
            : component.mongoDocument;
        const updateSource = llmMode === 'full' && llmQuery?.update !== undefined ? llmQuery.update : component.mongoUpdate;
        const rawDocument = this.parseTemplatedJsonConfig(documentSource, {}, context);
        const rawUpdate = this.parseTemplatedJsonConfig(updateSource, {}, context);
        const documentCandidate = Array.isArray(rawDocument) ? rawDocument[0] : rawDocument;
        const document = documentCandidate && typeof documentCandidate === 'object' && !Array.isArray(documentCandidate) && Object.keys(documentCandidate).length
            ? documentCandidate
            : this.createAnalyticsDocument(step, context);
        if (operation === 'insertOne') {
            const payload = { ...document, createdAt: document.createdAt || new Date() };
            const result = await collection.insertOne(payload);
            return this.toPlain({ operation, insertedId: result.insertedId, acknowledged: result.acknowledged, document: payload });
        }
        if (operation === 'insertMany') {
            const documents = Array.isArray(rawDocument) && rawDocument.length ? rawDocument : [document];
            const payload = documents.slice(0, limit).map((item) => {
                const base = item && typeof item === 'object' && !Array.isArray(item) ? item : { value: item };
                return { ...base, createdAt: base.createdAt || new Date() };
            });
            const result = await collection.insertMany(payload);
            return this.toPlain({ operation, insertedCount: result.insertedCount, insertedIds: result.insertedIds });
        }
        if (operation === 'find') {
            const documents = [];
            let currentSkip = skip;
            let pagesFetched = 0;
            let hasMore = false;
            do {
                const batch = await collection.find(filter, { projection }).sort(sort).skip(currentSkip).limit(limit + 1).toArray();
                hasMore = batch.length > limit;
                documents.push(...batch.slice(0, limit));
                pagesFetched += 1;
                currentSkip += limit;
            } while (paginationMode === 'all' && hasMore && pagesFetched < maxPages);
            return this.toPlain({
                operation,
                count: documents.length,
                documents,
                pagination: {
                    mode: paginationMode,
                    page,
                    limit,
                    skip,
                    pagesFetched,
                    hasMore,
                    nextPage: hasMore ? page + pagesFetched : null,
                    nextSkip: hasMore ? currentSkip : null,
                    maxPages: paginationMode === 'all' ? maxPages : 1,
                },
                generatedByLlm: component.mongoUseLlmFilter === true,
            });
        }
        if (operation === 'findOne') {
            const doc = await collection.findOne(filter, { projection, sort });
            return this.toPlain({ operation, document: doc });
        }
        if (operation === 'count') {
            const total = await collection.countDocuments(filter);
            return this.toPlain({ operation, total });
        }
        if (operation === 'aggregate') {
            const stages = Array.isArray(pipeline) ? pipeline : [];
            const matchStages = this.hasMongoFilter(filter) ? [{ $match: filter }] : [];
            const data = [];
            let currentSkip = skip;
            let pagesFetched = 0;
            let hasMore = false;
            do {
                const batch = await collection.aggregate([...matchStages, ...stages, { $skip: currentSkip }, { $limit: limit + 1 }]).toArray();
                hasMore = batch.length > limit;
                data.push(...batch.slice(0, limit));
                pagesFetched += 1;
                currentSkip += limit;
            } while (paginationMode === 'all' && hasMore && pagesFetched < maxPages);
            return this.toPlain({
                operation,
                count: data.length,
                data,
                pagination: {
                    mode: paginationMode,
                    page,
                    limit,
                    skip,
                    pagesFetched,
                    hasMore,
                    nextPage: hasMore ? page + pagesFetched : null,
                    nextSkip: hasMore ? currentSkip : null,
                    maxPages: paginationMode === 'all' ? maxPages : 1,
                },
                generatedByLlm: component.mongoUseLlmFilter === true,
            });
        }
        if (operation === 'deleteOne') {
            const result = await collection.deleteOne(filter);
            return this.toPlain({ operation, deletedCount: result.deletedCount, acknowledged: result.acknowledged });
        }
        if (operation === 'deleteMany') {
            const result = await collection.deleteMany(filter);
            return this.toPlain({ operation, deletedCount: result.deletedCount, acknowledged: result.acknowledged });
        }
        const update = this.normalizeMongoUpdate(rawUpdate);
        const options = operation === 'upsertOne' ? { upsert: true } : {};
        const result = operation === 'updateMany'
            ? await collection.updateMany(filter, update)
            : await collection.updateOne(filter, update, options);
        return this.toPlain({
            operation,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            upsertedId: result.upsertedId,
            acknowledged: result.acknowledged,
        });
    }
    resolveContextPathValue(pathExpression, context) {
        const raw = String(pathExpression || '').trim();
        if (!raw)
            return undefined;
        if (raw.startsWith('context.')) {
            return this.getByPath(context, raw.replace(/^context\./, ''));
        }
        if (raw.startsWith('slots.')) {
            return this.getByPath(context.slots || {}, raw.replace(/^slots\./, ''));
        }
        return this.getByPath(context.slots || {}, raw);
    }
    normalizeRagDocuments(value, sourceSlot = '') {
        const source = Array.isArray(value)
            ? value
            : typeof value === 'string'
                ? [value]
                : Array.isArray(value?.results)
                    ? value.results
                    : Array.isArray(value?.documents)
                        ? value.documents
                        : Array.isArray(value?.files)
                            ? value.files
                            : [];
        return source
            .map((item, index) => {
            if (typeof item === 'string') {
                const text = item.trim();
                if (!text)
                    return null;
                return {
                    text,
                    embeddingName: sourceSlot ? `${sourceSlot}_${index + 1}` : `doc_${index + 1}`,
                    extraFields: sourceSlot ? { sourceSlot } : {},
                };
            }
            if (!this.isPlainObject(item))
                return null;
            const text = String(item.text ?? item.content ?? item.pageContent ?? '').trim();
            if (!text)
                return null;
            const metadata = this.isPlainObject(item.metadata) ? item.metadata : {};
            const extraFields = this.isPlainObject(item.extraFields) ? item.extraFields : {};
            const title = String(item.embeddingName ||
                item.title ||
                item.filename ||
                metadata.title ||
                metadata.filename ||
                extraFields.title ||
                extraFields.filename ||
                (sourceSlot ? `${sourceSlot}_${index + 1}` : `doc_${index + 1}`));
            return {
                ...item,
                text,
                embeddingName: title,
                extraFields: {
                    ...extraFields,
                    ...metadata,
                    title,
                    sourceSlot: sourceSlot || extraFields.sourceSlot || metadata.sourceSlot,
                },
            };
        })
            .filter(Boolean);
    }
    responseSlotForStep(step) {
        if (!step)
            return '';
        if (step.type === 'input')
            return step.responseName || 'input';
        if (step.type === 'api')
            return step.api?.responseName || step.responseName || 'api';
        if (step.type === 'condition')
            return step.responseName || step.title || 'condition';
        if (step.type !== 'component')
            return step.responseName || '';
        const defaults = {
            cron: 'cron',
            debug: 'debug',
            webhook: 'webhook',
            context: 'context',
            files: 'arquivos',
            agentPlan: 'agentPlan',
            approval: 'aprovacao',
            mcp: 'mcp',
            mongodb: 'mongo',
            milvus: 'milvus',
            azureSearch: 'azureSearch',
            azureBlob: 'azureBlob',
            openaiGen: 'openai',
            azureOpenAI: 'azureOpenAI',
            loop: 'loop',
            flowRouter: 'flowRouter',
            dashboard: 'dashboard',
            rag: 'rag',
        };
        return step.component?.responseName || step.responseName || defaults[String(step.component?.type || '')] || '';
    }
    connectedInputsForStep(step, config, context) {
        const stepById = new Map((config.steps || []).map((item) => [item.id, item]));
        return (config.edges || [])
            .filter((edge) => edge.target === step.id && !this.isManifestVisualEdge(edge, config))
            .map((edge) => {
            const sourceStep = stepById.get(edge.source);
            const responseName = this.responseSlotForStep(sourceStep);
            const payload = responseName ? context?.slots?.[responseName] : undefined;
            if (payload === undefined)
                return null;
            return {
                edgeId: edge.id,
                sourceStepId: edge.source,
                sourceTitle: sourceStep?.title || edge.source,
                responseName,
                payload,
            };
        })
            .filter(Boolean);
    }
    withConnectedInputs(context, step, config) {
        const connectedInputs = this.connectedInputsForStep(step, config, context);
        if (!connectedInputs.length)
            return context;
        const connectedInputsBySlot = {};
        connectedInputs.forEach((entry) => {
            const current = connectedInputsBySlot[entry.responseName];
            connectedInputsBySlot[entry.responseName] = current === undefined
                ? entry.payload
                : Array.isArray(current)
                    ? [...current, entry.payload]
                    : [current, entry.payload];
        });
        return {
            ...context,
            connectedInput: connectedInputs.length === 1 ? connectedInputs[0].payload : connectedInputsBySlot,
            connectedInputs,
            connectedInputsBySlot,
        };
    }
    connectedInputsContextText(step, config, context) {
        const inputs = this.connectedInputsForStep(step, config, context);
        if (!inputs.length)
            return '';
        return [
            '# Entradas recebidas dos nos conectados',
            'Use estes payloads como contexto automatico. Configuracoes explicitas do no podem complementar ou sobrescrever esta entrada.',
            this.limitText(this.safeJsonStringify(inputs), 20000),
        ].join('\n');
    }
    dedupeRagDocuments(documents) {
        const seen = new Set();
        return documents.filter((doc) => {
            const key = String(doc?.extraFields?.id || doc?.metadata?.id || doc?.id || `${doc?.embeddingName || ''}:${doc?.text || ''}`);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    collectFileContextDocuments(context) {
        const slots = this.isPlainObject(context?.slots) ? context.slots : {};
        const documents = [];
        Object.entries(slots).forEach(([slotName, value]) => {
            if (!this.isPlainObject(value))
                return;
            const looksLikeFilesContext = Array.isArray(value.documents) ||
                Array.isArray(value.files) ||
                value.mode === 'context' ||
                value.sourceMode === 'upload' ||
                value.sourceMode === 'url';
            if (!looksLikeFilesContext)
                return;
            documents.push(...this.normalizeRagDocuments(value, slotName));
        });
        return this.dedupeRagDocuments(documents);
    }
    collectConnectedRagDocuments(step, config, context) {
        return this.dedupeRagDocuments(this.connectedInputsForStep(step, config, context)
            .flatMap((input) => this.normalizeRagDocuments(input.payload, input.responseName)));
    }
    resolveRagDocumentsForComponent(component, context, step, config) {
        if (component.ragDocsPath) {
            const explicitDocs = this.normalizeRagDocuments(this.resolveContextPathValue(component.ragDocsPath, context));
            return explicitDocs.length ? explicitDocs : undefined;
        }
        const connectedDocs = step && config ? this.collectConnectedRagDocuments(step, config, context) : [];
        if (connectedDocs.length)
            return connectedDocs;
        const fileDocs = this.collectFileContextDocuments(context);
        return fileDocs.length ? fileDocs : undefined;
    }
    resolveLoopSourceArray(step, context) {
        const component = step.component;
        const source = this.resolveContextPathValue(component.loopSourcePath || 'context.slots.mongo.documents', context);
        return Array.isArray(source)
            ? source
            : Array.isArray(source?.documents)
                ? source.documents
                : Array.isArray(source?.data)
                    ? source.data
                    : Array.isArray(source?.items)
                        ? source.items
                        : [];
    }
    setOrDeleteSlot(slots, key, value, hadValue) {
        if (hadValue) {
            slots[key] = value;
            return;
        }
        delete slots[key];
    }
    async getLoopBodyTargets(step, config, context, trace) {
        return (await this.getOutgoingAsync(step.id, config, context, trace)).map((edge) => edge.target);
    }
    async runBranchTargets(targets, config, context, messages, trace, options) {
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        const stopStepIds = options?.stopStepIds || new Set();
        const completed = new Set();
        const queue = targets
            .filter((target) => !stopStepIds.has(target))
            .map((stepId) => ({ stepId, readyAt: 0, delayMs: 0 }));
        const errors = [];
        let waitingInput = '';
        let ended = false;
        let safety = 0;
        const maxSteps = options?.maxSteps || 80;
        const maxStepVisits = this.limitNumber(this.configService.get('CANVAS_FLOW_MAX_STEP_VISITS') || 10, 100, 1, 1000);
        const visitCountByStep = new Map();
        while (queue.length && safety < maxSteps) {
            const nowMs = Date.now();
            const nextReadyAt = Math.min(...queue.map((item) => item.readyAt || 0));
            if (nextReadyAt > nowMs) {
                await this.sleep(nextReadyAt - nowMs);
            }
            const readyAt = Date.now();
            const readyItems = queue.filter((item) => (item.readyAt || 0) <= readyAt);
            queue.splice(0, queue.length, ...queue.filter((item) => (item.readyAt || 0) > readyAt));
            const delayByStep = new Map();
            readyItems.forEach((item) => {
                delayByStep.set(item.stepId, Math.max(delayByStep.get(item.stepId) || 0, Number(item.delayMs || 0)));
            });
            const batch = this.sortStepIdsByExecutionOrder(Array.from(new Set(readyItems.map((item) => item.stepId))).filter((stepId) => {
                const step = stepById.get(stepId);
                return step
                    && !completed.has(step.id)
                    && !stopStepIds.has(step.id)
                    && (visitCountByStep.get(step.id) || 0) < maxStepVisits;
            }), config);
            if (!batch.length)
                continue;
            const { executable: executionBatch, deferred } = this.splitDeferredPassthroughMessages(batch, stepById);
            const deferredStepIds = new Set(deferred);
            const deferredQueueItems = readyItems
                .filter((item) => deferredStepIds.has(item.stepId))
                .map((item) => ({ stepId: item.stepId, readyAt: 0, delayMs: Number(item.delayMs || 0) }));
            if (!executionBatch.length) {
                queue.push(...deferredQueueItems);
                continue;
            }
            safety += executionBatch.length;
            const batchMessages = new Array(executionBatch.length);
            const settled = await this.allSettledLimited(executionBatch, this.maxParallelNodes(), async (stepId, index) => {
                const step = stepById.get(stepId);
                const stepMessages = [];
                batchMessages[index] = stepMessages;
                if (!step || completed.has(step.id)) {
                    return { step, result: { skipped: true }, durationMs: 0 };
                }
                visitCountByStep.set(step.id, (visitCountByStep.get(step.id) || 0) + 1);
                const stepStartedAt = Date.now();
                const result = await this.runStep(step, config, context, stepMessages, trace, {
                    messageDelayMs: delayByStep.get(stepId) || 0,
                    deferOnMessage: true,
                });
                return { step, result, durationMs: Date.now() - stepStartedAt };
            });
            const nextQueue = [];
            let pendingWaitPromptStep;
            settled.forEach((item, index) => {
                if (item.status === 'rejected') {
                    const step = stepById.get(executionBatch[index]);
                    const message = `Erro no node "${step?.title || executionBatch[index]}": ${this.getErrorMessage(item.reason)}`;
                    errors.push(message);
                    this.emitFlowMessage(messages, { role: 'system', text: message }, { onMessage: context.__onMessage });
                    trace.push({ stepId: step?.id || executionBatch[index], type: 'error', message });
                    return;
                }
                const { step, result, durationMs } = item.value;
                if (!step || result.skipped)
                    return;
                this.flushDeferredMessages(messages, batchMessages[index], context.__onMessage);
                trace.push({
                    stepId: step.id,
                    title: step.title || step.id,
                    type: 'stepTiming',
                    stepType: step.type,
                    componentType: step.component?.type,
                    durationMs,
                });
                if (result.completed)
                    completed.add(step.id);
                (result.resetCompleted || []).forEach((stepId) => completed.delete(stepId));
                if (result.waitingInput && !waitingInput)
                    waitingInput = result.waitingInput;
                if (result.ended)
                    ended = true;
                const outgoingDelayMs = Math.max(0, Number(result.outgoingDelayMs || 0));
                (result.outgoing || []).forEach((target) => {
                    const targetStep = stepById.get(target);
                    const targetAlreadyVisited = Boolean((visitCountByStep.get(target) || 0) > 0 || completed.has(target));
                    if (!stopStepIds.has(target)
                        && this.isUserInteractionWaitStep(targetStep)
                        && targetAlreadyVisited) {
                        if (!waitingInput)
                            waitingInput = target;
                        if (!pendingWaitPromptStep)
                            pendingWaitPromptStep = targetStep;
                        trace.push({
                            type: 'interactionWaitReentry',
                            sourceStepId: step.id,
                            targetStepId: target,
                            targetTitle: targetStep.title || target,
                            stepType: targetStep.type,
                            componentType: targetStep.component?.type,
                            reason: 'Nó que depende de interação do usuário foi revisitado depois que a entrada desta rodada já foi consumida. Aguardando a próxima interação.',
                        });
                        return;
                    }
                    if (!stopStepIds.has(target)
                        && this.shouldQueueRuntimeTarget(target, completed, stepById, visitCountByStep, maxStepVisits, trace, step.id)) {
                        nextQueue.push({ stepId: target, readyAt: outgoingDelayMs ? Date.now() + outgoingDelayMs : 0, delayMs: outgoingDelayMs });
                    }
                });
            });
            if (waitingInput && pendingWaitPromptStep) {
                this.emitUserInteractionWaitPrompt(pendingWaitPromptStep, context, messages, trace);
            }
            if (ended && !queue.length && !nextQueue.length)
                break;
            if (waitingInput) {
                queue.splice(0, queue.length);
                break;
            }
            queue.push(...nextQueue, ...deferredQueueItems);
        }
        const limitReached = safety >= maxSteps;
        if (limitReached) {
            const message = 'Loop For interrompeu um ramo pelo limite de etapas.';
            errors.push(message);
            this.emitFlowMessage(messages, { role: 'system', text: message }, { onMessage: context.__onMessage });
        }
        if (!waitingInput && !ended && !limitReached) {
            waitingInput = this.inferWaitingInputFromAssistantPrompt(context, messages, stepById, trace);
        }
        return {
            completedIds: Array.from(completed),
            errors,
            ended,
            limitReached,
            safety,
            waitingInput,
        };
    }
    async runLoopForComponent(step, config, context, messages, trace) {
        const component = step.component;
        const sourceArray = this.resolveLoopSourceArray(step, context);
        const maxIterations = this.limitNumber(component.loopMaxIterations ?? 100, 100, 1, 1000);
        const items = sourceArray.slice(0, maxIterations);
        const responseName = component.loopResponseName || component.responseName || step.responseName || 'loop';
        const itemName = component.loopItemResponseName || 'item';
        const indexName = component.loopIndexResponseName || 'loopIndex';
        const collectPath = String(component.loopCollectPath || '').trim();
        const hadItem = Object.prototype.hasOwnProperty.call(context.slots, itemName);
        const hadIndex = Object.prototype.hasOwnProperty.call(context.slots, indexName);
        const previousItem = context.slots[itemName];
        const previousIndex = context.slots[indexName];
        const result = {
            sourcePath: component.loopSourcePath || 'context.slots.mongo.documents',
            totalAvailable: sourceArray.length,
            maxIterations,
            executed: 0,
            hasMore: sourceArray.length > items.length,
            collectPath,
            iterations: [],
            waitingInput: '',
            ended: false,
        };
        context.slots[responseName] = result;
        try {
            for (let index = 0; index < items.length; index += 1) {
                const item = items[index];
                context.slots[itemName] = item;
                context.slots[indexName] = index;
                context.slots[`${responseName}Iteration`] = {
                    index,
                    item,
                    total: items.length,
                };
                const bodyTargets = await this.getLoopBodyTargets(step, config, context, trace);
                if (!bodyTargets.length) {
                    result.iterations.push({
                        index,
                        status: 'skipped',
                        reason: 'sem ligação de saída para executar o corpo do loop',
                    });
                    break;
                }
                const beforeMessages = messages.length;
                const branchResult = await this.runBranchTargets(bodyTargets, config, context, messages, trace, {
                    stopStepIds: new Set([step.id]),
                    maxSteps: 80,
                });
                const collected = collectPath ? this.resolveContextPathValue(collectPath, context) : undefined;
                result.executed += 1;
                result.iterations.push({
                    index,
                    status: branchResult.errors.length ? 'error' : 'ok',
                    messageCount: messages.length - beforeMessages,
                    completedSteps: branchResult.completedIds,
                    ...(collectPath ? { collected: this.cloneJson(collected) } : {}),
                    ...(branchResult.errors.length ? { errors: branchResult.errors.slice(0, 3) } : {}),
                });
                context.slots[responseName] = result;
                if (branchResult.waitingInput) {
                    result.waitingInput = branchResult.waitingInput;
                    break;
                }
                if (branchResult.ended) {
                    result.ended = true;
                    break;
                }
            }
        }
        finally {
            this.setOrDeleteSlot(context.slots, itemName, previousItem, hadItem);
            this.setOrDeleteSlot(context.slots, indexName, previousIndex, hadIndex);
            delete context.slots[`${responseName}Iteration`];
        }
        context.slots[responseName] = result;
        return this.toPlain(result);
    }
    evaluateLoopStopCondition(condition, context) {
        const raw = String(condition || '').trim();
        if (!raw)
            return false;
        return this.evaluateCondition(raw, context);
    }
    buildConditionFunctionBody(rawValue) {
        const raw = String(rawValue || '').trim();
        if (/^(return|const|let|var|if|for|while|do|switch|try|throw|function|class)\b/.test(raw)) {
            return raw;
        }
        return `return (${raw});`;
    }
    collectLoopRevisitTargets(startTargets, loopStepId, config) {
        const visited = new Set();
        const queue = [...startTargets];
        let safety = 0;
        while (queue.length && safety < 500) {
            safety += 1;
            const current = queue.shift();
            if (!current || current === loopStepId || visited.has(current))
                continue;
            visited.add(current);
            this.getOutgoing(current, config).forEach((edge) => {
                if (edge.target !== loopStepId && !visited.has(edge.target)) {
                    queue.push(edge.target);
                }
            });
        }
        return Array.from(visited);
    }
    async runCounterLoopComponent(step, config, context, trace) {
        const component = step.component;
        const responseName = component.loopResponseName || component.responseName || step.responseName || 'loop';
        const indexName = component.loopIndexResponseName || 'loopIndex';
        const maxIterations = this.limitNumber(component.loopMaxIterations ?? 3, 3, 1, 1000);
        const delaySeconds = this.limitDecimal(component.loopDelaySeconds ?? 0, 0, 0, 3600);
        const loopState = context.__loopState || (context.__loopState = {});
        const previousIteration = this.limitNumber(loopState[step.id]?.iteration ?? 0, 0, 0, 1000);
        const reachedMaxBeforeRun = previousIteration >= maxIterations;
        const iteration = reachedMaxBeforeRun ? previousIteration : previousIteration + 1;
        const partial = {
            iteration,
            index: Math.max(iteration - 1, 0),
            executedIterations: previousIteration,
            maxIterations,
            delaySeconds,
            remaining: Math.max(maxIterations - iteration, 0),
            shouldContinue: false,
            reachedMax: reachedMaxBeforeRun || iteration >= maxIterations,
            isLastIteration: !reachedMaxBeforeRun && iteration >= maxIterations,
            stopConditionMatched: false,
            stoppedBy: null,
        };
        context.slots[indexName] = iteration;
        context.slots[responseName] = partial;
        const stopCondition = String(component.loopStopCondition || '').trim();
        const stopConditionMatched = reachedMaxBeforeRun ? false : this.evaluateLoopStopCondition(stopCondition, context);
        const reachedMax = reachedMaxBeforeRun || iteration >= maxIterations;
        let shouldContinue = !reachedMaxBeforeRun && !stopConditionMatched;
        const baseResult = {
            ...partial,
            executedIterations: shouldContinue ? iteration : previousIteration,
            reachedMax,
            stopCondition: stopCondition || undefined,
            stopConditionMatched,
            shouldContinue,
            nextTargets: [],
            stoppedBy: stopConditionMatched ? 'condition' : reachedMaxBeforeRun ? 'maxIterations' : null,
        };
        context.slots[indexName] = iteration;
        context.slots[responseName] = baseResult;
        const outgoing = shouldContinue
            ? await this.outgoingTargets(step, config, context, trace)
            : await this.outgoingTargets(step, config, context, trace, { includeUnconditional: false });
        const missingBody = shouldContinue && outgoing.length === 0;
        if (missingBody) {
            shouldContinue = false;
        }
        const shouldDelay = shouldContinue && delaySeconds > 0;
        const result = {
            ...baseResult,
            shouldContinue,
            nextTargets: missingBody ? [] : outgoing,
            delaySeconds,
            delayed: shouldDelay,
            delayMs: shouldDelay ? Math.round(delaySeconds * 1000) : 0,
            stoppedBy: missingBody ? 'missingBody' : baseResult.stoppedBy,
            warning: missingBody ? 'Loop sem saida ativa para executar o corpo. Conecte a saida do Loop ao no que deve repetir.' : undefined,
        };
        context.slots[responseName] = result;
        if (shouldContinue) {
            loopState[step.id] = { iteration };
        }
        else {
            delete loopState[step.id];
        }
        return {
            result: this.toPlain(result),
            outgoing,
            outgoingDelayMs: shouldDelay ? result.delayMs : 0,
            resetCompleted: shouldContinue ? this.collectLoopRevisitTargets(outgoing, step.id, config) : [],
        };
    }
    async evaluateFlowRouterRule(rule, config, context) {
        const condition = String(rule.condition || '').trim();
        if (!condition) {
            return { matched: true, reason: 'Regra sem condição.', raw: null };
        }
        if (rule.conditionMode === 'llm') {
            return await this.evaluateLlmCondition({
                id: rule.id || 'flow-router-rule',
                source: '',
                target: '',
                condition,
                conditionMode: 'llm',
                conditionModel: rule.conditionModel,
                conditionTemperature: rule.conditionTemperature,
            }, config, context);
        }
        return {
            matched: this.evaluateCondition(condition, context),
            reason: '',
            raw: null,
        };
    }
    getFlowRouterRuleModel(rule, config) {
        return String(rule.conditionModel || config.model || '');
    }
    getFlowRouterRuleTemperature(rule) {
        return Math.max(0, Math.min(Number(rule.conditionTemperature ?? 0) || 0, 1));
    }
    sameFlowRouterLlmOptions(left, right, config) {
        return this.getFlowRouterRuleModel(left, config) === this.getFlowRouterRuleModel(right, config)
            && this.getFlowRouterRuleTemperature(left) === this.getFlowRouterRuleTemperature(right);
    }
    async evaluateFlowRouterLlmRules(rules, config, context) {
        const renderedRules = rules.map((rule, index) => ({
            id: rule.id || `rule_${index + 1}`,
            index: index + 1,
            label: rule.label || `Regra ${index + 1}`,
            targetAgentId: String(rule.targetAgentId || '').trim(),
            targetFlowId: String(rule.targetFlowId || '').trim(),
            instruction: this.renderTemplate(rule.condition || '', context),
        }));
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), this.getFlowRouterRuleModel(rules[0], config), context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce escolhe o destino de um roteador de fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        'Avalie as regras em ordem e escolha no maximo a primeira regra que combine com o contexto.',
                        'Formato obrigatorio: {"matchedRuleId": "id da regra ou vazio", "reason": "motivo curto em pt-BR", "evaluations": [{"id": "id", "matched": boolean, "reason": "motivo curto"}]}.',
                        'Use somente o contexto recebido. Nao invente dados.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        rules: renderedRules,
                        context: {
                            channel: context.channel,
                            conversationId: context.conversationId,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: this.getFlowRouterRuleTemperature(rules[0]),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        const evaluations = Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];
        const byId = new Map(evaluations
            .map((item) => [String(item?.id || '').trim(), item])
            .filter(([id]) => Boolean(id)));
        const matchedRuleId = String(parsed?.matchedRuleId || parsed?.selectedRuleId || parsed?.ruleId || '').trim();
        let selectedIndex = renderedRules.findIndex((rule) => rule.id === matchedRuleId);
        const rawIndex = Number(parsed?.matchedRuleIndex ?? parsed?.selectedRuleIndex ?? parsed?.index);
        if (selectedIndex < 0 && Number.isFinite(rawIndex)) {
            selectedIndex = rawIndex > 0 ? rawIndex - 1 : rawIndex;
        }
        if (selectedIndex < 0) {
            selectedIndex = renderedRules.findIndex((rule) => this.readBooleanDecision(byId.get(rule.id)?.matched));
        }
        const decisions = renderedRules.map((rule, index) => {
            const item = byId.get(rule.id);
            const matched = index === selectedIndex && selectedIndex >= 0;
            return {
                matched,
                reason: this.limitText(item?.reason || item?.motivo || (matched ? parsed?.reason || parsed?.motivo : ''), 500),
                raw: item || parsed,
            };
        });
        return { decisions, raw: parsed };
    }
    mergeContextSlots(context, slots) {
        if (!slots || typeof slots !== 'object' || Array.isArray(slots))
            return;
        Object.assign(context.slots, slots);
    }
    async runFlowRouterComponent(step, config, context, messages, trace, options) {
        const component = step.component;
        const responseName = component.flowRouterReasonResponseName || component.responseName || step.responseName || 'flowRouter';
        const rules = Array.isArray(component.flowRouterRules) ? component.flowRouterRules : [];
        const routePath = Array.isArray(context.routePath) ? context.routePath.map((id) => String(id)) : [];
        const startedAt = Date.now();
        let rulesMs = 0;
        let lookupMs = 0;
        let childRunMs = 0;
        const evaluatedRules = [];
        let selectedRule;
        let selectedDecision = null;
        for (let index = 0; index < rules.length; index += 1) {
            const rule = rules[index];
            const ruleStartedAt = Date.now();
            const targetFlowId = String(rule.targetFlowId || '').trim();
            if (!targetFlowId) {
                evaluatedRules.push({
                    id: rule.id,
                    label: rule.label,
                    targetAgentId: String(rule.targetAgentId || '').trim(),
                    targetFlowId,
                    mode: rule.conditionMode || 'js',
                    matched: false,
                    reason: 'Fluxo destino não configurado.',
                    durationMs: 0,
                });
                continue;
            }
            if (rule.conditionMode === 'llm' && String(rule.condition || '').trim()) {
                const llmRules = [rule];
                while (index + llmRules.length < rules.length
                    && rules[index + llmRules.length].conditionMode === 'llm'
                    && String(rules[index + llmRules.length].targetFlowId || '').trim()
                    && String(rules[index + llmRules.length].condition || '').trim()
                    && this.sameFlowRouterLlmOptions(rule, rules[index + llmRules.length], config)) {
                    llmRules.push(rules[index + llmRules.length]);
                }
                const batchStartedAt = Date.now();
                const batch = await this.evaluateFlowRouterLlmRules(llmRules, config, context).catch((error) => ({
                    decisions: llmRules.map(() => ({
                        matched: false,
                        reason: this.getErrorMessage(error),
                        raw: null,
                    })),
                    raw: null,
                }));
                const batchDurationMs = Date.now() - batchStartedAt;
                rulesMs += batchDurationMs;
                batch.decisions.forEach((decision, batchIndex) => {
                    const llmRule = llmRules[batchIndex];
                    evaluatedRules.push({
                        id: llmRule.id,
                        label: llmRule.label,
                        targetAgentId: String(llmRule.targetAgentId || '').trim(),
                        targetFlowId: String(llmRule.targetFlowId || '').trim(),
                        mode: 'llm',
                        matched: decision.matched,
                        reason: decision.reason || '',
                        durationMs: batchIndex === 0 ? batchDurationMs : 0,
                        batchDurationMs,
                        batchSize: llmRules.length,
                    });
                });
                const selectedIndex = batch.decisions.findIndex((decision) => decision.matched);
                if (selectedIndex >= 0) {
                    selectedRule = llmRules[selectedIndex];
                    selectedDecision = batch.decisions[selectedIndex];
                    break;
                }
                index += llmRules.length - 1;
                continue;
            }
            const decision = await this.evaluateFlowRouterRule(rule, config, context).catch((error) => ({
                matched: false,
                reason: this.getErrorMessage(error),
                raw: null,
            }));
            const ruleDurationMs = Date.now() - ruleStartedAt;
            rulesMs += ruleDurationMs;
            const evaluation = {
                id: rule.id,
                label: rule.label,
                targetAgentId: String(rule.targetAgentId || '').trim(),
                targetFlowId,
                mode: rule.conditionMode || 'js',
                matched: decision.matched,
                reason: decision.reason || '',
                durationMs: ruleDurationMs,
            };
            evaluatedRules.push(evaluation);
            if (decision.matched && targetFlowId) {
                selectedRule = rule;
                selectedDecision = decision;
                break;
            }
        }
        const fallbackAgentId = String(component.flowRouterFallbackAgentId || '').trim();
        const selectedRuleAgentId = String(selectedRule?.targetAgentId || '').trim();
        const requestedTargetAgentId = selectedRuleAgentId || fallbackAgentId || '';
        const fallbackFlowId = String(component.flowRouterFallbackFlowId || '').trim();
        const targetFlowId = String(selectedRule?.targetFlowId || fallbackFlowId || '').trim();
        const baseResult = {
            routed: false,
            targetAgentId: requestedTargetAgentId,
            targetFlowId,
            selectedRuleId: selectedRule?.id || '',
            selectedRuleLabel: selectedRule?.label || '',
            reason: selectedDecision?.reason || '',
            evaluatedRules,
        };
        const timings = () => ({
            durationMs: Date.now() - startedAt,
            timings: { rulesMs, lookupMs, childRunMs },
        });
        if (!targetFlowId) {
            const result = { ...baseResult, action: 'no-route', ...timings() };
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'flowRouter', result });
            return { completed: true, outgoing: [] };
        }
        if (targetFlowId === String(context.flowId || '')) {
            const result = { ...baseResult, action: 'blocked-current-flow', error: 'Roteador apontou para o fluxo atual.', ...timings() };
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'flowRouter', result });
            return { completed: true, outgoing: [] };
        }
        if (routePath.includes(targetFlowId)) {
            const result = {
                ...baseResult,
                action: 'blocked-cycle',
                error: 'Roteamento cíclico bloqueado.',
                routePath,
                ...timings(),
            };
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'flowRouter', result });
            return { completed: true, outgoing: [] };
        }
        if ((context.routeDepth || 0) >= 10) {
            const result = { ...baseResult, action: 'blocked-depth', error: 'Limite interno de roteamento entre fluxos atingido.', ...timings() };
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'flowRouter', result });
            return { completed: true, outgoing: [] };
        }
        const lookupStartedAt = Date.now();
        const targetFlow = await this.canvasFlowService.findOne(targetFlowId, context.organizationId);
        lookupMs = Date.now() - lookupStartedAt;
        const targetAgentId = String(targetFlow?.agentId || requestedTargetAgentId || context.agentId || '').trim();
        const sameAgentRoute = String(targetAgentId || '') === String(context.agentId || '');
        const childAgentRelease = sameAgentRoute && context.ignoreAgentRelease !== true
            ? context.agentRelease
            : undefined;
        const childStartedAt = Date.now();
        const childResult = await this.run({
            flowId: targetFlowId,
            flowName: targetFlow?.name || targetFlow?.config?.title || '',
            entryFlowId: context.entryFlowId || context.flowId || targetFlowId,
            agentId: targetAgentId,
            channel: context.channel,
            conversationId: context.conversationId,
            text: '',
            slots: {
                ...(context.slots || {}),
                userInput: '',
                routedFromInput: context.input || context.slots?.userInput || '',
                routedFromFlowId: context.flowId,
                routedFromFlowName: context.flowName,
            },
            routeDepth: (context.routeDepth || 0) + 1,
            routePath: [...routePath, targetFlowId],
            agentRelease: childAgentRelease,
            ignoreAgentRelease: context.ignoreAgentRelease === true,
            flowVersionMap: context.flowVersionMap,
            organizationId: context.organizationId,
            _oauthUserId: context.oauthUserId,
            _conversationOwnerId: context.conversationOwnerId,
            _langGraphRunId: `${context.langGraphRunId || 'run'}:route:${targetFlowId}`,
            skipWebhookListeners: true,
            traceMode: context.__traceMode,
            traceLimit: context.__traceLimit,
            traceCollectLimit: context.__traceCollectLimit,
        });
        childRunMs = Date.now() - childStartedAt;
        const childMessages = childResult.messages || [];
        messages.push(...childMessages);
        if (!options?.deferOnMessage && typeof context.__onMessage === 'function') {
            childMessages.forEach((message) => context.__onMessage(this.toPlain(message)));
        }
        this.mergeContextSlots(context, childResult.slots);
        if (childResult.memoryClearRequested === true || childResult.memoryCleared === true) {
            context.__clearConversationMemory = true;
        }
        const nextActiveFlowId = childResult.activeFlowId || targetFlowId;
        const result = {
            ...baseResult,
            routed: true,
            action: 'jump-active-flow',
            targetFlowName: targetFlow?.name || targetFlow?.config?.title || '',
            targetAgentId,
            activeFlowId: nextActiveFlowId,
            activeFlowName: childResult.activeFlowName || targetFlow?.name || targetFlow?.config?.title || '',
            currentStepId: childResult.currentStepId || '',
            ended: childResult.ended === true,
            messages: childResult.messages?.length || 0,
            ...timings(),
        };
        context.slots[responseName] = result;
        if (targetAgentId) {
            context.agentId = targetAgentId;
            context.slots.agentId = targetAgentId;
            context.slots.activeAgentId = targetAgentId;
        }
        context.slots.activeFlowId = nextActiveFlowId;
        trace.push({ stepId: step.id, type: 'flowRouter', result });
        trace.push(...(childResult.trace || []).map((item) => ({ ...item, routedByStepId: step.id })));
        return {
            completed: true,
            ended: childResult.ended === true,
            clearConversationMemory: childResult.memoryClearRequested === true || childResult.memoryCleared === true,
            waitingInput: childResult.currentStepId || undefined,
            outgoing: [],
            activeFlowId: nextActiveFlowId,
            activeFlowName: result.activeFlowName,
        };
    }
    buildTraceDashboard(title, mode, trace, context) {
        const events = (trace || []).map((item, index) => ({
            index,
            stepId: item.stepId,
            type: item.type || item.tool || 'step',
            status: item.message ? 'error' : 'ok',
            title: item.title || item.type || item.tool || item.stepId,
            at: item.timestamp || context.now,
        }));
        const errors = events.filter((event) => event.status === 'error');
        const apiCalls = events.filter((event) => event.type === 'api' || event.type === 'httpBatch');
        const byType = events.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
        }, {});
        return {
            title,
            mode,
            source: 'trace',
            cards: [
                { label: 'Etapas executadas', value: events.length },
                { label: 'Chamadas API', value: apiCalls.length },
                { label: 'Erros', value: errors.length },
                { label: 'Canal', value: context.channel },
            ],
            byType,
            funnel: events.map((event) => ({ stepId: event.stepId, label: event.title, status: event.status, total: 1 })),
            rows: events,
        };
    }
    isChartMode(mode) {
        return mode === 'bar' || mode === 'pie' || mode === 'timeseries';
    }
    toNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value === 'string') {
            const parsed = Number(value.replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (Array.isArray(value))
            return value.length;
        return null;
    }
    extractRowsForChart(data) {
        if (Array.isArray(data?.rows) && data.rows.length)
            return data.rows;
        if (Array.isArray(data?.data) && data.data.length)
            return data.data;
        if (Array.isArray(data?.result?.results) && data.result.results.length)
            return data.result.results;
        if (Array.isArray(data?.result?.data) && data.result.data.length)
            return data.result.data;
        if (Array.isArray(data?.cards)) {
            return data.cards.map((card) => ({ label: card.label, value: card.value }));
        }
        return [];
    }
    buildFallbackChart(data, mode) {
        const rows = this.extractRowsForChart(data).slice(0, 12);
        const labelKeys = ['label', 'name', 'stage', 'status', 'type', 'source', 'title', '_id', 'stepId'];
        const valueKeys = ['value', 'total', 'count', 'users', 'visits', 'quantity', 'quantidade', 'qtd'];
        const series = rows
            .map((row, index) => {
            const labelKey = labelKeys.find((key) => row?.[key] !== undefined)
                || Object.keys(row || {}).find((key) => typeof row?.[key] === 'string')
                || Object.keys(row || {})[0];
            const valueKey = valueKeys.find((key) => this.toNumber(row?.[key]) !== null)
                || Object.keys(row || {}).find((key) => this.toNumber(row?.[key]) !== null);
            return {
                label: String(row?.[labelKey] ?? `Item ${index + 1}`).slice(0, 40),
                value: this.toNumber(row?.[valueKey]) ?? 1,
            };
        })
            .filter((item) => item.label && Number.isFinite(item.value));
        return {
            type: mode === 'pie' ? 'pie' : mode === 'timeseries' ? 'line' : 'bar',
            title: data?.title || 'Grafico',
            series: series.length ? series : [{ label: 'Sem dados', value: 0 }],
            generatedBy: 'fallback',
        };
    }
    normalizeChartConfig(chart, fallback) {
        const rawSeries = Array.isArray(chart?.series)
            ? chart.series
            : Array.isArray(chart?.data)
                ? chart.data
                : [];
        const series = rawSeries
            .slice(0, 12)
            .map((item, index) => ({
            label: String(item?.label || item?.name || item?.title || `Item ${index + 1}`).slice(0, 40),
            value: this.toNumber(item?.value ?? item?.total ?? item?.count) ?? 0,
            ...(item?.color ? { color: String(item.color).slice(0, 20) } : {}),
        }))
            .filter((item) => item.label);
        return {
            type: ['bar', 'pie', 'line'].includes(chart?.type) ? chart.type : fallback.type,
            title: String(chart?.title || fallback.title || 'Grafico').slice(0, 80),
            series: series.length ? series : fallback.series,
            generatedBy: chart?.generatedBy || 'llm',
        };
    }
    async generateDashboardChart(data, component, config, context) {
        const fallback = this.buildFallbackChart(data, component.dashboardMode || 'bar');
        if (component.dashboardUseLlm === false)
            return fallback;
        const prompt = component.dashboardLlmPrompt || 'Monte um gráfico objetivo em pt-BR com labels curtos e valores numéricos.';
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), component.dashboardModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce monta configuracoes JSON para dashboards conversacionais.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"chart":{"type":"bar|pie|line","title":"string","series":[{"label":"string","value":number}]}}.',
                        'Use no maximo 12 itens e labels curtos em pt-BR.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        prompt,
                        desiredType: component.dashboardMode === 'pie' ? 'pie' : component.dashboardMode === 'timeseries' ? 'line' : 'bar',
                        source: component.dashboardSource,
                        cards: data?.cards || [],
                        rows: this.extractRowsForChart(data).slice(0, 50),
                        context: {
                            channel: context.channel,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: 0.2,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '');
        return this.normalizeChartConfig(parsed?.chart || parsed, fallback);
    }
    getReportsDir() {
        return process.env.AWS_LAMBDA_FUNCTION_NAME
            ? path.join(os.tmpdir(), 'canvas-flow-reports')
            : path.join(process.cwd(), 'tmp', 'canvas-flow-reports');
    }
    getReportFilePath(fileName) {
        const safeName = String(fileName || '');
        if (!/^[a-zA-Z0-9_.-]+\.pdf$/.test(safeName)) {
            throw new common_1.HttpException('Relatorio inválido.', common_1.HttpStatus.BAD_REQUEST);
        }
        return path.join(this.getReportsDir(), safeName);
    }
    getPublicBaseUrl() {
        return String(this.configService.get('CANVAS_FLOW_PUBLIC_URL')
            || this.configService.get('PUBLIC_API_URL')
            || this.configService.get('APP_URL')
            || `http://localhost:${this.configService.get('PORT') || 3333}`).replace(/\/$/, '');
    }
    getMediaProxySecret() {
        return String(this.configService.get('CANVAS_FLOW_MEDIA_PROXY_SECRET')
            || this.configService.get('CANVAS_FLOW_JWT_SECRET')
            || this.configService.get('CANVAS_FLOW_API_TOKEN')
            || 'canvas-flow-media-proxy-dev-secret');
    }
    getMediaProxyTtlSeconds() {
        const ttl = Number(this.configService.get('CANVAS_FLOW_MEDIA_PROXY_TTL_SECONDS') || 86400);
        return Number.isFinite(ttl) && ttl > 0 ? Math.min(Math.floor(ttl), 7 * 24 * 60 * 60) : 86400;
    }
    signWhatsappMediaProxy(flowId, mediaId, expiresAt) {
        return (0, crypto_1.createHmac)('sha256', this.getMediaProxySecret())
            .update(`${flowId}:${mediaId}:${expiresAt}`)
            .digest('hex');
    }
    assertWhatsappMediaProxySignature(flowId, mediaId, expiresAtRaw, signatureRaw) {
        const expiresAt = Number(expiresAtRaw);
        const signature = String(signatureRaw || '');
        if (!flowId || !mediaId || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !signature) {
            throw new common_1.HttpException('Link de midia expirado ou invalido.', common_1.HttpStatus.FORBIDDEN);
        }
        const expected = this.signWhatsappMediaProxy(flowId, mediaId, expiresAt);
        const expectedBuffer = Buffer.from(expected);
        const receivedBuffer = Buffer.from(signature);
        if (expectedBuffer.length !== receivedBuffer.length || !(0, crypto_1.timingSafeEqual)(expectedBuffer, receivedBuffer)) {
            throw new common_1.HttpException('Assinatura de midia invalida.', common_1.HttpStatus.FORBIDDEN);
        }
    }
    buildWhatsappMediaProxyUrl(flowId, mediaId) {
        const safeFlowId = String(flowId || '').trim();
        const safeMediaId = String(mediaId || '').trim();
        if (!safeFlowId || !safeMediaId)
            return '';
        const expiresAt = Math.floor(Date.now() / 1000) + this.getMediaProxyTtlSeconds();
        const signature = this.signWhatsappMediaProxy(safeFlowId, safeMediaId, expiresAt);
        return `${this.getPublicBaseUrl()}/api/canvas-flow/whatsapp-media/${encodeURIComponent(safeFlowId)}/${encodeURIComponent(safeMediaId)}?exp=${expiresAt}&sig=${signature}`;
    }
    normalizeDownloadFileName(value, fallback) {
        const raw = String(value || fallback || 'whatsapp-media').trim();
        const safe = raw.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');
        return safe || fallback || 'whatsapp-media';
    }
    async downloadWhatsappMedia(flowId, mediaId, expiresAt, signature) {
        const safeFlowId = String(flowId || '').trim();
        const safeMediaId = String(mediaId || '').trim();
        this.assertWhatsappMediaProxySignature(safeFlowId, safeMediaId, expiresAt, signature);
        const flowRecord = await this.canvasFlowService.findOne(safeFlowId);
        const config = flowRecord?.config;
        const accessToken = String(config?.whatsapp?.accessToken || '').trim();
        if (!accessToken) {
            throw new common_1.HttpException('Token do WhatsApp nao configurado para baixar a midia.', common_1.HttpStatus.BAD_REQUEST);
        }
        const resolved = await this.resolveMetaMediaUrl(safeMediaId, config);
        if (!resolved?.url) {
            throw new common_1.HttpException('Midia do WhatsApp nao encontrada ou expirada.', common_1.HttpStatus.NOT_FOUND);
        }
        const response = await fetch(resolved.url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            throw new common_1.HttpException('Falha ao baixar midia do WhatsApp.', response.status || common_1.HttpStatus.BAD_GATEWAY);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get('content-type') || resolved.mimeType || 'application/octet-stream';
        const extension = mimeType.includes('png') ? '.png' : mimeType.includes('pdf') ? '.pdf' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '';
        const fileName = this.normalizeDownloadFileName(resolved.fileName, `${safeMediaId}${extension}`);
        return { buffer, mimeType, fileName };
    }
    formatPdfValue(value) {
        if (value === undefined || value === null)
            return '';
        if (typeof value === 'object')
            return JSON.stringify(value);
        return String(value);
    }
    drawDashboardRows(doc, rows) {
        if (!Array.isArray(rows) || !rows.length)
            return;
        const columns = Array.from(new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row || {})))).slice(0, 5);
        if (!columns.length)
            return;
        doc.moveDown(1);
        doc.fontSize(13).fillColor('#111827').text('Tabela de dados', { continued: false });
        doc.moveDown(0.4);
        doc.fontSize(8).fillColor('#4b5563');
        doc.text(columns.join(' | '));
        doc.moveDown(0.2);
        doc.moveTo(doc.x, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').stroke();
        doc.moveDown(0.4);
        rows.slice(0, 20).forEach((row) => {
            const line = columns
                .map((column) => this.formatPdfValue(row?.[column]).replace(/\s+/g, ' ').slice(0, 42))
                .join(' | ');
            doc.fillColor('#111827').text(line || '-', { width: 515 });
        });
    }
    async createDashboardPdf(data, showTable) {
        const reportsDir = this.getReportsDir();
        await fs.promises.mkdir(reportsDir, { recursive: true });
        const fileName = `dashboard-${Date.now()}-${(0, crypto_1.randomUUID)().slice(0, 8)}.pdf`;
        const filePath = path.join(reportsDir, fileName);
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(18).fillColor('#111827').text(String(data?.title || 'Dashboard'), { width: 515 });
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#6b7280').text(`${String(data?.source || 'fonte')} / ${String(data?.mode || 'dashboard')} - ${new Date().toLocaleString('pt-BR')}`);
        doc.moveDown(1);
        if (Array.isArray(data?.cards) && data.cards.length) {
            doc.fontSize(13).fillColor('#111827').text('Resumo');
            doc.moveDown(0.4);
            data.cards.slice(0, 8).forEach((card) => {
                doc.fontSize(10).fillColor('#374151').text(`${card.label || 'Metrica'}: `, { continued: true });
                doc.fontSize(12).fillColor('#111827').text(this.formatPdfValue(card.value));
            });
        }
        if (data?.chart?.series?.length) {
            doc.moveDown(1);
            doc.fontSize(13).fillColor('#111827').text(String(data.chart.title || 'Grafico'));
            doc.moveDown(0.4);
            const maxValue = Math.max(...data.chart.series.map((item) => Number(item.value) || 0), 1);
            data.chart.series.slice(0, 12).forEach((item) => {
                const value = Number(item.value) || 0;
                const width = Math.max(6, (value / maxValue) * 220);
                const y = doc.y + 3;
                doc.fontSize(9).fillColor('#374151').text(String(item.label || '-').slice(0, 34), 40, doc.y, { width: 150 });
                doc.rect(200, y, width, 8).fill('#2563eb');
                doc.fillColor('#111827').text(String(value), 430, y - 2, { width: 60 });
                doc.moveDown(0.5);
            });
        }
        if (showTable) {
            this.drawDashboardRows(doc, data?.rows || []);
        }
        doc.end();
        await new Promise((resolve, reject) => {
            stream.on('finish', () => resolve());
            stream.on('error', reject);
        });
        return {
            fileName,
            url: `${this.getPublicBaseUrl()}/api/canvas-flow/reports/${fileName}`,
        };
    }
    async runDashboardComponent(step, config, context, trace) {
        const component = step.component;
        const source = component.dashboardSource || 'trace';
        const mode = component.dashboardMode || 'summary';
        const title = component.dashboardTitle || step.title || 'Dashboard';
        let data;
        if (source === 'trace') {
            data = this.buildTraceDashboard(title, mode, trace, context);
        }
        else if (source === 'mongodb') {
            const collection = await this.getMongoCollection(component.dashboardCollectionName || component.mongoCollectionName || 'flow_events');
            const pipeline = this.parseTemplatedJsonConfig(component.dashboardPipeline || component.mongoPipeline, [], context);
            const limit = this.limitNumber(component.mongoLimit, 100, 1, 500);
            const rows = Array.isArray(pipeline) && pipeline.length
                ? await collection.aggregate(pipeline).limit(limit).toArray()
                : await collection.find({}, {}).sort({ createdAt: -1 }).limit(limit).toArray();
            data = {
                title,
                mode,
                source,
                collection: collection.collectionName,
                rows: this.toPlain(rows),
                cards: [
                    { label: 'Registros', value: rows.length },
                    { label: 'Fonte', value: collection.collectionName },
                ],
            };
        }
        else if (source === 'api') {
            const requests = this.parseTemplatedJsonConfig(component.dashboardApiRequests, [], context);
            const result = await this.httpBatchService.execute(Array.isArray(requests) ? requests : [], context);
            data = { title, mode, source, result };
        }
        else {
            const query = this.renderTemplate(component.dashboardQueryTemplate || component.queryTemplate || '{{context.slots.userInput}}', context);
            const ragAgentId = this.resolveRagAgentId(component, context);
            const result = await this.ragService.searchHybrid(query, component.collectionName, ragAgentId, {
                k: component.dashboardK ?? component.k ?? 10,
                provider: component.ragProvider,
                llmProvider: component.ragLlmProvider && component.ragLlmProvider !== 'auto' ? component.ragLlmProvider : config.llmProvider,
                embeddingProvider: component.ragEmbeddingProvider,
                embeddingModel: component.ragEmbeddingModel,
                searchProvider: component.ragSearchProvider,
                storageProvider: component.ragStorageProvider,
                filterExpr: this.renderTemplate(component.dashboardFilterExpr || component.filterExpr, context),
                extraFieldsFilter: this.buildActiveExtraFieldsFilter(component, context),
                order: component.order,
                extraFieldsFilterOrderBy: component.extraFieldsFilterOrderBy,
                metadataOrderScanPageSize: component.metadataOrderScanPageSize,
                metadataOrderMaxScan: component.metadataOrderMaxScan,
                useHybrid: component.useHybrid,
                denseWeight: component.denseWeight,
                sparseWeight: component.sparseWeight,
                candidateMultiplier: component.candidateMultiplier,
                candidateTopK: component.candidateTopK,
                denseEfSearch: component.denseEfSearch,
                sparseDropRatioSearch: component.sparseDropRatioSearch,
                fusionStrategy: component.fusionStrategy,
                rrfK: component.rrfK,
                relevanceBoost: component.relevanceBoost,
                maxChunksPerDocument: component.maxChunksPerDocument,
            });
            data = {
                title,
                mode,
                source,
                query,
                cards: [{ label: 'Documentos', value: result.results?.length || 0 }],
                rows: result.results || [],
            };
        }
        if (this.isChartMode(mode)) {
            data.chart = await this.generateDashboardChart(data, component, config, context).catch((error) => ({
                ...this.buildFallbackChart(data, mode),
                warning: this.getErrorMessage(error),
            }));
        }
        data.showTable = mode === 'table' || component.dashboardShowTable === true;
        if (context.channel === 'whatsapp') {
            const report = await this.createDashboardPdf(data, true).catch((error) => ({
                warning: this.getErrorMessage(error),
            }));
            data.whatsappDocument = report;
        }
        return {
            ...this.toPlain(data),
            ...(component.dashboardIncludeTrace === false ? {} : { trace: this.toPlain(trace) }),
            generatedAt: new Date().toISOString(),
        };
    }
    toExtraFieldsFilterObject(value) {
        const parsed = typeof value === 'string' ? this.parseJsonConfig(value, {}) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    evaluateExtraFieldsFilterRules(rules, context) {
        const source = typeof rules === 'string' ? this.parseJsonConfig(rules, []) : rules;
        if (!Array.isArray(source))
            return {};
        return source.reduce((acc, rule) => {
            if (!rule || typeof rule !== 'object' || Array.isArray(rule))
                return acc;
            const field = String(rule.field || rule.key || rule.name || '').trim();
            if (!field)
                return acc;
            const condition = String(rule.condition || rule.when || '').trim();
            if (condition) {
                const decision = this.evaluateConditionResult(condition, context);
                if (!decision.matched)
                    return acc;
            }
            const rawValue = Object.prototype.hasOwnProperty.call(rule, 'value') ? rule.value : rule.filterValue;
            const value = this.renderTemplate(rawValue, context);
            if (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))
                return acc;
            acc[field] = value;
            return acc;
        }, {});
    }
    buildActiveExtraFieldsFilter(component, context) {
        return {
            ...this.toExtraFieldsFilterObject(this.renderTemplate(component.extraFieldsFilter, context)),
            ...this.evaluateExtraFieldsFilterRules(component.extraFieldsFilterRules, context),
        };
    }
    resolveRagAgentId(component, context) {
        if (component.ragUseAgentFilter === false)
            return undefined;
        const raw = this.renderTemplate(component.ragAgentIdTemplate || '{{context.agentId}}', context);
        const value = String(raw || '').trim();
        if (!value || ['*', 'all', '__all__', 'global'].includes(value.toLowerCase()))
            return undefined;
        return value;
    }
    evaluateRagRuleExpression(rawValue, context) {
        if (rawValue === undefined || rawValue === null)
            return undefined;
        if (typeof rawValue !== 'string')
            return this.renderTemplate(rawValue, context);
        const raw = rawValue.trim();
        if (!raw)
            return undefined;
        const templated = this.renderTemplate(raw, context);
        if (typeof templated !== 'string')
            return templated;
        try {
            const body = this.buildConditionFunctionBody(templated);
            return new Function('context', 'slots', 'input', 'now', body)(context, context?.slots || {}, context?.input, context?.now);
        }
        catch {
            return this.parseTemplatedJsonConfig(rawValue, undefined, context);
        }
    }
    normalizeRagFilterObject(value) {
        if (value === undefined || value === null)
            return undefined;
        if (typeof value === 'string')
            return this.toExtraFieldsFilterObject(value);
        return this.isPlainObject(value) ? value : undefined;
    }
    normalizeRagFilterRounds(value) {
        if (value === undefined || value === null)
            return undefined;
        if (!Array.isArray(value))
            return undefined;
        return value.map((item) => (this.isPlainObject(item) ? item : {}));
    }
    normalizeRagRoundLimits(value) {
        if (value === undefined || value === null)
            return undefined;
        if (!Array.isArray(value))
            return undefined;
        return value.map((item) => {
            if (item === undefined || item === null || item === '')
                return null;
            const parsed = Number(item);
            return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
        });
    }
    normalizeRagOrderBy(value) {
        if (value === undefined || value === null)
            return undefined;
        const source = Array.isArray(value)
            ? value
            : typeof value === 'string'
                ? value.split(',').map((item) => item.trim())
                : [];
        const fields = source.map((item) => String(item || '').trim()).filter(Boolean);
        return fields.length ? fields : undefined;
    }
    normalizeRagPositiveInteger(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : undefined;
    }
    mergeExtraFieldsFilterObjects(base, override) {
        if (!override)
            return base;
        const merged = { ...base };
        Object.entries(override).forEach(([key, value]) => {
            if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
                delete merged[key];
            }
            else {
                merged[key] = value;
            }
        });
        return merged;
    }
    resolveRagConditionalOverrides(component, context) {
        const rules = Array.isArray(component.ragConditionalRules) ? component.ragConditionalRules : [];
        const overrides = {};
        rules.forEach((rule) => {
            if (!rule || typeof rule !== 'object')
                return;
            const condition = String(rule.condition || '').trim();
            if (condition) {
                const decision = this.evaluateConditionResult(condition, context);
                if (!decision.matched)
                    return;
            }
            if (String(rule.prompt || '').trim()) {
                overrides.prompt = String(this.renderTemplate(rule.prompt, context) || '');
            }
            if (String(rule.extraFieldsFilterExpression || '').trim()) {
                const value = this.normalizeRagFilterObject(this.evaluateRagRuleExpression(rule.extraFieldsFilterExpression, context));
                overrides.extraFieldsFilter = value;
            }
            if (String(rule.extraFieldsFilterPerRoundExpression || '').trim()) {
                const value = this.normalizeRagFilterRounds(this.evaluateRagRuleExpression(rule.extraFieldsFilterPerRoundExpression, context));
                overrides.extraFieldsFilterPerRound = value;
            }
            if (String(rule.extraFieldsFilterPerRoundLimitsExpression || '').trim()) {
                const value = this.normalizeRagRoundLimits(this.evaluateRagRuleExpression(rule.extraFieldsFilterPerRoundLimitsExpression, context));
                overrides.extraFieldsFilterPerRoundLimits = value;
            }
            if (typeof rule.roundStopFind === 'boolean')
                overrides.roundStopFind = rule.roundStopFind;
            if (typeof rule.roundMixHalf === 'boolean')
                overrides.roundMixHalf = rule.roundMixHalf;
            if (rule.order === 'asc' || rule.order === 'desc')
                overrides.order = rule.order;
            if (String(rule.extraFieldsFilterOrderByExpression || '').trim()) {
                const value = this.normalizeRagOrderBy(this.evaluateRagRuleExpression(rule.extraFieldsFilterOrderByExpression, context));
                overrides.extraFieldsFilterOrderBy = value;
            }
            const pageSize = this.normalizeRagPositiveInteger(rule.metadataOrderScanPageSize);
            if (pageSize !== undefined)
                overrides.metadataOrderScanPageSize = pageSize;
            const maxScan = this.normalizeRagPositiveInteger(rule.metadataOrderMaxScan);
            if (maxScan !== undefined)
                overrides.metadataOrderMaxScan = maxScan;
        });
        return overrides;
    }
    resolveRagPrompt(step, context, overrides) {
        const component = step.component;
        const prompt = overrides?.prompt ?? component.prompt ?? step.instruction;
        return this.renderTemplate(prompt || '', context);
    }
    buildRagSearchParams(component, context, forcedSearchProvider, config, conditionalOverrides) {
        const overrides = conditionalOverrides ?? this.resolveRagConditionalOverrides(component, context);
        const baseExtraFieldsFilter = this.buildActiveExtraFieldsFilter(component, context);
        const extraFieldsFilter = Object.prototype.hasOwnProperty.call(overrides, 'extraFieldsFilter')
            ? (overrides.extraFieldsFilter === undefined ? {} : this.mergeExtraFieldsFilterObjects(baseExtraFieldsFilter, overrides.extraFieldsFilter))
            : baseExtraFieldsFilter;
        const extraFieldsFilterPerRound = Object.prototype.hasOwnProperty.call(overrides, 'extraFieldsFilterPerRound')
            ? overrides.extraFieldsFilterPerRound
            : this.renderTemplate(component.extraFieldsFilterPerRound, context);
        const extraFieldsFilterPerRoundLimits = Object.prototype.hasOwnProperty.call(overrides, 'extraFieldsFilterPerRoundLimits')
            ? overrides.extraFieldsFilterPerRoundLimits
            : this.renderTemplate(component.extraFieldsFilterPerRoundLimits, context);
        return {
            k: component.k ?? 8,
            provider: forcedSearchProvider || component.ragProvider,
            llmProvider: component.ragLlmProvider && component.ragLlmProvider !== 'auto' ? component.ragLlmProvider : config?.llmProvider,
            embeddingProvider: component.ragEmbeddingProvider,
            embeddingModel: component.ragEmbeddingModel,
            searchProvider: forcedSearchProvider || component.ragSearchProvider,
            storageProvider: component.ragStorageProvider,
            ragAgentId: this.resolveRagAgentId(component, context),
            filterExpr: this.renderTemplate(component.filterExpr, context),
            extraFieldsFilter,
            extraFieldsFilterPerRound,
            extraFieldsFilterPerRoundLimits,
            roundStopFind: overrides.roundStopFind ?? component.roundStopFind,
            roundMixHalf: overrides.roundMixHalf ?? component.roundMixHalf,
            extraFieldsFilterOrderBy: Object.prototype.hasOwnProperty.call(overrides, 'extraFieldsFilterOrderBy')
                ? overrides.extraFieldsFilterOrderBy
                : component.extraFieldsFilterOrderBy,
            order: overrides.order ?? component.order,
            metadataOrderScanPageSize: overrides.metadataOrderScanPageSize ?? component.metadataOrderScanPageSize,
            metadataOrderMaxScan: overrides.metadataOrderMaxScan ?? component.metadataOrderMaxScan,
            useHybrid: component.useHybrid,
            denseWeight: component.denseWeight,
            sparseWeight: component.sparseWeight,
            candidateMultiplier: component.candidateMultiplier,
            candidateTopK: component.candidateTopK,
            denseEfSearch: component.denseEfSearch,
            sparseDropRatioSearch: component.sparseDropRatioSearch,
            fusionStrategy: component.fusionStrategy,
            rrfK: component.rrfK,
            relevanceBoost: component.relevanceBoost,
            maxChunksPerDocument: component.maxChunksPerDocument,
        };
    }
    async runRagSearchComponent(step, context, forcedSearchProvider, config) {
        const component = step.component;
        const query = this.renderTemplate(component.queryTemplate || step.instruction || '{{context.slots.userInput}}', context);
        return await this.ragService.searchHybrid(query, component.collectionName, this.resolveRagAgentId(component, context), this.buildRagSearchParams(component, context, forcedSearchProvider, config));
    }
    renderMilvusDocumentId(step, context) {
        const component = step.component;
        const id = String(this.renderTemplate(component.ragEmbeddingIdTemplate || '', context) || '').trim();
        if (!id) {
            throw new common_1.HttpException('Informe o ID ou embeddingId do documento Milvus.', common_1.HttpStatus.BAD_REQUEST);
        }
        return id;
    }
    async runMilvusComponent(step, context, config) {
        const component = step.component;
        const operation = component.ragOperation || 'search';
        if (operation === 'index') {
            return await this.runRagIndexComponent(step, context, 'milvus', 'none');
        }
        if (operation === 'list') {
            const query = String(this.renderTemplate(component.queryTemplate || '', context) || '').trim();
            return await this.ragService.listDocuments(component.collectionName, this.resolveRagAgentId(component, context), query, {
                limit: this.limitNumber(component.k, 50, 1, 1000),
            });
        }
        if (operation === 'get') {
            return await this.ragService.getDocument(component.collectionName, this.renderMilvusDocumentId(step, context), this.resolveRagAgentId(component, context));
        }
        if (operation === 'delete') {
            return await this.ragService.deleteDocument(component.collectionName, this.renderMilvusDocumentId(step, context), this.resolveRagAgentId(component, context));
        }
        return await this.runRagSearchComponent(step, context, 'milvus', config);
    }
    buildRagDocumentFromComponent(step, context) {
        const component = step.component;
        const rawText = component.ragTextPath
            ? this.resolveContextPathValue(component.ragTextPath, context)
            : this.renderTemplate(component.ragTextTemplate || step.instruction || '{{context.slots.userInput}}', context);
        const text = typeof rawText === 'string' ? rawText : JSON.stringify(rawText ?? '', null, 2);
        const extraFields = this.parseTemplatedJsonConfig(component.ragExtraFieldsJson || '{}', {}, context);
        const ragAgentId = this.resolveRagAgentId(component, context);
        return {
            text,
            agentId: ragAgentId || '',
            embeddingName: this.renderTemplate(component.ragEmbeddingNameTemplate || step.title || 'Documento', context),
            embeddingId: this.renderTemplate(component.ragEmbeddingIdTemplate || '', context) || undefined,
            extraFields: extraFields && typeof extraFields === 'object' && !Array.isArray(extraFields) ? extraFields : {},
        };
    }
    normalizeRagDocumentsFromPath(step, context) {
        const component = step.component;
        const sourcePath = component.ragDocumentsPath || component.ragDocsPath || '';
        if (!sourcePath)
            return null;
        const source = this.resolveContextPathValue(sourcePath, context);
        const rawItems = Array.isArray(source)
            ? source
            : Array.isArray(source?.documents)
                ? source.documents
                : Array.isArray(source?.chunks)
                    ? source.chunks
                    : Array.isArray(source?.blobs)
                        ? source.blobs
                        : Array.isArray(source?.results)
                            ? source.results
                            : source
                                ? [source]
                                : [];
        if (!rawItems.length)
            return [];
        const fallbackExtraFields = this.parseTemplatedJsonConfig(component.ragExtraFieldsJson || '{}', {}, context);
        const ragAgentId = this.resolveRagAgentId(component, context);
        return rawItems
            .map((item, index) => {
            const textValue = item?.text ?? item?.content ?? item?.pageContent ?? item?.chunk ?? item?.body ?? item?.document ?? item;
            const text = typeof textValue === 'string' ? textValue : JSON.stringify(textValue ?? '', null, 2);
            return {
                text,
                agentId: item?.agentId ?? ragAgentId ?? '',
                embeddingName: item?.embeddingName || item?.name || item?.title || this.renderTemplate(component.ragEmbeddingNameTemplate || step.title || 'Documento', context),
                embeddingId: item?.embeddingId || item?.documentId || item?.id || this.renderTemplate(component.ragEmbeddingIdTemplate || '', context) || undefined,
                extraFields: {
                    ...(fallbackExtraFields && typeof fallbackExtraFields === 'object' && !Array.isArray(fallbackExtraFields) ? fallbackExtraFields : {}),
                    ...(item?.extraFields && typeof item.extraFields === 'object' && !Array.isArray(item.extraFields) ? item.extraFields : {}),
                    ...(item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {}),
                    sourceIndex: index,
                    blobName: item?.blobName,
                    blobUrl: item?.blobUrl,
                },
            };
        })
            .filter((document) => String(document.text || '').trim());
    }
    async runRagIndexComponent(step, context, searchProvider, storageProvider) {
        const component = step.component;
        const documents = this.normalizeRagDocumentsFromPath(step, context) || [this.buildRagDocumentFromComponent(step, context)];
        return await this.ragService.addDocuments(component.collectionName, documents, {
            chunkSize: component.ragChunkSize ?? 512,
            chunkOverlap: component.ragChunkOverlap ?? 70,
            embeddingProvider: component.ragEmbeddingProvider,
            embeddingModel: component.ragEmbeddingModel,
            searchProvider,
            storageProvider: storageProvider || component.ragStorageProvider || 'none',
        });
    }
    async runAzureBlobComponent(step, context) {
        const component = step.component;
        if (component.azureBlobOperation === 'list') {
            const prefix = this.renderTemplate(component.collectionName || '', context);
            return await this.ragService.listAzureBlobDocuments(prefix, {
                limit: this.limitNumber(component.k, 100, 1, 1000),
                includeText: true,
                query: this.renderTemplate(component.azureBlobFilterText || '', context),
                contentType: this.renderTemplate(component.azureBlobFilterContentType || '', context),
                modifiedAfter: this.renderTemplate(component.azureBlobFilterModifiedAfter || '', context),
                modifiedBefore: this.renderTemplate(component.azureBlobFilterModifiedBefore || '', context),
                minBytes: component.azureBlobMinBytes,
                maxBytes: component.azureBlobMaxBytes,
            });
        }
        if (component.azureBlobOperation === 'read') {
            const blobName = this.renderTemplate(component.azureBlobNameTemplate || component.collectionName || '', context);
            return await this.ragService.readAzureBlobDocument(blobName);
        }
        if (component.azureBlobOperation === 'chunks' || component.azureBlobOperation === 'index') {
            const document = this.buildRagDocumentFromComponent(step, context);
            return await this.ragService.uploadChunksToAzureBlob({
                collectionName: component.collectionName || 'canvas-flow-chunks',
                text: document.text,
                embeddingName: document.embeddingName,
                embeddingId: document.embeddingId,
                agentId: document.agentId,
                extraFields: document.extraFields,
                chunkSize: component.ragChunkSize ?? 512,
                chunkOverlap: component.ragChunkOverlap ?? 70,
                embeddingProvider: component.ragEmbeddingProvider,
                embeddingModel: component.ragEmbeddingModel,
            });
        }
        const blobName = this.renderTemplate(component.azureBlobNameTemplate || `canvas-flow/${context.conversationId}/${Date.now()}.json`, context);
        const contentType = this.renderTemplate(component.azureBlobContentType || 'application/json', context);
        const pathValue = component.azureBlobContentPath
            ? this.resolveContextPathValue(component.azureBlobContentPath, context)
            : undefined;
        const content = pathValue !== undefined
            ? (typeof pathValue === 'string' ? pathValue : JSON.stringify(pathValue, null, 2))
            : this.renderTemplate(component.azureBlobContentTemplate || '{{context.slots}}', context);
        return await this.ragService.uploadTextToAzureBlob(blobName, content, contentType);
    }
    getGoogleDriveFileId(rawUrl) {
        try {
            const url = new URL(String(rawUrl || '').trim());
            const host = url.hostname.toLowerCase();
            const idParam = url.searchParams.get('id');
            if (idParam)
                return idParam;
            if (!/(^|\.)google\.com$/.test(host) && !/(^|\.)googleusercontent\.com$/.test(host))
                return '';
            const match = url.pathname.match(/\/d\/([^/]+)/) || url.pathname.match(/\/file\/d\/([^/]+)/);
            return match?.[1] || '';
        }
        catch {
            return '';
        }
    }
    normalizeFilesDocuments(files, maxTextChars = 0) {
        return (Array.isArray(files) ? files : [])
            .map((file, index) => {
            const rawText = String(file?.text ?? file?.fileContent ?? file?.content ?? '');
            const text = maxTextChars > 0 ? rawText.slice(0, maxTextChars) : rawText;
            const title = String(file?.title || file?.filename || file?.name || `arquivo-${index + 1}`).trim();
            return {
                id: String(file?.id || (0, crypto_1.randomUUID)()),
                title,
                filename: String(file?.filename || title),
                mimeType: String(file?.mimeType || file?.mimetype || ''),
                size: file?.size || undefined,
                sourceUrl: String(file?.sourceUrl || ''),
                ok: Boolean(text),
                strategy: String(file?.strategy || file?.source || ''),
                text,
                textLength: rawText.length,
                truncated: Boolean(file?.truncated) || (maxTextChars > 0 && rawText.length > maxTextChars),
                errors: Array.isArray(file?.errors) ? file.errors : [],
                documentId: String(file?.documentId || file?.id || ''),
                storage: String(file?.storage || ''),
                storageKey: String(file?.storageKey || file?.key || ''),
                downloadPath: String(file?.downloadPath || ''),
                structure: file?.structure && typeof file.structure === 'object' ? file.structure : {},
            };
        })
            .filter((file) => String(file.text || '').trim() || file.documentId);
    }
    async hydrateFilesDocuments(files, maxTextChars, context) {
        const normalized = this.normalizeFilesDocuments(files, maxTextChars);
        if (!this.documentsService)
            return normalized;
        return await Promise.all(normalized.map(async (file) => {
            if (file.text || !file.documentId)
                return file;
            const stored = await this.documentsService.getRecord(file.documentId, {
                organizationId: context.organizationId,
            }).catch(() => null);
            if (!stored)
                return file;
            return this.normalizeFilesDocuments([{ ...stored, ...file, text: stored.text || file.text }], maxTextChars)[0] || file;
        }));
    }
    parseFilesArtifactPayload(value) {
        const text = String(value || '').trim();
        const candidate = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
        try {
            const parsed = JSON.parse(candidate);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {
                    content: text,
                    replacements: {},
                    docxEdits: [],
                    xlsxEdits: [],
                    plan: null,
                    skill: '',
                };
            }
            const hasStructuredArtifactPayload = parsed.replacements || parsed.docxEdits || parsed.edits || parsed.xlsxEdits || parsed.plan;
            return {
                content: String(parsed.content ?? parsed.text ?? (hasStructuredArtifactPayload ? '' : text)),
                replacements: parsed.replacements && typeof parsed.replacements === 'object' && !Array.isArray(parsed.replacements)
                    ? parsed.replacements
                    : {},
                docxEdits: this.normalizeFilesDocxEdits(parsed.docxEdits || parsed.edits),
                xlsxEdits: this.normalizeFilesXlsxEdits(parsed.xlsxEdits),
                plan: this.normalizeFilesDocumentSkillPlan(parsed.plan || parsed.documentPlan || parsed.skillPlan),
                skill: this.limitText(parsed.skill || parsed.specialist || '', 80, ''),
            };
        }
        catch {
            const loose = this.parseLooseFilesArtifactPayload(candidate || text);
            if (loose)
                return loose;
            return {
                content: text,
                replacements: {},
                docxEdits: [],
                xlsxEdits: [],
                plan: null,
                skill: '',
            };
        }
    }
    parseLooseFilesArtifactPayload(value) {
        const text = String(value || '').trim();
        if (!/^\s*\{[\s\S]*"content"\s*:/.test(text))
            return null;
        const content = this.extractLooseJsonStringField(text, 'content');
        if (!String(content || '').trim())
            return null;
        const planText = this.extractLooseJsonObjectField(text, 'plan');
        let plan = null;
        if (planText) {
            try {
                plan = this.normalizeFilesDocumentSkillPlan(JSON.parse(planText));
            }
            catch {
                plan = null;
            }
        }
        return {
            content,
            replacements: {},
            docxEdits: [],
            xlsxEdits: [],
            plan,
            skill: /"skill"\s*:\s*"documents"/i.test(text) ? 'documents' : '',
        };
    }
    extractLooseJsonStringField(text, field) {
        const pattern = new RegExp(`"${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`);
        const match = pattern.exec(text);
        if (!match)
            return '';
        let cursor = match.index + match[0].length;
        let output = '';
        while (cursor < text.length) {
            const char = text[cursor];
            if (char === '\\') {
                const next = text[cursor + 1];
                if (next === 'n')
                    output += '\n';
                else if (next === 'r')
                    output += '\r';
                else if (next === 't')
                    output += '\t';
                else if (next === '"' || next === '\\' || next === '/')
                    output += next;
                else
                    output += next || '';
                cursor += 2;
                continue;
            }
            if (char === '"') {
                const rest = text.slice(cursor + 1);
                if (/^\s*(?:,\s*"[\w.-]+"\s*:|\})/.test(rest))
                    break;
            }
            output += char;
            cursor += 1;
        }
        return output.trim();
    }
    extractLooseJsonObjectField(text, field) {
        const pattern = new RegExp(`"${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*\\{`);
        const match = pattern.exec(text);
        if (!match)
            return '';
        let cursor = match.index + match[0].length - 1;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (; cursor < text.length; cursor += 1) {
            const char = text[cursor];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (char === '{')
                depth += 1;
            if (char === '}') {
                depth -= 1;
                if (depth === 0)
                    return text.slice(match.index + match[0].lastIndexOf('{'), cursor + 1);
            }
        }
        return '';
    }
    normalizeFilesDocumentSkillPlan(value) {
        if (!this.isPlainObject(value))
            return null;
        const normalizeList = (items, maxItems, maxLength) => (Array.isArray(items)
            ? items.slice(0, maxItems).map((item) => {
                if (typeof item === 'string')
                    return this.limitText(item, maxLength, '');
                if (this.isPlainObject(item)) {
                    return Object.fromEntries(Object.entries(item)
                        .slice(0, 12)
                        .map(([key, entry]) => [
                        this.limitText(key, 60, ''),
                        typeof entry === 'string' ? this.limitText(entry, maxLength, '') : entry,
                    ]));
                }
                return this.limitText(JSON.stringify(item ?? ''), maxLength, '');
            }).filter(Boolean)
            : []);
        return {
            goal: this.limitText(value.goal || value.objetivo || value.request, 500, ''),
            operation: this.limitText(value.operation || value.operacao, 40, ''),
            format: this.limitText(value.format || value.formato, 20, ''),
            documentType: this.limitText(value.documentType || value.tipoDocumento || value.tipo, 120, ''),
            audience: this.limitText(value.audience || value.publico || value.destinatario, 160, ''),
            strategy: this.limitText(value.strategy || value.estrategia, 700, ''),
            sourceUsage: normalizeList(value.sourceUsage || value.sources || value.fontes, 20, 500),
            sections: normalizeList(value.sections || value.secoes, 30, 500),
            tables: normalizeList(value.tables || value.tabelas, 20, 500),
            qualityChecklist: normalizeList(value.qualityChecklist || value.checklist || value.validations, 20, 300),
            warnings: normalizeList(value.warnings || value.alertas, 12, 300),
        };
    }
    normalizeFilesDocxEdits(value) {
        return (Array.isArray(value) ? value : [])
            .slice(0, 100)
            .map((edit) => {
            if (edit?.type === 'append_table_column') {
                return {
                    type: 'append_table_column',
                    tableIndex: Math.max(0, Math.floor(Number(edit.tableIndex || 0))),
                    allTables: edit.allTables === true,
                    header: this.limitText(edit.header || edit.name || '', 300, ''),
                    value: this.limitText(edit.value || '', 2000, ''),
                    values: Array.isArray(edit.values) ? edit.values.slice(0, 1000) : undefined,
                };
            }
            if (edit?.type === 'append_paragraph') {
                return {
                    type: 'append_paragraph',
                    text: this.limitText(edit.text || '', 10000, ''),
                };
            }
            return null;
        })
            .filter((edit) => Boolean(edit));
    }
    normalizeFilesXlsxValue(value) {
        if (typeof value === 'string')
            return this.limitText(value, 4000, '');
        if (typeof value === 'number' || typeof value === 'boolean' || value === null)
            return value;
        return this.limitText(JSON.stringify(value ?? ''), 4000, '');
    }
    normalizeFilesXlsxEdits(value) {
        return (Array.isArray(value) ? value : [])
            .slice(0, 1000)
            .map((edit) => {
            const valueType = ['text', 'number', 'duration'].includes(String(edit?.valueType || ''))
                ? edit.valueType
                : undefined;
            const common = {
                sheet: this.limitText(edit?.sheet || '', 200, ''),
                sheetIndex: Math.max(0, Math.floor(Number(edit?.sheetIndex || 0))),
                numberFormat: this.limitText(edit?.numberFormat || '', 100, ''),
                valueType,
            };
            if (edit?.type === 'set_cell') {
                return {
                    type: 'set_cell',
                    ...common,
                    cell: this.limitText(edit.cell || edit.address || '', 20, '').toUpperCase(),
                    value: this.normalizeFilesXlsxValue(edit.value),
                };
            }
            if (edit?.type === 'append_column') {
                const valuesByKey = edit.valuesByKey && typeof edit.valuesByKey === 'object' && !Array.isArray(edit.valuesByKey)
                    ? Object.fromEntries(Object.entries(edit.valuesByKey)
                        .slice(0, 1000)
                        .map(([key, item]) => [this.limitText(key, 500, ''), this.normalizeFilesXlsxValue(item)]))
                    : undefined;
                return {
                    type: 'append_column',
                    ...common,
                    header: this.limitText(edit.header || edit.name || '', 300, ''),
                    headerRow: Math.max(1, Math.floor(Number(edit.headerRow || 1))),
                    startRow: Math.max(2, Math.floor(Number(edit.startRow || 2))),
                    values: Array.isArray(edit.values) ? edit.values.slice(0, 1000).map((item) => this.normalizeFilesXlsxValue(item)) : undefined,
                    valuesByKey,
                    keyColumn: typeof edit.keyColumn === 'number'
                        ? Math.max(1, Math.floor(edit.keyColumn))
                        : this.limitText(edit.keyColumn || '', 300, ''),
                };
            }
            return null;
        })
            .filter((edit) => Boolean(edit));
    }
    filesDocxTableCount(files) {
        return Math.max(0, ...(files || []).map((file) => Array.isArray(file?.structure?.tables) ? file.structure.tables.length : 0));
    }
    inferFilesDocxEdits(instruction, files = []) {
        const text = String(instruction || '').trim();
        if (!text)
            return [];
        const header = text.match(/\bcoluna\b[\s\S]{0,100}?\b(?:chamada|nomeada|nome)\s+["']?([a-zA-Z0-9_-]+)["']?/i)?.[1];
        if (!header)
            return [];
        const value = text.match(/\bvalor\s+["']?([^"',.;\n]+)["']?/i)?.[1]?.trim() || '';
        const allTables = /\btodas?\s+as\s+tabelas\b/i.test(text);
        const tableNumberMatch = text.match(/\btabela\s+(\d+)\b/i);
        const tableCount = this.filesDocxTableCount(files);
        if (!allTables && !tableNumberMatch && tableCount > 1) {
            throw new common_1.HttpException(`O DOCX possui ${tableCount} tabelas. Informe qual deve ser alterada, por exemplo "adicione a coluna status com valor pendente na tabela 3", ou use "em todas as tabelas".`, common_1.HttpStatus.BAD_REQUEST);
        }
        const tableNumber = Number(tableNumberMatch?.[1] || 1);
        return [{
                type: 'append_table_column',
                tableIndex: Math.max(0, tableNumber - 1),
                allTables,
                header,
                value,
            }];
    }
    filesStructureContext(files) {
        return files
            .map((file, fileIndex) => {
            const tables = Array.isArray(file?.structure?.tables) ? file.structure.tables : [];
            const sheets = Array.isArray(file?.structure?.sheets) ? file.structure.sheets : [];
            if (tables.length) {
                return [
                    `Estrutura DOCX ${fileIndex + 1}: ${file.filename || file.title || 'arquivo'}`,
                    ...tables.slice(0, 30).map((table, tableIndex) => (`Tabela ${tableIndex + 1} (tableIndex=${tableIndex}): ${String(table || '').slice(0, 1500)}`)),
                ].join('\n');
            }
            if (sheets.length) {
                return [
                    `Estrutura XLSX ${fileIndex + 1}: ${file.filename || file.title || 'arquivo'}`,
                    ...sheets.slice(0, 40).map((sheet, sheetIndex) => [
                        `Aba ${sheetIndex + 1}: ${String(sheet?.name || `Planilha${sheetIndex + 1}`)}`,
                        ...(Array.isArray(sheet?.rows) ? sheet.rows : []).slice(0, 500).map((row, rowIndex) => {
                            const rowNumber = Math.max(1, Number(row?.rowNumber || rowIndex + 1));
                            const values = Array.isArray(row?.values) ? row.values : Array.isArray(row) ? row : [];
                            return `Linha ${rowNumber}: ${JSON.stringify(values).slice(0, 2000)}`;
                        }),
                    ].join('\n')),
                ].join('\n\n');
            }
            return '';
        })
            .filter(Boolean)
            .join('\n\n');
    }
    filesDocumentSkillEnabled(component, operation) {
        if (component.filesUseDocumentSkill === false)
            return false;
        return operation === 'generate' || operation === 'edit' || component.filesResultMode === 'llm';
    }
    filesDocumentSkillInventory(files, operation, format, templateDocumentIds) {
        return [
            '# Inventario para Docs Skill',
            `Operacao: ${operation}`,
            `Formato esperado: ${format}`,
            `Templates selecionados: ${templateDocumentIds.length ? templateDocumentIds.join(', ') : 'nenhum'}`,
            ...files.map((file, index) => {
                const documentId = String(file.documentId || file.id || '');
                const role = operation === 'edit' && templateDocumentIds.includes(documentId)
                    ? 'template'
                    : operation === 'edit'
                        ? 'referencia'
                        : 'fonte';
                const tables = Array.isArray(file?.structure?.tables) ? file.structure.tables.length : 0;
                const sheets = Array.isArray(file?.structure?.sheets) ? file.structure.sheets.length : 0;
                return [
                    `Arquivo ${index + 1}: ${file.filename || file.title || 'arquivo'}`,
                    `- papel: ${role}`,
                    `- documentId: ${documentId || '-'}`,
                    `- mimeType: ${file.mimeType || '-'}`,
                    `- caracteres extraidos: ${Number(file.textLength || String(file.text || '').length || 0)}`,
                    `- truncado: ${file.truncated ? 'sim' : 'nao'}`,
                    tables ? `- tabelas detectadas: ${tables}` : '',
                    sheets ? `- abas detectadas: ${sheets}` : '',
                ].filter(Boolean).join('\n');
            }),
        ].filter(Boolean).join('\n');
    }
    filesDocumentSkillPrompt(params) {
        const { operation, format, generationPrompt, customPrompt } = params;
        if (operation === 'read') {
            return [
                customPrompt || 'Voce e a Docs Skill do Canvas Flow: uma especialista em leitura, analise e sintese de documentos.',
                'Leia os arquivos conectados como um analista documental. Responda em pt-BR, com estrutura clara, destacando tabelas, riscos, lacunas e pontos acionaveis quando existirem.',
                'Se a extracao de algum arquivo estiver fraca, diga isso explicitamente e separe o que foi inferido do que foi encontrado no texto.',
            ].join('\n');
        }
        return [
            customPrompt || 'Voce e a Docs Skill do Canvas Flow: uma especialista em criar, editar e consolidar documentos profissionais a partir de arquivos.',
            `Objetivo do usuario/configuracao: ${generationPrompt || 'Crie uma nova versao conforme o pedido do usuario.'}`,
            `Operacao: ${operation}. Formato final esperado: ${format}.`,
            'Execute internamente este processo: 1) inventarie as fontes; 2) escolha estrategia de template, consolidacao ou edicao; 3) defina secoes e tabelas; 4) produza o conteudo final; 5) valide se o arquivo esta pronto para entrega.',
            'Retorne somente JSON valido no formato:',
            '{"skill":"documents","plan":{"goal":"...","operation":"generate|edit","format":"docx|pdf|xlsx|csv|json|html|md|txt","documentType":"...","audience":"...","strategy":"...","sourceUsage":[{"filename":"...","role":"template|referencia|fonte","confidence":"alta|media|baixa"}],"sections":[{"title":"...","purpose":"..."}],"tables":[{"title":"...","columns":["..."]}],"qualityChecklist":["..."],"warnings":["..."]},"content":"documento final em Markdown ou texto","replacements":{},"docxEdits":[],"xlsxEdits":[]}',
            ['docx', 'pdf'].includes(format)
                ? 'Para DOCX/PDF, o campo content deve ser um documento final em Markdown simples: # titulo, ## secoes, ### subsecoes, listas com "- " e tabelas Markdown. Use tabelas sempre que houver responsabilidades, riscos, cronograma, comparativos, valores, itens ou status.'
                : '',
            format === 'docx'
                ? 'Ao editar DOCX existente: se houver placeholders, preencha replacements. Se precisar alterar tabela existente sem placeholder, use docxEdits. Se for consolidar/criar novo, gere content completo.'
                : '',
            format === 'xlsx'
                ? 'Ao editar XLSX existente, preserve a planilha e use xlsxEdits. Para criar XLSX novo, content deve trazer uma ou mais tabelas Markdown com cabecalhos claros, ou CSV estruturado quando for uma tabela unica.'
                : '',
            format === 'html'
                ? 'Para HTML, entregue content em Markdown estruturado. O backend transformara isso em uma pagina HTML profissional com CSS, secoes e tabelas.'
                : '',
            format === 'pdf'
                ? 'Para PDF, nao inclua planejamento dentro de content, nao use linhas decorativas com ===== e nao duplique resumo/conteudo.'
                : '',
            'Nunca retorne uma resposta conversacional fora do JSON. Se faltar informacao, registre em plan.warnings e produza a melhor versao possivel com as fontes disponiveis.',
        ].filter(Boolean).join('\n');
    }
    filesArtifactQuality(operation, format, generated, files, skillEnabled) {
        const content = String(generated.content || '').trim();
        const lower = content.toLowerCase();
        const warnings = [];
        const checks = {
            hasContent: Boolean(content),
            hasPlan: !skillEnabled || Boolean(generated.plan),
            hasSourceFiles: files.length > 0,
            hasProfessionalStructure: !['docx', 'pdf'].includes(format) || /^#\s+/m.test(content) || generated.docxEdits.length > 0,
            hasTablesWhenPlanned: !['docx', 'pdf'].includes(format)
                || !Array.isArray(generated.plan?.tables)
                || generated.plan.tables.length === 0
                || /\|[^|\n]+\|[^|\n]+\|/.test(content)
                || generated.docxEdits.length > 0,
            hasNativeEdits: operation !== 'edit' || format !== 'xlsx' || generated.xlsxEdits.length > 0,
        };
        if (skillEnabled && !checks.hasPlan)
            warnings.push('A LLM nao retornou plan da Docs Skill; o artefato foi gerado com fallback.');
        if (['docx', 'pdf'].includes(format) && content && !checks.hasProfessionalStructure) {
            warnings.push('O conteudo nao trouxe heading Markdown; o documento pode ficar menos estruturado.');
        }
        if (!checks.hasTablesWhenPlanned) {
            warnings.push('A Docs Skill planejou tabelas, mas content nao trouxe tabela Markdown.');
        }
        if (content.length > 0 && content.length < 80 && ['docx', 'pdf'].includes(format)) {
            warnings.push('Conteudo curto para um documento profissional.');
        }
        const suspiciousRefusal = /^(desculpe|sinto muito|nao posso|não posso)\b/i.test(lower);
        if (suspiciousRefusal) {
            throw new common_1.HttpException('A LLM retornou uma recusa em vez do documento final. Revise a instrucao ou os arquivos enviados.', common_1.HttpStatus.BAD_REQUEST);
        }
        const passed = Object.values(checks).filter(Boolean).length;
        return {
            score: Math.round((passed / Math.max(1, Object.keys(checks).length)) * 100),
            checks,
            warnings,
        };
    }
    nativeEditableFilesFormat(file) {
        const extension = path.extname(String(file?.filename || file?.title || '')).slice(1).toLowerCase();
        const mimeType = String(file?.mimeType || '').toLowerCase();
        if (extension === 'docx' || mimeType.includes('wordprocessingml'))
            return 'docx';
        if (extension === 'xlsx' || mimeType.includes('spreadsheetml'))
            return 'xlsx';
        return '';
    }
    filesArtifactFormat(component, operation, file) {
        const nativeTemplateFormat = operation === 'edit' ? this.nativeEditableFilesFormat(file) : '';
        return String(nativeTemplateFormat || component.filesOutputFormat || 'docx').toLowerCase();
    }
    filesArtifactFilename(filename, format) {
        const extension = path.extname(filename);
        if (!extension)
            return `${filename}.${format}`;
        return extension.toLowerCase() === `.${format}`
            ? filename
            : `${filename.slice(0, -extension.length)}.${format}`;
    }
    assertFilesArtifactPayload(operation, format, generated, replacements) {
        const hasContent = Boolean(String(generated.content || '').trim());
        const hasReplacements = Object.keys(replacements || {}).length > 0;
        if (operation === 'edit' && format === 'xlsx') {
            if (!generated.xlsxEdits.length && !hasReplacements) {
                throw new common_1.HttpException('A LLM nao informou alteracoes aplicaveis ao XLSX. Tente novamente descrevendo quais celulas ou colunas devem ser preenchidas.', common_1.HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if (operation === 'edit' && format === 'docx') {
            if (!generated.docxEdits.length && !hasReplacements && !hasContent) {
                throw new common_1.HttpException('A LLM nao informou alteracoes aplicaveis ao DOCX.', common_1.HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if (!hasContent) {
            throw new common_1.HttpException('A LLM nao retornou conteudo para gerar o arquivo.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    numberedArtifactFilename(filename, index, total) {
        if (total <= 1)
            return filename;
        const extension = path.extname(filename);
        const stem = extension ? filename.slice(0, -extension.length) : filename;
        return `${stem}-${index + 1}${extension}`;
    }
    fileNameFromUrl(url, response) {
        const disposition = response.headers.get('content-disposition') || '';
        const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const quotedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
        const fromHeader = utf8Name ? decodeURIComponent(utf8Name) : quotedName;
        if (fromHeader)
            return fromHeader;
        const pathName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
        return pathName || 'arquivo';
    }
    async extractFileFromUrlForFilesComponent(rawUrl, component, context) {
        const renderedUrl = String(this.renderTemplate(rawUrl || '', context) || '').trim();
        if (!renderedUrl) {
            throw new common_1.HttpException('Informe a URL do arquivo.', common_1.HttpStatus.BAD_REQUEST);
        }
        const driveFileId = this.getGoogleDriveFileId(renderedUrl);
        if (driveFileId) {
            throw new common_1.HttpException('URLs do Google Drive, Docs ou Sheets devem ser lidas por um componente MCP dedicado. O componente Arquivos aceita upload local ou URL publica direta do arquivo.', common_1.HttpStatus.BAD_REQUEST);
        }
        let url;
        try {
            url = new URL(renderedUrl);
        }
        catch {
            throw new common_1.HttpException('URL do arquivo invalida.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new common_1.HttpException('A URL do arquivo precisa usar HTTP ou HTTPS.', common_1.HttpStatus.BAD_REQUEST);
        }
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) {
            throw new common_1.HttpException(`Nao foi possivel baixar o arquivo: HTTP ${response.status}.`, common_1.HttpStatus.BAD_REQUEST);
        }
        const length = Number(response.headers.get('content-length') || 0);
        const maxBytes = 30 * 1024 * 1024;
        if (length > maxBytes) {
            throw new common_1.HttpException('Arquivo maior que 30 MB.', common_1.HttpStatus.BAD_REQUEST);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > maxBytes) {
            throw new common_1.HttpException('Arquivo maior que 30 MB.', common_1.HttpStatus.BAD_REQUEST);
        }
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const extracted = await this.ragService.extractFiles([
            {
                buffer,
                originalname: this.fileNameFromUrl(url, response),
                mimetype: contentType,
                size: buffer.length,
            },
        ], {
            ocr: component.filesPreferOcr,
            maxTextChars: component.filesMaxTextChars,
            source: 'url',
            organizationId: context.organizationId,
            agentId: context.agentId,
            flowId: context.flowId,
            conversationId: context.conversationId,
        });
        const file = Array.isArray(extracted?.files) ? extracted.files[0] : null;
        if (!file?.text && !file?.documentId) {
            throw new common_1.HttpException('Nao foi possivel extrair texto deste arquivo.', common_1.HttpStatus.BAD_REQUEST);
        }
        return {
            ...file,
            sourceUrl: renderedUrl,
            source: 'url',
        };
    }
    async runFilesComponent(step, config, context) {
        const component = step.component;
        const responseName = component.responseName || step.responseName || 'arquivos';
        const sourceMode = component.filesSourceMode === 'url' ? 'url' : 'upload';
        const operation = component.filesOperation === 'generate' || component.filesOperation === 'edit'
            ? component.filesOperation
            : 'read';
        const maxTextChars = this.limitNumber(component.filesMaxTextChars ?? 60000, 60000, 0, 500000);
        const uploadedFiles = await this.hydrateFilesDocuments(component.filesUploaded || [], maxTextChars, context);
        const files = sourceMode === 'url'
            ? this.normalizeFilesDocuments([
                await this.extractFileFromUrlForFilesComponent(component.filesUrlTemplate || '', component, context),
            ], maxTextChars)
            : uploadedFiles;
        const combinedText = files.map((file) => `### ${file.title}\n${file.text}`).join('\n\n').trim();
        const result = {
            mode: component.filesResultMode === 'llm' ? 'llm' : 'context',
            operation,
            sourceMode,
            files,
            documents: files.filter((file) => String(file.text || '').trim()).map((file) => ({
                text: file.text,
                title: file.title,
                metadata: {
                    id: file.id,
                    documentId: file.documentId,
                    filename: file.filename,
                    mimeType: file.mimeType,
                    size: file.size,
                    sourceUrl: file.sourceUrl,
                    strategy: file.strategy,
                },
            })),
            text: combinedText,
        };
        if (!files.length) {
            throw new common_1.HttpException('Nenhum arquivo com texto extraido foi encontrado.', common_1.HttpStatus.BAD_REQUEST);
        }
        const configuredTemplateDocumentIds = Array.from(new Set((Array.isArray(component.filesTemplateDocumentIds) ? component.filesTemplateDocumentIds : [])
            .map((documentId) => String(documentId || '').trim())
            .filter(Boolean)));
        if (operation === 'edit' && files.length > 1 && !configuredTemplateDocumentIds.length && !component.filesTemplateDocumentId) {
            throw new common_1.HttpException('Ha varios arquivos enviados. Marque explicitamente qual documento deve ser usado como template para editar. Para consolidar os arquivos em um novo documento, selecione "Gerar novo arquivo".', common_1.HttpStatus.BAD_REQUEST);
        }
        const primaryTemplateDocumentId = configuredTemplateDocumentIds[0]
            || String(component.filesTemplateDocumentId || files[0]?.documentId || '');
        const primaryTemplateFile = files.find((file) => String(file.documentId || '') === primaryTemplateDocumentId) || files[0];
        const expectedArtifactFormat = this.filesArtifactFormat(component, operation, primaryTemplateFile);
        const documentSkillEnabled = this.filesDocumentSkillEnabled(component, operation)
            && !String(component.filesContentTemplate || '').trim();
        result.documentSkill = {
            enabled: documentSkillEnabled,
            name: 'Docs Skill',
            version: 'v1',
        };
        const shouldGenerateWithLlm = component.filesResultMode === 'llm'
            || (operation !== 'read' && !String(component.filesContentTemplate || '').trim());
        if (shouldGenerateWithLlm) {
            const query = this.renderTemplate(component.filesQuestionTemplate || step.instruction || '{{context.slots.userInput}}', context);
            const llmProvider = component.filesLlmProvider && component.filesLlmProvider !== 'auto'
                ? component.filesLlmProvider
                : config.llmProvider;
            const generationPrompt = component.filesGenerationPrompt || 'Crie uma nova versao conforme o pedido do usuario.';
            const specialistPrompt = this.filesDocumentSkillPrompt({
                operation,
                format: expectedArtifactFormat,
                generationPrompt,
                customPrompt: component.filesDocumentSkillPrompt,
            });
            const legacyPrompt = operation === 'read'
                ? component.filesLlmPrompt || 'Leia os arquivos conectados e responda ao usuario em pt-BR de forma objetiva.'
                : [
                    'Leia os documentos conectados e gere o conteudo solicitado.',
                    generationPrompt,
                    ['docx', 'pdf'].includes(expectedArtifactFormat)
                        ? 'Para DOCX ou PDF, entregue um documento final profissional no campo content usando Markdown simples: # titulo, ## secoes, ### subsecoes, listas com "- " e tabelas Markdown no formato | Coluna | Coluna | quando houver dados comparativos, cronogramas, responsabilidades, valores, riscos ou itens estruturados. Nao entregue texto solto quando uma tabela deixar o documento mais claro.'
                        : '',
                    'Quando houver placeholders de template, responda em JSON com {"content":"texto final","replacements":{"campo":"valor"}}.',
                    expectedArtifactFormat === 'docx'
                        ? 'Para editar tabelas de DOCX sem placeholders, responda em JSON com {"content":"","docxEdits":[{"type":"append_table_column","tableIndex":0,"header":"nome da coluna","value":"valor padrao"}]}. tableIndex comeca em zero. Use {"allTables":true} somente quando a solicitacao mencionar todas as tabelas.'
                        : '',
                    expectedArtifactFormat === 'xlsx'
                        ? 'Para editar XLSX, preserve a planilha existente e responda em JSON com {"content":"","xlsxEdits":[{"type":"set_cell","sheet":"Total acumulado","cell":"C2","value":"10:30","valueType":"duration"},{"type":"append_column","sheet":"Total acumulado","header":"Janeiro","keyColumn":"NOME","valuesByKey":{"Ana":"10:30"},"valueType":"duration"}]}. Use set_cell para preencher celulas existentes e append_column somente quando uma nova coluna tiver sido solicitada. Para totais de horas use valueType "duration". Para criar XLSX novo, retorne content com tabela Markdown ou CSV estruturado.'
                        : '',
                    expectedArtifactFormat === 'html'
                        ? 'Para HTML, retorne content em Markdown estruturado; o backend renderiza uma pagina profissional com CSS, secoes e tabelas.'
                        : '',
                    expectedArtifactFormat !== 'docx' && expectedArtifactFormat !== 'xlsx'
                        ? 'Para gerar o arquivo, retorne JSON com {"content":"conteudo final completo"}. O campo content nao pode ficar vazio.'
                        : '',
                    expectedArtifactFormat === 'pdf'
                        ? 'Para PDF, entregue somente o documento final em content. Nao use linhas decorativas com =====, nao inclua planejamento, notas internas de geracao ou uma segunda copia resumida do documento.'
                        : '',
                    'Nao use markdown fora do JSON quando retornar replacements.',
                ].filter(Boolean).join('\n');
            const structureContext = this.filesStructureContext(files);
            const documentSkillContext = documentSkillEnabled
                ? this.filesDocumentSkillInventory(files, operation, expectedArtifactFormat, configuredTemplateDocumentIds)
                : '';
            const llm = await this.ragService.chatLlmRag(query, context.agentId, {
                model: component.filesLlmModel || config.model,
                conversationId: context.conversationId,
                llmProvider,
                temperature: Math.max(0, Math.min(Number(component.filesLlmTemperature ?? 0.2), 1)),
                docs: result.documents,
                k: 0,
                prompt: this.withAgentSystemPreamble(documentSkillEnabled ? specialistPrompt : legacyPrompt, config),
                contextText: [
                    documentSkillContext,
                    operation === 'edit' || documentSkillEnabled ? structureContext : '',
                ].filter((part) => String(part || '').trim()).join('\n\n') || undefined,
                turnHistoricMessages: component.turnHistoricMessages ?? config.turnHistoricMessages ?? 20,
            });
            result.llm = llm;
            result.answer = llm?.text || '';
        }
        if (operation !== 'read') {
            if (!this.documentsService) {
                throw new common_1.HttpException('Servico de documentos nao esta disponivel.', common_1.HttpStatus.SERVICE_UNAVAILABLE);
            }
            const generated = this.parseFilesArtifactPayload(component.filesContentTemplate
                ? this.renderTemplate(component.filesContentTemplate, context)
                : result.answer);
            const generatedQuality = this.filesArtifactQuality(operation, expectedArtifactFormat, generated, files, documentSkillEnabled);
            result.documentSkill = {
                ...result.documentSkill,
                enabled: documentSkillEnabled,
                skill: generated.skill || (documentSkillEnabled ? 'documents' : ''),
                plan: generated.plan,
                quality: generatedQuality,
            };
            const configuredValues = this.parseTemplatedJsonConfig(component.filesTemplateValuesJson, {}, context);
            const replacements = {
                ...(configuredValues && typeof configuredValues === 'object' && !Array.isArray(configuredValues) ? configuredValues : {}),
                ...(generated.replacements || {}),
            };
            const sourceDocumentIds = operation === 'edit'
                ? configuredTemplateDocumentIds.length
                    ? configuredTemplateDocumentIds
                    : [String(component.filesTemplateDocumentId || files[0]?.documentId || '')].filter(Boolean)
                : [''];
            if (operation === 'edit' && !sourceDocumentIds.length) {
                throw new common_1.HttpException('Selecione ao menos um documento template para editar.', common_1.HttpStatus.BAD_REQUEST);
            }
            result.artifacts = await Promise.all(sourceDocumentIds.map(async (sourceDocumentId, index) => (await (async () => {
                const sourceFile = files.find((file) => String(file.documentId || '') === sourceDocumentId) || files[0];
                const format = this.filesArtifactFormat(component, operation, sourceFile);
                const rawFilename = String(this.renderTemplate(component.filesOutputFilenameTemplate || `artefato-${Date.now()}.${format}`, context));
                const filename = this.filesArtifactFilename(this.numberedArtifactFilename(rawFilename, index, sourceDocumentIds.length), format);
                const docxEdits = operation === 'edit' && format === 'docx'
                    ? generated.docxEdits.length
                        ? generated.docxEdits
                        : this.inferFilesDocxEdits(component.filesGenerationPrompt || '', files)
                    : [];
                const xlsxEdits = operation === 'edit' && format === 'xlsx' ? generated.xlsxEdits : [];
                this.assertFilesArtifactPayload(operation, format, { ...generated, docxEdits, xlsxEdits }, replacements);
                return await this.documentsService.createArtifact({
                    format,
                    filename,
                    content: generated.content,
                    replacements,
                    docxEdits,
                    xlsxEdits,
                    templateDocumentId: operation === 'edit' && ['docx', 'xlsx'].includes(format) ? sourceDocumentId : component.filesTemplateDocumentId,
                    parentDocumentId: operation === 'edit' ? sourceDocumentId : undefined,
                    scope: {
                        organizationId: context.organizationId,
                        agentId: context.agentId,
                        flowId: context.flowId,
                        conversationId: context.conversationId,
                    },
                    metadata: {
                        generatedBy: 'canvas-flow-files-component',
                        sourceDocumentIds: files.map((file) => file.documentId).filter(Boolean),
                        ...(sourceDocumentId ? { templateDocumentId: sourceDocumentId } : {}),
                    },
                });
            })())));
            result.artifact = { ...result.artifacts[0] };
            result.downloadUrls = result.artifacts.map((artifact) => artifact.downloadUrl).filter(Boolean);
            result.downloadPaths = result.artifacts.map((artifact) => artifact.downloadPath).filter(Boolean);
            result.downloadUrl = result.artifact.downloadUrl;
            result.downloadPath = result.artifact.downloadPath;
            result.answer = [
                result.answer,
                ...result.artifacts.flatMap((artifact) => [
                    `Arquivo gerado: ${artifact.filename}`,
                    `Download: ${artifact.downloadUrl || artifact.downloadPath}`,
                ]),
            ].filter(Boolean).join('\n\n');
        }
        context.slots[responseName] = result;
        return result;
    }
    async runLlmGenComponent(step, config, context, forcedProvider) {
        const component = step.component;
        const responseName = component.responseName || step.responseName || 'openai';
        const effectiveConfig = this.withComponentAgentSpec(config, component);
        const memoryTurnLimit = this.resolveTurnHistoricMessages(effectiveConfig, component);
        const conversationTurns = await this.loadConversationTurns(context, memoryTurnLimit);
        const decisionContext = this.agentDecisionContext(context, step, responseName, effectiveConfig);
        const provider = forcedProvider || this.componentLlmProvider(component) || this.flowLlmProvider(effectiveConfig) || 'openai';
        const query = this.renderTemplate(component.queryTemplate || step.instruction || '{{context.slots.userInput}}', decisionContext);
        const guardrail = this.evaluateAgentGuardrails(effectiveConfig, query || decisionContext?.input || decisionContext?.slots?.userInput);
        if (guardrail) {
            return {
                text: guardrail.text,
                conversationId: context.conversationId,
                docs: [],
                searchDebug: { mode: 'guardrail_block' },
                trace: [{ type: 'guardrail', result: guardrail }],
                model: component.ragLlmModel || effectiveConfig.model,
                guardrail,
            };
        }
        const providedDocs = this.resolveRagDocumentsForComponent(component, decisionContext, step, effectiveConfig);
        const prompt = this.renderTemplate(component.prompt || step.instruction || 'Responda em pt-BR de forma objetiva.', decisionContext);
        const contextText = [
            this.connectedInputsContextText(step, effectiveConfig, decisionContext),
            this.renderTemplate(component.llmContextTemplate || '', decisionContext),
        ].filter((part) => String(part || '').trim()).join('\n\n');
        const autoTools = await this.runAgentAutoToolsIfEnabled(step, effectiveConfig, context, {
            query,
            prompt,
            provider,
            model: component.ragLlmModel || effectiveConfig.model,
            conversationTurns,
        });
        const executionMode = this.agentExecutionModeForComponent(component);
        if (executionMode !== 'flow'
            && this.shouldBlockUngroundedAppointmentFinal(query, effectiveConfig, context)
            && !this.hasSuccessfulAppointmentDetailObservation(autoTools.observations, effectiveConfig)) {
            return {
                text: 'Nao consegui obter os detalhes desse agendamento com os dados disponiveis. Para evitar informar algo incorreto, preciso consultar o agendamento selecionado antes de responder.',
                conversationId: context.conversationId,
                docs: [],
                trace: [
                    ...autoTools.tracePrefix,
                    {
                        type: 'agentFinalGroundingBlocked',
                        stepId: step.id,
                        reason: 'Resposta final bloqueada porque o usuario pediu/selecionou detalhes de agendamento sem uma tool de detalhes executada com sucesso.',
                    },
                ],
                model: component.ragLlmModel || effectiveConfig.model,
                autoTools: autoTools.observations,
                agentTaskState: autoTools.state || context.slots?.agentTaskState,
            };
        }
        const toolContextText = autoTools.observations.length
            ? [
                contextText,
                '# Estado agentico',
                this.safeJsonStringify(autoTools.state || context.slots?.agentTaskState || {}),
                '# Auto tools executadas pelo agente',
                this.safeJsonStringify(autoTools.observations),
            ].filter((part) => String(part || '').trim()).join('\n\n')
            : contextText;
        const llmResult = await this.ragService.chatLlmRag(query, context.agentId, {
            model: component.ragLlmModel || effectiveConfig.model,
            conversationId: context.conversationId,
            llmProvider: provider,
            docs: providedDocs,
            contextText: toolContextText,
            k: 0,
            prompt: this.withAgentSystemPreamble(prompt, effectiveConfig),
            turnHistoricMessages: memoryTurnLimit,
        });
        if (autoTools.tracePrefix.length) {
            llmResult.trace = [...autoTools.tracePrefix, ...(Array.isArray(llmResult.trace) ? llmResult.trace : [])];
            llmResult.autoTools = autoTools.observations;
            llmResult.agentTaskState = autoTools.state || context.slots?.agentTaskState;
        }
        if (autoTools.messages.length) {
            llmResult.autoToolMessages = autoTools.messages;
        }
        return llmResult;
    }
    normalizeAgentExecutionMode(value) {
        const mode = String(value || '').trim();
        if (mode === 'auto_tools' || mode === 'hybrid')
            return mode;
        return 'flow';
    }
    agentExecutionModeForComponent(component) {
        const explicit = String(component?.agentExecutionMode || '').trim();
        if (explicit)
            return this.normalizeAgentExecutionMode(explicit);
        const role = String(component?.agentRole || '').trim();
        if (role === 'orchestrator')
            return 'hybrid';
        if (role === 'subagent')
            return 'auto_tools';
        return 'flow';
    }
    isAgenticToolCaller(step) {
        if (!step || step.type !== 'component' || step.component?.type !== 'openaiGen')
            return false;
        const role = String(step.component.agentRole || 'simple').trim();
        if (role !== 'orchestrator' && role !== 'subagent')
            return false;
        return this.agentExecutionModeForComponent(step.component) !== 'flow';
    }
    manifestTargetStepId(ref) {
        const direct = String(ref?.targetStepId || ref?.stepId || ref?.nodeId || '').trim();
        if (direct)
            return direct;
        const path = String(ref?.path || '').trim();
        if (path.startsWith('canvas://'))
            return path.slice('canvas://'.length).split(/[?#]/)[0]?.trim() || '';
        return '';
    }
    agenticManifestToolStepIds(config) {
        const ids = new Set();
        (config.steps || []).forEach((step) => {
            if (!this.isAgenticToolCaller(step))
                return;
            const manifest = this.isPlainObject(step.component?.agentManifest) ? step.component?.agentManifest || {} : {};
            let explicitTargetCount = 0;
            let manifestRefCount = 0;
            ['skills', 'subagents', 'mcpServers'].forEach((key) => {
                const refs = Array.isArray(manifest[key]) ? manifest[key] : [];
                manifestRefCount += refs.length;
                refs.forEach((ref) => {
                    const targetStepId = this.manifestTargetStepId(ref);
                    if (targetStepId && targetStepId !== step.id) {
                        explicitTargetCount += 1;
                        ids.add(targetStepId);
                    }
                });
            });
            if (manifestRefCount === 0 && explicitTargetCount === 0 && step.component?.agentUseWorkspaceCatalog !== false) {
                (config.steps || []).forEach((candidate) => {
                    if (candidate.id === step.id || candidate.type !== 'component')
                        return;
                    const isCanvasSubagent = candidate.component?.type === 'openaiGen' && candidate.component.agentRole === 'subagent';
                    const isCanvasMcp = candidate.component?.type === 'mcp';
                    if (isCanvasSubagent || isCanvasMcp)
                        ids.add(candidate.id);
                });
            }
        });
        return ids;
    }
    isManifestVisualEdge(edge, config) {
        if (edge.edgeRole === 'manifest')
            return true;
        const toolStepIds = this.agenticManifestToolStepIds(config);
        return toolStepIds.has(edge.source) || toolStepIds.has(edge.target);
    }
    responseSlotCandidates(step, fallback) {
        const values = [
            fallback,
            step.responseName,
            step.component?.responseName,
            step.title,
            step.id,
        ];
        return Array.from(new Set(values
            .flatMap((value) => {
            const raw = this.agentToolText(value);
            if (!raw)
                return [];
            return [raw, this.normalizeAssistantVariableName(raw, fallback)];
        })
            .filter(Boolean)));
    }
    agentDecisionSlots(context, step, fallback = '') {
        const omitKeys = step ? this.responseSlotCandidates(step, fallback || step.responseName || step.component?.responseName || step.id) : [];
        return this.stripAgentRuntimeSlots(context?.slots || {}, { omitKeys });
    }
    agentDecisionContext(context, step, fallback = '', config) {
        const decisionContext = {
            ...context,
            slots: this.agentDecisionSlots(context, step, fallback),
        };
        return step && config ? this.withConnectedInputs(decisionContext, step, config) : decisionContext;
    }
    normalizeMessageInstruction(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    isDefaultMessageInstruction(value) {
        const normalized = this.normalizeMessageInstruction(value);
        return normalized === 'ola. como posso ajudar?'
            || normalized === 'escreva a mensagem para o usuario.';
    }
    rememberAssistantText(context, text) {
        const value = String(text || '').trim();
        if (value)
            context.__lastAssistantText = value;
    }
    getLastAssistantText(context) {
        return String(context?.__lastAssistantText || '').trim();
    }
    rememberEmittedAssistantText(context, text) {
        const value = String(text || '').trim();
        if (value)
            context.__lastEmittedAssistantText = value;
    }
    getLastEmittedAssistantText(context) {
        return String(context?.__lastEmittedAssistantText || '').trim();
    }
    getLastAssistantMessage(messages) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message?.role === 'assistant' && String(message.text || '').trim())
                return message;
        }
        return undefined;
    }
    assistantTextLooksLikeUserPrompt(value) {
        const normalized = this.normalizeMessageInstruction(value);
        if (!normalized)
            return false;
        return normalized.includes('?')
            || /\b(informe|digite|diga|responda|confirme|escolha|selecione|envie|preencha|qual|quais|quando|onde|como|por favor)\b/.test(normalized);
    }
    inferWaitingInputFromAssistantPrompt(context, messages, stepById, trace) {
        if (context.__inputConsumedInRun !== true)
            return '';
        const consumedInputStepId = String(context.__lastConsumedInputStepId || context?.inputTargetStepId || '').trim();
        if (!consumedInputStepId)
            return '';
        const consumedInputStep = stepById.get(consumedInputStepId);
        if (!this.isUserInteractionWaitStep(consumedInputStep))
            return '';
        const lastAssistantMessage = this.getLastAssistantMessage(messages);
        if (!lastAssistantMessage || !this.assistantTextLooksLikeUserPrompt(lastAssistantMessage.text))
            return '';
        trace.push({
            stepId: consumedInputStepId,
            type: 'implicitInteractionWait',
            stepType: consumedInputStep?.type,
            lastAssistantText: this.limitText(lastAssistantMessage.text, 500),
            reason: 'O agente respondeu solicitando novo dado do usuario sem encaminhar para outro no; mantendo a conversa aguardando no input que consumiu esta rodada.',
        });
        return consumedInputStepId;
    }
    isDefaultPassthroughMessageStep(step) {
        return Boolean(step
            && step.type === 'message'
            && step.messageUseLlm !== true
            && (!String(step.instruction || '').trim() || this.isDefaultMessageInstruction(step.instruction)));
    }
    isAssistantResponseWorkStep(step) {
        return Boolean(step
            && step.type === 'component'
            && ['agentPlan', 'openaiGen', 'azureOpenAI', 'rag'].includes(String(step.component?.type || '')));
    }
    splitDeferredPassthroughMessages(batch, stepById) {
        const hasAssistantResponseWork = batch.some((stepId) => this.isAssistantResponseWorkStep(stepById.get(stepId)));
        if (!hasAssistantResponseWork)
            return { executable: batch, deferred: [] };
        return {
            executable: batch.filter((stepId) => !this.isDefaultPassthroughMessageStep(stepById.get(stepId))),
            deferred: batch.filter((stepId) => this.isDefaultPassthroughMessageStep(stepById.get(stepId))),
        };
    }
    recordInputHistory(context, step, responseName, value) {
        if (!context?.slots || !responseName)
            return;
        const entry = {
            stepId: step.id,
            stepTitle: step.title || '',
            responseName,
            value,
            text: this.limitText(value, 1000, ''),
            receivedAt: context.now || new Date().toISOString(),
        };
        const globalHistory = Array.isArray(context.slots.inputHistory) ? context.slots.inputHistory : [];
        context.slots.inputHistory = [...globalHistory, entry].slice(-30);
        const scopedKey = `${responseName}History`;
        const scopedHistory = Array.isArray(context.slots[scopedKey]) ? context.slots[scopedKey] : [];
        context.slots[scopedKey] = [...scopedHistory, entry].slice(-30);
    }
    resolveTurnHistoricMessages(config, component) {
        return this.limitNumber(component?.turnHistoricMessages ?? config.turnHistoricMessages ?? 20, 20, 0, 200);
    }
    normalizeConversationTurns(turns) {
        return (turns || [])
            .filter((turn) => ['user', 'assistant', 'tool'].includes(String(turn?.role || '')))
            .filter((turn) => {
            const metadata = turn?.metadata || {};
            if (metadata.kind && metadata.kind !== 'message')
                return false;
            return String(turn?.content || '').trim();
        })
            .map((turn) => ({
            role: String(turn.role),
            content: String(turn.content || ''),
        }));
    }
    async loadConversationTurns(context, limit) {
        const conversationId = String(context?.conversationId || '').trim();
        if (!conversationId || limit <= 0)
            return [];
        const cache = context.__conversationTurnsCache;
        if (cache && cache.limit >= limit && Array.isArray(cache.turns)) {
            return cache.turns.slice(-limit);
        }
        const turns = await this.memoryService.findRecent(context?.agentId, conversationId, limit, {
            organizationId: context?.organizationId,
            conversationOwnerId: context?.conversationOwnerId,
        }).catch(() => []);
        const normalized = this.normalizeConversationTurns(turns);
        context.__conversationTurnsCache = { limit, turns: normalized };
        return normalized;
    }
    agentAutoToolTargetStepIds(context, observationsOverride) {
        const observations = Array.isArray(observationsOverride)
            ? observationsOverride
            : Array.isArray(context?.slots?.agentAutoTools)
                ? context.slots.agentAutoTools
                : [];
        return new Set(observations
            .filter((observation) => observation?.status !== 'failed' && observation?.status !== 'blocked' && observation?.error === undefined)
            .map((observation) => this.agentToolText(observation?.targetStepId))
            .filter(Boolean));
    }
    async resolveCalledAgentToolDownstreamTargets(config, context, trace, sourceStepId = '', observations) {
        const calledToolTargetStepIds = this.agentAutoToolTargetStepIds(context, observations);
        const resumedTargets = [];
        for (const targetStepId of calledToolTargetStepIds) {
            const targetStep = (config.steps || []).find((item) => item.id === targetStepId);
            if (!targetStep)
                continue;
            const downstream = await this.outgoingTargets(targetStep, config, context, trace);
            resumedTargets.push(...downstream);
        }
        const uniqueTargets = Array.from(new Set(resumedTargets));
        if (uniqueTargets.length) {
            trace.push({
                stepId: sourceStepId,
                type: 'agentToolDownstreamResume',
                calledToolTargets: Array.from(calledToolTargetStepIds),
                resumedTargets: uniqueTargets,
                reason: 'Depois de executar auto tools, o agente retoma nos proximos nos das tools chamadas.',
            });
        }
        return uniqueTargets;
    }
    async filterHybridAgentOutgoingTargets(step, config, context, outgoing, trace, observations) {
        if (!outgoing.length)
            return outgoing;
        const effectiveConfig = this.withComponentAgentSpec(config, step.component);
        const toolTargetStepIds = new Set(this.buildAgentAutoToolCatalog(effectiveConfig)
            .filter((tool) => tool.executable === true && tool.executableType === 'canvas_step')
            .map((tool) => this.agentToolText(tool.targetStepId))
            .filter(Boolean));
        if (!toolTargetStepIds.size)
            return outgoing;
        const calledToolTargetStepIds = this.agentAutoToolTargetStepIds(context, observations);
        const filtered = outgoing.filter((targetStepId) => !toolTargetStepIds.has(targetStepId));
        const skipped = outgoing.filter((targetStepId) => toolTargetStepIds.has(targetStepId));
        const resumedTargets = await this.resolveCalledAgentToolDownstreamTargets(config, context, trace, step.id, observations);
        if (skipped.length) {
            trace.push({
                stepId: step.id,
                type: 'agentHybridToolEdgesSkipped',
                skipped,
                resumedTargets,
                reason: 'Modo hibrido nao executa novamente as tools do manifesto; depois de uma tool chamada, retoma nos proximos nos dela.',
            });
        }
        return Array.from(new Set([...filtered, ...resumedTargets]));
    }
    agentToolText(value) {
        return String(value || '').trim();
    }
    buildAgentAutoToolCatalog(config) {
        const spec = this.isPlainObject(config.agentSpec) ? config.agentSpec || {} : {};
        const tools = [];
        const pushTool = (sourceType, item, index) => {
            if (!this.isPlainObject(item) || item.enabled === false)
                return;
            const id = this.agentToolText(item.id || item.key || item.name || `${sourceType}_${index + 1}`);
            const name = this.agentToolText(item.name || item.label || id);
            const targetFlowId = this.agentToolText(item.targetFlowId || item.flowId || item.flow_id);
            const targetStepId = this.agentToolText(item.targetStepId || item.stepId || item.nodeId || item.targetNodeId);
            const targetStep = targetStepId
                ? (config.steps || []).find((step) => step.id === targetStepId)
                : undefined;
            const targetStepTitle = this.agentToolText(targetStep?.title);
            const targetStepResponseName = this.agentToolText(targetStep?.component?.responseName || targetStep?.responseName);
            const targetStepInstruction = this.agentToolText(targetStep?.instruction ||
                targetStep?.component?.prompt ||
                targetStep?.component?.mcpToolDescription ||
                targetStep?.component?.mcpInstruction ||
                targetStep?.component?.queryTemplate);
            const baseDescription = this.agentToolText(item.description || item.role || item.instructions || item.instruction);
            const description = [
                baseDescription,
                targetStepTitle && targetStepTitle !== name ? `No canvas: ${targetStepTitle}` : '',
                targetStepInstruction ? `Instrucao do no: ${this.limitText(targetStepInstruction, 500)}` : '',
            ].filter(Boolean).join('\n');
            const targetAgentId = this.agentToolText(item.targetAgentId || item.agentId || item.agent_id);
            const serverUrl = this.agentToolText(item.serverUrl || item.mcpExternalUrl || item.url);
            const toolName = this.agentToolText(item.toolName || item.mcpExternalToolName || item.mcpToolName);
            const executableType = targetFlowId
                ? 'flow'
                : targetStepId
                    ? 'canvas_step'
                    : serverUrl && toolName
                        ? 'mcp_external'
                        : '';
            tools.push({
                id,
                sourceType,
                name,
                description,
                executable: Boolean(executableType),
                executableType,
                targetFlowId,
                targetStepId,
                targetStepTitle,
                targetStepResponseName,
                targetStepInstruction,
                targetAgentId,
                serverUrl,
                toolName,
                transport: item.transport || item.mcpExternalTransport || 'streamable_http',
                authMode: item.authMode || item.mcpExternalAuthMode || 'none',
                oauthConnectionScope: item.oauthConnectionScope || item.mcpExternalOAuthConnectionScope || 'agent',
                authHeaderName: item.authHeaderName || item.mcpExternalAuthHeaderName || 'Authorization',
                authQueryParam: item.authQueryParam || item.mcpExternalAuthQueryParam || 'api_key',
                argumentsJson: item.argumentsJson || item.mcpExternalArgumentsJson || '{}',
                inputTemplate: item.inputTemplate || item.textTemplate || '',
                inputSchema: this.normalizeAgentToolSchema(item.inputSchema
                    || item.argumentsSchema
                    || item.parameters
                    || item.mcpInputSchema
                    || item.schema?.input
                    || targetStep?.component?.mcpInputSchema),
                outputSchema: this.normalizeAgentToolSchema(item.outputSchema
                    || item.resultSchema
                    || item.mcpOutputSchema
                    || item.schema?.output
                    || targetStep?.component?.mcpOutputSchema),
                sideEffect: item.sideEffect || item.effect || (item.mutatesData === true ? 'write' : 'read'),
                requiresApproval: item.requiresApproval === true || item.approvalRequired === true,
                maxRetries: this.limitNumber(item.maxRetries ?? 0, 0, 0, 3),
                load: this.normalizeAgentCatalogLoadMode(item.load || item.loadMode, sourceType === 'mcp' ? 'on_demand' : 'auto'),
            });
        };
        (Array.isArray(spec.skills) ? spec.skills : []).forEach((item, index) => pushTool('skill', item, index));
        (Array.isArray(spec.subagents) ? spec.subagents : []).forEach((item, index) => pushTool('subagent', item, index));
        (Array.isArray(spec.mcpServers) ? spec.mcpServers : []).forEach((item, index) => pushTool('mcp', item, index));
        return tools;
    }
    normalizeAgentToolSchema(value) {
        const parsed = typeof value === 'string' ? this.parseJsonConfig(value, {}) : value;
        return this.isPlainObject(parsed) ? parsed : {};
    }
    agentToolManifestForLlm(tool) {
        const inputSchema = this.normalizeAgentToolSchema(tool.inputSchema);
        const outputSchema = this.normalizeAgentToolSchema(tool.outputSchema);
        return {
            id: tool.id,
            type: tool.sourceType,
            name: tool.name,
            description: tool.description,
            executableType: tool.executableType,
            targetFlowId: tool.targetFlowId,
            targetStepId: tool.targetStepId,
            targetStepTitle: tool.targetStepTitle,
            targetStepResponseName: tool.targetStepResponseName,
            targetAgentId: tool.targetAgentId,
            toolName: tool.toolName,
            load: tool.load,
            sideEffect: tool.sideEffect || 'read',
            requiresApproval: tool.requiresApproval === true,
            inputSchema: Object.keys(inputSchema).length ? inputSchema : undefined,
            outputSchema: Object.keys(outputSchema).length ? outputSchema : undefined,
        };
    }
    agentToolCompactManifestForLlm(tool) {
        const inputSchema = this.normalizeAgentToolSchema(tool.inputSchema);
        const outputSchema = this.normalizeAgentToolSchema(tool.outputSchema);
        const inputKeys = Object.keys(inputSchema?.properties || {});
        const outputKeys = Object.keys(outputSchema?.properties || {});
        return {
            id: tool.id,
            type: tool.sourceType,
            name: tool.name,
            description: this.limitText(tool.description || tool.targetStepInstruction || '', 700),
            executableType: tool.executableType,
            targetFlowId: tool.targetFlowId,
            targetStepId: tool.targetStepId,
            targetStepTitle: tool.targetStepTitle,
            targetStepResponseName: tool.targetStepResponseName,
            targetAgentId: tool.targetAgentId,
            toolName: tool.toolName,
            load: tool.load,
            sideEffect: tool.sideEffect || 'read',
            requiresApproval: tool.requiresApproval === true,
            inputKeys: inputKeys.length ? inputKeys : undefined,
            requiredInputKeys: Array.isArray(inputSchema.required) ? inputSchema.required : undefined,
            outputKeys: outputKeys.length ? outputKeys : undefined,
        };
    }
    agentToolContractForLlm(tool) {
        return this.agentToolManifestForLlm(tool);
    }
    agentToolObservationForLlm(observation) {
        return {
            toolId: observation?.toolId,
            toolName: observation?.toolName,
            sourceType: observation?.sourceType,
            executableType: observation?.executableType,
            status: observation?.status || (observation?.error ? 'failed' : 'completed'),
            output: observation?.output,
            error: observation?.error,
            validation: observation?.validation,
        };
    }
    normalizeAgentToolPlanItem(item, executableTools, index) {
        if (!this.isPlainObject(item))
            return null;
        const action = String(item.action || item.type || '').trim().toLowerCase() === 'tool' ? 'tool' : 'final';
        const toolId = this.agentToolText(item.toolId || item.tool || item.id);
        if (action === 'tool') {
            const tool = executableTools.find((candidate) => candidate.id === toolId || candidate.name === toolId);
            return {
                index: index + 1,
                action: 'tool',
                toolId,
                toolName: tool?.name || '',
                arguments: this.isPlainObject(item.arguments) ? item.arguments : this.isPlainObject(item.args) ? item.args : {},
                reason: this.limitText(item.reason || item.motivo || '', 500),
                validTool: Boolean(tool),
            };
        }
        return {
            index: index + 1,
            action: 'final',
            toolId: '',
            arguments: {},
            reason: this.limitText(item.reason || item.motivo || '', 500),
            validTool: true,
        };
    }
    normalizeAgentToolPlan(parsed, executableTools, maxCalls) {
        const rawPlan = Array.isArray(parsed?.plan)
            ? parsed.plan
            : Array.isArray(parsed?.steps)
                ? parsed.steps
                : Array.isArray(parsed?.actions)
                    ? parsed.actions
                    : this.isPlainObject(parsed) && parsed.action
                        ? [parsed]
                        : [];
        return rawPlan
            .slice(0, maxCalls)
            .map((item, index) => this.normalizeAgentToolPlanItem(item, executableTools, index))
            .filter(Boolean);
    }
    validateJsonSchemaValue(value, schema, path, errors) {
        if (!this.isPlainObject(schema) || !Object.keys(schema).length)
            return;
        const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
        const nullable = allowedTypes.includes('null') || schema.nullable === true;
        if (value === null || value === undefined) {
            if (!nullable && allowedTypes.length)
                errors.push(`${path} e obrigatorio`);
            return;
        }
        const matchesType = (type) => {
            if (type === 'object')
                return this.isPlainObject(value);
            if (type === 'array')
                return Array.isArray(value);
            if (type === 'string')
                return typeof value === 'string';
            if (type === 'number')
                return typeof value === 'number' && Number.isFinite(value);
            if (type === 'integer')
                return Number.isInteger(value);
            if (type === 'boolean')
                return typeof value === 'boolean';
            return true;
        };
        if (allowedTypes.length && !allowedTypes.some(matchesType)) {
            errors.push(`${path} deve ser ${allowedTypes.join('|')}`);
            return;
        }
        if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
            errors.push(`${path} deve ser um de: ${schema.enum.join(', ')}`);
        }
        if (this.isPlainObject(value) && this.isPlainObject(schema.properties)) {
            const required = Array.isArray(schema.required) ? schema.required.map((item) => String(item)) : [];
            required.forEach((key) => {
                if (value[key] === undefined || value[key] === null || value[key] === '') {
                    errors.push(`${path}.${key} e obrigatorio`);
                }
            });
            Object.entries(schema.properties).forEach(([key, childSchema]) => {
                if (value[key] !== undefined)
                    this.validateJsonSchemaValue(value[key], childSchema, `${path}.${key}`, errors);
            });
            if (schema.additionalProperties === false) {
                const allowed = new Set(Object.keys(schema.properties));
                Object.keys(value).forEach((key) => {
                    if (!allowed.has(key))
                        errors.push(`${path}.${key} nao e permitido`);
                });
            }
        }
        if (Array.isArray(value) && this.isPlainObject(schema.items)) {
            value.forEach((item, index) => this.validateJsonSchemaValue(item, schema.items, `${path}[${index}]`, errors));
        }
    }
    validateAgentToolArguments(tool, args) {
        const schema = this.normalizeAgentToolSchema(tool.inputSchema);
        if (!Object.keys(schema).length)
            return { ok: true, errors: [], schema: undefined };
        const errors = [];
        this.validateJsonSchemaValue(args, schema, 'arguments', errors);
        return { ok: errors.length === 0, errors, schema };
    }
    validateAgentToolOutput(tool, output) {
        const schema = this.normalizeAgentToolSchema(tool.outputSchema);
        if (!Object.keys(schema).length)
            return { ok: true, errors: [], schema: undefined };
        const candidates = [
            { path: 'output', value: output },
            ...(this.isPlainObject(output?.output) ? [{ path: 'output.output', value: output.output }] : []),
            ...(this.isPlainObject(output?.latest?.data) ? [{ path: 'output.latest.data', value: output.latest.data }] : []),
        ];
        const checked = [];
        for (const candidate of candidates) {
            const errors = [];
            this.validateJsonSchemaValue(candidate.value, schema, candidate.path, errors);
            if (!errors.length) {
                return { ok: true, errors: [], schema, outputPath: candidate.path };
            }
            checked.push({ path: candidate.path, errors });
        }
        const best = checked.sort((a, b) => a.errors.length - b.errors.length)[0] || { path: 'output', errors: [] };
        return { ok: false, errors: best.errors, schema, outputPath: best.path };
    }
    agentToolSearchText(tool) {
        return [
            tool?.id,
            tool?.name,
            tool?.description,
            tool?.targetStepTitle,
            tool?.targetStepResponseName,
            tool?.targetStepInstruction,
            tool?.toolName,
            Object.keys(this.normalizeAgentToolSchema(tool?.inputSchema)?.properties || {}).join(' '),
        ].filter(Boolean).join(' ');
    }
    normalizeEntityKey(value) {
        return this.normalizeMessageInstruction(value).replace(/[^a-z0-9]/g, '');
    }
    isEntityIdKey(key) {
        const normalized = this.normalizeEntityKey(key);
        if (normalized === 'idade')
            return false;
        return normalized === 'id'
            || normalized.endsWith('id')
            || (normalized.startsWith('id') && normalized.length > 2);
    }
    entityTokensFromText(value) {
        const ignored = new Set([
            'api',
            'array',
            'canvas',
            'component',
            'consulta',
            'consultar',
            'context',
            'dados',
            'detalhe',
            'detalhes',
            'especifico',
            'id',
            'input',
            'latest',
            'mcp',
            'object',
            'output',
            'retorna',
            'slots',
            'tool',
        ]);
        return Array.from(new Set(this.normalizeMessageInstruction(value)
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .flatMap((token) => {
            const values = [token];
            const compact = this.normalizeEntityKey(token);
            if (compact.endsWith('id') && compact.length > 2)
                values.push(compact.slice(0, -2));
            if (compact.endsWith('s') && compact.length > 4)
                values.push(compact.slice(0, -1));
            return values;
        })
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !ignored.has(token))));
    }
    entityIdArgumentKey(tool) {
        const schema = this.normalizeAgentToolSchema(tool?.inputSchema);
        const keys = Array.from(new Set([
            ...(Array.isArray(schema.required) ? schema.required.map((key) => String(key || '')) : []),
            ...Object.keys(schema.properties || {}),
        ])).filter(Boolean);
        const required = new Set((Array.isArray(schema.required) ? schema.required : []).map((key) => String(key || '')));
        return keys.find((key) => required.has(key) && this.isEntityIdKey(key))
            || keys.find((key) => this.isEntityIdKey(key))
            || '';
    }
    isEntityDetailTool(tool) {
        const idKey = this.entityIdArgumentKey(tool);
        if (!idKey)
            return false;
        const text = this.normalizeMessageInstruction(this.agentToolSearchText(tool));
        return /(detalh|informac|especific|specific)/.test(text)
            || (/(consulta|consult|buscar|obter)/.test(text) && this.entityTokensFromText(idKey).some((token) => text.includes(token)));
    }
    isAppointmentDetailTool(tool) {
        if (this.isEntityDetailTool(tool))
            return true;
        const text = this.normalizeMessageInstruction(this.agentToolSearchText(tool));
        const schema = this.normalizeAgentToolSchema(tool?.inputSchema);
        const keys = Object.keys(schema?.properties || {}).map((key) => this.normalizeMessageInstruction(key)).join(' ');
        const acceptsAppointmentId = /(agendamento|appointment).*(id)|id.*(agendamento|appointment)/.test(keys);
        return acceptsAppointmentId
            || (/(agendamento|appointment)/.test(text) && /(detalh|consulta|consult|especific|specific)/.test(text));
    }
    appointmentIdArgumentKey(tool) {
        return this.entityIdArgumentKey(tool) || (() => {
            const schema = this.normalizeAgentToolSchema(tool?.inputSchema);
            const keys = Array.from(new Set([
                ...(Array.isArray(schema.required) ? schema.required.map((key) => String(key || '')) : []),
                ...Object.keys(schema.properties || {}),
            ])).filter(Boolean);
            return keys.find((key) => {
                const normalized = this.normalizeMessageInstruction(key);
                return /(agendamento|appointment).*(id)|id.*(agendamento|appointment)/.test(normalized);
            }) || keys.find((key) => this.normalizeMessageInstruction(key) === 'id') || 'agendamentoId';
        })();
    }
    extractEntityIdsFromValue(value) {
        if (!this.isPlainObject(value))
            return [];
        const entries = Object.entries(value);
        return entries
            .filter(([key, item]) => {
            const normalized = this.normalizeMessageInstruction(key);
            return item !== undefined
                && item !== null
                && item !== ''
                && (this.isEntityIdKey(key) || /(agendamento|appointment).*(id)|id.*(agendamento|appointment)/.test(normalized));
        })
            .map(([key, item]) => ({ key, id: String(item) }));
    }
    resolveNumericSelectionIndex(query) {
        const match = String(query || '').trim().match(/^(?:op(?:c|ç)ao\s*)?#?\s*(\d{1,3})$/i);
        if (!match)
            return -1;
        const value = Number(match[1]);
        return Number.isFinite(value) && value > 0 ? value - 1 : -1;
    }
    extractAppointmentIdFromValue(value) {
        if (!this.isPlainObject(value))
            return '';
        const entries = Object.entries(value);
        const direct = entries.find(([key, item]) => {
            const normalized = this.normalizeMessageInstruction(key);
            return item !== undefined
                && item !== null
                && item !== ''
                && (/(agendamento|appointment).*(id)|id.*(agendamento|appointment)/.test(normalized));
        });
        if (direct)
            return String(direct[1]);
        const generic = this.extractEntityIdsFromValue(value)[0];
        return generic?.id || '';
    }
    collectEntityCandidates(value, path = 'slots', arrayPath = '', arrayIndex = -1, depth = 0, output = []) {
        if (depth > 10 || value === null || value === undefined)
            return output;
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                this.collectEntityCandidates(item, `${path}[${index}]`, path, index, depth + 1, output);
            });
            return output;
        }
        if (!this.isPlainObject(value))
            return output;
        const ids = this.extractEntityIdsFromValue(value);
        ids.forEach(({ key, id }) => {
            output.push({
                id,
                idKey: key,
                entityTokens: this.entityTokensFromText(`${key} ${path} ${Object.keys(value).join(' ')}`),
                value,
                path,
                arrayPath,
                arrayIndex,
            });
        });
        Object.entries(value).forEach(([key, item]) => {
            this.collectEntityCandidates(item, `${path}.${key}`, arrayPath, arrayIndex, depth + 1, output);
        });
        return output;
    }
    collectAppointmentCandidates(value, path = 'slots', arrayPath = '', arrayIndex = -1, depth = 0, output = []) {
        if (depth > 10 || value === null || value === undefined)
            return output;
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                this.collectAppointmentCandidates(item, `${path}[${index}]`, path, index, depth + 1, output);
            });
            return output;
        }
        if (!this.isPlainObject(value))
            return output;
        const id = this.extractAppointmentIdFromValue(value);
        const text = this.normalizeMessageInstruction(`${path} ${Object.keys(value).join(' ')} ${this.limitText(JSON.stringify(value), 1000, '')}`);
        if (id && /(agendamento|appointment)/.test(text)) {
            output.push({
                id,
                idKey: this.extractEntityIdsFromValue(value).find((item) => item.id === id)?.key,
                entityTokens: this.entityTokensFromText(`agendamento appointment ${path} ${Object.keys(value).join(' ')}`),
                value,
                path,
                arrayPath,
                arrayIndex,
            });
        }
        Object.entries(value).forEach(([key, item]) => {
            this.collectAppointmentCandidates(item, `${path}.${key}`, arrayPath, arrayIndex, depth + 1, output);
        });
        return output;
    }
    appointmentCandidatesFromContext(context) {
        const candidates = this.collectAppointmentCandidates(this.stripAgentRuntimeSlots(context?.slots || {}));
        const seen = new Set();
        return candidates
            .filter((candidate) => {
            const key = `${candidate.id}:${candidate.path}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        })
            .sort((a, b) => {
            const aList = a.arrayIndex >= 0 ? 0 : 1;
            const bList = b.arrayIndex >= 0 ? 0 : 1;
            if (aList !== bList)
                return aList - bList;
            const aPlural = /agendamentos|appointments/.test(this.normalizeMessageInstruction(a.arrayPath || a.path)) ? 0 : 1;
            const bPlural = /agendamentos|appointments/.test(this.normalizeMessageInstruction(b.arrayPath || b.path)) ? 0 : 1;
            if (aPlural !== bPlural)
                return aPlural - bPlural;
            return a.path.localeCompare(b.path);
        });
    }
    entityCandidatesFromContext(context) {
        const candidates = this.collectEntityCandidates(this.stripAgentRuntimeSlots(context?.slots || {}));
        const seen = new Set();
        return candidates
            .filter((candidate) => {
            const key = `${candidate.idKey || 'id'}:${candidate.id}:${candidate.path}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        })
            .sort((a, b) => {
            const aList = a.arrayIndex >= 0 ? 0 : 1;
            const bList = b.arrayIndex >= 0 ? 0 : 1;
            if (aList !== bList)
                return aList - bList;
            return a.path.localeCompare(b.path);
        });
    }
    resolveAppointmentCandidateFromSelection(query, context) {
        const selectionIndex = this.resolveNumericSelectionIndex(query);
        if (selectionIndex < 0)
            return undefined;
        const candidates = this.appointmentCandidatesFromContext(context);
        const listCandidates = candidates.filter((candidate) => candidate.arrayIndex >= 0);
        return (listCandidates.length ? listCandidates : candidates)[selectionIndex];
    }
    resolveEntityCandidateFromSelection(query, context) {
        const selectionIndex = this.resolveNumericSelectionIndex(query);
        if (selectionIndex < 0)
            return undefined;
        const candidates = this.entityCandidatesFromContext(context);
        const listCandidates = candidates.filter((candidate) => candidate.arrayIndex >= 0);
        return (listCandidates.length ? listCandidates : candidates)[selectionIndex];
    }
    detailToolCandidateScore(tool, candidate) {
        if (!this.isEntityDetailTool(tool) && !this.isAppointmentDetailTool(tool))
            return -1;
        const idKey = this.entityIdArgumentKey(tool) || this.appointmentIdArgumentKey(tool);
        const directValue = this.isPlainObject(candidate.value) ? candidate.value[idKey] : undefined;
        const toolTokens = this.entityTokensFromText(`${idKey} ${this.agentToolSearchText(tool)}`);
        const candidateTokens = new Set(candidate.entityTokens || []);
        const overlap = toolTokens.filter((token) => candidateTokens.has(token)).length;
        let score = 0;
        if (directValue !== undefined && directValue !== null && directValue !== '')
            score += 100;
        if (candidate.idKey && this.normalizeEntityKey(candidate.idKey) === this.normalizeEntityKey(idKey))
            score += 80;
        score += overlap * 20;
        if (this.normalizeEntityKey(idKey) === 'id')
            score += 5;
        return score;
    }
    selectDetailToolForCandidate(executableTools, candidate) {
        const detailTools = executableTools.filter((item) => item.executable && (this.isEntityDetailTool(item) || this.isAppointmentDetailTool(item)));
        if (!detailTools.length)
            return null;
        const ranked = detailTools
            .map((tool, index) => ({ tool, index, score: this.detailToolCandidateScore(tool, candidate) }))
            .sort((a, b) => (b.score - a.score) || (a.index - b.index));
        if (ranked[0]?.score > 0)
            return ranked[0].tool;
        return detailTools.length === 1 ? detailTools[0] : null;
    }
    buildEntityDetailToolPlanFromContext(query, executableTools, context) {
        const candidate = this.resolveEntityCandidateFromSelection(query, context);
        if (!candidate)
            return null;
        const tool = this.selectDetailToolForCandidate(executableTools, candidate);
        if (!tool)
            return null;
        const idKey = this.entityIdArgumentKey(tool) || this.appointmentIdArgumentKey(tool);
        return {
            index: 1,
            action: 'tool',
            toolId: tool.id,
            toolName: tool.name,
            arguments: { [idKey]: candidate.id },
            reason: `Plano reparado: a entrada "${String(query).trim()}" seleciona o item ${candidate.id}; detalhes precisam ser obtidos pela tool antes de responder.`,
            validTool: true,
            repaired: true,
            repairedFromSelection: true,
        };
    }
    buildAppointmentDetailToolPlanFromContext(query, executableTools, context) {
        return this.buildEntityDetailToolPlanFromContext(query, executableTools, context);
    }
    shouldBlockUngroundedAppointmentFinal(query, config, context) {
        const executableTools = this.buildAgentAutoToolCatalog(config).filter((tool) => tool.executable);
        const detailTools = executableTools.filter((tool) => this.isEntityDetailTool(tool) || this.isAppointmentDetailTool(tool));
        if (!detailTools.length)
            return false;
        if (this.buildEntityDetailToolPlanFromContext(query, executableTools, context))
            return true;
        const normalized = this.normalizeMessageInstruction(query);
        if (!/(detalh|informac|mais\s+sobre|especific)/.test(normalized))
            return false;
        const queryTokens = new Set(this.entityTokensFromText(query));
        if (!queryTokens.size)
            return true;
        return detailTools.some((tool) => this.entityTokensFromText(this.agentToolSearchText(tool)).some((token) => queryTokens.has(token)));
    }
    hasSuccessfulAppointmentDetailObservation(observations, config) {
        const appointmentDetailToolIds = new Set(this.buildAgentAutoToolCatalog(config)
            .filter((tool) => tool.executable && (this.isEntityDetailTool(tool) || this.isAppointmentDetailTool(tool)))
            .flatMap((tool) => [tool.id, tool.name, tool.targetStepId].filter(Boolean)));
        return (observations || []).some((observation) => {
            if (!observation || observation.error)
                return false;
            if (['failed', 'blocked', 'validation_failed', 'output_validation_failed'].includes(String(observation.status || '')))
                return false;
            return appointmentDetailToolIds.has(observation.toolId)
                || appointmentDetailToolIds.has(observation.toolName)
                || appointmentDetailToolIds.has(observation.targetStepId);
        });
    }
    resolveAgentToolApproval(tool, context) {
        if (tool.requiresApproval !== true)
            return { required: false, approved: true };
        const approvals = {
            ...(this.isPlainObject(context?.approvals) ? context.approvals : {}),
            ...(this.isPlainObject(context?.slots?.approvals) ? context.slots.approvals : {}),
        };
        const raw = approvals[tool.id] || approvals[tool.name] || approvals[tool.toolName];
        const status = typeof raw === 'string'
            ? raw
            : this.isPlainObject(raw)
                ? raw.status || raw.decision || raw.approved
                : raw;
        const normalized = this.normalizeApprovalText(status);
        const approved = status === true || normalized === 'approved' || normalized === 'aprovado' || normalized === 'approve' || normalized === 'aprovar';
        return { required: true, approved, status: status ?? '' };
    }
    buildAgentTaskState(step, plan, maxCalls) {
        return {
            agentStepId: step.id,
            status: 'planned',
            maxCalls,
            plan: this.cloneJson(plan || []),
            completed: [],
            failed: [],
            skipped: [],
            pending: (plan || []).filter((item) => item?.action === 'tool').map((item) => ({
                toolId: item.toolId,
                toolName: item.toolName,
                reason: item.reason || '',
            })),
            updatedAt: new Date().toISOString(),
        };
    }
    updateAgentTaskState(context, patch) {
        const current = this.isPlainObject(context?.slots?.agentTaskState) ? context.slots.agentTaskState : {};
        context.slots.agentTaskState = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        return context.slots.agentTaskState;
    }
    runAgentPlanComponent(step, context) {
        const component = step.component;
        const mode = component.agentPlanMode === 'manual' ? 'manual' : 'advisory';
        const responseName = component.responseName || step.responseName || 'agentPlan';
        const renderedPlanJson = this.renderTemplate(component.agentPlanJson || '{ "plan": [] }', context);
        const parsedPlan = typeof renderedPlanJson === 'string'
            ? this.parseJsonConfig(renderedPlanJson, {})
            : renderedPlanJson;
        const result = {
            mode,
            sourceStepId: step.id,
            title: step.title || 'Agent Plan',
            instructions: String(this.renderTemplate(component.agentPlanInstructions || step.instruction || '', context) || ''),
            rawPlan: this.cloneJsonSafe(parsedPlan),
            maxToolCalls: this.limitNumber(component.agentPlanMaxToolCalls ?? 3, 3, 1, 10),
            clearAfterUse: component.agentPlanClearAfterUse !== false,
            createdAt: new Date().toISOString(),
        };
        context.slots[responseName] = result;
        context.slots.agentPlan = result;
        return result;
    }
    readActiveAgentPlan(context) {
        const plan = context?.slots?.agentPlan;
        if (!this.isPlainObject(plan))
            return undefined;
        if (plan.consumedByStepId && plan.clearAfterUse !== false)
            return undefined;
        return plan;
    }
    normalizeExternalAgentPlan(plan, executableTools, query, maxCalls) {
        if (!this.isPlainObject(plan))
            return undefined;
        const rawPlanSource = this.isPlainObject(plan.rawPlan) ? plan.rawPlan : plan;
        const rawNormalizedPlan = this.normalizeAgentToolPlan(rawPlanSource, executableTools, maxCalls);
        const normalizedPlan = this.sanitizeAgentPlan(rawNormalizedPlan, executableTools, query);
        const repairedPlan = this.repairAgentPlanCoverage(query, normalizedPlan, executableTools, maxCalls);
        return {
            sourceStepId: plan.sourceStepId || '',
            title: plan.title || 'Agent Plan',
            mode: plan.mode === 'manual' ? 'manual' : 'advisory',
            instructions: String(plan.instructions || ''),
            maxToolCalls: this.limitNumber(plan.maxToolCalls ?? maxCalls, maxCalls, 1, 10),
            clearAfterUse: plan.clearAfterUse !== false,
            rawPlanCount: rawNormalizedPlan.length,
            plan: repairedPlan.plan.slice(0, maxCalls),
            validation: repairedPlan.validation,
            repaired: repairedPlan.repaired,
            raw: this.cloneJsonSafe(rawPlanSource),
        };
    }
    markAgentPlanConsumed(context, step, activePlan) {
        if (!activePlan || activePlan.clearAfterUse === false || !this.isPlainObject(context?.slots?.agentPlan))
            return;
        context.slots.agentPlan = {
            ...context.slots.agentPlan,
            consumedByStepId: step.id,
            consumedAt: new Date().toISOString(),
        };
    }
    normalizeAgentIntentText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .toLowerCase();
    }
    detectAgentIntents(value) {
        const text = this.normalizeAgentIntentText(value);
        const intents = new Set();
        if (/\b(resum|resumo|resuma|sumari|summari|summary|summarize)\w*/i.test(text))
            intents.add('summarize');
        if (/\b(traduz|traducao|tradutor|translate|translation|translator|ingles|english)\w*/i.test(text))
            intents.add('translate');
        return Array.from(intents);
    }
    agentIntentLabel(intent) {
        if (intent === 'summarize')
            return 'resumo';
        if (intent === 'translate')
            return 'traducao';
        return intent;
    }
    agentIntentTask(intent) {
        if (intent === 'summarize')
            return 'Resumir o texto conforme solicitado.';
        if (intent === 'translate')
            return 'Traduzir o texto conforme solicitado.';
        return `Executar a tarefa ${intent}.`;
    }
    agentToolCapabilities(tool) {
        const explicit = Array.isArray(tool.capabilities)
            ? tool.capabilities.map((item) => this.normalizeAgentIntentText(item)).filter(Boolean)
            : [];
        const inferred = this.detectAgentIntents([
            tool.id,
            tool.name,
            tool.toolName,
            tool.description,
            tool.targetStepTitle,
            tool.targetStepResponseName,
            tool.targetStepInstruction,
        ].filter(Boolean).join(' '));
        return Array.from(new Set([...explicit, ...inferred]));
    }
    agentToolIntentScore(tool, intent) {
        const identifiers = this.normalizeAgentIntentText([
            tool.id,
            tool.name,
            tool.toolName,
            tool.targetStepTitle,
            tool.targetStepResponseName,
        ].filter(Boolean).join(' '));
        const description = this.normalizeAgentIntentText([
            tool.description,
            tool.targetStepInstruction,
        ].filter(Boolean).join(' '));
        const sourceType = String(tool?.sourceType || '').trim();
        let score = 0;
        const hasSummary = /\b(resum|resumo|resuma|sumari|summari|summary|summarize)\w*/i;
        const hasTranslate = /\b(traduz|traducao|tradutor|translate|translation|translator|ingles|english)\w*/i;
        if (intent === 'summarize') {
            if (hasSummary.test(identifiers))
                score += 120;
            if (hasSummary.test(description))
                score += 60;
            if (hasTranslate.test(identifiers) && !hasSummary.test(identifiers))
                score -= 90;
            if (hasTranslate.test(description) && !hasSummary.test(description))
                score -= 30;
        }
        if (intent === 'translate') {
            if (hasTranslate.test(identifiers))
                score += 120;
            if (hasTranslate.test(description))
                score += 60;
            if (hasSummary.test(identifiers) && !hasTranslate.test(identifiers))
                score -= 90;
            if (hasSummary.test(description) && !hasTranslate.test(description))
                score -= 30;
        }
        if (sourceType === 'skill' || sourceType === 'subagent')
            score += 5;
        if (sourceType === 'mcp')
            score -= 20;
        return score;
    }
    rankedAgentToolsForIntent(intent, candidates) {
        if (!candidates.length)
            return [];
        const ranked = candidates
            .map((tool, index) => ({ tool, index, score: this.agentToolIntentScore(tool, intent) }))
            .sort((a, b) => (b.score - a.score) || (a.index - b.index));
        const positive = ranked.filter((item) => item.score > 0).map((item) => item.tool);
        if (positive.length)
            return positive;
        return candidates.length === 1 ? [candidates[0]] : [];
    }
    agentToolTriggerTokens(value) {
        const ignored = new Set([
            'agent',
            'agente',
            'api',
            'caso',
            'chame',
            'chamar',
            'cliente',
            'com',
            'como',
            'context',
            'contexto',
            'deve',
            'esse',
            'esta',
            'este',
            'input',
            'mcp',
            'node',
            'para',
            'quando',
            'que',
            'tool',
            'usuario',
        ]);
        return Array.from(new Set(this.normalizeAgentIntentText(value)
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !ignored.has(token))));
    }
    agentToolMatchesQueryTrigger(query, tool) {
        const sourceType = String(tool?.sourceType || '').trim();
        if (sourceType !== 'mcp')
            return false;
        const queryTokens = new Set(this.agentToolTriggerTokens(query));
        if (!queryTokens.size)
            return false;
        const toolTokens = this.agentToolTriggerTokens([
            tool.id,
            tool.name,
            tool.toolName,
            tool.description,
            tool.instructions,
            tool.instruction,
        ].filter(Boolean).join(' '));
        return toolTokens.some((token) => queryTokens.has(token));
    }
    extractAgentTaskText(query) {
        const raw = String(query || '').trim();
        const colonIndex = raw.indexOf(':');
        if (colonIndex >= 0 && raw.slice(colonIndex + 1).trim().length >= 20) {
            return raw.slice(colonIndex + 1).trim();
        }
        return raw;
    }
    trimAgentExtractedText(value) {
        return String(value || '')
            .replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g, '')
            .trim();
    }
    extractAgentIntentPayload(query, intent) {
        const raw = String(query || '').trim();
        if (!raw)
            return '';
        if (intent === 'translate') {
            const match = raw.match(/\btraduz(?:a|ir)?\s+(.+?)\s+(?:para|pra|em)\s+(?:o\s+)?(?:ingles|ingl[eê]s|english|espanhol|spanish|portugues|portugu[eê]s)\b/i);
            if (match?.[1])
                return this.trimAgentExtractedText(match[1]);
        }
        return '';
    }
    planItemTextForIntentDetection(item) {
        const args = this.isPlainObject(item?.arguments) ? item.arguments : {};
        const taskText = [
            args.task,
            args.instruction,
            args.action,
            args.objective,
        ].filter(Boolean).join(' ');
        return taskText || String(item?.reason || '');
    }
    sanitizeAgentPlan(plan, executableTools, query) {
        const taskText = this.extractAgentTaskText(query);
        return (plan || []).map((item) => {
            if (item?.action !== 'tool')
                return item;
            const tool = executableTools.find((candidate) => candidate.id === item.toolId || candidate.name === item.toolId);
            if (!tool)
                return item;
            const capabilities = this.agentToolCapabilities(tool);
            if (!capabilities.length)
                return item;
            const itemIntents = this.detectAgentIntents(this.planItemTextForIntentDetection(item));
            const extraIntents = itemIntents.filter((intent) => !capabilities.includes(intent));
            const primaryIntent = capabilities.find((intent) => itemIntents.includes(intent)) || capabilities[0];
            const currentArgs = this.isPlainObject(item.arguments) ? item.arguments : {};
            const scopedText = this.extractAgentIntentPayload(query, primaryIntent);
            const providedText = String(currentArgs.text || '');
            const shouldUseScopedText = Boolean(scopedText) && (!providedText ||
                this.normalizeAgentIntentText(providedText) === this.normalizeAgentIntentText(query));
            if (!extraIntents.length && (currentArgs.text || currentArgs.input) && currentArgs.task && !shouldUseScopedText)
                return item;
            const nextArguments = {
                ...currentArgs,
                task: currentArgs.task || this.agentIntentTask(primaryIntent),
                text: String(shouldUseScopedText ? scopedText : providedText || scopedText || taskText),
            };
            return {
                ...item,
                arguments: nextArguments,
                scopeAdjusted: extraIntents.length ? extraIntents.map((intent) => this.agentIntentLabel(intent)) : undefined,
            };
        });
    }
    validateAgentPlanCoverage(query, plan, executableTools) {
        const requestedIntents = this.detectAgentIntents(query);
        const errors = [];
        const missingIntents = [];
        const capableToolsByIntent = new Map();
        requestedIntents.forEach((intent) => {
            capableToolsByIntent.set(intent, executableTools.filter((tool) => this.agentToolCapabilities(tool).includes(intent)));
        });
        (plan || []).forEach((item) => {
            if (item?.action !== 'tool')
                return;
            const tool = executableTools.find((candidate) => candidate.id === item.toolId || candidate.name === item.toolId);
            if (!tool)
                return;
            const capabilities = this.agentToolCapabilities(tool);
            const itemIntents = this.detectAgentIntents(this.planItemTextForIntentDetection(item));
            itemIntents
                .filter((intent) => !capabilities.includes(intent) && (capableToolsByIntent.get(intent) || []).length > 0)
                .forEach((intent) => {
                errors.push(`A tool "${tool.name}" recebeu tarefa de ${this.agentIntentLabel(intent)}, mas nao declara essa capacidade.`);
            });
        });
        requestedIntents.forEach((intent) => {
            const capableTools = capableToolsByIntent.get(intent) || [];
            if (!capableTools.length)
                return;
            const covered = (plan || []).some((item) => {
                if (item?.action !== 'tool')
                    return false;
                const tool = executableTools.find((candidate) => candidate.id === item.toolId || candidate.name === item.toolId);
                if (!tool || !this.agentToolCapabilities(tool).includes(intent))
                    return false;
                const itemIntents = this.detectAgentIntents(this.planItemTextForIntentDetection(item));
                return requestedIntents.length <= 1 || !itemIntents.length || itemIntents.includes(intent);
            });
            if (!covered) {
                missingIntents.push(intent);
                errors.push(`A intencao de ${this.agentIntentLabel(intent)} nao foi coberta por nenhuma tool do plano.`);
            }
        });
        return { ok: errors.length === 0, errors, missingIntents, requestedIntents };
    }
    repairAgentPlanCoverage(query, plan, executableTools, maxCalls) {
        const validation = this.validateAgentPlanCoverage(query, plan, executableTools);
        const taskText = this.extractAgentTaskText(query);
        const nextPlan = [...(plan || [])];
        const maxPlanLength = Number.isFinite(Number(maxCalls)) && Number(maxCalls) > 0
            ? Number(maxCalls)
            : executableTools.length;
        const alreadyPlanned = (tool) => nextPlan.some((item) => (item?.action === 'tool' && (item.toolId === tool.id || item.toolId === tool.name)));
        const addToolPlan = (tool, reason, args) => {
            if (nextPlan.length >= maxPlanLength)
                return false;
            if (alreadyPlanned(tool))
                return false;
            if (nextPlan.some((item) => item?.action === 'tool' && item.toolId === tool.id))
                return;
            nextPlan.push({
                index: nextPlan.length + 1,
                action: 'tool',
                toolId: tool.id,
                toolName: tool.name,
                arguments: args,
                reason,
                validTool: true,
                repaired: true,
            });
            return true;
        };
        const candidateGroups = validation.missingIntents.map((intent) => {
            const candidates = executableTools.filter((tool) => this.agentToolCapabilities(tool).includes(intent));
            return {
                intent,
                tools: this.rankedAgentToolsForIntent(intent, candidates),
            };
        });
        const addIntentCandidate = (intent, tool, extra = false) => addToolPlan(tool, extra
            ? `Plano reparado para incluir candidata adicional de ${this.agentIntentLabel(intent)} dentro do limite de chamadas.`
            : `Plano reparado para cobrir ${this.agentIntentLabel(intent)} com uma tool compativel.`, {
            task: this.agentIntentTask(intent),
            text: this.extractAgentIntentPayload(query, intent) || taskText,
        });
        candidateGroups.forEach(({ intent, tools }) => {
            if (tools[0])
                addIntentCandidate(intent, tools[0], false);
        });
        let candidateIndex = 1;
        while (nextPlan.length < maxPlanLength) {
            let added = false;
            candidateGroups.forEach(({ intent, tools }) => {
                if (nextPlan.length >= maxPlanLength)
                    return;
                const tool = tools[candidateIndex];
                if (tool && addIntentCandidate(intent, tool, true))
                    added = true;
            });
            if (!added)
                break;
            candidateIndex += 1;
        }
        executableTools
            .filter((tool) => this.agentToolMatchesQueryTrigger(query, tool))
            .forEach((tool) => {
            const genericArgs = { input: query };
            const genericValidation = this.validateAgentToolArguments(tool, genericArgs);
            if (!genericValidation.ok)
                return;
            addToolPlan(tool, 'Plano reparado por gatilho direto do manifesto da tool.', genericArgs);
        });
        if (nextPlan.length === (plan || []).length && validation.ok)
            return { plan, validation, repaired: false };
        const sanitized = this.sanitizeAgentPlan(nextPlan, executableTools, query).slice(0, nextPlan.length);
        const finalValidation = this.validateAgentPlanCoverage(query, sanitized, executableTools);
        if (nextPlan.length === (plan || []).length) {
            return { plan: sanitized, validation: finalValidation, repaired: !validation.ok };
        }
        return {
            plan: sanitized,
            validation: finalValidation,
            repaired: true,
        };
    }
    agentToolResultAliases(tool, targetStep, responseName) {
        const rawAliases = [
            responseName,
            targetStep.responseName,
            targetStep.component?.responseName,
            targetStep.title,
            targetStep.id,
            tool.name,
            tool.toolName,
        ];
        return Array.from(new Set(rawAliases
            .flatMap((value) => {
            const raw = this.agentToolText(value);
            if (!raw)
                return [];
            return [raw, this.normalizeAssistantVariableName(raw, 'agentTool')];
        })
            .filter(Boolean)));
    }
    writeAgentToolResultSlots(slots, tool, targetStep, responseName, result) {
        this.agentToolResultAliases(tool, targetStep, responseName).forEach((alias) => {
            slots[alias] = this.cloneJsonSafe(result);
        });
        const resultKey = this.normalizeAssistantVariableName(tool.name || tool.id || targetStep.id, 'agentTool');
        slots.agentToolResults = {
            ...(this.isPlainObject(slots.agentToolResults) ? slots.agentToolResults : {}),
            [tool.id]: this.cloneJsonSafe(result),
            [resultKey]: this.cloneJsonSafe(result),
        };
    }
    mergeAgentToolSlots(context, slots) {
        if (!slots || typeof slots !== 'object' || Array.isArray(slots))
            return;
        const nextSlots = { ...this.stripAgentRuntimeSlots(slots) };
        if (Object.prototype.hasOwnProperty.call(context?.slots || {}, 'userInput')) {
            nextSlots.userInput = context.slots.userInput;
        }
        else {
            delete nextSlots.userInput;
        }
        this.mergeContextSlots(context, nextSlots);
    }
    async planAgentAutoTools(params) {
        const { step, config, context, query, prompt, provider, model, tools, maxCalls, conversationTurns = [] } = params;
        const executableTools = tools.filter((tool) => tool.executable);
        if (!executableTools.length)
            return { plan: [], raw: {}, reason: 'Nenhuma tool executavel configurada.' };
        const externalAgentPlan = this.normalizeExternalAgentPlan(this.readActiveAgentPlan(context), executableTools, query, maxCalls);
        if (externalAgentPlan?.mode === 'manual' && externalAgentPlan.rawPlanCount > 0 && externalAgentPlan.plan.length) {
            return {
                plan: externalAgentPlan.plan.slice(0, maxCalls),
                raw: externalAgentPlan.raw,
                reason: externalAgentPlan.instructions || 'Plano manual definido pelo componente Agent Plan.',
                planValidation: externalAgentPlan.validation,
                planRepaired: externalAgentPlan.repaired,
                externalAgentPlan: {
                    sourceStepId: externalAgentPlan.sourceStepId,
                    title: externalAgentPlan.title,
                    mode: externalAgentPlan.mode,
                },
            };
        }
        const client = await this.getOpenAIClientForProvider(provider, context?.agentId);
        const chatModel = await this.getChatModelForProvider(provider, model || config.model, context?.agentId);
        const decisionPrompt = this.withAgentSystemPreamble(prompt, config);
        const completion = await client.chat.completions.create({
            model: chatModel,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                ...(decisionPrompt ? [{
                        role: 'system',
                        content: decisionPrompt,
                    }] : []),
                {
                    role: 'system',
                    content: [
                        'Contrato de saida: responda somente JSON valido no formato {"plan":[{"action":"tool|final","toolId":"","arguments":{},"reason":""}],"reason":""}.',
                        'Use apenas agents.md, guardrails, prompt, input, slots e o manifesto compacto para decidir qual tool chamar; este contrato define somente o formato.',
                        'O manifesto compacto descreve capacidades em alto nivel. Nao tente inferir contrato completo da tool nesta etapa; argumentos podem ficar vazios ou parciais.',
                        'Nunca escolha final para entregar dados que dependem de uma tool ainda nao executada.',
                        'Se o usuario selecionar um item numerico de uma lista anterior e existir tool para consultar detalhes desse item, planeje essa tool com o id correspondente.',
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        jsonResponseShape: {
                            plan: [
                                { action: 'tool|final', toolId: '', arguments: {}, reason: '' },
                            ],
                            reason: '',
                        },
                        maxToolCalls: maxCalls,
                        agentNode: { id: step.id, title: step.title },
                        agentPlan: externalAgentPlan
                            ? {
                                mode: externalAgentPlan.mode,
                                sourceStepId: externalAgentPlan.sourceStepId,
                                title: externalAgentPlan.title,
                                instructions: externalAgentPlan.instructions,
                                suggestedPlan: externalAgentPlan.plan,
                            }
                            : undefined,
                        input: query,
                        conversationTurns,
                        slots: this.agentDecisionSlots(context, step),
                        tools: executableTools.map((tool) => this.agentToolCompactManifestForLlm(tool)),
                    }),
                },
            ],
        });
        const raw = completion.choices?.[0]?.message?.content || '{}';
        const parsed = this.parseJsonConfig(raw, {});
        const initialPlan = this.sanitizeAgentPlan(this.normalizeAgentToolPlan(parsed, executableTools, maxCalls), executableTools, query);
        const repairedPlan = this.repairAgentPlanCoverage(query, initialPlan, executableTools, maxCalls);
        return {
            plan: repairedPlan.plan.slice(0, maxCalls),
            raw: this.isPlainObject(parsed) ? parsed : {},
            rawText: raw,
            reason: this.limitText(parsed?.reason || parsed?.motivo || '', 500),
            model: chatModel,
            planValidation: repairedPlan.validation,
            planRepaired: repairedPlan.repaired,
            externalAgentPlan: externalAgentPlan
                ? {
                    sourceStepId: externalAgentPlan.sourceStepId,
                    title: externalAgentPlan.title,
                    mode: externalAgentPlan.mode,
                }
                : undefined,
        };
    }
    async chooseAgentAutoTool(params) {
        const { step, config, context, query, prompt, provider, model, tools, observations = [], conversationTurns = [] } = params;
        const executableTools = tools.filter((tool) => tool.executable);
        if (!executableTools.length)
            return { action: 'final', reason: 'Nenhuma tool executavel configurada.' };
        const externalAgentPlan = this.normalizeExternalAgentPlan(this.readActiveAgentPlan(context), executableTools, query, executableTools.length);
        const client = await this.getOpenAIClientForProvider(provider, context?.agentId);
        const chatModel = await this.getChatModelForProvider(provider, model || config.model, context?.agentId);
        const decisionPrompt = this.withAgentSystemPreamble(prompt, config);
        const completion = await client.chat.completions.create({
            model: chatModel,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                ...(decisionPrompt ? [{
                        role: 'system',
                        content: decisionPrompt,
                    }] : []),
                {
                    role: 'system',
                    content: [
                        'Contrato de saida: responda somente JSON valido no formato {"action":"final|tool","toolId":"","arguments":{},"reason":""}.',
                        'Use apenas agents.md, guardrails, prompt, input, slots, executedTools e o manifesto compacto para decidir qual tool chamar; este contrato define somente o formato.',
                        'O manifesto compacto descreve capacidades em alto nivel. Nao tente inferir contrato completo da tool nesta etapa; argumentos podem ficar vazios ou parciais.',
                        'Nunca escolha final para entregar dados que dependem de uma tool ainda nao executada.',
                        'Se o usuario selecionar um item numerico de uma lista anterior e existir tool para consultar detalhes desse item, escolha essa tool com o id correspondente.',
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        jsonResponseShape: { action: 'final|tool', toolId: '', arguments: {}, reason: '' },
                        agentNode: { id: step.id, title: step.title },
                        agentPlan: externalAgentPlan
                            ? {
                                mode: externalAgentPlan.mode,
                                sourceStepId: externalAgentPlan.sourceStepId,
                                title: externalAgentPlan.title,
                                instructions: externalAgentPlan.instructions,
                                suggestedPlan: externalAgentPlan.plan,
                            }
                            : undefined,
                        input: query,
                        conversationTurns,
                        slots: this.agentDecisionSlots(context, step),
                        executedTools: observations.map((observation) => this.agentToolObservationForLlm(observation)),
                        tools: executableTools.map((tool) => this.agentToolCompactManifestForLlm(tool)),
                    }),
                },
            ],
        });
        const raw = completion.choices?.[0]?.message?.content || '{}';
        const parsed = this.parseJsonConfig(raw, {});
        const decision = this.isPlainObject(parsed) ? parsed : { action: 'final', reason: 'Resposta de selecao invalida.' };
        if (String(decision.action || '').toLowerCase() === 'tool') {
            const toolId = this.agentToolText(decision.toolId || decision.tool || decision.id);
            const selectedTool = executableTools.find((item) => item.id === toolId || item.name === toolId);
            if (!selectedTool) {
                return { action: 'final', reason: `Tool "${toolId}" nao encontrada.`, plannerRejected: decision };
            }
        }
        return decision;
    }
    async prepareAgentToolArgumentsWithContract(params) {
        const initialArgs = this.isPlainObject(params.rawArgs) ? params.rawArgs : {};
        const initialValidation = this.validateAgentToolArguments(params.tool, initialArgs);
        const schema = this.normalizeAgentToolSchema(params.tool.inputSchema);
        if (initialValidation.ok || !Object.keys(schema).length) {
            return {
                arguments: initialArgs,
                validation: initialValidation,
                initialValidation,
                generated: false,
            };
        }
        const client = await this.getOpenAIClientForProvider(params.provider, params.context?.agentId);
        const chatModel = await this.getChatModelForProvider(params.provider, params.model || params.config.model, params.context?.agentId);
        const decisionPrompt = this.withAgentSystemPreamble(params.prompt, params.config);
        const completion = await client.chat.completions.create({
            model: chatModel,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                ...(decisionPrompt ? [{
                        role: 'system',
                        content: decisionPrompt,
                    }] : []),
                {
                    role: 'system',
                    content: [
                        'Voce prepara argumentos para uma unica tool ja escolhida pelo orquestrador.',
                        'Agora sim leia o contrato completo da tool e retorne somente JSON valido no formato {"arguments":{}, "reason":""}.',
                        'Use apenas input, slots, historico e resultados de tools ja executadas. Nao invente dados ausentes.',
                        'Se faltar dado obrigatorio, deixe-o ausente; a validacao do runner deve impedir a chamada.',
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        jsonResponseShape: { arguments: {}, reason: '' },
                        agentNode: { id: params.step.id, title: params.step.title },
                        selectedTool: this.agentToolContractForLlm(params.tool),
                        plannerChoice: {
                            toolId: params.choice?.toolId || params.choice?.tool || params.choice?.id,
                            reason: params.choice?.reason || '',
                            arguments: initialArgs,
                        },
                        validationErrors: initialValidation.errors,
                        input: params.query,
                        conversationTurns: params.conversationTurns || [],
                        slots: this.agentDecisionSlots(params.context, params.step),
                        executedTools: params.observations.map((observation) => this.agentToolObservationForLlm(observation)),
                    }),
                },
            ],
        });
        const raw = completion.choices?.[0]?.message?.content || '{}';
        const parsed = this.parseJsonConfig(raw, {});
        const generatedArgs = this.isPlainObject(parsed?.arguments)
            ? parsed.arguments
            : this.isPlainObject(parsed?.args)
                ? parsed.args
                : {};
        const validation = this.validateAgentToolArguments(params.tool, generatedArgs);
        return {
            arguments: generatedArgs,
            validation,
            initialValidation,
            generated: true,
            reason: this.limitText(parsed?.reason || parsed?.motivo || '', 500),
            model: chatModel,
            raw: this.isPlainObject(parsed) ? parsed : {},
            rawText: raw,
        };
    }
    async executeAgentAutoTool(tool, args, step, config, context, query) {
        const argumentsPayload = this.isPlainObject(args) ? args : {};
        if (tool.executableType === 'canvas_step') {
            const targetStepId = this.agentToolText(tool.targetStepId);
            if (!targetStepId)
                throw new common_1.HttpException('Subagent do canvas sem targetStepId.', common_1.HttpStatus.BAD_REQUEST);
            if (targetStepId === step.id) {
                throw new common_1.HttpException('Auto tool bloqueada para evitar chamar o proprio no agente.', common_1.HttpStatus.BAD_REQUEST);
            }
            const targetStep = (config.steps || []).find((item) => item.id === targetStepId);
            if (!targetStep)
                throw new common_1.HttpException('Componente do canvas nao encontrado no fluxo.', common_1.HttpStatus.NOT_FOUND);
            if (targetStep.type !== 'component' || !targetStep.component) {
                throw new common_1.HttpException('TargetStepId nao aponta para um componente executavel.', common_1.HttpStatus.BAD_REQUEST);
            }
            const text = this.agentToolText(argumentsPayload.text || argumentsPayload.input)
                || (tool.inputTemplate ? this.renderTemplate(tool.inputTemplate, context) : '')
                || query;
            if (targetStep.component.type === 'openaiGen' || targetStep.component.type === 'azureOpenAI') {
                const responseName = targetStep.component.responseName || targetStep.responseName || targetStep.component.type;
                const currentPath = Array.isArray(context.agentToolPath)
                    ? context.agentToolPath.map((item) => String(item || '')).filter(Boolean)
                    : [String(step.id || '')].filter(Boolean);
                if (currentPath.includes(targetStepId)) {
                    throw new common_1.HttpException('Auto tool bloqueada por ciclo agentico entre subagentes.', common_1.HttpStatus.BAD_REQUEST);
                }
                const maxAgentToolDepth = this.limitNumber(argumentsPayload.maxAgentToolDepth ?? tool.maxAgentToolDepth ?? 6, 6, 1, 20);
                if (currentPath.length >= maxAgentToolDepth) {
                    throw new common_1.HttpException('Auto tool bloqueada por profundidade maxima de subagentes.', common_1.HttpStatus.BAD_REQUEST);
                }
                const nextPath = [...currentPath, targetStepId];
                const toolStep = { ...targetStep };
                const toolContext = {
                    ...context,
                    input: text,
                    agentToolDepth: nextPath.length - 1,
                    agentToolPath: nextPath,
                    slots: {
                        ...this.stripAgentRuntimeSlots(context.slots || {}),
                        ...(this.isPlainObject(argumentsPayload.slots) ? argumentsPayload.slots : {}),
                        userInput: text,
                        autoToolInput: text,
                        autoToolTask: this.agentToolText(argumentsPayload.task),
                        autoToolArguments: this.cloneJsonSafe(argumentsPayload),
                        parentAgentInput: query,
                        autoToolId: tool.id,
                        autoToolName: tool.name,
                        parentAgentStepId: step.id,
                        parentAgentPath: nextPath,
                    },
                    approvals: this.isPlainObject(argumentsPayload.approvals) ? argumentsPayload.approvals : context.approvals,
                };
                const result = await this.runLlmGenComponent(toolStep, config, toolContext, targetStep.component.type === 'azureOpenAI' ? 'azure_openai' : undefined);
                this.writeAgentToolResultSlots(toolContext.slots, tool, targetStep, responseName, result);
                this.mergeAgentToolSlots(context, toolContext.slots);
                return {
                    toolId: tool.id,
                    toolName: tool.name,
                    sourceType: tool.sourceType,
                    executableType: tool.executableType,
                    targetStepId,
                    canvasFollowMode: 'tool_only',
                    output: result,
                    propagatedMessages: [],
                    trace: [{
                            stepId: targetStep.id,
                            type: targetStep.component.type,
                            result,
                        }],
                };
            }
            if (targetStep.component.type === 'mcp') {
                const toolContext = {
                    ...context,
                    input: text,
                    slots: {
                        ...this.stripAgentRuntimeSlots(context.slots || {}),
                        ...(this.isPlainObject(argumentsPayload.slots) ? argumentsPayload.slots : {}),
                        userInput: text,
                        autoToolInput: text,
                        autoToolTask: this.agentToolText(argumentsPayload.task),
                        autoToolArguments: this.cloneJsonSafe(argumentsPayload),
                        parentAgentInput: query,
                        autoToolId: tool.id,
                        autoToolName: tool.name,
                        parentAgentStepId: step.id,
                    },
                    approvals: this.isPlainObject(argumentsPayload.approvals) ? argumentsPayload.approvals : context.approvals,
                };
                const result = await this.runMcpComponent(targetStep, config, toolContext);
                const responseName = targetStep.component.responseName || targetStep.responseName || 'mcp';
                this.writeAgentToolResultSlots(toolContext.slots, tool, targetStep, responseName, result);
                this.mergeAgentToolSlots(context, toolContext.slots);
                return {
                    toolId: tool.id,
                    toolName: tool.name,
                    sourceType: tool.sourceType,
                    executableType: tool.executableType,
                    targetStepId,
                    canvasFollowMode: 'tool_only',
                    output: result,
                    propagatedMessages: [],
                    trace: [{
                            stepId: targetStep.id,
                            type: 'mcp',
                            mode: targetStep.component.mcpMode || 'fields',
                            result,
                        }],
                };
            }
            const toolConfig = {
                ...config,
                steps: (config.steps || []).map((item) => {
                    if (item.id !== targetStepId || item.type !== 'component' || item.component?.type !== 'openaiGen') {
                        return item;
                    }
                    return {
                        ...item,
                        component: {
                            ...item.component,
                            agentExecutionMode: 'flow',
                        },
                    };
                }),
            };
            const result = await this.run({
                config: toolConfig,
                flowId: context.flowId,
                flowName: context.flowName,
                entryFlowId: context.entryFlowId || context.flowId,
                activeFlowId: context.flowId,
                agentId: tool.targetAgentId || context.agentId,
                channel: context.channel,
                conversationId: `${context.conversationId || 'conv'}-subagent-${targetStepId}`,
                currentStepId: targetStepId,
                text,
                slots: {
                    ...this.stripAgentRuntimeSlots(context.slots || {}),
                    ...(this.isPlainObject(argumentsPayload.slots) ? argumentsPayload.slots : {}),
                    userInput: text,
                    autoToolInput: text,
                    autoToolTask: this.agentToolText(argumentsPayload.task),
                    autoToolArguments: this.cloneJsonSafe(argumentsPayload),
                    parentAgentInput: query,
                    autoToolId: tool.id,
                    autoToolName: tool.name,
                    parentAgentStepId: step.id,
                },
                approvals: this.isPlainObject(argumentsPayload.approvals) ? argumentsPayload.approvals : context.approvals,
                routeDepth: (context.routeDepth || 0) + 1,
                routePath: context.routePath || [],
                organizationId: context.organizationId,
                _oauthUserId: context.oauthUserId,
                _conversationOwnerId: context.conversationOwnerId,
                _langGraphRunId: `${context.langGraphRunId || 'run'}:subagent:${targetStepId}`,
                maxSteps: this.limitNumber(argumentsPayload.maxSteps ?? tool.maxSteps ?? 12, 12, 1, 80),
                maxStepVisits: this.limitNumber(argumentsPayload.maxStepVisits ?? tool.maxStepVisits ?? 3, 3, 1, 20),
                skipHistory: true,
                skipWebhookListeners: true,
                ignoreAgentRelease: true,
                traceMode: context.__traceMode || 'compact',
                traceLimit: this.limitNumber(context.__traceLimit ?? 80, 80, 0, 500),
                traceCollectLimit: this.limitNumber(context.__traceCollectLimit ?? 500, 500, 0, 5000),
            });
            this.mergeAgentToolSlots(context, result.slots);
            const propagatedMessages = (Array.isArray(result.messages) ? result.messages : [])
                .filter((message) => message && (message.kind === 'debug' || message.role === 'system'));
            return {
                toolId: tool.id,
                toolName: tool.name,
                sourceType: tool.sourceType,
                executableType: tool.executableType,
                targetStepId,
                canvasFollowMode: 'flow',
                output: {
                    messages: result.messages || [],
                    slots: this.stripAgentRuntimeSlots(result.slots || {}),
                    ended: result.ended === true,
                    currentStepId: result.currentStepId || '',
                },
                propagatedMessages,
                trace: result.trace || [],
            };
        }
        if (tool.executableType === 'flow') {
            const targetFlowId = this.agentToolText(tool.targetFlowId);
            const targetStepId = this.agentToolText(tool.targetStepId);
            if (!targetFlowId)
                throw new common_1.HttpException('Tool de fluxo sem targetFlowId.', common_1.HttpStatus.BAD_REQUEST);
            if (targetFlowId === String(context.flowId || '')) {
                throw new common_1.HttpException('Auto tool bloqueada para evitar chamar o proprio fluxo.', common_1.HttpStatus.BAD_REQUEST);
            }
            const routePath = Array.isArray(context.routePath) ? context.routePath.map((id) => String(id)) : [];
            if (routePath.includes(targetFlowId)) {
                throw new common_1.HttpException('Auto tool bloqueada por ciclo de roteamento.', common_1.HttpStatus.BAD_REQUEST);
            }
            const targetFlow = await this.canvasFlowService.findOne(targetFlowId, context.organizationId);
            const targetAgentId = this.agentToolText(tool.targetAgentId || targetFlow?.agentId || context.agentId);
            const text = this.agentToolText(argumentsPayload.text || argumentsPayload.input)
                || (tool.inputTemplate ? this.renderTemplate(tool.inputTemplate, context) : '')
                || query;
            const result = await this.run({
                flowId: targetFlowId,
                flowName: targetFlow?.name || targetFlow?.config?.title || '',
                entryFlowId: context.entryFlowId || context.flowId || targetFlowId,
                agentId: targetAgentId,
                channel: context.channel,
                conversationId: `${context.conversationId || 'conv'}-auto-${tool.id}`,
                currentStepId: targetStepId || undefined,
                text,
                slots: {
                    ...this.stripAgentRuntimeSlots(context.slots || {}),
                    ...(this.isPlainObject(argumentsPayload.slots) ? argumentsPayload.slots : {}),
                    userInput: text,
                    autoToolInput: text,
                    autoToolTask: this.agentToolText(argumentsPayload.task),
                    autoToolArguments: this.cloneJsonSafe(argumentsPayload),
                    parentAgentInput: query,
                    autoToolId: tool.id,
                    autoToolName: tool.name,
                    parentAgentStepId: step.id,
                },
                approvals: this.isPlainObject(argumentsPayload.approvals) ? argumentsPayload.approvals : context.approvals,
                routeDepth: (context.routeDepth || 0) + 1,
                routePath: [...routePath, targetFlowId],
                organizationId: context.organizationId,
                _oauthUserId: context.oauthUserId,
                _conversationOwnerId: context.conversationOwnerId,
                _langGraphRunId: `${context.langGraphRunId || 'run'}:auto:${tool.id}`,
                maxSteps: this.limitNumber(argumentsPayload.maxSteps ?? tool.maxSteps ?? 12, 12, 1, 80),
                maxStepVisits: this.limitNumber(argumentsPayload.maxStepVisits ?? tool.maxStepVisits ?? 3, 3, 1, 20),
                skipHistory: true,
                skipWebhookListeners: true,
                traceMode: context.__traceMode || 'compact',
                traceLimit: this.limitNumber(context.__traceLimit ?? 80, 80, 0, 500),
                traceCollectLimit: this.limitNumber(context.__traceCollectLimit ?? 500, 500, 0, 5000),
            });
            this.mergeAgentToolSlots(context, result.slots);
            const propagatedMessages = (Array.isArray(result.messages) ? result.messages : [])
                .filter((message) => message && (message.kind === 'debug' || message.role === 'system'));
            return {
                toolId: tool.id,
                toolName: tool.name,
                sourceType: tool.sourceType,
                executableType: tool.executableType,
                targetFlowId,
                targetStepId: targetStepId || undefined,
                targetAgentId,
                output: {
                    messages: result.messages || [],
                    slots: this.stripAgentRuntimeSlots(result.slots || {}),
                    ended: result.ended === true,
                    currentStepId: result.currentStepId || '',
                },
                propagatedMessages,
                trace: result.trace || [],
            };
        }
        if (tool.executableType === 'mcp_external') {
            const responseName = `autoTool_${String(tool.id || 'mcp').replace(/[^a-zA-Z0-9_]/g, '_')}`;
            const syntheticStep = {
                id: `${step.id}-auto-${tool.id}`,
                type: 'component',
                title: tool.name || 'MCP auto tool',
                responseName,
                component: {
                    type: 'mcp',
                    responseName,
                    mcpMode: 'external',
                    mcpToolName: tool.toolName || tool.name,
                    mcpToolDescription: tool.description || '',
                    mcpExternalUrl: tool.serverUrl,
                    mcpExternalTransport: ['streamable_http', 'sse', 'websocket'].includes(String(tool.transport))
                        ? tool.transport
                        : 'streamable_http',
                    mcpExternalOperation: 'callTool',
                    mcpExternalToolName: tool.toolName,
                    mcpExternalArgumentsJson: JSON.stringify({
                        ...(this.parseTemplatedJsonConfig(tool.argumentsJson || '{}', {}, context) || {}),
                        ...argumentsPayload,
                    }),
                    mcpExternalAuthMode: ['none', 'bearer', 'header', 'query', 'oauth', 'aws_sigv4'].includes(String(tool.authMode))
                        ? tool.authMode
                        : 'none',
                    mcpExternalOAuthConnectionScope: tool.oauthConnectionScope === 'user' ? 'user' : 'agent',
                    mcpExternalAuthHeaderName: tool.authHeaderName || 'Authorization',
                    mcpExternalAuthQueryParam: tool.authQueryParam || 'api_key',
                    mcpExternalUseLlmArguments: false,
                    mcpExternalMapResultWithLlm: true,
                    mcpExternalTimeoutMs: 30000,
                },
            };
            const result = await this.runMcpComponent(syntheticStep, config, context);
            return {
                toolId: tool.id,
                toolName: tool.name,
                sourceType: tool.sourceType,
                executableType: tool.executableType,
                output: result,
            };
        }
        throw new common_1.HttpException('Tool sem executor disponivel.', common_1.HttpStatus.BAD_REQUEST);
    }
    async runAgentAutoToolsIfEnabled(step, config, context, params) {
        const component = step.component;
        const mode = this.agentExecutionModeForComponent(component);
        if (mode === 'flow')
            return { observations: [], tracePrefix: [], messages: [] };
        const tools = this.buildAgentAutoToolCatalog(config);
        const executableTools = tools.filter((tool) => tool.executable);
        if (!executableTools.length) {
            return {
                observations: [],
                tracePrefix: [{ type: 'agentAutoTools', mode, skipped: true, reason: 'Nenhuma tool executavel configurada.' }],
                messages: [],
            };
        }
        const activeAgentPlan = this.readActiveAgentPlan(context);
        const maxCalls = this.limitNumber(activeAgentPlan?.maxToolCalls ?? component.agentMaxToolCalls ?? 1, 1, 1, 10);
        const observations = [];
        const tracePrefix = [];
        const messages = [];
        const calledToolIds = new Set();
        const planResult = await this.planAgentAutoTools({
            step,
            config,
            context,
            query: params.query,
            prompt: params.prompt,
            provider: params.provider,
            model: params.model,
            tools,
            maxCalls,
            conversationTurns: params.conversationTurns || [],
        }).catch((error) => ({
            plan: [],
            raw: {},
            error: this.getErrorMessage(error),
            reason: 'Falha ao criar plano agentico.',
        }));
        let plannedChoices = Array.isArray(planResult.plan) ? planResult.plan : [];
        const contextualRepair = plannedChoices.some((choice) => choice?.action === 'tool')
            ? null
            : this.buildAppointmentDetailToolPlanFromContext(params.query, executableTools, context);
        if (contextualRepair) {
            plannedChoices = [contextualRepair, ...plannedChoices.filter((choice) => choice?.action === 'tool')].slice(0, maxCalls);
        }
        const state = this.buildAgentTaskState(step, plannedChoices, maxCalls);
        if (planResult.error) {
            state.status = 'planning_failed';
            state.failed.push({ stage: 'planning', error: planResult.error });
        }
        context.slots.agentTaskState = state;
        tracePrefix.push({
            type: 'agentPlan',
            mode,
            stepId: step.id,
            plan: plannedChoices,
            reason: planResult.reason || '',
            error: planResult.error,
            raw: planResult.raw,
            rawText: planResult.rawText,
            validation: planResult.planValidation,
            repaired: planResult.planRepaired,
            contextualRepair,
            externalAgentPlan: planResult.externalAgentPlan,
        });
        for (let index = 0; index < maxCalls; index += 1) {
            const availableTools = tools.filter((tool) => !calledToolIds.has(tool.id));
            if (!availableTools.some((tool) => tool.executable)) {
                tracePrefix.push({ type: 'agentAutoTools', mode, stepId: step.id, stopped: true, reason: 'Todas as tools executaveis elegiveis ja foram chamadas.' });
                this.updateAgentTaskState(context, { status: observations.length ? 'completed' : 'no_tools_available' });
                break;
            }
            const plannedChoice = plannedChoices[index];
            const choice = plannedChoice?.action
                ? { ...plannedChoice, planned: true }
                : await this.chooseAgentAutoTool({
                    step,
                    config,
                    context,
                    query: params.query,
                    prompt: params.prompt,
                    provider: params.provider,
                    model: params.model,
                    tools: availableTools,
                    observations,
                    conversationTurns: params.conversationTurns || [],
                }).catch((error) => ({
                    action: 'final',
                    error: this.getErrorMessage(error),
                    reason: 'Falha ao decidir auto tool.',
                }));
            tracePrefix.push({ type: 'agentAutoTools', mode, stepId: step.id, choice });
            if (String(choice.action || '').toLowerCase() !== 'tool') {
                this.updateAgentTaskState(context, {
                    status: observations.some((item) => item?.error) ? 'completed_with_errors' : observations.length ? 'completed' : 'final',
                    finalReason: choice.reason || '',
                });
                break;
            }
            const toolId = this.agentToolText(choice.toolId || choice.tool || choice.id);
            const tool = availableTools.find((item) => item.executable && (item.id === toolId || item.name === toolId));
            if (!tool) {
                tracePrefix.push({ type: 'agentAutoTools', mode, stepId: step.id, error: `Tool "${toolId}" nao encontrada.` });
                const observation = {
                    toolId,
                    toolName: '',
                    status: 'failed',
                    error: `Tool "${toolId}" nao encontrada.`,
                };
                observations.push(observation);
                this.updateAgentTaskState(context, {
                    status: 'completed_with_errors',
                    failed: [...(context.slots.agentTaskState?.failed || []), observation],
                });
                continue;
            }
            calledToolIds.add(tool.id);
            const rawArgs = this.isPlainObject(choice.arguments) ? choice.arguments : this.isPlainObject(choice.args) ? choice.args : {};
            const approval = this.resolveAgentToolApproval(tool, context);
            if (approval.required && !approval.approved) {
                const observation = {
                    toolId: tool.id,
                    toolName: tool.name,
                    sourceType: tool.sourceType,
                    executableType: tool.executableType,
                    status: 'blocked',
                    error: 'Aprovacao requerida antes de executar esta tool.',
                    approval,
                };
                observations.push(observation);
                context.slots.agentAutoTools = observations;
                tracePrefix.push({ type: 'agentToolGuardrail', mode, stepId: step.id, toolId: tool.id, approval });
                this.updateAgentTaskState(context, {
                    status: 'blocked',
                    failed: [...(context.slots.agentTaskState?.failed || []), observation],
                    pending: (context.slots.agentTaskState?.pending || []).filter((item) => item.toolId !== tool.id),
                });
                break;
            }
            const preparedArgs = await this.prepareAgentToolArgumentsWithContract({
                step,
                config,
                context,
                query: params.query,
                prompt: params.prompt,
                provider: params.provider,
                model: params.model,
                tool,
                choice,
                rawArgs,
                observations,
                conversationTurns: params.conversationTurns || [],
            }).catch((error) => ({
                arguments: rawArgs,
                validation: this.validateAgentToolArguments(tool, rawArgs),
                initialValidation: this.validateAgentToolArguments(tool, rawArgs),
                generated: false,
                error: this.getErrorMessage(error),
            }));
            if (preparedArgs.generated || preparedArgs.error || !preparedArgs.initialValidation?.ok) {
                tracePrefix.push({
                    type: 'agentToolArgumentContract',
                    mode,
                    stepId: step.id,
                    toolId: tool.id,
                    generated: preparedArgs.generated === true,
                    model: preparedArgs.model,
                    reason: preparedArgs.reason,
                    error: preparedArgs.error,
                    initialOk: preparedArgs.initialValidation?.ok,
                    initialErrors: preparedArgs.initialValidation?.errors,
                    ok: preparedArgs.validation?.ok,
                    errors: preparedArgs.validation?.errors,
                    rawText: preparedArgs.rawText,
                });
            }
            const finalArgs = this.isPlainObject(preparedArgs.arguments) ? preparedArgs.arguments : rawArgs;
            const validation = preparedArgs.validation || this.validateAgentToolArguments(tool, finalArgs);
            tracePrefix.push({
                type: 'agentToolContract',
                mode,
                stepId: step.id,
                toolId: tool.id,
                ok: validation.ok,
                errors: validation.errors,
                schema: validation.schema,
            });
            if (!validation.ok) {
                const observation = {
                    toolId: tool.id,
                    toolName: tool.name,
                    sourceType: tool.sourceType,
                    executableType: tool.executableType,
                    status: 'validation_failed',
                    error: 'Argumentos invalidos para o contrato da tool.',
                    validation,
                };
                observations.push(observation);
                context.slots.agentAutoTools = observations;
                this.updateAgentTaskState(context, {
                    status: 'completed_with_errors',
                    failed: [...(context.slots.agentTaskState?.failed || []), observation],
                    pending: (context.slots.agentTaskState?.pending || []).filter((item) => item.toolId !== tool.id),
                });
                continue;
            }
            const startedAt = Date.now();
            const maxRetries = this.limitNumber(tool.maxRetries ?? 0, 0, 0, 3);
            let observation;
            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                observation = await this.executeAgentAutoTool(tool, finalArgs, step, config, context, params.query)
                    .then((result) => ({
                    ...result,
                    status: result?.error ? 'failed' : 'completed',
                    durationMs: Date.now() - startedAt,
                    attempts: attempt + 1,
                    arguments: finalArgs,
                }))
                    .catch((error) => ({
                    toolId: tool.id,
                    toolName: tool.name,
                    sourceType: tool.sourceType,
                    executableType: tool.executableType,
                    status: 'failed',
                    durationMs: Date.now() - startedAt,
                    attempts: attempt + 1,
                    arguments: finalArgs,
                    error: this.getErrorMessage(error),
                }));
                if (!observation?.error && observation?.status !== 'failed')
                    break;
                if (attempt < maxRetries) {
                    tracePrefix.push({
                        type: 'agentToolRetry',
                        mode,
                        stepId: step.id,
                        toolId: tool.id,
                        attempt: attempt + 1,
                        nextAttempt: attempt + 2,
                        error: observation?.error || 'Falha na tool.',
                    });
                }
            }
            if (!observation?.error) {
                const outputValidation = this.validateAgentToolOutput(tool, observation?.output);
                tracePrefix.push({
                    type: 'agentToolOutputContract',
                    mode,
                    stepId: step.id,
                    toolId: tool.id,
                    ok: outputValidation.ok,
                    errors: outputValidation.errors,
                    schema: outputValidation.schema,
                });
                if (!outputValidation.ok) {
                    observation = {
                        ...observation,
                        status: 'output_validation_failed',
                        error: 'Output invalido para o contrato da tool.',
                        outputValidation,
                    };
                }
            }
            observations.push(observation);
            context.slots.agentAutoTools = observations;
            const completed = observations
                .filter((item) => !item?.error && item?.status !== 'blocked' && item?.status !== 'validation_failed')
                .map((item) => ({ toolId: item.toolId, toolName: item.toolName, status: item.status, durationMs: item.durationMs }));
            const failed = observations
                .filter((item) => item?.error || item?.status === 'blocked' || item?.status === 'validation_failed')
                .map((item) => ({ toolId: item.toolId, toolName: item.toolName, status: item.status, error: item.error, validation: item.validation }));
            const pending = (context.slots.agentTaskState?.pending || []).filter((item) => item.toolId !== tool.id);
            this.updateAgentTaskState(context, {
                status: failed.length ? 'running_with_errors' : 'running',
                completed,
                failed,
                pending,
            });
            if (Array.isArray(observation.propagatedMessages)) {
                observation.propagatedMessages.forEach((message) => {
                    if (message && typeof message.text === 'string') {
                        messages.push({
                            role: String(message.role || 'system'),
                            text: message.text,
                            kind: message.kind,
                            debug: message.debug,
                            content: message.content,
                        });
                    }
                });
            }
            tracePrefix.push({ type: 'agentAutoToolResult', mode, stepId: step.id, result: observation });
        }
        context.slots.agentAutoTools = observations;
        const finalFailed = observations.filter((item) => item?.error || item?.status === 'blocked' || item?.status === 'validation_failed');
        this.updateAgentTaskState(context, {
            status: context.slots.agentTaskState?.status === 'blocked'
                ? 'blocked'
                : finalFailed.length
                    ? 'completed_with_errors'
                    : observations.length
                        ? 'completed'
                        : context.slots.agentTaskState?.status || 'final',
        });
        this.markAgentPlanConsumed(context, step, activeAgentPlan);
        return { observations, tracePrefix, messages, state: context.slots.agentTaskState };
    }
    getRichMessageText(content) {
        if (!content)
            return '';
        if (content.type === 'image' || content.type === 'document') {
            return String(content.media?.caption || content.text || content.media?.url || '').trim();
        }
        if (content.type === 'carousel') {
            const cards = content.carousel?.cards || [];
            const cardText = cards
                .map((card) => [card.title, card.subtitle].filter(Boolean).join(' - '))
                .filter(Boolean)
                .join('\n');
            return [content.text, cardText].filter(Boolean).join('\n');
        }
        return String(content.text || '').trim();
    }
    async getChatModel(model) {
        await this.refreshOpenAIClient();
        return (0, openai_provider_1.getOpenAIChatModel)(this.configService, model, this.openAIRuntimeConfig);
    }
    limitText(value, maxLength, fallback = '') {
        const raw = value === undefined || value === null || value === '' ? fallback : value;
        return String(raw || '').slice(0, maxLength);
    }
    limitId(value, maxLength, fallback) {
        const raw = value === undefined || value === null || value === '' ? fallback : value;
        return String(raw || fallback).replace(/\s+/g, '_').slice(0, maxLength);
    }
    richMaxItems(type) {
        if (type === 'buttons' || type === 'quickReplies')
            return WHATSAPP_LIMITS.buttons;
        if (type === 'list' || type === 'appointmentFlow')
            return WHATSAPP_LIMITS.listRows;
        if (type === 'carousel')
            return WHATSAPP_LIMITS.carouselCards;
        return 1;
    }
    getRichMediaUrl(content) {
        const legacy = content;
        return String(content.media?.url ||
            legacy.mediaUrl ||
            legacy.imageUrl ||
            legacy.documentUrl ||
            '').trim();
    }
    getRichMediaCaption(content) {
        return this.limitText(content.media?.caption || content.text || '', WHATSAPP_LIMITS.interactiveBody);
    }
    getRichMediaFileName(content, fallback) {
        const legacy = content;
        return String(content.media?.fileName || legacy.fileName || fallback).trim() || fallback;
    }
    getRichMediaMimeType(content, fallback) {
        const legacy = content;
        return String(content.media?.mimeType || legacy.mimeType || fallback).trim() || fallback;
    }
    mediaTypeFromUrlOrMime(mimeType, urlOrName, fallback) {
        const source = `${String(mimeType || '')} ${String(urlOrName || '')}`.toLowerCase();
        if (source.includes('png'))
            return 'PNG';
        if (source.includes('jpeg') || source.includes('jpg'))
            return 'JPG';
        if (source.includes('gif'))
            return 'GIF';
        if (source.includes('webp'))
            return 'WEBP';
        if (source.includes('pdf'))
            return 'PDF';
        if (source.includes('csv'))
            return 'CSV';
        if (source.includes('docx'))
            return 'DOCX';
        if (source.includes('doc'))
            return 'DOC';
        if (source.includes('xlsx'))
            return 'XLSX';
        if (source.includes('xls'))
            return 'XLS';
        return fallback;
    }
    parseGeneratedJson(value) {
        const raw = String(value || '').trim();
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match)
                return null;
            try {
                return JSON.parse(match[0]);
            }
            catch {
                return null;
            }
        }
    }
    isPlainObject(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }
    assertContextPayload(value, source) {
        if (!this.isPlainObject(value)) {
            throw new common_1.HttpException(`${source} deve retornar um objeto JSON no topo.`, common_1.HttpStatus.BAD_REQUEST);
        }
        return value;
    }
    runContextScript(script, context) {
        const raw = String(script || '').trim();
        if (!raw)
            return {};
        const body = /\breturn\b/.test(raw) ? raw : `return (${raw});`;
        try {
            return new Function('context', 'slots', 'input', 'now', body)(context, context.slots || {}, context.input, context.now);
        }
        catch (error) {
            throw new common_1.HttpException(`Script do Contexto falhou: ${this.getErrorMessage(error)}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async generateContextPayloadWithLlm(component, config, context) {
        const instruction = this.renderTemplate(component.contextLlmPrompt || '', context);
        if (!String(instruction || '').trim())
            return {};
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), component.contextLlmModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce gera um objeto JSON para atualizar context.slots em um fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        'O topo da resposta deve ser um objeto cujas chaves serao mescladas em context.slots.',
                        'Nao retorne arrays ou textos soltos no topo.',
                        'Use somente o contexto recebido. Nao invente dados.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        context: {
                            channel: context.channel,
                            conversationId: context.conversationId,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(component.contextLlmTemperature ?? 0.2) || 0, 1)),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        if (this.isPlainObject(parsed?.slots) && Object.keys(parsed).length === 1) {
            return parsed.slots;
        }
        return parsed;
    }
    normalizeGeneratedContextScript(value) {
        const raw = String(value || '').trim();
        return raw
            .replace(/^```(?:javascript|js)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
    }
    assertContextScriptSyntax(code) {
        const raw = String(code || '').trim();
        if (!raw) {
            throw new common_1.HttpException('A LLM nao retornou codigo JS.', common_1.HttpStatus.BAD_REQUEST);
        }
        const body = /\breturn\b/.test(raw) ? raw : `return (${raw});`;
        try {
            new Function('context', 'slots', 'input', 'now', body);
        }
        catch (error) {
            throw new common_1.HttpException(`Codigo JS gerado com sintaxe invalida: ${this.getErrorMessage(error)}`, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async generateContextScriptWithLlm(body) {
        const instruction = String(body?.instruction || '').trim();
        if (!instruction) {
            throw new common_1.HttpException('Descreva o codigo que a LLM deve gerar.', common_1.HttpStatus.BAD_REQUEST);
        }
        const currentCode = String(body?.currentCode || '').trim();
        const scriptPurpose = String(body?.scriptPurpose || 'context').trim();
        const isConditionScript = scriptPurpose === 'condition' || scriptPurpose === 'edgeCondition';
        const provider = this.flowLlmProvider(undefined, body?.llmProvider);
        const model = await this.getChatModelForProvider(provider, body?.model, body?.agentId);
        const temperature = Math.max(0, Math.min(Number(body?.temperature ?? 0.2) || 0, 1));
        const systemInstructions = isConditionScript
            ? [
                'Voce gera codigo JavaScript para uma condicao de ligacao entre nos de um fluxo conversacional.',
                'Responda somente JSON valido, sem markdown.',
                'Formato obrigatorio: {"code": "codigo JS", "explanation": "resumo curto em pt-BR"}.',
                'O codigo deve ser sincrono e deve retornar booleano usando return true; ou return false;.',
                'O runtime disponibiliza: context, slots, input e now.',
                'slots e o mesmo objeto de context.slots.',
                'Se a origem for um componente Loop, o slot de contador do Loop comeca em 1; o indice zero-based fica em slots.<slotDoLoop>.index.',
                'Quando sourceStep.loopCounterSlot existir, use exatamente slots[sourceStep.loopCounterSlot] ou slots.nomeDoSlot. Nao invente o nome contador se ele nao estiver no sourceStep.',
                'Se conditionValidationPath existir, use esse caminho como fonte principal da validacao.',
                'Se availableSlots existir, use somente esses slots. Nao invente slots como contador, cpf ou cliente quando nao aparecerem em availableSlots.',
                'Use somente dados do contexto recebido. Nao invente dados.',
                'Nao use imports, require, fetch, await, timers, acesso a arquivos ou variaveis globais externas.',
                'Use if, else, for, map, reduce e helpers nativos quando fizer sentido.',
                'Nao envolva o codigo em funcao. Gere somente o corpo do script.',
            ]
            : [
                'Voce gera codigo JavaScript para o componente Contexto de um fluxo conversacional.',
                'Responda somente JSON valido, sem markdown.',
                'Formato obrigatorio: {"code": "codigo JS", "explanation": "resumo curto em pt-BR"}.',
                'O codigo deve ser sincrono e deve retornar um objeto JSON no topo usando return { ... };',
                'O runtime disponibiliza: context, slots, input e now.',
                'slots e o mesmo objeto de context.slots.',
                'Nao use imports, require, fetch, await, timers, acesso a arquivos ou variaveis globais externas.',
                'Use for, if, map, reduce e helpers nativos quando fizer sentido.',
                'Nao envolva o codigo em funcao. Gere somente o corpo do script.',
            ];
        const examples = isConditionScript
            ? [
                {
                    instruction: 'Seguir apenas quando o CPF informado tiver 11 digitos',
                    code: 'const cpf = String(slots.cpf || input || "").replace(/\\D/g, "");\nreturn cpf.length === 11;',
                },
                {
                    instruction: 'Seguir para maioridade quando a API retornar maiorIdade true',
                    code: 'const cliente = slots.cliente || {};\nif (!cliente.encontrado) return false;\nreturn cliente.maiorIdade === true;',
                },
            ]
            : [
                {
                    instruction: 'Criar lead com nome e email vindos do input',
                    code: 'const raw = String(input || "").trim();\nreturn {\n  lead: {\n    raw,\n    email: slots.email || "",\n    source: "context-node"\n  }\n};',
                },
                {
                    instruction: 'Normalizar itens e calcular total',
                    code: 'const items = Array.isArray(slots.items) ? slots.items : [];\nconst normalized = items.map((item) => ({\n  name: String(item.name || item.nome || "").trim(),\n  price: Number(item.price || item.preco || 0)\n}));\nreturn {\n  items: normalized,\n  total: normalized.reduce((sum, item) => sum + item.price, 0)\n};',
                },
            ];
        const completion = await (await this.getOpenAIClientForProvider(provider, body?.agentId)).chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: systemInstructions.join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        currentCode,
                        flowTitle: body?.flowTitle || '',
                        stepTitle: body?.stepTitle || '',
                        sourceTitle: body?.sourceTitle || '',
                        targetTitle: body?.targetTitle || '',
                        sourceStep: body?.sourceStep || null,
                        targetStep: body?.targetStep || null,
                        conditionValidationPath: body?.conditionValidationPath || '',
                        conditionValidationType: body?.conditionValidationType || '',
                        availableSlots: Array.isArray(body?.availableSlots) ? body.availableSlots : [],
                        purpose: isConditionScript ? 'edge-condition' : 'context-json',
                        examples,
                    }, null, 2),
                },
            ],
            temperature,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        const code = this.normalizeGeneratedContextScript(parsed?.code || parsed?.script || parsed?.javascript || '');
        this.assertContextScriptSyntax(code);
        return {
            code,
            explanation: this.limitText(parsed?.explanation || parsed?.resumo || parsed?.notes, 800),
            model,
        };
    }
    stripUndefinedMongoFields(payload) {
        return Object.entries(payload).reduce((acc, [key, value]) => {
            if (value === undefined || value === null || value === '')
                return acc;
            acc[key] = value;
            return acc;
        }, {});
    }
    assertSafeGeneratedMongoConfig(payload) {
        const raw = JSON.stringify(payload || {});
        if (/\$where\b|\$function\b|\$accumulator\b|\$out\b|\$merge\b/i.test(raw)) {
            throw new common_1.HttpException('A LLM gerou operadores MongoDB nao permitidos.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async generateMongoConfigWithLlm(body) {
        const instruction = String(body?.instruction || '').trim();
        if (!instruction) {
            throw new common_1.HttpException('Descreva o filtro, documento ou pipeline que a LLM deve gerar.', common_1.HttpStatus.BAD_REQUEST);
        }
        const operation = String(body?.operation || 'find');
        const provider = this.flowLlmProvider(undefined, body?.llmProvider);
        const model = await this.getChatModelForProvider(provider, body?.model, body?.agentId);
        const temperature = Math.max(0, Math.min(Number(body?.temperature ?? 0.1) || 0, 1));
        const completion = await (await this.getOpenAIClientForProvider(provider, body?.agentId)).chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce ajuda a montar campos MongoDB para um componente visual de fluxo.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato permitido: {"filter": {}, "sort": {}, "projection": {}, "pipeline": [], "document": {}, "documents": [], "update": {}, "dateRange": {"field": "createdAt", "start": "", "end": "", "timezone": "America/Sao_Paulo"}, "pagination": {"mode": "single|all", "page": 1, "limit": 50, "skip": 0, "maxPages": 5}, "explanation": "resumo curto em pt-BR"}.',
                        'Gere apenas os campos relevantes para a operation recebida.',
                        'Use variaveis dinamicas no formato {{context.slots.nome}} quando o valor vier do fluxo.',
                        'Para find/count/findOne/delete use filter, sort e projection quando fizer sentido.',
                        'Para aggregate use pipeline e opcionalmente filter como $match inicial.',
                        'Para insertOne use document. Para insertMany use documents.',
                        'Para updateOne/updateMany/upsertOne use filter e update.',
                        'Nao use $where, javascript, funcoes, $out ou $merge.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        operation,
                        collectionName: body?.collectionName || 'flow_events',
                        flowTitle: body?.flowTitle || '',
                        stepTitle: body?.stepTitle || '',
                        currentConfig: body?.currentConfig || {},
                        examples: [
                            {
                                instruction: 'Buscar leads convertidos hoje',
                                output: {
                                    filter: {
                                        status: 'convertido',
                                    },
                                    sort: { createdAt: -1 },
                                    dateRange: {
                                        field: 'createdAt',
                                        start: '{{context.slots.todayStart}}',
                                        end: '{{context.slots.todayEnd}}',
                                        timezone: 'America/Sao_Paulo',
                                    },
                                },
                            },
                            {
                                instruction: 'Atualizar lead pelo email do contexto',
                                output: {
                                    filter: { email: '{{context.slots.email}}' },
                                    update: {
                                        $set: {
                                            status: 'convertido',
                                            updatedAt: '{{context.now}}',
                                        },
                                    },
                                },
                            },
                        ],
                    }, null, 2),
                },
            ],
            temperature,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        const result = this.stripUndefinedMongoFields({
            filter: parsed.filter,
            sort: parsed.sort,
            projection: parsed.projection,
            pipeline: parsed.pipeline,
            document: parsed.document,
            documents: parsed.documents,
            update: parsed.update,
            dateRange: parsed.dateRange,
            pagination: parsed.pagination,
        });
        this.assertSafeGeneratedMongoConfig(result);
        return {
            ...result,
            explanation: this.limitText(parsed.explanation || parsed.resumo || parsed.notes, 800),
            model,
        };
    }
    normalizeAssistantSlug(value, fallback) {
        const normalized = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80);
        return normalized || fallback;
    }
    uniqueAssistantId(value, prefix, index, usedIds) {
        const safePrefix = this.normalizeAssistantSlug(prefix, 'step');
        const base = this.normalizeAssistantSlug(value, `${safePrefix}_${index + 1}`);
        let candidate = /^[a-z]/.test(base) ? base : `${safePrefix}_${base}`;
        let suffix = 2;
        while (usedIds.has(candidate)) {
            candidate = `${base}_${suffix}`;
            suffix += 1;
        }
        usedIds.add(candidate);
        return candidate;
    }
    normalizeAssistantVariableName(value, fallback) {
        const normalized = this.normalizeAssistantSlug(value, fallback).replace(/-/g, '_');
        return /^[a-zA-Z_$]/.test(normalized) ? normalized : `slot_${normalized}`;
    }
    normalizeAssistantPosition(value, index) {
        const x = Number(value?.x);
        const y = Number(value?.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            return {
                x: Math.round(x),
                y: Math.round(y),
            };
        }
        return {
            x: 120 + (index % 4) * 270,
            y: 160 + Math.floor(index / 4) * 190,
        };
    }
    normalizeAssistantSearchText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    assistantTextMatchesMcpPreset(value, preset) {
        const normalized = ` ${this.normalizeAssistantSearchText(value)} `;
        return preset.aliases.some((alias) => normalized.includes(` ${this.normalizeAssistantSearchText(alias)} `));
    }
    assistantMcpPresetsForInstruction(instruction) {
        const matches = ASSISTANT_MCP_REMOTE_PRESETS.filter((preset) => this.assistantTextMatchesMcpPreset(instruction, preset));
        const normalized = this.normalizeAssistantSearchText(instruction);
        const requestsAwsInfrastructure = matches.some((preset) => preset.id === 'aws-mcp');
        const requestsAwsDocumentation = /\b(documentacao|documentacao aws|docs?|knowledge|referencias?)\b/.test(normalized);
        return requestsAwsInfrastructure && !requestsAwsDocumentation
            ? matches.filter((preset) => preset.id !== 'aws-knowledge')
            : matches;
    }
    assistantMcpPresetPromptCatalog() {
        return ASSISTANT_MCP_REMOTE_PRESETS.map((preset) => ({
            id: preset.id,
            label: preset.label,
            serverUrl: preset.serverUrl,
            authMode: preset.authMode,
            capability: preset.capability,
        }));
    }
    assistantStepMatchesMcpPreset(step, preset) {
        if (!step)
            return false;
        const component = step.component || {};
        if (String(component.mcpExternalUrl || '').trim() === preset.serverUrl)
            return true;
        return this.assistantTextMatchesMcpPreset([
            step.id,
            step.title,
            step.instruction,
            step.responseName,
            component.responseName,
            component.prompt,
            component.mcpToolName,
            component.mcpToolDescription,
            component.mcpInstruction,
        ].filter(Boolean).join(' '), preset);
    }
    assistantCatalogItemMatchesMcpPreset(item, preset) {
        if (!this.isPlainObject(item))
            return false;
        if (String(item.serverUrl || item.mcpExternalUrl || item.url || '').trim() === preset.serverUrl)
            return true;
        return this.assistantTextMatchesMcpPreset([
            item.id,
            item.name,
            item.label,
            item.description,
            item.instructions,
            item.instruction,
        ].filter(Boolean).join(' '), preset);
    }
    assistantArchitectureStepId(steps, value) {
        const used = new Set(steps.map((step) => step.id));
        const base = this.normalizeAssistantSlug(value, 'step');
        let candidate = base;
        let suffix = 2;
        while (used.has(candidate)) {
            candidate = `${base}_${suffix}`;
            suffix += 1;
        }
        return candidate;
    }
    upsertAssistantArchitectureEdge(edges, source, target, edgeRole) {
        if (!source || !target || source === target)
            return;
        const exists = edges.some((edge) => edge.source === source && edge.target === target && edge.edgeRole === edgeRole);
        if (exists)
            return;
        const used = new Set(edges.map((edge) => edge.id));
        const base = this.normalizeAssistantSlug(`${edgeRole || 'flow'}_${source}_${target}`, 'edge');
        let id = base;
        let suffix = 2;
        while (used.has(id)) {
            id = `${base}_${suffix}`;
            suffix += 1;
        }
        edges.push({
            id,
            source,
            target,
            ...(edgeRole ? { edgeRole } : {}),
        });
    }
    upsertAssistantManifestRef(refs, ref) {
        const items = Array.isArray(refs) ? refs.filter((item) => this.isPlainObject(item)).map((item) => ({ ...item })) : [];
        const index = items.findIndex((item) => (String(item.id || '').trim() === String(ref.id || '').trim()
            || String(item.targetStepId || item.stepId || item.nodeId || '').trim() === String(ref.targetStepId || '').trim()));
        if (index >= 0) {
            items[index] = { ...ref, ...items[index], targetStepId: items[index].targetStepId || ref.targetStepId };
            return items;
        }
        return [...items, ref];
    }
    upsertAssistantCatalogItem(items, item, preset) {
        const catalog = Array.isArray(items) ? items.filter((entry) => this.isPlainObject(entry)).map((entry) => ({ ...entry })) : [];
        const index = catalog.findIndex((entry) => (String(entry.id || '').trim() === String(item.id || '').trim()
            || String(entry.targetStepId || entry.stepId || entry.nodeId || '').trim() === String(item.targetStepId || '').trim()
            || this.assistantCatalogItemMatchesMcpPreset(entry, preset)));
        if (index >= 0) {
            catalog[index] = {
                ...item,
                ...catalog[index],
                targetStepId: catalog[index].targetStepId || item.targetStepId,
                serverUrl: catalog[index].serverUrl || catalog[index].mcpExternalUrl || item.serverUrl,
                mcpExternalUrl: catalog[index].mcpExternalUrl || catalog[index].serverUrl || item.mcpExternalUrl,
            };
            return catalog;
        }
        return [...catalog, item];
    }
    ensureAssistantMcpArchitecture(config, instruction, scopeMode) {
        const presets = this.assistantMcpPresetsForInstruction(instruction);
        if (scopeMode !== 'fullFlow' || !presets.length)
            return { config, warnings: [] };
        const steps = [...(config.steps || [])];
        const edges = [...(config.edges || [])];
        const originalStartStepId = String(config.startStepId || '').trim();
        const warnings = [];
        const spec = this.isPlainObject(config.agentSpec) ? { ...config.agentSpec } : {};
        let skills = Array.isArray(spec.skills) ? [...spec.skills] : [];
        let mcpServers = Array.isArray(spec.mcpServers) ? [...spec.mcpServers] : [];
        let plan = steps.find((step) => step.component?.type === 'agentPlan');
        let orchestrator = steps.find((step) => step.component?.type === 'openaiGen' && step.component.agentRole === 'orchestrator');
        const planWasAdded = !plan;
        const orchestratorWasAdded = !orchestrator;
        if (!plan) {
            const id = this.assistantArchitectureStepId(steps, 'agent_plan');
            plan = {
                id,
                type: 'component',
                title: 'Agent Plan',
                instruction: 'Planeje a solicitacao, escolha a skill especialista adequada e descubra as tools MCP antes da execucao.',
                responseName: 'agentPlan',
                position: this.normalizeAssistantPosition(undefined, steps.length),
                component: {
                    type: 'agentPlan',
                    responseName: 'agentPlan',
                    agentPlanMode: 'advisory',
                    agentPlanInstructions: [
                        'Entenda a intencao do usuario antes de executar integracoes externas.',
                        'Delegue tarefas de integracao para a skill especialista correspondente.',
                        'Use listTools quando a tool exata do servidor MCP ainda nao estiver confirmada.',
                        'Nao invente argumentos, dados ou resultados de ferramentas.',
                    ].join('\n'),
                    agentPlanJson: '{\n  "plan": []\n}',
                    agentPlanMaxToolCalls: 3,
                    agentPlanClearAfterUse: true,
                },
            };
            steps.push(plan);
        }
        if (!orchestrator) {
            const id = this.assistantArchitectureStepId(steps, 'agente_orquestrador');
            orchestrator = {
                id,
                type: 'component',
                title: 'Agente orquestrador',
                instruction: 'Coordene o plano, delegue para skills especialistas e use MCP somente quando necessario.',
                responseName: 'agenteOrquestrador',
                position: this.normalizeAssistantPosition(undefined, steps.length),
                component: {
                    type: 'openaiGen',
                    responseName: 'agenteOrquestrador',
                    agentRole: 'orchestrator',
                    agentUseWorkspaceCatalog: true,
                    agentExecutionMode: 'hybrid',
                    agentMaxToolCalls: 3,
                    queryTemplate: '{{context.input}}',
                    prompt: 'Siga o Agent Plan. Delegue para a skill especialista adequada e responda sem inventar dados de MCP.',
                    agentSpec: {
                        agentsMd: '# Agente orquestrador\nCoordena o plano, seleciona skills especialistas e aciona MCP sob demanda.',
                        guardrails: 'Nao invente dados externos. Use somente resultados retornados pelas tools MCP configuradas.',
                        blockedTerms: [],
                    },
                    agentManifest: {
                        rules: [],
                        skills: [],
                        subagents: [],
                        mcpServers: [],
                    },
                },
            };
            steps.push(orchestrator);
        }
        this.upsertAssistantArchitectureEdge(edges, plan.id, orchestrator.id);
        const originalStart = steps.find((step) => step.id === originalStartStepId);
        const canResumeOriginalStart = originalStart
            && originalStart.id !== plan.id
            && originalStart.id !== orchestrator.id
            && originalStart.component?.type !== 'mcp'
            && originalStart.component?.type !== 'agentPlan'
            && !(originalStart.component?.type === 'openaiGen' && originalStart.component.agentRole === 'subagent');
        if ((planWasAdded || orchestratorWasAdded) && canResumeOriginalStart) {
            const hasFlowOutgoing = edges.some((edge) => edge.source === orchestrator?.id && edge.edgeRole !== 'manifest');
            if (!hasFlowOutgoing)
                this.upsertAssistantArchitectureEdge(edges, orchestrator.id, originalStart.id);
        }
        const usedMcpStepIds = new Set();
        const usedSkillStepIds = new Set();
        presets.forEach((preset) => {
            let mcpStep = steps.find((step) => (step.component?.type === 'mcp'
                && !usedMcpStepIds.has(step.id)
                && this.assistantStepMatchesMcpPreset(step, preset)));
            if (!mcpStep && presets.length === 1) {
                mcpStep = steps.find((step) => (step.component?.type === 'mcp'
                    && !usedMcpStepIds.has(step.id)
                    && !String(step.component.mcpExternalUrl || '').trim()));
            }
            if (!mcpStep) {
                const id = this.assistantArchitectureStepId(steps, `mcp_${preset.id}`);
                mcpStep = {
                    id,
                    type: 'component',
                    title: `MCP ${preset.label}`,
                    instruction: `Conecte ao MCP ${preset.label} para ${preset.capability}. Liste as tools antes de configurar a chamada final.`,
                    responseName: this.normalizeAssistantVariableName(`mcp_${preset.id}`, 'mcp'),
                    position: this.normalizeAssistantPosition(undefined, steps.length),
                    component: {
                        type: 'mcp',
                        responseName: this.normalizeAssistantVariableName(`mcp_${preset.id}`, 'mcp'),
                    },
                };
                steps.push(mcpStep);
            }
            usedMcpStepIds.add(mcpStep.id);
            const currentMcp = mcpStep.component || { type: 'mcp' };
            const mcpResponseName = this.normalizeAssistantVariableName(currentMcp.responseName || mcpStep.responseName || `mcp_${preset.id}`, 'mcp');
            const mcpOperation = currentMcp.mcpExternalOperation === 'callTool' && String(currentMcp.mcpExternalToolName || '').trim()
                ? 'callTool'
                : currentMcp.mcpExternalOperation && currentMcp.mcpExternalOperation !== 'callTool'
                    ? currentMcp.mcpExternalOperation
                    : 'listTools';
            mcpStep.type = 'component';
            mcpStep.title = mcpStep.title || `MCP ${preset.label}`;
            mcpStep.instruction = mcpStep.instruction || `Conecte ao MCP ${preset.label} para ${preset.capability}.`;
            mcpStep.responseName = mcpResponseName;
            mcpStep.component = {
                ...currentMcp,
                type: 'mcp',
                responseName: mcpResponseName,
                mcpMode: 'external',
                mcpToolName: currentMcp.mcpToolName || `mcp_${preset.id}`,
                mcpToolDescription: currentMcp.mcpToolDescription || `Integra com ${preset.label} para ${preset.capability}.`,
                mcpInstruction: currentMcp.mcpInstruction || `Use apenas tools descobertas no servidor MCP ${preset.label}. Nao invente argumentos nem resultados.`,
                mcpInputSchema: currentMcp.mcpInputSchema || '{}',
                mcpOutputSchema: currentMcp.mcpOutputSchema || '{}',
                mcpExternalTransport: currentMcp.mcpExternalTransport || 'streamable_http',
                mcpExternalUrl: currentMcp.mcpExternalUrl || preset.serverUrl,
                mcpExternalHeadersJson: currentMcp.mcpExternalHeadersJson || '{}',
                mcpExternalAuthMode: currentMcp.mcpExternalAuthMode && currentMcp.mcpExternalAuthMode !== 'none'
                    ? currentMcp.mcpExternalAuthMode
                    : preset.authMode,
                mcpExternalOAuthConnectionScope: currentMcp.mcpExternalOAuthConnectionScope
                    || (preset.authMode === 'oauth' ? 'user' : 'agent'),
                mcpExternalAuthHeaderName: currentMcp.mcpExternalAuthHeaderName || 'Authorization',
                mcpExternalAuthQueryParam: currentMcp.mcpExternalAuthQueryParam || 'api_key',
                mcpExternalOperation: mcpOperation,
                mcpExternalToolName: currentMcp.mcpExternalToolName || '',
                mcpExternalArgumentsJson: currentMcp.mcpExternalArgumentsJson || '{}',
                mcpExternalPromptArgumentsJson: currentMcp.mcpExternalPromptArgumentsJson || '{}',
                mcpExternalUseLlmArguments: currentMcp.mcpExternalUseLlmArguments !== false,
                mcpExternalMapResultWithLlm: currentMcp.mcpExternalMapResultWithLlm !== false,
                mcpExternalTimeoutMs: currentMcp.mcpExternalTimeoutMs || 30000,
            };
            const mcpCatalogId = `mcp:${preset.id}`;
            const mcpRef = {
                id: mcpCatalogId,
                name: `MCP ${preset.label}`,
                description: `Servidor remoto para ${preset.capability}.`,
                targetStepId: mcpStep.id,
                source: 'canvas',
                load: 'on_demand',
            };
            mcpServers = this.upsertAssistantCatalogItem(mcpServers, {
                ...mcpRef,
                label: `MCP ${preset.label}`,
                path: '.canvas-flow/mcp.json',
                serverUrl: preset.serverUrl,
                mcpExternalUrl: preset.serverUrl,
                transport: 'streamable_http',
                mcpExternalTransport: 'streamable_http',
                authMode: preset.authMode,
                mcpExternalAuthMode: preset.authMode,
                oauthConnectionScope: preset.authMode === 'oauth' ? 'user' : 'agent',
                mcpExternalOAuthConnectionScope: preset.authMode === 'oauth' ? 'user' : 'agent',
                enabled: true,
                sideEffect: 'read',
                requiresApproval: false,
                inputSchema: {},
                outputSchema: {},
            }, preset);
            let skillStep = steps.find((step) => (step.component?.type === 'openaiGen'
                && step.component.agentRole === 'subagent'
                && !usedSkillStepIds.has(step.id)
                && this.assistantStepMatchesMcpPreset(step, preset)));
            if (!skillStep && presets.length === 1) {
                skillStep = steps.find((step) => (step.component?.type === 'openaiGen'
                    && step.component.agentRole === 'subagent'
                    && !usedSkillStepIds.has(step.id)));
            }
            if (!skillStep) {
                const id = this.assistantArchitectureStepId(steps, `skill_${preset.id}`);
                skillStep = {
                    id,
                    type: 'component',
                    title: `Skill especialista ${preset.label}`,
                    instruction: `Especialista em ${preset.label}: entenda a tarefa delegada, use o MCP correspondente e normalize a resposta para o orquestrador.`,
                    responseName: this.normalizeAssistantVariableName(`skill_${preset.id}`, 'skill'),
                    position: this.normalizeAssistantPosition(undefined, steps.length),
                    component: {
                        type: 'openaiGen',
                        responseName: this.normalizeAssistantVariableName(`skill_${preset.id}`, 'skill'),
                        agentRole: 'subagent',
                        agentUseWorkspaceCatalog: true,
                        agentExecutionMode: 'auto_tools',
                        agentMaxToolCalls: 3,
                        queryTemplate: '{{context.input}}',
                        prompt: `Atue como especialista em ${preset.label}. Use o MCP configurado sob demanda e nunca invente dados externos.`,
                        agentSpec: {
                            agentsMd: `# Skill especialista ${preset.label}\nExecuta tarefas delegadas sobre ${preset.label} usando o MCP remoto configurado.`,
                            guardrails: 'Nao invente resultados externos. Retorne lacunas e erros de integracao de forma explicita.',
                            blockedTerms: [],
                        },
                        agentManifest: {
                            rules: [],
                            skills: [],
                            subagents: [],
                            mcpServers: [mcpRef],
                        },
                    },
                };
                steps.push(skillStep);
            }
            usedSkillStepIds.add(skillStep.id);
            const currentSkill = skillStep.component || { type: 'openaiGen' };
            const skillManifest = this.isPlainObject(currentSkill.agentManifest) ? currentSkill.agentManifest || {} : {};
            skillStep.component = {
                ...currentSkill,
                type: 'openaiGen',
                agentRole: 'subagent',
                agentUseWorkspaceCatalog: true,
                agentExecutionMode: currentSkill.agentExecutionMode === 'flow' ? 'auto_tools' : currentSkill.agentExecutionMode || 'auto_tools',
                agentMaxToolCalls: Math.max(Number(currentSkill.agentMaxToolCalls || 0), 3),
                agentManifest: {
                    ...skillManifest,
                    rules: this.normalizeAgentManifestRefs(skillManifest.rules),
                    skills: this.normalizeAgentManifestRefs(skillManifest.skills),
                    subagents: this.normalizeAgentManifestRefs(skillManifest.subagents),
                    mcpServers: this.upsertAssistantManifestRef(skillManifest.mcpServers, mcpRef),
                },
            };
            const skillCatalogId = `skill:${preset.id}`;
            const skillRef = {
                id: skillCatalogId,
                name: `Skill especialista ${preset.label}`,
                description: `Especialista em ${preset.label}. Delega ao MCP correspondente e normaliza a resposta para o orquestrador.`,
                targetStepId: skillStep.id,
                source: 'canvas',
                load: 'auto',
            };
            skills = this.upsertAssistantCatalogItem(skills, {
                ...skillRef,
                kind: 'workflow',
                path: `.canvas-flow/skills/${preset.id}/SKILL.md`,
                enabled: true,
                sideEffect: 'read',
                requiresApproval: false,
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: { type: 'string', description: `Tarefa delegada sobre ${preset.label}.` },
                    },
                    required: ['task'],
                },
                outputSchema: {
                    type: 'object',
                    properties: {
                        result: { description: `Resultado normalizado da integracao ${preset.label}.` },
                    },
                },
            }, preset);
            const orchestratorComponent = orchestrator?.component || { type: 'openaiGen' };
            const orchestratorManifest = this.isPlainObject(orchestratorComponent.agentManifest) ? orchestratorComponent.agentManifest || {} : {};
            if (orchestrator) {
                orchestrator.component = {
                    ...orchestratorComponent,
                    type: 'openaiGen',
                    agentRole: 'orchestrator',
                    agentUseWorkspaceCatalog: true,
                    agentExecutionMode: orchestratorComponent.agentExecutionMode === 'flow' ? 'hybrid' : orchestratorComponent.agentExecutionMode || 'hybrid',
                    agentMaxToolCalls: Math.max(Number(orchestratorComponent.agentMaxToolCalls || 0), 3),
                    agentManifest: {
                        ...orchestratorManifest,
                        rules: this.normalizeAgentManifestRefs(orchestratorManifest.rules),
                        skills: this.upsertAssistantManifestRef(orchestratorManifest.skills, skillRef),
                        subagents: this.normalizeAgentManifestRefs(orchestratorManifest.subagents),
                        mcpServers: this.upsertAssistantManifestRef(orchestratorManifest.mcpServers, mcpRef),
                    },
                };
            }
            this.upsertAssistantArchitectureEdge(edges, orchestrator.id, skillStep.id, 'manifest');
            this.upsertAssistantArchitectureEdge(edges, skillStep.id, mcpStep.id, 'manifest');
            if (mcpOperation === 'listTools') {
                warnings.push(`${preset.label}: o MCP foi criado em listTools. Valide a conexao e selecione a tool exata antes de publicar.`);
            }
            if (preset.authMode !== 'none') {
                const authLabel = preset.authMode === 'oauth'
                    ? 'OAuth'
                    : preset.authMode === 'aws_sigv4'
                        ? 'AWS IAM SigV4 no backend'
                        : 'Bearer token';
                warnings.push(`${preset.label}: conclua a autenticacao ${authLabel} no node MCP antes de executar.`);
            }
        });
        return {
            config: {
                ...config,
                agentSpec: {
                    ...spec,
                    skills,
                    mcpServers,
                },
                startStepId: planWasAdded ? plan.id : config.startStepId || plan.id,
                steps,
                edges,
            },
            warnings,
        };
    }
    normalizeAssistantTags(tags, stepId) {
        if (!Array.isArray(tags))
            return [];
        return tags
            .slice(0, 8)
            .map((tagConfig, index) => {
            const tag = String(this.isPlainObject(tagConfig)
                ? tagConfig.tag || tagConfig.label || tagConfig.name
                : tagConfig).trim();
            if (!tag)
                return null;
            const metadata = this.isPlainObject(tagConfig) ? tagConfig.metadataJson ?? tagConfig.metadata : undefined;
            return {
                id: this.normalizeAssistantSlug(tagConfig?.id, `${stepId}_tag_${index + 1}`),
                tag: this.limitText(tag, 80),
                label: this.limitText(tagConfig?.label || tag, 80),
                mode: tagConfig?.mode === 'once' ? 'once' : 'always',
                valueTemplate: tagConfig?.valueTemplate !== undefined ? tagConfig.valueTemplate : '',
                metadataJson: metadata === undefined || metadata === ''
                    ? '{}'
                    : typeof metadata === 'string'
                        ? metadata
                        : JSON.stringify(metadata, null, 2),
            };
        })
            .filter(Boolean);
    }
    normalizeAssistantRichMessageConfig(value) {
        const source = this.isPlainObject(value) ? value : {};
        const allowedTypes = new Set(['text', 'buttons', 'quickReplies', 'list', 'carousel', 'appointmentFlow', 'image', 'document']);
        const type = allowedTypes.has(String(source.type || ''))
            ? String(source.type)
            : Array.isArray(source.buttons)
                ? 'buttons'
                : Array.isArray(source.quickReplies)
                    ? 'quickReplies'
                    : Array.isArray(source.sections) || source.list
                        ? 'list'
                        : 'text';
        const base = {
            type,
            text: this.limitText(source.text || source.message || source.instruction, WHATSAPP_LIMITS.interactiveBody, type === 'buttons' ? 'Escolha uma opcao:' : ''),
            footer: this.limitText(source.footer, WHATSAPP_LIMITS.footer),
            media: source.media && typeof source.media === 'object' && !Array.isArray(source.media)
                ? {
                    url: this.limitText(source.media.url, WHATSAPP_LIMITS.imageUrl),
                    fileName: this.limitText(source.media.fileName, 120),
                    mimeType: this.limitText(source.media.mimeType, 120),
                    caption: this.limitText(source.media.caption, WHATSAPP_LIMITS.interactiveBody),
                }
                : undefined,
            list: source.list,
            carousel: source.carousel,
            appointmentFlow: source.appointmentFlow,
            generation: source.generation,
        };
        return this.normalizeGeneratedRichContent(base, {
            ...source,
            list: source.list || (Array.isArray(source.sections) ? { sections: source.sections, buttonText: source.buttonText } : undefined),
            carousel: source.carousel || (Array.isArray(source.cards) ? { cards: source.cards } : undefined),
        });
    }
    normalizeAssistantStep(step, index, idMap, usedIds) {
        if (!this.isPlainObject(step))
            return null;
        const componentSource = this.isPlainObject(step.component) ? step.component : {};
        const componentTypeRaw = String(componentSource.type || step.componentType || '').trim();
        const allowedComponents = new Set(['rag', 'openaiGen', 'azureOpenAI', 'milvus', 'azureSearch', 'azureBlob', 'debug', 'mongodb', 'dashboard', 'cron', 'loop', 'flowRouter', 'context', 'webhook', 'mcp', 'files', 'approval', 'agentPlan']);
        const hasComponentType = allowedComponents.has(componentTypeRaw);
        const typeAliases = {
            message: 'message',
            mensagem: 'message',
            rich: 'richMessage',
            richmessage: 'richMessage',
            rich_message: 'richMessage',
            mensagem_rica: 'richMessage',
            input: 'input',
            api: 'api',
            condition: 'condition',
            condicao: 'condition',
            end: 'end',
            fim: 'end',
            group: 'group',
            component: 'component',
            componente: 'component',
            loop: 'component',
        };
        const rawType = this.normalizeAssistantSlug(step.type, '');
        const type = hasComponentType
            ? 'component'
            : typeAliases[rawType] || 'message';
        const rawId = String(step.id || step.key || '').trim();
        const id = this.uniqueAssistantId(rawId || step.title || type, type, index, usedIds);
        const responseName = step.responseName
            ? this.normalizeAssistantVariableName(step.responseName, type === 'input' ? 'input' : id)
            : undefined;
        const titleFallback = type === 'richMessage'
            ? 'Mensagem rica'
            : type === 'input'
                ? 'Coletar dado'
                : type === 'api'
                    ? 'API'
                    : type === 'condition'
                        ? 'Condicao'
                        : type === 'end'
                            ? 'Fim'
                            : type === 'component'
                                ? componentTypeRaw || 'Componente'
                                : 'Mensagem';
        idMap.set(rawId || id, id);
        idMap.set(id, id);
        if (step.title) {
            idMap.set(String(step.title), id);
            idMap.set(this.normalizeAssistantSlug(step.title, ''), id);
        }
        if (responseName)
            idMap.set(responseName, id);
        const normalized = {
            id,
            type,
            title: this.limitText(step.title, 80, titleFallback),
            instruction: this.limitText(step.instruction || step.message || step.text || '', 8000),
            ...(responseName ? { responseName } : {}),
            position: this.normalizeAssistantPosition(step.position, index),
            ...(step.parentId ? { parentId: String(step.parentId) } : {}),
            tags: this.normalizeAssistantTags(step.tags, id),
        };
        if (type === 'message') {
            normalized.messageUseLlm = step.messageUseLlm === true;
            normalized.messageLlmModel = String(step.messageLlmModel || '');
            normalized.messageLlmTemperature = this.limitDecimal(step.messageLlmTemperature ?? 0.4, 0.4, 0, 1);
        }
        if (type === 'richMessage') {
            normalized.richMessage = this.normalizeAssistantRichMessageConfig(step.richMessage || step.content || step);
            if (!normalized.instruction)
                normalized.instruction = normalized.richMessage?.text || 'Mensagem interativa.';
        }
        if (type === 'input') {
            const validationModes = new Set(['none', 'type', 'regex', 'llm']);
            const validationTypes = new Set(['text', 'email', 'number', 'date', 'cpf', 'cnpj', 'phone', 'boolean']);
            normalized.responseName = responseName || this.normalizeAssistantVariableName(step.responseName || step.output || 'input', 'input');
            normalized.inputValidationMode = validationModes.has(String(step.inputValidationMode)) ? step.inputValidationMode : 'none';
            normalized.inputValidationType = validationTypes.has(String(step.inputValidationType)) ? step.inputValidationType : 'text';
            normalized.inputValidationRegex = String(step.inputValidationRegex || '');
            normalized.inputValidationErrorMessage = this.limitText(step.inputValidationErrorMessage, 500, 'Valor invalido. Informe novamente.');
            normalized.inputValidationLlmInstruction = this.limitText(step.inputValidationLlmInstruction, 1000, 'Valide se a entrada do usuario atende ao dado solicitado.');
            normalized.inputValidationLlmModel = String(step.inputValidationLlmModel || '');
            normalized.inputValidationLlmTemperature = this.limitDecimal(step.inputValidationLlmTemperature ?? 0, 0, 0, 1);
        }
        if (type === 'api') {
            const apiSource = this.isPlainObject(step.api) ? step.api : {};
            const apiResponseName = this.normalizeAssistantVariableName(apiSource.responseName || responseName || step.responseName || 'api', 'api');
            normalized.responseName = responseName || apiResponseName;
            normalized.api = {
                responseName: apiResponseName,
                requests: this.normalizeGeneratedApiRequests(apiSource.requests || step.requests || []),
                generation: {
                    enabled: apiSource.generation?.enabled === true,
                    prompt: String(apiSource.generation?.prompt || ''),
                    model: String(apiSource.generation?.model || ''),
                    temperature: this.limitDecimal(apiSource.generation?.temperature ?? 0.2, 0.2, 0, 1),
                    fallbackToManual: apiSource.generation?.fallbackToManual !== false,
                },
            };
        }
        if (type === 'condition') {
            normalized.responseName = responseName || this.normalizeAssistantVariableName(step.responseName || 'condition', 'condition');
            normalized.condition = String(step.condition || step.instruction || '');
            normalized.instruction = normalized.condition || normalized.instruction;
            normalized.conditionMode = step.conditionMode === 'llm' ? 'llm' : 'js';
            normalized.conditionModel = String(step.conditionModel || '');
            normalized.conditionTemperature = this.limitDecimal(step.conditionTemperature ?? 0, 0, 0, 1);
        }
        if (type === 'group') {
            normalized.group = {
                width: this.limitNumber(step.group?.width, 520, 360, 4000),
                height: this.limitNumber(step.group?.height, 340, 240, 4000),
                collapsed: step.group?.collapsed === true,
            };
        }
        if (type === 'component') {
            const componentType = hasComponentType ? componentTypeRaw : 'debug';
            const componentResponseName = this.normalizeAssistantVariableName(componentSource.responseName || responseName || step.responseName || componentType, componentType);
            normalized.responseName = responseName || componentResponseName;
            normalized.component = {
                ...componentSource,
                type: componentType,
                responseName: componentResponseName,
            };
            if (componentType === 'openaiGen' || componentType === 'azureOpenAI') {
                const role = String(componentSource.agentRole || '').trim();
                normalized.component.agentRole = role === 'orchestrator' || role === 'subagent' ? role : 'simple';
                normalized.component.agentUseWorkspaceCatalog = componentSource.agentUseWorkspaceCatalog !== false;
                normalized.component.agentExecutionMode = ['flow', 'auto_tools', 'hybrid'].includes(String(componentSource.agentExecutionMode))
                    ? componentSource.agentExecutionMode
                    : normalized.component.agentRole === 'orchestrator'
                        ? 'hybrid'
                        : normalized.component.agentRole === 'subagent'
                            ? 'auto_tools'
                            : 'flow';
                normalized.component.agentMaxToolCalls = this.limitNumber(componentSource.agentMaxToolCalls ?? 1, 1, 1, 3);
                const localSpec = this.isPlainObject(componentSource.agentSpec) ? componentSource.agentSpec : {};
                normalized.component.agentSpec = {
                    agentsMd: String(localSpec.agentsMd || ''),
                    guardrails: String(localSpec.guardrails || ''),
                    blockedTerms: Array.isArray(localSpec.blockedTerms)
                        ? localSpec.blockedTerms.map((term) => String(term || '').trim()).filter(Boolean)
                        : [],
                };
                const manifestSource = this.isPlainObject(componentSource.agentManifest) ? componentSource.agentManifest : {};
                normalized.component.agentManifest = {
                    rules: this.normalizeAgentManifestRefs(manifestSource.rules),
                    skills: this.normalizeAgentManifestRefs(manifestSource.skills),
                    subagents: this.normalizeAgentManifestRefs(manifestSource.subagents),
                    mcpServers: this.normalizeAgentManifestRefs(manifestSource.mcpServers),
                };
            }
            if (componentType === 'webhook') {
                const webhookModeRaw = String(componentSource.webhookMode || '').trim();
                normalized.component.webhookMode = ['listener', 'global', 'global_listener'].includes(webhookModeRaw)
                    ? 'listener'
                    : webhookModeRaw === 'outbound'
                        ? 'outbound'
                        : 'inbound';
                normalized.component.webhookId = String(componentSource.webhookId || id);
                normalized.component.webhookAuthMode = ['none', 'bearer', 'header', 'query'].includes(String(componentSource.webhookAuthMode))
                    ? componentSource.webhookAuthMode
                    : 'none';
                normalized.component.webhookHeaderName = String(componentSource.webhookHeaderName || 'x-canvas-flow-webhook-secret');
                normalized.component.webhookQueryParam = String(componentSource.webhookQueryParam || 'secret');
                normalized.component.webhookStartMode = componentSource.webhookStartMode === 'flow' ? 'flow' : 'node';
                normalized.component.webhookResponseMode = componentSource.webhookResponseMode === 'async'
                    ? 'async'
                    : componentSource.webhookResponseMode === 'async_job'
                        ? 'async_job'
                        : 'sync';
                normalized.component.webhookCallbackUrl = String(componentSource.webhookCallbackUrl || '');
                normalized.component.webhookCallbackAuthMode = ['none', 'bearer', 'header'].includes(String(componentSource.webhookCallbackAuthMode))
                    ? componentSource.webhookCallbackAuthMode
                    : 'none';
                normalized.component.webhookCallbackHeaderName = String(componentSource.webhookCallbackHeaderName || 'x-canvas-flow-callback-secret');
                normalized.component.webhookListenerFireAndForget = componentSource.webhookListenerFireAndForget !== false;
                if (componentSource.webhookCallbackSecret)
                    normalized.component.webhookCallbackSecret = String(componentSource.webhookCallbackSecret);
                if (componentSource.webhookSecret)
                    normalized.component.webhookSecret = String(componentSource.webhookSecret);
                if (normalized.component.webhookMode === 'outbound' || normalized.component.webhookMode === 'listener') {
                    const apiSource = this.isPlainObject(step.api) ? step.api : {};
                    normalized.api = {
                        responseName: componentResponseName,
                        requests: this.normalizeGeneratedApiRequests(apiSource.requests || step.requests || []),
                        generation: apiSource.generation,
                    };
                }
            }
            if (componentType === 'mcp') {
                const provider = String(componentSource.mcpLlmProvider || 'auto');
                const method = String(componentSource.mcpApiMethod || 'POST').toUpperCase();
                normalized.component.mcpMode = componentSource.mcpMode === 'api'
                    ? 'api'
                    : componentSource.mcpMode === 'external'
                        ? 'external'
                        : 'fields';
                normalized.component.mcpToolName = this.limitId(componentSource.mcpToolName || componentResponseName || 'mcp_tool', 80, 'mcp_tool');
                normalized.component.mcpToolDescription = this.limitText(componentSource.mcpToolDescription, 800, 'Ferramenta MCP do Canvas Flow.');
                normalized.component.mcpInstruction = this.limitText(componentSource.mcpInstruction || step.instruction, 4000, 'Use o contexto do fluxo e retorne o output conforme o schema.');
                normalized.component.mcpInputSchema = this.isPlainObject(this.parseJsonConfig(componentSource.mcpInputSchema, {}))
                    ? componentSource.mcpInputSchema
                    : '{}';
                normalized.component.mcpOutputSchema = this.isPlainObject(this.parseJsonConfig(componentSource.mcpOutputSchema, {}))
                    ? componentSource.mcpOutputSchema
                    : '{}';
                normalized.component.mcpLlmProvider = ['auto', 'openai', 'azure_openai', 'gemini', 'claude', 'grok', 'bedrock'].includes(provider) ? provider : 'auto';
                normalized.component.mcpModel = String(componentSource.mcpModel || '');
                normalized.component.mcpTemperature = this.limitDecimal(componentSource.mcpTemperature ?? 0.1, 0.1, 0, 1);
                normalized.component.mcpApiMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'POST';
                normalized.component.mcpApiBaseUrl = String(componentSource.mcpApiBaseUrl || '');
                normalized.component.mcpApiHeadersJson = componentSource.mcpApiHeadersJson || '{}';
                normalized.component.mcpApiQueryJson = componentSource.mcpApiQueryJson || '{}';
                normalized.component.mcpApiBodyJson = componentSource.mcpApiBodyJson || '{}';
                normalized.component.mcpApiAuthMode = ['none', 'bearer', 'header', 'query'].includes(String(componentSource.mcpApiAuthMode))
                    ? componentSource.mcpApiAuthMode
                    : 'none';
                normalized.component.mcpApiAuthHeaderName = String(componentSource.mcpApiAuthHeaderName || 'Authorization');
                normalized.component.mcpApiAuthQueryParam = String(componentSource.mcpApiAuthQueryParam || 'api_key');
                normalized.component.mcpApiAllowLlmRequest = componentSource.mcpApiAllowLlmRequest !== false;
                normalized.component.mcpApiMapResultWithLlm = componentSource.mcpApiMapResultWithLlm !== false;
                normalized.component.mcpApiExecute = componentSource.mcpApiExecute !== false;
                normalized.component.mcpApiCallMode = componentSource.mcpApiCallMode === 'multi' ? 'multi' : 'single';
                normalized.component.mcpApiExecutionMode = componentSource.mcpApiExecutionMode === 'parallel' ? 'parallel' : 'sequential';
                normalized.component.mcpApiRequestsJson = componentSource.mcpApiRequestsJson || '[]';
                normalized.component.mcpMergeOutputToSlots = componentSource.mcpMergeOutputToSlots === true;
                if (componentSource.mcpApiAuthSecret)
                    normalized.component.mcpApiAuthSecret = String(componentSource.mcpApiAuthSecret);
                normalized.component.mcpExternalTransport = ['streamable_http', 'sse', 'websocket'].includes(String(componentSource.mcpExternalTransport))
                    ? componentSource.mcpExternalTransport
                    : 'streamable_http';
                normalized.component.mcpExternalUrl = String(componentSource.mcpExternalUrl || '');
                normalized.component.mcpExternalHeadersJson = componentSource.mcpExternalHeadersJson || '{}';
                normalized.component.mcpExternalAuthMode = ['none', 'bearer', 'header', 'query', 'oauth', 'aws_sigv4'].includes(String(componentSource.mcpExternalAuthMode))
                    ? componentSource.mcpExternalAuthMode
                    : 'none';
                normalized.component.mcpExternalOAuthConnectionScope = componentSource.mcpExternalOAuthConnectionScope === 'user'
                    ? 'user'
                    : 'agent';
                normalized.component.mcpExternalAuthHeaderName = String(componentSource.mcpExternalAuthHeaderName || 'Authorization');
                normalized.component.mcpExternalAuthQueryParam = String(componentSource.mcpExternalAuthQueryParam || 'api_key');
                normalized.component.mcpExternalOperation = ['ping', 'listTools', 'callTool', 'listResources', 'readResource', 'listPrompts', 'getPrompt'].includes(String(componentSource.mcpExternalOperation))
                    ? componentSource.mcpExternalOperation
                    : 'callTool';
                normalized.component.mcpExternalToolName = String(componentSource.mcpExternalToolName || '');
                normalized.component.mcpExternalArgumentsJson = componentSource.mcpExternalArgumentsJson || '{}';
                normalized.component.mcpExternalResourceUri = String(componentSource.mcpExternalResourceUri || '');
                normalized.component.mcpExternalPromptName = String(componentSource.mcpExternalPromptName || '');
                normalized.component.mcpExternalPromptArgumentsJson = componentSource.mcpExternalPromptArgumentsJson || '{}';
                normalized.component.mcpExternalUseLlmArguments = componentSource.mcpExternalUseLlmArguments !== false;
                normalized.component.mcpExternalMapResultWithLlm = componentSource.mcpExternalMapResultWithLlm !== false;
                normalized.component.mcpExternalTimeoutMs = this.limitNumber(componentSource.mcpExternalTimeoutMs ?? 30000, 30000, 1000, 300000);
                if (componentSource.mcpExternalAuthSecret)
                    normalized.component.mcpExternalAuthSecret = String(componentSource.mcpExternalAuthSecret);
            }
            if (componentType === 'agentPlan') {
                normalized.component.agentPlanMode = componentSource.agentPlanMode === 'manual' ? 'manual' : 'advisory';
                normalized.component.agentPlanInstructions = this.limitText(componentSource.agentPlanInstructions || step.instruction || '', 4000, '');
                normalized.component.agentPlanJson = componentSource.agentPlanJson || '{ "plan": [] }';
                normalized.component.agentPlanMaxToolCalls = this.limitNumber(componentSource.agentPlanMaxToolCalls ?? 3, 3, 1, 10);
                normalized.component.agentPlanClearAfterUse = componentSource.agentPlanClearAfterUse !== false;
            }
            if (componentType === 'files') {
                const resultMode = String(componentSource.filesResultMode || 'context');
                const sourceMode = String(componentSource.filesSourceMode || 'upload');
                normalized.component.filesSourceMode = sourceMode === 'url' ? 'url' : 'upload';
                normalized.component.filesResultMode = resultMode === 'llm' ? 'llm' : 'context';
                normalized.component.filesUploaded = Array.isArray(componentSource.filesUploaded)
                    ? componentSource.filesUploaded
                        .map((file) => ({
                        id: String(file?.id || (0, crypto_1.randomUUID)()),
                        title: this.limitText(file?.title || file?.filename || 'arquivo', 160, 'arquivo'),
                        filename: this.limitText(file?.filename || file?.title || 'arquivo', 160, 'arquivo'),
                        mimeType: this.limitText(file?.mimeType || file?.mimetype || '', 120, ''),
                        size: this.limitNumber(file?.size, 0, 0, 50 * 1024 * 1024),
                        text: String(file?.text || file?.fileContent || ''),
                        textLength: this.limitNumber(file?.textLength, String(file?.text || '').length, 0, 100000000),
                        strategy: this.limitText(file?.strategy || '', 80, ''),
                        sourceUrl: this.limitText(file?.sourceUrl || '', 1000, ''),
                        truncated: file?.truncated === true,
                        errors: Array.isArray(file?.errors) ? file.errors.slice(0, 5).map((item) => String(item)) : [],
                        documentId: this.limitText(file?.documentId || file?.id || '', 120, ''),
                        storage: this.limitText(file?.storage || '', 20, ''),
                        storageKey: this.limitText(file?.storageKey || file?.key || '', 1000, ''),
                        downloadPath: this.limitText(file?.downloadPath || '', 1000, ''),
                        structure: file?.structure && typeof file.structure === 'object' && !Array.isArray(file.structure)
                            ? file.structure
                            : {},
                    }))
                        .filter((file) => String(file.text || '').trim() || file.documentId)
                    : [];
                normalized.component.filesUrlTemplate = String(componentSource.filesUrlTemplate || '');
                normalized.component.filesPreferOcr = componentSource.filesPreferOcr === true;
                normalized.component.filesMaxTextChars = this.limitNumber(componentSource.filesMaxTextChars ?? 60000, 60000, 0, 500000);
                normalized.component.filesLlmProvider = ['auto', 'openai', 'azure_openai', 'gemini', 'claude', 'grok', 'bedrock'].includes(String(componentSource.filesLlmProvider))
                    ? componentSource.filesLlmProvider
                    : 'auto';
                normalized.component.filesLlmModel = String(componentSource.filesLlmModel || '');
                normalized.component.filesLlmPrompt = this.limitText(componentSource.filesLlmPrompt, 4000, 'Leia os arquivos conectados e responda ao usuario em pt-BR de forma objetiva.');
                normalized.component.filesQuestionTemplate = String(componentSource.filesQuestionTemplate || '{{context.slots.userInput}}');
                normalized.component.filesLlmTemperature = this.limitDecimal(componentSource.filesLlmTemperature ?? 0.2, 0.2, 0, 1);
                normalized.component.filesOperation = ['read', 'generate', 'edit'].includes(String(componentSource.filesOperation))
                    ? componentSource.filesOperation
                    : 'read';
                normalized.component.filesOutputFormat = ['txt', 'md', 'csv', 'json', 'html', 'docx', 'xlsx', 'pdf'].includes(String(componentSource.filesOutputFormat))
                    ? componentSource.filesOutputFormat
                    : 'docx';
                normalized.component.filesOutputFilenameTemplate = String(componentSource.filesOutputFilenameTemplate || 'artefato.docx');
                normalized.component.filesContentTemplate = String(componentSource.filesContentTemplate || '');
                normalized.component.filesTemplateDocumentId = String(componentSource.filesTemplateDocumentId || '');
                normalized.component.filesTemplateDocumentIds = Array.from(new Set((Array.isArray(componentSource.filesTemplateDocumentIds) ? componentSource.filesTemplateDocumentIds : [])
                    .map((documentId) => String(documentId || '').trim())
                    .filter(Boolean))).slice(0, 50);
                normalized.component.filesTemplateValuesJson = componentSource.filesTemplateValuesJson || {};
                normalized.component.filesGenerationPrompt = this.limitText(componentSource.filesGenerationPrompt, 6000, '');
                normalized.component.filesUseDocumentSkill = componentSource.filesUseDocumentSkill !== false;
                normalized.component.filesDocumentSkillPrompt = this.limitText(componentSource.filesDocumentSkillPrompt, 3000, '');
            }
            if (componentType === 'approval') {
                normalized.component.approvalTitle = this.limitText(componentSource.approvalTitle || step.title, 120, 'Aprovar acao');
                normalized.component.approvalDescription = this.limitText(componentSource.approvalDescription || step.instruction, 1200, 'Revise a acao antes de continuar.');
                normalized.component.approvalRisk = ['low', 'medium', 'high', 'critical'].includes(String(componentSource.approvalRisk))
                    ? componentSource.approvalRisk
                    : 'medium';
                normalized.component.approvalScopes = Array.isArray(componentSource.approvalScopes)
                    ? componentSource.approvalScopes.map((scope) => String(scope || '').trim()).filter(Boolean).slice(0, 20)
                    : String(componentSource.approvalScopes || '')
                        .split(',')
                        .map((scope) => scope.trim())
                        .filter(Boolean)
                        .slice(0, 20);
                normalized.component.approvalApproverHint = this.limitText(componentSource.approvalApproverHint, 300, 'Operador humano');
                normalized.component.approvalKeyword = this.limitText(componentSource.approvalKeyword, 40, 'aprovar').toLowerCase();
                normalized.component.approvalRejectKeyword = this.limitText(componentSource.approvalRejectKeyword, 40, 'reprovar').toLowerCase();
                normalized.component.approvalApprovedText = this.limitText(componentSource.approvalApprovedText, 500, 'Aprovado. Vou continuar.');
                normalized.component.approvalRejectedText = this.limitText(componentSource.approvalRejectedText, 500, 'Reprovado. Nao vou executar a acao.');
                normalized.component.approvalRequireExplicitInput = componentSource.approvalRequireExplicitInput !== false;
            }
            if (componentType === 'loop') {
                normalized.component.loopResponseName = this.normalizeAssistantVariableName(componentSource.loopResponseName || componentResponseName, 'loop');
                normalized.component.loopIndexResponseName = this.normalizeAssistantVariableName(componentSource.loopIndexResponseName || 'loopIndex', 'loopIndex');
                normalized.component.loopMaxIterations = this.limitNumber(componentSource.loopMaxIterations ?? 3, 3, 1, 1000);
                normalized.component.loopDelaySeconds = this.limitDecimal(componentSource.loopDelaySeconds ?? 0, 0, 0, 3600);
                normalized.component.loopStopCondition = String(componentSource.loopStopCondition || '');
            }
        }
        return normalized;
    }
    normalizeAssistantEdge(edge, index, idMap, stepIds, usedIds) {
        if (!this.isPlainObject(edge))
            return null;
        const resolveRef = (value) => {
            const raw = String(value || '').trim();
            return idMap.get(raw) || idMap.get(this.normalizeAssistantSlug(raw, '')) || raw;
        };
        const source = resolveRef(edge.source);
        const target = resolveRef(edge.target);
        if (!stepIds.has(source) || !stepIds.has(target) || source === target)
            return null;
        const id = this.uniqueAssistantId(edge.id || `${source}_${target}`, 'edge', index, usedIds);
        const condition = String(edge.condition || '').trim();
        return {
            id,
            source,
            target,
            ...(edge.label ? { label: this.limitText(edge.label, 80) } : {}),
            ...(edge.edgeRole === 'manifest' ? { edgeRole: 'manifest' } : {}),
            ...(condition ? { condition } : {}),
            ...(condition ? { conditionMode: edge.conditionMode === 'llm' ? 'llm' : 'js' } : {}),
            ...(edge.conditionModel ? { conditionModel: String(edge.conditionModel) } : {}),
            ...(edge.conditionTemperature !== undefined ? { conditionTemperature: this.limitDecimal(edge.conditionTemperature, 0, 0, 1) } : {}),
            ...(edge.conditionReasonResponseName ? { conditionReasonResponseName: this.normalizeAssistantVariableName(edge.conditionReasonResponseName, `${id}_reason`) } : {}),
        };
    }
    normalizeAssistantFlowConfig(rawConfig, currentConfig) {
        const source = this.isPlainObject(rawConfig) ? rawConfig : {};
        const current = this.isPlainObject(currentConfig) ? currentConfig : {};
        const usedStepIds = new Set();
        const idMap = new Map();
        const steps = (Array.isArray(source.steps) ? source.steps : [])
            .slice(0, 120)
            .map((step, index) => this.normalizeAssistantStep(step, index, idMap, usedStepIds))
            .filter(Boolean);
        const stepIds = new Set(steps.map((step) => step.id));
        const usedEdgeIds = new Set();
        const edges = (Array.isArray(source.edges) ? source.edges : [])
            .slice(0, 200)
            .map((edge, index) => this.normalizeAssistantEdge(edge, index, idMap, stepIds, usedEdgeIds))
            .filter(Boolean);
        const startCandidate = idMap.get(String(source.startStepId || '').trim()) || source.startStepId;
        const normalizedProvider = this.normalizeFlowLlmProvider(source.llmProvider || current.llmProvider);
        const channel = source.channel === 'whatsapp'
            ? 'whatsapp'
            : source.channel === 'webWidget'
                ? 'webWidget'
                : current.channel === 'whatsapp'
                    ? 'whatsapp'
                    : 'webWidget';
        return {
            title: this.limitText(source.title || current.title, 120, 'Fluxo gerado por IA'),
            responseName: this.normalizeAssistantVariableName(source.responseName || current.responseName || 'assistantFlow', 'assistantFlow'),
            execute: this.limitText(source.execute || current.execute, 80, 'firstQuestion'),
            model: this.limitText(source.model || current.model, 80, 'gpt-4o'),
            llmProvider: normalizedProvider === 'azure' ? 'azure_openai' : (normalizedProvider || 'openai'),
            agentSpec: this.isPlainObject(source.agentSpec) ? source.agentSpec : current.agentSpec,
            channel,
            isMainFlow: source.isMainFlow === true ? true : source.isMainFlow === false ? false : current.isMainFlow === true,
            webWidget: this.isPlainObject(source.webWidget) ? source.webWidget : current.webWidget,
            whatsapp: this.isPlainObject(source.whatsapp) ? source.whatsapp : current.whatsapp,
            turnHistoricMessages: this.limitNumber(source.turnHistoricMessages ?? current.turnHistoricMessages, 20, 0, 200),
            startStepId: stepIds.has(startCandidate) ? startCandidate : steps[0]?.id || '',
            steps,
            edges,
        };
    }
    async generateFlowConfigWithLlm(body) {
        const instruction = String(body?.instruction || '').trim();
        if (!instruction) {
            throw new common_1.HttpException('Descreva o fluxo que a IA deve criar ou alterar.', common_1.HttpStatus.BAD_REQUEST);
        }
        const currentConfig = this.isPlainObject(body?.currentConfig) ? body.currentConfig : {};
        const scope = this.isPlainObject(body?.scope) ? body.scope : {};
        const scopeMode = scope.mode === 'selectedNodes' || scope.mode === 'selection' ? 'selectedNodes' : 'fullFlow';
        const sourceType = String(body?.sourceType || '').trim();
        const agentSpec = this.isPlainObject(currentConfig.agentSpec) ? currentConfig.agentSpec || {} : {};
        const provider = this.flowLlmProvider(currentConfig, body?.llmProvider);
        const model = await this.getChatModelForProvider(provider, body?.model || currentConfig.model, body?.agentId);
        const llmClient = await this.getOpenAIClientForProvider(provider, body?.agentId);
        const preconfiguredMcpServers = this.assistantMcpPresetPromptCatalog();
        const requestedPreconfiguredMcpServers = this.assistantMcpPresetsForInstruction(instruction)
            .map((preset) => ({
            id: preset.id,
            label: preset.label,
            serverUrl: preset.serverUrl,
            authMode: preset.authMode,
            capability: preset.capability,
        }));
        const agentOsContext = {
            agentsMd: this.limitText(agentSpec.agentsMd, 3000),
            guardrails: this.limitText(agentSpec.guardrails, 2000),
            blockedTerms: Array.isArray(agentSpec.blockedTerms) ? agentSpec.blockedTerms.slice(0, 50) : [],
            rules: Array.isArray(agentSpec.rules) ? agentSpec.rules.slice(0, 20).map((item) => ({
                id: item?.id,
                name: item?.name,
                timing: item?.timing,
                condition: item?.condition,
                action: item?.action,
                enabled: item?.enabled !== false,
            })) : [],
            skills: Array.isArray(agentSpec.skills) ? agentSpec.skills.slice(0, 20).map((item) => ({
                id: item?.id,
                name: item?.name,
                description: item?.description,
                inputSchema: item?.inputSchema,
                outputSchema: item?.outputSchema,
                targetStepId: item?.targetStepId,
                enabled: item?.enabled !== false,
            })) : [],
            subagents: Array.isArray(agentSpec.subagents) ? agentSpec.subagents.slice(0, 20).map((item) => ({
                id: item?.id,
                name: item?.name,
                role: item?.role,
                handoff: item?.handoff,
                inputSchema: item?.inputSchema,
                outputSchema: item?.outputSchema,
                targetStepId: item?.targetStepId,
                enabled: item?.enabled !== false,
            })) : [],
            mcpServers: Array.isArray(agentSpec.mcpServers) ? agentSpec.mcpServers.slice(0, 20).map((item) => ({
                id: item?.id,
                name: item?.name,
                description: item?.description,
                url: item?.url || item?.serverUrl,
                tools: item?.tools,
                enabled: item?.enabled !== false,
            })) : [],
        };
        const currentFlowSummary = {
            title: currentConfig.title,
            channel: currentConfig.channel,
            startStepId: currentConfig.startStepId,
            steps: Array.isArray(currentConfig.steps) ? currentConfig.steps.slice(0, 80).map((step) => ({
                id: step?.id,
                type: step?.type,
                title: step?.title,
                responseName: step?.responseName || step?.component?.responseName,
                componentType: step?.component?.type,
                operation: step?.component?.mcpExternalOperation || step?.component?.mcpApiCallMode || step?.api?.method,
            })) : [],
            edges: Array.isArray(currentConfig.edges) ? currentConfig.edges.slice(0, 120).map((edge) => ({
                id: edge?.id,
                source: edge?.source,
                target: edge?.target,
                label: edge?.label,
                condition: edge?.condition,
            })) : [],
        };
        const planCompletion = await llmClient.chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce e o planejador spec-driven do Assistente IA do Canvas Flow.',
                        'Primeiro produza uma especificacao operacional compacta. Nao gere FlowConfig nesta etapa.',
                        'Carregue sob demanda apenas capacidades relevantes do Agent OS: rules, skills, subagents e mcpServers.',
                        'Se o pedido exigir agentes/subagentes/skills, explicite quais precisam ser usados ou criados e por que.',
                        'Se envolver Jira/GitLab/MCP e a tool exata nao foi informada, planeje um no listTools antes de qualquer callTool.',
                        'Quando o pedido mencionar um MCP remoto pre-configurado, planeje obrigatoriamente Agent Plan, agente orquestrador, skill especialista e node MCP externo.',
                        'A skill especialista deve ser registrada no Agent OS e delegar ao MCP correspondente. O orquestrador deve enxergar a skill e o MCP no manifesto.',
                        'Inclua validacoes, estados de erro, aprovacao humana para acoes sensiveis, dados de entrada/saida e criterios de sucesso.',
                        'Responda somente JSON valido no formato {"flowSpec": {...}, "warnings": ["opcional"]}.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        sourceType,
                        scope: {
                            mode: scopeMode,
                            selectedStepIds: Array.isArray(scope.selectedStepIds) ? scope.selectedStepIds : [],
                        },
                        currentFlowSummary,
                        agentOsContext,
                        preconfiguredMcpServers,
                        requestedPreconfiguredMcpServers,
                        mandatoryMcpArchitecture: requestedPreconfiguredMcpServers.length
                            ? [
                                'Crie component agentPlan para explicitar a estrategia.',
                                'Crie component openaiGen com agentRole=orchestrator e agentExecutionMode=hybrid.',
                                'Crie uma skill especialista por integracao, registrada em agentSpec.skills e representada por openaiGen com agentRole=subagent.',
                                'Crie component mcp com mcpMode=external, URL e authMode do preset.',
                                'Use mcpExternalOperation=listTools quando a tool exata ainda nao estiver confirmada.',
                                'Use edges edgeRole=manifest para representar orquestrador -> skill e skill -> MCP sem executar essas dependencias como caminho linear.',
                            ]
                            : [],
                        specContract: {
                            goal: 'Objetivo de negocio do fluxo.',
                            strategy: 'Como o fluxo deve pensar, delegar e usar capacidades.',
                            capabilitiesToUse: {
                                rules: ['ids/nomes relevantes'],
                                skills: ['ids/nomes relevantes ou novas skills a criar'],
                                subagents: ['ids/nomes relevantes ou novos subagents a criar'],
                                mcpServers: ['ids/nomes relevantes e tools esperadas quando conhecidas'],
                            },
                            nodes: [
                                {
                                    id: 'id_curto',
                                    type: 'message|input|condition|end|component',
                                    componentType: 'agentPlan|openaiGen|mcp|approval|context|...',
                                    purpose: 'responsabilidade unica do no',
                                    inputs: ['dados necessarios'],
                                    outputs: ['dados produzidos'],
                                    toolOrCapability: 'skill/subagent/mcp/rule quando aplicavel',
                                    successPath: 'proximo passo esperado',
                                    errorPath: 'fallback/erro',
                                },
                            ],
                            dataModel: 'slots principais e schemas esperados.',
                            approvals: 'acoes que exigem aprovacao humana.',
                            warnings: ['lacunas ou placeholders seguros'],
                        },
                    }, null, 2),
                },
            ],
            temperature: 0.1,
        });
        const planned = this.parseGeneratedJson(planCompletion.choices?.[0]?.message?.content || '') || {};
        const flowBuildSpec = this.isPlainObject(planned.flowSpec) ? planned.flowSpec : planned;
        const planWarnings = Array.isArray(planned.warnings)
            ? planned.warnings.map((warning) => this.limitText(warning, 300)).filter(Boolean).slice(0, 8)
            : [];
        const completion = await llmClient.chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce e um arquiteto senior de fluxos conversacionais para o Canvas Flow.',
                        'Transforme o pedido do usuario em um FlowConfig completo, claro, conectado e pronto para testar.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"config": FlowConfig, "summary": "resumo curto em pt-BR", "warnings": ["opcional"]}.',
                        scopeMode === 'selectedNodes'
                            ? 'Escopo atual: nos selecionados. Altere somente a configuracao dos nos recebidos e as edges internas entre eles. Preserve IDs, posicoes e intencao.'
                            : 'Escopo atual: fluxo inteiro. Sempre retorne o FlowConfig completo, nao um patch.',
                        'Preserve title, responseName, channel, llmProvider, model, isMainFlow e turnHistoricMessages do currentConfig, salvo quando o usuario pedir mudanca explicita.',
                        'Use currentConfig.agentSpec como Agent OS ativo: agentsMd define papel e arquitetura; guardrails sao limites duros; rules sao comportamentos obrigatorios; skills, subagents e mcpServers sao capacidades disponiveis para desenhar o fluxo.',
                        'Quando houver skills, subagents ou mcpServers relevantes, crie nos que orquestrem essas capacidades em vez de gerar apenas mensagens lineares. Use agentPlan para planejar/rotear trabalho agentico quando o pedido envolver decisao, varias tools ou integracao externa.',
                        'Para Jira, GitLab ou outros MCP remotos: se o nome exato da tool nao foi informado, crie um no MCP de descoberta com mcpExternalOperation=listTools e adicione warning pedindo escolher a tool exata antes de publicar. Se o nome exato foi informado, crie mcpExternalOperation=callTool com inputSchema, outputSchema e argumentos seguros.',
                        'Para cada MCP remoto pre-configurado solicitado, materialize o pacote completo: Agent Plan -> agente orquestrador; registre uma skill especialista no Agent OS; represente a skill como openaiGen subagent; configure o node MCP externo com URL e auth do preset.',
                        'No manifesto do orquestrador inclua a skill especialista e o MCP. No manifesto da skill especialista inclua o MCP. Use edges edgeRole=manifest para as dependencias agenticas.',
                        'Fluxos inteligentes devem ter captura e validacao de dados, normalizacao em Contexto quando necessario, condicoes de sucesso/erro, aprovacao humana antes de acoes sensiveis e mensagens de fallback claras.',
                        'Evite um fluxo raso com apenas mensagem -> input -> fim quando o pedido envolver consulta, triagem, integracao, memoria, RAG, MCP, dashboard, regras ou automacao.',
                        'Tipos de step permitidos: message, richMessage, input, api, condition, end, group, component.',
                        'Componentes permitidos em step.component.type: rag, openaiGen, azureOpenAI, milvus, azureSearch, azureBlob, debug, mongodb, dashboard, cron, loop, flowRouter, context, webhook, mcp, files, approval, agentPlan.',
                        'Um fluxo bem formado precisa ter startStepId valido, steps com position, edges ligando o caminho principal e um no end quando a conversa terminar.',
                        'Use ids estaveis, curtos, sem espacos e sem acentos. Use titulos humanos e responseName simples.',
                        'Templates dinamicos devem usar {{context.slots.nome}}, {{context.input}}, {{context.conversationId}}, {{context.agentId}}, {{context.flowId}} ou {{context.now}}.',
                        'Nao invente segredos, tokens, API keys, bearer tokens, connection strings ou headers de autorizacao. Deixe vazio e avise em warnings.',
                        'Se faltar informacao essencial, crie uma versao funcional com placeholders seguros e adicione warnings claros. Nao faca perguntas na resposta.',
                        'Siga flowBuildSpec como contrato de construcao. Materialize os nos planejados; nao reduza o fluxo para uma sequencia rasa se o spec pedir capacidades agenticas.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        sourceType,
                        scope: {
                            mode: scopeMode,
                            selectedStepIds: Array.isArray(scope.selectedStepIds) ? scope.selectedStepIds : [],
                        },
                        currentConfig,
                        agentOsContext,
                        preconfiguredMcpServers,
                        requestedPreconfiguredMcpServers,
                        flowBuildSpec,
                        expectedShape: {
                            config: {
                                title: 'string',
                                responseName: 'string',
                                execute: 'firstQuestion',
                                model: currentConfig.model || 'gpt-4o',
                                llmProvider: currentConfig.llmProvider || 'openai',
                                agentSpec: currentConfig.agentSpec || {
                                    agentsMd: '# Agente\nObjetivo, tom, limites e ferramentas permitidas.',
                                    guardrails: 'Nunca invente dados, peça aprovação antes de ações sensíveis e respeite dados pessoais.',
                                    blockedTerms: [],
                                    rules: [],
                                    skills: [],
                                    subagents: [],
                                    mcpServers: [],
                                },
                                channel: currentConfig.channel || 'webWidget',
                                turnHistoricMessages: 20,
                                startStepId: 'welcome',
                                steps: [
                                    {
                                        id: 'welcome',
                                        type: 'message',
                                        title: 'Boas vindas',
                                        instruction: 'Olá, seja bem-vindo.',
                                        responseName: 'boasVindas',
                                        tags: [{ tag: 'boas_vindas', mode: 'once', valueTemplate: '', metadataJson: '{}' }],
                                        position: { x: 120, y: 160 },
                                    },
                                    {
                                        id: 'cpf_input',
                                        type: 'input',
                                        title: 'CPF',
                                        instruction: 'Informe seu CPF.',
                                        responseName: 'input',
                                        inputValidationMode: 'type',
                                        inputValidationType: 'cpf',
                                        inputValidationErrorMessage: 'CPF inválido',
                                        position: { x: 390, y: 160 },
                                    },
                                    {
                                        id: 'consulta_cpf',
                                        type: 'api',
                                        title: 'Consulta CPF',
                                        responseName: 'api',
                                        api: {
                                            responseName: 'api',
                                            requests: [{
                                                    method: 'POST',
                                                    url: 'http://cpto.com',
                                                    headers: {},
                                                    params: {},
                                                    bodyType: 'jsonFields',
                                                    body: { cpf: '{{context.slots.input}}' },
                                                    polling: {
                                                        enabled: true,
                                                        intervalSeconds: 3,
                                                        maxAttempts: 10,
                                                        stopCondition: 'result.data.maiorIdade === true || result.data.maior_idade === true',
                                                    },
                                                }],
                                        },
                                        position: { x: 660, y: 160 },
                                    },
                                    {
                                        id: 'botoes',
                                        type: 'richMessage',
                                        title: 'Botões',
                                        instruction: 'Cliente encontrado.',
                                        richMessage: {
                                            type: 'buttons',
                                            text: 'Cliente maior de idade. Como deseja continuar?',
                                            buttons: [
                                                { id: 'continuar', label: 'Continuar', value: 'continuar' },
                                                { id: 'finalizar', label: 'Finalizar', value: 'finalizar' },
                                            ],
                                        },
                                        position: { x: 930, y: 160 },
                                    },
                                    {
                                        id: 'fim',
                                        type: 'end',
                                        title: 'Fim',
                                        instruction: 'Fluxo finalizado.',
                                        position: { x: 1200, y: 160 },
                                    },
                                ],
                                edges: [
                                    { id: 'edge_welcome_cpf', source: 'welcome', target: 'cpf_input' },
                                    { id: 'edge_cpf_api', source: 'cpf_input', target: 'consulta_cpf' },
                                    { id: 'edge_api_botoes', source: 'consulta_cpf', target: 'botoes' },
                                    { id: 'edge_botoes_fim', source: 'botoes', target: 'fim' },
                                ],
                            },
                            summary: 'string',
                            warnings: [],
                        },
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(body?.temperature ?? 0.2) || 0, 1)),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        const rawConfig = parsed.config || parsed.flowConfig || parsed.flow || parsed;
        const normalizedConfig = this.normalizeAssistantFlowConfig(rawConfig, currentConfig);
        const architecture = this.ensureAssistantMcpArchitecture(normalizedConfig, instruction, scopeMode);
        const config = architecture.config;
        if (!config.steps.length) {
            throw new common_1.HttpException('A IA não retornou nenhum nó para o fluxo.', common_1.HttpStatus.BAD_REQUEST);
        }
        return {
            config,
            summary: this.limitText(parsed.summary || parsed.resumo || parsed.explanation, 1000, 'Fluxo gerado pela IA.'),
            warnings: [
                ...planWarnings,
                ...architecture.warnings,
                ...(Array.isArray(parsed.warnings)
                    ? parsed.warnings.map((warning) => this.limitText(warning, 300)).filter(Boolean)
                    : []),
            ].slice(0, 20),
            model,
        };
    }
    promptFieldSpec(fieldType, targetType) {
        const field = String(fieldType || '').trim();
        const target = String(targetType || '').trim();
        const specs = {
            instruction: {
                title: 'Instrucao do no',
                purpose: 'Define exatamente o que este no do fluxo deve fazer, sem misturar regras globais, agents.md ou guardrails.',
                format: 'Texto curto e operacional em pt-BR. Use bullets apenas quando ajudar. Nao inclua segredos.',
            },
            agentsMd: {
                title: target === 'global-agent' ? 'Agents.md global' : 'Agents.md local do agente',
                purpose: 'Define identidade, papel, responsabilidades, memoria, ferramentas e criterios de delegacao do agente.',
                format: 'Markdown enxuto com secoes claras. Nao repita guardrails nem termos bloqueados.',
            },
            guardrails: {
                title: 'Guardrails',
                purpose: 'Define limites duros de seguranca, privacidade, anti-alucinacao e acoes que exigem confirmacao.',
                format: 'Lista objetiva em pt-BR. Nao inclua arquitetura, fluxo de negocio ou instrucoes de ferramenta.',
            },
            blockedTerms: {
                title: 'Termos bloqueados',
                purpose: 'Define tripwires textuais que bloqueiam ou escalam entradas sensiveis antes da chamada LLM.',
                format: 'Retorne termos curtos separados por virgula, sem frases longas e sem markdown.',
            },
            mcpDescription: {
                title: 'Descricao da ferramenta MCP',
                purpose: 'Explica quando o agente deve escolher esta ferramenta no manifesto.',
                format: 'Uma ou duas frases curtas. Inclua pre-condicoes essenciais e o dado de saida principal.',
            },
            mcpInstruction: {
                title: 'Instrucao da ferramenta MCP',
                purpose: 'Define como a ferramenta deve montar argumentos, chamar API/MCP e normalizar output, sem conversar com o cliente final.',
                format: 'Instrucoes operacionais em pt-BR. Cite input/output schema quando relevante. Proiba inventar dados.',
            },
        };
        return specs[field] || {
            title: field || 'Campo de prompt',
            purpose: `Preencher o campo ${field || 'solicitado'} para ${target || 'Canvas Flow'} com precisao.`,
            format: 'Texto objetivo em pt-BR.',
        };
    }
    async generatePromptFieldWithLlm(body) {
        const objective = String(body?.objective || body?.instruction || '').trim();
        if (!objective) {
            throw new common_1.HttpException('Descreva o objetivo deste campo para a IA preencher.', common_1.HttpStatus.BAD_REQUEST);
        }
        const fieldType = String(body?.fieldType || '').trim();
        const targetType = String(body?.targetType || '').trim();
        const currentConfig = this.isPlainObject(body?.currentConfig) ? body.currentConfig : {};
        const stepContext = this.isPlainObject(body?.stepContext) ? body.stepContext : {};
        const field = this.promptFieldSpec(fieldType, targetType);
        const provider = this.normalizeFlowLlmProvider(body?.llmProvider || currentConfig.llmProvider || 'openai') || 'openai';
        const model = await this.getChatModelForProvider(provider, body?.model || currentConfig.model, body?.agentId);
        const completion = await (await this.getOpenAIClientForProvider(provider, body?.agentId)).chat.completions.create({
            model,
            temperature: this.limitDecimal(body?.temperature ?? 0.2, 0.2, 0, 1),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce e um especialista em Canvas Flow, Agent OS e design de prompts operacionais.',
                        'Sua tarefa e preencher somente um campo especifico, com texto fiel ao objetivo recebido.',
                        'Nao misture responsabilidades: agents.md nao deve carregar guardrails; guardrails nao deve carregar arquitetura; termos bloqueados devem ser apenas tripwires; MCP nao deve conter prompt de atendimento ao cliente final.',
                        'Nao invente segredos, endpoints, tokens, credenciais ou dados reais. Use placeholders seguros quando necessario.',
                        'Responda somente JSON valido no formato {"text":"...", "explanation":"...", "terms":["opcional"]}.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        field,
                        fieldType,
                        targetType,
                        objective,
                        currentValue: String(body?.currentValue || ''),
                        currentConfig: {
                            title: currentConfig.title,
                            channel: currentConfig.channel,
                            model: currentConfig.model,
                            llmProvider: currentConfig.llmProvider,
                            agentSpec: currentConfig.agentSpec,
                        },
                        stepContext,
                        outputRules: {
                            text: fieldType === 'blockedTerms'
                                ? 'Termos separados por virgula, sem markdown.'
                                : 'Conteudo pronto para aplicar diretamente no campo.',
                            explanation: 'Explique em uma frase o criterio usado.',
                            terms: fieldType === 'blockedTerms' ? 'Array opcional com os termos individuais.' : 'Omitir ou vazio.',
                        },
                    }),
                },
            ],
        });
        const raw = completion.choices?.[0]?.message?.content || '{}';
        const parsed = this.parseJsonConfig(raw, {});
        const terms = Array.isArray(parsed?.terms)
            ? parsed.terms.map((term) => String(term || '').trim()).filter(Boolean)
            : [];
        const text = fieldType === 'blockedTerms' && terms.length
            ? terms.join(', ')
            : String(parsed?.text || '').trim();
        if (!text) {
            throw new common_1.HttpException('A IA nao retornou conteudo para este campo.', common_1.HttpStatus.BAD_REQUEST);
        }
        return {
            text,
            explanation: String(parsed?.explanation || '').trim(),
            terms,
            model,
            raw: this.isPlainObject(parsed) ? parsed : undefined,
        };
    }
    async runContextComponent(step, config, context) {
        const component = step.component;
        const mode = component.contextMode || 'json';
        const payload = mode === 'js'
            ? this.runContextScript(component.contextScript, context)
            : mode === 'llm'
                ? await this.generateContextPayloadWithLlm(component, config, context)
                : this.parseTemplatedJsonConfig(component.contextJson ?? '{}', {}, context);
        const slots = this.assertContextPayload(payload, 'Contexto');
        const plainSlots = this.toPlain(slots);
        const result = {
            ...plainSlots,
            mode,
            mergedKeys: Object.keys(slots),
            payload: plainSlots,
        };
        this.mergeContextSlots(context, slots);
        context.slots[component.responseName || step.responseName || 'context'] = result;
        return result;
    }
    resolveMcpLlmProvider(component, config) {
        const provider = String(component.mcpLlmProvider || '').trim();
        if (provider === 'openai')
            return 'openai';
        if (provider === 'azure_openai' || provider === 'azure')
            return 'azure_openai';
        if (['gemini', 'claude', 'grok', 'bedrock'].includes(provider))
            return provider;
        const flowProvider = this.flowLlmProvider(config);
        return flowProvider === 'azure' ? 'azure_openai' : flowProvider || 'openai';
    }
    normalizeMcpSchema(value) {
        const schema = this.parseJsonConfig(value, {});
        return this.isPlainObject(schema) ? schema : {};
    }
    getMcpSchemaKeys(schema) {
        return this.isPlainObject(schema?.properties) ? Object.keys(schema.properties) : [];
    }
    filterMcpObjectBySchema(value, schema) {
        const source = this.isPlainObject(value) ? value : {};
        if (!this.isPlainObject(schema?.properties) || schema.additionalProperties === true) {
            return source;
        }
        const allowedKeys = new Set(Object.keys(schema.properties));
        return Object.fromEntries(Object.entries(source).filter(([key]) => allowedKeys.has(key)));
    }
    pruneMcpOptionalEmptyValues(value, schema, required = false) {
        if (value === undefined || value === null || value === '') {
            return required ? value : undefined;
        }
        if (Array.isArray(value)) {
            const items = value
                .map((item) => this.pruneMcpOptionalEmptyValues(item, schema?.items, false))
                .filter((item) => item !== undefined);
            return items.length || required ? items : undefined;
        }
        if (!this.isPlainObject(value))
            return value;
        const properties = this.isPlainObject(schema?.properties) ? schema.properties : {};
        const requiredKeys = new Set(Array.isArray(schema?.required) ? schema.required.map((key) => String(key)) : []);
        const entries = Object.entries(value).flatMap(([key, item]) => {
            const childRequired = requiredKeys.has(key);
            const child = this.pruneMcpOptionalEmptyValues(item, properties[key], childRequired);
            return child === undefined ? [] : [[key, child]];
        });
        return entries.length || required ? Object.fromEntries(entries) : undefined;
    }
    coerceMcpArgumentValueForSchema(value, schema) {
        if (value === undefined || value === null)
            return value;
        if (schema?.type === 'array') {
            const sourceItems = Array.isArray(value) ? value : [value];
            const items = sourceItems.flatMap((item) => {
                if (typeof item !== 'string')
                    return [item];
                const trimmed = item.trim();
                if (!trimmed)
                    return [item];
                try {
                    const parsed = JSON.parse(trimmed);
                    return Array.isArray(parsed) ? parsed : [item];
                }
                catch {
                    return [item];
                }
            });
            return items.map((item) => this.coerceMcpArgumentValueForSchema(item, schema?.items));
        }
        if (schema?.type === 'boolean' && typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true')
                return true;
            if (normalized === 'false')
                return false;
        }
        if ((schema?.type === 'number' || schema?.type === 'integer') && typeof value === 'string' && value.trim()) {
            const numericValue = Number(value);
            if (Number.isFinite(numericValue))
                return schema.type === 'integer' ? Math.trunc(numericValue) : numericValue;
        }
        if (schema?.type === 'object' && typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (this.isPlainObject(parsed))
                    return this.coerceMcpArgumentValueForSchema(parsed, schema);
            }
            catch {
            }
        }
        if (!this.isPlainObject(value) || schema?.type !== 'object')
            return value;
        const properties = this.isPlainObject(schema?.properties) ? schema.properties : {};
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            this.coerceMcpArgumentValueForSchema(item, properties[key]),
        ]));
    }
    normalizeMcpArgumentsForSchema(value, schema) {
        const filtered = this.filterMcpObjectBySchema(value, schema);
        return this.pruneMcpOptionalEmptyValues(this.coerceMcpArgumentValueForSchema(filtered, schema), schema, true);
    }
    buildMcpContextPayload(context) {
        return {
            channel: context.channel,
            conversationId: context.conversationId,
            agentId: context.agentId,
            flowId: context.flowId,
            flowName: context.flowName,
            input: context.input,
            now: context.now,
            slots: context.slots,
        };
    }
    async generateMcpPayloadWithLlm(options) {
        const { component, config, context, mode, inputSchema, outputSchema, apiResult } = options;
        const provider = this.resolveMcpLlmProvider(component, config);
        const model = await this.getChatModelForProvider(provider, component.mcpModel || config.model, context?.agentId);
        const instruction = this.renderTemplate(component.mcpInstruction || '', context);
        const temperature = this.limitDecimal(component.mcpTemperature ?? 0.1, 0.1, 0, 1);
        const completion = await (await this.getOpenAIClientForProvider(provider, context?.agentId)).chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce executa uma ferramenta MCP-style dentro de um fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        'Use pt-BR em textos explicativos.',
                        'Use somente dados fornecidos no contexto, na instrucao e no resultado de API recebido.',
                        'Nao invente dados sensiveis, segredos, tokens, endpoints ou identificadores.',
                        mode === 'api'
                            ? 'Formato obrigatorio: {"arguments":{},"request":{"method":"GET|POST|PUT|PATCH|DELETE","url":"https://...","headers":{},"params":{},"bodyType":"none|jsonFields|jsonText|text","body":{}},"output":{},"explanation":"string"}.'
                            : 'Formato obrigatorio: {"arguments":{},"output":{},"explanation":"string"}.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        tool: {
                            name: component.mcpToolName || 'mcp_tool',
                            description: component.mcpToolDescription || '',
                            mode,
                        },
                        instruction,
                        inputSchema,
                        outputSchema,
                        api: mode === 'api'
                            ? {
                                configuredMethod: component.mcpApiMethod || 'POST',
                                allowedBaseUrl: this.renderTemplate(component.mcpApiBaseUrl || '', context),
                                configuredHeaders: this.parseTemplatedJsonConfig(component.mcpApiHeadersJson || '{}', {}, context),
                                configuredQuery: this.parseTemplatedJsonConfig(component.mcpApiQueryJson || '{}', {}, context),
                                configuredBody: this.parseTemplatedJsonConfig(component.mcpApiBodyJson || '{}', {}, context),
                                canSuggestRequest: component.mcpApiAllowLlmRequest !== false,
                                apiResult,
                            }
                            : undefined,
                        externalMcp: mode === 'external'
                            ? {
                                transport: component.mcpExternalTransport || 'streamable_http',
                                serverUrl: this.renderTemplate(component.mcpExternalUrl || '', context),
                                operation: component.mcpExternalOperation || 'callTool',
                                toolName: component.mcpExternalToolName || '',
                                resourceUri: component.mcpExternalResourceUri || '',
                                promptName: component.mcpExternalPromptName || '',
                                configuredArguments: this.parseTemplatedJsonConfig(component.mcpExternalArgumentsJson || '{}', {}, context),
                                configuredPromptArguments: this.parseTemplatedJsonConfig(component.mcpExternalPromptArgumentsJson || '{}', {}, context),
                                result: apiResult,
                            }
                            : undefined,
                        context: this.buildMcpContextPayload(context),
                    }, null, 2),
                },
            ],
            temperature,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        return {
            provider,
            model,
            parsed: this.isPlainObject(parsed) ? parsed : {},
        };
    }
    normalizeMcpMethod(value, fallback) {
        const method = String(value || fallback || 'POST').trim().toUpperCase();
        return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'POST';
    }
    normalizeMcpBodyType(value, body) {
        const bodyType = String(value || '').trim();
        if (bodyType === 'none' || body === undefined)
            return 'none';
        if (!bodyType && this.isPlainObject(body) && !Object.keys(body).length)
            return 'none';
        if (bodyType === 'text' || bodyType === 'jsonText' || bodyType === 'jsonFields')
            return bodyType;
        return this.isPlainObject(body) || Array.isArray(body) ? 'jsonFields' : 'text';
    }
    isMcpGeneratedUrlAllowed(candidate, configuredBaseUrl) {
        const requested = String(candidate || '').trim();
        const base = String(configuredBaseUrl || '').trim();
        if (!requested || !base)
            return false;
        try {
            const requestedUrl = new URL(requested);
            const baseUrl = new URL(base);
            if (requestedUrl.origin !== baseUrl.origin)
                return false;
            const basePath = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
            return baseUrl.pathname === '/' || requestedUrl.pathname === baseUrl.pathname || requestedUrl.pathname.startsWith(basePath);
        }
        catch {
            return false;
        }
    }
    applyMcpAuth(request, component, context) {
        const mode = component.mcpApiAuthMode || 'none';
        const secret = String(this.renderTemplate(component.mcpApiAuthSecret || '', context) || '').trim();
        if (mode === 'none' || !secret)
            return request;
        const next = {
            ...request,
            headers: this.isPlainObject(request.headers) ? { ...request.headers } : {},
            params: this.isPlainObject(request.params) ? { ...request.params } : {},
        };
        if (mode === 'bearer') {
            const headerName = String(component.mcpApiAuthHeaderName || 'Authorization').trim() || 'Authorization';
            next.headers[headerName] = /^Bearer\s+/i.test(secret) ? secret : `Bearer ${secret}`;
        }
        else if (mode === 'header') {
            const headerName = String(component.mcpApiAuthHeaderName || 'x-api-key').trim() || 'x-api-key';
            next.headers[headerName] = secret;
        }
        else if (mode === 'query') {
            const param = String(component.mcpApiAuthQueryParam || 'api_key').trim() || 'api_key';
            next.params[param] = secret;
        }
        return next;
    }
    redactMcpRequest(request, component) {
        const secretHeader = String(component.mcpApiAuthHeaderName || '').trim().toLowerCase();
        const secretParam = String(component.mcpApiAuthQueryParam || '').trim();
        const headers = Object.fromEntries(Object.entries(request?.headers || {}).map(([key, value]) => [
            key,
            /authorization|token|api-key|x-api-key|cookie|secret/i.test(key) || key.toLowerCase() === secretHeader ? '[redacted]' : value,
        ]));
        const params = Object.fromEntries(Object.entries(request?.params || {}).map(([key, value]) => [
            key,
            /token|api-key|secret|password/i.test(key) || key === secretParam ? '[redacted]' : value,
        ]));
        return {
            ...request,
            headers,
            params,
        };
    }
    redactMcpExternalUrl(rawUrl, component) {
        try {
            const url = new URL(String(rawUrl || ''));
            const secretParam = String(component.mcpExternalAuthQueryParam || '').trim();
            for (const key of Array.from(url.searchParams.keys())) {
                if (/token|api-key|secret|password/i.test(key) || key === secretParam) {
                    url.searchParams.set(key, '[redacted]');
                }
            }
            return url.toString();
        }
        catch {
            return String(rawUrl || '');
        }
    }
    buildMcpExternalHeaders(component, context) {
        const configuredHeaders = this.parseTemplatedJsonConfig(component.mcpExternalHeadersJson || '{}', {}, context);
        const headers = this.isPlainObject(configuredHeaders) ? { ...configuredHeaders } : {};
        const mode = component.mcpExternalAuthMode || 'none';
        const secret = String(this.renderTemplate(component.mcpExternalAuthSecret || '', context) || '').trim();
        if (!secret)
            return headers;
        if (mode === 'bearer') {
            const headerName = String(component.mcpExternalAuthHeaderName || 'Authorization').trim() || 'Authorization';
            headers[headerName] = /^Bearer\s+/i.test(secret) ? secret : `Bearer ${secret}`;
        }
        else if (mode === 'header') {
            const headerName = String(component.mcpExternalAuthHeaderName || 'x-api-key').trim() || 'x-api-key';
            headers[headerName] = secret;
        }
        return headers;
    }
    buildMcpExternalUrl(component, context) {
        const rawUrl = String(this.renderTemplate(component.mcpExternalUrl || '', context) || '').trim();
        if (!rawUrl) {
            throw new common_1.HttpException('Servidor MCP externo precisa de URL.', common_1.HttpStatus.BAD_REQUEST);
        }
        let url;
        try {
            url = new URL(rawUrl);
        }
        catch {
            throw new common_1.HttpException('URL do servidor MCP externo invalida.', common_1.HttpStatus.BAD_REQUEST);
        }
        const transport = component.mcpExternalTransport || 'streamable_http';
        const allowedProtocols = transport === 'websocket'
            ? new Set(['ws:', 'wss:'])
            : new Set(['http:', 'https:']);
        if (!allowedProtocols.has(url.protocol)) {
            throw new common_1.HttpException('Protocolo do servidor MCP externo nao combina com o transporte selecionado.', common_1.HttpStatus.BAD_REQUEST);
        }
        const secret = String(this.renderTemplate(component.mcpExternalAuthSecret || '', context) || '').trim();
        if ((component.mcpExternalAuthMode || 'none') === 'query' && secret) {
            const param = String(component.mcpExternalAuthQueryParam || 'api_key').trim() || 'api_key';
            url.searchParams.set(param, secret);
        }
        return url;
    }
    createFetchWithMcpHeaders(headers) {
        return async (url, init = {}) => {
            const mergedHeaders = {
                ...(init?.headers || {}),
                ...headers,
            };
            return await fetch(url, {
                ...init,
                headers: mergedHeaders,
            });
        };
    }
    removeMcpExternalHeader(headers, headerName) {
        const normalized = String(headerName || '').trim().toLowerCase();
        Object.keys(headers || {}).forEach((key) => {
            if (key.toLowerCase() === normalized)
                delete headers[key];
        });
    }
    normalizeMcpExternalError(error, component) {
        const message = this.getErrorMessage(error);
        const googleMcpService = message.match(/\b([a-z][a-z0-9-]*mcp\.googleapis\.com)\b/i)?.[1];
        const googleProject = message.match(/\bproject\s+([a-z0-9-]+)\b/i)?.[1];
        const googleEnableUrl = message.match(/https:\/\/console\.(?:developers\.google\.com|cloud\.google\.com)\/[^\s"'\\]+/i)?.[0];
        const googleBaseService = {
            'gmailmcp.googleapis.com': 'gmail.googleapis.com',
            'drivemcp.googleapis.com': 'drive.googleapis.com',
            'calendarmcp.googleapis.com': 'calendar-json.googleapis.com',
            'chatmcp.googleapis.com': 'chat.googleapis.com',
        }[String(googleMcpService || '').toLowerCase()];
        if (googleMcpService
            && /has not been used in project|it is disabled|service_disabled|accessnotconfigured/i.test(message)) {
            const projectLabel = googleProject ? ` no projeto Google Cloud ${googleProject}` : '';
            const enableHint = googleEnableUrl ? ` Habilite em ${googleEnableUrl}.` : '';
            const baseServiceHint = googleBaseService
                ? ` Habilite tambem ${googleBaseService}.`
                : ' Habilite tambem a API base correspondente.';
            return new common_1.HttpException(`API Google Workspace MCP desabilitada${projectLabel}: ${googleMcpService}.${enableHint}${baseServiceHint} Aguarde alguns minutos antes de testar novamente.`, common_1.HttpStatus.FAILED_DEPENDENCY);
        }
        if (/gmailmcp\.googleapis\.com/i.test(String(component.mcpExternalUrl || ''))
            && /at least one recipient\s*\(to,\s*cc,\s*or\s*bcc\)\s*must be specified/i.test(message)) {
            return new common_1.HttpException('Gmail MCP exige pelo menos um destinatario. Informe listas de emails, por exemplo {"to":["cliente@example.com"]}. Remova cc, bcc e attachments quando estiverem vazios.', common_1.HttpStatus.BAD_GATEWAY);
        }
        if (/gmailmcp\.googleapis\.com/i.test(String(component.mcpExternalUrl || ''))
            && /caller does not have permission|permission[_\s-]*denied|insufficient permissions?|\b403\b|forbidden/i.test(message)) {
            return new common_1.HttpException('Gmail MCP recusou a permissao da conta Google. No Google Auth Platform > Data Access, adicione https://www.googleapis.com/auth/gmail.readonly e https://www.googleapis.com/auth/gmail.compose. Se a audiencia OAuth for External, inclua a conta em Test users. Depois use Reconectar do zero no node MCP e aceite os novos scopes. Como o Google Workspace MCP esta em Developer Preview, confirme tambem a liberacao da conta ou do dominio com o administrador.', common_1.HttpStatus.FORBIDDEN);
        }
        if (component.mcpExternalAuthMode === 'oauth'
            && (/unauthorized|http\s*401|\b401\b/i.test(message) || Number(error?.status || error?.statusCode) === 401)) {
            return new common_1.HttpException('OAuth MCP nao autorizado. A autorizacao pode estar pendente, expirada ou revogada. Conclua Abrir autorizacao ou use Reconectar do zero no node MCP.', common_1.HttpStatus.UNAUTHORIZED);
        }
        return error;
    }
    normalizeMcpFetchHeaders(headers) {
        return Object.fromEntries(new Headers(headers || {}).entries());
    }
    getAwsMcpEndpointConfig(url) {
        const hostnameParts = url.hostname.split('.');
        const endpointService = hostnameParts.length === 4 && hostnameParts[2] === 'api' && hostnameParts[3] === 'aws'
            ? hostnameParts[0]
            : '';
        const endpointRegion = hostnameParts.length === 4 && hostnameParts[2] === 'api' && hostnameParts[3] === 'aws'
            ? hostnameParts[1]
            : '';
        const service = String(this.configService.get('CANVAS_FLOW_AWS_MCP_SIGNING_SERVICE') || endpointService || '').trim();
        const region = String(this.configService.get('CANVAS_FLOW_AWS_MCP_SIGNING_REGION') || endpointRegion || this.configService.get('AWS_REGION') || '').trim();
        const targetRegion = String(this.configService.get('CANVAS_FLOW_AWS_MCP_TARGET_REGION') || this.configService.get('AWS_REGION') || region).trim();
        if (!service || !region) {
            throw new common_1.HttpException('Nao foi possivel inferir service e region para AWS SigV4. Configure CANVAS_FLOW_AWS_MCP_SIGNING_SERVICE e CANVAS_FLOW_AWS_MCP_SIGNING_REGION.', common_1.HttpStatus.BAD_REQUEST);
        }
        return { service, region, targetRegion };
    }
    injectAwsMcpMetadata(body, targetRegion) {
        if (!body || !targetRegion)
            return body;
        let raw;
        if (typeof body === 'string')
            raw = body;
        else if (Buffer.isBuffer(body) || ArrayBuffer.isView(body))
            raw = Buffer.from(body).toString('utf8');
        else if (body instanceof ArrayBuffer)
            raw = Buffer.from(body).toString('utf8');
        else
            return body;
        try {
            const parsed = JSON.parse(raw);
            if (!this.isPlainObject(parsed) || !parsed.jsonrpc)
                return body;
            const params = this.isPlainObject(parsed.params) ? { ...parsed.params } : {};
            const metadata = this.isPlainObject(params._meta) ? params._meta : {};
            params._meta = { AWS_REGION: targetRegion, ...metadata };
            parsed.params = params;
            return JSON.stringify(parsed);
        }
        catch {
            return body;
        }
    }
    createAwsSigV4Fetch(url, baseHeaders) {
        if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
            throw new common_1.HttpException('AWS SigV4 exige HTTPS para endpoints remotos.', common_1.HttpStatus.BAD_REQUEST);
        }
        const { service, region, targetRegion } = this.getAwsMcpEndpointConfig(url);
        const signer = new signature_v4_1.SignatureV4({
            credentials: (0, credential_provider_node_1.defaultProvider)(),
            region,
            service,
            sha256: sha256_js_1.Sha256,
        });
        return async (rawUrl, init = {}) => {
            const targetUrl = new URL(rawUrl.toString());
            if (targetUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(targetUrl.hostname)) {
                throw new common_1.HttpException('AWS SigV4 exige HTTPS para endpoints remotos.', common_1.HttpStatus.BAD_REQUEST);
            }
            const body = this.injectAwsMcpMetadata(init.body, targetRegion);
            const headers = {
                ...this.normalizeMcpFetchHeaders(baseHeaders),
                ...this.normalizeMcpFetchHeaders(init.headers),
                host: targetUrl.host,
            };
            delete headers.connection;
            if (body !== undefined && body !== null) {
                headers['content-length'] = String(Buffer.byteLength(typeof body === 'string' ? body : Buffer.from(body)));
            }
            const query = {};
            targetUrl.searchParams.forEach((value, key) => {
                const current = query[key];
                query[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
            });
            const signed = await signer.sign({
                method: String(init.method || 'GET').toUpperCase(),
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                ...(targetUrl.port ? { port: Number(targetUrl.port) } : {}),
                path: targetUrl.pathname || '/',
                query,
                headers,
                body,
            });
            const signedHeaders = { ...signed.headers };
            delete signedHeaders.host;
            return await fetch(targetUrl, {
                ...init,
                body,
                headers: signedHeaders,
            });
        };
    }
    async createMcpExternalTransport(component, context) {
        const transportName = component.mcpExternalTransport || 'streamable_http';
        const url = this.buildMcpExternalUrl(component, context);
        const headers = this.buildMcpExternalHeaders(component, context);
        const authMode = component.mcpExternalAuthMode || 'none';
        const oauthEnabled = authMode === 'oauth';
        const awsSigv4Enabled = authMode === 'aws_sigv4';
        if (oauthEnabled) {
            this.removeMcpExternalHeader(headers, 'authorization');
        }
        const authProvider = oauthEnabled
            ? await this.mcpOAuthService.createRuntimeProvider({
                serverUrl: url.toString(),
                agentId: context?.agentId,
                organizationId: context?.organizationId,
                connectionScope: component.mcpExternalOAuthConnectionScope,
                oauthUserId: context?.oauthUserId,
            })
            : undefined;
        if (transportName === 'websocket') {
            if (oauthEnabled) {
                throw new common_1.HttpException('OAuth MCP externo nao esta disponivel para WebSocket neste runtime. Use Streamable HTTP ou SSE.', common_1.HttpStatus.BAD_REQUEST);
            }
            if (awsSigv4Enabled) {
                throw new common_1.HttpException('AWS SigV4 nao esta disponivel para WebSocket neste runtime. Use Streamable HTTP.', common_1.HttpStatus.BAD_REQUEST);
            }
            const headerKeys = Object.keys(headers);
            if (headerKeys.length) {
                throw new common_1.HttpException('WebSocket MCP externo nao aceita headers neste runtime. Use auth por query ou Streamable HTTP.', common_1.HttpStatus.BAD_REQUEST);
            }
            return {
                transport: new websocket_js_1.WebSocketClientTransport(url),
                url,
                safeUrl: this.redactMcpExternalUrl(url.toString(), component),
                headers,
                transportName,
                oauth: false,
                authMode,
            };
        }
        if (transportName === 'sse') {
            const fetchWithHeaders = awsSigv4Enabled
                ? this.createAwsSigV4Fetch(url, headers)
                : this.createFetchWithMcpHeaders(headers);
            return {
                transport: new sse_js_1.SSEClientTransport(url, {
                    authProvider,
                    requestInit: { headers },
                    eventSourceInit: { fetch: fetchWithHeaders },
                    fetch: fetchWithHeaders,
                }),
                url,
                safeUrl: this.redactMcpExternalUrl(url.toString(), component),
                headers,
                transportName,
                oauth: oauthEnabled,
                authMode,
            };
        }
        const fetchWithHeaders = awsSigv4Enabled ? this.createAwsSigV4Fetch(url, headers) : undefined;
        return {
            transport: new streamableHttp_js_1.StreamableHTTPClientTransport(url, {
                authProvider,
                requestInit: { headers },
                ...(fetchWithHeaders ? { fetch: fetchWithHeaders } : {}),
            }),
            url,
            safeUrl: this.redactMcpExternalUrl(url.toString(), component),
            headers,
            transportName: 'streamable_http',
            oauth: oauthEnabled,
            authMode,
        };
    }
    redactMcpExternalHeaders(headers, component) {
        const secretHeader = String(component.mcpExternalAuthHeaderName || '').trim().toLowerCase();
        return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [
            key,
            /authorization|token|api-key|x-api-key|cookie|secret/i.test(key) || key.toLowerCase() === secretHeader ? '[redacted]' : value,
        ]));
    }
    async listExternalMcpTools(body) {
        const source = this.isPlainObject(body?.component) ? body.component : body;
        const transport = ['streamable_http', 'sse', 'websocket'].includes(String(source?.mcpExternalTransport))
            ? source.mcpExternalTransport
            : 'streamable_http';
        const authMode = ['none', 'bearer', 'header', 'query', 'oauth', 'aws_sigv4'].includes(String(source?.mcpExternalAuthMode))
            ? source.mcpExternalAuthMode
            : 'none';
        const component = {
            type: 'mcp',
            mcpMode: 'external',
            mcpExternalTransport: transport,
            mcpExternalUrl: String(source?.mcpExternalUrl || ''),
            mcpExternalHeadersJson: source?.mcpExternalHeadersJson || '{}',
            mcpExternalAuthMode: authMode,
            mcpExternalOAuthConnectionScope: source?.mcpExternalOAuthConnectionScope === 'user' ? 'user' : 'agent',
            mcpExternalAuthHeaderName: String(source?.mcpExternalAuthHeaderName || 'Authorization'),
            mcpExternalAuthQueryParam: String(source?.mcpExternalAuthQueryParam || 'api_key'),
            mcpExternalAuthSecret: String(source?.mcpExternalAuthSecret || ''),
            mcpExternalTimeoutMs: this.limitNumber(source?.mcpExternalTimeoutMs ?? 30000, 30000, 1000, 300000),
        };
        const context = {
            agentId: String(body?.agentId || 'default-agent'),
            organizationId: body?._organizationId,
            oauthUserId: body?._oauthUserId,
            slots: {},
        };
        const connection = await this.createMcpExternalTransport(component, context);
        const client = new index_js_1.Client({ name: 'canvas-flow-discovery', version: '0.1.0' }, { capabilities: {} });
        const requestOptions = {
            timeout: component.mcpExternalTimeoutMs,
            maxTotalTimeout: component.mcpExternalTimeoutMs,
        };
        try {
            await client.connect(connection.transport, requestOptions);
            const result = await client.listTools(undefined, requestOptions);
            return {
                external: {
                    transport: connection.transportName,
                    url: connection.safeUrl,
                    authMode: connection.authMode,
                    server: client.getServerVersion(),
                    capabilities: client.getServerCapabilities(),
                },
                tools: (result?.tools || []).map((tool) => ({
                    name: String(tool?.name || ''),
                    title: tool?.title ? String(tool.title) : undefined,
                    description: tool?.description ? String(tool.description) : undefined,
                    inputSchema: this.isPlainObject(tool?.inputSchema) ? this.toPlain(tool.inputSchema) : {},
                    outputSchema: this.isPlainObject(tool?.outputSchema) ? this.toPlain(tool.outputSchema) : undefined,
                    annotations: this.isPlainObject(tool?.annotations) ? this.toPlain(tool.annotations) : undefined,
                })).filter((tool) => tool.name),
            };
        }
        catch (error) {
            throw this.normalizeMcpExternalError(error, component);
        }
        finally {
            await client.close().catch(() => undefined);
        }
    }
    getTextFromMcpContent(result) {
        const content = Array.isArray(result?.content) ? result.content : [];
        return content
            .map((item) => {
            if (item?.type === 'text')
                return item.text;
            if (item?.type === 'resource' && item.resource?.text)
                return item.resource.text;
            if (item?.type === 'resource_link')
                return item.uri || item.name;
            return '';
        })
            .filter(Boolean)
            .join('\n')
            .trim();
    }
    getMcpResultOutputCandidate(result) {
        if (this.isPlainObject(result?.structuredContent))
            return result.structuredContent;
        if (this.isPlainObject(result?.toolResult))
            return result.toolResult;
        const text = this.getTextFromMcpContent(result);
        if (text) {
            const parsed = this.parseGeneratedJson(text);
            if (this.isPlainObject(parsed))
                return parsed;
            return { text };
        }
        return this.isPlainObject(result) ? result : {};
    }
    async runExternalMcpComponent(step, config, context, inputSchema, outputSchema) {
        const component = step.component;
        const operation = component.mcpExternalOperation || 'callTool';
        const timeout = this.limitNumber(component.mcpExternalTimeoutMs ?? 30000, 30000, 1000, 300000);
        const connection = await this.createMcpExternalTransport(component, context);
        const client = new index_js_1.Client({ name: 'canvas-flow', version: '0.1.0' }, { capabilities: {} });
        const requestOptions = { timeout, maxTotalTimeout: timeout };
        let tools;
        let argumentsPayload = {};
        try {
            await client.connect(connection.transport, requestOptions);
            let externalResult;
            if (operation === 'ping') {
                externalResult = await client.ping(requestOptions);
            }
            else if (operation === 'listTools') {
                externalResult = await client.listTools(undefined, requestOptions);
            }
            else if (operation === 'listResources') {
                externalResult = await client.listResources(undefined, requestOptions);
            }
            else if (operation === 'readResource') {
                const uri = this.renderTemplate(component.mcpExternalResourceUri || '', context);
                if (!String(uri || '').trim())
                    throw new common_1.HttpException('Informe a URI do resource MCP.', common_1.HttpStatus.BAD_REQUEST);
                externalResult = await client.readResource({ uri: String(uri) }, requestOptions);
            }
            else if (operation === 'listPrompts') {
                externalResult = await client.listPrompts(undefined, requestOptions);
            }
            else if (operation === 'getPrompt') {
                const name = this.renderTemplate(component.mcpExternalPromptName || '', context);
                if (!String(name || '').trim())
                    throw new common_1.HttpException('Informe o nome do prompt MCP.', common_1.HttpStatus.BAD_REQUEST);
                const configuredArgs = this.parseTemplatedJsonConfig(component.mcpExternalPromptArgumentsJson || '{}', {}, context);
                const argsSchema = inputSchema;
                if (component.mcpExternalUseLlmArguments !== false) {
                    const generated = await this.generateMcpPayloadWithLlm({
                        component,
                        config,
                        context,
                        mode: 'external',
                        inputSchema: argsSchema,
                        outputSchema,
                    });
                    argumentsPayload = this.normalizeMcpArgumentsForSchema({
                        ...(this.isPlainObject(configuredArgs) ? configuredArgs : {}),
                        ...(this.isPlainObject(generated.parsed.arguments) ? generated.parsed.arguments : {}),
                    }, argsSchema);
                }
                else {
                    argumentsPayload = this.normalizeMcpArgumentsForSchema(configuredArgs, argsSchema);
                }
                externalResult = await client.getPrompt({ name: String(name), arguments: argumentsPayload }, requestOptions);
            }
            else {
                const toolName = this.renderTemplate(component.mcpExternalToolName || '', context);
                if (!String(toolName || '').trim())
                    throw new common_1.HttpException('Informe o nome da tool MCP.', common_1.HttpStatus.BAD_REQUEST);
                tools = (await client.listTools(undefined, requestOptions).catch(() => ({ tools: [] })))?.tools || [];
                const tool = tools.find((item) => item?.name === toolName);
                const toolInputSchema = this.isPlainObject(tool?.inputSchema) ? tool.inputSchema : inputSchema;
                const configuredArgs = this.parseTemplatedJsonConfig(component.mcpExternalArgumentsJson || '{}', {}, context);
                if (component.mcpExternalUseLlmArguments !== false) {
                    const generated = await this.generateMcpPayloadWithLlm({
                        component,
                        config,
                        context,
                        mode: 'external',
                        inputSchema: toolInputSchema,
                        outputSchema,
                    });
                    argumentsPayload = this.normalizeMcpArgumentsForSchema({
                        ...(this.isPlainObject(configuredArgs) ? configuredArgs : {}),
                        ...(this.isPlainObject(generated.parsed.arguments) ? generated.parsed.arguments : {}),
                    }, toolInputSchema);
                }
                else {
                    argumentsPayload = this.normalizeMcpArgumentsForSchema(configuredArgs, toolInputSchema);
                }
                externalResult = await client.callTool({ name: String(toolName), arguments: argumentsPayload }, undefined, requestOptions);
            }
            if (externalResult?.isError === true) {
                const detail = this.getTextFromMcpContent(externalResult) || 'O servidor MCP retornou isError=true.';
                throw new common_1.HttpException(`Tool MCP externa retornou erro: ${detail}`, common_1.HttpStatus.BAD_GATEWAY);
            }
            let output = this.filterMcpObjectBySchema(this.getMcpResultOutputCandidate(externalResult), outputSchema);
            if (component.mcpExternalMapResultWithLlm !== false &&
                this.getMcpSchemaKeys(outputSchema).length &&
                !Object.keys(output).length) {
                const mapped = await this.generateMcpPayloadWithLlm({
                    component,
                    config,
                    context,
                    mode: 'external',
                    inputSchema,
                    outputSchema,
                    apiResult: externalResult,
                });
                output = this.filterMcpObjectBySchema(mapped.parsed.output || mapped.parsed.result || {}, outputSchema);
            }
            return {
                external: {
                    operation,
                    transport: connection.transportName,
                    url: connection.safeUrl,
                    headers: this.redactMcpExternalHeaders(connection.headers, component),
                    oauth: connection.oauth,
                    authMode: connection.authMode,
                    server: client.getServerVersion(),
                    capabilities: client.getServerCapabilities(),
                },
                arguments: this.toPlain(argumentsPayload),
                rawResult: this.toPlain(externalResult),
                output: this.toPlain(output),
                tools: tools?.map((tool) => ({
                    name: tool?.name,
                    description: tool?.description,
                    inputSchema: tool?.inputSchema,
                    outputSchema: tool?.outputSchema,
                })),
            };
        }
        catch (error) {
            throw this.normalizeMcpExternalError(error, component);
        }
        finally {
            await client.close().catch(() => undefined);
        }
    }
    buildMcpApiRequest(component, context, llmRequest) {
        return this.buildMcpApiRequestFromConfig(component, context, {
            method: component.mcpApiMethod || 'POST',
            url: component.mcpApiBaseUrl || '',
            headersJson: component.mcpApiHeadersJson || '{}',
            queryJson: component.mcpApiQueryJson || '{}',
            bodyJson: component.mcpApiBodyJson || '{}',
        }, llmRequest);
    }
    parseMcpApiJsonValue(value, fallback, context) {
        if (value === undefined || value === null || value === '')
            return fallback;
        if (typeof value !== 'string')
            return this.renderTemplate(value, context);
        return this.parseTemplatedJsonConfig(value, fallback, context);
    }
    buildMcpApiRequestFromConfig(component, context, requestConfig, llmRequest) {
        const configuredUrl = String(this.renderTemplate(requestConfig?.url || component.mcpApiBaseUrl || '', context) || '').trim();
        if (!configuredUrl) {
            throw new common_1.HttpException('MCP API precisa de URL/base permitida.', common_1.HttpStatus.BAD_REQUEST);
        }
        const llmCanSuggest = component.mcpApiAllowLlmRequest !== false && this.isPlainObject(llmRequest);
        const llmUrl = llmCanSuggest ? String(llmRequest.url || '').trim() : '';
        if (llmUrl && !this.isMcpGeneratedUrlAllowed(llmUrl, configuredUrl)) {
            throw new common_1.HttpException('MCP tentou chamar URL fora da base permitida.', common_1.HttpStatus.BAD_REQUEST);
        }
        const configuredHeaders = this.parseMcpApiJsonValue(requestConfig?.headersJson ?? requestConfig?.headers ?? component.mcpApiHeadersJson ?? '{}', {}, context);
        const configuredQuery = this.parseMcpApiJsonValue(requestConfig?.queryJson ?? requestConfig?.query ?? requestConfig?.params ?? component.mcpApiQueryJson ?? '{}', {}, context);
        const configuredBody = this.parseMcpApiJsonValue(requestConfig?.bodyJson ?? requestConfig?.body ?? requestConfig?.data ?? component.mcpApiBodyJson ?? '{}', {}, context);
        const llmBody = llmCanSuggest && llmRequest.body !== undefined ? llmRequest.body : llmRequest?.data;
        const body = llmBody !== undefined ? llmBody : configuredBody;
        const bodyType = this.normalizeMcpBodyType(llmCanSuggest ? llmRequest.bodyType : requestConfig?.bodyType, body);
        const request = {
            method: this.normalizeMcpMethod(llmCanSuggest ? llmRequest.method : undefined, requestConfig?.method || component.mcpApiMethod || 'POST'),
            url: llmUrl || configuredUrl,
            headers: {
                ...(this.isPlainObject(configuredHeaders) ? configuredHeaders : {}),
                ...(llmCanSuggest && this.isPlainObject(llmRequest.headers) ? llmRequest.headers : {}),
            },
            params: {
                ...(this.isPlainObject(configuredQuery) ? configuredQuery : {}),
                ...(llmCanSuggest && this.isPlainObject(llmRequest.params) ? llmRequest.params : {}),
            },
            bodyType,
            ...(bodyType === 'none' ? {} : { body }),
        };
        return this.applyMcpAuth(request, component, context);
    }
    normalizeMcpApiRequestConfigs(value) {
        const source = this.parseJsonConfig(value, []);
        const rawItems = Array.isArray(source)
            ? source
            : Array.isArray(source?.requests)
                ? source.requests
                : source?.request
                    ? [source.request]
                    : [];
        return rawItems
            .slice(0, 10)
            .filter((item) => this.isPlainObject(item))
            .map((item, index) => ({
            ...item,
            id: String(item.id || item.key || `request_${index + 1}`).trim().replace(/\s+/g, '_'),
            label: String(item.label || item.title || `Chamada ${index + 1}`),
        }));
    }
    createMcpApiProgress(responseName, results, resultsById) {
        return {
            mode: 'api',
            callMode: 'multi',
            results,
            resultsById,
            latest: results[results.length - 1],
            output: {},
            responseName,
        };
    }
    extractMcpApiOutputWithoutLlm(apiResult, outputSchema) {
        const candidates = [];
        const addCandidate = (value) => {
            if (this.isPlainObject(value))
                candidates.push(value);
        };
        addCandidate(apiResult?.structuredContent);
        addCandidate(apiResult?.output);
        addCandidate(apiResult?.result);
        addCandidate(apiResult?.data);
        addCandidate(apiResult?.body);
        const results = Array.isArray(apiResult?.results) ? apiResult.results : [];
        const latest = apiResult?.latest || results[results.length - 1];
        [latest, ...(results.length === 1 ? [results[0]] : [])].forEach((item) => {
            addCandidate(item?.structuredContent);
            addCandidate(item?.output);
            addCandidate(item?.result);
            addCandidate(item?.data);
            addCandidate(item?.finalData);
            addCandidate(item?.body);
            addCandidate(item?.polling?.value);
            addCandidate(item);
        });
        addCandidate(apiResult);
        const hasSchemaKeys = this.getMcpSchemaKeys(outputSchema).length > 0;
        for (const candidate of candidates) {
            const filtered = this.filterMcpObjectBySchema(candidate, outputSchema);
            if (Object.keys(filtered).length || !hasSchemaKeys)
                return filtered;
        }
        return {};
    }
    async runMcpMultiApiRequests(component, responseName, context, execute = true) {
        const configs = this.normalizeMcpApiRequestConfigs(component.mcpApiRequestsJson || '[]');
        if (!configs.length) {
            throw new common_1.HttpException('MCP API com varias chamadas precisa de pelo menos uma chamada configurada.', common_1.HttpStatus.BAD_REQUEST);
        }
        const executionMode = component.mcpApiExecutionMode === 'parallel' ? 'parallel' : 'sequential';
        if (!execute) {
            const requests = configs.map((config) => this.buildMcpApiRequestFromConfig(component, context, config));
            return {
                executionMode,
                requests,
                apiResult: {
                    executionMode,
                    pending: true,
                    results: [],
                    resultsById: {},
                },
            };
        }
        if (executionMode === 'parallel') {
            const requests = configs.map((config) => this.buildMcpApiRequestFromConfig(component, context, config));
            const batch = await this.httpBatchService.execute(requests, context);
            const results = (batch?.results || []).map((result, index) => ({
                ...result,
                id: configs[index]?.id || `request_${index + 1}`,
                label: configs[index]?.label || `Chamada ${index + 1}`,
            }));
            const resultsById = Object.fromEntries(results.map((result) => [result.id, result]));
            return {
                executionMode,
                requests,
                apiResult: {
                    executionMode,
                    results,
                    resultsById,
                },
            };
        }
        const requests = [];
        const results = [];
        const resultsById = {};
        const sequentialContext = {
            ...context,
            slots: {
                ...(context.slots || {}),
            },
        };
        for (const [index, config] of configs.entries()) {
            sequentialContext.slots[responseName] = this.createMcpApiProgress(responseName, results, resultsById);
            const request = this.buildMcpApiRequestFromConfig(component, sequentialContext, config);
            requests.push(request);
            const batch = await this.httpBatchService.execute([request], sequentialContext);
            const result = {
                ...(batch?.results?.[0] || {}),
                id: config.id || `request_${index + 1}`,
                label: config.label || `Chamada ${index + 1}`,
            };
            results.push(result);
            resultsById[result.id] = result;
            sequentialContext.slots[responseName] = this.createMcpApiProgress(responseName, results, resultsById);
        }
        return {
            executionMode,
            requests,
            apiResult: {
                executionMode,
                results,
                resultsById,
            },
        };
    }
    async runMcpComponent(step, config, context) {
        const component = step.component;
        const responseName = component.responseName || step.responseName || 'mcp';
        const mode = component.mcpMode === 'api'
            ? 'api'
            : component.mcpMode === 'external'
                ? 'external'
                : 'fields';
        const inputSchema = this.normalizeMcpSchema(component.mcpInputSchema || '{}');
        const outputSchema = this.normalizeMcpSchema(component.mcpOutputSchema || '{}');
        if (mode === 'external') {
            const external = await this.runExternalMcpComponent(step, config, context, inputSchema, outputSchema);
            const result = {
                mode,
                tool: {
                    name: component.mcpToolName || component.mcpExternalToolName || 'external_mcp',
                    description: component.mcpToolDescription || '',
                },
                schema: {
                    inputKeys: this.getMcpSchemaKeys(inputSchema),
                    outputKeys: this.getMcpSchemaKeys(outputSchema),
                },
                ...external,
            };
            context.slots[responseName] = result;
            if (component.mcpMergeOutputToSlots === true && this.isPlainObject(result.output)) {
                this.mergeContextSlots(context, result.output);
            }
            return result;
        }
        const apiAllowsLlmRequest = component.mcpApiCallMode !== 'multi' && component.mcpApiAllowLlmRequest !== false;
        const apiMapsResultWithLlm = component.mcpApiMapResultWithLlm !== false;
        const shouldGenerateInitialPayload = mode !== 'api' || apiAllowsLlmRequest;
        const firstPass = shouldGenerateInitialPayload
            ? await this.generateMcpPayloadWithLlm({
                component,
                config,
                context,
                mode,
                inputSchema,
                outputSchema,
            })
            : { provider: '', model: '', parsed: {} };
        let request;
        let requests;
        let apiExecutionMode = '';
        let apiResult;
        let provider = firstPass.provider;
        let model = firstPass.model;
        let output = this.filterMcpObjectBySchema(firstPass.parsed.output || firstPass.parsed.result || {}, outputSchema);
        let explanation = this.limitText(firstPass.parsed.explanation || firstPass.parsed.reason || '', 1200);
        if (mode === 'api') {
            if (component.mcpApiCallMode === 'multi') {
                const multi = await this.runMcpMultiApiRequests(component, responseName, context, component.mcpApiExecute !== false);
                requests = multi.requests;
                apiResult = multi.apiResult;
                apiExecutionMode = multi.executionMode;
            }
            else {
                request = this.buildMcpApiRequest(component, context, apiAllowsLlmRequest ? firstPass.parsed.request : undefined);
            }
            if (component.mcpApiExecute !== false) {
                if (request) {
                    apiResult = await this.httpBatchService.execute([request], context);
                }
                if (apiMapsResultWithLlm) {
                    const mapped = await this.generateMcpPayloadWithLlm({
                        component,
                        config,
                        context,
                        mode,
                        inputSchema,
                        outputSchema,
                        apiResult,
                    });
                    provider = mapped.provider;
                    model = mapped.model;
                    output = this.filterMcpObjectBySchema(mapped.parsed.output || mapped.parsed.result || {}, outputSchema);
                    explanation = this.limitText(mapped.parsed.explanation || mapped.parsed.reason || explanation, 1200);
                }
                else {
                    output = this.extractMcpApiOutputWithoutLlm(apiResult, outputSchema);
                    explanation = explanation || 'Resposta da API mapeada sem LLM por correspondencia de campos do output schema.';
                }
            }
        }
        const argumentsPayload = this.filterMcpObjectBySchema(firstPass.parsed.arguments || firstPass.parsed.args || {}, inputSchema);
        const result = {
            mode,
            provider,
            model,
            tool: {
                name: component.mcpToolName || 'mcp_tool',
                description: component.mcpToolDescription || '',
            },
            schema: {
                inputKeys: this.getMcpSchemaKeys(inputSchema),
                outputKeys: this.getMcpSchemaKeys(outputSchema),
            },
            arguments: this.toPlain(argumentsPayload),
            output: this.toPlain(output),
            explanation,
        };
        if (request)
            result.request = this.redactMcpRequest(request, component);
        if (requests)
            result.requests = requests.map((item) => this.redactMcpRequest(item, component));
        if (apiExecutionMode)
            result.apiExecutionMode = apiExecutionMode;
        if (apiResult !== undefined)
            result.apiResult = this.toPlain(apiResult);
        if (this.isPlainObject(apiResult) && Array.isArray(apiResult.results)) {
            result.results = this.toPlain(apiResult.results);
            result.resultsById = this.toPlain(apiResult.resultsById || {});
            result.latest = this.toPlain(apiResult.results[apiResult.results.length - 1] || null);
        }
        context.slots[responseName] = result;
        if (component.mcpMergeOutputToSlots === true && this.isPlainObject(output)) {
            this.mergeContextSlots(context, output);
        }
        return result;
    }
    normalizeGeneratedAction(action, index) {
        const label = this.limitText(action?.label || action?.title, WHATSAPP_LIMITS.buttonLabel, `Opcao ${index + 1}`);
        const value = this.limitText(action?.value || action?.id || label, WHATSAPP_LIMITS.buttonId, label);
        return {
            id: this.limitId(action?.id || value, WHATSAPP_LIMITS.buttonId, `option_${index + 1}`),
            label,
            value,
            ...(action?.url ? { url: this.limitText(action.url, WHATSAPP_LIMITS.imageUrl) } : {}),
        };
    }
    normalizeGeneratedRichContent(base, generated) {
        const type = base.type || 'text';
        const maxItems = Math.min(Math.max(Number(base.generation?.maxItems || 3), 1), this.richMaxItems(type));
        const next = {
            ...base,
            text: this.limitText(generated?.text || base.text, WHATSAPP_LIMITS.interactiveBody),
            footer: this.limitText(generated?.footer || base.footer, WHATSAPP_LIMITS.footer),
        };
        if (type === 'buttons') {
            next.buttons = (generated?.buttons || generated?.actions || [])
                .slice(0, Math.min(maxItems, 3))
                .map((action, index) => this.normalizeGeneratedAction(action, index));
        }
        if (type === 'quickReplies') {
            next.quickReplies = (generated?.quickReplies || generated?.replies || generated?.buttons || [])
                .slice(0, Math.min(maxItems, WHATSAPP_LIMITS.buttons))
                .map((action, index) => this.normalizeGeneratedAction(action, index));
        }
        if (type === 'list') {
            const sourceSections = Array.isArray(generated?.list?.sections)
                ? generated.list.sections
                : Array.isArray(generated?.sections)
                    ? generated.sections
                    : [];
            const rows = Array.isArray(generated?.items) ? generated.items : [];
            const sections = sourceSections.length
                ? sourceSections
                : [{ title: 'Opções', items: rows }];
            let remainingRows = Math.min(maxItems, WHATSAPP_LIMITS.listRows);
            const normalizedSections = [];
            for (const [sectionIndex, section] of sections.slice(0, WHATSAPP_LIMITS.listSections).entries()) {
                if (remainingRows <= 0)
                    break;
                const sourceItems = Array.isArray(section?.items)
                    ? section.items
                    : Array.isArray(section?.rows)
                        ? section.rows
                        : [];
                const items = sourceItems.slice(0, remainingRows).map((item, itemIndex) => ({
                    id: this.limitId(item?.id || item?.value, WHATSAPP_LIMITS.rowId, `item_${sectionIndex + 1}_${itemIndex + 1}`),
                    title: this.limitText(item?.title || item?.label, WHATSAPP_LIMITS.rowTitle, `Item ${itemIndex + 1}`),
                    description: this.limitText(item?.description, WHATSAPP_LIMITS.rowDescription),
                    value: this.limitText(item?.value || item?.id || item?.title, WHATSAPP_LIMITS.rowId),
                }));
                remainingRows -= items.length;
                if (items.length) {
                    normalizedSections.push({
                        title: this.limitText(section?.title, WHATSAPP_LIMITS.sectionTitle, `Seção ${sectionIndex + 1}`),
                        items,
                    });
                }
            }
            next.list = {
                buttonText: this.limitText(generated?.list?.buttonText || generated?.buttonText || base.list?.buttonText, WHATSAPP_LIMITS.listButton, 'Ver opções'),
                sections: normalizedSections,
            };
        }
        if (type === 'carousel') {
            next.carousel = {
                cards: (generated?.carousel?.cards || generated?.cards || [])
                    .slice(0, Math.min(maxItems, WHATSAPP_LIMITS.carouselCards))
                    .map((card, index) => ({
                    id: this.limitId(card?.id, WHATSAPP_LIMITS.rowId, `card_${index + 1}`),
                    title: this.limitText(card?.title, WHATSAPP_LIMITS.carouselCardTitle, `Card ${index + 1}`),
                    subtitle: this.limitText(card?.subtitle || card?.description, WHATSAPP_LIMITS.carouselCardSubtitle),
                    imageUrl: this.limitText(card?.imageUrl || card?.image, WHATSAPP_LIMITS.imageUrl),
                    buttons: (card?.buttons || card?.actions || [])
                        .slice(0, WHATSAPP_LIMITS.buttons)
                        .map((action, actionIndex) => this.normalizeGeneratedAction(action, actionIndex)),
                })),
            };
        }
        return next;
    }
    async formatAppointmentFlowDataWithLlm(base, config, context) {
        const flow = base.appointmentFlow || {};
        if (base.type !== 'appointmentFlow' || flow.llmEnabled !== true)
            return base;
        const source = this.parsePossibleJsonValue(flow.llmSourceTemplate);
        if (source === undefined || source === null || source === '')
            return base;
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), flow.llmModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce formata dados brutos para um WhatsApp Flow de agendamento.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"providers":[],"services":[],"dates":[],"times":[],"appointments":[],"actions":[],"items":[],"payload":{}}.',
                        'Cada item das listas deve ter: {"id":"string","title":"string","description":"string opcional"}.',
                        `Respeite limites do WhatsApp: title ate ${WHATSAPP_LIMITS.rowTitle} caracteres, description ate ${WHATSAPP_LIMITS.rowDescription}, id ate ${WHATSAPP_LIMITS.rowId}.`,
                        'Nao invente dados. Se nao houver informacao para uma lista, retorne array vazio.',
                        'Agrupe dados repetidos. Use ids estaveis e sem espacos quando possivel.',
                        'Use pt-BR nos titulos e descricoes.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction: flow.llmInstruction || 'Transforme os dados brutos em providers, services, items, dates, times e appointments para agendamento.',
                        source,
                        current: {
                            text: base.text,
                            stage: flow.stage,
                            providersTemplate: flow.providersTemplate,
                            servicesTemplate: flow.servicesTemplate,
                            datesTemplate: flow.datesTemplate,
                            timesTemplate: flow.timesTemplate,
                            appointmentsTemplate: flow.appointmentsTemplate,
                            itemsTemplate: flow.itemsTemplate,
                        },
                        context: {
                            channel: context.channel,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(flow.llmTemperature ?? 0.1) || 0, 1)),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '') || {};
        const nextFlow = { ...flow };
        const setList = (key, target) => {
            const value = parsed?.[key];
            if (!Array.isArray(value))
                return;
            const normalized = this.normalizeAppointmentOptions(value, key, APPOINTMENT_FLOW_DATA_SOURCE_LIMIT);
            nextFlow[target] = JSON.stringify(normalized, null, 2);
        };
        setList('actions', 'actionsTemplate');
        setList('appointments', 'appointmentsTemplate');
        setList('providers', 'providersTemplate');
        setList('services', 'servicesTemplate');
        setList('dates', 'datesTemplate');
        setList('times', 'timesTemplate');
        setList('items', 'itemsTemplate');
        if (this.isPlainObject(parsed?.payload)) {
            nextFlow.payloadTemplate = JSON.stringify(parsed.payload, null, 2);
        }
        return {
            ...base,
            appointmentFlow: nextFlow,
        };
    }
    async generateRichMessageContent(base, config, context) {
        if (base.type === 'appointmentFlow' && base.appointmentFlow?.llmEnabled === true) {
            return await this.formatAppointmentFlowDataWithLlm(base, config, context);
        }
        if (!base.generation?.enabled)
            return base;
        const type = base.type || 'buttons';
        const maxItems = Math.min(Math.max(Number(base.generation?.maxItems || 3), 1), this.richMaxItems(type));
        const prompt = base.generation?.prompt || 'Gere componentes interativos em pt-BR.';
        const schemaHint = {
            text: 'string',
            footer: 'string opcional',
            buttons: [{ id: 'string', label: 'string', value: 'string' }],
            quickReplies: [{ id: 'string', label: 'string', value: 'string' }],
            list: {
                buttonText: 'string',
                sections: [{ title: 'string', items: [{ id: 'string', title: 'string', description: 'string', value: 'string' }] }],
            },
            carousel: {
                cards: [{ id: 'string', title: 'string', subtitle: 'string', imageUrl: 'string opcional', buttons: [{ id: 'string', label: 'string', value: 'string' }] }],
            },
        };
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), base.generation?.model || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce gera JSON valido para mensagens ricas de atendimento.',
                        'Responda somente JSON, sem markdown.',
                        `Tipo alvo: ${type}.`,
                        `Maximo de itens: ${maxItems}.`,
                        `Limites WhatsApp: corpo ${WHATSAPP_LIMITS.interactiveBody} chars, rodape ${WHATSAPP_LIMITS.footer}, botao ${WHATSAPP_LIMITS.buttonLabel}, lista ${WHATSAPP_LIMITS.listRows} linhas.`,
                        'Use textos curtos, claros e em pt-BR.',
                        'Nao invente URLs de imagem. Se nao houver URL no contexto, use string vazia.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        prompt,
                        type,
                        maxItems,
                        baseText: base.text,
                        footer: base.footer,
                        expectedShape: schemaHint,
                        context: {
                            channel: context.channel,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: 0.4,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '');
        if (!parsed)
            return base;
        return this.normalizeGeneratedRichContent(base, parsed);
    }
    async generateMessageTextWithLlm(step, config, context) {
        const prompt = this.renderTemplate(step.instruction || '', context);
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), step.messageLlmModel || config.model, context?.agentId),
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce e um formatador de mensagens para fluxo conversacional.',
                        'Responda somente com o texto final que sera enviado ao usuario.',
                        'Nao use markdown a menos que a instrucao peca explicitamente.',
                        'Use pt-BR por padrao.',
                        'Se houver dados no contexto, use apenas os dados fornecidos.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction: prompt,
                        channel: context.channel,
                        input: context.input,
                        slots: context.slots,
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(step.messageLlmTemperature ?? 0.4), 1)),
        });
        return String(completion.choices?.[0]?.message?.content || '').trim() || prompt;
    }
    onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }
    isValidCpf(value) {
        const cpf = this.onlyDigits(value);
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf))
            return false;
        const calc = (base, factor) => {
            const sum = base.split('').reduce((acc, digit) => acc + Number(digit) * factor--, 0);
            const rest = (sum * 10) % 11;
            return rest === 10 ? 0 : rest;
        };
        return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10]);
    }
    isValidCnpj(value) {
        const cnpj = this.onlyDigits(value);
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj))
            return false;
        const calc = (base, weights) => {
            const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
            const rest = sum % 11;
            return rest < 2 ? 0 : 11 - rest;
        };
        const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const secondWeights = [6, ...firstWeights];
        return calc(cnpj.slice(0, 12), firstWeights) === Number(cnpj[12]) && calc(cnpj.slice(0, 13), secondWeights) === Number(cnpj[13]);
    }
    validateTypedInput(value, type) {
        const raw = String(value ?? '').trim();
        if (!raw)
            return { valid: false, reason: 'Valor vazio.' };
        if (!type || type === 'text')
            return { valid: true, normalizedValue: raw };
        if (type === 'email') {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
                ? { valid: true, normalizedValue: raw.toLowerCase() }
                : { valid: false, reason: 'Email inválido.' };
        }
        if (type === 'number') {
            const normalized = Number(raw.replace(',', '.'));
            return Number.isFinite(normalized)
                ? { valid: true, normalizedValue: normalized }
                : { valid: false, reason: 'Número inválido.' };
        }
        if (type === 'date') {
            const parsed = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
                ? new Date(`${raw.slice(6, 10)}-${raw.slice(3, 5)}-${raw.slice(0, 2)}T00:00:00`)
                : new Date(raw);
            return Number.isNaN(parsed.getTime())
                ? { valid: false, reason: 'Data invalida.' }
                : { valid: true, normalizedValue: raw };
        }
        if (type === 'cpf') {
            return this.isValidCpf(raw)
                ? { valid: true, normalizedValue: this.onlyDigits(raw) }
                : { valid: false, reason: 'CPF inválido.' };
        }
        if (type === 'cnpj') {
            return this.isValidCnpj(raw)
                ? { valid: true, normalizedValue: this.onlyDigits(raw) }
                : { valid: false, reason: 'CNPJ inválido.' };
        }
        if (type === 'phone') {
            const digits = this.onlyDigits(raw);
            return digits.length >= 10 && digits.length <= 13
                ? { valid: true, normalizedValue: digits }
                : { valid: false, reason: 'Telefone inválido.' };
        }
        if (type === 'boolean') {
            const normalized = raw.toLowerCase();
            if (['sim', 's', 'yes', 'y', 'true', '1'].includes(normalized))
                return { valid: true, normalizedValue: true };
            if (['nao', 'não', 'n', 'no', 'false', '0'].includes(normalized))
                return { valid: true, normalizedValue: false };
            return { valid: false, reason: 'Resposta booleana invalida.' };
        }
        return { valid: true, normalizedValue: raw };
    }
    validateRegexInput(step, value) {
        const rawRegex = String(step.inputValidationRegex || '').trim();
        if (!rawRegex)
            return { valid: true, normalizedValue: value };
        try {
            return new RegExp(rawRegex).test(String(value ?? ''))
                ? { valid: true, normalizedValue: value }
                : { valid: false, reason: 'Valor fora do padrao esperado.' };
        }
        catch {
            return { valid: false, reason: 'Regex inválido na configuração do input.' };
        }
    }
    async validateInputWithLlm(step, config, context, value) {
        const instruction = this.renderTemplate(step.inputValidationLlmInstruction || 'Valide se a entrada do usuário atende ao dado solicitado.', context);
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), step.inputValidationLlmModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce valida entradas de usuario em um fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"valid": boolean, "reason": "motivo curto em pt-BR", "normalizedValue": valor opcional, "slots": {}}.',
                        'Use somente o contexto recebido. Nao invente dados.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        inputValue: value,
                        requestedField: step.responseName || step.title || 'input',
                        context: {
                            channel: context.channel,
                            conversationId: context.conversationId,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(step.inputValidationLlmTemperature ?? 0), 1)),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '');
        return {
            valid: this.readBooleanDecision(parsed?.valid ?? parsed?.ok ?? parsed?.matched ?? false),
            reason: this.limitText(parsed?.reason || parsed?.motivo || parsed?.explanation, 500),
            normalizedValue: parsed?.normalizedValue ?? parsed?.value ?? value,
            slots: parsed?.slots && typeof parsed.slots === 'object' && !Array.isArray(parsed.slots) ? parsed.slots : undefined,
            raw: parsed,
        };
    }
    async validateInputValue(step, config, context, value) {
        const mode = step.inputValidationMode || 'none';
        if (mode === 'none')
            return { valid: true, normalizedValue: value };
        if (mode === 'type')
            return this.validateTypedInput(value, step.inputValidationType || 'text');
        if (mode === 'regex')
            return this.validateRegexInput(step, value);
        if (mode === 'llm')
            return await this.validateInputWithLlm(step, config, context, value);
        return { valid: true, normalizedValue: value };
    }
    normalizeGeneratedApiRequests(value) {
        const rawRequests = Array.isArray(value)
            ? value
            : Array.isArray(value?.requests)
                ? value.requests
                : value?.request
                    ? [value.request]
                    : [];
        const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
        return rawRequests
            .slice(0, 10)
            .map((request) => {
            const method = String(request?.method || 'GET').toUpperCase();
            const url = String(request?.url || '').trim();
            if (!url)
                return null;
            const bodyType = request?.bodyType === 'none'
                ? 'none'
                : request?.bodyType === 'text'
                    ? 'text'
                    : request?.bodyType === 'jsonText'
                        ? 'jsonText'
                        : request?.body !== undefined || request?.data !== undefined
                            ? 'jsonFields'
                            : 'none';
            const polling = request?.polling && typeof request.polling === 'object' && !Array.isArray(request.polling)
                ? {
                    enabled: request.polling.enabled === true,
                    url: String(request.polling.url || '').trim(),
                    method: allowedMethods.has(String(request.polling.method || 'GET').toUpperCase())
                        ? String(request.polling.method || 'GET').toUpperCase()
                        : 'GET',
                    headers: request.polling.headers && typeof request.polling.headers === 'object' && !Array.isArray(request.polling.headers) ? request.polling.headers : {},
                    params: request.polling.params && typeof request.polling.params === 'object' && !Array.isArray(request.polling.params) ? request.polling.params : {},
                    bodyType: request.polling.bodyType === 'none'
                        ? 'none'
                        : request.polling.bodyType === 'text'
                            ? 'text'
                            : request.polling.bodyType === 'jsonText'
                                ? 'jsonText'
                                : request.polling.body !== undefined || request.polling.data !== undefined
                                    ? 'jsonFields'
                                    : 'none',
                    ...(request.polling.bodyType === 'none' || (request.polling.body === undefined && request.polling.data === undefined)
                        ? {}
                        : { body: request.polling.body !== undefined ? request.polling.body : request.polling.data }),
                    intervalSeconds: this.limitNumber(request.polling.intervalSeconds, 5, 1, 600),
                    maxAttempts: this.limitNumber(request.polling.maxAttempts, 10, 1, 100),
                    stopCondition: String(request.polling.stopCondition || '').trim(),
                }
                : undefined;
            return {
                method: allowedMethods.has(method) ? method : 'GET',
                url,
                headers: request?.headers && typeof request.headers === 'object' && !Array.isArray(request.headers) ? request.headers : {},
                params: request?.params && typeof request.params === 'object' && !Array.isArray(request.params) ? request.params : {},
                bodyType,
                ...(bodyType === 'none'
                    ? {}
                    : { body: request?.body !== undefined ? request.body : request?.data }),
                ...(polling?.enabled ? { polling } : {}),
            };
        })
            .filter(Boolean);
    }
    async generateApiRequestsWithLlm(step, config, context) {
        const prompt = this.renderTemplate(step.api?.generation?.prompt || step.instruction || '', context);
        if (!String(prompt || '').trim())
            return [];
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), step.api?.generation?.model || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce monta requests HTTP para um executor httpBatch.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"requests":[{"method":"GET|POST|PUT|PATCH|DELETE","url":"https://...","headers":{},"params":{},"bodyType":"none|jsonFields|jsonText|text","body":{},"polling":{"enabled":false,"url":"https://...","method":"GET","headers":{},"params":{},"bodyType":"none|jsonFields|jsonText|text","body":{},"intervalSeconds":5,"maxAttempts":10,"stopCondition":"result.data.status === \\"done\\" && Boolean(result.data.result)"}}]}.',
                        'Use polling apenas quando a API responder por processamento assincrono/webhook e precisar consultar uma URL de status.',
                        'Em polling.url, voce pode usar {{result.data.id}} ou {{initialResult.data.id}} para aproveitar dados da chamada inicial.',
                        'Use somente dados fornecidos no contexto e na instrucao.',
                        'Nao invente segredos, tokens ou endpoints. Se faltar URL obrigatoria, retorne {"requests":[]}.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        prompt,
                        currentManualRequests: step.api?.requests || [],
                        context: {
                            channel: context.channel,
                            conversationId: context.conversationId,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature: Math.max(0, Math.min(Number(step.api?.generation?.temperature ?? 0.2), 1)),
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '');
        return this.normalizeGeneratedApiRequests(parsed);
    }
    normalizeWhatsappButtons(actions) {
        return (actions || [])
            .filter((action) => action?.label)
            .slice(0, WHATSAPP_LIMITS.buttons)
            .map((action, index) => ({
            type: 'reply',
            reply: {
                id: this.limitId(action.id || action.value, WHATSAPP_LIMITS.buttonId, `option_${index + 1}`),
                title: this.limitText(action.label, WHATSAPP_LIMITS.buttonLabel, `Opcao ${index + 1}`),
            },
        }));
    }
    buildWhatsappTextPayload(to, text) {
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: this.limitText(text, WHATSAPP_LIMITS.textBody, ' ') },
        };
    }
    buildWhatsappImagePayload(to, link, caption) {
        const safeCaption = this.limitText(caption || '', WHATSAPP_LIMITS.interactiveBody);
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: {
                link,
                ...(safeCaption ? { caption: safeCaption } : {}),
            },
        };
    }
    buildWhatsappDocumentPayload(to, link, fileName, caption) {
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'document',
            document: {
                link,
                filename: fileName || 'dashboard.pdf',
                caption: this.limitText(caption, WHATSAPP_LIMITS.interactiveBody, 'Dashboard em PDF'),
            },
        };
    }
    buildWhatsappButtonPayload(to, content, actions) {
        const buttons = this.normalizeWhatsappButtons(actions);
        if (!buttons.length)
            return this.buildWhatsappTextPayload(to, this.getRichMessageText(content));
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: this.limitText(content.text, WHATSAPP_LIMITS.interactiveBody, 'Escolha uma opcao:') },
                ...(content.footer ? { footer: { text: this.limitText(content.footer, WHATSAPP_LIMITS.footer) } } : {}),
                action: { buttons },
            },
        };
    }
    buildWhatsappListPayload(to, content) {
        const sections = [];
        let remainingRows = WHATSAPP_LIMITS.listRows;
        for (const [sectionIndex, section] of (content.list?.sections || []).slice(0, WHATSAPP_LIMITS.listSections).entries()) {
            if (remainingRows <= 0)
                break;
            const rows = (section.items || []).slice(0, remainingRows).map((item, itemIndex) => ({
                id: this.limitId(item.id || item.value, WHATSAPP_LIMITS.rowId, `item_${sectionIndex + 1}_${itemIndex + 1}`),
                title: this.limitText(item.title, WHATSAPP_LIMITS.rowTitle, `Item ${itemIndex + 1}`),
                ...(item.description ? { description: this.limitText(item.description, WHATSAPP_LIMITS.rowDescription) } : {}),
            }));
            remainingRows -= rows.length;
            if (rows.length) {
                sections.push({
                    title: this.limitText(section.title, WHATSAPP_LIMITS.sectionTitle, `Seção ${sectionIndex + 1}`),
                    rows,
                });
            }
        }
        if (!sections.length)
            return this.buildWhatsappTextPayload(to, this.getRichMessageText(content));
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: { text: this.limitText(content.text, WHATSAPP_LIMITS.interactiveBody, 'Escolha uma opcao:') },
                ...(content.footer ? { footer: { text: this.limitText(content.footer, WHATSAPP_LIMITS.footer) } } : {}),
                action: {
                    button: this.limitText(content.list?.buttonText, WHATSAPP_LIMITS.listButton, 'Ver opções'),
                    sections,
                },
            },
        };
    }
    parsePossibleJsonValue(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        if (typeof value !== 'string')
            return value;
        const raw = value.trim();
        if (!raw)
            return undefined;
        if (!/^[\[{]/.test(raw))
            return raw;
        try {
            return JSON.parse(raw);
        }
        catch {
            return raw;
        }
    }
    normalizeAppointmentStage(value, fallback = 'actions') {
        const normalized = String(value || fallback).trim().toLowerCase();
        if (['appointments', 'agendamentos', 'meus_agendamentos'].includes(normalized))
            return 'appointments';
        if (['providers', 'provider', 'prestadores', 'prestador', 'professionals'].includes(normalized))
            return 'providers';
        if (['services', 'service', 'servicos', 'servicos', 'servico'].includes(normalized))
            return 'services';
        if (['dates', 'date', 'datas', 'data'].includes(normalized))
            return 'dates';
        if (['times', 'time', 'horarios', 'horario'].includes(normalized))
            return 'times';
        if (['items', 'item', 'itens', 'selecionaveis', 'selecionaveis', 'exams', 'exam', 'exames', 'exame', 'procedimentos', 'procedimento'].includes(normalized))
            return 'items';
        return 'actions';
    }
    appointmentStageTitle(stage) {
        const titles = {
            actions: 'Agenda',
            appointments: 'Agendamentos',
            providers: 'Prestadores',
            services: 'Servicos',
            dates: 'Datas',
            times: 'Horarios',
            items: 'Itens',
            exams: 'Exames',
        };
        return titles[stage] || titles.actions;
    }
    normalizeAppointmentOptions(value, fallbackPrefix, limit = WHATSAPP_LIMITS.listRows) {
        const parsed = this.parsePossibleJsonValue(value);
        let source = [];
        if (Array.isArray(parsed)) {
            source = parsed;
        }
        else if (this.isPlainObject(parsed)) {
            const objectSource = Array.isArray(parsed.items) ? parsed.items :
                Array.isArray(parsed.options) ? parsed.options :
                    Array.isArray(parsed.rows) ? parsed.rows :
                        Array.isArray(parsed.results) ? parsed.results :
                            Array.isArray(parsed.data) ? parsed.data :
                                undefined;
            source = objectSource || Object.entries(parsed).map(([key, item]) => (this.isPlainObject(item) ? { id: key, ...item } : { id: key, title: item }));
        }
        else if (typeof parsed === 'string') {
            source = parsed
                .split(/\r?\n|,/)
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return source
            .slice(0, Math.max(1, Math.min(Number(limit) || WHATSAPP_LIMITS.listRows, APPOINTMENT_FLOW_DATA_SOURCE_LIMIT)))
            .map((item, index) => {
            const plain = this.isPlainObject(item) ? item : {};
            const titleSource = this.isPlainObject(item)
                ? plain.title || plain.label || plain.name || plain.nome || plain.text || plain.value || plain.id
                : item;
            const descriptionSource = this.isPlainObject(item)
                ? plain.description || plain.subtitle || plain.descricao || plain.details || plain.detail
                : '';
            const valueSource = this.isPlainObject(item)
                ? plain.value || plain.id || plain.code || plain.slug || titleSource
                : item;
            const title = this.limitText(titleSource, WHATSAPP_LIMITS.rowTitle, `Item ${index + 1}`);
            return {
                id: this.limitId(valueSource, WHATSAPP_LIMITS.rowId, `${fallbackPrefix}_${index + 1}`),
                title,
                description: this.limitText(descriptionSource, WHATSAPP_LIMITS.rowDescription),
                value: this.limitText(valueSource, WHATSAPP_LIMITS.rowId, title),
            };
        })
            .filter((item) => item.title);
    }
    filterAppointmentOptions(options, filterText) {
        const query = String(filterText || '').trim().toLowerCase();
        if (!query)
            return options;
        return options.filter((item) => [
            item?.id,
            item?.title,
            item?.description,
            item?.value,
        ].some((value) => String(value || '').toLowerCase().includes(query)));
    }
    defaultAppointmentActions() {
        return [
            { id: 'new_appointment', title: 'Novo agendamento', description: 'Escolher prestador, servico e horario', value: 'new_appointment' },
            { id: 'my_appointments', title: 'Meus agendamentos', description: 'Consultar ou alterar agendamentos', value: 'my_appointments' },
        ];
    }
    buildAppointmentFlowData(content) {
        const flow = content.appointmentFlow || {};
        const configuredStage = String(flow.stageTemplate || '').trim() || flow.stage || 'actions';
        const stage = this.normalizeAppointmentStage(configuredStage, flow.stage || 'actions');
        const actions = this.normalizeAppointmentOptions(flow.actionsTemplate, 'action', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT);
        const payload = this.parsePossibleJsonValue(flow.payloadTemplate);
        const items = this.filterAppointmentOptions(this.normalizeAppointmentOptions(flow.itemsTemplate ?? flow.examsTemplate, 'item', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT), flow.itemsFilterTemplate);
        const data = {
            ...(this.isPlainObject(payload) ? payload : {}),
            stage,
            actions: actions.length ? actions : this.defaultAppointmentActions(),
            appointments: this.normalizeAppointmentOptions(flow.appointmentsTemplate, 'appointment', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT),
            providers: this.normalizeAppointmentOptions(flow.providersTemplate, 'provider', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT),
            services: this.normalizeAppointmentOptions(flow.servicesTemplate, 'service', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT),
            dates: this.normalizeAppointmentOptions(flow.datesTemplate, 'date', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT),
            times: this.normalizeAppointmentOptions(flow.timesTemplate, 'time', APPOINTMENT_FLOW_DATA_SOURCE_LIMIT),
            items,
            exams: items,
        };
        const activeOptions = data[stage] || data.actions;
        return {
            ...data,
            activeOptions,
            active_options: activeOptions,
        };
    }
    buildWhatsappAppointmentListPayload(to, content, data) {
        const flow = content.appointmentFlow || {};
        const activeOptions = Array.isArray(data.activeOptions) ? data.activeOptions : [];
        if (!activeOptions.length) {
            return this.buildWhatsappTextPayload(to, this.getRichMessageText(content) || 'Nenhuma opcao de agendamento disponivel no momento.');
        }
        return this.buildWhatsappListPayload(to, {
            type: 'list',
            text: content.text || 'Vamos agendar?',
            footer: content.footer,
            list: {
                buttonText: flow.buttonText || flow.flowCta || 'Ver opcoes',
                sections: [
                    {
                        title: this.appointmentStageTitle(data.stage),
                        items: activeOptions,
                    },
                ],
            },
        });
    }
    compactMetaFlowOptions(value, fallbackPrefix, fallbackTitle) {
        const normalized = this.normalizeAppointmentOptions(value, fallbackPrefix);
        const source = normalized.length
            ? normalized
            : [{ id: `${fallbackPrefix}_unavailable`, title: fallbackTitle, description: 'Nenhuma opcao configurada.' }];
        return source.map((item, index) => ({
            id: this.limitId(item.id || item.value, WHATSAPP_LIMITS.rowId, `${fallbackPrefix}_${this.identifierNumberWord(index + 1)}`),
            title: this.limitText(item.title, WHATSAPP_LIMITS.rowTitle, fallbackTitle),
            ...(item.description ? { description: this.limitText(item.description, WHATSAPP_LIMITS.rowDescription) } : {}),
        }));
    }
    firstMetaOptionId(options, fallback = '') {
        return String(options?.[0]?.id || options?.[0]?.value || fallback || '').trim();
    }
    buildMetaAppointmentFlowData(content, data, screen) {
        const flow = content.appointmentFlow || {};
        const attachments = this.normalizeAppointmentAttachmentSteps(flow);
        const payload = this.parsePossibleJsonValue(flow.payloadTemplate);
        const extra = this.isPlainObject(payload) ? payload : {};
        const providers = this.compactMetaFlowOptions(data.providers, 'provider', 'Prestador indisponivel');
        const actions = this.compactMetaFlowOptions(data.actions, 'action', 'Acao indisponivel');
        const appointments = this.compactMetaFlowOptions(data.appointments, 'appointment', 'Agendamento indisponivel');
        const services = this.compactMetaFlowOptions(data.services, 'service', 'Servico indisponivel');
        const dates = this.compactMetaFlowOptions(data.dates, 'date', 'Data indisponivel');
        const times = this.compactMetaFlowOptions(data.times, 'time', 'Horario indisponivel');
        const items = this.compactMetaFlowOptions(data.items || data.exams, 'item', 'Item indisponivel');
        const action = String(extra.action || extra.actionId || this.firstMetaOptionId(actions, 'action_um'));
        const appointment = String(extra.appointment || extra.appointmentId || this.firstMetaOptionId(appointments, 'appointment_um'));
        const provider = String(extra.provider || extra.providerId || this.firstMetaOptionId(providers, 'provider_um'));
        const service = String(extra.service || extra.serviceId || this.firstMetaOptionId(services, 'service_um'));
        const date = String(extra.date || extra.dateId || this.firstMetaOptionId(dates, 'date_um'));
        const time = String(extra.time || extra.timeId || this.firstMetaOptionId(times, 'time_um'));
        const selectedItems = Array.isArray(extra.selected_items)
            ? extra.selected_items
            : Array.isArray(extra.selectedItems)
                ? extra.selectedItems
                : Array.isArray(extra.selected_exams)
                    ? extra.selected_exams
                    : Array.isArray(extra.selectedExams)
                        ? extra.selectedExams
                        : [];
        const introText = this.limitText(extra.introText || content.text || 'Escolha as opcoes para montar seu agendamento.', 300, 'Escolha as opcoes para montar seu agendamento.');
        const attachmentData = Object.fromEntries(attachments.map((step) => [step.name, []]));
        const flowOrder = this.normalizeAppointmentFlowStepOrder(flow, attachments);
        const itemsIndex = flowOrder.indexOf('items');
        const includeSelectedItems = itemsIndex >= 0 && itemsIndex < flowOrder.length - 1;
        const orderedFlowData = {
            introText,
            actions,
            appointments,
            providers,
            services,
            dates,
            times,
            items,
            exams: items,
            action,
            appointment,
            provider,
            service,
            date,
            time,
            ...(includeSelectedItems ? { selected_items: selectedItems } : {}),
            ...attachmentData,
        };
        const normalizedScreen = String(screen || 'START').trim().toUpperCase();
        if (attachments.length || Array.isArray(flow.stepOrder) || this.isPlainObject(flow.stepLabels))
            return orderedFlowData;
        if (normalizedScreen === 'SUMMARY')
            return { provider, service, date, time };
        if (normalizedScreen === 'TIMES')
            return { provider, service, date, times };
        if (normalizedScreen === 'DATES')
            return { provider, service, dates, times };
        if (normalizedScreen === 'SERVICES')
            return { provider, services, dates, times };
        return { introText, providers, services, dates, times };
    }
    buildWhatsappAppointmentFlowPayload(to, content) {
        const flow = content.appointmentFlow || {};
        const data = this.buildAppointmentFlowData(content);
        const flowId = String(flow.flowId || '').trim();
        const mode = flow.mode || 'auto';
        if (!flowId || mode === 'interactive') {
            return this.buildWhatsappAppointmentListPayload(to, content, data);
        }
        return {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'flow',
                header: {
                    type: 'text',
                    text: this.limitText(flow.headerText, WHATSAPP_LIMITS.rowTitle, 'Agendamento'),
                },
                body: { text: this.limitText(content.text, WHATSAPP_LIMITS.interactiveBody, 'Clique para iniciar seu agendamento.') },
                ...(content.footer ? { footer: { text: this.limitText(content.footer, WHATSAPP_LIMITS.footer) } } : {}),
                action: {
                    name: 'flow',
                    parameters: {
                        mode: 'published',
                        flow_message_version: '3',
                        flow_token: this.limitText(flow.flowToken, 512, `canvas_appointment_${Date.now()}`),
                        flow_id: flowId,
                        flow_cta: this.limitText(flow.flowCta || flow.buttonText, WHATSAPP_LIMITS.buttonLabel, 'Agendar'),
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: String(flow.flowScreen || 'START').trim() || 'START',
                            data: this.buildMetaAppointmentFlowData(content, data, flow.flowScreen || 'START'),
                        },
                    },
                },
            },
        };
    }
    buildWhatsappPayloads(to, message) {
        if (message.kind === 'dashboard') {
            const document = message.debug?.whatsappDocument;
            if (document?.url) {
                return [
                    this.buildWhatsappDocumentPayload(to, document.url, document.fileName || 'dashboard.pdf', message.text || 'Dashboard em PDF'),
                ];
            }
            return [this.buildWhatsappTextPayload(to, `${message.text || 'Dashboard'}\nPDF indisponível no momento.`)];
        }
        const content = message.content;
        if (!content)
            return [this.buildWhatsappTextPayload(to, message.text || '')];
        if (content.type === 'image') {
            const link = this.getRichMediaUrl(content);
            if (!link)
                return [this.buildWhatsappTextPayload(to, this.getRichMessageText(content) || 'Imagem indisponivel no momento.')];
            return [this.buildWhatsappImagePayload(to, link, this.getRichMediaCaption(content))];
        }
        if (content.type === 'document') {
            const link = this.getRichMediaUrl(content);
            if (!link)
                return [this.buildWhatsappTextPayload(to, this.getRichMessageText(content) || 'Documento indisponivel no momento.')];
            return [
                this.buildWhatsappDocumentPayload(to, link, this.getRichMediaFileName(content, 'arquivo.pdf'), this.getRichMediaCaption(content) || this.getRichMediaFileName(content, 'arquivo.pdf')),
            ];
        }
        if (content.type === 'buttons')
            return [this.buildWhatsappButtonPayload(to, content, content.buttons)];
        if (content.type === 'quickReplies')
            return [this.buildWhatsappButtonPayload(to, content, content.quickReplies)];
        if (content.type === 'list')
            return [this.buildWhatsappListPayload(to, content)];
        if (content.type === 'appointmentFlow')
            return [this.buildWhatsappAppointmentFlowPayload(to, content)];
        if (content.type === 'carousel') {
            const cards = (content.carousel?.cards || []).slice(0, WHATSAPP_LIMITS.carouselCards);
            if (!cards.length)
                return [this.buildWhatsappTextPayload(to, this.getRichMessageText(content))];
            return cards.map((card) => this.buildWhatsappButtonPayload(to, {
                type: 'buttons',
                text: [card.title, card.subtitle].filter(Boolean).join('\n'),
                buttons: card.buttons,
            }, card.buttons));
        }
        return [this.buildWhatsappTextPayload(to, this.getRichMessageText(content))];
    }
    evaluateCondition(condition, context) {
        return this.evaluateConditionResult(condition, context).matched;
    }
    evaluateConditionResult(condition, context) {
        const raw = String(condition || '').trim();
        if (!raw || raw === 'true')
            return { matched: true };
        if (raw === 'false')
            return { matched: false };
        try {
            const body = this.buildConditionFunctionBody(raw);
            const result = new Function('context', 'slots', 'input', 'now', body)(context, context?.slots || {}, context?.input, context?.now);
            return { matched: Boolean(result) };
        }
        catch (error) {
            return { matched: false, error: this.getErrorMessage(error) };
        }
    }
    buildConditionSlotPreview(context) {
        const slots = context?.slots && typeof context.slots === 'object' ? context.slots : {};
        return Object.entries(slots).slice(0, 30).reduce((acc, [key, value]) => {
            if (value === null || value === undefined) {
                acc[key] = value;
            }
            else if (['string', 'number', 'boolean'].includes(typeof value)) {
                acc[key] = value;
            }
            else if (Array.isArray(value)) {
                acc[key] = `[array:${value.length}]`;
            }
            else if (typeof value === 'object') {
                acc[key] = `[object:${Object.keys(value).slice(0, 8).join(',')}]`;
            }
            return acc;
        }, {});
    }
    extractConditionSlotReferences(condition) {
        const raw = String(condition || '');
        const refs = new Set();
        const dotPattern = /\b(?:context\.)?slots\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
        const bracketPattern = /\b(?:context\.)?slots\[['"]([^'"]+)['"]\]/g;
        let match;
        while ((match = dotPattern.exec(raw))) {
            refs.add(match[1]);
        }
        while ((match = bracketPattern.exec(raw))) {
            refs.add(match[1]);
        }
        return Array.from(refs);
    }
    buildConditionMissingSlotReferences(condition, context) {
        const slots = context?.slots && typeof context.slots === 'object' ? context.slots : {};
        return this.extractConditionSlotReferences(condition)
            .filter((slotPath) => this.getByPath(slots, slotPath) === undefined);
    }
    readBooleanDecision(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value !== 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', 'sim', 'yes', 'y', '1', 'verdadeiro'].includes(normalized))
                return true;
            if (['false', 'nao', 'no', 'n', '0', 'falso'].includes(normalized))
                return false;
        }
        return false;
    }
    async evaluateLlmCondition(source, config, context) {
        const instructionSource = 'instruction' in source
            ? source.instruction || source.condition || ''
            : source.condition || '';
        const instruction = this.renderTemplate(instructionSource, context);
        if (!String(instruction || '').trim()) {
            return { matched: false, reason: 'Instrução LLM vazia.', raw: null };
        }
        const temperature = Math.max(0, Math.min(Number(source.conditionTemperature ?? 0) || 0, 1));
        const completion = await (await this.getOpenAIClientForProvider(this.flowLlmProvider(config), context?.agentId)).chat.completions.create({
            model: await this.getChatModelForProvider(this.flowLlmProvider(config), source.conditionModel || config.model, context?.agentId),
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'Voce avalia condicoes de fluxo conversacional.',
                        'Responda somente JSON valido, sem markdown.',
                        'Formato obrigatorio: {"matched": boolean, "reason": "motivo curto em pt-BR"}.',
                        'Use somente o contexto recebido. Nao invente dados.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction,
                        context: {
                            channel: context.channel,
                            conversationId: context.conversationId,
                            input: context.input,
                            slots: context.slots,
                        },
                    }, null, 2),
                },
            ],
            temperature,
        });
        const parsed = this.parseGeneratedJson(completion.choices?.[0]?.message?.content || '');
        const decision = parsed?.matched ?? parsed?.result ?? parsed?.condition ?? parsed?.ok ?? false;
        return {
            matched: this.readBooleanDecision(decision),
            reason: this.limitText(parsed?.reason || parsed?.motivo || parsed?.explanation, 500),
            raw: parsed,
        };
    }
    getOutgoing(stepId, config) {
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        return (config.edges || [])
            .filter((edge) => edge.source === stepId && !this.isManifestVisualEdge(edge, config))
            .sort((left, right) => {
            const leftStep = stepById.get(left.target);
            const rightStep = stepById.get(right.target);
            const ly = leftStep?.position?.y ?? 0;
            const ry = rightStep?.position?.y ?? 0;
            if (ly !== ry)
                return ly - ry;
            return (leftStep?.position?.x ?? 0) - (rightStep?.position?.x ?? 0);
        });
    }
    async getOutgoingAsync(stepId, config, context, trace, options) {
        const includeUnconditional = options?.includeUnconditional !== false;
        const evaluated = await Promise.all(this.getOutgoing(stepId, config).map(async (edge) => {
            const hasCondition = Boolean(String(edge.condition || '').trim());
            if (!hasCondition && edge.conditionMode !== 'llm') {
                return includeUnconditional ? edge : null;
            }
            if (edge.conditionMode === 'llm') {
                if (!hasCondition && !includeUnconditional)
                    return null;
                const responseName = edge.conditionReasonResponseName || `edge_${edge.id}_reason`;
                const decision = await this.evaluateLlmCondition(edge, config, context).catch((error) => ({
                    matched: false,
                    reason: this.getErrorMessage(error),
                    raw: null,
                }));
                context.slots[responseName] = decision.reason || '';
                trace.push({
                    edgeId: edge.id,
                    source: edge.source,
                    target: edge.target,
                    type: 'edgeConditionLlm',
                    matched: decision.matched,
                    reason: decision.reason || '',
                    raw: decision.raw,
                });
                return decision.matched ? edge : null;
            }
            const decision = this.evaluateConditionResult(edge.condition, context);
            trace.push({
                edgeId: edge.id,
                source: edge.source,
                target: edge.target,
                type: 'edgeConditionJs',
                matched: decision.matched,
                error: decision.error || '',
                condition: this.limitText(edge.condition, 500),
                slotKeys: Object.keys(context?.slots || {}).slice(0, 50),
                slotReferences: this.extractConditionSlotReferences(edge.condition),
                missingSlotReferences: this.buildConditionMissingSlotReferences(edge.condition, context),
                slotPreview: this.buildConditionSlotPreview(context),
            });
            return decision.matched ? edge : null;
        }));
        return evaluated.filter(Boolean);
    }
    createSnapshot(step, context) {
        return {
            stepId: step.id,
            title: step.title || 'Debug',
            slots: this.cloneJson(context.slots || {}),
            timestamp: new Date().toISOString(),
        };
    }
    cloneJson(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        }
        catch {
            return value;
        }
    }
    cloneJsonSafe(value, seen = new WeakSet(), depth = 0) {
        if (value === null || value === undefined)
            return value;
        if (typeof value !== 'object')
            return value;
        if (depth > 20)
            return '[MaxDepth]';
        if (seen.has(value))
            return '[Circular]';
        seen.add(value);
        if (value instanceof Date)
            return value.toISOString();
        if (Array.isArray(value)) {
            return value.map((item) => this.cloneJsonSafe(item, seen, depth + 1));
        }
        return Object.fromEntries(Object.entries(value)
            .filter(([, item]) => typeof item !== 'function' && item !== undefined)
            .map(([key, item]) => [key, this.cloneJsonSafe(item, seen, depth + 1)]));
    }
    stripAgentRuntimeSlots(slots, options) {
        const clone = this.cloneJsonSafe(slots || {});
        const omitKeys = new Set((options?.omitKeys || []).map((key) => String(key || '').trim()).filter(Boolean));
        const strip = (value, depth = 0) => {
            if (Array.isArray(value))
                return value.map((item) => strip(item));
            if (!this.isPlainObject(value))
                return value;
            const result = {};
            Object.entries(value).forEach(([key, item]) => {
                if (depth === 0 && omitKeys.has(key))
                    return;
                if (['agentAutoTools', 'agentTaskState', 'autoTools', 'autoToolMessages'].includes(key))
                    return;
                result[key] = strip(item, depth + 1);
            });
            return result;
        };
        return strip(clone);
    }
    safeJsonStringify(value) {
        try {
            return JSON.stringify(this.cloneJsonSafe(value), null, 2);
        }
        catch {
            return JSON.stringify('[Unserializable]');
        }
    }
    getErrorMessage(error) {
        const response = typeof error?.getResponse === 'function' ? error.getResponse() : error?.response;
        if (response) {
            return typeof response === 'string' ? response : JSON.stringify(response);
        }
        return error?.message || String(error);
    }
    getCronTimezone(component) {
        return String(component?.cronTimezone || 'America/Sao_Paulo').trim() || 'America/Sao_Paulo';
    }
    getTimeZoneParts(date, timeZone) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date);
        const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return {
            year: Number(map.year),
            month: Number(map.month),
            day: Number(map.day),
            hour: Number(map.hour),
            minute: Number(map.minute),
            second: Number(map.second),
        };
    }
    getTimeZoneOffsetMs(date, timeZone) {
        const parts = this.getTimeZoneParts(date, timeZone);
        const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        return zonedAsUtc - date.getTime();
    }
    zonedTimeToUtc(year, month, day, hour, minute, second, timeZone) {
        const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
        const firstOffset = this.getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
        let result = new Date(utcGuess - firstOffset);
        const secondOffset = this.getTimeZoneOffsetMs(result, timeZone);
        if (secondOffset !== firstOffset) {
            result = new Date(utcGuess - secondOffset);
        }
        return result;
    }
    parseCronDate(value, timeZone = 'America/Sao_Paulo') {
        if (!value)
            return null;
        const raw = String(value);
        const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (localMatch) {
            return this.zonedTimeToUtc(Number(localMatch[1]), Number(localMatch[2]), Number(localMatch[3]), Number(localMatch[4]), Number(localMatch[5]), Number(localMatch[6] || 0), timeZone);
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    parseCronTime(value) {
        const match = String(value || '09:00').match(/^(\d{1,2}):(\d{2})/);
        const hour = match ? Number(match[1]) : 9;
        const minute = match ? Number(match[2]) : 0;
        return {
            hour: Math.max(0, Math.min(hour, 23)),
            minute: Math.max(0, Math.min(minute, 59)),
        };
    }
    getLocalDateParts(date, timeZone) {
        const parts = this.getTimeZoneParts(date, timeZone);
        return { year: parts.year, month: parts.month, day: parts.day };
    }
    atCronTime(localDate, time, timeZone) {
        return this.zonedTimeToUtc(localDate.year, localDate.month, localDate.day, time.hour, time.minute, 0, timeZone);
    }
    addCronDays(localDate, days) {
        const next = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days));
        return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
    }
    addCronMonths(localDate, months, dayOfMonth) {
        const firstOfMonth = new Date(Date.UTC(localDate.year, localDate.month - 1 + months, 1));
        const lastDay = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0)).getUTCDate();
        return {
            year: firstOfMonth.getUTCFullYear(),
            month: firstOfMonth.getUTCMonth() + 1,
            day: Math.min(dayOfMonth, lastDay),
        };
    }
    computeNextCronRun(component, fromDate = new Date()) {
        if (component.type !== 'cron' || component.cronEnabled !== true)
            return null;
        const timeZone = this.getCronTimezone(component);
        const startAt = this.parseCronDate(component.cronStartAt, timeZone);
        const lastRunAt = this.parseCronDate(component.cronLastRunAt, timeZone);
        const from = new Date(fromDate);
        const notBefore = startAt && startAt > from ? startAt : from;
        const mode = component.cronMode || 'interval';
        if (mode === 'interval') {
            const intervalValue = Math.max(Number(component.cronIntervalValue || 15), 1);
            const intervalMs = intervalValue * (component.cronIntervalUnit === 'hours' ? 60 * 60 * 1000 : 60 * 1000);
            if (!lastRunAt) {
                if (startAt && startAt <= from)
                    return startAt;
                if (startAt && startAt > from)
                    return startAt;
                return new Date(from.getTime() + intervalMs);
            }
            let next = new Date(lastRunAt.getTime() + intervalMs);
            while (next <= from) {
                next = new Date(next.getTime() + intervalMs);
            }
            return next;
        }
        const time = this.parseCronTime(component.cronTime);
        let localDate = this.getLocalDateParts(notBefore, timeZone);
        let next = this.atCronTime(localDate, time, timeZone);
        if (mode === 'daily') {
            while (next <= notBefore || (startAt && next < startAt)) {
                localDate = this.addCronDays(localDate, 1);
                next = this.atCronTime(localDate, time, timeZone);
            }
            return next;
        }
        if (mode === 'weekly') {
            const weekday = Math.max(0, Math.min(Number(component.cronWeekday ?? 1), 6));
            const currentWeekday = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day)).getUTCDay();
            const diff = (weekday - currentWeekday + 7) % 7;
            localDate = this.addCronDays(localDate, diff);
            next = this.atCronTime(localDate, time, timeZone);
            while (next <= notBefore || (startAt && next < startAt)) {
                localDate = this.addCronDays(localDate, 7);
                next = this.atCronTime(localDate, time, timeZone);
            }
            return next;
        }
        const monthDay = Math.max(1, Math.min(Number(component.cronMonthDay || 1), 31));
        localDate = this.addCronMonths(localDate, 0, monthDay);
        next = this.atCronTime(localDate, time, timeZone);
        while (next <= notBefore || (startAt && next < startAt)) {
            localDate = this.addCronMonths(localDate, 1, monthDay);
            next = this.atCronTime(localDate, time, timeZone);
        }
        return next;
    }
    cronSummary(component) {
        return {
            enabled: component.cronEnabled === true,
            mode: component.cronMode || 'interval',
            intervalValue: component.cronIntervalValue ?? 15,
            intervalUnit: component.cronIntervalUnit || 'minutes',
            time: component.cronTime || '09:00',
            weekday: component.cronWeekday ?? 1,
            monthDay: component.cronMonthDay ?? 1,
            timezone: component.cronTimezone || 'America/Sao_Paulo',
            lastRunAt: component.cronLastRunAt || null,
            nextRunAt: component.cronNextRunAt || null,
        };
    }
    appendCronExecutionLog(component, entry) {
        const currentLog = Array.isArray(component.cronExecutionLog) ? component.cronExecutionLog : [];
        component.cronExecutionLog = [
            {
                firedAt: entry.firedAt,
                finishedAt: entry.finishedAt,
                status: entry.status,
                messages: entry.messages,
                durationMs: entry.durationMs,
                nextRunAt: entry.nextRunAt,
                ...(entry.error ? { error: this.limitText(entry.error, 180) } : {}),
            },
            ...currentLog,
        ].slice(0, 8);
    }
    async outgoingTargets(step, config, context, trace, options) {
        const outgoing = await this.getOutgoingAsync(step.id, config, context, trace, options);
        if (!step.parentId) {
            return outgoing.map((edge) => edge.target);
        }
        const stepById = new Map(config.steps.map((item) => [item.id, item]));
        const parentGroup = stepById.get(step.parentId);
        if (!parentGroup || parentGroup.type !== 'group') {
            return outgoing.map((edge) => edge.target);
        }
        const groupExitTargets = await this.getGroupExitTargets(parentGroup, config, context, trace);
        const resolvedTargets = outgoing.flatMap((edge) => {
            if (edge.target === parentGroup.id) {
                return groupExitTargets;
            }
            return [edge.target];
        });
        if (resolvedTargets.length) {
            return resolvedTargets;
        }
        return groupExitTargets;
    }
    isDescendantOfGroup(stepId, groupId, config) {
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        let current = stepById.get(stepId);
        const visited = new Set();
        while (current?.parentId && !visited.has(current.parentId)) {
            if (current.parentId === groupId)
                return true;
            visited.add(current.parentId);
            current = stepById.get(current.parentId);
        }
        return false;
    }
    getDirectChildren(groupId, config) {
        return (config.steps || []).filter((step) => step.parentId === groupId);
    }
    sortStepsByCanvasPosition(steps) {
        return [...steps].sort((left, right) => {
            const lx = left.position?.x ?? 0;
            const rx = right.position?.x ?? 0;
            if (lx !== rx)
                return lx - rx;
            return (left.position?.y ?? 0) - (right.position?.y ?? 0);
        });
    }
    sortStepsByVerticalFlow(steps) {
        return [...steps].sort((left, right) => {
            const ly = left.position?.y ?? 0;
            const ry = right.position?.y ?? 0;
            if (ly !== ry)
                return ly - ry;
            return (left.position?.x ?? 0) - (right.position?.x ?? 0);
        });
    }
    sortStepIdsByExecutionOrder(stepIds, config) {
        const stepById = new Map(config.steps.map((step, index) => [step.id, { step, index }]));
        return [...stepIds].sort((leftId, rightId) => {
            const left = stepById.get(leftId);
            const right = stepById.get(rightId);
            const ly = left?.step.position?.y ?? 0;
            const ry = right?.step.position?.y ?? 0;
            if (ly !== ry)
                return ly - ry;
            const lx = left?.step.position?.x ?? 0;
            const rx = right?.step.position?.x ?? 0;
            if (lx !== rx)
                return lx - rx;
            return (left?.index ?? 0) - (right?.index ?? 0);
        });
    }
    flushDeferredMessages(messages, deferred, onMessage) {
        (deferred || []).forEach((message) => {
            messages.push(message);
            if (typeof onMessage === 'function') {
                onMessage(this.toPlain(message));
            }
        });
    }
    isCostlyOrSideEffectStep(step) {
        if (step.type === 'api')
            return true;
        if (step.type === 'message')
            return true;
        if (step.type === 'richMessage')
            return true;
        if (step.type === 'condition' && step.conditionMode === 'llm')
            return true;
        const componentType = step.component?.type;
        return Boolean(componentType && [
            'api',
            'openaiGen',
            'azureOpenAI',
            'rag',
            'mcp',
            'mongodb',
            'milvus',
            'azureSearch',
            'azureBlob',
            'files',
            'webhook',
            'dashboard',
            'cron',
            'flowRouter',
        ].includes(componentType));
    }
    isUserInteractionWaitStep(step) {
        if (!step)
            return false;
        if (step.type === 'input')
            return true;
        return step.type === 'component' && step.component?.type === 'approval';
    }
    emitUserInteractionWaitPrompt(step, context, messages, trace) {
        if (!step)
            return;
        if (step.type === 'input') {
            const text = this.renderTemplate(step.instruction || 'Informe o valor para continuar.', context);
            const lastAssistantMessage = this.getLastAssistantMessage(messages);
            if (context.__inputConsumedInRun === true
                && lastAssistantMessage
                && lastAssistantMessage.text !== text
                && this.assistantTextLooksLikeUserPrompt(lastAssistantMessage.text)) {
                trace.push({
                    stepId: step.id,
                    type: 'interactionWaitPromptSuppressed',
                    stepType: step.type,
                    text: this.limitText(text, 500),
                    lastAssistantText: this.limitText(lastAssistantMessage.text, 500),
                    reason: 'O agente ja respondeu pedindo o proximo dado; o runner apenas aguarda a proxima interacao neste input.',
                });
                return;
            }
            const lastMessage = messages[messages.length - 1];
            if (lastMessage?.role !== 'assistant' || lastMessage.text !== text) {
                this.emitFlowMessage(messages, { role: 'assistant', text }, { onMessage: context.__onMessage });
            }
            trace.push({
                stepId: step.id,
                type: 'interactionWaitPrompt',
                stepType: step.type,
                text: this.limitText(text, 500),
            });
        }
    }
    shouldQueueRuntimeTarget(target, completed, stepById, visitCountByStep, maxStepVisits, trace, sourceStepId) {
        const targetStep = stepById.get(target);
        if (!targetStep)
            return false;
        const visits = visitCountByStep.get(target) || 0;
        if (visits >= maxStepVisits) {
            trace.push({
                type: 'stepRevisitLimit',
                sourceStepId,
                targetStepId: target,
                targetTitle: targetStep.title || target,
                visits,
                maxStepVisits,
            });
            return false;
        }
        if (completed.has(target)
            && targetStep.type !== 'input'
            && stepById.get(sourceStepId || '')?.component?.type !== 'loop'
            && this.isCostlyOrSideEffectStep(targetStep)) {
            trace.push({
                type: 'stepRevisitBlocked',
                sourceStepId,
                targetStepId: target,
                targetTitle: targetStep.title || target,
                stepType: targetStep.type,
                componentType: targetStep.component?.type,
                reason: 'Reentrada em no com LLM/API/efeito externo exige componente Loop ou uma parada em Input.',
            });
            return false;
        }
        completed.delete(target);
        return true;
    }
    resolveStartStepIds(config, requestedStepId) {
        if (requestedStepId)
            return [requestedStepId];
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        const incomingTargets = new Set((config.edges || [])
            .filter((edge) => !this.isManifestVisualEdge(edge, config))
            .map((edge) => edge.target));
        const configured = config.startStepId ? stepById.get(config.startStepId) : undefined;
        const rootSteps = config.steps.filter((step) => !step.parentId && !incomingTargets.has(step.id));
        const rootConditions = rootSteps.filter((step) => step.type === 'condition');
        if (rootConditions.length) {
            return this.sortStepsByCanvasPosition(rootConditions).map((step) => step.id);
        }
        if (configured && configured.type !== 'end') {
            return [configured.id];
        }
        const startStepId = this.sortStepsByCanvasPosition(rootSteps)[0]?.id || configured?.id || config.steps[0]?.id;
        return startStepId ? [startStepId] : [];
    }
    async getGroupEntryTargets(group, config, context, trace) {
        const children = this.getDirectChildren(group.id, config);
        const childIds = new Set(children.map((child) => child.id));
        if (!children.length)
            return [];
        const explicitEntries = (await this.getOutgoingAsync(group.id, config, context, trace))
            .map((edge) => edge.target)
            .filter((target) => childIds.has(target));
        if (explicitEntries.length) {
            return explicitEntries;
        }
        const childrenWithInternalIncoming = new Set((config.edges || [])
            .filter((edge) => childIds.has(edge.source) && childIds.has(edge.target) && !this.isManifestVisualEdge(edge, config))
            .map((edge) => edge.target));
        const rootChildren = children.filter((child) => !childrenWithInternalIncoming.has(child.id));
        return this.sortStepsByVerticalFlow(rootChildren.length ? rootChildren : children).map((step) => step.id);
    }
    async getGroupExitTargets(group, config, context, trace) {
        return (await this.getOutgoingAsync(group.id, config, context, trace))
            .map((edge) => edge.target)
            .filter((target) => !this.isDescendantOfGroup(target, group.id, config));
    }
    hasWhatsappRuntimeOverride(whatsapp) {
        if (!whatsapp || typeof whatsapp !== 'object')
            return false;
        const textFields = [
            'verifyToken',
            'businessAccountId',
            'phoneNumberId',
            'accessToken',
            'blipContractId',
            'blipAuthorizationKey',
            'sinchProjectId',
            'sinchAppId',
            'sinchAccessToken',
            'sinchServiceNumber',
            'sinchServiceUsername',
            'sinchServiceToken',
        ];
        if (textFields.some((field) => String(whatsapp[field] || '').trim()))
            return true;
        if (String(whatsapp.provider || 'meta') !== 'meta')
            return true;
        if (String(whatsapp.deliveryMode || 'provider') === 'apiResponse')
            return true;
        if (whatsapp.autoReply === false)
            return true;
        if (String(whatsapp.sinchApiMode || 'conversation') === 'relay' || String(whatsapp.sinchApiMode || '') === 'broker')
            return true;
        if (String(whatsapp.graphApiVersion || '').trim() && String(whatsapp.graphApiVersion).trim() !== 'v20.0')
            return true;
        if (String(whatsapp.sinchRegion || '').trim() && String(whatsapp.sinchRegion).trim() !== 'us')
            return true;
        if (String(whatsapp.sinchChannel || '').trim() && String(whatsapp.sinchChannel).trim() !== 'WHATSAPP')
            return true;
        return false;
    }
    mergeWhatsappFallback(base, override) {
        const output = { ...(base || {}) };
        if (!override || typeof override !== 'object')
            return output;
        Object.entries(override).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '')
                return;
            output[key] = value;
        });
        return output;
    }
    mergeAgentRuntimeConfig(flowConfig, agentConfig) {
        const base = this.isPlainObject(flowConfig) ? flowConfig : { steps: [], edges: [] };
        const agent = this.isPlainObject(agentConfig) ? agentConfig : {};
        const flowSpec = this.isPlainObject(base.agentSpec) ? base.agentSpec : {};
        const agentSpec = this.isPlainObject(agent.agentSpec) ? agent.agentSpec : {};
        return {
            ...base,
            ...(String(agent.llmProvider || '').trim() ? { llmProvider: agent.llmProvider } : {}),
            ...(String(agent.model || '').trim() ? { model: String(agent.model || '').trim() } : {}),
            agentSpec: {
                ...flowSpec,
                ...agentSpec,
                blockedTerms: Array.isArray(agentSpec.blockedTerms)
                    ? agentSpec.blockedTerms
                    : Array.isArray(flowSpec.blockedTerms)
                        ? flowSpec.blockedTerms
                        : [],
                rules: Array.isArray(agentSpec.rules) ? agentSpec.rules : (Array.isArray(flowSpec.rules) ? flowSpec.rules : []),
                skills: Array.isArray(agentSpec.skills) ? agentSpec.skills : (Array.isArray(flowSpec.skills) ? flowSpec.skills : []),
                subagents: Array.isArray(agentSpec.subagents) ? agentSpec.subagents : (Array.isArray(flowSpec.subagents) ? flowSpec.subagents : []),
                mcpServers: Array.isArray(agentSpec.mcpServers) ? agentSpec.mcpServers : (Array.isArray(flowSpec.mcpServers) ? flowSpec.mcpServers : []),
            },
        };
    }
    async resolveRuntimeFlowConfig(config, agentId, organizationId) {
        const settings = await this.providerConfigService.getEffectiveSettings(agentId);
        const agentConfig = agentId
            ? await this.canvasFlowService.getAgentConfig(agentId, organizationId).catch(() => ({}))
            : {};
        const mergedConfig = this.mergeAgentRuntimeConfig(config, agentConfig);
        const providerWhatsapp = settings.whatsapp || {};
        const flowWhatsapp = mergedConfig?.whatsapp || {};
        const whatsapp = this.hasWhatsappRuntimeOverride(flowWhatsapp)
            ? this.mergeWhatsappFallback(providerWhatsapp, flowWhatsapp)
            : providerWhatsapp;
        return {
            ...mergedConfig,
            whatsapp,
        };
    }
    normalizeWhatsappProvider(config) {
        const provider = String(config?.whatsapp?.provider || 'meta').toLowerCase();
        if (provider === 'blip' || provider === 'sinch')
            return provider;
        return 'meta';
    }
    normalizeWhatsappDeliveryMode(config) {
        if (this.normalizeWhatsappProvider(config) === 'sinch') {
            const mode = config?.whatsapp?.sinchApiMode;
            if (mode === 'relay' || mode === 'broker')
                return 'apiResponse';
        }
        return config?.whatsapp?.deliveryMode === 'apiResponse' ? 'apiResponse' : 'provider';
    }
    hasSinchRelayCredentials(config) {
        const whatsapp = config?.whatsapp || {};
        const legacyWhatsapp = whatsapp;
        const serviceUsername = String(whatsapp.sinchServiceUsername || legacyWhatsapp.sinchBrokerUsername || legacyWhatsapp.sinchBrokerNumber || '').trim();
        const serviceToken = String(whatsapp.sinchServiceToken || legacyWhatsapp.sinchBrokerToken || '').trim();
        return Boolean(serviceUsername && serviceToken);
    }
    hasSinchConversationCredentials(config) {
        const whatsapp = config?.whatsapp || {};
        return Boolean(String(whatsapp.sinchProjectId || '').trim() &&
            String(whatsapp.sinchAppId || '').trim() &&
            String(whatsapp.sinchAccessToken || '').trim());
    }
    normalizeSinchApiMode(config) {
        if (this.normalizeWhatsappDeliveryMode(config) === 'apiResponse')
            return 'relay';
        const mode = config?.whatsapp?.sinchApiMode;
        return mode === 'relay' || mode === 'broker' ? 'relay' : 'conversation';
    }
    normalizeGraphApiVersion(value) {
        const raw = String(value || 'v20.0').trim();
        return raw.startsWith('v') ? raw : `v${raw}`;
    }
    async resolveWhatsappFlowCredentials(body) {
        const settings = await this.providerConfigService.getEffectiveSettings(body?.agentId || body?.config?.agentId);
        const override = body?.whatsapp || body?.config?.whatsapp || {};
        const whatsapp = this.hasWhatsappRuntimeOverride(override)
            ? this.mergeWhatsappFallback(settings.whatsapp || {}, override)
            : settings.whatsapp || {};
        const accessToken = String(whatsapp.accessToken || '').trim();
        const businessAccountId = String(whatsapp.businessAccountId ||
            whatsapp.wabaId ||
            '').trim();
        const graphApiVersion = this.normalizeGraphApiVersion(whatsapp.graphApiVersion);
        if (!accessToken) {
            throw new common_1.HttpException('Access token da Meta nao configurado.', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!businessAccountId) {
            throw new common_1.HttpException('WhatsApp Business Account ID e obrigatorio para criar Flow.', common_1.HttpStatus.BAD_REQUEST);
        }
        return { accessToken, businessAccountId, graphApiVersion };
    }
    buildWhatsappFlowOptionSchema(example) {
        return {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
            },
            __example__: example,
        };
    }
    identifierNumberWord(value) {
        const digitWords = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        return digitWords[value] || 'item';
    }
    normalizeAttachmentStepId(value, index) {
        const normalized = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\d/g, (digit) => `_${this.identifierNumberWord(Number(digit))}_`)
            .replace(/[^a-z_]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        return normalized || `anexo_${this.identifierNumberWord(index + 1)}`;
    }
    attachmentStepKey(id) {
        return `attachment:${id}`;
    }
    normalizeAppointmentAttachmentSteps(flow) {
        return (Array.isArray(flow?.attachmentSteps) ? flow.attachmentSteps : [])
            .slice(0, 3)
            .map((step, index) => {
            const id = this.normalizeAttachmentStepId(step?.id, index);
            const type = step?.type === 'document' ? 'document' : 'image';
            return {
                id,
                key: this.attachmentStepKey(id),
                name: `attachment_${id}`,
                label: this.limitText(step?.label, 30, `Anexo ${index + 1}`),
                description: this.limitText(step?.description, 300, type === 'document' ? 'Anexe o documento solicitado.' : 'Anexe uma imagem legivel.'),
                type,
                required: step?.required !== false,
            };
        });
    }
    normalizeAppointmentFlowStepOrder(flow, attachments) {
        const base = ['actions', 'appointments', 'providers', 'services', 'dates', 'times', 'items'];
        const defaultOrder = ['providers', 'services', 'dates', 'times'];
        const attachmentKeys = attachments.map((step) => step.key);
        const allowed = new Set([...base, ...attachmentKeys]);
        const initialOrder = Array.isArray(flow?.stepOrder) ? flow.stepOrder : defaultOrder;
        const ordered = initialOrder
            .map((item) => String(item || '').trim() === 'exams' ? 'items' : String(item || '').trim())
            .filter((item, index, source) => allowed.has(item) && source.indexOf(item) === index);
        for (const item of attachmentKeys) {
            if (!ordered.includes(item))
                ordered.push(item);
        }
        if (!ordered.length)
            ordered.push('providers');
        return ordered;
    }
    appointmentFlowConfiguredLabel(flow, stepKey, fallback, max = 30) {
        const label = flow?.stepLabels?.[stepKey] || fallback;
        return this.limitText(label, max, fallback);
    }
    appointmentFlowScreenId(stepKey, index) {
        if (index === 0)
            return 'START';
        if (stepKey === 'actions')
            return 'ACTIONS';
        if (stepKey === 'appointments')
            return 'APPOINTMENTS';
        if (stepKey === 'providers')
            return 'PROVIDERS';
        if (stepKey === 'services')
            return 'SERVICES';
        if (stepKey === 'dates')
            return 'DATES';
        if (stepKey === 'times')
            return 'TIMES';
        if (stepKey === 'items')
            return 'ITEMS';
        return `ATTACHMENT_${this.normalizeAttachmentStepId(stepKey.replace(/^attachment:/, ''), index).toUpperCase()}`;
    }
    appointmentFlowScreenTitle(stepKey, title, attachments, flow) {
        if (stepKey === 'actions')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Acoes iniciais');
        if (stepKey === 'appointments')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Meus agendamentos');
        if (stepKey === 'providers')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Prestadores');
        if (stepKey === 'services')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Servicos');
        if (stepKey === 'dates')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Datas');
        if (stepKey === 'times')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Horarios');
        if (stepKey === 'items')
            return this.appointmentFlowConfiguredLabel(flow, stepKey, 'Itens');
        const attachment = attachments.find((step) => step.key === stepKey);
        return this.limitText(attachment?.label, 30, title || 'Anexo');
    }
    appointmentFlowComponentForStep(stepKey, attachments, flow) {
        if (stepKey === 'actions') {
            return {
                type: 'Dropdown',
                name: 'action',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Acao'),
                required: true,
                'data-source': '${data.actions}',
            };
        }
        if (stepKey === 'appointments') {
            return {
                type: 'Dropdown',
                name: 'appointment',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Agendamento'),
                required: true,
                'data-source': '${data.appointments}',
            };
        }
        if (stepKey === 'providers') {
            return {
                type: 'Dropdown',
                name: 'provider',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Prestador'),
                required: true,
                'data-source': '${data.providers}',
            };
        }
        if (stepKey === 'services') {
            return {
                type: 'Dropdown',
                name: 'service',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Servico'),
                required: true,
                'data-source': '${data.services}',
            };
        }
        if (stepKey === 'dates') {
            return {
                type: 'Dropdown',
                name: 'date',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Data'),
                required: true,
                'data-source': '${data.dates}',
            };
        }
        if (stepKey === 'times') {
            return {
                type: 'Dropdown',
                name: 'time',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Horario'),
                required: true,
                'data-source': '${data.times}',
            };
        }
        if (stepKey === 'items') {
            return {
                type: 'CheckboxGroup',
                name: 'items',
                label: this.appointmentFlowConfiguredLabel(flow, stepKey, 'Itens'),
                'min-selected-items': 1,
                'max-selected-items': this.limitNumber(flow?.itemsMaxSelected, 20, 1, 20),
                'data-source': '${data.items}',
            };
        }
        const attachment = attachments.find((step) => step.key === stepKey);
        if (!attachment)
            return null;
        if (attachment.type === 'document') {
            return {
                type: 'DocumentPicker',
                name: attachment.name,
                label: attachment.label,
                description: attachment.description,
                'min-uploaded-documents': attachment.required ? 1 : 0,
                'max-uploaded-documents': 1,
                'max-file-size-kb': 25600,
                'allowed-mime-types': ['application/pdf', 'image/jpeg', 'image/png'],
            };
        }
        return {
            type: 'PhotoPicker',
            name: attachment.name,
            label: attachment.label,
            description: attachment.description,
            'min-uploaded-photos': attachment.required ? 1 : 0,
            'max-uploaded-photos': 1,
            'max-file-size-kb': 10240,
        };
    }
    appointmentFlowDataSchema(optionSchema, attachments, introText, includeSelectedItems = false) {
        const attachmentSchema = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    media_id: { type: 'string' },
                    url: { type: 'string' },
                    mime_type: { type: 'string' },
                    file_name: { type: 'string' },
                },
            },
            __example__: [],
        };
        return {
            introText: { type: 'string', __example__: introText },
            actions: optionSchema,
            appointments: optionSchema,
            providers: optionSchema,
            services: optionSchema,
            dates: optionSchema,
            times: optionSchema,
            items: optionSchema,
            exams: optionSchema,
            action: { type: 'string', __example__: 'action_um' },
            appointment: { type: 'string', __example__: 'appointment_um' },
            provider: { type: 'string', __example__: 'provider_um' },
            service: { type: 'string', __example__: 'service_um' },
            date: { type: 'string', __example__: 'date_um' },
            time: { type: 'string', __example__: 'time_um' },
            ...(includeSelectedItems ? { selected_items: {
                    type: 'array',
                    items: { type: 'string' },
                    __example__: ['item_um'],
                } } : {}),
            ...Object.fromEntries(attachments.map((step) => [step.name, attachmentSchema])),
        };
    }
    appointmentFlowPayloadForStep(stepKey, attachments, includeSelectedItems = false, complete = false) {
        const payload = {
            action: stepKey === 'actions' ? '${form.action}' : '${data.action}',
            appointment: stepKey === 'appointments' ? '${form.appointment}' : '${data.appointment}',
            provider: stepKey === 'providers' ? '${form.provider}' : '${data.provider}',
            service: stepKey === 'services' ? '${form.service}' : '${data.service}',
            date: stepKey === 'dates' ? '${form.date}' : '${data.date}',
            time: stepKey === 'times' ? '${form.time}' : '${data.time}',
        };
        if (!complete) {
            payload.introText = '${data.introText}';
            payload.actions = '${data.actions}';
            payload.appointments = '${data.appointments}';
            payload.providers = '${data.providers}';
            payload.services = '${data.services}';
            payload.dates = '${data.dates}';
            payload.times = '${data.times}';
            payload.items = '${data.items}';
            payload.exams = '${data.exams}';
        }
        if (stepKey === 'items')
            payload.selected_items = '${form.items}';
        if (stepKey !== 'items' && includeSelectedItems)
            payload.selected_items = '${data.selected_items}';
        for (const attachment of attachments) {
            payload[attachment.name] = stepKey === attachment.key ? `\${form.${attachment.name}}` : `\${data.${attachment.name}}`;
        }
        return payload;
    }
    buildOrderedAppointmentWhatsappFlowJson(body, flow) {
        const optionSchema = this.buildWhatsappFlowOptionSchema([
            { id: 'item_um', title: 'Opcao', description: 'Descricao curta' },
        ]);
        const title = this.limitText(body?.title || body?.flowTitle, 60, 'Agendamento');
        const introText = this.limitText(body?.introText, 300, 'Escolha as opcoes para montar seu agendamento.');
        const attachments = this.normalizeAppointmentAttachmentSteps(flow);
        const order = this.normalizeAppointmentFlowStepOrder(flow, attachments);
        const screenIds = order.map((stepKey, index) => this.appointmentFlowScreenId(stepKey, index));
        const itemsIndex = order.indexOf('items');
        const includeSelectedItems = itemsIndex >= 0 && itemsIndex < order.length - 1;
        const dataSchema = this.appointmentFlowDataSchema(optionSchema, attachments, introText, includeSelectedItems);
        const routingModel = Object.fromEntries(screenIds.map((id, index) => [id, index < screenIds.length - 1 ? [screenIds[index + 1]] : []]));
        const screens = order.map((stepKey, index) => {
            const id = screenIds[index];
            const nextId = screenIds[index + 1] || '';
            const isLast = index === order.length - 1;
            const component = this.appointmentFlowComponentForStep(stepKey, attachments, flow);
            return {
                id,
                title: this.appointmentFlowScreenTitle(stepKey, title, attachments, flow),
                terminal: isLast,
                ...(isLast ? { success: true } : {}),
                data: dataSchema,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [
                        ...(index === 0 ? [{ type: 'TextHeading', text: title }, { type: 'TextBody', text: '${data.introText}' }] : []),
                        {
                            type: 'Form',
                            name: `${id.toLowerCase()}_form`,
                            children: [
                                component,
                                {
                                    type: 'Footer',
                                    label: 'Continuar',
                                    'on-click-action': {
                                        name: isLast ? 'complete' : 'navigate',
                                        ...(isLast ? {} : { next: { type: 'screen', name: nextId } }),
                                        payload: {
                                            ...this.appointmentFlowPayloadForStep(stepKey, attachments, includeSelectedItems, isLast),
                                            ...(isLast ? { source: 'canvas-flow' } : {}),
                                        },
                                    },
                                },
                            ].filter(Boolean),
                        },
                    ],
                },
            };
        });
        const firstScreen = String(body?.firstScreen || flow?.flowScreen || screenIds[0] || 'START').trim() || screenIds[0] || 'START';
        return {
            version: '7.3',
            routing_model: routingModel,
            screens,
            ...(firstScreen !== screenIds[0] ? { first_screen: firstScreen } : {}),
        };
    }
    buildAppointmentWhatsappFlowJson(body = {}) {
        const flow = body?.appointmentFlow || body?.flow || body;
        const attachments = this.normalizeAppointmentAttachmentSteps(flow);
        if (attachments.length || Array.isArray(flow?.stepOrder) || this.isPlainObject(flow?.stepLabels)) {
            return this.buildOrderedAppointmentWhatsappFlowJson(body, flow);
        }
        const optionSchema = this.buildWhatsappFlowOptionSchema([
            { id: 'item_um', title: 'Opcao', description: 'Descricao curta' },
        ]);
        const title = this.limitText(body?.title || body?.flowTitle, 60, 'Agendamento');
        const introText = this.limitText(body?.introText, 300, 'Escolha as opcoes para montar seu agendamento.');
        const firstScreen = String(body?.firstScreen || 'START').trim() || 'START';
        return {
            version: '7.3',
            routing_model: {
                START: ['SERVICES'],
                SERVICES: ['DATES'],
                DATES: ['TIMES'],
                TIMES: ['SUMMARY'],
                SUMMARY: [],
            },
            screens: [
                {
                    id: 'START',
                    title,
                    terminal: false,
                    data: {
                        introText: { type: 'string', __example__: introText },
                        providers: optionSchema,
                        services: optionSchema,
                        dates: optionSchema,
                        times: optionSchema,
                    },
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [
                            { type: 'TextHeading', text: title },
                            { type: 'TextBody', text: '${data.introText}' },
                            {
                                type: 'Form',
                                name: 'provider_form',
                                children: [
                                    {
                                        type: 'Dropdown',
                                        name: 'provider',
                                        label: 'Prestador',
                                        required: true,
                                        'data-source': '${data.providers}',
                                    },
                                    {
                                        type: 'Footer',
                                        label: 'Continuar',
                                        'on-click-action': {
                                            name: 'navigate',
                                            next: { type: 'screen', name: 'SERVICES' },
                                            payload: {
                                                provider: '${form.provider}',
                                                services: '${data.services}',
                                                dates: '${data.dates}',
                                                times: '${data.times}',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: 'SERVICES',
                    title: 'Servico',
                    terminal: false,
                    data: {
                        provider: { type: 'string', __example__: 'provider_um' },
                        services: optionSchema,
                        dates: optionSchema,
                        times: optionSchema,
                    },
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [
                            { type: 'TextHeading', text: 'Escolha o servico' },
                            {
                                type: 'Form',
                                name: 'service_form',
                                children: [
                                    {
                                        type: 'Dropdown',
                                        name: 'service',
                                        label: 'Servico',
                                        required: true,
                                        'data-source': '${data.services}',
                                    },
                                    {
                                        type: 'Footer',
                                        label: 'Continuar',
                                        'on-click-action': {
                                            name: 'navigate',
                                            next: { type: 'screen', name: 'DATES' },
                                            payload: {
                                                provider: '${data.provider}',
                                                service: '${form.service}',
                                                dates: '${data.dates}',
                                                times: '${data.times}',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: 'DATES',
                    title: 'Data',
                    terminal: false,
                    data: {
                        provider: { type: 'string', __example__: 'provider_um' },
                        service: { type: 'string', __example__: 'service_um' },
                        dates: optionSchema,
                        times: optionSchema,
                    },
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [
                            { type: 'TextHeading', text: 'Escolha a data' },
                            {
                                type: 'Form',
                                name: 'date_form',
                                children: [
                                    {
                                        type: 'Dropdown',
                                        name: 'date',
                                        label: 'Data',
                                        required: true,
                                        'data-source': '${data.dates}',
                                    },
                                    {
                                        type: 'Footer',
                                        label: 'Continuar',
                                        'on-click-action': {
                                            name: 'navigate',
                                            next: { type: 'screen', name: 'TIMES' },
                                            payload: {
                                                provider: '${data.provider}',
                                                service: '${data.service}',
                                                date: '${form.date}',
                                                times: '${data.times}',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: 'TIMES',
                    title: 'Horario',
                    terminal: false,
                    data: {
                        provider: { type: 'string', __example__: 'provider_um' },
                        service: { type: 'string', __example__: 'service_um' },
                        date: { type: 'string', __example__: 'date_um' },
                        times: optionSchema,
                    },
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [
                            { type: 'TextHeading', text: 'Escolha o horario' },
                            {
                                type: 'Form',
                                name: 'time_form',
                                children: [
                                    {
                                        type: 'Dropdown',
                                        name: 'time',
                                        label: 'Horario',
                                        required: true,
                                        'data-source': '${data.times}',
                                    },
                                    {
                                        type: 'Footer',
                                        label: 'Continuar',
                                        'on-click-action': {
                                            name: 'navigate',
                                            next: { type: 'screen', name: 'SUMMARY' },
                                            payload: {
                                                provider: '${data.provider}',
                                                service: '${data.service}',
                                                date: '${data.date}',
                                                time: '${form.time}',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: 'SUMMARY',
                    title: 'Confirmar',
                    terminal: true,
                    success: true,
                    data: {
                        provider: { type: 'string', __example__: 'provider_um' },
                        service: { type: 'string', __example__: 'service_um' },
                        date: { type: 'string', __example__: 'date_um' },
                        time: { type: 'string', __example__: 'time_um' },
                    },
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [
                            { type: 'TextHeading', text: 'Confirmar agendamento' },
                            { type: 'TextBody', text: 'Confira os dados e confirme para enviar a solicitacao.' },
                            {
                                type: 'Footer',
                                label: 'Confirmar',
                                'on-click-action': {
                                    name: 'complete',
                                    payload: {
                                        provider: '${data.provider}',
                                        service: '${data.service}',
                                        date: '${data.date}',
                                        time: '${data.time}',
                                        source: 'canvas-flow',
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
            ...(firstScreen !== 'START' ? { first_screen: firstScreen } : {}),
        };
    }
    sanitizeWhatsappFlowJsonForMeta(value) {
        if (Array.isArray(value))
            return value.map((item) => this.sanitizeWhatsappFlowJsonForMeta(item));
        if (!this.isPlainObject(value))
            return value;
        const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.sanitizeWhatsappFlowJsonForMeta(item)]));
        if (next.type === 'PhotoPicker') {
            delete next.required;
        }
        return next;
    }
    async metaJsonRequest(url, accessToken, init = {}) {
        const response = await fetch(url, {
            ...init,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(init.headers || {}),
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new common_1.HttpException({
                statusCode: response.status,
                message: data?.error?.message || data?.message || `Erro Meta HTTP ${response.status}`,
                whatsappError: data,
            }, response.status >= 400 && response.status < 500 ? response.status : common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return data;
    }
    async createMetaWhatsappFlow(body) {
        const credentials = await this.resolveWhatsappFlowCredentials(body);
        const url = `https://graph.facebook.com/${credentials.graphApiVersion}/${credentials.businessAccountId}/flows`;
        const form = new FormData();
        form.append('name', this.limitText(body?.name, 80, `Canvas Agendamento ${Date.now()}`));
        form.append('categories', JSON.stringify(body?.categories || ['APPOINTMENT_BOOKING']));
        if (body?.endpointUri || body?.endpoint_uri) {
            form.append('endpoint_uri', String(body.endpointUri || body.endpoint_uri));
        }
        if (body?.cloneFlowId || body?.clone_flow_id) {
            form.append('clone_flow_id', String(body.cloneFlowId || body.clone_flow_id));
        }
        const data = await this.metaJsonRequest(url, credentials.accessToken, {
            method: 'POST',
            body: form,
        });
        return { ...data, businessAccountId: credentials.businessAccountId, graphApiVersion: credentials.graphApiVersion };
    }
    async listWhatsappFlows(body) {
        const credentials = await this.resolveWhatsappFlowCredentials(body);
        const limit = Math.max(1, Math.min(Number(body?.limit || 100), 100));
        const fields = [
            'id',
            'name',
            'status',
            'categories',
            'created_time',
            'updated_time',
            'validation_errors',
        ].join(',');
        const url = new URL(`https://graph.facebook.com/${credentials.graphApiVersion}/${credentials.businessAccountId}/flows`);
        url.searchParams.set('fields', fields);
        url.searchParams.set('limit', String(limit));
        if (body?.after)
            url.searchParams.set('after', String(body.after));
        const data = await this.metaJsonRequest(url.toString(), credentials.accessToken);
        return {
            success: true,
            flows: Array.isArray(data?.data) ? data.data : [],
            paging: data?.paging || null,
            businessAccountId: credentials.businessAccountId,
            graphApiVersion: credentials.graphApiVersion,
        };
    }
    async deleteWhatsappFlow(body) {
        const credentials = await this.resolveWhatsappFlowCredentials(body);
        const flowId = String(body?.flowId || '').trim();
        if (!flowId)
            throw new common_1.HttpException('flowId e obrigatorio.', common_1.HttpStatus.BAD_REQUEST);
        const url = `https://graph.facebook.com/${credentials.graphApiVersion}/${flowId}`;
        try {
            const data = await this.metaJsonRequest(url, credentials.accessToken, { method: 'DELETE' });
            return { success: true, deleted: true, flowId, data };
        }
        catch (error) {
            if (body?.deprecateOnFailure === false)
                throw error;
            const data = await this.metaJsonRequest(`${url}/deprecate`, credentials.accessToken, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            return {
                success: true,
                deleted: false,
                deprecated: true,
                flowId,
                data,
                deleteFallbackReason: this.getErrorMessage(error),
            };
        }
    }
    async uploadWhatsappFlowJson(body) {
        const credentials = await this.resolveWhatsappFlowCredentials(body);
        const flowId = String(body?.flowId || '').trim();
        if (!flowId)
            throw new common_1.HttpException('flowId e obrigatorio.', common_1.HttpStatus.BAD_REQUEST);
        const flowJson = this.sanitizeWhatsappFlowJsonForMeta(body?.flowJson || body?.flow_json || this.buildAppointmentWhatsappFlowJson(body));
        const form = new FormData();
        form.append('name', 'flow.json');
        form.append('asset_type', 'FLOW_JSON');
        form.append('file', new Blob([JSON.stringify(flowJson)], { type: 'application/json' }), 'flow.json');
        const data = await this.metaJsonRequest(`https://graph.facebook.com/${credentials.graphApiVersion}/${flowId}/assets`, credentials.accessToken, {
            method: 'POST',
            body: form,
        });
        return {
            success: !Array.isArray(data?.validation_errors) || data.validation_errors.length === 0,
            flowId,
            data,
            validationErrors: data?.validation_errors || [],
            flowJson,
        };
    }
    async publishWhatsappFlow(body) {
        const credentials = await this.resolveWhatsappFlowCredentials(body);
        const flowId = String(body?.flowId || '').trim();
        if (!flowId)
            throw new common_1.HttpException('flowId e obrigatorio.', common_1.HttpStatus.BAD_REQUEST);
        const data = await this.metaJsonRequest(`https://graph.facebook.com/${credentials.graphApiVersion}/${flowId}/publish`, credentials.accessToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        return { success: true, flowId, data };
    }
    async createWhatsappFlow(body) {
        const create = await this.createMetaWhatsappFlow(body);
        const flowId = String(create.id || create.flowId || '').trim();
        if (!flowId) {
            throw new common_1.HttpException('A Meta nao retornou o ID do Flow criado.', common_1.HttpStatus.BAD_REQUEST);
        }
        const flowJson = this.sanitizeWhatsappFlowJsonForMeta(body?.flowJson || body?.flow_json || this.buildAppointmentWhatsappFlowJson(body));
        const upload = await this.uploadWhatsappFlowJson({
            ...body,
            flowId,
            flowJson,
        });
        const validationErrors = upload.validationErrors || [];
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            return {
                success: false,
                flowId,
                created: create,
                upload,
                validationErrors,
            };
        }
        const publish = body?.publish === true
            ? await this.publishWhatsappFlow({ ...body, flowId })
            : null;
        return {
            success: true,
            flowId,
            created: create,
            upload,
            publish,
            flowJson,
        };
    }
    sanitizeMcpToolName(value, fallback) {
        const ascii = String(value || fallback || 'canvas_flow')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const slug = ascii
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^[_-]+|[_-]+$/g, '');
        return (slug || 'canvas_flow').slice(0, 80);
    }
    mcpToolNameForFlow(flow) {
        const baseName = flow?.config?.responseName || flow?.name || flow?.config?.title || flow?._id;
        return this.sanitizeMcpToolName(baseName, `flow_${String(flow?._id || '').slice(-8)}`);
    }
    mcpInputSchemaForFlow(flow) {
        return {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'Mensagem ou tarefa de entrada para executar o fluxo.',
                },
                conversationId: {
                    type: 'string',
                    description: 'ID opcional para preservar memoria entre chamadas.',
                },
                slots: {
                    type: 'object',
                    description: 'Contexto inicial opcional em context.slots.',
                    additionalProperties: true,
                },
                flowVersion: {
                    type: 'number',
                    description: 'Versao especifica do fluxo, opcional.',
                },
                agentRelease: {
                    type: 'number',
                    description: 'Release especifico do agente, opcional.',
                },
                approvals: {
                    type: 'object',
                    description: 'Decisoes humanas pre-aprovadas por stepId ou responseName.',
                    additionalProperties: true,
                },
            },
            required: ['text'],
            additionalProperties: true,
            description: `Executa o fluxo ${flow?.name || flow?.config?.title || ''} no Canvas Flow.`,
        };
    }
    async listMcpTools(agentId, organizationId) {
        const flows = await this.canvasFlowService.findAll(agentId || 'default-agent', organizationId, { includeConfig: true });
        return (flows || [])
            .filter((flow) => flow?.config?.steps?.length)
            .map((flow) => ({
            name: this.mcpToolNameForFlow(flow),
            title: flow.name || flow.config?.title || this.mcpToolNameForFlow(flow),
            description: flow.description || `Executa o fluxo "${flow.name || flow.config?.title || 'Canvas Flow'}".`,
            inputSchema: this.mcpInputSchemaForFlow(flow),
            annotations: {
                flowId: String(flow._id || ''),
                agentId: flow.agentId || agentId || 'default-agent',
                channel: flow.config?.channel || 'webWidget',
                activeVersion: flow.activeVersion,
                latestVersion: flow.latestVersion,
                isMainFlow: flow.config?.isMainFlow === true,
            },
        }));
    }
    async callMcpTool(agentId, toolName, args = {}, organizationId, oauthUserId) {
        const flows = await this.canvasFlowService.findAll(agentId || 'default-agent', organizationId, { includeConfig: true });
        const target = (flows || []).find((flow) => {
            const name = this.mcpToolNameForFlow(flow);
            return name === toolName || String(flow._id || '') === toolName;
        });
        if (!target) {
            throw new common_1.HttpException(`Ferramenta MCP "${toolName}" nao encontrada para o agente.`, common_1.HttpStatus.NOT_FOUND);
        }
        const result = await this.run({
            flowId: String(target._id),
            agentId: target.agentId || agentId || 'default-agent',
            channel: args.channel || target.config?.channel || 'webWidget',
            conversationId: args.conversationId || `mcp-${(0, crypto_1.randomUUID)()}`,
            text: String(args.text || args.input || ''),
            slots: this.isPlainObject(args.slots) ? args.slots : {},
            approvals: this.isPlainObject(args.approvals) ? args.approvals : {},
            flowVersion: args.flowVersion,
            agentRelease: args.agentRelease,
            traceMode: args.traceMode || 'compact',
            traceLimit: this.limitNumber(args.traceLimit ?? 80, 80, 0, 500),
            skipHistory: args.skipHistory === true,
            _organizationId: organizationId,
            _oauthUserId: oauthUserId,
            _conversationOwnerId: oauthUserId || 'mcp',
        });
        const text = (result.messages || [])
            .map((message) => `${message.role}: ${message.text || ''}`)
            .filter(Boolean)
            .join('\n')
            || JSON.stringify({ slots: result.slots, ended: result.ended }, null, 2);
        return {
            content: [{ type: 'text', text }],
            structuredContent: {
                messages: result.messages || [],
                slots: result.slots || {},
                currentStepId: result.currentStepId || '',
                ended: result.ended === true,
                conversationId: result.conversationId,
                flowId: String(target._id),
                flowName: target.name || target.config?.title,
                trace: result.trace || [],
            },
        };
    }
    async handleMcpJsonRpc(agentId, body, organizationId, oauthUserId) {
        const requests = Array.isArray(body) ? body : [body];
        const responses = await Promise.all(requests.map(async (request) => {
            const id = request?.id ?? null;
            const method = String(request?.method || '');
            try {
                if (method === 'initialize') {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: request?.params?.protocolVersion || '2025-06-18',
                            capabilities: { tools: {} },
                            serverInfo: { name: `canvas-flow-${agentId || 'default-agent'}`, version: '0.1.0' },
                        },
                    };
                }
                if (method === 'ping' || method === 'notifications/initialized') {
                    return { jsonrpc: '2.0', id, result: {} };
                }
                if (method === 'tools/list') {
                    return { jsonrpc: '2.0', id, result: { tools: await this.listMcpTools(agentId, organizationId) } };
                }
                if (method === 'tools/call') {
                    const result = await this.callMcpTool(agentId, String(request?.params?.name || ''), request?.params?.arguments || {}, organizationId, oauthUserId);
                    return { jsonrpc: '2.0', id, result };
                }
                return {
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32601, message: `Metodo MCP nao suportado: ${method}` },
                };
            }
            catch (error) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: error?.status || -32000,
                        message: this.getErrorMessage(error),
                    },
                };
            }
        }));
        return Array.isArray(body) ? responses : responses[0];
    }
    parseSimulationCases(body) {
        if (Array.isArray(body?.cases))
            return body.cases;
        const transcript = String(body?.transcript || '').trim();
        if (!transcript)
            return [];
        return transcript
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => /^(user|usuario|usuário|cliente|humano|u)\s*:/i.test(line))
            .map((line) => ({
            text: line.replace(/^[^:]+:\s*/, ''),
        }));
    }
    resolvePathValue(source, pathValue) {
        const normalized = String(pathValue || '').replace(/^\$?\./, '');
        if (!normalized)
            return source;
        return normalized.split('.').reduce((current, part) => {
            if (current === undefined || current === null)
                return undefined;
            return current[part];
        }, source);
    }
    evaluateSimulationCase(testCase, result) {
        const checks = [];
        const expectedIncludes = Array.isArray(testCase?.expectedContains)
            ? testCase.expectedContains
            : Array.isArray(testCase?.expectedTextIncludes)
                ? testCase.expectedTextIncludes
                : testCase?.expectedContains || testCase?.expectedTextIncludes
                    ? [testCase.expectedContains || testCase.expectedTextIncludes]
                    : [];
        const outputText = (result.messages || []).map((message) => String(message?.text || '')).join('\n').toLowerCase();
        expectedIncludes.forEach((expected) => {
            const needle = String(expected || '').trim().toLowerCase();
            if (!needle)
                return;
            checks.push({
                type: 'text_contains',
                expected: needle,
                passed: outputText.includes(needle),
            });
        });
        const expectedSlots = this.isPlainObject(testCase?.expectedSlots) ? testCase.expectedSlots : {};
        Object.entries(expectedSlots).forEach(([pathValue, expected]) => {
            const actual = this.resolvePathValue(result.slots || {}, pathValue);
            checks.push({
                type: 'slot_equals',
                path: pathValue,
                expected,
                actual,
                passed: JSON.stringify(actual) === JSON.stringify(expected),
            });
        });
        if (testCase?.expectedEnded !== undefined) {
            checks.push({
                type: 'ended',
                expected: testCase.expectedEnded === true,
                actual: result.ended === true,
                passed: (result.ended === true) === (testCase.expectedEnded === true),
            });
        }
        const traceErrors = (result.trace || []).filter((item) => this.traceErrorMessage(item));
        if (testCase?.allowErrors !== true) {
            checks.push({
                type: 'no_trace_errors',
                expected: true,
                actual: traceErrors.length === 0,
                passed: traceErrors.length === 0,
                errors: traceErrors.slice(0, 5),
            });
        }
        return {
            checks,
            passed: checks.length ? checks.every((check) => check.passed) : traceErrors.length === 0,
        };
    }
    async replaySimulation(body) {
        const cases = this.parseSimulationCases(body).slice(0, 100);
        if (!cases.length) {
            throw new common_1.HttpException('Informe cases[] ou um transcript com linhas do usuario.', common_1.HttpStatus.BAD_REQUEST);
        }
        const mode = body?.mode === 'isolated' ? 'isolated' : 'conversation';
        const baseConversationId = body?.conversationId || `sim-${Date.now()}`;
        let currentStepId = body?.currentStepId || '';
        let activeFlowId = body?.activeFlowId || body?.flowId || '';
        let slots = this.isPlainObject(body?.slots) ? this.cloneJson(body.slots) : {};
        const startedAt = Date.now();
        const results = [];
        for (let index = 0; index < cases.length; index += 1) {
            const testCase = cases[index] || {};
            const conversationId = mode === 'isolated'
                ? `${baseConversationId}-${index + 1}`
                : baseConversationId;
            const runPayload = {
                ...body,
                text: String(testCase.text || testCase.input || ''),
                conversationId,
                currentStepId: mode === 'conversation' ? currentStepId || undefined : testCase.currentStepId,
                activeFlowId: mode === 'conversation' ? activeFlowId || undefined : testCase.activeFlowId,
                slots: mode === 'conversation'
                    ? { ...slots, ...(this.isPlainObject(testCase.slots) ? testCase.slots : {}) }
                    : { ...(this.isPlainObject(body?.slots) ? body.slots : {}), ...(this.isPlainObject(testCase.slots) ? testCase.slots : {}) },
                approvals: this.isPlainObject(testCase.approvals) ? testCase.approvals : body.approvals,
                skipHistory: true,
                traceMode: body?.traceMode || 'compact',
                traceLimit: this.limitNumber(body?.traceLimit ?? 120, 120, 0, 500),
                traceCollectLimit: this.limitNumber(body?.traceCollectLimit ?? 800, 800, 0, 5000),
            };
            delete runPayload.cases;
            delete runPayload.transcript;
            const runResult = await this.run(runPayload);
            const evaluation = this.evaluateSimulationCase(testCase, runResult);
            if (mode === 'conversation') {
                currentStepId = runResult.currentStepId || '';
                activeFlowId = runResult.activeFlowId || activeFlowId;
                slots = runResult.slots || slots;
            }
            results.push({
                index: index + 1,
                name: String(testCase.name || testCase.title || testCase.id || '').trim(),
                text: runPayload.text,
                conversationId,
                passed: evaluation.passed,
                checks: evaluation.checks,
                messages: runResult.messages || [],
                lastMessage: (runResult.messages || []).slice(-1)[0] || null,
                currentStepId: runResult.currentStepId || '',
                ended: runResult.ended === true,
                slots: runResult.slots || {},
                trace: runResult.trace || [],
            });
        }
        const passed = results.filter((item) => item.passed).length;
        return {
            mode,
            summary: {
                total: results.length,
                passed,
                failed: results.length - passed,
                passRate: results.length ? passed / results.length : 0,
                durationMs: Date.now() - startedAt,
            },
            results,
            finalState: {
                conversationId: baseConversationId,
                currentStepId,
                activeFlowId,
                slots,
            },
            generatedAt: new Date().toISOString(),
        };
    }
    async getTagDashboard(body) {
        const tags = Array.isArray(body?.tags)
            ? body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : String(body?.tags || body?.tag || '')
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
        const filters = {
            organizationId: body?._organizationId || body?.organizationId || '',
            agentId: body?.agentId || '',
            flowId: body?.flowId || '',
            conversationId: body?.conversationId || '',
            tag: tags.length === 1 ? tags[0] : '',
            tags,
            dateFrom: body?.dateFrom || '',
            dateTo: body?.dateTo || '',
            limit: body?.limit || 100,
        };
        const historyPage = Math.max(1, Math.floor(Number(body?.historyPage || 1)));
        const historyLimit = Math.max(1, Math.min(Number(body?.historyLimit || 50), 500));
        const dashboard = await this.flowTagService.dashboard(filters);
        const shouldScopeHistoryByTags = tags.length > 0 && !filters.conversationId;
        const scopedConversationIds = shouldScopeHistoryByTags ? dashboard.conversationIds : undefined;
        const history = shouldScopeHistoryByTags && !dashboard.conversationIds?.length
            ? { items: [], total: 0, page: historyPage, limit: historyLimit, skip: (historyPage - 1) * historyLimit, totalPages: 0 }
            : await this.memoryService.findHistory({
                organizationId: filters.organizationId,
                agentId: filters.agentId,
                flowId: filters.flowId,
                conversationId: filters.conversationId,
                conversationIds: scopedConversationIds,
                metadataKind: 'message',
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                limit: historyLimit,
                page: historyPage,
            });
        const [insights, traceRows] = await Promise.all([
            this.memoryService.getMessageInsights({
                organizationId: filters.organizationId,
                agentId: filters.agentId,
                flowId: filters.flowId,
                conversationId: filters.conversationId,
                conversationIds: scopedConversationIds,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
            }),
            this.memoryService.findTraceHistory({
                organizationId: filters.organizationId,
                agentId: filters.agentId,
                flowId: filters.flowId,
                conversationId: filters.conversationId,
                conversationIds: scopedConversationIds,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                limit: 500,
            }),
        ]);
        return {
            ...dashboard,
            history: history.items,
            historyPagination: {
                page: history.page,
                limit: history.limit,
                total: history.total,
                totalPages: history.totalPages,
            },
            insights,
            traceInsights: this.buildTraceDashboardFromHistory(traceRows),
        };
    }
    summarizeFlowCapabilities(flows) {
        const summary = {
            totalNodes: 0,
            approvalGates: 0,
            mcpNodes: 0,
            exposedMcpTools: 0,
            ragNodes: 0,
            cronNodes: 0,
            webhookNodes: 0,
            whatsappFlows: 0,
            dashboards: 0,
            flowToMcpEndpointReady: false,
        };
        const byFlow = (flows || []).map((flow) => {
            const steps = Array.isArray(flow?.config?.steps) ? flow.config.steps : [];
            const counts = steps.reduce((acc, step) => {
                const type = step?.component?.type || step?.type || '';
                if (type === 'approval')
                    acc.approvalGates += 1;
                if (type === 'mcp')
                    acc.mcpNodes += 1;
                if (['rag', 'milvus', 'azureSearch', 'azureBlob', 'files'].includes(type))
                    acc.ragNodes += 1;
                if (type === 'cron')
                    acc.cronNodes += 1;
                if (type === 'webhook')
                    acc.webhookNodes += 1;
                if (type === 'dashboard')
                    acc.dashboards += 1;
                if (step?.richMessage?.type === 'appointmentFlow')
                    acc.whatsappFlows += 1;
                return acc;
            }, {
                approvalGates: 0,
                mcpNodes: 0,
                ragNodes: 0,
                cronNodes: 0,
                webhookNodes: 0,
                whatsappFlows: 0,
                dashboards: 0,
            });
            summary.totalNodes += steps.length;
            summary.approvalGates += counts.approvalGates;
            summary.mcpNodes += counts.mcpNodes;
            summary.ragNodes += counts.ragNodes;
            summary.cronNodes += counts.cronNodes;
            summary.webhookNodes += counts.webhookNodes;
            summary.whatsappFlows += counts.whatsappFlows;
            summary.dashboards += counts.dashboards;
            summary.exposedMcpTools += steps.length ? 1 : 0;
            return {
                flowId: String(flow?._id || ''),
                name: flow?.name || flow?.config?.title || '',
                nodeCount: steps.length,
                mcpToolName: steps.length ? this.mcpToolNameForFlow(flow) : '',
                ...counts,
            };
        });
        summary.flowToMcpEndpointReady = summary.exposedMcpTools > 0;
        return { summary, byFlow };
    }
    async getAgentOpsDashboard(body) {
        const filters = {
            organizationId: body?._organizationId || body?.organizationId || '',
            agentId: body?.agentId || '',
            flowId: body?.flowId || '',
            conversationId: body?.conversationId || '',
            dateFrom: body?.dateFrom || '',
            dateTo: body?.dateTo || '',
        };
        const defaultHistoryLimit = this.limitNumber(this.configService.get('CANVAS_FLOW_AGENTOPS_HISTORY_LIMIT') || 80, 80, 1, 500);
        const defaultTraceLimit = this.limitNumber(this.configService.get('CANVAS_FLOW_AGENTOPS_TRACE_LIMIT') || 600, 600, 1, 5000);
        const [history, insights, traceRows, queueHealth, flows, releases] = await Promise.all([
            this.memoryService.findHistory({
                ...filters,
                metadataKind: 'message',
                limit: Math.max(1, Math.min(Number(body?.historyLimit || defaultHistoryLimit), 500)),
                page: 1,
            }),
            this.memoryService.getMessageInsights(filters),
            this.memoryService.findTraceHistory({
                ...filters,
                limit: Math.max(1, Math.min(Number(body?.traceLimit || defaultTraceLimit), 5000)),
            }),
            this.sqsTransitionService.getQueueHealth().catch((error) => ({
                ok: false,
                error: this.getErrorMessage(error),
            })),
            this.canvasFlowService.findAll(filters.agentId, filters.organizationId, { includeConfig: true }).catch(() => []),
            filters.agentId
                ? this.canvasFlowService.getAgentReleases(filters.agentId, { organizationId: filters.organizationId }).catch(() => null)
                : Promise.resolve(null),
        ]);
        const traceInsights = this.buildTraceDashboardFromHistory(traceRows);
        const capabilityReport = this.summarizeFlowCapabilities(flows || []);
        const messages = Array.isArray(history.items) ? history.items : [];
        const totalMessageChars = messages.reduce((sum, item) => sum + String(item?.content || '').length, 0);
        const estimatedTokens = Math.ceil(totalMessageChars / 4);
        const llmCallTypes = new Set(['rag', 'openaiGen', 'azureOpenAI', 'messageLlm', 'conditionLlm', 'inputValidationLlm', 'mcp', 'files']);
        const llmCalls = (traceInsights.calls || [])
            .filter((item) => llmCallTypes.has(String(item.key || item.type || '')))
            .reduce((sum, item) => sum + Number(item.count || 0), 0);
        const totalRuns = Number(traceInsights.summary?.runs || 0);
        const errorCount = Number(traceInsights.summary?.errorCount || 0);
        const avgDurationMs = (traceInsights.byStep || []).length
            ? Math.round((traceInsights.byStep || []).reduce((sum, item) => sum + Number(item.avgDurationMs || 0), 0) / (traceInsights.byStep || []).length)
            : 0;
        const flowReleaseRows = (flows || []).map((flow) => ({
            flowId: String(flow._id || ''),
            name: flow.name || flow.config?.title || '',
            activeVersion: flow.activeVersion,
            latestVersion: flow.latestVersion,
            isMainFlow: flow.config?.isMainFlow === true,
            channel: flow.config?.channel || '',
        }));
        const readinessWarnings = [
            !(flows || []).length ? 'Nenhum fluxo encontrado para este agente.' : '',
            totalRuns > 0 && errorCount / totalRuns > 0.1
                ? 'A taxa de erro por execucao esta acima de 10%.'
                : '',
            !releases?.activeRelease && flowReleaseRows.some((flow) => flow.latestVersion)
                ? 'Ha versoes de fluxo, mas nenhum pacote ativo do agente.'
                : '',
            capabilityReport.summary.mcpNodes > 0 && capabilityReport.summary.approvalGates === 0
                ? 'Ha ferramentas/acoes MCP sem nenhum gate de aprovacao humana no agente.'
                : '',
            capabilityReport.summary.flowToMcpEndpointReady
                ? ''
                : 'Nenhum fluxo pronto para exposicao como ferramenta MCP.'
        ].filter(Boolean);
        return {
            filters,
            summary: {
                conversations: insights.summary?.conversations || 0,
                messages: insights.summary?.totalMessages || 0,
                userMessages: insights.summary?.userMessages || 0,
                assistantMessages: insights.summary?.assistantMessages || 0,
                runs: totalRuns,
                errorCount,
                errorRate: totalRuns ? errorCount / totalRuns : 0,
                avgDurationMs,
                llmCalls,
                estimatedTokens,
                estimatedTokenSource: 'history_characters',
            },
            queue: queueHealth,
            insights,
            traceInsights,
            errors: traceInsights.errors || [],
            hotNodes: traceInsights.byStep || [],
            releases: releases || { agentId: filters.agentId, activeRelease: undefined, latestRelease: 0, releases: [] },
            flows: flowReleaseRows,
            capabilities: capabilityReport.summary,
            capabilityByFlow: capabilityReport.byFlow,
            readiness: {
                status: readinessWarnings.length ? 'attention' : 'ok',
                warnings: readinessWarnings,
            },
            history: messages,
            generatedAt: new Date().toISOString(),
        };
    }
    incrementMetric(map, key, patch = {}) {
        const normalizedKey = String(key || 'sem_identificacao').trim() || 'sem_identificacao';
        const current = map.get(normalizedKey) || { key: normalizedKey, count: 0 };
        current.count += 1;
        Object.entries(patch).forEach(([field, value]) => {
            if (typeof value === 'number') {
                current[field] = Number(current[field] || 0) + value;
            }
            else if (value !== undefined && value !== null && value !== '') {
                current[field] = value;
            }
        });
        map.set(normalizedKey, current);
    }
    traceErrorMessage(item) {
        const type = String(item?.type || '').toLowerCase();
        const error = item?.error || item?.message || item?.result?.error || item?.result?.warning;
        if (type.includes('error') || error)
            return String(error || item?.type || 'erro');
        return '';
    }
    compactTraceForHistory(trace) {
        const byType = new Map();
        const byStep = new Map();
        const calls = new Map();
        const errors = [];
        const callTypes = new Set([
            'api',
            'apiLlmGeneration',
            'webhookOutbound',
            'mongodb',
            'mcp',
            'rag',
            'openaiGen',
            'azureOpenAI',
            'azureSearch',
            'azureBlob',
            'files',
            'milvus',
            'flowRouter',
        ]);
        (trace || []).forEach((item) => {
            const type = String(item?.type || 'trace');
            const stepId = String(item?.stepId || item?.routedByStepId || '').trim();
            this.incrementMetric(byType, type);
            if (stepId) {
                this.incrementMetric(byStep, stepId, {
                    title: item?.title || item?.stepTitle || stepId,
                    stepType: item?.stepType || item?.componentType || item?.type,
                    durationMs: Number(item?.durationMs || 0),
                });
            }
            if (callTypes.has(type)) {
                this.incrementMetric(calls, type, {
                    durationMs: Number(item?.durationMs || 0),
                });
            }
            const errorMessage = this.traceErrorMessage(item);
            if (errorMessage) {
                errors.push({
                    type,
                    stepId,
                    message: this.limitText(errorMessage, 300, 'Erro'),
                    at: item?.createdAt || item?.time || '',
                });
            }
        });
        const byStepRows = Array.from(byStep.values())
            .map((item) => ({
            ...item,
            avgDurationMs: item.count ? Math.round(Number(item.durationMs || 0) / item.count) : 0,
        }))
            .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
            .slice(0, 50);
        return {
            totalEvents: Array.isArray(trace) ? trace.length : 0,
            errorCount: errors.length,
            byType: Array.from(byType.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 50),
            byStep: byStepRows,
            calls: Array.from(calls.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 50),
            errors: errors.slice(0, 50),
        };
    }
    buildTraceDashboardFromHistory(rows) {
        const byType = new Map();
        const byStep = new Map();
        const calls = new Map();
        const errors = [];
        let totalEvents = 0;
        let runs = 0;
        (rows || []).forEach((row) => {
            const summary = row?.metadata?.traceSummary || {};
            runs += 1;
            totalEvents += Number(summary.totalEvents || 0);
            (summary.byType || []).forEach((item) => this.incrementMetric(byType, item.key || item.type, { count: Number(item.count || 0) - 1 }));
            (summary.byStep || []).forEach((item) => this.incrementMetric(byStep, item.key || item.stepId, {
                count: Number(item.count || 0) - 1,
                title: item.title,
                stepType: item.stepType,
                durationMs: Number(item.durationMs || 0),
            }));
            (summary.calls || []).forEach((item) => this.incrementMetric(calls, item.key || item.type, {
                count: Number(item.count || 0) - 1,
                durationMs: Number(item.durationMs || 0),
            }));
            (summary.errors || []).forEach((error) => {
                errors.push({
                    ...error,
                    conversationId: row.conversationId,
                    createdAt: row.createdAt,
                });
            });
        });
        return {
            summary: {
                runs,
                totalEvents,
                errorCount: errors.length,
                nodesTouched: byStep.size,
                callTypes: calls.size,
            },
            byType: Array.from(byType.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 50),
            byStep: Array.from(byStep.values())
                .map((item) => ({
                ...item,
                avgDurationMs: item.count ? Math.round(Number(item.durationMs || 0) / item.count) : 0,
            }))
                .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
                .slice(0, 50),
            calls: Array.from(calls.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 50),
            errors: errors.slice(0, 100),
        };
    }
    extractMessageTextFromObject(value) {
        if (!value)
            return '';
        if (typeof value === 'string')
            return value;
        return String(value.selectedOption?.value ||
            value.selectedOption?.text ||
            value.selectedOption ||
            value.id ||
            value.text ||
            value.value ||
            value.title ||
            value.postback_data ||
            value.label ||
            '');
    }
    getAppointmentAttachmentFields(config) {
        return (config?.steps || [])
            .flatMap((step) => step.richMessage?.appointmentFlow?.attachmentSteps || [])
            .slice(0, 12)
            .map((step, index) => {
            const id = this.normalizeAttachmentStepId(step?.id, index);
            return {
                id,
                name: `attachment_${id}`,
                label: step?.label || `Anexo ${index + 1}`,
                type: step?.type === 'document' ? 'document' : 'image',
            };
        });
    }
    async resolveMetaMediaUrl(mediaId, config) {
        const id = String(mediaId || '').trim();
        const accessToken = String(config?.whatsapp?.accessToken || '').trim();
        if (!id || !accessToken)
            return null;
        const graphApiVersion = config?.whatsapp?.graphApiVersion || 'v20.0';
        const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            return null;
        return {
            id,
            url: body?.url || '',
            mimeType: body?.mime_type || body?.mimeType || '',
            sha256: body?.sha256 || '',
            fileSize: body?.file_size || body?.fileSize || undefined,
            fileName: body?.file_name || body?.fileName || '',
        };
    }
    withWhatsappMediaProxy(file, flowId) {
        const mediaId = String(file?.id || file?.media_id || file?.mediaId || '').trim();
        const proxyUrl = this.buildWhatsappMediaProxyUrl(flowId, mediaId);
        if (!proxyUrl)
            return file;
        const metaUrl = file?.metaUrl || file?.url || '';
        return {
            ...file,
            metaUrl,
            proxyUrl,
            downloadUrl: proxyUrl,
            url: proxyUrl,
        };
    }
    async normalizeFlowAttachmentFiles(value, config, flowId) {
        const list = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
        const files = [];
        for (const item of list) {
            if (typeof item === 'string') {
                if (/^(https?:|data:)\/?/i.test(item)) {
                    files.push({ url: item });
                    continue;
                }
                if (/^[A-Za-z0-9+/=]{120,}$/.test(item)) {
                    files.push({ url: `data:image/jpeg;base64,${item}`, base64: true });
                    continue;
                }
                const resolved = await this.resolveMetaMediaUrl(item, config).catch(() => null);
                files.push(this.withWhatsappMediaProxy(resolved || { id: item }, flowId));
                continue;
            }
            if (this.isPlainObject(item)) {
                const base64 = item.base64 || item.data || item.content;
                const mediaId = String(item.media_id || item.mediaId || item.id || '').trim();
                const resolved = !item.url && mediaId ? await this.resolveMetaMediaUrl(mediaId, config).catch(() => null) : null;
                files.push(this.withWhatsappMediaProxy({
                    ...item,
                    ...(resolved || {}),
                    metaUrl: resolved?.url || item.metaUrl || item.url || '',
                    url: item.url || resolved?.url || item.cdn_url || item.cdnUrl || (typeof base64 === 'string' && /^[A-Za-z0-9+/=]{120,}$/.test(base64) ? `data:image/jpeg;base64,${base64}` : ''),
                }, flowId));
            }
        }
        return files;
    }
    async enrichFlowReplyDataWithAttachmentUrls(data, config, flowId) {
        if (!this.isPlainObject(data))
            return data;
        const fields = this.getAppointmentAttachmentFields(config);
        if (!fields.length)
            return data;
        const enriched = { ...data };
        const attachments = [];
        for (const field of fields) {
            const files = await this.normalizeFlowAttachmentFiles(enriched[field.name], config, flowId);
            if (!files.length)
                continue;
            enriched[field.name] = files;
            enriched[`${field.name}_urls`] = files.map((file) => file.url).filter(Boolean);
            enriched[`${field.name}_download_urls`] = files.map((file) => file.downloadUrl || file.url).filter(Boolean);
            enriched[`${field.name}_meta_urls`] = files.map((file) => file.metaUrl).filter(Boolean);
            attachments.push({
                id: field.id,
                name: field.name,
                label: field.label,
                type: field.type,
                files,
                urls: files.map((file) => file.url).filter(Boolean),
                downloadUrls: files.map((file) => file.downloadUrl || file.url).filter(Boolean),
                metaUrls: files.map((file) => file.metaUrl).filter(Boolean),
            });
        }
        if (attachments.length)
            enriched.attachments = attachments;
        return enriched;
    }
    async extractFlowReplyData(message, config, flowId) {
        const flowReply = message?.interactive?.nfm_reply;
        const raw = flowReply?.response_json || flowReply?.responseJson || flowReply?.body || '';
        const parsed = this.parsePossibleJsonValue(raw);
        return this.isPlainObject(parsed) ? await this.enrichFlowReplyDataWithAttachmentUrls(parsed, config, flowId) : undefined;
    }
    async extractMetaWhatsappMessages(payload, config, flowId) {
        const messages = [];
        for (const entry of payload?.entry || []) {
            for (const change of entry?.changes || []) {
                const value = change?.value || {};
                for (const message of value?.messages || []) {
                    const flowReplyData = await this.extractFlowReplyData(message, config, flowId);
                    const text = message?.text?.body ||
                        message?.button?.payload ||
                        message?.button?.text ||
                        message?.interactive?.button_reply?.id ||
                        message?.interactive?.button_reply?.title ||
                        message?.interactive?.list_reply?.id ||
                        message?.interactive?.list_reply?.title ||
                        (flowReplyData ? JSON.stringify(flowReplyData) : '') ||
                        message?.interactive?.nfm_reply?.body ||
                        '';
                    if (!text)
                        continue;
                    messages.push({
                        provider: 'meta',
                        from: message.from,
                        text,
                        slots: flowReplyData ? { whatsappFlow: flowReplyData } : undefined,
                        messageId: message.id,
                        timestamp: message.timestamp,
                        phoneNumberId: value?.metadata?.phone_number_id,
                        displayPhoneNumber: value?.metadata?.display_phone_number,
                        raw: message,
                    });
                }
            }
        }
        return messages;
    }
    extractBlipWhatsappMessages(payload) {
        const raw = payload?.message || payload?.resource || payload;
        const source = Array.isArray(payload?.messages) ? payload.messages : [raw];
        return source
            .map((message) => {
            const text = this.extractMessageTextFromObject(message?.content);
            if (!text || !message?.from)
                return null;
            return {
                provider: 'blip',
                from: message.from,
                text,
                messageId: message.id,
                timestamp: message.date || message.timestamp,
                raw: message,
            };
        })
            .filter(Boolean);
    }
    extractSinchWhatsappMessages(payload) {
        const source = payload?.message_inbound || payload?.messageInbound || payload?.event?.message_inbound || payload;
        const message = source?.message || source;
        const text = message?.text_message?.text ||
            message?.choice_response_message?.postback_data ||
            message?.choice_response_message?.message_id ||
            this.extractMessageTextFromObject(message?.contact_message);
        const identity = source?.channel_identity?.identity || message?.channel_identity?.identity || source?.identity;
        const contactId = source?.contact_id || source?.contactId || message?.contact_id;
        const from = identity || contactId;
        if (!text || !from)
            return [];
        return [{
                provider: 'sinch',
                from,
                text,
                messageId: source?.message_id || source?.messageId || message?.id,
                timestamp: source?.accept_time || source?.event_time || source?.timestamp,
                sinchContactId: contactId,
                sinchIdentity: identity,
                raw: source,
            }];
    }
    async extractWhatsappMessages(payload, config, flowId) {
        const provider = this.normalizeWhatsappProvider(config);
        if (provider === 'blip')
            return this.extractBlipWhatsappMessages(payload);
        if (provider === 'sinch')
            return this.extractSinchWhatsappMessages(payload);
        return await this.extractMetaWhatsappMessages(payload, config, flowId);
    }
    getAssistantText(messages) {
        return messages
            .filter((message) => message.role === 'assistant' && message.text)
            .map((message) => message.content ? this.getRichMessageText(message.content) : message.text)
            .join('\n\n')
            .trim();
    }
    whatsappDeliveryKey(message) {
        return JSON.stringify({
            role: message.role,
            kind: message.kind || '',
            text: message.text || '',
            content: message.content || null,
        });
    }
    buildWhatsappDedupeKey(flowRecord, message) {
        const providerMessageId = String(message?.messageId || '').trim();
        if (!providerMessageId)
            return '';
        return [
            flowRecord?.organizationId || 'global',
            flowRecord?.agentId || 'default-agent',
            flowRecord?._id || 'flow',
            message?.provider || 'whatsapp',
            providerMessageId,
        ].join(':');
    }
    async getCanvasFlowState(agentId, conversationId, entryFlowId, options) {
        const turns = await this.memoryService.findRecent(agentId, conversationId, 30, {
            organizationId: options?.organizationId,
            metadataKind: 'canvas_flow_state',
            conversationOwnerId: options?.conversationOwnerId,
        });
        for (const turn of [...turns].reverse()) {
            const state = turn?.metadata?.canvasFlowState;
            if (options?.conversationOwnerId && state?.conversationOwnerId && state.conversationOwnerId !== options.conversationOwnerId) {
                continue;
            }
            if (state && (!entryFlowId || state.entryFlowId === entryFlowId)) {
                return state;
            }
        }
        return null;
    }
    compactSlotsForState(slots) {
        const clone = this.cloneJson(slots || {});
        delete clone.debug;
        delete clone.dashboard;
        const json = JSON.stringify(clone);
        if (json.length <= 60000)
            return clone;
        return {
            agentId: clone.agentId,
            channel: clone.channel,
            conversationId: clone.conversationId,
            flowId: clone.flowId,
            entryFlowId: clone.entryFlowId,
            activeFlowId: clone.activeFlowId,
            userInput: clone.userInput,
            phone: clone.phone,
            whatsapp: clone.whatsapp,
        };
    }
    async saveCanvasFlowState(params) {
        await this.memoryService.addTurn({
            agentId: params.agentId,
            conversationId: params.conversationId,
            role: 'system',
            content: 'canvas_flow_state',
            metadata: {
                organizationId: params.organizationId,
                kind: 'canvas_flow_state',
                conversationOwnerId: params.conversationOwnerId,
                canvasFlowState: {
                    entryFlowId: params.entryFlowId,
                    activeFlowId: params.activeFlowId,
                    currentStepId: params.currentStepId || '',
                    slots: this.compactSlotsForState(params.slots),
                    conversationOwnerId: params.conversationOwnerId || '',
                    langGraphThreadId: params.langGraphThreadId || '',
                    updatedAt: new Date().toISOString(),
                },
            },
        });
    }
    async postWhatsappPayload(config, payload) {
        const provider = this.normalizeWhatsappProvider(config);
        if (provider === 'blip')
            return await this.postBlipPayload(config, payload);
        if (provider === 'sinch')
            return await this.postSinchPayload(config, payload);
        const whatsapp = config.whatsapp || {};
        const phoneNumberId = whatsapp.phoneNumberId;
        const accessToken = whatsapp.accessToken;
        if (!phoneNumberId || !accessToken) {
            return { skipped: true };
        }
        const graphApiVersion = whatsapp.graphApiVersion || 'v20.0';
        const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            (0, observability_1.logEvent)('error', 'whatsapp.send.failed', {
                provider,
                status: response.status,
                body,
                payloadType: payload?.type,
                interactiveType: payload?.interactive?.type,
                flowId: payload?.interactive?.action?.parameters?.flow_id,
            });
        }
        return {
            ok: response.ok,
            status: response.status,
            body,
        };
    }
    flowInteractiveToListInteractive(interactive) {
        if (interactive?.type !== 'flow')
            return interactive;
        const parameters = interactive?.action?.parameters || {};
        const data = parameters?.flow_action_payload?.data || {};
        const stage = this.normalizeAppointmentStage(data.stage || data.activeStage || data.active_stage || 'actions');
        const source = data.activeOptions ||
            data.active_options ||
            data[stage] ||
            data.actions ||
            data.providers ||
            data.services ||
            data.dates ||
            data.times ||
            data.items ||
            data.exams ||
            data.appointments ||
            [];
        const rows = this.normalizeAppointmentOptions(source, 'flow', WHATSAPP_LIMITS.listRows);
        return {
            type: 'list',
            body: interactive.body,
            footer: interactive.footer,
            action: {
                button: this.limitText(parameters.flow_cta, WHATSAPP_LIMITS.listButton, 'Ver opcoes'),
                sections: rows.length
                    ? [
                        {
                            title: this.appointmentStageTitle(stage),
                            rows: rows.map((row) => ({
                                id: row.id,
                                title: row.title,
                                ...(row.description ? { description: row.description } : {}),
                            })),
                        },
                    ]
                    : [],
            },
        };
    }
    metaPayloadToText(payload) {
        if (payload?.type === 'text')
            return String(payload?.text?.body || '');
        if (payload?.type === 'image')
            return [payload?.image?.caption, payload?.image?.link].filter(Boolean).join('\n');
        if (payload?.type === 'document')
            return [payload?.document?.caption, payload?.document?.link].filter(Boolean).join('\n');
        const interactive = this.flowInteractiveToListInteractive(payload?.interactive);
        if (interactive?.type === 'button') {
            const options = (interactive?.action?.buttons || [])
                .map((button, index) => `${index + 1}. ${button?.reply?.title || button?.title || `Opcao ${index + 1}`}`)
                .join('\n');
            return [interactive?.body?.text, options].filter(Boolean).join('\n');
        }
        if (interactive?.type === 'list') {
            const rows = (interactive?.action?.sections || [])
                .flatMap((section) => section?.rows || [])
                .map((row, index) => `${index + 1}. ${row?.title || `Item ${index + 1}`}`)
                .join('\n');
            return [interactive?.body?.text, rows].filter(Boolean).join('\n');
        }
        return '';
    }
    buildBlipPayload(to, payload) {
        const interactive = this.flowInteractiveToListInteractive(payload?.interactive);
        if (payload?.type === 'image' && payload?.image?.link) {
            return {
                id: (0, crypto_1.randomUUID)(),
                to,
                type: 'application/vnd.lime.media-link+json',
                content: {
                    uri: payload.image.link,
                    title: payload.image.caption || 'Imagem',
                    text: payload.image.caption || '',
                    type: 'image/jpeg',
                },
            };
        }
        if (payload?.type === 'document' && payload?.document?.link) {
            return {
                id: (0, crypto_1.randomUUID)(),
                to,
                type: 'application/vnd.lime.media-link+json',
                content: {
                    uri: payload.document.link,
                    title: payload.document.filename || 'arquivo.pdf',
                    text: payload.document.caption || payload.document.filename || 'Arquivo',
                    type: 'application/pdf',
                },
            };
        }
        if (interactive?.type === 'button' || interactive?.type === 'list') {
            const buttonOptions = (interactive?.action?.buttons || []).map((button, index) => ({
                text: button?.reply?.title || `Opcao ${index + 1}`,
                value: button?.reply?.id || button?.reply?.title || `option_${index + 1}`,
            }));
            const listOptions = (interactive?.action?.sections || []).flatMap((section) => (section?.rows || []).map((row, index) => ({
                text: row?.title || `Item ${index + 1}`,
                value: row?.id || row?.title || `item_${index + 1}`,
                ...(row?.description ? { description: row.description } : {}),
            })));
            const options = interactive.type === 'list' ? listOptions : buttonOptions;
            if (!options.length) {
                return {
                    id: (0, crypto_1.randomUUID)(),
                    to,
                    type: 'text/plain',
                    content: this.metaPayloadToText({ ...payload, interactive }) || ' ',
                };
            }
            return {
                id: (0, crypto_1.randomUUID)(),
                to,
                type: 'application/vnd.lime.select+json',
                content: {
                    text: interactive?.body?.text || 'Escolha uma opcao:',
                    options,
                },
            };
        }
        const text = this.metaPayloadToText(payload);
        return {
            id: (0, crypto_1.randomUUID)(),
            to,
            type: 'text/plain',
            content: text || ' ',
        };
    }
    async postBlipPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        const contractId = String(whatsapp.blipContractId || '').trim();
        const authorizationKey = String(whatsapp.blipAuthorizationKey || '').trim();
        if (!contractId || !authorizationKey || !payload?.to) {
            return { skipped: true, provider: 'blip' };
        }
        const authorization = authorizationKey.toLowerCase().startsWith('key ') ? authorizationKey : `Key ${authorizationKey}`;
        const blipPayload = this.buildBlipPayload(payload.to, payload);
        const response = await fetch(`https://${contractId}.http.msging.net/messages`, {
            method: 'POST',
            headers: {
                Authorization: authorization,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(blipPayload),
        });
        const body = await response.json().catch(() => ({}));
        return {
            provider: 'blip',
            ok: response.ok,
            status: response.status,
            body,
        };
    }
    buildSinchRelayMessage(payload) {
        if (payload?.type === 'text') {
            return { messageText: payload?.text?.body || ' ' };
        }
        if (payload?.type === 'image' && payload?.image?.link) {
            return {
                image: {
                    type: this.mediaTypeFromUrlOrMime('', payload.image.link, 'PNG'),
                    url: payload.image.link,
                    caption: payload.image.caption || '',
                },
            };
        }
        if (payload?.type === 'document') {
            return {
                document: {
                    type: this.mediaTypeFromUrlOrMime('', payload?.document?.filename || payload?.document?.link, 'PDF'),
                    url: payload?.document?.link,
                    caption: payload?.document?.caption || payload?.document?.filename || 'Arquivo',
                },
            };
        }
        const interactive = this.flowInteractiveToListInteractive(payload?.interactive);
        if (interactive?.type === 'button') {
            return {
                interactive: {
                    messageInteractiveType: 'REPLY_BUTTON',
                    body: { text: interactive?.body?.text || 'Escolha uma opcao:' },
                    ...(interactive?.footer?.text ? { footer: { text: interactive.footer.text } } : {}),
                    replyButtonAction: {
                        buttons: (interactive?.action?.buttons || []).map((button, index) => ({
                            reply: {
                                title: button?.reply?.title || `Opcao ${index + 1}`,
                                payload: button?.reply?.id || `option_${index + 1}`,
                            },
                        })),
                    },
                },
            };
        }
        if (interactive?.type === 'list') {
            return {
                interactive: {
                    messageInteractiveType: 'LIST',
                    body: { text: interactive?.body?.text || 'Escolha uma opcao:' },
                    ...(interactive?.footer?.text ? { footer: { text: interactive.footer.text } } : {}),
                    listAction: {
                        button: interactive?.action?.button || 'Ver opcoes',
                        sections: (interactive?.action?.sections || []).map((section) => ({
                            ...(section?.title ? { title: section.title } : {}),
                            rows: (section?.rows || []).map((row, index) => ({
                                identifier: row?.id || `item_${index + 1}`,
                                title: row?.title || `Item ${index + 1}`,
                                ...(row?.description ? { description: row.description } : {}),
                            })),
                        })),
                    },
                },
            };
        }
        return { messageText: this.metaPayloadToText(payload) || ' ' };
    }
    getSinchRelayApiUrl() {
        return String(process.env.SINCH_API_URL ||
            process.env.CANVAS_FLOW_SINCH_API_URL ||
            'https://api-messaging.wavy.global/v1/whatsapp/send').trim();
    }
    buildSinchRelayPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        const legacyWhatsapp = whatsapp;
        const serviceNumber = String(whatsapp.sinchServiceNumber || legacyWhatsapp.sinchBrokerNumber || '').trim();
        const serviceUsername = String(whatsapp.sinchServiceUsername || legacyWhatsapp.sinchBrokerUsername || legacyWhatsapp.sinchBrokerNumber || '').trim();
        const serviceToken = String(whatsapp.sinchServiceToken || legacyWhatsapp.sinchBrokerToken || '').trim();
        return {
            provider: 'sinch',
            mode: 'relay',
            api: 'sinch',
            method: 'POST',
            url: this.getSinchRelayApiUrl() || '<SINCH_API_URL>',
            headers: {
                username: serviceUsername || '<SINCH_SERVICE_USERNAME>',
                authenticationtoken: serviceToken ? '<configured>' : '<SINCH_SERVICE_TOKEN>',
                'Content-Type': 'application/json',
            },
            serviceUser: {
                number: serviceNumber || '<SINCH_NUMBER>',
                username: serviceUsername || '<SINCH_SERVICE_USERNAME>',
                tokenConfigured: Boolean(serviceToken),
            },
            body: {
                destinations: [{ destination: payload.to }],
                message: this.buildSinchRelayMessage(payload),
            },
        };
    }
    buildSinchConversationBody(config, payload) {
        const whatsapp = config.whatsapp || {};
        const channel = String(whatsapp.sinchChannel || 'WHATSAPP').trim().toUpperCase();
        const base = {
            app_id: whatsapp.sinchAppId || '<SINCH_APP_ID>',
            recipient: {
                identified_by: {
                    channel_identities: [{ channel, identity: payload.to }],
                },
            },
        };
        if (payload?.type === 'document' && payload?.document?.link) {
            return {
                ...base,
                message: {
                    media_message: {
                        url: payload.document.link,
                        ...(payload.document.caption ? { caption: payload.document.caption } : {}),
                    },
                },
            };
        }
        if (payload?.type === 'image' && payload?.image?.link) {
            return {
                ...base,
                message: {
                    media_message: {
                        url: payload.image.link,
                        ...(payload.image.caption ? { caption: payload.image.caption } : {}),
                    },
                },
            };
        }
        const interactive = this.flowInteractiveToListInteractive(payload?.interactive);
        if (interactive?.type === 'button' || interactive?.type === 'list') {
            const buttonChoices = (interactive?.action?.buttons || []).map((button, index) => ({
                text_message: { text: button?.reply?.title || `Opcao ${index + 1}` },
                postback_data: button?.reply?.id || `option_${index + 1}`,
            }));
            const listChoices = (interactive?.action?.sections || []).flatMap((section) => (section?.rows || []).map((row, index) => ({
                text_message: { text: row?.title || `Item ${index + 1}` },
                postback_data: row?.id || `item_${index + 1}`,
            })));
            const choices = interactive.type === 'list' ? listChoices : buttonChoices;
            return {
                ...base,
                message: {
                    choice_message: {
                        text_message: { text: interactive?.body?.text || 'Escolha uma opcao:' },
                        choices,
                    },
                },
            };
        }
        return {
            ...base,
            message: {
                text_message: { text: this.metaPayloadToText(payload) || ' ' },
            },
        };
    }
    buildSinchConversationPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        const projectId = String(whatsapp.sinchProjectId || '').trim() || '<SINCH_PROJECT_ID>';
        const region = String(whatsapp.sinchRegion || 'us').trim().toLowerCase();
        return {
            provider: 'sinch',
            mode: 'conversation',
            method: 'POST',
            url: `https://${region}.conversation.api.sinch.com/v1/projects/${projectId}/messages:send`,
            headers: {
                Authorization: whatsapp.sinchAccessToken ? 'Bearer <configured>' : 'Bearer <SINCH_ACCESS_TOKEN>',
                'Content-Type': 'application/json',
            },
            body: this.buildSinchConversationBody(config, payload),
        };
    }
    buildSinchPayload(config, payload) {
        return this.normalizeSinchApiMode(config) === 'relay'
            ? this.buildSinchRelayPayload(config, payload)
            : this.buildSinchConversationPayload(config, payload);
    }
    async postSinchPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        if (this.normalizeSinchApiMode(config) === 'relay') {
            const legacyWhatsapp = whatsapp;
            const relayUrl = this.getSinchRelayApiUrl();
            const serviceUsername = String(whatsapp.sinchServiceUsername || legacyWhatsapp.sinchBrokerUsername || legacyWhatsapp.sinchBrokerNumber || '').trim();
            const serviceToken = String(whatsapp.sinchServiceToken || legacyWhatsapp.sinchBrokerToken || '').trim();
            const relayPayload = this.buildSinchRelayPayload(config, payload);
            if (!relayUrl || !serviceUsername || !serviceToken || !payload?.to) {
                return {
                    skipped: true,
                    provider: 'sinch',
                    mode: 'relay',
                    reason: !relayUrl ? 'missing_sinch_api_url' : 'missing_sinch_credentials_or_destination',
                    payload: relayPayload,
                };
            }
            const response = await fetch(relayUrl, {
                method: 'POST',
                headers: {
                    username: serviceUsername,
                    authenticationtoken: serviceToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(relayPayload.body),
            });
            const responseBody = await response.clone().json().catch(async () => response.text().catch(() => ''));
            return {
                provider: 'sinch',
                mode: 'relay',
                ok: response.ok,
                status: response.status,
                body: responseBody,
                payload: relayPayload,
            };
        }
        const projectId = String(whatsapp.sinchProjectId || '').trim();
        const accessToken = String(whatsapp.sinchAccessToken || '').trim();
        const region = String(whatsapp.sinchRegion || 'us').trim().toLowerCase();
        if (!projectId || !whatsapp.sinchAppId || !accessToken || !payload?.to) {
            return { skipped: true, provider: 'sinch', mode: 'conversation' };
        }
        const sinchPayload = this.buildSinchConversationPayload(config, payload);
        const response = await fetch(`https://${region}.conversation.api.sinch.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                Authorization: accessToken.toLowerCase().startsWith('bearer ') ? accessToken : `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sinchPayload.body),
        });
        const body = await response.json().catch(() => ({}));
        return {
            provider: 'sinch',
            mode: 'conversation',
            ok: response.ok,
            status: response.status,
            body,
        };
    }
    buildMetaApiPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        const phoneNumberId = whatsapp.phoneNumberId || '<PHONE_NUMBER_ID>';
        const graphApiVersion = whatsapp.graphApiVersion || 'v20.0';
        return {
            provider: 'meta',
            method: 'POST',
            url: `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
            headers: {
                Authorization: whatsapp.accessToken ? 'Bearer <configured>' : 'Bearer <META_ACCESS_TOKEN>',
                'Content-Type': 'application/json',
            },
            body: payload,
        };
    }
    buildBlipApiPayload(config, payload) {
        const whatsapp = config.whatsapp || {};
        return {
            provider: 'blip',
            method: 'POST',
            url: `https://${whatsapp.blipContractId || '<BLIP_CONTRACT_ID>'}.http.msging.net/messages`,
            headers: {
                Authorization: whatsapp.blipAuthorizationKey ? 'Key <configured>' : 'Key <BLIP_AUTHORIZATION_KEY>',
                'Content-Type': 'application/json',
            },
            body: this.buildBlipPayload(payload.to, payload),
        };
    }
    buildProviderApiPayload(config, payload) {
        const provider = this.normalizeWhatsappProvider(config);
        if (provider === 'blip')
            return this.buildBlipApiPayload(config, payload);
        if (provider === 'sinch')
            return this.buildSinchPayload(config, payload);
        return this.buildMetaApiPayload(config, payload);
    }
    buildWhatsappApiResponsePayloads(config, to, message) {
        return this.buildWhatsappPayloads(to, message).map((payload) => this.buildProviderApiPayload(config, payload));
    }
    shouldSendWhatsappAssistantMessage(config, message) {
        if (this.normalizeWhatsappDeliveryMode(config) === 'apiResponse')
            return true;
        if (this.normalizeWhatsappProvider(config) === 'sinch' && (this.hasSinchRelayCredentials(config) || this.hasSinchConversationCredentials(config))) {
            return true;
        }
        if (config?.whatsapp?.autoReply === true)
            return true;
        return Boolean(message.content?.type === 'appointmentFlow' && message.content.appointmentFlow?.flowId);
    }
    async sendWhatsappMessage(config, to, message) {
        const payloads = this.buildWhatsappPayloads(to, message);
        if (this.normalizeWhatsappDeliveryMode(config) === 'apiResponse') {
            const provider = this.normalizeWhatsappProvider(config);
            const responsePayloads = this.buildWhatsappApiResponsePayloads(config, to, message);
            if (provider === 'sinch') {
                const deliveries = [];
                for (const payload of payloads) {
                    deliveries.push(await this.postWhatsappPayload(config, payload));
                }
                return {
                    skipped: false,
                    mode: 'apiResponse',
                    provider,
                    payloads: responsePayloads,
                    deliveries,
                };
            }
            return {
                skipped: true,
                mode: 'apiResponse',
                provider,
                payloads: responsePayloads,
            };
        }
        const deliveries = [];
        for (const payload of payloads) {
            deliveries.push(await this.postWhatsappPayload(config, payload));
        }
        return deliveries;
    }
    async recordStepTags(step, context, trace) {
        const tags = Array.isArray(step.tags) ? step.tags : [];
        if (!tags.length)
            return;
        const results = await Promise.all(tags.map(async (tagConfig, index) => {
            const tag = String(tagConfig?.tag || tagConfig?.label || '').trim();
            if (!tag)
                return { skipped: true, reason: 'empty_tag' };
            const value = tagConfig.valueTemplate !== undefined && tagConfig.valueTemplate !== ''
                ? this.renderTemplate(tagConfig.valueTemplate, context)
                : undefined;
            const metadata = tagConfig.metadataJson !== undefined && tagConfig.metadataJson !== ''
                ? this.parseTemplatedJsonConfig(tagConfig.metadataJson, {}, context)
                : {};
            return await this.flowTagService.record({
                organizationId: context.organizationId,
                agentId: context.agentId,
                flowId: context.flowId,
                flowName: context.flowName,
                entryFlowId: context.entryFlowId,
                activeFlowId: context.slots?.activeFlowId,
                conversationId: context.conversationId,
                channel: context.channel,
                stepId: step.id,
                stepTitle: step.title,
                stepType: step.component?.type || step.type,
                tag,
                label: tagConfig.label || tag,
                mode: tagConfig.mode === 'once' ? 'once' : 'always',
                value,
                metadata: {
                    ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : { value: metadata }),
                    tagConfigId: tagConfig.id || `tag_${index + 1}`,
                },
                input: context.input,
            });
        }));
        trace.push({
            stepId: step.id,
            type: 'tags',
            result: results.map((result) => ({
                tag: result?.tag,
                skipped: result?.skipped,
                duplicate: result?.duplicate,
                id: result?._id,
            })),
        });
    }
    normalizeApprovalText(value) {
        return String(value || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }
    resolveApprovalDecision(step, context) {
        const component = (step.component || {});
        const approvals = context?.slots?.approvals && typeof context.slots.approvals === 'object' && !Array.isArray(context.slots.approvals)
            ? context.slots.approvals
            : {};
        const byStep = approvals[step.id] || approvals[component.responseName || step.responseName || 'approval'];
        const rawDecision = typeof byStep === 'string'
            ? byStep
            : byStep && typeof byStep === 'object'
                ? byStep.decision || byStep.status || byStep.approved
                : undefined;
        if (rawDecision === true || this.normalizeApprovalText(rawDecision) === 'approved' || this.normalizeApprovalText(rawDecision) === 'aprovado')
            return 'approved';
        if (rawDecision === false || this.normalizeApprovalText(rawDecision) === 'rejected' || this.normalizeApprovalText(rawDecision) === 'reprovado')
            return 'rejected';
        const requireExplicitInput = component.approvalRequireExplicitInput !== false;
        const canReadInput = Boolean(context?.input) && (requireExplicitInput
            ? context.inputTargetStepId === step.id
            : true);
        if (!canReadInput)
            return 'pending';
        const input = this.normalizeApprovalText(context.input);
        const approveKeyword = this.normalizeApprovalText(component.approvalKeyword || 'aprovar');
        const rejectKeyword = this.normalizeApprovalText(component.approvalRejectKeyword || 'reprovar');
        if (input && approveKeyword && (input === approveKeyword || input.includes(approveKeyword)))
            return 'approved';
        if (input && rejectKeyword && (input === rejectKeyword || input.includes(rejectKeyword)))
            return 'rejected';
        return 'pending';
    }
    buildApprovalResult(step, context, decision) {
        const component = (step.component || {});
        const scopes = Array.isArray(component.approvalScopes)
            ? component.approvalScopes.map((scope) => String(scope || '').trim()).filter(Boolean)
            : [];
        return {
            decision,
            status: decision,
            approved: decision === 'approved',
            rejected: decision === 'rejected',
            title: component.approvalTitle || step.title || 'Aprovar acao',
            description: this.renderTemplate(component.approvalDescription || step.instruction || 'Revise a acao antes de continuar.', context),
            risk: component.approvalRisk || 'medium',
            scopes,
            approverHint: component.approvalApproverHint || '',
            decidedAt: decision === 'pending' ? '' : new Date().toISOString(),
        };
    }
    async runApprovalComponent(step, config, context, trace, pushMessage) {
        const component = (step.component || {});
        const responseName = component.responseName || step.responseName || 'approval';
        const decision = this.resolveApprovalDecision(step, context);
        const result = this.buildApprovalResult(step, context, decision);
        context.slots[responseName] = result;
        context.slots.approvals = {
            ...(context.slots.approvals || {}),
            [step.id]: result,
            [responseName]: result,
        };
        trace.push({
            stepId: step.id,
            type: decision === 'pending' ? 'approvalPending' : 'approvalDecision',
            result,
        });
        if (decision === 'pending') {
            const approve = component.approvalKeyword || 'aprovar';
            const reject = component.approvalRejectKeyword || 'reprovar';
            pushMessage({
                role: 'assistant',
                kind: 'approval',
                text: [
                    `${result.title}`,
                    result.description,
                    `Risco: ${result.risk}.`,
                    result.scopes.length ? `Escopos: ${result.scopes.join(', ')}.` : '',
                    `Responda "${approve}" para continuar ou "${reject}" para bloquear.`,
                ].filter(Boolean).join('\n'),
                content: {
                    type: 'buttons',
                    text: `${result.title}\n${result.description}`,
                    footer: `Risco: ${result.risk}`,
                    buttons: [
                        { id: 'approve', label: 'Aprovar', value: approve },
                        { id: 'reject', label: 'Reprovar', value: reject },
                    ],
                },
            });
            return { waitingInput: step.id };
        }
        context.__inputConsumedInRun = true;
        pushMessage({
            role: 'assistant',
            text: decision === 'approved'
                ? this.renderTemplate(component.approvalApprovedText || 'Aprovado. Vou continuar.', context)
                : this.renderTemplate(component.approvalRejectedText || 'Reprovado. Nao vou executar a acao.', context),
        });
        if (decision === 'rejected') {
            return { completed: true, outgoing: [] };
        }
        return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
    }
    async runStep(step, config, context, messages, trace, options) {
        let pendingMessageDelayMs = Math.max(0, Math.floor(Number(options?.messageDelayMs || 0)));
        const pushMessage = (message) => {
            const delayBeforeMs = pendingMessageDelayMs;
            pendingMessageDelayMs = 0;
            const emitted = this.emitFlowMessage(messages, message, {
                delayBeforeMs,
                onMessage: options?.deferOnMessage ? undefined : context.__onMessage,
            });
            if (message.role === 'assistant') {
                this.rememberEmittedAssistantText(context, message.text);
            }
            return emitted;
        };
        await this.recordStepTags(step, context, trace).catch((error) => {
            trace.push({ stepId: step.id, type: 'tagsError', message: this.getErrorMessage(error) });
        });
        if (step.type === 'group') {
            const entryTargets = await this.getGroupEntryTargets(step, config, context, trace);
            const outgoing = entryTargets.length ? entryTargets : await this.getGroupExitTargets(step, config, context, trace);
            return { completed: true, outgoing };
        }
        if (step.type === 'input') {
            const responseName = step.responseName || 'input';
            const runtimeContext = context;
            const canConsumeInput = Boolean(runtimeContext.input) && (runtimeContext.__inputConsumedInRun !== true) && (runtimeContext.deferInputUntilCurrentStep !== true ||
                runtimeContext.inputTargetStepId === step.id);
            if (!canConsumeInput) {
                pushMessage({
                    role: 'assistant',
                    text: this.renderTemplate(step.instruction || 'Informe o valor para continuar.', context),
                });
                return { waitingInput: step.id };
            }
            runtimeContext.__inputConsumedInRun = true;
            runtimeContext.__lastConsumedInputStepId = step.id;
            const validation = await this.validateInputValue(step, config, context, runtimeContext.input).catch((error) => ({
                valid: false,
                reason: this.getErrorMessage(error),
                normalizedValue: runtimeContext.input,
            }));
            const reasonSlot = step.inputValidationReasonResponseName || `${responseName}_validation_reason`;
            if (validation.reason)
                context.slots[reasonSlot] = validation.reason;
            if (!validation.valid) {
                const fallbackMessage = validation.reason || 'Valor inválido. Informe novamente.';
                pushMessage({
                    role: 'assistant',
                    text: this.renderTemplate(step.inputValidationErrorMessage || fallbackMessage, context),
                });
                trace.push({
                    stepId: step.id,
                    type: step.inputValidationMode === 'llm' ? 'inputValidationLlm' : 'inputValidation',
                    valid: false,
                    reason: validation.reason || fallbackMessage,
                    raw: validation.raw,
                });
                return { waitingInput: step.id };
            }
            if (validation.slots && typeof validation.slots === 'object') {
                Object.assign(context.slots, validation.slots);
            }
            const normalizedInput = validation.normalizedValue ?? runtimeContext.input;
            this.recordInputHistory(context, step, responseName, normalizedInput);
            context.slots[responseName] = normalizedInput;
            trace.push({
                stepId: step.id,
                type: step.inputValidationMode === 'llm' ? 'inputValidationLlm' : 'inputValidation',
                valid: true,
                reason: validation.reason || '',
                raw: validation.raw,
            });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'message') {
            const outgoing = await this.outgoingTargets(step, config, context, trace);
            const rawInstruction = step.instruction || '';
            let text = this.renderTemplate(rawInstruction, context);
            const isDefaultPassthrough = this.isDefaultPassthroughMessageStep(step);
            const lastAssistantText = this.getLastAssistantText(context);
            if (lastAssistantText && isDefaultPassthrough) {
                text = lastAssistantText;
            }
            if (step.messageUseLlm === true) {
                text = await this.generateMessageTextWithLlm(step, config, context).catch((error) => {
                    trace.push({
                        stepId: step.id,
                        type: 'messageLlmError',
                        message: this.getErrorMessage(error),
                    });
                    return text;
                });
                if (step.responseName) {
                    context.slots[step.responseName] = { text, generatedBy: 'llm' };
                }
                trace.push({ stepId: step.id, type: 'messageLlm', result: { text } });
            }
            this.rememberAssistantText(context, text);
            const lastEmittedAssistantText = this.getLastEmittedAssistantText(context);
            const suppressDuplicatePassthrough = isDefaultPassthrough
                && lastEmittedAssistantText
                && this.normalizeMessageInstruction(lastEmittedAssistantText) === this.normalizeMessageInstruction(text);
            const suppressDefaultAfterUserInput = isDefaultPassthrough
                && context.__inputConsumedInRun === true
                && outgoing.some((target) => this.isUserInteractionWaitStep(config.steps.find((candidate) => candidate.id === target)))
                && this.isDefaultMessageInstruction(text);
            if (suppressDuplicatePassthrough || suppressDefaultAfterUserInput) {
                trace.push({
                    stepId: step.id,
                    type: 'messagePassthroughSuppressed',
                    text: this.limitText(text, 500),
                    reason: suppressDefaultAfterUserInput
                        ? 'Mensagem padrao ignorada depois de uma interacao do usuario; o fluxo deve seguir pela resposta do agente ou aguardar input.'
                        : 'Mensagem padrao duplicaria a ultima resposta ja emitida pelo agente.',
                });
            }
            else {
                pushMessage({ role: 'assistant', text });
            }
            return { completed: true, outgoing };
        }
        if (step.type === 'richMessage') {
            const renderedContent = this.renderTemplate(step.richMessage || {
                type: 'text',
                text: step.instruction || '',
            }, context);
            const content = await this.generateRichMessageContent(renderedContent, config, context).catch((error) => {
                trace.push({
                    stepId: step.id,
                    type: 'richMessageGenerationError',
                    message: this.getErrorMessage(error),
                });
                return renderedContent;
            });
            const text = this.getRichMessageText(content) || this.renderTemplate(step.instruction || '', context);
            pushMessage({ role: 'assistant', text, kind: 'rich', content });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'condition') {
            const responseName = step.responseName || step.title || 'condition';
            let matched = false;
            if (step.conditionMode === 'llm') {
                const decision = await this.evaluateLlmCondition(step, config, context).catch((error) => {
                    const message = this.getErrorMessage(error);
                    return { matched: false, reason: message, raw: null };
                });
                matched = decision.matched;
                context.slots[step.conditionReasonResponseName || `${responseName}_reason`] = decision.reason || '';
                trace.push({
                    stepId: step.id,
                    type: 'conditionLlm',
                    matched,
                    reason: decision.reason || '',
                    raw: decision.raw,
                });
            }
            else {
                matched = this.evaluateCondition(step.instruction || step.condition, context);
            }
            context.slots[responseName] = matched;
            return { completed: true, outgoing: matched ? await this.outgoingTargets(step, config, context, trace) : [] };
        }
        if (step.type === 'api') {
            let requests = this.renderTemplate(step.api?.requests || [], context);
            if (step.api?.generation?.enabled === true) {
                const generatedRequests = await this.generateApiRequestsWithLlm(step, config, context).catch((error) => {
                    trace.push({
                        stepId: step.id,
                        type: 'apiLlmGenerationError',
                        message: this.getErrorMessage(error),
                    });
                    return [];
                });
                if (generatedRequests.length || step.api.generation.fallbackToManual === false) {
                    requests = this.renderTemplate(generatedRequests, context);
                }
                trace.push({
                    stepId: step.id,
                    type: 'apiLlmGeneration',
                    generatedCount: Array.isArray(generatedRequests) ? generatedRequests.length : 0,
                    usedGenerated: generatedRequests.length > 0 || step.api.generation.fallbackToManual === false,
                });
            }
            const result = await this.httpBatchService.execute(requests, context);
            const responseName = step.api?.responseName || step.responseName || 'api';
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'api', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'cron') {
            const responseName = step.component.responseName || step.responseName || 'cron';
            const result = {
                triggeredAt: context.now,
                input: context.input || '',
                schedule: this.cronSummary(step.component),
            };
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'cron', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'debug') {
            const responseName = step.component.responseName || step.responseName || 'debug';
            const snapshot = this.createSnapshot(step, context);
            context.slots[responseName] = snapshot;
            trace.push({ stepId: step.id, type: 'debug', snapshot });
            pushMessage({ role: 'system', text: step.title || 'Debug', kind: 'debug', debug: snapshot });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'webhook') {
            const responseName = step.component.responseName || step.responseName || 'webhook';
            const webhookMode = step.component.webhookMode || 'inbound';
            if (webhookMode === 'listener') {
                trace.push({ stepId: step.id, type: 'webhookListener', mode: 'global', reachedAsNode: true });
                return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
            }
            if (webhookMode === 'outbound') {
                const requests = this.renderTemplate(step.api?.requests || [], context);
                const result = await this.httpBatchService.execute(requests, context);
                context.slots[responseName] = result;
                trace.push({ stepId: step.id, type: 'webhookOutbound', result });
                return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
            }
            const inbound = context.slots[responseName] || context.slots.webhook || {
                webhookId: step.component.webhookId || step.id,
                flowId: context.flowId,
                stepId: step.id,
                receivedAt: context.now,
                body: context.input,
            };
            context.slots.webhook = inbound;
            context.slots[responseName] = inbound;
            trace.push({
                stepId: step.id,
                type: 'webhookInbound',
                webhookId: step.component.webhookId || step.id,
                hasBody: inbound?.body !== undefined,
            });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'context') {
            const result = await this.runContextComponent(step, config, context);
            trace.push({ stepId: step.id, type: 'context', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'files') {
            const result = await this.runFilesComponent(step, config, context);
            trace.push({ stepId: step.id, type: 'files', result });
            const outgoing = await this.outgoingTargets(step, config, context, trace);
            if (!outgoing.length
                && (step.component.filesResultMode === 'llm' || ['generate', 'edit'].includes(String(step.component.filesOperation || 'read')))
                && result?.answer) {
                this.rememberAssistantText(context, result.answer);
                pushMessage({ role: 'assistant', text: result.answer });
            }
            return { completed: true, outgoing };
        }
        if (step.type === 'component' && step.component?.type === 'agentPlan') {
            const result = this.runAgentPlanComponent(step, context);
            trace.push({ stepId: step.id, type: 'agentPlanComponent', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'approval') {
            return await this.runApprovalComponent(step, config, context, trace, pushMessage);
        }
        if (step.type === 'component' && step.component?.type === 'mcp') {
            const result = await this.runMcpComponent(step, config, context);
            trace.push({
                stepId: step.id,
                type: 'mcp',
                mode: step.component.mcpMode || 'fields',
                result,
            });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'mongodb') {
            const responseName = step.component.responseName || step.responseName || 'mongo';
            const result = await this.runMongoComponent(step, context, config);
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'mongodb', operation: step.component.mongoOperation || 'insertOne', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'milvus') {
            const responseName = step.component.responseName || step.responseName || 'milvus';
            const result = await this.runMilvusComponent(step, context, config);
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'milvus', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'azureSearch') {
            const responseName = step.component.responseName || step.responseName || 'azureSearch';
            const result = step.component.ragOperation === 'index'
                ? await this.runRagIndexComponent(step, context, 'azure_search', step.component.ragStorageProvider)
                : await this.runRagSearchComponent(step, context, 'azure_search', config);
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'azureSearch', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'azureBlob') {
            const responseName = step.component.responseName || step.responseName || 'azureBlob';
            const result = await this.runAzureBlobComponent(step, context);
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'azureBlob', result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'openaiGen') {
            const responseName = step.component.responseName || step.responseName || 'openai';
            const result = await this.runLlmGenComponent(step, config, context);
            context.slots[responseName] = result;
            this.rememberAssistantText(context, result?.text);
            trace.push({ stepId: step.id, type: 'openaiGen', result });
            const executionMode = this.agentExecutionModeForComponent(step.component);
            const autoToolObservations = Array.isArray(result.autoTools) ? result.autoTools : undefined;
            let outgoing = executionMode === 'auto_tools'
                ? await this.resolveCalledAgentToolDownstreamTargets(config, context, trace, step.id, autoToolObservations)
                : await this.outgoingTargets(step, config, context, trace);
            if (executionMode === 'hybrid') {
                outgoing = await this.filterHybridAgentOutgoingTargets(step, config, context, outgoing, trace, autoToolObservations);
            }
            const autoToolMessages = Array.isArray(result.autoToolMessages)
                ? result.autoToolMessages
                : [];
            autoToolMessages.forEach((message) => {
                if (message && typeof message.text === 'string') {
                    pushMessage({
                        role: String(message.role || 'system'),
                        text: message.text,
                        kind: message.kind,
                        debug: message.debug,
                        content: message.content,
                    });
                }
            });
            if (!outgoing.length)
                pushMessage({ role: 'assistant', text: result.text });
            return { completed: true, outgoing };
        }
        if (step.type === 'component' && step.component?.type === 'azureOpenAI') {
            const responseName = step.component.responseName || step.responseName || 'azureOpenAI';
            const result = await this.runLlmGenComponent(step, config, context, 'azure_openai');
            context.slots[responseName] = result;
            this.rememberAssistantText(context, result?.text);
            trace.push({ stepId: step.id, type: 'azureOpenAI', result });
            const outgoing = await this.outgoingTargets(step, config, context, trace);
            if (!outgoing.length)
                pushMessage({ role: 'assistant', text: result.text });
            return { completed: true, outgoing };
        }
        if (step.type === 'component' && step.component?.type === 'loop') {
            const loop = await this.runCounterLoopComponent(step, config, context, trace);
            trace.push({ stepId: step.id, type: 'loop', result: loop.result });
            if (loop.result.warning) {
                pushMessage({ role: 'system', text: loop.result.warning });
            }
            return {
                completed: !loop.result.shouldContinue,
                outgoing: loop.outgoing,
                outgoingDelayMs: loop.outgoingDelayMs,
                resetCompleted: loop.resetCompleted,
            };
        }
        if (step.type === 'component' && step.component?.type === 'flowRouter') {
            return await this.runFlowRouterComponent(step, config, context, messages, trace, {
                deferOnMessage: options?.deferOnMessage === true,
            });
        }
        if (step.type === 'component' && step.component?.type === 'dashboard') {
            const responseName = step.component.responseName || step.responseName || 'dashboard';
            const result = await this.runDashboardComponent(step, config, context, trace);
            context.slots[responseName] = result;
            trace.push({ stepId: step.id, type: 'dashboard', source: step.component.dashboardSource || 'trace', result });
            pushMessage({ role: 'system', text: result.title || step.title || 'Dashboard', kind: 'dashboard', debug: result });
            return { completed: true, outgoing: await this.outgoingTargets(step, config, context, trace) };
        }
        if (step.type === 'component' && step.component?.type === 'rag') {
            const responseName = step.component.responseName || step.responseName || 'rag';
            const query = this.renderTemplate(step.component.queryTemplate || step.instruction || '{{context.slots.userInput}}', context);
            const guardrail = this.evaluateAgentGuardrails(config, query || context?.input || context?.slots?.userInput);
            if (guardrail) {
                const result = {
                    text: guardrail.text,
                    conversationId: context.conversationId,
                    docs: [],
                    searchDebug: { mode: 'guardrail_block' },
                    trace: [{ type: 'guardrail', result: guardrail }],
                    model: config.model,
                    guardrail,
                };
                context.slots[responseName] = result;
                this.rememberAssistantText(context, result.text);
                trace.push({ stepId: step.id, type: 'rag', result });
                const outgoing = await this.outgoingTargets(step, config, context, trace);
                if (!outgoing.length)
                    pushMessage({ role: 'assistant', text: result.text });
                return { completed: true, outgoing };
            }
            const ragOverrides = this.resolveRagConditionalOverrides(step.component, context);
            const providedDocs = this.resolveRagDocumentsForComponent(step.component, context, step, config);
            const ragResponse = await this.ragService.chatLlmRag(query, context.agentId, {
                model: step.component.ragLlmModel || config.model,
                conversationId: context.conversationId,
                collectionName: step.component.collectionName,
                ...this.buildRagSearchParams(step.component, context, undefined, config, ragOverrides),
                docs: providedDocs,
                prompt: this.withAgentSystemPreamble(this.resolveRagPrompt(step, context, ragOverrides), config),
                turnHistoricMessages: step.component.turnHistoricMessages ?? config.turnHistoricMessages ?? 20,
            });
            context.slots[responseName] = ragResponse;
            this.rememberAssistantText(context, ragResponse?.text);
            trace.push({ stepId: step.id, type: 'rag', result: ragResponse });
            const outgoing = await this.outgoingTargets(step, config, context, trace);
            if (!outgoing.length) {
                pushMessage({ role: 'assistant', text: ragResponse.text });
            }
            return { completed: true, outgoing };
        }
        if (step.type === 'end') {
            const text = this.renderTemplate(step.instruction || 'Fluxo finalizado.', context);
            pushMessage({ role: 'assistant', text });
            const outgoing = await this.outgoingTargets(step, config, context, trace);
            if (outgoing.length) {
                return { completed: true, outgoing };
            }
            context.__clearConversationMemory = true;
            return { completed: true, ended: true, clearConversationMemory: true };
        }
        return { completed: true };
    }
    getLangGraphRuntime() {
        if (this.langGraphRuntimeService)
            return this.langGraphRuntimeService;
        if (!this.fallbackLangGraphRuntimeService) {
            this.fallbackLangGraphRuntimeService = new langgraph_runtime_service_1.LangGraphRuntimeService(undefined, this.configService);
        }
        return this.fallbackLangGraphRuntimeService;
    }
    snapshotLangGraphContext(context) {
        const snapshot = { ...(context || {}) };
        delete snapshot.__onMessage;
        return this.cloneJsonSafe(snapshot);
    }
    restoreLangGraphTrace(entries, dropped, options) {
        const trace = this.createTraceBuffer(options);
        (Array.isArray(entries) ? entries : []).forEach((entry) => trace.push(entry));
        trace.__dropped = Math.max(Number(trace.__dropped || 0), Number(dropped || 0));
        return trace;
    }
    langGraphRuntimeStatus(state) {
        if (state.waitingInput)
            return 'waiting';
        if (state.safety >= state.maxExecutionSteps)
            return 'limit';
        if (state.queue.length)
            return 'running';
        return state.ended ? 'ended' : 'completed';
    }
    async advanceLangGraphRuntime(state, options) {
        const { config, traceOptions, onMessage } = options;
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        const queue = (state.queue || []).map((item) => ({ ...item }));
        const completed = new Set(state.completed || []);
        const visitCountByStep = new Map(Object.entries(state.visitCountByStep || {}).map(([stepId, count]) => [stepId, Number(count || 0)]));
        const context = this.cloneJsonSafe(state.context || {});
        if (typeof onMessage === 'function')
            context.__onMessage = onMessage;
        const messages = this.cloneJsonSafe(state.messages || []);
        const trace = this.restoreLangGraphTrace(state.trace, state.traceDropped, traceOptions);
        let waitingInput = state.waitingInput || '';
        let ended = state.ended === true;
        let safety = Number(state.safety || 0);
        let activeFlowId = state.activeFlowId || '';
        let activeFlowName = state.activeFlowName || '';
        let clearConversationMemory = state.clearConversationMemory === true;
        if (queue.length && !waitingInput && safety < state.maxExecutionSteps) {
            const nowMs = Date.now();
            const nextReadyAt = Math.min(...queue.map((item) => item.readyAt || 0));
            if (nextReadyAt > nowMs) {
                await this.sleep(nextReadyAt - nowMs);
            }
            const readyAt = Date.now();
            const readyItems = queue.filter((item) => (item.readyAt || 0) <= readyAt);
            queue.splice(0, queue.length, ...queue.filter((item) => (item.readyAt || 0) > readyAt));
            const delayByStep = new Map();
            readyItems.forEach((item) => {
                delayByStep.set(item.stepId, Math.max(delayByStep.get(item.stepId) || 0, Number(item.delayMs || 0)));
            });
            const batch = this.sortStepIdsByExecutionOrder(Array.from(new Set(readyItems.map((item) => item.stepId))).filter((stepId) => {
                const step = stepById.get(stepId);
                return step
                    && !completed.has(step.id)
                    && (visitCountByStep.get(step.id) || 0) < state.maxStepVisits;
            }), config);
            if (batch.length) {
                const { executable: executionBatch, deferred } = this.splitDeferredPassthroughMessages(batch, stepById);
                const deferredStepIds = new Set(deferred);
                const deferredQueueItems = readyItems
                    .filter((item) => deferredStepIds.has(item.stepId))
                    .map((item) => ({ stepId: item.stepId, readyAt: 0, delayMs: Number(item.delayMs || 0) }));
                if (!executionBatch.length) {
                    queue.push(...deferredQueueItems);
                }
                else {
                    safety += executionBatch.length;
                    const batchMessages = new Array(executionBatch.length);
                    const settled = await this.allSettledLimited(executionBatch, this.maxParallelNodes(), async (stepId, index) => {
                        const step = stepById.get(stepId);
                        const stepMessages = [];
                        batchMessages[index] = stepMessages;
                        if (!step || completed.has(step.id)) {
                            return { step, result: { skipped: true } };
                        }
                        visitCountByStep.set(step.id, (visitCountByStep.get(step.id) || 0) + 1);
                        return {
                            step,
                            result: await this.runStep(step, config, context, stepMessages, trace, {
                                messageDelayMs: delayByStep.get(stepId) || 0,
                                deferOnMessage: true,
                            }),
                        };
                    });
                    const nextQueue = [];
                    let pendingWaitPromptStep;
                    settled.forEach((item, index) => {
                        if (item.status === 'rejected') {
                            const step = stepById.get(executionBatch[index]);
                            const message = `Erro no node "${step?.title || executionBatch[index]}": ${this.getErrorMessage(item.reason)}`;
                            this.emitFlowMessage(messages, { role: 'system', text: message }, { onMessage: context.__onMessage });
                            trace.push({ stepId: step?.id || executionBatch[index], type: 'error', message });
                            return;
                        }
                        const { step, result } = item.value;
                        if (!step || result.skipped)
                            return;
                        this.flushDeferredMessages(messages, batchMessages[index], context.__onMessage);
                        if (result.completed)
                            completed.add(step.id);
                        (result.resetCompleted || []).forEach((stepId) => completed.delete(stepId));
                        if (result.activeFlowId)
                            activeFlowId = result.activeFlowId;
                        if (result.activeFlowName)
                            activeFlowName = result.activeFlowName;
                        if (result.waitingInput && !waitingInput)
                            waitingInput = result.waitingInput;
                        if (result.ended)
                            ended = true;
                        if (result.clearConversationMemory)
                            clearConversationMemory = true;
                        const outgoingDelayMs = Math.max(0, Number(result.outgoingDelayMs || 0));
                        (result.outgoing || []).forEach((target) => {
                            const targetStep = stepById.get(target);
                            const targetAlreadyVisited = Boolean((visitCountByStep.get(target) || 0) > 0 || completed.has(target));
                            if (this.isUserInteractionWaitStep(targetStep) && targetAlreadyVisited) {
                                if (!waitingInput)
                                    waitingInput = target;
                                if (!pendingWaitPromptStep)
                                    pendingWaitPromptStep = targetStep;
                                trace.push({
                                    type: 'interactionWaitReentry',
                                    sourceStepId: step.id,
                                    targetStepId: target,
                                    targetTitle: targetStep.title || target,
                                    stepType: targetStep.type,
                                    componentType: targetStep.component?.type,
                                    reason: 'No que depende de interacao do usuario foi revisitado depois que a entrada desta rodada ja foi consumida. Aguardando a proxima interacao.',
                                });
                                return;
                            }
                            if (this.shouldQueueRuntimeTarget(target, completed, stepById, visitCountByStep, state.maxStepVisits, trace, step.id)) {
                                nextQueue.push({ stepId: target, readyAt: outgoingDelayMs ? Date.now() + outgoingDelayMs : 0, delayMs: outgoingDelayMs });
                            }
                        });
                    });
                    if (waitingInput && pendingWaitPromptStep) {
                        this.emitUserInteractionWaitPrompt(pendingWaitPromptStep, context, messages, trace);
                    }
                    if (waitingInput) {
                        queue.splice(0, queue.length);
                    }
                    else {
                        queue.push(...nextQueue, ...deferredQueueItems);
                    }
                }
            }
        }
        const nextState = {
            ...state,
            queue,
            completed: Array.from(completed),
            visitCountByStep: Object.fromEntries(visitCountByStep),
            waitingInput,
            ended,
            safety,
            activeFlowId,
            activeFlowName,
            clearConversationMemory,
            context: this.snapshotLangGraphContext(context),
            messages: this.cloneJsonSafe(messages),
            trace: this.cloneJsonSafe(Array.from(trace)),
            traceDropped: Number(trace.__dropped || 0),
            checkpoints: Number(state.checkpoints || 0) + 1,
            updatedAt: new Date().toISOString(),
        };
        return {
            ...nextState,
            status: this.langGraphRuntimeStatus(nextState),
        };
    }
    async run(body) {
        const traceOptions = this.resolveTraceOptions(body);
        const requestedFlowId = body?.activeFlowId || body?.flowId || '';
        const hasInlineConfig = Boolean(body?.config?.steps?.length);
        const activeDiffersFromEntry = Boolean(body?.activeFlowId && body?.flowId && body.activeFlowId !== body.flowId);
        const shouldLoadFlowRecord = Boolean(requestedFlowId && (!hasInlineConfig || activeDiffersFromEntry));
        const flowRecord = shouldLoadFlowRecord ? await this.canvasFlowService.findOne(requestedFlowId, body?._organizationId || body?.organizationId) : null;
        const runtimeAgentId = flowRecord?.agentId || body?.agentId;
        const bodyFlowVersionMap = body?.flowVersionMap && typeof body.flowVersionMap === 'object' && !Array.isArray(body.flowVersionMap)
            ? body.flowVersionMap
            : {};
        const ignoreAgentRelease = body?.ignoreAgentRelease === true || body?._ignoreAgentRelease === true;
        const agentReleaseInfo = flowRecord && !ignoreAgentRelease
            ? await this.canvasFlowService.resolveAgentRelease(runtimeAgentId, flowRecord?.organizationId || body?._organizationId || body?.organizationId, body?.agentRelease || body?.agentReleaseVersion)
            : { release: undefined, versions: bodyFlowVersionMap, source: 'none' };
        const releaseVersionMap = {
            ...(agentReleaseInfo?.versions || {}),
            ...bodyFlowVersionMap,
        };
        const releaseFlowVersion = releaseVersionMap[String(requestedFlowId || flowRecord?._id || '')];
        const versionInfo = flowRecord
            ? await this.canvasFlowService.resolveFlowVersionAsync(flowRecord, body?.flowVersion || body?.version || releaseFlowVersion)
            : undefined;
        const entryFlowId = body?.entryFlowId || body?.flowId || requestedFlowId || flowRecord?._id;
        const canUseInlineConfig = hasInlineConfig && !activeDiffersFromEntry;
        const config = canUseInlineConfig ? body.config : versionInfo?.config;
        if (!config?.steps?.length) {
            const traceResult = this.paginateTrace(this.createTraceBuffer(traceOptions), traceOptions);
            return {
                messages: [{ role: 'system', text: 'Fluxo vazio ou inválido.' }],
                slots: body?.slots || {},
                trace: traceResult.trace,
                tracePage: traceResult.tracePage,
            };
        }
        const conversationId = body?.conversationId || (0, crypto_1.randomUUID)();
        const conversationOwnerId = String(body?._conversationOwnerId || body?._oauthUserId || '').trim();
        const langGraphRunId = String(body?._langGraphRunId || (0, crypto_1.randomUUID)());
        const conversationOrganizationId = flowRecord?.organizationId || body?.organizationId || body?._organizationId || '';
        const agentId = runtimeAgentId;
        const channel = body?.channel || config.channel || body?.slots?.channel || 'webWidget';
        const flowVersion = canUseInlineConfig ? undefined : versionInfo?.version;
        const activeFlowVersion = versionInfo?.activeVersion;
        const flowVersionSource = canUseInlineConfig ? 'draft' : versionInfo?.source;
        let activeFlowId = requestedFlowId || body?.flowId || '';
        let activeFlowName = flowRecord?.name || body?.flowName || config.title || '';
        const savedState = body?.skipHistory === true
            ? null
            : await this.getCanvasFlowState(agentId, conversationId, String(entryFlowId || requestedFlowId || flowRecord?._id || ''), {
                organizationId: conversationOrganizationId,
                conversationOwnerId,
            }).catch(() => null);
        const savedSlots = this.isPlainObject(savedState?.slots) ? savedState.slots : {};
        const bodySlots = this.isPlainObject(body?.slots) ? body.slots : {};
        const incomingSlots = this.stripAgentRuntimeSlots({
            ...savedSlots,
            ...bodySlots,
        });
        const requestedCurrentStepId = String(body?.currentStepId || '').trim();
        const savedCurrentStepId = String(savedState?.currentStepId || '').trim();
        const resumeStepId = requestedCurrentStepId || savedCurrentStepId;
        const now = new Date().toISOString();
        const currentFlowId = String(requestedFlowId || body?.flowId || flowRecord?._id || '');
        const baseRoutePath = Array.isArray(body?.routePath) ? body.routePath.map((id) => String(id)) : [];
        const routePath = currentFlowId && !baseRoutePath.includes(currentFlowId)
            ? [...baseRoutePath, currentFlowId]
            : baseRoutePath;
        const context = {
            agentId,
            channel,
            conversationId,
            organizationId: conversationOrganizationId,
            oauthUserId: body?._oauthUserId || '',
            conversationOwnerId,
            langGraphRunId,
            flowId: currentFlowId,
            entryFlowId,
            entryFlowName: body?.entryFlowName,
            routeDepth: Number(body?.routeDepth || 0),
            routePath,
            agentRelease: agentReleaseInfo?.release,
            agentReleaseSource: agentReleaseInfo?.source,
            ignoreAgentRelease,
            flowVersionMap: releaseVersionMap,
            flowName: flowRecord?.name || body?.flowName || config.title,
            now,
            input: body?.text || '',
            inputTargetStepId: resumeStepId,
            deferInputUntilCurrentStep: body?._deferInputUntilCurrentStep === true,
            slots: {
                ...incomingSlots,
                agentId,
                channel,
                conversationId,
                flowId: currentFlowId,
                flowVersion,
                activeFlowVersion,
                flowVersionSource,
                agentRelease: agentReleaseInfo?.release,
                agentReleaseSource: agentReleaseInfo?.source,
                entryFlowId,
                activeFlowId,
                flowName: flowRecord?.name || body?.flowName || config.title,
                now,
                userInput: body?.text || incomingSlots?.userInput || '',
                approvals: body?.approvals || incomingSlots?.approvals || {},
            },
        };
        if (typeof body?._onMessage === 'function') {
            context.__onMessage = body._onMessage;
        }
        const messages = [];
        context.__traceMode = traceOptions.mode;
        context.__traceLimit = traceOptions.responseLimit;
        context.__traceCollectLimit = traceOptions.collectLimit;
        const trace = this.createTraceBuffer(traceOptions);
        if (body?.text && body?.skipHistory !== true) {
            await this.memoryService.addTurn({
                agentId,
                conversationId,
                role: 'user',
                content: String(body.text),
                metadata: {
                    kind: 'message',
                    organizationId: context.organizationId,
                    conversationOwnerId,
                    flowId: currentFlowId,
                    entryFlowId,
                    activeFlowId,
                    flowName: context.flowName,
                    channel,
                },
            }).catch((error) => {
                trace.push({ type: 'memoryError', role: 'user', message: this.getErrorMessage(error) });
            });
        }
        const stepById = new Map(config.steps.map((step) => [step.id, step]));
        const queue = this.resolveStartStepIds(config, resumeStepId)
            .filter(Boolean)
            .map((stepId) => ({ stepId, readyAt: 0, delayMs: 0 }));
        let waitingInput = '';
        let ended = false;
        let safety = 0;
        const loopStepBudget = (config.steps || []).reduce((total, step) => {
            if (step.type === 'component' && step.component?.type === 'loop') {
                return total + this.limitNumber(step.component.loopMaxIterations ?? 3, 3, 1, 1000) * Math.max(config.steps.length, 1);
            }
            return total;
        }, 0);
        const maxExecutionSteps = this.limitNumber(body?.maxSteps, Math.max(80, Math.min(10000, loopStepBudget + config.steps.length * 2)), 1, 10000);
        const maxStepVisits = this.limitNumber(body?.maxStepVisits, this.limitNumber(this.configService.get('CANVAS_FLOW_MAX_STEP_VISITS') || 10, 10, 1, 1000), 1, 1000);
        const langGraphRuntime = this.getLangGraphRuntime();
        const langGraphThreadId = langGraphRuntime.createThreadId({
            organizationId: context.organizationId,
            ownerId: conversationOwnerId,
            agentId,
            entryFlowId: String(entryFlowId || currentFlowId || ''),
            flowId: currentFlowId,
            conversationId,
        });
        const langGraphResult = await langGraphRuntime.run({
            threadId: langGraphThreadId,
            initialState: {
                runId: langGraphRunId,
                queue,
                completed: [],
                visitCountByStep: {},
                waitingInput: '',
                ended: false,
                safety: 0,
                maxExecutionSteps,
                maxStepVisits,
                activeFlowId,
                activeFlowName,
                clearConversationMemory: false,
                context: this.snapshotLangGraphContext(context),
                messages: [],
                trace: this.cloneJsonSafe(Array.from(trace)),
                traceDropped: Number(trace.__dropped || 0),
                checkpoints: 0,
                status: queue.length ? 'running' : 'completed',
                updatedAt: new Date().toISOString(),
            },
            executeTick: async (state) => await this.advanceLangGraphRuntime(state, {
                config,
                traceOptions,
                onMessage: context.__onMessage,
            }),
        });
        const langGraphState = langGraphResult.state;
        Object.assign(context, langGraphState.context || {});
        if (typeof body?._onMessage === 'function') {
            context.__onMessage = body._onMessage;
        }
        messages.splice(0, messages.length, ...(langGraphState.messages || []));
        trace.splice(0, trace.length, ...(langGraphState.trace || []));
        trace.__dropped = Number(langGraphState.traceDropped || 0);
        waitingInput = langGraphState.waitingInput || '';
        ended = langGraphState.ended === true;
        safety = Number(langGraphState.safety || 0);
        activeFlowId = langGraphState.activeFlowId || activeFlowId;
        activeFlowName = langGraphState.activeFlowName || activeFlowName;
        if (langGraphState.clearConversationMemory)
            context.__clearConversationMemory = true;
        if (safety >= maxExecutionSteps) {
            this.emitFlowMessage(messages, { role: 'system', text: 'Execução interrompida pelo limite de etapas.' }, { onMessage: context.__onMessage });
        }
        if (!waitingInput && !ended && safety < maxExecutionSteps) {
            waitingInput = this.inferWaitingInputFromAssistantPrompt(context, messages, stepById, trace);
        }
        const shouldClearConversationMemory = context.__clearConversationMemory === true && Boolean(conversationId);
        let memoryCleared = false;
        if (shouldClearConversationMemory) {
            const clearResult = await this.memoryService.clearConversation(agentId, conversationId, {
                organizationId: context.organizationId,
                conversationOwnerId,
            }).catch((error) => {
                trace.push({
                    type: 'memoryClearError',
                    conversationId,
                    message: this.getErrorMessage(error),
                });
                return { acknowledged: false, deletedCount: 0 };
            });
            memoryCleared = clearResult?.acknowledged !== false;
            trace.push({
                type: memoryCleared ? 'memoryCleared' : 'memoryClearFailed',
                conversationId,
                deletedCount: clearResult?.deletedCount ?? 0,
            });
        }
        if (body?.skipHistory !== true && messages.length) {
            const historyWrites = messages.map((message) => this.memoryService[shouldClearConversationMemory ? 'addHistoryTurn' : 'addTurn']({
                agentId,
                conversationId,
                role: message.role,
                content: message.text || '',
                metadata: {
                    kind: 'message',
                    organizationId: context.organizationId,
                    conversationOwnerId,
                    flowId: currentFlowId,
                    entryFlowId,
                    activeFlowId,
                    flowName: context.flowName,
                    channel,
                    messageKind: message.kind,
                    debug: message.debug,
                },
            }));
            const historyResults = await Promise.allSettled(historyWrites);
            historyResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    trace.push({
                        type: 'memoryError',
                        role: messages[index]?.role,
                        message: this.getErrorMessage(result.reason),
                    });
                }
            });
        }
        if (body?.skipHistory !== true && trace.length) {
            const traceSummary = this.compactTraceForHistory(trace);
            await this.memoryService.addTraceTurn({
                agentId,
                conversationId,
                role: 'system',
                content: 'trace_summary',
                metadata: {
                    kind: 'trace',
                    organizationId: context.organizationId,
                    conversationOwnerId,
                    flowId: currentFlowId,
                    entryFlowId,
                    activeFlowId,
                    flowName: context.flowName,
                    channel,
                    ended,
                    currentStepId: waitingInput,
                    traceSummary,
                },
            }).catch((error) => {
                trace.push({
                    type: 'traceHistoryError',
                    message: this.getErrorMessage(error),
                });
            });
        }
        if (body?.skipHistory !== true && !shouldClearConversationMemory && conversationId) {
            await this.saveCanvasFlowState({
                agentId,
                organizationId: context.organizationId,
                conversationId,
                entryFlowId: String(entryFlowId || currentFlowId || ''),
                activeFlowId,
                currentStepId: waitingInput,
                slots: this.stripAgentRuntimeSlots(context.slots || {}),
                conversationOwnerId,
                langGraphThreadId,
            }).catch((error) => {
                trace.push({
                    type: 'stateSaveError',
                    conversationId,
                    message: this.getErrorMessage(error),
                });
            });
        }
        context.currentStepId = waitingInput;
        context.ended = ended;
        context.activeFlowId = activeFlowId;
        context.activeFlowName = activeFlowName;
        context.messages = this.cloneJson(messages);
        await this.dispatchWebhookListeners({
            body,
            config,
            context,
            messages,
            trace,
            waitingInput,
            ended,
            activeFlowId,
            activeFlowName,
        });
        const traceResult = this.paginateTrace(trace, traceOptions);
        return {
            messages,
            slots: this.stripAgentRuntimeSlots(context.slots),
            currentStepId: waitingInput,
            ended,
            conversationId,
            entryFlowId,
            activeFlowId,
            activeFlowName,
            trace: traceResult.trace,
            tracePage: traceResult.tracePage,
            flowVersion,
            activeFlowVersion,
            flowVersionSource,
            agentRelease: agentReleaseInfo?.release,
            agentReleaseSource: agentReleaseInfo?.source,
            memoryClearRequested: shouldClearConversationMemory,
            memoryCleared,
            runtime: langGraphResult.runtime,
        };
    }
    async runDueCronFlows(options) {
        if (this.cronRunning) {
            return { ok: true, skipped: true, reason: 'scheduler already running' };
        }
        this.cronRunning = true;
        const now = new Date();
        const executions = [];
        const scheduled = [];
        try {
            let flows = [];
            try {
                await this.waitForMongoConnection();
                flows = await this.canvasFlowService.findAll(options?.agentId, undefined, { includeConfig: true });
            }
            catch (error) {
                const message = this.getErrorMessage(error);
                const isConnectionError = /mongo|connection|timed?\s*out|timeout|econnrefused|server selection/i.test(message);
                if (options?.suppressConnectionErrors && isConnectionError) {
                    return {
                        ok: false,
                        skipped: true,
                        reason: 'mongo_unavailable',
                        error: message,
                        timestamp: now.toISOString(),
                    };
                }
                throw error;
            }
            for (const flow of flows) {
                const config = flow?.config;
                if (!config?.steps?.length)
                    continue;
                let changed = false;
                for (const step of config.steps) {
                    const component = step.component;
                    if (step.type !== 'component' || component?.type !== 'cron' || component.cronEnabled !== true) {
                        continue;
                    }
                    let nextRunAt = this.parseCronDate(component.cronNextRunAt, this.getCronTimezone(component));
                    if (!nextRunAt) {
                        nextRunAt = this.computeNextCronRun(component, now);
                        component.cronNextRunAt = nextRunAt?.toISOString() || '';
                        changed = true;
                    }
                    if (!nextRunAt)
                        continue;
                    const baseReport = {
                        flowId: String(flow._id),
                        flowName: flow.name || config.title,
                        stepId: step.id,
                        title: step.title || 'CRON',
                        nextRunAt: nextRunAt.toISOString(),
                    };
                    if (nextRunAt > now) {
                        scheduled.push(baseReport);
                        continue;
                    }
                    const firedAt = now.toISOString();
                    const startedAt = Date.now();
                    let logEntry = null;
                    const extraSlots = this.parseJsonConfig(component.cronSlotsJson, {});
                    if (!options?.dryRun) {
                        try {
                            const runPayload = {
                                flowId: String(flow._id),
                                activeFlowId: String(flow._id),
                                entryFlowId: String(flow._id),
                                agentId: flow.agentId,
                                organizationId: flow.organizationId,
                                _organizationId: flow.organizationId,
                                _conversationOwnerId: 'cron',
                                _langGraphRunId: (0, crypto_1.randomUUID)(),
                                conversationId: `cron-${String(flow._id)}-${step.id}`,
                                channel: config.channel || 'webWidget',
                                currentStepId: component.cronRunFrom === 'flowStart' ? undefined : step.id,
                                text: component.cronInputText || '',
                                async: this.sqsTransitionService.isEnabled(),
                                queue: this.sqsTransitionService.isEnabled(),
                                slots: {
                                    ...(extraSlots && typeof extraSlots === 'object' && !Array.isArray(extraSlots) ? extraSlots : {}),
                                    cron: {
                                        flowId: String(flow._id),
                                        stepId: step.id,
                                        firedAt,
                                        schedule: this.cronSummary(component),
                                    },
                                },
                            };
                            const result = this.sqsTransitionService.isEnabled()
                                ? await this.sqsTransitionService.enqueue('canvas-flow.run', runPayload, {
                                    trackResult: true,
                                    jobId: `cron-${String(flow._id)}-${step.id}-${Date.parse(firedAt) || Date.now()}`,
                                })
                                : await this.run(runPayload);
                            const finishedAt = new Date().toISOString();
                            executions.push({
                                ...baseReport,
                                status: this.sqsTransitionService.isEnabled() ? 'queued' : 'ok',
                                queued: this.sqsTransitionService.isEnabled() ? true : undefined,
                                jobId: result.jobId,
                                messages: result.messages?.length || 0,
                                ended: result.ended,
                            });
                            logEntry = {
                                firedAt,
                                finishedAt,
                                status: 'ok',
                                messages: result.messages?.length || 0,
                                durationMs: Date.now() - startedAt,
                            };
                        }
                        catch (error) {
                            const finishedAt = new Date().toISOString();
                            const message = this.getErrorMessage(error);
                            executions.push({
                                ...baseReport,
                                status: 'error',
                                error: message,
                            });
                            logEntry = {
                                firedAt,
                                finishedAt,
                                status: 'error',
                                durationMs: Date.now() - startedAt,
                                error: message,
                            };
                        }
                    }
                    else {
                        executions.push({ ...baseReport, status: 'dry-run' });
                    }
                    component.cronLastRunAt = firedAt;
                    const next = this.computeNextCronRun(component, now);
                    component.cronNextRunAt = next?.toISOString() || '';
                    if (logEntry) {
                        this.appendCronExecutionLog(component, {
                            ...logEntry,
                            nextRunAt: component.cronNextRunAt || undefined,
                        });
                    }
                    changed = true;
                }
                if (changed && !options?.dryRun) {
                    await this.canvasFlowService.update(String(flow._id), { config: config });
                }
            }
            return {
                ok: true,
                checkedFlows: flows.length,
                executions,
                scheduled,
                timestamp: now.toISOString(),
            };
        }
        finally {
            this.cronRunning = false;
        }
    }
    async verifyWhatsappWebhook(flowId, mode, verifyToken, challenge) {
        const flowRecord = await this.canvasFlowService.findOne(flowId);
        const agentReleaseInfo = await this.canvasFlowService.resolveAgentRelease(flowRecord?.agentId, flowRecord?.organizationId);
        const versionInfo = await this.canvasFlowService.resolveFlowVersionAsync(flowRecord, agentReleaseInfo.versions?.[String(flowRecord?._id || flowId)]);
        const config = await this.resolveRuntimeFlowConfig(versionInfo.config || { steps: [], edges: [] }, flowRecord?.agentId, flowRecord?.organizationId);
        const provider = this.normalizeWhatsappProvider(config);
        if (provider !== 'meta') {
            return challenge || 'ok';
        }
        const expectedToken = String(config?.whatsapp?.verifyToken || '').trim();
        const receivedToken = String(verifyToken || '').trim();
        if (mode === 'subscribe' && expectedToken && receivedToken === expectedToken) {
            return challenge || '';
        }
        throw new common_1.HttpException('Invalid WhatsApp verify token', common_1.HttpStatus.FORBIDDEN);
    }
    async verifyWhatsappMainWebhook(agentId, mode, verifyToken, challenge) {
        const flowRecord = await this.canvasFlowService.findMain(agentId, 'whatsapp');
        return await this.verifyWhatsappWebhook(String(flowRecord._id), mode, verifyToken, challenge);
    }
    async runWhatsappWebhook(flowId, payload) {
        const flowRecord = await this.canvasFlowService.findOne(flowId);
        const agentReleaseInfo = await this.canvasFlowService.resolveAgentRelease(flowRecord?.agentId, flowRecord?.organizationId, payload?.agentRelease || payload?.agentReleaseVersion);
        const releaseFlowVersion = agentReleaseInfo.versions?.[String(flowRecord?._id || flowId)];
        const versionInfo = await this.canvasFlowService.resolveFlowVersionAsync(flowRecord, payload?.flowVersion || payload?.version || releaseFlowVersion);
        const config = await this.resolveRuntimeFlowConfig(versionInfo.config, flowRecord?.agentId, flowRecord?.organizationId);
        const messages = await this.extractWhatsappMessages(payload, config, String(flowRecord?._id || flowId));
        if (!messages.length) {
            return { ok: true, received: 0, ignored: true };
        }
        const results = [];
        for (const message of messages) {
            const conversationId = `whatsapp-${message.from}`;
            const conversationOwnerId = `whatsapp:${message.from}`;
            const dedupeKey = this.buildWhatsappDedupeKey(flowRecord, message);
            const dedupe = await this.sqsTransitionService.tryStartMessageDedupe({
                dedupeKey,
                organizationId: flowRecord?.organizationId,
                agentId: flowRecord?.agentId,
                flowId,
                conversationId,
                channel: 'whatsapp',
                provider: message.provider || this.normalizeWhatsappProvider(config),
                providerMessageId: message.messageId,
            });
            if (!dedupe.acquired) {
                (0, observability_1.logEvent)('info', 'whatsapp.message.duplicate', {
                    flowId,
                    agentId: flowRecord?.agentId,
                    conversationId,
                    provider: message.provider,
                    providerMessageId: message.messageId,
                    status: dedupe.status,
                });
                results.push({
                    from: message.from,
                    messageId: message.messageId,
                    duplicate: true,
                    skipped: true,
                    status: dedupe.status,
                });
                continue;
            }
            const savedState = await this.getCanvasFlowState(flowRecord?.agentId, conversationId, flowId, {
                organizationId: flowRecord?.organizationId,
                conversationOwnerId,
            });
            const activeFlowId = savedState?.activeFlowId || flowId;
            const savedSlots = savedState?.slots && typeof savedState.slots === 'object' ? savedState.slots : {};
            const whatsappDelivery = savedSlots?.whatsappDelivery && typeof savedSlots.whatsappDelivery === 'object'
                ? savedSlots.whatsappDelivery
                : {
                    agentId: flowRecord?.agentId,
                    flowId,
                    provider: this.normalizeWhatsappProvider(config),
                    deliveryMode: this.normalizeWhatsappDeliveryMode(config),
                };
            const deliveryConfig = await this.resolveRuntimeFlowConfig(versionInfo.config, whatsappDelivery.agentId || flowRecord?.agentId, flowRecord?.organizationId);
            const deliveryResults = [];
            const scheduledAssistantMessageKeys = new Map();
            let deliveryChain = Promise.resolve();
            const scheduleWhatsappDelivery = (assistantMessage) => {
                if (assistantMessage.role !== 'assistant' || !this.shouldSendWhatsappAssistantMessage(deliveryConfig, assistantMessage))
                    return;
                const deliveryKey = this.whatsappDeliveryKey(assistantMessage);
                scheduledAssistantMessageKeys.set(deliveryKey, (scheduledAssistantMessageKeys.get(deliveryKey) || 0) + 1);
                deliveryChain = deliveryChain.then(async () => {
                    const delivery = await this.sendWhatsappMessage(deliveryConfig, message.from, assistantMessage).catch((error) => ({
                        ok: false,
                        error: this.getErrorMessage(error),
                    }));
                    deliveryResults.push(delivery);
                }).catch((error) => {
                    deliveryResults.push({ ok: false, error: this.getErrorMessage(error) });
                });
            };
            try {
                const result = await this.run({
                    flowId,
                    activeFlowId,
                    entryFlowId: flowId,
                    agentId: flowRecord?.agentId,
                    channel: 'whatsapp',
                    flowVersion: versionInfo.version,
                    agentRelease: agentReleaseInfo.release,
                    flowVersionMap: agentReleaseInfo.versions,
                    conversationId,
                    _conversationOwnerId: conversationOwnerId,
                    _langGraphRunId: dedupeKey || (0, crypto_1.randomUUID)(),
                    currentStepId: savedState?.currentStepId || undefined,
                    text: message.text,
                    slots: {
                        ...savedSlots,
                        ...(message.slots || {}),
                        phone: message.from,
                        whatsapp: {
                            provider: message.provider || this.normalizeWhatsappProvider(config),
                            from: message.from,
                            messageId: message.messageId,
                            phoneNumberId: message.phoneNumberId,
                            displayPhoneNumber: message.displayPhoneNumber,
                            sinchContactId: message.sinchContactId,
                            sinchIdentity: message.sinchIdentity,
                            timestamp: message.timestamp,
                        },
                        whatsappDelivery: {
                            agentId: whatsappDelivery.agentId || flowRecord?.agentId,
                            flowId: whatsappDelivery.flowId || flowId,
                            provider: this.normalizeWhatsappProvider(deliveryConfig),
                            deliveryMode: this.normalizeWhatsappDeliveryMode(deliveryConfig),
                        },
                    },
                    _onMessage: scheduleWhatsappDelivery,
                });
                await deliveryChain;
                if (result.memoryClearRequested !== true && result.memoryCleared !== true) {
                    await this.saveCanvasFlowState({
                        agentId: flowRecord?.agentId,
                        organizationId: flowRecord?.organizationId,
                        conversationId,
                        entryFlowId: result.entryFlowId || flowId,
                        activeFlowId: result.activeFlowId || activeFlowId || flowId,
                        currentStepId: result.currentStepId || '',
                        slots: result.slots || {},
                        conversationOwnerId,
                        langGraphThreadId: result.runtime?.threadId,
                    });
                }
                const answer = this.getAssistantText(result.messages || []);
                const assistantMessages = (result.messages || []).filter((item) => item.role === 'assistant');
                const sendableAssistantMessages = assistantMessages.filter((item) => this.shouldSendWhatsappAssistantMessage(deliveryConfig, item));
                for (const item of assistantMessages) {
                    if (!this.shouldSendWhatsappAssistantMessage(deliveryConfig, item))
                        continue;
                    const deliveryKey = this.whatsappDeliveryKey(item);
                    const scheduledCount = scheduledAssistantMessageKeys.get(deliveryKey) || 0;
                    if (scheduledCount > 0) {
                        scheduledAssistantMessageKeys.set(deliveryKey, scheduledCount - 1);
                        continue;
                    }
                    const delivery = await this.sendWhatsappMessage(deliveryConfig, message.from, item).catch((error) => ({
                        ok: false,
                        error: this.getErrorMessage(error),
                    }));
                    deliveryResults.push(delivery);
                }
                const delivery = deliveryResults.length ? deliveryResults : {
                    skipped: true,
                    reason: !assistantMessages.length
                        ? 'no_assistant_message'
                        : !sendableAssistantMessages.length
                            ? 'no_sendable_assistant_message'
                            : 'delivery_not_scheduled',
                    provider: this.normalizeWhatsappProvider(deliveryConfig),
                    deliveryMode: this.normalizeWhatsappDeliveryMode(deliveryConfig),
                    configuredDeliveryMode: deliveryConfig?.whatsapp?.deliveryMode || '',
                    sinchApiMode: deliveryConfig?.whatsapp?.sinchApiMode || '',
                    autoReply: deliveryConfig?.whatsapp?.autoReply === true,
                    hasSinchRelayCredentials: this.hasSinchRelayCredentials(deliveryConfig),
                    hasSinchConversationCredentials: this.hasSinchConversationCredentials(deliveryConfig),
                    messagesCount: Array.isArray(result.messages) ? result.messages.length : 0,
                    assistantMessagesCount: assistantMessages.length,
                    sendableAssistantMessagesCount: sendableAssistantMessages.length,
                    currentStepId: result.currentStepId || '',
                    ended: result.ended === true,
                };
                await this.sqsTransitionService.completeMessageDedupe(dedupeKey);
                results.push({
                    from: message.from,
                    messageId: message.messageId,
                    answer,
                    delivery,
                    replyPayloads: Array.isArray(delivery) ? delivery.flatMap((item) => item?.payloads || []) : [],
                    result,
                });
            }
            catch (error) {
                await this.sqsTransitionService.failMessageDedupe(dedupeKey, error);
                (0, observability_1.logEvent)('error', 'whatsapp.message.failed', {
                    flowId,
                    agentId: flowRecord?.agentId,
                    conversationId,
                    provider: message.provider,
                    providerMessageId: message.messageId,
                    error: (0, observability_1.getErrorDetails)(error),
                });
                throw error;
            }
        }
        return {
            ok: true,
            received: messages.length,
            results,
        };
    }
    async runWhatsappMainWebhook(agentId, payload) {
        const flowRecord = await this.canvasFlowService.findMain(agentId, 'whatsapp');
        return await this.runWhatsappWebhook(String(flowRecord._id), payload);
    }
};
exports.RunnerService = RunnerService;
exports.RunnerService = RunnerService = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, common_1.Optional)()),
    __param(10, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [canvas_flow_service_1.CanvasFlowService,
        http_batch_service_1.HttpBatchService,
        memory_service_1.MemoryService,
        rag_service_1.RagService,
        config_1.ConfigService,
        provider_config_service_1.ProviderConfigService,
        flow_tag_service_1.FlowTagService,
        sqs_transition_service_1.SqsTransitionService,
        mcp_oauth_service_1.McpOAuthService,
        langgraph_runtime_service_1.LangGraphRuntimeService,
        documents_service_1.DocumentsService])
], RunnerService);
//# sourceMappingURL=runner-service.js.map