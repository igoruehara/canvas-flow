import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataType, FunctionType, MilvusClient } from '@zilliz/milvus2-sdk-node';
import OpenAI from 'openai';
import { createHash, randomUUID } from 'crypto';
import * as mammoth from 'mammoth';
import * as ExcelJS from 'exceljs';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { HttpBatchService } from '../http-batch/http-batch-service';
import { MemoryService } from '../memory/memory-service';
import {
  createOpenAIClient,
  getOpenAIChatModel,
  getOpenAIEmbeddingModel,
  getOpenAIOcrModel,
} from '../llm/openai-provider';
import { OpenAIRuntimeConfig, ProviderConfigService, ProviderSettings } from '../provider-config/provider-config-service';
import { DocumentsService } from '../documents/documents-service';

const pdfParseModule = require('pdf-parse');

interface RagDocumentInput {
  text: string;
  embeddingName?: string;
  embeddingId?: string;
  agentId?: string;
  extraFields?: Record<string, any>;
}

interface UploadedRagFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

interface AzureSearchIndexSchema {
  fields: Set<string>;
  filterableFields: Set<string>;
  searchableFields: Set<string>;
  fieldTypes: Map<string, string>;
  vectorDimensions: Map<string, number>;
  semanticConfigurations: Set<string>;
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private openAIClient?: OpenAI;
  private openAIClientError?: Error;
  private milvusClient?: MilvusClient;
  private azureBlobContainer?: ContainerClient;
  private runtimeSettings?: ProviderSettings;
  private openAIRuntimeConfig?: OpenAIRuntimeConfig;
  private providerSignature = '';
  private azureSearchFieldCache = new Map<string, { expiresAt: number; schema: AzureSearchIndexSchema }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly httpBatchService: HttpBatchService,
    private readonly providerConfigService: ProviderConfigService,
    @Optional() private readonly documentsService?: DocumentsService,
  ) {
    this.runtimeSettings = this.providerConfigService.getEnvSettings();
    this.openAIRuntimeConfig = this.providerConfigService.toOpenAIRuntimeConfig(this.runtimeSettings);
  }

  private isLocalMilvusAddress(address: string) {
    const withoutScheme = String(address || '').trim().replace(/^https?:\/\//i, '');
    const host = withoutScheme.split('/')[0]?.split(':')[0]?.replace(/^\[|\]$/g, '').toLowerCase();
    return ['localhost', '127.0.0.1', '::1', 'milvus'].includes(host);
  }

  private hasMilvusCredentials(settings: ProviderSettings) {
    return Boolean(
      String(settings.milvus?.token || '').trim() ||
      (String(settings.milvus?.username || '').trim() && String(settings.milvus?.password || '').trim()),
    );
  }

  private normalizeSettingsAgentId(agentId?: any) {
    const normalized = agentId === undefined || agentId === null ? '' : String(agentId).trim();
    return normalized || undefined;
  }

  private resolveDocumentsSettingsAgentId(documents: RagDocumentInput[] = [], options: any = {}) {
    return this.normalizeSettingsAgentId(
      options?.agentId ??
      documents.find((document) => this.normalizeSettingsAgentId(document?.agentId))?.agentId,
    );
  }

  private applyProviderSettings(settings: ProviderSettings) {
    this.runtimeSettings = settings;
    this.openAIRuntimeConfig = this.providerConfigService.toOpenAIRuntimeConfig(settings);
    try {
      this.openAIClient = createOpenAIClient(this.configService, this.openAIRuntimeConfig);
      this.openAIClientError = undefined;
    } catch (error: any) {
      this.openAIClient = undefined;
      this.openAIClientError = error instanceof Error ? error : new Error(error?.message || String(error));
      this.logger.warn(`LLM padrao nao esta pronto: ${this.openAIClientError.message}`);
    }

    const milvusAddressRaw = String(settings.milvus?.address || '').trim();
    this.milvusClient = undefined;
    if (milvusAddressRaw) {
      const isLocalMilvus = this.isLocalMilvusAddress(milvusAddressRaw);
      if (!isLocalMilvus && !this.hasMilvusCredentials(settings)) {
        this.logger.warn('Milvus remoto configurado sem token/usuario e senha; Milvus sera desativado ate as credenciais serem configuradas.');
      } else {
        const milvusAddress = milvusAddressRaw.replace(/^https?:\/\//i, '');
        const milvusUseSsl =
          /^https:\/\//i.test(milvusAddressRaw) || (!isLocalMilvus && !/^http:\/\//i.test(milvusAddressRaw));
        const milvusOptions: any = { address: milvusAddress, ssl: milvusUseSsl };

        if (settings.milvus?.token) {
          milvusOptions.token = settings.milvus.token;
        } else if (settings.milvus?.username && settings.milvus?.password) {
          milvusOptions.username = settings.milvus.username;
          milvusOptions.password = settings.milvus.password;
        }

        this.milvusClient = new MilvusClient(milvusOptions);
      }
    }

    this.azureBlobContainer = undefined;
    if (settings.azureBlob?.connectionString && settings.azureBlob?.containerName) {
      this.azureBlobContainer = BlobServiceClient
        .fromConnectionString(settings.azureBlob.connectionString)
        .getContainerClient(settings.azureBlob.containerName);
    }
  }

  private async refreshProviderSettings(agentId?: string) {
    const settings = await this.providerConfigService.getEffectiveSettings(this.normalizeSettingsAgentId(agentId));
    const signature = JSON.stringify(settings);
    if (signature !== this.providerSignature) {
      this.applyProviderSettings(settings);
      this.providerSignature = signature;
    }
  }

  async onModuleInit(): Promise<void> {
    await this.refreshProviderSettings();
    const defaultCollection = this.getDefaultCollectionName();
    if (!this.milvusClient || !defaultCollection) return;
    try {
      await this.milvusClient.loadCollection({ collection_name: defaultCollection });
      this.logger.log(`Milvus collection loaded: ${defaultCollection}`);
    } catch (error: any) {
      this.logger.warn(`Milvus startup load skipped: ${error?.message || String(error)}`);
    }
  }

  private getDefaultCollectionName() {
    return this.runtimeSettings?.milvus?.collectionName || this.configService.get<string>('COLLECTION_NAME') || 'canvas_flow_docs';
  }

  private getEmbeddingModel() {
    return getOpenAIEmbeddingModel(this.configService, undefined, this.openAIRuntimeConfig);
  }

  private getChatModel(model?: string) {
    return getOpenAIChatModel(this.configService, model, this.openAIRuntimeConfig);
  }

  private getOcrModel() {
    return getOpenAIOcrModel(this.configService, undefined, this.openAIRuntimeConfig);
  }

  private getEmbeddingDimensions() {
    return Number(
      this.runtimeSettings?.azureOpenai?.embeddingDimensions ||
      this.configService.get<string>('AZURE_OPENAI_EMBEDDING_DIMENSIONS') ||
      this.configService.get<string>('OPENAI_EMBEDDING_DIMENSIONS') ||
      3072,
    );
  }

  private normalizeOpenAIProvider(value: any) {
    const provider = String(value || '').trim().toLowerCase();
    if (provider === 'azure' || provider === 'azure_openai' || provider === 'azure-openai') return 'azure';
    if (provider === 'openai') return 'openai';
    if (provider === 'gemini') return 'gemini';
    if (provider === 'claude' || provider === 'anthropic') return 'claude';
    if (provider === 'grok' || provider === 'xai') return 'grok';
    if (provider === 'bedrock' || provider === 'aws_bedrock') return 'bedrock';
    return '';
  }

  private getOpenAIClientForProvider(provider?: string) {
    const normalized = this.normalizeOpenAIProvider(provider);
    if (!normalized) {
      if (this.openAIClient) return this.openAIClient;
      throw this.openAIClientError || new Error('Provider LLM padrao nao configurado.');
    }
    const runtime = this.providerConfigService.toOpenAIRuntimeConfig(
      this.runtimeSettings || this.providerConfigService.getEnvSettings(),
      normalized,
    );
    return createOpenAIClient(this.configService, runtime);
  }

  private getEmbeddingModelForProvider(provider?: string, model?: string) {
    const normalized = this.normalizeOpenAIProvider(provider);
    const runtime = normalized
      ? this.providerConfigService.toOpenAIRuntimeConfig(this.runtimeSettings || this.providerConfigService.getEnvSettings(), normalized)
      : this.openAIRuntimeConfig;
    return getOpenAIEmbeddingModel(this.configService, model, runtime);
  }

  private getChatModelForProvider(provider?: string, model?: string) {
    const normalized = this.normalizeOpenAIProvider(provider);
    const runtime = normalized
      ? this.providerConfigService.toOpenAIRuntimeConfig(this.runtimeSettings || this.providerConfigService.getEnvSettings(), normalized)
      : this.openAIRuntimeConfig;
    return getOpenAIChatModel(this.configService, model, runtime);
  }

  private getAzureSearchEndpoint() {
    return String(
      this.runtimeSettings?.azureSearch?.endpoint ||
      this.configService.get<string>('AZURE_SEARCH_API_BASE_PATH') ||
      this.configService.get<string>('AZURE_SEARCH_ENDPOINT') ||
      '',
    ).replace(/\/+$/, '');
  }

  private getAzureSearchApiKey() {
    return this.runtimeSettings?.azureSearch?.apiKey || this.configService.get<string>('AZURE_SEARCH_API_KEY') || this.configService.get<string>('AZURE_SEARCH_KEY') || '';
  }

  private getAzureSearchIndexName(collectionName?: string) {
    return collectionName || this.runtimeSettings?.azureSearch?.indexName || this.configService.get<string>('AZURE_SEARCH_INDEX_NAME') || '';
  }

  private getAzureSearchApiVersion() {
    return this.runtimeSettings?.azureSearch?.apiVersion || this.configService.get<string>('AZURE_SEARCH_API_VERSION') || '2024-07-01';
  }

  private isAzureSearchConfigured(collectionName?: string) {
    return Boolean(this.getAzureSearchEndpoint() && this.getAzureSearchApiKey() && this.getAzureSearchIndexName(collectionName));
  }

  private collectAzureSearchFieldSchema(fields: any[], schema: AzureSearchIndexSchema, prefix = '') {
    for (const field of fields || []) {
      const name = String(field?.name || '').trim();
      if (!name) continue;
      const path = prefix ? `${prefix}/${name}` : name;
      schema.fields.add(path);
      schema.fieldTypes.set(path, String(field?.type || ''));
      if (Number.isFinite(Number(field?.dimensions))) {
        schema.vectorDimensions.set(path, Number(field.dimensions));
      }
      if (field?.filterable === true) schema.filterableFields.add(path);
      if (field?.searchable === true) schema.searchableFields.add(path);
      if (Array.isArray(field?.fields)) {
        this.collectAzureSearchFieldSchema(field.fields, schema, path);
      }
    }
  }

  private async getAzureSearchIndexSchema(indexName: string): Promise<AzureSearchIndexSchema> {
    const cacheKey = `${this.getAzureSearchEndpoint()}::${indexName}`;
    const cached = this.azureSearchFieldCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.schema;

    const url = `${this.getAzureSearchEndpoint()}/indexes/${encodeURIComponent(indexName)}?api-version=${this.getAzureSearchApiVersion()}`;
    const response = await this.fetchWithRetry('azure search schema', url, {
      headers: {
        'api-key': this.getAzureSearchApiKey(),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BadRequestException({
        message: 'Azure AI Search schema failed',
        status: response.status,
        body,
      });
    }

    const schema: AzureSearchIndexSchema = {
      fields: new Set<string>(),
      filterableFields: new Set<string>(),
      searchableFields: new Set<string>(),
      fieldTypes: new Map<string, string>(),
      vectorDimensions: new Map<string, number>(),
      semanticConfigurations: new Set<string>(
        (Array.isArray(body?.semantic?.configurations) ? body.semantic.configurations : [])
          .map((configuration: any) => String(configuration?.name || '').trim())
          .filter(Boolean),
      ),
    };
    this.collectAzureSearchFieldSchema(Array.isArray(body?.fields) ? body.fields : [], schema);
    this.azureSearchFieldCache.set(cacheKey, { schema, expiresAt: Date.now() + 60_000 });
    return schema;
  }

  private async getAzureSearchIndexFields(indexName: string): Promise<Set<string>> {
    return (await this.getAzureSearchIndexSchema(indexName)).fields;
  }

  private azureSearchSelectFields(fields: Set<string>) {
    const preferred = [
      'id',
      'content',
      'text',
      'chunk',
      'pageContent',
      'body',
      'metadata',
      'embeddingName',
      'embeddingId',
      'title',
      'name',
      'documentId',
      'agentId',
      'contentHash',
      'extraFieldsJson',
      'blobName',
      'blobUrl',
    ];
    return preferred.filter((field) => fields.has(field)).join(',') || undefined;
  }

  private azureSearchVectorField(fields: Set<string>) {
    return ['content_vector', 'contentVector', 'vector', 'embedding', 'embeddingVector'].find((field) => fields.has(field)) || '';
  }

  private azureSearchTextFields(fields: Set<string>) {
    return ['content', 'text', 'chunk', 'pageContent', 'body'].filter((field) => fields.has(field));
  }

  private pickAzureSearchDocumentField<T = any>(document: any, fields: Set<string>, candidates: string[], fallback: T): T {
    const field = candidates.find((candidate) => fields.has(candidate) && document?.[candidate] !== undefined && document?.[candidate] !== null);
    return field ? document[field] : fallback;
  }

  private azureSearchSemanticConfiguration(schema: AzureSearchIndexSchema, params: any = {}) {
    if (params?.semantic === false || params?.useSemantic === false) return '';
    const requested = String(params?.semanticConfigurationName || params?.semanticConfiguration || '').trim();
    if (requested && schema.semanticConfigurations.has(requested)) return requested;
    if (schema.semanticConfigurations.has('content')) return 'content';
    if (schema.semanticConfigurations.has('semantic-config')) return 'semantic-config';
    return Array.from(schema.semanticConfigurations)[0] || '';
  }

  private async withTransientRetry<T>(label: string, operation: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const status = Number(error?.status || error?.statusCode || error?.response?.status || error?.cause?.status || 0);
        const retryable = !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
        if (!retryable || attempt >= attempts) break;
        const delayMs = Math.min(1500 * attempt, 5000);
        this.logger.warn(`${label} falhou na tentativa ${attempt}/${attempts}; tentando novamente em ${delayMs}ms: ${error?.message || String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async fetchWithRetry(label: string, url: string, init: any = {}) {
    return await this.withTransientRetry(label, async () => {
      const response = await fetch(url, init);
      if (response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500) {
        const error: any = new Error(`${label} retornou status ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response;
    });
  }

  private chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private contentHash(value: string) {
    return createHash('sha256').update(String(value || '')).digest('hex');
  }

  private ensureVectorDimensions(vector: any, expected: number | undefined, label: string) {
    if (!Array.isArray(vector) || !vector.length) {
      throw new BadRequestException(`${label} gerou vetor vazio.`);
    }
    if (expected && vector.length !== expected) {
      throw new BadRequestException(`${label} gerou vetor com ${vector.length} dimensoes, mas o destino espera ${expected}. Ajuste o modelo/deployment de embedding ou recrie o indice.`);
    }
  }

  private shouldUseAzureSearch(params: any, collectionName?: string) {
    const provider = String(params?.searchProvider || params?.vectorProvider || params?.provider || params?.ragProvider || this.configService.get<string>('RAG_VECTOR_PROVIDER') || '').toLowerCase();
    return (
      this.isAzureSearchConfigured(collectionName) &&
      (provider === 'azure_search' || provider === 'azure-search' || provider === 'azure' || provider === 'hybrid' || (!this.milvusClient && provider !== 'milvus'))
    );
  }

  private shouldUseMilvusSearch(params: any) {
    const provider = String(params?.searchProvider || params?.vectorProvider || params?.provider || params?.ragProvider || this.configService.get<string>('RAG_VECTOR_PROVIDER') || '').toLowerCase();
    if (provider === 'azure_search' || provider === 'azure-search' || provider === 'azure') return false;
    return Boolean(this.milvusClient);
  }

  private shouldUseAzureBlob(params: any) {
    const storageProvider = String(params?.storageProvider || '').toLowerCase();
    if (storageProvider === 'none') return false;
    if (storageProvider === 'azure_blob' || storageProvider === 'azure-blob' || storageProvider === 'blob') return true;
    return Boolean(this.azureBlobContainer);
  }

  private parseBoolean(value: any) {
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'sim'].includes(String(value || '').toLowerCase());
  }

  private parseJsonField<T = any>(value: any, fallback: T): T {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return fallback;
    }
  }

  private escapeMilvusString(value: string) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private isBinaryDecodedText(value: string) {
    const sample = String(value || '').slice(0, 2000);
    const replacementCount = (sample.match(/\uFFFD/g) || []).length;
    const controlCount = (sample.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
    return (
      replacementCount > Math.max(8, sample.length * 0.03) ||
      controlCount > Math.max(8, sample.length * 0.02)
    );
  }

  private buildDataUrl(buffer: Buffer, mimeType: string) {
    return `data:${mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
  }

  private sanitizeText(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/\?\?o/g, 'ção')
      .replace(/\?\?a/g, 'ção')
      .replace(/\?\?/g, 'ç')
      .replace(/n\?/g, 'nº')
      .replace(/N\?/g, 'Nº')
      .replace(/a\?o/g, 'ação')
      .replace(/i\?o/g, 'ição')
      .replace(/e\?o/g, 'eção')
      .replace(/o\?o/g, 'oção')
      .replace(/u\?o/g, 'ução')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') return this.sanitizeText(obj);
    if (Array.isArray(obj)) return obj.map((item) => this.sanitizeObject(item));
    if (obj && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = this.sanitizeObject(value);
        return acc;
      }, {} as Record<string, any>);
    }
    return obj;
  }

  private chunkText(text: string, chunkSize = 512, chunkOverlap = 70) {
    const clean = String(text || '').trim();
    if (!clean) return [];
    const size = Math.max(100, Math.floor(Number(chunkSize) || 512));
    const overlap = Math.max(0, Math.min(Math.floor(Number(chunkOverlap) || 0), size - 1));
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < clean.length) {
      let end = Math.min(clean.length, cursor + size);
      if (end < clean.length) {
        const window = clean.slice(cursor, end);
        const breakpoints = [window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf(' ')]
          .filter((index) => index > Math.floor(size * 0.55));
        if (breakpoints.length) end = cursor + Math.max(...breakpoints) + 1;
      }
      chunks.push(clean.slice(cursor, end).trim());
      if (end === clean.length) break;
      cursor = Math.max(0, end - overlap);
    }
    return chunks.filter(Boolean);
  }

  private normalizeMilvusResults(result: any, source: 'dense' | 'sparse') {
    const raw = Array.isArray(result?.results)
      ? result.results
      : Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : [];
    const flat = raw.flat ? raw.flat() : raw;
    return flat.map((hit: any) => {
      const entity = hit?.entity || hit;
      const id = String(entity?.id ?? hit?.id ?? hit?.pk ?? randomUUID());
      return {
        id,
        source,
        score: Number(hit?.score ?? hit?.distance ?? entity?.score ?? 0),
        embeddingName: entity?.embeddingName,
        agentId: entity?.agentId,
        embeddingId: entity?.embeddingId,
        extraFields: this.parseExtraFields(entity?.extraFields),
        text: entity?.text || '',
      };
    });
  }

  private normalizeMilvusData(response: any) {
    const raw = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
          ? response
          : [];

    return raw.map((row: any) => ({
      ...row,
      id: row?.id !== undefined && row?.id !== null ? String(row.id) : '',
      embeddingId: row?.embeddingId !== undefined && row?.embeddingId !== null ? String(row.embeddingId) : '',
      extraFields: this.parseJsonField(row?.extraFields, {}),
      text: row?.text || '',
    }));
  }

  private getChunkIndex(row: any) {
    const index = Number(row?.extraFields?.chunkIndex);
    if (Number.isFinite(index)) return index;
    const part = Number(row?.extraFields?.part);
    return Number.isFinite(part) ? Math.max(0, part - 1) : 0;
  }

  private stripChunkFields(extraFields: Record<string, any> = {}) {
    const { chunkIndex, chunksCount, part, totalParts, ...cleanExtraFields } = extraFields || {};
    return cleanExtraFields;
  }

  private async streamToString(stream: any) {
    if (!stream) return '';
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  private normalizeBlobSearchTerms(value: any) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return [];
    return raw
      .split(/[\s,;|]+/g)
      .map((term) => term.trim())
      .filter(Boolean);
  }

  private blobMatchesTerms(haystack: string, terms: string[]) {
    if (!terms.length) return true;
    return terms.every((term) => haystack.includes(term));
  }

  private detectTextOverlap(left: string, right: string) {
    const max = Math.min(600, left.length, right.length);
    for (let size = max; size >= 20; size -= 1) {
      if (left.slice(-size) === right.slice(0, size)) return size;
    }
    return 0;
  }

  private joinChunkTexts(rows: any[]) {
    const ordered = [...rows].sort((left, right) => this.getChunkIndex(left) - this.getChunkIndex(right));
    return ordered.reduce((content, row) => {
      const next = String(row?.text || '');
      if (!content) return next;
      const overlap = this.detectTextOverlap(content, next);
      return `${content}${next.slice(overlap)}`;
    }, '');
  }

  private buildAgentExpr(agentId?: string) {
    return agentId ? `agentId == "${this.escapeMilvusString(agentId)}"` : 'id >= 0';
  }

  private buildDocumentExpr(idOrEmbeddingId: string, agentId?: string) {
    const value = String(idOrEmbeddingId || '').trim();
    if (!value) {
      throw new BadRequestException('id is required');
    }

    const parts = [`embeddingId == "${this.escapeMilvusString(value)}"`];
    if (/^\d+$/.test(value)) parts.push(`id == ${value}`);
    const documentExpr = `(${parts.join(' || ')})`;
    return agentId ? `${documentExpr} && ${this.buildAgentExpr(agentId)}` : documentExpr;
  }

  private groupDocumentRows(rows: any[]) {
    const byKey = new Map<string, any[]>();

    rows.forEach((row) => {
      const key = String(row?.embeddingId || row?.id || randomUUID());
      const current = byKey.get(key) || [];
      current.push(row);
      byKey.set(key, current);
    });

    return Array.from(byKey.entries()).map(([key, group]) => {
      const ordered = [...group].sort((left, right) => this.getChunkIndex(left) - this.getChunkIndex(right));
      const first = ordered[0] || {};
      const text = this.joinChunkTexts(ordered);
      const extraFields = this.stripChunkFields(first.extraFields || {});

      return {
        id: first.id || key,
        embeddingId: first.embeddingId || key,
        embeddingName: first.embeddingName || extraFields?.title || 'Documento RAG',
        agentId: first.agentId || '',
        extraFields,
        chunksCount: ordered.length,
        ids: ordered.map((row) => row.id).filter(Boolean),
        text,
        textLength: text.length,
        textPreview: text.slice(0, 260),
      };
    });
  }

  private async queryRows(collectionName: string, filter: string, limit = 1000, offset = 0) {
    if (!this.milvusClient) {
      throw new BadRequestException('MILVUS_ADDRESS is not configured');
    }

    const response = await this.milvusClient.query({
      collection_name: collectionName,
      filter: filter || 'id >= 0',
      output_fields: ['id', 'text', 'embeddingName', 'embeddingId', 'agentId', 'extraFields'],
      limit,
      offset,
      timeout: 900000,
    } as any);

    return this.normalizeMilvusData(response);
  }

  private async flushCollection(collectionName: string) {
    if (!this.milvusClient) return;
    try {
      const client: any = this.milvusClient as any;
      if (client.flushSync) {
        await client.flushSync({ collection_names: [collectionName] } as any);
      } else if (client.flush) {
        await client.flush({ collection_names: [collectionName] } as any);
      }
    } catch {
      return undefined;
    }
  }

  private mergeHybridResults(denseResults: any[], sparseResults: any[], params: any) {
    const denseWeight = Number(params?.denseWeight ?? 0.7);
    const sparseWeight = Number(params?.sparseWeight ?? 0.3);
    const byId = new Map<string, any>();

    denseResults.forEach((item) => {
      byId.set(item.id, {
        ...item,
        denseScore: item.score,
        sparseScore: 0,
        score: item.score * denseWeight,
      });
    });

    sparseResults.forEach((item) => {
      const current = byId.get(item.id) || {
        ...item,
        denseScore: 0,
        sparseScore: 0,
        score: 0,
      };
      current.sparseScore = item.score;
      current.score = Number(current.score || 0) + item.score * sparseWeight;
      byId.set(item.id, current);
    });

    return Array.from(byId.values()).sort((left, right) => right.score - left.score);
  }

  private clampSearchInt(value: any, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  private clampSearchFloat(value: any, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  private getSearchScore(item: any): number {
    const raw = Number(item?.combinedScore ?? item?.score ?? item?.distance ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  }

  private parseExtraFields(extraFields: any) {
    if (!extraFields) return {};
    if (typeof extraFields === 'string') return this.parseJsonField(extraFields, {});
    return typeof extraFields === 'object' ? extraFields : {};
  }

  private checkRelevanceFlag(result: any): boolean {
    const extraFields = this.parseExtraFields(result?.extraFields);
    return extraFields?.relevante === true || extraFields?.relevant === true;
  }

  private applyRelevanceBoost(results: any, relevanceBoost = 1.5): any {
    if (!Array.isArray(results?.results) || relevanceBoost === 1) return results;

    const boostedResults = results.results
      .map((result: any) => {
        if (!this.checkRelevanceFlag(result)) return result;
        const originalScore = this.getSearchScore(result);
        return {
          ...result,
          score: originalScore * relevanceBoost,
          combinedScore: originalScore * relevanceBoost,
          originalScore,
          relevanceBoostApplied: true,
        };
      })
      .sort((left: any, right: any) => this.getSearchScore(right) - this.getSearchScore(left));

    return { ...results, results: boostedResults };
  }

  private combineSearchResultsV2(
    denseResults: any,
    sparseResults: any,
    denseWeight: number,
    sparseWeight: number,
    topK: number,
    relevanceBoost = 1.5,
    options?: {
      candidateTopK?: number;
      fusionStrategy?: 'rrf' | 'weighted_score';
      rrfK?: number;
      maxChunksPerDocument?: number;
      denseEfSearch?: number;
      sparseDropRatioSearch?: number;
    },
  ): any {
    const denseItems = Array.isArray(denseResults?.results) ? denseResults.results : [];
    const sparseItems = Array.isArray(sparseResults?.results) ? sparseResults.results : [];
    const scoreMap = new Map<string, any>();

    const dwRaw = Number(denseWeight);
    const swRaw = Number(sparseWeight);
    const dw = Number.isFinite(dwRaw) && dwRaw >= 0 ? dwRaw : 0.7;
    const sw = Number.isFinite(swRaw) && swRaw >= 0 ? swRaw : 0.3;
    const weightSum = dw + sw;
    const denseW = weightSum > 0 ? dw / weightSum : 0.7;
    const sparseW = weightSum > 0 ? sw / weightSum : 0.3;
    const fusionStrategy = options?.fusionStrategy === 'weighted_score' ? 'weighted_score' : 'rrf';
    const rrfK = Number.isFinite(Number(options?.rrfK)) ? Math.max(1, Math.floor(Number(options?.rrfK))) : 60;
    const maxChunksPerDocument =
      Number.isFinite(Number(options?.maxChunksPerDocument))
        ? Math.max(0, Math.floor(Number(options?.maxChunksPerDocument)))
        : 0;

    const buildNormalizedScoreMap = (items: any[]) => {
      const normalized = new Map<string, number>();
      const rows = items
        .map((item) => ({ id: String(item?.id ?? ''), score: this.getSearchScore(item) }))
        .filter((row) => row.id);
      if (!rows.length) return normalized;

      const values = rows.map((row) => row.score);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sameScore = Math.abs(max - min) < 1e-12;

      rows.forEach((row) => {
        normalized.set(row.id, sameScore ? 1 : (row.score - min) / (max - min));
      });
      return normalized;
    };

    const denseNormMap = buildNormalizedScoreMap(denseItems);
    const sparseNormMap = buildNormalizedScoreMap(sparseItems);

    const upsertBase = (item: any) => {
      const idKey = String(item?.id ?? '');
      if (!idKey) return null;
      if (!scoreMap.has(idKey)) {
        scoreMap.set(idKey, {
          ...item,
          denseScore: 0,
          sparseScore: 0,
          denseRank: null,
          sparseRank: null,
          denseNormalizedScore: 0,
          sparseNormalizedScore: 0,
          combinedScore: 0,
        });
      } else {
        const existing = scoreMap.get(idKey);
        scoreMap.set(idKey, {
          ...item,
          ...existing,
          id: existing?.id ?? item?.id,
          text: existing?.text || item?.text,
          embeddingName: existing?.embeddingName || item?.embeddingName,
          embeddingId: existing?.embeddingId || item?.embeddingId,
          agentId: existing?.agentId || item?.agentId,
          extraFields: existing?.extraFields ?? item?.extraFields,
        });
      }
      return scoreMap.get(idKey);
    };

    denseItems.forEach((item: any, index: number) => {
      const row = upsertBase(item);
      if (!row) return;
      const idKey = String(item?.id ?? '');
      row.denseScore = this.getSearchScore(item);
      row.denseRank = index + 1;
      row.denseNormalizedScore = denseNormMap.get(idKey) ?? 0;
    });

    sparseItems.forEach((item: any, index: number) => {
      const row = upsertBase(item);
      if (!row) return;
      const idKey = String(item?.id ?? '');
      row.sparseScore = this.getSearchScore(item);
      row.sparseRank = index + 1;
      row.sparseNormalizedScore = sparseNormMap.get(idKey) ?? 0;
    });

    for (const [idKey, row] of scoreMap.entries()) {
      const denseRank = typeof row.denseRank === 'number' ? row.denseRank : null;
      const sparseRank = typeof row.sparseRank === 'number' ? row.sparseRank : null;
      let combinedScore = 0;

      if (fusionStrategy === 'weighted_score') {
        combinedScore =
          (row.denseNormalizedScore || 0) * denseW +
          (row.sparseNormalizedScore || 0) * sparseW;
      } else {
        if (denseRank !== null) combinedScore += denseW * (1 / (rrfK + denseRank));
        if (sparseRank !== null) combinedScore += sparseW * (1 / (rrfK + sparseRank));
        combinedScore += 1e-6 * (((row.denseNormalizedScore || 0) * denseW) + ((row.sparseNormalizedScore || 0) * sparseW));
      }

      row.combinedScore = combinedScore;
      row.score = combinedScore;

      if (this.checkRelevanceFlag(row)) {
        row.combinedScore *= relevanceBoost;
        row.score = row.combinedScore;
        row.relevanceBoostApplied = true;
        this.logger.debug(`Relevance boost applied to document ${idKey}: score multiplied by ${relevanceBoost}`);
      }
    }

    const sorted = Array.from(scoreMap.values()).sort((left, right) => {
      const scoreDiff = this.getSearchScore(right) - this.getSearchScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      const denseDiff = (right.denseNormalizedScore || 0) - (left.denseNormalizedScore || 0);
      if (denseDiff !== 0) return denseDiff;
      return (right.sparseNormalizedScore || 0) - (left.sparseNormalizedScore || 0);
    });

    let diversified = false;
    let finalResults = sorted;
    if (maxChunksPerDocument > 0) {
      const perDocCounts = new Map<string, number>();
      const selected: any[] = [];
      const overflow: any[] = [];

      for (const item of sorted) {
        const groupKey = String(item?.embeddingId || item?.embeddingName || item?.id || '');
        const current = perDocCounts.get(groupKey) || 0;
        if (current < maxChunksPerDocument) {
          selected.push(item);
          perDocCounts.set(groupKey, current + 1);
        } else {
          overflow.push(item);
        }
      }

      finalResults = selected.length < topK ? [...selected, ...overflow] : selected;
      diversified = true;
    }

    return {
      results: finalResults.slice(0, topK),
      status: { error_code: 'Success', reason: 'Combined search results' },
      searchDebug: {
        mode: 'hybrid',
        topK,
        candidateTopK: options?.candidateTopK ?? null,
        fusionStrategy,
        rrfK: fusionStrategy === 'rrf' ? rrfK : null,
        denseWeight: denseW,
        sparseWeight: sparseW,
        denseEfSearch: options?.denseEfSearch ?? null,
        sparseDropRatioSearch: options?.sparseDropRatioSearch ?? null,
        denseResults: denseItems.length,
        sparseResults: sparseItems.length,
        uniqueCandidates: scoreMap.size,
        maxChunksPerDocument: maxChunksPerDocument > 0 ? maxChunksPerDocument : null,
        diversified,
      },
    };
  }

  private buildExtraFieldsExpr(extraFieldsFilter: any) {
    if (typeof extraFieldsFilter === 'string') {
      extraFieldsFilter = this.parseJsonField(extraFieldsFilter, null);
    }
    if (!extraFieldsFilter || typeof extraFieldsFilter !== 'object') return '';
    const parts: string[] = [];

    for (const [rawKey, value] of Object.entries(extraFieldsFilter)) {
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) continue;
      const key = this.escapeMilvusString(rawKey);
      const field = `extraFields["${key}"]`;

      if (Array.isArray(value)) {
        const choices = value
          .filter((item) => item !== undefined && item !== null && String(item).trim() !== '')
          .map((item) => this.formatMilvusValue(item));
        if (choices.length) parts.push(`(${choices.map((item) => `${field} == ${item}`).join(' || ')})`);
        continue;
      }

      parts.push(`${field} == ${this.formatMilvusValue(value)}`);
    }

    return parts.join(' && ');
  }

  private formatMilvusValue(value: any) {
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return `"${this.escapeMilvusString(String(value))}"`;
  }

  private mergeExtraFieldsFilters(base: any, override: any) {
    if (typeof base === 'string') base = this.parseJsonField(base, null);
    if (typeof override === 'string') override = this.parseJsonField(override, null);
    const merged: Record<string, any> = {};
    if (base && typeof base === 'object') Object.assign(merged, base);
    if (override && typeof override === 'object') {
      Object.entries(override).forEach(([key, value]) => {
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      });
    }
    return merged;
  }

  private isEmptyRoundFilter(round: any) {
    if (!round || typeof round !== 'object') return true;
    return Object.entries(round).every(([, value]) => (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ));
  }

  private getExtraField(item: any, field: string) {
    let extraFields = item?.extraFields;
    if (typeof extraFields === 'string') {
      try {
        extraFields = JSON.parse(extraFields);
      } catch {
        return undefined;
      }
    }
    return extraFields?.[field];
  }

  private toComparableMetadataValue(value: any) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const numeric = Number(value.trim().replace(',', '.').replace(/[^\d.-]/g, ''));
      if (Number.isFinite(numeric)) return numeric;
      return value.toLowerCase();
    }
    return value;
  }

  private applyMetadataOrdering(results: any[], params: any) {
    const field = Array.isArray(params?.extraFieldsFilterOrderBy)
      ? String(params.extraFieldsFilterOrderBy[0] || '').trim()
      : String(params?.orderBy || params?.sortBy || '').trim();
    if (!field) return results;

    const order = String(params?.order || params?.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    return [...results].sort((left, right) => {
      const leftValue = this.toComparableMetadataValue(this.getExtraField(left, field));
      const rightValue = this.toComparableMetadataValue(this.getExtraField(right, field));
      const leftMissing = leftValue === undefined || leftValue === null || leftValue === '';
      const rightMissing = rightValue === undefined || rightValue === null || rightValue === '';

      if (leftMissing && rightMissing) return this.getSearchScore(right) - this.getSearchScore(left);
      if (leftMissing) return 1;
      if (rightMissing) return -1;
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return order === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }
      return order === 'asc'
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    }).slice(0, this.clampSearchInt(params?.k || params?.topK || results.length, results.length, 1, Math.max(results.length, 1)));
  }

  async createCollection(collectionName?: string) {
    await this.refreshProviderSettings();
    if (!this.milvusClient) {
      throw new BadRequestException('MILVUS_ADDRESS is not configured');
    }
    const targetCollection = collectionName || this.getDefaultCollectionName();
    return await this.milvusClient.createCollection({
      collection_name: targetCollection,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'embeddingName',
          data_type: DataType.VarChar,
          max_length: 1000,
          enable_analyzer: true,
        },
        {
          name: 'agentId',
          data_type: DataType.VarChar,
          max_length: 500,
          enable_analyzer: true,
        },
        {
          name: 'embeddingId',
          data_type: DataType.VarChar,
          max_length: 500,
          enable_analyzer: true,
        },
        {
          name: 'extraFields',
          data_type: DataType.JSON,
          enable_analyzer: true,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 10000,
          enable_analyzer: true,
        },
        {
          name: 'dense',
          data_type: DataType.FloatVector,
          dim: this.getEmbeddingDimensions(),
        },
        {
          name: 'sparse',
          data_type: DataType.SparseFloatVector,
        },
      ],
      functions: [
        {
          name: 'text_bm25_emb',
          description: 'BM25 sparse vector from text',
          type: FunctionType.BM25,
          input_field_names: ['text'],
          output_field_names: ['sparse'],
          params: {},
        },
      ],
    } as any);
  }

  async createIndex(collectionName?: string) {
    await this.refreshProviderSettings();
    const targetCollection = collectionName || this.getDefaultCollectionName();
    const azureSearchConfigured = this.isAzureSearchConfigured(targetCollection);
    if (!this.milvusClient && !azureSearchConfigured) {
      throw new BadRequestException('Milvus ou Azure AI Search precisa estar configurado.');
    }
    let dense: any = null;
    let sparse: any = null;
    if (this.milvusClient) {
      dense = await this.milvusClient.createIndex({
        collection_name: targetCollection,
        field_name: 'dense',
        index_name: 'hnsw_index',
        index_type: 'HNSW',
        metric_type: 'COSINE',
        params: { M: 16, efConstruction: 200 },
      } as any);

      try {
        sparse = await this.milvusClient.createIndex({
          collection_name: targetCollection,
          field_name: 'sparse',
          index_name: 'bm25_index',
          index_type: 'SPARSE_INVERTED_INDEX',
          metric_type: 'BM25',
          params: {
            drop_ratio_build: 0.2,
            bm25_k1: 1.2,
            bm25_b: 0.75,
          },
        } as any);
      } catch (error: any) {
        this.logger.warn(`Sparse BM25 index creation skipped: ${error?.message || String(error)}`);
      }
    }
    const azureSearch = azureSearchConfigured ? await this.createAzureSearchIndex(targetCollection) : null;

    return { collectionName: targetCollection, dense, sparse, azureSearch };
  }

  async embeddingCreate(text: string, provider?: string, model?: string, agentId?: string) {
    const vectors = await this.embeddingCreateBatch([text], provider, model, agentId);
    return vectors[0];
  }

  async embeddingCreateBatch(texts: string[], provider?: string, model?: string, agentId?: string) {
    await this.refreshProviderSettings(agentId);
    const cleanTexts = (texts || []).map((text) => String(text || ''));
    if (!cleanTexts.length) return [];
    const normalizedProvider = this.normalizeOpenAIProvider(provider);
    const normalizedEffectiveProvider = this.normalizeOpenAIProvider(this.runtimeSettings?.llmProvider);
    const embeddingProvider =
      normalizedProvider === 'azure' || normalizedProvider === 'openai'
        ? normalizedProvider
        : normalizedEffectiveProvider === 'azure' || normalizedEffectiveProvider === 'openai'
          ? normalizedEffectiveProvider
          : 'openai';
    const client = this.getOpenAIClientForProvider(embeddingProvider);
    const embeddingModel = this.getEmbeddingModelForProvider(embeddingProvider, model);
    const response = await this.withTransientRetry('embedding batch', () => client.embeddings.create({
      model: embeddingModel,
      input: cleanTexts,
    }));
    const vectors = (response.data || [])
      .sort((left: any, right: any) => Number(left.index || 0) - Number(right.index || 0))
      .map((item: any) => item.embedding);
    if (vectors.length !== cleanTexts.length) {
      throw new BadRequestException(`Embedding retornou ${vectors.length} vetores para ${cleanTexts.length} textos.`);
    }
    return vectors;
  }

  private toAzureSafeId(value: string) {
    return Buffer.from(String(value || randomUUID())).toString('base64url').slice(0, 900);
  }

  private escapeODataString(value: string) {
    return String(value || '').replace(/'/g, "''");
  }

  private isAzureFilterable(schema: AzureSearchIndexSchema | undefined, field: string) {
    if (!schema) return true;
    return schema.filterableFields.has(field);
  }

  private pushAzureFilter(parts: string[], schema: AzureSearchIndexSchema | undefined, field: string, value: any) {
    if (value === undefined || value === null || value === '') return false;
    if (!this.isAzureFilterable(schema, field)) return false;
    parts.push(`${field} eq '${this.escapeODataString(String(value))}'`);
    return true;
  }

  private buildAzureFilter(agentId?: string, extraFieldsFilter?: any, schema?: AzureSearchIndexSchema) {
    const parts: string[] = [];
    if (agentId) {
      this.pushAzureFilter(parts, schema, 'agentId', agentId) ||
        this.pushAzureFilter(parts, schema, 'metadata/agentId', agentId);
    }
    const extra = typeof extraFieldsFilter === 'string' ? this.parseJsonField(extraFieldsFilter, null) : extraFieldsFilter;
    if (extra && typeof extra === 'object') {
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined || value === null || value === '') continue;
        if (key === 'embeddingName') {
          this.pushAzureFilter(parts, schema, 'embeddingName', value) ||
            this.pushAzureFilter(parts, schema, 'metadata/nomeEmbedding', value);
        } else if (key === 'embeddingId') {
          this.pushAzureFilter(parts, schema, 'embeddingId', value) ||
            this.pushAzureFilter(parts, schema, 'metadata/embeddingId', value);
        } else if (key === 'source' || key === 'marca') {
          this.pushAzureFilter(parts, schema, 'source', value) ||
            this.pushAzureFilter(parts, schema, 'metadata/source', value);
        } else if (key === 'attributes' || key === 'origem') {
          this.pushAzureFilter(parts, schema, 'attributes', value) ||
            this.pushAzureFilter(parts, schema, 'metadata/attributes', value);
        } else if (key === 'contentHash') {
          this.pushAzureFilter(parts, schema, 'contentHash', value) ||
            this.pushAzureFilter(parts, schema, 'metadata/contentHash', value);
        } else if (String(key).includes('/')) {
          this.pushAzureFilter(parts, schema, String(key), value);
        } else {
          this.pushAzureFilter(parts, schema, String(key), value);
        }
      }
    }
    return parts.join(' and ');
  }

  private buildAzureRagMetadata(row: any, blob?: { blobName?: string; blobUrl?: string }) {
    const extraFields = row?.extraFields || {};
    return {
      source: String(extraFields.source ?? extraFields.marca ?? ''),
      attributes: String(extraFields.attributes ?? extraFields.origem ?? ''),
      embeddingId: String(row?.embeddingId || ''),
      agentId: String(row?.agentId || ''),
      nomeEmbedding: String(row?.embeddingName || ''),
      filename: String(extraFields.filename || extraFields.arquivo || ''),
      chunkIndex: String(extraFields.chunkIndex ?? ''),
      chunksCount: String(extraFields.chunksCount ?? ''),
      part: String(extraFields.part ?? ''),
      totalParts: String(extraFields.totalParts ?? ''),
      contentHash: String(extraFields.contentHash || this.contentHash(row?.text || '')),
      blobName: String(blob?.blobName || ''),
      blobUrl: String(blob?.blobUrl || ''),
    };
  }

  private buildAzureDocumentMetadata(schema: AzureSearchIndexSchema, row: any, blob?: { blobName?: string; blobUrl?: string }) {
    const metadata = this.buildAzureRagMetadata(row, blob);
    const complexMetadata = Object.entries(metadata).reduce((acc, [key, value]) => {
      if (schema.fields.has(`metadata/${key}`)) acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
    if (Object.keys(complexMetadata).length) return complexMetadata;
    return JSON.stringify({
      ...row?.extraFields,
      embeddingId: row?.embeddingId || '',
      agentId: row?.agentId || '',
      nomeEmbedding: row?.embeddingName || '',
      blobName: blob?.blobName || '',
      blobUrl: blob?.blobUrl || '',
    });
  }

  private buildAzureBlobChunkPayload(row: any) {
    return {
      content: String(row?.text || ''),
      text: String(row?.text || ''),
      content_vector: Array.isArray(row?.dense) ? row.dense : undefined,
      vectorDimensions: Array.isArray(row?.dense) ? row.dense.length : 0,
      contentHash: row?.extraFields?.contentHash || this.contentHash(row?.text || ''),
      embeddingProvider: row?.embeddingProvider || '',
      embeddingModel: row?.embeddingModel || '',
      metadata: {
        ...this.buildAzureRagMetadata(row),
        ...(row?.extraFields || {}),
      },
      extraFields: row?.extraFields || {},
      agenteId: row?.agentId || '',
      agentId: row?.agentId || '',
      nomeEmbedding: row?.embeddingName || '',
      embeddingName: row?.embeddingName || '',
      embeddingId: row?.embeddingId || '',
      createdAt: new Date().toISOString(),
    };
  }

  private normalizeAzureBlobJsonPayload(value: string) {
    const parsed = this.parseJsonField<any>(value, null);
    if (!parsed || typeof parsed !== 'object') return null;
    const vector = parsed.content_vector || parsed.contentVector || parsed.vector || parsed.embedding;
    return {
      parsed,
      text: String(parsed.content ?? parsed.text ?? parsed.pageContent ?? parsed.chunk ?? parsed.body ?? ''),
      vectorDimensions: Array.isArray(vector) ? vector.length : 0,
      metadata: parsed.metadata || parsed.extraFields || {},
    };
  }

  private async uploadRowsToAzureBlob(rows: any[], collectionName: string) {
    if (!this.azureBlobContainer) return [];
    await this.azureBlobContainer.createIfNotExists().catch(() => undefined);
    const uploaded: Array<{ id: string; blobName: string; blobUrl: string }> = [];

    for (const row of rows) {
      const id = this.toAzureSafeId(`${row.embeddingId}-${row.extraFields?.chunkIndex ?? randomUUID()}`);
      const blobName = `${collectionName}/${row.agentId || 'global'}/${row.embeddingId || id}/${row.extraFields?.chunkIndex ?? 0}.json`;
      const blob = this.azureBlobContainer.getBlockBlobClient(blobName);
      const payload = this.buildAzureBlobChunkPayload(row);
      const content = JSON.stringify(payload);
      await this.withTransientRetry('azure blob upload', () => blob.upload(content, Buffer.byteLength(content, 'utf-8'), {
        blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
        metadata: {
          embeddingId: String(row.embeddingId || '').slice(0, 1024),
          agentId: String(row.agentId || '').slice(0, 1024),
          source: String(row.extraFields?.source || row.extraFields?.marca || '').slice(0, 1024),
          attributes: String(row.extraFields?.attributes || row.extraFields?.origem || '').slice(0, 1024),
          nomeEmbedding: String(row.embeddingName || '').slice(0, 1024),
          chunkIndex: String(row.extraFields?.chunkIndex ?? '').slice(0, 1024),
          contentHash: String(row.extraFields?.contentHash || this.contentHash(row.text || '')).slice(0, 1024),
        },
      }));
      uploaded.push({
        id,
        blobName,
        blobUrl: blob.url,
        text: String(row.text || ''),
        embeddingName: row.embeddingName || '',
        embeddingId: row.embeddingId || '',
        agentId: row.agentId || '',
        extraFields: row.extraFields || {},
      } as any);
    }

    return uploaded;
  }

  async uploadTextToAzureBlob(blobName: string, content: string, contentType = 'text/plain') {
    await this.refreshProviderSettings();
    if (!this.azureBlobContainer) {
      throw new BadRequestException('Azure Blob Storage nao esta configurado.');
    }
    const safeBlobName = String(blobName || `${randomUUID()}.txt`)
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
      .replace(/\.\./g, '.');
    await this.azureBlobContainer.createIfNotExists().catch(() => undefined);
    const blob = this.azureBlobContainer.getBlockBlobClient(safeBlobName);
    await this.withTransientRetry('azure blob upload', () => blob.upload(content || '', Buffer.byteLength(content || '', 'utf-8'), {
      blobHTTPHeaders: { blobContentType: contentType || 'text/plain' },
    }));
    return {
      blobName: safeBlobName,
      blobUrl: blob.url,
      contentType: contentType || 'text/plain',
      bytes: Buffer.byteLength(content || '', 'utf-8'),
    };
  }

  async uploadChunksToAzureBlob(params: {
    collectionName?: string;
    text: string;
    embeddingName?: string;
    embeddingId?: string;
    agentId?: string;
    extraFields?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingBatchSize?: number;
  }) {
    await this.refreshProviderSettings(params?.agentId);
    if (!this.azureBlobContainer) {
      throw new BadRequestException('Azure Blob Storage nao esta configurado.');
    }
    const text = this.sanitizeText(params?.text || '');
    if (!text) {
      throw new BadRequestException('text is required');
    }

    const chunkSize = this.clampSearchInt(params?.chunkSize, 512, 100, 10000);
    const chunkOverlap = this.clampSearchInt(params?.chunkOverlap, 70, 0, Math.max(0, chunkSize - 1));
    const embeddingBatchSize = this.clampSearchInt((params as any)?.embeddingBatchSize, 64, 1, 256);
    const chunks = this.chunkText(text, chunkSize, chunkOverlap);
    const embeddingId = params?.embeddingId || randomUUID();
    const baseExtraFields = this.sanitizeObject(params?.extraFields || {});
    const rows: any[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const hash = this.contentHash(chunk);
      rows.push({
        embeddingName: this.sanitizeText(params?.embeddingName || baseExtraFields?.title || 'document'),
        embeddingId,
        agentId: params?.agentId || '',
        extraFields: {
          ...baseExtraFields,
          chunkIndex: index,
          chunksCount: chunks.length,
          part: index + 1,
          totalParts: chunks.length,
          contentHash: hash,
        },
        text: chunk,
        embeddingProvider: params?.embeddingProvider || '',
        embeddingModel: params?.embeddingModel || '',
      });
    }
    for (const batch of this.chunkArray(rows, embeddingBatchSize)) {
      const vectors = await this.embeddingCreateBatch(batch.map((row) => row.text), params?.embeddingProvider, params?.embeddingModel, params?.agentId);
      vectors.forEach((vector, index) => {
        batch[index].dense = vector;
      });
    }
    const collectionName = params?.collectionName || this.getDefaultCollectionName();
    const blobs = await this.uploadRowsToAzureBlob(rows, collectionName);
    return {
      collectionName,
      embeddingName: rows[0]?.embeddingName,
      embeddingId,
      chunks: rows.length,
      blobs,
    };
  }

  async listAzureBlobDocuments(prefix = '', options: any = {}) {
    await this.refreshProviderSettings(options?.agentId);
    if (!this.azureBlobContainer) {
      throw new BadRequestException('Azure Blob Storage nao esta configurado.');
    }
    const safePrefix = String(prefix || '').replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.\./g, '.');
    const limit = this.clampSearchInt(options?.limit, 100, 1, 1000);
    const includeText = options?.includeText === true;
    const query = String(options?.query || '').trim().toLowerCase();
    const queryTerms = this.normalizeBlobSearchTerms(query);
    const contentTypeFilter = String(options?.contentType || '').trim().toLowerCase();
    const modifiedAfter = options?.modifiedAfter ? new Date(options.modifiedAfter) : null;
    const modifiedBefore = options?.modifiedBefore ? new Date(options.modifiedBefore) : null;
    const minBytes = Number(options?.minBytes);
    const maxBytes = Number(options?.maxBytes);
    const maxTextBytes = this.clampSearchInt(options?.maxTextBytes, 2_000_000, 1, 10_000_000);
    const blobs: any[] = [];
    const debug = {
      scanned: 0,
      skippedByContentType: 0,
      skippedBySize: 0,
      skippedByDate: 0,
      skippedByQuery: 0,
      textDownloads: 0,
      textDownloadErrors: 0,
      textSkippedBySize: 0,
    };

    for await (const item of this.azureBlobContainer.listBlobsFlat({
      prefix: safePrefix || undefined,
      includeMetadata: true,
    } as any)) {
      debug.scanned += 1;
      const blob = this.azureBlobContainer.getBlockBlobClient(item.name);
      const row: any = {
        blobName: item.name,
        blobUrl: blob.url,
        contentType: item.properties.contentType || '',
        size: item.properties.contentLength || 0,
        lastModified: item.properties.lastModified?.toISOString?.() || item.properties.lastModified || null,
        metadata: item.metadata || {},
      };
      const rowModified = row.lastModified ? new Date(row.lastModified) : null;
      if (contentTypeFilter && !String(row.contentType || '').toLowerCase().includes(contentTypeFilter)) {
        debug.skippedByContentType += 1;
        continue;
      }
      if (Number.isFinite(minBytes) && row.size < minBytes) {
        debug.skippedBySize += 1;
        continue;
      }
      if (Number.isFinite(maxBytes) && row.size > maxBytes) {
        debug.skippedBySize += 1;
        continue;
      }
      if (modifiedAfter && !Number.isNaN(modifiedAfter.getTime()) && rowModified && rowModified < modifiedAfter) {
        debug.skippedByDate += 1;
        continue;
      }
      if (modifiedBefore && !Number.isNaN(modifiedBefore.getTime()) && rowModified && rowModified > modifiedBefore) {
        debug.skippedByDate += 1;
        continue;
      }

      let haystack = [
        row.blobName,
        row.contentType,
        JSON.stringify(row.metadata || {}),
      ].join('\n').toLowerCase();
      const metadataMatchesQuery = this.blobMatchesTerms(haystack, queryTerms);

      if (includeText && (!queryTerms.length || !metadataMatchesQuery)) {
        if (row.size <= maxTextBytes) {
          try {
            const download = await blob.download(0);
            row.text = await this.streamToString(download.readableStreamBody);
            const jsonPayload = this.normalizeAzureBlobJsonPayload(row.text);
            if (jsonPayload) {
              row.payload = jsonPayload.parsed;
              row.text = jsonPayload.text;
              row.metadata = { ...(row.metadata || {}), ...(jsonPayload.metadata || {}) };
              row.vectorDimensions = jsonPayload.vectorDimensions;
              row.hasVector = jsonPayload.vectorDimensions > 0;
            }
            row.textPreview = String(row.text || '').slice(0, 500);
            debug.textDownloads += 1;
            haystack = `${haystack}\n${String(row.text || '').toLowerCase()}`;
          } catch (error: any) {
            row.text = '';
            row.textError = error?.message || String(error);
            debug.textDownloadErrors += 1;
          }
        } else {
          row.text = '';
          row.textSkipped = `Blob com ${row.size} bytes maior que o limite de leitura ${maxTextBytes}.`;
          debug.textSkippedBySize += 1;
        }
      }

      if (queryTerms.length && !this.blobMatchesTerms(haystack, queryTerms)) {
        debug.skippedByQuery += 1;
        continue;
      }
      blobs.push(row);
      if (blobs.length >= limit) break;
    }

    return {
      prefix: safePrefix,
      filters: {
        query,
        contentType: contentTypeFilter,
        modifiedAfter: options?.modifiedAfter || '',
        modifiedBefore: options?.modifiedBefore || '',
        minBytes: Number.isFinite(minBytes) ? minBytes : null,
        maxBytes: Number.isFinite(maxBytes) ? maxBytes : null,
        maxTextBytes,
      },
      debug,
      total: blobs.length,
      blobs,
    };
  }

  async readAzureBlobDocument(blobName: string) {
    await this.refreshProviderSettings();
    if (!this.azureBlobContainer) {
      throw new BadRequestException('Azure Blob Storage nao esta configurado.');
    }
    const safeBlobName = String(blobName || '').replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.\./g, '.');
    if (!safeBlobName) {
      throw new BadRequestException('blobName is required');
    }
    const blob = this.azureBlobContainer.getBlockBlobClient(safeBlobName);
    const exists = await blob.exists();
    if (!exists) {
      throw new BadRequestException('Blob nao encontrado.');
    }
    const properties = await blob.getProperties();
    const download = await blob.download(0);
    const rawText = await this.streamToString(download.readableStreamBody);
    const jsonPayload = this.normalizeAzureBlobJsonPayload(rawText);
    return {
      blobName: safeBlobName,
      blobUrl: blob.url,
      contentType: properties.contentType || '',
      size: properties.contentLength || Buffer.byteLength(rawText, 'utf-8'),
      lastModified: properties.lastModified?.toISOString?.() || properties.lastModified || null,
      metadata: { ...(properties.metadata || {}), ...(jsonPayload?.metadata || {}) },
      text: jsonPayload?.text ?? rawText,
      rawText: jsonPayload ? undefined : rawText,
      payload: jsonPayload?.parsed,
      hasVector: Boolean(jsonPayload?.vectorDimensions),
      vectorDimensions: jsonPayload?.vectorDimensions || 0,
    };
  }

  private async indexRowsInAzureSearch(collectionName: string, rows: any[], uploadedBlobs: Array<{ id: string; blobName: string; blobUrl: string; text?: string; embeddingName?: string; embeddingId?: string; agentId?: string; extraFields?: Record<string, any> }> = []) {
    if (!this.isAzureSearchConfigured(collectionName) || !rows.length) return null;
    const endpoint = this.getAzureSearchEndpoint();
    const indexName = this.getAzureSearchIndexName(collectionName);
    const schema = await this.getAzureSearchIndexSchema(indexName);
    const fields = schema.fields;
    const vectorField = this.azureSearchVectorField(fields);
    const textFields = this.azureSearchTextFields(fields);
    if (!vectorField) {
      throw new BadRequestException('Azure AI Search precisa de um campo vetorial no indice: content_vector, contentVector, vector, embedding ou embeddingVector.');
    }
    if (!textFields.length) {
      throw new BadRequestException('Azure AI Search precisa de um campo textual pesquisavel: content, text, chunk, pageContent ou body.');
    }
    const expectedDimensions = schema.vectorDimensions.get(vectorField);
    const url = `${endpoint}/indexes/${encodeURIComponent(indexName)}/docs/index?api-version=${this.getAzureSearchApiVersion()}`;
    const blobByIndex = new Map(uploadedBlobs.map((blob, index) => [index, blob]));
    const value = rows.map((row, index) => {
      const blob = blobByIndex.get(index);
      const id = blob?.id || this.toAzureSafeId(`${row.embeddingId}-${row.extraFields?.chunkIndex ?? index}`);
      this.ensureVectorDimensions(row.dense, expectedDimensions, `Azure AI Search/${vectorField}`);
      const document: Record<string, any> = {
        '@search.action': 'mergeOrUpload',
        id,
        embeddingName: row.embeddingName || '',
        embeddingId: row.embeddingId || '',
        agentId: row.agentId || '',
        source: row.extraFields?.source || row.extraFields?.marca || '',
        attributes: row.extraFields?.attributes || row.extraFields?.origem || '',
        contentHash: row.extraFields?.contentHash || this.contentHash(row.text || ''),
        extraFieldsJson: JSON.stringify(row.extraFields || {}),
        blobName: blob?.blobName || '',
        blobUrl: blob?.blobUrl || '',
        [vectorField]: row.dense,
      };
      if (fields.has('metadata')) {
        document.metadata = this.buildAzureDocumentMetadata(schema, row, blob);
      }
      Object.entries(row.extraFields || {}).forEach(([key, value]) => {
        if (!fields.has(key) || Object.prototype.hasOwnProperty.call(document, key)) return;
        if (value === undefined || value === null) return;
        document[key] = typeof value === 'object' ? JSON.stringify(value) : value;
      });
      textFields.forEach((field) => {
        document[field] = row.text;
      });
      Object.keys(document).forEach((key) => {
        if (key !== '@search.action' && !fields.has(key)) delete document[key];
      });
      return document;
    });

    const batches = this.chunkArray(value, 500);
    const responses: any[] = [];
    for (const batch of batches) {
      const response = await this.fetchWithRetry('azure search index', url, {
        method: 'POST',
        headers: {
          'api-key': this.getAzureSearchApiKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: batch }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new BadRequestException({
          message: 'Azure AI Search index failed',
          status: response.status,
          body,
        });
      }
      responses.push(body);
    }
    return {
      indexed: value.length,
      batches: batches.length,
      vectorField,
      textFields,
      expectedDimensions: expectedDimensions || null,
      responses,
    };
  }

  private async createAzureSearchIndex(collectionName: string) {
    if (!this.getAzureSearchEndpoint() || !this.getAzureSearchApiKey()) return null;
    const indexName = this.getAzureSearchIndexName(collectionName);
    if (!indexName) return null;
    const dimensions = this.getEmbeddingDimensions();
    const url = `${this.getAzureSearchEndpoint()}/indexes/${encodeURIComponent(indexName)}?api-version=${this.getAzureSearchApiVersion()}`;
    const response = await this.fetchWithRetry('azure search create index', url, {
      method: 'PUT',
      headers: {
        'api-key': this.getAzureSearchApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: indexName,
        fields: [
          { name: 'id', type: 'Edm.String', key: true, filterable: true },
          { name: 'content', type: 'Edm.String', searchable: true },
          { name: 'text', type: 'Edm.String', searchable: true },
          { name: 'embeddingName', type: 'Edm.String', searchable: true, filterable: true, sortable: true },
          { name: 'embeddingId', type: 'Edm.String', filterable: true },
          { name: 'agentId', type: 'Edm.String', filterable: true },
          { name: 'source', type: 'Edm.String', searchable: true, filterable: true },
          { name: 'attributes', type: 'Edm.String', searchable: true, filterable: true },
          { name: 'contentHash', type: 'Edm.String', filterable: true },
          { name: 'extraFieldsJson', type: 'Edm.String', searchable: true },
          {
            name: 'metadata',
            type: 'Edm.ComplexType',
            fields: [
              { name: 'source', type: 'Edm.String', searchable: true, filterable: true },
              { name: 'attributes', type: 'Edm.String', searchable: true, filterable: true },
              { name: 'embeddingId', type: 'Edm.String', filterable: true },
              { name: 'agentId', type: 'Edm.String', filterable: true },
              { name: 'nomeEmbedding', type: 'Edm.String', searchable: true, filterable: true },
              { name: 'filename', type: 'Edm.String', searchable: true, filterable: true },
              { name: 'chunkIndex', type: 'Edm.String', filterable: true },
              { name: 'chunksCount', type: 'Edm.String', filterable: true },
              { name: 'part', type: 'Edm.String', filterable: true },
              { name: 'totalParts', type: 'Edm.String', filterable: true },
              { name: 'contentHash', type: 'Edm.String', filterable: true },
              { name: 'blobName', type: 'Edm.String', filterable: true },
              { name: 'blobUrl', type: 'Edm.String' },
            ],
          },
          { name: 'blobName', type: 'Edm.String', filterable: true },
          { name: 'blobUrl', type: 'Edm.String' },
          {
            name: 'content_vector',
            type: 'Collection(Edm.Single)',
            searchable: true,
            dimensions,
            vectorSearchProfile: 'vector-profile',
          },
          {
            name: 'contentVector',
            type: 'Collection(Edm.Single)',
            searchable: true,
            dimensions,
            vectorSearchProfile: 'vector-profile',
          },
        ],
        vectorSearch: {
          algorithms: [
            {
              name: 'hnsw',
              kind: 'hnsw',
              hnswParameters: {
                metric: 'cosine',
                m: 16,
                efConstruction: 200,
                efSearch: 128,
              },
            },
          ],
          profiles: [
            {
              name: 'vector-profile',
              algorithm: 'hnsw',
            },
          ],
        },
        semantic: {
          configurations: [
            {
              name: 'semantic-config',
              prioritizedFields: {
                contentFields: [{ fieldName: 'content' }],
                titleField: { fieldName: 'embeddingName' },
              },
            },
            {
              name: 'content',
              prioritizedFields: {
                contentFields: [{ fieldName: 'content' }],
                titleField: { fieldName: 'embeddingName' },
              },
            },
          ],
        },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BadRequestException({
        message: 'Azure AI Search create index failed',
        status: response.status,
        body,
      });
    }
    this.azureSearchFieldCache.delete(`${this.getAzureSearchEndpoint()}::${indexName}`);
    return body;
  }

  private async searchAzureSearch(query: string, collectionName: string, agentId: string | undefined, params: any = {}) {
    if (!this.isAzureSearchConfigured(collectionName)) {
      return { results: [], warning: 'Azure AI Search is not configured' };
    }
    const denseVector = await this.embeddingCreate(query, params?.embeddingProvider, params?.embeddingModel, agentId);
    const topK = this.clampSearchInt(params?.k ?? params?.topK, 15, 1, 100);
    const candidateTopK = this.clampSearchInt(params?.candidateTopK, Math.max(topK, topK * 4), topK, 200);
    const endpoint = this.getAzureSearchEndpoint();
    const indexName = this.getAzureSearchIndexName(collectionName);
    const schema = await this.getAzureSearchIndexSchema(indexName);
    const fields = schema.fields;
    const select = this.azureSearchSelectFields(fields);
    const vectorField = this.azureSearchVectorField(fields);
    if (!vectorField) {
      throw new BadRequestException('Azure AI Search precisa de um campo vetorial no indice: content_vector, contentVector, vector, embedding ou embeddingVector.');
    }
    this.ensureVectorDimensions(denseVector, schema.vectorDimensions.get(vectorField), `Azure AI Search/${vectorField}`);
    const semanticConfiguration = this.azureSearchSemanticConfiguration(schema, params);
    const url = `${endpoint}/indexes/${encodeURIComponent(indexName)}/docs/search?api-version=${this.getAzureSearchApiVersion()}`;
    const baseExtraFieldsFilter = params?.extraFieldsFilter || params?.metadataFilter || params?.meta || null;
    const perRoundFilters = Array.isArray(params?.extraFieldsFilterPerRound) ? params.extraFieldsFilterPerRound : null;
    const perRoundLimitValues = Array.isArray(params?.extraFieldsFilterPerRoundLimits)
      ? params.extraFieldsFilterPerRoundLimits.map((value: any) => {
          if (value === undefined || value === null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
        })
      : null;
    const hasPerRoundLimits = Boolean(perRoundLimitValues?.some((value: number | null) => value !== null));
    const roundStopFind = params?.roundStopFind !== false;
    const roundMixHalf = params?.roundMixHalf === true;
    const rawFilter = String(params?.filterExpression || params?.filterExpr || '').trim();

    const runRound = async (extraFieldsFilter: any) => {
      const structuredFilter = this.buildAzureFilter(agentId, extraFieldsFilter, schema);
      const filter = [structuredFilter, rawFilter].filter(Boolean).join(' and ');
      const payload: Record<string, any> = {
        search: query,
        top: topK,
        filter: filter || undefined,
        select,
        vectorQueries: [
          {
            kind: 'vector',
            vector: denseVector,
            fields: vectorField,
            k: candidateTopK,
          },
        ],
      };
      if (semanticConfiguration) {
        payload.queryType = 'semantic';
        payload.semanticConfiguration = semanticConfiguration;
        payload.captions = 'extractive';
        payload.answers = 'extractive|count-3';
      }
      if (params?.exhaustive === true) {
        payload.vectorQueries[0].exhaustive = true;
      }
      const response = await this.fetchWithRetry('azure search query', url, {
        method: 'POST',
        headers: {
          'api-key': this.getAzureSearchApiKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new BadRequestException({
          message: 'Azure AI Search query failed',
          status: response.status,
          body,
        });
      }

      const results = (Array.isArray(body?.value) ? body.value : []).map((item: any) => {
        const metadata = this.pickAzureSearchDocumentField<Record<string, any>>(item, fields, ['metadata'], {});
        const extraFields = this.parseJsonField(this.pickAzureSearchDocumentField(item, fields, ['extraFieldsJson'], {}), {});
        return {
          id: String(this.pickAzureSearchDocumentField(item, fields, ['id'], randomUUID())),
          source: 'azure_search',
          score: Number(item['@search.score'] || item.score || 0),
          rerankerScore: Number(item['@search.rerankerScore'] || 0),
          embeddingName: this.pickAzureSearchDocumentField(item, fields, ['embeddingName', 'title', 'name'], metadata?.nomeEmbedding || ''),
          embeddingId: this.pickAzureSearchDocumentField(item, fields, ['embeddingId', 'documentId'], metadata?.embeddingId || ''),
          agentId: this.pickAzureSearchDocumentField(item, fields, ['agentId'], metadata?.agentId || ''),
          extraFields: { ...(typeof metadata === 'object' ? metadata : {}), ...(extraFields || {}) },
          text: this.pickAzureSearchDocumentField(item, fields, ['content', 'text', 'chunk', 'pageContent', 'body'], ''),
          blobName: this.pickAzureSearchDocumentField(item, fields, ['blobName'], metadata?.blobName || ''),
          blobUrl: this.pickAzureSearchDocumentField(item, fields, ['blobUrl'], metadata?.blobUrl || ''),
          contentHash: this.pickAzureSearchDocumentField(item, fields, ['contentHash'], metadata?.contentHash || ''),
          captions: item['@search.captions'] || undefined,
        };
      });

      return {
        results,
        denseCount: results.length,
        sparseCount: 0,
        searchDebug: {
          mode: 'azure_search_hybrid',
          topK,
          candidateTopK,
          indexName,
          select,
          vectorField,
          semanticConfiguration: semanticConfiguration || null,
          answers: body?.['@search.answers'] || undefined,
          filter: filter || null,
        },
      };
    };

    const filtersToTry = perRoundFilters?.length
      ? perRoundFilters.map((round: any) => (
          this.isEmptyRoundFilter(round) ? null : this.mergeExtraFieldsFilters(baseExtraFieldsFilter, round)
        ))
      : [baseExtraFieldsFilter];

    if (filtersToTry.length <= 1) {
      const single = await runRound(filtersToTry[0]);
      return {
        ...single,
        results: this.applyMetadataOrdering(single.results || [], params).slice(0, topK),
      };
    }

    let lastResult: any = null;
    const collected: Array<{ item: any; roundIndex: number }> = [];
    const baseRoundLimit = filtersToTry.length ? Math.floor(topK / filtersToTry.length) : topK;
    const remainder = filtersToTry.length ? topK - baseRoundLimit * filtersToTry.length : 0;

    for (let roundIndex = 0; roundIndex < filtersToTry.length; roundIndex += 1) {
      const result = await runRound(filtersToTry[roundIndex]);
      lastResult = result;
      if (result.results.length && roundStopFind) {
        return {
          ...result,
          results: this.applyMetadataOrdering(result.results, params).slice(0, topK),
          roundIndex,
          rounds: filtersToTry.length,
        };
      }

      if (result.results.length) {
        const configuredLimit = hasPerRoundLimits ? perRoundLimitValues?.[roundIndex] : null;
        const roundLimit = typeof configuredLimit === 'number'
          ? configuredLimit
          : roundMixHalf
            ? Math.max(1, baseRoundLimit + (roundIndex < remainder ? 1 : 0))
            : result.results.length;
        result.results.slice(0, roundLimit).forEach((item: any) => collected.push({ item, roundIndex }));
      }
    }

    if (collected.length) {
      const byId = new Map<string, { item: any; roundIndex: number }>();
      collected.forEach((entry) => {
        const id = String(entry.item?.id || entry.item?.embeddingId || entry.item?.text || '');
        const previous = byId.get(id);
        if (!previous || entry.roundIndex < previous.roundIndex || this.getSearchScore(entry.item) > this.getSearchScore(previous.item)) {
          byId.set(id, entry);
        }
      });
      const mergedRounds = Array.from(byId.values())
        .sort((left, right) => {
          if (left.roundIndex !== right.roundIndex) return left.roundIndex - right.roundIndex;
          return this.getSearchScore(right.item) - this.getSearchScore(left.item);
        })
        .map((entry) => entry.item);

      return {
        ...(lastResult || {}),
        results: this.applyMetadataOrdering(mergedRounds, params).slice(0, topK),
        rounds: filtersToTry.length,
      };
    }

    return {
      ...(lastResult || { denseCount: 0, sparseCount: 0 }),
      results: this.applyMetadataOrdering(lastResult?.results || [], params).slice(0, topK),
      rounds: filtersToTry.length,
    };
  }

  async addDocuments(collectionName: string | undefined, documents: RagDocumentInput[], options: any = {}) {
    const settingsAgentId = this.resolveDocumentsSettingsAgentId(documents, options);
    await this.refreshProviderSettings(settingsAgentId);
    const targetCollection = collectionName || this.getDefaultCollectionName();
    const azureSearchConfigured = this.isAzureSearchConfigured(targetCollection);
    const requestedSearchProvider = String(options?.searchProvider || options?.vectorProvider || options?.provider || options?.ragProvider || '').toLowerCase();
    if (requestedSearchProvider === 'milvus' && !this.milvusClient) {
      throw new BadRequestException('Milvus foi selecionado, mas nao esta configurado.');
    }
    if ((requestedSearchProvider === 'azure_search' || requestedSearchProvider === 'azure-search' || requestedSearchProvider === 'azure') && !azureSearchConfigured) {
      throw new BadRequestException('Azure AI Search foi selecionado, mas nao esta configurado.');
    }
    if (!this.milvusClient && !azureSearchConfigured) {
      throw new BadRequestException('MILVUS_ADDRESS or Azure AI Search must be configured');
    }
    const chunkSize = this.clampSearchInt(options?.chunkSize, 512, 100, 10000);
    const chunkOverlap = this.clampSearchInt(options?.chunkOverlap, 70, 0, Math.max(0, chunkSize - 1));
    const batchSize = this.clampSearchInt(options?.batchSize, 100, 1, 500);
    const embeddingBatchSize = this.clampSearchInt(options?.embeddingBatchSize, 64, 1, 256);
    const deduplicate = options?.deduplicate === true;
    const noSplit = options?.noSplit === true;
    const noHeader = options?.noHeader === true;
    const rows: any[] = [];
    const processedTexts = new Set<string>();

    const sanitizedDocuments = (documents || []).map((document) => ({
      ...document,
      text: this.sanitizeText(document?.text || ''),
      embeddingName: this.sanitizeText(document?.embeddingName || document?.extraFields?.title || 'document'),
      extraFields: this.sanitizeObject(document?.extraFields || {}),
    }));

    for (const document of sanitizedDocuments) {
      if (!document.text) continue;

      const embeddingId = document.embeddingId || randomUUID();
      const baseExtraFields = document.extraFields || {};
      const chunks = noSplit ? [document.text] : this.chunkText(document.text, chunkSize, chunkOverlap);
      const chunksCount = chunks.length;
      const extraFieldsHeader = !noHeader
        ? Object.entries(baseExtraFields)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join('\n')
        : '';

      for (let index = 0; index < chunks.length; index += 1) {
        const rawChunk = chunks[index];
        const part = index + 1;
        const partHeader = noHeader ? '' : `part: ${part}/${chunksCount}`;
        const header = [extraFieldsHeader, partHeader].filter(Boolean).join('\n');
        const enrichedText = header ? `${header}\ntexto: ${rawChunk}` : rawChunk;
        const hash = this.contentHash(rawChunk);

        if (deduplicate) {
          const uniqueIdentifier = `${document.agentId || ''}_${hash}`;
          if (processedTexts.has(uniqueIdentifier)) continue;
          processedTexts.add(uniqueIdentifier);
        }

        rows.push({
          embeddingName: document.embeddingName || baseExtraFields?.title || 'document',
          embeddingId,
          agentId: document.agentId || '',
          extraFields: {
            ...baseExtraFields,
            chunkIndex: index,
            chunksCount,
            part,
            totalParts: chunksCount,
            contentHash: hash,
          },
          text: enrichedText,
          embeddingProvider: options?.embeddingProvider || '',
          embeddingModel: options?.embeddingModel || '',
        });
      }
    }

    if (!rows.length) {
      return {
        success: true,
        inserted: 0,
        totalChunks: 0,
        batches: 0,
        message: 'No documents to insert after processing',
      };
    }

    for (const batch of this.chunkArray(rows, embeddingBatchSize)) {
      const vectors = await this.embeddingCreateBatch(batch.map((row) => row.text), options?.embeddingProvider, options?.embeddingModel, settingsAgentId);
      vectors.forEach((vector, index) => {
        batch[index].dense = vector;
      });
    }

    const responses: any[] = [];
    const searchProvider = requestedSearchProvider;
    const writeMilvus = this.milvusClient && searchProvider !== 'azure_search' && searchProvider !== 'azure-search' && searchProvider !== 'azure';
    const writeAzureSearch = azureSearchConfigured && searchProvider !== 'milvus';
    if (writeMilvus) {
      const expectedMilvusDimensions = this.getEmbeddingDimensions();
      rows.forEach((row) => this.ensureVectorDimensions(row.dense, expectedMilvusDimensions, 'Milvus/dense'));
    }

    if (writeMilvus) {
      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        this.logger.log(`Inserting RAG batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (${batch.length} chunks)`);
        responses.push(await this.milvusClient.insert({
          collection_name: targetCollection,
          fields_data: batch,
        } as any));
      }

      await this.flushCollection(targetCollection);
    }

    const uploadedBlobs = this.shouldUseAzureBlob(options)
      ? await this.uploadRowsToAzureBlob(rows, targetCollection)
      : [];
    const azureSearch = writeAzureSearch
      ? await this.indexRowsInAzureSearch(targetCollection, rows, uploadedBlobs)
      : null;

    return {
      success: true,
      inserted: rows.length,
      totalChunks: rows.length,
      batches: responses.length,
      response: responses[responses.length - 1],
      responses,
      azureSearch,
      azureBlobs: uploadedBlobs.length,
      message: `Successfully inserted ${rows.length} chunks in ${responses.length} batches`,
    };
  }

  private formatWorksheetCell(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if ('text' in value) return String(value.text || '');
      if ('result' in value) return String(value.result || '');
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item: any) => item?.text || '').join('');
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  private async extractXlsxText(buffer: Buffer) {
    return (await this.extractXlsxStructure(buffer)).text;
  }

  private async extractPdfText(buffer: Buffer) {
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        return String((await parser.getText())?.text || '').trim();
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }
    if (typeof pdfParseModule === 'function') {
      return String((await pdfParseModule(buffer))?.text || '').trim();
    }
    throw new BadRequestException('Leitor de PDF indisponivel.');
  }

  private async extractXlsxStructure(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheets: string[] = [];
    const worksheets: Array<{ name: string; rows: Array<{ rowNumber: number; values: string[] }> }> = [];
    workbook.worksheets.forEach((worksheet) => {
      const rows: string[] = [];
      const structuredRows: Array<{ rowNumber: number; values: string[] }> = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        const structured = values.map((value) => this.formatWorksheetCell(value));
        const line = structured.join(',');
        if (line.trim()) rows.push(line);
        if (structured.some((value) => value.trim())) structuredRows.push({ rowNumber, values: structured });
      });
      if (rows.length) {
        sheets.push(`--- Aba: ${worksheet.name} ---\n${rows.join('\n')}`);
        worksheets.push({ name: worksheet.name, rows: structuredRows });
      }
    });
    return { text: sheets.join('\n\n').trim(), sheets: worksheets };
  }

  private stripHtml(value: string) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<\/(td|th)>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractPlaceholders(value: string) {
    return Array.from(new Set(
      Array.from(String(value || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
        .map((match) => String(match[1] || '').trim())
        .filter(Boolean),
    ));
  }

  private textSections(text: string) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length <= 180)
      .filter((line) => /^(\d+(?:\.\d+)*[.)-]?\s+|clausula\b|se[cç][aã]o\b|anexo\b|[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9\s._-]{4,})/i.test(line))
      .slice(0, 200);
  }

  private async extractFileStructure(file: UploadedRagFile, text: string) {
    const filename = String(file.originalname || 'documento').toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();
    const base = {
      placeholders: this.extractPlaceholders(text),
      sections: this.textSections(text),
    };
    if (mimeType.includes('wordprocessingml') || filename.endsWith('.docx')) {
      const html = String((await mammoth.convertToHtml({ buffer: file.buffer }))?.value || '');
      return {
        ...base,
        type: 'docx',
        html,
        tables: Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi)).map((match) => this.stripHtml(match[0])).slice(0, 100),
      };
    }
    if (mimeType.includes('spreadsheetml') || filename.endsWith('.xlsx')) {
      const workbook = await this.extractXlsxStructure(file.buffer);
      return { ...base, type: 'xlsx', sheets: workbook.sheets };
    }
    return { ...base, type: filename.split('.').pop() || mimeType || 'binary' };
  }

  private async extractTextDirect(file: UploadedRagFile) {
    const buffer = file.buffer;
    const filename = String(file.originalname || 'documento').toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();

    if (mimeType.includes('pdf') || filename.endsWith('.pdf') || buffer.subarray(0, 4).toString('latin1') === '%PDF') {
      return await this.extractPdfText(buffer);
    }

    if (
      mimeType.includes('wordprocessingml') ||
      mimeType.includes('msword') ||
      filename.endsWith('.docx')
    ) {
      const parsed = await mammoth.extractRawText({ buffer });
      return String(parsed?.value || '').trim();
    }

    if (filename.endsWith('.xls')) {
      throw new BadRequestException('Arquivos .xls legados nao sao aceitos por seguranca. Converta para .xlsx ou .csv.');
    }

    if (filename.endsWith('.csv') || mimeType.includes('csv')) {
      const decoded = buffer.toString('utf-8');
      return this.isBinaryDecodedText(decoded) ? '' : decoded.trim();
    }

    if (
      mimeType.includes('spreadsheetml') ||
      mimeType.includes('excel') ||
      filename.endsWith('.xlsx')
    ) {
      return await this.extractXlsxText(buffer);
    }

    if (mimeType.startsWith('text/') || filename.match(/\.(txt|md|json|csv)$/)) {
      const decoded = buffer.toString('utf-8');
      return this.isBinaryDecodedText(decoded) ? '' : decoded.trim();
    }

    return '';
  }

  private async extractTextWithOpenAI(file: UploadedRagFile) {
    const buffer = file.buffer;
    const filename = file.originalname || 'documento';
    const mimeType = file.mimetype || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
    const instruction = [
      'Extraia por OCR o texto do arquivo anexado.',
      'Transcreva fielmente títulos, seções, datas, números e tabelas quando possível.',
      'Retorne somente o texto extraido, sem resumo.',
    ].join('\n');
    const responseContent: any[] = [
      { type: 'input_text', text: instruction },
      isImage
        ? { type: 'input_image', image_url: this.buildDataUrl(buffer, mimeType), detail: 'high' }
        : { type: 'input_file', filename, file_data: this.buildDataUrl(buffer, mimeType) },
    ];
    const openAIClient = this.getOpenAIClientForProvider();
    const responsesApi = (openAIClient as any).responses;

    if (responsesApi?.create) {
      const response = await responsesApi.create({
        model: this.getOcrModel(),
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'Você e um motor de OCR. Extraia texto fielmente de documentos enviados.' }],
          },
          { role: 'user', content: responseContent },
        ],
        temperature: 0,
      });
      return String(response?.output_text || '').trim();
    }

    const chatContent: any[] = [
      {
        type: 'text',
        text: instruction,
      },
    ];

    if (isImage) {
      chatContent.push({
        type: 'image_url',
        image_url: { url: this.buildDataUrl(buffer, mimeType), detail: 'high' },
      });
    } else {
      chatContent.push({
        type: 'file',
        file: {
          filename,
          file_data: this.buildDataUrl(buffer, mimeType),
        },
      });
    }

    const response = await openAIClient.chat.completions.create({
      model: this.getOcrModel(),
      messages: [
        { role: 'system', content: 'Você e um motor de OCR. Extraia texto fielmente de documentos enviados.' },
        { role: 'user', content: chatContent },
      ],
      temperature: 0,
    } as any);

    return String(response?.choices?.[0]?.message?.content || '').trim();
  }

  private async extractTextFromUploadedFile(file: UploadedRagFile, preferOcr: boolean) {
    const isImage = String(file.mimetype || '').startsWith('image/');
    const directFirst = !preferOcr && !isImage;
    const errors: string[] = [];

    if (directFirst) {
      try {
        const directText = await this.extractTextDirect(file);
        if (directText) return { text: directText, strategy: 'direct', errors };
      } catch (error: any) {
        errors.push(error?.message || String(error));
      }
    }

    try {
      const ocrText = await this.extractTextWithOpenAI(file);
      if (ocrText) return { text: ocrText, strategy: 'ocr-openai', errors };
    } catch (error: any) {
      errors.push(error?.message || String(error));
    }

    if (!directFirst) {
      try {
        const directText = await this.extractTextDirect(file);
        if (directText) return { text: directText, strategy: 'direct', errors };
      } catch (error: any) {
        errors.push(error?.message || String(error));
      }
    }

    return { text: '', strategy: 'none', errors };
  }

  async extractFiles(files: UploadedRagFile[], body: any = {}) {
    await this.refreshProviderSettings(body?.agentId);
    if (!files?.length) {
      throw new BadRequestException('arquivos is required');
    }

    const preferOcr = this.parseBoolean(body?.ocr);
    const maxTextChars = Math.max(0, Number(body?.maxTextChars || 0) || 0);
    const extractedFiles: any[] = [];

    for (const file of files) {
      const extracted = await this.extractTextFromUploadedFile(file, preferOcr);
      const filename = file.originalname || 'documento';
      const rawText = String(extracted.text || '');
      const text = maxTextChars > 0 ? rawText.slice(0, maxTextChars) : rawText;
      const structure = await this.extractFileStructure(file, text).catch((error: any) => ({
        placeholders: this.extractPlaceholders(text),
        sections: this.textSections(text),
        structureError: error?.message || String(error),
      }));
      const stored = this.documentsService
        ? await this.documentsService.storeOriginal({
            buffer: file.buffer,
            filename,
            mimeType: file.mimetype || 'application/octet-stream',
            source: body?.source === 'url' ? 'url' : 'upload',
            text,
            structure,
            scope: {
              organizationId: body?.organizationId,
              agentId: body?.agentId,
              flowId: body?.flowId,
              conversationId: body?.conversationId,
            },
            metadata: {
              extractionStrategy: extracted.strategy,
              textLength: rawText.length,
              truncated: maxTextChars > 0 && rawText.length > maxTextChars,
            },
          })
        : null;

      extractedFiles.push({
        id: stored?.documentId || stored?.id || randomUUID(),
        documentId: stored?.documentId || stored?.id,
        filename,
        title: filename,
        mimeType: file.mimetype || '',
        size: file.size || file.buffer?.length || 0,
        ok: Boolean(rawText),
        strategy: extracted.strategy,
        text,
        textLength: rawText.length,
        truncated: maxTextChars > 0 && rawText.length > maxTextChars,
        errors: extracted.errors,
        structure,
        storage: stored?.storage,
        storageKey: stored?.key,
        downloadPath: stored?.downloadPath,
      });
    }

    return {
      files: extractedFiles,
      documents: extractedFiles.filter((file) => file.ok).length,
    };
  }

  async addDocumentsFromFiles(files: UploadedRagFile[], body: any = {}) {
    await this.refreshProviderSettings(body?.agentId);
    if (!files?.length) {
      throw new BadRequestException('arquivos is required');
    }

    const collectionName = body?.collectionName || this.getDefaultCollectionName();
    const options = this.parseJsonField<Record<string, any>>(body?.options, {});
    const baseExtraFields = this.parseJsonField<Record<string, any>>(body?.extraFields, {});
    const preferOcr = this.parseBoolean(body?.ocr);
    const documents: RagDocumentInput[] = [];
    const extractedFiles: any[] = [];

    for (const file of files) {
      const extracted = await this.extractTextFromUploadedFile(file, preferOcr);
      const filename = file.originalname || 'documento';

      if (!extracted.text) {
        extractedFiles.push({
          filename,
          ok: false,
          strategy: extracted.strategy,
          errors: extracted.errors,
        });
        continue;
      }

      documents.push({
        text: extracted.text,
        agentId: body?.agentId || '',
        embeddingName: body?.embeddingName || filename,
        embeddingId: body?.embeddingId || randomUUID(),
        extraFields: {
          ...baseExtraFields,
          source: baseExtraFields.source || 'canvas-flow-rag-upload',
          filename,
          mimeType: file.mimetype || '',
          size: file.size || file.buffer?.length || 0,
          extractionStrategy: extracted.strategy,
        },
      });
      extractedFiles.push({
        filename,
        ok: true,
        strategy: extracted.strategy,
        textLength: extracted.text.length,
        errors: extracted.errors,
      });
    }

    if (!documents.length) {
      throw new BadRequestException({
        message: 'Não foi possível extrair texto dos arquivos enviados',
        files: extractedFiles,
      });
    }

    const added = await this.addDocuments(collectionName, documents, {
      ...options,
      agentId: options?.agentId ?? body?.agentId,
    });
    return {
      ...added,
      collectionName,
      files: extractedFiles,
      documents: documents.length,
    };
  }

  async listDocuments(collectionName?: string, agentId?: string, query?: string, options: any = {}) {
    await this.refreshProviderSettings(agentId ?? options?.agentId);
    if (!this.milvusClient) {
      throw new BadRequestException('MILVUS_ADDRESS is not configured');
    }

    const targetCollection = collectionName || this.getDefaultCollectionName();
    const limit = Math.min(Math.max(Number(options?.limit || 200), 1), 1000);
    const offset = Math.max(Number(options?.offset || 0), 0);
    const scanLimit = Math.min(Math.max(limit + offset, 300), 2000);
    const rows = await this.queryRows(targetCollection, this.buildAgentExpr(agentId), scanLimit, 0);
    const q = String(query || '').trim().toLowerCase();
    const documents = this.groupDocumentRows(rows)
      .filter((document) => {
        if (!q) return true;
        const haystack = [
          document.embeddingName,
          document.embeddingId,
          document.agentId,
          document.text,
          JSON.stringify(document.extraFields || {}),
        ].join('\n').toLowerCase();
        return haystack.includes(q);
      })
      .sort((left, right) => String(left.embeddingName).localeCompare(String(right.embeddingName)));

    return {
      collectionName: targetCollection,
      total: documents.length,
      documents: documents.slice(offset, offset + limit),
    };
  }

  async getDocument(collectionName: string | undefined, idOrEmbeddingId: string, agentId?: string) {
    await this.refreshProviderSettings(agentId);
    const targetCollection = collectionName || this.getDefaultCollectionName();
    const rows = await this.queryRows(targetCollection, this.buildDocumentExpr(idOrEmbeddingId, agentId), 1000, 0);
    const document = this.groupDocumentRows(rows)[0];
    if (!document) {
      throw new BadRequestException('Documento RAG não encontrado');
    }

    return {
      collectionName: targetCollection,
      document,
    };
  }

  async deleteDocument(collectionName: string | undefined, idOrEmbeddingId: string, agentId?: string) {
    await this.refreshProviderSettings(agentId);
    if (!this.milvusClient) {
      throw new BadRequestException('MILVUS_ADDRESS is not configured');
    }

    const targetCollection = collectionName || this.getDefaultCollectionName();
    const filter = this.buildDocumentExpr(idOrEmbeddingId, agentId);
    const response = await this.milvusClient.delete({
      collection_name: targetCollection,
      filter,
    } as any);
    await this.flushCollection(targetCollection);

    return {
      collectionName: targetCollection,
      deleted: true,
      filter,
      response,
    };
  }

  async updateDocument(collectionName: string | undefined, idOrEmbeddingId: string, payload: any = {}) {
    await this.refreshProviderSettings(payload?.agentId);
    const targetCollection = collectionName || this.getDefaultCollectionName();
    const existing = await this.getDocument(targetCollection, idOrEmbeddingId, payload?.agentId);
    const document = existing.document;
    const incomingExtraFields = payload?.extraFields && typeof payload.extraFields === 'object'
      ? payload.extraFields
      : {};
    const extraFields = payload?.mergeExtraFields === false
      ? incomingExtraFields
      : { ...(document.extraFields || {}), ...incomingExtraFields };
    const text = String(payload?.text ?? document.text ?? '').trim();

    if (!text) {
      throw new BadRequestException('text is required');
    }

    await this.deleteDocument(targetCollection, document.embeddingId || document.id, payload?.agentId);
    const added = await this.addDocuments(
      targetCollection,
      [
        {
          text,
          embeddingName: payload?.embeddingName || document.embeddingName,
          embeddingId: document.embeddingId || idOrEmbeddingId,
          agentId: payload?.agentId ?? document.agentId,
          extraFields: this.stripChunkFields(extraFields),
        },
      ],
      payload?.options || {},
    );

    return {
      collectionName: targetCollection,
      embeddingId: document.embeddingId || idOrEmbeddingId,
      updated: true,
      ...added,
    };
  }

  async listCollections() {
    await this.refreshProviderSettings();
    if (!this.milvusClient) return [];
    const response = await this.milvusClient.showCollections();
    return response?.data || [];
  }

  private combineProviderSearchResults(primary: any, secondary: any, topK: number, params: any) {
    if (!secondary?.results?.length) return primary;
    if (!primary?.results?.length) return {
      ...secondary,
      results: this.applyMetadataOrdering(secondary.results || [], params).slice(0, topK),
      searchDebug: {
        ...(secondary.searchDebug || {}),
        mode: 'provider_hybrid',
        primaryResults: 0,
        secondaryResults: secondary.results.length,
      },
    };

    const byKey = new Map<string, any>();
    [...(primary.results || []), ...(secondary.results || [])].forEach((item: any) => {
      const key = String(item?.source || 'milvus') + ':' + String(item?.id || item?.embeddingId || item?.text || randomUUID());
      const existing = byKey.get(key);
      if (!existing || this.getSearchScore(item) > this.getSearchScore(existing)) {
        byKey.set(key, item);
      }
    });

    const merged = Array.from(byKey.values()).sort((left, right) => this.getSearchScore(right) - this.getSearchScore(left));
    return {
      ...primary,
      results: this.applyMetadataOrdering(merged, params).slice(0, topK),
      providerResults: {
        milvus: primary.results?.length || 0,
        azureSearch: secondary.results?.length || 0,
      },
      searchDebug: {
        ...(primary.searchDebug || {}),
        mode: 'provider_hybrid',
        primaryMode: primary.searchDebug?.mode || 'milvus',
        secondaryMode: secondary.searchDebug?.mode || 'azure_search',
        primaryResults: primary.results?.length || 0,
        secondaryResults: secondary.results?.length || 0,
        uniqueCandidates: byKey.size,
      },
    };
  }

  async searchHybrid(query: string, collectionName: string | undefined, agentId: string | undefined, params: any = {}) {
    await this.refreshProviderSettings(agentId);
    if (!query || typeof query !== 'string') {
      throw new BadRequestException('query is required');
    }
    const targetCollection = collectionName || this.getDefaultCollectionName();
    const searchProvider = String(params?.searchProvider || params?.vectorProvider || params?.provider || params?.ragProvider || '').toLowerCase();
    const providerHybrid = ['hybrid', 'milvus_azure_search', 'milvus+azure_search', 'milvus+azure'].includes(searchProvider);
    const effectiveTopK = this.clampSearchInt(params?.k ?? params?.topK, 15, 1, 100);

    if (this.shouldUseAzureSearch(params, targetCollection) && !providerHybrid) {
      return await this.searchAzureSearch(query, targetCollection, agentId, params);
    }
    if (!this.milvusClient) {
      if (this.isAzureSearchConfigured(targetCollection)) {
        return await this.searchAzureSearch(query, targetCollection, agentId, params);
      }
      return { results: [], warning: 'MILVUS_ADDRESS is not configured' };
    }
    const azureSearchPromise = providerHybrid && this.isAzureSearchConfigured(targetCollection)
      ? this.searchAzureSearch(query, targetCollection, agentId, params).catch((error: any) => ({
          results: [],
          warning: error?.message || String(error),
          searchDebug: { mode: 'azure_search_error' },
        }))
      : null;

    const useHybrid = params?.useHybrid !== false;
    const candidateMultiplier = this.clampSearchInt(params?.candidateMultiplier, useHybrid ? 4 : 2, 1, 10);
    const candidateTopK = this.clampSearchInt(
      params?.candidateTopK,
      Math.max(effectiveTopK, effectiveTopK * candidateMultiplier),
      effectiveTopK,
      200,
    );
    const denseEfSearch = this.clampSearchInt(
      params?.denseEfSearch ?? params?.efSearch,
      Math.max(128, candidateTopK * 8),
      Math.max(16, candidateTopK),
      4096,
    );
    const sparseDropRatioSearch = this.clampSearchFloat(params?.sparseDropRatioSearch, 0.15, 0, 0.95);
    const denseWeight = this.clampSearchFloat(params?.denseWeight, 0.7, 0, 1);
    const sparseWeight = this.clampSearchFloat(params?.sparseWeight, 0.3, 0, 1);
    const relevanceBoost = this.clampSearchFloat(params?.relevanceBoost, 1.5, 0.1, 10);
    const fusionStrategyRaw = String(params?.fusionStrategy || 'rrf').toLowerCase().trim();
    const fusionStrategy = fusionStrategyRaw === 'weighted_score' || fusionStrategyRaw === 'score'
      ? 'weighted_score'
      : 'rrf';
    const rrfK = this.clampSearchInt(params?.rrfK, 60, 1, 1000);
    const maxChunksPerDocument = this.clampSearchInt(params?.maxChunksPerDocument, 0, 0, 20);
    const baseExtraFieldsFilter = params?.extraFieldsFilter || params?.metadataFilter || params?.meta || null;
    const perRoundFilters = Array.isArray(params?.extraFieldsFilterPerRound) ? params.extraFieldsFilterPerRound : null;
    const perRoundLimitValues = Array.isArray(params?.extraFieldsFilterPerRoundLimits)
      ? params.extraFieldsFilterPerRoundLimits.map((value: any) => {
          if (value === undefined || value === null || value === '') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
        })
      : null;
    const hasPerRoundLimits = Boolean(perRoundLimitValues?.some((value: number | null) => value !== null));
    const roundStopFind = params?.roundStopFind !== false;
    const roundMixHalf = params?.roundMixHalf === true;
    const denseVector = await this.embeddingCreate(query, params?.embeddingProvider, params?.embeddingModel, agentId);
    this.ensureVectorDimensions(denseVector, this.getEmbeddingDimensions(), 'Milvus/dense');

    const buildExpr = (extraFieldsFilter: any) => {
      const exprParts: string[] = [];
      if (agentId) exprParts.push(`agentId == "${this.escapeMilvusString(agentId)}"`);
      const extraFieldsExpr = this.buildExtraFieldsExpr(extraFieldsFilter);
      if (extraFieldsExpr) exprParts.push(`(${extraFieldsExpr})`);
      if (params?.filterExpr) exprParts.push(`(${params.filterExpr})`);
      return exprParts.length ? exprParts.join(' && ') : undefined;
    };

    const runRound = async (extraFieldsFilter: any) => {
      const expr = buildExpr(extraFieldsFilter);
      const densePromise = this.milvusClient.search({
        collection_name: targetCollection,
        vector_type: DataType.FloatVector,
        vectors: [denseVector],
        search_params: {
          anns_field: 'dense',
          topk: candidateTopK,
          metric_type: 'COSINE',
          params: JSON.stringify({ ef: denseEfSearch }),
        },
        expr,
        output_fields: ['id', 'extraFields', 'embeddingName', 'embeddingId', 'agentId', 'text'],
        timeout: 900000,
      } as any);

      if (!useHybrid) {
        const denseRaw = await densePromise;
        const denseResults = this.normalizeMilvusResults(denseRaw, 'dense');
        const boosted = this.applyRelevanceBoost({ results: denseResults }, relevanceBoost);
        return {
          ...boosted,
          results: (boosted.results || []).slice(0, effectiveTopK),
          denseCount: denseResults.length,
          sparseCount: 0,
          expr,
          searchDebug: {
            mode: 'dense',
            topK: effectiveTopK,
            candidateTopK,
            denseEfSearch,
            relevanceBoost,
            denseResults: denseResults.length,
          },
        };
      }

      const sparsePromise = this.milvusClient.search({
        collection_name: targetCollection,
        data: { text: query } as any,
        search_params: {
          anns_field: 'sparse',
          topk: candidateTopK,
          metric_type: 'BM25',
          params: JSON.stringify({ drop_ratio_search: sparseDropRatioSearch }),
        },
        expr,
        output_fields: ['id', 'extraFields', 'embeddingName', 'embeddingId', 'agentId', 'text'],
        timeout: 900000,
      } as any).catch((error: any) => {
        this.logger.warn(`Sparse search skipped: ${error?.message || String(error)}`);
        return { results: [] };
      });
      const [denseRaw, sparseRaw] = await Promise.all([densePromise, sparsePromise]);
      const denseResults = this.normalizeMilvusResults(denseRaw, 'dense');
      const sparseResults = this.normalizeMilvusResults(sparseRaw, 'sparse');

      if (!sparseResults.length) {
        const boosted = this.applyRelevanceBoost({ results: denseResults }, relevanceBoost);
        return {
          ...boosted,
          results: (boosted.results || []).slice(0, effectiveTopK),
          denseCount: denseResults.length,
          sparseCount: 0,
          expr,
          searchDebug: {
            mode: 'dense_fallback',
            topK: effectiveTopK,
            candidateTopK,
            denseEfSearch,
            sparseDropRatioSearch,
            relevanceBoost,
            denseResults: denseResults.length,
            sparseResults: 0,
          },
        };
      }

      const combined = this.combineSearchResultsV2(
        { results: denseResults },
        { results: sparseResults },
        denseWeight,
        sparseWeight,
        effectiveTopK,
        relevanceBoost,
        {
          candidateTopK,
          fusionStrategy,
          rrfK,
          maxChunksPerDocument,
          denseEfSearch,
          sparseDropRatioSearch,
        },
      );

      return {
        ...combined,
        denseCount: denseResults.length,
        sparseCount: sparseResults.length,
        expr,
      };
    };

    const filtersToTry = perRoundFilters?.length
      ? perRoundFilters.map((round: any) => (
          this.isEmptyRoundFilter(round) ? null : this.mergeExtraFieldsFilters(baseExtraFieldsFilter, round)
        ))
      : [baseExtraFieldsFilter];

    let lastResult: any = null;
    const collected: Array<{ item: any; roundIndex: number }> = [];
    const baseRoundLimit = filtersToTry.length ? Math.floor(effectiveTopK / filtersToTry.length) : effectiveTopK;
    const remainder = filtersToTry.length ? effectiveTopK - baseRoundLimit * filtersToTry.length : 0;

    for (let roundIndex = 0; roundIndex < filtersToTry.length; roundIndex += 1) {
      const result = await runRound(filtersToTry[roundIndex]);
      lastResult = result;
      if (result.results.length && roundStopFind) {
        const ordered = this.applyMetadataOrdering(result.results, params).slice(0, effectiveTopK);
        this.logger.log(
          `RAG topK result (round ${roundIndex + 1}/${filtersToTry.length}): count=${result.results.length}, topK=${effectiveTopK}, ids=${JSON.stringify(ordered.map((item: any) => item?.id).filter(Boolean))}`,
        );
        const milvusResult = {
          ...result,
          results: ordered,
          roundIndex,
          rounds: filtersToTry.length,
        };
        return azureSearchPromise
          ? this.combineProviderSearchResults(milvusResult, await azureSearchPromise, effectiveTopK, params)
          : milvusResult;
      }

      if (result.results.length) {
        const configuredLimit = hasPerRoundLimits ? perRoundLimitValues?.[roundIndex] : null;
        const roundLimit = typeof configuredLimit === 'number'
          ? configuredLimit
          : roundMixHalf
            ? Math.max(1, baseRoundLimit + (roundIndex < remainder ? 1 : 0))
            : result.results.length;
        result.results.slice(0, roundLimit).forEach((item: any) => collected.push({ item, roundIndex }));
        this.logger.log(
          `RAG topK result (round ${roundIndex + 1}/${filtersToTry.length}): count=${result.results.length}, topK=${effectiveTopK}`,
        );
      }
    }

    if (collected.length) {
      const byId = new Map<string, { item: any; roundIndex: number }>();
      collected.forEach((entry) => {
        const id = String(entry.item?.id || '');
        const previous = byId.get(id);
        if (!previous || entry.roundIndex < previous.roundIndex || this.getSearchScore(entry.item) > this.getSearchScore(previous.item)) {
          byId.set(id, entry);
        }
      });
      const mergedRounds = Array.from(byId.values())
        .sort((left, right) => {
          if (left.roundIndex !== right.roundIndex) return left.roundIndex - right.roundIndex;
          return this.getSearchScore(right.item) - this.getSearchScore(left.item);
        })
        .map((entry) => entry.item);

      const milvusResult = {
        ...(lastResult || {}),
        results: this.applyMetadataOrdering(mergedRounds, params).slice(0, effectiveTopK),
        rounds: filtersToTry.length,
      };
      return azureSearchPromise
        ? this.combineProviderSearchResults(milvusResult, await azureSearchPromise, effectiveTopK, params)
        : milvusResult;
    }

    const milvusResult = {
      ...(lastResult || { denseCount: 0, sparseCount: 0 }),
      results: this.applyMetadataOrdering(lastResult?.results || [], params).slice(0, effectiveTopK),
      rounds: filtersToTry.length,
    };
    return azureSearchPromise
      ? this.combineProviderSearchResults(milvusResult, await azureSearchPromise, effectiveTopK, params)
      : milvusResult;
  }

  private buildHttpBatchTool() {
    return {
      type: 'function',
      function: {
        name: 'httpBatch',
        description: 'Execute one or more HTTP requests and return their status/body.',
        parameters: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
                  headers: { type: 'object', additionalProperties: true },
                  body: { type: 'object', additionalProperties: true },
                },
                required: ['url'],
              },
            },
          },
          required: ['requests'],
        },
      },
    };
  }

  private toOpenAIHistory(turns: any[]) {
    return (turns || [])
      .filter((turn) => ['system', 'user', 'assistant', 'tool'].includes(turn.role))
      .filter((turn) => !turn?.metadata?.kind || turn.metadata.kind === 'message')
      .map((turn) => ({
        role: turn.role,
        content: turn.content || '',
      }));
  }

  private extractTextFromCompletion(completion: any) {
    return completion?.choices?.[0]?.message?.content || '';
  }

  async chatLlmRag(text: string, agentId: string | undefined, params: any = {}) {
    await this.refreshProviderSettings(agentId);
    if (!text || typeof text !== 'string') {
      throw new BadRequestException('text is required');
    }

    const conversationId = params?.conversationId || randomUUID();
    const turnHistoricMessages = Number(params?.turnHistoricMessages ?? 20);
    const collectionName = params?.collectionName || this.getDefaultCollectionName();
    const k = Number(params?.k ?? 8);
    const searchAgentId = Object.prototype.hasOwnProperty.call(params || {}, 'ragAgentId')
      ? params.ragAgentId
      : agentId;
    const prompt =
      params?.prompt ||
      'Você é uma IA RAG. Responda em pt-BR, use o contexto quando relevante e seja objetivo.';
    const history = await this.memoryService.findRecent(agentId, conversationId, turnHistoricMessages);
    const providedDocs = Array.isArray(params?.docs)
      ? params.docs
      : Array.isArray(params?.documents)
        ? params.documents
        : null;
    const ragResults = providedDocs
      ? { results: providedDocs, searchDebug: { mode: 'provided_docs', count: providedDocs.length } }
      : k > 0
        ? await this.searchHybrid(text, collectionName, searchAgentId, { ...params, k }).catch((error: any) => ({
          results: [],
          warning: error?.message || String(error),
        }))
        : { results: [] };

    await this.refreshProviderSettings(agentId);
    const model = this.getChatModelForProvider(params?.llmProvider, params?.model);
    const chatClient = this.getOpenAIClientForProvider(params?.llmProvider);

    const docsContextText = (ragResults.results || [])
      .map((item: any, index: number) => {
        const extra = {
          ...this.parseExtraFields(item.extraFields),
          ...this.parseExtraFields(item.metadata),
        };
        const title = item.embeddingName || item.title || item.filename || extra?.title || extra?.filename || `doc_${index + 1}`;
        return [
          `Documento ${index + 1}`,
          `Embedding name: ${title};`,
          `Text of doc: ${item.text || ''};`,
          `Extra fields: ${JSON.stringify(extra)};`,
        ].join('\n');
      })
      .join('\n-------------------------------------------------\n\n');
    const dynamicContextText = String(params?.contextText || params?.dynamicContextText || '').trim();
    const contextText = [
      dynamicContextText
        ? [
          'Contexto dinamico',
          dynamicContextText,
        ].join('\n')
        : '',
      docsContextText,
    ].filter(Boolean).join('\n-------------------------------------------------\n\n');

    const ragSystemInstruction = [
      prompt,
      'Use TODOS os materiais de referência entre <contexto_rag> e </contexto_rag> quando forem relevantes para a pergunta.',
      'Analise cada documento individualmente, não omita documentos pertinentes e destaque os mais recentes quando houver metadados de ano/número.',
      'Se o contexto recuperado não contiver suporte suficiente, diga isso com clareza.',
    ].join('\n');

    const openAIHistory = this.toOpenAIHistory(history);
    const lastHistoryTurn = openAIHistory[openAIHistory.length - 1];
    const shouldAppendCurrentUserTurn = !(
      lastHistoryTurn?.role === 'user' &&
      String(lastHistoryTurn.content || '').trim() === String(text || '').trim()
    );
    const messages: any[] = [
      {
        role: 'system',
        content: `${ragSystemInstruction}\n\n<contexto_rag>\n${contextText || 'Sem documentos recuperados.'}\n</contexto_rag>`,
      },
      ...openAIHistory,
      ...(shouldAppendCurrentUserTurn ? [{ role: 'user', content: text }] : []),
    ];

    const allowHttpBatchTool = params?.allowHttpBatchTool === true || params?.enableHttpBatchTool === true;
    const tools = [
      ...(allowHttpBatchTool ? [this.buildHttpBatchTool()] : []),
      ...(Array.isArray(params?.tools) ? params.tools : []),
    ];
    const trace: any[] = [];

    await this.memoryService.addTurn({
      agentId,
      conversationId,
      role: 'user',
      content: text,
      metadata: { source: 'canvas-flow' },
    });

    for (let step = 0; step < 4; step += 1) {
      const completion = await chatClient.chat.completions.create({
        model,
        messages,
        tools: tools as any,
        tool_choice: params?.tool_choice || 'auto',
        temperature: Number(params?.temperature ?? 0.2),
      } as any);
      const message: any = completion.choices?.[0]?.message;
      messages.push(message);

      if (!message?.tool_calls?.length) {
        const answer = this.extractTextFromCompletion(completion);
        await this.memoryService.addTurn({
          agentId,
          conversationId,
          role: 'assistant',
          content: answer,
          metadata: {
            source: 'canvas-flow',
            docs: (ragResults.results || []).slice(0, 5),
            trace,
          },
        });
        return {
          text: answer,
          conversationId,
          docs: ragResults.results || [],
          searchDebug: ragResults.searchDebug,
          trace,
          model,
        };
      }

      for (const call of message.tool_calls) {
        const args = JSON.parse(call.function?.arguments || '{}');
        let result: any;
        if (call.function?.name === 'httpBatch') {
          result = await this.httpBatchService.execute(args?.requests || []);
        } else {
          result = { ok: true, received_args: args };
        }
        trace.push({ tool: call.function?.name, args, result });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    const fallback = 'Não consegui concluir a resposta dentro do limite de chamadas de ferramenta.';
    await this.memoryService.addTurn({
      agentId,
      conversationId,
      role: 'assistant',
      content: fallback,
      metadata: { source: 'canvas-flow', trace },
    });
    return {
      text: fallback,
      conversationId,
      docs: ragResults.results || [],
      searchDebug: ragResults.searchDebug,
      trace,
      model,
    };
  }
}
