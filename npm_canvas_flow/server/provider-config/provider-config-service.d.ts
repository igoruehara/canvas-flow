import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
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
export declare class ProviderConfigService {
    private model;
    private readonly configService;
    private effectiveSettingsCache;
    constructor(model: Model<ProviderConfigEntity>, configService: ConfigService);
    private clearEffectiveSettingsCache;
    private configKey;
    private envFlag;
    private encryptSecret;
    private decryptSecret;
    private secretKey;
    getEnvSettings(): ProviderSettings;
    private deepMerge;
    private deepMergeFallback;
    private walkSecrets;
    private decryptStoredSettings;
    private buildEffectiveSettings;
    private decryptSettings;
    private encryptSettings;
    private sanitizeSettingsPatch;
    private mergePatchPreservingSecrets;
    private maskSafe;
    private hasOpenAIConfig;
    private hasAzureOpenAIConfig;
    private hasGeminiConfig;
    private hasClaudeConfig;
    private hasGrokConfig;
    private hasBedrockConfig;
    private hasSectionConfig;
    private buildProviderStatus;
    private hasEnvWebWidgetConfig;
    private normalizeEffectiveSettings;
    private blankSection;
    private getStoredSettings;
    getEffectiveSettings(agentId?: string): Promise<ProviderSettings>;
    getSafeSettings(agentId?: string): Promise<{
        providerStatus?: Record<ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
    updateSettings(patch: any, updatedBy?: string, agentId?: string): Promise<{
        providerStatus?: Record<ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
    clearSection(section: string, updatedBy?: string, agentId?: string): Promise<{
        providerStatus?: Record<ProviderConfigSection, any>;
        settings: any;
        secretStatus: Record<string, boolean>;
    }>;
    toOpenAIRuntimeConfig(settings: ProviderSettings, provider?: string): OpenAIRuntimeConfig;
}
