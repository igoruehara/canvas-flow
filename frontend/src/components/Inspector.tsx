import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, Download, Info, Loader2, Maximize2, Plus, RefreshCw, Trash2, Wand2, X } from 'lucide-react';
import type {
  CanvasFlowAgentRecord,
  CanvasFlowProviderSettings,
  CanvasFlowRecord,
  ExtraFieldsFilterRule,
  FlowChannel,
  FlowConfig,
  FlowEdge,
  EdgeOutputValidationType,
  FlowLlmProvider,
  FlowNodeTagConfig,
  FlowRouterRule,
  FlowStep,
  WebhookAuthMode,
  WebhookMode,
  WebhookResponseMode,
  WebhookStartMode,
  RagConditionalRule,
  ConditionMode,
  ContextMode,
  McpApiCallMode,
  McpApiExecutionMode,
  McpExternalAuthMode,
  McpExternalOAuthConnectionScope,
  McpExternalOperation,
  McpExternalTransport,
  McpHttpMethod,
  McpLlmProvider,
  McpMode,
  InputValidationMode,
  InputValidationType,
  DashboardMode,
  DashboardSource,
  CronIntervalUnit,
  CronMode,
  CronRunFrom,
  MongoLlmMode,
  MongoPaginationMode,
  MongoOperation,
  AzureBlobOperation,
  RagDataOperation,
  RagModelProvider,
  RagSearchProvider,
  RagStorageProvider,
  AppointmentFlowStage,
  RichMessageAction,
  RichMessageCarouselCard,
  RichMessageListSection,
  RichMessageType,
  FilesResultMode,
  FilesSourceMode,
  FilesOperation,
  FilesOutputFormat,
  FlowFileDocument,
  AgentManifestConfig,
  AgentManifestItemRef,
  AgentManifestLoadMode,
  AgentPlanMode,
} from '../types/flow';
import { CANVAS_FLOW_API_URL, canvasApi, type McpExternalTool, type McpOAuthStatus } from '../lib/api';
import { getDefaultLlmModelForProvider, getLlmModelOptionsForProvider, LLM_MODEL_OPTIONS_BY_PROVIDER } from '../lib/llmModels';

interface InspectorProps {
  config: FlowConfig;
  selectedStep?: FlowStep;
  selectedEdge?: FlowEdge;
  flows?: CanvasFlowRecord[];
  currentFlowId?: string;
  agentId?: string;
  onUpdateConfig: (patch: Partial<FlowConfig>) => void;
  onUpdateStep: (stepId: string, patch: Partial<FlowStep>) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<FlowEdge>) => void;
  onRefreshCronLog?: (stepId: string) => void;
  canRefreshCronLog?: boolean;
}

function stopEditorEvent(event: React.SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation?.();
}

type ProviderSecretStatus = Record<string, boolean>;
type AgentManifestKind = keyof Required<AgentManifestConfig>;
type AgentManifestTab = 'skills' | 'subagents' | 'rules' | 'mcp';

const AGENT_MANIFEST_SECTIONS: Array<{
  key: AgentManifestKind;
  label: string;
  fallbackLoad: AgentManifestLoadMode;
}> = [
  { key: 'rules', label: 'Rules', fallbackLoad: 'always' },
  { key: 'skills', label: 'Skills', fallbackLoad: 'auto' },
  { key: 'subagents', label: 'Subagents', fallbackLoad: 'auto' },
  { key: 'mcpServers', label: 'MCP', fallbackLoad: 'on_demand' },
];

type McpRemoteServerPreset = {
  id: string;
  label: string;
  serverUrl: string;
  authMode: McpExternalAuthMode;
  description: string;
  docsUrl: string;
  oauthScopes?: string[];
  setupLinks: Array<{
    label: string;
    description: string;
    url: string;
  }>;
  setupNotes?: string[];
};

const MCP_REMOTE_SERVER_PRESETS: McpRemoteServerPreset[] = [
  {
    id: 'gmail',
    label: 'Email - Gmail',
    serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
    authMode: 'oauth',
    description: 'Google Workspace em Developer Preview. Permite ler emails, organizar mensagens e criar rascunhos. No projeto Google Cloud do cliente, habilite gmail.googleapis.com e gmailmcp.googleapis.com, adicione os scopes gmail.readonly e gmail.compose e autorize usuarios de teste quando a audiencia for External.',
    docsUrl: 'https://developers.google.com/workspace/guides/configure-mcp-servers',
    oauthScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    setupLinks: [
      { label: 'Habilitar Gmail API', description: 'Ative gmail.googleapis.com no projeto Google Cloud.', url: 'https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com' },
      { label: 'Habilitar Gmail MCP API', description: 'Ative gmailmcp.googleapis.com no mesmo projeto.', url: 'https://console.cloud.google.com/flows/enableapi?apiid=gmailmcp.googleapis.com' },
      { label: 'Configurar Data Access', description: 'Adicione os scopes gmail.readonly e gmail.compose.', url: 'https://console.cloud.google.com/auth/scopes' },
      { label: 'Configurar Audience', description: 'Se usar audiencia External, inclua as contas em Test users.', url: 'https://console.cloud.google.com/auth/audience' },
      { label: 'Configurar Branding OAuth', description: 'Configure a tela de consentimento do aplicativo.', url: 'https://console.cloud.google.com/auth/branding' },
    ],
    setupNotes: [
      'Depois de alterar scopes ou usuarios de teste, use Reconectar do zero no node MCP.',
      'O Google Workspace MCP esta em Developer Preview e pode exigir liberacao da conta ou do dominio.',
    ],
  },
  {
    id: 'google-drive',
    label: 'Google Drive',
    serverUrl: 'https://drivemcp.googleapis.com/mcp/v1',
    authMode: 'oauth',
    description: 'Google Workspace em Developer Preview. Permite pesquisar, ler, criar, copiar e baixar arquivos conforme as permissoes OAuth concedidas.',
    docsUrl: 'https://developers.google.com/workspace/guides/configure-mcp-servers',
    oauthScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    setupLinks: [
      { label: 'Habilitar Google Drive API', description: 'Ative drive.googleapis.com no projeto Google Cloud.', url: 'https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com' },
      { label: 'Habilitar Google Drive MCP API', description: 'Ative drivemcp.googleapis.com no mesmo projeto.', url: 'https://console.cloud.google.com/flows/enableapi?apiid=drivemcp.googleapis.com' },
      { label: 'Configurar Data Access', description: 'Adicione os scopes drive.readonly e drive.file.', url: 'https://console.cloud.google.com/auth/scopes' },
      { label: 'Configurar Audience', description: 'Se usar audiencia External, inclua as contas em Test users.', url: 'https://console.cloud.google.com/auth/audience' },
      { label: 'Configurar Branding OAuth', description: 'Configure a tela de consentimento do aplicativo.', url: 'https://console.cloud.google.com/auth/branding' },
    ],
    setupNotes: [
      'Depois de alterar scopes ou usuarios de teste, use Reconectar do zero no node MCP.',
      'O Google Workspace MCP esta em Developer Preview e pode exigir liberacao da conta ou do dominio.',
    ],
  },
  {
    id: 'onedrive',
    label: 'Microsoft OneDrive Work IQ (preview)',
    serverUrl: 'https://agent365.svc.cloud.microsoft/agents/tenants/SEU_TENANT_ID/servers/mcp_OneDriveRemoteServer',
    authMode: 'oauth',
    description: 'Servidor Work IQ OneDrive em preview. Substitua SEU_TENANT_ID na URL pelo tenant Microsoft Entra. Requer configuracao do cliente OAuth, licenca Microsoft 365 Copilot e limita operacoes de arquivo a 5 MB.',
    docsUrl: 'https://learn.microsoft.com/en-us/microsoft-agent-365/mcp-server-reference/onedrive',
    setupLinks: [
      { label: 'Referencia Work IQ OneDrive', description: 'Confirme requisitos, URL tenant-level e tools disponiveis.', url: 'https://learn.microsoft.com/en-us/microsoft-agent-365/mcp-server-reference/onedrive' },
      { label: 'Microsoft 365 Admin Center', description: 'Revise licencas e politicas do tenant Microsoft 365.', url: 'https://admin.microsoft.com/' },
      { label: 'Microsoft Entra Admin Center', description: 'Consulte o tenant ID e as politicas de acesso da organizacao.', url: 'https://entra.microsoft.com/' },
    ],
    setupNotes: [
      'Substitua SEU_TENANT_ID na URL do preset.',
      'O servidor esta em preview e opera no OneDrive pessoal do usuario autenticado. Operacoes de arquivo sao limitadas a 5 MB.',
    ],
  },
  {
    id: 'notion',
    label: 'Notion',
    serverUrl: 'https://mcp.notion.com/mcp',
    authMode: 'oauth',
    description: 'Servidor remoto oficial do Notion. Usa OAuth e permite ler ou alterar o workspace conforme as permissoes concedidas.',
    docsUrl: 'https://developers.notion.com/docs/get-started-with-mcp',
    setupLinks: [
      { label: 'Conectar ao Notion MCP', description: 'Veja o fluxo OAuth oficial e as permissoes do workspace.', url: 'https://developers.notion.com/docs/get-started-with-mcp' },
    ],
    setupNotes: [
      'O Notion MCP remoto exige OAuth por usuario. A conta acessa apenas o conteudo permitido no workspace selecionado.',
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    serverUrl: 'https://api.githubcopilot.com/mcp/',
    authMode: 'bearer',
    description: 'Servidor remoto oficial do GitHub. Informe um PAT no campo Segredo; OAuth tambem e possivel quando o host possui um GitHub App configurado.',
    docsUrl: 'https://github.com/github/github-mcp-server',
    setupLinks: [
      { label: 'Criar Personal Access Token', description: 'Gere um PAT com acesso minimo aos repositorios e operacoes necessarias.', url: 'https://github.com/settings/personal-access-tokens/new' },
      { label: 'Documentacao do GitHub MCP', description: 'Confira autenticacao remota, PAT, OAuth e politicas aplicaveis.', url: 'https://github.com/github/github-mcp-server' },
      { label: 'Politicas e governanca', description: 'Confira restricoes organizacionais para MCP remoto.', url: 'https://github.com/github/github-mcp-server/blob/main/docs/policies-and-governance.md' },
    ],
    setupNotes: [
      'No Canvas Flow, use autenticacao Bearer e informe o PAT em Segredo.',
      'Aplique privilegio minimo: leitura para consultas e escrita somente quando o fluxo realmente precisar alterar recursos.',
    ],
  },
  {
    id: 'gitlab-orbit',
    label: 'GitLab Orbit (experimental)',
    serverUrl: 'https://gitlab.com/api/v4/orbit/mcp',
    authMode: 'oauth',
    description: 'Servidor remoto oficial do GitLab Orbit para consultar o knowledge graph. Requer Premium ou Ultimate, Orbit habilitado no grupo e ainda nao esta pronto para producao.',
    docsUrl: 'https://docs.gitlab.com/orbit/remote/access/mcp/',
    setupLinks: [
      { label: 'Habilitar Orbit Remote', description: 'Ative o Orbit no grupo top-level com uma conta Owner.', url: 'https://docs.gitlab.com/orbit/remote/getting-started/' },
      { label: 'Conectar via MCP', description: 'Veja o endpoint remoto e o fluxo OAuth do GitLab Orbit.', url: 'https://docs.gitlab.com/orbit/remote/access/mcp/' },
    ],
    setupNotes: [
      'Requer GitLab.com Premium ou Ultimate, papel Owner no grupo top-level e Orbit habilitado.',
      'Orbit Remote ainda e experimental e nao deve ser tratado como dependencia de producao.',
    ],
  },
  {
    id: 'aws-knowledge',
    label: 'AWS Knowledge',
    serverUrl: 'https://knowledge-mcp.global.api.aws',
    authMode: 'none',
    description: 'Servidor remoto oficial e GA para documentacao, referencias, disponibilidade regional e skills AWS. Nao altera recursos da conta e nao exige autenticacao.',
    docsUrl: 'https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server',
    setupLinks: [
      { label: 'Documentacao AWS Knowledge MCP', description: 'Consulte ferramentas, exemplos e comportamento do servidor.', url: 'https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server' },
    ],
    setupNotes: [
      'Nao exige credenciais e nao altera recursos da conta AWS.',
    ],
  },
  {
    id: 'aws-mcp',
    label: 'AWS MCP Server - infraestrutura',
    serverUrl: 'https://aws-mcp.us-east-1.api.aws/mcp',
    authMode: 'aws_sigv4',
    description: 'Servidor remoto gerenciado e GA do Agent Toolkit for AWS. Consulta documentacao e pode operar recursos reais da conta conforme o IAM do backend. Usa AWS SigV4; aplique privilegio minimo e aprovacao humana antes de mutacoes.',
    docsUrl: 'https://docs.aws.amazon.com/aws-mcp/latest/userguide/getting-started-aws-mcp-server.html',
    setupLinks: [
      { label: 'Configurar AWS MCP Server', description: 'Veja credenciais, SigV4, teste de conexao e troubleshooting.', url: 'https://docs.aws.amazon.com/aws-mcp/latest/userguide/getting-started-aws-mcp-server.html' },
      { label: 'Entender autorizacao IAM', description: 'As policies do usuario ou role controlam cada chamada encaminhada aos servicos AWS.', url: 'https://docs.aws.amazon.com/aws-mcp/latest/userguide/security_iam_service-with-iam.html' },
      { label: 'Abrir IAM Roles', description: 'Revise a role usada pelo backend e aplique privilegio minimo.', url: 'https://console.aws.amazon.com/iam/home#/roles' },
    ],
    setupNotes: [
      'O servidor nao exige actions IAM exclusivas do MCP. As permissoes dos servicos AWS continuam valendo normalmente.',
      'Use aws:ViaAWSMCPService e aws:CalledViaAWSMCP para restringir chamadas iniciadas via MCP.',
    ],
  },
];

function getMcpRemoteServerPreset(serverUrl?: string) {
  return MCP_REMOTE_SERVER_PRESETS.find((preset) => preset.serverUrl === String(serverUrl || '').trim());
}

function getMcpRemoteServerOAuthScope(serverUrl?: string) {
  return getMcpRemoteServerPreset(serverUrl)?.oauthScopes?.join(' ') || '';
}

function normalizeAgentManifestLoadMode(value: unknown, fallback: AgentManifestLoadMode): AgentManifestLoadMode {
  const mode = String(value || '').trim();
  if (mode === 'always' || mode === 'auto' || mode === 'on_demand' || mode === 'manual') return mode;
  return fallback;
}

function catalogItemId(item: Record<string, unknown>, fallback: string) {
  return String(item.id || item.key || item.name || item.label || fallback).trim() || fallback;
}

function catalogItemName(item: Record<string, unknown>, fallback: string) {
  return String(item.name || item.label || item.title || catalogItemId(item, fallback)).trim() || fallback;
}

function catalogItemDescription(item: Record<string, unknown>) {
  return String(item.description || item.role || item.instructions || item.instruction || item.action || '').trim();
}

function agentCatalogSlug(value: string, fallback: string) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

type LlmProviderConfigStatus = {
  loading: boolean;
  error: string;
  configured: Partial<Record<FlowLlmProvider, boolean | null>>;
};

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getPlainJsonError(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = raw.replace(/\{\{[\s\S]*?\}\}/g, '0');
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Use um objeto JSON no topo.';
    }
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'JSON invalido.';
  }
}

function isBareIdentifierScript(raw: string) {
  const source = raw.trim().replace(/;$/, '').trim();
  return /^[A-Za-z_$][\w$]*(?:\(\s*\))?$/.test(source)
    || /^return\s+[A-Za-z_$][\w$]*(?:\(\s*\))?\s*;?$/.test(raw.trim());
}

function getJsSyntaxError(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isBareIdentifierScript(raw)) {
    return 'Script precisa retornar um objeto JSON. Ex: return { exemplo: "valor" };';
  }
  const body = /\breturn\b/.test(raw) ? raw : `return (${raw});`;
  try {
    new Function('context', 'slots', 'input', 'now', body);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Sintaxe JS invalida.';
  }
}

function stringifyMongoValue(value: unknown, fallback = '{}') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function getMongoGeneratedPayload(result: Record<string, unknown> | null) {
  if (!result) return null;
  const { explanation, model, ...payload } = result;
  return Object.keys(payload).length ? payload : null;
}

function isFlowOpenAIConfigured(settings: CanvasFlowProviderSettings, secretStatus: ProviderSecretStatus) {
  return Boolean(settings.openai?.enabled || secretStatus['openai.apiKey'] || settings.openai?.apiKey);
}

function isFlowAzureOpenAIConfigured(settings: CanvasFlowProviderSettings, secretStatus: ProviderSecretStatus) {
  return Boolean(
    settings.azureOpenai?.enabled ||
    ((secretStatus['azureOpenai.apiKey'] || settings.azureOpenai?.apiKey) && settings.azureOpenai?.endpoint)
  );
}

function isFlowProviderConfigured(provider: FlowLlmProvider, settings: CanvasFlowProviderSettings, secretStatus: ProviderSecretStatus) {
  if (provider === 'openai') return isFlowOpenAIConfigured(settings, secretStatus);
  if (provider === 'azure_openai') return isFlowAzureOpenAIConfigured(settings, secretStatus);
  if (provider === 'gemini') return Boolean(settings.gemini?.enabled || secretStatus['gemini.apiKey'] || settings.gemini?.apiKey);
  if (provider === 'claude') return Boolean(settings.claude?.enabled || secretStatus['claude.apiKey'] || settings.claude?.apiKey);
  if (provider === 'grok') return Boolean(settings.grok?.enabled || secretStatus['grok.apiKey'] || settings.grok?.apiKey);
  if (provider === 'bedrock') return Boolean((settings.bedrock?.enabled || secretStatus['bedrock.apiKey'] || settings.bedrock?.apiKey) && settings.bedrock?.baseUrl);
  return false;
}

function getLlmProviderName(provider: FlowLlmProvider) {
  if (provider === 'azure_openai') return 'Azure OpenAI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'claude') return 'Claude';
  if (provider === 'grok') return 'Grok';
  if (provider === 'bedrock') return 'Bedrock';
  return 'OpenAI';
}

function getLlmProviderOptionLabel(provider: FlowLlmProvider, status: LlmProviderConfigStatus) {
  const name = getLlmProviderName(provider);
  const configured = status.configured[provider];
  if (configured === true) return `${name} (configurado)`;
  if (configured === false) return `${name} (não configurado)`;
  if (status.loading) return `${name} (verificando...)`;
  if (status.error) return `${name} (status indisponível)`;
  return name;
}

function createWebhookBodyExample(context?: {
  flowId?: string;
  flowName?: string;
  agentId?: string;
  channel?: FlowChannel;
  currentStepId?: string;
  startMode?: WebhookStartMode;
}) {
  const startMode = context?.startMode || 'node';
  return JSON.stringify({
    text: 'Olá, preciso de ajuda.',
    conversationId: `${context?.agentId || 'cliente'}-cliente-123`,
    currentStepId: startMode === 'node' ? context?.currentStepId || '' : '',
    slots: {
      agentId: context?.agentId || '<AGENTE_ID>',
      flowId: context?.flowId || '<FLOW_ID_SALVO>',
      flowName: context?.flowName || '<NOME_DO_FLUXO>',
      channel: context?.channel || 'webWidget',
      cpf: '12345678909',
      origem: 'crm',
    },
  }, null, 2);
}

function createWebhookCurlExample(
  url: string,
  authMode: WebhookAuthMode,
  headerName: string,
  queryParam: string,
  bodyExample: string,
) {
  const targetUrl = authMode === 'query'
    ? `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(queryParam || 'secret')}=<SEGREDO>`
    : url;
  const headers = [
    '-H "Content-Type: application/json"',
    authMode === 'bearer' ? '-H "Authorization: Bearer <SEGREDO>"' : '',
    authMode === 'header' ? `-H "${headerName || 'x-canvas-flow-webhook-secret'}: <SEGREDO>"` : '',
  ].filter(Boolean);

  return [
    `curl -X POST "${targetUrl}" \\`,
    ...headers.map((header) => `  ${header} \\`),
    `  -d '${bodyExample.replace(/'/g, "'\\''")}'`,
  ].join('\n');
}

function createWebhookAsyncResponseExample(flowId?: string, webhookId?: string) {
  return JSON.stringify({
    async: true,
    queued: true,
    jobId: '9b8b1f4e-7a41-4b0a-b067-7f0f8b56a010',
    status: 'queued',
    retrievalUrl: `${CANVAS_FLOW_API_URL}/api/canvas-flow/sqs/jobs/9b8b1f4e-7a41-4b0a-b067-7f0f8b56a010`,
    flowId: flowId || '<FLOW_ID_SALVO>',
    webhookId: webhookId || '<WEBHOOK_ID>',
    callbackUrlConfigured: false,
  }, null, 2);
}

function createWebhookCallbackExample(flowId?: string, webhookId?: string) {
  return JSON.stringify({
    jobId: '9b8b1f4e-7a41-4b0a-b067-7f0f8b56a010',
    status: 'completed',
    flowId: flowId || '<FLOW_ID_SALVO>',
    webhookId: webhookId || '<WEBHOOK_ID>',
    completedAt: '2026-05-17T12:00:00.000Z',
    result: {
      messages: [],
      slots: {},
      ended: true,
    },
  }, null, 2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightPlainCodeSegment(segment: string) {
  const tokenPattern = /(\b(?:const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|of|in|true|false|null|undefined|context|slots|input|now|Array|Object|String|Number|Boolean|Math|Date|JSON)\b|\b\d+(?:\.\d+)?\b|[{}[\]().,:;+\-*/%=!<>|&?]+)/g;
  return segment.split(tokenPattern).map((part) => {
    if (!part) return '';
    const token = escapeHtml(part);
    if (/^(const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|of|in)$/.test(token)) {
      return `<span class="tok-keyword">${token}</span>`;
    }
    if (/^(true|false|null|undefined)$/.test(token)) return `<span class="tok-literal">${token}</span>`;
    if (/^(context|slots|input|now|Array|Object|String|Number|Boolean|Math|Date|JSON)$/.test(token)) {
      return `<span class="tok-builtin">${token}</span>`;
    }
    if (/^\d/.test(token)) return `<span class="tok-number">${token}</span>`;
    if (/^[{}[\]().,:;+\-*/%=!&lt;&gt;|&amp;?]+$/.test(token)) return `<span class="tok-punctuation">${token}</span>`;
    return token;
  }).join('');
}

function highlightCode(value: string, language: 'json' | 'js') {
  let html = '';
  let index = 0;

  while (index < value.length) {
    const char = value[index];
    if (language === 'js' && char === '/' && value[index + 1] === '/') {
      const end = value.indexOf('\n', index);
      const next = end < 0 ? value.length : end;
      html += `<span class="tok-comment">${escapeHtml(value.slice(index, next))}</span>`;
      index = next;
      continue;
    }
    if (language === 'js' && char === '/' && value[index + 1] === '*') {
      const end = value.indexOf('*/', index + 2);
      const next = end < 0 ? value.length : end + 2;
      html += `<span class="tok-comment">${escapeHtml(value.slice(index, next))}</span>`;
      index = next;
      continue;
    }
    if (char === '"' || (language === 'js' && (char === '\'' || char === '`'))) {
      const quote = char;
      let end = index + 1;
      while (end < value.length) {
        if (value[end] === '\\') {
          end += 2;
          continue;
        }
        if (value[end] === quote) {
          end += 1;
          break;
        }
        end += 1;
      }
      const rawString = value.slice(index, end);
      const after = value.slice(end).match(/^\s*:/);
      const className = language === 'json' && after ? 'tok-property' : 'tok-string';
      html += `<span class="${className}">${escapeHtml(rawString)}</span>`;
      index = end;
      continue;
    }

    let nextSpecial = value.length;
    for (const special of language === 'js' ? ['"', "'", '`', '//', '/*'] : ['"']) {
      const found = value.indexOf(special, index + 1);
      if (found >= 0) nextSpecial = Math.min(nextSpecial, found);
    }
    html += highlightPlainCodeSegment(value.slice(index, nextSpecial));
    index = nextSpecial;
  }

  return html || '&nbsp;';
}

function createRuleId() {
  return `route-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function formatCronDate(value?: string | null, timeZone = 'America/Sao_Paulo') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return value;
  }
}

const EMBEDDING_MODEL_OPTIONS = [
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
  { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002' },
];

const MODEL_OPTIONS = Array.from(
  new Map(
    Object.values(LLM_MODEL_OPTIONS_BY_PROVIDER)
      .flat()
      .map((option) => [option.value, option]),
  ).values(),
);

function optionsWithCurrent<T extends { value: string; label: string }>(options: T[], current?: string) {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: `${current} (atual)` }, ...options];
}

function ReasonSlotHint({ slotName, resultName }: { slotName: string; resultName?: string }) {
  return (
    <span className="field-hint reason-slot-hint">
      Campo opcional para auditoria/debug. A decisao principal fica em{' '}
      <code>{`context.slots.${resultName || 'resultado'}`}</code>; a explicacao da IA fica em{' '}
      <code>{`context.slots.${slotName}`}</code>. Use um nome legivel, por exemplo <code>motivoAgendamento</code>.
    </span>
  );
}

function normalizeEdgeValidationPath(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return 'context.slots.input';
  if (/^(context|Math|Number|String|Boolean|Array|Date)\b/.test(raw)) return raw;
  if (raw.startsWith('slots.')) return `context.${raw}`;
  return `context.slots.${raw}`;
}

function buildEdgeOutputValidationCondition(path: string, type: EdgeOutputValidationType) {
  const valueExpression = normalizeEdgeValidationPath(path);
  const checks: Record<EdgeOutputValidationType, string> = {
    filled: "value !== undefined && value !== null && String(value).trim() !== ''",
    text: "typeof value === 'string' && value.trim() !== ''",
    number: [
      "(typeof value === 'number' && Number.isFinite(value))",
      "|| (typeof value === 'string'",
      "  && value.trim() !== ''",
      "  && Number.isFinite(Number(value)))",
    ].join('\n    '),
    integer: [
      'Number.isInteger(value)',
      "|| (typeof value === 'string'",
      "  && /^-?\\d+$/.test(value.trim()))",
    ].join('\n    '),
    boolean: [
      "typeof value === 'boolean'",
      "|| ['true', 'false', 'sim', 'nao', 'não', 'yes', 'no', '1', '0']",
      '  .includes(String(value).trim().toLowerCase())',
    ].join('\n    '),
    date: [
      'value instanceof Date',
      "|| (String(value || '').trim() !== ''",
      '  && !Number.isNaN(Date.parse(String(value))))',
    ].join('\n    '),
    email: "/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || '').trim())",
    cpf: "String(value || '').replace(/\\D/g, '').length === 11",
    cnpj: "String(value || '').replace(/\\D/g, '').length === 14",
    phone: "String(value || '').replace(/\\D/g, '').length >= 8",
    object: "value !== null && typeof value === 'object' && !Array.isArray(value)",
    array: 'Array.isArray(value)',
  };
  return [
    '(() => {',
    `  const value = ${valueExpression};`,
    `  return ${checks[type]};`,
    '})()',
  ].join('\n');
}

function extractConditionSlotReferences(code: string) {
  const refs = new Set<string>();
  const raw = String(code || '');
  const dotPattern = /\b(?:context\.)?slots\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
  const bracketPattern = /\b(?:context\.)?slots\[['"]([^'"]+)['"]\]/g;
  let match: RegExpExecArray | null;
  while ((match = dotPattern.exec(raw))) {
    refs.add(match[1].split('.')[0]);
  }
  while ((match = bracketPattern.exec(raw))) {
    refs.add(match[1].split('.')[0]);
  }
  return Array.from(refs);
}

function getSlotNameFromValidationPath(path: string) {
  const normalized = normalizeEdgeValidationPath(path);
  const match = normalized.match(/^context\.slots\.([A-Za-z_$][\w$]*)/);
  return match?.[1] || '';
}

function getStepResponseSlot(step?: FlowStep) {
  return step?.responseName || step?.api?.responseName || step?.component?.responseName || '';
}

function parseBlockedTermsDraft(value: string) {
  return value.split(',').map((item) => item.replace(/^\s+/, ''));
}

function normalizeBlockedTerms(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const HTTP_METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const INPUT_VALIDATION_TYPES: Array<{ value: InputValidationType; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'boolean', label: 'Sim/Não' },
];
const EDGE_OUTPUT_VALIDATION_TYPES: Array<{ value: EdgeOutputValidationType; label: string }> = [
  { value: 'filled', label: 'Preenchido' },
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'integer', label: 'Inteiro' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'date', label: 'Data' },
  { value: 'email', label: 'Email' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'object', label: 'Objeto' },
  { value: 'array', label: 'Array/lista' },
];

const HTTP_BODY_TYPES = [
  { value: 'none', label: 'Sem body' },
  { value: 'jsonFields', label: 'JSON por campos' },
  { value: 'jsonText', label: 'JSON texto' },
  { value: 'text', label: 'Texto bruto' },
] as const;

const MONGO_OPERATION_OPTIONS: Array<{ value: MongoOperation; label: string }> = [
  { value: 'insertOne', label: 'Inserir 1' },
  { value: 'insertMany', label: 'Inserir vários' },
  { value: 'find', label: 'Buscar vários' },
  { value: 'findOne', label: 'Buscar 1' },
  { value: 'updateOne', label: 'Atualizar 1' },
  { value: 'updateMany', label: 'Atualizar vários' },
  { value: 'upsertOne', label: 'Upsert 1' },
  { value: 'deleteOne', label: 'Deletar 1' },
  { value: 'deleteMany', label: 'Deletar vários' },
  { value: 'count', label: 'Contar' },
  { value: 'aggregate', label: 'Aggregate' },
];

const MONGO_FILTER_OPERATIONS = new Set<MongoOperation>([
  'find',
  'findOne',
  'updateOne',
  'updateMany',
  'upsertOne',
  'deleteOne',
  'deleteMany',
  'count',
  'aggregate',
]);
const MONGO_DOCUMENT_OPERATIONS = new Set<MongoOperation>(['insertOne', 'insertMany']);
const MONGO_UPDATE_OPERATIONS = new Set<MongoOperation>(['updateOne', 'updateMany', 'upsertOne']);
const MONGO_PROJECTION_OPERATIONS = new Set<MongoOperation>(['find', 'findOne']);
const MONGO_SORT_OPERATIONS = new Set<MongoOperation>(['find', 'findOne']);
const MONGO_LIMIT_OPERATIONS = new Set<MongoOperation>(['find', 'aggregate', 'insertMany']);
const MONGO_PAGINATION_OPERATIONS = new Set<MongoOperation>(['find', 'aggregate']);
const MONGO_DATE_RANGE_OPERATIONS = new Set<MongoOperation>([
  'find',
  'findOne',
  'updateOne',
  'updateMany',
  'upsertOne',
  'deleteOne',
  'deleteMany',
  'count',
  'aggregate',
]);
const MONGO_LLM_FULL_ONLY_OPERATIONS = new Set<MongoOperation>(['insertOne', 'insertMany', 'updateOne', 'updateMany', 'upsertOne']);

const WHATSAPP_LIMITS = {
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

const APPOINTMENT_FLOW_STAGE_OPTIONS: Array<{ value: AppointmentFlowStage; label: string }> = [
  { value: 'actions', label: 'Ações iniciais' },
  { value: 'appointments', label: 'Meus agendamentos' },
  { value: 'providers', label: 'Prestadores' },
  { value: 'services', label: 'Serviços' },
  { value: 'dates', label: 'Datas' },
  { value: 'times', label: 'Horários' },
  { value: 'items', label: 'Itens selecionáveis' },
];

const DEFAULT_APPOINTMENT_FLOW = {
  mode: 'auto' as const,
  flowId: '',
  flowToken: '{{context.conversationId}}',
  flowCta: 'Agendar',
  flowScreen: 'START',
  headerText: 'Agendamento',
  buttonText: 'Ver opções',
  stage: 'actions' as AppointmentFlowStage,
  stageTemplate: '{{context.slots.appointmentStage}}',
  actionsTemplate: '',
  appointmentsTemplate: '{{context.slots.appointments}}',
  providersTemplate: '{{context.slots.providers}}',
  servicesTemplate: '{{context.slots.services}}',
  datesTemplate: '{{context.slots.dates}}',
  timesTemplate: '{{context.slots.times}}',
  itemsTemplate: '{{context.slots.items}}',
  itemsFilterTemplate: '',
  itemsMaxSelected: 20,
  examsTemplate: '{{context.slots.exams}}',
  payloadTemplate: '{}',
  stepOrder: ['providers', 'services', 'items', 'dates', 'times'] as string[],
  stepLabels: {
    actions: 'Ações iniciais',
    appointments: 'Meus agendamentos',
    providers: 'Prestadores',
    services: 'Serviços',
    dates: 'Datas',
    times: 'Horários',
    items: 'Itens selecionáveis',
  } as Record<string, string>,
  attachmentSteps: [] as Array<{ id: string; label: string; type?: 'image' | 'document'; required?: boolean; description?: string }>,
  llmEnabled: false,
  llmSourceTemplate: '{{context.slots.schedules}}',
  llmInstruction: 'Receba os agendamentos/horários brutos e retorne providers, services, items, dates, times e appointments no formato do WhatsApp Flow.',
  llmModel: '',
  llmTemperature: 0.1,
};

const APPOINTMENT_FLOW_ORDER_BASE_STEPS = [
  { key: 'actions', label: 'Ações iniciais', screen: 'ACTIONS' },
  { key: 'appointments', label: 'Meus agendamentos', screen: 'APPOINTMENTS' },
  { key: 'providers', label: 'Prestadores', screen: 'START' },
  { key: 'services', label: 'Serviços', screen: 'SERVICES' },
  { key: 'dates', label: 'Datas', screen: 'DATES' },
  { key: 'times', label: 'Horários', screen: 'TIMES' },
  { key: 'items', label: 'Itens selecionáveis', screen: 'ITEMS' },
];

const APPOINTMENT_FLOW_FIELD_EXAMPLES: Record<string, { title: string; description: string; value: unknown }> = {
  actions: {
    title: 'Ações iniciais',
    description: 'Use quando quiser mostrar ações antes da escolha de prestador, serviço ou horário.',
    value: [
      { id: 'novo', title: 'Novo agendamento', description: 'Escolher prestador, serviço, data e horário' },
      { id: 'meus', title: 'Meus agendamentos', description: 'Consultar ou remarcar horários existentes' },
    ],
  },
  appointments: {
    title: 'Agendamentos',
    description: 'Lista de agendamentos já montados ou disponíveis para confirmação.',
    value: [
      {
        id: 'ag_20260520_0900',
        title: '20/05/2026 às 09:00',
        description: 'Dra. Ana - Consulta cardiológica',
        providerId: 'prestador_ana',
        serviceId: 'consulta',
        date: '2026-05-20',
        time: '09:00',
      },
    ],
  },
  providers: {
    title: 'Prestadores',
    description: 'Profissionais, unidades ou equipes que podem atender.',
    value: [
      { id: 'prestador_ana', title: 'Dra. Ana', description: 'Cardiologia - Unidade Paulista' },
      { id: 'prestador_bruno', title: 'Dr. Bruno', description: 'Clínico geral - Telemedicina' },
    ],
  },
  services: {
    title: 'Serviços',
    description: 'Serviços ou procedimentos que o usuário pode escolher.',
    value: [
      { id: 'consulta', title: 'Consulta', description: 'Atendimento de 30 minutos' },
      { id: 'retorno', title: 'Retorno', description: 'Retorno em até 15 dias' },
    ],
  },
  dates: {
    title: 'Datas',
    description: 'Dias disponíveis. O id pode ser uma data ISO para facilitar o backend.',
    value: [
      { id: '2026-05-20', title: '20/05/2026', description: 'Quarta-feira' },
      { id: '2026-05-21', title: '21/05/2026', description: 'Quinta-feira' },
    ],
  },
  times: {
    title: 'Horários',
    description: 'Horários disponíveis para a etapa selecionada.',
    value: [
      { id: '09:00', title: '09:00', description: 'Manhã' },
      { id: '14:30', title: '14:30', description: 'Tarde' },
    ],
  },
  items: {
    title: 'Itens selecionáveis',
    description: 'Lista genérica para seleção múltipla. Pode ser exame, produto, procedimento ou qualquer item de carrinho.',
    value: [
      { id: 'hemograma', title: 'Hemograma', description: 'HEM' },
      { id: 'tsh', title: 'TSH', description: 'Hormônio tireoestimulante' },
      { id: 'glicemia', title: 'Glicemia', description: 'GLI' },
    ],
  },
  payload: {
    title: 'Payload extra do Flow',
    description: 'Objeto adicional para contexto. No Flow Meta padrao, apenas campos aceitos pela tela inicial entram no payload nativo; em lista/Blip/Sinch ele pode carregar mais contexto.',
    value: {
      clientId: '{{context.slots.clientId}}',
      clientName: '{{context.slots.clientName}}',
      insurancePlan: '{{context.slots.plan}}',
      origin: 'canvas-flow',
    },
  },
};

function appointmentAttachmentKey(id: string) {
  return `attachment:${id}`;
}

function normalizeAppointmentAttachmentId(value: string, index: number) {
  const digitWords = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\d/g, (digit) => `_${digitWords[Number(digit)]}_`)
    .replace(/[^a-z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `anexo_${digitWords[index + 1] || 'item'}`;
}

function repairMojibakeText(value: string) {
  return String(value || '')
    .replace(/ÃƒÂ§/g, 'ç')
    .replace(/ÃƒÂ£/g, 'ã')
    .replace(/ÃƒÂµ/g, 'õ')
    .replace(/ÃƒÂ¡/g, 'á')
    .replace(/ÃƒÂ©/g, 'é')
    .replace(/ÃƒÂ­/g, 'í')
    .replace(/ÃƒÂ³/g, 'ó')
    .replace(/ÃƒÂº/g, 'ú')
    .replace(/ÃƒÂª/g, 'ê')
    .replace(/ÃƒÂ¢/g, 'â')
    .replace(/ÃƒÂ´/g, 'ô')
    .replace(/ÃƒÂ /g, 'à')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã /g, 'à')
    .replace(/Â/g, '');
}

function normalizeAppointmentStepOrder(
  rawOrder: string[] | undefined,
  attachmentSteps: Array<{ id: string; label: string }>,
) {
  const attachmentKeys = attachmentSteps.map((step) => appointmentAttachmentKey(step.id));
  const allowed = new Set([...APPOINTMENT_FLOW_ORDER_BASE_STEPS.map((step) => step.key), ...attachmentKeys]);
  const initialOrder = Array.isArray(rawOrder)
    ? rawOrder
    : APPOINTMENT_FLOW_ORDER_BASE_STEPS.map((step) => step.key);
  const ordered = initialOrder
    .map((item) => String(item || '').trim() === 'exams' ? 'items' : String(item || '').trim())
    .filter((item, index, source) => allowed.has(item) && source.indexOf(item) === index);
  for (const key of attachmentKeys) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  if (!ordered.length) ordered.push(APPOINTMENT_FLOW_ORDER_BASE_STEPS[0].key);
  return ordered;
}

function appointmentStepOrderLabel(key: string, attachmentSteps: Array<{ id: string; label: string }>, stepLabels?: Record<string, string>) {
  const base = APPOINTMENT_FLOW_ORDER_BASE_STEPS.find((step) => step.key === key);
  if (base) return repairMojibakeText(stepLabels?.[key] || base.label);
  const attachment = attachmentSteps.find((step) => appointmentAttachmentKey(step.id) === key);
  return attachment?.label || 'Anexo';
}

function appointmentStepScreenId(key: string, index: number) {
  if (index === 0) return 'START';
  const base = APPOINTMENT_FLOW_ORDER_BASE_STEPS.find((step) => step.key === key);
  if (base) return base.screen === 'START' ? 'PROVIDERS' : base.screen;
  return `ATTACHMENT_${normalizeAppointmentAttachmentId(key.replace(/^attachment:/, ''), index).toUpperCase()}`;
}

function appointmentTemplateMeta(key: string) {
  const meta: Record<string, {
    helpKey: string;
    title: string;
    valueKey: keyof typeof DEFAULT_APPOINTMENT_FLOW;
    rows: number;
    placeholder: string;
  }> = {
    actions: {
      helpKey: 'actions',
      title: 'Ações iniciais',
      valueKey: 'actionsTemplate',
      rows: 3,
      placeholder: 'Opcional. Ex: [{"id":"novo","title":"Novo agendamento"},{"id":"meus","title":"Meus agendamentos"}]',
    },
    appointments: {
      helpKey: 'appointments',
      title: 'Agendamentos',
      valueKey: 'appointmentsTemplate',
      rows: 3,
      placeholder: '{{context.slots.appointments}}',
    },
    providers: {
      helpKey: 'providers',
      title: 'Prestadores',
      valueKey: 'providersTemplate',
      rows: 3,
      placeholder: '{{context.slots.providers}}',
    },
    services: {
      helpKey: 'services',
      title: 'Serviços',
      valueKey: 'servicesTemplate',
      rows: 3,
      placeholder: '{{context.slots.services}}',
    },
    dates: {
      helpKey: 'dates',
      title: 'Datas',
      valueKey: 'datesTemplate',
      rows: 3,
      placeholder: '{{context.slots.dates}}',
    },
    times: {
      helpKey: 'times',
      title: 'Horários',
      valueKey: 'timesTemplate',
      rows: 3,
      placeholder: '{{context.slots.times}}',
    },
    items: {
      helpKey: 'items',
      title: 'Itens selecionáveis',
      valueKey: 'itemsTemplate',
      rows: 4,
      placeholder: '{{context.slots.items}}',
    },
  };
  return meta[key];
}

function stringifyFlowValidationIssue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildConditionJsBody(rawValue: string) {
  const raw = String(rawValue || '').trim();
  if (/^(return|const|let|var|if|for|while|do|switch|try|throw|function|class)\b/.test(raw)) {
    return raw;
  }
  return `return (${raw});`;
}

function getConditionJsSyntaxError(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const body = buildConditionJsBody(raw);
  try {
    new Function('context', 'slots', 'input', 'now', body);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Sintaxe JS invalida.';
  }
}

function formatWhatsappFlowValidationErrors(errors: unknown[]): string {
  return errors
    .map((item, index) => {
      if (typeof item === 'string') return `${index + 1}. ${item}`;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const path = [record.path, record.field, record.pointer, record.property, record.component]
          .map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''))
          .find(Boolean);
        const message = [record.message, record.error, record.title, record.detail, record.description]
          .map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''))
          .find(Boolean);
        const nested = [record.details, record.errors, record.validation_errors]
          .find((value) => Array.isArray(value) && value.length > 0) as unknown[] | undefined;
        const nestedText: string = nested
          ? `\n${formatWhatsappFlowValidationErrors(nested).split('\n').map((line: string) => `  ${line}`).join('\n')}`
          : '';
        return `${index + 1}. ${path ? `${path}: ` : ''}${message || stringifyFlowValidationIssue(item)}${nestedText}`;
      }
      return `${index + 1}. ${String(item)}`;
    })
    .join('\n');
}

function richMaxItems(type: RichMessageType) {
  if (type === 'buttons' || type === 'quickReplies') return WHATSAPP_LIMITS.buttons;
  if (type === 'list' || type === 'appointmentFlow') return WHATSAPP_LIMITS.listRows;
  if (type === 'carousel') return WHATSAPP_LIMITS.carouselCards;
  return 1;
}

type FilterValueType = 'text' | 'number' | 'boolean' | 'array';

interface FilterDraft {
  field: string;
  type: FilterValueType;
  value: string;
  condition?: string;
}

type HttpBodyType = (typeof HTTP_BODY_TYPES)[number]['value'];

const EMPTY_FILTER_DRAFT: FilterDraft = { field: '', type: 'text', value: '' };

function inferFilterType(value: unknown): FilterValueType {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'text';
}

function stringifyFilterValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseFilterValue(type: FilterValueType, rawValue: string) {
  const value = rawValue.trim();
  if (type === 'number') {
    if (!value) return null;
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'boolean') {
    return value === 'true';
  }
  if (type === 'array') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        if (item === 'true') return true;
        if (item === 'false') return false;
        const parsed = Number(item.replace(',', '.'));
        return Number.isFinite(parsed) && /^-?\d+([.,]\d+)?$/.test(item) ? parsed : item;
      });
  }
  return rawValue;
}

function normalizeExtraFieldsFilterRules(filter: Record<string, unknown> | undefined, rules: ExtraFieldsFilterRule[] | undefined) {
  if (Array.isArray(rules) && rules.length) {
    return rules.map((rule) => ({
      field: String(rule.field || '').trim(),
      value: rule.value,
      condition: String(rule.condition || ''),
    })).filter((rule) => rule.field);
  }
  return Object.entries(filter || {}).map(([field, value]) => ({
    field,
    value,
    condition: '',
  }));
}

function getUnconditionalExtraFieldsFilter(rules: ExtraFieldsFilterRule[]) {
  return rules.reduce((acc, rule) => {
    const field = String(rule.field || '').trim();
    const condition = String(rule.condition || '').trim();
    if (field && !condition) acc[field] = rule.value;
    return acc;
  }, {} as Record<string, unknown>);
}

function FilterValueControl({
  type,
  value,
  onChange,
}: {
  type: FilterValueType;
  value: string;
  onChange: (value: string) => void;
}) {
  if (type === 'boolean') {
    return (
      <select value={value === 'true' ? 'true' : 'false'} onChange={(event) => onChange(event.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return <input value={value} placeholder={type === 'array' ? 'valor1, valor2' : 'Valor'} onChange={(event) => onChange(event.target.value)} />;
}

function FilterEditor({
  filter,
  draft,
  emptyText,
  onChange,
  onDraftChange,
}: {
  filter: Record<string, unknown>;
  draft: FilterDraft;
  emptyText: string;
  onChange: (filter: Record<string, unknown>) => void;
  onDraftChange: (draft: FilterDraft) => void;
}) {
  const entries = Object.entries(filter || {});

  const addDraftFilter = () => {
    const field = draft.field.trim();
    if (!field) return;
    onChange({ ...filter, [field]: parseFilterValue(draft.type, draft.value) });
    onDraftChange(EMPTY_FILTER_DRAFT);
  };

  return (
    <div className="filter-editor">
      {entries.length === 0 && <div className="filter-empty">{emptyText}</div>}
      {entries.map(([field, value], index) => {
        const type = inferFilterType(value);
        const rawValue = stringifyFilterValue(value);
        return (
          <div className="filter-row" key={index}>
            <input
              aria-label="Campo extraFields"
              value={field}
              placeholder="Campo"
              onChange={(event) => {
                const nextField = event.target.value.trim();
                const next = { ...filter };
                delete next[field];
                if (nextField) next[nextField] = value;
                onChange(next);
              }}
            />
            <select
              aria-label="Tipo do filtro"
              value={type}
              onChange={(event) => {
                onChange({ ...filter, [field]: parseFilterValue(event.target.value as FilterValueType, rawValue) });
              }}
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="boolean">Booleano</option>
              <option value="array">Lista</option>
            </select>
            <FilterValueControl
              type={type}
              value={rawValue}
              onChange={(nextValue) => onChange({ ...filter, [field]: parseFilterValue(type, nextValue) })}
            />
            <button
              type="button"
              className="filter-icon-button"
              aria-label="Remover filtro"
              title="Remover filtro"
              onClick={() => {
                const next = { ...filter };
                delete next[field];
                onChange(next);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <div className="filter-row filter-row-new">
        <input
          value={draft.field}
          placeholder="Campo"
          onChange={(event) => onDraftChange({ ...draft, field: event.target.value })}
        />
        <select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as FilterValueType })}>
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Booleano</option>
          <option value="array">Lista</option>
        </select>
        <FilterValueControl
          type={draft.type}
          value={draft.value}
          onChange={(value) => onDraftChange({ ...draft, value })}
        />
        <button type="button" className="filter-add-button" onClick={addDraftFilter} disabled={!draft.field.trim()}>
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

function inferHttpBodyType(request: Record<string, unknown>): HttpBodyType {
  if (request.bodyType === 'none' || request.bodyType === 'jsonFields' || request.bodyType === 'jsonText' || request.bodyType === 'text') {
    return request.bodyType;
  }
  const body = request.body !== undefined ? request.body : request.data;
  if (typeof body === 'string') return 'text';
  if (body && typeof body === 'object' && !Array.isArray(body)) return 'jsonFields';
  return 'none';
}

function cleanObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createHttpRequest(): Record<string, unknown> {
  return {
    method: 'GET',
    url: 'https://example.com',
    headers: {},
    params: {},
    bodyType: 'none',
  };
}

function createPollingConfig() {
  return {
    enabled: true,
    url: '',
    method: 'GET',
    headers: {},
    params: {},
    intervalSeconds: 5,
    maxAttempts: 10,
    stopCondition: 'result.data.status === "done"',
  };
}

function stringifyBodyJson(body: unknown) {
  if (body === undefined || body === null || body === '') return '{\n  \n}';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return '{}';
  }
}

function HttpBatchEditor({
  requests,
  onChange,
}: {
  requests: Array<Record<string, unknown>>;
  onChange: (requests: Array<Record<string, unknown>>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, FilterDraft>>({});
  const [jsonBodyDrafts, setJsonBodyDrafts] = useState<Record<string, string>>({});
  const safeRequests = Array.isArray(requests) ? requests : [];
  const updateDraft = (key: string, draft: FilterDraft) => setDrafts((current) => ({ ...current, [key]: draft }));
  const updateRequest = (index: number, patch: Record<string, unknown>) => {
    const next = [...safeRequests];
    next[index] = { ...(next[index] || createHttpRequest()), ...patch };
    onChange(next);
  };
  const removeRequest = (index: number) => onChange(safeRequests.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="http-batch-editor">
      <div className="filter-section-header">
        <strong>Requests httpBatch ({safeRequests.length})</strong>
        <button type="button" onClick={() => onChange([...safeRequests, createHttpRequest()])}>
          <Plus size={14} />
          Request
        </button>
      </div>
      {safeRequests.length === 0 && <div className="filter-empty">Nenhuma chamada configurada.</div>}
      {safeRequests.map((request, index) => {
        const bodyType = inferHttpBodyType(request);
        const bodyValue = request.body !== undefined ? request.body : request.data;
        const polling = cleanObject(request.polling);
        const pollingEnabled = polling.enabled === true;
        const pollingBodyType = inferHttpBodyType(polling);
        const pollingBodyValue = polling.body !== undefined ? polling.body : polling.data;
        const updatePolling = (patch: Record<string, unknown>) => updateRequest(index, {
          polling: {
            ...createPollingConfig(),
            ...polling,
            ...patch,
          },
        });

        return (
          <div className="http-request-card" key={index}>
            <div className="http-request-header">
              <strong>Request {index + 1}</strong>
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover request"
                title="Remover request"
                onClick={() => removeRequest(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="http-request-grid">
              <label>
                Método
                <select
                  value={String(request.method || 'GET').toUpperCase()}
                  onChange={(event) => updateRequest(index, { method: event.target.value })}
                >
                  {HTTP_METHOD_OPTIONS.map((method) => (
                    <option value={method} key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label>
                URL
                <input
                  value={String(request.url || '')}
                  placeholder="https://api.exemplo.com/recurso"
                  onChange={(event) => updateRequest(index, { url: event.target.value })}
                />
              </label>
            </div>
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Headers</strong>
              </div>
              <FilterEditor
                filter={cleanObject(request.headers)}
                draft={drafts[`headers-${index}`] || EMPTY_FILTER_DRAFT}
                emptyText="Sem headers."
                onDraftChange={(draft) => updateDraft(`headers-${index}`, draft)}
                onChange={(headers) => updateRequest(index, { headers })}
              />
            </div>
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Query params</strong>
              </div>
              <FilterEditor
                filter={cleanObject(request.params)}
                draft={drafts[`params-${index}`] || EMPTY_FILTER_DRAFT}
                emptyText="Sem query params."
                onDraftChange={(draft) => updateDraft(`params-${index}`, draft)}
                onChange={(params) => updateRequest(index, { params })}
              />
            </div>
            <label>
              Body
              <select
                value={bodyType}
                onChange={(event) => {
                  const nextType = event.target.value as HttpBodyType;
                  if (nextType === 'none') updateRequest(index, { bodyType: nextType, body: undefined, data: undefined });
                  if (nextType === 'jsonFields') updateRequest(index, { bodyType: nextType, body: cleanObject(bodyValue), data: undefined });
                  if (nextType === 'jsonText') {
                    const nextText = stringifyBodyJson(bodyValue);
                    setJsonBodyDrafts((current) => ({ ...current, [index]: nextText }));
                    updateRequest(index, { bodyType: nextType, body: parseJson(nextText, cleanObject(bodyValue)), data: undefined });
                  }
                  if (nextType === 'text') updateRequest(index, { bodyType: nextType, body: typeof bodyValue === 'string' ? bodyValue : '', data: undefined });
                }}
              >
                {HTTP_BODY_TYPES.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {bodyType === 'jsonFields' && (
              <div className="filter-section">
                <div className="filter-section-header">
                  <strong>Campos do body</strong>
                </div>
                <FilterEditor
                  filter={cleanObject(bodyValue)}
                  draft={drafts[`body-${index}`] || EMPTY_FILTER_DRAFT}
                  emptyText="Sem campos no body."
                  onDraftChange={(draft) => updateDraft(`body-${index}`, draft)}
                  onChange={(body) => updateRequest(index, { body, data: undefined, bodyType })}
                />
              </div>
            )}
            {bodyType === 'jsonText' && (
              <label>
                JSON do body
                <textarea
                  rows={6}
                  value={jsonBodyDrafts[index] ?? stringifyBodyJson(bodyValue)}
                  placeholder='{"campo": "valor"}'
                  onChange={(event) => setJsonBodyDrafts((current) => ({ ...current, [index]: event.target.value }))}
                  onBlur={() => {
                    const raw = jsonBodyDrafts[index] ?? stringifyBodyJson(bodyValue);
                    updateRequest(index, { body: parseJson(raw, cleanObject(bodyValue)), data: undefined, bodyType });
                  }}
                />
              </label>
            )}
            {bodyType === 'text' && (
              <label>
                Texto do body
                <textarea
                  rows={4}
                  value={String(bodyValue || '')}
                  placeholder="Conteúdo bruto enviado no body"
                  onChange={(event) => updateRequest(index, { body: event.target.value, data: undefined, bodyType })}
                />
              </label>
            )}
            <div className="filter-section">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={pollingEnabled}
                  onChange={(event) => updatePolling({ enabled: event.target.checked })}
                />
                <span>Ativar polling</span>
              </label>

              {pollingEnabled && (
                <>
                  <div className="filter-empty">
                    Use polling quando a chamada inicial dispara um processamento/webhook e outra URL precisa ser consultada até o dado aparecer.
                    Em URL, headers ou params, você pode usar <code>{'{{result.data.id}}'}</code> ou <code>{'{{initialResult.data.id}}'}</code>.
                  </div>
                  <div className="http-request-grid">
                    <label>
                      Método do polling
                      <select
                        value={String(polling.method || 'GET').toUpperCase()}
                        onChange={(event) => updatePolling({ method: event.target.value })}
                      >
                        {HTTP_METHOD_OPTIONS.map((method) => (
                          <option value={method} key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      URL de polling
                      <input
                        value={String(polling.url || '')}
                        placeholder="https://api.exemplo.com/status/{{result.data.id}}"
                        onChange={(event) => updatePolling({ url: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="inspector-grid-two">
                    <label>
                      Intervalo (segundos)
                      <input
                        type="number"
                        min={1}
                        max={600}
                        value={Number(polling.intervalSeconds || 5)}
                        onChange={(event) => updatePolling({ intervalSeconds: Math.max(1, Number(event.target.value) || 1) })}
                      />
                    </label>
                    <label>
                      Máx. tentativas
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Number(polling.maxAttempts || 10)}
                        onChange={(event) => updatePolling({ maxAttempts: Math.max(1, Number(event.target.value) || 1) })}
                      />
                    </label>
                  </div>
                  <div className="filter-empty">
                    Use a condição JS para decidir quando parar. Você recebe <code>result</code> com a resposta atual do polling,
                    <code>initialResult</code> com a resposta da primeira chamada e <code>attempt</code> com o número da tentativa.
                  </div>
                  <label>
                    Condição JS para parar
                    <textarea
                      rows={3}
                      value={String(polling.stopCondition || '')}
                      placeholder={'result.data.status === "done" && Boolean(result.data.result?.xpto)'}
                      onChange={(event) => updatePolling({ stopCondition: event.target.value })}
                    />
                  </label>
                  <label>
                    Body do polling
                    <select
                      value={pollingBodyType}
                      onChange={(event) => {
                        const nextType = event.target.value as HttpBodyType;
                        if (nextType === 'none') updatePolling({ bodyType: nextType, body: undefined, data: undefined });
                        if (nextType === 'jsonFields') updatePolling({ bodyType: nextType, body: cleanObject(pollingBodyValue), data: undefined });
                        if (nextType === 'jsonText') {
                          const nextText = stringifyBodyJson(pollingBodyValue);
                          setJsonBodyDrafts((current) => ({ ...current, [`polling-${index}`]: nextText }));
                          updatePolling({ bodyType: nextType, body: parseJson(nextText, cleanObject(pollingBodyValue)), data: undefined });
                        }
                        if (nextType === 'text') updatePolling({ bodyType: nextType, body: typeof pollingBodyValue === 'string' ? pollingBodyValue : '', data: undefined });
                      }}
                    >
                      {HTTP_BODY_TYPES.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  {pollingBodyType === 'jsonFields' && (
                    <div className="filter-section">
                      <div className="filter-section-header">
                        <strong>Campos do body do polling</strong>
                      </div>
                      <FilterEditor
                        filter={cleanObject(pollingBodyValue)}
                        draft={drafts[`polling-body-${index}`] || EMPTY_FILTER_DRAFT}
                        emptyText="Sem campos no body."
                        onDraftChange={(draft) => updateDraft(`polling-body-${index}`, draft)}
                        onChange={(body) => updatePolling({ body, data: undefined, bodyType: pollingBodyType })}
                      />
                    </div>
                  )}
                  {pollingBodyType === 'jsonText' && (
                    <label>
                      JSON do body do polling
                      <textarea
                        rows={6}
                        value={jsonBodyDrafts[`polling-${index}`] ?? stringifyBodyJson(pollingBodyValue)}
                        placeholder='{"id": "{{initialResult.data.id}}"}'
                        onChange={(event) => setJsonBodyDrafts((current) => ({ ...current, [`polling-${index}`]: event.target.value }))}
                        onBlur={() => {
                          const raw = jsonBodyDrafts[`polling-${index}`] ?? stringifyBodyJson(pollingBodyValue);
                          updatePolling({ body: parseJson(raw, cleanObject(pollingBodyValue)), data: undefined, bodyType: pollingBodyType });
                        }}
                      />
                    </label>
                  )}
                  {pollingBodyType === 'text' && (
                    <label>
                      Texto do body do polling
                      <textarea
                        rows={4}
                        value={String(pollingBodyValue || '')}
                        placeholder="Conteúdo bruto enviado no polling"
                        onChange={(event) => updatePolling({ body: event.target.value, data: undefined, bodyType: pollingBodyType })}
                      />
                    </label>
                  )}
                  <div className="filter-section">
                    <div className="filter-section-header">
                      <strong>Headers do polling</strong>
                    </div>
                    <FilterEditor
                      filter={cleanObject(polling.headers)}
                      draft={drafts[`polling-headers-${index}`] || EMPTY_FILTER_DRAFT}
                      emptyText="Sem headers."
                      onDraftChange={(draft) => updateDraft(`polling-headers-${index}`, draft)}
                      onChange={(headers) => updatePolling({ headers })}
                    />
                  </div>
                  <div className="filter-section">
                    <div className="filter-section-header">
                      <strong>Query params do polling</strong>
                    </div>
                    <FilterEditor
                      filter={cleanObject(polling.params)}
                      draft={drafts[`polling-params-${index}`] || EMPTY_FILTER_DRAFT}
                      emptyText="Sem query params."
                      onDraftChange={(draft) => updateDraft(`polling-params-${index}`, draft)}
                      onChange={(params) => updatePolling({ params })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function actionId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: FlowNodeTagConfig[];
  onChange: (tags: FlowNodeTagConfig[]) => void;
}) {
  const updateTag = (index: number, patch: Partial<FlowNodeTagConfig>) => {
    const next = [...tags];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="rich-editor-block">
      <div className="filter-section-header">
        <strong>Tags do nó</strong>
        <button
          type="button"
          onClick={() => onChange([
            ...tags,
            {
              id: actionId('tag'),
              tag: 'novo_evento',
              label: 'Novo evento',
              mode: 'always',
              valueTemplate: '',
              metadataJson: '{}',
            },
          ])}
        >
          <Plus size={14} />
          Tag
        </button>
      </div>
      <div className="filter-empty">
        Salva métricas em uma coleção separada quando a conversa passar por este nó. Use <strong>uma vez</strong> para funil/conversão e <strong>sempre</strong> para contagem de passagem.
      </div>
      {tags.length === 0 && <div className="filter-empty">Nenhuma tag configurada neste nó.</div>}
      {tags.map((tag, index) => {
        const metadataError = tag.metadataJson ? getPlainJsonError(tag.metadataJson) : '';
        return (
          <div className="rich-card-editor" key={tag.id || index}>
            <div className="rich-card-header">
              <strong>Tag {index + 1}</strong>
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover tag"
                title="Remover tag"
                onClick={() => onChange(tags.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="inspector-grid-two">
              <label>
                Tag
                <input
                  value={tag.tag || ''}
                  placeholder="lead_qualificado"
                  onChange={(event) => updateTag(index, { tag: event.target.value })}
                />
              </label>
              <label>
                Nome para exibição
                <input
                  value={tag.label || ''}
                  placeholder="Lead qualificado"
                  onChange={(event) => updateTag(index, { label: event.target.value })}
                />
              </label>
            </div>
            <label>
              Frequência de gravação
              <select value={tag.mode || 'always'} onChange={(event) => updateTag(index, { mode: event.target.value as FlowNodeTagConfig['mode'] })}>
                <option value="once">Salvar uma vez por conversa neste nó</option>
                <option value="always">Salvar toda vez que passar por aqui</option>
              </select>
            </label>
            <label>
              Valor opcional
              <input
                value={tag.valueTemplate || ''}
                placeholder="{{context.slots.valor}}"
                onChange={(event) => updateTag(index, { valueTemplate: event.target.value })}
              />
            </label>
            <label>
              Metadados JSON
              <textarea
                rows={3}
                value={tag.metadataJson || '{}'}
                placeholder='{"canal":"{{context.channel}}"}'
                onChange={(event) => updateTag(index, { metadataJson: event.target.value })}
              />
            </label>
            {metadataError && <div className="field-error">JSON inválido: {metadataError}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ActionEditor({
  title,
  actions,
  onChange,
  maxActions = WHATSAPP_LIMITS.buttons,
}: {
  title: string;
  actions: RichMessageAction[];
  onChange: (actions: RichMessageAction[]) => void;
  maxActions?: number;
}) {
  return (
    <div className="rich-editor-block">
      <div className="filter-section-header">
        <strong>{title} ({actions.length}/{maxActions})</strong>
        <button
          type="button"
          disabled={actions.length >= maxActions}
          onClick={() => onChange([...actions, { id: actionId('action'), label: 'Opcao', value: 'opcao' }])}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
      {actions.length === 0 && <div className="filter-empty">Nenhuma opcao cadastrada.</div>}
      {actions.map((action, index) => (
        <div className="rich-action-row" key={action.id || index}>
          <input
            value={action.label || ''}
            placeholder="Texto do botão"
            maxLength={WHATSAPP_LIMITS.buttonLabel}
            onChange={(event) => {
              const next = [...actions];
              next[index] = { ...action, label: event.target.value };
              onChange(next);
            }}
          />
          <input
            value={action.value || ''}
            placeholder="Valor salvo/enviado"
            maxLength={WHATSAPP_LIMITS.buttonId}
            onChange={(event) => {
              const next = [...actions];
              next[index] = { ...action, value: event.target.value };
              onChange(next);
            }}
          />
          <input
            value={action.id || ''}
            placeholder="ID"
            maxLength={WHATSAPP_LIMITS.buttonId}
            onChange={(event) => {
              const next = [...actions];
              next[index] = { ...action, id: event.target.value };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="filter-icon-button"
            aria-label="Remover opcao"
            title="Remover opcao"
            onClick={() => onChange(actions.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ListEditor({
  sections,
  onChange,
}: {
  sections: RichMessageListSection[];
  onChange: (sections: RichMessageListSection[]) => void;
}) {
  const totalRows = sections.reduce((count, section) => count + (section.items || []).length, 0);
  const updateSection = (sectionIndex: number, patch: Partial<RichMessageListSection>) => {
    const next = [...sections];
    next[sectionIndex] = { ...next[sectionIndex], ...patch };
    onChange(next);
  };

  return (
    <div className="rich-editor-block">
      <div className="filter-section-header">
        <strong>Secoes da lista ({totalRows}/{WHATSAPP_LIMITS.listRows} itens)</strong>
        <button
          type="button"
          disabled={sections.length >= WHATSAPP_LIMITS.listSections}
          onClick={() => onChange([...sections, { title: 'Seção', items: [] }])}
        >
          <Plus size={14} />
          Seção
        </button>
      </div>
      {sections.length === 0 && <div className="filter-empty">Adicione uma secao com itens de lista.</div>}
      {sections.map((section, sectionIndex) => (
        <div className="rich-card-editor" key={sectionIndex}>
          <div className="rich-card-header">
            <input
              value={section.title || ''}
              placeholder="Título da secao"
              maxLength={WHATSAPP_LIMITS.sectionTitle}
              onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
            />
            <button
              type="button"
              className="filter-icon-button"
              aria-label="Remover secao"
              title="Remover secao"
              onClick={() => onChange(sections.filter((_, index) => index !== sectionIndex))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {(section.items || []).map((item, itemIndex) => (
            <div className="rich-list-item-row" key={item.id || itemIndex}>
              <input
                value={item.title || ''}
                placeholder="Item"
                maxLength={WHATSAPP_LIMITS.rowTitle}
                onChange={(event) => {
                  const nextItems = [...(section.items || [])];
                  nextItems[itemIndex] = { ...item, title: event.target.value };
                  updateSection(sectionIndex, { items: nextItems });
                }}
              />
              <input
                value={item.description || ''}
                placeholder="Descricao"
                maxLength={WHATSAPP_LIMITS.rowDescription}
                onChange={(event) => {
                  const nextItems = [...(section.items || [])];
                  nextItems[itemIndex] = { ...item, description: event.target.value };
                  updateSection(sectionIndex, { items: nextItems });
                }}
              />
              <input
                value={item.value || ''}
                placeholder="Valor"
                maxLength={WHATSAPP_LIMITS.rowId}
                onChange={(event) => {
                  const nextItems = [...(section.items || [])];
                  nextItems[itemIndex] = { ...item, value: event.target.value };
                  updateSection(sectionIndex, { items: nextItems });
                }}
              />
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover item"
                title="Remover item"
                onClick={() => updateSection(sectionIndex, { items: section.items.filter((_, index) => index !== itemIndex) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="filter-add-button"
            disabled={totalRows >= WHATSAPP_LIMITS.listRows}
            onClick={() => updateSection(sectionIndex, {
              items: [...(section.items || []), { id: actionId('item'), title: 'Item', value: 'item' }],
            })}
          >
            <Plus size={14} />
            Item
          </button>
        </div>
      ))}
    </div>
  );
}

function CarouselEditor({
  cards,
  onChange,
}: {
  cards: RichMessageCarouselCard[];
  onChange: (cards: RichMessageCarouselCard[]) => void;
}) {
  const updateCard = (cardIndex: number, patch: Partial<RichMessageCarouselCard>) => {
    const next = [...cards];
    next[cardIndex] = { ...next[cardIndex], ...patch };
    onChange(next);
  };

  return (
    <div className="rich-editor-block">
      <div className="filter-section-header">
        <strong>Cards do carrossel ({cards.length}/{WHATSAPP_LIMITS.carouselCards})</strong>
        <button
          type="button"
          disabled={cards.length >= WHATSAPP_LIMITS.carouselCards}
          onClick={() => onChange([...cards, { id: actionId('card'), title: 'Card', subtitle: '', imageUrl: '', buttons: [] }])}
        >
          <Plus size={14} />
          Card
        </button>
      </div>
      {cards.length === 0 && <div className="filter-empty">Adicione cards para o web widget.</div>}
      {cards.map((card, cardIndex) => (
        <div className="rich-card-editor" key={card.id || cardIndex}>
          <div className="rich-card-header">
            <strong>Card {cardIndex + 1}</strong>
            <button
              type="button"
              className="filter-icon-button"
              aria-label="Remover card"
              title="Remover card"
              onClick={() => onChange(cards.filter((_, index) => index !== cardIndex))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <input value={card.title || ''} maxLength={WHATSAPP_LIMITS.carouselCardTitle} placeholder="Título" onChange={(event) => updateCard(cardIndex, { title: event.target.value })} />
          <input value={card.subtitle || ''} maxLength={WHATSAPP_LIMITS.carouselCardSubtitle} placeholder="Subtítulo" onChange={(event) => updateCard(cardIndex, { subtitle: event.target.value })} />
          <input value={card.imageUrl || ''} maxLength={WHATSAPP_LIMITS.imageUrl} placeholder="URL da imagem" onChange={(event) => updateCard(cardIndex, { imageUrl: event.target.value })} />
          <ActionEditor
            title="Botões do card"
            actions={card.buttons || []}
            onChange={(buttons) => updateCard(cardIndex, { buttons })}
            maxActions={WHATSAPP_LIMITS.buttons}
          />
        </div>
      ))}
    </div>
  );
}

function AppointmentFlowEditor({
  appointmentFlow,
  flowConfig,
  currentFlowId,
  stepId,
  agentId,
  onChange,
}: {
  appointmentFlow?: NonNullable<FlowStep['richMessage']>['appointmentFlow'];
  flowConfig: FlowConfig;
  currentFlowId?: string;
  stepId?: string;
  agentId?: string;
  onChange: (config: NonNullable<FlowStep['richMessage']>['appointmentFlow']) => void;
}) {
  const [flowName, setFlowName] = useState('');
  const [flowPublishing, setFlowPublishing] = useState(false);
  const [flowPublishError, setFlowPublishError] = useState('');
  const [flowPublishResult, setFlowPublishResult] = useState('');
  const [showDataExamples, setShowDataExamples] = useState(false);
  const [fieldExampleKey, setFieldExampleKey] = useState<string>('');
  const [metaFlows, setMetaFlows] = useState<Array<Record<string, unknown>>>([]);
  const [loadingMetaFlows, setLoadingMetaFlows] = useState(false);
  const [metaFlowError, setMetaFlowError] = useState('');
  const [providerWhatsappReady, setProviderWhatsappReady] = useState(false);
  const [deletingMetaFlowId, setDeletingMetaFlowId] = useState('');
  const [baseStepToAdd, setBaseStepToAdd] = useState('');
  const current = { ...DEFAULT_APPOINTMENT_FLOW, ...(appointmentFlow || {}) };
  const update = (patch: Partial<typeof current>) => onChange({ ...current, ...patch });
  const attachmentSteps = (Array.isArray(current.attachmentSteps) ? current.attachmentSteps : [])
    .slice(0, 3)
    .map((step, index) => ({
      id: normalizeAppointmentAttachmentId(step.id || `anexo_${index + 1}`, index),
      label: repairMojibakeText(step.label || `Anexo ${index + 1}`),
      type: step.type === 'document' ? 'document' as const : 'image' as const,
      required: step.required !== false,
      description: repairMojibakeText(step.description || ''),
    }));
  const stepLabels = {
    ...DEFAULT_APPOINTMENT_FLOW.stepLabels,
    ...(current.stepLabels || {}),
  };
  for (const key of Object.keys(stepLabels)) {
    stepLabels[key] = repairMojibakeText(stepLabels[key]);
  }
  const stepOrder = normalizeAppointmentStepOrder(current.stepOrder, attachmentSteps);
  const availableBaseSteps = APPOINTMENT_FLOW_ORDER_BASE_STEPS.filter((step) => !stepOrder.includes(step.key));
  const whatsappCredentialsReady = Boolean(flowConfig.whatsapp?.businessAccountId && flowConfig.whatsapp?.accessToken) || providerWhatsappReady;
  useEffect(() => {
    let cancelled = false;
    const loadProviderWhatsappStatus = async () => {
      try {
        const result = await canvasApi.getProviderConfig({ agentId: agentId?.trim() || 'default-agent' });
        if (cancelled) return;
        const whatsapp = result.settings.whatsapp;
        setProviderWhatsappReady(Boolean(
          whatsapp?.provider === 'meta' &&
          whatsapp.businessAccountId &&
          (result.secretStatus?.['whatsapp.accessToken'] || whatsapp.accessToken)
        ));
      } catch {
        if (!cancelled) setProviderWhatsappReady(false);
      }
    };
    void loadProviderWhatsappStatus();
    window.addEventListener('canvas-flow-provider-config-updated', loadProviderWhatsappStatus);
    return () => {
      cancelled = true;
      window.removeEventListener('canvas-flow-provider-config-updated', loadProviderWhatsappStatus);
    };
  }, [agentId]);
  const loadMetaFlows = async () => {
    if (!whatsappCredentialsReady) {
      setMetaFlows([]);
      return;
    }
    setLoadingMetaFlows(true);
    setMetaFlowError('');
    try {
      const result = await canvasApi.listWhatsappFlows({
        whatsapp: flowConfig.whatsapp,
        agentId,
      });
      setMetaFlows(Array.isArray(result.flows) ? result.flows : []);
    } catch (error) {
      setMetaFlowError(error instanceof Error ? error.message : 'Não foi possível listar os WhatsApp Flows.');
    } finally {
      setLoadingMetaFlows(false);
    }
  };
  const deleteMetaFlow = async (flowId: string) => {
    const id = String(flowId || '').trim();
    if (!id) return;
    if (!window.confirm('Excluir ou desativar este WhatsApp Flow na Meta?')) return;
    setDeletingMetaFlowId(id);
    setMetaFlowError('');
    try {
      const result = await canvasApi.deleteWhatsappFlow(id, {
        whatsapp: flowConfig.whatsapp,
        agentId,
      });
      if (current.flowId === id) update({ flowId: '' });
      setFlowPublishResult(result.deprecated ? `Flow desativado: ${id}` : `Flow excluído: ${id}`);
      await loadMetaFlows();
    } catch (error) {
      setMetaFlowError(error instanceof Error ? error.message : 'Não foi possível excluir o Flow.');
    } finally {
      setDeletingMetaFlowId('');
    }
  };
  const renderFieldHelp = (key: string) => (
    <button
      type="button"
      className="field-help-button"
      title={`Ver exemplo de ${APPOINTMENT_FLOW_FIELD_EXAMPLES[key]?.title || 'campo'}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setFieldExampleKey((currentKey) => (currentKey === key ? '' : key));
      }}
    >
      ?
    </button>
  );
  const renderFieldExample = (key: string) => {
    const example = APPOINTMENT_FLOW_FIELD_EXAMPLES[key];
    if (fieldExampleKey !== key || !example) return null;
    return (
      <div className="appointment-field-example inline">
        <div>
          <strong>{example.title}</strong>
          <button
            type="button"
            title="Fechar exemplo"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setFieldExampleKey('');
            }}
          >
            <X size={14} />
          </button>
        </div>
        <span>{example.description}</span>
        <pre>{JSON.stringify(example.value, null, 2)}</pre>
      </div>
    );
  };
  const updateStepOrder = (nextOrder: string[]) => update({ stepOrder: normalizeAppointmentStepOrder(nextOrder, attachmentSteps) });
  const updateStepLabel = (key: string, label: string) => {
    update({ stepLabels: { ...stepLabels, [key]: label } });
  };
  const removeStepFromOrder = (key: string) => {
    if (stepOrder.length <= 1) return;
    if (key.startsWith('attachment:')) {
      const attachmentId = key.replace(/^attachment:/, '');
      updateAttachmentSteps(
        attachmentSteps.filter((step) => step.id !== attachmentId),
        stepOrder.filter((item) => item !== key),
      );
      return;
    }
    updateStepOrder(stepOrder.filter((item) => item !== key));
  };
  const addBaseStep = (key: string) => {
    if (!key || stepOrder.includes(key)) return;
    updateStepOrder([...stepOrder, key]);
    setBaseStepToAdd('');
  };
  const moveStepOrder = (index: number, direction: -1 | 1) => {
    const next = [...stepOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateStepOrder(next);
  };
  const updateAttachmentSteps = (nextAttachments: typeof attachmentSteps, nextOrder = stepOrder) => {
    const normalized = nextAttachments.slice(0, 3).map((step, index) => ({
      ...step,
      id: normalizeAppointmentAttachmentId(step.id, index),
      label: step.label || `Anexo ${index + 1}`,
    }));
    update({
      attachmentSteps: normalized,
      stepOrder: normalizeAppointmentStepOrder(nextOrder, normalized),
    });
  };
  const addAttachmentStep = () => {
    if (attachmentSteps.length >= 3) return;
    const index = attachmentSteps.length;
    const id = normalizeAppointmentAttachmentId(`anexo_${index + 1}`, index);
    const nextAttachment = {
      id,
      label: index === 0 ? 'Carteirinha de saúde' : index === 1 ? 'Pedido médico' : 'RG',
      type: 'image' as const,
      required: true,
      description: 'Anexe uma imagem legível.',
    };
    updateAttachmentSteps([...attachmentSteps, nextAttachment], [...stepOrder, appointmentAttachmentKey(id)]);
  };
  const persistAppointmentFlow = async (nextAppointmentFlow: typeof current) => {
    onChange(nextAppointmentFlow);
    if (!currentFlowId || !stepId) return false;
    const nextConfig: FlowConfig = {
      ...flowConfig,
      steps: flowConfig.steps.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          richMessage: {
            ...(step.richMessage || { type: 'appointmentFlow', text: '' }),
            appointmentFlow: nextAppointmentFlow,
          },
        };
      }),
    };
    await canvasApi.updateFlow(currentFlowId, { agentId, config: nextConfig });
    return true;
  };
  const renderStepDataEditor = (key: string) => {
    const meta = appointmentTemplateMeta(key);
    if (!meta) return null;
    return (
      <div className="appointment-step-data-field">
        <label>
          Label da etapa
          <input
            value={stepLabels[key] || meta.title}
            maxLength={30}
            placeholder={meta.title}
            onChange={(event) => updateStepLabel(key, event.target.value)}
          />
        </label>
        <label>
          <span className="field-label-with-help">
            <span>Dados dinâmicos ou fixos</span>
            {renderFieldHelp(meta.helpKey)}
          </span>
          <textarea
            rows={meta.rows}
            value={String(current[meta.valueKey] || '')}
            placeholder={meta.placeholder}
            onChange={(event) => update({ [meta.valueKey]: event.target.value })}
          />
        </label>
        {renderFieldExample(meta.helpKey)}
        {key === 'items' && (
          <div className="inspector-grid-two">
            <label>
              Filtro dos itens
              <input
                value={current.itemsFilterTemplate || ''}
                placeholder="{{context.slots.itemFilter}}"
                onChange={(event) => update({ itemsFilterTemplate: event.target.value })}
              />
              <span className="field-hint">Filtra por ID, título ou descrição antes de montar o Flow.</span>
            </label>
            <label>
              Máx. selecionados
              <input
                type="number"
                min={1}
                max={20}
                value={current.itemsMaxSelected ?? 20}
                onChange={(event) => update({ itemsMaxSelected: Number(event.target.value) })}
              />
              <span className="field-hint">Quantidade máxima que o usuário pode marcar neste passo.</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    void loadMetaFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowConfig.whatsapp?.businessAccountId, flowConfig.whatsapp?.accessToken, flowConfig.whatsapp?.graphApiVersion, agentId, providerWhatsappReady]);

  const createOrPublish = async (publish: boolean) => {
    setFlowPublishing(true);
    setFlowPublishError('');
    setFlowPublishResult('');
    try {
      const whatsapp = flowConfig.whatsapp;
      if (!whatsappCredentialsReady) {
        throw new Error('Configure WhatsApp Business Account ID e Access token em Provedores > WhatsApp.');
      }
      const name = flowName.trim() || `${flowConfig.title || 'Canvas Flow'} Agendamento`;
      if (current.flowId && publish) {
        const upload = await canvasApi.uploadWhatsappFlowJson(current.flowId, {
          whatsapp,
          agentId,
          title: current.headerText || 'Agendamento',
          appointmentFlow: {
            ...current,
            attachmentSteps,
            stepOrder,
            stepLabels,
          },
          introText: flowConfig.title ? `Agendamento - ${flowConfig.title}` : 'Escolha as opções para montar seu agendamento.',
        });
        const validationErrors = Array.isArray(upload.validationErrors) ? upload.validationErrors : [];
        if (validationErrors.length) {
          const details = formatWhatsappFlowValidationErrors(validationErrors);
          setFlowPublishError(`Flow atualizado, mas o JSON voltou com ${validationErrors.length} erro(s) de validação.${details ? `\n${details}` : ''}`);
          await loadMetaFlows();
          return;
        }
        const result = await canvasApi.publishWhatsappFlow(current.flowId, {
          whatsapp,
          agentId,
        });
        const nextAppointmentFlow = {
          ...current,
          attachmentSteps,
          stepOrder,
          stepLabels,
          mode: 'auto' as const,
        };
        const persisted = await persistAppointmentFlow(nextAppointmentFlow);
        setFlowPublishResult(`Flow publicado: ${String(result.flowId || current.flowId)}${persisted ? ' e salvo no Canvas.' : '. Clique em Salvar para persistir no Canvas.'}`);
        await loadMetaFlows();
        return;
      }
      const result = await canvasApi.createWhatsappFlow({
        name,
        categories: ['APPOINTMENT_BOOKING'],
        publish,
        whatsapp,
        agentId,
        title: current.headerText || 'Agendamento',
        appointmentFlow: {
          ...current,
          attachmentSteps,
          stepOrder,
          stepLabels,
        },
        introText: flowConfig.title ? `Agendamento - ${flowConfig.title}` : 'Escolha as opções para montar seu agendamento.',
      });
      const flowId = String(result.flowId || '');
      if (flowId) {
        await persistAppointmentFlow({
          ...current,
          flowId,
          mode: 'auto',
          attachmentSteps,
          stepOrder,
          stepLabels,
        });
      }
      const validationErrors = Array.isArray(result.validationErrors) ? result.validationErrors : [];
      if (validationErrors.length) {
        const details = formatWhatsappFlowValidationErrors(validationErrors);
        setFlowPublishError(`Flow criado, mas o JSON voltou com ${validationErrors.length} erro(s) de validação.${details ? `\n${details}` : ''}`);
      } else {
        setFlowPublishResult(publish ? `Flow criado, publicado e salvo no Canvas: ${flowId}` : `Rascunho criado e salvo no Canvas: ${flowId}`);
      }
      await loadMetaFlows();
    } catch (error) {
      setFlowPublishError(error instanceof Error ? error.message : 'Nao foi possivel criar/publicar o Flow.');
    } finally {
      setFlowPublishing(false);
    }
  };

  return (
    <div className="rich-editor-block">
      <div className="filter-section-header">
        <strong>WhatsApp Flow de agendamento</strong>
        <button
          type="button"
          title="Ver exemplos dos dados dinâmicos"
          onClick={() => setShowDataExamples((open) => !open)}
        >
          <Info size={14} />
          Exemplos
        </button>
      </div>
      <div className="filter-empty">
        API oficial envia Flow nativo quando houver Flow ID publicado. Blip e Sinch recebem uma lista interativa equivalente usando os mesmos dados dinâmicos.
      </div>
      {showDataExamples && (
        <div className="filter-empty">
          <strong>Formato esperado dos dados dinâmicos</strong>
          <pre>{JSON.stringify({
            providers: [
              { id: 'prestador_ana', title: 'Dra. Ana', description: 'Cardiologia' },
              { id: 'prestador_bruno', title: 'Dr. Bruno', description: 'Clínico geral' },
            ],
            services: [
              { id: 'consulta', title: 'Consulta', description: '30 min' },
              { id: 'retorno', title: 'Retorno', description: '15 min' },
            ],
            items: [
              { id: 'hemograma', title: 'Hemograma', description: 'Exame de sangue' },
              { id: 'tsh', title: 'TSH', description: 'Tireoide' },
              { id: 'glicemia', title: 'Glicemia', description: 'Jejum' },
            ],
            dates: [
              { id: '2026-05-20', title: '20/05/2026', description: 'Quarta-feira' },
              { id: '2026-05-21', title: '21/05/2026', description: 'Quinta-feira' },
            ],
            times: [
              { id: '09:00', title: '09:00', description: 'Manhã' },
              { id: '14:30', title: '14:30', description: 'Tarde' },
            ],
            appointments: [
              { id: 'ag_123', title: '20/05 às 09:00', description: 'Dra. Ana - Consulta' },
            ],
          }, null, 2)}</pre>
          <span>
            Você pode preencher esses campos com uma variável, por exemplo {'{{context.slots.providers}}'}, ou com um JSON direto. O componente também aceita itens com <code>label</code>, <code>name</code> ou <code>nome</code> no lugar de <code>title</code>.
          </span>
        </div>
      )}
      <div className="rich-editor-block nested">
        <div className="filter-section-header">
          <strong>Criar e publicar na Meta</strong>
          <button type="button" onClick={() => void loadMetaFlows()} disabled={!whatsappCredentialsReady || loadingMetaFlows}>
            {loadingMetaFlows ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            Atualizar
          </button>
        </div>
        <label>
          Nome do Flow
          <input
            value={flowName}
            placeholder={`${flowConfig.title || 'Canvas Flow'} Agendamento`}
            onChange={(event) => setFlowName(event.target.value)}
          />
        </label>
        <div className="filter-empty">
          Usa o WhatsApp Business Account ID e o Access token configurados em Provedores &gt; WhatsApp. Depois de criar, o Flow ID e gravado abaixo automaticamente.
        </div>
        <div className="meta-flow-manager">
          <label>
            Flow criado na Meta
            <select
              value={current.flowId || ''}
              onChange={(event) => update({ flowId: event.target.value, mode: event.target.value ? 'auto' : current.mode })}
              disabled={!whatsappCredentialsReady || loadingMetaFlows}
            >
              <option value="">{loadingMetaFlows ? 'Carregando flows...' : 'Selecionar flow criado'}</option>
              {metaFlows.map((flow) => {
                const id = String(flow.id || '');
                const name = String(flow.name || id);
                const status = String(flow.status || '');
                return (
                  <option key={id} value={id}>
                    {name}{status ? ` - ${status}` : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            className="danger-link"
            onClick={() => void deleteMetaFlow(current.flowId || '')}
            disabled={!current.flowId || deletingMetaFlowId === current.flowId}
            title="Excluir ou desativar o Flow selecionado na Meta"
          >
            <Trash2 size={14} />
            {deletingMetaFlowId === current.flowId ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
        {!whatsappCredentialsReady && (
          <div className="filter-empty">Configure Business Account ID e Access token em Provedores &gt; WhatsApp para listar os flows criados.</div>
        )}
        {metaFlowError && <div className="field-error">{metaFlowError}</div>}
        <div className="rich-action-row compact">
          <button type="button" onClick={() => void createOrPublish(false)} disabled={flowPublishing}>
            {flowPublishing ? 'Processando...' : 'Criar rascunho'}
          </button>
          <button type="button" className="primary-button" onClick={() => void createOrPublish(true)} disabled={flowPublishing}>
            {current.flowId ? 'Publicar Flow ID' : 'Criar e publicar'}
          </button>
        </div>
        {flowPublishResult && <div className="filter-empty success">{flowPublishResult}</div>}
        {flowPublishError && <div className="field-error">{flowPublishError}</div>}
      </div>
      <div className="rich-editor-block nested">
        <div className="filter-section-header">
          <strong>Formatar dados com LLM</strong>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={current.llmEnabled === true}
            onChange={(event) => update({ llmEnabled: event.target.checked })}
          />
          <span>Usar LLM para converter dados brutos no formato do Flow</span>
        </label>
        {current.llmEnabled === true && (
          <>
            <label>
              Dados de entrada para a LLM
              <textarea
                rows={3}
                value={current.llmSourceTemplate || ''}
                placeholder="{{context.slots.schedules}}"
                onChange={(event) => update({ llmSourceTemplate: event.target.value })}
              />
            </label>
            <label>
              Instrução da formatação
              <textarea
                rows={4}
                value={current.llmInstruction || ''}
                placeholder="Transforme a agenda bruta em providers, services, items, dates, times e appointments."
                onChange={(event) => update({ llmInstruction: event.target.value })}
              />
            </label>
            <div className="inspector-grid-two">
              <label>
                Modelo
                <select value={current.llmModel || ''} onChange={(event) => update({ llmModel: event.target.value })}>
                  <option value="">Usar modelo do fluxo ({flowConfig.model})</option>
                  {optionsWithCurrent(MODEL_OPTIONS, current.llmModel).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Temperatura
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={current.llmTemperature ?? 0.1}
                  onChange={(event) => update({ llmTemperature: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="filter-empty">
              Exemplo: a LLM recebe {'{{context.slots.schedules}}'} e retorna JSON com <code>providers</code>, <code>services</code>, <code>items</code>, <code>dates</code>, <code>times</code> e <code>appointments</code>. O runtime normaliza títulos, descrições e IDs para os limites do WhatsApp.
            </div>
          </>
        )}
      </div>
      <div className="inspector-grid-two">
        <label>
          Como enviar
          <select value={current.mode || 'auto'} onChange={(event) => update({ mode: event.target.value as typeof current.mode })}>
            <option value="auto">Automático: Flow se tiver ID, senão lista</option>
            <option value="metaFlow">Usar WhatsApp Flow da Meta</option>
            <option value="interactive">Usar lista/botões interativos</option>
          </select>
        </label>
        <label>
          Lista exibida agora
          <select value={current.stage || 'actions'} onChange={(event) => update({ stage: event.target.value as AppointmentFlowStage })}>
            {APPOINTMENT_FLOW_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-empty">
        <strong>Como enviar:</strong> controla se este nó usa o Flow publicado da Meta ou uma lista compatível com Blip/Sinch. <strong>Lista exibida agora:</strong> define qual conjunto de opções aparece neste passo quando o envio for por lista.
      </div>
      <label>
        Lista exibida por contexto
        <input
          value={current.stageTemplate || ''}
          placeholder="{{context.slots.appointmentStage}}"
          onChange={(event) => update({ stageTemplate: event.target.value })}
        />
      </label>
      <div className="filter-empty">
        Se esse campo retornar <code>providers</code>, <code>services</code>, <code>items</code>, <code>dates</code>, <code>times</code> ou <code>appointments</code>, ele sobrescreve a lista escolhida acima.
      </div>
      <div className="rich-editor-block nested">
        <div className="filter-section-header">
          <strong>Etapas do Flow</strong>
          <button type="button" onClick={addAttachmentStep} disabled={attachmentSteps.length >= 3}>
            <Plus size={14} />
            Anexo
          </button>
        </div>
        <div className="filter-empty">
          Ordene as telas que o WhatsApp Flow vai renderizar. Para começar direto em uma etapa, escolha a tela em <strong>Tela inicial</strong>; o Flow segue as próximas etapas desta ordem.
        </div>
        {availableBaseSteps.length > 0 && (
          <div className="appointment-add-step-row">
            <select
              value={baseStepToAdd || availableBaseSteps[0]?.key || ''}
              onChange={(event) => setBaseStepToAdd(event.target.value)}
            >
              {availableBaseSteps.map((step) => (
                <option key={step.key} value={step.key}>{stepLabels[step.key] || step.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => addBaseStep(baseStepToAdd || availableBaseSteps[0]?.key || '')}>
              <Plus size={14} />
              Etapa
            </button>
          </div>
        )}
        <div className="appointment-step-order-list">
          {stepOrder.map((key, index) => {
            const attachment = attachmentSteps.find((step) => appointmentAttachmentKey(step.id) === key);
            const attachmentIndex = attachment ? attachmentSteps.findIndex((step) => step.id === attachment.id) : -1;
            const isBaseStep = APPOINTMENT_FLOW_ORDER_BASE_STEPS.some((step) => step.key === key);
            return (
              <div className="appointment-step-order-row" key={key}>
                <div className="appointment-step-order-main">
                  <div className="appointment-step-order-title">
                    <div>
                      <strong>{index + 1}. {appointmentStepOrderLabel(key, attachmentSteps, stepLabels)}</strong>
                      <small>{appointmentStepScreenId(key, index)}</small>
                    </div>
                    <div className="appointment-step-order-actions">
                      <button type="button" aria-label="Subir etapa" onClick={() => moveStepOrder(index, -1)} disabled={index === 0}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" aria-label="Descer etapa" onClick={() => moveStepOrder(index, 1)} disabled={index === stepOrder.length - 1}>
                        <ArrowDown size={14} />
                      </button>
                      {(attachment || isBaseStep) && (
                        <button
                          type="button"
                          className="filter-icon-button"
                          aria-label="Remover etapa"
                          onClick={() => removeStepFromOrder(key)}
                          disabled={stepOrder.length <= 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {attachment && attachmentIndex >= 0 ? (
                    <div className="appointment-step-inline-editor">
                      <div className="rich-card-header">
                        <strong>Anexo {attachmentIndex + 1}</strong>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={attachment.required !== false}
                            onChange={(event) => {
                              const next = [...attachmentSteps];
                              next[attachmentIndex] = { ...attachment, required: event.target.checked };
                              updateAttachmentSteps(next);
                            }}
                          />
                          <span>Obrigatório</span>
                        </label>
                      </div>
                      <div className="inspector-grid-two">
                        <label>
                          Tipo
                          <select
                            value={attachment.type || 'image'}
                            onChange={(event) => {
                              const next = [...attachmentSteps];
                              next[attachmentIndex] = { ...attachment, type: event.target.value === 'document' ? 'document' : 'image' };
                              updateAttachmentSteps(next);
                            }}
                          >
                            <option value="image">Imagem</option>
                            <option value="document">Documento</option>
                          </select>
                        </label>
                        <label>
                          ID
                          <input
                            value={attachment.id}
                            placeholder={`anexo_${attachmentIndex + 1}`}
                            onChange={(event) => {
                              const previousKey = appointmentAttachmentKey(attachment.id);
                              const nextId = normalizeAppointmentAttachmentId(event.target.value, attachmentIndex);
                              const next = [...attachmentSteps];
                              next[attachmentIndex] = { ...attachment, id: nextId };
                              updateAttachmentSteps(next, stepOrder.map((item) => item === previousKey ? appointmentAttachmentKey(nextId) : item));
                            }}
                          />
                        </label>
                      </div>
                      <label>
                        Label
                        <input
                          value={attachment.label}
                          maxLength={30}
                          placeholder="Carteirinha de saúde"
                          onChange={(event) => {
                            const next = [...attachmentSteps];
                            next[attachmentIndex] = { ...attachment, label: event.target.value };
                            updateAttachmentSteps(next);
                          }}
                        />
                      </label>
                      <label>
                        Descrição
                        <input
                          value={attachment.description || ''}
                          maxLength={300}
                          placeholder="Envie uma imagem legível do documento."
                          onChange={(event) => {
                            const next = [...attachmentSteps];
                            next[attachmentIndex] = { ...attachment, description: event.target.value };
                            updateAttachmentSteps(next);
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    renderStepDataEditor(key)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="inspector-grid-two">
        <label>
          Flow ID Meta
          <input
            value={current.flowId || ''}
            placeholder="ID do Flow publicado"
            onChange={(event) => update({ flowId: event.target.value })}
          />
        </label>
        <label>
          CTA do Flow
          <input
            value={current.flowCta || ''}
            maxLength={WHATSAPP_LIMITS.buttonLabel}
            placeholder="Agendar"
            onChange={(event) => update({ flowCta: event.target.value })}
          />
        </label>
      </div>
      <div className="inspector-grid-two">
        <label>
          Token do Flow
          <input
            value={current.flowToken || ''}
            placeholder="{{context.conversationId}}"
            onChange={(event) => update({ flowToken: event.target.value })}
          />
        </label>
        <label>
          Tela inicial
          <select
            value={current.flowScreen || ''}
            onChange={(event) => update({ flowScreen: event.target.value })}
          >
            <option value="">Primeira etapa da ordem</option>
            {stepOrder.map((key, index) => {
              const screenId = appointmentStepScreenId(key, index);
              return (
                <option key={`${key}-${screenId}`} value={screenId}>
                  {appointmentStepOrderLabel(key, attachmentSteps, stepLabels)} ({screenId})
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="inspector-grid-two">
        <label>
          Header
          <input
            value={current.headerText || ''}
            placeholder="Agendamento"
            onChange={(event) => update({ headerText: event.target.value })}
          />
        </label>
        <label>
          Botao da lista
          <input
            value={current.buttonText || ''}
            maxLength={WHATSAPP_LIMITS.listButton}
            placeholder="Ver opções"
            onChange={(event) => update({ buttonText: event.target.value })}
          />
        </label>
      </div>
      <div className="filter-empty">
        Os campos de dados aceitam array JSON, string JSON ou variável {'{{context.slots...}}'}. Cada item pode usar id, title/label/name e description.
      </div>
    </div>
  );
}

function LineNumberedCodeTextarea({
  language,
  value,
  placeholder,
  rows,
  error,
  fill = false,
  readOnly = false,
  onChange,
}: {
  language: 'json' | 'js';
  value: string;
  placeholder: string;
  rows: number;
  error?: string;
  fill?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbers = useMemo(() => {
    const total = Math.max(String(value || '').split('\n').length, rows);
    return Array.from({ length: total }, (_, index) => index + 1);
  }, [rows, value]);
  const highlighted = useMemo(() => {
    if (value) return highlightCode(value, language);
    return `<span class="code-placeholder">${escapeHtml(placeholder)}</span>`;
  }, [language, placeholder, value]);

  useEffect(() => {
    if (!readOnly) return;
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
    }
    setScrollOffset({ top: 0, left: 0 });
  }, [readOnly, value]);

  return (
    <div className={`code-editor-shell ${fill ? 'fill' : ''} ${error ? 'invalid' : ''}`}>
      <div className="code-editor-gutter" aria-hidden="true">
        <div style={{ transform: `translateY(-${scrollOffset.top}px)` }}>
          {lineNumbers.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
      <div
        className={`code-editor-main ${readOnly ? 'readonly' : ''}`}
        onScroll={readOnly
          ? (event) => setScrollOffset({
            top: event.currentTarget.scrollTop,
            left: event.currentTarget.scrollLeft,
          })
          : undefined}
      >
        {readOnly ? (
          <pre
            className="code-editor-highlight code-editor-static"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <>
            <pre
              aria-hidden="true"
              className="code-editor-highlight"
              style={{ transform: `translate(-${scrollOffset.left}px, -${scrollOffset.top}px)` }}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
            <textarea
              ref={textareaRef}
              className="code-editor-textarea"
              rows={rows}
              spellCheck={false}
              value={value}
              onScroll={(event) => setScrollOffset({
                top: event.currentTarget.scrollTop,
                left: event.currentTarget.scrollLeft,
              })}
              onChange={(event) => onChange(event.target.value)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function CodeEditorField({
  label,
  language,
  value,
  placeholder,
  rows,
  error,
  onChange,
  onOpen,
}: {
  label: string;
  language: string;
  value: string;
  placeholder: string;
  rows: number;
  error?: string;
  onChange: (value: string) => void;
  onOpen: () => void;
}) {
  return (
    <div className="code-editor-field">
      <div className="code-editor-header">
        <strong>{label}</strong>
        <div>
          <span>{language}</span>
          <button type="button" onClick={onOpen}>
            <Maximize2 size={14} />
            Abrir editor
          </button>
        </div>
      </div>
      <LineNumberedCodeTextarea
        language={language === 'JSON' ? 'json' : 'js'}
        rows={rows}
        error={error}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
      {error && <div className="code-editor-error">{error}</div>}
    </div>
  );
}

function ContextScriptAiPanel({
  title = 'Gerar JS com LLM',
  placeholder = 'Ex: pegue context.slots.carrinho, calcule subtotal, desconto e retorne {pedido: {...}, total: ...}',
  prompt,
  generatedCode,
  generatedExplanation,
  error,
  loading,
  copied,
  onPromptChange,
  onGenerate,
  onCopy,
  onApply,
}: {
  title?: string;
  placeholder?: string;
  prompt: string;
  generatedCode: string;
  generatedExplanation: string;
  error: string;
  loading: boolean;
  copied: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onApply: () => void;
}) {
  return (
    <div className="context-script-ai">
      <div className="filter-section-header">
        <strong>{title}</strong>
        <button type="button" disabled={loading || !prompt.trim()} onClick={onGenerate}>
          {loading ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
          Gerar
        </button>
      </div>
      <textarea
        rows={3}
        value={prompt}
        placeholder={placeholder}
        onChange={(event) => onPromptChange(event.target.value)}
      />
      {error && <div className="code-editor-error">{error}</div>}
      {generatedCode && (
        <div className="context-script-result">
          <div className="filter-section-header">
            <strong>Código gerado</strong>
            <div className="context-script-actions">
              <button type="button" onClick={onCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                Copiar
              </button>
              <button type="button" onClick={onApply}>
                Aplicar no editor
              </button>
            </div>
          </div>
          {generatedExplanation && <div className="filter-empty">{generatedExplanation}</div>}
          <LineNumberedCodeTextarea
            language="js"
            rows={8}
            value={generatedCode}
            placeholder=""
            readOnly
            onChange={() => undefined}
          />
        </div>
      )}
    </div>
  );
}

function MongoConfigAiPanel({
  prompt,
  generated,
  error,
  loading,
  copied,
  onPromptChange,
  onGenerate,
  onCopy,
  onApply,
}: {
  prompt: string;
  generated: Record<string, unknown> | null;
  error: string;
  loading: boolean;
  copied: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onApply: () => void;
}) {
  const payload = getMongoGeneratedPayload(generated);
  const generatedText = payload ? JSON.stringify(payload, null, 2) : '';
  return (
    <div className="context-script-ai">
      <div className="filter-section-header">
        <strong>Gerar MongoDB com LLM</strong>
        <button type="button" disabled={loading || !prompt.trim()} onClick={onGenerate}>
          {loading ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
          Gerar
        </button>
      </div>
      <textarea
        rows={3}
        value={prompt}
        placeholder="Ex: gere um filtro para buscar leads convertidos hoje pelo agentId atual, ordenando por createdAt desc"
        onChange={(event) => onPromptChange(event.target.value)}
      />
      {error && <div className="code-editor-error">{error}</div>}
      {payload && (
        <div className="context-script-result">
          <div className="filter-section-header">
            <strong>JSON gerado</strong>
            <div className="context-script-actions">
              <button type="button" onClick={onCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                Copiar
              </button>
              <button type="button" onClick={onApply}>
                Aplicar campos
              </button>
            </div>
          </div>
          {typeof generated?.explanation === 'string' && generated.explanation && (
            <div className="filter-empty">{generated.explanation}</div>
          )}
          <LineNumberedCodeTextarea
            language="json"
            rows={8}
            value={generatedText}
            placeholder=""
            readOnly
            onChange={() => undefined}
          />
        </div>
      )}
    </div>
  );
}

function FieldAiButton({ onClick, title = 'Gerar com LLM' }: { onClick: () => void; title?: string }) {
  return (
    <button type="button" className="prompt-field-ai-button" title={title} onClick={onClick}>
      <Wand2 size={13} />
    </button>
  );
}

type ContextEditorModal = 'json' | 'js' | null;
type PromptFieldKind = 'instruction' | 'agentsMd' | 'guardrails' | 'blockedTerms' | 'mcpDescription' | 'mcpInstruction';
type PromptFieldTarget = 'global-agent' | 'agent-node' | 'mcp-node' | 'flow-node';
type PromptFieldAssistantState = {
  fieldType: PromptFieldKind;
  targetType: PromptFieldTarget;
  title: string;
  label: string;
  currentValue: string;
  placeholder: string;
  applyText: (value: string) => void;
  stepContext?: Record<string, unknown>;
} | null;

const MCP_MODE_OPTIONS: Array<{ value: McpMode; title: string; description: string }> = [
  {
    value: 'fields',
    title: 'Montar campos',
    description: 'A IA transforma contexto em JSON para usar nos próximos nós.',
  },
  {
    value: 'api',
    title: 'Chamar API',
    description: 'A IA monta argumentos/body e o Canvas chama um endpoint permitido.',
  },
  {
    value: 'external',
    title: 'Servidor MCP',
    description: 'Conecta em um servidor MCP remoto e chama tools, resources ou prompts.',
  },
];

function getMcpPresetPatch(mode: McpMode): Partial<NonNullable<FlowStep['component']>> {
  if (mode === 'api') {
    return {
      mcpMode: 'api',
      responseName: 'consultaCliente',
      mcpToolName: 'consultar_cliente',
      mcpToolDescription: 'Consulta dados do cliente em uma API externa usando CPF ou identificador recebido no fluxo.',
      mcpInstruction: 'Use os dados do contexto para montar a chamada. Depois normalize a resposta no output schema, sem inventar dados.',
      mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "cpf": { "type": "string", "description": "CPF do cliente" }\n  },\n  "required": ["cpf"]\n}',
      mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "encontrado": { "type": "boolean" },\n    "nome": { "type": "string" },\n    "maiorIdade": { "type": "boolean" },\n    "status": { "type": "string" }\n  }\n}',
      mcpApiMethod: 'POST',
      mcpApiBaseUrl: 'https://api.exemplo.com/clientes/consulta',
      mcpApiHeadersJson: '{}',
      mcpApiQueryJson: '{}',
      mcpApiBodyJson: '{\n  "cpf": "{{context.slots.cpf}}"\n}',
      mcpApiAuthMode: 'none',
      mcpApiAllowLlmRequest: true,
      mcpApiMapResultWithLlm: true,
      mcpApiExecute: true,
      mcpApiCallMode: 'single',
      mcpApiExecutionMode: 'sequential',
      mcpApiRequestsJson: getMcpMultiApiExample('consultaCliente'),
      mcpMergeOutputToSlots: false,
    };
  }
  if (mode === 'external') {
    return {
      mcpMode: 'external',
      responseName: 'mcpCliente',
      mcpToolName: 'buscar_cliente_mcp',
      mcpToolDescription: 'Chama uma tool de um servidor MCP remoto e normaliza o retorno para o fluxo.',
      mcpInstruction: 'Use os dados do contexto para montar os argumentos da tool. Normalize o retorno no output schema.',
      mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "cpf": { "type": "string" }\n  },\n  "required": ["cpf"]\n}',
      mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "encontrado": { "type": "boolean" },\n    "nome": { "type": "string" },\n    "documento": { "type": "string" },\n    "resumo": { "type": "string" }\n  }\n}',
      mcpExternalTransport: 'streamable_http',
      mcpExternalUrl: 'https://mcp.exemplo.com/mcp',
      mcpExternalOperation: 'callTool',
      mcpExternalToolName: 'buscar_cliente',
      mcpExternalArgumentsJson: '{\n  "cpf": "{{context.slots.cpf}}"\n}',
      mcpExternalHeadersJson: '{}',
      mcpExternalAuthMode: 'none',
      mcpExternalOAuthConnectionScope: 'agent',
      mcpExternalUseLlmArguments: true,
      mcpExternalMapResultWithLlm: true,
      mcpExternalTimeoutMs: 30000,
      mcpMergeOutputToSlots: false,
    };
  }
  return {
    mcpMode: 'fields',
    responseName: 'camposCliente',
    mcpToolName: 'montar_campos_cliente',
    mcpToolDescription: 'Monta campos estruturados para o fluxo com base no contexto da conversa.',
    mcpInstruction: 'Extraia e normalize os campos disponíveis no contexto. Retorne somente o JSON do output schema.',
    mcpInputSchema: '{\n  "type": "object",\n  "properties": {\n    "input": { "type": "string" },\n    "cpf": { "type": "string" }\n  }\n}',
    mcpOutputSchema: '{\n  "type": "object",\n  "properties": {\n    "cpf": { "type": "string" },\n    "intencao": { "type": "string" },\n    "resumo": { "type": "string" }\n  }\n}',
    mcpMergeOutputToSlots: false,
  };
}

function ConditionalFilterEditor({
  rules,
  draft,
  emptyText,
  onChange,
  onDraftChange,
}: {
  rules: ExtraFieldsFilterRule[];
  draft: FilterDraft;
  emptyText: string;
  onChange: (rules: ExtraFieldsFilterRule[]) => void;
  onDraftChange: (draft: FilterDraft) => void;
}) {
  const safeRules = Array.isArray(rules) ? rules : [];

  const updateRule = (index: number, patch: Partial<ExtraFieldsFilterRule>) => {
    const next = [...safeRules];
    next[index] = { ...(next[index] || { field: '', value: '' }), ...patch };
    onChange(next.filter((rule) => String(rule.field || '').trim()));
  };

  const addDraftFilter = () => {
    const field = draft.field.trim();
    if (!field) return;
    onChange([
      ...safeRules,
      {
        field,
        value: parseFilterValue(draft.type, draft.value),
        condition: String(draft.condition || '').trim(),
      },
    ]);
    onDraftChange(EMPTY_FILTER_DRAFT);
  };

  return (
    <div className="filter-editor conditional-filter-editor">
      {safeRules.length === 0 && <div className="filter-empty">{emptyText}</div>}
      {safeRules.map((rule, index) => {
        const type = inferFilterType(rule.value);
        const rawValue = stringifyFilterValue(rule.value);
        return (
          <div className="conditional-filter-row" key={index}>
            <input
              aria-label="Campo extraFields"
              value={rule.field || ''}
              placeholder="Campo"
              onChange={(event) => updateRule(index, { field: event.target.value.trim() })}
            />
            <select
              aria-label="Tipo do filtro"
              value={type}
              onChange={(event) => updateRule(index, {
                value: parseFilterValue(event.target.value as FilterValueType, rawValue),
              })}
            >
              <option value="text">Texto</option>
              <option value="number">Numero</option>
              <option value="boolean">Booleano</option>
              <option value="array">Lista</option>
            </select>
            <FilterValueControl
              type={type}
              value={rawValue}
              onChange={(nextValue) => updateRule(index, { value: parseFilterValue(type, nextValue) })}
            />
            <input
              aria-label="Condicao JS do filtro"
              value={rule.condition || ''}
              placeholder="Condicao JS opcional"
              onChange={(event) => updateRule(index, { condition: event.target.value })}
            />
            <button
              type="button"
              className="filter-icon-button"
              aria-label="Remover filtro"
              title="Remover filtro"
              onClick={() => onChange(safeRules.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <div className="conditional-filter-row conditional-filter-row-new">
        <input
          value={draft.field}
          placeholder="Campo"
          onChange={(event) => onDraftChange({ ...draft, field: event.target.value })}
        />
        <select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as FilterValueType })}>
          <option value="text">Texto</option>
          <option value="number">Numero</option>
          <option value="boolean">Booleano</option>
          <option value="array">Lista</option>
        </select>
        <FilterValueControl
          type={draft.type}
          value={draft.value}
          onChange={(value) => onDraftChange({ ...draft, value })}
        />
        <input
          value={draft.condition || ''}
          placeholder="context.slots.ano == 2026"
          onChange={(event) => onDraftChange({ ...draft, condition: event.target.value })}
        />
        <button type="button" className="filter-add-button" onClick={addDraftFilter} disabled={!draft.field.trim()}>
          <Plus size={14} />
          Add
        </button>
      </div>
      <div className="filter-empty">
        Condicao vazia aplica sempre. Exemplo: <code>context.slots.ano == 2026</code>.
      </div>
    </div>
  );
}

function createLawRagConditionalRules(): RagConditionalRule[] {
  return [
    {
      id: `rag_if_default_${Date.now()}`,
      condition: '',
      extraFieldsFilterPerRoundExpression: '[{ relevante: true }, { relevante: undefined }]',
      extraFieldsFilterPerRoundLimitsExpression: '[15, 15]',
      roundStopFind: false,
      roundMixHalf: true,
    },
    {
      id: `rag_if_ano_${Date.now() + 1}`,
      condition: 'context?.slots?.extraFieldsFilter?.obterAnoFinanceiroPrioritario == true',
      extraFieldsFilterPerRoundExpression: '[{ ano: 2026 }, { ano: 2025 }]',
      roundStopFind: false,
      roundMixHalf: true,
    },
    {
      id: `rag_if_ultima_${Date.now() + 2}`,
      condition: 'context?.slots?.extraFieldsFilter?.intentUltimaLei == true || context?.slots?.extraFieldsFilter?.ultimaLei == true',
      extraFieldsFilterPerRoundExpression: '[{ ano: 2026 }, { ano: 2025 }]',
      extraFieldsFilterPerRoundLimitsExpression: 'undefined',
      roundStopFind: false,
      roundMixHalf: true,
      order: 'desc',
      extraFieldsFilterOrderByExpression: '["numero"]',
      metadataOrderScanPageSize: 1000,
      metadataOrderMaxScan: 20000,
    },
    {
      id: `rag_if_filter_${Date.now() + 3}`,
      condition: '(context?.slots?.extraFieldsFilter?.ano || context?.slots?.extraFieldsFilter?.numero) && !context?.slots?.extraFieldsFilter?.intentUltimaLei && !context?.slots?.extraFieldsFilter?.obterAnoFinanceiroPrioritario',
      extraFieldsFilterExpression: 'context?.slots?.extraFieldsFilter',
    },
  ];
}

function RagConditionalRulesEditor({
  rules,
  onChange,
}: {
  rules?: RagConditionalRule[];
  onChange: (rules: RagConditionalRule[]) => void;
}) {
  const safeRules = Array.isArray(rules) ? rules : [];
  const updateRule = (index: number, patch: Partial<RagConditionalRule>) => {
    const next = [...safeRules];
    next[index] = { ...(next[index] || {}), ...patch };
    onChange(next);
  };
  const addRule = () => {
    onChange([
      ...safeRules,
      {
        id: `rag_if_${Date.now()}`,
        condition: '',
      },
    ]);
  };
  const setBooleanPatch = (value: string): boolean | null | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  };
  const setNumberPatch = (value: string): number | null => {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <div className="filter-section rag-conditional-section">
      <div className="filter-section-header">
        <strong>IF RAG</strong>
        <div className="rag-conditional-actions">
          <button type="button" onClick={() => onChange([...safeRules, ...createLawRagConditionalRules()])}>
            Exemplo leis
          </button>
          <button type="button" onClick={addRule}>
            <Plus size={14} />
            IF
          </button>
        </div>
      </div>
      {safeRules.length === 0 && <div className="filter-empty">Sem IF RAG. Use para trocar prompt, filtros e ordem por condicao.</div>}
      <div className="rag-conditional-list">
        {safeRules.map((rule, index) => (
          <div className="rag-conditional-card" key={rule.id || index}>
            <div className="rag-conditional-card-header">
              <strong>IF #{index + 1}</strong>
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover IF RAG"
                title="Remover IF RAG"
                onClick={() => onChange(safeRules.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <label>
              Condicao do IF
              <input
                value={rule.condition || ''}
                placeholder="context?.slots?.extraFieldsFilter?.intentUltimaLei == true"
                onChange={(event) => updateRule(index, { condition: event.target.value })}
              />
            </label>
            <label>
              Prompt override
              <textarea
                rows={4}
                value={rule.prompt || ''}
                placeholder="Opcional. Se preencher, este prompt substitui o Prompt RAG quando o IF bater."
                onChange={(event) => updateRule(index, { prompt: event.target.value })}
              />
            </label>
            <div className="rag-conditional-grid">
              <label>
                extraFieldsFilter (JS)
                <textarea
                  rows={3}
                  value={rule.extraFieldsFilterExpression || ''}
                  placeholder="context?.slots?.extraFieldsFilter"
                  onChange={(event) => updateRule(index, { extraFieldsFilterExpression: event.target.value })}
                />
              </label>
              <label>
                extraFieldsFilterPerRound (JS)
                <textarea
                  rows={3}
                  value={rule.extraFieldsFilterPerRoundExpression || ''}
                  placeholder="[{ ano: 2026 }, { ano: 2025 }]"
                  onChange={(event) => updateRule(index, { extraFieldsFilterPerRoundExpression: event.target.value })}
                />
              </label>
              <label>
                extraFieldsFilterPerRoundLimits (JS)
                <input
                  value={rule.extraFieldsFilterPerRoundLimitsExpression || ''}
                  placeholder="[15, 15] ou undefined"
                  onChange={(event) => updateRule(index, { extraFieldsFilterPerRoundLimitsExpression: event.target.value })}
                />
              </label>
              <label>
                extraFieldsFilterOrderBy (JS)
                <input
                  value={rule.extraFieldsFilterOrderByExpression || ''}
                  placeholder={'["numero"]'}
                  onChange={(event) => updateRule(index, { extraFieldsFilterOrderByExpression: event.target.value })}
                />
              </label>
            </div>
            <div className="rag-conditional-meta-grid">
              <label>
                roundStopFind
                <select
                  value={rule.roundStopFind === true ? 'true' : rule.roundStopFind === false ? 'false' : ''}
                  onChange={(event) => updateRule(index, { roundStopFind: setBooleanPatch(event.target.value) })}
                >
                  <option value="">herdar</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label>
                roundMixHalf
                <select
                  value={rule.roundMixHalf === true ? 'true' : rule.roundMixHalf === false ? 'false' : ''}
                  onChange={(event) => updateRule(index, { roundMixHalf: setBooleanPatch(event.target.value) })}
                >
                  <option value="">herdar</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label>
                order
                <select
                  value={rule.order || ''}
                  onChange={(event) => updateRule(index, { order: event.target.value as RagConditionalRule['order'] })}
                >
                  <option value="">herdar</option>
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
              </label>
              <label>
                scan page
                <input
                  type="number"
                  min={0}
                  value={rule.metadataOrderScanPageSize ?? ''}
                  placeholder="1000"
                  onChange={(event) => updateRule(index, { metadataOrderScanPageSize: setNumberPatch(event.target.value) })}
                />
              </label>
              <label>
                max scan
                <input
                  type="number"
                  min={0}
                  value={rule.metadataOrderMaxScan ?? ''}
                  placeholder="20000"
                  onChange={(event) => updateRule(index, { metadataOrderMaxScan: setNumberPatch(event.target.value) })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type McpSchemaField = {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'enum';
  required: boolean;
  enumValues: string;
  description: string;
};

const MCP_SCHEMA_FIELD_TYPES: McpSchemaField['type'][] = ['string', 'number', 'integer', 'boolean', 'enum', 'object', 'array'];

function parseMcpSchemaFields(schemaText?: string): McpSchemaField[] {
  try {
    const schema = JSON.parse(String(schemaText || '{}'));
    const properties = schema?.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? schema.properties
      : {};
    const required = new Set(Array.isArray(schema?.required) ? schema.required.map((item: unknown) => String(item)) : []);
    return Object.entries(properties).map(([name, config]) => {
      const fieldConfig = config && typeof config === 'object' && !Array.isArray(config)
        ? config as Record<string, unknown>
        : {};
      const rawType = String(fieldConfig.type || 'string') as McpSchemaField['type'];
      const hasEnum = Array.isArray(fieldConfig.enum);
      const enumList = hasEnum ? fieldConfig.enum as unknown[] : [];
      const enumText = typeof fieldConfig['x-canvas-enumText'] === 'string'
        ? String(fieldConfig['x-canvas-enumText'])
        : enumList.map((item) => String(item)).join(', ');
      return {
        name,
        type: hasEnum && rawType === 'string' ? 'enum' : MCP_SCHEMA_FIELD_TYPES.includes(rawType) ? rawType : 'string',
        required: required.has(name),
        enumValues: enumText,
        description: String(fieldConfig.description || ''),
      };
    });
  } catch {
    return [];
  }
}

function createMcpSchemaField(existing: McpSchemaField[], prefix: string): McpSchemaField {
  const usedNames = new Set(existing.map((field) => field.name));
  let index = existing.length + 1;
  let name = `${prefix}${index}`;
  while (usedNames.has(name)) {
    index += 1;
    name = `${prefix}${index}`;
  }
  return {
    name,
    type: 'string',
    required: false,
    enumValues: '',
    description: '',
  };
}

function normalizeMcpEnumValues(rawValues: string, type: McpSchemaField['type']): Array<string | number | boolean> {
  const values = rawValues
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length || type === 'object' || type === 'array') return [];
  if (type === 'boolean') {
    return values
      .map((value) => {
        const normalized = value.toLowerCase();
        if (normalized === 'true' || normalized === 'verdadeiro' || normalized === 'sim') return true;
        if (normalized === 'false' || normalized === 'falso' || normalized === 'nao' || normalized === 'não') return false;
        return undefined;
      })
      .filter((value): value is boolean => typeof value === 'boolean');
  }
  if (type === 'number' || type === 'integer') {
    return values
      .map((value) => Number(value.replace(',', '.')))
      .filter((value) => Number.isFinite(value))
      .map((value) => (type === 'integer' ? Math.trunc(value) : value));
  }
  return values;
}

function buildMcpSchema(fields: McpSchemaField[]) {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  fields.forEach((field) => {
    const name = field.name.trim();
    if (!name) return;
    const enumValues = normalizeMcpEnumValues(field.enumValues, field.type);
    const rawEnumText = field.enumValues || '';
    const rawDescription = field.description || '';
    properties[name] = {
      type: field.type === 'enum' ? 'string' : field.type || 'string',
      ...(rawDescription ? { description: rawDescription } : {}),
      ...(enumValues.length ? { enum: enumValues } : {}),
      ...(rawEnumText ? { 'x-canvas-enumText': rawEnumText } : {}),
      ...(field.type === 'array' ? { items: { type: 'string' } } : {}),
    };
    if (field.required) required.push(name);
  });
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };
  if (required.length) schema.required = required;
  return JSON.stringify(schema, null, 2);
}

type McpExternalArgumentField = {
  path: string;
  type: string;
  required: boolean;
  description: string;
};

function getMcpExternalSchemaType(schema: Record<string, unknown>): string {
  const type = String(schema.type || (schema.properties ? 'object' : 'any'));
  if (type === 'array') {
    const items = schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)
      ? schema.items as Record<string, unknown>
      : {};
    return `array<${getMcpExternalSchemaType(items)}>`;
  }
  return Array.isArray(schema.enum) && schema.enum.length ? `${type} enum` : type;
}

function listMcpExternalArgumentFields(
  schema?: Record<string, unknown>,
  prefix = '',
  parentRequired = true,
): McpExternalArgumentField[] {
  const properties = schema?.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {};
  const required = new Set(Array.isArray(schema?.required) ? schema.required.map((item) => String(item)) : []);

  return Object.entries(properties).flatMap(([name, rawSchema]) => {
    const fieldSchema = rawSchema && typeof rawSchema === 'object' && !Array.isArray(rawSchema)
      ? rawSchema as Record<string, unknown>
      : {};
    const path = prefix ? `${prefix}.${name}` : name;
    const fieldRequired = parentRequired && required.has(name);
    const itemSchema = fieldSchema.type === 'array'
      && fieldSchema.items
      && typeof fieldSchema.items === 'object'
      && !Array.isArray(fieldSchema.items)
      ? fieldSchema.items as Record<string, unknown>
      : undefined;
    const nestedSchema = itemSchema || fieldSchema;
    const nestedFields = nestedSchema.properties
      ? listMcpExternalArgumentFields(nestedSchema, itemSchema ? `${path}[]` : path, fieldRequired)
      : [];

    return [{
      path,
      type: getMcpExternalSchemaType(fieldSchema),
      required: fieldRequired,
      description: String(fieldSchema.description || ''),
    }, ...nestedFields];
  });
}

function buildMcpExternalArgumentsTemplate(schema?: Record<string, unknown>) {
  const buildValue = (fieldSchema: unknown, path: string): unknown => {
    const config = fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema)
      ? fieldSchema as Record<string, unknown>
      : {};
    const properties = config.properties && typeof config.properties === 'object' && !Array.isArray(config.properties)
      ? config.properties as Record<string, unknown>
      : {};
    if (config.type === 'object' && Object.keys(properties).length) {
      return Object.fromEntries(Object.entries(properties).map(([name, childSchema]) => [
        name,
        buildValue(childSchema, `${path}.${name}`),
      ]));
    }
    if (config.type === 'array') {
      return [`{{context.slots.${path}}}`];
    }
    return `{{context.slots.${path}}}`;
  };
  const properties = schema?.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {};
  return JSON.stringify(Object.fromEntries(Object.entries(properties).map(([name, fieldSchema]) => [
    name,
    buildValue(fieldSchema, name),
  ])), null, 2);
}

function stringifyMcpSchema(schema?: Record<string, unknown>) {
  return JSON.stringify(schema && typeof schema === 'object' && !Array.isArray(schema) ? schema : {}, null, 2);
}

function getMcpMultiApiExample(responseName = 'consultaCliente') {
  return JSON.stringify([
    {
      id: 'cliente',
      label: 'Buscar cliente',
      method: 'POST',
      url: 'https://api.exemplo.com/clientes/consulta',
      body: {
        cpf: '{{context.slots.cpf}}',
      },
    },
    {
      id: 'endereco',
      label: 'Buscar endereco',
      method: 'GET',
      url: 'https://api.exemplo.com/enderecos/{{context.slots.' + responseName + '.resultsById.cliente.data.enderecoId}}',
      params: {
        clienteId: '{{context.slots.' + responseName + '.resultsById.cliente.data.id}}',
      },
    },
  ], null, 2);
}

function parseMcpApiRequestsJson(value?: string): Array<Record<string, unknown>> {
  const parsed = parseJson(String(value || '[]'), []);
  const parsedObject = cleanObject(parsed);
  const source: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsedObject.requests)
      ? parsedObject.requests
      : [];
  return source
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((request, index) => ({
      ...request,
      id: String(request.id || request.key || `request_${index + 1}`),
      label: String(request.label || request.title || `Chamada ${index + 1}`),
    }));
}

function stringifyMcpApiRequests(requests: Array<Record<string, unknown>>) {
  return JSON.stringify(requests, null, 2);
}

function createMcpApiRequest(existing: Array<Record<string, unknown>>, idHint = 'api'): Record<string, unknown> {
  const usedIds = new Set(existing.map((request) => String(request.id || '')));
  const baseId = idHint.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'api';
  let index = existing.length + 1;
  let id = usedIds.has(baseId) ? `${baseId}_${index}` : baseId;
  while (usedIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }
  return {
    id,
    label: `Chamada ${index}`,
    method: 'GET',
    url: 'https://api.exemplo.com/recurso',
    headers: {},
    params: {},
    bodyType: 'none',
  };
}

function McpApiRequestsEditor({
  requests,
  responseName,
  executionMode,
  onChange,
  onUseExample,
}: {
  requests: Array<Record<string, unknown>>;
  responseName: string;
  executionMode: McpApiExecutionMode;
  onChange: (requests: Array<Record<string, unknown>>) => void;
  onUseExample: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, FilterDraft>>({});
  const [jsonBodyDrafts, setJsonBodyDrafts] = useState<Record<string, string>>({});
  const safeRequests = Array.isArray(requests) ? requests : [];
  const updateDraft = (key: string, draft: FilterDraft) => setDrafts((current) => ({ ...current, [key]: draft }));
  const updateRequest = (index: number, patch: Record<string, unknown>) => {
    const next = [...safeRequests];
    next[index] = { ...(next[index] || createMcpApiRequest(safeRequests)), ...patch };
    onChange(next);
  };
  const removeRequest = (index: number) => onChange(safeRequests.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="mcp-api-requests-editor">
      <div className="filter-section-header">
        <div>
          <strong>Chamadas da API ({safeRequests.length})</strong>
          <span>{executionMode === 'parallel' ? 'Executadas ao mesmo tempo.' : 'Executadas na ordem da lista.'}</span>
        </div>
        <div className="mcp-api-editor-actions">
          <button type="button" onClick={onUseExample}>
            <Wand2 size={14} />
            Exemplo
          </button>
          <button type="button" onClick={() => onChange([...safeRequests, createMcpApiRequest(safeRequests)])}>
            <Plus size={14} />
            API
          </button>
        </div>
      </div>
      {safeRequests.length === 0 && (
        <div className="filter-empty">Nenhuma API configurada. Clique em API para adicionar uma chamada.</div>
      )}
      {safeRequests.map((request, index) => {
        const bodyType = inferHttpBodyType(request);
        const bodyValue = request.body !== undefined ? request.body : request.data;
        const id = String(request.id || `request_${index + 1}`);
        const label = String(request.label || `Chamada ${index + 1}`);
        return (
          <div className="http-request-card mcp-api-call-card" key={`${id}-${index}`}>
            <div className="http-request-header">
              <div>
                <strong>{label}</strong>
                <span>{id}</span>
              </div>
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover API"
                title="Remover API"
                onClick={() => removeRequest(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mcp-api-call-meta">
              <label>
                ID da chamada
                <input
                  value={id}
                  placeholder="cliente"
                  onChange={(event) => updateRequest(index, { id: event.target.value })}
                />
              </label>
              <label>
                Nome
                <input
                  value={label}
                  placeholder="Buscar cliente"
                  onChange={(event) => updateRequest(index, { label: event.target.value })}
                />
              </label>
            </div>
            <div className="http-request-grid">
              <label>
                Método
                <select
                  value={String(request.method || 'GET').toUpperCase()}
                  onChange={(event) => updateRequest(index, { method: event.target.value })}
                >
                  {HTTP_METHOD_OPTIONS.map((method) => (
                    <option value={method} key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label>
                URL
                <input
                  value={String(request.url || '')}
                  placeholder={index > 0 && executionMode !== 'parallel'
                    ? `https://api.exemplo.com/enderecos/{{context.slots.${responseName}.resultsById.cliente.data.enderecoId}}`
                    : 'https://api.exemplo.com/clientes'}
                  onChange={(event) => updateRequest(index, { url: event.target.value })}
                />
              </label>
            </div>
            {index > 0 && executionMode !== 'parallel' && (
              <div className="filter-empty">
                Pode usar resultados anteriores, por exemplo <code>{`{{context.slots.${responseName}.resultsById.cliente.data.id}}`}</code>.
              </div>
            )}
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Headers</strong>
              </div>
              <FilterEditor
                filter={cleanObject(request.headers)}
                draft={drafts[`mcp-headers-${index}`] || EMPTY_FILTER_DRAFT}
                emptyText="Sem headers."
                onDraftChange={(draft) => updateDraft(`mcp-headers-${index}`, draft)}
                onChange={(headers) => updateRequest(index, { headers })}
              />
            </div>
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Query params</strong>
              </div>
              <FilterEditor
                filter={cleanObject(request.params)}
                draft={drafts[`mcp-params-${index}`] || EMPTY_FILTER_DRAFT}
                emptyText="Sem query params."
                onDraftChange={(draft) => updateDraft(`mcp-params-${index}`, draft)}
                onChange={(params) => updateRequest(index, { params })}
              />
            </div>
            <label>
              Body
              <select
                value={bodyType}
                onChange={(event) => {
                  const nextType = event.target.value as HttpBodyType;
                  if (nextType === 'none') updateRequest(index, { bodyType: nextType, body: undefined, data: undefined });
                  if (nextType === 'jsonFields') updateRequest(index, { bodyType: nextType, body: cleanObject(bodyValue), data: undefined });
                  if (nextType === 'jsonText') {
                    const nextText = stringifyBodyJson(bodyValue);
                    setJsonBodyDrafts((current) => ({ ...current, [index]: nextText }));
                    updateRequest(index, { bodyType: nextType, body: parseJson(nextText, cleanObject(bodyValue)), data: undefined });
                  }
                  if (nextType === 'text') updateRequest(index, { bodyType: nextType, body: typeof bodyValue === 'string' ? bodyValue : '', data: undefined });
                }}
              >
                {HTTP_BODY_TYPES.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {bodyType === 'jsonFields' && (
              <div className="filter-section">
                <div className="filter-section-header">
                  <strong>Campos do body</strong>
                </div>
                <FilterEditor
                  filter={cleanObject(bodyValue)}
                  draft={drafts[`mcp-body-${index}`] || EMPTY_FILTER_DRAFT}
                  emptyText="Sem campos no body."
                  onDraftChange={(draft) => updateDraft(`mcp-body-${index}`, draft)}
                  onChange={(body) => updateRequest(index, { body, data: undefined, bodyType })}
                />
              </div>
            )}
            {bodyType === 'jsonText' && (
              <label>
                JSON do body
                <textarea
                  rows={6}
                  value={jsonBodyDrafts[index] ?? stringifyBodyJson(bodyValue)}
                  placeholder='{"cpf": "{{context.slots.cpf}}"}'
                  onChange={(event) => setJsonBodyDrafts((current) => ({ ...current, [index]: event.target.value }))}
                  onBlur={() => {
                    const raw = jsonBodyDrafts[index] ?? stringifyBodyJson(bodyValue);
                    updateRequest(index, { body: parseJson(raw, cleanObject(bodyValue)), data: undefined, bodyType });
                  }}
                />
              </label>
            )}
            {bodyType === 'text' && (
              <label>
                Texto do body
                <textarea
                  rows={4}
                  value={String(bodyValue || '')}
                  placeholder="Conteúdo bruto enviado no body"
                  onChange={(event) => updateRequest(index, { body: event.target.value, data: undefined, bodyType })}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

function McpSchemaBuilder({
  title,
  helper,
  fields,
  emptyLabel,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  helper: string;
  fields: McpSchemaField[];
  emptyLabel: string;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<McpSchemaField>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mcp-schema-card">
      <div className="filter-section-header">
        <div>
          <strong>{title}</strong>
          <span>{helper}</span>
        </div>
        <button type="button" onClick={onAdd}>
          <Plus size={14} />
          Campo
        </button>
      </div>
      {fields.length === 0 ? (
        <div className="filter-empty">{emptyLabel}</div>
      ) : (
        <div className="mcp-schema-fields">
          {fields.map((field, index) => (
            <div className="mcp-schema-row" key={`mcp-schema-field-${index}`}>
              <label>
                Campo
                <input
                  value={field.name}
                  placeholder="cpf"
                  onChange={(event) => onUpdate(index, { name: event.target.value })}
                />
              </label>
              <label>
                Tipo
                <select
                  value={field.type}
                  onChange={(event) => onUpdate(index, { type: event.target.value as McpSchemaField['type'] })}
                >
                  {MCP_SCHEMA_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Opções
                <input
                  value={field.enumValues}
                  placeholder="Ex: pendente, aprovado"
                  onBeforeInput={stopEditorEvent}
                  onKeyDownCapture={stopEditorEvent}
                  onKeyDown={stopEditorEvent}
                  onKeyUpCapture={stopEditorEvent}
                  onKeyUp={stopEditorEvent}
                  onChange={(event) => onUpdate(index, { enumValues: event.target.value })}
                />
              </label>
              <label>
                Descrição
                <input
                  value={field.description}
                  placeholder="Ajuda a IA a preencher corretamente"
                  onBeforeInput={stopEditorEvent}
                  onKeyDownCapture={stopEditorEvent}
                  onKeyDown={stopEditorEvent}
                  onKeyUpCapture={stopEditorEvent}
                  onKeyUp={stopEditorEvent}
                  onChange={(event) => onUpdate(index, { description: event.target.value })}
                />
              </label>
              <label className="mcp-required-toggle">
                Obrigatório
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) => onUpdate(index, { required: event.target.checked })}
                />
              </label>
              <button
                type="button"
                className="filter-icon-button"
                aria-label="Remover campo"
                onClick={() => onRemove(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Inspector({
  config,
  selectedStep,
  selectedEdge,
  flows = [],
  currentFlowId = '',
  agentId = '',
  onUpdateConfig,
  onUpdateStep,
  onUpdateEdge,
  onRefreshCronLog,
  canRefreshCronLog,
}: InspectorProps) {
  const [extraFilterDraft, setExtraFilterDraft] = useState<FilterDraft>(EMPTY_FILTER_DRAFT);
  const [roundFilterDrafts, setRoundFilterDrafts] = useState<Record<number, FilterDraft>>({});
  const [contextEditorModal, setContextEditorModal] = useState<ContextEditorModal>(null);
  const [edgeConditionEditorOpen, setEdgeConditionEditorOpen] = useState(false);
  const [edgeConditionPrompt, setEdgeConditionPrompt] = useState('');
  const [edgeConditionGenerating, setEdgeConditionGenerating] = useState(false);
  const [edgeConditionGenerated, setEdgeConditionGenerated] = useState('');
  const [edgeConditionGeneratedExplanation, setEdgeConditionGeneratedExplanation] = useState('');
  const [edgeConditionGenerateError, setEdgeConditionGenerateError] = useState('');
  const [edgeConditionCopied, setEdgeConditionCopied] = useState(false);
  const [contextScriptPrompt, setContextScriptPrompt] = useState('');
  const [contextScriptGenerating, setContextScriptGenerating] = useState(false);
  const [contextScriptGenerated, setContextScriptGenerated] = useState('');
  const [contextScriptGeneratedExplanation, setContextScriptGeneratedExplanation] = useState('');
  const [contextScriptGenerateError, setContextScriptGenerateError] = useState('');
  const [contextScriptCopied, setContextScriptCopied] = useState(false);
  const [mongoAiPrompt, setMongoAiPrompt] = useState('');
  const [mongoAiGenerating, setMongoAiGenerating] = useState(false);
  const [mongoAiGenerated, setMongoAiGenerated] = useState<Record<string, unknown> | null>(null);
  const [mongoAiError, setMongoAiError] = useState('');
  const [mongoAiCopied, setMongoAiCopied] = useState(false);
  const [flowRouterAgents, setFlowRouterAgents] = useState<CanvasFlowAgentRecord[]>([]);
  const [flowRouterAgentsError, setFlowRouterAgentsError] = useState('');
  const [flowRouterFlowsByAgent, setFlowRouterFlowsByAgent] = useState<Record<string, CanvasFlowRecord[]>>({});
  const [flowRouterLoadingByAgent, setFlowRouterLoadingByAgent] = useState<Record<string, boolean>>({});
  const [llmProviderStatus, setLlmProviderStatus] = useState<LlmProviderConfigStatus>({
    loading: true,
    error: '',
    configured: {},
  });
  const [mcpOAuthStatus, setMcpOAuthStatus] = useState<McpOAuthStatus | null>(null);
  const [mcpOAuthLoading, setMcpOAuthLoading] = useState(false);
  const [mcpOAuthMessage, setMcpOAuthMessage] = useState('');
  const [mcpOAuthAuthorizationUrl, setMcpOAuthAuthorizationUrl] = useState('');
  const [mcpExternalTools, setMcpExternalTools] = useState<McpExternalTool[]>([]);
  const [mcpExternalToolsLoading, setMcpExternalToolsLoading] = useState(false);
  const [mcpExternalToolsError, setMcpExternalToolsError] = useState('');
  const [mcpExternalToolsMessage, setMcpExternalToolsMessage] = useState('');
  const [mcpPresetHelpId, setMcpPresetHelpId] = useState<string | null>(null);
  const [filesUploading, setFilesUploading] = useState(false);
  const [filesUploadError, setFilesUploadError] = useState('');
  const [quickRuleName, setQuickRuleName] = useState('');
  const [quickRuleText, setQuickRuleText] = useState('');
  const [agentManifestTab, setAgentManifestTab] = useState<AgentManifestTab>('skills');
  const [promptFieldAssistant, setPromptFieldAssistant] = useState<PromptFieldAssistantState>(null);
  const [promptFieldObjective, setPromptFieldObjective] = useState('');
  const [promptFieldModel, setPromptFieldModel] = useState(config.model || '');
  const [promptFieldGenerating, setPromptFieldGenerating] = useState(false);
  const [promptFieldGenerated, setPromptFieldGenerated] = useState('');
  const [promptFieldExplanation, setPromptFieldExplanation] = useState('');
  const [promptFieldError, setPromptFieldError] = useState('');
  const [promptFieldCopied, setPromptFieldCopied] = useState(false);
  const currentAgentId = agentId.trim() || 'default-agent';
  const selectedLlmProvider = (config.llmProvider || 'openai') as FlowLlmProvider;

  const modelOptions = useMemo(() => {
    return optionsWithCurrent(getLlmModelOptionsForProvider(selectedLlmProvider), config.model);
  }, [config.model, selectedLlmProvider]);

  const openPromptFieldAssistant = (state: PromptFieldAssistantState, suggestedObjective = '', model = config.model || '') => {
    if (!state) return;
    setPromptFieldAssistant(state);
    setPromptFieldObjective(suggestedObjective);
    setPromptFieldModel(model || config.model || '');
    setPromptFieldGenerated('');
    setPromptFieldExplanation('');
    setPromptFieldError('');
    setPromptFieldCopied(false);
  };

  const closePromptFieldAssistant = () => {
    if (promptFieldGenerating) return;
    setPromptFieldAssistant(null);
    setPromptFieldGenerated('');
    setPromptFieldExplanation('');
    setPromptFieldError('');
    setPromptFieldCopied(false);
  };

  const promptFieldModelOptions = useMemo(
    () => optionsWithCurrent(getLlmModelOptionsForProvider(selectedLlmProvider), promptFieldModel || config.model),
    [config.model, promptFieldModel, selectedLlmProvider],
  );

  const generatePromptField = async () => {
    if (!promptFieldAssistant || !promptFieldObjective.trim() || promptFieldGenerating) return;
    setPromptFieldGenerating(true);
    setPromptFieldError('');
    setPromptFieldCopied(false);
    try {
      const result = await canvasApi.generatePromptField({
        fieldType: promptFieldAssistant.fieldType,
        targetType: promptFieldAssistant.targetType,
        objective: promptFieldObjective,
        currentValue: promptFieldAssistant.currentValue,
        currentConfig: config,
        stepContext: promptFieldAssistant.stepContext,
        model: promptFieldModel || config.model,
        llmProvider: selectedLlmProvider,
        flowId: currentFlowId,
        agentId: currentAgentId,
      });
      setPromptFieldGenerated(result.text || '');
      setPromptFieldExplanation(result.explanation || '');
    } catch (error) {
      setPromptFieldError(error instanceof Error ? error.message : 'Nao foi possivel gerar este campo.');
    } finally {
      setPromptFieldGenerating(false);
    }
  };

  const copyGeneratedPromptField = async () => {
    if (!promptFieldGenerated) return;
    await navigator.clipboard.writeText(promptFieldGenerated);
    setPromptFieldCopied(true);
    window.setTimeout(() => setPromptFieldCopied(false), 1800);
  };

  const applyGeneratedPromptField = () => {
    if (!promptFieldAssistant || !promptFieldGenerated) return;
    promptFieldAssistant.applyText(promptFieldGenerated);
    closePromptFieldAssistant();
  };

  const renderPromptFieldAssistantModal = () => (
    promptFieldAssistant && (
      <div className="modal-backdrop prompt-field-assistant-backdrop" onMouseDown={closePromptFieldAssistant}>
        <div className="prompt-field-assistant-modal" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div>
              <strong>{promptFieldAssistant.title}</strong>
              <span>{promptFieldAssistant.label}</span>
            </div>
            <button type="button" onClick={closePromptFieldAssistant} disabled={promptFieldGenerating}>
              <X size={16} />
              Fechar
            </button>
          </div>
          <div className="prompt-field-assistant-body">
            <section className="prompt-field-assistant-compose">
              <label>
                Modelo
                <select value={promptFieldModel} onChange={(event) => setPromptFieldModel(event.target.value)}>
                  {promptFieldModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Objetivo deste campo
                <textarea
                  rows={5}
                  value={promptFieldObjective}
                  placeholder={promptFieldAssistant.placeholder}
                  onChange={(event) => setPromptFieldObjective(event.target.value)}
                />
              </label>
              <div className="filter-empty">
                A IA vai gerar apenas este campo. Use Agents.md para papel/arquitetura, Guardrails para limites, Termos bloqueados para tripwires e MCP para contrato de ferramenta.
              </div>
              <button type="button" onClick={() => void generatePromptField()} disabled={promptFieldGenerating || !promptFieldObjective.trim()}>
                {promptFieldGenerating ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
                Gerar
              </button>
            </section>
            <section className="prompt-field-assistant-result">
              <div className="filter-section-header">
                <strong>Resultado</strong>
                <div className="context-script-actions">
                  <button type="button" onClick={() => void copyGeneratedPromptField()} disabled={!promptFieldGenerated}>
                    {promptFieldCopied ? <Check size={14} /> : <Copy size={14} />}
                    Copiar
                  </button>
                  <button type="button" onClick={applyGeneratedPromptField} disabled={!promptFieldGenerated}>
                    Aplicar no campo
                  </button>
                </div>
              </div>
              {promptFieldError && <div className="code-editor-error">{promptFieldError}</div>}
              {promptFieldExplanation && <div className="filter-empty">{promptFieldExplanation}</div>}
              <textarea
                rows={14}
                value={promptFieldGenerated}
                placeholder="O texto gerado aparece aqui."
                readOnly
              />
            </section>
          </div>
        </div>
      </div>
    )
  );

  useEffect(() => {
    setEdgeConditionEditorOpen(false);
    setEdgeConditionPrompt('');
    setEdgeConditionGenerated('');
    setEdgeConditionGeneratedExplanation('');
    setEdgeConditionGenerateError('');
    setEdgeConditionCopied(false);
  }, [selectedEdge?.id]);

  useEffect(() => {
    setQuickRuleName('');
    setQuickRuleText('');
  }, [selectedStep?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadProviderStatus = async () => {
      setLlmProviderStatus((current) => ({ ...current, loading: true, error: '' }));
      try {
        const result = await canvasApi.getProviderConfig({ agentId: currentAgentId });
        if (cancelled) return;
        const providers: FlowLlmProvider[] = ['openai', 'azure_openai', 'gemini', 'claude', 'grok', 'bedrock'];
        setLlmProviderStatus({
          loading: false,
          error: '',
          configured: Object.fromEntries(providers.map((provider) => [
            provider,
            isFlowProviderConfigured(provider, result.settings, result.secretStatus),
          ])) as Partial<Record<FlowLlmProvider, boolean>>,
        });
      } catch (error) {
        if (cancelled) return;
        setLlmProviderStatus((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Não foi possível verificar os provedores.',
        }));
      }
    };

    void loadProviderStatus();
    window.addEventListener('canvas-flow-provider-config-updated', loadProviderStatus);
    return () => {
      cancelled = true;
      window.removeEventListener('canvas-flow-provider-config-updated', loadProviderStatus);
    };
  }, [currentAgentId]);

  const selectedStepComponent = selectedStep?.component;
  const selectedMcpMode = selectedStepComponent?.type === 'mcp'
    ? selectedStepComponent.mcpMode || 'fields'
    : 'fields';
  const selectedMcpExternalUrl = selectedStepComponent?.type === 'mcp'
    ? String(selectedStepComponent.mcpExternalUrl || '').trim()
    : '';
  const selectedMcpExternalAuthMode = selectedStepComponent?.type === 'mcp'
    ? selectedStepComponent.mcpExternalAuthMode || 'none'
    : 'none';
  const selectedMcpExternalOAuthConnectionScope = selectedStepComponent?.type === 'mcp'
    ? selectedStepComponent.mcpExternalOAuthConnectionScope || 'agent'
    : 'agent';
  const selectedMcpExternalTransport = selectedStepComponent?.type === 'mcp'
    ? selectedStepComponent.mcpExternalTransport || 'streamable_http'
    : 'streamable_http';
  const selectedMcpExternalOAuthReady = selectedMcpExternalAuthMode !== 'oauth' || mcpOAuthStatus?.connected === true;
  useEffect(() => {
    setMcpExternalTools([]);
    setMcpExternalToolsError('');
    setMcpExternalToolsMessage('');
  }, [
    selectedStep?.id,
    selectedMcpExternalAuthMode,
    selectedMcpExternalOAuthConnectionScope,
    selectedMcpExternalTransport,
    selectedMcpExternalUrl,
    selectedStepComponent?.mcpExternalAuthHeaderName,
    selectedStepComponent?.mcpExternalAuthQueryParam,
    selectedStepComponent?.mcpExternalAuthSecret,
    selectedStepComponent?.mcpExternalHeadersJson,
  ]);
  const flowRouterRuleConfig = selectedStepComponent?.type === 'flowRouter'
    ? selectedStepComponent.flowRouterRules || []
    : [];
  const flowRouterFallbackAgentId = selectedStepComponent?.type === 'flowRouter'
    ? selectedStepComponent.flowRouterFallbackAgentId || ''
    : '';
  const flowRouterAgentOptions = useMemo(() => {
    const getAgentId = (agent: CanvasFlowAgentRecord) => String(agent.agentId || agent.name || '').trim();
    const byId = new Map<string, CanvasFlowAgentRecord>();
    flowRouterAgents.forEach((agent) => byId.set(getAgentId(agent), agent));
    byId.set(currentAgentId, byId.get(currentAgentId) || { agentId: currentAgentId, name: currentAgentId, flowCount: flows.length });
    flowRouterRuleConfig.forEach((rule) => {
      const targetAgentId = String(rule.targetAgentId || '').trim();
      if (targetAgentId && !byId.has(targetAgentId)) {
        byId.set(targetAgentId, { agentId: targetAgentId, name: targetAgentId, flowCount: 0 });
      }
    });
    if (flowRouterFallbackAgentId && !byId.has(flowRouterFallbackAgentId)) {
      byId.set(flowRouterFallbackAgentId, { agentId: flowRouterFallbackAgentId, name: flowRouterFallbackAgentId, flowCount: 0 });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentAgentId, flowRouterAgents, flowRouterFallbackAgentId, flowRouterRuleConfig, flows.length]);
  const flowRouterNeededAgentIds = useMemo(() => {
    const ids = new Set<string>([currentAgentId]);
    flowRouterRuleConfig.forEach((rule) => {
      const targetAgentId = String(rule.targetAgentId || '').trim();
      if (targetAgentId) ids.add(targetAgentId);
    });
    if (flowRouterFallbackAgentId) ids.add(flowRouterFallbackAgentId);
    return Array.from(ids);
  }, [currentAgentId, flowRouterFallbackAgentId, flowRouterRuleConfig]);
  const flowRouterNeededAgentIdsKey = flowRouterNeededAgentIds.join('|');

  useEffect(() => {
    setFlowRouterFlowsByAgent((current) => {
      const existing = current[currentAgentId] || [];
      const sameFlows = existing.length === flows.length && existing.every((flow, index) => flow._id === flows[index]?._id);
      if (sameFlows) return current;
      return { ...current, [currentAgentId]: flows };
    });
    setFlowRouterLoadingByAgent((current) => (
      current[currentAgentId] ? { ...current, [currentAgentId]: false } : current
    ));
  }, [currentAgentId, flows]);

  useEffect(() => {
    if (selectedStepComponent?.type !== 'flowRouter') return;
    let cancelled = false;
    setFlowRouterAgentsError('');
    canvasApi.listAgents()
      .then((nextAgents) => {
        if (!cancelled) setFlowRouterAgents(nextAgents);
      })
      .catch((error) => {
        if (!cancelled) setFlowRouterAgentsError(error instanceof Error ? error.message : 'Não foi possível carregar os agentes.');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStep?.id, selectedStepComponent?.type]);

  useEffect(() => {
    if (selectedStepComponent?.type !== 'flowRouter') return;
    let cancelled = false;
    const missingAgentIds = flowRouterNeededAgentIds.filter((targetAgentId) => (
      targetAgentId
      && targetAgentId !== currentAgentId
      && !flowRouterFlowsByAgent[targetAgentId]
    ));
    if (!missingAgentIds.length) return;

    missingAgentIds.forEach((targetAgentId) => {
      setFlowRouterLoadingByAgent((current) => ({ ...current, [targetAgentId]: true }));
      canvasApi.listFlows(targetAgentId)
        .then((nextFlows) => {
          if (!cancelled) {
            setFlowRouterFlowsByAgent((current) => ({ ...current, [targetAgentId]: nextFlows }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFlowRouterFlowsByAgent((current) => ({ ...current, [targetAgentId]: [] }));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setFlowRouterLoadingByAgent((current) => ({ ...current, [targetAgentId]: false }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [currentAgentId, flowRouterFlowsByAgent, flowRouterNeededAgentIds, flowRouterNeededAgentIdsKey, selectedStepComponent?.type]);

  const getFlowRouterAgentId = useCallback((targetAgentId?: string) => {
    return String(targetAgentId || '').trim() || currentAgentId;
  }, [currentAgentId]);

  const getFlowRouterOptions = useCallback((targetAgentId?: string) => {
    const scopedAgentId = getFlowRouterAgentId(targetAgentId);
    const source = flowRouterFlowsByAgent[scopedAgentId] || (scopedAgentId === currentAgentId ? flows : []);
    return source.filter((flow) => flow._id !== currentFlowId);
  }, [currentAgentId, currentFlowId, flowRouterFlowsByAgent, flows, getFlowRouterAgentId]);

  const hasFlowRouterOption = useCallback((flowId?: string, targetAgentId?: string) => {
    const id = String(flowId || '').trim();
    if (!id) return false;
    return getFlowRouterOptions(targetAgentId).some((flow) => flow._id === id);
  }, [getFlowRouterOptions]);

  const formatExternalFlowOption = useCallback((flowId: string, targetAgentId?: string) => {
    const scopedAgentId = getFlowRouterAgentId(targetAgentId);
    return `Fluxo fora de ${scopedAgentId} (${flowId.slice(0, 8)}...)`;
  }, [getFlowRouterAgentId]);

  const loadMcpOAuthStatus = useCallback(async (options?: { silent?: boolean }) => {
    const shouldLoad = selectedStepComponent?.type === 'mcp'
      && selectedMcpMode === 'external'
      && selectedMcpExternalAuthMode === 'oauth'
      && Boolean(selectedMcpExternalUrl);
    if (!shouldLoad) {
      setMcpOAuthStatus(null);
      setMcpOAuthAuthorizationUrl('');
      return null;
    }
    if (!options?.silent) setMcpOAuthLoading(true);
    try {
      const result = await canvasApi.getMcpOAuthStatus({
        serverUrl: selectedMcpExternalUrl,
        agentId: currentAgentId,
        connectionScope: selectedMcpExternalOAuthConnectionScope,
      });
      setMcpOAuthStatus(result);
      setMcpOAuthAuthorizationUrl(result.authorizationUrl || '');
      if (result.error) setMcpOAuthMessage(result.error);
      return result;
    } catch (error) {
      setMcpOAuthStatus(null);
      setMcpOAuthMessage(error instanceof Error ? error.message : 'Nao foi possivel verificar o OAuth MCP.');
      return null;
    } finally {
      if (!options?.silent) setMcpOAuthLoading(false);
    }
  }, [currentAgentId, selectedMcpExternalAuthMode, selectedMcpExternalOAuthConnectionScope, selectedMcpExternalUrl, selectedMcpMode, selectedStepComponent?.type]);

  useEffect(() => {
    setMcpOAuthMessage('');
    if (selectedStepComponent?.type !== 'mcp' || selectedMcpMode !== 'external' || selectedMcpExternalAuthMode !== 'oauth' || !selectedMcpExternalUrl) {
      setMcpOAuthStatus(null);
      return;
    }
    void loadMcpOAuthStatus();
  }, [loadMcpOAuthStatus, selectedMcpExternalAuthMode, selectedMcpExternalUrl, selectedMcpMode, selectedStep?.id, selectedStepComponent?.type]);

  useEffect(() => {
    if (selectedStepComponent?.type !== 'mcp' || selectedMcpMode !== 'external' || selectedMcpExternalAuthMode !== 'oauth') return;
    if (mcpOAuthStatus?.status !== 'pending' || !mcpOAuthStatus.authorizationUrl) return;
    const intervalId = window.setInterval(() => {
      void loadMcpOAuthStatus({ silent: true });
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [loadMcpOAuthStatus, mcpOAuthStatus?.authorizationUrl, mcpOAuthStatus?.status, selectedMcpExternalAuthMode, selectedMcpMode, selectedStepComponent?.type]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; status?: string } | null;
      if (!payload || payload.type !== 'canvas-flow-mcp-oauth') return;
      if (payload.status === 'ok') setMcpOAuthAuthorizationUrl('');
      setMcpOAuthMessage(payload.status === 'ok'
        ? 'OAuth MCP conectado. O no ja pode executar chamadas autenticadas.'
        : 'OAuth MCP retornou erro. Verifique a conexao e tente novamente.');
      void loadMcpOAuthStatus({ silent: false });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadMcpOAuthStatus]);

  const openMcpOAuthPopup = (authorizationUrl: string, popupWindow?: Window | null) => {
    const target = `canvas-flow-mcp-oauth-${Date.now()}`;
    if (popupWindow && !popupWindow.closed) {
      popupWindow.location.href = authorizationUrl;
      popupWindow.focus();
      return popupWindow;
    }
    return window.open(authorizationUrl, target, 'width=720,height=760');
  };

  const handleMcpOAuthStartResult = (result: McpOAuthStatus, resetBeforeStart = false, popupWindow?: Window | null) => {
    setMcpOAuthStatus(result);
    setMcpOAuthAuthorizationUrl(result.authorizationUrl || '');
    if (result.authorizationUrl) {
      const popup = openMcpOAuthPopup(result.authorizationUrl, popupWindow);
      setMcpOAuthMessage(popup
        ? resetBeforeStart
          ? 'Cache OAuth limpo. Autorize o servidor MCP na janela aberta.'
          : 'Autorize o servidor MCP na janela aberta. Esta tela atualiza quando o callback voltar.'
        : 'O navegador bloqueou a janela de OAuth. Use Abrir autorizacao.');
    } else if (result.connected) {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      setMcpOAuthMessage(resetBeforeStart ? 'OAuth MCP reconectado.' : 'OAuth MCP ja esta conectado.');
    } else {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      setMcpOAuthMessage(result.error || 'OAuth iniciado, mas o servidor nao retornou uma URL de autorizacao.');
    }
  };

  const startMcpOAuthFlow = async (resetBeforeStart = false) => {
    if (!selectedMcpExternalUrl || mcpOAuthLoading) return;
    const popupWindow = window.open('', `canvas-flow-mcp-oauth-${Date.now()}`, 'width=720,height=760');
    setMcpOAuthLoading(true);
    setMcpOAuthAuthorizationUrl('');
    setMcpOAuthMessage(resetBeforeStart ? 'Limpando cache OAuth deste escopo e URL...' : '');
    try {
      if (resetBeforeStart) {
        await canvasApi.disconnectMcpOAuth({
          serverUrl: selectedMcpExternalUrl,
          agentId: currentAgentId,
          connectionScope: selectedMcpExternalOAuthConnectionScope,
        });
      }
      const result = await canvasApi.startMcpOAuth({
        serverUrl: selectedMcpExternalUrl,
        agentId: currentAgentId,
        connectionScope: selectedMcpExternalOAuthConnectionScope,
        label: selectedStep?.title || selectedStep?.id || 'MCP externo',
        scope: getMcpRemoteServerOAuthScope(selectedMcpExternalUrl),
        clientName: 'Canvas Flow MCP',
      });
      handleMcpOAuthStartResult(result, resetBeforeStart, popupWindow);
    } catch (error) {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      setMcpOAuthMessage(error instanceof Error ? error.message : resetBeforeStart ? 'Nao foi possivel reconectar o OAuth MCP.' : 'Nao foi possivel iniciar o OAuth MCP.');
    } finally {
      setMcpOAuthLoading(false);
    }
  };

  const connectMcpOAuth = async () => {
    await startMcpOAuthFlow(false);
  };

  const reconnectMcpOAuth = async () => {
    await startMcpOAuthFlow(true);
  };

  const disconnectMcpOAuth = async () => {
    if (!selectedMcpExternalUrl || mcpOAuthLoading) return;
    setMcpOAuthLoading(true);
    setMcpOAuthMessage('');
    try {
      const result = await canvasApi.disconnectMcpOAuth({
        serverUrl: selectedMcpExternalUrl,
        agentId: currentAgentId,
        connectionScope: selectedMcpExternalOAuthConnectionScope,
      });
      setMcpOAuthStatus(result);
      setMcpOAuthAuthorizationUrl('');
      setMcpOAuthMessage('OAuth MCP desconectado deste escopo.');
    } catch (error) {
      setMcpOAuthMessage(error instanceof Error ? error.message : 'Nao foi possivel desconectar o OAuth MCP.');
    } finally {
      setMcpOAuthLoading(false);
    }
  };

  const selectedLlmProviderConfigured = llmProviderStatus.configured[selectedLlmProvider];
  const selectedLlmProviderName = getLlmProviderName(selectedLlmProvider);
  const resolveModelProvider = (provider?: RagModelProvider | McpLlmProvider): FlowLlmProvider => (
    provider && provider !== 'auto' ? provider as FlowLlmProvider : selectedLlmProvider
  );
  const modelOptionsForProvider = (provider: RagModelProvider | McpLlmProvider | undefined, current?: string) => (
    optionsWithCurrent(getLlmModelOptionsForProvider(resolveModelProvider(provider)), current)
  );

  const generateEdgeConditionScript = async () => {
    const instruction = edgeConditionPrompt.trim();
    if (!instruction || edgeConditionGenerating || !selectedEdge) return;

    const sourceStep = config.steps.find((step) => step.id === selectedEdge.source);
    const targetStep = config.steps.find((step) => step.id === selectedEdge.target);
    setEdgeConditionGenerating(true);
    setEdgeConditionGenerateError('');
    setEdgeConditionCopied(false);
    try {
      const result = await canvasApi.generateContextScript({
        scriptPurpose: 'condition',
        instruction,
        currentCode: selectedEdge.condition || '',
        model: config.model,
        llmProvider: config.llmProvider || 'openai',
        temperature: 0.1,
        flowId: currentFlowId,
        agentId: currentAgentId,
        flowTitle: config.title,
        sourceTitle: sourceStep?.title || selectedEdge.source,
        targetTitle: targetStep?.title || selectedEdge.target,
        sourceStep: sourceStep ? {
          type: sourceStep.type,
          componentType: sourceStep.component?.type || '',
          responseName: sourceStep.responseName || sourceStep.component?.responseName || '',
          loopSlot: sourceStep.component?.type === 'loop'
            ? sourceStep.component?.loopResponseName || sourceStep.component?.responseName || sourceStep.responseName || 'loop'
            : '',
          loopCounterSlot: sourceStep.component?.type === 'loop'
            ? sourceStep.component?.loopIndexResponseName || 'loopIndex'
            : '',
        } : undefined,
        targetStep: targetStep ? {
          type: targetStep.type,
          componentType: targetStep.component?.type || '',
          responseName: targetStep.responseName || targetStep.component?.responseName || '',
        } : undefined,
        conditionValidationPath: selectedEdge.conditionValidationPath || (getStepResponseSlot(sourceStep) ? `context.slots.${getStepResponseSlot(sourceStep)}` : 'context.slots.input'),
        conditionValidationType: selectedEdge.conditionValidationType || '',
        availableSlots: Array.from(new Set(config.steps.map((step) => getStepResponseSlot(step)).filter(Boolean))),
      });
      setEdgeConditionGenerated(result.code || '');
      setEdgeConditionGeneratedExplanation(result.explanation || '');
    } catch (error) {
      setEdgeConditionGenerateError(error instanceof Error ? error.message : 'Nao foi possivel gerar a condicao.');
    } finally {
      setEdgeConditionGenerating(false);
    }
  };
  const copyGeneratedEdgeConditionScript = async () => {
    if (!edgeConditionGenerated) return;
    await navigator.clipboard.writeText(edgeConditionGenerated);
    setEdgeConditionCopied(true);
    window.setTimeout(() => setEdgeConditionCopied(false), 1800);
  };
  const applyGeneratedEdgeConditionScript = () => {
    if (!edgeConditionGenerated || !selectedEdge) return;
    onUpdateEdge(selectedEdge.id, {
      conditionMode: 'js',
      condition: edgeConditionGenerated,
      conditionValidationType: undefined,
    });
  };

  if (selectedEdge) {
    const sourceStep = config.steps.find((step) => step.id === selectedEdge.source);
    const targetStep = config.steps.find((step) => step.id === selectedEdge.target);
    const sourceSlot = getStepResponseSlot(sourceStep);
    const edgeValidationPath = selectedEdge.conditionValidationPath || (sourceSlot ? `context.slots.${sourceSlot}` : 'context.slots.input');
    const edgeOutputPathOptions = Array.from(new Set([
      sourceSlot ? `context.slots.${sourceSlot}` : '',
      'context.input',
      'context.slots.input',
      'context.slots.userInput',
      ...config.steps.map((step) => {
        const slot = getStepResponseSlot(step);
        return slot ? `context.slots.${slot}` : '';
      }),
    ].filter(Boolean)));
    const edgeValidationSlotName = getSlotNameFromValidationPath(edgeValidationPath);
    const conditionSlotReferences = extractConditionSlotReferences(selectedEdge.condition || '');
    const edgeValidationMismatch = Boolean(
      selectedEdge.conditionValidationType
      && edgeValidationSlotName
      && conditionSlotReferences.length
      && !conditionSlotReferences.includes(edgeValidationSlotName),
    );
    const edgeConditionPlaceholder = [
      'const value = context.slots.input;',
      "if (!value) return false;",
      "return String(value).trim() === 'ok';",
    ].join('\n');
    const edgeConditionError = getConditionJsSyntaxError(selectedEdge.condition || '');
    const updateEdgeOutputValidation = (path: string, type: EdgeOutputValidationType | '') => {
      const patch: Partial<FlowEdge> = {
        conditionValidationPath: path,
        conditionValidationType: type || undefined,
      };
      if (type) {
        patch.conditionMode = 'js';
        patch.condition = buildEdgeOutputValidationCondition(path, type);
      }
      onUpdateEdge(selectedEdge.id, patch);
    };

    return (
      <>
      <aside className="inspector edge-inspector">
        <div className="edge-summary">
          <div className="edge-summary-box">
            <span>Origem</span>
            <strong>{sourceStep?.title || selectedEdge.source}</strong>
          </div>
          <ArrowRight size={18} />
          <div className="edge-summary-box">
            <span>Destino</span>
            <strong>{targetStep?.title || selectedEdge.target}</strong>
          </div>
        </div>
        {selectedEdge.edgeRole === 'manifest' && (
          <div className="filter-empty warning">
            Ligacao de manifesto: exibida para mostrar chamada agentica entre nos, mas ignorada pelo runner como jump normal do fluxo.
          </div>
        )}
        <label>
          Texto na linha
          <input value={selectedEdge.label || ''} onChange={(event) => onUpdateEdge(selectedEdge.id, { label: event.target.value })} />
        </label>
        <label>
          Modo da condição
          <select
            value={selectedEdge.conditionMode || 'js'}
            onChange={(event) => onUpdateEdge(selectedEdge.id, { conditionMode: event.target.value as ConditionMode })}
          >
            <option value="js">Regra JS</option>
            <option value="llm">Instrução LLM</option>
          </select>
        </label>
        {(selectedEdge.conditionMode || 'js') === 'js' && (
          <>
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Validação rápida por tipo</strong>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Saída/slot para validar
                  <input
                    list={`edge-output-paths-${selectedEdge.id}`}
                    value={edgeValidationPath}
                    placeholder="context.slots.input"
                    onChange={(event) => updateEdgeOutputValidation(event.target.value, selectedEdge.conditionValidationType || '')}
                  />
                  <datalist id={`edge-output-paths-${selectedEdge.id}`}>
                    {edgeOutputPathOptions.map((path) => (
                      <option key={path} value={path} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Tipo esperado
                  <select
                    value={selectedEdge.conditionValidationType || ''}
                    onChange={(event) => updateEdgeOutputValidation(edgeValidationPath, event.target.value as EdgeOutputValidationType | '')}
                  >
                    <option value="">Sem atalho</option>
                    {EDGE_OUTPUT_VALIDATION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="filter-empty">
                Ao escolher um tipo, o Canvas monta a Condição JS abaixo automaticamente. Você ainda pode editar o JS manualmente depois.
              </div>
              {edgeValidationMismatch && (
                <div className="filter-empty warning">
                  Atenção: a condição atual lê {conditionSlotReferences.map((slot) => `context.slots.${slot}`).join(', ')}, mas o atalho está configurado para context.slots.{edgeValidationSlotName}. Ajuste o JS ou escolha o tipo novamente para recriar a regra.
                </div>
              )}
            </div>
            <CodeEditorField
              label="Condição JS"
              language="JavaScript"
              rows={8}
              error={edgeConditionError}
              value={selectedEdge.condition || ''}
              placeholder={edgeConditionPlaceholder}
              onChange={(value) => onUpdateEdge(selectedEdge.id, { condition: value })}
              onOpen={() => setEdgeConditionEditorOpen(true)}
            />
          </>
        )}
        {selectedEdge.conditionMode === 'llm' && (
          <div className="rich-editor-block">
            <div className="filter-section-header">
              <strong>Validação por LLM</strong>
            </div>
            <label>
              Instrução LLM
              <textarea
                rows={5}
                value={selectedEdge.condition || ''}
                placeholder="Ex: siga por esta ligação se o usuário quer falar com financeiro."
                onChange={(event) => onUpdateEdge(selectedEdge.id, { condition: event.target.value })}
              />
            </label>
            <div className="inspector-grid-two">
              <label>
                Modelo
                <select
                  value={selectedEdge.conditionModel || ''}
                  onChange={(event) => onUpdateEdge(selectedEdge.id, { conditionModel: event.target.value })}
                >
                  <option value="">Usar modelo do fluxo ({config.model})</option>
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Temperatura
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={selectedEdge.conditionTemperature ?? 0}
                  onChange={(event) => onUpdateEdge(selectedEdge.id, { conditionTemperature: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              Slot do motivo
              <input
                value={selectedEdge.conditionReasonResponseName || ''}
                placeholder={`edge_${selectedEdge.id}_reason`}
                onChange={(event) => onUpdateEdge(selectedEdge.id, { conditionReasonResponseName: event.target.value })}
              />
              <ReasonSlotHint
                slotName={selectedEdge.conditionReasonResponseName || `edge_${selectedEdge.id}_reason`}
                resultName={selectedEdge.id}
              />
            </label>
            <div className="filter-empty">
              Helper: a IA retorna verdadeiro/falso para esta ligação e salva o motivo nesse slot. Use quando a regra não couber bem em JS.
            </div>
          </div>
        )}
      </aside>
      {edgeConditionEditorOpen && (
        <div className="modal-backdrop context-code-backdrop" onMouseDown={() => setEdgeConditionEditorOpen(false)}>
          <div className="context-code-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <strong>Editor JS da ligação</strong>
                <span>JavaScript</span>
              </div>
              <button type="button" onClick={() => setEdgeConditionEditorOpen(false)}>
                <X size={16} />
                Fechar
              </button>
            </div>
            <div className="context-code-modal-body with-ai">
              <ContextScriptAiPanel
                title="Gerar condição JS com LLM"
                placeholder="Ex: valide CPF, se for inválido retorne false; se for válido e a origem for crm, retorne true."
                prompt={edgeConditionPrompt}
                generatedCode={edgeConditionGenerated}
                generatedExplanation={edgeConditionGeneratedExplanation}
                error={edgeConditionGenerateError}
                loading={edgeConditionGenerating}
                copied={edgeConditionCopied}
                onPromptChange={setEdgeConditionPrompt}
                onGenerate={() => void generateEdgeConditionScript()}
                onCopy={() => void copyGeneratedEdgeConditionScript()}
                onApply={applyGeneratedEdgeConditionScript}
              />
              <LineNumberedCodeTextarea
                language="js"
                rows={30}
                fill
                error={edgeConditionError}
                value={selectedEdge.condition || ''}
                placeholder={edgeConditionPlaceholder}
                onChange={(value) => onUpdateEdge(selectedEdge.id, { condition: value })}
              />
              {edgeConditionError && <div className="code-editor-error">{edgeConditionError}</div>}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  if (!selectedStep) {
    return (
      <>
      <aside className="inspector">
        <div className="inspector-title">Config Padrão</div>
        <label>
          Título
          <input value={config.title} onChange={(event) => onUpdateConfig({ title: event.target.value })} />
        </label>
        <label>
          responseName
          <input value={config.responseName} onChange={(event) => onUpdateConfig({ responseName: event.target.value })} />
        </label>
        <label>
          Modelo padrão
          <select value={config.model} onChange={(event) => onUpdateConfig({ model: event.target.value })}>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provedor LLM
          <select
            value={selectedLlmProvider}
            onChange={(event) => {
              const provider = event.target.value as FlowLlmProvider;
              onUpdateConfig({
                llmProvider: provider,
                model: getDefaultLlmModelForProvider(provider) || config.model,
              });
            }}
          >
            <option value="openai">{getLlmProviderOptionLabel('openai', llmProviderStatus)}</option>
            <option value="azure_openai">{getLlmProviderOptionLabel('azure_openai', llmProviderStatus)}</option>
            <option value="gemini">{getLlmProviderOptionLabel('gemini', llmProviderStatus)}</option>
            <option value="claude">{getLlmProviderOptionLabel('claude', llmProviderStatus)}</option>
            <option value="grok">{getLlmProviderOptionLabel('grok', llmProviderStatus)}</option>
            <option value="bedrock">{getLlmProviderOptionLabel('bedrock', llmProviderStatus)}</option>
          </select>
          {selectedLlmProviderConfigured === false && (
            <span className="field-hint provider-config-warning">
              {selectedLlmProviderName} não está configurado em Provedores. Configure antes de executar chamadas LLM.
            </span>
          )}
          {llmProviderStatus.error && (
            <span className="field-hint provider-config-warning">
              Não foi possível verificar os Provedores agora. O fluxo ainda será salvo com esta opção.
            </span>
          )}
        </label>
        <label>
          Canal
          <select value={config.channel || 'webWidget'} onChange={(event) => onUpdateConfig({ channel: event.target.value as FlowChannel })}>
            <option value="webWidget">Web widget</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.isMainFlow === true}
            onChange={(event) => onUpdateConfig({ isMainFlow: event.target.checked })}
          />
          Flow principal do agente
        </label>
        <div className="filter-empty">
          Use o flow principal como porta de entrada do WhatsApp. Dentro dele, adicione o componente Roteador de fluxo para decidir se a conversa pula para outro flow.
        </div>
        <div className="filter-section">
          <div className="filter-section-header">
            <strong>Agent OS</strong>
          </div>
          <label>
            <span className="prompt-field-label-row">
              <span>Agents.md</span>
              <FieldAiButton
                onClick={() => openPromptFieldAssistant({
                  fieldType: 'agentsMd',
                  targetType: 'global-agent',
                  title: 'Gerar Agents.md',
                  label: 'Agent OS global',
                  currentValue: config.agentSpec?.agentsMd || '',
                  placeholder: 'Ex: agente principal de atendimento para clínica. Deve coletar CPF e data de nascimento, consultar MCPs em ordem e nunca misturar regras técnicas na resposta ao cliente.',
                  applyText: (text) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), agentsMd: text } }),
                }, config.agentSpec?.agentsMd ? 'Melhore este Agents.md mantendo as responsabilidades separadas dos guardrails.' : '')}
              />
            </span>
            <textarea
              rows={5}
              value={config.agentSpec?.agentsMd || ''}
              placeholder="# Papel&#10;Descreva objetivo, tom, limites, memoria e ferramentas permitidas."
              onChange={(event) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), agentsMd: event.target.value } })}
            />
          </label>
          <label>
            <span className="prompt-field-label-row">
              <span>Guardrails</span>
              <FieldAiButton
                onClick={() => openPromptFieldAssistant({
                  fieldType: 'guardrails',
                  targetType: 'global-agent',
                  title: 'Gerar Guardrails',
                  label: 'Limites globais do agente',
                  currentValue: config.agentSpec?.guardrails || '',
                  placeholder: 'Ex: não inventar dados, não expor segredos, não executar ações sensíveis sem confirmação, responder apenas com dados retornados por MCP/API.',
                  applyText: (text) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), guardrails: text } }),
                }, config.agentSpec?.guardrails ? 'Melhore estes guardrails sem misturar papel do agente ou fluxo de negócio.' : '')}
              />
            </span>
            <textarea
              rows={4}
              value={config.agentSpec?.guardrails || ''}
              placeholder="Nunca invente dados. Peça aprovação antes de ações sensíveis. Não exponha segredos."
              onChange={(event) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), guardrails: event.target.value } })}
            />
          </label>
          <label>
            <span className="prompt-field-label-row">
              <span>Termos bloqueados</span>
              <FieldAiButton
                onClick={() => openPromptFieldAssistant({
                  fieldType: 'blockedTerms',
                  targetType: 'global-agent',
                  title: 'Gerar termos bloqueados',
                  label: 'Tripwires globais',
                  currentValue: (config.agentSpec?.blockedTerms || []).join(', '),
                  placeholder: 'Ex: termos que devem bloquear exclusão destrutiva, vazamento de token, fraude, disparo em massa ou alteração sensível.',
                  applyText: (text) => onUpdateConfig({
                    agentSpec: {
                      ...(config.agentSpec || {}),
                      blockedTerms: normalizeBlockedTerms(text),
                    },
                  }),
                }, (config.agentSpec?.blockedTerms || []).length ? 'Melhore esta lista mantendo termos curtos separados por vírgula.' : '')}
              />
            </span>
            <input
              value={(config.agentSpec?.blockedTerms || []).join(', ')}
              placeholder="excluir cliente, apagar banco, disparo em massa"
              onChange={(event) => onUpdateConfig({
                agentSpec: {
                  ...(config.agentSpec || {}),
                  blockedTerms: parseBlockedTermsDraft(event.target.value),
                },
              })}
              onBlur={(event) => onUpdateConfig({
                agentSpec: {
                  ...(config.agentSpec || {}),
                  blockedTerms: normalizeBlockedTerms(event.target.value),
                },
              })}
            />
          </label>
          <label>
            Skills JSON
            <textarea
              rows={3}
              value={JSON.stringify(config.agentSpec?.skills || [], null, 2)}
              onChange={(event) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), skills: parseJson(event.target.value, config.agentSpec?.skills || []) as Array<Record<string, unknown>> } })}
            />
          </label>
          <label>
            Subagents JSON
            <textarea
              rows={3}
              value={JSON.stringify(config.agentSpec?.subagents || [], null, 2)}
              onChange={(event) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), subagents: parseJson(event.target.value, config.agentSpec?.subagents || []) as Array<Record<string, unknown>> } })}
            />
          </label>
          <label>
            Rules JSON
            <textarea
              rows={3}
              value={JSON.stringify(config.agentSpec?.rules || [], null, 2)}
              onChange={(event) => onUpdateConfig({ agentSpec: { ...(config.agentSpec || {}), rules: parseJson(event.target.value, config.agentSpec?.rules || []) as Array<Record<string, unknown>> } })}
            />
          </label>
        </div>
        <label>
          Turnos de memoria
          <input
            type="number"
            min={0}
            value={config.turnHistoricMessages}
            onChange={(event) => onUpdateConfig({ turnHistoricMessages: Number(event.target.value) || 0 })}
          />
        </label>
      </aside>
      {renderPromptFieldAssistantModal()}
      </>
    );
  }

  const updateStep = (patch: Partial<FlowStep>) => onUpdateStep(selectedStep.id, patch);
  const updateComponent = (patch: NonNullable<FlowStep['component']>) => updateStep({ component: patch });
  const updateRagComponent = (patch: Partial<NonNullable<FlowStep['component']>>) => {
    updateComponent({ ...selectedStep.component!, ...patch });
  };
  const currentMcpRemoteServerPreset = getMcpRemoteServerPreset(selectedStep.component?.mcpExternalUrl);
  const mcpRemoteServerPresetHelp = MCP_REMOTE_SERVER_PRESETS.find((preset) => preset.id === mcpPresetHelpId);
  const applyMcpRemoteServerPreset = (presetId: string) => {
    const preset = MCP_REMOTE_SERVER_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setMcpExternalTools([]);
    setMcpExternalToolsError('');
    setMcpExternalToolsMessage('');
    updateRagComponent({
      mcpExternalTransport: 'streamable_http',
      mcpExternalUrl: preset.serverUrl,
      mcpExternalOperation: 'listTools',
      mcpExternalToolName: '',
      mcpExternalArgumentsJson: '{}',
      mcpExternalHeadersJson: '{}',
      mcpExternalAuthMode: preset.authMode,
      mcpExternalOAuthConnectionScope: preset.authMode === 'oauth' ? 'user' : 'agent',
      mcpExternalAuthHeaderName: 'Authorization',
      mcpExternalAuthQueryParam: 'api_key',
      mcpExternalAuthSecret: '',
      mcpExternalResourceUri: '',
      mcpExternalPromptName: '',
      mcpExternalPromptArgumentsJson: '{}',
      mcpExternalTimeoutMs: 30000,
    });
    setMcpPresetHelpId(preset.id);
  };
  const discoverMcpExternalTools = async () => {
    if (selectedStep.component?.type !== 'mcp' || !selectedMcpExternalUrl || mcpExternalToolsLoading) return;
    setMcpExternalToolsLoading(true);
    setMcpExternalToolsError('');
    setMcpExternalToolsMessage('');
    try {
      const result = await canvasApi.listExternalMcpTools({
        agentId: currentAgentId,
        component: { ...selectedStep.component },
      });
      const tools = Array.isArray(result.tools) ? result.tools : [];
      setMcpExternalTools(tools);
      setMcpExternalToolsMessage(tools.length
        ? `${tools.length} tool(s) carregada(s). Selecione uma para preencher o schema e os argumentos.`
        : 'O servidor respondeu sem tools disponiveis.');
    } catch (error) {
      setMcpExternalTools([]);
      setMcpExternalToolsError(error instanceof Error ? error.message : 'Nao foi possivel listar as tools deste MCP.');
    } finally {
      setMcpExternalToolsLoading(false);
    }
  };
  const selectMcpExternalTool = (toolName: string) => {
    const tool = mcpExternalTools.find((item) => item.name === toolName);
    if (!tool) return;
    const inputSchema = tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema)
      ? tool.inputSchema
      : {};
    const outputSchema = tool.outputSchema && typeof tool.outputSchema === 'object' && !Array.isArray(tool.outputSchema)
      ? tool.outputSchema
      : undefined;
    updateRagComponent({
      mcpExternalOperation: 'callTool',
      mcpExternalToolName: tool.name,
      mcpExternalArgumentsJson: buildMcpExternalArgumentsTemplate(inputSchema),
      mcpInputSchema: stringifyMcpSchema(inputSchema),
      ...(outputSchema && Object.keys(outputSchema).length ? { mcpOutputSchema: stringifyMcpSchema(outputSchema) } : {}),
    });
    setMcpExternalToolsMessage(`Tool ${tool.name} selecionada. Ajuste os argumentos ou desmarque a LLM para enviar somente os valores configurados.`);
  };
  const componentAgentSpec = {
    agentsMd: selectedStep.component?.agentSpec?.agentsMd || '',
    guardrails: selectedStep.component?.agentSpec?.guardrails || '',
    blockedTerms: selectedStep.component?.agentSpec?.blockedTerms || [],
  };
  const componentAgentLegacyCatalogCounts = {
    rules: selectedStep.component?.agentSpec?.rules?.length || 0,
    skills: selectedStep.component?.agentSpec?.skills?.length || 0,
    subagents: selectedStep.component?.agentSpec?.subagents?.length || 0,
    mcpServers: selectedStep.component?.agentSpec?.mcpServers?.length || 0,
  };
  const componentAgentHasLegacyCatalog = Object.values(componentAgentLegacyCatalogCounts).some((count) => count > 0);
  const componentAgentRole = selectedStep.component?.agentRole || 'simple';
  const componentAgentUseWorkspaceCatalog = selectedStep.component?.agentUseWorkspaceCatalog !== false;
  const workspaceAgentSpec = config.agentSpec || {};
  const componentAgentManifest = selectedStep.component?.agentManifest || {};
  const workspaceCatalogCounts = {
    rules: workspaceAgentSpec.rules?.length || 0,
    skills: workspaceAgentSpec.skills?.length || 0,
    subagents: workspaceAgentSpec.subagents?.length || 0,
    mcpServers: workspaceAgentSpec.mcpServers?.length || 0,
  };
  const canvasSubagentCatalog = config.steps
    .filter((step) => (
      step.id !== selectedStep.id
      && step.type === 'component'
      && step.component?.type === 'openaiGen'
      && step.component.agentRole === 'subagent'
    ))
    .map((step) => ({
      id: `canvas:${step.id}`,
      name: step.title || 'Subagent do canvas',
      description: step.instruction || step.component?.agentSpec?.agentsMd || 'Subagent especializado criado como no do canvas.',
      path: `canvas://${step.id}`,
      source: 'canvas',
      targetStepId: step.id,
      load: step.component?.agentExecutionMode === 'auto_tools' ? 'auto' : 'on_demand',
    } as Record<string, unknown>));
  const describeMcpStep = (step: FlowStep) => String(
    step.component?.mcpToolDescription ||
    step.instruction ||
    step.component?.mcpInstruction ||
    step.component?.mcpExternalToolName ||
    step.component?.mcpExternalUrl ||
    'Ferramenta MCP criada em um fluxo.',
  ).trim();
  const canvasMcpCatalog = config.steps
    .filter((step) => (
      step.id !== selectedStep.id
      && step.type === 'component'
      && step.component?.type === 'mcp'
    ))
    .map((step) => ({
      id: `canvas-mcp:${step.id}`,
      name: step.title || step.component?.mcpToolName || 'MCP do canvas',
      description: describeMcpStep(step),
      path: `canvas://${step.id}`,
      source: 'canvas',
      targetStepId: step.id,
      inputSchema: step.component?.mcpInputSchema || {},
      outputSchema: step.component?.mcpOutputSchema || {},
      sideEffect: step.component?.mcpMode === 'api' || step.component?.mcpMode === 'external' ? 'external_action' : 'read',
      load: 'on_demand',
    } as Record<string, unknown>));
  const flowMcpCatalog = flows
    .filter((flow) => String(flow._id || '') !== String(currentFlowId || ''))
    .flatMap((flow) => {
      const steps = Array.isArray(flow.config?.steps) ? flow.config.steps : [];
      return steps
        .filter((step) => step.type === 'component' && step.component?.type === 'mcp')
        .map((step) => ({
          id: `flow-mcp:${flow._id}:${step.id}`,
          name: `${flow.name || flow.config?.title || 'Fluxo'} / ${step.title || step.component?.mcpToolName || 'MCP'}`,
          description: describeMcpStep(step),
          path: `flow://${flow._id}#${step.id}`,
          source: 'flow',
          targetFlowId: flow._id,
          targetStepId: step.id,
          targetAgentId: flow.agentId || '',
          inputSchema: step.component?.mcpInputSchema || {},
          outputSchema: step.component?.mcpOutputSchema || {},
          sideEffect: step.component?.mcpMode === 'api' || step.component?.mcpMode === 'external' ? 'external_action' : 'read',
          load: 'on_demand',
        } as Record<string, unknown>));
    });
  const updateComponentAgentSpec = (patch: Partial<typeof componentAgentSpec>) => {
    updateRagComponent({ agentSpec: { ...componentAgentSpec, ...patch } });
  };
  const setComponentAgentRole = (role: 'simple' | 'orchestrator' | 'subagent') => {
    updateRagComponent({
      agentRole: role,
      agentUseWorkspaceCatalog: true,
      agentSpec: { ...componentAgentSpec },
      agentExecutionMode: role === 'orchestrator' || role === 'subagent'
        ? selectedStep.component?.agentExecutionMode === 'hybrid' ? 'hybrid' : 'auto_tools'
        : selectedStep.component?.agentExecutionMode || 'flow',
    });
  };
  const getManifestRefs = (key: AgentManifestKind): AgentManifestItemRef[] => (
    Array.isArray(componentAgentManifest[key]) ? componentAgentManifest[key] || [] : []
  );
  const hasExplicitManifestSelection = AGENT_MANIFEST_SECTIONS.some((section) => getManifestRefs(section.key).length > 0);
  const selectedAgentExecutionMode = selectedStep.component?.agentExecutionMode || (
    componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent' ? 'auto_tools' : 'flow'
  );
  const selectedAgentUsesTools = Boolean(
    selectedStep.component?.type === 'openaiGen'
    && (componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent')
    && selectedAgentExecutionMode !== 'flow',
  );
  const agentManifestTargetIds = new Set(
    AGENT_MANIFEST_SECTIONS
      .flatMap((section) => getManifestRefs(section.key))
      .map((ref) => String(ref.targetStepId || ref.stepId || ref.nodeId || '').trim())
      .filter(Boolean),
  );
  const canvasCallableTargetIds = new Set([
    ...canvasSubagentCatalog.map((item) => String(item.targetStepId || '').trim()).filter(Boolean),
    ...canvasMcpCatalog.map((item) => String(item.targetStepId || '').trim()).filter(Boolean),
  ]);
  const agentCallableTargetIds = hasExplicitManifestSelection ? agentManifestTargetIds : canvasCallableTargetIds;
  const mcpStepIds = new Set(
    config.steps
      .filter((step) => step.type === 'component' && step.component?.type === 'mcp')
      .map((step) => step.id),
  );
  const stepTitleById = new Map(config.steps.map((step) => [step.id, step.title || step.id]));
  const agenticDirectToolEdges = selectedAgentUsesTools
    ? config.edges.filter((edge) => edge.source === selectedStep.id && agentCallableTargetIds.has(edge.target))
    : [];
  const agenticToolToMcpEdges = selectedAgentUsesTools
    ? config.edges.filter((edge) => agentCallableTargetIds.has(edge.source) && mcpStepIds.has(edge.target))
    : [];
  const agenticGraphWarningEdges = Array.from(
    new Map([...agenticDirectToolEdges, ...agenticToolToMcpEdges].map((edge) => [edge.id, edge])).values(),
  );
  const agenticGraphWarningSummary = agenticGraphWarningEdges
    .slice(0, 5)
    .map((edge) => `${stepTitleById.get(edge.source) || edge.source} -> ${stepTitleById.get(edge.target) || edge.target}`)
    .join(', ');
  const buildManifestRef = (
    key: AgentManifestKind,
    item: Record<string, unknown>,
    index: number,
    fallbackLoad: AgentManifestLoadMode,
  ): AgentManifestItemRef => {
    const id = catalogItemId(item, `${key}-${index + 1}`);
    return {
      id,
      name: catalogItemName(item, id),
      description: catalogItemDescription(item),
      path: String(item.path || '').trim(),
      source: item.source === 'canvas' || item.source === 'flow' ? item.source : 'workspace',
      targetStepId: String(item.targetStepId || '').trim() || undefined,
      targetFlowId: String(item.targetFlowId || item.flowId || '').trim() || undefined,
      targetAgentId: String(item.targetAgentId || item.agentId || '').trim() || undefined,
      inputSchema: item.inputSchema && typeof item.inputSchema === 'object' && !Array.isArray(item.inputSchema) ? item.inputSchema as Record<string, unknown> : undefined,
      outputSchema: item.outputSchema && typeof item.outputSchema === 'object' && !Array.isArray(item.outputSchema) ? item.outputSchema as Record<string, unknown> : undefined,
      sideEffect: String(item.sideEffect || '').trim() || undefined,
      requiresApproval: item.requiresApproval === true ? true : undefined,
      maxRetries: Number.isFinite(Number(item.maxRetries)) ? Number(item.maxRetries) : undefined,
      load: normalizeAgentManifestLoadMode(item.load || item.loadMode, fallbackLoad),
    };
  };
  const updateManifestRefs = (key: AgentManifestKind, refs: AgentManifestItemRef[]) => {
    updateRagComponent({
      agentUseWorkspaceCatalog: true,
      agentManifest: {
        ...(selectedStep.component?.agentManifest || {}),
        [key]: refs,
      },
    });
  };
  const findManifestRef = (key: AgentManifestKind, item: Record<string, unknown>, index: number) => {
    const id = catalogItemId(item, `${key}-${index + 1}`);
    return getManifestRefs(key).find((ref) => ref.id === id);
  };
  const toggleManifestItem = (
    key: AgentManifestKind,
    item: Record<string, unknown>,
    index: number,
    fallbackLoad: AgentManifestLoadMode,
  ) => {
    const id = catalogItemId(item, `${key}-${index + 1}`);
    const refs = getManifestRefs(key);
    if (refs.some((ref) => ref.id === id)) {
      updateManifestRefs(key, refs.filter((ref) => ref.id !== id));
      return;
    }
    updateManifestRefs(key, [...refs, buildManifestRef(key, item, index, fallbackLoad)]);
  };
  const updateManifestItemLoad = (key: AgentManifestKind, id: string, load: AgentManifestLoadMode) => {
    updateManifestRefs(key, getManifestRefs(key).map((ref) => (ref.id === id ? { ...ref, load } : ref)));
  };
  const selectAllManifestItems = () => {
    const nextManifest = AGENT_MANIFEST_SECTIONS.reduce((acc, section) => {
      const items = Array.isArray(workspaceAgentSpec[section.key]) ? workspaceAgentSpec[section.key] || [] : [];
      acc[section.key] = items.map((item, index) => buildManifestRef(section.key, item, index, section.fallbackLoad));
      return acc;
    }, {} as AgentManifestConfig);
    nextManifest.subagents = [
      ...(nextManifest.subagents || []),
      ...canvasSubagentCatalog.map((item, index) => buildManifestRef('subagents', item, index + (nextManifest.subagents?.length || 0), 'auto')),
    ];
    nextManifest.mcpServers = [
      ...(nextManifest.mcpServers || []),
      ...canvasMcpCatalog.map((item, index) => buildManifestRef('mcpServers', item, index + (nextManifest.mcpServers?.length || 0), 'on_demand')),
      ...flowMcpCatalog.map((item, index) => buildManifestRef('mcpServers', item, index + (nextManifest.mcpServers?.length || 0), 'on_demand')),
    ];
    updateRagComponent({ agentUseWorkspaceCatalog: true, agentManifest: nextManifest });
  };
  const clearManifestItems = () => updateRagComponent({ agentManifest: {} });
  const manifestTabs: Array<{ id: AgentManifestTab; label: string; selected: number; total: number }> = [
    {
      id: 'skills',
      label: 'Skills',
      selected: getManifestRefs('skills').length,
      total: workspaceCatalogCounts.skills,
    },
    {
      id: 'subagents',
      label: 'Subagents',
      selected: getManifestRefs('subagents').length,
      total: workspaceCatalogCounts.subagents + canvasSubagentCatalog.length,
    },
    {
      id: 'rules',
      label: 'Rules',
      selected: getManifestRefs('rules').length,
      total: workspaceCatalogCounts.rules,
    },
    {
      id: 'mcp',
      label: 'MCP',
      selected: getManifestRefs('mcpServers').length,
      total: workspaceCatalogCounts.mcpServers + canvasMcpCatalog.length + flowMcpCatalog.length,
    },
  ];
  const selectCurrentManifestTab = () => {
    if (agentManifestTab === 'skills') {
      updateManifestRefs('skills', (workspaceAgentSpec.skills || []).map((item, index) => buildManifestRef('skills', item, index, 'auto')));
      return;
    }
    if (agentManifestTab === 'subagents') {
      const workspaceRefs = (workspaceAgentSpec.subagents || []).map((item, index) => buildManifestRef('subagents', item, index, 'auto'));
      const canvasRefs = canvasSubagentCatalog.map((item, index) => buildManifestRef('subagents', item, index + workspaceRefs.length, 'auto'));
      updateManifestRefs('subagents', [...workspaceRefs, ...canvasRefs]);
      return;
    }
    if (agentManifestTab === 'rules') {
      updateManifestRefs('rules', (workspaceAgentSpec.rules || []).map((item, index) => buildManifestRef('rules', item, index, 'always')));
      return;
    }
    const workspaceRefs = (workspaceAgentSpec.mcpServers || []).map((item, index) => buildManifestRef('mcpServers', item, index, 'on_demand'));
    const canvasRefs = canvasMcpCatalog.map((item, index) => buildManifestRef('mcpServers', item, index + workspaceRefs.length, 'on_demand'));
    const flowRefs = flowMcpCatalog.map((item, index) => buildManifestRef('mcpServers', item, index + workspaceRefs.length + canvasRefs.length, 'on_demand'));
    updateManifestRefs('mcpServers', [...workspaceRefs, ...canvasRefs, ...flowRefs]);
  };
  const clearCurrentManifestTab = () => {
    if (agentManifestTab === 'mcp') {
      updateManifestRefs('mcpServers', []);
      return;
    }
    updateManifestRefs(agentManifestTab, []);
  };
  const attachManifestRefToSelectedStep = (
    key: AgentManifestKind,
    ref: AgentManifestItemRef,
    steps: FlowStep[] = config.steps,
  ) => steps.map((step) => {
    if (step.id !== selectedStep.id || step.type !== 'component' || !step.component) return step;
    const manifest = step.component.agentManifest || {};
    const refs = Array.isArray(manifest[key]) ? manifest[key] || [] : [];
    const exists = refs.some((item) => item.id === ref.id);
    return {
      ...step,
      component: {
        ...step.component,
        agentUseWorkspaceCatalog: true,
        agentManifest: {
          ...manifest,
          [key]: exists ? refs : [...refs, ref],
        },
      },
    };
  });
  const createRuleFromAgent = () => {
    const name = quickRuleName.trim() || `Rule ${workspaceCatalogCounts.rules + 1}`;
    const instructions = quickRuleText.trim() || 'Descreva a regra, quando ela deve ser aplicada e como ela redireciona o agente.';
    const slug = agentCatalogSlug(name, `rule-${Date.now().toString(36)}`);
    const rule = {
      id: `rule_${slug}`,
      name,
      description: instructions.split('\n').find(Boolean)?.slice(0, 180) || name,
      instructions,
      load: 'always',
      path: `.canvas-flow/rules/${slug}.md`,
      enabled: true,
    };
    const nextRules = [...(workspaceAgentSpec.rules || []), rule];
    const ref = buildManifestRef('rules', rule, nextRules.length - 1, 'always');
    onUpdateConfig({
      agentSpec: {
        ...(config.agentSpec || {}),
        rules: nextRules,
      },
      steps: attachManifestRefToSelectedStep('rules', ref),
    });
    setAgentManifestTab('rules');
    setQuickRuleName('');
    setQuickRuleText('');
  };
  const filesUploaded = selectedStep.component?.type === 'files'
    ? selectedStep.component.filesUploaded || []
    : [];
  const filesUsesLlm = selectedStep.component?.type === 'files' && (
    (selectedStep.component.filesResultMode || 'context') === 'llm'
    || (
      (selectedStep.component.filesOperation || 'read') !== 'read'
      && !String(selectedStep.component.filesContentTemplate || '').trim()
    )
  );
  const selectedFilesTemplateDocumentIds = selectedStep.component?.type === 'files'
    ? Array.from(new Set(
        (selectedStep.component.filesTemplateDocumentIds?.length
          ? selectedStep.component.filesTemplateDocumentIds
          : selectedStep.component.filesTemplateDocumentId
            ? [selectedStep.component.filesTemplateDocumentId]
            : [])
          .map((documentId) => String(documentId || '').trim())
          .filter(Boolean),
      ))
    : [];
  const filesTemplateCandidates = selectedFilesTemplateDocumentIds.length
    ? filesUploaded.filter((file) => selectedFilesTemplateDocumentIds.includes(String(file.documentId || file.id || '')))
    : filesUploaded.length === 1
      ? filesUploaded
      : [];
  const filesNativeEditFormats = Array.from(new Set(
    filesTemplateCandidates
      .map((file) => {
        const filename = String(file.filename || file.title || '').toLowerCase();
        const mimeType = String(file.mimeType || '').toLowerCase();
        if (filename.endsWith('.docx') || mimeType.includes('wordprocessingml')) return 'docx';
        if (filename.endsWith('.xlsx') || mimeType.includes('spreadsheetml')) return 'xlsx';
        return '';
      })
      .filter(Boolean),
  ));
  const filesNativeEditFormat = (selectedStep.component?.type === 'files'
    && (selectedStep.component.filesOperation || 'read') === 'edit'
    && filesNativeEditFormats.length === 1
    ? filesNativeEditFormats[0]
    : '') as FilesOutputFormat | '';
  const displayedFilesOutputFormat = filesNativeEditFormat
    || selectedStep.component?.filesOutputFormat
    || 'docx';
  const withFilesOutputExtension = (filename: string, format: FilesOutputFormat) => {
    const current = String(filename || '').trim() || `artefato.${format}`;
    return /\.[^./\\]+$/.test(current)
      ? current.replace(/\.[^./\\]+$/, `.${format}`)
      : `${current}.${format}`;
  };
  const displayedFilesOutputFilenameTemplate = filesNativeEditFormat
    ? withFilesOutputExtension(selectedStep.component?.filesOutputFilenameTemplate || '', filesNativeEditFormat)
    : selectedStep.component?.filesOutputFilenameTemplate || `artefato.${displayedFilesOutputFormat}`;
  const filesHasAmbiguousEditTemplate = selectedStep.component?.type === 'files'
    && (selectedStep.component.filesOperation || 'read') === 'edit'
    && filesUploaded.length > 1
    && selectedFilesTemplateDocumentIds.length === 0;
  const toggleFilesTemplateDocument = (documentId: string) => {
    if (!documentId) return;
    const nextDocumentIds = selectedFilesTemplateDocumentIds.includes(documentId)
      ? selectedFilesTemplateDocumentIds.filter((item) => item !== documentId)
      : [...selectedFilesTemplateDocumentIds, documentId];
    updateRagComponent({
      filesTemplateDocumentIds: nextDocumentIds,
      filesTemplateDocumentId: nextDocumentIds[0] || '',
    });
  };
  const handleFilesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selectedFiles.length || selectedStep.component?.type !== 'files') return;

    setFilesUploading(true);
    setFilesUploadError('');
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('arquivos', file));
      formData.append('ocr', selectedStep.component.filesPreferOcr ? 'true' : 'false');
      formData.append('maxTextChars', String(selectedStep.component.filesMaxTextChars ?? 60000));
      if (agentId) formData.append('agentId', agentId);
      if (currentFlowId) formData.append('flowId', currentFlowId);
      const result = await canvasApi.extractFiles(formData);
      const extracted = Array.isArray(result.files) ? result.files as FlowFileDocument[] : [];
      const okFiles = extracted.filter((file) => file.documentId || file.text);
      if (!okFiles.length) {
        throw new Error('Nao foi possivel armazenar os arquivos selecionados.');
      }
      updateRagComponent({
        filesUploaded: [...filesUploaded, ...okFiles],
        filesSourceMode: 'upload',
      });
    } catch (error) {
      setFilesUploadError(error instanceof Error ? error.message : 'Nao foi possivel enviar os arquivos.');
    } finally {
      setFilesUploading(false);
    }
  };
  const downloadUploadedFile = async (file: FlowFileDocument) => {
    const documentId = file.documentId || file.id;
    if (!documentId) return;
    try {
      const { blob, filename } = await canvasApi.downloadDocument(documentId);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || file.filename || 'arquivo';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setFilesUploadError(error instanceof Error ? error.message : 'Nao foi possivel baixar o arquivo.');
    }
  };
  const removeUploadedFile = (fileId?: string, index?: number) => {
    if (selectedStep.component?.type !== 'files') return;
    const removedFile = filesUploaded.find((file, fileIndex) => (
      fileId ? file.id === fileId : fileIndex === index
    ));
    const removedDocumentId = String(removedFile?.documentId || removedFile?.id || '');
    const nextTemplateDocumentIds = selectedFilesTemplateDocumentIds.filter((documentId) => documentId !== removedDocumentId);
    updateRagComponent({
      filesUploaded: filesUploaded.filter((file, fileIndex) => (
        fileId ? file.id !== fileId : fileIndex !== index
      )),
      filesTemplateDocumentIds: nextTemplateDocumentIds,
      filesTemplateDocumentId: nextTemplateDocumentIds[0] || '',
    });
  };
  const renderAgentManifestPicker = (
    key: AgentManifestKind,
    label: string,
    items: Array<Record<string, unknown>> | undefined,
    fallbackLoad: AgentManifestLoadMode,
  ) => {
    const safeItems = Array.isArray(items) ? items : [];
    return (
      <div className="agent-manifest-picker">
        <div className="agent-manifest-picker-title">
          <strong>{label}</strong>
          <span>{getManifestRefs(key).length}/{safeItems.length}</span>
        </div>
        {!safeItems.length && <div className="filter-empty">Nenhum item disponivel para esta origem.</div>}
        <div className="agent-manifest-bubbles">
          {safeItems.map((item, index) => {
            const id = catalogItemId(item, `${key}-${index + 1}`);
            const name = catalogItemName(item, id);
            const description = catalogItemDescription(item);
            const selectedRef = findManifestRef(key, item, index);
            const selected = Boolean(selectedRef);
            const load = normalizeAgentManifestLoadMode(selectedRef?.load || item.load || item.loadMode, fallbackLoad);
            return (
              <div className={`agent-manifest-bubble ${selected ? 'selected' : ''}`} key={id}>
                <button type="button" onClick={() => toggleManifestItem(key, item, index, fallbackLoad)}>
                  <span>{name}</span>
                  {description && <small>{description}</small>}
                </button>
                {selected && (
                  <select value={load} onChange={(event) => updateManifestItemLoad(key, id, event.target.value as AgentManifestLoadMode)}>
                    <option value="always">always</option>
                    <option value="auto">auto</option>
                    <option value="on_demand">on_demand</option>
                    <option value="manual">manual</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderRuleQuickCreate = () => (
    <div className="agent-inline-create-card">
      <div className="filter-section-header">
        <strong>Nova rule para este agente</strong>
        <button type="button" onClick={createRuleFromAgent}>
          <Plus size={14} /> Adicionar rule
        </button>
      </div>
      <label>
        Nome
        <input
          value={quickRuleName}
          placeholder="Seguranca de escrita"
          onChange={(event) => setQuickRuleName(event.target.value)}
        />
      </label>
      <label>
        Instrucao
        <textarea
          rows={4}
          value={quickRuleText}
          placeholder="Sempre pedir aprovacao antes de criar, alterar ou excluir dados em sistemas externos."
          onChange={(event) => setQuickRuleText(event.target.value)}
        />
      </label>
      <span className="field-hint">
        A rule criada entra no Agent Workspace e fica selecionada no manifesto deste orquestrador.
      </span>
    </div>
  );
  const renderAgentManifestTabContent = () => {
    if (agentManifestTab === 'skills') {
      return renderAgentManifestPicker('skills', 'Skills do Agent Workspace', workspaceAgentSpec.skills, 'auto');
    }
    if (agentManifestTab === 'subagents') {
      return (
        <>
          {renderAgentManifestPicker('subagents', 'Subagents do Agent Workspace', workspaceAgentSpec.subagents, 'auto')}
          {renderAgentManifestPicker('subagents', 'Subagents do canvas', canvasSubagentCatalog, 'auto')}
        </>
      );
    }
    if (agentManifestTab === 'rules') {
      return (
        <>
          {renderRuleQuickCreate()}
          {renderAgentManifestPicker('rules', 'Rules', workspaceAgentSpec.rules, 'always')}
        </>
      );
    }
    return (
      <>
        {renderAgentManifestPicker('mcpServers', 'MCP do Agent Workspace', workspaceAgentSpec.mcpServers, 'on_demand')}
        {renderAgentManifestPicker('mcpServers', 'MCP do canvas atual', canvasMcpCatalog, 'on_demand')}
        {renderAgentManifestPicker('mcpServers', 'MCP de fluxos salvos', flowMcpCatalog, 'on_demand')}
      </>
    );
  };
  const renderRagAgentScopeControls = () => {
    if (!selectedStep.component) return null;
    const enabled = selectedStep.component.ragUseAgentFilter !== false;
    return (
      <div className="filter-section">
        <div className="filter-section-header">
          <strong>Escopo dos vetores</strong>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => updateRagComponent({ ragUseAgentFilter: event.target.checked })}
          />
          <span>Filtrar vetores/documentos por agente</span>
        </label>
        {enabled && (
          <label>
            AgentId dos vetores/documentos
            <input
              value={selectedStep.component.ragAgentIdTemplate || ''}
              placeholder="{{context.agentId}} ou agent_id_manual"
              onChange={(event) => updateRagComponent({ ragAgentIdTemplate: event.target.value })}
            />
          </label>
        )}
        <div className="filter-empty">
          Vazio usa o agente atual. Informe outro agentId para buscar ou vetorizar documentos naquele agente. Desmarque para buscar sem filtro de agente.
        </div>
      </div>
    );
  };
  const applyMcpPreset = (mode: McpMode) => {
    if (selectedStep.component?.type !== 'mcp') return;
    const patch = getMcpPresetPatch(mode);
    const responseName = String(patch.responseName || selectedStep.component.responseName || selectedStep.responseName || 'mcp');
    updateStep({
      responseName,
      component: {
        ...selectedStep.component,
        ...patch,
        responseName,
      },
    });
  };
  const flowRouterRules = selectedStep.component?.flowRouterRules || [];
  const updateFlowRouterRules = (rules: FlowRouterRule[]) => updateRagComponent({ flowRouterRules: rules });
  const updateFlowRouterRule = (ruleId: string, patch: Partial<FlowRouterRule>) => {
    updateFlowRouterRules(flowRouterRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  };
  const addFlowRouterRule = () => {
    updateFlowRouterRules([
      ...flowRouterRules,
      {
        id: createRuleId(),
        label: `Regra ${flowRouterRules.length + 1}`,
        targetAgentId: currentAgentId,
        targetFlowId: '',
        conditionMode: 'llm',
        condition: 'Roteie para este fluxo se a intenção do usuário combina com o tema.',
        conditionModel: '',
        conditionTemperature: 0,
      },
    ]);
  };
  const removeFlowRouterRule = (ruleId: string) => {
    updateFlowRouterRules(flowRouterRules.filter((rule) => rule.id !== ruleId));
  };
  const contextMode = selectedStep.component?.contextMode || 'json';
  const contextJsonValue = selectedStep.component?.contextJson || '{}';
  const contextScriptValue = selectedStep.component?.contextScript || '';
  const contextJsonError = contextMode === 'json' ? getPlainJsonError(contextJsonValue) : '';
  const contextScriptError = contextMode === 'js' ? getJsSyntaxError(contextScriptValue) : '';
  const contextEditorValue = contextEditorModal === 'json' ? contextJsonValue : contextScriptValue;
  const contextEditorError = contextEditorModal === 'json'
    ? getPlainJsonError(contextEditorValue)
    : contextEditorModal === 'js'
      ? getJsSyntaxError(contextEditorValue)
      : '';
  const contextEditorTitle = contextEditorModal === 'json' ? 'Editor JSON do Contexto' : 'Editor JS do Contexto';
  const contextEditorLanguage = contextEditorModal === 'json' ? 'JSON' : 'JavaScript';
  const contextEditorPlaceholder = contextEditorModal === 'json'
    ? '{\n  "cliente": "{{context.slots.input}}",\n  "payload": {"origem": "web"}\n}'
    : 'const itens = context.slots.itens || [];\nreturn {\n  total: itens.length,\n  nomes: itens.map((item) => item.nome)\n};';
  const updateContextEditorValue = (value: string) => {
    if (contextEditorModal === 'json') {
      updateRagComponent({ contextJson: value });
      return;
    }
    if (contextEditorModal === 'js') {
      updateRagComponent({ contextScript: value });
    }
  };
  const generateContextScript = async () => {
    const instruction = contextScriptPrompt.trim();
    if (!instruction || contextScriptGenerating) return;

    setContextScriptGenerating(true);
    setContextScriptGenerateError('');
    setContextScriptCopied(false);
    try {
      const result = await canvasApi.generateContextScript({
        instruction,
        currentCode: contextScriptValue,
        model: selectedStep.component?.contextLlmModel || config.model,
        llmProvider: config.llmProvider || 'openai',
        temperature: selectedStep.component?.contextLlmTemperature ?? 0.2,
        flowId: currentFlowId,
        agentId: currentAgentId,
        flowTitle: config.title,
        stepTitle: selectedStep.title,
      });
      setContextScriptGenerated(result.code || '');
      setContextScriptGeneratedExplanation(result.explanation || '');
    } catch (error) {
      setContextScriptGenerateError(error instanceof Error ? error.message : 'Nao foi possivel gerar o codigo.');
    } finally {
      setContextScriptGenerating(false);
    }
  };
  const copyGeneratedContextScript = async () => {
    if (!contextScriptGenerated) return;
    await navigator.clipboard.writeText(contextScriptGenerated);
    setContextScriptCopied(true);
    window.setTimeout(() => setContextScriptCopied(false), 1800);
  };
  const applyGeneratedContextScript = () => {
    if (!contextScriptGenerated) return;
    updateRagComponent({ contextScript: contextScriptGenerated });
  };
  const richMessage = selectedStep.richMessage || {
    type: 'buttons' as RichMessageType,
    text: selectedStep.instruction || 'Escolha uma opcao:',
    footer: '',
    media: {
      url: '',
      fileName: '',
      mimeType: '',
    },
    buttons: [],
    quickReplies: [],
    list: { buttonText: 'Ver opções', sections: [] },
    carousel: { cards: [] },
    appointmentFlow: DEFAULT_APPOINTMENT_FLOW,
    generation: {
      enabled: false,
      prompt: 'Gere opções objetivas em pt-BR com base no contexto da conversa e no texto principal.',
      model: '',
      maxItems: 3,
    },
  };
  const updateRichMessage = (patch: Partial<NonNullable<FlowStep['richMessage']>>) => {
    updateStep({ richMessage: { ...richMessage, ...patch } });
  };
  const richIsMedia = richMessage.type === 'image' || richMessage.type === 'document';
  const richSupportsGeneration = richMessage.type !== 'appointmentFlow' && !richIsMedia;
  const richTextLabel = richIsMedia ? 'Legenda' : 'Texto principal';
  const richTextPlaceholder = richIsMedia
    ? 'Texto opcional enviado como legenda da mídia'
    : 'Texto enviado antes dos elementos interativos';
  const updateRichGeneration = (patch: Partial<NonNullable<NonNullable<FlowStep['richMessage']>['generation']>>) => {
    updateRichMessage({
      generation: {
        enabled: false,
        prompt: 'Gere opções objetivas em pt-BR com base no contexto da conversa e no texto principal.',
        maxItems: 3,
        ...(richMessage.generation || {}),
        ...patch,
      },
    });
  };
  const richGenerationEnabled = richSupportsGeneration && richMessage.generation?.enabled === true;
  const richGenerationMaxItems = richMaxItems(richMessage.type);
  const ragRounds = selectedStep.component?.extraFieldsFilterPerRound || [];
  const ragRoundLimits = selectedStep.component?.extraFieldsFilterPerRoundLimits || [];
  const ragConditionalRules = Array.isArray(selectedStep.component?.ragConditionalRules)
    ? selectedStep.component.ragConditionalRules
    : [];
  const extraFieldsFilterRules = normalizeExtraFieldsFilterRules(
    selectedStep.component?.extraFieldsFilter || {},
    selectedStep.component?.extraFieldsFilterRules,
  );
  const updateExtraFieldsFilterRules = (rules: ExtraFieldsFilterRule[]) => {
    updateRagComponent({
      extraFieldsFilterRules: rules,
      extraFieldsFilter: getUnconditionalExtraFieldsFilter(rules),
    });
  };
  const cronLog = selectedStep.component?.cronExecutionLog || [];
  const cronTimezone = selectedStep.component?.cronTimezone || 'America/Sao_Paulo';
  const webhookMode = selectedStep.component?.webhookMode || 'inbound';
  const webhookId = selectedStep.component?.webhookId || selectedStep.id;
  const webhookUrl = `${CANVAS_FLOW_API_URL}/api/canvas-flow/webhook/custom/${currentFlowId || '<FLOW_ID_SALVO>'}/${webhookId || '<WEBHOOK_ID>'}`;
  const webhookAuthMode = selectedStep.component?.webhookAuthMode || 'none';
  const webhookHeaderName = selectedStep.component?.webhookHeaderName || 'x-canvas-flow-webhook-secret';
  const webhookQueryParam = selectedStep.component?.webhookQueryParam || 'secret';
  const webhookResponseMode = selectedStep.component?.webhookResponseMode || 'sync';
  const webhookCallbackAuthMode = selectedStep.component?.webhookCallbackAuthMode || 'none';
  const webhookCallbackHeaderName = selectedStep.component?.webhookCallbackHeaderName || 'x-canvas-flow-callback-secret';
  const webhookListenerFireAndForget = selectedStep.component?.webhookListenerFireAndForget !== false;
  const webhookBodyExample = createWebhookBodyExample({
    flowId: currentFlowId,
    flowName: config.title,
    agentId: currentAgentId,
    channel: config.channel || 'webWidget',
    currentStepId: selectedStep.id,
    startMode: selectedStep.component?.webhookStartMode || 'node',
  });
  const webhookCurlExample = createWebhookCurlExample(webhookUrl, webhookAuthMode, webhookHeaderName, webhookQueryParam, webhookBodyExample);
  const webhookAsyncResponseExample = createWebhookAsyncResponseExample(currentFlowId, webhookId);
  const webhookCallbackExample = createWebhookCallbackExample(currentFlowId, webhookId);
  const mcpMode = selectedMcpMode;
  const mcpInputSchemaError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpInputSchema || '{}') : '';
  const mcpOutputSchemaError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpOutputSchema || '{}') : '';
  const mcpHeadersError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpApiHeadersJson || '{}') : '';
  const mcpQueryError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpApiQueryJson || '{}') : '';
  const mcpBodyError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpApiBodyJson || '{}') : '';
  const mcpApiRequestsError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpApiRequestsJson || '[]') : '';
  const mcpExternalHeadersError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpExternalHeadersJson || '{}') : '';
  const mcpExternalArgumentsError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpExternalArgumentsJson || '{}') : '';
  const mcpExternalPromptArgumentsError = selectedStep.component?.type === 'mcp' ? getPlainJsonError(selectedStep.component.mcpExternalPromptArgumentsJson || '{}') : '';
  const agentPlanJsonError = selectedStep.component?.type === 'agentPlan' ? getPlainJsonError(selectedStep.component.agentPlanJson || '{"plan": []}') : '';
  const mcpInputFields = selectedStep.component?.type === 'mcp' ? parseMcpSchemaFields(selectedStep.component.mcpInputSchema) : [];
  const mcpOutputFields = selectedStep.component?.type === 'mcp' ? parseMcpSchemaFields(selectedStep.component.mcpOutputSchema) : [];
  const mcpExternalArgumentSchema = selectedStep.component?.type === 'mcp'
    ? parseJson(selectedStep.component.mcpInputSchema || '{}', {})
    : {};
  const mcpExternalArgumentFields = mcpMode === 'external'
    && mcpExternalArgumentSchema
    && typeof mcpExternalArgumentSchema === 'object'
    && !Array.isArray(mcpExternalArgumentSchema)
    ? listMcpExternalArgumentFields(mcpExternalArgumentSchema as Record<string, unknown>)
    : [];
  const mcpApiAllowLlmRequest = selectedStep.component?.type === 'mcp'
    ? selectedStep.component.mcpApiAllowLlmRequest !== false
    : true;
  const mcpApiCanUseLlmRequest = selectedStep.component?.type === 'mcp'
    ? (selectedStep.component.mcpApiCallMode || 'single') !== 'multi' && mcpApiAllowLlmRequest
    : true;
  const mcpApiMapResultWithLlm = selectedStep.component?.type === 'mcp'
    ? selectedStep.component.mcpApiMapResultWithLlm !== false
    : true;
  const mcpExternalUseLlmArguments = selectedStep.component?.type === 'mcp'
    ? selectedStep.component.mcpExternalUseLlmArguments !== false
    : true;
  const mcpExternalMapResultWithLlm = selectedStep.component?.type === 'mcp'
    ? selectedStep.component.mcpExternalMapResultWithLlm !== false
    : true;
  const mcpUsesLlm = selectedStep.component?.type === 'mcp' && (
    mcpMode === 'fields' ||
    (mcpMode === 'api' && (mcpApiCanUseLlmRequest || mcpApiMapResultWithLlm)) ||
    (mcpMode === 'external' && (mcpExternalUseLlmArguments || mcpExternalMapResultWithLlm))
  );
  const updateMcpSchemaFields = (
    schemaKey: 'mcpInputSchema' | 'mcpOutputSchema',
    updater: (fields: McpSchemaField[]) => McpSchemaField[],
  ) => {
    const current = schemaKey === 'mcpInputSchema'
      ? selectedStep.component?.mcpInputSchema
      : selectedStep.component?.mcpOutputSchema;
    const nextFields = updater(parseMcpSchemaFields(current));
    updateRagComponent({ [schemaKey]: buildMcpSchema(nextFields) } as Partial<NonNullable<FlowStep['component']>>);
  };
  const addMcpSchemaField = (schemaKey: 'mcpInputSchema' | 'mcpOutputSchema') => {
    updateMcpSchemaFields(schemaKey, (fields) => [
      ...fields,
      createMcpSchemaField(fields, schemaKey === 'mcpInputSchema' ? 'entrada' : 'campo'),
    ]);
  };
  const updateMcpSchemaField = (
    schemaKey: 'mcpInputSchema' | 'mcpOutputSchema',
    index: number,
    patch: Partial<McpSchemaField>,
  ) => {
    updateMcpSchemaFields(schemaKey, (fields) => fields.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, ...patch } : field
    )));
  };
  const removeMcpSchemaField = (schemaKey: 'mcpInputSchema' | 'mcpOutputSchema', index: number) => {
    updateMcpSchemaFields(schemaKey, (fields) => fields.filter((_field, fieldIndex) => fieldIndex !== index));
  };
  const mongoOperation = selectedStep.component?.mongoOperation || 'insertOne';
  const mongoShowsFilter = MONGO_FILTER_OPERATIONS.has(mongoOperation);
  const mongoShowsDocument = MONGO_DOCUMENT_OPERATIONS.has(mongoOperation);
  const mongoShowsUpdate = MONGO_UPDATE_OPERATIONS.has(mongoOperation);
  const mongoShowsProjection = MONGO_PROJECTION_OPERATIONS.has(mongoOperation);
  const mongoShowsSort = MONGO_SORT_OPERATIONS.has(mongoOperation);
  const mongoShowsLimit = MONGO_LIMIT_OPERATIONS.has(mongoOperation);
  const mongoShowsPagination = MONGO_PAGINATION_OPERATIONS.has(mongoOperation);
  const mongoShowsDateRange = MONGO_DATE_RANGE_OPERATIONS.has(mongoOperation);
  const mongoLlmFullOnly = MONGO_LLM_FULL_ONLY_OPERATIONS.has(mongoOperation);
  const mongoLlmPlaceholder = mongoShowsDocument
    ? 'Ex: gere o documento de evento com intent, texto do usuário e dados do contexto.'
    : mongoShowsUpdate
      ? 'Ex: encontre o lead pelo email em context.slots.email e atualize o status para convertido.'
      : 'Ex: busque entradas do funil de ontem com intent PEDIR_PIZZA e ordene pelas mais recentes.';
  const generateMongoConfig = async () => {
    const instruction = mongoAiPrompt.trim();
    if (!instruction || mongoAiGenerating) return;

    setMongoAiGenerating(true);
    setMongoAiError('');
    setMongoAiCopied(false);
    try {
      const result = await canvasApi.generateMongoConfig({
        instruction,
        operation: mongoOperation,
        collectionName: selectedStep.component?.mongoCollectionName || selectedStep.component?.collectionName || 'flow_events',
        model: selectedStep.component?.mongoLlmModel || config.model,
        llmProvider: config.llmProvider || 'openai',
        flowId: currentFlowId,
        agentId: currentAgentId,
        flowTitle: config.title,
        stepTitle: selectedStep.title,
        currentConfig: {
          filter: selectedStep.component?.mongoFilter,
          sort: selectedStep.component?.mongoSort,
          projection: selectedStep.component?.mongoProjection,
          pipeline: selectedStep.component?.mongoPipeline,
          document: selectedStep.component?.mongoDocument,
          update: selectedStep.component?.mongoUpdate,
          dateRange: {
            field: selectedStep.component?.mongoDateField,
            start: selectedStep.component?.mongoDateStart,
            end: selectedStep.component?.mongoDateEnd,
            timezone: selectedStep.component?.mongoDateTimezone,
          },
          pagination: {
            mode: selectedStep.component?.mongoPaginationMode,
            page: selectedStep.component?.mongoPage,
            limit: selectedStep.component?.mongoLimit,
            skip: selectedStep.component?.mongoSkip,
            maxPages: selectedStep.component?.mongoMaxPages,
          },
        },
      });
      setMongoAiGenerated(result);
    } catch (error) {
      setMongoAiError(error instanceof Error ? error.message : 'Nao foi possivel gerar o MongoDB.');
    } finally {
      setMongoAiGenerating(false);
    }
  };
  const copyGeneratedMongoConfig = async () => {
    const payload = getMongoGeneratedPayload(mongoAiGenerated);
    if (!payload) return;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setMongoAiCopied(true);
    window.setTimeout(() => setMongoAiCopied(false), 1800);
  };
  const applyGeneratedMongoConfig = () => {
    const payload = getMongoGeneratedPayload(mongoAiGenerated);
    if (!payload) return;

    const patch: Partial<NonNullable<FlowStep['component']>> = {};
    if (mongoShowsFilter && payload.filter !== undefined) patch.mongoFilter = stringifyMongoValue(payload.filter);
    if (mongoShowsSort && payload.sort !== undefined) patch.mongoSort = stringifyMongoValue(payload.sort);
    if (mongoShowsProjection && payload.projection !== undefined) patch.mongoProjection = stringifyMongoValue(payload.projection);
    if (mongoOperation === 'aggregate' && payload.pipeline !== undefined) patch.mongoPipeline = stringifyMongoValue(payload.pipeline, '[]');
    if (mongoShowsDocument) {
      const documentValue = mongoOperation === 'insertMany' && payload.documents !== undefined
        ? payload.documents
        : payload.document ?? payload.documents;
      if (documentValue !== undefined) patch.mongoDocument = stringifyMongoValue(documentValue, mongoOperation === 'insertMany' ? '[]' : '{}');
    }
    if (mongoShowsUpdate && payload.update !== undefined) patch.mongoUpdate = stringifyMongoValue(payload.update);

    const dateRange = payload.dateRange && typeof payload.dateRange === 'object' && !Array.isArray(payload.dateRange)
      ? payload.dateRange as Record<string, unknown>
      : null;
    if (dateRange) {
      if (dateRange.field !== undefined) patch.mongoDateField = String(dateRange.field || '');
      if (dateRange.start !== undefined) patch.mongoDateStart = String(dateRange.start || '');
      if (dateRange.end !== undefined) patch.mongoDateEnd = String(dateRange.end || '');
      if (dateRange.timezone !== undefined) patch.mongoDateTimezone = String(dateRange.timezone || 'America/Sao_Paulo');
    }

    const pagination = payload.pagination && typeof payload.pagination === 'object' && !Array.isArray(payload.pagination)
      ? payload.pagination as Record<string, unknown>
      : null;
    if (pagination) {
      if (pagination.mode === 'single' || pagination.mode === 'all') patch.mongoPaginationMode = pagination.mode;
      if (pagination.page !== undefined) patch.mongoPage = Math.max(1, Number(pagination.page) || 1);
      if (pagination.limit !== undefined) patch.mongoLimit = Math.max(1, Math.min(1000, Number(pagination.limit) || 50));
      if (pagination.skip !== undefined) patch.mongoSkip = Math.max(0, Number(pagination.skip) || 0);
      if (pagination.maxPages !== undefined) patch.mongoMaxPages = Math.max(1, Math.min(50, Number(pagination.maxPages) || 1));
    }

    updateRagComponent(patch);
  };

  return (
    <>
    <aside className="inspector">
      <div className="inspector-title">{selectedStep.title || selectedStep.type}</div>
      <div className={`start-step-panel ${config.startStepId === selectedStep.id ? 'active' : ''}`}>
        <div>
          <strong>{config.startStepId === selectedStep.id ? 'Nó inicial' : 'Este nó não é o início'}</strong>
          <span>{config.startStepId === selectedStep.id ? 'O teste do fluxo começa por aqui.' : 'Use isto quando quiser testar este trecho ou um ciclo isolado.'}</span>
        </div>
        {config.startStepId !== selectedStep.id && (
          <button type="button" onClick={() => onUpdateConfig({ startStepId: selectedStep.id })}>
            Definir como início
          </button>
        )}
      </div>
      <label>
        Título
        <input value={selectedStep.title} onChange={(event) => updateStep({ title: event.target.value })} />
      </label>
      <TagEditor
        tags={selectedStep.tags || []}
        onChange={(tags) => updateStep({ tags })}
      />
      {selectedStep.type !== 'richMessage' && selectedStep.type !== 'condition' && (
        <label>
          <span className="prompt-field-label-row">
            <span>Instrucao</span>
            <FieldAiButton
              onClick={() => openPromptFieldAssistant({
                fieldType: 'instruction',
                targetType: selectedStep.component?.type === 'openaiGen' || selectedStep.component?.type === 'azureOpenAI'
                  ? 'agent-node'
                  : selectedStep.component?.type === 'mcp'
                    ? 'mcp-node'
                    : 'flow-node',
                title: 'Gerar instrucao',
                label: selectedStep.title || selectedStep.type,
                currentValue: selectedStep.instruction || '',
                placeholder: selectedStep.component?.type === 'mcp'
                  ? 'Ex: descreva como este MCP deve usar CPF e data de nascimento do contexto, chamar a API e salvar apenas campos reais no output.'
                  : selectedStep.component?.type === 'openaiGen'
                    ? 'Ex: este agente deve perguntar um dado por vez, chamar MCPs apenas quando tiver campos obrigatorios e responder sem termos tecnicos.'
                    : 'Ex: descreva o que este no deve fazer no fluxo, com entrada, saida esperada e limites.',
                applyText: (text) => updateStep({ instruction: text }),
                stepContext: {
                  id: selectedStep.id,
                  title: selectedStep.title,
                  type: selectedStep.type,
                  componentType: selectedStep.component?.type || '',
                  responseName: selectedStep.responseName || selectedStep.component?.responseName || '',
                },
              }, selectedStep.instruction ? 'Melhore esta instrucao mantendo-a separada de Agents.md, guardrails e termos bloqueados.' : '', selectedStep.component?.ragLlmModel || selectedStep.component?.mcpModel || config.model)}
            />
          </span>
          <textarea rows={4} value={selectedStep.instruction} onChange={(event) => updateStep({ instruction: event.target.value })} />
        </label>
      )}
      {selectedStep.type !== 'message' && selectedStep.type !== 'richMessage' && selectedStep.type !== 'end' && selectedStep.type !== 'group' && (
        <label>
          responseName
          <input value={selectedStep.responseName || ''} onChange={(event) => updateStep({ responseName: event.target.value })} />
        </label>
      )}
      {selectedStep.type === 'input' && (
        <div className="rich-message-editor">
          <label>
            Validação do input
            <select
              value={selectedStep.inputValidationMode || 'none'}
              onChange={(event) => updateStep({ inputValidationMode: event.target.value as InputValidationMode })}
            >
              <option value="none">Sem validação</option>
              <option value="type">Tipo do dado</option>
              <option value="regex">Regex</option>
              <option value="llm">Instrução LLM</option>
            </select>
          </label>

          {selectedStep.inputValidationMode === 'type' && (
            <label>
              Tipo esperado
              <select
                value={selectedStep.inputValidationType || 'text'}
                onChange={(event) => updateStep({ inputValidationType: event.target.value as InputValidationType })}
              >
                {INPUT_VALIDATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedStep.inputValidationMode === 'regex' && (
            <label>
              Regex de validação
              <input
                value={selectedStep.inputValidationRegex || ''}
                placeholder="^[A-Z]{3}-\\d{4}$"
                onChange={(event) => updateStep({ inputValidationRegex: event.target.value })}
              />
            </label>
          )}

          {selectedStep.inputValidationMode === 'llm' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Validação por IA</strong>
              </div>
              <label>
                Instrução LLM
                <textarea
                  rows={5}
                  value={selectedStep.inputValidationLlmInstruction || ''}
                  placeholder="Ex: valide se o usuário informou uma data de nascimento real no formato brasileiro."
                  onChange={(event) => updateStep({ inputValidationLlmInstruction: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Modelo
                  <select
                    value={selectedStep.inputValidationLlmModel || ''}
                    onChange={(event) => updateStep({ inputValidationLlmModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedStep.inputValidationLlmTemperature ?? 0}
                    onChange={(event) => updateStep({ inputValidationLlmTemperature: Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="filter-empty">
                A IA pode devolver um valor normalizado e slots extras. Se retornar inválido, o fluxo pergunta novamente.
              </div>
            </div>
          )}

          {(selectedStep.inputValidationMode || 'none') !== 'none' && (
            <>
              <label>
                Mensagem quando inválido
                <input
                  value={selectedStep.inputValidationErrorMessage || ''}
                  placeholder="Valor inválido. Informe novamente."
                  onChange={(event) => updateStep({ inputValidationErrorMessage: event.target.value })}
                />
              </label>
              <label>
                Slot do motivo
                <input
                  value={selectedStep.inputValidationReasonResponseName || ''}
                  placeholder={`${selectedStep.responseName || 'input'}_validation_reason`}
                  onChange={(event) => updateStep({ inputValidationReasonResponseName: event.target.value })}
                />
                <ReasonSlotHint
                  slotName={selectedStep.inputValidationReasonResponseName || `${selectedStep.responseName || 'input'}_validation_reason`}
                  resultName={selectedStep.responseName || 'input'}
                />
              </label>
            </>
          )}
        </div>
      )}
      {selectedStep.type === 'message' && (
        <div className="rich-message-editor">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.messageUseLlm === true}
              onChange={(event) => updateStep({ messageUseLlm: event.target.checked })}
            />
            Formatar resposta com LLM
          </label>
          {selectedStep.messageUseLlm === true && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Formatacao por IA</strong>
              </div>
              <div className="filter-empty">
                A instrução acima vira o prompt do modelo. Use variáveis como {'{{context.slots.item}}'} e a IA retorna somente a mensagem final para o usuário.
              </div>
              <div className="inspector-grid-two">
                <label>
                  Modelo
                  <select
                    value={selectedStep.messageLlmModel || ''}
                    onChange={(event) => updateStep({ messageLlmModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedStep.messageLlmTemperature ?? 0.4}
                    onChange={(event) => updateStep({ messageLlmTemperature: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label>
                Salvar resposta em slot
                <input
                  value={selectedStep.responseName || ''}
                  placeholder="mensagem_formatada"
                  onChange={(event) => updateStep({ responseName: event.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      )}
      {selectedStep.type === 'group' && (
        <div className="filter-empty">Selecione o encapsulador no canvas e arraste as bordas para redimensionar.</div>
      )}
      {selectedStep.type === 'condition' && (
        <div className="rich-message-editor">
          <label>
            Modo da condição
            <select
              value={selectedStep.conditionMode || 'js'}
              onChange={(event) => updateStep({ conditionMode: event.target.value as FlowStep['conditionMode'] })}
            >
              <option value="js">Regra JS</option>
              <option value="llm">Instrução LLM</option>
            </select>
          </label>

          {(selectedStep.conditionMode || 'js') === 'js' && (
            <label>
              Condição JS
              <textarea
                rows={4}
                value={selectedStep.instruction || selectedStep.condition || ''}
                placeholder={'context.slots.input === "ok"'}
                onChange={(event) => updateStep({ condition: event.target.value, instruction: event.target.value })}
              />
            </label>
          )}

          {selectedStep.conditionMode === 'llm' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Decisao por LLM</strong>
              </div>
              <label>
                Instrução LLM
                <textarea
                  rows={5}
                  value={selectedStep.instruction || selectedStep.condition || ''}
                  placeholder="Ex: retorne verdadeiro se o usuário confirmou que quer continuar; caso contrário retorne falso."
                  onChange={(event) => updateStep({ condition: event.target.value, instruction: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Modelo
                  <select
                    value={selectedStep.conditionModel || ''}
                    onChange={(event) => updateStep({ conditionModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedStep.conditionTemperature ?? 0}
                    onChange={(event) => updateStep({ conditionTemperature: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label>
                Slot do motivo
                <input
                  value={selectedStep.conditionReasonResponseName || ''}
                  placeholder={`${selectedStep.responseName || 'condition'}_reason`}
                  onChange={(event) => updateStep({ conditionReasonResponseName: event.target.value })}
                />
                <ReasonSlotHint
                  slotName={selectedStep.conditionReasonResponseName || `${selectedStep.responseName || 'condition'}_reason`}
                  resultName={selectedStep.responseName || 'condition'}
                />
              </label>
              <div className="filter-empty">
                Helper: campo opcional para salvar a explicação do LLM sobre a decisão. Exemplo: se o responseName for condition, o true/false fica em context.slots.condition e o motivo fica em context.slots.{selectedStep.conditionReasonResponseName || `${selectedStep.responseName || 'condition'}_reason`}.
              </div>
            </div>
          )}
        </div>
      )}
      {selectedStep.type === 'richMessage' && (
        <div className="rich-message-editor">
          <label>
            Tipo de mensagem
            <select
              value={richMessage.type}
              onChange={(event) => {
                const nextType = event.target.value as RichMessageType;
                const maxItems = richMaxItems(nextType);
                updateRichMessage({
                  type: nextType,
                  ...(nextType === 'appointmentFlow' && !richMessage.appointmentFlow
                    ? { appointmentFlow: DEFAULT_APPOINTMENT_FLOW }
                    : {}),
                  ...((nextType === 'image' || nextType === 'document') && !richMessage.media
                    ? { media: { url: '', fileName: '', mimeType: '' } }
                    : {}),
                  generation: richMessage.generation
                    ? {
                        ...richMessage.generation,
                        enabled: nextType === 'appointmentFlow' || nextType === 'image' || nextType === 'document'
                          ? false
                          : richMessage.generation.enabled,
                        maxItems: Math.min(Number(richMessage.generation.maxItems || 3), maxItems),
                      }
                    : richMessage.generation,
                });
              }}
            >
              <option value="text">Texto</option>
              <option value="buttons">Botões</option>
              <option value="quickReplies">Quick replies</option>
              <option value="list">Lista</option>
              <option value="carousel">Carrossel</option>
              <option value="image">Imagem</option>
              <option value="document">Documento</option>
              <option value="appointmentFlow">WhatsApp Flow agendamento</option>
            </select>
          </label>
          {richSupportsGeneration && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={richGenerationEnabled}
                onChange={(event) => updateRichGeneration({ enabled: event.target.checked })}
              />
              <span>Gerar componentes com LLM</span>
            </label>
          )}

          {!richGenerationEnabled && (
            <>
              <label>
                {richTextLabel}
                <textarea
                  rows={4}
                  value={richMessage.text || ''}
                  placeholder={richTextPlaceholder}
                  maxLength={WHATSAPP_LIMITS.interactiveBody}
                  onChange={(event) => {
                    updateRichMessage({ text: event.target.value });
                    updateStep({ instruction: event.target.value });
                  }}
                />
              </label>
              <label>
                Rodapé
                <input
                  value={richMessage.footer || ''}
                  placeholder="Opcional"
                  maxLength={WHATSAPP_LIMITS.footer}
                  onChange={(event) => updateRichMessage({ footer: event.target.value })}
                />
              </label>
              <div className="filter-empty">
                WhatsApp: texto até {WHATSAPP_LIMITS.interactiveBody} caracteres, rodapé até {WHATSAPP_LIMITS.footer}, botões até {WHATSAPP_LIMITS.buttons}, lista até {WHATSAPP_LIMITS.listRows} itens.
              </div>
              {richIsMedia && (
                <div className="rich-editor-block nested">
                  <div className="filter-section-header">
                    <strong>{richMessage.type === 'image' ? 'Imagem' : 'Documento'}</strong>
                  </div>
                  <label>
                    URL pública da {richMessage.type === 'image' ? 'imagem' : 'mídia'}
                    <input
                      value={richMessage.media?.url || ''}
                      placeholder={richMessage.type === 'image' ? '{{context.slots.imageUrl}}' : '{{context.slots.documentUrl}}'}
                      maxLength={WHATSAPP_LIMITS.imageUrl}
                      onChange={(event) => updateRichMessage({
                        media: {
                          ...(richMessage.media || {}),
                          url: event.target.value,
                        },
                      })}
                    />
                  </label>
                  <div className="inspector-grid-two">
                    {richMessage.type === 'document' && (
                      <label>
                        Nome do arquivo
                        <input
                          value={richMessage.media?.fileName || ''}
                          placeholder="arquivo.pdf"
                          onChange={(event) => updateRichMessage({
                            media: {
                              ...(richMessage.media || {}),
                              fileName: event.target.value,
                            },
                          })}
                        />
                      </label>
                    )}
                    <label>
                      Tipo MIME
                      <input
                        value={richMessage.media?.mimeType || ''}
                        placeholder={richMessage.type === 'image' ? 'image/jpeg' : 'application/pdf'}
                        onChange={(event) => updateRichMessage({
                          media: {
                            ...(richMessage.media || {}),
                            mimeType: event.target.value,
                          },
                        })}
                      />
                    </label>
                  </div>
                  <div className="filter-empty">
                    Use uma URL HTTPS acessível pelo provedor. A API Oficial envia como {richMessage.type === 'image' ? 'imagem' : 'documento'}; a Sinch recebe o payload de mídia equivalente.
                  </div>
                </div>
              )}
            </>
          )}

          {richGenerationEnabled && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Geração por IA</strong>
              </div>
              <label>
                Prompt da geração
                <textarea
                  rows={5}
                  value={richMessage.generation?.prompt || ''}
                  placeholder="Ex: gere opções de atendimento com base no interesse do usuário em context.slots.userInput"
                  onChange={(event) => updateRichGeneration({ prompt: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Modelo para gerar
                  <select
                    value={richMessage.generation?.model || ''}
                    onChange={(event) => updateRichGeneration({ model: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Max itens
                  <input
                    type="number"
                    min={1}
                    max={richGenerationMaxItems}
                    value={richMessage.generation?.maxItems ?? 3}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 1;
                      updateRichGeneration({ maxItems: Math.max(1, Math.min(value, richGenerationMaxItems)) });
                    }}
                  />
                </label>
              </div>
              <div className="filter-empty">
                O LLM gera texto e componentes respeitando o limite do canal. Para este tipo: até {richGenerationMaxItems} item(ns).
              </div>
            </div>
          )}

          {!richGenerationEnabled && richMessage.type === 'buttons' && (
            <ActionEditor
              title="Botões"
              actions={richMessage.buttons || []}
              onChange={(buttons) => updateRichMessage({ buttons })}
            />
          )}

          {!richGenerationEnabled && richMessage.type === 'quickReplies' && (
            <ActionEditor
              title="Quick replies"
              actions={richMessage.quickReplies || []}
              onChange={(quickReplies) => updateRichMessage({ quickReplies })}
            />
          )}

          {!richGenerationEnabled && richMessage.type === 'list' && (
            <>
              <label>
                Texto do botão da lista
                <input
                  value={richMessage.list?.buttonText || ''}
                  placeholder="Ver opções"
                  maxLength={WHATSAPP_LIMITS.listButton}
                  onChange={(event) => updateRichMessage({
                    list: {
                      buttonText: event.target.value,
                      sections: richMessage.list?.sections || [],
                    },
                  })}
                />
              </label>
              <ListEditor
                sections={richMessage.list?.sections || []}
                onChange={(sections) => updateRichMessage({
                  list: {
                    buttonText: richMessage.list?.buttonText || 'Ver opções',
                    sections,
                  },
                })}
              />
            </>
          )}

          {!richGenerationEnabled && richMessage.type === 'carousel' && (
            <CarouselEditor
              cards={richMessage.carousel?.cards || []}
              onChange={(cards) => updateRichMessage({ carousel: { cards } })}
            />
          )}

          {!richGenerationEnabled && richMessage.type === 'appointmentFlow' && (
            <AppointmentFlowEditor
              appointmentFlow={richMessage.appointmentFlow}
              flowConfig={config}
              currentFlowId={currentFlowId}
              stepId={selectedStep.id}
              agentId={agentId}
              onChange={(appointmentFlow) => updateRichMessage({ appointmentFlow })}
            />
          )}
        </div>
      )}
      {selectedStep.type === 'api' && (
        <div className="rich-message-editor">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.api?.generation?.enabled === true}
              onChange={(event) => updateStep({
                api: {
                  responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                  requests: selectedStep.api?.requests || [],
                  generation: {
                    enabled: event.target.checked,
                    prompt: selectedStep.api?.generation?.prompt || 'Monte uma ou mais chamadas HTTP usando o contexto do fluxo.',
                    model: selectedStep.api?.generation?.model || '',
                    temperature: selectedStep.api?.generation?.temperature ?? 0.2,
                    fallbackToManual: selectedStep.api?.generation?.fallbackToManual ?? true,
                  },
                },
              })}
            />
            Montar requests com LLM
          </label>

          {selectedStep.api?.generation?.enabled === true && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Geração da API por IA</strong>
              </div>
              <label>
                Instrução para montar as chamadas
                <textarea
                  rows={5}
                  value={selectedStep.api?.generation?.prompt || ''}
                  placeholder="Ex: crie uma chamada POST para enviar context.slots.item para o CRM."
                  onChange={(event) => updateStep({
                    api: {
                      responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                      requests: selectedStep.api?.requests || [],
                      generation: {
                        enabled: true,
                        prompt: event.target.value,
                        model: selectedStep.api?.generation?.model || '',
                        temperature: selectedStep.api?.generation?.temperature ?? 0.2,
                        fallbackToManual: selectedStep.api?.generation?.fallbackToManual ?? true,
                      },
                    },
                  })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Modelo
                  <select
                    value={selectedStep.api?.generation?.model || ''}
                    onChange={(event) => updateStep({
                      api: {
                        responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                        requests: selectedStep.api?.requests || [],
                        generation: {
                          enabled: true,
                          prompt: selectedStep.api?.generation?.prompt || '',
                          model: event.target.value,
                          temperature: selectedStep.api?.generation?.temperature ?? 0.2,
                          fallbackToManual: selectedStep.api?.generation?.fallbackToManual ?? true,
                        },
                      },
                    })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedStep.api?.generation?.temperature ?? 0.2}
                    onChange={(event) => updateStep({
                      api: {
                        responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                        requests: selectedStep.api?.requests || [],
                        generation: {
                          enabled: true,
                          prompt: selectedStep.api?.generation?.prompt || '',
                          model: selectedStep.api?.generation?.model || '',
                          temperature: Number(event.target.value),
                          fallbackToManual: selectedStep.api?.generation?.fallbackToManual ?? true,
                        },
                      },
                    })}
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedStep.api?.generation?.fallbackToManual !== false}
                  onChange={(event) => updateStep({
                    api: {
                      responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                      requests: selectedStep.api?.requests || [],
                      generation: {
                        enabled: true,
                        prompt: selectedStep.api?.generation?.prompt || '',
                        model: selectedStep.api?.generation?.model || '',
                        temperature: selectedStep.api?.generation?.temperature ?? 0.2,
                        fallbackToManual: event.target.checked,
                      },
                    },
                  })}
                />
                Usar requests manuais como fallback
              </label>
              <div className="filter-empty">
                O LLM gera apenas o JSON do httpBatch, incluindo polling quando necessário. O executor ainda valida método, URL, headers, params e body antes de chamar.
              </div>
            </div>
          )}

          <HttpBatchEditor
            requests={selectedStep.api?.requests || []}
            onChange={(requests) => updateStep({
              api: {
                responseName: selectedStep.api?.responseName || selectedStep.responseName || 'api',
                requests,
                generation: selectedStep.api?.generation,
              },
            })}
          />
        </div>
      )}
      {selectedStep.component?.type === 'files' && (
        <div className="rich-message-editor">
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Arquivos</strong>
            </div>
            <div className="filter-empty">
              Envie arquivos ou informe uma URL. O original fica versionado no storage e o texto extraido fica em <code>context.slots.{selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}</code>.
            </div>
            <label>
              responseName
              <input
                value={selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}
                onChange={(event) => {
                  const responseName = event.target.value;
                  updateStep({
                    responseName,
                    component: { ...selectedStep.component!, responseName },
                  });
                }}
              />
            </label>
            <div className="inspector-grid-two">
              <label>
                Fonte
                <select
                  value={selectedStep.component.filesSourceMode || 'upload'}
                  onChange={(event) => updateRagComponent({ filesSourceMode: event.target.value as FilesSourceMode })}
                >
                  <option value="upload">Upload no fluxo</option>
                  <option value="url">URL existente</option>
                </select>
              </label>
              <label>
                Operacao
                <select
                  value={selectedStep.component.filesOperation || 'read'}
                  onChange={(event) => updateRagComponent({ filesOperation: event.target.value as FilesOperation })}
                >
                  <option value="read">Ler documentos</option>
                  <option value="generate">Gerar novo arquivo ou consolidar</option>
                  <option value="edit">Editar template e criar versao</option>
                </select>
              </label>
              <label>
                Saida
                <select
                  value={selectedStep.component.filesResultMode || 'context'}
                  onChange={(event) => updateRagComponent({ filesResultMode: event.target.value as FilesResultMode })}
                >
                  <option value="context">Salvar no contexto</option>
                  <option value="llm">LLM le e responde</option>
                </select>
              </label>
            </div>
          </div>

          {(selectedStep.component.filesSourceMode || 'upload') === 'upload' && (
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Upload</strong>
              </div>
              <input
                type="file"
                multiple
                accept="*/*"
                onChange={handleFilesUpload}
                disabled={filesUploading}
              />
              {filesUploading && (
                <span className="field-hint"><Loader2 size={14} className="spin" /> Armazenando e extraindo estrutura...</span>
              )}
              {filesUploadError && <span className="field-error">{filesUploadError}</span>}
              {filesUploaded.length > 0 && (
                <div className="selected-files">
                  {filesUploaded.map((file, index) => (
                    <span key={file.id || `${file.filename}-${index}`}>
                      {file.filename || file.title || `arquivo-${index + 1}`} ({file.textLength || file.text?.length || 0} chars)
                      {(file.documentId || file.id) && (
                        <button type="button" onClick={() => void downloadUploadedFile(file)} aria-label="Baixar arquivo">
                          <Download size={12} />
                        </button>
                      )}
                      <button type="button" onClick={() => removeUploadedFile(file.id, index)} aria-label="Remover arquivo">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedStep.component.filesSourceMode || 'upload') === 'url' && (
            <label>
              URL do arquivo
              <input
                value={selectedStep.component.filesUrlTemplate || ''}
                placeholder="https://site.com/arquivo.pdf"
                onChange={(event) => updateRagComponent({ filesUrlTemplate: event.target.value })}
              />
              <span className="field-hint">Use uma URL publica direta do arquivo. Para Google Drive, Docs ou Sheets privado, use um componente MCP separado.</span>
            </label>
          )}

          <div className="inspector-grid-two">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedStep.component.filesPreferOcr === true}
                onChange={(event) => updateRagComponent({ filesPreferOcr: event.target.checked })}
              />
              Usar OCR quando necessario
            </label>
            <label>
              Limite de texto por arquivo
              <input
                type="number"
                min={0}
                step={1000}
                value={selectedStep.component.filesMaxTextChars ?? 60000}
                onChange={(event) => updateRagComponent({ filesMaxTextChars: Number(event.target.value) || 0 })}
              />
            </label>
          </div>

          {(selectedStep.component.filesOperation || 'read') !== 'read' && (
            <div className="filter-section">
              <div className="filter-section-header">
                <strong>Artefato gerado</strong>
              </div>
              <div className="filter-empty">
                O componente cria um novo arquivo versionado. Em modo editar, use placeholders como <code>{'{{cliente.nome}}'}</code> ou descreva alteracoes estruturais em DOCX e XLSX.
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedStep.component.filesUseDocumentSkill !== false}
                  onChange={(event) => updateRagComponent({ filesUseDocumentSkill: event.target.checked })}
                />
                Usar Docs Skill especialista
              </label>
              <span className="field-hint">
                A skill planeja a entrega, escolhe secoes/tabelas, orienta a LLM e registra qualidade em <code>documentSkill</code> no resultado.
              </span>
              {filesHasAmbiguousEditTemplate && (
                <div className="filter-empty warning">
                  Ha varios arquivos enviados. Marque explicitamente qual deles e o template que sera editado. Para combinar o conteudo de todos em um novo documento, use Gerar novo arquivo ou consolidar.
                  <button type="button" onClick={() => updateRagComponent({ filesOperation: 'generate' })}>
                    Consolidar arquivos
                  </button>
                </div>
              )}
              {(selectedStep.component.filesOperation || 'read') === 'generate' && filesUploaded.length > 1 && (
                <div className="filter-empty">
                  Os arquivos enviados serao lidos como referencias para gerar um novo documento consolidado no formato escolhido abaixo.
                </div>
              )}
              <div className="inspector-grid-two">
                <label>
                  Formato de saida
                  <select
                    value={displayedFilesOutputFormat}
                    disabled={Boolean(filesNativeEditFormat)}
                    onChange={(event) => {
                      const format = event.target.value as FilesOutputFormat;
                      updateRagComponent({
                        filesOutputFormat: format,
                        filesOutputFilenameTemplate: withFilesOutputExtension(
                          selectedStep.component!.filesOutputFilenameTemplate || '',
                          format,
                        ),
                      });
                    }}
                  >
                    <option value="docx">DOCX</option>
                    <option value="xlsx">XLSX</option>
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="html">HTML</option>
                    <option value="md">Markdown</option>
                    <option value="txt">TXT</option>
                  </select>
                  {filesNativeEditFormat && (
                    <span className="field-hint">
                      Ao editar um template {filesNativeEditFormat.toUpperCase()}, o formato original e preservado. Para converter, use Gerar novo arquivo.
                    </span>
                  )}
                </label>
                <label>
                  Nome do novo arquivo
                  <input
                    value={displayedFilesOutputFilenameTemplate}
                    onChange={(event) => updateRagComponent({ filesOutputFilenameTemplate: event.target.value })}
                  />
                </label>
              </div>
              {(selectedStep.component.filesOperation || 'read') === 'edit' && (
                <>
                  <div className="template-files-list">
                    <strong>Documentos template</strong>
                    <span className="field-hint">
                      Marque um ou mais arquivos que serao editados. Quando houver varios uploads, a selecao e obrigatoria. Arquivos nao marcados continuam disponiveis como referencia para a LLM.
                    </span>
                    {!filesUploaded.length && <div className="filter-empty">Envie ao menos um arquivo template.</div>}
                    {filesUploaded.map((file, index) => {
                      const documentId = String(file.documentId || file.id || '');
                      return (
                        <label className="checkbox-row" key={documentId || index}>
                          <input
                            type="checkbox"
                            checked={selectedFilesTemplateDocumentIds.includes(documentId)}
                            disabled={!documentId}
                            onChange={() => toggleFilesTemplateDocument(documentId)}
                          />
                          {file.filename || file.title || `arquivo-${index + 1}`}
                        </label>
                      );
                    })}
                  </div>
                  <label>
                    Valores para placeholders
                    <textarea
                      rows={5}
                      value={typeof selectedStep.component.filesTemplateValuesJson === 'string'
                        ? selectedStep.component.filesTemplateValuesJson
                        : JSON.stringify(selectedStep.component.filesTemplateValuesJson || {}, null, 2)}
                      placeholder={'{"cliente.nome":"{{context.slots.cliente.nome}}"}'}
                      onChange={(event) => updateRagComponent({ filesTemplateValuesJson: event.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                Conteudo pronto avancado (opcional)
                <textarea
                  rows={5}
                  value={selectedStep.component.filesContentTemplate || ''}
                  placeholder="Deixe vazio para a LLM interpretar a instrucao abaixo. Preencha somente quando ja tiver o conteudo final pronto."
                  onChange={(event) => updateRagComponent({ filesContentTemplate: event.target.value })}
                />
              </label>
              {String(selectedStep.component.filesContentTemplate || '').trim() && (
                <div className="filter-empty warning">
                  Este campo esta preenchido: a LLM nao sera chamada para interpretar a alteracao. Use-o somente para conteudo final pronto.
                  <button type="button" onClick={() => updateRagComponent({ filesContentTemplate: '' })}>
                    Limpar e usar LLM
                  </button>
                </div>
              )}
              <label>
                Instrucao para gerar ou editar
                <textarea
                  rows={5}
                  value={selectedStep.component.filesGenerationPrompt || ''}
                  placeholder="Leia os contratos conectados e gere a nova versao solicitada pelo usuario."
                  onChange={(event) => updateRagComponent({ filesGenerationPrompt: event.target.value })}
                />
                <span className="field-hint">
                  Em DOCX com varias tabelas, informe qual tabela alterar. Em XLSX, informe a aba e as celulas ou colunas desejadas, por exemplo: preencher os totais na aba Total acumulado.
                </span>
              </label>
            </div>
          )}

          <div className="filter-section">
            <div className="filter-section-header">
              <strong>LLM do componente Arquivos</strong>
            </div>
            <div className="filter-empty">
              {filesUsesLlm
                ? 'LLM ativa nesta etapa. Se nenhum modelo for escolhido, este componente usa o modelo configurado no fluxo.'
                : 'LLM inativa nesta configuracao. Ela sera usada ao selecionar LLM le e responde ou ao gerar/editar com Conteudo direto opcional vazio.'}
            </div>
            {filesUsesLlm && (
              <label>
                Pergunta para a LLM
                <input
                  value={selectedStep.component.filesQuestionTemplate || '{{context.slots.userInput}}'}
                  onChange={(event) => updateRagComponent({ filesQuestionTemplate: event.target.value })}
                />
              </label>
            )}
            {filesUsesLlm && (selectedStep.component.filesOperation || 'read') === 'read' && (
              <label>
                Prompt
                <textarea
                  rows={4}
                  value={selectedStep.component.filesLlmPrompt || 'Leia os arquivos conectados e responda ao usuario em pt-BR de forma objetiva.'}
                  onChange={(event) => updateRagComponent({ filesLlmPrompt: event.target.value })}
                />
              </label>
            )}
            <div className="inspector-grid-two">
              <label>
                Provider
                <select
                  value={selectedStep.component.filesLlmProvider || 'auto'}
                  onChange={(event) => {
                    const provider = event.target.value as RagModelProvider;
                    updateRagComponent({
                      filesLlmProvider: provider,
                      filesLlmModel: provider === 'auto' ? '' : getDefaultLlmModelForProvider(provider as FlowLlmProvider),
                    });
                  }}
                >
                  <option value="auto">Auto/global</option>
                  <option value="openai">OpenAI</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="claude">Claude</option>
                  <option value="grok">Grok</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </label>
              <label>
                Modelo
                <select
                  value={selectedStep.component.filesLlmModel || ''}
                  onChange={(event) => updateRagComponent({ filesLlmModel: event.target.value })}
                >
                  <option value="">Usar modelo do fluxo ({config.model})</option>
                  {modelOptionsForProvider(selectedStep.component.filesLlmProvider || 'auto', selectedStep.component.filesLlmModel).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Temperatura
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={selectedStep.component.filesLlmTemperature ?? 0.2}
                  onChange={(event) => updateRagComponent({ filesLlmTemperature: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="mcp-output-hint">
            Proximo no: use <code>{`{{context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}.text}}`}</code>, configure um Agente com docs em <code>{`context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}.documents`}</code> ou envie <code>{`{{context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}.artifact.downloadUrl}}`}</code>. Em edicao multipla, a lista completa fica em <code>{`context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'arquivos'}.artifacts`}</code>.
          </div>
        </div>
      )}
      {selectedStep.component?.type === 'agentPlan' && (
        <div className="rich-message-editor">
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Agent Plan</strong>
            </div>
            <div className="filter-empty">
              Coloque este no antes do Agente. Ele salva um contrato de planejamento em <code>context.slots.agentPlan</code>; o orquestrador usa isso para decidir quais skills, subagents e MCP chamar.
            </div>
            <label>
              responseName
              <input
                value={selectedStep.component.responseName || selectedStep.responseName || 'agentPlan'}
                onChange={(event) => {
                  const responseName = event.target.value;
                  updateStep({
                    responseName,
                    component: { ...selectedStep.component!, responseName },
                  });
                }}
              />
            </label>
            <div className="inspector-grid-two">
              <label>
                Modo
                <select
                  value={selectedStep.component.agentPlanMode || 'advisory'}
                  onChange={(event) => updateRagComponent({ agentPlanMode: event.target.value as AgentPlanMode })}
                >
                  <option value="advisory">Orientar planejamento</option>
                  <option value="manual">Plano manual</option>
                </select>
              </label>
              <label>
                Limite de chamadas sugerido
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={selectedStep.component.agentPlanMaxToolCalls ?? 3}
                  onChange={(event) => updateRagComponent({ agentPlanMaxToolCalls: Number(event.target.value) || 1 })}
                />
              </label>
            </div>
            <label>
              Instrucoes do plano
              <textarea
                rows={6}
                value={selectedStep.component.agentPlanInstructions || ''}
                placeholder={'Ex: quebre pedidos com varias intencoes em uma chamada por tool.\nEx: resumo deve usar somente skill de resumo; traducao deve usar somente skill de traducao.'}
                onChange={(event) => updateRagComponent({ agentPlanInstructions: event.target.value })}
              />
            </label>
            {(selectedStep.component.agentPlanMode || 'advisory') === 'manual' && (
              <label>
                Plano JSON
                <textarea
                  rows={8}
                  value={selectedStep.component.agentPlanJson || '{\n  "plan": []\n}'}
                  placeholder={'{\n  "plan": [\n    { "action": "tool", "toolId": "canvas:...", "arguments": { "text": "{{context.slots.userInput}}" }, "reason": "..." }\n  ]\n}'}
                  onChange={(event) => updateRagComponent({ agentPlanJson: event.target.value })}
                />
                {agentPlanJsonError && <span className="field-error">{agentPlanJsonError}</span>}
              </label>
            )}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedStep.component.agentPlanClearAfterUse !== false}
                onChange={(event) => updateRagComponent({ agentPlanClearAfterUse: event.target.checked })}
              />
              <span>Consumir apenas pelo proximo Agente</span>
            </label>
            <div className="mcp-output-hint">
              O trace continua mostrando <code>agentPlan</code>, mas agora o criterio pode ser editado aqui no canvas.
            </div>
          </div>
        </div>
      )}
      {selectedStep.component?.type === 'approval' && (
        <div className="rich-message-editor">
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Aprovação humana</strong>
            </div>
            <div className="filter-empty">
              Este nó pausa a execução antes de ações sensíveis. O fluxo continua quando o operador responder com a palavra de aprovação ou quando a API enviar approvals pelo payload.
            </div>
            <label>
              responseName
              <input
                value={selectedStep.component.responseName || selectedStep.responseName || 'aprovacao'}
                onChange={(event) => {
                  const responseName = event.target.value;
                  updateStep({
                    responseName,
                    component: { ...selectedStep.component!, responseName },
                  });
                }}
              />
            </label>
            <label>
              Título da aprovação
              <input
                value={selectedStep.component.approvalTitle || ''}
                placeholder="Aprovar cancelamento"
                onChange={(event) => updateRagComponent({ approvalTitle: event.target.value })}
              />
            </label>
            <label>
              Descrição para o operador
              <textarea
                rows={4}
                value={selectedStep.component.approvalDescription || selectedStep.instruction || ''}
                placeholder="Revise os dados do cliente, valor e motivo antes de continuar."
                onChange={(event) => updateRagComponent({ approvalDescription: event.target.value })}
              />
            </label>
            <div className="inspector-grid-two">
              <label>
                Risco
                <select
                  value={selectedStep.component.approvalRisk || 'medium'}
                  onChange={(event) => updateRagComponent({ approvalRisk: event.target.value as NonNullable<FlowStep['component']>['approvalRisk'] })}
                >
                  <option value="low">Baixo</option>
                  <option value="medium">Médio</option>
                  <option value="high">Alto</option>
                  <option value="critical">Crítico</option>
                </select>
              </label>
              <label>
                Responsável
                <input
                  value={selectedStep.component.approvalApproverHint || ''}
                  placeholder="Supervisor de atendimento"
                  onChange={(event) => updateRagComponent({ approvalApproverHint: event.target.value })}
                />
              </label>
            </div>
            <label>
              Escopos/permissões
              <input
                value={(selectedStep.component.approvalScopes || []).join(', ')}
                placeholder="write, external_api, billing"
                onChange={(event) => updateRagComponent({
                  approvalScopes: event.target.value
                    .split(',')
                    .map((scope) => scope.trim())
                    .filter(Boolean),
                })}
              />
              <span className="field-hint">Use nomes curtos para auditoria, como <code>write</code>, <code>delete</code>, <code>billing</code> ou <code>whatsapp_broadcast</code>.</span>
            </label>
            <div className="inspector-grid-two">
              <label>
                Palavra para aprovar
                <input
                  value={selectedStep.component.approvalKeyword || 'aprovar'}
                  onChange={(event) => updateRagComponent({ approvalKeyword: event.target.value })}
                />
              </label>
              <label>
                Palavra para reprovar
                <input
                  value={selectedStep.component.approvalRejectKeyword || 'reprovar'}
                  onChange={(event) => updateRagComponent({ approvalRejectKeyword: event.target.value })}
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedStep.component.approvalRequireExplicitInput !== false}
                onChange={(event) => updateRagComponent({ approvalRequireExplicitInput: event.target.checked })}
              />
              <span>Exigir que a resposta venha quando este nó estiver aguardando input</span>
            </label>
            <div className="inspector-grid-two">
              <label>
                Texto ao aprovar
                <input
                  value={selectedStep.component.approvalApprovedText || ''}
                  placeholder="Aprovado. Vou continuar."
                  onChange={(event) => updateRagComponent({ approvalApprovedText: event.target.value })}
                />
              </label>
              <label>
                Texto ao reprovar
                <input
                  value={selectedStep.component.approvalRejectedText || ''}
                  placeholder="Reprovado. A ação foi bloqueada."
                  onChange={(event) => updateRagComponent({ approvalRejectedText: event.target.value })}
                />
              </label>
            </div>
            <div className="mcp-output-hint">
              Próximo nó: use <code>{`{{context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'aprovacao'}.decision}}`}</code> para rotear aprovado/reprovado.
            </div>
          </div>
        </div>
      )}
      {selectedStep.component?.type === 'mcp' && (
        <div className="rich-message-editor">
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>MCP</strong>
            </div>
            <div className="filter-empty">
              Escolha o tipo de integração, preencha os campos principais e use o output em <code>context.slots.{selectedStep.component.responseName || selectedStep.responseName || 'mcp'}</code>.
            </div>
            <div className="mcp-mode-grid">
              {MCP_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={mcpMode === option.value ? 'active' : ''}
                  onClick={() => updateRagComponent({ mcpMode: option.value })}
                >
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            <div className="mcp-helper-row">
              <span>{mcpMode === 'fields' ? 'Ideal para extrair e padronizar dados.' : mcpMode === 'api' ? 'Ideal quando o sistema externo ainda não é MCP.' : 'Ideal para servers MCP remotos já publicados.'}</span>
              <button type="button" onClick={() => applyMcpPreset(mcpMode)}>
                <Wand2 size={14} />
                Preencher exemplo
              </button>
            </div>
            <label>
              responseName
              <input
                value={selectedStep.component.responseName || selectedStep.responseName || 'mcp'}
                placeholder="mcp"
                onChange={(event) => {
                  const responseName = event.target.value;
                  updateStep({
                    responseName,
                    component: { ...selectedStep.component!, responseName },
                  });
                }}
              />
            </label>
            <div className="mcp-output-hint">
              Próximo nó: use <code>{`{{context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'mcp'}.output.campo}}`}</code>
            </div>
            {mcpMode === 'api' && (
              <div className="rich-editor-block">
                <div className="filter-section-header">
                  <strong>Uso de LLM neste no</strong>
                </div>
                {(selectedStep.component.mcpApiCallMode || 'single') !== 'multi' && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={mcpApiAllowLlmRequest}
                      onChange={(event) => updateRagComponent({ mcpApiAllowLlmRequest: event.target.checked })}
                    />
                    <span>Permitir que a LLM monte metodo, params e body dentro da URL/base permitida</span>
                  </label>
                )}
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={mcpApiMapResultWithLlm}
                    onChange={(event) => updateRagComponent({ mcpApiMapResultWithLlm: event.target.checked })}
                  />
                  <span>Usar LLM para mapear resposta da API para o output schema</span>
                </label>
                {!mcpApiCanUseLlmRequest && !mcpApiMapResultWithLlm && (
                  <div className="filter-empty">
                    LLM desligada neste no. Provider, modelo e temperatura ficam bloqueados; o Canvas usa a chamada fixa e copia campos compativeis com o output schema.
                  </div>
                )}
              </div>
            )}
            <details className="mcp-details">
              <summary>Modelo, provider e saída</summary>
              {!mcpUsesLlm && (
                <div className="filter-empty">
                  LLM desativada neste componente. Provider, modelo e temperatura so sao usados quando alguma opcao de LLM estiver ligada.
                </div>
              )}
              <div className="inspector-grid-two">
                <label>
                  Provedor LLM
                  <select
                    disabled={!mcpUsesLlm}
                    value={selectedStep.component.mcpLlmProvider || 'auto'}
                    onChange={(event) => {
                      const provider = event.target.value as McpLlmProvider;
                      updateRagComponent({
                        mcpLlmProvider: provider,
                        mcpModel: provider === 'auto' ? '' : getDefaultLlmModelForProvider(provider as FlowLlmProvider),
                      });
                    }}
                  >
                    <option value="auto">Usar provedor do fluxo ({selectedLlmProviderName})</option>
                    <option value="openai">OpenAI</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                    <option value="grok">Grok</option>
                    <option value="bedrock">Bedrock</option>
                  </select>
                </label>
                <label>
                  Modelo/deployment
                  <select
                    disabled={!mcpUsesLlm}
                    value={selectedStep.component.mcpModel || ''}
                    onChange={(event) => updateRagComponent({ mcpModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptionsForProvider(selectedStep.component.mcpLlmProvider || 'auto', selectedStep.component.mcpModel).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={!mcpUsesLlm}
                    value={selectedStep.component.mcpTemperature ?? 0.1}
                    onChange={(event) => updateRagComponent({ mcpTemperature: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Salvar output
                  <select
                    value={selectedStep.component.mcpMergeOutputToSlots === true ? 'merge' : 'responseName'}
                    onChange={(event) => updateRagComponent({ mcpMergeOutputToSlots: event.target.value === 'merge' })}
                  >
                    <option value="responseName">Só no responseName</option>
                    <option value="merge">Mesclar em context.slots</option>
                  </select>
                </label>
              </div>
            </details>
          </div>

          <div className="rich-editor-block">
            <div className="filter-section-header">
              <strong>Contrato da ferramenta</strong>
            </div>
            <label>
              Nome da ferramenta
              <input
                value={selectedStep.component.mcpToolName || ''}
                placeholder={mcpMode === 'external' ? 'buscar_cliente_mcp' : mcpMode === 'api' ? 'consultar_cliente' : 'montar_campos_cliente'}
                onChange={(event) => updateRagComponent({ mcpToolName: event.target.value })}
              />
            </label>
            <label>
              <span className="prompt-field-label-row">
                <span>Descricao da ferramenta</span>
                <FieldAiButton
                  onClick={() => openPromptFieldAssistant({
                    fieldType: 'mcpDescription',
                    targetType: 'mcp-node',
                    title: 'Gerar descricao do MCP',
                    label: selectedStep.title || 'MCP',
                    currentValue: selectedStep.component?.mcpToolDescription || '',
                    placeholder: 'Ex: ferramenta que obtem detalhes de um agendamento usando agendamentoId e retorna unidade, horario e exames somente quando a API responder.',
                    applyText: (text) => updateRagComponent({ mcpToolDescription: text }),
                    stepContext: {
                      id: selectedStep.id,
                      title: selectedStep.title,
                      mcpMode,
                      inputSchema: selectedStep.component?.mcpInputSchema || '{}',
                      outputSchema: selectedStep.component?.mcpOutputSchema || '{}',
                    },
                  }, selectedStep.component?.mcpToolDescription ? 'Melhore a descricao para o agente escolher esta ferramenta corretamente.' : '', selectedStep.component?.mcpModel || config.model)}
                />
              </span>
              <textarea
                rows={3}
                value={selectedStep.component.mcpToolDescription || ''}
                placeholder="Busca ou monta dados do cliente com base no CPF informado."
                onChange={(event) => updateRagComponent({ mcpToolDescription: event.target.value })}
              />
            </label>
            <label>
              <span className="prompt-field-label-row">
                <span>Instrucao</span>
                <FieldAiButton
                  onClick={() => openPromptFieldAssistant({
                    fieldType: 'mcpInstruction',
                    targetType: 'mcp-node',
                    title: 'Gerar instrucao do MCP',
                    label: selectedStep.title || 'MCP',
                    currentValue: selectedStep.component?.mcpInstruction || selectedStep.instruction || '',
                    placeholder: 'Ex: use somente os campos do input schema, nao execute se faltar campo obrigatorio, chame a API configurada e normalize apenas dados reais no output schema.',
                    applyText: (text) => updateRagComponent({ mcpInstruction: text }),
                    stepContext: {
                      id: selectedStep.id,
                      title: selectedStep.title,
                      mcpMode,
                      toolName: selectedStep.component?.mcpToolName || '',
                      description: selectedStep.component?.mcpToolDescription || '',
                      inputSchema: selectedStep.component?.mcpInputSchema || '{}',
                      outputSchema: selectedStep.component?.mcpOutputSchema || '{}',
                      apiMethod: selectedStep.component?.mcpApiMethod || '',
                      apiBaseUrl: selectedStep.component?.mcpApiBaseUrl || '',
                    },
                  }, selectedStep.component?.mcpInstruction ? 'Melhore esta instrucao do MCP sem misturar prompt de atendimento ao cliente.' : '', selectedStep.component?.mcpModel || config.model)}
                />
              </span>
              <textarea
                rows={5}
                value={selectedStep.component.mcpInstruction || selectedStep.instruction || ''}
                placeholder="Use somente dados do contexto. Retorne os campos do schema de saída. Não invente dados sensíveis."
                onChange={(event) => updateRagComponent({ mcpInstruction: event.target.value })}
              />
            </label>
            <details className="mcp-details">
              <summary>Campos de entrada e saída</summary>
              <div className="filter-empty">
                Preencha os campos em formulário. Use Opções para enum, separando os valores por vírgula. O JSON continua disponível em "JSON avançado".
              </div>
              <McpSchemaBuilder
                title="Entrada que a IA pode usar"
                helper="Ex: cpf, idCliente, origem"
                fields={mcpInputFields}
                emptyLabel="Nenhum campo de entrada definido. Adicione os campos que a IA deve receber do contexto."
                onAdd={() => addMcpSchemaField('mcpInputSchema')}
                onUpdate={(index, patch) => updateMcpSchemaField('mcpInputSchema', index, patch)}
                onRemove={(index) => removeMcpSchemaField('mcpInputSchema', index)}
              />
              <McpSchemaBuilder
                title="Saída para os próximos nós"
                helper="Ex: encontrado, nome, maiorIdade"
                fields={mcpOutputFields}
                emptyLabel="Nenhum campo de saída definido. Adicione os campos que os próximos nós precisam consumir."
                onAdd={() => addMcpSchemaField('mcpOutputSchema')}
                onUpdate={(index, patch) => updateMcpSchemaField('mcpOutputSchema', index, patch)}
                onRemove={(index) => removeMcpSchemaField('mcpOutputSchema', index)}
              />
              <details className="mcp-details mcp-json-details">
                <summary>JSON avançado</summary>
                <div className="mcp-schema-json-grid">
                  <label>
                    Input schema JSON
                    <textarea
                      rows={8}
                      value={selectedStep.component.mcpInputSchema || '{}'}
                      placeholder='{"type":"object","properties":{"cpf":{"type":"string"}},"required":["cpf"]}'
                      onChange={(event) => updateRagComponent({ mcpInputSchema: event.target.value })}
                    />
                    {mcpInputSchemaError && <span className="field-error">{mcpInputSchemaError}</span>}
                  </label>
                  <label>
                    Output schema JSON
                    <textarea
                      rows={8}
                      value={selectedStep.component.mcpOutputSchema || '{}'}
                      placeholder='{"type":"object","properties":{"maiorIdade":{"type":"boolean"},"nome":{"type":"string"}}}'
                      onChange={(event) => updateRagComponent({ mcpOutputSchema: event.target.value })}
                    />
                    {mcpOutputSchemaError && <span className="field-error">{mcpOutputSchemaError}</span>}
                  </label>
                </div>
              </details>
            </details>
          </div>

          {mcpMode === 'api' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>API externa</strong>
              </div>
              <div className="filter-empty">
                Informe a URL permitida. Se a LLM montar a request, o runtime aceita apenas URLs no mesmo host/base configurado e nunca inventa segredos.
              </div>
              <div className="mcp-output-hint">
                Campos de entrada dizem quais dados a IA pode usar para montar argumentos, query ou body. Campos de saída dizem quais dados normalizados ela deve salvar em <code>{`context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'mcp'}.output`}</code> para os próximos nós.
              </div>
              <div className="inspector-grid-two">
                <label>
                  Modo de chamada
                  <select
                    value={selectedStep.component.mcpApiCallMode || 'single'}
                    onChange={(event) => {
                      const mode = event.target.value as McpApiCallMode;
                      const currentRequests = parseMcpApiRequestsJson(selectedStep.component?.mcpApiRequestsJson || '[]');
                      updateRagComponent({
                        mcpApiCallMode: mode,
                        ...(mode === 'multi' && currentRequests.length === 0
                          ? { mcpApiRequestsJson: stringifyMcpApiRequests([createMcpApiRequest([], 'cliente')]) }
                          : {}),
                      });
                    }}
                  >
                    <option value="single">Uma API</option>
                    <option value="multi">Várias APIs</option>
                  </select>
                </label>
                {(selectedStep.component.mcpApiCallMode || 'single') === 'multi' && (
                  <label>
                    Execução
                    <select
                      value={selectedStep.component.mcpApiExecutionMode || 'sequential'}
                      onChange={(event) => updateRagComponent({ mcpApiExecutionMode: event.target.value as McpApiExecutionMode })}
                    >
                      <option value="sequential">Sequencial</option>
                      <option value="parallel">Paralela</option>
                    </select>
                  </label>
                )}
              </div>
              {(selectedStep.component.mcpApiCallMode || 'single') === 'multi' && (
                <div className="mcp-api-multi-box">
                  <div className="mcp-output-hint">
                    Sequencial: a próxima chamada pode usar <code>{`{{context.slots.${selectedStep.component?.responseName || selectedStep.responseName || 'mcp'}.resultsById.cliente.data.enderecoId}}`}</code>
                  </div>
                  <McpApiRequestsEditor
                    requests={parseMcpApiRequestsJson(selectedStep.component.mcpApiRequestsJson || '[]')}
                    responseName={selectedStep.component?.responseName || selectedStep.responseName || 'mcp'}
                    executionMode={selectedStep.component.mcpApiExecutionMode || 'sequential'}
                    onChange={(requests) => updateRagComponent({ mcpApiRequestsJson: stringifyMcpApiRequests(requests) })}
                    onUseExample={() => updateRagComponent({ mcpApiRequestsJson: getMcpMultiApiExample(selectedStep.component?.responseName || selectedStep.responseName || 'mcp') })}
                  />
                  {mcpApiRequestsError && <span className="field-error">{mcpApiRequestsError}</span>}
                  <details className="mcp-details">
                    <summary>Autenticação comum para todas as chamadas</summary>
                    <div className="inspector-grid-two">
                      <label>
                        Autenticação
                        <select
                          value={selectedStep.component.mcpApiAuthMode || 'none'}
                          onChange={(event) => updateRagComponent({ mcpApiAuthMode: event.target.value as WebhookAuthMode })}
                        >
                          <option value="none">Sem autenticação</option>
                          <option value="bearer">Bearer token</option>
                          <option value="header">Header secreto</option>
                          <option value="query">Query param</option>
                        </select>
                      </label>
                      {(selectedStep.component.mcpApiAuthMode === 'header' || selectedStep.component.mcpApiAuthMode === 'bearer') && (
                        <label>
                          Header
                          <input
                            value={selectedStep.component.mcpApiAuthHeaderName || 'Authorization'}
                            onChange={(event) => updateRagComponent({ mcpApiAuthHeaderName: event.target.value })}
                          />
                        </label>
                      )}
                      {selectedStep.component.mcpApiAuthMode === 'query' && (
                        <label>
                          Query param
                          <input
                            value={selectedStep.component.mcpApiAuthQueryParam || 'api_key'}
                            onChange={(event) => updateRagComponent({ mcpApiAuthQueryParam: event.target.value })}
                          />
                        </label>
                      )}
                      {(selectedStep.component.mcpApiAuthMode || 'none') !== 'none' && (
                        <label>
                          Segredo
                          <input
                            type="password"
                            value={selectedStep.component.mcpApiAuthSecret || ''}
                            onChange={(event) => updateRagComponent({ mcpApiAuthSecret: event.target.value })}
                          />
                        </label>
                      )}
                    </div>
                  </details>
                  <details className="mcp-details mcp-json-details">
                    <summary>JSON avançado das chamadas</summary>
                    <textarea
                      rows={10}
                      value={selectedStep.component.mcpApiRequestsJson || '[]'}
                      placeholder={getMcpMultiApiExample(selectedStep.component.responseName || selectedStep.responseName || 'mcp')}
                      onChange={(event) => updateRagComponent({ mcpApiRequestsJson: event.target.value })}
                    />
                    {mcpApiRequestsError && <span className="field-error">{mcpApiRequestsError}</span>}
                  </details>
                  <div className="filter-empty">
                    Cada item aceita <code>id</code>, <code>method</code>, <code>url</code>, <code>headers</code>, <code>params</code>, <code>body</code> e <code>bodyType</code>. Em paralelo, as chamadas não dependem uma da outra; em sequencial, use o resultado anterior pelo id.
                  </div>
                </div>
              )}
              {(selectedStep.component.mcpApiCallMode || 'single') !== 'multi' && (
                <>
              <div className="inspector-grid-two">
                <label>
                Método padrão
                  <select
                    value={selectedStep.component.mcpApiMethod || 'POST'}
                    onChange={(event) => updateRagComponent({ mcpApiMethod: event.target.value as McpHttpMethod })}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </label>
                <label>
                Autenticação
                  <select
                    value={selectedStep.component.mcpApiAuthMode || 'none'}
                    onChange={(event) => updateRagComponent({ mcpApiAuthMode: event.target.value as WebhookAuthMode })}
                  >
                    <option value="none">Sem autenticação</option>
                    <option value="bearer">Bearer token</option>
                    <option value="header">Header secreto</option>
                    <option value="query">Query param</option>
                  </select>
                </label>
              </div>
              <label>
                URL/base permitida
                <input
                  value={selectedStep.component.mcpApiBaseUrl || ''}
                  placeholder="https://api.exemplo.com/clientes"
                  onChange={(event) => updateRagComponent({ mcpApiBaseUrl: event.target.value })}
                />
              </label>
              {(selectedStep.component.mcpApiAuthMode || 'none') !== 'none' && (
                <div className="inspector-grid-two">
                  {(selectedStep.component.mcpApiAuthMode === 'header' || selectedStep.component.mcpApiAuthMode === 'bearer') && (
                    <label>
                      Header
                      <input
                        value={selectedStep.component.mcpApiAuthHeaderName || 'Authorization'}
                        onChange={(event) => updateRagComponent({ mcpApiAuthHeaderName: event.target.value })}
                      />
                    </label>
                  )}
                  {selectedStep.component.mcpApiAuthMode === 'query' && (
                    <label>
                      Query param
                      <input
                        value={selectedStep.component.mcpApiAuthQueryParam || 'api_key'}
                        onChange={(event) => updateRagComponent({ mcpApiAuthQueryParam: event.target.value })}
                      />
                    </label>
                  )}
                  <label>
                    Segredo
                    <input
                      type="password"
                      value={selectedStep.component.mcpApiAuthSecret || ''}
                      onChange={(event) => updateRagComponent({ mcpApiAuthSecret: event.target.value })}
                    />
                  </label>
                </div>
              )}
              <div className="inspector-grid-two">
                <label>
                  Headers JSON
                  <textarea
                    rows={6}
                    value={selectedStep.component.mcpApiHeadersJson || '{}'}
                    placeholder='{"x-tenant":"{{context.agentId}}"}'
                    onChange={(event) => updateRagComponent({ mcpApiHeadersJson: event.target.value })}
                  />
                  {mcpHeadersError && <span className="field-error">{mcpHeadersError}</span>}
                </label>
                <label>
                  Query JSON
                  <textarea
                    rows={6}
                    value={selectedStep.component.mcpApiQueryJson || '{}'}
                    placeholder='{"cpf":"{{context.slots.cpf}}"}'
                    onChange={(event) => updateRagComponent({ mcpApiQueryJson: event.target.value })}
                  />
                  {mcpQueryError && <span className="field-error">{mcpQueryError}</span>}
                </label>
              </div>
              <label>
                Body JSON padrão
                <textarea
                  rows={7}
                  value={selectedStep.component.mcpApiBodyJson || '{}'}
                  placeholder='{"cpf":"{{context.slots.cpf}}","origem":"canvas-flow"}'
                  onChange={(event) => updateRagComponent({ mcpApiBodyJson: event.target.value })}
                />
                {mcpBodyError && <span className="field-error">{mcpBodyError}</span>}
              </label>
                </>
              )}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedStep.component.mcpApiExecute !== false}
                  onChange={(event) => updateRagComponent({ mcpApiExecute: event.target.checked })}
                />
                <span>Executar chamada HTTP</span>
              </label>
            </div>
          )}

          {mcpMode === 'external' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Servidor MCP externo</strong>
              </div>
              <div className="filter-empty">
                Conecta em um servidor MCP remoto e executa tools, resources ou prompts. Streamable HTTP e SSE aceitam headers, OAuth e AWS SigV4; WebSocket deve usar auth por query.
              </div>
              <div className="mcp-remote-preset-picker">
                <label>
                  MCP remoto pre-configurado
                  <select value="" onChange={(event) => applyMcpRemoteServerPreset(event.target.value)}>
                    <option value="">Selecionar preset...</option>
                    {MCP_REMOTE_SERVER_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                </label>
                {currentMcpRemoteServerPreset && (
                  <div className="mcp-remote-preset-hint">
                    <strong>{currentMcpRemoteServerPreset.label}</strong>
                    <span>{currentMcpRemoteServerPreset.description}</span>
                    <div className="mcp-remote-preset-actions">
                      <button type="button" onClick={() => setMcpPresetHelpId(currentMcpRemoteServerPreset.id)}>
                        <Info size={14} />
                        Ver permissoes e configuracao
                      </button>
                      <a href={currentMcpRemoteServerPreset.docsUrl} target="_blank" rel="noreferrer">Abrir documentacao oficial</a>
                    </div>
                  </div>
                )}
                <span className="field-hint">O preset preenche a conexao. Use Listar tools abaixo e selecione a operacao remota desejada.</span>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Transporte
                  <select
                    value={selectedStep.component.mcpExternalTransport || 'streamable_http'}
                    onChange={(event) => updateRagComponent({ mcpExternalTransport: event.target.value as McpExternalTransport })}
                  >
                    <option value="streamable_http">Streamable HTTP</option>
                    <option value="sse">SSE legado</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </label>
                <label>
                Operação
                  <select
                    value={selectedStep.component.mcpExternalOperation || 'callTool'}
                    onChange={(event) => updateRagComponent({ mcpExternalOperation: event.target.value as McpExternalOperation })}
                  >
                    <option value="callTool">Chamar tool</option>
                    <option value="listTools">Listar tools</option>
                    <option value="readResource">Ler resource</option>
                    <option value="listResources">Listar resources</option>
                    <option value="getPrompt">Buscar prompt</option>
                    <option value="listPrompts">Listar prompts</option>
                    <option value="ping">Ping</option>
                  </select>
                </label>
              </div>
              <label>
                URL do servidor MCP
                <input
                  value={selectedStep.component.mcpExternalUrl || ''}
                  placeholder="https://mcp.exemplo.com/mcp"
                  onChange={(event) => updateRagComponent({ mcpExternalUrl: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Autenticação
                  <select
                    value={selectedStep.component.mcpExternalAuthMode || 'none'}
                    onChange={(event) => updateRagComponent({ mcpExternalAuthMode: event.target.value as McpExternalAuthMode })}
                  >
                    <option value="none">Sem autenticação</option>
                    <option value="bearer">Bearer token</option>
                    <option value="header">Header secreto</option>
                    <option value="query">Query param</option>
                    <option value="oauth">OAuth MCP</option>
                    <option value="aws_sigv4">AWS IAM SigV4 (backend)</option>
                  </select>
                </label>
                <label>
                  Timeout
                  <input
                    type="number"
                    min={1000}
                    max={300000}
                    step={1000}
                    value={selectedStep.component.mcpExternalTimeoutMs ?? 30000}
                    onChange={(event) => updateRagComponent({ mcpExternalTimeoutMs: Number(event.target.value) })}
                  />
                </label>
              </div>
              {!['none', 'oauth', 'aws_sigv4'].includes(selectedStep.component.mcpExternalAuthMode || 'none') && (
                <div className="inspector-grid-two">
                  {(selectedStep.component.mcpExternalAuthMode === 'header' || selectedStep.component.mcpExternalAuthMode === 'bearer') && (
                    <label>
                      Header
                      <input
                        value={selectedStep.component.mcpExternalAuthHeaderName || 'Authorization'}
                        onChange={(event) => updateRagComponent({ mcpExternalAuthHeaderName: event.target.value })}
                      />
                    </label>
                  )}
                  {selectedStep.component.mcpExternalAuthMode === 'query' && (
                    <label>
                      Query param
                      <input
                        value={selectedStep.component.mcpExternalAuthQueryParam || 'api_key'}
                        onChange={(event) => updateRagComponent({ mcpExternalAuthQueryParam: event.target.value })}
                      />
                    </label>
                  )}
                  <label>
                    Segredo
                    <input
                      type="password"
                      value={selectedStep.component.mcpExternalAuthSecret || ''}
                      onChange={(event) => updateRagComponent({ mcpExternalAuthSecret: event.target.value })}
                    />
                  </label>
                </div>
              )}
              {selectedMcpExternalAuthMode === 'aws_sigv4' && (
                <div className="mcp-output-hint">
                  O backend assina cada chamada com AWS SigV4 usando a cadeia padrao de credenciais AWS. Configure IAM com privilegio minimo e use um node de aprovacao antes de tools que alteram infraestrutura.
                </div>
              )}
              {selectedMcpExternalAuthMode === 'oauth' && (
                <div className="mcp-output-hint mcp-oauth-panel">
                  <label>
                    Escopo da conexao OAuth
                    <select
                      value={selectedMcpExternalOAuthConnectionScope}
                      onChange={(event) => updateRagComponent({ mcpExternalOAuthConnectionScope: event.target.value as McpExternalOAuthConnectionScope })}
                    >
                      <option value="user">Individual por usuario Canvas Flow</option>
                      <option value="agent">Compartilhada no agente</option>
                    </select>
                  </label>
                  <div className="mcp-oauth-status">
                    <strong>{mcpOAuthStatus?.connected ? 'OAuth conectado' : mcpOAuthAuthorizationUrl ? 'OAuth aguardando autorizacao' : mcpOAuthStatus?.status === 'error' ? 'OAuth com erro' : 'OAuth nao conectado'}</strong>
                    <span>
                      {selectedMcpExternalOAuthConnectionScope === 'user'
                        ? `A conexao fica salva somente para o usuario Canvas Flow autenticado, no agente ${currentAgentId} e nesta URL MCP.`
                        : `A conexao fica compartilhada com todos os operadores do agente ${currentAgentId} para esta URL MCP.`}
                      {' '}Os tokens nao entram no JSON do flow.
                    </span>
                    {selectedMcpExternalOAuthConnectionScope === 'user' && (
                      <span>O modo individual exige login Canvas Flow habilitado com <code>CANVAS_FLOW_LOGIN=true</code>.</span>
                    )}
                    {currentMcpRemoteServerPreset?.oauthScopes?.length && (
                      <span>
                        Scopes solicitados ao reconectar: <code>{currentMcpRemoteServerPreset.oauthScopes.join(' ')}</code>
                      </span>
                    )}
                    {selectedMcpExternalTransport === 'websocket' && (
                      <span className="field-error">OAuth MCP esta disponivel apenas em Streamable HTTP ou SSE neste runtime.</span>
                    )}
                    {mcpOAuthAuthorizationUrl && (
                      <span className="field-error">Conclua Abrir autorizacao antes de executar o node ou listar tools.</span>
                    )}
                    {mcpOAuthStatus?.connected && mcpOAuthStatus.authenticatedAt && (
                      <span>Autenticado em {new Date(mcpOAuthStatus.authenticatedAt).toLocaleString()}</span>
                    )}
                    {mcpOAuthStatus?.connected && mcpOAuthStatus.expiresAt && (
                      <span>Token expira em {new Date(mcpOAuthStatus.expiresAt).toLocaleString()}</span>
                    )}
                    {mcpOAuthMessage && <span>{mcpOAuthMessage}</span>}
                  </div>
                  <div className="mcp-oauth-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void connectMcpOAuth()}
                      disabled={!selectedMcpExternalUrl || mcpOAuthLoading || selectedMcpExternalTransport === 'websocket'}
                    >
                      {mcpOAuthLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                      {mcpOAuthStatus?.connected ? 'Reconectar OAuth' : 'Conectar OAuth'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reconnectMcpOAuth()}
                      disabled={!selectedMcpExternalUrl || mcpOAuthLoading || selectedMcpExternalTransport === 'websocket'}
                    >
                      <RefreshCw size={14} />
                      Reconectar do zero
                    </button>
                    {mcpOAuthAuthorizationUrl && (
                      <button
                        type="button"
                        onClick={() => openMcpOAuthPopup(mcpOAuthAuthorizationUrl)}
                        disabled={selectedMcpExternalTransport === 'websocket'}
                      >
                        Abrir autorizacao
                      </button>
                    )}
                    {mcpOAuthStatus?.connected && (
                      <button type="button" onClick={() => void disconnectMcpOAuth()} disabled={mcpOAuthLoading}>
                        Desconectar
                      </button>
                    )}
                  </div>
                </div>
              )}
              <label>
                Headers JSON
                <textarea
                  rows={5}
                  value={selectedStep.component.mcpExternalHeadersJson || '{}'}
                  placeholder='{"x-tenant":"{{context.agentId}}"}'
                  onChange={(event) => updateRagComponent({ mcpExternalHeadersJson: event.target.value })}
                />
                {mcpExternalHeadersError && <span className="field-error">{mcpExternalHeadersError}</span>}
              </label>

              <div className="mcp-tool-discovery">
                <div className="filter-section-header">
                  <strong>Descobrir tools agora</strong>
                  <button
                    type="button"
                    onClick={() => void discoverMcpExternalTools()}
                    disabled={!selectedMcpExternalUrl || mcpExternalToolsLoading || !selectedMcpExternalOAuthReady}
                  >
                    {mcpExternalToolsLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                    Listar tools
                  </button>
                </div>
                <div className="filter-empty">
                  Consulta <code>tools/list</code> durante a configuracao. Ao selecionar uma tool, o Canvas copia o input schema oficial e preenche os argumentos com variaveis de <code>context.slots</code>.
                </div>
                {mcpExternalTools.length > 0 && (
                  <label>
                    Tool encontrada
                    <select
                      value={mcpExternalTools.some((tool) => tool.name === selectedStep.component?.mcpExternalToolName)
                        ? selectedStep.component?.mcpExternalToolName
                        : ''}
                      onChange={(event) => selectMcpExternalTool(event.target.value)}
                    >
                      <option value="">Selecionar tool...</option>
                      {mcpExternalTools.map((tool) => (
                        <option key={tool.name} value={tool.name}>{tool.title || tool.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {mcpExternalToolsMessage && <span className="field-hint">{mcpExternalToolsMessage}</span>}
                {mcpExternalToolsError && <span className="field-error">{mcpExternalToolsError}</span>}
              </div>

              {(selectedStep.component.mcpExternalOperation || 'callTool') === 'callTool' && (
                <>
                  <label>
                    Nome da tool
                    <input
                      value={selectedStep.component.mcpExternalToolName || ''}
                      placeholder="buscar_cliente"
                      onChange={(event) => updateRagComponent({ mcpExternalToolName: event.target.value })}
                    />
                  </label>
                  <label>
                    Argumentos JSON
                    <textarea
                      rows={7}
                      value={selectedStep.component.mcpExternalArgumentsJson || '{}'}
                      placeholder='{"cpf":"{{context.slots.cpf}}"}'
                      onChange={(event) => updateRagComponent({ mcpExternalArgumentsJson: event.target.value })}
                    />
                    {mcpExternalArgumentsError && <span className="field-error">{mcpExternalArgumentsError}</span>}
                  </label>
                  {mcpExternalArgumentFields.length > 0 && (
                    <div className="mcp-argument-contract">
                      <div className="mcp-argument-contract-header">
                        <strong>Tipagem da entrada</strong>
                        <span>schema oficial da tool</span>
                      </div>
                      <div className="mcp-argument-contract-list">
                        {mcpExternalArgumentFields.map((field) => (
                          <div
                            className="mcp-argument-contract-row"
                            key={field.path}
                            title={field.description || undefined}
                          >
                            <code>{field.path}</code>
                            <span className="mcp-type-badge">{field.type}</span>
                            <span className={field.required ? 'mcp-required-badge' : 'mcp-optional-badge'}>
                              {field.required ? 'obrigatorio' : 'opcional'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="field-hint">
                        Arrays aparecem com colchetes no JSON preenchido. Valores vindos de <code>context.slots</code> sao convertidos conforme essa tipagem.
                      </span>
                    </div>
                  )}
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedStep.component.mcpExternalUseLlmArguments !== false}
                      onChange={(event) => updateRagComponent({ mcpExternalUseLlmArguments: event.target.checked })}
                    />
                    <span>Permitir que a LLM monte os argumentos da tool usando o schema da tool</span>
                  </label>
                  <div className="filter-empty">
                    Desmarque para enviar somente o JSON configurado acima. Isso evita uma chamada de LLM quando o cliente ja possui os dados necessarios.
                  </div>
                </>
              )}

              {(selectedStep.component.mcpExternalOperation || 'callTool') === 'readResource' && (
                <label>
                  URI do resource
                  <input
                    value={selectedStep.component.mcpExternalResourceUri || ''}
                    placeholder="file:///docs/contrato.md"
                    onChange={(event) => updateRagComponent({ mcpExternalResourceUri: event.target.value })}
                  />
                </label>
              )}

              {(selectedStep.component.mcpExternalOperation || 'callTool') === 'getPrompt' && (
                <>
                  <label>
                    Nome do prompt
                    <input
                      value={selectedStep.component.mcpExternalPromptName || ''}
                      placeholder="resumo_cliente"
                      onChange={(event) => updateRagComponent({ mcpExternalPromptName: event.target.value })}
                    />
                  </label>
                  <label>
                    Argumentos do prompt JSON
                    <textarea
                      rows={6}
                      value={selectedStep.component.mcpExternalPromptArgumentsJson || '{}'}
                      placeholder='{"clienteId":"{{context.slots.clienteId}}"}'
                      onChange={(event) => updateRagComponent({ mcpExternalPromptArgumentsJson: event.target.value })}
                    />
                    {mcpExternalPromptArgumentsError && <span className="field-error">{mcpExternalPromptArgumentsError}</span>}
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedStep.component.mcpExternalUseLlmArguments !== false}
                      onChange={(event) => updateRagComponent({ mcpExternalUseLlmArguments: event.target.checked })}
                    />
                    <span>Permitir que a LLM monte os argumentos do prompt</span>
                  </label>
                </>
              )}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedStep.component.mcpExternalMapResultWithLlm !== false}
                  onChange={(event) => updateRagComponent({ mcpExternalMapResultWithLlm: event.target.checked })}
                />
                <span>Mapear resultado para o output schema quando o servidor não retornar structuredContent</span>
              </label>
              <div className="filter-empty">
                Desmarque tambem o mapeamento para evitar LLM na resposta. O retorno bruto continua disponivel no slot do node.
              </div>
            </div>
          )}
        </div>
      )}
      {selectedStep.component?.type === 'webhook' && (
        <div className="rich-message-editor">
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Webhook</strong>
            </div>
            <label>
              Modo
              <select
                value={webhookMode}
                onChange={(event) => updateRagComponent({ webhookMode: event.target.value as WebhookMode })}
              >
                <option value="inbound">Entrada: receber dados</option>
                <option value="outbound">Saída: postar dados</option>
                <option value="listener">Ouvinte global: postar interações</option>
              </select>
            </label>
            <label>
              responseName
              <input
                value={selectedStep.component.responseName || selectedStep.responseName || 'webhook'}
                onChange={(event) => {
                  const responseName = event.target.value;
                  updateStep({
                    responseName,
                    api: selectedStep.api ? { ...selectedStep.api, responseName } : selectedStep.api,
                    component: { ...selectedStep.component!, responseName },
                  });
                }}
              />
            </label>
          </div>

          {webhookMode === 'inbound' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Entrada HTTP</strong>
              </div>
              <label>
                Identificador da URL
                <input
                  value={webhookId}
                  onChange={(event) => updateRagComponent({ webhookId: event.target.value.trim() })}
                />
              </label>
              <label>
                URL do webhook
                <div className="copy-field">
                  <input value={webhookUrl} readOnly />
                  <button type="button" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    <Copy size={14} />
                  </button>
                </div>
              </label>
              {!currentFlowId && (
                <div className="filter-empty">
                  Salve o fluxo para trocar <code>{'<FLOW_ID_SALVO>'}</code> pelo ID real da URL.
                </div>
              )}
              <div className="inspector-grid-two">
                <label>
                  Autenticação
                  <select
                    value={webhookAuthMode}
                    onChange={(event) => updateRagComponent({ webhookAuthMode: event.target.value as WebhookAuthMode })}
                  >
                    <option value="none">Sem autenticação</option>
                    <option value="bearer">Bearer token</option>
                    <option value="header">Header secreto</option>
                    <option value="query">Query param</option>
                  </select>
                </label>
                <label>
                  Iniciar em
                  <select
                    value={selectedStep.component.webhookStartMode || 'node'}
                    onChange={(event) => updateRagComponent({ webhookStartMode: event.target.value as WebhookStartMode })}
                  >
                    <option value="node">Este nó</option>
                    <option value="flow">Início do fluxo</option>
                  </select>
                </label>
              </div>
              <label>
                Resposta do webhook
                <select
                  value={webhookResponseMode}
                  onChange={(event) => updateRagComponent({ webhookResponseMode: event.target.value as WebhookResponseMode })}
                >
                  <option value="sync">Síncrona: esperar o fluxo terminar</option>
                  <option value="async_job">Assíncrona: retornar apenas jobId</option>
                  <option value="async">Assíncrona: retornar jobId e chamar URL de retorno</option>
                </select>
              </label>
              {webhookResponseMode === 'async_job' && (
                <div className="filter-section">
                  <div className="filter-section-header">
                    <strong>Retorno por jobId</strong>
                  </div>
                  <div className="filter-empty">
                    A chamada inicial retorna um <code>jobId</code> e não envia callback. Com SQS habilitado, consulte depois em <code>GET {CANVAS_FLOW_API_URL}/api/canvas-flow/sqs/jobs/&lt;jobId&gt;</code>.
                  </div>
                  <div className="filter-empty">
                    Se o job ainda não terminou, a consulta retorna <code>status: "queued"</code> ou <code>status: "running"</code> sem <code>result</code>. Consulte novamente com backoff até receber <code>status: "completed"</code> ou <code>status: "failed"</code>.
                  </div>
                  <div className="filter-empty">
                    Use este modo quando o sistema externo recupera os resultados em lote. Configure o TTL dos jobs para maior que a janela de recuperação.
                  </div>
                </div>
              )}
              {webhookResponseMode === 'async' && (
                <div className="filter-section">
                  <div className="filter-section-header">
                    <strong>Retorno assíncrono</strong>
                  </div>
                  <label>
                    URL de retorno
                    <input
                      value={selectedStep.component.webhookCallbackUrl || ''}
                      placeholder="https://meusistema.com/canvas-flow/callback"
                      onChange={(event) => updateRagComponent({ webhookCallbackUrl: event.target.value })}
                    />
                  </label>
                  <div className="inspector-grid-two">
                    <label>
                      Auth do retorno
                      <select
                        value={webhookCallbackAuthMode}
                        onChange={(event) => updateRagComponent({ webhookCallbackAuthMode: event.target.value as WebhookAuthMode })}
                      >
                        <option value="none">Sem autenticação</option>
                        <option value="bearer">Bearer token</option>
                        <option value="header">Header secreto</option>
                      </select>
                    </label>
                    {webhookCallbackAuthMode === 'header' && (
                      <label>
                        Header
                        <input
                          value={webhookCallbackHeaderName}
                          onChange={(event) => updateRagComponent({ webhookCallbackHeaderName: event.target.value })}
                        />
                      </label>
                    )}
                  </div>
                  {webhookCallbackAuthMode !== 'none' && (
                    <label>
                      Segredo do retorno
                      <input
                        type="password"
                        value={selectedStep.component.webhookCallbackSecret || ''}
                        placeholder="Segredo enviado no callback"
                        onChange={(event) => updateRagComponent({ webhookCallbackSecret: event.target.value })}
                      />
                    </label>
                  )}
                  <div className="filter-empty">
                    A chamada inicial retorna um <code>jobId</code>. Quando o fluxo terminar, o Canvas Flow faz <code>POST</code> nesta URL com o resultado.
                  </div>
                  <div className="filter-empty">
                    Com SQS habilitado, o resultado também pode ser consultado por <code>GET {CANVAS_FLOW_API_URL}/api/canvas-flow/sqs/jobs/&lt;jobId&gt;</code>.
                  </div>
                  <div className="filter-empty">
                    Enquanto não estiver pronto, esse endpoint retorna <code>queued</code> ou <code>running</code> sem <code>result</code>. Quando terminar, retorna <code>completed</code> com <code>result</code>, ou <code>failed</code> com <code>error</code>.
                  </div>
                </div>
              )}
              {webhookAuthMode !== 'none' && (
                <>
                  <label>
                    Segredo
                    <input
                      type="password"
                      value={selectedStep.component.webhookSecret || ''}
                      placeholder="Segredo usado pelo sistema externo"
                      onChange={(event) => updateRagComponent({ webhookSecret: event.target.value })}
                    />
                  </label>
                  {webhookAuthMode === 'header' && (
                    <label>
                      Nome do header
                      <input
                        value={selectedStep.component.webhookHeaderName || 'x-canvas-flow-webhook-secret'}
                        onChange={(event) => updateRagComponent({ webhookHeaderName: event.target.value })}
                      />
                    </label>
                  )}
                  {webhookAuthMode === 'query' && (
                    <label>
                      Query param
                      <input
                        value={selectedStep.component.webhookQueryParam || 'secret'}
                        onChange={(event) => updateRagComponent({ webhookQueryParam: event.target.value })}
                      />
                    </label>
                  )}
                  {!selectedStep.component.webhookSecret && (
                    <div className="filter-empty">
                      Configure um segredo para o endpoint aceitar chamadas externas neste modo.
                    </div>
                  )}
                </>
              )}
              {webhookAuthMode === 'none' && (
                <div className="filter-empty">
                  Sem autenticação deixa esta URL pública. Use apenas quando o endpoint estiver protegido por outra camada.
                </div>
              )}
              <div className="filter-empty">
                O payload recebido fica em <code>context.slots.{selectedStep.component.responseName || selectedStep.responseName || 'webhook'}</code> e também em <code>context.slots.webhook</code>.
              </div>
              <div className="api-doc-section webhook-contract">
                <div className="api-doc-section-header">
                  <strong>Contrato de entrada</strong>
                  <button type="button" onClick={() => navigator.clipboard.writeText(webhookCurlExample)}>
                    <Copy size={14} />
                    Copiar cURL
                  </button>
                </div>
                <div className="api-endpoint">
                  <span>Método</span>
                  <code>POST</code>
                </div>
                <div className="api-endpoint">
                  <span>URL</span>
                  <code>{webhookUrl}</code>
                </div>
                <div className="filter-empty">
                  Envie <code>Content-Type: application/json</code>. O campo <code>text</code> vira a entrada principal; <code>slots</code> é mesclado em <code>context.slots</code>. Para continuar uma conversa, reenvie o <code>conversationId</code> e o <code>currentStepId</code> retornados na chamada anterior.
                  Sem <code>currentStepId</code>, o <code>text</code> abre a interação, mas não responde automaticamente inputs que aparecerem depois no mesmo fluxo.
                </div>
                {webhookAuthMode === 'bearer' && (
                  <div className="api-endpoint">
                    <span>Auth</span>
                    <code>Authorization: Bearer &lt;SEGREDO&gt;</code>
                  </div>
                )}
                {webhookAuthMode === 'header' && (
                  <div className="api-endpoint">
                    <span>Auth</span>
                    <code>{webhookHeaderName}: &lt;SEGREDO&gt;</code>
                  </div>
                )}
                {webhookAuthMode === 'query' && (
                  <div className="api-endpoint">
                    <span>Auth</span>
                    <code>?{webhookQueryParam}=&lt;SEGREDO&gt;</code>
                  </div>
                )}
                <label>
                  Body JSON esperado
                  <textarea rows={7} value={webhookBodyExample} readOnly />
                </label>
                <label>
                  Exemplo cURL
                  <textarea rows={9} value={webhookCurlExample} readOnly />
                </label>
                {(webhookResponseMode === 'async' || webhookResponseMode === 'async_job') && (
                  <>
                    <label>
                      Resposta imediata no modo assíncrono
                      <textarea rows={7} value={webhookAsyncResponseExample} readOnly />
                    </label>
                    {webhookResponseMode === 'async' && (
                      <label>
                        POST enviado para a URL de retorno
                        <textarea rows={10} value={webhookCallbackExample} readOnly />
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {webhookMode === 'outbound' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Saída HTTP</strong>
              </div>
              <div className="filter-empty">
                Configure uma ou mais chamadas para postar dados do fluxo. Use templates como <code>{'{{context.slots.cpf}}'}</code> no body, headers ou URL.
              </div>
              <HttpBatchEditor
                requests={selectedStep.api?.requests || []}
                onChange={(requests) => updateStep({
                  api: {
                    responseName: selectedStep.component?.responseName || selectedStep.responseName || 'webhook',
                    requests,
                    generation: selectedStep.api?.generation,
                  },
                })}
              />
            </div>
          )}

          {webhookMode === 'listener' && (
            <div className="rich-editor-block">
              <div className="filter-section-header">
                <strong>Ouvinte global</strong>
              </div>
              <div className="filter-empty">
                Este webhook não precisa estar conectado em nenhum nó. A cada interação do cliente, o Canvas Flow dispara as chamadas abaixo e mantém o fluxo conversacional seguindo pelo caminho normal.
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={webhookListenerFireAndForget}
                  onChange={(event) => updateRagComponent({ webhookListenerFireAndForget: event.target.checked })}
                />
                Não bloquear a resposta do usuário enquanto posta no webhook
              </label>
              <div className="filter-empty">
                Campos úteis para montar o body: <code>{'{{context.slots.webhookEvent}}'}</code>, <code>{'{{context.input}}'}</code>, <code>{'{{context.conversationId}}'}</code>, <code>{'{{context.currentStepId}}'}</code> e <code>{'{{context.slots}}'}</code>.
              </div>
              <HttpBatchEditor
                requests={selectedStep.api?.requests || []}
                onChange={(requests) => updateStep({
                  api: {
                    responseName: selectedStep.component?.responseName || selectedStep.responseName || 'webhook',
                    requests,
                    generation: selectedStep.api?.generation,
                  },
                })}
              />
            </div>
          )}
        </div>
      )}
      {selectedStep.component?.type === 'rag' && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Composicao do RAG</strong>
            </div>
            <div className="inspector-grid-two">
              <label>
                LLM resposta
                <select
                  value={selectedStep.component.ragLlmProvider || 'auto'}
                  onChange={(event) => {
                    const provider = event.target.value as RagModelProvider;
                    updateRagComponent({
                      ragLlmProvider: provider,
                      ragLlmModel: provider === 'auto' ? '' : getDefaultLlmModelForProvider(provider as FlowLlmProvider),
                    });
                  }}
                >
                  <option value="auto">Auto/global</option>
                  <option value="openai">OpenAI</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="claude">Claude</option>
                  <option value="grok">Grok</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </label>
              <label>
                Embedding
                <select
                  value={selectedStep.component.ragEmbeddingProvider || 'auto'}
                  onChange={(event) => updateRagComponent({ ragEmbeddingProvider: event.target.value as RagModelProvider })}
                >
                  <option value="auto">Auto/global</option>
                  <option value="openai">OpenAI</option>
                  <option value="azure_openai">Azure OpenAI</option>
                </select>
              </label>
              <label>
                Busca vetorial
                <select
                  value={selectedStep.component.ragSearchProvider || selectedStep.component.ragProvider || 'auto'}
                  onChange={(event) => {
                    const value = event.target.value as RagSearchProvider;
                    updateRagComponent({
                      ragSearchProvider: value,
                      ragProvider: value === 'hybrid' ? 'auto' : value as 'auto' | 'milvus' | 'azure_search',
                    });
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="milvus">Milvus</option>
                  <option value="azure_search">Azure AI Search</option>
                  <option value="hybrid">Milvus + Azure AI Search</option>
                </select>
              </label>
              <label>
                Modelo do chat
                <select
                  value={selectedStep.component.ragLlmModel || ''}
                  onChange={(event) => updateRagComponent({ ragLlmModel: event.target.value })}
                >
                  <option value="">Usar modelo do fluxo ({config.model})</option>
                  {modelOptionsForProvider(selectedStep.component.ragLlmProvider || 'auto', selectedStep.component.ragLlmModel).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Modelo de embedding
                <select
                  value={selectedStep.component.ragEmbeddingModel || ''}
                  onChange={(event) => updateRagComponent({ ragEmbeddingModel: event.target.value })}
                >
                  <option value="">Usar default do provider</option>
                  {optionsWithCurrent(EMBEDDING_MODEL_OPTIONS, selectedStep.component.ragEmbeddingModel).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="filter-empty">
              Azure AI Search funciona como motor de busca. Azure Blob Storage nao busca vetores direto aqui: use um componente Azure Blob Storage antes e informe Docs recuperados, ou indexe o conteudo no Azure AI Search/Milvus.
            </div>
          </div>
          <div className="inspector-grid-two">
            <label>
              Collection / Index
              <input
                value={selectedStep.component.collectionName || ''}
                placeholder="canvas_flow_docs ou azure-search-index"
                onChange={(event) =>
                  updateStep({ component: { ...selectedStep.component!, collectionName: event.target.value } })
                }
              />
            </label>
          </div>
          {renderRagAgentScopeControls()}
          <label>
            K
            <input
              type="number"
              min={0}
              value={selectedStep.component.k ?? 8}
              onChange={(event) => updateRagComponent({ k: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            Turnos de memoria
            <input
              type="number"
              min={0}
              value={selectedStep.component.turnHistoricMessages ?? config.turnHistoricMessages ?? 20}
              onChange={(event) => updateRagComponent({ turnHistoricMessages: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            Prompt RAG
            <textarea
              rows={5}
              value={selectedStep.component.prompt || ''}
              onChange={(event) => updateRagComponent({ prompt: event.target.value })}
            />
          </label>
          <label>
            Texto de busca no RAG
            <input
              value={selectedStep.component.queryTemplate || ''}
              onChange={(event) => updateRagComponent({ queryTemplate: event.target.value })}
            />
          </label>
          <label>
            Docs recuperados
            <input
              value={selectedStep.component.ragDocsPath || ''}
              placeholder="context.slots.milvus.results ou context.slots.azureSearch.results"
              onChange={(event) => updateRagComponent({ ragDocsPath: event.target.value })}
            />
          </label>
          <RagConditionalRulesEditor
            rules={ragConditionalRules}
            onChange={(rules) => updateRagComponent({ ragConditionalRules: rules })}
          />
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Filtro extraFields</strong>
            </div>
            <ConditionalFilterEditor
              rules={extraFieldsFilterRules}
              draft={extraFilterDraft}
              emptyText="Sem filtro global. Adicione campos como ano, tipo ou categoria."
              onDraftChange={setExtraFilterDraft}
              onChange={updateExtraFieldsFilterRules}
            />
          </div>
          <div className="filter-section">
            <div className="filter-section-header">
              <strong>Filtros por rodada</strong>
              <button
                type="button"
                onClick={() => updateRagComponent({ extraFieldsFilterPerRound: [...ragRounds, {}] })}
              >
                <Plus size={14} />
                Rodada
              </button>
            </div>
            {ragRounds.length === 0 && <div className="filter-empty">Sem rodadas. Use quando quiser tentar filtros em ordem.</div>}
            <div className="round-filter-list">
              {ragRounds.map((round, roundIndex) => (
                <div className="round-filter-card" key={roundIndex}>
                  <div className="round-filter-header">
                    <strong>Rodada {roundIndex + 1}</strong>
                    <label>
                      Limite
                      <input
                        type="number"
                        min={0}
                        value={ragRoundLimits[roundIndex] ?? ''}
                        placeholder="Auto"
                        onChange={(event) => {
                          const nextLimits = [...ragRoundLimits];
                          nextLimits[roundIndex] = event.target.value === '' ? null : Number(event.target.value) || 0;
                          updateRagComponent({ extraFieldsFilterPerRoundLimits: nextLimits });
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="filter-icon-button"
                      aria-label="Remover rodada"
                      title="Remover rodada"
                      onClick={() => {
                        updateRagComponent({
                          extraFieldsFilterPerRound: ragRounds.filter((_, index) => index !== roundIndex),
                          extraFieldsFilterPerRoundLimits: ragRoundLimits.filter((_, index) => index !== roundIndex),
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <FilterEditor
                    filter={round || {}}
                    draft={roundFilterDrafts[roundIndex] || EMPTY_FILTER_DRAFT}
                    emptyText="Esta rodada ainda não tem filtros."
                    onDraftChange={(draft) => setRoundFilterDrafts((current) => ({ ...current, [roundIndex]: draft }))}
                    onChange={(nextRound) => {
                      const nextRounds = [...ragRounds];
                      nextRounds[roundIndex] = nextRound;
                      updateRagComponent({ extraFieldsFilterPerRound: nextRounds });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="inspector-grid-two">
            <label>
              Order by extraFields
              <input
                value={selectedStep.component.extraFieldsFilterOrderBy?.[0] || ''}
                placeholder="ano"
                onChange={(event) => {
                  const field = event.target.value.trim();
                  updateRagComponent({ extraFieldsFilterOrderBy: field ? [field] : [] });
                }}
              />
            </label>
            <label>
              Ordem
              <select
                value={selectedStep.component.order || 'desc'}
                onChange={(event) => updateRagComponent({ order: event.target.value as 'asc' | 'desc' })}
              >
                <option value="desc">desc</option>
                <option value="asc">asc</option>
              </select>
            </label>
          </div>
          <div className="inspector-grid-two">
            <label>
              metadataOrderScanPageSize
              <input
                type="number"
                min={0}
                value={selectedStep.component.metadataOrderScanPageSize ?? ''}
                placeholder="1000"
                onChange={(event) => updateRagComponent({
                  metadataOrderScanPageSize: event.target.value === '' ? null : Number(event.target.value) || 0,
                })}
              />
            </label>
            <label>
              metadataOrderMaxScan
              <input
                type="number"
                min={0}
                value={selectedStep.component.metadataOrderMaxScan ?? ''}
                placeholder="20000"
                onChange={(event) => updateRagComponent({
                  metadataOrderMaxScan: event.target.value === '' ? null : Number(event.target.value) || 0,
                })}
              />
            </label>
          </div>
          <label>
            Filtro avancado Milvus
            <input
              value={selectedStep.component.filterExpr || ''}
              placeholder={'text like "%contrato%"'}
              onChange={(event) => updateRagComponent({ filterExpr: event.target.value })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.component.roundStopFind !== false}
              onChange={(event) => updateRagComponent({ roundStopFind: event.target.checked })}
            />
            <span>Parar na primeira rodada com resultado</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.component.roundMixHalf === true}
              onChange={(event) => updateRagComponent({ roundMixHalf: event.target.checked })}
            />
            <span>Misturar resultados entre rodadas</span>
          </label>
        </>
      )}
      {(selectedStep.component?.type === 'openaiGen' || selectedStep.component?.type === 'azureOpenAI') && (
        <>
          <div className="filter-empty">
            {selectedStep.component.type === 'azureOpenAI'
              ? 'Este componente gera a resposta com Azure OpenAI.'
              : 'Este componente e um Agente: escolha o motor LLM, defina o papel e selecione quais rules, skills, subagents e MCP ele pode enxergar.'}
            {' '}Para usar documentos, conecte antes Arquivos, Milvus ou Azure AI Search e informe o caminho dos resultados.
          </div>
          <div className="filter-section agent-llm-section">
            <div className="filter-section-header">
              <strong>Motor LLM</strong>
            </div>
            <div className="filter-grid two-columns">
              {selectedStep.component.type === 'openaiGen' && (
                <label>
                  Provider
                  <select
                    value={selectedStep.component.ragLlmProvider || 'auto'}
                    onChange={(event) => {
                      const provider = event.target.value as RagModelProvider;
                      updateRagComponent({
                        ragLlmProvider: provider,
                        ragLlmModel: provider === 'auto' ? '' : getDefaultLlmModelForProvider(provider as FlowLlmProvider),
                      });
                    }}
                  >
                    <option value="auto">Usar provider do fluxo ({selectedLlmProviderName})</option>
                    <option value="openai">OpenAI</option>
                    <option value="azure_openai">Azure OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                    <option value="grok">Grok</option>
                    <option value="bedrock">Bedrock</option>
                  </select>
                </label>
              )}
              <label>
                {selectedStep.component.type === 'azureOpenAI' ? 'Deployment/modelo' : 'Modelo'}
                <select
                  value={selectedStep.component.ragLlmModel || ''}
                  onChange={(event) => updateRagComponent({ ragLlmModel: event.target.value })}
                >
                  <option value="">Usar modelo do fluxo ({config.model})</option>
                  {modelOptionsForProvider(selectedStep.component.ragLlmProvider || 'auto', selectedStep.component.ragLlmModel).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {selectedStep.component.type === 'openaiGen' && (
            <div className="filter-section agent-execution-section">
              <div className="filter-section-header">
                <strong>Execucao do agente</strong>
              </div>
              <div className="filter-grid two-columns compact">
                <label>
                  Modo
                  <select
                    value={selectedStep.component.agentExecutionMode || 'hybrid'}
                    onChange={(event) => updateRagComponent({ agentExecutionMode: event.target.value as 'flow' | 'auto_tools' | 'hybrid' })}
                  >
                    <option value="flow">Fluxo conectado</option>
                    <option value="auto_tools">Auto tools</option>
                    <option value="hybrid">Hibrido</option>
                  </select>
                </label>
                <label>
                  Limite de chamadas
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={selectedStep.component.agentMaxToolCalls ?? 1}
                    onChange={(event) => updateRagComponent({ agentMaxToolCalls: Number(event.target.value) || 1 })}
                  />
                </label>
              </div>
              <span className="field-hint">
                Fluxo conectado segue as linhas do canvas. Auto tools deixa o agente chamar skills, subagents ou MCP. Hibrido chama tools e depois continua pelo canvas.
              </span>
              {(componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent') && selectedAgentExecutionMode !== 'flow' && (
                <div className="filter-empty warning">
                  Modo agentico usa o manifesto visivel para chamar skills, subagents e MCP sob demanda. Use edges apenas para o caminho conversacional do canvas, como Agente -&gt; Mensagem -&gt; Pergunta. Nao conecte orquestrador -&gt; skill nem skill/subagent -&gt; MCP para representar dependencia agentica; isso vira execucao de fluxo conectado.
                </div>
              )}
              {agenticGraphWarningEdges.length > 0 && (
                <span className="field-error">
                  Ligacoes agenticas por manifesto: {agenticGraphWarningSummary}{agenticGraphWarningEdges.length > 5 ? '...' : ''}. Elas mantem o mesmo layout da conexao, ficam verdes no canvas e nao fazem jump de fluxo.
                </span>
              )}
              {(componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent') && selectedStep.component.agentExecutionMode === 'flow' && (
                <span className="field-error">Para delegar para skills/subagents selecionados, use Auto tools ou Hibrido.</span>
              )}
            </div>
          )}
          {selectedStep.component.type === 'openaiGen' && (
            <>
              <div className="filter-section">
                <div className="filter-section-header">
                  <strong>Papel e contrato do agente</strong>
                </div>
                <div className="filter-empty">
                  Configure aqui o papel deste no e o manifesto que ele enxerga. Voce tambem pode criar rules e subagents rapidos sem sair do agente.
                </div>
                <label>
                  Papel
                  <select
                    value={componentAgentRole}
                    onChange={(event) => setComponentAgentRole(event.target.value as 'simple' | 'orchestrator' | 'subagent')}
                  >
                    <option value="simple">Agente simples</option>
                    <option value="orchestrator">Agente orquestrador principal</option>
                    <option value="subagent">Subagent especializado</option>
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={componentAgentUseWorkspaceCatalog || hasExplicitManifestSelection}
                    disabled={hasExplicitManifestSelection}
                    onChange={(event) => updateRagComponent({ agentUseWorkspaceCatalog: event.target.checked })}
                  />
                  <span>Usar catalogo do Agent Workspace</span>
                </label>
                {hasExplicitManifestSelection && (
                  <span className="field-hint">
                    O manifesto selecionado ativa automaticamente o catalogo necessario para este orquestrador.
                  </span>
                )}
                <div className="agent-workspace-catalog-summary">
                  <span><strong>{workspaceCatalogCounts.skills}</strong> skills</span>
                  <span><strong>{workspaceCatalogCounts.subagents + canvasSubagentCatalog.length}</strong> subagents</span>
                  <span><strong>{workspaceCatalogCounts.rules}</strong> rules</span>
                  <span><strong>{workspaceCatalogCounts.mcpServers + canvasMcpCatalog.length + flowMcpCatalog.length}</strong> MCP</span>
                </div>
                {(componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent') && (
                  <div className="agent-manifest-section">
                    <div className="filter-section-header">
                      <strong>Manifesto visivel para este agente</strong>
                      <div className="agent-manifest-actions">
                        <button type="button" onClick={selectCurrentManifestTab}>Selecionar aba</button>
                        <button type="button" onClick={clearCurrentManifestTab}>Limpar aba</button>
                        <button type="button" onClick={selectAllManifestItems}>Selecionar todos</button>
                        <button type="button" onClick={clearManifestItems}>Limpar</button>
                      </div>
                    </div>
                    {!hasExplicitManifestSelection && (
                      <div className="filter-empty">
                        Sem selecao explicita: este no enxerga o catalogo inteiro do Agent Workspace.
                      </div>
                    )}
                    <div className="agent-manifest-tabs" role="tablist" aria-label="Categorias do manifesto do agente">
                      {manifestTabs.map((tab) => (
                        <button
                          type="button"
                          key={tab.id}
                          className={agentManifestTab === tab.id ? 'active' : ''}
                          onClick={() => setAgentManifestTab(tab.id)}
                        >
                          <span>{tab.label}</span>
                          <small>{tab.selected}/{tab.total}</small>
                        </button>
                      ))}
                    </div>
                    <div className="agent-manifest-tab-panel">
                      {renderAgentManifestTabContent()}
                    </div>
                  </div>
                )}
                {componentAgentRole === 'orchestrator' && (
                  <div className="filter-empty">
                    Orquestrador recebe instrucoes do usuario, consulta rules/docs, decide quando usar skills, chama subagents com contexto isolado e aciona MCP sob demanda.
                  </div>
                )}
                {componentAgentRole === 'subagent' && (
                  <div className="filter-empty">
                    Subagent deve ter escopo estreito e contexto proprio, mas pode chamar MCP, skills e outros subagents selecionados quando isso fizer parte da tarefa.
                  </div>
                )}
                <label>
                  <span className="prompt-field-label-row">
                    <span>Agents.md local</span>
                    <FieldAiButton
                      onClick={() => openPromptFieldAssistant({
                        fieldType: 'agentsMd',
                        targetType: 'agent-node',
                        title: 'Gerar Agents.md local',
                        label: selectedStep.title || 'Agente',
                        currentValue: componentAgentSpec.agentsMd,
                        placeholder: componentAgentRole === 'orchestrator'
                          ? 'Ex: orquestrador de agendamentos: coleta CPF, data de nascimento, chama MCP_LOGIN, MCP_API_CLIENTES e só consulta detalhes após seleção do cliente.'
                          : 'Ex: subagent especializado em consultar e formatar dados de agendamento. Pode chamar MCPs ou subagents selecionados quando precisar de dados que nao estao no contexto.',
                        applyText: (text) => updateComponentAgentSpec({ agentsMd: text }),
                        stepContext: {
                          id: selectedStep.id,
                          title: selectedStep.title,
                          type: selectedStep.type,
                          componentType: selectedStep.component?.type || '',
                          role: componentAgentRole,
                          manifest: selectedStep.component?.agentManifest || {},
                        },
                      }, componentAgentSpec.agentsMd ? 'Melhore este Agents.md local sem misturar guardrails ou termos bloqueados.' : '', selectedStep.component?.ragLlmModel || config.model)}
                    />
                  </span>
                  <textarea
                    rows={componentAgentRole === 'orchestrator' ? 6 : 4}
                    value={componentAgentSpec.agentsMd}
                    placeholder={componentAgentRole === 'orchestrator'
                      ? '# Agente principal orquestrador&#10;Recebe instrucoes do usuario, consulta rules e docs, delega tarefas e coordena subagents e skills.&#10;&#10;Use o catalogo do Agent Workspace para decidir ferramentas.'
                      : '# Identidade local&#10;Objetivo, tom, limites e quando este agente deve responder.'}
                    onChange={(event) => updateComponentAgentSpec({ agentsMd: event.target.value })}
                  />
                </label>
                <label>
                  <span className="prompt-field-label-row">
                    <span>Guardrails</span>
                    <FieldAiButton
                      onClick={() => openPromptFieldAssistant({
                        fieldType: 'guardrails',
                        targetType: 'agent-node',
                        title: 'Gerar guardrails locais',
                        label: selectedStep.title || 'Agente',
                        currentValue: componentAgentSpec.guardrails,
                        placeholder: 'Ex: bloquear resposta sem dados de MCP, não inventar detalhes de agendamento, não expor IDs técnicos ao cliente salvo quando necessário.',
                        applyText: (text) => updateComponentAgentSpec({ guardrails: text }),
                        stepContext: {
                          id: selectedStep.id,
                          title: selectedStep.title,
                          role: componentAgentRole,
                          manifest: selectedStep.component?.agentManifest || {},
                        },
                      }, componentAgentSpec.guardrails ? 'Melhore estes guardrails locais sem repetir o Agents.md.' : '', selectedStep.component?.ragLlmModel || config.model)}
                    />
                  </span>
                  <textarea
                    rows={4}
                    value={componentAgentSpec.guardrails}
                    placeholder="Nao invente dados. Peça aprovacao antes de acoes sensiveis. Nao exponha segredos."
                    onChange={(event) => updateComponentAgentSpec({ guardrails: event.target.value })}
                  />
                </label>
                <label>
                  <span className="prompt-field-label-row">
                    <span>Termos bloqueados</span>
                    <FieldAiButton
                      onClick={() => openPromptFieldAssistant({
                        fieldType: 'blockedTerms',
                        targetType: 'agent-node',
                        title: 'Gerar termos bloqueados locais',
                        label: selectedStep.title || 'Agente',
                        currentValue: componentAgentSpec.blockedTerms.join(', '),
                        placeholder: 'Ex: termos que devem bloquear exclusão, vazamento de token, manipulação indevida de cliente ou chamadas sensíveis.',
                        applyText: (text) => updateComponentAgentSpec({ blockedTerms: normalizeBlockedTerms(text) }),
                        stepContext: {
                          id: selectedStep.id,
                          title: selectedStep.title,
                          role: componentAgentRole,
                        },
                      }, componentAgentSpec.blockedTerms.length ? 'Melhore a lista mantendo termos curtos separados por vírgula.' : '', selectedStep.component?.ragLlmModel || config.model)}
                    />
                  </span>
                  <input
                    value={componentAgentSpec.blockedTerms.join(', ')}
                    placeholder="apagar banco, excluir cliente, vazar token"
                    onChange={(event) => updateComponentAgentSpec({ blockedTerms: parseBlockedTermsDraft(event.target.value) })}
                    onBlur={(event) => updateComponentAgentSpec({ blockedTerms: normalizeBlockedTerms(event.target.value) })}
                  />
                </label>
                {componentAgentHasLegacyCatalog && (
                  <div className="filter-empty">
                    Este no ainda tem catalogo legado local ({componentAgentLegacyCatalogCounts.skills} skills, {componentAgentLegacyCatalogCounts.subagents} subagents, {componentAgentLegacyCatalogCounts.rules} rules, {componentAgentLegacyCatalogCounts.mcpServers} MCP). Ao salvar o papel acima, o Canvas passa a usar o catalogo do Agent Workspace.
                  </div>
                )}
              </div>
            </>
          )}
          <label>
            <span className="prompt-field-label-row">
              <span>Prompt</span>
              <FieldAiButton
                onClick={() => openPromptFieldAssistant({
                  fieldType: 'instruction',
                  targetType: 'agent-node',
                  title: 'Gerar prompt do agente',
                  label: selectedStep.title || 'Agente',
                  currentValue: selectedStep.component?.prompt || '',
                  placeholder: 'Ex: agente deve conduzir a conversa um dado por vez, usar MCPs somente com entradas obrigatorias e responder ao cliente sem expor detalhes tecnicos.',
                  applyText: (text) => updateRagComponent({ prompt: text }),
                  stepContext: {
                    id: selectedStep.id,
                    title: selectedStep.title,
                    type: selectedStep.type,
                    componentType: selectedStep.component?.type || '',
                    role: componentAgentRole,
                    agentsMd: componentAgentSpec.agentsMd,
                    guardrails: componentAgentSpec.guardrails,
                    blockedTerms: componentAgentSpec.blockedTerms,
                    manifest: selectedStep.component?.agentManifest || {},
                  },
                }, selectedStep.component?.prompt ? 'Melhore este prompt sem repetir Agents.md, guardrails ou termos bloqueados.' : '', selectedStep.component?.ragLlmModel || config.model)}
              />
            </span>
            <textarea
              rows={5}
              value={selectedStep.component.prompt || ''}
              onChange={(event) => updateRagComponent({ prompt: event.target.value })}
            />
          </label>
          <label>
            <span className="prompt-field-label-row">
              <span>Entrada do LLM</span>
              {componentAgentRole === 'subagent' && selectedStep.component.queryTemplate !== '{{context.input}}' && (
                <button
                  type="button"
                  onClick={() => updateRagComponent({ queryTemplate: '{{context.input}}' })}
                >
                  Usar context.input
                </button>
              )}
            </span>
            <input
              value={selectedStep.component.queryTemplate || ''}
              placeholder={componentAgentRole === 'subagent' ? '{{context.input}}' : '{{context.slots.userInput}}'}
              onChange={(event) => updateRagComponent({ queryTemplate: event.target.value })}
            />
            {(componentAgentRole === 'orchestrator' || componentAgentRole === 'subagent') ? (
              <span className="field-hint">
                <code>{'{{context.input}}'}</code> e a entrada atual deste componente. Em subagent/MCP chamado como tool, ele recebe a tarefa ou payload delegado pelo agente pai; <code>{'{{context.slots.autoToolInput}}'}</code> guarda o mesmo texto por compatibilidade. <code>{'{{context.slots.pergunta}}'}</code> e o valor salvo pelo no Pergunta.
              </span>
            ) : (
              <span className="field-hint">
                <code>{'{{context.input}}'}</code> e a entrada atual do runner; <code>{'{{context.slots.nome}}'}</code> acessa valores salvos por nos anteriores.
              </span>
            )}
          </label>
          <label>
            Contexto dinamico
            <textarea
              rows={4}
              value={selectedStep.component.llmContextTemplate || ''}
              placeholder="{{context.slots.arquivos.text}}"
              onChange={(event) => updateRagComponent({ llmContextTemplate: event.target.value })}
            />
            <span className="field-hint">
              Opcional. O payload dos nos ligados ao Agente ja entra automaticamente. Use este campo para complementar ou sobrescrever partes do contexto.
            </span>
          </label>
          <label>
            Docs conectados
            <input
              value={selectedStep.component.ragDocsPath || ''}
              placeholder="context.slots.milvus.results ou context.slots.azureSearch.results"
              onChange={(event) => updateRagComponent({ ragDocsPath: event.target.value })}
            />
            <span className="field-hint">
              Opcional. Documentos vindos de Arquivos, Milvus ou Azure AI Search ligados ao Agente sao usados automaticamente. Preencha para escolher outro caminho explicitamente.
            </span>
          </label>
          <label>
            Turnos de memoria
            <input
              type="number"
              min={0}
              value={selectedStep.component.turnHistoricMessages ?? config.turnHistoricMessages ?? 20}
              onChange={(event) => updateRagComponent({ turnHistoricMessages: Number(event.target.value) || 0 })}
            />
          </label>
        </>
      )}
      {(selectedStep.component?.type === 'milvus' || selectedStep.component?.type === 'azureSearch') && (
        <>
          <div className="filter-empty">
            {(() => {
              const operation = selectedStep.component.ragOperation || 'search';
              const isAzureSearch = selectedStep.component.type === 'azureSearch';
              if (operation === 'index' && isAzureSearch) {
                return 'Gera embeddings e grava os chunks/vetores diretamente no indice Azure AI Search. Nao salva no Blob; para Blob + Search use o componente Azure Blob Storage.';
              }
              if (operation === 'index') return 'Gera embeddings e salva os chunks/vetores na collection Milvus.';
              if (operation === 'list') return 'Lista documentos salvos no Milvus para visualizar o que ja foi vetorizado.';
              if (operation === 'get') return 'Busca um documento do Milvus pelo id ou embeddingId.';
              if (operation === 'delete') return 'Remove um documento do Milvus pelo id ou embeddingId.';
              return `Busca documentos no ${isAzureSearch ? 'Azure AI Search' : 'Milvus'} e salva o resultado em context.slots.${selectedStep.component.responseName || selectedStep.responseName || (isAzureSearch ? 'azureSearch' : 'milvus')}. Use Agente ou Azure OpenAI depois para responder com esses docs.`;
            })()}
          </div>
          <label>
            Operação
            <select
              value={selectedStep.component.ragOperation || 'search'}
              onChange={(event) => updateRagComponent({ ragOperation: event.target.value as RagDataOperation })}
            >
              <option value="search">{selectedStep.component.type === 'azureSearch' ? 'Buscar no Azure AI Search' : 'Buscar documentos no Milvus'}</option>
              <option value="index">{selectedStep.component.type === 'azureSearch' ? 'Indexar documentos no Azure AI Search' : 'Indexar / vetorizar no Milvus'}</option>
              {selectedStep.component.type === 'milvus' && (
                <>
                  <option value="list">Visualizar / listar dados</option>
                  <option value="get">Buscar por ID</option>
                  <option value="delete">Deletar por ID</option>
                </>
              )}
            </select>
          </label>
          <div className="inspector-grid-two">
            <label>
              {selectedStep.component.type === 'milvus' ? 'Collection Milvus' : 'Index Azure AI Search'}
              <input
                value={selectedStep.component.collectionName || ''}
                placeholder={selectedStep.component.type === 'milvus' ? 'canvas_flow_docs' : 'azure-search-index'}
                onChange={(event) => updateRagComponent({ collectionName: event.target.value })}
              />
            </label>
          </div>
          {renderRagAgentScopeControls()}
          {((selectedStep.component.ragOperation || 'search') === 'search' || (selectedStep.component.ragOperation || 'search') === 'index') && (
            <div className="inspector-grid-two">
              <label>
                Provider de embedding
                <select
                  value={selectedStep.component.ragEmbeddingProvider || 'openai'}
                  onChange={(event) => updateRagComponent({ ragEmbeddingProvider: event.target.value as RagModelProvider })}
                >
                  <option value="openai">OpenAI</option>
                  <option value="azure_openai">Azure OpenAI</option>
                  {selectedStep.component.ragEmbeddingProvider === 'auto' && <option value="auto">Auto/global (atual)</option>}
                </select>
              </label>
              <label>
                Modelo/deployment de embedding
                <select
                  value={selectedStep.component.ragEmbeddingModel || ''}
                  onChange={(event) => updateRagComponent({ ragEmbeddingModel: event.target.value })}
                >
                  <option value="">Usar default do provider</option>
                  {optionsWithCurrent(EMBEDDING_MODEL_OPTIONS, selectedStep.component.ragEmbeddingModel).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(selectedStep.component.ragOperation || 'search') === 'search' && (
            <>
              <div className="inspector-grid-two">
                <label>
                  K
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={selectedStep.component.k ?? 8}
                    onChange={(event) => updateRagComponent({ k: Number(event.target.value) || 8 })}
                  />
                </label>
                {selectedStep.component.type === 'milvus' && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selectedStep.component.useHybrid !== false}
                      onChange={(event) => updateRagComponent({ useHybrid: event.target.checked })}
                    />
                    <span>Busca híbrida dense + BM25</span>
                  </label>
                )}
              </div>
              <label>
                Query
                <input
                  value={selectedStep.component.queryTemplate || ''}
                  placeholder="{{context.slots.userInput}}"
                  onChange={(event) => updateRagComponent({ queryTemplate: event.target.value })}
                />
              </label>
              <RagConditionalRulesEditor
                rules={ragConditionalRules}
                onChange={(rules) => updateRagComponent({ ragConditionalRules: rules })}
              />
              <div className="filter-section">
                <div className="filter-section-header">
                  <strong>Filtro extraFields</strong>
                </div>
                <ConditionalFilterEditor
                  rules={extraFieldsFilterRules}
                  draft={extraFilterDraft}
                  emptyText="Sem filtro global. Adicione campos como ano, tipo ou categoria."
                  onDraftChange={setExtraFilterDraft}
                  onChange={updateExtraFieldsFilterRules}
                />
              </div>
              {selectedStep.component.type === 'milvus' && (
                <label>
                  Filtro Milvus
                  <input
                    value={selectedStep.component.filterExpr || ''}
                    placeholder={'text like "%contrato%"'}
                    onChange={(event) => updateRagComponent({ filterExpr: event.target.value })}
                  />
                </label>
              )}
            </>
          )}
          {selectedStep.component.type === 'milvus' && (selectedStep.component.ragOperation || 'search') === 'list' && (
            <>
              <div className="inspector-grid-two">
                <label>
                  Limite
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={selectedStep.component.k ?? 50}
                    onChange={(event) => updateRagComponent({ k: Number(event.target.value) || 50 })}
                  />
                </label>
              </div>
              <label>
                Busca/filtro textual opcional
                <input
                  value={selectedStep.component.queryTemplate || ''}
                  placeholder="{{context.slots.termoBusca}}"
                  onChange={(event) => updateRagComponent({ queryTemplate: event.target.value })}
                />
              </label>
              <div className="filter-empty">
                Lista documentos agrupados por embeddingId/nome para visualizar o que esta salvo no Milvus.
              </div>
            </>
          )}
          {selectedStep.component.type === 'milvus' &&
            ((selectedStep.component.ragOperation || 'search') === 'get' || (selectedStep.component.ragOperation || 'search') === 'delete') && (
              <>
                <label>
                  ID ou embeddingId do documento
                  <input
                    value={selectedStep.component.ragEmbeddingIdTemplate || ''}
                    placeholder="{{context.slots.documentId}}"
                    onChange={(event) => updateRagComponent({ ragEmbeddingIdTemplate: event.target.value })}
                  />
                </label>
                {(selectedStep.component.ragOperation || 'search') === 'delete' && (
                  <div className="filter-empty">
                    A exclusao remove os chunks desse documento da collection Milvus.
                  </div>
                )}
              </>
            )}
          {(selectedStep.component.ragOperation || 'search') === 'index' && (
            <>
              <label>
                Caminho de documentos/chunks
                <input
                  value={selectedStep.component.ragDocumentsPath || ''}
                  placeholder={selectedStep.component.type === 'azureSearch' ? 'context.slots.azureBlob.blobs ou context.slots.mongo.documents' : 'context.slots.documentos'}
                  onChange={(event) => updateRagComponent({ ragDocumentsPath: event.target.value })}
                />
              </label>
              <div className="filter-empty">
                Opcional. Use para indexar chunks vindos de Blob, MongoDB ou outro no. Se vazio, usa o texto abaixo.
              </div>
              <label>
                Texto/documento para indexar
                <textarea
                  rows={7}
                  value={selectedStep.component.ragTextTemplate || ''}
                  placeholder="{{context.slots.documento}}"
                  onChange={(event) => updateRagComponent({ ragTextTemplate: event.target.value })}
                />
              </label>
              <label>
                Caminho do texto
                <input
                  value={selectedStep.component.ragTextPath || ''}
                  placeholder="context.slots.documento.text"
                  onChange={(event) => updateRagComponent({ ragTextPath: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Nome do documento
                  <input
                    value={selectedStep.component.ragEmbeddingNameTemplate || ''}
                    placeholder="Documento"
                    onChange={(event) => updateRagComponent({ ragEmbeddingNameTemplate: event.target.value })}
                  />
                </label>
                <label>
                  ID do documento
                  <input
                    value={selectedStep.component.ragEmbeddingIdTemplate || ''}
                    placeholder="opcional"
                    onChange={(event) => updateRagComponent({ ragEmbeddingIdTemplate: event.target.value })}
                  />
                </label>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Chunk size
                  <input
                    type="number"
                    min={100}
                    value={selectedStep.component.ragChunkSize ?? 512}
                    onChange={(event) => updateRagComponent({ ragChunkSize: Number(event.target.value) || 512 })}
                  />
                </label>
                <label>
                  Chunk overlap
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.component.ragChunkOverlap ?? 70}
                    onChange={(event) => updateRagComponent({ ragChunkOverlap: Number(event.target.value) || 0 })}
                  />
                </label>
              </div>
              <label>
                Extra fields JSON
                <textarea
                  rows={5}
                  value={selectedStep.component.ragExtraFieldsJson || '{}'}
                  onChange={(event) => updateRagComponent({ ragExtraFieldsJson: event.target.value })}
                />
              </label>
            </>
          )}
        </>
      )}
      {selectedStep.component?.type === 'azureBlob' && (
        <>
          <div className="filter-empty">
            {(selectedStep.component.azureBlobOperation === 'chunks' || selectedStep.component.azureBlobOperation === 'index')
              ? 'Quebra o texto em chunks e salva no Azure Blob Storage. Nao gera embedding e nao cria indice de busca.'
              : selectedStep.component.azureBlobOperation === 'list'
                ? 'Lista blobs/chunks por prefixo e traz o texto para usar em outro componente, como Azure AI Search.'
                : selectedStep.component.azureBlobOperation === 'read'
                  ? 'Le um blob especifico e salva o conteudo no contexto.'
              : `Grava um texto ou JSON renderizado no Azure Blob Storage e salva blobName/blobUrl em context.slots.${selectedStep.component.responseName || selectedStep.responseName || 'azureBlob'}.`}
          </div>
          <label>
            Operação
            <select
              value={selectedStep.component.azureBlobOperation === 'index' ? 'chunks' : selectedStep.component.azureBlobOperation || 'upload'}
              onChange={(event) => updateRagComponent({ azureBlobOperation: event.target.value as AzureBlobOperation })}
            >
              <option value="upload">Gravar blob</option>
              <option value="chunks">Salvar chunks no Blob</option>
              <option value="list">Listar/buscar blobs</option>
              <option value="read">Ler blob</option>
            </select>
          </label>
          {((selectedStep.component.azureBlobOperation === 'index' ? 'chunks' : selectedStep.component.azureBlobOperation || 'upload') === 'list') && (
            <>
              <div className="inspector-grid-two">
                <label>
                  Prefixo/pasta
                  <input
                    value={selectedStep.component.collectionName || ''}
                    placeholder="canvas-flow-chunks/"
                    onChange={(event) => updateRagComponent({ collectionName: event.target.value })}
                  />
                </label>
                <label>
                  Limite
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={selectedStep.component.k ?? 100}
                    onChange={(event) => updateRagComponent({ k: Number(event.target.value) || 100 })}
                  />
                </label>
              </div>
              <label>
                Busca em nome/metadados/texto
                <input
                  value={selectedStep.component.azureBlobFilterText || ''}
                  placeholder="contrato, cliente, produto..."
                  onChange={(event) => updateRagComponent({ azureBlobFilterText: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Content-Type contem
                  <input
                    value={selectedStep.component.azureBlobFilterContentType || ''}
                    placeholder="text/plain ou application/json"
                    onChange={(event) => updateRagComponent({ azureBlobFilterContentType: event.target.value })}
                  />
                </label>
                <label>
                  Min bytes
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.component.azureBlobMinBytes ?? ''}
                    onChange={(event) => updateRagComponent({ azureBlobMinBytes: event.target.value === '' ? undefined : Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Modificado apos
                  <input
                    type="datetime-local"
                    value={selectedStep.component.azureBlobFilterModifiedAfter || ''}
                    onChange={(event) => updateRagComponent({ azureBlobFilterModifiedAfter: event.target.value })}
                  />
                </label>
                <label>
                  Modificado antes
                  <input
                    type="datetime-local"
                    value={selectedStep.component.azureBlobFilterModifiedBefore || ''}
                    onChange={(event) => updateRagComponent({ azureBlobFilterModifiedBefore: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Max bytes
                <input
                  type="number"
                  min={0}
                  value={selectedStep.component.azureBlobMaxBytes ?? ''}
                  onChange={(event) => updateRagComponent({ azureBlobMaxBytes: event.target.value === '' ? undefined : Number(event.target.value) })}
                />
              </label>
              <div className="filter-empty">
                Resultado sugerido para indexar: context.slots.{selectedStep.component.responseName || selectedStep.responseName || 'azureBlob'}.blobs
              </div>
            </>
          )}
          {((selectedStep.component.azureBlobOperation === 'index' ? 'chunks' : selectedStep.component.azureBlobOperation || 'upload') === 'read') && (
            <label>
              Nome do blob
              <input
                value={selectedStep.component.azureBlobNameTemplate || ''}
                placeholder="canvas-flow-chunks/global/documento/0.txt"
                onChange={(event) => updateRagComponent({ azureBlobNameTemplate: event.target.value })}
              />
            </label>
          )}
          {((selectedStep.component.azureBlobOperation === 'index' ? 'chunks' : selectedStep.component.azureBlobOperation || 'upload') === 'chunks') && (
            <>
              <label>
                Pasta/prefixo no Blob
                <input
                  value={selectedStep.component.collectionName || ''}
                  placeholder="canvas-flow-chunks"
                  onChange={(event) => updateRagComponent({ collectionName: event.target.value })}
                />
              </label>
              <label>
                Texto para quebrar em chunks
                <textarea
                  rows={7}
                  value={selectedStep.component.ragTextTemplate || ''}
                  placeholder="{{context.slots.documento}}"
                  onChange={(event) => updateRagComponent({ ragTextTemplate: event.target.value })}
                />
              </label>
              <label>
                Caminho do texto
                <input
                  value={selectedStep.component.ragTextPath || ''}
                  placeholder="context.slots.documento.text"
                  onChange={(event) => updateRagComponent({ ragTextPath: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Nome do documento
                  <input
                    value={selectedStep.component.ragEmbeddingNameTemplate || ''}
                    placeholder="Documento"
                    onChange={(event) => updateRagComponent({ ragEmbeddingNameTemplate: event.target.value })}
                  />
                </label>
                <label>
                  ID do documento
                  <input
                    value={selectedStep.component.ragEmbeddingIdTemplate || ''}
                    placeholder="opcional"
                    onChange={(event) => updateRagComponent({ ragEmbeddingIdTemplate: event.target.value })}
                  />
                </label>
              </div>
              <div className="inspector-grid-two">
                <label>
                  Chunk size
                  <input
                    type="number"
                    min={100}
                    value={selectedStep.component.ragChunkSize ?? 512}
                    onChange={(event) => updateRagComponent({ ragChunkSize: Number(event.target.value) || 512 })}
                  />
                </label>
                <label>
                  Chunk overlap
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.component.ragChunkOverlap ?? 70}
                    onChange={(event) => updateRagComponent({ ragChunkOverlap: Number(event.target.value) || 0 })}
                  />
                </label>
              </div>
              <label>
                Extra fields JSON
                <textarea
                  rows={5}
                  value={selectedStep.component.ragExtraFieldsJson || '{}'}
                  onChange={(event) => updateRagComponent({ ragExtraFieldsJson: event.target.value })}
                />
              </label>
            </>
          )}
          {((selectedStep.component.azureBlobOperation === 'index' ? 'chunks' : selectedStep.component.azureBlobOperation || 'upload') === 'upload') && (
            <>
          <label>
            Nome do blob
            <input
              value={selectedStep.component.azureBlobNameTemplate || ''}
              placeholder="canvas-flow/{{context.conversationId}}/{{context.now}}.json"
              onChange={(event) => updateRagComponent({ azureBlobNameTemplate: event.target.value })}
            />
          </label>
          <div className="inspector-grid-two">
            <label>
              Content-Type
              <input
                value={selectedStep.component.azureBlobContentType || 'application/json'}
                onChange={(event) => updateRagComponent({ azureBlobContentType: event.target.value })}
              />
            </label>
            <label>
              Caminho do conteúdo
              <input
                value={selectedStep.component.azureBlobContentPath || ''}
                placeholder="context.slots.rag"
                onChange={(event) => updateRagComponent({ azureBlobContentPath: event.target.value })}
              />
            </label>
          </div>
          <label>
            Conteúdo template
            <textarea
              rows={7}
              value={selectedStep.component.azureBlobContentTemplate || ''}
              placeholder="{{context.slots}}"
              onChange={(event) => updateRagComponent({ azureBlobContentTemplate: event.target.value })}
            />
          </label>
            </>
          )}
        </>
      )}
      {selectedStep.component?.type === 'mongodb' && (
        <>
          <div className="filter-empty">
            Usa o MongoDB configurado no backend. O resultado fica em context.slots.{selectedStep.component.responseName || selectedStep.responseName || 'mongo'}.
          </div>
          <div className="inspector-grid-two">
            <label>
              Collection MongoDB
              <input
                value={selectedStep.component.mongoCollectionName || ''}
                placeholder="flow_events"
                onChange={(event) => updateRagComponent({ mongoCollectionName: event.target.value })}
              />
            </label>
            <label>
              Operação
              <select
                value={mongoOperation}
                onChange={(event) => {
                  const nextOperation = event.target.value as MongoOperation;
                  updateRagComponent({
                    mongoOperation: nextOperation,
                    ...(MONGO_LLM_FULL_ONLY_OPERATIONS.has(nextOperation) ? { mongoLlmMode: 'full' as MongoLlmMode } : {}),
                  });
                }}
              >
                {MONGO_OPERATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(mongoShowsLimit || mongoShowsSort) && (
            <div className="inspector-grid-two">
              {mongoShowsLimit && (
                <label>
                  {mongoOperation === 'insertMany' ? 'Max documentos' : 'Limite'}
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={selectedStep.component.mongoLimit ?? 50}
                    onChange={(event) => updateRagComponent({ mongoLimit: Number(event.target.value) || 50 })}
                  />
                </label>
              )}
              {mongoShowsSort && (
                <label>
                  Sort JSON
                  <input
                    value={selectedStep.component.mongoSort || '{}'}
                    placeholder='{"createdAt": -1}'
                    onChange={(event) => updateRagComponent({ mongoSort: event.target.value })}
                  />
                </label>
              )}
            </div>
          )}
          {mongoShowsPagination && (
          <div className="rich-editor-block">
            <div className="filter-section-header">
              <strong>Paginação e volume</strong>
            </div>
            <div className="inspector-grid-two">
              <label>
                Modo
                <select
                  value={selectedStep.component.mongoPaginationMode || 'single'}
                  onChange={(event) => updateRagComponent({ mongoPaginationMode: event.target.value as MongoPaginationMode })}
                >
                  <option value="single">Uma página</option>
                  <option value="all">Buscar várias páginas</option>
                </select>
              </label>
              <label>
                Página
                <input
                  type="number"
                  min={1}
                  value={selectedStep.component.mongoPage ?? 1}
                  onChange={(event) => updateRagComponent({ mongoPage: Math.max(1, Number(event.target.value) || 1) })}
                />
              </label>
            </div>
            <div className="inspector-grid-two">
              <label>
                Skip inicial
                <input
                  type="number"
                  min={0}
                  value={selectedStep.component.mongoSkip ?? 0}
                  onChange={(event) => updateRagComponent({ mongoSkip: Math.max(0, Number(event.target.value) || 0) })}
                />
              </label>
              <label>
                Max páginas
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={selectedStep.component.mongoMaxPages ?? 5}
                  onChange={(event) => updateRagComponent({ mongoMaxPages: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })}
                />
              </label>
            </div>
            <div className="filter-empty">
              Max páginas define quantas páginas o backend percorre a partir da página inicial. Ex: limite 100 e max páginas 5 busca até 500 registros, parando antes se não houver mais dados.
            </div>
          </div>
          )}
          {mongoShowsDateRange && (
          <div className="rich-editor-block">
            <div className="filter-section-header">
              <strong>Range de data</strong>
            </div>
            <div className="mongo-date-grid">
              <label>
                Campo de data
                <input
                  value={selectedStep.component.mongoDateField || ''}
                  placeholder="createdAt"
                  onChange={(event) => updateRagComponent({ mongoDateField: event.target.value })}
                />
              </label>
              <label>
                Timezone
                <input
                  value={selectedStep.component.mongoDateTimezone || 'America/Sao_Paulo'}
                  placeholder="America/Sao_Paulo"
                  onChange={(event) => updateRagComponent({ mongoDateTimezone: event.target.value })}
                />
              </label>
            </div>
            <div className="mongo-date-grid">
              <label>
                Início
                <input
                  type="datetime-local"
                  value={selectedStep.component.mongoDateStart || ''}
                  onChange={(event) => updateRagComponent({ mongoDateStart: event.target.value })}
                />
              </label>
              <label>
                Fim
                <input
                  type="datetime-local"
                  value={selectedStep.component.mongoDateEnd || ''}
                  onChange={(event) => updateRagComponent({ mongoDateEnd: event.target.value })}
                />
              </label>
            </div>
          </div>
          )}
          <div className="rich-editor-block">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedStep.component.mongoUseLlmFilter === true}
                onChange={(event) => updateRagComponent({ mongoUseLlmFilter: event.target.checked })}
              />
              <span>Montar campos com LLM</span>
            </label>
            {selectedStep.component.mongoUseLlmFilter === true && (
              <>
                {!mongoLlmFullOnly && (
                  <label>
                    Modo do LLM
                    <select
                      value={selectedStep.component.mongoLlmMode || 'filter'}
                      onChange={(event) => updateRagComponent({ mongoLlmMode: event.target.value as MongoLlmMode })}
                    >
                      <option value="filter">Somente consulta</option>
                      <option value="full">Consulta completa + paginação</option>
                    </select>
                  </label>
                )}
                <label>
                  Instrução do MongoDB
                  <textarea
                    rows={4}
                    value={selectedStep.component.mongoLlmInstruction || ''}
                    placeholder={mongoLlmPlaceholder}
                    onChange={(event) => updateRagComponent({ mongoLlmInstruction: event.target.value })}
                  />
                </label>
                <label>
                  Modelo
                  <select
                    value={selectedStep.component.mongoLlmModel || ''}
                    onChange={(event) => updateRagComponent({ mongoLlmModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="filter-empty">
              {mongoLlmFullOnly
                ? 'Nesta operação, o LLM monta os campos principais da ação: document/documents para insert ou filter + update para update/upsert. Os campos manuais ficam como fallback.'
                : selectedStep.component.mongoLlmMode === 'full'
                  ? 'Consulta completa: o LLM pode montar filter, sort, projection/pipeline, range de data e paginação. O backend ainda limita limite e max páginas.'
                  : 'Somente consulta: o LLM monta filter, sort, projection ou pipeline. Limite, paginação, range de data e demais campos manuais continuam valendo.'}
            </div>
          </div>
          <MongoConfigAiPanel
            prompt={mongoAiPrompt}
            generated={mongoAiGenerated}
            error={mongoAiError}
            loading={mongoAiGenerating}
            copied={mongoAiCopied}
            onPromptChange={setMongoAiPrompt}
            onGenerate={() => void generateMongoConfig()}
            onCopy={() => void copyGeneratedMongoConfig()}
            onApply={applyGeneratedMongoConfig}
          />
          {mongoShowsFilter && (
            <label>
              {mongoOperation === 'aggregate' ? 'Filtro / $match JSON' : 'Filtro JSON'}
              <textarea
                rows={4}
                value={selectedStep.component.mongoFilter || '{}'}
                placeholder='{"conversationId": "{{context.slots.conversationId}}"}'
                onChange={(event) => updateRagComponent({ mongoFilter: event.target.value })}
              />
            </label>
          )}
          {mongoShowsDocument && (
            <label>
              {mongoOperation === 'insertMany' ? 'Documentos JSON' : 'Documento JSON'}
              <textarea
                rows={5}
                value={selectedStep.component.mongoDocument || '{}'}
                placeholder={mongoOperation === 'insertMany'
                  ? '[{"event": "entrada_fluxo"}, {"event": "lead_convertido"}]'
                  : '{"event": "entrada_fluxo", "userInput": "{{context.slots.userInput}}"}'}
                onChange={(event) => updateRagComponent({ mongoDocument: event.target.value })}
              />
            </label>
          )}
          {mongoShowsUpdate && (
            <label>
              Update JSON
              <textarea
                rows={4}
                value={selectedStep.component.mongoUpdate || '{}'}
                placeholder='{"$set": {"status": "convertido"}}'
                onChange={(event) => updateRagComponent({ mongoUpdate: event.target.value })}
              />
            </label>
          )}
          {mongoShowsProjection && (
            <label>
              Projection JSON
              <input
                value={selectedStep.component.mongoProjection || '{}'}
                placeholder='{"_id": 0, "conversationId": 1}'
                onChange={(event) => updateRagComponent({ mongoProjection: event.target.value })}
              />
            </label>
          )}
          {mongoOperation === 'aggregate' && (
            <label>
              Pipeline aggregate JSON
              <textarea
                rows={6}
                value={selectedStep.component.mongoPipeline || '[]'}
                placeholder='[{"$group": {"_id": "$event", "total": {"$sum": 1}}}]'
                onChange={(event) => updateRagComponent({ mongoPipeline: event.target.value })}
              />
            </label>
          )}
        </>
      )}
      {selectedStep.component?.type === 'loop' && (
        <>
          <div className="filter-empty">
            O Loop executa as saídas conectadas enquanto não atingir o limite de voltas e enquanto a condição JS de parada for falsa. Para repetir, conecte Loop -&gt; corpo e depois corpo -&gt; Loop.
          </div>
          <div className="inspector-grid-two">
            <label>
              Slot do loop
              <input
                value={selectedStep.component.loopResponseName || selectedStep.component.responseName || ''}
                placeholder="loop"
                onChange={(event) => updateRagComponent({ loopResponseName: event.target.value, responseName: event.target.value })}
              />
            </label>
            <label>
              Quantidade de voltas
              <input
                type="number"
                min={1}
                max={1000}
                value={selectedStep.component.loopMaxIterations ?? 3}
                onChange={(event) => updateRagComponent({ loopMaxIterations: Math.max(1, Math.min(1000, Number(event.target.value) || 1)) })}
              />
            </label>
          </div>
          <label>
            Slot do contador
            <input
              value={selectedStep.component.loopIndexResponseName || ''}
              placeholder="loopIndex"
              onChange={(event) => updateRagComponent({ loopIndexResponseName: event.target.value })}
            />
            <div className="reason-slot-hint">
              Se ficar vazio, o contador será salvo em <code>context.slots.loopIndex</code>. Se você preencher <code>contador</code>, use <code>context.slots.contador</code> ou <code>slots.contador</code> nas condições.
            </div>
          </label>
          <label>
            Espera entre voltas (segundos)
            <input
              type="number"
              min={0}
              max={3600}
              step={0.1}
              value={selectedStep.component.loopDelaySeconds ?? 0}
              onChange={(event) => updateRagComponent({ loopDelaySeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })}
            />
          </label>
          <label>
            Condição JS para parar
            <textarea
              rows={4}
              value={selectedStep.component.loopStopCondition || ''}
              placeholder='context.slots.api?.status === "done"'
              onChange={(event) => updateRagComponent({ loopStopCondition: event.target.value })}
            />
          </label>
          <div className="filter-empty">
            Use 0 para rodar sem pausa. A espera acontece antes da segunda volta em diante, ou seja, entre uma repetição e outra.
          </div>
          <div className="filter-empty">
            Durante a execução, o backend grava context.slots.{selectedStep.component.loopResponseName || selectedStep.component.responseName || 'loop'}.iteration e context.slots.{selectedStep.component.loopIndexResponseName || 'loopIndex'} com a volta atual, começando em 1. O índice começando em 0 fica em context.slots.{selectedStep.component.loopResponseName || selectedStep.component.responseName || 'loop'}.index. Para seguir depois que o loop acabar, crie uma ligação saindo do Loop para o próximo nó com a condição JS: !context.slots.{selectedStep.component.loopResponseName || selectedStep.component.responseName || 'loop'}.shouldContinue
          </div>
        </>
      )}
      {selectedStep.component?.type === 'context' && (
        <>
          <div className="filter-empty">
            O Contexto cria ou atualiza campos em context.slots. Os proximos nos podem usar essas variaveis com {'{{context.slots.nomeDoCampo}}'} ou via JS.
          </div>
          <div className="filter-empty">
            Se preencher Slot do resultado, os mesmos campos tambem ficam agrupados nele. Exemplo: com slot <code>email</code> e campo <code>to</code>, use <code>{'{{context.slots.email.to}}'}</code>.
          </div>
          <div className="inspector-grid-two">
            <label>
              Slot do resultado
              <input
                value={selectedStep.component.responseName || ''}
                placeholder="context"
                onChange={(event) => updateRagComponent({ responseName: event.target.value })}
              />
            </label>
            <label>
              Modo
              <select
                value={contextMode}
                onChange={(event) => updateRagComponent({ contextMode: event.target.value as ContextMode })}
              >
                <option value="json">JSON com variaveis</option>
                <option value="js">Script JS</option>
                <option value="llm">LLM</option>
              </select>
            </label>
          </div>
          {contextMode === 'json' && (
            <CodeEditorField
              label="JSON para mesclar no contexto"
              language="JSON"
              rows={9}
              value={contextJsonValue}
              placeholder={'{\n  "cliente": "{{context.slots.input}}",\n  "payload": {"origem": "web"}\n}'}
              error={contextJsonError}
              onChange={(value) => updateRagComponent({ contextJson: value })}
              onOpen={() => setContextEditorModal('json')}
            />
          )}
          {contextMode === 'js' && (
            <CodeEditorField
              label="Script JS que retorna um JSON"
              language="JavaScript"
              rows={11}
              value={contextScriptValue}
              placeholder={'const itens = context.slots.itens || [];\nreturn {\n  total: itens.length,\n  nomes: itens.map((item) => item.nome)\n};'}
              error={contextScriptError}
              onChange={(value) => updateRagComponent({ contextScript: value })}
              onOpen={() => setContextEditorModal('js')}
            />
          )}
          {contextMode === 'llm' && (
            <>
              <label>
                Instrucao LLM
                <textarea
                  rows={7}
                  value={selectedStep.component.contextLlmPrompt || ''}
                  placeholder="Extraia da conversa um JSON com nome, email e interesse. Responda somente com os campos que devem entrar em context.slots."
                  onChange={(event) => updateRagComponent({ contextLlmPrompt: event.target.value })}
                />
              </label>
              <div className="inspector-grid-two">
                <label>
                  Modelo
                  <select
                    value={selectedStep.component.contextLlmModel || ''}
                    onChange={(event) => updateRagComponent({ contextLlmModel: event.target.value })}
                  >
                    <option value="">Usar modelo do fluxo ({config.model})</option>
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temperatura
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={selectedStep.component.contextLlmTemperature ?? 0.2}
                    onChange={(event) => updateRagComponent({ contextLlmTemperature: Number(event.target.value) })}
                  />
                </label>
              </div>
            </>
          )}
          <div className="filter-empty">
            O retorno precisa ser um objeto JSON no topo, por exemplo {'{"lead": {"nome": "Ana"}, "score": 8}'}. Arrays ou textos soltos nao sao mesclados.
          </div>
        </>
      )}
      {selectedStep.component?.type === 'flowRouter' && (
        <>
          <div className="filter-empty">
            O roteador avalia as regras em ordem. A primeira regra verdadeira pula a conversa para o flow escolhido. Se nenhuma regra bater, ele para neste ponto ou usa o fallback configurado.
          </div>
          <div className="filter-empty">
            Escolha o agente do destino para listar os fluxos dele. O valor executado continua sendo o ID do fluxo, e o runtime troca o agente ativo para o agente do fluxo destino.
          </div>
          <label>
            Slot do resultado
            <input
              value={selectedStep.component.flowRouterReasonResponseName || selectedStep.component.responseName || ''}
              placeholder="flowRouter"
              onChange={(event) => updateRagComponent({
                flowRouterReasonResponseName: event.target.value,
                responseName: event.target.value,
              })}
            />
            <span className="field-hint reason-slot-hint">
              Salva o resultado do roteador em <code>{`context.slots.${selectedStep.component.flowRouterReasonResponseName || selectedStep.component.responseName || 'flowRouter'}`}</code>, incluindo regra escolhida, destino e motivo quando a decisão usar LLM.
            </span>
          </label>
          <div className="filter-empty">
            O jump usa apenas as regras JS ou LLM abaixo, entra no flow destino e não reaproveita a mensagem atual como resposta dos inputs do destino.
          </div>
          {flowRouterAgentsError && (
            <div className="auth-error">{flowRouterAgentsError}</div>
          )}
          <div className="rich-editor-block">
            <div className="filter-section-header">
              <strong>Regras de roteamento</strong>
              <button type="button" onClick={addFlowRouterRule}>
                <Plus size={14} />
                Regra
              </button>
            </div>
            {!flowRouterRules.length && (
              <div className="filter-empty">
                Adicione uma regra para escolher um fluxo destino. Use LLM para intenção aberta ou JS para regras diretas com context.slots.
              </div>
            )}
            {flowRouterRules.map((rule, index) => (
              <div className="filter-rule-card" key={rule.id}>
                <div className="filter-section-header">
                  <strong>{rule.label || `Regra ${index + 1}`}</strong>
                  <button type="button" className="danger-link" onClick={() => removeFlowRouterRule(rule.id)}>
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>
                {(() => {
                  const targetAgentId = getFlowRouterAgentId(rule.targetAgentId);
                  const targetFlowOptions = getFlowRouterOptions(targetAgentId);
                  const isLoadingTargetFlows = flowRouterLoadingByAgent[targetAgentId] === true;
                  return (
                    <>
                      <div className="inspector-grid-two">
                        <label>
                          Nome
                          <input
                            value={rule.label || ''}
                            placeholder={`Regra ${index + 1}`}
                            onChange={(event) => updateFlowRouterRule(rule.id, { label: event.target.value })}
                          />
                        </label>
                        <label>
                          Agente destino
                          <select
                            value={targetAgentId}
                            onChange={(event) => updateFlowRouterRule(rule.id, {
                              targetAgentId: event.target.value,
                              targetFlowId: '',
                            })}
                          >
                            {flowRouterAgentOptions.map((agent) => (
                              <option key={agent.agentId || agent.name} value={agent.agentId || agent.name}>
                                {agent.name}{(agent.agentId || agent.name) === currentAgentId ? ' (atual)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        Fluxo destino
                        <select
                          value={rule.targetFlowId || ''}
                          onChange={(event) => updateFlowRouterRule(rule.id, {
                            targetAgentId,
                            targetFlowId: event.target.value,
                          })}
                          disabled={isLoadingTargetFlows}
                        >
                          <option value="">{isLoadingTargetFlows ? 'Carregando fluxos...' : 'Selecione um fluxo'}</option>
                          {rule.targetFlowId && !hasFlowRouterOption(rule.targetFlowId, targetAgentId) && (
                            <option value={rule.targetFlowId}>{formatExternalFlowOption(rule.targetFlowId, targetAgentId)}</option>
                          )}
                          {targetFlowOptions.map((flow) => (
                            <option key={flow._id} value={flow._id}>
                              {flow.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  );
                })()}
                <label>
                  Modo da regra
                  <select
                    value={rule.conditionMode || 'js'}
                    onChange={(event) => updateFlowRouterRule(rule.id, { conditionMode: event.target.value as ConditionMode })}
                  >
                    <option value="js">Regra JS</option>
                    <option value="llm">Instrução LLM</option>
                  </select>
                </label>
                <label>
                  {rule.conditionMode === 'llm' ? 'Instrução LLM' : 'Condição JS'}
                  <textarea
                    rows={4}
                    value={rule.condition || ''}
                    placeholder={rule.conditionMode === 'llm'
                      ? 'Ex: roteie se o usuário quer falar sobre financeiro, boleto ou pagamento.'
                      : 'context.slots.userInput?.includes("boleto")'}
                    onChange={(event) => updateFlowRouterRule(rule.id, { condition: event.target.value })}
                  />
                </label>
                {rule.conditionMode === 'llm' && (
                  <div className="inspector-grid-two">
                    <label>
                      Modelo
                      <select
                        value={rule.conditionModel || ''}
                        onChange={(event) => updateFlowRouterRule(rule.id, { conditionModel: event.target.value })}
                      >
                        <option value="">Usar modelo do fluxo ({config.model})</option>
                        {modelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Temperatura
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={rule.conditionTemperature ?? 0}
                        onChange={(event) => updateFlowRouterRule(rule.id, { conditionTemperature: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
          {(() => {
            const fallbackAgentId = getFlowRouterAgentId(selectedStep.component.flowRouterFallbackAgentId);
            const fallbackFlowOptions = getFlowRouterOptions(fallbackAgentId);
            const isLoadingFallbackFlows = flowRouterLoadingByAgent[fallbackAgentId] === true;
            return (
              <div className="rich-editor-block">
                <div className="filter-section-header">
                  <strong>Fallback</strong>
                </div>
                <div className="inspector-grid-two">
                  <label>
                    Agente do fallback
                    <select
                      value={fallbackAgentId}
                      onChange={(event) => updateRagComponent({
                        flowRouterFallbackAgentId: event.target.value,
                        flowRouterFallbackFlowId: '',
                      })}
                    >
                      {flowRouterAgentOptions.map((agent) => (
                        <option key={agent.agentId || agent.name} value={agent.agentId || agent.name}>
                          {agent.name}{(agent.agentId || agent.name) === currentAgentId ? ' (atual)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fluxo se nenhuma regra bater
                    <select
                      value={selectedStep.component.flowRouterFallbackFlowId || ''}
                      onChange={(event) => updateRagComponent({
                        flowRouterFallbackAgentId: fallbackAgentId,
                        flowRouterFallbackFlowId: event.target.value,
                      })}
                      disabled={isLoadingFallbackFlows}
                    >
                      <option value="">{isLoadingFallbackFlows ? 'Carregando fluxos...' : 'Parar neste ponto'}</option>
                      {selectedStep.component.flowRouterFallbackFlowId && !hasFlowRouterOption(selectedStep.component.flowRouterFallbackFlowId, fallbackAgentId) && (
                        <option value={selectedStep.component.flowRouterFallbackFlowId}>
                          {formatExternalFlowOption(selectedStep.component.flowRouterFallbackFlowId, fallbackAgentId)}
                        </option>
                      )}
                      {fallbackFlowOptions.map((flow) => (
                        <option key={flow._id} value={flow._id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })()}
        </>
      )}
      {selectedStep.component?.type === 'dashboard' && (
        <>
          <div className="filter-empty">
            Monta um payload analítico e exibe no teste como Debug. Use para funil, tráfego, traces de API e consultas em MongoDB/Milvus.
          </div>
          <label>
            Título do dashboard
            <input
              value={selectedStep.component.dashboardTitle || ''}
              placeholder="Analítico do fluxo"
              onChange={(event) => updateRagComponent({ dashboardTitle: event.target.value })}
            />
          </label>
          <div className="inspector-grid-two">
            <label>
              Fonte
              <select
                value={selectedStep.component.dashboardSource || 'trace'}
                onChange={(event) => updateRagComponent({ dashboardSource: event.target.value as DashboardSource })}
              >
                <option value="trace">Trace do fluxo</option>
                <option value="mongodb">MongoDB</option>
                <option value="api">API externa</option>
                <option value="milvus">Milvus/RAG</option>
              </select>
            </label>
            <label>
              Visualizacao
              <select
                value={selectedStep.component.dashboardMode || 'summary'}
                onChange={(event) => updateRagComponent({ dashboardMode: event.target.value as DashboardMode })}
              >
                <option value="summary">Resumo</option>
                <option value="table">Tabela</option>
                <option value="funnel">Funil</option>
                <option value="timeseries">Serie temporal</option>
                <option value="bar">Grafico de barras</option>
                <option value="pie">Grafico de pizza</option>
              </select>
            </label>
          </div>
          {(selectedStep.component.dashboardMode === 'bar' || selectedStep.component.dashboardMode === 'pie' || selectedStep.component.dashboardMode === 'timeseries') && (
            <div className="rich-editor-block">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedStep.component.dashboardUseLlm !== false}
                  onChange={(event) => updateRagComponent({ dashboardUseLlm: event.target.checked })}
                />
                <span>Montar gráfico com LLM</span>
              </label>
              {selectedStep.component.dashboardUseLlm !== false && (
                <>
                  <label>
                    Prompt do gráfico
                    <textarea
                      rows={4}
                      value={selectedStep.component.dashboardLlmPrompt || ''}
                      placeholder="Ex: agrupe por etapa do funil e gere labels curtos."
                      onChange={(event) => updateRagComponent({ dashboardLlmPrompt: event.target.value })}
                    />
                  </label>
                  <label>
                    Modelo para montar
                    <select
                      value={selectedStep.component.dashboardModel || ''}
                      onChange={(event) => updateRagComponent({ dashboardModel: event.target.value })}
                    >
                      <option value="">Usar modelo do fluxo ({config.model})</option>
                      {modelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <div className="filter-empty">
                O LLM recebe os dados da fonte escolhida e devolve um JSON de gráfico. Se falhar, o backend monta o gráfico automaticamente.
              </div>
            </div>
          )}
          {selectedStep.component.dashboardSource === 'mongodb' && (
            <>
              <div className="inspector-grid-two">
                <label>
                  Collection MongoDB
                  <input
                    value={selectedStep.component.dashboardCollectionName || selectedStep.component.mongoCollectionName || ''}
                    placeholder="flow_events"
                    onChange={(event) => updateRagComponent({ dashboardCollectionName: event.target.value })}
                  />
                </label>
                <label>
                  Limite
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={selectedStep.component.mongoLimit ?? 100}
                    onChange={(event) => updateRagComponent({ mongoLimit: Number(event.target.value) || 100 })}
                  />
                </label>
              </div>
              <label>
                Pipeline aggregate JSON
                <textarea
                  rows={7}
                  value={selectedStep.component.dashboardPipeline || '[]'}
                  placeholder='[{"$group": {"_id": "$stage", "users": {"$addToSet": "$conversationId"}}}, {"$project": {"stage": "$_id", "total": {"$size": "$users"}}}]'
                  onChange={(event) => updateRagComponent({ dashboardPipeline: event.target.value })}
                />
              </label>
            </>
          )}
          {selectedStep.component.dashboardSource === 'api' && (
            <HttpBatchEditor
              requests={parseJson(selectedStep.component.dashboardApiRequests || '[]', []) as Array<Record<string, unknown>>}
              onChange={(requests) => updateRagComponent({ dashboardApiRequests: JSON.stringify(requests, null, 2) })}
            />
          )}
          {selectedStep.component.dashboardSource === 'milvus' && (
            <>
              <div className="inspector-grid-two">
                <label>
                  Collection Milvus
                  <input
                    value={selectedStep.component.collectionName || ''}
                    onChange={(event) => updateRagComponent({ collectionName: event.target.value })}
                  />
                </label>
                <label>
                  K
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={selectedStep.component.dashboardK ?? selectedStep.component.k ?? 10}
                    onChange={(event) => updateRagComponent({ dashboardK: Number(event.target.value) || 10 })}
                  />
                </label>
              </div>
              <label>
                Query Milvus
                <input
                  value={selectedStep.component.dashboardQueryTemplate || selectedStep.component.queryTemplate || ''}
                  placeholder="{{context.slots.userInput}}"
                  onChange={(event) => updateRagComponent({ dashboardQueryTemplate: event.target.value })}
                />
              </label>
              <label>
                Filtro Milvus
                <input
                  value={selectedStep.component.dashboardFilterExpr || selectedStep.component.filterExpr || ''}
                  placeholder={'source == "fluxo"'}
                  onChange={(event) => updateRagComponent({ dashboardFilterExpr: event.target.value })}
                />
              </label>
            </>
          )}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.component.dashboardIncludeTrace !== false}
              onChange={(event) => updateRagComponent({ dashboardIncludeTrace: event.target.checked })}
            />
            <span>Incluir trace do fluxo no resultado</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.component.dashboardShowTable === true}
              onChange={(event) => updateRagComponent({ dashboardShowTable: event.target.checked })}
            />
            <span>Mostrar tabela de dados no web widget/teste</span>
          </label>
        </>
      )}
      {selectedStep.component?.type === 'cron' && (
        <>
          <div className="filter-empty">
            Agenda a execução do fluxo. Conecte a saída do CRON no primeiro nó que deve rodar, ou selecione executar desde o início do fluxo.
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedStep.component.cronEnabled === true}
              onChange={(event) => updateRagComponent({ cronEnabled: event.target.checked })}
            />
            <span>Ativar agendamento</span>
          </label>
          <div className="cron-grid-two">
            <label>
              Recorrência
              <select
                value={selectedStep.component.cronMode || 'interval'}
                onChange={(event) => updateRagComponent({ cronMode: event.target.value as CronMode })}
              >
                <option value="interval">A cada X tempo</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </label>
            <label>
              Executar
              <select
                value={selectedStep.component.cronRunFrom || 'cronNode'}
                onChange={(event) => updateRagComponent({ cronRunFrom: event.target.value as CronRunFrom })}
              >
                <option value="cronNode">Da saída do CRON</option>
                <option value="flowStart">Do início do fluxo</option>
              </select>
            </label>
          </div>
          {(selectedStep.component.cronMode || 'interval') === 'interval' && (
            <div className="cron-grid-two compact-cron-grid">
              <label>
                A cada
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={selectedStep.component.cronIntervalValue ?? 15}
                  onChange={(event) => updateRagComponent({ cronIntervalValue: Math.max(1, Number(event.target.value) || 1) })}
                />
              </label>
              <label>
                Unidade
                <select
                  value={selectedStep.component.cronIntervalUnit || 'minutes'}
                  onChange={(event) => updateRagComponent({ cronIntervalUnit: event.target.value as CronIntervalUnit })}
                >
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                </select>
              </label>
            </div>
          )}
          {(selectedStep.component.cronMode || 'interval') !== 'interval' && (
            <div className="cron-grid-two compact-cron-grid">
              <label>
                Horário
                <input
                  type="time"
                  value={selectedStep.component.cronTime || '09:00'}
                  onChange={(event) => updateRagComponent({ cronTime: event.target.value })}
                />
              </label>
              {selectedStep.component.cronMode === 'weekly' && (
                <label>
                  Dia da semana
                  <select
                    value={selectedStep.component.cronWeekday ?? 1}
                    onChange={(event) => updateRagComponent({ cronWeekday: Number(event.target.value) })}
                  >
                    <option value={0}>Domingo</option>
                    <option value={1}>Segunda</option>
                    <option value={2}>Terça</option>
                    <option value={3}>Quarta</option>
                    <option value={4}>Quinta</option>
                    <option value={5}>Sexta</option>
                    <option value={6}>Sábado</option>
                  </select>
                </label>
              )}
              {selectedStep.component.cronMode === 'monthly' && (
                <label>
                  Dia do mês
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={selectedStep.component.cronMonthDay ?? 1}
                    onChange={(event) => updateRagComponent({ cronMonthDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })}
                  />
                </label>
              )}
            </div>
          )}
          <div className="cron-grid-two">
            <label>
              Timezone
              <input
                value={selectedStep.component.cronTimezone || 'America/Sao_Paulo'}
                placeholder="America/Sao_Paulo"
                onChange={(event) => updateRagComponent({ cronTimezone: event.target.value })}
              />
            </label>
            <label>
              Começar em
              <input
                type="datetime-local"
                value={selectedStep.component.cronStartAt || ''}
                onChange={(event) => updateRagComponent({ cronStartAt: event.target.value })}
              />
            </label>
          </div>
          <label>
            Mensagem de entrada
            <input
              value={selectedStep.component.cronInputText || ''}
              placeholder="Texto usado como input quando o agendamento rodar"
              onChange={(event) => updateRagComponent({ cronInputText: event.target.value })}
            />
          </label>
          <label>
            Slots extras JSON
            <textarea
              rows={4}
              value={selectedStep.component.cronSlotsJson || '{}'}
              placeholder='{"source": "cron", "campanha": "followup"}'
              onChange={(event) => updateRagComponent({ cronSlotsJson: event.target.value })}
            />
          </label>
          <div className="filter-empty">
            Salve o fluxo para o scheduler considerar esta configuração. Horários exibidos em {cronTimezone}. Próxima execução: {formatCronDate(selectedStep.component.cronNextRunAt, cronTimezone) || 'será calculada pelo backend'}. Última execução: {formatCronDate(selectedStep.component.cronLastRunAt, cronTimezone) || 'nenhuma'}.
          </div>
          <div className="cron-log-panel">
            <div className="filter-section-header">
              <strong>Histórico leve</strong>
              <button
                type="button"
                onClick={() => onRefreshCronLog?.(selectedStep.id)}
                disabled={!canRefreshCronLog || !onRefreshCronLog}
              >
                <RefreshCw size={14} />
                Atualizar
              </button>
            </div>
            {!cronLog.length && (
              <div className="filter-empty">Nenhuma execução registrada ainda. O histórico guarda apenas as últimas execuções.</div>
            )}
            {cronLog.length > 0 && (
              <div className="cron-log-list">
                {cronLog.slice(0, 8).map((entry, index) => (
                  <div className={`cron-log-entry ${entry.status === 'error' ? 'error' : 'ok'}`} key={`${entry.firedAt}-${index}`}>
                    <div>
                      <strong>{entry.status === 'error' ? 'Erro' : 'Executado'}</strong>
                      <span>{formatCronDate(entry.finishedAt || entry.firedAt, cronTimezone)}</span>
                    </div>
                    <small>
                      {entry.status === 'ok'
                        ? `${entry.messages ?? 0} mensagem(ns) - ${entry.durationMs ?? 0}ms`
                        : entry.error || 'Erro sem detalhes.'}
                    </small>
                    {entry.nextRunAt && <em>Próxima: {formatCronDate(entry.nextRunAt, cronTimezone)}</em>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
    {renderPromptFieldAssistantModal()}
    {contextEditorModal && selectedStep.component?.type === 'context' && (
      <div className="modal-backdrop context-code-backdrop" onMouseDown={() => setContextEditorModal(null)}>
        <div className="context-code-modal" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div>
              <strong>{contextEditorTitle}</strong>
              <span>{contextEditorLanguage}</span>
            </div>
            <button type="button" onClick={() => setContextEditorModal(null)}>
              <X size={16} />
              Fechar
            </button>
          </div>
          <div className={`context-code-modal-body ${contextEditorModal === 'js' ? 'with-ai' : ''}`}>
            {contextEditorModal === 'js' && (
              <ContextScriptAiPanel
                prompt={contextScriptPrompt}
                generatedCode={contextScriptGenerated}
                generatedExplanation={contextScriptGeneratedExplanation}
                error={contextScriptGenerateError}
                loading={contextScriptGenerating}
                copied={contextScriptCopied}
                onPromptChange={setContextScriptPrompt}
                onGenerate={() => void generateContextScript()}
                onCopy={() => void copyGeneratedContextScript()}
                onApply={applyGeneratedContextScript}
              />
            )}
            <LineNumberedCodeTextarea
              language={contextEditorModal === 'json' ? 'json' : 'js'}
              rows={30}
              fill
              error={contextEditorError}
              value={contextEditorValue}
              placeholder={contextEditorPlaceholder}
              onChange={updateContextEditorValue}
            />
            {contextEditorError && <div className="code-editor-error">{contextEditorError}</div>}
          </div>
        </div>
      </div>
    )}
    {mcpRemoteServerPresetHelp && (
      <div className="modal-backdrop mcp-preset-help-backdrop" onMouseDown={() => setMcpPresetHelpId(null)}>
        <div className="mcp-preset-help-modal" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div>
              <strong>{mcpRemoteServerPresetHelp.label}</strong>
              <span>Permissoes e configuracao necessarias</span>
            </div>
            <button type="button" onClick={() => setMcpPresetHelpId(null)}>
              <X size={16} />
              Fechar
            </button>
          </div>
          <div className="mcp-preset-help-body">
            <p>{mcpRemoteServerPresetHelp.description}</p>
            <div className="mcp-preset-help-auth">
              <strong>Autenticacao usada pelo Canvas Flow</strong>
              <code>{mcpRemoteServerPresetHelp.authMode}</code>
            </div>
            {mcpRemoteServerPresetHelp.oauthScopes?.length && (
              <div className="mcp-preset-help-scopes">
                <strong>Scopes OAuth solicitados</strong>
                {mcpRemoteServerPresetHelp.oauthScopes.map((scope) => <code key={scope}>{scope}</code>)}
              </div>
            )}
            <div className="mcp-preset-help-links">
              {mcpRemoteServerPresetHelp.setupLinks.map((link) => (
                <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </a>
              ))}
            </div>
            {mcpRemoteServerPresetHelp.setupNotes?.length && (
              <div className="mcp-preset-help-notes">
                <strong>Antes de testar</strong>
                {mcpRemoteServerPresetHelp.setupNotes.map((note) => <span key={note}>{note}</span>)}
              </div>
            )}
          </div>
          <div className="mcp-preset-help-footer">
            <a href={mcpRemoteServerPresetHelp.docsUrl} target="_blank" rel="noreferrer">Documentacao oficial</a>
            <button type="button" className="primary-button" onClick={() => setMcpPresetHelpId(null)}>Entendi</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
