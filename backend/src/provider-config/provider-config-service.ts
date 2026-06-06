import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { GLOBAL_CONFIG_KEY, MODEL_NAME } from './provider-config-constants-model';
import { ProviderConfigEntity } from './provider-config-schema';

export interface OpenAIRuntimeConfig {
  openaiProvider?: string;
  openaiApiKey?: string;
  openaiChatModel?: string;
  openaiEmbeddingModel?: string;
  openaiOcrModel?: string;
  azureOpenAIEnabled?: boolean;
  azureOpenAIApiKey?: string;
  azureOpenAIApiVersion?: string;
  azureOpenAIEndpoint?: string;
  azureOpenAIChatDeployment?: string;
  azureOpenAIEmbeddingDeployment?: string;
  azureOpenAIOcrDeployment?: string;
  geminiApiKey?: string;
  geminiChatModel?: string;
  claudeApiKey?: string;
  claudeChatModel?: string;
  grokApiKey?: string;
  grokBaseUrl?: string;
  grokChatModel?: string;
  bedrockApiKey?: string;
  bedrockBaseUrl?: string;
  bedrockRegion?: string;
  bedrockChatModel?: string;
}

export interface ProviderSettings {
  llmProvider: 'openai' | 'azure' | 'azure_openai' | 'gemini' | 'claude' | 'grok' | 'bedrock';
  openai: {
    enabled: boolean;
    apiKey: string;
    chatModel: string;
    embeddingModel: string;
    ocrModel: string;
  };
  azureOpenai: {
    enabled: boolean;
    apiKey: string;
    endpoint: string;
    apiVersion: string;
    chatDeploymentName: string;
    embeddingDeploymentName: string;
    ocrDeploymentName: string;
    embeddingDimensions: number;
  };
  gemini: {
    enabled: boolean;
    apiKey: string;
    chatModel: string;
  };
  claude: {
    enabled: boolean;
    apiKey: string;
    chatModel: string;
  };
  grok: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    chatModel: string;
  };
  bedrock: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    region: string;
    chatModel: string;
  };
  milvus: {
    address: string;
    token: string;
    username: string;
    password: string;
    collectionName: string;
  };
  azureBlob: {
    connectionString: string;
    containerName: string;
  };
  azureSearch: {
    endpoint: string;
    apiKey: string;
    indexName: string;
    apiVersion: string;
  };
  mongodb: {
    connectionString: string;
    databaseName: string;
  };
  webWidget: {
    primaryColor: string;
    accentColor: string;
    assistantName: string;
    subtitle: string;
    welcomeMessage: string;
    placeholder: string;
    bubbleLabel: string;
    avatarText: string;
    openByDefault: boolean;
    position: 'right' | 'left';
  };
  whatsapp: {
    provider: 'meta' | 'blip' | 'sinch';
    deliveryMode: 'provider' | 'apiResponse';
    autoReply: boolean;
    verifyToken: string;
    businessAccountId: string;
    phoneNumberId: string;
    accessToken: string;
    graphApiVersion: string;
    blipContractId: string;
    blipAuthorizationKey: string;
    sinchProjectId: string;
    sinchAppId: string;
    sinchRegion: string;
    sinchAccessToken: string;
    sinchChannel: string;
    sinchApiMode: 'conversation' | 'relay';
    sinchServiceNumber: string;
    sinchServiceUsername: string;
    sinchServiceToken: string;
  };
}

export type ProviderConfigSection = 'openai' | 'azureOpenai' | 'gemini' | 'claude' | 'grok' | 'bedrock' | 'milvus' | 'azureBlob' | 'azureSearch' | 'mongodb' | 'webWidget' | 'whatsapp';
type ProviderConfigSource = 'agent' | 'global' | 'env' | 'none';

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

@Injectable()
export class ProviderConfigService {
  private effectiveSettingsCache = new Map<string, { value: ProviderSettings; expiresAt: number }>();

  constructor(
    @Inject(MODEL_NAME) private model: Model<ProviderConfigEntity>,
    private readonly configService: ConfigService,
  ) {}

  private clearEffectiveSettingsCache() {
    this.effectiveSettingsCache.clear();
  }

  private configKey(agentId?: string) {
    const normalized = String(agentId || '').trim();
    return normalized ? `agent:${normalized}` : GLOBAL_CONFIG_KEY;
  }

  private envFlag(value: any) {
    return ['true', '1', 'yes', 'sim'].includes(String(value || '').trim().toLowerCase());
  }

  private encryptSecret(value: string) {
    const plain = String(value || '');
    if (!plain) return '';
    const key = createHash('sha256').update(this.secretKey()).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
  }

  private decryptSecret(value: any) {
    const raw = String(value || '');
    if (!raw.startsWith('enc:')) return raw;
    try {
      const payload = Buffer.from(raw.slice(4), 'base64url');
      const iv = payload.subarray(0, 12);
      const tag = payload.subarray(12, 28);
      const encrypted = payload.subarray(28);
      const key = createHash('sha256').update(this.secretKey()).digest();
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }

  private secretKey() {
    return (
      this.configService.get<string>('CANVAS_FLOW_JWT_SECRET') ||
      this.configService.get<string>('CANVAS_FLOW_API_TOKEN') ||
      this.configService.get<string>('MONGO_DB_CONNECTION_STRING') ||
      'canvas-flow-provider-config-dev-secret'
    );
  }

  getEnvSettings(): ProviderSettings {
    const azureEnabled = this.envFlag(this.configService.get<string>('AZURE_OPENAI_ENABLED'));
    const provider = String(this.configService.get<string>('OPENAI_PROVIDER') || '').toLowerCase();
    const llmProvider = ['azure', 'azure_openai', 'azure-openai'].includes(provider) || azureEnabled
      ? 'azure'
      : ['gemini', 'claude', 'grok', 'bedrock'].includes(provider)
        ? provider as ProviderSettings['llmProvider']
        : 'openai';

    return {
      llmProvider,
      openai: {
        enabled: llmProvider !== 'azure',
        apiKey: this.configService.get<string>('OPENAI_API_KEY') || '',
        chatModel: this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o',
        embeddingModel: this.configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-large',
        ocrModel: this.configService.get<string>('OPENAI_OCR_MODEL') || 'gpt-4o',
      },
      azureOpenai: {
        enabled: llmProvider === 'azure',
        apiKey: this.configService.get<string>('AZURE_OPENAI_API_KEY') || '',
        endpoint: this.configService.get<string>('AZURE_OPENAI_ENDPOINT') || this.configService.get<string>('AZURE_OPENAI_API_BASE_PATH') || '',
        apiVersion: this.configService.get<string>('AZURE_OPENAI_API_VERSION') || '2024-02-15-preview',
        chatDeploymentName: this.configService.get<string>('AZURE_OPENAI_API_CHAT_DEPLOYMENT_NAME') || '',
        embeddingDeploymentName: this.configService.get<string>('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME') || '',
        ocrDeploymentName: this.configService.get<string>('AZURE_OPENAI_OCR_DEPLOYMENT_NAME') || '',
        embeddingDimensions: Number(this.configService.get<string>('AZURE_OPENAI_EMBEDDING_DIMENSIONS') || 3072),
      },
      gemini: {
        enabled: llmProvider === 'gemini',
        apiKey: this.configService.get<string>('GEMINI_API_KEY') || this.configService.get<string>('GOOGLE_AI_API_KEY') || '',
        chatModel: this.configService.get<string>('GEMINI_CHAT_MODEL') || this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash',
      },
      claude: {
        enabled: llmProvider === 'claude',
        apiKey: this.configService.get<string>('ANTHROPIC_API_KEY') || this.configService.get<string>('CLAUDE_API_KEY') || '',
        chatModel: this.configService.get<string>('CLAUDE_CHAT_MODEL') || this.configService.get<string>('ANTHROPIC_MODEL') || 'claude-sonnet-4-6',
      },
      grok: {
        enabled: llmProvider === 'grok',
        apiKey: this.configService.get<string>('XAI_API_KEY') || this.configService.get<string>('GROK_API_KEY') || '',
        baseUrl: this.configService.get<string>('XAI_BASE_URL') || this.configService.get<string>('GROK_BASE_URL') || 'https://api.x.ai/v1',
        chatModel: this.configService.get<string>('GROK_CHAT_MODEL') || this.configService.get<string>('XAI_MODEL') || 'grok-2-latest',
      },
      bedrock: {
        enabled: llmProvider === 'bedrock',
        apiKey: this.configService.get<string>('BEDROCK_API_KEY') || '',
        baseUrl: this.configService.get<string>('BEDROCK_BASE_URL') || '',
        region: this.configService.get<string>('AWS_REGION') || this.configService.get<string>('BEDROCK_REGION') || 'us-east-1',
        chatModel: this.configService.get<string>('BEDROCK_CHAT_MODEL') || this.configService.get<string>('BEDROCK_MODEL') || 'anthropic.claude-sonnet-4-6',
      },
      milvus: {
        address: this.configService.get<string>('MILVUS_ADDRESS') || '',
        token: this.configService.get<string>('MILVUS_TOKEN') || '',
        username: this.configService.get<string>('MILVUS_USERNAME') || '',
        password: this.configService.get<string>('MILVUS_PASSWORD') || '',
        collectionName: this.configService.get<string>('COLLECTION_NAME') || 'canvas_flow_docs',
      },
      azureBlob: {
        connectionString: this.configService.get<string>('BLOB_STRING_CONNECTION') || this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING') || '',
        containerName: this.configService.get<string>('BLOB_CONTAINER_NAME') || this.configService.get<string>('AZURE_BLOB_CONTAINER_NAME') || '',
      },
      azureSearch: {
        endpoint: this.configService.get<string>('AZURE_SEARCH_API_BASE_PATH') || this.configService.get<string>('AZURE_SEARCH_ENDPOINT') || '',
        apiKey: this.configService.get<string>('AZURE_SEARCH_API_KEY') || this.configService.get<string>('AZURE_SEARCH_KEY') || '',
        indexName: this.configService.get<string>('AZURE_SEARCH_INDEX_NAME') || '',
        apiVersion: this.configService.get<string>('AZURE_SEARCH_API_VERSION') || '2024-07-01',
      },
      mongodb: {
        connectionString: this.configService.get<string>('MONGO_COMPONENT_CONNECTION_STRING') || '',
        databaseName: this.configService.get<string>('MONGO_COMPONENT_DB_NAME') || '',
      },
      webWidget: {
        primaryColor: this.configService.get<string>('CANVAS_FLOW_WIDGET_PRIMARY_COLOR') || '#0f6bff',
        accentColor: this.configService.get<string>('CANVAS_FLOW_WIDGET_ACCENT_COLOR') || '#00b37e',
        assistantName: this.configService.get<string>('CANVAS_FLOW_WIDGET_ASSISTANT_NAME') || 'Assistente IA',
        subtitle: this.configService.get<string>('CANVAS_FLOW_WIDGET_SUBTITLE') || 'Online agora',
        welcomeMessage: this.configService.get<string>('CANVAS_FLOW_WIDGET_WELCOME_MESSAGE') || 'Ola! Como posso ajudar?',
        placeholder: this.configService.get<string>('CANVAS_FLOW_WIDGET_PLACEHOLDER') || 'Digite sua mensagem',
        bubbleLabel: this.configService.get<string>('CANVAS_FLOW_WIDGET_BUBBLE_LABEL') || 'Precisa de ajuda?',
        avatarText: this.configService.get<string>('CANVAS_FLOW_WIDGET_AVATAR_TEXT') || 'IA',
        openByDefault:
          this.configService.get<string>('CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT') === undefined
            ? false
            : this.envFlag(this.configService.get<string>('CANVAS_FLOW_WIDGET_OPEN_BY_DEFAULT')),
        position: this.configService.get<string>('CANVAS_FLOW_WIDGET_POSITION') === 'left' ? 'left' : 'right',
      },
      whatsapp: {
        provider: (this.configService.get<string>('WHATSAPP_PROVIDER') as any) || 'meta',
        deliveryMode: (this.configService.get<string>('WHATSAPP_DELIVERY_MODE') as any) || 'provider',
        autoReply:
          this.configService.get<string>('WHATSAPP_AUTO_REPLY') === undefined
            ? true
            : this.envFlag(this.configService.get<string>('WHATSAPP_AUTO_REPLY')),
        verifyToken: this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || '',
        businessAccountId: this.configService.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID') || this.configService.get<string>('WHATSAPP_WABA_ID') || '',
        phoneNumberId: this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '',
        accessToken: this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '',
        graphApiVersion: this.configService.get<string>('WHATSAPP_GRAPH_API_VERSION') || 'v20.0',
        blipContractId: this.configService.get<string>('BLIP_CONTRACT_ID') || '',
        blipAuthorizationKey: this.configService.get<string>('BLIP_AUTHORIZATION_KEY') || '',
        sinchProjectId: this.configService.get<string>('SINCH_PROJECT_ID') || '',
        sinchAppId: this.configService.get<string>('SINCH_APP_ID') || '',
        sinchRegion: this.configService.get<string>('SINCH_REGION') || 'us',
        sinchAccessToken: this.configService.get<string>('SINCH_ACCESS_TOKEN') || '',
        sinchChannel: this.configService.get<string>('SINCH_CHANNEL') || 'WHATSAPP',
        sinchApiMode: (this.configService.get<string>('SINCH_API_MODE') as any) || 'conversation',
        sinchServiceNumber: this.configService.get<string>('SINCH_SERVICE_NUMBER') || '',
        sinchServiceUsername: this.configService.get<string>('SINCH_SERVICE_USERNAME') || '',
        sinchServiceToken: this.configService.get<string>('SINCH_SERVICE_TOKEN') || '',
      },
    };
  }

  private deepMerge<T>(base: T, override: any): T {
    if (!override || typeof override !== 'object') return base;
    const output: any = Array.isArray(base) ? [...base] : { ...(base as any) };
    Object.entries(override).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
        output[key] = this.deepMerge(output[key], value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  private deepMergeFallback<T>(base: T, override: any): T {
    if (!override || typeof override !== 'object') return base;
    const output: any = Array.isArray(base) ? [...base] : { ...(base as any) };
    Object.entries(override).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
        output[key] = this.deepMergeFallback(output[key], value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  private walkSecrets(settings: any, visitor: (path: string, value: any) => any, prefix = '') {
    if (!settings || typeof settings !== 'object') return settings;
    const output: any = Array.isArray(settings) ? [...settings] : { ...settings };
    Object.keys(output).forEach((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (SECRET_PATHS.has(path)) {
        output[key] = visitor(path, output[key]);
      } else if (output[key] && typeof output[key] === 'object') {
        output[key] = this.walkSecrets(output[key], visitor, path);
      }
    });
    return output;
  }

  private decryptStoredSettings(settings: any) {
    return this.walkSecrets(settings || {}, (_path, value) => this.decryptSecret(value));
  }

  private buildEffectiveSettings(storedSettings: any): ProviderSettings {
    return this.normalizeEffectiveSettings(this.deepMergeFallback(this.getEnvSettings(), storedSettings || {}));
  }

  private decryptSettings(settings: any): ProviderSettings {
    return this.buildEffectiveSettings(this.decryptStoredSettings(settings));
  }

  private encryptSettings(settings: any) {
    return this.walkSecrets(settings || {}, (_path, value) => this.encryptSecret(value));
  }

  private sanitizeSettingsPatch(patch: any) {
    const allowedSections = ['llmProvider', 'openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'];
    const clean: Record<string, any> = {};
    allowedSections.forEach((section) => {
      if (patch?.[section] !== undefined) clean[section] = patch[section];
    });
    if (clean.llmProvider && !['openai', 'azure', 'azure_openai', 'gemini', 'claude', 'grok', 'bedrock'].includes(clean.llmProvider)) {
      throw new BadRequestException('llmProvider invalido.');
    }
    if (clean.azureOpenai?.embeddingDimensions !== undefined) {
      clean.azureOpenai.embeddingDimensions = Math.max(1, Number(clean.azureOpenai.embeddingDimensions) || 3072);
    }
    if (clean.whatsapp?.provider && !['meta', 'blip', 'sinch'].includes(clean.whatsapp.provider)) {
      throw new BadRequestException('whatsapp.provider invalido.');
    }
    if (clean.whatsapp?.deliveryMode && !['provider', 'apiResponse'].includes(clean.whatsapp.deliveryMode)) {
      throw new BadRequestException('whatsapp.deliveryMode invalido.');
    }
    if (clean.whatsapp?.sinchApiMode && !['conversation', 'relay'].includes(clean.whatsapp.sinchApiMode)) {
      throw new BadRequestException('whatsapp.sinchApiMode invalido.');
    }
    if (clean.webWidget?.position && !['right', 'left'].includes(clean.webWidget.position)) {
      throw new BadRequestException('webWidget.position invalido.');
    }
    return clean;
  }

  private mergePatchPreservingSecrets(current: any, patch: any) {
    const cleanPatch = this.sanitizeSettingsPatch(patch);
    const merged = this.deepMerge(current, cleanPatch);
    SECRET_PATHS.forEach((path) => {
      const incoming = path.split('.').reduce((acc, key) => acc?.[key], cleanPatch);
      if (incoming === '' || incoming === undefined || incoming === null) {
        const keys = path.split('.');
        const value = keys.reduce((acc, key) => acc?.[key], current as any);
        let cursor: any = merged;
        keys.slice(0, -1).forEach((key) => {
          cursor[key] = cursor[key] || {};
          cursor = cursor[key];
        });
        cursor[keys[keys.length - 1]] = value || '';
      }
    });
    return merged;
  }

  private maskSafe(settings: ProviderSettings, providerStatus?: Record<ProviderConfigSection, any>) {
    const secretStatus: Record<string, boolean> = {};
    const safe = this.walkSecrets(settings, (path, value) => {
      secretStatus[path] = Boolean(String(value || '').trim());
      return '';
    });
    return { settings: safe, secretStatus, ...(providerStatus ? { providerStatus } : {}) };
  }

  private hasOpenAIConfig(settings: ProviderSettings) {
    return Boolean(String(settings.openai?.apiKey || '').trim());
  }

  private hasAzureOpenAIConfig(settings: ProviderSettings) {
    return Boolean(
      String(settings.azureOpenai?.endpoint || '').trim() &&
      String(settings.azureOpenai?.apiKey || '').trim(),
    );
  }

  private hasGeminiConfig(settings: ProviderSettings) {
    return Boolean(String(settings.gemini?.apiKey || '').trim());
  }

  private hasClaudeConfig(settings: ProviderSettings) {
    return Boolean(String(settings.claude?.apiKey || '').trim());
  }

  private hasGrokConfig(settings: ProviderSettings) {
    return Boolean(String(settings.grok?.apiKey || '').trim());
  }

  private hasBedrockConfig(settings: ProviderSettings) {
    return Boolean(String(settings.bedrock?.apiKey || '').trim() && String(settings.bedrock?.baseUrl || '').trim());
  }

  private hasSectionConfig(section: ProviderConfigSection, settings: any) {
    if (!settings || typeof settings !== 'object') return false;
    if (section === 'openai') return Boolean(String(settings.openai?.apiKey || '').trim());
    if (section === 'azureOpenai') {
      return Boolean(String(settings.azureOpenai?.endpoint || '').trim() && String(settings.azureOpenai?.apiKey || '').trim());
    }
    if (section === 'gemini') return Boolean(String(settings.gemini?.apiKey || '').trim());
    if (section === 'claude') return Boolean(String(settings.claude?.apiKey || '').trim());
    if (section === 'grok') return Boolean(String(settings.grok?.apiKey || '').trim());
    if (section === 'bedrock') return Boolean(String(settings.bedrock?.apiKey || '').trim() && String(settings.bedrock?.baseUrl || '').trim());
    if (section === 'milvus') {
      return Boolean(
        String(settings.milvus?.address || '').trim() ||
        String(settings.milvus?.token || '').trim() ||
        String(settings.milvus?.username || '').trim() ||
        String(settings.milvus?.password || '').trim()
      );
    }
    if (section === 'azureBlob') {
      return Boolean(String(settings.azureBlob?.connectionString || '').trim() || String(settings.azureBlob?.containerName || '').trim());
    }
    if (section === 'azureSearch') {
      return Boolean(
        String(settings.azureSearch?.endpoint || '').trim() ||
        String(settings.azureSearch?.apiKey || '').trim() ||
        String(settings.azureSearch?.indexName || '').trim()
      );
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
        return Boolean(
          String(whatsapp.sinchProjectId || '').trim() &&
          String(whatsapp.sinchAppId || '').trim() &&
          String(whatsapp.sinchAccessToken || '').trim()
        );
      }
      return Boolean(String(whatsapp.phoneNumberId || '').trim() && String(whatsapp.accessToken || '').trim());
    }
    return false;
  }

  private buildProviderStatus(params: {
    agentId?: string;
    globalStored?: any;
    scopedStored?: any;
    envSettings?: ProviderSettings;
  }) {
    const sections: ProviderConfigSection[] = ['openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'];
    const envSettings = params.envSettings || this.getEnvSettings();
    const status: Record<ProviderConfigSection, any> = {} as any;
    const scoped = String(params.agentId || '').trim();

    sections.forEach((section) => {
      const agentConfigured = scoped ? this.hasSectionConfig(section, params.scopedStored) : false;
      const globalConfigured = this.hasSectionConfig(section, params.globalStored);
      const envConfigured = section === 'webWidget' ? this.hasEnvWebWidgetConfig() : this.hasSectionConfig(section, envSettings);
      let source: ProviderConfigSource = 'none';
      if (agentConfigured) source = 'agent';
      else if (globalConfigured) source = 'global';
      else if (envConfigured) source = 'env';

      status[section] = {
        configured: source !== 'none',
        source,
        scopeConfigured: scoped ? agentConfigured : globalConfigured,
        inherited: scoped ? !agentConfigured && source !== 'none' : source === 'env',
      };
    });

    return status;
  }

  private hasEnvWebWidgetConfig() {
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
    ].some((key) => this.configService.get<string>(key) !== undefined);
  }

  private normalizeEffectiveSettings(settings: ProviderSettings): ProviderSettings {
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
    const selectedConfigured =
      (selected === 'openai' && openaiConfigured) ||
      ((selected === 'azure' || selected === 'azure_openai') && azureConfigured) ||
      (selected === 'gemini' && geminiConfigured) ||
      (selected === 'claude' && claudeConfigured) ||
      (selected === 'grok' && grokConfigured) ||
      (selected === 'bedrock' && bedrockConfigured);

    if (!selectedConfigured) {
      if (openaiConfigured) next.llmProvider = 'openai';
      else if (azureConfigured) next.llmProvider = 'azure';
      else if (geminiConfigured) next.llmProvider = 'gemini';
      else if (claudeConfigured) next.llmProvider = 'claude';
      else if (grokConfigured) next.llmProvider = 'grok';
      else if (bedrockConfigured) next.llmProvider = 'bedrock';
    }

    return next;
  }

  private blankSection(section: ProviderConfigSection) {
    const defaults = this.getEnvSettings();
    const blanks: Record<ProviderConfigSection, any> = {
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

  private async getStoredSettings(key: string) {
    const row = await this.model.findOne({ key }).lean().exec().catch(() => null);
    return this.decryptStoredSettings(row?.settings || {});
  }

  async getEffectiveSettings(agentId?: string) {
    const key = this.configKey(agentId);
    const now = Date.now();
    const cached = this.effectiveSettingsCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    let settings: ProviderSettings;
    if (this.model.db.readyState !== 1) {
      settings = this.normalizeEffectiveSettings(this.getEnvSettings());
    } else {
      const globalStored = await this.getStoredSettings(GLOBAL_CONFIG_KEY);
      if (key === GLOBAL_CONFIG_KEY) {
        settings = this.buildEffectiveSettings(globalStored);
      } else {
        const scopedStored = await this.getStoredSettings(key);
        settings = this.buildEffectiveSettings(this.deepMergeFallback(globalStored, scopedStored));
      }
    }

    this.effectiveSettingsCache.set(key, {
      value: settings,
      expiresAt: now + Number(this.configService.get<string>('CANVAS_FLOW_PROVIDER_CACHE_MS') || 10000),
    });
    return settings;
  }

  async getSafeSettings(agentId?: string) {
    const key = this.configKey(agentId);
    let globalStored = {};
    let scopedStored = {};
    if (this.model.db.readyState === 1) {
      globalStored = await this.getStoredSettings(GLOBAL_CONFIG_KEY);
      if (key !== GLOBAL_CONFIG_KEY) scopedStored = await this.getStoredSettings(key);
    }
    return this.maskSafe(
      await this.getEffectiveSettings(agentId),
      this.buildProviderStatus({ agentId, globalStored, scopedStored, envSettings: this.getEnvSettings() }),
    );
  }

  async updateSettings(patch: any, updatedBy?: string, agentId?: string) {
    if (this.model.db.readyState !== 1) {
      throw new BadRequestException('MongoDB ainda nao esta conectado para salvar configuracoes.');
    }
    const key = this.configKey(agentId);
    const currentRow = await this.model.findOne({ key }).lean().exec();
    const currentStored = this.decryptStoredSettings(currentRow?.settings || {});
    const nextStored = this.mergePatchPreservingSecrets(currentStored, patch || {});
    await this.model
      .findOneAndUpdate(
        { key },
        { key, settings: this.encryptSettings(nextStored), updatedBy },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    this.clearEffectiveSettingsCache();
    return await this.getSafeSettings(agentId);
  }

  async clearSection(section: string, updatedBy?: string, agentId?: string) {
    if (!['openai', 'azureOpenai', 'gemini', 'claude', 'grok', 'bedrock', 'milvus', 'azureBlob', 'azureSearch', 'mongodb', 'webWidget', 'whatsapp'].includes(section)) {
      throw new BadRequestException('Provider invalido.');
    }
    if (this.model.db.readyState !== 1) {
      throw new BadRequestException('MongoDB ainda nao esta conectado para salvar configuracoes.');
    }

    const key = this.configKey(agentId);
    const target = section as ProviderConfigSection;
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
      .findOneAndUpdate(
        { key },
        { key, settings: this.encryptSettings(nextStored), updatedBy },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    this.clearEffectiveSettingsCache();

    return await this.getSafeSettings(agentId);
  }

  toOpenAIRuntimeConfig(settings: ProviderSettings, provider?: string): OpenAIRuntimeConfig {
    const normalizedProvider = String(provider || settings.llmProvider || 'openai').toLowerCase();
    const selectedProvider =
      normalizedProvider === 'azure' || normalizedProvider === 'azure_openai' || normalizedProvider === 'azure-openai'
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
}
