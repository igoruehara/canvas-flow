export type StepType = 'message' | 'richMessage' | 'input' | 'api' | 'condition' | 'end' | 'group' | 'component';

export type ComponentType = 'rag' | 'openaiGen' | 'azureOpenAI' | 'milvus' | 'azureSearch' | 'azureBlob' | 'debug' | 'mongodb' | 'dashboard' | 'cron' | 'loop' | 'flowRouter' | 'context' | 'webhook' | 'mcp' | 'files' | 'approval' | 'agentPlan';
export type FlowChannel = 'webWidget' | 'whatsapp';
export type FlowLlmProvider = 'openai' | 'azure_openai' | 'gemini' | 'claude' | 'grok' | 'bedrock';
export type WhatsappProvider = 'meta' | 'blip' | 'sinch';
export type WhatsappDeliveryMode = 'provider' | 'apiResponse';
export type WhatsappSinchApiMode = 'conversation' | 'relay';
export type WidgetPosition = 'right' | 'left';
export type RichMessageType = 'text' | 'buttons' | 'quickReplies' | 'list' | 'carousel' | 'appointmentFlow' | 'image' | 'document';
export type AppointmentFlowStage = 'actions' | 'appointments' | 'providers' | 'services' | 'dates' | 'times' | 'items' | 'exams';
export type AppointmentFlowAttachmentType = 'image' | 'document';
export type ConditionMode = 'js' | 'llm';
export type InputValidationMode = 'none' | 'type' | 'regex' | 'llm';
export type InputValidationType = 'text' | 'email' | 'number' | 'date' | 'cpf' | 'cnpj' | 'phone' | 'boolean';
export type EdgeOutputValidationType =
  | 'filled'
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'email'
  | 'cpf'
  | 'cnpj'
  | 'phone'
  | 'object'
  | 'array';
export type CronMode = 'interval' | 'daily' | 'weekly' | 'monthly';
export type CronIntervalUnit = 'minutes' | 'hours';
export type CronRunFrom = 'cronNode' | 'flowStart';
export type CronExecutionStatus = 'ok' | 'error';
export type MongoPaginationMode = 'single' | 'all';
export type MongoLlmMode = 'filter' | 'full';
export type ContextMode = 'json' | 'js' | 'llm';
export type McpMode = 'api' | 'fields' | 'external';
export type AgentPlanMode = 'advisory' | 'manual';
export type McpLlmProvider = 'auto' | FlowLlmProvider;
export type McpHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type McpApiCallMode = 'single' | 'multi';
export type McpApiExecutionMode = 'sequential' | 'parallel';
export type McpExternalTransport = 'streamable_http' | 'sse' | 'websocket';
export type McpExternalOperation = 'ping' | 'listTools' | 'callTool' | 'listResources' | 'readResource' | 'listPrompts' | 'getPrompt';
export type McpExternalOAuthConnectionScope = 'agent' | 'user';
export type RagModelProvider = 'auto' | FlowLlmProvider;
export type RagSearchProvider = 'auto' | 'milvus' | 'azure_search' | 'hybrid';
export type RagStorageProvider = 'none' | 'azure_blob';
export type AgentManifestLoadMode = 'always' | 'auto' | 'on_demand' | 'manual';

export type AgentManifestItemRef = {
  id: string;
  load?: AgentManifestLoadMode;
  path?: string;
  name?: string;
  description?: string;
  source?: 'workspace' | 'canvas' | 'flow';
  targetStepId?: string;
  stepId?: string;
  nodeId?: string;
  targetFlowId?: string;
  targetAgentId?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  sideEffect?: string;
  requiresApproval?: boolean;
  maxRetries?: number;
};

export type AgentManifestConfig = {
  rules?: AgentManifestItemRef[];
  skills?: AgentManifestItemRef[];
  subagents?: AgentManifestItemRef[];
  mcpServers?: AgentManifestItemRef[];
};

export type AgentSpecConfig = {
  agentsMd?: string;
  guardrails?: string;
  blockedTerms?: string[];
  rules?: Array<Record<string, unknown>>;
  skills?: Array<Record<string, unknown>>;
  subagents?: Array<Record<string, unknown>>;
  mcpServers?: Array<Record<string, unknown>>;
};
export type RagDataOperation = 'search' | 'index' | 'list' | 'get' | 'delete';
export type AzureBlobOperation = 'upload' | 'chunks' | 'list' | 'read' | 'index';
export type WebhookMode = 'inbound' | 'outbound' | 'listener';
export type WebhookAuthMode = 'none' | 'bearer' | 'header' | 'query';
export type McpExternalAuthMode = WebhookAuthMode | 'oauth' | 'aws_sigv4';
export type WebhookStartMode = 'node' | 'flow';
export type WebhookResponseMode = 'sync' | 'async' | 'async_job';
export type FilesSourceMode = 'upload' | 'url';
export type FilesResultMode = 'context' | 'llm';
export type FilesOperation = 'read' | 'generate' | 'edit';
export type FilesOutputFormat = 'txt' | 'md' | 'csv' | 'json' | 'html' | 'docx' | 'xlsx' | 'pdf';

export interface ExtraFieldsFilterRule {
  field: string;
  value: unknown;
  condition?: string;
}

export interface RagConditionalRule {
  id?: string;
  condition?: string;
  prompt?: string;
  extraFieldsFilterExpression?: string;
  extraFieldsFilterPerRoundExpression?: string;
  extraFieldsFilterPerRoundLimitsExpression?: string;
  roundStopFind?: boolean | null;
  roundMixHalf?: boolean | null;
  order?: 'asc' | 'desc' | '';
  extraFieldsFilterOrderByExpression?: string;
  metadataOrderScanPageSize?: number | null;
  metadataOrderMaxScan?: number | null;
}

export interface CronExecutionLogEntry {
  firedAt: string;
  finishedAt: string;
  status: CronExecutionStatus;
  messages?: number;
  durationMs?: number;
  nextRunAt?: string;
  error?: string;
}

export interface FlowRouterRule {
  id: string;
  label: string;
  targetAgentId?: string;
  targetFlowId: string;
  conditionMode: ConditionMode;
  condition: string;
  conditionModel?: string;
  conditionTemperature?: number;
}

export interface FlowNodeTagConfig {
  id: string;
  tag: string;
  label?: string;
  mode: 'once' | 'always';
  valueTemplate?: string;
  metadataJson?: string;
}

export type MongoOperation =
  | 'insertOne'
  | 'insertMany'
  | 'find'
  | 'findOne'
  | 'updateOne'
  | 'updateMany'
  | 'upsertOne'
  | 'deleteOne'
  | 'deleteMany'
  | 'count'
  | 'aggregate';
export type DashboardSource = 'trace' | 'mongodb' | 'api' | 'milvus';
export type DashboardMode = 'summary' | 'table' | 'funnel' | 'timeseries' | 'bar' | 'pie';

export interface RichMessageAction {
  id: string;
  label: string;
  value?: string;
  url?: string;
}

export interface RichMessageListItem {
  id: string;
  title: string;
  description?: string;
  value?: string;
}

export interface RichMessageListSection {
  title: string;
  items: RichMessageListItem[];
}

export interface RichMessageCarouselCard {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttons?: RichMessageAction[];
}

export interface RichMessageMedia {
  url?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
}

export interface RichMessageGenerationConfig {
  enabled: boolean;
  prompt: string;
  model?: string;
  maxItems?: number;
}

export interface RichMessageAppointmentFlowConfig {
  mode?: 'auto' | 'metaFlow' | 'interactive';
  flowId?: string;
  flowToken?: string;
  flowCta?: string;
  flowScreen?: string;
  headerText?: string;
  buttonText?: string;
  stage?: AppointmentFlowStage;
  stageTemplate?: string;
  actionsTemplate?: string;
  appointmentsTemplate?: string;
  providersTemplate?: string;
  servicesTemplate?: string;
  datesTemplate?: string;
  timesTemplate?: string;
  itemsTemplate?: string;
  itemsFilterTemplate?: string;
  itemsMaxSelected?: number;
  examsTemplate?: string;
  payloadTemplate?: string;
  stepOrder?: string[];
  stepLabels?: Record<string, string>;
  attachmentSteps?: Array<{
    id: string;
    label: string;
    type?: AppointmentFlowAttachmentType;
    required?: boolean;
    description?: string;
  }>;
  llmEnabled?: boolean;
  llmSourceTemplate?: string;
  llmInstruction?: string;
  llmModel?: string;
  llmTemperature?: number;
}

export interface RichMessageConfig {
  type: RichMessageType;
  text: string;
  footer?: string;
  media?: RichMessageMedia;
  buttons?: RichMessageAction[];
  quickReplies?: RichMessageAction[];
  list?: {
    buttonText: string;
    sections: RichMessageListSection[];
  };
  carousel?: {
    cards: RichMessageCarouselCard[];
  };
  appointmentFlow?: RichMessageAppointmentFlowConfig;
  generation?: RichMessageGenerationConfig;
}

export interface FlowFileDocument {
  id?: string;
  title?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  sourceUrl?: string;
  text?: string;
  textLength?: number;
  strategy?: string;
  truncated?: boolean;
  errors?: string[];
  documentId?: string;
  storage?: 'local' | 's3';
  storageKey?: string;
  downloadPath?: string;
  structure?: Record<string, unknown>;
}

export interface WebWidgetConfig {
  primaryColor: string;
  accentColor: string;
  assistantName: string;
  subtitle: string;
  welcomeMessage: string;
  placeholder: string;
  bubbleLabel: string;
  avatarText: string;
  openByDefault: boolean;
  position: WidgetPosition;
}

export interface WhatsappConfig {
  provider: WhatsappProvider;
  deliveryMode?: WhatsappDeliveryMode;
  verifyToken: string;
  businessAccountId?: string;
  phoneNumberId: string;
  accessToken: string;
  graphApiVersion: string;
  autoReply: boolean;
  blipContractId?: string;
  blipAuthorizationKey?: string;
  sinchProjectId?: string;
  sinchAppId?: string;
  sinchRegion?: string;
  sinchAccessToken?: string;
  sinchChannel?: string;
  sinchApiMode?: WhatsappSinchApiMode;
  sinchServiceNumber?: string;
  sinchServiceUsername?: string;
  sinchServiceToken?: string;
}

export interface FlowStep {
  id: string;
  type: StepType;
  title: string;
  instruction: string;
  responseName?: string;
  condition?: string;
  conditionMode?: ConditionMode;
  conditionModel?: string;
  conditionTemperature?: number;
  conditionReasonResponseName?: string;
  messageUseLlm?: boolean;
  messageLlmModel?: string;
  messageLlmTemperature?: number;
  inputValidationMode?: InputValidationMode;
  inputValidationType?: InputValidationType;
  inputValidationRegex?: string;
  inputValidationErrorMessage?: string;
  inputValidationLlmInstruction?: string;
  inputValidationLlmModel?: string;
  inputValidationLlmTemperature?: number;
  inputValidationReasonResponseName?: string;
  position: { x: number; y: number };
  parentId?: string;
  group?: {
    width: number;
    height: number;
    collapsed?: boolean;
    collapsedChildIds?: string[];
  };
  tags?: FlowNodeTagConfig[];
  richMessage?: RichMessageConfig;
  api?: {
    responseName?: string;
    requests: Array<Record<string, unknown>>;
    generation?: {
      enabled: boolean;
      prompt: string;
      model?: string;
      temperature?: number;
      fallbackToManual?: boolean;
    };
  };
  component?: {
    type: ComponentType;
    responseName?: string;
    collectionName?: string;
    ragProvider?: 'auto' | 'milvus' | 'azure_search';
    ragOperation?: RagDataOperation;
    azureBlobOperation?: AzureBlobOperation;
    ragLlmProvider?: RagModelProvider;
    ragLlmModel?: string;
    agentRole?: 'simple' | 'orchestrator' | 'subagent';
    agentUseWorkspaceCatalog?: boolean;
    agentExecutionMode?: 'flow' | 'auto_tools' | 'hybrid';
    agentMaxToolCalls?: number;
    agentSpec?: AgentSpecConfig;
    agentManifest?: AgentManifestConfig;
    agentPlanMode?: AgentPlanMode;
    agentPlanInstructions?: string;
    agentPlanJson?: string;
    agentPlanMaxToolCalls?: number;
    agentPlanClearAfterUse?: boolean;
    ragEmbeddingProvider?: RagModelProvider;
    ragEmbeddingModel?: string;
    ragSearchProvider?: RagSearchProvider;
    ragStorageProvider?: RagStorageProvider;
    ragUseAgentFilter?: boolean;
    ragAgentIdTemplate?: string;
    ragDocsPath?: string;
    ragDocumentsPath?: string;
    ragTextTemplate?: string;
    ragTextPath?: string;
    ragEmbeddingNameTemplate?: string;
    ragEmbeddingIdTemplate?: string;
    ragExtraFieldsJson?: string;
    ragChunkSize?: number;
    ragChunkOverlap?: number;
    azureBlobNameTemplate?: string;
    azureBlobContentTemplate?: string;
    azureBlobContentPath?: string;
    azureBlobContentType?: string;
    azureBlobFilterText?: string;
    azureBlobFilterContentType?: string;
    azureBlobFilterModifiedAfter?: string;
    azureBlobFilterModifiedBefore?: string;
    azureBlobMinBytes?: number;
    azureBlobMaxBytes?: number;
    k?: number;
    turnHistoricMessages?: number;
    prompt?: string;
    queryTemplate?: string;
    llmContextTemplate?: string;
    filterExpr?: string;
    extraFieldsFilter?: Record<string, unknown>;
    extraFieldsFilterRules?: ExtraFieldsFilterRule[];
    ragConditionalRules?: RagConditionalRule[];
    extraFieldsFilterPerRound?: Array<Record<string, unknown>>;
    extraFieldsFilterPerRoundLimits?: Array<number | null>;
    roundStopFind?: boolean;
    roundMixHalf?: boolean;
    extraFieldsFilterOrderBy?: string[];
    order?: 'asc' | 'desc';
    metadataOrderScanPageSize?: number | null;
    metadataOrderMaxScan?: number | null;
    useHybrid?: boolean;
    denseWeight?: number;
    sparseWeight?: number;
    candidateMultiplier?: number;
    candidateTopK?: number;
    denseEfSearch?: number;
    sparseDropRatioSearch?: number;
    fusionStrategy?: 'rrf' | 'weighted_score';
    rrfK?: number;
    relevanceBoost?: number;
    maxChunksPerDocument?: number;
    mongoOperation?: MongoOperation;
    mongoCollectionName?: string;
    mongoFilter?: string;
    mongoDocument?: string;
    mongoUpdate?: string;
    mongoPipeline?: string;
    mongoProjection?: string;
    mongoSort?: string;
    mongoLimit?: number;
    mongoPage?: number;
    mongoSkip?: number;
    mongoPaginationMode?: MongoPaginationMode;
    mongoMaxPages?: number;
    mongoDateField?: string;
    mongoDateStart?: string;
    mongoDateEnd?: string;
    mongoDateTimezone?: string;
    mongoUseLlmFilter?: boolean;
    mongoLlmMode?: MongoLlmMode;
    mongoLlmInstruction?: string;
    mongoLlmModel?: string;
    dashboardSource?: DashboardSource;
    dashboardMode?: DashboardMode;
    dashboardTitle?: string;
    dashboardCollectionName?: string;
    dashboardPipeline?: string;
    dashboardApiRequests?: string;
    dashboardQueryTemplate?: string;
    dashboardK?: number;
    dashboardFilterExpr?: string;
    dashboardIncludeTrace?: boolean;
    dashboardShowTable?: boolean;
    dashboardUseLlm?: boolean;
    dashboardLlmPrompt?: string;
    dashboardModel?: string;
    cronEnabled?: boolean;
    cronMode?: CronMode;
    cronIntervalValue?: number;
    cronIntervalUnit?: CronIntervalUnit;
    cronTime?: string;
    cronWeekday?: number;
    cronMonthDay?: number;
    cronTimezone?: string;
    cronStartAt?: string;
    cronLastRunAt?: string;
    cronNextRunAt?: string;
    cronInputText?: string;
    cronRunFrom?: CronRunFrom;
    cronSlotsJson?: string;
    cronExecutionLog?: CronExecutionLogEntry[];
    loopSourcePath?: string;
    loopResponseName?: string;
    loopItemResponseName?: string;
    loopIndexResponseName?: string;
    loopMaxIterations?: number;
    loopDelaySeconds?: number;
    loopCollectPath?: string;
    loopStopCondition?: string;
    flowRouterRules?: FlowRouterRule[];
    flowRouterFallbackAgentId?: string;
    flowRouterFallbackFlowId?: string;
    flowRouterReasonResponseName?: string;
    contextMode?: ContextMode;
    contextJson?: string;
    contextScript?: string;
    contextLlmPrompt?: string;
    contextLlmModel?: string;
    contextLlmTemperature?: number;
    webhookMode?: WebhookMode;
    webhookId?: string;
    webhookAuthMode?: WebhookAuthMode;
    webhookSecret?: string;
    webhookHeaderName?: string;
    webhookQueryParam?: string;
    webhookStartMode?: WebhookStartMode;
    webhookResponseMode?: WebhookResponseMode;
    webhookCallbackUrl?: string;
    webhookCallbackAuthMode?: WebhookAuthMode;
    webhookCallbackSecret?: string;
    webhookCallbackHeaderName?: string;
    webhookListenerFireAndForget?: boolean;
    mcpMode?: McpMode;
    mcpToolName?: string;
    mcpToolDescription?: string;
    mcpInstruction?: string;
    mcpInputSchema?: string;
    mcpOutputSchema?: string;
    mcpLlmProvider?: McpLlmProvider;
    mcpModel?: string;
    mcpTemperature?: number;
    mcpApiMethod?: McpHttpMethod;
    mcpApiBaseUrl?: string;
    mcpApiHeadersJson?: string;
    mcpApiQueryJson?: string;
    mcpApiBodyJson?: string;
    mcpApiAuthMode?: WebhookAuthMode;
    mcpApiAuthHeaderName?: string;
    mcpApiAuthQueryParam?: string;
    mcpApiAuthSecret?: string;
    mcpApiAllowLlmRequest?: boolean;
    mcpApiMapResultWithLlm?: boolean;
    mcpApiExecute?: boolean;
    mcpApiCallMode?: McpApiCallMode;
    mcpApiExecutionMode?: McpApiExecutionMode;
    mcpApiRequestsJson?: string;
    mcpMergeOutputToSlots?: boolean;
    mcpExternalTransport?: McpExternalTransport;
    mcpExternalUrl?: string;
    mcpExternalHeadersJson?: string;
    mcpExternalAuthMode?: McpExternalAuthMode;
    mcpExternalOAuthConnectionScope?: McpExternalOAuthConnectionScope;
    mcpExternalAuthHeaderName?: string;
    mcpExternalAuthQueryParam?: string;
    mcpExternalAuthSecret?: string;
    mcpExternalOperation?: McpExternalOperation;
    mcpExternalToolName?: string;
    mcpExternalArgumentsJson?: string;
    mcpExternalResourceUri?: string;
    mcpExternalPromptName?: string;
    mcpExternalPromptArgumentsJson?: string;
    mcpExternalUseLlmArguments?: boolean;
    mcpExternalMapResultWithLlm?: boolean;
    mcpExternalTimeoutMs?: number;
    filesSourceMode?: FilesSourceMode;
    filesResultMode?: FilesResultMode;
    filesUploaded?: FlowFileDocument[];
    filesUrlTemplate?: string;
    filesPreferOcr?: boolean;
    filesMaxTextChars?: number;
    filesLlmProvider?: RagModelProvider;
    filesLlmModel?: string;
    filesLlmPrompt?: string;
    filesQuestionTemplate?: string;
    filesLlmTemperature?: number;
    filesOperation?: FilesOperation;
    filesOutputFormat?: FilesOutputFormat;
    filesOutputFilenameTemplate?: string;
    filesContentTemplate?: string;
    filesTemplateDocumentId?: string;
    filesTemplateDocumentIds?: string[];
    filesTemplateValuesJson?: string | Record<string, unknown>;
    filesGenerationPrompt?: string;
    filesUseDocumentSkill?: boolean;
    filesDocumentSkillPrompt?: string;
    approvalTitle?: string;
    approvalDescription?: string;
    approvalRisk?: 'low' | 'medium' | 'high' | 'critical';
    approvalScopes?: string[];
    approvalApproverHint?: string;
    approvalKeyword?: string;
    approvalRejectKeyword?: string;
    approvalApprovedText?: string;
    approvalRejectedText?: string;
    approvalRequireExplicitInput?: boolean;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edgeRole?: 'flow' | 'manifest';
  condition?: string;
  conditionMode?: ConditionMode;
  conditionValidationPath?: string;
  conditionValidationType?: EdgeOutputValidationType;
  conditionModel?: string;
  conditionTemperature?: number;
  conditionReasonResponseName?: string;
}

export interface FlowConfig {
  title: string;
  responseName: string;
  execute: string;
  model: string;
  llmProvider?: FlowLlmProvider;
  agentSpec?: AgentSpecConfig;
  channel: FlowChannel;
  isMainFlow?: boolean;
  webWidget?: WebWidgetConfig;
  whatsapp?: WhatsappConfig;
  turnHistoricMessages: number;
  startStepId: string;
  steps: FlowStep[];
  edges: FlowEdge[];
  simulationSuites?: FlowSimulationSuite[];
}

export interface FlowSimulationSuite {
  id: string;
  name: string;
  description?: string;
  mode?: 'conversation' | 'isolated';
  cases: Array<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasFlowRecord {
  _id: string;
  name: string;
  agentId?: string;
  description?: string;
  sortOrder?: number;
  config: FlowConfig;
  versions?: CanvasFlowVersionRecord[];
  latestVersion?: number;
  activeVersion?: number;
  bsonSizeBytes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasFlowVersionRecord {
  version: number;
  name?: string;
  notes?: string;
  config?: FlowConfig;
  deployedAt?: string;
  createdAt?: string;
  deployedBy?: string;
  deployedByEmail?: string;
  activatedAt?: string;
  activatedBy?: string;
  activatedByEmail?: string;
  bsonSizeBytes?: number;
}

export interface CanvasFlowAgentRecord {
  _id?: string;
  agentId: string;
  name: string;
  flowCount: number;
  config?: Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'>;
  sortOrder?: number;
  releases?: CanvasFlowAgentReleaseRecord[];
  latestRelease?: number;
  activeRelease?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasFlowAgentWorkspaceFile {
  path: string;
  content: string;
  type?: string;
  encoding?: string;
}

export interface CanvasFlowAgentWorkspace {
  kind: 'canvas-flow-agent-workspace';
  version: number;
  folderName: '.canvas-flow';
  agentId: string;
  agentName?: string;
  exportedAt?: string;
  config: Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'>;
  files: CanvasFlowAgentWorkspaceFile[];
}

export interface CanvasFlowAgentReleaseRecord {
  release: number;
  name?: string;
  notes?: string;
  versions?: Record<string, number>;
  flowNames?: Record<string, string>;
  versionNames?: Record<string, string>;
  createdAt?: string;
  deployedAt?: string;
  deployedBy?: string;
  deployedByEmail?: string;
  activatedAt?: string;
  activatedBy?: string;
  activatedByEmail?: string;
}

export interface CanvasFlowApiKeyRecord {
  _id: string;
  name: string;
  tokenPrefix: string;
  flowId?: string;
  agentId?: string;
  scopes?: string[];
  active: boolean;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  totalUses?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatedCanvasFlowApiKey extends CanvasFlowApiKeyRecord {
  token: string;
}

export interface CanvasFlowAuthUser {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

export type CanvasFlowProviderSettings = {
  llmProvider: FlowLlmProvider | 'azure';
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
  webWidget: WebWidgetConfig;
  whatsapp: WhatsappConfig;
};

export interface TestMessage {
  role: string;
  text: string;
  kind?: string;
  delayBeforeMs?: number;
  debug?: unknown;
  content?: RichMessageConfig;
}
