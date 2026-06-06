import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Check, Cloud, Copy, Database, Loader2, MessageCircle, Monitor, Save, Search, Send, ShieldCheck, Trash2, X } from 'lucide-react';
import { canvasApi } from '../lib/api';
import { LLM_MODEL_OPTIONS_BY_PROVIDER } from '../lib/llmModels';
import type { CanvasFlowProviderSettings } from '../types/flow';

const DEFAULT_SETTINGS: CanvasFlowProviderSettings = {
  llmProvider: 'openai',
  openai: {
    enabled: true,
    apiKey: '',
    chatModel: 'gpt-4o',
    embeddingModel: 'text-embedding-3-large',
    ocrModel: 'gpt-4o',
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
  gemini: {
    enabled: false,
    apiKey: '',
    chatModel: 'gemini-3.5-flash',
  },
  claude: {
    enabled: false,
    apiKey: '',
    chatModel: 'claude-sonnet-4-6',
  },
  grok: {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.x.ai/v1',
    chatModel: 'grok-2-latest',
  },
  bedrock: {
    enabled: false,
    apiKey: '',
    baseUrl: '',
    region: 'us-east-1',
    chatModel: 'anthropic.claude-sonnet-4-6',
  },
  milvus: {
    address: '',
    token: '',
    username: '',
    password: '',
    collectionName: 'canvas_flow_docs',
  },
  azureBlob: {
    connectionString: '',
    containerName: '',
  },
  azureSearch: {
    endpoint: '',
    apiKey: '',
    indexName: '',
    apiVersion: '2024-07-01',
  },
  mongodb: {
    connectionString: '',
    databaseName: '',
  },
  webWidget: {
    primaryColor: '#0f6bff',
    accentColor: '#00b37e',
    assistantName: 'Assistente IA',
    subtitle: 'Online agora',
    welcomeMessage: 'Ola! Como posso ajudar?',
    placeholder: 'Digite sua mensagem',
    bubbleLabel: 'Precisa de ajuda?',
    avatarText: 'IA',
    openByDefault: false,
    position: 'right',
  },
  whatsapp: {
    provider: 'meta',
    deliveryMode: 'provider',
    verifyToken: '',
    businessAccountId: '',
    phoneNumberId: '',
    accessToken: '',
    graphApiVersion: 'v20.0',
    autoReply: true,
    blipContractId: '',
    blipAuthorizationKey: '',
    sinchProjectId: '',
    sinchAppId: '',
    sinchRegion: 'us',
    sinchAccessToken: '',
    sinchChannel: 'WHATSAPP',
    sinchApiMode: 'conversation',
    sinchServiceNumber: '',
    sinchServiceUsername: '',
    sinchServiceToken: '',
  },
};

const CHAT_MODEL_OPTIONS = Array.from(
  new Map(
    Object.values(LLM_MODEL_OPTIONS_BY_PROVIDER)
      .flat()
      .map((option) => [option.value, option]),
  ).values(),
);

const EMBEDDING_MODEL_OPTIONS = [
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
  { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002' },
];

type SecretStatus = Record<string, boolean>;
type ProviderObjectSection = Exclude<keyof CanvasFlowProviderSettings, 'llmProvider'>;
type ProviderStatus = Record<string, {
  configured: boolean;
  source: 'agent' | 'global' | 'env' | 'none';
  scopeConfigured: boolean;
  inherited: boolean;
}>;

const PROVIDERS: Array<{
  id: ProviderObjectSection;
  title: string;
  subtitle: string;
  Icon: typeof Bot;
  color: string;
}> = [
  {
    id: 'openai',
    title: 'OpenAI',
    subtitle: 'Credencial OpenAI',
    Icon: Bot,
    color: '#2563eb',
  },
  {
    id: 'azureOpenai',
    title: 'Azure OpenAI',
    subtitle: 'Endpoint e credencial',
    Icon: Cloud,
    color: '#0ea5e9',
  },
  {
    id: 'gemini',
    title: 'Gemini',
    subtitle: 'Google AI Studio',
    Icon: Bot,
    color: '#7c3aed',
  },
  {
    id: 'claude',
    title: 'Claude',
    subtitle: 'Anthropic API',
    Icon: Bot,
    color: '#c2410c',
  },
  {
    id: 'grok',
    title: 'Grok',
    subtitle: 'xAI OpenAI-compatible',
    Icon: Bot,
    color: '#111827',
  },
  {
    id: 'bedrock',
    title: 'Bedrock',
    subtitle: 'Gateway OpenAI-compatible',
    Icon: Cloud,
    color: '#ea580c',
  },
  {
    id: 'milvus',
    title: 'Milvus',
    subtitle: 'Vetores e busca',
    Icon: Database,
    color: '#7c3aed',
  },
  {
    id: 'azureBlob',
    title: 'Azure Blob Storage',
    subtitle: 'Arquivos do RAG',
    Icon: Cloud,
    color: '#0891b2',
  },
  {
    id: 'azureSearch',
    title: 'Azure AI Search',
    subtitle: 'Indice e busca RAG',
    Icon: Search,
    color: '#16a34a',
  },
  {
    id: 'mongodb',
    title: 'MongoDB',
    subtitle: 'Base operacional',
    Icon: Database,
    color: '#15803d',
  },
  {
    id: 'webWidget',
    title: 'Web widget',
    subtitle: 'Aparencia e embed',
    Icon: Monitor,
    color: '#2563eb',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    subtitle: 'Canal e entrega',
    Icon: MessageCircle,
    color: '#0f766e',
  },
];

function mergeSettings(settings?: Partial<CanvasFlowProviderSettings>): CanvasFlowProviderSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    openai: { ...DEFAULT_SETTINGS.openai, ...(settings?.openai || {}) },
    azureOpenai: { ...DEFAULT_SETTINGS.azureOpenai, ...(settings?.azureOpenai || {}) },
    gemini: { ...DEFAULT_SETTINGS.gemini, ...(settings?.gemini || {}) },
    claude: { ...DEFAULT_SETTINGS.claude, ...(settings?.claude || {}) },
    grok: { ...DEFAULT_SETTINGS.grok, ...(settings?.grok || {}) },
    bedrock: { ...DEFAULT_SETTINGS.bedrock, ...(settings?.bedrock || {}) },
    milvus: { ...DEFAULT_SETTINGS.milvus, ...(settings?.milvus || {}) },
    azureBlob: { ...DEFAULT_SETTINGS.azureBlob, ...(settings?.azureBlob || {}) },
    azureSearch: { ...DEFAULT_SETTINGS.azureSearch, ...(settings?.azureSearch || {}) },
    mongodb: { ...DEFAULT_SETTINGS.mongodb, ...(settings?.mongodb || {}) },
    webWidget: { ...DEFAULT_SETTINGS.webWidget, ...(settings?.webWidget || {}) },
    whatsapp: { ...DEFAULT_SETTINGS.whatsapp, ...(settings?.whatsapp || {}) },
  };
}

function SecretHint({ path, status }: { path: string; status: SecretStatus }) {
  if (!status[path]) return null;
  return <small className="provider-secret-hint">Ja configurado. Deixe em branco para manter.</small>;
}

function providerConfigured(id: ProviderObjectSection, settings: CanvasFlowProviderSettings, secretStatus: SecretStatus) {
  if (id === 'openai') return secretStatus['openai.apiKey'] || Boolean(settings.openai.apiKey);
  if (id === 'azureOpenai') {
    return (
      Boolean(settings.azureOpenai.endpoint) &&
      (secretStatus['azureOpenai.apiKey'] || Boolean(settings.azureOpenai.apiKey))
    );
  }
  if (id === 'gemini') return secretStatus['gemini.apiKey'] || Boolean(settings.gemini.apiKey);
  if (id === 'claude') return secretStatus['claude.apiKey'] || Boolean(settings.claude.apiKey);
  if (id === 'grok') return secretStatus['grok.apiKey'] || Boolean(settings.grok.apiKey);
  if (id === 'bedrock') return (secretStatus['bedrock.apiKey'] || Boolean(settings.bedrock.apiKey)) && Boolean(settings.bedrock.baseUrl);
  if (id === 'milvus') return secretStatus['milvus.token'] || Boolean(settings.milvus.address || settings.milvus.username);
  if (id === 'azureBlob') return secretStatus['azureBlob.connectionString'] || Boolean(settings.azureBlob.containerName);
  if (id === 'azureSearch') return secretStatus['azureSearch.apiKey'] || Boolean(settings.azureSearch.endpoint || settings.azureSearch.indexName);
  if (id === 'mongodb') return secretStatus['mongodb.connectionString'] || Boolean(settings.mongodb.databaseName);
  if (id === 'webWidget') return Boolean(settings.webWidget.assistantName || settings.webWidget.primaryColor || settings.webWidget.welcomeMessage);
  if (id === 'whatsapp') {
    if (settings.whatsapp.provider === 'blip') {
      return Boolean(settings.whatsapp.blipContractId) && (secretStatus['whatsapp.blipAuthorizationKey'] || Boolean(settings.whatsapp.blipAuthorizationKey));
    }
    if (settings.whatsapp.provider === 'sinch') {
      if (settings.whatsapp.sinchApiMode === 'relay') {
        return Boolean(settings.whatsapp.sinchServiceUsername) && (secretStatus['whatsapp.sinchServiceToken'] || Boolean(settings.whatsapp.sinchServiceToken));
      }
      return Boolean(settings.whatsapp.sinchProjectId && settings.whatsapp.sinchAppId) && (secretStatus['whatsapp.sinchAccessToken'] || Boolean(settings.whatsapp.sinchAccessToken));
    }
    return Boolean(settings.whatsapp.phoneNumberId) && (secretStatus['whatsapp.accessToken'] || Boolean(settings.whatsapp.accessToken));
  }
  return false;
}

function providerStatusLabel(id: ProviderObjectSection, status: ProviderStatus, fallbackConfigured: boolean, scope: 'global' | 'agent') {
  const item = status[id];
  if (!item) return fallbackConfigured ? 'Configurado' : 'Nao configurado';
  if (item.source === 'agent') return 'Configurado no agente';
  if (item.source === 'global') return scope === 'global' ? 'Configurado' : 'Herdado do global';
  if (item.source === 'env') return 'Fallback .env';
  return 'Nao configurado';
}

function optionsWithCurrent(options: Array<{ value: string; label: string }>, current?: string) {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: `${current} (atual)` }, ...options];
}

function clampWidgetAvatar(value: string) {
  return value.slice(0, 3).toUpperCase();
}

function createWebWidgetEmbedCode(
  widget: CanvasFlowProviderSettings['webWidget'],
  context: {
    agentId: string;
    flowId: string;
    flowName?: string;
  },
) {
  const widgetSettings = {
    flowId: context.flowId,
    flowName: context.flowName || '<NOME_DO_FLUXO>',
    agentId: context.agentId,
    channel: 'webWidget',
    userContext: null,
    theme: {
      primaryColor: widget.primaryColor,
      accentColor: widget.accentColor,
      assistantName: widget.assistantName,
      subtitle: widget.subtitle,
      welcomeMessage: widget.welcomeMessage,
      placeholder: widget.placeholder,
      bubbleLabel: widget.bubbleLabel,
      avatarText: widget.avatarText,
      openByDefault: widget.openByDefault,
      position: widget.position,
    },
  };
  const widgetJson = JSON.stringify(widgetSettings, null, 2).replace(/</g, '\\u003c');

  return `<script>
const canvasFlowWidget = ${widgetJson};
const canvasFlowConversationStorageKey =
  "canvasFlowConversationId:" + canvasFlowWidget.agentId + ":" + canvasFlowWidget.flowId;
const canvasFlowSession = {
  // Anonimo: gere uma vez no browser e guarde.
  // Usuario logado: prefira receber este ID do seu backend/proxy.
  conversationId:
    window.localStorage.getItem(canvasFlowConversationStorageKey) ||
    ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "web-" + Date.now())
};
window.localStorage.setItem(canvasFlowConversationStorageKey, canvasFlowSession.conversationId);

async function enviarMensagemCanvasFlow(texto) {
  // O proxy deve validar o usuario logado e pode trocar conversationId/userContext
  // por valores confiaveis do seu sistema antes de chamar o Canvas Flow.
  // Produção: chame seu backend/proxy e injete o Authorization no servidor.
  const response = await fetch("/seu-backend/canvas-flow-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      flowId: canvasFlowWidget.flowId,
      agentId: canvasFlowWidget.agentId,
      channel: canvasFlowWidget.channel,
      conversationId: canvasFlowSession.conversationId,
      text: texto,
      slots: {
        webWidget: canvasFlowWidget.theme,
        user: canvasFlowWidget.userContext
      }
    })
  });

  const data = await response.json();
  // O backend recupera o checkpoint LangGraph usando conversationId.
  return data;
}

// Use canvasFlowWidget.theme para montar o botão, janela,
// cores, textos, posição e estado inicial do widget.
// Use canvasFlowWidget.userContext apenas para dados nao sensiveis.
</script>`;
}

interface ProviderConfigModalProps {
  agentId?: string;
  flowId?: string;
  flowName?: string;
  onClose: () => void;
}

export function ProviderConfigModal({ agentId, flowId, flowName, onClose }: ProviderConfigModalProps) {
  const [settings, setSettings] = useState<CanvasFlowProviderSettings>(DEFAULT_SETTINGS);
  const [secretStatus, setSecretStatus] = useState<SecretStatus>({});
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({});
  const [activeProvider, setActiveProvider] = useState<ProviderObjectSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderObjectSection | null>(null);
  const [scope, setScope] = useState<'global' | 'agent'>('global');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [widgetPreviewOpen, setWidgetPreviewOpen] = useState(DEFAULT_SETTINGS.webWidget.openByDefault);
  const [copiedWidgetCode, setCopiedWidgetCode] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeInfo = useMemo(() => PROVIDERS.find((item) => item.id === activeProvider), [activeProvider]);
  const currentAgentId = String(agentId || '').trim();
  const normalizedAgentId = currentAgentId || 'default-agent';
  const currentFlowId = String(flowId || '').trim();
  const currentFlowName = String(flowName || '').trim();
  const widgetContextAgentId = currentAgentId || '<AGENTE_ID>';
  const widgetContextFlowId = currentFlowId || '<FLOW_ID_DO_FLUXO>';
  const scopedAgentId = scope === 'agent' ? normalizedAgentId : undefined;
  const scopeLabel = scope === 'agent' ? `Agente: ${normalizedAgentId}` : 'Global';
  const webWidgetEmbedCode = useMemo(
    () => createWebWidgetEmbedCode(settings.webWidget, {
      agentId: widgetContextAgentId,
      flowId: widgetContextFlowId,
      flowName: currentFlowName || undefined,
    }),
    [currentFlowName, settings.webWidget, widgetContextAgentId, widgetContextFlowId],
  );

  const updateSection = <K extends ProviderObjectSection>(section: K, patch: Partial<CanvasFlowProviderSettings[K]>) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...(current[section] as Record<string, unknown>),
        ...(patch as Record<string, unknown>),
      },
    }));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    canvasApi.getProviderConfig({ agentId: scopedAgentId })
      .then((result) => {
        if (!mounted) return;
        setSettings(mergeSettings(result.settings));
        setSecretStatus(result.secretStatus || {});
        setProviderStatus(result.providerStatus || {});
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os provedores.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scopedAgentId]);

  useEffect(() => {
    setWidgetPreviewOpen(settings.webWidget.openByDefault);
  }, [settings.webWidget.openByDefault]);

  const copyWebWidgetCode = async () => {
    try {
      await navigator.clipboard.writeText(webWidgetEmbedCode);
      setCopiedWidgetCode(true);
      window.setTimeout(() => setCopiedWidgetCode(false), 1600);
    } catch {
      setError('Não foi possível copiar o código do widget.');
    }
  };

  const save = async () => {
    if (!activeProvider) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await canvasApi.updateProviderConfig({
        [activeProvider]: {
          ...(settings[activeProvider] as Record<string, unknown>),
          ...(activeProvider === 'whatsapp' || activeProvider === 'webWidget' ? {} : { enabled: providerConfigured(activeProvider, settings, secretStatus) }),
        },
      }, { agentId: scopedAgentId });
      setSettings(mergeSettings(result.settings));
      setSecretStatus(result.secretStatus || {});
      setProviderStatus(result.providerStatus || {});
      window.dispatchEvent(new Event('canvas-flow-provider-config-updated'));
      setMessage(`Configuracao salva em ${scopeLabel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar o provedor.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (section: ProviderObjectSection) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await canvasApi.deleteProviderConfigSection(section, { agentId: scopedAgentId });
      setSettings(mergeSettings(result.settings));
      setSecretStatus(result.secretStatus || {});
      setProviderStatus(result.providerStatus || {});
      setActiveProvider(null);
      setDeleteTarget(null);
      window.dispatchEvent(new Event('canvas-flow-provider-config-updated'));
      setMessage(`Configuracao removida de ${scopeLabel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel remover o provedor.');
    } finally {
      setSaving(false);
    }
  };

  const renderProviderForm = () => {
    if (!activeProvider) return null;

    if (activeProvider === 'openai') {
      return (
        <div className="provider-form-grid">
          <label>
            API key
            <input type="password" value={settings.openai.apiKey} onChange={(event) => updateSection('openai', { apiKey: event.target.value })} />
            <SecretHint path="openai.apiKey" status={secretStatus} />
          </label>
          <label>
            Modelo do chat
            <select value={settings.openai.chatModel} onChange={(event) => updateSection('openai', { chatModel: event.target.value })}>
              {optionsWithCurrent(CHAT_MODEL_OPTIONS, settings.openai.chatModel).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Modelo de embedding
            <select value={settings.openai.embeddingModel} onChange={(event) => updateSection('openai', { embeddingModel: event.target.value })}>
              {optionsWithCurrent(EMBEDDING_MODEL_OPTIONS, settings.openai.embeddingModel).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Modelo de OCR
            <input
              list="provider-chat-model-options"
              value={settings.openai.ocrModel}
              placeholder="gpt-4o"
              onChange={(event) => updateSection('openai', { ocrModel: event.target.value })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'azureOpenai') {
      return (
        <div className="provider-form-grid">
          <label>
            Endpoint
            <input value={settings.azureOpenai.endpoint} placeholder="https://recurso.openai.azure.com" onChange={(event) => updateSection('azureOpenai', { endpoint: event.target.value })} />
          </label>
          <label>
            API key
            <input type="password" value={settings.azureOpenai.apiKey} onChange={(event) => updateSection('azureOpenai', { apiKey: event.target.value })} />
            <SecretHint path="azureOpenai.apiKey" status={secretStatus} />
          </label>
          <label>
            API version
            <input value={settings.azureOpenai.apiVersion} onChange={(event) => updateSection('azureOpenai', { apiVersion: event.target.value })} />
          </label>
          <label>
            Deployment/modelo do chat
            <input
              list="provider-chat-model-options"
              value={settings.azureOpenai.chatDeploymentName}
              placeholder="gpt-5.4-mini ou nome do deployment"
              onChange={(event) => updateSection('azureOpenai', { chatDeploymentName: event.target.value })}
            />
            <span className="provider-secret-hint">No Azure, informe o nome do deployment criado no portal. Pode ser igual ao modelo, se voce nomeou assim.</span>
          </label>
          <label>
            Deployment de embedding
            <input
              list="provider-embedding-model-options"
              value={settings.azureOpenai.embeddingDeploymentName}
              placeholder="text-embedding-3-large ou nome do deployment"
              onChange={(event) => updateSection('azureOpenai', { embeddingDeploymentName: event.target.value })}
            />
          </label>
          <label>
            Deployment de OCR
            <input
              list="provider-chat-model-options"
              value={settings.azureOpenai.ocrDeploymentName}
              placeholder="gpt-4o ou nome do deployment"
              onChange={(event) => updateSection('azureOpenai', { ocrDeploymentName: event.target.value })}
            />
          </label>
          <label>
            Dimensoes do embedding
            <input
              type="number"
              min={1}
              value={settings.azureOpenai.embeddingDimensions}
              onChange={(event) => updateSection('azureOpenai', { embeddingDimensions: Number(event.target.value) || 3072 })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'gemini') {
      return (
        <div className="provider-form-grid">
          <label>
            API key
            <input type="password" value={settings.gemini.apiKey} onChange={(event) => updateSection('gemini', { apiKey: event.target.value })} />
            <SecretHint path="gemini.apiKey" status={secretStatus} />
          </label>
          <label>
            Modelo do chat
            <input
              list="provider-chat-model-options"
              value={settings.gemini.chatModel}
              placeholder="gemini-3.5-flash"
              onChange={(event) => updateSection('gemini', { chatModel: event.target.value })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'claude') {
      return (
        <div className="provider-form-grid">
          <label>
            API key
            <input type="password" value={settings.claude.apiKey} onChange={(event) => updateSection('claude', { apiKey: event.target.value })} />
            <SecretHint path="claude.apiKey" status={secretStatus} />
          </label>
          <label>
            Modelo do chat
            <input
              list="provider-chat-model-options"
              value={settings.claude.chatModel}
              placeholder="claude-sonnet-4-6"
              onChange={(event) => updateSection('claude', { chatModel: event.target.value })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'grok') {
      return (
        <div className="provider-form-grid">
          <label>
            API key
            <input type="password" value={settings.grok.apiKey} onChange={(event) => updateSection('grok', { apiKey: event.target.value })} />
            <SecretHint path="grok.apiKey" status={secretStatus} />
          </label>
          <label>
            Base URL
            <input value={settings.grok.baseUrl} placeholder="https://api.x.ai/v1" onChange={(event) => updateSection('grok', { baseUrl: event.target.value })} />
          </label>
          <label>
            Modelo do chat
            <input
              list="provider-chat-model-options"
              value={settings.grok.chatModel}
              placeholder="grok-2-latest"
              onChange={(event) => updateSection('grok', { chatModel: event.target.value })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'bedrock') {
      return (
        <div className="provider-form-grid">
          <label>
            API key do gateway
            <input type="password" value={settings.bedrock.apiKey} onChange={(event) => updateSection('bedrock', { apiKey: event.target.value })} />
            <SecretHint path="bedrock.apiKey" status={secretStatus} />
          </label>
          <label>
            Base URL
            <input value={settings.bedrock.baseUrl} placeholder="https://seu-gateway-bedrock/v1" onChange={(event) => updateSection('bedrock', { baseUrl: event.target.value })} />
            <span className="provider-secret-hint">Use um gateway Bedrock OpenAI-compatible. Assim o Canvas mantém tools, JSON mode e auditoria no mesmo formato.</span>
          </label>
          <label>
            Regiao
            <input value={settings.bedrock.region} placeholder="us-east-1" onChange={(event) => updateSection('bedrock', { region: event.target.value })} />
          </label>
          <label>
            Modelo do chat
            <input
              list="provider-chat-model-options"
              value={settings.bedrock.chatModel}
              placeholder="anthropic.claude-sonnet-4-6"
              onChange={(event) => updateSection('bedrock', { chatModel: event.target.value })}
            />
          </label>
        </div>
      );
    }

    if (activeProvider === 'milvus') {
      return (
        <div className="provider-form-grid">
          <label>
            Address
            <input value={settings.milvus.address} placeholder="host:19530" onChange={(event) => updateSection('milvus', { address: event.target.value })} />
          </label>
          <label>
            Token
            <input type="password" value={settings.milvus.token} onChange={(event) => updateSection('milvus', { token: event.target.value })} />
            <SecretHint path="milvus.token" status={secretStatus} />
          </label>
          <label>
            Username
            <input value={settings.milvus.username} onChange={(event) => updateSection('milvus', { username: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={settings.milvus.password} onChange={(event) => updateSection('milvus', { password: event.target.value })} />
            <SecretHint path="milvus.password" status={secretStatus} />
          </label>
          <label>
            Collection padrao
            <input value={settings.milvus.collectionName} onChange={(event) => updateSection('milvus', { collectionName: event.target.value })} />
          </label>
        </div>
      );
    }

    if (activeProvider === 'azureBlob') {
      return (
        <div className="provider-form-grid">
          <label>
            Connection string
            <input type="password" value={settings.azureBlob.connectionString} onChange={(event) => updateSection('azureBlob', { connectionString: event.target.value })} />
            <SecretHint path="azureBlob.connectionString" status={secretStatus} />
          </label>
          <label>
            Container
            <input value={settings.azureBlob.containerName} onChange={(event) => updateSection('azureBlob', { containerName: event.target.value })} />
          </label>
        </div>
      );
    }

    if (activeProvider === 'azureSearch') {
      return (
        <div className="provider-form-grid">
          <label>
            Endpoint
            <input value={settings.azureSearch.endpoint} placeholder="https://servico.search.windows.net" onChange={(event) => updateSection('azureSearch', { endpoint: event.target.value })} />
          </label>
          <label>
            API key
            <input type="password" value={settings.azureSearch.apiKey} onChange={(event) => updateSection('azureSearch', { apiKey: event.target.value })} />
            <SecretHint path="azureSearch.apiKey" status={secretStatus} />
          </label>
          <label>
            Index padrao
            <input value={settings.azureSearch.indexName} onChange={(event) => updateSection('azureSearch', { indexName: event.target.value })} />
          </label>
          <label>
            API version
            <input value={settings.azureSearch.apiVersion} onChange={(event) => updateSection('azureSearch', { apiVersion: event.target.value })} />
          </label>
        </div>
      );
    }

    if (activeProvider === 'whatsapp') {
      return (
        <div className="provider-form-grid">
          <label>
            Provedor WhatsApp
            <select value={settings.whatsapp.provider} onChange={(event) => updateSection('whatsapp', { provider: event.target.value as CanvasFlowProviderSettings['whatsapp']['provider'] })}>
              <option value="meta">Meta Cloud API</option>
              <option value="blip">Blip</option>
              <option value="sinch">Sinch</option>
            </select>
          </label>
          <label>
            Modo de entrega
            <select value={settings.whatsapp.deliveryMode || 'provider'} onChange={(event) => updateSection('whatsapp', { deliveryMode: event.target.value as CanvasFlowProviderSettings['whatsapp']['deliveryMode'] })}>
              <option value="provider">Enviar pelo provedor</option>
              <option value="apiResponse">Responder no payload da API</option>
            </select>
          </label>
          <label className="provider-checkbox-label">
            <input type="checkbox" checked={settings.whatsapp.autoReply !== false} onChange={(event) => updateSection('whatsapp', { autoReply: event.target.checked })} />
            Responder automaticamente mensagens do assistente
          </label>

          {settings.whatsapp.provider === 'meta' && (
            <>
              <label>
                Verify token
                <input value={settings.whatsapp.verifyToken} onChange={(event) => updateSection('whatsapp', { verifyToken: event.target.value })} />
              </label>
              <label>
                Business Account ID
                <input value={settings.whatsapp.businessAccountId || ''} onChange={(event) => updateSection('whatsapp', { businessAccountId: event.target.value })} />
              </label>
              <label>
                Phone Number ID
                <input value={settings.whatsapp.phoneNumberId} onChange={(event) => updateSection('whatsapp', { phoneNumberId: event.target.value })} />
              </label>
              <label>
                Access token
                <input type="password" value={settings.whatsapp.accessToken} onChange={(event) => updateSection('whatsapp', { accessToken: event.target.value })} />
                <SecretHint path="whatsapp.accessToken" status={secretStatus} />
              </label>
              <label>
                Graph API version
                <input value={settings.whatsapp.graphApiVersion} onChange={(event) => updateSection('whatsapp', { graphApiVersion: event.target.value })} />
              </label>
            </>
          )}

          {settings.whatsapp.provider === 'blip' && (
            <>
              <label>
                Contract ID
                <input value={settings.whatsapp.blipContractId || ''} onChange={(event) => updateSection('whatsapp', { blipContractId: event.target.value })} />
              </label>
              <label>
                Authorization key
                <input type="password" value={settings.whatsapp.blipAuthorizationKey || ''} onChange={(event) => updateSection('whatsapp', { blipAuthorizationKey: event.target.value })} />
                <SecretHint path="whatsapp.blipAuthorizationKey" status={secretStatus} />
              </label>
            </>
          )}

          {settings.whatsapp.provider === 'sinch' && (
            <>
              <label>
                API Sinch
                <select value={settings.whatsapp.sinchApiMode || 'conversation'} onChange={(event) => updateSection('whatsapp', { sinchApiMode: event.target.value as CanvasFlowProviderSettings['whatsapp']['sinchApiMode'] })}>
                  <option value="conversation">Conversation API</option>
                  <option value="relay">Relay/API response</option>
                </select>
              </label>
              <label>
                Regiao
                <input value={settings.whatsapp.sinchRegion || 'us'} onChange={(event) => updateSection('whatsapp', { sinchRegion: event.target.value })} />
              </label>
              <label>
                Canal
                <input value={settings.whatsapp.sinchChannel || 'WHATSAPP'} onChange={(event) => updateSection('whatsapp', { sinchChannel: event.target.value })} />
              </label>
              {settings.whatsapp.sinchApiMode === 'relay' ? (
                <>
                  <label>
                    Service number
                    <input value={settings.whatsapp.sinchServiceNumber || ''} onChange={(event) => updateSection('whatsapp', { sinchServiceNumber: event.target.value })} />
                  </label>
                  <label>
                    Service username
                    <input value={settings.whatsapp.sinchServiceUsername || ''} onChange={(event) => updateSection('whatsapp', { sinchServiceUsername: event.target.value })} />
                  </label>
                  <label>
                    Service token
                    <input type="password" value={settings.whatsapp.sinchServiceToken || ''} onChange={(event) => updateSection('whatsapp', { sinchServiceToken: event.target.value })} />
                    <SecretHint path="whatsapp.sinchServiceToken" status={secretStatus} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Project ID
                    <input value={settings.whatsapp.sinchProjectId || ''} onChange={(event) => updateSection('whatsapp', { sinchProjectId: event.target.value })} />
                  </label>
                  <label>
                    App ID
                    <input value={settings.whatsapp.sinchAppId || ''} onChange={(event) => updateSection('whatsapp', { sinchAppId: event.target.value })} />
                  </label>
                  <label>
                    Access token
                    <input type="password" value={settings.whatsapp.sinchAccessToken || ''} onChange={(event) => updateSection('whatsapp', { sinchAccessToken: event.target.value })} />
                    <SecretHint path="whatsapp.sinchAccessToken" status={secretStatus} />
                  </label>
                </>
              )}
            </>
          )}
        </div>
      );
    }

    if (activeProvider === 'webWidget') {
      const widget = settings.webWidget;
      const sideClass = widget.position === 'left' ? 'left' : 'right';
      return (
        <div className="provider-form-grid">
          <label>
            Cor principal
            <div className="widget-color-row">
              <input
                aria-label="Cor principal"
                type="color"
                value={settings.webWidget.primaryColor}
                onChange={(event) => updateSection('webWidget', { primaryColor: event.target.value })}
              />
              <input value={settings.webWidget.primaryColor} onChange={(event) => updateSection('webWidget', { primaryColor: event.target.value })} />
            </div>
          </label>
          <label>
            Cor de destaque
            <div className="widget-color-row">
              <input
                aria-label="Cor de destaque"
                type="color"
                value={settings.webWidget.accentColor}
                onChange={(event) => updateSection('webWidget', { accentColor: event.target.value })}
              />
              <input value={settings.webWidget.accentColor} onChange={(event) => updateSection('webWidget', { accentColor: event.target.value })} />
            </div>
          </label>
          <label>
            Posicao
            <select value={settings.webWidget.position} onChange={(event) => updateSection('webWidget', { position: event.target.value as CanvasFlowProviderSettings['webWidget']['position'] })}>
              <option value="right">Direita</option>
              <option value="left">Esquerda</option>
            </select>
          </label>
          <label className="provider-checkbox-label">
            <input type="checkbox" checked={settings.webWidget.openByDefault === true} onChange={(event) => updateSection('webWidget', { openByDefault: event.target.checked })} />
            Manter aberto ao carregar
          </label>
          <label>
            Nome do assistente
            <input value={settings.webWidget.assistantName} onChange={(event) => updateSection('webWidget', { assistantName: event.target.value })} />
          </label>
          <label>
            Subtitulo
            <input value={settings.webWidget.subtitle} onChange={(event) => updateSection('webWidget', { subtitle: event.target.value })} />
          </label>
          <label>
            Mensagem inicial
            <textarea rows={3} value={settings.webWidget.welcomeMessage} onChange={(event) => updateSection('webWidget', { welcomeMessage: event.target.value })} />
          </label>
          <label>
            Placeholder
            <input value={settings.webWidget.placeholder} onChange={(event) => updateSection('webWidget', { placeholder: event.target.value })} />
          </label>
          <label>
            Balao
            <input value={settings.webWidget.bubbleLabel} onChange={(event) => updateSection('webWidget', { bubbleLabel: event.target.value })} />
          </label>
          <label>
            Avatar
            <input value={settings.webWidget.avatarText} onChange={(event) => updateSection('webWidget', { avatarText: clampWidgetAvatar(event.target.value) })} />
          </label>
          <section className="provider-widget-context-card">
            <div>
              <ShieldCheck size={18} />
              <strong>Contexto da conversa</strong>
            </div>
            <p>
              O backend usa LangGraph para recuperar o checkpoint pelo conversationId. Em producao, o recomendado e
              o seu backend/proxy controlar o conversationId do usuario logado e chamar o Canvas Flow com Authorization
              fora do navegador.
            </p>
            <ul>
              <li>Usuario anonimo: gere um conversationId uma vez e guarde no browser.</li>
              <li>Usuario logado: derive o conversationId no backend, por exemplo pelo ID interno do usuario ou da sessao.</li>
              <li>Contexto do usuario entra em slots.user, somente com dados nao sensiveis.</li>
              <li>Para continuar a conversa, reenvie o mesmo conversationId. O backend mantem o no atual e os slots.</li>
            </ul>
          </section>
          <div className="provider-widget-live">
            <section className="provider-widget-panel">
              <div className="provider-widget-panel-header">
                <div>
                  <strong>Prévia do widget</strong>
                  <span>Amostra visual com a configuração atual.</span>
                </div>
              </div>
              <div className="provider-widget-stage">
                <header className="provider-widget-site-header">
                  <div>
                    <strong>Site do cliente</strong>
                    <span>Atendimento online</span>
                  </div>
                  <nav>
                    <span>Produtos</span>
                    <span>Contato</span>
                  </nav>
                </header>
                <main className="provider-widget-site-body">
                  <section>
                    <span>Web widget</span>
                    <strong>Experiência no site</strong>
                    <p>Prévia de abertura, cores e textos do atendimento.</p>
                  </section>
                </main>

                <div className={`web-widget-preview ${sideClass}`}>
                  {widgetPreviewOpen && (
                    <div className="web-widget-window" style={{ ['--widget-primary' as string]: widget.primaryColor, ['--widget-accent' as string]: widget.accentColor }}>
                      <div className="web-widget-header">
                        <div className="web-widget-avatar">{widget.avatarText || 'IA'}</div>
                        <div>
                          <strong>{widget.assistantName || 'Assistente IA'}</strong>
                          <span>{widget.subtitle || 'Online agora'}</span>
                        </div>
                        <button type="button" aria-label="Fechar preview" onClick={() => setWidgetPreviewOpen(false)}>
                          <X size={16} />
                        </button>
                      </div>
                      <div className="web-widget-messages">
                        <div className="web-widget-day">Hoje</div>
                        <div className="web-widget-bubble assistant">
                          <Bot size={14} />
                          <p>{widget.welcomeMessage || 'Olá! Como posso ajudar?'}</p>
                        </div>
                        <div className="web-widget-quick-replies">
                          <button type="button">Falar com atendimento</button>
                          <button type="button">Consultar pedido</button>
                        </div>
                        <div className="web-widget-bubble user">
                          <p>Quero tirar uma dúvida.</p>
                        </div>
                        <div className="web-widget-bubble assistant compact">
                          <p>Claro. Me conte o que você precisa.</p>
                        </div>
                      </div>
                      <div className="web-widget-input">
                        <input value="" readOnly placeholder={widget.placeholder || 'Digite sua mensagem'} />
                        <button type="button" aria-label="Enviar preview">
                          <Send size={17} />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`web-widget-launcher ${widgetPreviewOpen ? 'open' : ''}`}
                    style={{ ['--widget-primary' as string]: widget.primaryColor, ['--widget-accent' as string]: widget.accentColor }}
                    onClick={() => setWidgetPreviewOpen((current) => !current)}
                  >
                    <MessageCircle size={22} />
                    {!widgetPreviewOpen && widget.bubbleLabel && <span>{widget.bubbleLabel}</span>}
                  </button>
                </div>
              </div>
            </section>

            <section className="provider-widget-panel">
              <div className="provider-widget-panel-header">
                <div>
                  <strong>Código do widget</strong>
                  <span>
                    Agente: {widgetContextAgentId} · Fluxo: {currentFlowId ? widgetContextFlowId : 'salve o fluxo para gerar o flowId'}
                  </span>
                </div>
                <button type="button" className="primary-button" onClick={copyWebWidgetCode}>
                  {copiedWidgetCode ? <Check size={15} /> : <Copy size={15} />}
                  {copiedWidgetCode ? 'Copiado' : 'Copiar código'}
                </button>
              </div>
              <pre className="provider-widget-code-block"><code>{webWidgetEmbedCode}</code></pre>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div className="provider-form-grid">
        <label>
          Connection string
          <input type="password" value={settings.mongodb.connectionString} onChange={(event) => updateSection('mongodb', { connectionString: event.target.value })} />
          <SecretHint path="mongodb.connectionString" status={secretStatus} />
        </label>
        <label>
          Database
          <input value={settings.mongodb.databaseName} onChange={(event) => updateSection('mongodb', { databaseName: event.target.value })} />
        </label>
      </div>
    );
  };

  return (
    <div className="provider-config-shell">
      <datalist id="provider-chat-model-options">
        {CHAT_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
      <datalist id="provider-embedding-model-options">
        {EMBEDDING_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
      <div className="provider-config-intro">
        <div>
          <strong><ShieldCheck size={17} /> Provedores do Canvas Flow</strong>
          <p>Configure credenciais, modelos padrÃ£o e deployments globais ou sobrescreva por agente.</p>
        </div>
        <button type="button" className="primary-button" onClick={save} disabled={saving || loading || !activeProvider}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          Salvar
        </button>
      </div>

      <div className="provider-scope-bar">
        <span>Escopo</span>
        <div className="provider-scope-toggle">
          <button type="button" className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>
            Global
          </button>
          <button type="button" className={scope === 'agent' ? 'active' : ''} onClick={() => setScope('agent')}>
            Agente atual
          </button>
        </div>
        <small>{scope === 'agent' ? `Usando sobrescritas para ${normalizedAgentId}. Campos vazios herdam o Global.` : 'Usado como fallback para todos os agentes.'}</small>
      </div>

      {loading && <div className="provider-config-status">Carregando configuracoes...</div>}
      {error && <div className="api-keys-error">{error}</div>}
      {message && <div className="provider-config-success">{message}</div>}

      {!activeProvider && (
        <div className="provider-component-grid">
          {PROVIDERS.map((provider) => {
            const Icon = provider.Icon;
            const configured = providerConfigured(provider.id, settings, secretStatus);
            const status = providerStatusLabel(provider.id, providerStatus, configured, scope);
            const statusConfigured = status !== 'Nao configurado';
            return (
              <div
                role="button"
                tabIndex={0}
                className="provider-component-card"
                key={provider.id}
                onClick={() => setActiveProvider(provider.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveProvider(provider.id);
                  }
                }}
                style={{ borderColor: `${provider.color}40` }}
              >
                <span className="provider-card-icon" style={{ color: provider.color, background: `${provider.color}12` }}>
                  <Icon size={19} />
                </span>
                <span className="provider-card-main">
                  <strong>{provider.title}</strong>
                  <small>{provider.subtitle}</small>
                  <em className={statusConfigured ? 'configured' : undefined}>{status}</em>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="provider-card-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(provider.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      setDeleteTarget(provider.id);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {activeProvider && activeInfo && (
        <div className="provider-editor">
          <div className="provider-editor-header">
            <button type="button" onClick={() => setActiveProvider(null)}>
              <ArrowLeft size={15} />
              Voltar
            </button>
            <div>
              <strong>{activeInfo.title}</strong>
              <span>{activeInfo.subtitle}</span>
            </div>
            <button type="button" className="danger-button compact-danger-button" onClick={() => setDeleteTarget(activeProvider)}>
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
          {renderProviderForm()}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" onClick={onClose}>Fechar</button>
        <button type="button" className="primary-button" onClick={save} disabled={saving || loading || !activeProvider}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          Salvar
        </button>
      </div>

      {deleteTarget && (
        <div className="provider-delete-confirm">
          <div>
            <strong>Excluir configuracao?</strong>
            <p>Os campos salvos deste provedor serao limpos, incluindo segredos armazenados.</p>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button>
            <button type="button" className="danger-button" onClick={() => void deleteProvider(deleteTarget)} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
