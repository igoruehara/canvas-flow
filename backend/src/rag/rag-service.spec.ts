jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: 'Arquitetura via webhook e conversationId' }),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@zilliz/milvus2-sdk-node', () => ({
  DataType: {
    Int64: 'Int64',
    VarChar: 'VarChar',
    JSON: 'JSON',
    FloatVector: 'FloatVector',
    SparseFloatVector: 'SparseFloatVector',
  },
  FunctionType: {
    BM25: 'BM25',
  },
  MilvusClient: jest.fn().mockImplementation(() => ({
    loadCollection: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => ({
      getContainerClient: jest.fn(() => ({
        createIfNotExists: jest.fn().mockResolvedValue(undefined),
        getBlockBlobClient: jest.fn(),
      })),
    })),
  },
}));

import { RagService } from './rag-service';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { BlobServiceClient } from '@azure/storage-blob';
import PDFDocument = require('pdfkit');

const createSettings = () => ({
  llmProvider: 'openai' as const,
  openai: {
    enabled: true,
    apiKey: '',
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    ocrModel: 'gpt-4o-mini',
  },
  azureOpenai: {
    enabled: false,
    apiKey: '',
    endpoint: '',
    apiVersion: '2024-02-15-preview',
    chatDeploymentName: '',
    embeddingDeploymentName: '',
    ocrDeploymentName: '',
    embeddingDimensions: 3072,
  },
  gemini: { enabled: false, apiKey: '', chatModel: 'gemini-3.5-flash' },
  claude: { enabled: false, apiKey: '', chatModel: 'claude-sonnet-4-6' },
  grok: { enabled: false, apiKey: '', baseUrl: 'https://api.x.ai/v1', chatModel: 'grok-2-latest' },
  bedrock: { enabled: false, apiKey: '', baseUrl: '', region: 'us-east-1', chatModel: 'anthropic.claude-sonnet-4-6' },
  milvus: { address: '', token: '', username: '', password: '', collectionName: 'canvas_flow_docs' },
  azureBlob: { connectionString: '', containerName: '' },
  azureSearch: { endpoint: '', apiKey: '', indexName: '', apiVersion: '2024-07-01' },
  mongodb: { connectionString: '', databaseName: '' },
  webWidget: {
    primaryColor: '#0f6bff',
    accentColor: '#00b37e',
    assistantName: 'Assistente IA',
    subtitle: '',
    welcomeMessage: '',
    placeholder: '',
    bubbleLabel: '',
    avatarText: 'IA',
    openByDefault: false,
    position: 'right' as const,
  },
  whatsapp: {
    provider: 'meta' as const,
    deliveryMode: 'provider' as const,
    autoReply: true,
    verifyToken: '',
    businessAccountId: '',
    phoneNumberId: '',
    accessToken: '',
    graphApiVersion: 'v20.0',
    blipContractId: '',
    blipAuthorizationKey: '',
    sinchProjectId: '',
    sinchAppId: '',
    sinchRegion: 'us',
    sinchAccessToken: '',
    sinchChannel: 'WHATSAPP',
    sinchApiMode: 'conversation' as const,
    sinchServiceNumber: '',
    sinchServiceUsername: '',
    sinchServiceToken: '',
  },
});

const createService = (documentsService?: any, settingsOverride: any = {}) => {
  const settings = createSettings();
  Object.entries(settingsOverride).forEach(([key, value]) => {
    const current = (settings as any)[key];
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      (settings as any)[key] = {
        ...current,
        ...(value as any),
      };
    } else {
      (settings as any)[key] = value;
    }
  });
  const configService = { get: jest.fn(() => undefined) };
  const memoryService = {
    findRecent: jest.fn().mockResolvedValue([]),
    addTurn: jest.fn().mockResolvedValue({}),
  };
  const httpBatchService = {
    execute: jest.fn().mockResolvedValue({ results: [] }),
  };
  const providerConfigService = {
    getEnvSettings: jest.fn(() => settings),
    getEffectiveSettings: jest.fn().mockResolvedValue(settings),
    toOpenAIRuntimeConfig: jest.fn((runtimeSettings = settings, provider?: string) => {
      const selected = String(provider || (runtimeSettings as any).llmProvider || 'openai').toLowerCase();
      const openaiProvider =
        selected === 'azure' || selected === 'azure_openai' || selected === 'azure-openai'
          ? 'azure'
          : selected;
      return {
        openaiProvider,
        openaiApiKey: (runtimeSettings as any).openai?.apiKey,
        openaiChatModel: (runtimeSettings as any).openai?.chatModel,
        openaiEmbeddingModel: (runtimeSettings as any).openai?.embeddingModel,
        openaiOcrModel: (runtimeSettings as any).openai?.ocrModel,
        azureOpenAIEnabled: openaiProvider === 'azure',
        azureOpenAIApiKey: (runtimeSettings as any).azureOpenai?.apiKey,
        azureOpenAIApiVersion: (runtimeSettings as any).azureOpenai?.apiVersion,
        azureOpenAIEndpoint: (runtimeSettings as any).azureOpenai?.endpoint,
        azureOpenAIChatDeployment: (runtimeSettings as any).azureOpenai?.chatDeploymentName,
        azureOpenAIEmbeddingDeployment: (runtimeSettings as any).azureOpenai?.embeddingDeploymentName,
        azureOpenAIOcrDeployment: (runtimeSettings as any).azureOpenai?.ocrDeploymentName,
        geminiApiKey: (runtimeSettings as any).gemini?.apiKey,
        geminiChatModel: (runtimeSettings as any).gemini?.chatModel,
        claudeApiKey: (runtimeSettings as any).claude?.apiKey,
        claudeChatModel: (runtimeSettings as any).claude?.chatModel,
        grokApiKey: (runtimeSettings as any).grok?.apiKey,
        grokBaseUrl: (runtimeSettings as any).grok?.baseUrl,
        grokChatModel: (runtimeSettings as any).grok?.chatModel,
        bedrockApiKey: (runtimeSettings as any).bedrock?.apiKey,
        bedrockBaseUrl: (runtimeSettings as any).bedrock?.baseUrl,
        bedrockRegion: (runtimeSettings as any).bedrock?.region,
        bedrockChatModel: (runtimeSettings as any).bedrock?.chatModel,
      };
    }),
  };
  const service = new RagService(
    configService as any,
    memoryService as any,
    httpBatchService as any,
    providerConfigService as any,
    documentsService,
  );
  const chatCreate = jest.fn().mockResolvedValue({
    choices: [{ message: { role: 'assistant', content: 'ok' } }],
  });
  const embeddingCreate = jest.fn().mockResolvedValue({
    data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
  });
  (service as any).getOpenAIClientForProvider = jest.fn(() => ({
    chat: { completions: { create: chatCreate } },
    embeddings: { create: embeddingCreate },
  }));
  return { service, chatCreate, embeddingCreate, providerConfigService };
};

const createPdf = async (text: string) => {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.text(text);
  doc.end();
  return await complete;
};

describe('RagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not create a Milvus client for remote addresses without credentials', async () => {
    const { service } = createService(undefined, {
      milvus: {
        address: 'https://example.zillizcloud.com:19530',
        token: '',
        username: '',
        password: '',
      },
    });

    await service.onModuleInit();

    expect(MilvusClient).not.toHaveBeenCalled();
    expect((service as any).milvusClient).toBeUndefined();
  });

  it('allows local Milvus without credentials', async () => {
    const { service } = createService(undefined, {
      milvus: {
        address: 'localhost:19530',
        token: '',
        username: '',
        password: '',
      },
    });

    await service.onModuleInit();

    expect(MilvusClient).toHaveBeenCalledWith(expect.objectContaining({
      address: 'localhost:19530',
      ssl: false,
    }));
  });

  it('uses effective infra settings for Milvus, Azure Blob, and Azure Search', async () => {
    const { service, providerConfigService } = createService(undefined, {
      milvus: {
        address: 'https://example.zillizcloud.com:19530',
        token: 'milvus-token',
        username: '',
        password: '',
        collectionName: 'agent_docs',
      },
      azureBlob: {
        connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;EndpointSuffix=core.windows.net',
        containerName: 'rag-container',
      },
      azureSearch: {
        endpoint: 'https://search.example.net/',
        apiKey: 'search-key',
        indexName: 'rag-index',
        apiVersion: '2025-01-01',
      },
    });

    await (service as any).refreshProviderSettings('agent-1');

    expect(providerConfigService.getEffectiveSettings).toHaveBeenCalledWith('agent-1');
    expect(MilvusClient).toHaveBeenCalledWith(expect.objectContaining({
      address: 'example.zillizcloud.com:19530',
      ssl: true,
      token: 'milvus-token',
    }));
    expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith('DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;EndpointSuffix=core.windows.net');
    const blobService = (BlobServiceClient.fromConnectionString as jest.Mock).mock.results[0].value;
    expect(blobService.getContainerClient).toHaveBeenCalledWith('rag-container');
    expect((service as any).getAzureSearchEndpoint()).toBe('https://search.example.net');
    expect((service as any).getAzureSearchApiKey()).toBe('search-key');
    expect((service as any).getAzureSearchIndexName()).toBe('rag-index');
    expect((service as any).getAzureSearchApiVersion()).toBe('2025-01-01');
  });

  it('maps provider-specific chat settings from effective agent config without network calls', async () => {
    const { service, chatCreate, providerConfigService } = createService(undefined, {
      llmProvider: 'claude',
      claude: {
        enabled: true,
        apiKey: 'claude-key',
        chatModel: 'claude-agent-model',
      },
    });

    await service.chatLlmRag('teste', 'agent-1', { k: 0, llmProvider: 'claude' });

    expect(providerConfigService.getEffectiveSettings).toHaveBeenCalledWith('agent-1');
    expect(providerConfigService.toOpenAIRuntimeConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        llmProvider: 'claude',
        claude: expect.objectContaining({ chatModel: 'claude-agent-model' }),
      }),
      'claude',
    );
    expect((service as any).getOpenAIClientForProvider).toHaveBeenCalledWith('claude');
    expect(chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-agent-model',
    }));
  });

  it('maps provider-specific embedding settings from effective agent config without network calls', async () => {
    const { service, embeddingCreate, providerConfigService } = createService(undefined, {
      llmProvider: 'azure',
      azureOpenai: {
        enabled: true,
        apiKey: 'azure-key',
        endpoint: 'https://azure.example.openai.azure.com',
        apiVersion: '2024-02-15-preview',
        embeddingDeploymentName: 'agent-embedding-deployment',
      },
    });

    const vectors = await service.embeddingCreateBatch(['hello'], undefined, undefined, 'agent-1');

    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);
    expect(providerConfigService.getEffectiveSettings).toHaveBeenCalledWith('agent-1');
    expect(providerConfigService.toOpenAIRuntimeConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        llmProvider: 'azure',
        azureOpenai: expect.objectContaining({ embeddingDeploymentName: 'agent-embedding-deployment' }),
      }),
      'azure',
    );
    expect((service as any).getOpenAIClientForProvider).toHaveBeenCalledWith('azure');
    expect(embeddingCreate).toHaveBeenCalledWith({
      model: 'agent-embedding-deployment',
      input: ['hello'],
    });
  });

  it('stores the original uploaded file while keeping its extracted text available', async () => {
    const documentsService = {
      storeOriginal: jest.fn().mockResolvedValue({
        documentId: 'document-1',
        storage: 'local',
        key: 'canvas-flow/global/documents/document-1/contrato.csv',
        downloadPath: '/api/documents/document-1/download',
      }),
    };
    const { service } = createService(documentsService);

    const result = await service.extractFiles([
      {
        buffer: Buffer.from('cliente,valor\nAna,10', 'utf-8'),
        originalname: 'contrato.csv',
        mimetype: 'text/csv',
        size: 20,
      },
    ], {
      organizationId: 'org-1',
      agentId: 'agent-1',
    });

    expect(documentsService.storeOriginal).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'contrato.csv',
      scope: expect.objectContaining({ organizationId: 'org-1', agentId: 'agent-1' }),
      text: 'cliente,valor\nAna,10',
    }));
    expect(result.files[0]).toEqual(expect.objectContaining({
      documentId: 'document-1',
      storage: 'local',
      downloadPath: '/api/documents/document-1/download',
    }));
  });

  it('extracts PDF text directly with the installed pdf-parse API', async () => {
    const { service } = createService();
    const result = await service.extractFiles([
      {
        buffer: await createPdf('Arquitetura via webhook e conversationId'),
        originalname: 'arquitetura.pdf',
        mimetype: 'application/pdf',
      },
    ]);

    expect(result.files[0]).toEqual(expect.objectContaining({
      strategy: 'direct',
      ok: true,
    }));
    expect(result.files[0].text).toContain('Arquitetura via webhook e conversationId');
  });

  it('does not expose the internal httpBatch tool by default', async () => {
    const { service, chatCreate } = createService();

    await service.chatLlmRag('teste', 'agent-1', { k: 0 });

    expect(chatCreate).toHaveBeenCalledWith(expect.objectContaining({
      tools: [],
      tool_choice: 'auto',
    }));
  });

  it('exposes httpBatch only when explicitly enabled', async () => {
    const { service, chatCreate } = createService();

    await service.chatLlmRag('teste', 'agent-1', { k: 0, allowHttpBatchTool: true });

    const tools = chatCreate.mock.calls[0][0].tools;
    expect(tools.map((tool: any) => tool.function?.name)).toContain('httpBatch');
  });
});
