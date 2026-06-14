import { BadRequestException } from '@nestjs/common';
import { ProviderConfigService } from './provider-config-service';

const secretPaths = [
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
  'whatsapp.embeddedSignupAppSecret',
  'whatsapp.blipAuthorizationKey',
  'whatsapp.sinchAccessToken',
  'whatsapp.sinchServiceToken',
];

const getPath = (value: any, path: string) => (
  path.split('.').reduce((cursor, key) => cursor?.[key], value)
);

const createQuery = (value: any) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

const createService = (env: Record<string, any> = {}) => {
  const store = new Map<string, any>();
  const model = {
    db: { readyState: 1 },
    findOne: jest.fn((filter: { key: string }) => createQuery(store.get(filter.key) || null)),
    findOneAndUpdate: jest.fn((filter: { key: string }, update: any) => {
      const row = {
        key: update.key,
        settings: update.settings,
        updatedBy: update.updatedBy,
      };
      store.set(filter.key, row);
      return createQuery(row);
    }),
  };
  const configService = {
    get: jest.fn((key: string) => env[key]),
  };
  const service = new ProviderConfigService(model as any, configService as any);
  return { service, model, store, configService };
};

describe('ProviderConfigService provider settings contract', () => {
  it('encrypts every secret path at rest and masks secrets in safe responses', async () => {
    const { service, store } = createService({
      CANVAS_FLOW_JWT_SECRET: 'unit-test-secret',
    });

    const response = await service.updateSettings({
      openai: {
        apiKey: 'openai-secret',
        chatModel: 'gpt-4o',
      },
      azureOpenai: {
        apiKey: 'azure-secret',
        endpoint: 'https://azure.example.com',
      },
      gemini: {
        apiKey: 'gemini-secret',
      },
      claude: {
        apiKey: 'claude-secret',
      },
      grok: {
        apiKey: 'grok-secret',
        baseUrl: 'https://api.x.ai/v1',
      },
      bedrock: {
        apiKey: 'bedrock-secret',
        baseUrl: 'https://bedrock.example.com/v1',
      },
      milvus: {
        address: 'milvus.example.com:19530',
        token: 'milvus-token',
        password: 'milvus-password',
        collectionName: 'docs',
      },
      azureBlob: {
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test',
        containerName: 'docs',
      },
      azureSearch: {
        endpoint: 'https://search.example.com',
        apiKey: 'search-secret',
        indexName: 'docs',
      },
      mongodb: {
        connectionString: 'mongodb://user:pass@localhost:27017/canvas_flow',
        databaseName: 'canvas_flow',
      },
      webWidget: {
        primaryColor: '#123456',
        assistantName: 'Bot',
      },
      whatsapp: {
        accessToken: 'meta-token',
        embeddedSignupAppSecret: 'embedded-secret',
        blipAuthorizationKey: 'blip-secret',
        sinchAccessToken: 'sinch-access',
        sinchServiceToken: 'sinch-service',
      },
      unknownSection: {
        shouldBeDropped: true,
      },
    }, 'user-1');

    const storedSettings = store.get('global').settings;
    secretPaths.forEach((path) => {
      const stored = getPath(storedSettings, path);
      expect(stored).toEqual(expect.stringMatching(/^enc:/));
      expect(stored).not.toContain('secret');
      expect(stored).not.toContain('token');
    });

    secretPaths.forEach((path) => {
      expect(getPath(response.settings, path)).toBe('');
      expect(response.secretStatus[path]).toBe(true);
    });
    expect(response.settings.milvus.address).toBe('milvus.example.com:19530');
    expect(response.settings.azureBlob.containerName).toBe('docs');
    expect(response.settings.azureSearch.endpoint).toBe('https://search.example.com');
    expect(response.settings.mongodb.databaseName).toBe('canvas_flow');
    expect(response.settings.webWidget.primaryColor).toBe('#123456');
    expect(storedSettings.unknownSection).toBeUndefined();
  });

  it('preserves existing secrets when partial updates send blank secret fields', async () => {
    const { service } = createService({
      CANVAS_FLOW_JWT_SECRET: 'unit-test-secret',
    });

    await service.updateSettings({
      openai: {
        apiKey: 'initial-openai-secret',
        chatModel: 'gpt-4o',
      },
    });

    const response = await service.updateSettings({
      openai: {
        apiKey: '',
        chatModel: 'gpt-4.1-mini',
      },
    });
    const effective = await service.getEffectiveSettings();

    expect(response.settings.openai.apiKey).toBe('');
    expect(response.secretStatus['openai.apiKey']).toBe(true);
    expect(response.settings.openai.chatModel).toBe('gpt-4.1-mini');
    expect(effective.openai.apiKey).toBe('initial-openai-secret');
    expect(effective.openai.chatModel).toBe('gpt-4.1-mini');
  });

  it.each([
    ['llmProvider', { llmProvider: 'invalid' }, 'llmProvider invalido.'],
    ['whatsapp.provider', { whatsapp: { provider: 'invalid' } }, 'whatsapp.provider invalido.'],
    ['whatsapp.deliveryMode', { whatsapp: { deliveryMode: 'invalid' } }, 'whatsapp.deliveryMode invalido.'],
    ['whatsapp.onboardingMode', { whatsapp: { onboardingMode: 'invalid' } }, 'whatsapp.onboardingMode invalido.'],
    ['whatsapp.sinchApiMode', { whatsapp: { sinchApiMode: 'invalid' } }, 'whatsapp.sinchApiMode invalido.'],
    ['webWidget.position', { webWidget: { position: 'center' } }, 'webWidget.position invalido.'],
  ])('rejects invalid enum value for %s', async (_field, patch, message) => {
    const { service } = createService();

    await expect(service.updateSettings(patch)).rejects.toThrow(BadRequestException);
    await expect(service.updateSettings(patch)).rejects.toThrow(message);
  });

  it('fails writes when MongoDB is not connected', async () => {
    const { service, model } = createService();
    model.db.readyState = 0;

    await expect(service.updateSettings({ openai: { apiKey: 'secret' } }))
      .rejects
      .toThrow('MongoDB ainda nao esta conectado para salvar configuracoes.');
  });

  it('merges env, global, and agent settings while preserving inherited values over empty overrides', async () => {
    const { service, store } = createService({
      CANVAS_FLOW_JWT_SECRET: 'unit-test-secret',
      OPENAI_API_KEY: 'env-openai-secret',
      OPENAI_CHAT_MODEL: 'env-chat',
      OPENAI_EMBEDDING_MODEL: 'env-embedding',
    });

    await service.updateSettings({
      openai: {
        apiKey: 'global-openai-secret',
        chatModel: 'global-chat',
        embeddingModel: '',
      },
    });
    await service.updateSettings({
      openai: {
        apiKey: '',
        chatModel: 'agent-chat',
        ocrModel: '',
      },
    }, 'user-1', 'agent-a');

    const effective = await service.getEffectiveSettings('agent-a');

    expect(store.has('global')).toBe(true);
    expect(store.has('agent:agent-a')).toBe(true);
    expect(effective.openai.apiKey).toBe('global-openai-secret');
    expect(effective.openai.chatModel).toBe('agent-chat');
    expect(effective.openai.embeddingModel).toBe('env-embedding');
    expect(effective.openai.ocrModel).toBe('gpt-4o');
  });

  it('reports provider status provenance for env, global inheritance, and scoped overrides', async () => {
    const { service } = createService({
      CANVAS_FLOW_JWT_SECRET: 'unit-test-secret',
      OPENAI_API_KEY: 'env-openai-secret',
    });

    const envSafe = await service.getSafeSettings();
    expect(envSafe.providerStatus.openai).toEqual({
      configured: true,
      source: 'env',
      scopeConfigured: false,
      inherited: true,
    });

    await service.updateSettings({
      openai: {
        chatModel: 'global-chat',
      },
    });

    const globalSafe = await service.getSafeSettings();
    expect(globalSafe.providerStatus.openai).toEqual({
      configured: true,
      source: 'global',
      scopeConfigured: true,
      inherited: false,
    });

    const inheritedSafe = await service.getSafeSettings('agent-a');
    expect(inheritedSafe.providerStatus.openai).toEqual({
      configured: true,
      source: 'global',
      scopeConfigured: false,
      inherited: true,
    });

    await service.updateSettings({
      openai: {
        chatModel: 'agent-chat',
      },
    }, 'user-1', 'agent-a');

    const agentSafe = await service.getSafeSettings('agent-a');
    expect(agentSafe.providerStatus.openai).toEqual({
      configured: true,
      source: 'agent',
      scopeConfigured: true,
      inherited: false,
    });
  });

  it('caches effective settings by global and agent keys and clears stale cache on write', async () => {
    const { service, model, store } = createService({
      CANVAS_FLOW_PROVIDER_CACHE_MS: '60000',
    });
    store.set('global', {
      key: 'global',
      settings: { openai: { apiKey: 'global-openai-secret', chatModel: 'global-chat' } },
    });
    store.set('agent:agent-a', {
      key: 'agent:agent-a',
      settings: { openai: { chatModel: 'agent-chat' } },
    });
    model.findOne.mockClear();

    await service.getEffectiveSettings();
    await service.getEffectiveSettings();
    await service.getEffectiveSettings('agent-a');
    await service.getEffectiveSettings('agent-a');

    expect(model.findOne.mock.calls.map(([filter]) => filter.key)).toEqual([
      'global',
      'global',
      'agent:agent-a',
    ]);

    await service.updateSettings({
      openai: {
        apiKey: 'updated-global-openai-secret',
      },
    });

    const effective = await service.getEffectiveSettings();
    expect(effective.openai.apiKey).toBe('updated-global-openai-secret');
  });

  it('deletes only the selected scope section and clears matching stored llmProvider', async () => {
    const { service, store } = createService({
      CANVAS_FLOW_JWT_SECRET: 'unit-test-secret',
    });

    await service.updateSettings({
      llmProvider: 'openai',
      openai: {
        apiKey: 'global-openai-secret',
        chatModel: 'global-chat',
      },
    });
    await service.updateSettings({
      llmProvider: 'openai',
      openai: {
        apiKey: 'agent-openai-secret',
        chatModel: 'agent-chat',
      },
    }, 'user-1', 'agent-a');

    await service.clearSection('openai', 'user-1', 'agent-a');

    expect(store.get('global').settings.openai).toBeDefined();
    expect(store.get('global').settings.llmProvider).toBe('openai');
    expect(store.get('agent:agent-a').settings.openai).toBeUndefined();
    expect(store.get('agent:agent-a').settings.llmProvider).toBeUndefined();

    const inherited = await service.getEffectiveSettings('agent-a');
    expect(inherited.openai.apiKey).toBe('global-openai-secret');
    expect(inherited.openai.chatModel).toBe('global-chat');

    await service.clearSection('openai', 'user-1');

    expect(store.get('global').settings.openai).toBeUndefined();
    expect(store.get('global').settings.llmProvider).toBeUndefined();
  });

  it('falls back from invalid or unconfigured selected providers in spec order', async () => {
    const { service, store } = createService();

    store.set('global', {
      key: 'global',
      settings: {
        llmProvider: 'invalid-provider',
        azureOpenai: {
          apiKey: 'azure-secret',
          endpoint: 'https://azure.example.com',
        },
        gemini: {
          apiKey: 'gemini-secret',
        },
      },
    });

    const invalidSelected = await service.getEffectiveSettings();
    expect(invalidSelected.llmProvider).toBe('azure');

    await service.updateSettings({
      llmProvider: 'bedrock',
      azureOpenai: {
        apiKey: '',
        endpoint: '',
      },
      gemini: {
        apiKey: 'gemini-secret',
      },
      bedrock: {
        apiKey: '',
        baseUrl: '',
      },
    });

    const unconfiguredSelected = await service.getEffectiveSettings();
    expect(unconfiguredSelected.llmProvider).toBe('gemini');
  });

  it('maps OpenAI chat, embedding, and OCR settings to runtime config', () => {
    const { service } = createService();
    const settings = service.getEnvSettings();
    settings.llmProvider = 'openai';
    settings.openai = {
      ...settings.openai,
      apiKey: 'openai-secret',
      chatModel: 'gpt-4.1',
      embeddingModel: 'text-embedding-3-small',
      ocrModel: 'gpt-4.1-mini',
    };
    settings.azureOpenai = {
      ...settings.azureOpenai,
      apiKey: 'azure-secret',
      endpoint: 'https://azure.example.com',
    };

    const runtime = service.toOpenAIRuntimeConfig(settings);

    expect(runtime).toMatchObject({
      openaiProvider: 'openai',
      openaiApiKey: 'openai-secret',
      openaiChatModel: 'gpt-4.1',
      openaiEmbeddingModel: 'text-embedding-3-small',
      openaiOcrModel: 'gpt-4.1-mini',
      azureOpenAIEnabled: false,
    });
  });

  it.each(['azure', 'azure_openai', 'azure-openai'])(
    'normalizes Azure alias %s and maps Azure runtime settings',
    (provider) => {
      const { service } = createService();
      const settings = service.getEnvSettings();
      settings.llmProvider = provider === 'azure-openai' ? 'openai' : provider as any;
      settings.azureOpenai = {
        ...settings.azureOpenai,
        apiKey: 'azure-secret',
        endpoint: 'https://azure.example.com',
        apiVersion: '2024-10-21',
        chatDeploymentName: 'chat-deployment',
        embeddingDeploymentName: 'embedding-deployment',
        ocrDeploymentName: 'ocr-deployment',
      };

      const runtime = service.toOpenAIRuntimeConfig(settings, provider);

      expect(runtime).toMatchObject({
        openaiProvider: 'azure',
        azureOpenAIEnabled: true,
        azureOpenAIApiKey: 'azure-secret',
        azureOpenAIApiVersion: '2024-10-21',
        azureOpenAIEndpoint: 'https://azure.example.com',
        azureOpenAIChatDeployment: 'chat-deployment',
        azureOpenAIEmbeddingDeployment: 'embedding-deployment',
        azureOpenAIOcrDeployment: 'ocr-deployment',
      });
    },
  );

  it('maps Gemini, Claude, Grok, and Bedrock settings to runtime config', () => {
    const { service } = createService();
    const settings = service.getEnvSettings();
    settings.gemini = {
      ...settings.gemini,
      apiKey: 'gemini-secret',
      chatModel: 'gemini-pro',
    };
    settings.claude = {
      ...settings.claude,
      apiKey: 'claude-secret',
      chatModel: 'claude-opus',
    };
    settings.grok = {
      ...settings.grok,
      apiKey: 'grok-secret',
      baseUrl: 'https://api.x.ai/v1',
      chatModel: 'grok-3',
    };
    settings.bedrock = {
      ...settings.bedrock,
      apiKey: 'bedrock-secret',
      baseUrl: 'https://bedrock-gateway.example.com/v1',
      region: 'us-west-2',
      chatModel: 'anthropic.claude-3-5-sonnet',
    };

    expect(service.toOpenAIRuntimeConfig(settings, 'gemini')).toMatchObject({
      openaiProvider: 'gemini',
      geminiApiKey: 'gemini-secret',
      geminiChatModel: 'gemini-pro',
    });
    expect(service.toOpenAIRuntimeConfig(settings, 'claude')).toMatchObject({
      openaiProvider: 'claude',
      claudeApiKey: 'claude-secret',
      claudeChatModel: 'claude-opus',
    });
    expect(service.toOpenAIRuntimeConfig(settings, 'grok')).toMatchObject({
      openaiProvider: 'grok',
      grokApiKey: 'grok-secret',
      grokBaseUrl: 'https://api.x.ai/v1',
      grokChatModel: 'grok-3',
    });
    expect(service.toOpenAIRuntimeConfig(settings, 'bedrock')).toMatchObject({
      openaiProvider: 'bedrock',
      bedrockApiKey: 'bedrock-secret',
      bedrockBaseUrl: 'https://bedrock-gateway.example.com/v1',
      bedrockRegion: 'us-west-2',
      bedrockChatModel: 'anthropic.claude-3-5-sonnet',
    });
  });
});
