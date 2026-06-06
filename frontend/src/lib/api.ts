import type { CanvasFlowAgentRecord, CanvasFlowAgentReleaseRecord, CanvasFlowAgentWorkspace, CanvasFlowApiKeyRecord, CanvasFlowAuthUser, CanvasFlowProviderSettings, CanvasFlowRecord, CreatedCanvasFlowApiKey, FlowConfig, TestMessage } from '../types/flow';

const RAW_API_URL = import.meta.env.VITE_CANVAS_FLOW_API_URL;
const API_URL = RAW_API_URL === '__CANVAS_FLOW_SAME_ORIGIN__'
  ? ''
  : (RAW_API_URL || 'http://localhost:3333').replace(/\/$/, '');
const API_TOKEN = import.meta.env.VITE_CANVAS_FLOW_API_TOKEN || '';
const LOGIN_REQUIRED = String(import.meta.env.VITE_CANVAS_FLOW_LOGIN || '').toLowerCase() === 'true';
const AUTH_STORAGE_KEY = 'canvas_flow_auth_token';
export const CANVAS_FLOW_API_URL = API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
export const CANVAS_FLOW_API_TOKEN_CONFIGURED = Boolean(API_TOKEN);
export const CANVAS_FLOW_LOGIN_REQUIRED = LOGIN_REQUIRED;
export type LangGraphRuntimeSummary = {
  engine: 'langgraph';
  durable: boolean;
  storage: 'mongodb' | 'memory';
  threadId: string;
  checkpointNamespace: string;
  checkpoints: number;
  recovered: boolean;
  status: string;
};
type ProviderConfigApiResponse = {
  settings: CanvasFlowProviderSettings;
  secretStatus: Record<string, boolean>;
  providerStatus?: Record<string, {
    configured: boolean;
    source: 'agent' | 'global' | 'env' | 'none';
    scopeConfigured: boolean;
    inherited: boolean;
  }>;
};

export type McpOAuthStatus = {
  connected: boolean;
  status: 'pending' | 'connected' | 'error';
  serverUrl?: string;
  agentId?: string;
  organizationId?: string;
  connectionScope?: 'agent' | 'user';
  label?: string;
  scope?: string;
  authorizationUrl?: string;
  expiresAt?: string;
  authenticatedAt?: string;
  updatedAt?: string;
  error?: string;
};

export type McpExternalTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type McpExternalToolsResponse = {
  external: {
    transport: string;
    url: string;
    authMode: string;
    server?: unknown;
    capabilities?: unknown;
  };
  tools: McpExternalTool[];
};

export function getCanvasFlowAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY) || '';
}

export function setCanvasFlowAuthToken(token: string) {
  if (token) localStorage.setItem(AUTH_STORAGE_KEY, token);
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function authHeaders(): Record<string, string> {
  const token = getCanvasFlowAuthToken() || API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const url = `${API_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'falha de rede';
    throw new Error(`Não foi possível conectar ao backend em ${CANVAS_FLOW_API_URL || 'esta origem'}. Verifique se a API está rodando e se o CORS permite esta origem. Detalhe: ${message}`);
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.error || message;
    } catch {
      // Keep the raw text when the backend did not return JSON.
    }
    const error = new Error(message || `HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json();
}

export const canvasApi = {
  authConfig() {
    return request<{ loginRequired: boolean; hasUsers: boolean }>('/api/auth/config');
  },

  login(payload: { email: string; password: string; organizationSlug?: string }) {
    return request<{ token: string; user: CanvasFlowAuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bootstrap(payload: { organizationName: string; organizationSlug?: string; name: string; email: string; password: string }) {
    return request<{ token: string; user: CanvasFlowAuthUser }>('/api/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createOrganization(payload: { organizationName: string; organizationSlug?: string; name: string; email: string; password: string }) {
    return request<{ token: string; user: CanvasFlowAuthUser }>('/api/auth/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<{ user: CanvasFlowAuthUser | null }>('/api/auth/me', {
      headers: authHeaders(),
    });
  },

  createOrganizationUser(payload: { name: string; email: string; password: string; role?: 'admin' | 'member' }) {
    return request<CanvasFlowAuthUser>('/api/auth/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getProviderConfig(options?: { agentId?: string }) {
    return request<ProviderConfigApiResponse>(`/api/provider-config${queryString({ agentId: options?.agentId })}`, {
      headers: authHeaders(),
    });
  },

  updateProviderConfig(settings: Partial<CanvasFlowProviderSettings>, options?: { agentId?: string }) {
    return request<ProviderConfigApiResponse>(`/api/provider-config${queryString({ agentId: options?.agentId })}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ settings, agentId: options?.agentId }),
    });
  },

  deleteProviderConfigSection(section: string, options?: { agentId?: string }) {
    return request<ProviderConfigApiResponse>(`/api/provider-config/${encodeURIComponent(section)}${queryString({ agentId: options?.agentId })}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  listFlows(agentId?: string) {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
    return request<CanvasFlowRecord[]>(`/api/canvas-flows${query}`, {
      headers: authHeaders(),
    });
  },

  listAgents() {
    return request<CanvasFlowAgentRecord[]>('/api/canvas-flows/agents', {
      headers: authHeaders(),
    });
  },

  createAgent(payload: { name: string }) {
    return request<CanvasFlowAgentRecord>('/api/canvas-flows/agents', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  renameAgent(agentId: string, payload: { name: string }) {
    return request<CanvasFlowAgentRecord>(`/api/canvas-flows/agents/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  reorderAgents(orderedAgentIds: string[]) {
    return request<CanvasFlowAgentRecord[]>('/api/canvas-flows/agents/reorder', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ orderedAgentIds }),
    });
  },

  updateAgentConfig(agentId: string, config: Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'>) {
    return request<CanvasFlowAgentRecord>(`/api/canvas-flows/agents/${encodeURIComponent(agentId)}/config`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ config }),
    });
  },

  getAgentWorkspace(agentId: string) {
    return request<CanvasFlowAgentWorkspace>(`/api/canvas-flows/agents/${encodeURIComponent(agentId)}/workspace`, {
      headers: authHeaders(),
    });
  },

  importAgentWorkspace(agentId: string, workspace: CanvasFlowAgentWorkspace | Record<string, unknown>) {
    return request<CanvasFlowAgentRecord>(`/api/canvas-flows/agents/${encodeURIComponent(agentId)}/workspace`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(workspace),
    });
  },

  deleteAgent(agentId: string, payload: { confirmationName: string }) {
    return request<{ agentId: string; name: string; deletedFlows: number; deletedAgents: number; agents: CanvasFlowAgentRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getAgentReleases(name: string) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases`, {
      headers: authHeaders(),
    });
  },

  deployAgentRelease(name: string, payload: { name?: string; notes?: string; activate?: boolean }) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; release: CanvasFlowAgentReleaseRecord; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases/deploy`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  activateAgentRelease(name: string, release: number) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases/${encodeURIComponent(String(release))}/activate`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  },

  renameAgentRelease(name: string, release: number, payload: { name: string }) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases/${encodeURIComponent(String(release))}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  overwriteAgentRelease(name: string, release: number, payload: { sourceRelease?: number; notes?: string; name?: string }) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases/${encodeURIComponent(String(release))}/overwrite`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  deleteAgentRelease(name: string, release: number) {
    return request<{ agentId: string; activeRelease?: number; latestRelease?: number; releases: CanvasFlowAgentReleaseRecord[] }>(`/api/canvas-flows/agents/${encodeURIComponent(name)}/releases/${encodeURIComponent(String(release))}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  getFlow(id: string) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}`, {
      headers: authHeaders(),
    });
  },

  getFlowVersions(id: string) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions`, {
      headers: authHeaders(),
    });
  },

  createFlow(payload: { name: string; agentId?: string; config: FlowConfig }) {
    return request<CanvasFlowRecord>('/api/canvas-flows', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  updateFlow(id: string, payload: { name?: string; agentId?: string; sortOrder?: number; config?: FlowConfig }) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  deployFlowVersion(id: string, payload: { name?: string; agentId?: string; config?: FlowConfig; notes?: string; activate?: boolean }) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions/deploy`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  activateFlowVersion(id: string, version: number) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions/${encodeURIComponent(String(version))}/activate`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  },

  renameFlowVersion(id: string, version: number, payload: { name: string }) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions/${encodeURIComponent(String(version))}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  overwriteFlowVersion(id: string, version: number, payload: { config?: FlowConfig; sourceVersion?: number; notes?: string; name?: string }) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions/${encodeURIComponent(String(version))}/overwrite`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  deleteFlowVersion(id: string, version: number) {
    return request<CanvasFlowRecord>(`/api/canvas-flows/${id}/versions/${encodeURIComponent(String(version))}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  reorderFlows(orderedIds: string[], agentId?: string) {
    return request<CanvasFlowRecord[]>('/api/canvas-flows/reorder', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ orderedIds, agentId }),
    });
  },

  deleteFlow(id: string) {
    return request<CanvasFlowRecord | null>(`/api/canvas-flows/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  listApiKeys(params?: { flowId?: string; agentId?: string }) {
    const query = new URLSearchParams();
    if (params?.flowId) query.set('flowId', params.flowId);
    if (params?.agentId) query.set('agentId', params.agentId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<CanvasFlowApiKeyRecord[]>(`/api/canvas-flow-api-keys${suffix}`, {
      headers: authHeaders(),
    });
  },

  createApiKey(payload: { name: string; flowId?: string; agentId?: string; expiresAt?: string }) {
    return request<CreatedCanvasFlowApiKey>('/api/canvas-flow-api-keys', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  revokeApiKey(id: string) {
    return request<CanvasFlowApiKeyRecord>(`/api/canvas-flow-api-keys/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  testFlow(payload: Record<string, unknown>) {
    return request<{
      queued?: boolean;
      jobId?: string;
      id?: string;
      status?: string;
      type?: string;
      messages?: TestMessage[];
      slots?: Record<string, unknown>;
      currentStepId?: string;
      ended?: boolean;
      conversationId?: string;
      entryFlowId?: string;
      activeFlowId?: string;
      activeFlowName?: string;
      trace?: unknown[];
      tracePage?: Record<string, unknown>;
      runtime?: LangGraphRuntimeSummary;
    }>('/api/canvas-flow/test', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  replaySimulation(payload: Record<string, unknown>) {
    return request<{
      mode: 'conversation' | 'isolated';
      summary: {
        total: number;
        passed: number;
        failed: number;
        passRate: number;
        durationMs: number;
      };
      results: Array<Record<string, any>>;
      finalState?: Record<string, unknown>;
      generatedAt?: string;
    }>('/api/canvas-flow/simulations/replay', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getSqsJob(jobId: string, params?: { agentId?: string; flowId?: string }) {
    const query = new URLSearchParams();
    if (params?.agentId) query.set('agentId', params.agentId);
    if (params?.flowId) query.set('flowId', params.flowId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<{
      jobId: string;
      type: string;
      status: 'queued' | 'running' | 'completed' | 'failed';
      result?: {
        messages?: TestMessage[];
        slots?: Record<string, unknown>;
        currentStepId?: string;
        ended?: boolean;
        conversationId?: string;
        entryFlowId?: string;
        activeFlowId?: string;
        activeFlowName?: string;
        trace?: unknown[];
        tracePage?: Record<string, unknown>;
        runtime?: LangGraphRuntimeSummary;
      };
      error?: string;
      queuedAt?: string;
      startedAt?: string;
      completedAt?: string;
      failedAt?: string;
    }>(`/api/canvas-flow/sqs/jobs/${encodeURIComponent(jobId)}${suffix}`, {
      headers: authHeaders(),
    });
  },

  retrySqsJob(jobId: string, payload: Record<string, unknown> = {}) {
    return request<{
      queued?: boolean;
      jobId?: string;
      status?: string;
      skipped?: boolean;
      reason?: string;
    }>(`/api/canvas-flow/sqs/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getSqsHealth() {
    return request<Record<string, unknown>>('/api/canvas-flow/sqs/health', {
      headers: authHeaders(),
    });
  },

  async streamTestFlow(
    payload: Record<string, unknown>,
    onMessage: (message: TestMessage) => void,
  ) {
    const response = await fetch(`${API_URL}/api/canvas-flow/test/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: Record<string, unknown> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;
        const event = JSON.parse(raw);
        if (event.event === 'message' && event.message) {
          onMessage(event.message as TestMessage);
        }
        if (event.event === 'result') {
          finalResult = event.result || {};
        }
        if (event.event === 'error') {
          throw new Error(event.message || 'Falha no stream do fluxo.');
        }
      }

      if (done) break;
    }

    if (buffer.trim()) {
      const event = JSON.parse(buffer.trim());
      if (event.event === 'message' && event.message) onMessage(event.message as TestMessage);
      if (event.event === 'result') finalResult = event.result || {};
      if (event.event === 'error') throw new Error(event.message || 'Falha no stream do fluxo.');
    }

    return finalResult as {
      messages: TestMessage[];
      slots: Record<string, unknown>;
      currentStepId?: string;
      ended?: boolean;
      conversationId?: string;
      entryFlowId?: string;
      activeFlowId?: string;
      activeFlowName?: string;
      trace?: unknown[];
      tracePage?: Record<string, unknown>;
      runtime?: LangGraphRuntimeSummary;
    };
  },

  generateContextScript(payload: Record<string, unknown>) {
    return request<{ code: string; explanation?: string; model?: string }>('/api/canvas-flow/context/script/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  generateMongoConfig(payload: Record<string, unknown>) {
    return request<Record<string, unknown> & { explanation?: string; model?: string }>('/api/canvas-flow/mongodb/config/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  generateFlowWithAssistant(payload: Record<string, unknown>) {
    return request<{ config: FlowConfig; summary?: string; warnings?: string[]; model?: string }>('/api/canvas-flow/assistant/generate-flow', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  generatePromptField(payload: Record<string, unknown>) {
    return request<{ text: string; explanation?: string; terms?: string[]; model?: string }>('/api/canvas-flow/prompt-field/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  createWhatsappFlow(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/canvas-flow/whatsapp-flows', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  listWhatsappFlows(payload: Record<string, unknown>) {
    return request<{ success?: boolean; flows?: Array<Record<string, unknown>>; paging?: Record<string, unknown> | null }>('/api/canvas-flow/whatsapp-flows/list', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  deleteWhatsappFlow(flowId: string, payload: Record<string, unknown>) {
    return request<Record<string, unknown>>(`/api/canvas-flow/whatsapp-flows/${encodeURIComponent(flowId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  uploadWhatsappFlowJson(flowId: string, payload: Record<string, unknown>) {
    return request<Record<string, unknown>>(`/api/canvas-flow/whatsapp-flows/${encodeURIComponent(flowId)}/assets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  publishWhatsappFlow(flowId: string, payload: Record<string, unknown>) {
    return request<Record<string, unknown>>(`/api/canvas-flow/whatsapp-flows/${encodeURIComponent(flowId)}/publish`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getTagDashboard(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/canvas-flow/tags/dashboard', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  listFlowTemplates() {
    return request<Record<string, unknown>>('/api/canvas-flow/templates', {
      headers: authHeaders(),
    });
  },

  getAgentOpsDashboard(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/canvas-flow/agentops/dashboard', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }).catch(async (error) => {
      const status = (error as Error & { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error || '');
      if (status !== 404 && !/agentops\/dashboard|not found|cannot post/i.test(message)) {
        throw error;
      }

      const fallback = await request<Record<string, any>>('/api/canvas-flow/tags/dashboard', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...payload,
          tags: [],
          limit: Number(payload.historyLimit || 80),
          historyLimit: Number(payload.historyLimit || 80),
        }),
      });
      const traceInsights = (fallback.traceInsights || {}) as Record<string, any>;
      const insights = (fallback.insights || {}) as Record<string, any>;
      const runs = Number(traceInsights.summary?.runs || 0);
      const errorCount = Number(traceInsights.summary?.errorCount || 0);
      return {
        ...fallback,
        fallback: 'tags-dashboard',
        summary: {
          conversations: insights.summary?.conversations || fallback.summary?.conversations || 0,
          messages: insights.summary?.totalMessages || 0,
          userMessages: insights.summary?.userMessages || 0,
          assistantMessages: insights.summary?.assistantMessages || 0,
          runs,
          errorCount,
          errorRate: runs ? errorCount / runs : 0,
          avgDurationMs: 0,
          llmCalls: 0,
          estimatedTokens: 0,
        },
        queue: {},
        insights,
        traceInsights,
        errors: traceInsights.errors || [],
        hotNodes: traceInsights.byStep || [],
        releases: { activeRelease: undefined, latestRelease: 0, releases: [] },
        flows: [],
        readiness: {
          status: 'attention',
          warnings: [
            'Backend atual ainda nao tem o endpoint AgentOps. Reinicie ou atualize o backend; enquanto isso, este painel usa dados operacionais do dashboard existente.',
          ],
        },
      };
    });
  },

  getMcpOAuthStatus(params: { serverUrl: string; agentId?: string; connectionScope?: 'agent' | 'user' }) {
    return request<McpOAuthStatus>(`/api/mcp-oauth/status${queryString({
      serverUrl: params.serverUrl,
      agentId: params.agentId,
      connectionScope: params.connectionScope,
    })}`, {
      headers: authHeaders(),
    });
  },

  startMcpOAuth(payload: { serverUrl: string; agentId?: string; connectionScope?: 'agent' | 'user'; label?: string; scope?: string; clientName?: string }) {
    return request<McpOAuthStatus>('/api/mcp-oauth/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  disconnectMcpOAuth(params: { serverUrl: string; agentId?: string; connectionScope?: 'agent' | 'user' }) {
    return request<McpOAuthStatus>(`/api/mcp-oauth${queryString({
      serverUrl: params.serverUrl,
      agentId: params.agentId,
      connectionScope: params.connectionScope,
    })}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },

  listExternalMcpTools(payload: { agentId?: string; component: Record<string, unknown> }) {
    return request<McpExternalToolsResponse>('/api/canvas-flow/mcp-external/tools', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  addRagDocuments(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/rag/add-documents', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  addRagFiles(formData: FormData) {
    return request<Record<string, unknown>>('/api/rag/add-documents-from-file', {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
  },

  extractFiles(formData: FormData) {
    return request<Record<string, unknown>>('/api/rag/extract-files', {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
  },

  async downloadDocument(documentId: string) {
    const response = await fetch(`${API_URL}/api/documents/${encodeURIComponent(documentId)}/download`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'arquivo';
    return { blob: await response.blob(), filename };
  },

  listRagDocuments(payload: Record<string, unknown>) {
    return request<{ collectionName: string; total: number; documents: Record<string, unknown>[] }>('/api/rag/documents/list', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  getRagDocument(payload: Record<string, unknown>) {
    return request<{ collectionName: string; document: Record<string, unknown> }>('/api/rag/documents/get', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  updateRagDocument(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/rag/documents/update', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },

  deleteRagDocument(payload: Record<string, unknown>) {
    return request<Record<string, unknown>>('/api/rag/documents/delete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  },
};
