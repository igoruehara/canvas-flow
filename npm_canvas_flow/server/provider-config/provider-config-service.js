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
exports.ProviderConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const mongoose_1 = require("mongoose");
const provider_config_constants_model_1 = require("./provider-config-constants-model");
const SECRET_PATHS = new Set([
    'openai.apiKey',
    'azureOpenai.apiKey',
    'gemini.apiKey',
    'claude.apiKey',
    'grok.apiKey',
    'bedrock.apiKey',
    'milvus.token',
    'milvus.password',
    'azureBlob.connectionString',
    'azureSearch.apiKey',
    'mongodb.connectionString',
    'whatsapp.accessToken',
    'whatsapp.blipAuthorizationKey',
    'whatsapp.sinchAccessToken',
    'whatsapp.sinchServiceToken',
]);
let ProviderConfigService = class ProviderConfigService {
    constructor(model, configService) {
        this.model = model;
        this.configService = configService;
        this.effectiveSettingsCache = new Map();
    }
    clearEffectiveSettingsCache() {
        this.effectiveSettingsCache.clear();
    }
    configKey(agentId) {
        const normalized = String(agentId || '').trim();
        return normalized ? `agent:${normalized}` : provider_config_constants_model_1.GLOBAL_CONFIG_KEY;
    }
    envFlag(value) {
        return ['true', '1', 'yes', 'sim'].includes(String(value || '').trim().toLowerCase());
    }
    encryptSecret(value) {
        const plain = String(value || '');
        if (!plain)
            return '';
        const key = (0, crypto_1.createHash)('sha256').update(this.secretKey()).digest();
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `enc:${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
    }
    decryptSecret(value) {
        const raw = String(value || '');
        if (!raw.startsWith('enc:'))
            return raw;
        try {
            const payload = Buffer.from(raw.slice(4), 'base64url');
            const iv = payload.subarray(0, 12);
            const tag = payload.subarray(12, 28);
            const encrypted = payload.subarray(28);
            const key = (0, crypto_1.createHash)('sha256').update(this.secretKey()).digest();
            const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        }
        catch {
            return '';
        }
    }
    secretKey() {
        return (this.configService.get('CANVAS_FLOW_JWT_SECRET') ||
            this.configService.get('CANVAS_FLOW_API_TOKEN') ||
            this.configService.get('MONGO_DB_CONNECTION_STRING') ||
            'canvas-flow-provider-config-dev-secret');
    }
    getEnvSettings() {
        const azureEnabled = this.envFlag(this.configService.get('AZURE_OPENAI_ENABLED'));
        const provider = String(this.configService.get('OPENAI_PROVIDER') || '').toLowerCase();
        const llmProvider = ['azure', 'azure_openai', 'azure-openai'].includes(provider) || azureEnabled
            ? 'azure'
            : ['gemini', 'claude', 'grok', 'bedrock'].includes(provider)
                ? provider
                : 'openai';
        return {
            llmProvider,
            openai: {
                enabled: llmProvider !== 'azure',
                apiKey: this.configService.get('OPENAI_API_KEY') || '',
                chatModel: this.configService.get('OPENAI_CHAT_MODEL') || 'gpt-4o',
                embeddingModel: this.configService.get('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-large',
                ocrModel: this.configService.get('OPENAI_OCR_MODEL') || 'gpt-4o',
            },
            azureOpenai: {
                enabled: llmProvider === 'azure',
                apiKey: this.configService.get('AZURE_OPENAI_API_KEY') || '',
                endpoint: this.configService.get('AZURE_OPENAI_ENDPOINT') || this.configService.get('AZURE_OPENAI_API_BASE_PATH') || '',
                apiVersion: this.configService.get('AZURE_OPENAI_API_VERSION') || '2024-02-15-preview',
                chatDeploymentName: this.configService.get('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') || '',
                embeddingDeploymentName: this.configService.get('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME') || '',
                ocrDeploymentName: this.configService.get('AZURE_OPENAI_OCR_DEPLOYMENT_NAME') || '',
                embeddingDimensions: Number(this.configService.get('AZURE_OPENAI_EMBEDDING_DIMENSIONS') || 3072),
            },
            gemini: {
                enabled: llmProvider === 'gemini',
                apiKey: this.configService.get('GEMINI_API_KEY') || this.configService.get('GOOGLE_AI_API_KEY') || '',
                chatModel: this.configService.get('GEMINI_CHAT_MODEL') || this.configService.get('GEMINI_MODEL') || 'gemini-3.5-flash',
            },
            claude: {
                enabled: llmProvider === 'claude',
                apiKey: this.configService.get('ANTHROPIC_API_KEY') || this.configService.get('CLAUDE_API_KEY') || '',
                chatModel: this.configService.get('CLAUDE_CHAT_MODEL') || this.configService.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
            },
            grok: {
                enabled: llmProvider === 'grok',
                apiKey: this.configService.get('XAI_API_KEY') || this.configService.get('GROK_API_KEY') || '',
                baseUrl: this.configService.get('XAI_BASE_URL') || this.configService.get('GROK_BASE_URL') || 'https://api.x.ai/v1',
                chatModel: this.configService.get('GROK_CHAT_MODEL') || this.configService.get('XAI_MODEL') || 'grok-2-latest',
            },
            bedrock: {
                enabled: llmProvider === 'bedrock',
                apiKey: this.configService.get('BEDROCK_API_KEY') || '',
                baseUrl: this.configService.get('BEDROCK_BASE_URL') || '',
                region: this.configService.get('AWS_REGION') || this.configService.get('BEDROCK_REGION') || 'us-east-1',
                chatModel: this.configService.get('BEDROCK_CHAT_MODEL') || this.configService.get('BEDROCK_MODEL') || 'anthropic.claude-sonnet-4-6',
            },
            milvus: {
                address: this.configService.get('MILVUS_ADDRESS') || '',
                token: this.configService.get('MILVUS_TOKEN') || '',
                username: this.configService.get('MILVUS_USERNAME') || '',
                password: this.configService.get('MILVUS_PASSWORD') || '',
                collectionName: this.configService.get('COLLECTION_NAME') || 'canvas_flow_docs',
            },
            azureBlob: {
                connectionString: this.configService.get('BLOB_STRING_CONNECTION') || this.configService.get('AZURE_STORAGE_CONNECTION_STRING') || '',
                containerName: this.configService.get('BLOB_CONTAINER_NAME') || this.configService.get('AZURE_BLOB_CONTAINER_NAME') || '',
            },
            azureSearch: {
                endpoint: this.configService.get('AZURE_SEARCH_API_BASE_PATH') || this.configService.get('AZURE_SEARCH_ENDPOINT') || '',
                apiKey: this.configService.get('AZURE_SEARCH_API_KEY') || this.configService.get('AZURE_SEARCH_KEY') || '',
                indexName: this.configService.get('AZURE_SEARCH_INDEX_NAME') || '',
                apiVersion: this.configService.get('AZURE_SEARCH_API_VERSION') || '2024-07-01',
            },
            mongodb: {
                connectionString: this.configService.get('MONGO_COMPONENT_CONNECTION_STRING') || '',
                databaseName: this.configService.get('MONGO_COMPONENT_DB_NAME') || '',
            },
            webWidget: {
                primaryColor: this.configService.get('CANVAS_FLOW_WIDGET_PRIMARY_COLOR') || '#0f6bff',
                accentColor: this.configService.get('CANVAS_FLOW_WIDGET_ACCENT_COLOR') || '#00b37e',
                assistantName: this.configService.get('CANVAS_FLOW_WIDGET_ASSISTANT_NAME') || 'Assistente IA',
                subtitle: this.configService.get('CANVAS_FLOW_WIDGET_SUBTITLE') || 'Online agora',
                welcomeMessage: this.configService.get('CANVAS_FLOW_WIDGET_WELCOME_MESSAGE') || 'Ola! Como posso ajudar?',
                placeholder: this.configService.get('CANVAS_FLOW_WIDGET_PLACEHOLDER') || 'Digite sua mensagem',
                bubbleLabel: this.configService.get('CANVAS_FLOW_WIDGET_BUBBLE_LABEL') || 'Precisa de ajuda?',
                avatarText: this.configService.get('CANVAS_FLOW_WIDGET_AVATAR_TEXT') || 'IA',
                openByDefault: this.configService.get('CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT') === undefined
                    ? false
                    : this.envFlag(this.configService.get('CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT')),
                position: this.configService.get('CANVAS_FLOW_WIDGET_POSITION') === 'left' ? 'left' : 'right',
            },
            whatsapp: {
                provider: this.configService.get('WHATSAPP_PROVIDER') || 'meta',
                deliveryMode: this.configService.get('WHATSAPP_DELIVERY_MODE') || 'provider',
                autoReply: this.configService.get('WHATSAPP_AUTO_REPLY') === undefined
                    ? true
                    : this.envFlag(this.configService.get('WHATSAPP_AUTO_REPLY')),
                verifyToken: this.configService.get('WHATSAPP_VERIFY_TOKEN') || '',
                businessAccountId: this.configService.get('WHATSAPP_BUSINESS_ACCOUNT_ID') || this.configService.get('WHATSAPP_WABA_ID') || '',
                phoneNumberId: this.configService.get('WHATSAPP_PHONE_NUMBER_ID') || '',
                accessToken: this.configService.get('WHATSAPP_ACCESS_TOKEN') || '',
                graphApiVersion: this.configService.get('WHATSAPP_GRAPH_API_VERSION') || 'v20.0',
                blipContractId: this.configService.get('BLIP_CONTRACT_ID') || '',
                blipAuthorizationKey: this.configService.get('BLIP_AUTHORIZATION_KEY') || '',
                sinchProjectId: this.configService.get('SINCH_PROJECT_ID') || '',
                sinchAppId: this.configService.get('SINCH_APP_ID') || '',
                sinchRegion: this.configService.get('SINCH_REGION') || 'us',
                sinchAccessToken: this.configService.get('SINCH_ACCESS_TOKEN') || '',
                sinchChannel: this.configService.get('SINCH_CHANNEL') || 'WHATSAPP',
                sinchApiMode: this.configService.get('SINCH_API_MODE') || 'conversation',
                sinchServiceNumber: this.configService.get('SINCH_SERVICE_NUMBER') || '',
                sinchServiceUsername: this.configService.get('SINCH_SERVICE_USERNAME') || '',
                sinchServiceToken: this.configService.get('SINCH_SERVICE_TOKEN') || '',
            },
        };
    }
    deepMerge(base, override) {
        if (!override || typeof override !== 'object')
            return base;
        const output = Array.isArray(base) ? [...base] : { ...base };
        Object.entries(override).forEach(([key, value]) => {
            if (value === undefined || value === null)
                return;
            if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
                output[key] = this.deepMerge(output[key], value);
            }
            else {
                output[key] = value;
            }
        });
        return output;
    }
    deepMergeFallback(base, override) {
        if (!override || typeof override !== 'object')
            return base;
        const output = Array.isArray(base) ? [...base] : { ...base };
        Object.entries(override).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '')
                return;
            if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
                output[key] = this.deepMergeFallback(output[key], value);
            }
            else {
                output[key] = value;
            }
        });
        return output;
    }
    walkSecrets(settings, visitor, prefix = '') {
        if (!settings || typeof settings !== 'object')
            return settings;
        const output = Array.isArray(settings) ? [...settings] : { ...settings };
        Object.keys(output).forEach((key) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (SECRET_PATHS.has(path)) {
                output[key] = visitor(path, output[key]);
            }
            else if (output[key] && typeof output[key] === 'object') {
                output[key] = this.walkSecrets(output[key], visitor, path);
            }
        });
        return output;
    }
    decryptStoredSettings(settings) {
        return this.walkSecrets(settings || {}, (_path, value) => this.decryptSecret(value));
    }
    buildEffectiveSettings(storedSettings) {
        return this.normalizeEffectiveSettings(this.deepMergeFallback(this.getEnvSettings(), storedSettings || {}));
    }
    decryptSettings(settings) {
        return this.buildEffectiveSettings(this.decryptStoredSettings(settings));
    }
    encryptSettings(settings) {
        return this.walkSecrets(settings || {}, (_path, value) => this.encryptSecret(value));
    }
    sanitizeSettingsPatch(patch) {
        const allowedSections = ['llmProvider', 'openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'];
        const clean = {};
        allowedSections.forEach((section) => {
            if (patch?.[section] !== undefined)
                clean[section] = patch[section];
        });
        if (clean.llmProvider && !['openai', 'azure', 'azure_openai', 'gemini', 'claude', 'grok', 'bedrock'].includes(clean.llmProvider)) {
            throw new common_1.BadRequestException('llmProvider invalido.');
        }
        if (clean.azureOpenai?.embeddingDimensions !== undefined) {
            clean.azureOpenai.embeddingDimensions = Math.max(1, Number(clean.azureOpenai.embeddingDimensions) || 3072);
        }
        if (clean.whatsapp?.provider && !['meta', 'blip', 'sinch'].includes(clean.whatsapp.provider)) {
            throw new common_1.BadRequestException('whatsapp.provider invalido.');
        }
        if (clean.whatsapp?.deliveryMode && !['provider', 'apiResponse'].includes(clean.whatsapp.deliveryMode)) {
            throw new common_1.BadRequestException('whatsapp.deliveryMode invalido.');
        }
        if (clean.whatsapp?.sinchApiMode && !['conversation', 'relay'].includes(clean.whatsapp.sinchApiMode)) {
            throw new common_1.BadRequestException('whatsapp.sinchApiMode invalido.');
        }
        if (clean.webWidget?.position && !['right', 'left'].includes(clean.webWidget.position)) {
            throw new common_1.BadRequestException('webWidget.position invalido.');
        }
        return clean;
    }
    mergePatchPreservingSecrets(current, patch) {
        const cleanPatch = this.sanitizeSettingsPatch(patch);
        const merged = this.deepMerge(current, cleanPatch);
        SECRET_PATHS.forEach((path) => {
            const incoming = path.split('.').reduce((acc, key) => acc?.[key], cleanPatch);
            if (incoming === '' || incoming === undefined || incoming === null) {
                const keys = path.split('.');
                const value = keys.reduce((acc, key) => acc?.[key], current);
                let cursor = merged;
                keys.slice(0, -1).forEach((key) => {
                    cursor[key] = cursor[key] || {};
                    cursor = cursor[key];
                });
                cursor[keys[keys.length - 1]] = value || '';
            }
        });
        return merged;
    }
    maskSafe(settings, providerStatus) {
        const secretStatus = {};
        const safe = this.walkSecrets(settings, (path, value) => {
            secretStatus[path] = Boolean(String(value || '').trim());
            return '';
        });
        return { settings: safe, secretStatus, ...(providerStatus ? { providerStatus } : {}) };
    }
    hasOpenAIConfig(settings) {
        return Boolean(String(settings.openai?.apiKey || '').trim());
    }
    hasAzureOpenAIConfig(settings) {
        return Boolean(String(settings.azureOpenai?.endpoint || '').trim() &&
            String(settings.azureOpenai?.apiKey || '').trim());
    }
    hasGeminiConfig(settings) {
        return Boolean(String(settings.gemini?.apiKey || '').trim());
    }
    hasClaudeConfig(settings) {
        return Boolean(String(settings.claude?.apiKey || '').trim());
    }
    hasGrokConfig(settings) {
        return Boolean(String(settings.grok?.apiKey || '').trim());
    }
    hasBedrockConfig(settings) {
        return Boolean(String(settings.bedrock?.apiKey || '').trim() && String(settings.bedrock?.baseUrl || '').trim());
    }
    hasSectionConfig(section, settings) {
        if (!settings || typeof settings !== 'object')
            return false;
        if (section === 'openai')
            return Boolean(String(settings.openai?.apiKey || '').trim());
        if (section === 'azureOpenai') {
            return Boolean(String(settings.azureOpenai?.endpoint || '').trim() && String(settings.azureOpenai?.apiKey || '').trim());
        }
        if (section === 'gemini')
            return Boolean(String(settings.gemini?.apiKey || '').trim());
        if (section === 'claude')
            return Boolean(String(settings.claude?.apiKey || '').trim());
        if (section === 'grok')
            return Boolean(String(settings.grok?.apiKey || '').trim());
        if (section === 'bedrock')
            return Boolean(String(settings.bedrock?.apiKey || '').trim() && String(settings.bedrock?.baseUrl || '').trim());
        if (section === 'milvus') {
            return Boolean(String(settings.milvus?.address || '').trim() ||
                String(settings.milvus?.token || '').trim() ||
                String(settings.milvus?.username || '').trim() ||
                String(settings.milvus?.password || '').trim());
        }
        if (section === 'azureBlob') {
            return Boolean(String(settings.azureBlob?.connectionString || '').trim() || String(settings.azureBlob?.containerName || '').trim());
        }
        if (section === 'azureSearch') {
            return Boolean(String(settings.azureSearch?.endpoint || '').trim() ||
                String(settings.azureSearch?.apiKey || '').trim() ||
                String(settings.azureSearch?.indexName || '').trim());
        }
        if (section === 'mongodb') {
            return Boolean(String(settings.mongodb?.connectionString || '').trim() || String(settings.mongodb?.databaseName || '').trim());
        }
        if (section === 'webWidget') {
            return Boolean(settings.webWidget && typeof settings.webWidget === 'object' && Object.keys(settings.webWidget).length > 0);
        }
        if (section === 'whatsapp') {
            const whatsapp = settings.whatsapp || {};
            const provider = String(whatsapp.provider || 'meta');
            if (provider === 'blip') {
                return Boolean(String(whatsapp.blipContractId || '').trim() && String(whatsapp.blipAuthorizationKey || '').trim());
            }
            if (provider === 'sinch') {
                const mode = String(whatsapp.sinchApiMode || 'conversation');
                if (mode === 'relay' || mode === 'broker') {
                    return Boolean(String(whatsapp.sinchServiceUsername || '').trim() && String(whatsapp.sinchServiceToken || '').trim());
                }
                return Boolean(String(whatsapp.sinchProjectId || '').trim() &&
                    String(whatsapp.sinchAppId || '').trim() &&
                    String(whatsapp.sinchAccessToken || '').trim());
            }
            return Boolean(String(whatsapp.phoneNumberId || '').trim() && String(whatsapp.accessToken || '').trim());
        }
        return false;
    }
    buildProviderStatus(params) {
        const sections = ['openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'];
        const envSettings = params.envSettings || this.getEnvSettings();
        const status = {};
        const scoped = String(params.agentId || '').trim();
        sections.forEach((section) => {
            const agentConfigured = scoped ? this.hasSectionConfig(section, params.scopedStored) : false;
            const globalConfigured = this.hasSectionConfig(section, params.globalStored);
            const envConfigured = section === 'webWidget' ? this.hasEnvWebWidgetConfig() : this.hasSectionConfig(section, envSettings);
            let source = 'none';
            if (agentConfigured)
                source = 'agent';
            else if (globalConfigured)
                source = 'global';
            else if (envConfigured)
                source = 'env';
            status[section] = {
                configured: source !== 'none',
                source,
                scopeConfigured: scoped ? agentConfigured : globalConfigured,
                inherited: scoped ? !agentConfigured && source !== 'none' : source === 'env',
            };
        });
        return status;
    }
    hasEnvWebWidgetConfig() {
        return [
            'CANVAS_FLOW_WIDGET_PRIMARY_COLOR',
            'CANVAS_FLOW_WIDGET_ACCENT_COLOR',
            'CANVAS_FLOW_WIDGET_ASSISTANT_NAME',
            'CANVAS_FLOW_WIDGET_SUBTITLE',
            'CANVAS_FLOW_WIDGET_WELCOME_MESSAGE',
            'CANVAS_FLOW_WIDGET_PLACEHOLDER',
            'CANVAS_FLOW_WIDGET_BUBBLE_LABEL',
            'CANVAS_FLOW_WIDGET_AVATAR_TEXT',
            'CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT',
            'CANVAS_FLOW_WIDGET_POSITION',
        ].some((key) => this.configService.get(key) !== undefined);
    }
    normalizeEffectiveSettings(settings) {
        const next = this.deepMerge(this.getEnvSettings(), settings || {});
        const openaiConfigured = this.hasOpenAIConfig(next);
        const azureConfigured = this.hasAzureOpenAIConfig(next);
        const geminiConfigured = this.hasGeminiConfig(next);
        const claudeConfigured = this.hasClaudeConfig(next);
        const grokConfigured = this.hasGrokConfig(next);
        const bedrockConfigured = this.hasBedrockConfig(next);
        next.openai.enabled = openaiConfigured;
        next.azureOpenai.enabled = azureConfigured;
        next.gemini.enabled = geminiConfigured;
        next.claude.enabled = claudeConfigured;
        next.grok.enabled = grokConfigured;
        next.bedrock.enabled = bedrockConfigured;
        const selected = String(next.llmProvider || 'openai');
        const selectedConfigured = (selected === 'openai' && openaiConfigured) ||
            ((selected === 'azure' || selected === 'azure_openai') && azureConfigured) ||
            (selected === 'gemini' && geminiConfigured) ||
            (selected === 'claude' && claudeConfigured) ||
            (selected === 'grok' && grokConfigured) ||
            (selected === 'bedrock' && bedrockConfigured);
        if (!selectedConfigured) {
            if (openaiConfigured)
                next.llmProvider = 'openai';
            else if (azureConfigured)
                next.llmProvider = 'azure';
            else if (geminiConfigured)
                next.llmProvider = 'gemini';
            else if (claudeConfigured)
                next.llmProvider = 'claude';
            else if (grokConfigured)
                next.llmProvider = 'grok';
            else if (bedrockConfigured)
                next.llmProvider = 'bedrock';
        }
        return next;
    }
    blankSection(section) {
        const defaults = this.getEnvSettings();
        const blanks = {
            openai: {
                enabled: false,
                apiKey: '',
                chatModel: defaults.openai.chatModel || 'gpt-4o',
                embeddingModel: defaults.openai.embeddingModel || 'text-embedding-3-large',
                ocrModel: defaults.openai.ocrModel || 'gpt-4o',
            },
            azureOpenai: {
                enabled: false,
                apiKey: '',
                endpoint: '',
                apiVersion: defaults.azureOpenai.apiVersion || '2024-02-15-preview',
                chatDeploymentName: '',
                embeddingDeploymentName: '',
                ocrDeploymentName: '',
                embeddingDimensions: defaults.azureOpenai.embeddingDimensions || 3072,
            },
            gemini: {
                enabled: false,
                apiKey: '',
                chatModel: defaults.gemini.chatModel || 'gemini-3.5-flash',
            },
            claude: {
                enabled: false,
                apiKey: '',
                chatModel: defaults.claude.chatModel || 'claude-sonnet-4-6',
            },
            grok: {
                enabled: false,
                apiKey: '',
                baseUrl: defaults.grok.baseUrl || 'https://api.x.ai/v1',
                chatModel: defaults.grok.chatModel || 'grok-2-latest',
            },
            bedrock: {
                enabled: false,
                apiKey: '',
                baseUrl: '',
                region: defaults.bedrock.region || 'us-east-1',
                chatModel: defaults.bedrock.chatModel || 'anthropic.claude-sonnet-4-6',
            },
            milvus: {
                address: '',
                token: '',
                username: '',
                password: '',
                collectionName: defaults.milvus.collectionName || 'canvas_flow_docs',
            },
            azureBlob: {
                connectionString: '',
                containerName: '',
            },
            azureSearch: {
                endpoint: '',
                apiKey: '',
                indexName: '',
                apiVersion: defaults.azureSearch.apiVersion || '2024-07-01',
            },
            mongodb: {
                connectionString: '',
                databaseName: '',
            },
            webWidget: {
                primaryColor: defaults.webWidget.primaryColor || '#0f6bff',
                accentColor: defaults.webWidget.accentColor || '#00b37e',
                assistantName: defaults.webWidget.assistantName || 'Assistente IA',
                subtitle: defaults.webWidget.subtitle || 'Online agora',
                welcomeMessage: defaults.webWidget.welcomeMessage || 'Ola! Como posso ajudar?',
                placeholder: defaults.webWidget.placeholder || 'Digite sua mensagem',
                bubbleLabel: defaults.webWidget.bubbleLabel || 'Precisa de ajuda?',
                avatarText: defaults.webWidget.avatarText || 'IA',
                openByDefault: defaults.webWidget.openByDefault === true,
                position: defaults.webWidget.position === 'left' ? 'left' : 'right',
            },
            whatsapp: {
                provider: 'meta',
                deliveryMode: 'provider',
                autoReply: true,
                verifyToken: '',
                businessAccountId: '',
                phoneNumberId: '',
                accessToken: '',
                graphApiVersion: defaults.whatsapp.graphApiVersion || 'v20.0',
                blipContractId: '',
                blipAuthorizationKey: '',
                sinchProjectId: '',
                sinchAppId: '',
                sinchRegion: defaults.whatsapp.sinchRegion || 'us',
                sinchAccessToken: '',
                sinchChannel: defaults.whatsapp.sinchChannel || 'WHATSAPP',
                sinchApiMode: 'conversation',
                sinchServiceNumber: '',
                sinchServiceUsername: '',
                sinchServiceToken: '',
            },
        };
        return blanks[section];
    }
    async getStoredSettings(key) {
        const row = await this.model.findOne({ key }).lean().exec().catch(() => null);
        return this.decryptStoredSettings(row?.settings || {});
    }
    async getEffectiveSettings(agentId) {
        const key = this.configKey(agentId);
        const now = Date.now();
        const cached = this.effectiveSettingsCache.get(key);
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        let settings;
        if (this.model.db.readyState !== 1) {
            settings = this.normalizeEffectiveSettings(this.getEnvSettings());
        }
        else {
            const globalStored = await this.getStoredSettings(provider_config_constants_model_1.GLOBAL_CONFIG_KEY);
            if (key === provider_config_constants_model_1.GLOBAL_CONFIG_KEY) {
                settings = this.buildEffectiveSettings(globalStored);
            }
            else {
                const scopedStored = await this.getStoredSettings(key);
                settings = this.buildEffectiveSettings(this.deepMergeFallback(globalStored, scopedStored));
            }
        }
        this.effectiveSettingsCache.set(key, {
            value: settings,
            expiresAt: now + Number(this.configService.get('CANVAS_FLOW_PROVIDER_CACHE_MS') || 10000),
        });
        return settings;
    }
    async getSafeSettings(agentId) {
        const key = this.configKey(agentId);
        let globalStored = {};
        let scopedStored = {};
        if (this.model.db.readyState === 1) {
            globalStored = await this.getStoredSettings(provider_config_constants_model_1.GLOBAL_CONFIG_KEY);
            if (key !== provider_config_constants_model_1.GLOBAL_CONFIG_KEY)
                scopedStored = await this.getStoredSettings(key);
        }
        return this.maskSafe(await this.getEffectiveSettings(agentId), this.buildProviderStatus({ agentId, globalStored, scopedStored, envSettings: this.getEnvSettings() }));
    }
    async updateSettings(patch, updatedBy, agentId) {
        if (this.model.db.readyState !== 1) {
            throw new common_1.BadRequestException('MongoDB ainda nao esta conectado para salvar configuracoes.');
        }
        const key = this.configKey(agentId);
        const currentRow = await this.model.findOne({ key }).lean().exec();
        const currentStored = this.decryptStoredSettings(currentRow?.settings || {});
        const nextStored = this.mergePatchPreservingSecrets(currentStored, patch || {});
        await this.model
            .findOneAndUpdate({ key }, { key, settings: this.encryptSettings(nextStored), updatedBy }, { upsert: true, new: true })
            .lean()
            .exec();
        this.clearEffectiveSettingsCache();
        return await this.getSafeSettings(agentId);
    }
    async clearSection(section, updatedBy, agentId) {
        if (!['openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'].includes(section)) {
            throw new common_1.BadRequestException('Provider invalido.');
        }
        if (this.model.db.readyState !== 1) {
            throw new common_1.BadRequestException('MongoDB ainda nao esta conectado para salvar configuracoes.');
        }
        const key = this.configKey(agentId);
        const target = section;
        const currentRow = await this.model.findOne({ key }).lean().exec();
        const nextStored = this.decryptStoredSettings(currentRow?.settings || {});
        delete nextStored[target];
        if (target === 'openai' && nextStored.llmProvider === 'openai') {
            delete nextStored.llmProvider;
        }
        if (target === 'azureOpenai' && (nextStored.llmProvider === 'azure' || nextStored.llmProvider === 'azure_openai')) {
            delete nextStored.llmProvider;
        }
        if (['gemini', 'claude', 'grok', 'bedrock'].includes(target) && nextStored.llmProvider === target) {
            delete nextStored.llmProvider;
        }
        await this.model
            .findOneAndUpdate({ key }, { key, settings: this.encryptSettings(nextStored), updatedBy }, { upsert: true, new: true })
            .lean()
            .exec();
        this.clearEffectiveSettingsCache();
        return await this.getSafeSettings(agentId);
    }
    toOpenAIRuntimeConfig(settings, provider) {
        const normalizedProvider = String(provider || settings.llmProvider || 'openai').toLowerCase();
        const selectedProvider = normalizedProvider === 'azure' || normalizedProvider === 'azure_openai' || normalizedProvider === 'azure-openai'
            ? 'azure'
            : normalizedProvider === 'openai'
                ? 'openai'
                : ['gemini', 'claude', 'grok', 'bedrock'].includes(normalizedProvider)
                    ? normalizedProvider
                    : settings.llmProvider;
        return {
            openaiProvider: selectedProvider,
            openaiApiKey: settings.openai.apiKey,
            openaiChatModel: settings.openai.chatModel,
            openaiEmbeddingModel: settings.openai.embeddingModel,
            openaiOcrModel: settings.openai.ocrModel,
            azureOpenAIEnabled: selectedProvider === 'azure',
            azureOpenAIApiKey: settings.azureOpenai.apiKey,
            azureOpenAIApiVersion: settings.azureOpenai.apiVersion,
            azureOpenAIEndpoint: settings.azureOpenai.endpoint,
            azureOpenAIChatDeployment: settings.azureOpenai.chatDeploymentName,
            azureOpenAIEmbeddingDeployment: settings.azureOpenai.embeddingDeploymentName,
            azureOpenAIOcrDeployment: settings.azureOpenai.ocrDeploymentName,
            geminiApiKey: settings.gemini?.apiKey || '',
            geminiChatModel: settings.gemini?.chatModel || '',
            claudeApiKey: settings.claude?.apiKey || '',
            claudeChatModel: settings.claude?.chatModel || '',
            grokApiKey: settings.grok?.apiKey || '',
            grokBaseUrl: settings.grok?.baseUrl || '',
            grokChatModel: settings.grok?.chatModel || '',
            bedrockApiKey: settings.bedrock?.apiKey || '',
            bedrockBaseUrl: settings.bedrock?.baseUrl || '',
            bedrockRegion: settings.bedrock?.region || '',
            bedrockChatModel: settings.bedrock?.chatModel || '',
        };
    }
};
exports.ProviderConfigService = ProviderConfigService;
exports.ProviderConfigService = ProviderConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(provider_config_constants_model_1.MODEL_NAME)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        config_1.ConfigService])
], ProviderConfigService);
//# sourceMappingURL=provider-config-service.js.map