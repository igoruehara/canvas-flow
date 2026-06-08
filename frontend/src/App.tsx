import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  Panel,
  ReactFlowProvider,
  applyNodeChanges,
  MarkerType,
} from 'reactflow';
import type { NodeChange } from 'reactflow';
import { ControlButton } from '@reactflow/controls';
import 'reactflow/dist/style.css';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bot,
  Bug,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  Repeat2,
  Ellipsis,
  FileJson,
  FileText,
  FolderPlus,
  GitBranch,
  GripVertical,
  KeyRound,
  Library,
  LineChart,
  Loader2,
  MessageSquarePlus,
  PanelsTopLeft,
  Pencil,
  PieChart,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SquareTerminal,
  Table2,
  Trash2,
  Upload,
  Wand2,
  Webhook,
  Maximize2,
  X,
} from 'lucide-react';
import { CanvasFlowEdge } from './components/CanvasFlowEdge';
import { CanvasStepNode } from './components/CanvasStepNode';
import { AgentStudioModal } from './components/AgentStudioModal';
import { ApiKeysModal } from './components/ApiKeysModal';
import { Inspector } from './components/Inspector';
import { ProviderConfigModal } from './components/ProviderConfigModal';
import { CANVAS_FLOW_API_URL, canvasApi, hasCanvasFlowAuthToken, type LangGraphRuntimeSummary } from './lib/api';
import { createDefaultFlow, createId, createStep, createWebWidgetConfig, createWhatsappConfig } from './lib/defaultFlow';
import { getFlowTemplates, type FlowTemplateSummary } from './lib/flowTemplates';
import { getDefaultLlmModelForProvider, getLlmModelValuesForProvider, LLM_PROVIDER_OPTIONS } from './lib/llmModels';
import type { CanvasFlowAgentRecord, CanvasFlowAgentReleaseRecord, CanvasFlowAgentWorkspace, CanvasFlowRecord, CanvasFlowVersionRecord, ComponentType, FlowChannel, FlowConfig, FlowEdge, FlowLlmProvider, FlowSimulationSuite, FlowStep, RichMessageConfig, StepType, TestMessage, WebWidgetConfig, WhatsappConfig } from './types/flow';

const nodeTypes = { canvasStep: CanvasStepNode };
const edgeTypes = { canvasFlowEdge: CanvasFlowEdge };

const DEFAULT_NODE_WIDTH = 108;
const DEFAULT_NODE_HEIGHT = 72;
const LARGE_CANVAS_NODE_THRESHOLD = 120;
const LARGE_CANVAS_EDGE_THRESHOLD = 180;
const GROUP_MIN_WIDTH = 180;
const GROUP_MIN_HEIGHT = 156;
const GROUP_COLLAPSED_WIDTH = DEFAULT_NODE_WIDTH;
const GROUP_COLLAPSED_HEIGHT = DEFAULT_NODE_HEIGHT;
const GROUP_PADDING_X = 36;
const GROUP_PADDING_TOP = 74;
const GROUP_PADDING_BOTTOM = 36;
const GROUP_HEADER_SAFE_TOP = 58;
const GROUP_CHILD_SAFE_LEFT = 18;
const GROUP_CHILD_SAFE_RIGHT = 18;
const GROUP_CHILD_SAFE_BOTTOM = 18;
const GROUP_CAPTURE_INSET = 18;
const GROUP_COLLAPSE_ABSORB_MARGIN = 16;

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  confirmationText?: string;
  confirmationPrompt?: string;
  onConfirm: () => void;
} | null;

type FlowAssistantResult = {
  config: FlowConfig;
  summary?: string;
  warnings?: string[];
  model?: string;
  scope?: FlowAssistantScope;
  selectedStepIds?: string[];
};

type FlowAssistantScope = 'flow' | 'selection';
type FlowAssistantSource = 'brief' | 'whatsappTranscript';
type TestRuntimeMode = 'draft' | 'active' | 'agentVersion' | 'flowVersion';
type SimulationEditorMode = 'visual' | 'json';
type SimulationSuiteTab = 'saved' | 'editor';
type SimulationExpectedEnded = 'any' | 'true' | 'false';
type SimulationCaseDraft = {
  id: string;
  name: string;
  text: string;
  expectedContainsText: string;
  expectedEnded: SimulationExpectedEnded;
  expectedSlotsText: string;
  slotsText: string;
  approvalsText: string;
  allowErrors: boolean;
};
type VersionRenameTarget = {
  kind: 'agent' | 'flow';
  version: number;
  currentName?: string;
} | null;
type VersionOverwriteTarget = {
  kind: 'agent' | 'flow';
  version: number;
  isActive?: boolean;
  currentName?: string;
} | null;
type VersionOverwriteSource = 'draft' | 'version';

const parseTagFilters = (value: unknown) =>
  String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const getAgentRecordId = (agent?: Partial<CanvasFlowAgentRecord> | null) =>
  String(agent?.agentId || agent?.name || '').trim() || 'default-agent';

const getAgentRecordName = (agent?: Partial<CanvasFlowAgentRecord> | null) =>
  String(agent?.name || agent?.agentId || '').trim() || 'Agente';

const getAgentProfileConfig = (agent: Partial<CanvasFlowAgentRecord> | null | undefined, fallback: FlowConfig) => ({
  llmProvider: (agent?.config?.llmProvider || fallback.llmProvider || 'openai') as FlowLlmProvider,
  model: agent?.config?.model || fallback.model,
  agentSpec: {
    agentsMd: agent?.config?.agentSpec?.agentsMd ?? fallback.agentSpec?.agentsMd ?? '',
    guardrails: agent?.config?.agentSpec?.guardrails ?? fallback.agentSpec?.guardrails ?? '',
    blockedTerms: agent?.config?.agentSpec?.blockedTerms ?? fallback.agentSpec?.blockedTerms ?? [],
    rules: agent?.config?.agentSpec?.rules ?? fallback.agentSpec?.rules ?? [],
    skills: agent?.config?.agentSpec?.skills ?? fallback.agentSpec?.skills ?? [],
    subagents: agent?.config?.agentSpec?.subagents ?? fallback.agentSpec?.subagents ?? [],
    mcpServers: agent?.config?.agentSpec?.mcpServers ?? fallback.agentSpec?.mcpServers ?? [],
  },
});

function splitSimulationLines(value: string) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifySimulationObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return JSON.stringify(value, null, 2);
}

function parseSimulationObject(value: string, label: string) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} precisa ser um objeto JSON.`);
  }
  return parsed as Record<string, unknown>;
}

function createSimulationCaseDraft(patch: Partial<SimulationCaseDraft> = {}): SimulationCaseDraft {
  return {
    id: createId('simcase'),
    name: '',
    text: '',
    expectedContainsText: '',
    expectedEnded: 'any',
    expectedSlotsText: '',
    slotsText: '',
    approvalsText: '',
    allowErrors: false,
    ...patch,
  };
}

function simulationCaseToDraft(testCase: Record<string, any>, index: number): SimulationCaseDraft {
  const expectedContains = Array.isArray(testCase.expectedContains)
    ? testCase.expectedContains
    : Array.isArray(testCase.expectedTextIncludes)
      ? testCase.expectedTextIncludes
      : testCase.expectedContains || testCase.expectedTextIncludes
        ? [testCase.expectedContains || testCase.expectedTextIncludes]
        : [];
  return createSimulationCaseDraft({
    id: String(testCase.id || '') || createId('simcase'),
    name: String(testCase.name || testCase.title || `Cenario ${index + 1}`),
    text: String(testCase.text || testCase.input || ''),
    expectedContainsText: expectedContains.map((item: unknown) => String(item || '')).filter(Boolean).join('\n'),
    expectedEnded: testCase.expectedEnded === true ? 'true' : testCase.expectedEnded === false ? 'false' : 'any',
    expectedSlotsText: stringifySimulationObject(testCase.expectedSlots),
    slotsText: stringifySimulationObject(testCase.slots),
    approvalsText: stringifySimulationObject(testCase.approvals),
    allowErrors: testCase.allowErrors === true,
  });
}

function simulationDraftsToCases(drafts: SimulationCaseDraft[]) {
  return drafts
    .map((draft, index) => {
      const expectedContains = splitSimulationLines(draft.expectedContainsText);
      const testCase: Record<string, unknown> = {
        name: draft.name.trim() || `Cenario ${index + 1}`,
        text: draft.text.trim(),
      };
      if (expectedContains.length === 1) testCase.expectedContains = expectedContains[0];
      if (expectedContains.length > 1) testCase.expectedContains = expectedContains;
      if (draft.expectedEnded !== 'any') testCase.expectedEnded = draft.expectedEnded === 'true';
      const expectedSlots = parseSimulationObject(draft.expectedSlotsText, 'Slots esperados');
      const slots = parseSimulationObject(draft.slotsText, 'Slots iniciais');
      const approvals = parseSimulationObject(draft.approvalsText, 'Aprovacoes');
      if (expectedSlots && Object.keys(expectedSlots).length) testCase.expectedSlots = expectedSlots;
      if (slots && Object.keys(slots).length) testCase.slots = slots;
      if (approvals && Object.keys(approvals).length) testCase.approvals = approvals;
      if (draft.allowErrors) testCase.allowErrors = true;
      return testCase;
    })
    .filter((testCase) => String(testCase.text || '').trim());
}

function simulationDraftsToJson(drafts: SimulationCaseDraft[]) {
  return JSON.stringify(simulationDraftsToCases(drafts), null, 2);
}

function simulationDraftsFromJson(raw: string) {
  const parsed = JSON.parse(raw || '[]');
  const cases = Array.isArray(parsed) ? parsed : parsed?.cases;
  if (!Array.isArray(cases)) {
    throw new Error('JSON precisa ser uma lista de casos ou um objeto com cases[].');
  }
  return cases.map((testCase, index) => simulationCaseToDraft(testCase || {}, index));
}

function getDefaultSimulationCaseDrafts() {
  return [
    createSimulationCaseDraft({
      name: 'Boas-vindas',
      text: 'Oi, preciso de ajuda',
      expectedContainsText: 'ajuda',
    }),
    createSimulationCaseDraft({
      name: 'Agendamento',
      text: 'Quero falar com atendimento',
      expectedEnded: 'false',
    }),
  ];
}

function normalizeSimulationSuites(value: unknown): FlowSimulationSuite[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((suite, index) => {
      if (!suite || typeof suite !== 'object' || Array.isArray(suite)) return null;
      const record = suite as Record<string, any>;
      const cases = Array.isArray(record.cases) ? record.cases.filter((item) => item && typeof item === 'object') : [];
      if (!cases.length) return null;
      return {
        id: String(record.id || '') || createId('evalsuite'),
        name: String(record.name || record.title || `Suite ${index + 1}`),
        description: String(record.description || ''),
        mode: record.mode === 'isolated' ? 'isolated' : 'conversation',
        cases,
        createdAt: String(record.createdAt || ''),
        updatedAt: String(record.updatedAt || ''),
      } as FlowSimulationSuite;
    })
    .filter((suite): suite is FlowSimulationSuite => Boolean(suite));
}

const SIMULATION_SUITES_STORAGE_PREFIX = 'canvas_flow_eval_suites_v1';

function buildSimulationSuitesStorageKey(agentId: string, flowId: string, flowName: string) {
  const scope = flowId || flowName || 'draft';
  return `${SIMULATION_SUITES_STORAGE_PREFIX}:${agentId || 'default-agent'}:${scope}`;
}

function readSimulationSuitesFromStorage(storageKey: string) {
  try {
    if (typeof localStorage === 'undefined') return [];
    return normalizeSimulationSuites(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return [];
  }
}

function writeSimulationSuitesToStorage(storageKey: string, suites: FlowSimulationSuite[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(normalizeSimulationSuites(suites)));
  } catch {
    // Local persistence is best-effort; backend persistence remains the source of truth for saved flows.
  }
}

function mergeSimulationSuites(primary: FlowSimulationSuite[], secondary: FlowSimulationSuite[]) {
  const byId = new Map<string, FlowSimulationSuite>();
  primary.forEach((suite) => byId.set(suite.id, suite));
  secondary.forEach((suite) => {
    if (!byId.has(suite.id)) byId.set(suite.id, suite);
  });
  return Array.from(byId.values());
}

function buildSimulationSuiteRunCases(suites: FlowSimulationSuite[], orderedSuiteIds: string[]) {
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  return orderedSuiteIds.flatMap((suiteId) => {
    const suite = byId.get(suiteId);
    if (!suite) return [];
    return suite.cases.map((testCase, index) => ({
      ...(testCase || {}),
      suiteId: suite.id,
      suiteName: suite.name,
      name: `${suite.name} / ${String((testCase as any)?.name || (testCase as any)?.title || `Caso ${index + 1}`)}`,
    }));
  });
}

type TagDashboardView = 'table' | 'bar' | 'pie' | 'line';
type TagDashboardTab = 'dashboard' | 'insights' | 'trace' | 'history';

const COMPONENT_PALETTE = [
  {
    type: 'openaiGen' as ComponentType,
    title: 'Agente',
    description: 'Agente LLM com modelo, skills, subagents, rules e guardrails.',
    category: 'IA',
    Icon: Bot,
    color: '#2563eb',
  },
  {
    type: 'agentPlan' as ComponentType,
    title: 'Agent Plan',
    description: 'Contrato visual para orientar ou fixar o plano do agente antes das tools.',
    category: 'IA',
    Icon: GitBranch,
    color: '#4f46e5',
  },
  {
    type: 'rag' as ComponentType,
    title: 'RAG IA Gen',
    description: 'Busca documentos e gera a resposta final com LLM.',
    category: 'RAG',
    Icon: Database,
    color: '#2563eb',
  },
  {
    type: 'milvus' as ComponentType,
    title: 'Milvus',
    description: 'Busca vetorial/hibrida no Milvus e salva documentos no contexto.',
    category: 'RAG',
    Icon: Database,
    color: '#7c3aed',
  },
  {
    type: 'azureSearch' as ComponentType,
    title: 'Azure AI Search',
    description: 'Busca no Azure AI Search e salva documentos no contexto.',
    category: 'RAG',
    Icon: Search,
    color: '#16a34a',
  },
  {
    type: 'azureBlob' as ComponentType,
    title: 'Azure Blob Storage',
    description: 'Grava payloads e documentos no Blob Storage.',
    category: 'RAG',
    Icon: FolderPlus,
    color: '#0891b2',
  },
  {
    type: 'files' as ComponentType,
    title: 'Arquivos',
    description: 'Lê upload ou URL e salva texto/documentos no contexto.',
    category: 'Dados',
    Icon: FileText,
    color: '#0f766e',
  },
  {
    type: 'mongodb' as ComponentType,
    title: 'MongoDB',
    description: 'CRUD em collections para funil, eventos e analise.',
    category: 'Dados',
    Icon: Database,
    color: '#16a34a',
  },
  {
    type: 'context' as ComponentType,
    title: 'Contexto',
    description: 'Cria ou atualiza slots por JSON dinamico, JS ou LLM.',
    category: 'Dados',
    Icon: FileJson,
    color: '#0891b2',
  },
  {
    type: 'webhook' as ComponentType,
    title: 'Webhook',
    description: 'Recebe dados externos ou envia o contexto para outro endpoint.',
    category: 'Ações',
    Icon: Webhook,
    color: '#dc2626',
  },
  {
    type: 'mcp' as ComponentType,
    title: 'MCP',
    description: 'Contrato de ferramenta com schema, LLM e chamada API externa opcional.',
    category: 'Acoes',
    Icon: SquareTerminal,
    color: '#0f766e',
  },
  {
    type: 'approval' as ComponentType,
    title: 'Aprovação humana',
    description: 'Pausa o fluxo antes de ações sensíveis e registra aprovar/reprovar.',
    category: 'Governança',
    Icon: ShieldCheck,
    color: '#be123c',
  },
  {
    type: 'dashboard' as ComponentType,
    title: 'Dashboard',
    description: 'Monta cards, tabelas e gráficos com trace, API, Mongo ou Milvus.',
    category: 'Analítico',
    Icon: BarChart3,
    color: '#7c3aed',
  },
  {
    type: 'loop' as ComponentType,
    title: 'Loop',
    description: 'Repete a saída até atingir o limite ou uma condição JS parar.',
    category: 'Controle',
    Icon: Repeat2,
    color: '#0ea5e9',
  },
  {
    type: 'flowRouter' as ComponentType,
    title: 'Roteador de fluxo',
    description: 'Direciona a conversa para outro fluxo por regra JS ou LLM.',
    category: 'Controle',
    Icon: GitBranch,
    color: '#9333ea',
  },
  {
    type: 'cron' as ComponentType,
    title: 'CRON',
    description: 'Agenda a execução automática do fluxo por intervalo, dia, semana ou mês.',
    category: 'Automação',
    Icon: Clock,
    color: '#0f766e',
  },
  {
    type: 'debug' as ComponentType,
    title: 'Debug',
    description: 'Registra um snapshot do contexto atual do fluxo.',
    category: 'Dev',
    Icon: Bug,
    color: '#f59e0b',
  },
];

const FLOW_ASSISTANT_EXAMPLE = [
  'Construa um fluxo com mensagem de boas vindas "Ola seja bem vindo",',
  'salve a entrada em responseName input, marque a tag boas_vindas,',
  'peca o CPF do usuario validando como cpf e use fallback "CPF invalido",',
  'chame POST http://cpto.com enviando o cpf no body,',
  'faca polling a cada 3 segundos ate encontrar maiorIdade=true,',
  'mostre uma mensagem rica com botoes e finalize o fluxo.',
].join(' ');

function getMiniMapNodeColor(node: Node) {
  if (node.data?.step?.type === 'group') return '#0d9488';
  if (node.data?.step?.type === 'richMessage') return '#0891b2';
  if (node.data?.step?.component?.type === 'debug') return '#f59e0b';
  if (node.data?.step?.component?.type === 'openaiGen' && node.data?.step?.component?.agentRole === 'subagent') return '#dc2626';
  if (node.data?.step?.component?.type === 'openaiGen') return '#2563eb';
  if (node.data?.step?.component?.type === 'agentPlan') return '#4f46e5';
  if (node.data?.step?.component?.type === 'azureOpenAI') return '#0ea5e9';
  if (node.data?.step?.component?.type === 'milvus') return '#7c3aed';
  if (node.data?.step?.component?.type === 'azureSearch') return '#16a34a';
  if (node.data?.step?.component?.type === 'azureBlob') return '#0891b2';
  if (node.data?.step?.component?.type === 'files') return '#0f766e';
  if (node.data?.step?.component?.type === 'mongodb') return '#16a34a';
  if (node.data?.step?.component?.type === 'context') return '#0891b2';
  if (node.data?.step?.component?.type === 'dashboard') return '#7c3aed';
  if (node.data?.step?.component?.type === 'cron') return '#0f766e';
  if (node.data?.step?.component?.type === 'loop') return '#0ea5e9';
  if (node.data?.step?.component?.type === 'flowRouter') return '#9333ea';
  if (node.data?.step?.component?.type === 'webhook') return '#dc2626';
  if (node.data?.step?.component?.type === 'mcp') return '#0f766e';
  if (node.data?.step?.component?.type === 'approval') return '#be123c';
  return '#2563eb';
}

function parsePossibleJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getDebugPayload(message: TestMessage) {
  if (message.kind === 'debug' && message.debug) {
    return {
      title: message.text || 'Debug',
      payload: message.debug,
    };
  }

  const text = String(message.text || '').trim();
  if (text.startsWith('DEBUG - ')) {
    const lineBreakIndex = text.indexOf('\n');
    const title = lineBreakIndex > -1 ? text.slice(8, lineBreakIndex).trim() : 'Debug';
    const parsed = lineBreakIndex > -1 ? parsePossibleJson(text.slice(lineBreakIndex + 1)) : null;
    if (parsed) return { title: title || 'Debug', payload: parsed };
  }

  const parsed = parsePossibleJson(text);
  if (parsed && typeof parsed === 'object' && ('stepId' in parsed || 'slots' in parsed)) {
    return {
      title: typeof parsed.title === 'string' ? parsed.title : 'Debug',
      payload: parsed,
    };
  }

  return null;
}

function getDashboardPayload(message: TestMessage) {
  if (message.kind === 'dashboard' && message.debug && typeof message.debug === 'object') {
    return message.debug as Record<string, unknown>;
  }
  return null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getJsonEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
  if (isJsonObject(value)) return Object.entries(value);
  return [];
}

function collectJsonBranchPaths(value: unknown, path = 'root'): string[] {
  if (!value || typeof value !== 'object') return [];
  return [
    path,
    ...getJsonEntries(value).flatMap(([key, child]) => collectJsonBranchPaths(child, `${path}.${key}`)),
  ];
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="json-value json-null">null</span>;
  if (typeof value === 'string') return <span className="json-value json-string">"{value}"</span>;
  if (typeof value === 'number') return <span className="json-value json-number">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="json-value json-boolean">{String(value)}</span>;
  return <span className="json-value json-unknown">"{String(value)}"</span>;
}

function JsonTreeNode({
  name,
  value,
  path,
  level,
  isLast,
  collapsedPaths,
  onToggle,
}: {
  name?: string;
  value: unknown;
  path: string;
  level: number;
  isLast: boolean;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isArray = Array.isArray(value);
  const isObject = isJsonObject(value);
  const isBranch = isArray || isObject;
  const entries = getJsonEntries(value);
  const collapsed = collapsedPaths.has(path);
  const indent = { paddingLeft: `${level * 18}px` };
  const openToken = isArray ? '[' : '{';
  const closeToken = isArray ? ']' : '}';
  const summary = isArray ? `${entries.length} item(ns)` : `${entries.length} campo(s)`;
  const isIndex = name !== undefined && Number.isInteger(Number(name));

  if (!isBranch) {
    return (
      <div className="json-tree-row" style={indent}>
        {name !== undefined && (
          <>
            <span className={isIndex ? 'json-index' : 'json-key'}>{isIndex ? name : `"${name}"`}</span>
            <span className="json-punctuation">: </span>
          </>
        )}
        <JsonPrimitive value={value} />
        {!isLast && <span className="json-punctuation">,</span>}
      </div>
    );
  }

  return (
    <>
      <div className="json-tree-row" style={indent}>
        <button type="button" className="json-tree-toggle" onClick={() => onToggle(path)} aria-label={collapsed ? 'Expandir JSON' : 'Recolher JSON'}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        {name !== undefined && (
          <>
            <span className={isIndex ? 'json-index' : 'json-key'}>{isIndex ? name : `"${name}"`}</span>
            <span className="json-punctuation">: </span>
          </>
        )}
        <span className="json-punctuation">{openToken}</span>
        {collapsed && (
          <>
            <span className="json-summary">{summary}</span>
            <span className="json-punctuation">{closeToken}{!isLast ? ',' : ''}</span>
          </>
        )}
      </div>
      {!collapsed && entries.map(([key, child], index) => (
        <JsonTreeNode
          key={`${path}.${key}`}
          name={key}
          value={child}
          path={`${path}.${key}`}
          level={level + 1}
          isLast={index === entries.length - 1}
          collapsedPaths={collapsedPaths}
          onToggle={onToggle}
        />
      ))}
      {!collapsed && (
        <div className="json-tree-row" style={indent}>
          <span className="json-tree-spacer" />
          <span className="json-punctuation">{closeToken}{!isLast ? ',' : ''}</span>
        </div>
      )}
    </>
  );
}

function DebugJsonTree({ value }: { value: unknown }) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const branchPaths = useMemo(() => collectJsonBranchPaths(value).filter((path) => path !== 'root'), [value]);
  const togglePath = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="json-tree-shell">
      <div className="json-tree-toolbar">
        <button type="button" onClick={() => setCollapsedPaths(new Set(branchPaths))}>Recolher tudo</button>
        <button type="button" onClick={() => setCollapsedPaths(new Set())}>Expandir tudo</button>
      </div>
      <div className="json-tree-view">
        <JsonTreeNode
          value={value}
          path="root"
          level={0}
          isLast
          collapsedPaths={collapsedPaths}
          onToggle={togglePath}
        />
      </div>
    </div>
  );
}

function getRichMessageContent(message: TestMessage) {
  if (message.kind === 'rich' && message.content) return message.content;
  return undefined;
}

const DASHBOARD_CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#475569'];

function getDashboardChart(payload: Record<string, unknown>) {
  const chart = payload.chart as Record<string, unknown> | undefined;
  const rawSeries = Array.isArray(chart?.series) ? chart.series as Array<Record<string, unknown>> : [];
  const series = rawSeries
    .map((item, index) => ({
      label: String(item.label || `Item ${index + 1}`),
      value: Number(item.value) || 0,
      color: String(item.color || DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length]),
    }))
    .filter((item) => item.label);

  if (!chart || !series.length) return null;
  return {
    type: String(chart.type || payload.mode || 'bar'),
    title: String(chart.title || payload.title || 'Grafico'),
    generatedBy: String(chart.generatedBy || ''),
    series,
  };
}

function DashboardChart({ chart }: { chart: NonNullable<ReturnType<typeof getDashboardChart>> }) {
  const total = chart.series.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  const maxValue = Math.max(...chart.series.map((item) => item.value), 1);
  const pieStops = chart.series.reduce(
    (acc, item) => {
      const start = acc.offset;
      const next = start + (Math.max(item.value, 0) / total) * 100;
      return {
        offset: next,
        stops: [...acc.stops, `${item.color} ${start}% ${next}%`],
      };
    },
    { offset: 0, stops: [] as string[] },
  ).stops.join(', ');

  return (
    <div className="dashboard-chart">
      <div className="dashboard-chart-title">
        <strong>{chart.title}</strong>
        {chart.generatedBy && <span>{chart.generatedBy === 'llm' ? 'LLM' : 'auto'}</span>}
      </div>
      {chart.type === 'pie' ? (
        <div className="dashboard-pie-wrap">
          <div className="dashboard-pie" style={{ background: `conic-gradient(${pieStops || '#e5e7eb 0% 100%'})` }} />
          <div className="dashboard-legend">
            {chart.series.map((item) => (
              <div key={item.label}>
                <i style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard-bars">
          {chart.series.map((item) => (
            <div className="dashboard-bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="dashboard-bar-track">
                <div style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%`, background: item.color }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardPreview({ payload }: { payload: Record<string, unknown> }) {
  const cards = Array.isArray(payload.cards) ? payload.cards as Array<Record<string, unknown>> : [];
  const rows = Array.isArray(payload.rows) ? payload.rows as Array<Record<string, unknown>> : [];
  const chart = getDashboardChart(payload);
  const showTable = payload.showTable === true || payload.mode === 'table';
  const columns = rows.length
    ? Array.from(new Set(rows.slice(0, 5).flatMap((row) => Object.keys(row)))).slice(0, 5)
    : [];

  return (
    <div className="dashboard-preview">
      <div className="dashboard-preview-header">
        <strong>{String(payload.title || 'Dashboard')}</strong>
        <span>{String(payload.source || 'trace')} / {String(payload.mode || 'summary')}</span>
      </div>
      {cards.length > 0 && (
        <div className="dashboard-card-grid">
          {cards.map((card, index) => (
            <div className="dashboard-card" key={index}>
              <span>{String(card.label || `Metrica ${index + 1}`)}</span>
              <strong>{String(card.value ?? '-')}</strong>
            </div>
          ))}
        </div>
      )}
      {chart && <DashboardChart chart={chart} />}
      {showTable && rows.length > 0 && columns.length > 0 && (
        <div className="dashboard-table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getTagDashboardSeries(dashboard: Record<string, any> | null) {
  const rows = Array.isArray(dashboard?.byTag) ? dashboard.byTag : [];
  return rows.slice(0, 12).map((item: any, index: number) => ({
    label: String(item.tag || `Tag ${index + 1}`),
    value: Number(item.count || 0),
    conversations: Number(item.conversations || 0),
    color: DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
  }));
}

function toDashboardSeries(rows: any[] | undefined, labelKeys: string[], valueKey = 'count') {
  const source = Array.isArray(rows) ? rows : [];
  return source.slice(0, 12).map((item: any, index: number) => {
    const label = labelKeys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && String(value).trim());
    return {
      label: String(label || `Item ${index + 1}`),
      value: Number(item?.[valueKey] || 0),
      conversations: Number(item?.conversations || 0),
      color: DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length],
    };
  });
}

function formatMetric(value: unknown, digits = 0) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function TagDashboardVisualization({ mode, series }: { mode: TagDashboardView; series: ReturnType<typeof getTagDashboardSeries> }) {
  const total = series.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const pieStops = series.reduce(
    (acc, item) => {
      const start = acc.offset;
      const next = start + (Math.max(item.value, 0) / total) * 100;
      return {
        offset: next,
        stops: [...acc.stops, `${item.color} ${start}% ${next}%`],
      };
    },
    { offset: 0, stops: [] as string[] },
  ).stops.join(', ');

  const chartWidth = 720;
  const chartHeight = 240;
  const padX = 34;
  const padY = 26;
  const points = series.map((item, index) => {
    const x = series.length === 1 ? chartWidth / 2 : padX + (index / Math.max(series.length - 1, 1)) * (chartWidth - padX * 2);
    const y = chartHeight - padY - (Math.max(item.value, 0) / maxValue) * (chartHeight - padY * 2);
    return { ...item, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = points.length ? `${padX},${chartHeight - padY} ${linePoints} ${chartWidth - padX},${chartHeight - padY}` : '';

  if (!series.length) {
    return <div className="tag-dashboard-chart-empty">Nenhuma tag encontrada para os filtros atuais.</div>;
  }

  if (mode === 'bar') {
    return (
      <div className="dashboard-chart tag-dashboard-chart-panel">
        <div className="dashboard-chart-title">
          <strong>Eventos por tag</strong>
          <span>Barras</span>
        </div>
        <div className="dashboard-bars">
          {series.map((item) => (
            <div className="dashboard-bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="dashboard-bar-track">
                <div style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%`, background: item.color }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'pie') {
    return (
      <div className="dashboard-chart tag-dashboard-chart-panel">
        <div className="dashboard-chart-title">
          <strong>Distribuição por tag</strong>
          <span>Pizza</span>
        </div>
        <div className="dashboard-pie-wrap tag-dashboard-pie-wrap">
          <div className="dashboard-pie tag-dashboard-pie" style={{ background: `conic-gradient(${pieStops || '#e5e7eb 0% 100%'})` }} />
          <div className="dashboard-legend">
            {series.map((item) => (
              <div key={item.label}>
                <i style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'line') {
    return (
      <div className="dashboard-chart tag-dashboard-chart-panel">
        <div className="dashboard-chart-title">
          <strong>Comparativo por tag</strong>
          <span>Gráfico</span>
        </div>
        <div className="tag-dashboard-line-chart">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Gráfico de tags por eventos">
            <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} />
            <line x1={padX} y1={padY} x2={padX} y2={chartHeight - padY} />
            {areaPoints && <polygon points={areaPoints} />}
            {linePoints && <polyline points={linePoints} />}
            {points.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="5" style={{ fill: point.color }} />
                <title>{`${point.label}: ${point.value} eventos`}</title>
              </g>
            ))}
          </svg>
          <div className="dashboard-legend tag-dashboard-line-legend">
            {series.map((item) => (
              <div key={item.label}>
                <i style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function DashboardBarList({
  title,
  subtitle,
  series,
  emptyText,
}: {
  title: string;
  subtitle: string;
  series: ReturnType<typeof getTagDashboardSeries>;
  emptyText: string;
}) {
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  if (!series.length) {
    return <div className="tag-dashboard-chart-empty">{emptyText}</div>;
  }
  return (
    <div className="dashboard-chart tag-dashboard-chart-panel">
      <div className="dashboard-chart-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="dashboard-bars">
        {series.map((item) => (
          <div className="dashboard-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="dashboard-bar-track">
              <div style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%`, background: item.color }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRichInteractionValue(item: { id?: string; label?: string; title?: string; value?: string }) {
  return String(item.value || item.label || item.title || item.id || '').trim();
}

function getRichInteractionLabel(item: { id?: string; label?: string; title?: string; value?: string }) {
  return String(item.label || item.title || item.value || item.id || '').trim();
}

function RichMessagePreview({
  content,
  disabled,
  onSelect,
}: {
  content: RichMessageConfig;
  disabled?: boolean;
  onSelect?: (value: string, label: string) => void;
}) {
  const selectItem = (item: { id?: string; label?: string; title?: string; value?: string }) => {
    const value = getRichInteractionValue(item);
    if (!value || disabled) return;
    onSelect?.(value, getRichInteractionLabel(item) || value);
  };

  return (
    <div className={`rich-message-preview rich-message-preview-${content.type}`}>
      {content.text && <p>{content.text}</p>}
      {content.type === 'image' && content.media?.url && (
        <img className="rich-preview-media-image" src={content.media.url} alt={content.media.caption || content.text || 'Imagem'} />
      )}
      {content.type === 'document' && content.media?.url && (
        <a className="rich-preview-document" href={content.media.url} target="_blank" rel="noreferrer">
          <strong>{content.media.fileName || 'Documento'}</strong>
          <small>{content.media.mimeType || 'Arquivo anexado'}</small>
        </a>
      )}
      {content.type === 'buttons' && (
        <div className="rich-preview-actions">
          {(content.buttons || []).map((button) => (
            <button type="button" key={button.id || button.label} disabled={disabled} onClick={() => selectItem(button)}>
              {button.label}
            </button>
          ))}
        </div>
      )}
      {content.type === 'quickReplies' && (
        <div className="rich-preview-quick">
          {(content.quickReplies || []).map((reply) => (
            <button type="button" key={reply.id || reply.label} disabled={disabled} onClick={() => selectItem(reply)}>
              {reply.label}
            </button>
          ))}
        </div>
      )}
      {content.type === 'list' && (
        <div className="rich-preview-list">
          <strong>{content.list?.buttonText || 'Ver opções'}</strong>
          {(content.list?.sections || []).map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <span>{section.title}</span>
              {(section.items || []).map((item) => (
                <button
                  type="button"
                  className="rich-preview-list-item"
                  key={item.id || item.title}
                  disabled={disabled}
                  onClick={() => selectItem(item)}
                >
                  <strong>{item.title}</strong>
                  {item.description && <small>{item.description}</small>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {content.type === 'carousel' && (
        <div className="rich-preview-carousel">
          {(content.carousel?.cards || []).map((card) => (
            <div className="rich-preview-card" key={card.id || card.title}>
              {card.imageUrl && <img src={card.imageUrl} alt="" />}
              <strong>{card.title}</strong>
              {card.subtitle && <span>{card.subtitle}</span>}
              <div className="rich-preview-actions">
                {(card.buttons || []).map((button) => (
                  <button type="button" key={button.id || button.label} disabled={disabled} onClick={() => selectItem(button)}>
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {content.type === 'appointmentFlow' && (
        <div className="rich-preview-list">
          <strong>{content.appointmentFlow?.flowCta || content.appointmentFlow?.buttonText || 'Agendar'}</strong>
          <button
            type="button"
            className="rich-preview-list-item"
            disabled={disabled}
            onClick={() => selectItem({
              id: 'appointment_flow',
              title: content.appointmentFlow?.flowCta || 'Agendar',
              value: content.appointmentFlow?.flowCta || 'agendar',
            })}
          >
            <strong>{content.appointmentFlow?.headerText || 'Agendamento'}</strong>
            <small>{content.appointmentFlow?.flowId ? 'WhatsApp Flow' : 'Lista interativa'}</small>
          </button>
        </div>
      )}
      {content.footer && <small className="rich-preview-footer">{content.footer}</small>}
    </div>
  );
}

function withConfigDefaults(config: FlowConfig): FlowConfig {
  return {
    ...config,
    channel: config.channel || 'webWidget',
    llmProvider: config.llmProvider || 'openai',
    agentSpec: {
      agentsMd: config.agentSpec?.agentsMd || '',
      guardrails: config.agentSpec?.guardrails || '',
      blockedTerms: config.agentSpec?.blockedTerms || [],
      rules: config.agentSpec?.rules || [],
      skills: config.agentSpec?.skills || [],
      subagents: config.agentSpec?.subagents || [],
      mcpServers: config.agentSpec?.mcpServers || [],
    },
    isMainFlow: config.isMainFlow === true,
    webWidget: createWebWidgetConfig(config.webWidget),
    whatsapp: createWhatsappConfig(config.whatsapp),
    steps: (config.steps || []).map((step) => {
      if (step.component?.type !== 'flowRouter') return step;
      const {
        flowRouterPersistTarget: _flowRouterPersistTarget,
        flowRouterRunMode: _flowRouterRunMode,
        flowRouterSynchronousModeConfirmed: _flowRouterSynchronousModeConfirmed,
        flowRouterSwitchMessage: _flowRouterSwitchMessage,
        ...component
      } = step.component as NonNullable<FlowStep['component']> & Record<string, unknown>;
      return { ...step, component };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createFlowExportPayload({
  config,
  flowId,
  flowName,
  agentId,
}: {
  config: FlowConfig;
  flowId: string;
  flowName: string;
  agentId: string;
}) {
  return {
    kind: 'canvas-flow.flow',
    version: 1,
    exportedAt: new Date().toISOString(),
    flowId: flowId || undefined,
    name: flowName || config.title || 'Fluxo exportado',
    agentId: agentId || undefined,
    config: withConfigDefaults(config),
  };
}

function parseImportedFlow(value: unknown): { config: FlowConfig; name: string; agentId: string } {
  if (!isRecord(value)) {
    throw new Error('Arquivo inválido. Envie um JSON de fluxo do Canvas Flow.');
  }

  const configCandidate = isRecord(value.config)
    ? value.config
    : isRecord(value.flowConfig)
      ? value.flowConfig
      : value;

  if (!Array.isArray(configCandidate.steps) || !Array.isArray(configCandidate.edges)) {
    throw new Error('JSON inválido. O fluxo precisa conter steps e edges.');
  }

  const nextConfig = withConfigDefaults(configCandidate as unknown as FlowConfig);
  return {
    config: nextConfig,
    name: String(value.name || value.flowName || nextConfig.title || 'Fluxo importado'),
    agentId: String(value.agentId || ''),
  };
}

function sanitizeFileName(value: string) {
  return (value || 'fluxo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'fluxo';
}

function sortFlowVersions(versions?: CanvasFlowVersionRecord[]) {
  return [...(versions || [])].sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
}

function pickPreferredFlowVersion(
  versions: CanvasFlowVersionRecord[],
  activeVersion?: number,
  preferredVersion?: number,
) {
  const sorted = sortFlowVersions(versions).filter((version) => version.config);
  if (!sorted.length) return undefined;
  const requested = Number(preferredVersion || 0);
  const active = Number(activeVersion || 0);
  return (requested ? sorted.find((version) => Number(version.version) === requested) : undefined)
    || (active ? sorted.find((version) => Number(version.version) === active) : undefined)
    || sorted[0];
}

function sortAgentReleases(releases?: CanvasFlowAgentReleaseRecord[]) {
  return [...(releases || [])].sort((a, b) => Number(b.release || 0) - Number(a.release || 0));
}

type AgentReleaseSnapshotOption = {
  id: string;
  name: string;
  packageName?: string;
  versionName?: string;
  version: number;
};

function getAgentReleaseSnapshotOptions(
  release: CanvasFlowAgentReleaseRecord | undefined,
  flows: CanvasFlowRecord[],
): AgentReleaseSnapshotOption[] {
  return Object.entries(release?.versions || {})
    .map(([flowId, version]) => {
      const currentName = flows.find((flow) => flow._id === flowId)?.name;
      const packageName = release?.flowNames?.[flowId];
      const versionName = release?.versionNames?.[flowId];
      const name = currentName || packageName || flowId;
      return {
        id: flowId,
        name,
        packageName: currentName && packageName && currentName !== packageName ? packageName : undefined,
        versionName: versionName && versionName !== name ? versionName : undefined,
        version: Number(version),
      };
    })
    .filter((flow) => flow.version > 0)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function formatAgentReleaseSnapshotOption(flow: AgentReleaseSnapshotOption, isProduction = false) {
  return `${flow.name} - v${flow.version}${flow.versionName ? ` · ${flow.versionName}` : ''}${flow.packageName ? ` (no pacote: ${flow.packageName})` : ''}${isProduction ? ' (produção)' : ''}`;
}

type AgentReleaseFlowVersionOption = AgentReleaseSnapshotOption & {
  key: string;
  flowId: string;
  isReleaseSnapshot: boolean;
  isFlowActive: boolean;
};

function getAgentReleaseFlowVersionOptions(
  release: CanvasFlowAgentReleaseRecord | undefined,
  flows: CanvasFlowRecord[],
  versionStates: Record<string, Pick<CanvasFlowRecord, 'activeVersion' | 'versions'>>,
): AgentReleaseFlowVersionOption[] {
  return getAgentReleaseSnapshotOptions(release, flows).flatMap((flow) => {
    const state = versionStates[flow.id];
    const versions = sortFlowVersions(state?.versions);
    const availableVersions = versions.length
      ? versions
      : [{ version: flow.version, name: flow.versionName }];
    return availableVersions.map((version) => ({
      ...flow,
      key: `${flow.id}:${version.version}`,
      flowId: flow.id,
      version: Number(version.version),
      versionName: version.name && version.name !== flow.name ? version.name : undefined,
      isReleaseSnapshot: Number(version.version) === Number(flow.version),
      isFlowActive: Number(version.version) === Number(state?.activeVersion),
    }));
  });
}

function isAgentReleaseFlowVersionProduction(
  flow: AgentReleaseFlowVersionOption,
  activeRelease: CanvasFlowAgentReleaseRecord | undefined,
) {
  const productionVersion = Number(activeRelease?.versions?.[flow.flowId] || 0);
  return productionVersion ? productionVersion === flow.version : flow.isFlowActive;
}

function formatAgentReleaseFlowVersionOption(flow: AgentReleaseFlowVersionOption, isProduction = false) {
  return formatAgentReleaseSnapshotOption(flow, isProduction);
}

function formatDateTime(value?: string) {
  if (!value) return 'sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem data';
  return date.toLocaleString('pt-BR');
}

function formatAuditActor(email?: string, userId?: string) {
  const emailValue = String(email || '').trim();
  if (emailValue) return emailValue;
  const fallback = String(userId || '').trim();
  if (!fallback) return 'sem e-mail registrado';
  if (/^[a-f0-9]{24}$/i.test(fallback)) return 'sem e-mail registrado';
  return fallback;
}

function createEmptyFlow(): FlowConfig {
  return {
    title: 'Novo fluxo',
    responseName: 'newFlow',
    execute: 'firstQuestion',
    model: 'gpt-5.5',
    llmProvider: 'openai',
    agentSpec: {
      agentsMd: '',
      guardrails: 'Nunca invente dados. Peça aprovação humana antes de ações sensíveis. Respeite privacidade e dados pessoais.',
      blockedTerms: [],
      rules: [],
      skills: [],
      subagents: [],
      mcpServers: [],
    },
    channel: 'webWidget',
    isMainFlow: false,
    webWidget: createWebWidgetConfig(),
    whatsapp: createWhatsappConfig(),
    turnHistoricMessages: 20,
    startStepId: '',
    steps: [],
    edges: [],
  };
}

function createNextFlowName(existingFlows: CanvasFlowRecord[], baseName = 'Novo fluxo') {
  const names = new Set(existingFlows.map((flow) => String(flow.name || '').trim()).filter(Boolean));
  if (!names.has(baseName)) return baseName;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${baseName} ${Date.now()}`;
}

function reorderByIndex<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function createApiExamples({
  apiUrl,
  flowId,
  flowName,
  flowResponseName,
  agentId,
  channel,
  webWidget,
  whatsapp,
  whatsappWebhookUrl,
  apiTokenConfigured,
}: {
  apiUrl: string;
  flowId: string;
  flowName: string;
  flowResponseName?: string;
  agentId: string;
  channel: FlowChannel;
  webWidget: WebWidgetConfig;
  whatsapp: WhatsappConfig;
  whatsappWebhookUrl: string;
  apiTokenConfigured: boolean;
}) {
  const endpoint = `${apiUrl}/api/canvas-flow/test`;
  const mcpEndpoint = `${apiUrl}/api/canvas-flow/mcp/${encodeURIComponent(agentId || 'default-agent')}`;
  const mcpToolName = (flowResponseName || flowName || 'nome_da_ferramenta')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 80) || 'nome_da_ferramenta';
  const tokenPlaceholder = '<CANVAS_FLOW_API_KEY>';
  const widgetTheme = {
    primaryColor: webWidget.primaryColor,
    accentColor: webWidget.accentColor,
    assistantName: webWidget.assistantName,
    subtitle: webWidget.subtitle,
    welcomeMessage: webWidget.welcomeMessage,
    placeholder: webWidget.placeholder,
    bubbleLabel: webWidget.bubbleLabel,
    avatarText: webWidget.avatarText,
    openByDefault: webWidget.openByDefault,
    position: webWidget.position,
  };
  const payload = {
    flowId,
    agentId,
    channel,
    conversationId: `${channel}-cliente-123`,
    text: 'Ola, preciso de ajuda.',
    slots: channel === 'webWidget' ? { webWidget: widgetTheme } : {},
  };
  const payloadJson = JSON.stringify(payload, null, 2);
  const curl = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '${payloadJson}'`;
  const javascript = `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${tokenPlaceholder}"
  },
  body: JSON.stringify(${payloadJson})
});

const data = await response.json();
console.log(data.messages, data.slots);`;
  const widgetSettings = {
    flowId,
    flowName: flowName || '<NOME_DO_FLUXO>',
    agentId,
    channel: 'webWidget',
    userContext: null,
    theme: widgetTheme,
  };
  const widget = `<script>
const canvasFlowWidget = ${JSON.stringify(widgetSettings, null, 2)};
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

async function enviarMensagem(texto) {
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

// Use canvasFlowWidget.theme para aplicar cores, textos,
// posicao e se o chat inicia aberto ou apenas como balao.
// Use canvasFlowWidget.userContext apenas para dados nao sensiveis.
</script>`;
  const auth = `Authorization: Bearer ${tokenPlaceholder}
Header alternativo: x-api-key: ${tokenPlaceholder}

Use uma chave gerada em API Keys. O token master CANVAS_FLOW_API_TOKEN deve ficar reservado para administracao.

Backend atual: ${apiTokenConfigured ? 'token master configurado' : 'sem token master no frontend; defina VITE_CANVAS_FLOW_API_TOKEN para gerenciar chaves'}.`;
  const mcp = `MCP server exposto pelo Canvas Flow
Transporte: JSON-RPC 2.0 sobre HTTP POST
Endpoint: ${mcpEndpoint}
Auth: Authorization: Bearer ${tokenPlaceholder}
Header alternativo: x-api-key: ${tokenPlaceholder}

Como um MCP client consome este server:
1. Envie initialize para negociar capabilities.
2. Envie tools/list para descobrir as tools disponiveis.
3. Cada flow salvo deste agente aparece como uma tool MCP.
4. Use exatamente result.tools[].name no tools/call.
5. Em arguments, envie text e, se quiser memoria, reutilize conversationId.

Initialize:
curl -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"meu-mcp-client","version":"1.0.0"}}}'

Listar tools:
curl -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

Chamar uma tool:
curl -X POST "${mcpEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"${mcpToolName}","arguments":{"text":"Preciso de ajuda","conversationId":"mcp-cliente-123","slots":{}}}}'

Exemplo minimo de cliente HTTP:
const endpoint = "${mcpEndpoint}";
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer ${tokenPlaceholder}"
};

async function mcpRequest(method, params = {}, id = Date.now()) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

await mcpRequest("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "meu-mcp-client", version: "1.0.0" }
});
const listed = await mcpRequest("tools/list");
const toolName = listed.tools[0].name;
const result = await mcpRequest("tools/call", {
  name: toolName,
  arguments: {
    text: "Preciso de ajuda",
    conversationId: "mcp-cliente-123",
    slots: {}
  }
});
console.log(result.content, result.structuredContent);

Config generica para um client/proxy MCP HTTP:
{
  "name": "canvas-flow-${agentId || 'default-agent'}",
  "transport": "http-json-rpc-post",
  "url": "${mcpEndpoint}",
  "headers": {
    "Authorization": "Bearer ${tokenPlaceholder}"
  }
}

Observacao: se o seu MCP client aceitar apenas Streamable HTTP/SSE com sessao, use um bridge/proxy MCP que encaminhe JSON-RPC HTTP POST para este endpoint.`;
  const whatsappProvider = whatsapp.provider || 'meta';
  const whatsappAdapter = whatsappProvider === 'meta'
    ? `Provedor: API Oficial Meta
Callback URL: ${whatsappWebhookUrl}
Verify token: ${whatsapp.verifyToken || '<PALAVRA_TOKEN>'}

GET ${whatsappWebhookUrl}
POST ${whatsappWebhookUrl}

O backend valida o token no GET e executa o fluxo no POST quando chegar uma mensagem.`
    : whatsappProvider === 'blip'
      ? `Provedor: Blip
Callback URL: ${whatsappWebhookUrl}

Configure a entrada HTTP/webhook no Blip apontando para a URL acima.
Para envio automatico, configure Contract ID e Authorization key em Provedores > WhatsApp.`
      : `Provedor: Sinch
Callback URL: ${whatsappWebhookUrl}

Configure inbound message webhooks da Sinch Conversation API apontando para a URL acima.
Para envio automatico, configure Project ID, App ID, regiao e access token.
Para repasse, use Retornar payload na resposta da API e configure numero, username e token em Provedores > WhatsApp.`;

  return { endpoint, mcpEndpoint, auth, payloadJson, curl, javascript, widget, whatsapp: whatsappAdapter, mcp };
}

function getGroupExpandedSize(step: FlowStep) {
  return {
    width: Math.max(GROUP_MIN_WIDTH, Number(step.group?.width || 520)),
    height: Math.max(GROUP_MIN_HEIGHT, Number(step.group?.height || 340)),
  };
}

function getStepSize(step: FlowStep) {
  if (step.type === 'group') {
    if (step.group?.collapsed) {
      return {
        width: GROUP_COLLAPSED_WIDTH,
        height: GROUP_COLLAPSED_HEIGHT,
      };
    }
    return getGroupExpandedSize(step);
  }
  return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
}

function getBoundsFromPosition(position: { x: number; y: number }, size: { width: number; height: number }) {
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    right: position.x + size.width,
    bottom: position.y + size.height,
  };
}

function getMeasuredNodeSize(node: Node | undefined, fallback: { width: number; height: number }) {
  const nodeWithMeasured = node as (Node & { measured?: { width?: number; height?: number } }) | undefined;
  const style = (node?.style || {}) as { width?: number | string; height?: number | string };
  const measuredWidth = Number(node?.width || nodeWithMeasured?.measured?.width || style.width || 0);
  const measuredHeight = Number(node?.height || nodeWithMeasured?.measured?.height || style.height || 0);

  return {
    width: Math.max(fallback.width, Number.isFinite(measuredWidth) ? measuredWidth : 0),
    height: Math.max(fallback.height, Number.isFinite(measuredHeight) ? measuredHeight : 0),
  };
}

function getPositionInsideGroup(x: number, y: number) {
  return {
    x: Math.max(GROUP_CHILD_SAFE_LEFT, x),
    y: Math.max(GROUP_HEADER_SAFE_TOP, y),
  };
}

function expandBounds(bounds: ReturnType<typeof getBoundsFromPosition>, margin: number) {
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
    right: bounds.right + margin,
    bottom: bounds.bottom + margin,
  };
}

function shrinkBounds(bounds: ReturnType<typeof getBoundsFromPosition>, inset: number) {
  const safeInset = Math.max(0, Math.min(inset, bounds.width / 2 - 1, bounds.height / 2 - 1));
  return {
    x: bounds.x + safeInset,
    y: bounds.y + safeInset,
    width: Math.max(1, bounds.width - safeInset * 2),
    height: Math.max(1, bounds.height - safeInset * 2),
    right: bounds.right - safeInset,
    bottom: bounds.bottom - safeInset,
  };
}

function removeStepsFromConfig(config: FlowConfig, stepIds: Set<string>): FlowConfig {
  if (!stepIds.size) return config;
  const stepById = new Map(config.steps.map((step) => [step.id, step]));
  const steps = config.steps
    .filter((step) => !stepIds.has(step.id))
    .map((step) => {
      if (!step.parentId || !stepIds.has(step.parentId)) return step;
      return {
        ...step,
        parentId: undefined,
        position: getAbsolutePosition(step, stepById),
      };
    });

  return {
    ...config,
    steps,
    edges: config.edges.filter((edge) => !stepIds.has(edge.source) && !stepIds.has(edge.target)),
    startStepId: stepIds.has(config.startStepId) ? steps[0]?.id || '' : config.startStepId,
  };
}

function cloneFlowStep(step: FlowStep): FlowStep {
  return JSON.parse(JSON.stringify(step)) as FlowStep;
}

function getAbsolutePosition(step: FlowStep, stepById: Map<string, FlowStep>): { x: number; y: number } {
  const position = {
    x: step.position?.x || 0,
    y: step.position?.y || 0,
  };
  const visited = new Set([step.id]);
  let parentId = step.parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = stepById.get(parentId);
    if (!parent) break;
    position.x += parent.position?.x || 0;
    position.y += parent.position?.y || 0;
    parentId = parent.parentId;
  }

  return position;
}

function getStepBounds(step: FlowStep, stepById: Map<string, FlowStep>) {
  const position = getAbsolutePosition(step, stepById);
  const size = getStepSize(step);
  return getBoundsFromPosition(position, size);
}

function isPointInsideBounds(point: { x: number; y: number }, bounds: ReturnType<typeof getStepBounds>) {
  return point.x >= bounds.x && point.x <= bounds.right && point.y >= bounds.y && point.y <= bounds.bottom;
}

function getIntersectionRatio(
  nodeBounds: ReturnType<typeof getStepBounds>,
  groupBounds: ReturnType<typeof getStepBounds>,
) {
  const xOverlap = Math.max(0, Math.min(nodeBounds.right, groupBounds.right) - Math.max(nodeBounds.x, groupBounds.x));
  const yOverlap = Math.max(0, Math.min(nodeBounds.bottom, groupBounds.bottom) - Math.max(nodeBounds.y, groupBounds.y));
  const nodeArea = Math.max(1, nodeBounds.width * nodeBounds.height);
  return (xOverlap * yOverlap) / nodeArea;
}

function hasCollapsedAncestor(step: FlowStep, stepById: Map<string, FlowStep>) {
  let parentId = step.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = stepById.get(parentId);
    if (!parent) return false;
    if (parent.type === 'group' && parent.group?.collapsed) return true;
    parentId = parent.parentId;
  }

  return false;
}

function hasDraggedAncestor(step: FlowStep, stepById: Map<string, FlowStep>, draggedIds: Set<string>) {
  let parentId = step.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    if (draggedIds.has(parentId)) return true;
    visited.add(parentId);
    parentId = stepById.get(parentId)?.parentId;
  }

  return false;
}

function hasAncestor(step: FlowStep, ancestorId: string, stepById: Map<string, FlowStep>) {
  let parentId = step.parentId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    parentId = stepById.get(parentId)?.parentId;
  }

  return false;
}

function hasParentCycle(step: FlowStep, stepById: Map<string, FlowStep>) {
  const visited = new Set([step.id]);
  let parentId = step.parentId;

  while (parentId) {
    if (visited.has(parentId)) return true;
    visited.add(parentId);
    parentId = stepById.get(parentId)?.parentId;
  }

  return false;
}

function fitExpandedGroupToChildren(steps: FlowStep[], groupId: string) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const group = stepById.get(groupId);
  if (!group || group.type !== 'group') return steps;

  const descendants = steps.filter((step) => step.id !== groupId && hasAncestor(step, groupId, stepById));
  if (!descendants.length) return steps;

  const groupPosition = getAbsolutePosition(group, stepById);
  const bounds = descendants.reduce(
    (acc, step) => {
      const stepBounds = getStepBounds(step, stepById);
      return {
        minX: Math.min(acc.minX, stepBounds.x - groupPosition.x),
        minY: Math.min(acc.minY, stepBounds.y - groupPosition.y),
        maxX: Math.max(acc.maxX, stepBounds.right - groupPosition.x),
        maxY: Math.max(acc.maxY, stepBounds.bottom - groupPosition.y),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const shiftX = Math.max(0, GROUP_CHILD_SAFE_LEFT - bounds.minX);
  const shiftY = Math.max(0, GROUP_HEADER_SAFE_TOP - bounds.minY);
  const currentSize = getGroupExpandedSize(group);
  const nextWidth = Math.max(currentSize.width, Math.ceil(bounds.maxX + shiftX + GROUP_CHILD_SAFE_RIGHT));
  const nextHeight = Math.max(currentSize.height, Math.ceil(bounds.maxY + shiftY + GROUP_CHILD_SAFE_BOTTOM));
  const shouldShift = shiftX > 0 || shiftY > 0;
  const shouldResize = nextWidth !== currentSize.width || nextHeight !== currentSize.height;

  if (!shouldShift && !shouldResize) return steps;

  return steps.map((step) => {
    if (step.id === groupId) {
      return {
        ...step,
        group: {
          ...(step.group || { width: currentSize.width, height: currentSize.height }),
          width: nextWidth,
          height: nextHeight,
        },
      };
    }
    if (!shouldShift || step.parentId !== groupId) return step;
    return {
      ...step,
      position: {
        x: (step.position?.x || 0) + shiftX,
        y: (step.position?.y || 0) + shiftY,
      },
    };
  });
}

function normalizeCanvasHierarchy(steps: FlowStep[]) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  let changed = false;

  const nextSteps = steps.map((step) => {
    if (!step.parentId) return step;
    const parent = stepById.get(step.parentId);
    const invalidParent =
      step.type === 'group' ||
      step.parentId === step.id ||
      !parent ||
      parent.type !== 'group' ||
      hasParentCycle(step, stepById);

    if (invalidParent) {
      changed = true;
      return {
        ...step,
        parentId: undefined,
        position: getAbsolutePosition(step, stepById),
      };
    }
    if (!parent.group?.collapsed) {
      const nextPosition = getPositionInsideGroup(step.position?.x || 0, step.position?.y || 0);
      if (
        Math.abs((step.position?.x || 0) - nextPosition.x) < 0.5 &&
        Math.abs((step.position?.y || 0) - nextPosition.y) < 0.5
      ) {
        return step;
      }
      changed = true;
      return {
        ...step,
        position: nextPosition,
      };
    }
    return step;
  });

  return changed ? nextSteps : steps;
}

function getCollapsedGroupProxyMap(config: FlowConfig) {
  const steps = normalizeCanvasHierarchy(config.steps);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const collapsedChildOwnerById = new Map<string, string>();
  steps.forEach((step) => {
    if (step.type !== 'group' || !step.group?.collapsed) return;
    (step.group.collapsedChildIds || []).forEach((childId) => {
      if (childId !== step.id && stepById.has(childId)) {
        collapsedChildOwnerById.set(childId, step.id);
      }
    });
  });
  const hiddenByCollapsedAncestor = new Map<string, string>();
  const getCollapsedAncestorId = (step: FlowStep): string => {
    const cached = hiddenByCollapsedAncestor.get(step.id);
    if (cached !== undefined) return cached;
    const visited = new Set<string>();
    let parentId = step.parentId;
    let collapsedAncestorId = '';

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = stepById.get(parentId);
      if (!parent) break;
      const cachedParent = hiddenByCollapsedAncestor.get(parent.id);
      if (cachedParent !== undefined) {
        collapsedAncestorId = cachedParent;
        break;
      }
      if (parent.type === 'group' && parent.group?.collapsed) {
        collapsedAncestorId = parent.id;
        break;
      }
      parentId = parent.parentId;
    }

    hiddenByCollapsedAncestor.set(step.id, collapsedAncestorId);
    return collapsedAncestorId;
  };
  const proxyByStepId = new Map<string, string>();

  steps.forEach((step) => {
    const collapsedOwnerId = collapsedChildOwnerById.get(step.id);
    if (collapsedOwnerId) {
      proxyByStepId.set(step.id, collapsedOwnerId);
      return;
    }
    const collapsedAncestorId = getCollapsedAncestorId(step);
    if (collapsedAncestorId) {
      proxyByStepId.set(step.id, collapsedAncestorId);
    }
  });

  return proxyByStepId;
}

function getVisibleStepIds(config: FlowConfig) {
  const steps = normalizeCanvasHierarchy(config.steps);
  const proxyByStepId = getCollapsedGroupProxyMap(config);
  const visibleStepIds = new Set(
    steps
      .filter((step) => !proxyByStepId.has(step.id))
      .map((step) => step.id),
  );

  steps.forEach((step) => {
    if (step.type === 'group' && step.group?.collapsed) {
      visibleStepIds.add(step.id);
    }
  });

  return visibleStepIds;
}

function getVisibleEndpointId(
  stepId: string,
  stepById: Map<string, FlowStep>,
  visibleStepIds: Set<string>,
  proxyByStepId: Map<string, string>,
) {
  if (visibleStepIds.has(stepId)) return stepId;
  const proxiedStepId = proxyByStepId.get(stepId);
  if (proxiedStepId && visibleStepIds.has(proxiedStepId)) return proxiedStepId;
  const visited = new Set<string>();
  let parentId = stepById.get(stepId)?.parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = stepById.get(parentId);
    if (!parent) break;
    if (parent.type === 'group' && parent.group?.collapsed && visibleStepIds.has(parent.id)) {
      return parent.id;
    }
    parentId = parent.parentId;
  }

  return visibleStepIds.has(stepId) ? stepId : '';
}

function getChildrenCountByGroup(steps: FlowStep[]) {
  const childrenCount = new Map<string, number>();

  steps.forEach((step) => {
    if (!step.parentId) return;
    childrenCount.set(step.parentId, (childrenCount.get(step.parentId) || 0) + 1);
  });

  return childrenCount;
}

function getNodeAbsolutePosition(node: Node, step: FlowStep, stepById: Map<string, FlowStep>) {
  const positionAbsolute = (node as Node & { positionAbsolute?: { x: number; y: number } }).positionAbsolute;
  if (positionAbsolute) {
    return {
      x: Number(positionAbsolute.x || 0),
      y: Number(positionAbsolute.y || 0),
    };
  }

  const currentParent = step.parentId ? stepById.get(step.parentId) : undefined;
  const parentPosition = currentParent ? getAbsolutePosition(currentParent, stepById) : { x: 0, y: 0 };
  return {
    x: parentPosition.x + (node.position?.x || 0),
    y: parentPosition.y + (node.position?.y || 0),
  };
}

function getCanvasAwareStepBounds(
  step: FlowStep,
  stepById: Map<string, FlowStep>,
  canvasNodeById: Map<string, Node>,
) {
  const canvasNode = canvasNodeById.get(step.id);
  const position = canvasNode ? getNodeAbsolutePosition(canvasNode, step, stepById) : getAbsolutePosition(step, stepById);
  return getBoundsFromPosition(position, getMeasuredNodeSize(canvasNode, getStepSize(step)));
}

function isBoundsInsideGroupArea(
  nodeBounds: ReturnType<typeof getStepBounds>,
  groupBounds: ReturnType<typeof getStepBounds>,
  captureInset = GROUP_CAPTURE_INSET,
) {
  const center = {
    x: nodeBounds.x + nodeBounds.width / 2,
    y: nodeBounds.y + nodeBounds.height / 2,
  };
  return isPointInsideBounds(center, shrinkBounds(groupBounds, captureInset));
}

function collectGroupInteriorStepIds(
  steps: FlowStep[],
  groupId: string,
  options: { includeAttached?: boolean; threshold?: number; margin?: number; canvasNodes?: Node[] } = {},
) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const canvasNodeById = new Map((options.canvasNodes || []).map((node) => [node.id, node]));
  const group = stepById.get(groupId);
  const childIds = new Set<string>();
  if (!group || group.type !== 'group') return childIds;

  const groupBounds = expandBounds(getCanvasAwareStepBounds(group, stepById, canvasNodeById), options.margin || 0);
  const fallbackGroupBounds = expandBounds(getStepBounds(group, stepById), options.margin || 0);
  const captureInset = Math.max(0, Number(options.margin || 0) >= GROUP_CAPTURE_INSET ? 0 : GROUP_CAPTURE_INSET - Number(options.margin || 0));

  steps.forEach((step) => {
    if (step.id === groupId || step.type === 'group') return;
    if (step.parentId && !options.includeAttached) return;

    const nodeBounds = getCanvasAwareStepBounds(step, stepById, canvasNodeById);
    const fallbackNodeBounds = getStepBounds(step, stepById);
    if (
      isBoundsInsideGroupArea(nodeBounds, groupBounds, captureInset) ||
      isBoundsInsideGroupArea(fallbackNodeBounds, fallbackGroupBounds, captureInset)
    ) {
      childIds.add(step.id);
    }
  });

  return childIds;
}

function findTargetGroupForBounds(
  steps: FlowStep[],
  stepById: Map<string, FlowStep>,
  movedStepId: string,
  nodeBounds: ReturnType<typeof getStepBounds>,
) {
  const center = {
    x: nodeBounds.x + nodeBounds.width / 2,
    y: nodeBounds.y + nodeBounds.height / 2,
  };

  return steps
    .filter((step) => (
      step.type === 'group' &&
      step.id !== movedStepId &&
      !step.group?.collapsed &&
      !hasCollapsedAncestor(step, stepById)
    ))
    .map((step) => {
      const bounds = getStepBounds(step, stepById);
      const captureBounds = shrinkBounds(bounds, GROUP_CAPTURE_INSET);
      return {
        step,
        bounds,
        ratio: getIntersectionRatio(nodeBounds, bounds),
        centerInside: isPointInsideBounds(center, captureBounds),
      };
    })
    .filter((entry) => entry.centerInside)
    .sort((left, right) => {
      if (right.ratio !== left.ratio) return right.ratio - left.ratio;
      return left.bounds.width * left.bounds.height - right.bounds.width * right.bounds.height;
    })[0]?.step;
}

function absorbFreeNodesIntoGroup(
  steps: FlowStep[],
  groupId: string,
  options: { includeAttached?: boolean; threshold?: number; margin?: number; canvasNodes?: Node[] } = {},
) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const canvasNodeById = new Map((options.canvasNodes || []).map((node) => [node.id, node]));
  const group = stepById.get(groupId);
  if (!group || group.type !== 'group') return steps;

  const groupNode = canvasNodeById.get(groupId);
  const groupPosition = groupNode ? getNodeAbsolutePosition(groupNode, group, stepById) : getAbsolutePosition(group, stepById);
  const childIds = collectGroupInteriorStepIds(steps, groupId, options);
  let changed = false;

  const nextSteps = steps.map((step) => {
    if (!childIds.has(step.id) || hasAncestor(step, groupId, stepById)) return step;
    changed = true;
    const nodeBounds = getCanvasAwareStepBounds(step, stepById, canvasNodeById);
    return {
      ...step,
      parentId: groupId,
      position: getPositionInsideGroup(
        nodeBounds.x - groupPosition.x,
        nodeBounds.y - groupPosition.y,
      ),
    };
  });

  return changed ? nextSteps : steps;
}

function reconcileGroupChildrenForCollapse(
  steps: FlowStep[],
  groupId: string,
  options: { includeAttached?: boolean; threshold?: number; margin?: number; canvasNodes?: Node[] } = {},
) {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const canvasNodeById = new Map((options.canvasNodes || []).map((node) => [node.id, node]));
  const group = stepById.get(groupId);
  if (!group || group.type !== 'group') return { steps, childIds: [] as string[] };

  const groupBounds = getCanvasAwareStepBounds(group, stepById, canvasNodeById);
  const groupPosition = { x: groupBounds.x, y: groupBounds.y };
  const childIdSet = collectGroupInteriorStepIds(steps, groupId, options);
  let changed = false;

  const nextSteps = steps.map((step) => {
    if (step.id === groupId || step.type === 'group') return step;
    const isInside = childIdSet.has(step.id);
    const isCurrentlyInGroup = hasAncestor(step, groupId, stepById);

    if (isInside) {
      const nodeBounds = getCanvasAwareStepBounds(step, stepById, canvasNodeById);
      const nextPosition = getPositionInsideGroup(
        nodeBounds.x - groupPosition.x,
        nodeBounds.y - groupPosition.y,
      );
      if (
        step.parentId === groupId &&
        Math.abs((step.position?.x || 0) - nextPosition.x) < 0.5 &&
        Math.abs((step.position?.y || 0) - nextPosition.y) < 0.5
      ) {
        return step;
      }
      changed = true;
      return {
        ...step,
        parentId: groupId,
        position: nextPosition,
      };
    }

    if (!isCurrentlyInGroup) return step;
    changed = true;
    return {
      ...step,
      parentId: undefined,
      position: getAbsolutePosition(step, stepById),
    };
  });

  return {
    steps: changed ? nextSteps : steps,
    childIds: Array.from(childIdSet),
  };
}

function applyDraggedNodesToConfig(current: FlowConfig, draggedNodes: Node[]) {
  if (!draggedNodes.length) return current;

  const baseSteps = normalizeCanvasHierarchy(current.steps);
  const draggedNodeById = new Map(draggedNodes.map((node) => [node.id, node]));
  const draggedIds = new Set(draggedNodeById.keys());
  const initialStepById = new Map(baseSteps.map((step) => [step.id, step]));
  const movedGroupIds: string[] = [];

  let changed = false;
  let steps = baseSteps.map((step) => {
    const node = draggedNodeById.get(step.id);
    if (!node || step.type !== 'group') return step;

    changed = true;
    movedGroupIds.push(step.id);
    return {
      ...step,
      position: {
        x: node.position?.x || 0,
        y: node.position?.y || 0,
      },
    };
  });

  const nextStepById = new Map(steps.map((step) => [step.id, step]));

  steps = steps.map((step) => {
    const node = draggedNodeById.get(step.id);
    if (!node || step.type === 'group' || hasDraggedAncestor(step, initialStepById, draggedIds)) return step;

    const absolutePosition = getNodeAbsolutePosition(node, step, nextStepById);
    const nodeBounds = getBoundsFromPosition(absolutePosition, getStepSize(step));
    const targetGroup = findTargetGroupForBounds(steps, nextStepById, step.id, nodeBounds);
    const targetGroupPosition = targetGroup ? getAbsolutePosition(targetGroup, nextStepById) : { x: 0, y: 0 };
    const nextPosition = targetGroup
      ? getPositionInsideGroup(
          absolutePosition.x - targetGroupPosition.x,
          absolutePosition.y - targetGroupPosition.y,
        )
      : absolutePosition;

    changed = true;
    return {
      ...step,
      parentId: targetGroup?.id,
      position: nextPosition,
    };
  });

  movedGroupIds.forEach((groupId) => {
    const group = steps.find((step) => step.id === groupId && step.type === 'group');
    if (!group?.group?.collapsed) {
      steps = absorbFreeNodesIntoGroup(steps, groupId);
    }
  });

  return changed ? { ...current, steps: normalizeCanvasHierarchy(steps) } : { ...current, steps: baseSteps };
}

function mergeCanvasNodeSnapshots(currentNodes: Node[], updatedNodes: Node[]) {
  if (!updatedNodes.length) return currentNodes;
  const updatedNodeById = new Map(updatedNodes.map((node) => [node.id, node]));
  const seenIds = new Set<string>();
  const nextNodes = currentNodes.map((node) => {
    const updatedNode = updatedNodeById.get(node.id);
    if (!updatedNode) return node;
    seenIds.add(node.id);
    return {
      ...node,
      ...updatedNode,
      data: updatedNode.data || node.data,
      style: updatedNode.style || node.style,
    };
  });

  updatedNodes.forEach((node) => {
    if (!seenIds.has(node.id)) nextNodes.push(node);
  });

  return nextNodes;
}

function mergeReactNodesPreservingInternals(currentNodes: Node[], nextNodes: Node[]) {
  if (!currentNodes.length) return nextNodes;
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));

  return nextNodes.map((nextNode) => {
    const currentNode = currentById.get(nextNode.id);
    if (!currentNode) return nextNode;

    return {
      ...currentNode,
      ...nextNode,
      data: {
        ...(currentNode.data || {}),
        ...(nextNode.data || {}),
      },
      position: nextNode.position || currentNode.position,
      selected: nextNode.selected,
      style: nextNode.style,
      zIndex: nextNode.zIndex,
    };
  });
}

const AGENTIC_MANIFEST_TOOL_KEYS = ['skills', 'subagents', 'mcpServers'] as const;

function isAgenticToolCaller(step: FlowStep) {
  if (step.type !== 'component' || step.component?.type !== 'openaiGen') return false;
  const role = step.component.agentRole || 'simple';
  if (role !== 'orchestrator' && role !== 'subagent') return false;
  return (step.component.agentExecutionMode || 'auto_tools') !== 'flow';
}

function getManifestTargetStepId(ref: Record<string, unknown>) {
  const directId = String(ref.targetStepId || ref.stepId || ref.nodeId || '').trim();
  if (directId) return directId;
  const path = String(ref.path || '').trim();
  if (path.startsWith('canvas://')) return path.slice('canvas://'.length).split(/[?#]/)[0]?.trim() || '';
  return '';
}

function getAgenticManifestToolStepIds(config: FlowConfig) {
  const ids = new Set<string>();
  (config.steps || []).forEach((step) => {
    if (!isAgenticToolCaller(step)) return;
    const manifest = step.component?.agentManifest || {};
    let explicitTargetCount = 0;
    let manifestRefCount = 0;
    AGENTIC_MANIFEST_TOOL_KEYS.forEach((key) => {
      const refs = Array.isArray(manifest[key]) ? manifest[key] || [] : [];
      manifestRefCount += refs.length;
      refs.forEach((ref) => {
        const targetStepId = getManifestTargetStepId(ref as Record<string, unknown>);
        if (targetStepId && targetStepId !== step.id) {
          explicitTargetCount += 1;
          ids.add(targetStepId);
        }
      });
    });
    if (manifestRefCount === 0 && explicitTargetCount === 0 && step.component?.agentUseWorkspaceCatalog !== false) {
      (config.steps || []).forEach((candidate) => {
        if (candidate.id === step.id || candidate.type !== 'component') return;
        const isCanvasSubagent = candidate.component?.type === 'openaiGen' && candidate.component.agentRole === 'subagent';
        const isCanvasMcp = candidate.component?.type === 'mcp';
        if (isCanvasSubagent || isCanvasMcp) ids.add(candidate.id);
      });
    }
  });
  return ids;
}

function isAgenticManifestEdge(edge: Pick<FlowEdge, 'source' | 'target' | 'edgeRole'>, config: FlowConfig) {
  const toolStepIds = getAgenticManifestToolStepIds(config);
  return edge.edgeRole === 'manifest' || toolStepIds.has(edge.source) || toolStepIds.has(edge.target);
}

function toReactNodes(
  config: FlowConfig,
  actions?: {
    onUpdate: (stepId: string, patch: Partial<Pick<FlowStep, 'title' | 'instruction'>>) => void;
    onEdit: (stepId: string) => void;
    onInlineEdit: (stepId: string, field: 'title' | 'instruction' | null) => void;
    editingStepId?: string;
    editingField?: 'title' | 'instruction' | null;
    onDuplicate: (stepId: string) => void;
    onDelete: (stepId: string) => void;
    onResizeGroup: (stepId: string, size: { width: number; height: number }) => void;
    onToggleGroup: (stepId: string) => void;
    selectedStepIds?: string[];
  },
): Node[] {
  const steps = normalizeCanvasHierarchy(config.steps);
  const stepIds = new Set(steps.map((step) => step.id));
  const selectedStepIds = new Set(actions?.selectedStepIds || []);
  const visibleStepIds = getVisibleStepIds({ ...config, steps });
  const childrenCountByGroup = getChildrenCountByGroup(steps);
  const orderedSteps = [...steps].sort((left, right) => {
    if (left.type === 'group' && right.type !== 'group') return -1;
    if (left.type !== 'group' && right.type === 'group') return 1;
    return 0;
  });

  return orderedSteps.filter((step) => visibleStepIds.has(step.id)).map((step) => {
    const isGroup = step.type === 'group';
    const parentNode = step.parentId && stepIds.has(step.parentId) && visibleStepIds.has(step.parentId) ? step.parentId : undefined;
    const size = getStepSize(step);

    return {
      id: step.id,
      type: 'canvasStep',
      position: step.position,
      parentNode,
      selected: selectedStepIds.has(step.id),
      style: isGroup ? { width: size.width, height: size.height } : undefined,
      zIndex: isGroup ? (step.group?.collapsed ? 4 : 0) : parentNode ? 3 : 1,
      data: {
        step,
        isStart: config.startStepId === step.id,
        childrenCount: childrenCountByGroup.get(step.id) || 0,
        ...actions,
        editingField: actions?.editingStepId === step.id ? actions.editingField : null,
      },
    };
  });
}

type ReactEdgeActions = {
  onEdit?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
};

function toReactEdges(config: FlowConfig, actions: ReactEdgeActions = {}): Edge[] {
  const steps = normalizeCanvasHierarchy(config.steps);
  const normalizedConfig = { ...config, steps };
  const visibleStepIds = getVisibleStepIds(normalizedConfig);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const proxyByStepId = getCollapsedGroupProxyMap(normalizedConfig);

  return config.edges
    .map((edge) => {
      const source = getVisibleEndpointId(edge.source, stepById, visibleStepIds, proxyByStepId);
      const target = getVisibleEndpointId(edge.target, stepById, visibleStepIds, proxyByStepId);
      if (!source || !target || source === target) return null;
      const proxied = source !== edge.source || target !== edge.target;
      const manifestEdge = isAgenticManifestEdge(edge, normalizedConfig);
      const stroke = manifestEdge ? '#059669' : edge.condition ? '#8b5cf6' : '#94a3b8';

      return {
        id: edge.id,
        type: 'canvasFlowEdge',
        source,
        target,
        label: edge.label,
        markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: stroke },
        style: {
          stroke,
          strokeWidth: proxied ? 1.3 : 1.1,
          opacity: edge.condition ? 0.76 : 0.68,
          strokeDasharray: proxied ? '6 4' : undefined,
        },
        labelStyle: { fill: '#334155', fontWeight: 700, fontSize: 11 },
        data: {
          ...edge,
          edgeRole: manifestEdge ? 'manifest' : edge.edgeRole,
          source,
          target,
          originalSource: edge.source,
          originalTarget: edge.target,
          proxied,
          ...actions,
        },
      } as Edge;
    })
    .filter((edge): edge is Edge => Boolean(edge));
}

function getAssistantSelectedStepIds(config: FlowConfig, selectedNodeIds: string[], selectedStepId: string) {
  const existingIds = new Set(config.steps.map((step) => step.id));
  const sourceIds = selectedNodeIds.length ? selectedNodeIds : selectedStepId ? [selectedStepId] : [];
  return Array.from(new Set(sourceIds)).filter((id) => existingIds.has(id));
}

function createAssistantScopedConfig(config: FlowConfig, selectedStepIds: string[]): FlowConfig {
  const selectedSet = new Set(selectedStepIds);
  const steps = config.steps.filter((step) => selectedSet.has(step.id));
  const edges = config.edges.filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target));

  return {
    ...config,
    steps,
    edges,
    startStepId: selectedSet.has(config.startStepId) ? config.startStepId : steps[0]?.id || '',
  };
}

function mergeAssistantSelectionResult(current: FlowConfig, generated: FlowConfig, selectedStepIds: string[]): FlowConfig {
  const selectedSet = new Set(selectedStepIds);
  const generatedStepById = new Map(generated.steps.map((step) => [step.id, step]));
  const internalGeneratedEdges = generated.edges.filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target));

  return {
    ...current,
    steps: current.steps.map((step) => {
      if (!selectedSet.has(step.id)) return step;
      const generatedStep = generatedStepById.get(step.id);
      if (!generatedStep) return step;
      return {
        ...generatedStep,
        id: step.id,
        position: step.position,
        parentId: step.parentId,
        group: step.type === 'group' ? generatedStep.group || step.group : generatedStep.group,
      };
    }),
    edges: [
      ...current.edges.filter((edge) => !(selectedSet.has(edge.source) && selectedSet.has(edge.target))),
      ...internalGeneratedEdges,
    ],
    startStepId: current.startStepId,
  };
}

type VariableLibraryItem = {
  group: 'native' | 'response';
  label: string;
  value: string;
  description: string;
  source?: string;
};

const NATIVE_VARIABLE_LIBRARY_ITEMS: VariableLibraryItem[] = [
  {
    group: 'native',
    label: 'Entrada atual',
    value: '{{context.input}}',
    description: 'Texto ou payload atual recebido pelo componente.',
  },
  {
    group: 'native',
    label: 'Ultimo input do usuario',
    value: '{{context.slots.userInput}}',
    description: 'Ultima mensagem de usuario salva pelo runner.',
  },
  {
    group: 'native',
    label: 'Input de tool',
    value: '{{context.slots.autoToolInput}}',
    description: 'Entrada delegada pelo agente pai para subagents/MCP chamados como tool.',
  },
  {
    group: 'native',
    label: 'Tarefa da tool',
    value: '{{context.slots.autoToolTask}}',
    description: 'Tarefa enviada pelo agente pai quando houver delegacao agentica.',
  },
  {
    group: 'native',
    label: 'Input do agente pai',
    value: '{{context.slots.parentAgentInput}}',
    description: 'Entrada original vista pelo agente que chamou a tool.',
  },
  {
    group: 'native',
    label: 'Todos os slots',
    value: '{{context.slots}}',
    description: 'Objeto completo de memoria operacional da conversa.',
  },
  {
    group: 'native',
    label: 'ID da conversa',
    value: '{{context.conversationId}}',
    description: 'Identificador da conversa atual.',
  },
  {
    group: 'native',
    label: 'ID do agente',
    value: '{{context.agentId}}',
    description: 'Agente em execucao.',
  },
  {
    group: 'native',
    label: 'ID do fluxo',
    value: '{{context.flowId}}',
    description: 'Fluxo em execucao quando salvo/versionado.',
  },
  {
    group: 'native',
    label: 'No atual',
    value: '{{context.currentStepId}}',
    description: 'ID do no que esta sendo executado.',
  },
  {
    group: 'native',
    label: 'Agora',
    value: '{{context.now}}',
    description: 'Data/hora atual disponibilizada no contexto.',
  },
  {
    group: 'native',
    label: 'Webhook recebido',
    value: '{{context.slots.webhookEvent}}',
    description: 'Payload bruto de webhook quando o fluxo for iniciado por webhook.',
  },
];

function getStepResponseSlotName(step: FlowStep) {
  return String(step.responseName || step.api?.responseName || step.component?.responseName || '').trim();
}

function buildStepVariableExamples(step: FlowStep, slot: string): VariableLibraryItem[] {
  const source = step.title || step.id;
  const base = {
    group: 'response' as const,
    source,
  };
  const items: VariableLibraryItem[] = [{
    ...base,
    label: slot,
    value: `{{context.slots.${slot}}}`,
    description: `Valor salvo pelo responseName do no ${source}.`,
  }];
  const componentType = step.component?.type || step.type;

  if (step.type === 'input' || step.type === 'condition') {
    return items;
  }
  if (step.type === 'api' || componentType === 'mcp') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.latest.data`,
        value: `{{context.slots.${slot}.latest.data}}`,
        description: 'Dados da ultima resposta HTTP/API.',
      },
      {
        ...base,
        label: `${slot}.output`,
        value: `{{context.slots.${slot}.output}}`,
        description: 'Saida normalizada para uso nos proximos nos.',
      },
      {
        ...base,
        label: `${slot}.results`,
        value: `{{context.slots.${slot}.results}}`,
        description: 'Lista de respostas quando houver multiplas chamadas.',
      },
      {
        ...base,
        label: `${slot}.resultsById`,
        value: `{{context.slots.${slot}.resultsById}}`,
        description: 'Mapa de respostas por ID de request quando configurado.',
      },
    ];
  }
  if (componentType === 'files') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.text`,
        value: `{{context.slots.${slot}.text}}`,
        description: 'Texto extraido dos arquivos.',
      },
      {
        ...base,
        label: `${slot}.documents`,
        value: `{{context.slots.${slot}.documents}}`,
        description: 'Documentos extraidos para RAG/LLM.',
      },
    ];
  }
  if (componentType === 'openaiGen' || componentType === 'azureOpenAI') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.text`,
        value: `{{context.slots.${slot}.text}}`,
        description: 'Texto gerado pelo agente/LLM.',
      },
      {
        ...base,
        label: `${slot}.autoTools`,
        value: `{{context.slots.${slot}.autoTools}}`,
        description: 'Ferramentas chamadas pelo agente quando houver auto tools.',
      },
    ];
  }
  if (componentType === 'agentPlan') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.plan`,
        value: `{{context.slots.${slot}.plan}}`,
        description: 'Plano produzido pelo Agent Plan.',
      },
    ];
  }
  if (componentType === 'approval') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.decision`,
        value: `{{context.slots.${slot}.decision}}`,
        description: 'Decisao de aprovacao/reprovacao.',
      },
    ];
  }
  if (componentType === 'loop') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.iteration`,
        value: `{{context.slots.${slot}.iteration}}`,
        description: 'Iteracao atual do loop, comecando em 1.',
      },
      {
        ...base,
        label: `${slot}.shouldContinue`,
        value: `{{context.slots.${slot}.shouldContinue}}`,
        description: 'Booleano usado para saber se o loop continua.',
      },
    ];
  }
  if (componentType === 'flowRouter') {
    return [
      ...items,
      {
        ...base,
        label: `${slot}.targetFlowId`,
        value: `{{context.slots.${slot}.targetFlowId}}`,
        description: 'Fluxo escolhido pelo roteador.',
      },
      {
        ...base,
        label: `${slot}.reason`,
        value: `{{context.slots.${slot}.reason}}`,
        description: 'Motivo da escolha do roteador.',
      },
    ];
  }
  return items;
}

function buildVariableLibraryItems(config: FlowConfig) {
  const responseItems: VariableLibraryItem[] = [];
  const seenValues = new Set<string>();
  const pushUnique = (item: VariableLibraryItem) => {
    if (seenValues.has(item.value)) return;
    seenValues.add(item.value);
    responseItems.push(item);
  };

  (config.steps || []).forEach((step) => {
    const slot = getStepResponseSlotName(step);
    if (slot) buildStepVariableExamples(step, slot).forEach(pushUnique);
    const reasonSlot = String(step.inputValidationReasonResponseName || step.conditionReasonResponseName || '').trim();
    if (reasonSlot) {
      pushUnique({
        group: 'response',
        label: reasonSlot,
        value: `{{context.slots.${reasonSlot}}}`,
        description: `Motivo/explicacao salvo pelo no ${step.title || step.id}.`,
        source: step.title || step.id,
      });
    }
  });

  return {
    native: NATIVE_VARIABLE_LIBRARY_ITEMS,
    response: responseItems,
  };
}

export default function App() {
  const [config, setConfig] = useState<FlowConfig>(() => createDefaultFlow());
  const [flowName, setFlowName] = useState('Fluxo IA Gen');
  const [agentId, setAgentId] = useState('default-agent');
  const [savedAgentId, setSavedAgentId] = useState('');
  const [savedFlowId, setSavedFlowId] = useState('');
  const [flowVersions, setFlowVersions] = useState<CanvasFlowVersionRecord[]>([]);
  const [flowActiveVersion, setFlowActiveVersion] = useState<number | undefined>(undefined);
  const [flowLatestVersion, setFlowLatestVersion] = useState(0);
  const [flowVersionsLoading, setFlowVersionsLoading] = useState(false);
  const [flows, setFlows] = useState<CanvasFlowRecord[]>([]);
  const [agents, setAgents] = useState<CanvasFlowAgentRecord[]>([]);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentOrderSaving, setAgentOrderSaving] = useState(false);
  const [agentsError, setAgentsError] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [agentCreateName, setAgentCreateName] = useState('');
  const [agentEditingName, setAgentEditingName] = useState('');
  const [agentEditingDraft, setAgentEditingDraft] = useState('');
  const [draggingAgentName, setDraggingAgentName] = useState('');
  const [dragOverAgentName, setDragOverAgentName] = useState('');
  const [agentDeleteTarget, setAgentDeleteTarget] = useState<CanvasFlowAgentRecord | null>(null);
  const [agentDeleteConfirm, setAgentDeleteConfirm] = useState('');
  const [agentStudioOpen, setAgentStudioOpen] = useState(false);
  const [agentStudioSaving, setAgentStudioSaving] = useState(false);
  const [agentStudioWorkspaceBusy, setAgentStudioWorkspaceBusy] = useState(false);
  const [agentStudioError, setAgentStudioError] = useState('');
  const [agentStudioMessage, setAgentStudioMessage] = useState('');
  const [nodes, setNodes] = useState<Node[]>(() => toReactNodes(config));
  const nodesRef = useRef<Node[]>(nodes);
  const [edges, setEdges] = useState<Edge[]>(() => toReactEdges(config));
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('');
  const [edgeActionId, setEdgeActionId] = useState<string>('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [inlineEditing, setInlineEditing] = useState<{ stepId: string; field: 'title' | 'instruction' } | null>(null);
  const [componentPaletteOpen, setComponentPaletteOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [variableLibraryOpen, setVariableLibraryOpen] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState('');
  const [componentSearch, setComponentSearch] = useState('');
  const [flowAssistantOpen, setFlowAssistantOpen] = useState(false);
  const [flowAssistantScope, setFlowAssistantScope] = useState<FlowAssistantScope>('flow');
  const [flowAssistantSource, setFlowAssistantSource] = useState<FlowAssistantSource>('brief');
  const [flowAssistantSelectedStepIds, setFlowAssistantSelectedStepIds] = useState<string[]>([]);
  const [flowAssistantNodeSearch, setFlowAssistantNodeSearch] = useState('');
  const [flowAssistantPrompt, setFlowAssistantPrompt] = useState(FLOW_ASSISTANT_EXAMPLE);
  const [flowAssistantLoading, setFlowAssistantLoading] = useState(false);
  const [flowAssistantError, setFlowAssistantError] = useState('');
  const [flowAssistantResult, setFlowAssistantResult] = useState<FlowAssistantResult | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [flowImportExportOpen, setFlowImportExportOpen] = useState(false);
  const [flowImportText, setFlowImportText] = useState('');
  const [flowImportError, setFlowImportError] = useState('');
  const [flowImportMessage, setFlowImportMessage] = useState('');
  const flowImportFileRef = useRef<HTMLInputElement | null>(null);
  const flowVersionsQuickRef = useRef<HTMLDivElement | null>(null);
  const [apiDocsOpen, setApiDocsOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [providerConfigOpen, setProviderConfigOpen] = useState(false);
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
  const [flowOrderOpen, setFlowOrderOpen] = useState(false);
  const [flowVersionsQuickOpen, setFlowVersionsQuickOpen] = useState(false);
  const [flowVersionsOpen, setFlowVersionsOpen] = useState(false);
  const [flowVersionTab, setFlowVersionTab] = useState<'agent' | 'flow' | 'deploy'>('agent');
  const [flowVersionManageOpen, setFlowVersionManageOpen] = useState(true);
  const [flowVersionNotes, setFlowVersionNotes] = useState('');
  const [flowVersionError, setFlowVersionError] = useState('');
  const [flowVersionMessage, setFlowVersionMessage] = useState('');
  const [flowVersionSaving, setFlowVersionSaving] = useState(false);
  const [versionRenameTarget, setVersionRenameTarget] = useState<VersionRenameTarget>(null);
  const [versionRenameDraft, setVersionRenameDraft] = useState('');
  const [versionRenameError, setVersionRenameError] = useState('');
  const [versionRenameSaving, setVersionRenameSaving] = useState(false);
  const [versionOverwriteTarget, setVersionOverwriteTarget] = useState<VersionOverwriteTarget>(null);
  const [versionOverwriteSource, setVersionOverwriteSource] = useState<VersionOverwriteSource>('draft');
  const [versionOverwriteSourceVersion, setVersionOverwriteSourceVersion] = useState('');
  const [versionOverwriteError, setVersionOverwriteError] = useState('');
  const [agentReleases, setAgentReleases] = useState<CanvasFlowAgentReleaseRecord[]>([]);
  const [agentActiveRelease, setAgentActiveRelease] = useState<number | undefined>(undefined);
  const [agentLatestRelease, setAgentLatestRelease] = useState(0);
  const [agentReleaseNotes, setAgentReleaseNotes] = useState('');
  const [agentReleaseLoading, setAgentReleaseLoading] = useState(false);
  const [agentTabAgentRelease, setAgentTabAgentRelease] = useState('');
  const [agentTabReleasePreviewKey, setAgentTabReleasePreviewKey] = useState('');
  const [agentReleaseFlowVersionStates, setAgentReleaseFlowVersionStates] = useState<Record<string, Pick<CanvasFlowRecord, 'activeVersion' | 'versions'>>>({});
  const [flowVersionSwitchLoading, setFlowVersionSwitchLoading] = useState(false);
  const [agentTabFlowVersion, setAgentTabFlowVersion] = useState('');
  const [editorFlowVersion, setEditorFlowVersion] = useState<number | undefined>(undefined);
  const [flowOrderDraft, setFlowOrderDraft] = useState<CanvasFlowRecord[]>([]);
  const [flowOrderSaving, setFlowOrderSaving] = useState(false);
  const [flowOrderError, setFlowOrderError] = useState('');
  const [flowSearch, setFlowSearch] = useState('');
  const [flowCreateName, setFlowCreateName] = useState('');
  const [flowEditingId, setFlowEditingId] = useState('');
  const [flowEditingDraft, setFlowEditingDraft] = useState('');
  const [draggingFlowId, setDraggingFlowId] = useState('');
  const [dragOverFlowId, setDragOverFlowId] = useState('');
  const [tagDashboardOpen, setTagDashboardOpen] = useState(false);
  const [tagDashboardLoading, setTagDashboardLoading] = useState(false);
  const [tagDashboardError, setTagDashboardError] = useState('');
  const [tagDashboard, setTagDashboard] = useState<Record<string, any> | null>(null);
  const [tagDashboardFilters, setTagDashboardFilters] = useState({
    dateFrom: '',
    dateTo: '',
    flowId: '',
    conversationId: '',
    tags: '',
    limit: 100,
  });
  const [tagDashboardTab, setTagDashboardTab] = useState<TagDashboardTab>('dashboard');
  const [tagDashboardView, setTagDashboardView] = useState<TagDashboardView>('table');
  const [tagDashboardHistoryPage, setTagDashboardHistoryPage] = useState(1);
  const [tagDashboardHistoryLimit, setTagDashboardHistoryLimit] = useState(50);
  const [agentOpsOpen, setAgentOpsOpen] = useState(false);
  const [agentOpsLoading, setAgentOpsLoading] = useState(false);
  const [agentOpsError, setAgentOpsError] = useState('');
  const [agentOpsDashboard, setAgentOpsDashboard] = useState<Record<string, any> | null>(null);
  const [agentOpsFilters, setAgentOpsFilters] = useState({
    dateFrom: '',
    dateTo: '',
    flowId: '',
    conversationId: '',
    historyLimit: 80,
    traceLimit: 600,
  });
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState('');
  const [simulationResult, setSimulationResult] = useState<Record<string, any> | null>(null);
  const [simulationResultsOpen, setSimulationResultsOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState<'conversation' | 'isolated'>('conversation');
  const [simulationSuiteTab, setSimulationSuiteTab] = useState<SimulationSuiteTab>('saved');
  const [simulationEditorMode, setSimulationEditorMode] = useState<SimulationEditorMode>('visual');
  const [simulationCaseDrafts, setSimulationCaseDrafts] = useState<SimulationCaseDraft[]>(() => getDefaultSimulationCaseDrafts());
  const [simulationCasesText, setSimulationCasesText] = useState(() => simulationDraftsToJson(getDefaultSimulationCaseDrafts()));
  const [simulationSelectedRunSuiteIds, setSimulationSelectedRunSuiteIds] = useState<string[]>([]);
  const [simulationDraggingSuiteId, setSimulationDraggingSuiteId] = useState('');
  const [simulationSelectedSuiteId, setSimulationSelectedSuiteId] = useState('');
  const [simulationSuiteName, setSimulationSuiteName] = useState('Suite principal');
  const [simulationSuiteDescription, setSimulationSuiteDescription] = useState('');
  const [simulationSaving, setSimulationSaving] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState('');
  const [localSimulationSuites, setLocalSimulationSuites] = useState<FlowSimulationSuite[]>([]);
  const [providerWebWidget, setProviderWebWidget] = useState<WebWidgetConfig | null>(null);
  const [providerWebWidgetConfigured, setProviderWebWidgetConfigured] = useState(false);
  const [flowConfigOpen, setFlowConfigOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const [flowListError, setFlowListError] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testMessages, setTestMessages] = useState<TestMessage[]>([
    { role: 'system', text: 'Clique em Reiniciar para testar com a IA real, incluindo chamadas httpBatch.' },
  ]);
  const [testRuntimeMode, setTestRuntimeMode] = useState<TestRuntimeMode>('draft');
  const [testAgentRelease, setTestAgentRelease] = useState('');
  const [testFlowVersion, setTestFlowVersion] = useState('');
  const [openDebugMessages, setOpenDebugMessages] = useState<Record<string, boolean>>({});
  const [debugJsonModal, setDebugJsonModal] = useState<{ title: string; payload: unknown } | null>(null);
  const [testSlots, setTestSlots] = useState<Record<string, unknown>>({});
  const [testTrace, setTestTrace] = useState<unknown[]>([]);
  const [testTracePage, setTestTracePage] = useState<Record<string, unknown> | null>(null);
  const [testGraphRuntime, setTestGraphRuntime] = useState<LangGraphRuntimeSummary | null>(null);
  const [testConversationId, setTestConversationId] = useState('');
  const [testCurrentStepId, setTestCurrentStepId] = useState('');
  const [testActiveFlowId, setTestActiveFlowId] = useState('');
  const flowTemplates = useMemo(() => getFlowTemplates(), []);

  const selectedStep = useMemo(
    () => config.steps.find((step) => step.id === selectedStepId),
    [config.steps, selectedStepId],
  );
  const largeCanvasMode = nodes.length > LARGE_CANVAS_NODE_THRESHOLD || edges.length > LARGE_CANVAS_EDGE_THRESHOLD;
  const selectedEdge = useMemo(
    () => config.edges.find((edge) => edge.id === selectedEdgeId),
    [config.edges, selectedEdgeId],
  );
  const actionEdge = useMemo(
    () => config.edges.find((edge) => edge.id === edgeActionId),
    [config.edges, edgeActionId],
  );
  const canvasAssistantSelectedStepIds = useMemo(
    () => getAssistantSelectedStepIds(config, selectedNodeIds, selectedStepId),
    [config, selectedNodeIds, selectedStepId],
  );
  const assistantSelectedStepIds = useMemo(() => {
    const existingIds = new Set(config.steps.map((step) => step.id));
    const sourceIds = flowAssistantOpen ? flowAssistantSelectedStepIds : canvasAssistantSelectedStepIds;
    return Array.from(new Set(sourceIds)).filter((id) => existingIds.has(id));
  }, [canvasAssistantSelectedStepIds, config.steps, flowAssistantOpen, flowAssistantSelectedStepIds]);
  const assistantSelectedSteps = useMemo(
    () => config.steps.filter((step) => assistantSelectedStepIds.includes(step.id)),
    [assistantSelectedStepIds, config.steps],
  );
  const filteredAssistantSteps = useMemo(() => {
    const query = flowAssistantNodeSearch.trim().toLowerCase();
    if (!query) return config.steps;
    return config.steps.filter((step) => {
      const component = step.component || ({} as NonNullable<FlowStep['component']>);
      const rich = step.richMessage || ({} as NonNullable<FlowStep['richMessage']>);
      const haystack = [
        step.id,
        step.title,
        step.type,
        step.instruction,
        step.responseName,
        step.condition,
        component.type,
        component.responseName,
        component.webhookId,
        component.collectionName,
        rich.text,
        rich.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [config.steps, flowAssistantNodeSearch]);
  const variableLibraryItems = useMemo(() => buildVariableLibraryItems(config), [config]);
  const normalizedAgentId = agentId.trim() || 'default-agent';
  const agentChangedOnSavedFlow = Boolean(
    savedFlowId
    && savedAgentId
    && normalizedAgentId !== savedAgentId.trim(),
  );
  const simulationSuitesStorageKey = buildSimulationSuitesStorageKey(
    normalizedAgentId,
    savedFlowId,
    flowName || config.responseName || config.title,
  );
  const selectedAgentExists = useMemo(
    () => agents.some((agent) => (
      getAgentRecordId(agent) === normalizedAgentId
      || getAgentRecordName(agent) === normalizedAgentId
    )),
    [agents, normalizedAgentId],
  );
  const missingAgentSelection = normalizedAgentId === 'default-agent' && !selectedAgentExists;
  const virtualDefaultAgent = missingAgentSelection && !savedFlowId;
  const editorBlockedByMissingAgent = missingAgentSelection;
  const selectedAgentRecord = useMemo(
    () => agents.find((agent) => getAgentRecordId(agent) === normalizedAgentId)
      || agents.find((agent) => getAgentRecordName(agent) === normalizedAgentId),
    [agents, normalizedAgentId],
  );
  const selectedAgentStableId = getAgentRecordId(selectedAgentRecord || { agentId: normalizedAgentId, name: normalizedAgentId });
  const agentDisplayName = missingAgentSelection ? 'Nenhum agente' : getAgentRecordName(selectedAgentRecord || { agentId: normalizedAgentId, name: normalizedAgentId });
  const currentAgentProfileConfig = useMemo(
    () => getAgentProfileConfig(selectedAgentRecord || { agentId: normalizedAgentId, name: normalizedAgentId }, config),
    [selectedAgentRecord, normalizedAgentId, config],
  );
  const visibleAgents = useMemo(() => {
    const byId = new Map<string, CanvasFlowAgentRecord>();
    agents.forEach((agent) => byId.set(getAgentRecordId(agent), agent));
    if (savedFlowId && !byId.has(normalizedAgentId)) {
      byId.set(normalizedAgentId, { agentId: normalizedAgentId, name: normalizedAgentId, flowCount: flows.length });
    }
    return Array.from(byId.values());
  }, [agents, flows.length, normalizedAgentId, savedFlowId]);
  useEffect(() => {
    setLocalSimulationSuites(readSimulationSuitesFromStorage(simulationSuitesStorageKey));
  }, [simulationSuitesStorageKey]);
  useEffect(() => {
    let cancelled = false;
    const loadProviderWebWidget = async () => {
      try {
        const result = await canvasApi.getProviderConfig({ agentId: selectedAgentStableId });
        if (cancelled) return;
        const status = result.providerStatus?.webWidget;
        setProviderWebWidgetConfigured(Boolean(status?.configured));
        setProviderWebWidget(result.settings.webWidget ? createWebWidgetConfig(result.settings.webWidget) : null);
      } catch {
        if (!cancelled) {
          setProviderWebWidgetConfigured(false);
          setProviderWebWidget(null);
        }
      }
    };
    void loadProviderWebWidget();
    window.addEventListener('canvas-flow-provider-config-updated', loadProviderWebWidget);
    return () => {
      cancelled = true;
      window.removeEventListener('canvas-flow-provider-config-updated', loadProviderWebWidget);
    };
  }, [selectedAgentStableId]);
  const filteredAgents = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    return visibleAgents.filter((agent) => {
      if (!query) return true;
      return `${getAgentRecordName(agent)} ${getAgentRecordId(agent)}`.toLowerCase().includes(query);
    });
  }, [agentSearch, visibleAgents]);
  const filteredFlowOrderDraft = useMemo(() => {
    const query = flowSearch.trim().toLowerCase();
    return flowOrderDraft
      .map((flow, index) => ({ flow, index }))
      .filter(({ flow }) => {
        if (!query) return true;
        return `${flow.name} ${flow.config?.title || ''} ${flow.config?.responseName || ''}`
          .toLowerCase()
          .includes(query);
      });
  }, [flowOrderDraft, flowSearch]);
  const inspectorOpen = flowConfigOpen || Boolean(selectedStep || selectedEdge);
  const inspectorTitle = selectedStep
    ? selectedStep.title || 'Editar nóde'
    : selectedEdge
      ? 'Editar ligação'
      : 'Config Padrão';
  useEffect(() => {
    if (!flowAssistantOpen) return;
    const existingIds = new Set(config.steps.map((step) => step.id));
    setFlowAssistantSelectedStepIds((current) => {
      const next = current.filter((id) => existingIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [config.steps, flowAssistantOpen]);

  const filteredComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    if (!query) return COMPONENT_PALETTE;
    return COMPONENT_PALETTE.filter((item) => (
      `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)
    ));
  }, [componentSearch]);
  const channel = config.channel || 'webWidget';
  const webWidget = useMemo(
    () => createWebWidgetConfig(providerWebWidgetConfigured && providerWebWidget ? providerWebWidget : config.webWidget),
    [config.webWidget, providerWebWidget, providerWebWidgetConfigured],
  );
  const whatsapp = useMemo(() => createWhatsappConfig(config.whatsapp), [config.whatsapp]);
  const apiExampleAgentId = virtualDefaultAgent ? '<AGENTE_ID>' : selectedAgentStableId;
  const flowExportPayload = useMemo(
    () => createFlowExportPayload({
      config,
      flowId: savedFlowId,
      flowName,
      agentId: virtualDefaultAgent ? '' : selectedAgentStableId,
    }),
    [config, flowName, savedFlowId, selectedAgentStableId, virtualDefaultAgent],
  );
  const flowExportJson = useMemo(() => JSON.stringify(flowExportPayload, null, 2), [flowExportPayload]);
  const whatsappWebhookUrl = config.isMainFlow
    ? `${CANVAS_FLOW_API_URL}/api/canvas-flow/webhook/whatsapp-main/${apiExampleAgentId}`
    : `${CANVAS_FLOW_API_URL}/api/canvas-flow/webhook/whatsapp/${savedFlowId || '<FLOW_ID_SALVO>'}`;
  const apiExamples = useMemo(
    () =>
      createApiExamples({
        apiUrl: CANVAS_FLOW_API_URL,
        flowId: savedFlowId || '<FLOW_ID_SALVO>',
        flowName,
        flowResponseName: config.responseName,
        agentId: apiExampleAgentId,
        channel,
        webWidget,
        whatsapp,
        whatsappWebhookUrl,
        apiTokenConfigured: hasCanvasFlowAuthToken(),
      }),
    [apiExampleAgentId, channel, config.responseName, flowName, savedFlowId, webWidget, whatsapp, whatsappWebhookUrl],
  );
  const savedSimulationSuites = useMemo(
    () => mergeSimulationSuites(normalizeSimulationSuites(config.simulationSuites), localSimulationSuites),
    [config.simulationSuites, localSimulationSuites],
  );
  const selectedSimulationRunSuites = useMemo(
    () => simulationSelectedRunSuiteIds
      .map((suiteId) => savedSimulationSuites.find((suite) => suite.id === suiteId))
      .filter((suite): suite is FlowSimulationSuite => Boolean(suite)),
    [savedSimulationSuites, simulationSelectedRunSuiteIds],
  );
  const selectedSimulationRunCaseCount = selectedSimulationRunSuites.reduce((total, suite) => total + suite.cases.length, 0);
  useEffect(() => {
    setSimulationSelectedRunSuiteIds((current) => {
      const availableIds = new Set(savedSimulationSuites.map((suite) => suite.id));
      const filtered = current.filter((suiteId) => availableIds.has(suiteId));
      if (filtered.length) return filtered;
      return savedSimulationSuites.map((suite) => suite.id);
    });
  }, [savedSimulationSuites]);
  const sortedFlowVersions = useMemo(() => sortFlowVersions(flowVersions), [flowVersions]);
  const sortedAgentReleases = useMemo(() => sortAgentReleases(agentReleases), [agentReleases]);
  const nextFlowVersion = Math.max(flowLatestVersion || 0, ...flowVersions.map((version) => Number(version.version || 0))) + 1;
  const nextAgentRelease = Math.max(agentLatestRelease || 0, ...agentReleases.map((release) => Number(release.release || 0))) + 1;
  const selectedAgentTabReleaseRecord = sortedAgentReleases.find((release) => String(release.release) === agentTabAgentRelease);
  const selectedAgentTabReleaseFlows = useMemo(
    () => getAgentReleaseSnapshotOptions(selectedAgentTabReleaseRecord, flows),
    [flows, selectedAgentTabReleaseRecord],
  );
  const activeAgentReleaseRecord = sortedAgentReleases.find((release) => Number(release.release) === Number(agentActiveRelease));
  const productionFlowVersion = savedFlowId
    ? Number(activeAgentReleaseRecord?.versions?.[savedFlowId] || flowActiveVersion || 0)
    : 0;
  const selectedAgentTabReleaseFlowVersions = useMemo(
    () => getAgentReleaseFlowVersionOptions(selectedAgentTabReleaseRecord, flows, {
      ...agentReleaseFlowVersionStates,
      ...(savedFlowId ? {
        [savedFlowId]: {
          activeVersion: flowActiveVersion,
          versions: sortedFlowVersions,
        },
      } : {}),
    }),
    [agentReleaseFlowVersionStates, flowActiveVersion, flows, savedFlowId, selectedAgentTabReleaseRecord, sortedFlowVersions],
  );
  const selectedAgentTabFlowVersionRecord = sortedFlowVersions.find((version) => String(version.version) === agentTabFlowVersion);
  const editorFlowVersionRecord = editorFlowVersion
    ? sortedFlowVersions.find((version) => Number(version.version) === Number(editorFlowVersion))
    : undefined;
  const flowVersionsPanelOpen = flowVersionsQuickOpen || flowVersionsOpen;
  const primarySaveTargetVersionRecord = editorFlowVersionRecord || (savedFlowId ? pickPreferredFlowVersion(sortedFlowVersions, productionFlowVersion || flowActiveVersion) : undefined);
  const savePublishesFlowVersion = Boolean(savedFlowId && primarySaveTargetVersionRecord);
  const primarySaveTargetVersionName = String(primarySaveTargetVersionRecord?.name || '').trim();
  const primarySaveTargetVersionLabel = primarySaveTargetVersionRecord
    ? `v${primarySaveTargetVersionRecord.version}${primarySaveTargetVersionName ? ` · ${primarySaveTargetVersionName}` : ''}`
    : '';
  const qaAgentRelease = agentLatestRelease || agentActiveRelease;
  const selectedTestAgentRelease = Number(testAgentRelease) || 0;
  const selectedTestFlowVersion = Number(testFlowVersion) || 0;
  const overwriteVersionOptions = versionOverwriteTarget?.kind === 'agent'
    ? sortedAgentReleases.filter((release) => Number(release.release) !== Number(versionOverwriteTarget.version))
    : sortedFlowVersions.filter((version) => Number(version.version) !== Number(versionOverwriteTarget?.version));
  const firstOverwriteSourceVersion = versionOverwriteTarget?.kind === 'agent'
    ? String((overwriteVersionOptions[0] as CanvasFlowAgentReleaseRecord | undefined)?.release || '')
    : String((overwriteVersionOptions[0] as CanvasFlowVersionRecord | undefined)?.version || '');
  const effectiveOverwriteSourceVersion = versionOverwriteSourceVersion || firstOverwriteSourceVersion;
  const overwriteSourceNumber = Number(effectiveOverwriteSourceVersion) || 0;
  const overwriteNeedsSourceVersion = Boolean(versionOverwriteTarget && versionOverwriteSource === 'version' && !overwriteSourceNumber);
  const testNeedsVersionSelection =
    (testRuntimeMode === 'agentVersion' && !selectedTestAgentRelease)
    || (testRuntimeMode === 'flowVersion' && !selectedTestFlowVersion)
    || (testRuntimeMode !== 'draft' && !savedFlowId);
  const testTraceConditionEvents = useMemo(() => (
    testTrace.filter((item) => (
      item
      && typeof item === 'object'
      && ['edgeConditionJs', 'edgeConditionLlm'].includes(String((item as Record<string, unknown>).type || ''))
    ))
  ), [testTrace]);
  const testTraceTotal = Number(testTracePage?.total || testTrace.length || 0);
  const testTraceDropped = Number(testTracePage?.dropped || 0);
  const testTraceReturned = Number(testTracePage?.returned || testTrace.length || 0);
  const testTraceHasMore = Boolean(testTracePage?.hasMore);
  const hasTestTrace = testTrace.length > 0 || testTraceTotal > 0;
  const testTraceSummaryText = testTraceConditionEvents.length
    ? `${testTraceConditionEvents.length} condição(ões) de ligação avaliadas`
    : `${testTraceReturned} evento(s) de trace carregado(s)`;
  const versionDefaultPayload = useMemo(() => JSON.stringify({
    flowId: savedFlowId || '<FLOW_ID_SALVO>',
    agentId: apiExampleAgentId,
    channel,
    conversationId: `${channel}-cliente-123`,
    text: 'oi',
    slots: {},
  }, null, 2), [apiExampleAgentId, channel, savedFlowId]);
  const versionQaPayload = useMemo(() => JSON.stringify({
    flowId: savedFlowId || '<FLOW_ID_SALVO>',
    agentId: apiExampleAgentId,
    channel,
    agentRelease: qaAgentRelease || '<PACOTE_DE_HOMOLOGACAO>',
    conversationId: `${channel}-homolog-123`,
    text: 'Teste de homologação',
    slots: {},
  }, null, 2), [apiExampleAgentId, channel, qaAgentRelease, savedFlowId]);
  const closeInspector = useCallback(() => {
    setFlowConfigOpen(false);
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setSelectedNodeIds([]);
    setVariableLibraryOpen(false);
  }, []);

  const updateConfig = (patch: Partial<FlowConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const applyAgentProfileToConfig = (profile: Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'>) => {
    setConfig((current) => ({
      ...current,
      model: profile.model || current.model,
      llmProvider: profile.llmProvider || current.llmProvider || 'openai',
      agentSpec: {
        ...(current.agentSpec || {}),
        ...(profile.agentSpec || {}),
        blockedTerms: profile.agentSpec?.blockedTerms || current.agentSpec?.blockedTerms || [],
        rules: profile.agentSpec?.rules || current.agentSpec?.rules || [],
        skills: profile.agentSpec?.skills || current.agentSpec?.skills || [],
        subagents: profile.agentSpec?.subagents || current.agentSpec?.subagents || [],
        mcpServers: profile.agentSpec?.mcpServers || current.agentSpec?.mcpServers || [],
      },
    }));
  };

  const openAgentStudio = (agent?: CanvasFlowAgentRecord | null) => {
    if (agent) {
      const profile = getAgentProfileConfig(agent, config);
      if (getAgentRecordId(agent) === normalizedAgentId) applyAgentProfileToConfig(profile);
    } else {
      applyAgentProfileToConfig(currentAgentProfileConfig);
    }
    setAgentStudioError('');
    setAgentStudioMessage('');
    setAgentStudioOpen(true);
  };

  const buildCurrentAgentProfile = (): Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'> => ({
    model: config.model,
    llmProvider: config.llmProvider || 'openai',
    agentSpec: {
      agentsMd: config.agentSpec?.agentsMd || '',
      guardrails: config.agentSpec?.guardrails || '',
      blockedTerms: config.agentSpec?.blockedTerms || [],
      rules: config.agentSpec?.rules || [],
      skills: config.agentSpec?.skills || [],
      subagents: config.agentSpec?.subagents || [],
      mcpServers: config.agentSpec?.mcpServers || [],
    },
  });

  const upsertAgentRecord = (updated: CanvasFlowAgentRecord) => {
    setAgents((current) => {
      const exists = current.some((agent) => getAgentRecordId(agent) === selectedAgentStableId);
      if (!exists) return [...current, updated];
      return current.map((agent) => (getAgentRecordId(agent) === selectedAgentStableId ? { ...agent, ...updated } : agent));
    });
  };

  const saveAgentStudioConfig = async () => {
    if (!selectedAgentStableId || virtualDefaultAgent || agentStudioSaving) return;
    const profile = buildCurrentAgentProfile();
    setAgentStudioSaving(true);
    setAgentStudioError('');
    setAgentStudioMessage('');
    try {
      const updated = await canvasApi.updateAgentConfig(selectedAgentStableId, profile);
      upsertAgentRecord(updated);
      applyAgentProfileToConfig(getAgentProfileConfig(updated, config));
      setAgentStudioMessage('Agent OS salvo no perfil do agente.');
    } catch (error) {
      setAgentStudioError(error instanceof Error ? error.message : 'Nao foi possivel salvar o Agent OS.');
    } finally {
      setAgentStudioSaving(false);
    }
  };

  const downloadAgentWorkspace = (workspace: CanvasFlowAgentWorkspace) => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(workspace.agentName || workspace.agentId || agentDisplayName || 'agente')}.canvas-flow.workspace.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAgentWorkspace = async () => {
    if (!selectedAgentStableId || virtualDefaultAgent || agentStudioWorkspaceBusy) return;
    setAgentStudioWorkspaceBusy(true);
    setAgentStudioError('');
    setAgentStudioMessage('');
    try {
      const updated = await canvasApi.updateAgentConfig(selectedAgentStableId, buildCurrentAgentProfile());
      upsertAgentRecord(updated);
      applyAgentProfileToConfig(getAgentProfileConfig(updated, config));
      const workspace = await canvasApi.getAgentWorkspace(selectedAgentStableId);
      downloadAgentWorkspace(workspace);
      setAgentStudioMessage('Workspace .canvas-flow exportado.');
    } catch (error) {
      setAgentStudioError(error instanceof Error ? error.message : 'Nao foi possivel exportar o workspace.');
    } finally {
      setAgentStudioWorkspaceBusy(false);
    }
  };

  const importAgentWorkspace = async (raw: string) => {
    if (!selectedAgentStableId || virtualDefaultAgent || agentStudioWorkspaceBusy) return;
    setAgentStudioWorkspaceBusy(true);
    setAgentStudioError('');
    setAgentStudioMessage('');
    try {
      const workspace = JSON.parse(raw) as CanvasFlowAgentWorkspace;
      const updated = await canvasApi.importAgentWorkspace(selectedAgentStableId, workspace);
      upsertAgentRecord(updated);
      applyAgentProfileToConfig(getAgentProfileConfig(updated, config));
      setAgentStudioMessage('Workspace .canvas-flow importado para este agente.');
    } catch (error) {
      setAgentStudioError(error instanceof Error ? error.message : 'Nao foi possivel importar o workspace.');
    } finally {
      setAgentStudioWorkspaceBusy(false);
    }
  };

  const applyFlowVersionMetadata = (flow?: CanvasFlowRecord | null, versionsOverride?: CanvasFlowVersionRecord[]) => {
    setFlowVersions(Array.isArray(versionsOverride) ? versionsOverride : Array.isArray(flow?.versions) ? flow.versions : []);
    setFlowActiveVersion(Number.isFinite(Number(flow?.activeVersion)) ? Number(flow?.activeVersion) : undefined);
    setFlowLatestVersion(Number.isFinite(Number(flow?.latestVersion)) ? Number(flow?.latestVersion) : 0);
  };

  const applyAgentReleaseMetadata = (payload?: { activeRelease?: number; latestRelease?: number; releases?: CanvasFlowAgentReleaseRecord[] } | null) => {
    setAgentReleases(Array.isArray(payload?.releases) ? payload.releases : []);
    setAgentActiveRelease(Number.isFinite(Number(payload?.activeRelease)) ? Number(payload?.activeRelease) : undefined);
    setAgentLatestRelease(Number.isFinite(Number(payload?.latestRelease)) ? Number(payload?.latestRelease) : 0);
  };

  const loadAgentReleaseState = useCallback(async (targetAgentId = normalizedAgentId) => {
    if (!targetAgentId || targetAgentId === 'default-agent') {
      applyAgentReleaseMetadata(null);
      return null;
    }
    setAgentReleaseLoading(true);
    try {
      const state = await canvasApi.getAgentReleases(targetAgentId);
      applyAgentReleaseMetadata(state);
      return state;
    } catch {
      applyAgentReleaseMetadata(null);
      return null;
    } finally {
      setAgentReleaseLoading(false);
    }
  }, [normalizedAgentId]);

  const loadFlowVersionState = useCallback(async (targetFlowId = savedFlowId) => {
    if (!targetFlowId) {
      applyFlowVersionMetadata(null);
      return null;
    }
    setFlowVersionsLoading(true);
    try {
      const state = await canvasApi.getFlowVersions(targetFlowId);
      applyFlowVersionMetadata(state);
      return state;
    } catch {
      applyFlowVersionMetadata(null);
      return null;
    } finally {
      setFlowVersionsLoading(false);
    }
  }, [savedFlowId]);

  useEffect(() => {
    if (!flowVersionsPanelOpen) return;
    if (savedFlowId) void loadFlowVersionState(savedFlowId);
    void loadAgentReleaseState(normalizedAgentId);
  }, [flowVersionsPanelOpen, loadAgentReleaseState, loadFlowVersionState, normalizedAgentId, savedFlowId]);

  useEffect(() => {
    setConfirmInput('');
  }, [confirmDialog?.title, confirmDialog?.confirmationText]);

  useEffect(() => {
    if (!flowVersionsQuickOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!flowVersionsQuickRef.current?.contains(event.target as globalThis.Node)) {
        setFlowVersionsQuickOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [flowVersionsQuickOpen]);

  useEffect(() => {
    if (testRuntimeMode !== 'agentVersion') return;
    void loadAgentReleaseState(normalizedAgentId);
  }, [testRuntimeMode, loadAgentReleaseState, normalizedAgentId]);

  useEffect(() => {
    if (testRuntimeMode !== 'flowVersion' || !savedFlowId || sortedFlowVersions.length || flowVersionsLoading) return;
    void loadFlowVersionState(savedFlowId);
  }, [testRuntimeMode, savedFlowId, sortedFlowVersions.length, flowVersionsLoading, loadFlowVersionState]);

  useEffect(() => {
    if (testRuntimeMode !== 'agentVersion' || testAgentRelease || !sortedAgentReleases.length) return;
    setTestAgentRelease(String(sortedAgentReleases[0].release || ''));
  }, [testRuntimeMode, testAgentRelease, sortedAgentReleases]);

  useEffect(() => {
    if (testRuntimeMode !== 'flowVersion' || testFlowVersion || !sortedFlowVersions.length) return;
    setTestFlowVersion(String(sortedFlowVersions[0].version || ''));
  }, [testRuntimeMode, testFlowVersion, sortedFlowVersions]);

  useEffect(() => {
    if (!flowVersionsPanelOpen) return;
    if (!sortedAgentReleases.length) {
      if (agentTabAgentRelease) setAgentTabAgentRelease('');
      return;
    }
    const exists = sortedAgentReleases.some((release) => String(release.release) === agentTabAgentRelease);
    if (exists) return;
    setAgentTabAgentRelease('');
  }, [agentTabAgentRelease, flowVersionsPanelOpen, sortedAgentReleases]);

  useEffect(() => {
    if (!sortedFlowVersions.length) {
      if (agentTabFlowVersion) setAgentTabFlowVersion('');
      return;
    }
    const exists = sortedFlowVersions.some((version) => String(version.version) === agentTabFlowVersion);
    if (exists) return;
    setAgentTabFlowVersion('');
  }, [agentTabFlowVersion, sortedFlowVersions]);

  useEffect(() => {
    if (!flowVersionsPanelOpen || !selectedAgentTabReleaseFlows.length) {
      setAgentReleaseFlowVersionStates({});
      return;
    }
    let cancelled = false;
    void Promise.all(selectedAgentTabReleaseFlows.map(async (flow) => {
      const state = await canvasApi.getFlowVersions(flow.id).catch(() => null);
      return [flow.id, {
        activeVersion: state?.activeVersion,
        versions: state?.versions || [],
      }] as const;
    })).then((entries) => {
      if (!cancelled) setAgentReleaseFlowVersionStates(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [flowVersionsPanelOpen, selectedAgentTabReleaseFlows]);

  useEffect(() => {
    if (!selectedAgentTabReleaseFlowVersions.length) {
      if (agentTabReleasePreviewKey) setAgentTabReleasePreviewKey('');
      return;
    }
    const exists = selectedAgentTabReleaseFlowVersions.some((flow) => flow.key === agentTabReleasePreviewKey);
    if (exists) return;
    const preferred = selectedAgentTabReleaseFlowVersions.find((flow) => flow.isReleaseSnapshot) || selectedAgentTabReleaseFlowVersions[0];
    setAgentTabReleasePreviewKey(preferred.key);
  }, [agentTabReleasePreviewKey, selectedAgentTabReleaseFlowVersions]);

  const updateStep = (stepId: string, patch: Partial<FlowStep>) => {
    setConfig((current) => ({
      ...current,
      steps: current.steps.map((step) => {
        if (step.id !== stepId) return step;
        const next = { ...step, ...patch };
        if (patch.responseName && next.api) {
          next.api = { ...next.api, responseName: patch.responseName };
        }
        if (patch.responseName && next.component) {
          next.component = { ...next.component, responseName: patch.responseName };
        }
        return next;
      }),
    }));
  };

  const updateNodeInline = useCallback(
    (stepId: string, patch: Partial<Pick<FlowStep, 'title' | 'instruction'>>) => {
      setConfig((current) => ({
        ...current,
        steps: current.steps.map((step) => {
          if (step.id !== stepId) return step;
          const next: FlowStep = { ...step, ...patch };
          if (step.type === 'condition' && patch.instruction !== undefined) {
            next.condition = patch.instruction;
          }
          return next;
        }),
      }));
    },
    [],
  );

  const updateInlineEditing = useCallback((stepId: string, field: 'title' | 'instruction' | null) => {
    setInlineEditing(field ? { stepId, field } : null);
  }, []);

  const updateEdge = (edgeId: string, patch: Partial<FlowEdge>) => {
    setConfig((current) => ({
      ...current,
      edges: current.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
    }));
  };

  const resizeGroup = useCallback((stepId: string, size: { width: number; height: number }) => {
    setConfig((current) => {
      const normalizedSteps = normalizeCanvasHierarchy(current.steps);
      const resizedSteps = normalizedSteps.map((step) => (
        step.id === stepId
          ? {
              ...step,
              group: {
                ...(step.group || { width: 520, height: 340 }),
                width: Math.max(GROUP_MIN_WIDTH, Math.round(size.width)),
                height: Math.max(GROUP_MIN_HEIGHT, Math.round(size.height)),
              },
            }
          : step
      ));

      return {
        ...current,
        steps: absorbFreeNodesIntoGroup(resizedSteps, stepId),
      };
    });
  }, []);

  const toggleGroupCollapsed = useCallback((stepId: string) => {
    setConfig((current) => {
      const normalizedSteps = normalizeCanvasHierarchy(current.steps);
      const group = normalizedSteps.find((step) => step.id === stepId && step.type === 'group');
      const willCollapse = !group?.group?.collapsed;
      const collapseState = willCollapse
        ? reconcileGroupChildrenForCollapse(normalizedSteps, stepId, {
            includeAttached: true,
            threshold: 0,
            margin: GROUP_COLLAPSE_ABSORB_MARGIN,
            canvasNodes: nodesRef.current,
          })
        : { steps: normalizedSteps, childIds: [] as string[] };
      const toggledSteps = collapseState.steps.map((step) => (
        step.id === stepId && step.type === 'group'
          ? {
              ...step,
              group: {
                ...(step.group || { width: 520, height: 340 }),
                collapsed: !step.group?.collapsed,
                collapsedChildIds: collapseState.childIds,
              },
            }
          : step
      ));

      return {
        ...current,
        steps: willCollapse ? toggledSteps : fitExpandedGroupToChildren(toggledSteps, stepId),
      };
    });
  }, []);

  const encapsulateSelectedNodes = useCallback(() => {
    const groupId = createId('group');

    setConfig((current) => {
      const stepById = new Map(current.steps.map((step) => [step.id, step]));
      const selectedSteps = selectedNodeIds
        .map((id) => stepById.get(id))
        .filter((step): step is FlowStep => {
          if (!step) return false;
          return step.type !== 'group' && !step.parentId;
        });

      const group = createStep('group', current.steps.length);
      group.id = groupId;

      if (!selectedSteps.length) {
        group.position = { x: 120 + current.steps.length * 38, y: 120 + current.steps.length * 24 };
        return {
          ...current,
          steps: [...current.steps, group],
          startStepId: current.startStepId || group.id,
        };
      }

      const bounds = selectedSteps.reduce(
        (acc, step) => {
          const stepBounds = getStepBounds(step, stepById);
          return {
            minX: Math.min(acc.minX, stepBounds.x),
            minY: Math.min(acc.minY, stepBounds.y),
            maxX: Math.max(acc.maxX, stepBounds.right),
            maxY: Math.max(acc.maxY, stepBounds.bottom),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      const groupPosition = {
        x: bounds.minX - GROUP_PADDING_X,
        y: bounds.minY - GROUP_PADDING_TOP,
      };
      const groupWidth = Math.max(GROUP_MIN_WIDTH, bounds.maxX - bounds.minX + GROUP_PADDING_X * 2);
      const groupHeight = Math.max(GROUP_MIN_HEIGHT, bounds.maxY - bounds.minY + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM);
      group.position = groupPosition;
      group.group = { width: groupWidth, height: groupHeight };

      const selectedIds = new Set(selectedSteps.map((step) => step.id));
      const steps = current.steps.map((step) => {
        if (!selectedIds.has(step.id)) return step;
        const absolutePosition = getAbsolutePosition(step, stepById);
        return {
          ...step,
          parentId: group.id,
          position: getPositionInsideGroup(
            absolutePosition.x - groupPosition.x,
            absolutePosition.y - groupPosition.y,
          ),
        };
      });

      return {
        ...current,
        steps: [...steps, group],
        startStepId: current.startStepId || group.id,
      };
    });

    setSelectedStepId(groupId);
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
  }, [selectedNodeIds]);

  const openFlowAssistant = () => {
    const selectedIds = canvasAssistantSelectedStepIds;
    setFlowAssistantSelectedStepIds(selectedIds);
    setComponentPaletteOpen(false);
    setFlowAssistantError('');
    setFlowAssistantScope(selectedIds.length ? 'selection' : 'flow');
    setFlowAssistantNodeSearch('');
    setFlowAssistantOpen(true);
  };

  const toggleFlowAssistantStepSelection = (stepId: string) => {
    setFlowAssistantSelectedStepIds((current) => (
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId]
    ));
    setFlowAssistantResult(null);
    setFlowAssistantError('');
  };

  const selectAllFlowAssistantSteps = () => {
    const source = flowAssistantNodeSearch.trim() ? filteredAssistantSteps : config.steps;
    setFlowAssistantSelectedStepIds((current) => Array.from(new Set([
      ...current,
      ...source.map((step) => step.id),
    ])));
    setFlowAssistantResult(null);
    setFlowAssistantError('');
  };

  const clearFlowAssistantStepSelection = () => {
    setFlowAssistantSelectedStepIds([]);
    setFlowAssistantResult(null);
    setFlowAssistantError('');
  };

  const generateFlowWithAssistant = async () => {
    const instruction = flowAssistantPrompt.trim();
    if (!instruction) {
      setFlowAssistantError('Descreva o fluxo que a IA deve montar.');
      return;
    }

    const scope = flowAssistantScope === 'selection' ? 'selection' : 'flow';
    const selectedStepIds = scope === 'selection' ? assistantSelectedStepIds : [];
    if (scope === 'selection' && !selectedStepIds.length) {
      setFlowAssistantError('Selecione pelo menos um nó no canvas para usar este escopo.');
      return;
    }

    setFlowAssistantLoading(true);
    setFlowAssistantError('');
    try {
      const fullConfig = withConfigDefaults(config);
      const currentConfig = scope === 'selection'
        ? createAssistantScopedConfig(fullConfig, selectedStepIds)
        : fullConfig;
      const result = await canvasApi.generateFlowWithAssistant({
        instruction,
        sourceType: flowAssistantSource,
        currentConfig,
        scope: {
          mode: scope === 'selection' ? 'selectedNodes' : 'fullFlow',
          selectedStepIds,
        },
        flowName,
        agentId,
        flowId: savedFlowId || undefined,
        model: config.model,
        llmProvider: config.llmProvider || 'openai',
      });
      setFlowAssistantResult({ ...result, scope, selectedStepIds });
    } catch (error) {
      setFlowAssistantError(error instanceof Error ? error.message : 'Não foi possível gerar o fluxo com IA.');
    } finally {
      setFlowAssistantLoading(false);
    }
  };

  const applyFlowAssistantResult = () => {
    if (!flowAssistantResult?.config) return;
    const generatedConfig = withConfigDefaults(flowAssistantResult.config);
    const nextConfig = flowAssistantResult.scope === 'selection'
      ? withConfigDefaults(mergeAssistantSelectionResult(config, generatedConfig, flowAssistantResult.selectedStepIds || []))
      : generatedConfig;
    setConfig(nextConfig);
    if (flowAssistantResult.scope !== 'selection') {
      setFlowName(nextConfig.title || flowName || 'Fluxo IA');
    }
    setSelectedStepId(
      flowAssistantResult.scope === 'selection'
        ? flowAssistantResult.selectedStepIds?.[0] || ''
        : nextConfig.startStepId || nextConfig.steps[0]?.id || '',
    );
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestConversationId('');
    setTestSlots({});
    setTestGraphRuntime(null);
    setTestMessages([{ role: 'system', text: 'Alteração aplicada pelo assistente. Clique em Salvar para persistir.' }]);
    setFlowAssistantOpen(false);
  };

  const addStep = (type: StepType) => {
    if (type === 'group') {
      encapsulateSelectedNodes();
      return;
    }

    const step = createStep(type, config.steps.length);
    setConfig((current) => ({
      ...current,
      steps: [...current.steps, step],
      startStepId: current.startStepId || step.id,
    }));
    setSelectedStepId(step.id);
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestSlots({});
  };

  const addComponent = (type: ComponentType | '') => {
    if (!type) return;
    const step = createStep('component', config.steps.length, type);
    setConfig((current) => ({ ...current, steps: [...current.steps, step] }));
    setSelectedStepId(step.id);
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
    setComponentPaletteOpen(false);
    setComponentSearch('');
  };

  const performDeleteStep = useCallback((stepId: string) => {
    setConfig((current) => removeStepsFromConfig(current, new Set([stepId])));
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setSelectedNodeIds([]);
  }, []);

  const requestDeleteStep = useCallback(
    (stepId: string) => {
      const step = config.steps.find((item) => item.id === stepId);
      const message = step?.type === 'group'
        ? `Deseja realmente excluir "${step?.title || 'este encapsulador'}"? Os nós dentro dele serão mantidos no canvas.`
        : `Deseja realmente excluir "${step?.title || 'este nó'}"? As ligações conectadas a ele também serão removidas.`;
      setConfirmDialog({
        title: 'Excluir nó?',
        message,
        confirmLabel: 'Excluir nó',
        onConfirm: () => performDeleteStep(stepId),
      });
    },
    [config.steps, performDeleteStep],
  );

  const openStepInspector = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
  }, []);

  const duplicateStep = useCallback((stepId: string) => {
    setConfig((current) => {
      const source = current.steps.find((step) => step.id === stepId);
      if (!source) return current;
      const duplicateId = createId(source.type);
      const duplicate: FlowStep = {
        ...cloneFlowStep(source),
        id: duplicateId,
        title: `${source.title || 'Node'} copia`,
        position: {
          x: (source.position?.x || 0) + 36,
          y: (source.position?.y || 0) + 36,
        },
      };
      return { ...current, steps: [...current.steps, duplicate] };
    });
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
  }, []);

  const duplicateSelectedNodes = useCallback(() => {
    const selectedIds = new Set(selectedNodeIds);
    if (!selectedIds.size) return;
    const selectedSteps = config.steps.filter((step) => selectedIds.has(step.id));
    if (!selectedSteps.length) return;
    const idMap = new Map(selectedSteps.map((step) => [step.id, createId(step.type)]));
    const duplicatedStepIds = Array.from(idMap.values());
    const duplicatedSteps = selectedSteps.map((step) => {
      const nextId = idMap.get(step.id) || createId(step.type);
      const parentId = step.parentId && idMap.has(step.parentId)
        ? idMap.get(step.parentId)
        : step.parentId;
      return {
        ...cloneFlowStep(step),
        id: nextId,
        title: `${step.title || 'Node'} copia`,
        parentId,
        position: {
          x: (step.position?.x || 0) + 36,
          y: (step.position?.y || 0) + 36,
        },
      };
    });
    const duplicatedEdges = config.edges
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge) => ({
        ...edge,
        id: createId('edge'),
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));

    setConfig((current) => ({
      ...current,
      steps: [...current.steps, ...duplicatedSteps],
      edges: [...current.edges, ...duplicatedEdges],
    }));
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setSelectedNodeIds(duplicatedStepIds);
    setFlowConfigOpen(false);
  }, [config.edges, config.steps, selectedNodeIds]);

  const performDeleteSelectedNodes = useCallback((stepIds: string[]) => {
    const ids = new Set(stepIds);
    setConfig((current) => removeStepsFromConfig(current, ids));
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setSelectedNodeIds([]);
    setFlowConfigOpen(false);
  }, []);

  const requestDeleteSelectedNodes = useCallback(() => {
    const selectedSteps = selectedNodeIds
      .map((stepId) => config.steps.find((step) => step.id === stepId))
      .filter((step): step is FlowStep => Boolean(step));
    if (!selectedSteps.length) return;
    setConfirmDialog({
      title: `Excluir ${selectedSteps.length} nos?`,
      message: 'As ligacoes conectadas aos nos selecionados tambem serao removidas. Encapsuladores selecionados soltam os nos internos que nao estiverem selecionados.',
      confirmLabel: 'Excluir selecionados',
      onConfirm: () => performDeleteSelectedNodes(selectedSteps.map((step) => step.id)),
    });
  }, [config.steps, performDeleteSelectedNodes, selectedNodeIds]);

  const performDeleteEdge = useCallback((edgeId: string) => {
    setConfig((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== edgeId) }));
    setSelectedEdgeId('');
    setEdgeActionId('');
  }, []);

  const requestDeleteEdge = useCallback(
    (edgeId: string) => {
      const edge = config.edges.find((item) => item.id === edgeId);
      const source = config.steps.find((step) => step.id === edge?.source);
      const target = config.steps.find((step) => step.id === edge?.target);
      const label = source && target ? `${source.title || source.id} -> ${target.title || target.id}` : 'esta ligação';

      setConfirmDialog({
        title: 'Excluir ligação?',
        message: `Deseja realmente excluir ${label}?`,
        confirmLabel: 'Excluir ligação',
        onConfirm: () => performDeleteEdge(edgeId),
      });
    },
    [config.edges, config.steps, performDeleteEdge],
  );

  const openEdgeInspector = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedStepId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setConfig((current) => {
      const edge: FlowEdge = {
        id: createId('edge'),
        source: connection.source!,
        target: connection.target!,
      };
      if (isAgenticManifestEdge(edge, current)) edge.edgeRole = 'manifest';
      return { ...current, edges: [...current.edges, edge] };
    });
  }, []);

  const resolveDraggedNodeSet = useCallback((node: Node, draggedNodes?: Node[]) => {
    const incomingNodes = Array.isArray(draggedNodes) && draggedNodes.length ? draggedNodes : [node];
    if (incomingNodes.length > 1) return incomingNodes;
    if (selectedNodeIds.length <= 1 || !selectedNodeIds.includes(node.id)) return incomingNodes;

    const selectedIds = new Set(selectedNodeIds);
    const latestNodes = mergeCanvasNodeSnapshots(nodesRef.current, [node]);
    return latestNodes.filter((item) => selectedIds.has(item.id));
  }, [selectedNodeIds]);

  const onNodeDrag = useCallback((_event: unknown, node: Node, draggedNodes?: Node[]) => {
    const dragNodes = resolveDraggedNodeSet(node, draggedNodes);
    nodesRef.current = mergeCanvasNodeSnapshots(nodesRef.current, dragNodes);
  }, [resolveDraggedNodeSet]);

  const onSelectionDrag = useCallback((_event: unknown, draggedNodes: Node[]) => {
    nodesRef.current = mergeCanvasNodeSnapshots(nodesRef.current, draggedNodes);
  }, []);

  const onNodeDragStop = useCallback((_event: unknown, node: Node, draggedNodes?: Node[]) => {
    const dragNodes = resolveDraggedNodeSet(node, draggedNodes);
    nodesRef.current = mergeCanvasNodeSnapshots(nodesRef.current, dragNodes);
    setConfig((current) => applyDraggedNodesToConfig(current, dragNodes));
  }, [resolveDraggedNodeSet]);

  const onSelectionDragStop = useCallback((_event: unknown, draggedNodes: Node[]) => {
    nodesRef.current = mergeCanvasNodeSnapshots(nodesRef.current, draggedNodes);
    setConfig((current) => applyDraggedNodesToConfig(current, draggedNodes));
  }, []);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const selectionChanges = changes.filter((change) => change.type === 'select');
    if (selectionChanges.length) {
      setSelectedNodeIds((current) => {
        const nextSelectedIds = new Set(current);
        selectionChanges.forEach((change) => {
          if (change.selected) {
            nextSelectedIds.add(change.id);
          } else {
            nextSelectedIds.delete(change.id);
          }
        });
        return Array.from(nextSelectedIds);
      });
    }

    const layoutChanges = changes.filter((change) => change.type !== 'select');
    if (!layoutChanges.length) return;

    setNodes((current) => {
      const nextNodes = applyNodeChanges(layoutChanges, current);
      nodesRef.current = nextNodes;
      return nextNodes;
    });
  }, []);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    setSelectedNodeIds(selectedNodes.map((node) => node.id));
  }, []);

  const handleNodeClick = useCallback((event: unknown, node: Node) => {
    const pointerEvent = event as { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
    if (pointerEvent.ctrlKey || pointerEvent.metaKey || pointerEvent.shiftKey) {
      setSelectedStepId('');
      setSelectedEdgeId('');
      setEdgeActionId('');
      setFlowConfigOpen(false);
      return;
    }
    if (node.data?.step?.type === 'group') {
      closeInspector();
      setSelectedNodeIds([node.id]);
      return;
    }
    setSelectedNodeIds([node.id]);
    openStepInspector(node.id);
  }, [closeInspector, openStepInspector]);

  const handleEdgeClick = useCallback((_event: unknown, edge: Edge) => {
    setEdgeActionId(edge.id);
    setSelectedEdgeId('');
    setSelectedStepId('');
    setFlowConfigOpen(false);
  }, []);

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    const deletedIds = new Set(deleted.map((edge) => edge.id));
    setConfig((current) => ({ ...current, edges: current.edges.filter((edge) => !deletedIds.has(edge.id)) }));
    setSelectedEdgeId((current) => (deletedIds.has(current) ? '' : current));
    setEdgeActionId((current) => (deletedIds.has(current) ? '' : current));
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const nextNodes = toReactNodes(config, {
      onUpdate: updateNodeInline,
      onEdit: openStepInspector,
      onInlineEdit: updateInlineEditing,
      editingStepId: inlineEditing?.stepId,
      editingField: inlineEditing?.field || null,
      onDuplicate: duplicateStep,
      onDelete: requestDeleteStep,
      onResizeGroup: resizeGroup,
      onToggleGroup: toggleGroupCollapsed,
      selectedStepIds: selectedNodeIds,
    });
    setNodes((currentNodes) => {
      const mergedNodes = mergeReactNodesPreservingInternals(currentNodes, nextNodes);
      nodesRef.current = mergedNodes;
      return mergedNodes;
    });
  }, [config, duplicateStep, inlineEditing, openStepInspector, requestDeleteStep, resizeGroup, selectedNodeIds, toggleGroupCollapsed, updateInlineEditing, updateNodeInline]);

  useEffect(() => {
    setEdges(toReactEdges(config, {
      onEdit: openEdgeInspector,
      onDelete: requestDeleteEdge,
    }));
  }, [config, openEdgeInspector, requestDeleteEdge]);

  useEffect(() => {
    const validStepIds = new Set(config.steps.map((step) => step.id));
    const visibleStepIds = getVisibleStepIds(config);
    setSelectedNodeIds((current) => current.filter((stepId) => validStepIds.has(stepId) && visibleStepIds.has(stepId)));
    setSelectedStepId((current) => (current && !visibleStepIds.has(current) ? '' : current));
    setInlineEditing((current) => (current && !visibleStepIds.has(current.stepId) ? null : current));
  }, [config]);

  const loadFlows = useCallback(async (targetAgentId = normalizedAgentId) => {
    const scopedAgentId = targetAgentId.trim() || 'default-agent';
    setLoadingFlows(true);
    setFlowListError('');
    try {
      const nextFlows = await canvasApi.listFlows(scopedAgentId);
      setFlows(nextFlows);
      return nextFlows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar os fluxos.';
      setFlowListError(message);
      throw error;
    } finally {
      setLoadingFlows(false);
    }
  }, [normalizedAgentId]);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    setAgentsError('');
    try {
      const nextAgents = await canvasApi.listAgents();
      setAgents(nextAgents);
      return nextAgents;
    } catch (error) {
      setAgentsError(error instanceof Error ? error.message : 'Nao foi possivel carregar os agentes.');
      return [];
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    let cancelled = false;
    const scopedAgentId = normalizedAgentId;
    const timeout = window.setTimeout(() => {
      setLoadingFlows(true);
      canvasApi.listFlows(scopedAgentId)
        .then((nextFlows) => {
          if (cancelled) return;
          setFlowListError('');
          setFlows(nextFlows);
        })
        .catch((error) => {
          if (!cancelled) setFlowListError(error instanceof Error ? error.message : 'Nao foi possivel carregar os fluxos.');
        })
        .finally(() => {
          if (!cancelled) setLoadingFlows(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [normalizedAgentId]);

  const loadTagDashboard = async (
    filters = tagDashboardFilters,
    historyPage = tagDashboardHistoryPage,
    historyLimit = tagDashboardHistoryLimit,
  ) => {
    setTagDashboardLoading(true);
    setTagDashboardError('');
    try {
      const result = await canvasApi.getTagDashboard({
        ...filters,
        agentId,
        flowId: filters.flowId || '',
        tags: parseTagFilters(filters.tags),
        limit: Number(filters.limit || 100),
        historyPage,
        historyLimit,
      });
      setTagDashboard(result);
    } catch (error) {
      setTagDashboardError(error instanceof Error ? error.message : 'Não foi possível carregar o dashboard de tags.');
    } finally {
      setTagDashboardLoading(false);
    }
  };

  const openTagDashboard = async () => {
    setHeaderActionsOpen(false);
    setTagDashboardOpen(true);
    setTagDashboardHistoryPage(1);
    if (!flows.length) {
      await loadFlows().catch(() => []);
    }
    await loadTagDashboard(tagDashboardFilters, 1, tagDashboardHistoryLimit);
  };

  const applyTagDashboardFilters = async () => {
    setTagDashboardHistoryPage(1);
    await loadTagDashboard(tagDashboardFilters, 1, tagDashboardHistoryLimit);
  };

  const changeTagDashboardHistoryPage = async (page: number) => {
    const nextPage = Math.max(1, page);
    setTagDashboardHistoryPage(nextPage);
    await loadTagDashboard(tagDashboardFilters, nextPage, tagDashboardHistoryLimit);
  };

  const changeTagDashboardHistoryLimit = async (limit: number) => {
    const nextLimit = Math.max(10, Math.min(Number(limit || 50), 500));
    setTagDashboardHistoryLimit(nextLimit);
    setTagDashboardHistoryPage(1);
    await loadTagDashboard(tagDashboardFilters, 1, nextLimit);
  };

  const loadAgentOpsDashboard = async (filters = agentOpsFilters) => {
    setAgentOpsLoading(true);
    setAgentOpsError('');
    try {
      const result = await canvasApi.getAgentOpsDashboard({
        ...filters,
        agentId: normalizedAgentId,
        flowId: filters.flowId || '',
        historyLimit: Math.max(10, Math.min(Number(filters.historyLimit || 80), 500)),
        traceLimit: Math.max(50, Math.min(Number(filters.traceLimit || 600), 5000)),
      });
      setAgentOpsDashboard(result);
    } catch (error) {
      setAgentOpsError(error instanceof Error ? error.message : 'Nao foi possivel carregar o AgentOps.');
    } finally {
      setAgentOpsLoading(false);
    }
  };

  const openAgentOpsDashboard = async () => {
    setHeaderActionsOpen(false);
    setAgentOpsOpen(true);
    if (!flows.length) {
      await loadFlows().catch(() => []);
    }
    await loadAgentOpsDashboard(agentOpsFilters);
  };

  const applyAgentOpsFilters = async () => {
    await loadAgentOpsDashboard(agentOpsFilters);
  };

  const commitSimulationCaseDrafts = (drafts: SimulationCaseDraft[]) => {
    const nextDrafts = drafts.length ? drafts : [createSimulationCaseDraft({ name: 'Novo cenario' })];
    setSimulationCaseDrafts(nextDrafts);
    try {
      setSimulationCasesText(simulationDraftsToJson(nextDrafts));
    } catch {
      // Mantem o JSON anterior enquanto o usuario termina de editar algum campo JSON visual.
    }
  };

  const updateSimulationCaseDraft = (id: string, patch: Partial<SimulationCaseDraft>) => {
    const nextDrafts = simulationCaseDrafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft));
    commitSimulationCaseDrafts(nextDrafts);
    setSimulationResult(null);
  };

  const addSimulationCaseDraft = () => {
    const nextDrafts = [
      ...simulationCaseDrafts,
      createSimulationCaseDraft({ name: `Cenario ${simulationCaseDrafts.length + 1}` }),
    ];
    commitSimulationCaseDrafts(nextDrafts);
    setSimulationResult(null);
  };

  const duplicateSimulationCaseDraft = (id: string) => {
    const source = simulationCaseDrafts.find((draft) => draft.id === id);
    if (!source) return;
    const nextDrafts = [
      ...simulationCaseDrafts,
      { ...source, id: createId('simcase'), name: `${source.name || 'Cenario'} copia` },
    ];
    commitSimulationCaseDrafts(nextDrafts);
    setSimulationResult(null);
  };

  const removeSimulationCaseDraft = (id: string) => {
    const nextDrafts = simulationCaseDrafts.filter((draft) => draft.id !== id);
    commitSimulationCaseDrafts(nextDrafts);
    setSimulationResult(null);
  };

  const resetSimulationExampleDrafts = () => {
    const nextDrafts = getDefaultSimulationCaseDrafts();
    commitSimulationCaseDrafts(nextDrafts);
    setSimulationError('');
    setSimulationResult(null);
  };

  const applySimulationJsonToVisual = () => {
    try {
      const nextDrafts = simulationDraftsFromJson(simulationCasesText);
      commitSimulationCaseDrafts(nextDrafts.length ? nextDrafts : [createSimulationCaseDraft({ name: 'Novo cenario' })]);
      setSimulationEditorMode('visual');
      setSimulationError('');
      setSimulationResult(null);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'JSON invalido.');
    }
  };

  const formatSimulationJson = () => {
    try {
      const nextDrafts = simulationDraftsFromJson(simulationCasesText);
      setSimulationCasesText(simulationDraftsToJson(nextDrafts));
      setSimulationError('');
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'JSON invalido.');
    }
  };

  const getSimulationCasesForRun = () => {
    if (simulationSuiteTab === 'saved') {
      if (!simulationSelectedRunSuiteIds.length) {
        throw new Error('Selecione pelo menos uma suite salva para rodar.');
      }
      const cases = buildSimulationSuiteRunCases(savedSimulationSuites, simulationSelectedRunSuiteIds);
      if (!cases.length) {
        throw new Error('As suites selecionadas nao possuem casos.');
      }
      setSimulationCasesText(JSON.stringify(cases, null, 2));
      return cases;
    }
    if (simulationEditorMode === 'json') {
      const parsed = JSON.parse(simulationCasesText || '[]');
      const cases = Array.isArray(parsed) ? parsed : parsed.cases;
      if (!Array.isArray(cases)) {
        throw new Error('JSON precisa ser uma lista de casos ou um objeto com cases[].');
      }
      return cases;
    }
    const cases = simulationDraftsToCases(simulationCaseDrafts);
    setSimulationCasesText(JSON.stringify(cases, null, 2));
    return cases;
  };

  const toggleSimulationRunSuite = (suiteId: string) => {
    setSimulationSelectedRunSuiteIds((current) => (
      current.includes(suiteId)
        ? current.filter((id) => id !== suiteId)
        : [...current, suiteId]
    ));
    setSimulationResult(null);
  };

  const selectAllSimulationRunSuites = () => {
    setSimulationSelectedRunSuiteIds(savedSimulationSuites.map((suite) => suite.id));
    setSimulationResult(null);
  };

  const clearSimulationRunSuites = () => {
    setSimulationSelectedRunSuiteIds([]);
    setSimulationResult(null);
  };

  const moveSimulationRunSuite = (sourceSuiteId: string, targetSuiteId: string) => {
    if (!sourceSuiteId || !targetSuiteId || sourceSuiteId === targetSuiteId) return;
    setSimulationSelectedRunSuiteIds((current) => {
      const fromIndex = current.indexOf(sourceSuiteId);
      const toIndex = current.indexOf(targetSuiteId);
      if (fromIndex < 0 || toIndex < 0) return current;
      return reorderByIndex(current, fromIndex, toIndex);
    });
    setSimulationDraggingSuiteId('');
    setSimulationResult(null);
  };

  const loadSimulationSuite = (suiteId: string) => {
    const suite = savedSimulationSuites.find((item) => item.id === suiteId);
    if (!suite) return;
    const drafts = suite.cases.map((testCase, index) => simulationCaseToDraft(testCase, index));
    setSimulationSelectedSuiteId(suite.id);
    setSimulationSuiteName(suite.name || 'Suite sem nome');
    setSimulationSuiteDescription(suite.description || '');
    setSimulationMode(suite.mode === 'isolated' ? 'isolated' : 'conversation');
    setSimulationCaseDrafts(drafts.length ? drafts : [createSimulationCaseDraft({ name: 'Novo cenario' })]);
    setSimulationCasesText(JSON.stringify(suite.cases || [], null, 2));
    setSimulationEditorMode('visual');
    setSimulationSuiteTab('editor');
    setSimulationError('');
    setSimulationMessage(`Suite "${suite.name}" carregada.`);
    setSimulationResult(null);
  };

  const startNewSimulationSuite = () => {
    const drafts = getDefaultSimulationCaseDrafts();
    setSimulationSelectedSuiteId('');
    setSimulationSuiteName(`Suite ${savedSimulationSuites.length + 1}`);
    setSimulationSuiteDescription('');
    setSimulationMode('conversation');
    setSimulationCaseDrafts(drafts);
    setSimulationCasesText(simulationDraftsToJson(drafts));
    setSimulationEditorMode('visual');
    setSimulationSuiteTab('editor');
    setSimulationError('');
    setSimulationMessage('');
    setSimulationResult(null);
  };

  const persistSimulationSuites = async (nextSuites: FlowSimulationSuite[], message: string) => {
    const normalizedSuites = normalizeSimulationSuites(nextSuites);
    writeSimulationSuitesToStorage(simulationSuitesStorageKey, normalizedSuites);
    setLocalSimulationSuites(normalizedSuites);
    const nextConfig = withConfigDefaults({
      ...config,
      simulationSuites: normalizedSuites,
    });
    setConfig(nextConfig);
    if (!savedFlowId) {
      setSimulationMessage(`${message} Salva localmente; salve o fluxo para enviar ao backend.`);
      return null;
    }
    const saved = await canvasApi.updateFlow(savedFlowId, {
      name: flowName || nextConfig.title,
      agentId: normalizedAgentId,
      config: nextConfig,
    });
    setFlowName(saved.name);
    setAgentId(saved.agentId || normalizedAgentId);
    setSavedAgentId(saved.agentId || normalizedAgentId);
    setConfig(withConfigDefaults(saved.config));
    const persistedSuites = normalizeSimulationSuites(saved.config?.simulationSuites || normalizedSuites);
    writeSimulationSuitesToStorage(simulationSuitesStorageKey, persistedSuites);
    setLocalSimulationSuites(persistedSuites);
    await loadFlows(saved.agentId || normalizedAgentId);
    setSimulationMessage(message);
    return saved;
  };

  const saveSimulationSuite = async () => {
    setSimulationSaving(true);
    setSimulationError('');
    setSimulationMessage('');
    try {
      const cases = getSimulationCasesForRun();
      if (!cases.length) throw new Error('Adicione pelo menos um caso com mensagem do usuario.');
      const now = new Date().toISOString();
      const currentSuites = savedSimulationSuites;
      const suiteId = simulationSelectedSuiteId || createId('evalsuite');
      const previous = currentSuites.find((suite) => suite.id === suiteId);
      const suite: FlowSimulationSuite = {
        id: suiteId,
        name: simulationSuiteName.trim() || previous?.name || `Suite ${currentSuites.length + 1}`,
        description: simulationSuiteDescription.trim(),
        mode: simulationMode,
        cases,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      const nextSuites = previous
        ? currentSuites.map((item) => (item.id === suiteId ? suite : item))
        : [...currentSuites, suite];
      setSimulationSelectedSuiteId(suite.id);
      setSimulationSelectedRunSuiteIds((current) => (
        current.includes(suite.id) ? current : [...current, suite.id]
      ));
      setSimulationSuiteName(suite.name);
      setSimulationSuiteDescription(suite.description || '');
      await persistSimulationSuites(nextSuites, `Suite "${suite.name}" salva.`);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'Nao foi possivel salvar a suite.');
    } finally {
      setSimulationSaving(false);
    }
  };

  const deleteSimulationSuite = async () => {
    if (!simulationSelectedSuiteId) return;
    const suite = savedSimulationSuites.find((item) => item.id === simulationSelectedSuiteId);
    if (!suite) return;
    setSimulationSaving(true);
    setSimulationError('');
    setSimulationMessage('');
    try {
      const nextSuites = savedSimulationSuites.filter((item) => item.id !== suite.id);
      await persistSimulationSuites(nextSuites, `Suite "${suite.name}" removida.`);
      setSimulationSelectedRunSuiteIds((current) => current.filter((suiteId) => suiteId !== suite.id));
      const drafts = getDefaultSimulationCaseDrafts();
      setSimulationSelectedSuiteId('');
      setSimulationSuiteName(`Suite ${nextSuites.length + 1}`);
      setSimulationSuiteDescription('');
      setSimulationMode('conversation');
      setSimulationCaseDrafts(drafts);
      setSimulationCasesText(simulationDraftsToJson(drafts));
      setSimulationEditorMode('visual');
      setSimulationResult(null);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'Nao foi possivel remover a suite.');
    } finally {
      setSimulationSaving(false);
    }
  };

  const openSimulation = () => {
    setHeaderActionsOpen(false);
    setSimulationOpen(true);
    setSimulationError('');
    setSimulationMessage('');
    setSimulationSuiteTab(savedSimulationSuites.length ? 'saved' : 'editor');
  };

  const runSimulation = async () => {
    setSimulationLoading(true);
    setSimulationError('');
    setSimulationResult(null);
    setSimulationResultsOpen(false);
    try {
      const cases = getSimulationCasesForRun();
      if (!Array.isArray(cases) || !cases.length) {
        throw new Error('Informe uma lista JSON com pelo menos um caso.');
      }
      const result = await canvasApi.replaySimulation(withTestRuntimePayload({
        flowId: savedFlowId || undefined,
        agentId,
        channel,
        mode: simulationMode,
        cases,
        conversationId: `canvas-flow-sim-${Date.now()}`,
        traceMode: 'compact',
        traceLimit: 120,
        traceCollectLimit: 800,
      }));
      setSimulationResult(result);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'Nao foi possivel rodar a simulacao.');
    } finally {
      setSimulationLoading(false);
    }
  };

  const openSimulationFinalState = () => {
    if (!simulationResult) return;
    setDebugJsonModal({
      title: 'Estado final da simulacao',
      payload: {
        summary: simulationResult.summary,
        mode: simulationResult.mode,
        finalState: simulationResult.finalState,
        generatedAt: simulationResult.generatedAt,
      },
    });
  };

  const openSimulationResultDetail = (item: any) => {
    setDebugJsonModal({
      title: `Resultado ${item.index}${item.name ? ` - ${item.name}` : ''}`,
      payload: {
        index: item.index,
        name: item.name,
        passed: item.passed,
        input: item.text,
        output: {
          lastMessage: item.lastMessage,
          messages: item.messages || [],
        },
        checks: item.checks || [],
        context: {
          slots: item.slots || {},
          currentStepId: item.currentStepId || '',
          ended: item.ended === true,
          conversationId: item.conversationId || '',
        },
        trace: item.trace || [],
      },
    });
  };

  const applyFlowTemplate = (template: FlowTemplateSummary) => {
    const nextConfig = withConfigDefaults(JSON.parse(JSON.stringify(template.config)) as FlowConfig);
    setSavedFlowId('');
    setSavedAgentId('');
    applyFlowVersionMetadata(null);
    setEditorFlowVersion(undefined);
    setFlowName(nextConfig.title || template.name);
    setConfig(nextConfig);
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setSelectedNodeIds([]);
    setFlowConfigOpen(false);
    setTemplatesOpen(false);
    setComponentPaletteOpen(false);
    setTestRuntimeMode('draft');
    setTestAgentRelease('');
    setTestFlowVersion('');
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestConversationId('');
    setTestSlots({});
    setTestTrace([]);
    setTestTracePage(null);
    setTestGraphRuntime(null);
    setTestMessages([{ role: 'system', text: `Template "${template.name}" aplicado como rascunho. Salve para criar um fluxo no agente atual.` }]);
  };

  const openFlowOrder = async () => {
    setHeaderActionsOpen(false);
    setFlowOrderError('');
    setFlowSearch('');
    setFlowCreateName('');
    setFlowEditingId('');
    setFlowEditingDraft('');
    const source = await loadFlows();
    setFlowOrderDraft(source);
    setFlowOrderOpen(true);
  };

  const moveFlowToTarget = (sourceFlowId: string, targetFlowId: string) => {
    if (!sourceFlowId || !targetFlowId || sourceFlowId === targetFlowId) return;
    setFlowOrderDraft((current) => {
      const fromIndex = current.findIndex((flow) => flow._id === sourceFlowId);
      const toIndex = current.findIndex((flow) => flow._id === targetFlowId);
      return reorderByIndex(current, fromIndex, toIndex);
    });
  };

  const saveFlowOrder = async () => {
    setFlowOrderSaving(true);
    setFlowOrderError('');
    try {
      const ordered = await canvasApi.reorderFlows(flowOrderDraft.map((flow) => flow._id), normalizedAgentId);
      setFlows(ordered);
      setFlowOrderDraft(ordered);
    } catch (err) {
      setFlowOrderError(err instanceof Error ? err.message : 'Nao foi possivel reordenar os fluxos.');
    } finally {
      setFlowOrderSaving(false);
    }
  };

  const enterFlow = async (flow: CanvasFlowRecord) => {
    await loadFlow(flow);
    setFlowOrderOpen(false);
    setFlowSearch('');
    setFlowEditingId('');
    setFlowEditingDraft('');
  };

  const createFlowFromManager = async () => {
    const name = flowCreateName.trim();
    if (!name || flowOrderSaving) return;

    setFlowOrderSaving(true);
    setFlowOrderError('');
    try {
      const nextConfig = withConfigDefaults({
        ...createEmptyFlow(),
        title: name,
      });
      const saved = await canvasApi.createFlow({
        name,
        agentId: normalizedAgentId,
        config: nextConfig,
      });
      setFlowCreateName('');
      const nextFlows = await loadFlows(normalizedAgentId);
      setFlowOrderDraft(nextFlows);
      await loadAgents();
      await loadFlow(saved);
      setFlowOrderOpen(false);
    } catch (error) {
      setFlowOrderError(error instanceof Error ? error.message : 'Nao foi possivel criar o fluxo.');
    } finally {
      setFlowOrderSaving(false);
    }
  };

  const startFlowRename = (flow: CanvasFlowRecord) => {
    setFlowEditingId(flow._id);
    setFlowEditingDraft(flow.name);
    setFlowOrderError('');
  };

  const saveFlowRename = async (flow: CanvasFlowRecord) => {
    const name = flowEditingDraft.trim();
    if (!name) {
      setFlowOrderError('Informe um nome para o fluxo.');
      return;
    }
    if (name === flow.name || flowOrderSaving) {
      setFlowEditingId('');
      setFlowEditingDraft('');
      return;
    }

    setFlowOrderSaving(true);
    setFlowOrderError('');
    try {
      const updated = await canvasApi.updateFlow(flow._id, { name });
      setFlowOrderDraft((current) => current.map((item) => (item._id === flow._id ? { ...item, ...updated } : item)));
      setFlows((current) => current.map((item) => (item._id === flow._id ? { ...item, ...updated } : item)));
      if (savedFlowId === flow._id) setFlowName(updated.name);
      setFlowEditingId('');
      setFlowEditingDraft('');
    } catch (error) {
      setFlowOrderError(error instanceof Error ? error.message : 'Nao foi possivel atualizar o fluxo.');
    } finally {
      setFlowOrderSaving(false);
    }
  };

  const performDeleteFlowRecord = async (flow: CanvasFlowRecord) => {
    setFlowOrderSaving(true);
    setFlowOrderError('');
    try {
      await canvasApi.deleteFlow(flow._id);
      const nextFlows = await loadFlows(normalizedAgentId);
      setFlowOrderDraft(nextFlows);
      await loadAgents();
      await loadAgentReleaseState(normalizedAgentId);

      if (savedFlowId === flow._id) {
        if (nextFlows[0]) {
          await loadFlow(nextFlows[0]);
        } else {
          const created = await createNewFlowDraft(normalizedAgentId, nextFlows);
          if (created) {
            setFlowOrderDraft(await loadFlows(normalizedAgentId));
          }
        }
      }
    } catch (error) {
      setFlowOrderError(error instanceof Error ? error.message : 'Nao foi possivel excluir o fluxo.');
    } finally {
      setFlowOrderSaving(false);
    }
  };

  const requestDeleteFlowRecord = (flow: CanvasFlowRecord) => {
    setConfirmDialog({
      title: 'Excluir fluxo?',
      message: `Deseja realmente excluir o fluxo "${flow.name || 'sem nome'}"? Esta acao nao pode ser desfeita.`,
      confirmLabel: 'Excluir fluxo',
      onConfirm: () => void performDeleteFlowRecord(flow),
    });
  };

  const loadFlow = async (
    flow: CanvasFlowRecord | string,
    options: { preferVersion?: boolean; preferredVersion?: number; preferredVersionLabel?: string } = {},
  ) => {
    const flowId = typeof flow === 'string' ? flow : flow._id;
    if (!flowId) return;
    const fullFlow = await canvasApi.getFlow(flowId);
    const nextAgentId = fullFlow.agentId || agentId;
    const shouldPreferVersion = options.preferVersion === true || Boolean(options.preferredVersion);
    const versionState = shouldPreferVersion ? await canvasApi.getFlowVersions(flowId).catch(() => null) : null;
    const versions = sortFlowVersions(versionState?.versions || []);
    const requestedVersion = Number(options.preferredVersion || 0);
    const requestedVersionRecord = requestedVersion
      ? versions.find((version) => Number(version.version) === requestedVersion && version.config)
      : undefined;
    const activeVersionRecord = shouldPreferVersion
      ? versions.find((version) => Number(version.version) === Number(fullFlow.activeVersion) && version.config)
      : undefined;
    const latestVersionRecord = shouldPreferVersion
      ? versions.find((version) => version.config)
      : undefined;
    const versionToEdit = requestedVersionRecord || activeVersionRecord || latestVersionRecord;

    setSavedFlowId(fullFlow._id);
    setFlowName(fullFlow.name);
    setAgentId(nextAgentId);
    setSavedAgentId(nextAgentId);
    setConfig(withConfigDefaults(versionToEdit?.config || fullFlow.config || createDefaultFlow()));
    applyFlowVersionMetadata(versionState || fullFlow, versionState?.versions || []);
    setEditorFlowVersion(versionToEdit ? Number(versionToEdit.version) : undefined);
    setSelectedStepId('');
    setSelectedEdgeId('');
    setSelectedNodeIds([]);
    setInlineEditing(null);
    setEdgeActionId('');
    setTestRuntimeMode(versionToEdit ? 'flowVersion' : 'draft');
    setTestAgentRelease('');
    setTestFlowVersion(versionToEdit ? String(versionToEdit.version) : '');
    setAgentTabFlowVersion(versionToEdit ? String(versionToEdit.version) : '');
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestConversationId('');
    setTestSlots({});
    setTestGraphRuntime(null);
    setTestMessages([{
      role: 'system',
      text: versionToEdit
        ? `Fluxo carregado na v${versionToEdit.version}${options.preferredVersionLabel ? ` (${options.preferredVersionLabel})` : ''}. Clique em Reiniciar para testar esta versão.`
        : 'Fluxo carregado. Clique em Reiniciar para testar este rascunho.',
    }]);
    setFlowConfigOpen(false);
  };

  const performSaveFlow = async () => {
    setSaving(true);
    try {
      const normalizedAgentId = agentId.trim() || 'default-agent';
      const currentEditorFlowVersion = editorFlowVersion;
      const payload = { name: flowName || config.title, agentId: normalizedAgentId, config: withConfigDefaults(config) };
      const saved = savedFlowId
        ? await canvasApi.updateFlow(savedFlowId, payload)
        : await canvasApi.createFlow(payload);
      const currentVersions = saved._id === savedFlowId ? flowVersions : [];
      const preferredVersion = pickPreferredFlowVersion(currentVersions, saved.activeVersion, currentEditorFlowVersion);
      setSavedFlowId(saved._id);
      setFlowName(saved.name);
      setAgentId(saved.agentId || normalizedAgentId);
      setSavedAgentId(saved.agentId || normalizedAgentId);
      setConfig(withConfigDefaults(saved.config));
      applyFlowVersionMetadata(saved, currentVersions);
      setEditorFlowVersion(preferredVersion ? Number(preferredVersion.version) : undefined);
      setTestFlowVersion(preferredVersion ? String(preferredVersion.version) : '');
      setAgentTabFlowVersion(preferredVersion ? String(preferredVersion.version) : '');
      setTestActiveFlowId('');
      setTestCurrentStepId('');
      setTestSlots({});
      await loadFlows();
      await loadAgents();
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const saveFlow = async () => {
    if (virtualDefaultAgent) {
      setConfirmDialog({
        title: 'Crie um agente primeiro',
        message: 'Este fluxo ainda nao tem um agente real selecionado. Crie ou selecione um agente antes de salvar para evitar criar default-agent automaticamente.',
        confirmLabel: 'Abrir agentes',
        variant: 'primary',
        onConfirm: () => {
          setAgentsOpen(true);
          void loadAgents();
        },
      });
      return;
    }
    if (agentChangedOnSavedFlow) {
      setConfirmDialog({
        title: 'Alterar agente do fluxo?',
        message: `Este fluxo estÃ¡ salvo no agente "${savedAgentId}". Ao salvar com "${agentId.trim()}", ele passa a aparecer na lista desse outro agente e deixa de aparecer em "${savedAgentId}".`,
        confirmLabel: 'Alterar agente e salvar',
        variant: 'primary',
        onConfirm: () => void performSaveFlow(),
      });
      return;
    }
    await performSaveFlow();
  };

  const applyVersionedFlowRecord = async (flow: CanvasFlowRecord, message?: string) => {
    const preferredVersion = pickPreferredFlowVersion(flow.versions || [], flow.activeVersion, flow.latestVersion);
    setSavedFlowId(flow._id);
    setFlowName(flow.name);
    setAgentId(flow.agentId || normalizedAgentId);
    setSavedAgentId(flow.agentId || normalizedAgentId);
    setConfig(withConfigDefaults(preferredVersion?.config || flow.config));
    applyFlowVersionMetadata(flow);
    setEditorFlowVersion(preferredVersion ? Number(preferredVersion.version) : undefined);
    setTestRuntimeMode(preferredVersion ? 'flowVersion' : 'draft');
    setTestFlowVersion(preferredVersion ? String(preferredVersion.version) : '');
    setAgentTabFlowVersion(preferredVersion ? String(preferredVersion.version) : '');
    if (message) {
      setFlowVersionMessage(message);
      window.setTimeout(() => setFlowVersionMessage(''), 2200);
    }
    await loadFlows(flow.agentId || normalizedAgentId);
    await loadAgentReleaseState(flow.agentId || normalizedAgentId);
  };

  const performDeployFlowVersion = async () => {
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const saved = await performSaveFlow();
      const targetFlowId = saved?._id || savedFlowId;
      if (!targetFlowId) throw new Error('Salve o fluxo antes de criar uma versao.');
      const deployed = await canvasApi.deployFlowVersion(targetFlowId, {
        notes: flowVersionNotes,
        activate: false,
      });
      setFlowVersionNotes('');
      await applyVersionedFlowRecord(deployed, `Versão v${deployed.latestVersion} criada para homologação.`);
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível criar a versão.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const deployFlowVersion = () => {
    if (virtualDefaultAgent) {
      setConfirmDialog({
        title: 'Crie um agente primeiro',
        message: 'Selecione ou crie um agente antes de criar uma versão do fluxo.',
        confirmLabel: 'Abrir agentes',
        variant: 'primary',
        onConfirm: () => {
          setAgentsOpen(true);
          void loadAgents();
        },
      });
      return;
    }
    if (agentChangedOnSavedFlow) {
      setConfirmDialog({
        title: 'Alterar agente e criar versão?',
        message: `Este fluxo está salvo no agente "${savedAgentId}". Para criar uma versão em "${agentId.trim()}", o fluxo será salvo nesse agente antes.`,
        confirmLabel: 'Salvar e criar versão',
        variant: 'primary',
        onConfirm: () => void performDeployFlowVersion(),
      });
      return;
    }
    void performDeployFlowVersion();
  };

  const activateFlowVersion = async (version: number) => {
    if (!savedFlowId || !version || flowVersionSaving) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const updated = await canvasApi.activateFlowVersion(savedFlowId, version);
      await applyVersionedFlowRecord(updated, `Versão v${version} ativada para clientes.`);
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível ativar a versão.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const requestActivateFlowVersion = (version: number) => {
    if (!version) return;
    setConfirmDialog({
      title: `Ativar v${version} para clientes?`,
      message: agentActiveRelease
        ? `Esta versão passa a ser usada em produção. O pacote ativo r${agentActiveRelease} será atualizado para apontar para a v${version}.`
        : 'Esta versão passa a ser usada em produção.',
      confirmLabel: `Ativar v${version}`,
      variant: 'primary',
      onConfirm: () => void activateFlowVersion(version),
    });
  };

  const loadFlowVersionIntoDraft = (version: CanvasFlowVersionRecord) => {
    if (!version?.config) {
      setFlowVersionError(`A versão v${version?.version || ''} não possui snapshot para carregar.`);
      return;
    }
    setConfig(withConfigDefaults(version.config));
    setEditorFlowVersion(Number(version.version));
    setSelectedStepId('');
    setSelectedEdgeId('');
    setSelectedNodeIds([]);
    setInlineEditing(null);
    setEdgeActionId('');
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestConversationId('');
    setTestSlots({});
    setTestGraphRuntime(null);
    setFlowVersionMessage(`v${version.version} carregada no editor. O botão principal agora publica as alterações nesta versão.`);
    window.setTimeout(() => setFlowVersionMessage(''), 3200);
  };

  const loadAgentReleaseFlowVersionIntoEditor = async (
    previewKey: string,
    release = selectedAgentTabReleaseRecord,
  ) => {
    const separatorIndex = previewKey.lastIndexOf(':');
    const flowId = previewKey.slice(0, separatorIndex);
    const flowVersion = Number(previewKey.slice(separatorIndex + 1));
    const releaseFlowVersion = Number(release?.versions?.[flowId] || 0);
    if (!release?.release || !flowId || !flowVersion) return;
    const isReleaseSnapshot = flowVersion === releaseFlowVersion;
    setAgentTabReleasePreviewKey(previewKey);
    setFlowVersionSwitchLoading(true);
    try {
      await loadFlow(flowId, {
        preferVersion: true,
        preferredVersion: flowVersion,
        preferredVersionLabel: isReleaseSnapshot ? `pacote r${release.release}` : 'histórico do fluxo',
      });
      setAgentTabAgentRelease(String(release.release));
      setAgentTabReleasePreviewKey(previewKey);
      if (isReleaseSnapshot) {
        setTestAgentRelease(String(release.release));
        setTestRuntimeMode('agentVersion');
      } else {
        setTestFlowVersion(String(flowVersion));
        setTestRuntimeMode('flowVersion');
      }
    } finally {
      setFlowVersionSwitchLoading(false);
    }
  };

  const handleAgentTabAgentReleaseChange = (value: string) => {
    setAgentTabAgentRelease(value);
    setTestAgentRelease(value);
    if (value) setTestRuntimeMode('agentVersion');
    const release = sortedAgentReleases.find((item) => String(item.release) === value);
    const firstFlow = getAgentReleaseSnapshotOptions(release, flows)[0];
    const firstPreviewKey = firstFlow ? `${firstFlow.id}:${firstFlow.version}` : '';
    setAgentTabReleasePreviewKey(firstPreviewKey);
    if (firstPreviewKey) void loadAgentReleaseFlowVersionIntoEditor(firstPreviewKey, release);
  };

  const handleAgentTabFlowVersionChange = (value: string) => {
    setAgentTabFlowVersion(value);
    setTestFlowVersion(value);
    if (value) setTestRuntimeMode('flowVersion');
    const version = sortedFlowVersions.find((item) => String(item.version) === value);
    if (version) loadFlowVersionIntoDraft(version);
  };

  const overwriteFlowVersion = async (target: Exclude<VersionOverwriteTarget, null>, sourceVersion?: number) => {
    if (!savedFlowId || !target?.version || flowVersionSaving) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const updated = await canvasApi.overwriteFlowVersion(
        savedFlowId,
        target.version,
        sourceVersion
          ? { sourceVersion, name: target.currentName }
          : { config: withConfigDefaults(config), name: target.currentName },
      );
      applyFlowVersionMetadata(updated);
      setFlowVersionMessage(sourceVersion
        ? `v${target.version} publicada com a v${sourceVersion}.`
        : `v${target.version} publicada com o rascunho atual.`);
      window.setTimeout(() => setFlowVersionMessage(''), 3000);
      await loadFlows(updated.agentId || normalizedAgentId);
      await loadAgentReleaseState(updated.agentId || normalizedAgentId);
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível publicar a versão.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const saveEditorChanges = async () => {
    if (primarySaveTargetVersionRecord && savedFlowId) {
      const target = {
        kind: 'flow',
        version: primarySaveTargetVersionRecord.version,
        isActive: Number(primarySaveTargetVersionRecord.version) === Number(productionFlowVersion),
        currentName: primarySaveTargetVersionRecord.name || '',
      } satisfies Exclude<VersionOverwriteTarget, null>;
      if (!editorFlowVersionRecord) {
        setEditorFlowVersion(Number(primarySaveTargetVersionRecord.version));
        setTestFlowVersion(String(primarySaveTargetVersionRecord.version));
        setAgentTabFlowVersion(String(primarySaveTargetVersionRecord.version));
      }
      if (target.isActive) {
        setConfirmDialog({
          title: `Publicar em produção v${target.version}?`,
          message: 'Esta versão está ativa para clientes. Publicar agora altera imediatamente o fluxo usado em produção.',
          confirmLabel: `Publicar v${target.version}`,
          variant: 'danger',
          confirmationText: `v${target.version}`,
          confirmationPrompt: `Digite v${target.version} para confirmar a publicação em produção.`,
          onConfirm: () => void overwriteFlowVersion(target),
        });
        return;
      }
      await overwriteFlowVersion(target);
      return;
    }
    await performDeployFlowVersion();
  };

  const overwriteAgentVersion = async (target: Exclude<VersionOverwriteTarget, null>, sourceRelease?: number) => {
    if (!target?.version || flowVersionSaving || virtualDefaultAgent) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      if (!sourceRelease) {
        await performSaveFlow();
      }
      const result = await canvasApi.overwriteAgentRelease(
        normalizedAgentId,
        target.version,
        sourceRelease ? { sourceRelease, name: target.currentName } : { name: target.currentName },
      );
      applyAgentReleaseMetadata(result);
      setFlowVersionMessage(sourceRelease
        ? `r${target.version} sobrescrita com a r${sourceRelease}.`
        : `r${target.version} atualizada com as últimas versões criadas dos fluxos.`);
      window.setTimeout(() => setFlowVersionMessage(''), 3000);
      await loadAgents();
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível sobrescrever a versão do agente.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const openVersionOverwrite = (target: Exclude<VersionOverwriteTarget, null>) => {
    setVersionOverwriteTarget(target);
    setVersionOverwriteSource('draft');
    setVersionOverwriteSourceVersion('');
    setVersionOverwriteError('');
  };

  const closeVersionOverwrite = () => {
    setVersionOverwriteTarget(null);
    setVersionOverwriteSource('draft');
    setVersionOverwriteSourceVersion('');
    setVersionOverwriteError('');
  };

  const saveVersionOverwrite = async () => {
    if (!versionOverwriteTarget || flowVersionSaving) return;
    const sourceVersion = versionOverwriteSource === 'version' ? overwriteSourceNumber : undefined;
    if (versionOverwriteSource === 'version' && !sourceVersion) {
      setVersionOverwriteError('Selecione a versão de origem.');
      return;
    }
    closeVersionOverwrite();
    if (versionOverwriteTarget.kind === 'agent') {
      await overwriteAgentVersion(versionOverwriteTarget, sourceVersion);
    } else {
      await overwriteFlowVersion(versionOverwriteTarget, sourceVersion);
    }
  };

  const deleteFlowVersion = async (version: CanvasFlowVersionRecord) => {
    if (!savedFlowId || !version?.version || flowVersionSaving) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const updated = await canvasApi.deleteFlowVersion(savedFlowId, version.version);
      applyFlowVersionMetadata(updated);
      const preferredVersion = pickPreferredFlowVersion(updated.versions || [], updated.activeVersion, editorFlowVersion);
      if (preferredVersion) {
        setEditorFlowVersion(Number(preferredVersion.version));
        setTestFlowVersion(String(preferredVersion.version));
        setAgentTabFlowVersion(String(preferredVersion.version));
        setConfig(withConfigDefaults(preferredVersion.config || updated.config));
      } else {
        setEditorFlowVersion(undefined);
        setTestFlowVersion('');
        setAgentTabFlowVersion('');
      }
      setFlowVersionMessage(`v${version.version} excluída.`);
      window.setTimeout(() => setFlowVersionMessage(''), 2600);
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível excluir a versão do fluxo.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const requestDeleteFlowVersion = (version: CanvasFlowVersionRecord) => {
    const token = `v${version.version}`;
    setConfirmDialog({
      title: `Excluir ${token}?`,
      message: 'Esta ação remove definitivamente esta versão do fluxo. Para excluir uma versão ativa, ative outra versão antes.',
      confirmLabel: `Excluir ${token}`,
      variant: 'danger',
      confirmationText: token,
      confirmationPrompt: `Digite ${token} para confirmar.`,
      onConfirm: () => void deleteFlowVersion(version),
    });
  };

  const openVersionRename = (target: Exclude<VersionRenameTarget, null>) => {
    setVersionRenameTarget(target);
    setVersionRenameDraft(target.currentName || '');
    setVersionRenameError('');
  };

  const closeVersionRename = () => {
    setVersionRenameTarget(null);
    setVersionRenameDraft('');
    setVersionRenameError('');
  };

  const saveVersionRename = async () => {
    if (!versionRenameTarget || versionRenameSaving) return;
    const name = versionRenameDraft.trim();
    if (!name) {
      setVersionRenameError('Informe um nome para a versão.');
      return;
    }

    setVersionRenameSaving(true);
    setVersionRenameError('');
    try {
      if (versionRenameTarget.kind === 'agent') {
        const result = await canvasApi.renameAgentRelease(normalizedAgentId, versionRenameTarget.version, { name });
        applyAgentReleaseMetadata(result);
        setFlowVersionMessage(`Versão do agente r${versionRenameTarget.version} renomeada para "${name}".`);
      } else {
        if (!savedFlowId) throw new Error('Salve o fluxo antes de renomear a versão.');
        const updated = await canvasApi.renameFlowVersion(savedFlowId, versionRenameTarget.version, { name });
        applyFlowVersionMetadata(updated);
        setFlowVersionMessage(`Versão do fluxo v${versionRenameTarget.version} renomeada para "${name}".`);
      }
      window.setTimeout(() => setFlowVersionMessage(''), 2600);
      closeVersionRename();
    } catch (error) {
      setVersionRenameError(error instanceof Error ? error.message : 'Não foi possível renomear a versão.');
    } finally {
      setVersionRenameSaving(false);
    }
  };

  const deployAgentRelease = async () => {
    if (virtualDefaultAgent) {
      setConfirmDialog({
        title: 'Crie um agente primeiro',
        message: 'Selecione ou crie um agente antes de criar uma release do agente.',
        confirmLabel: 'Abrir agentes',
        variant: 'primary',
        onConfirm: () => {
          setAgentsOpen(true);
          void loadAgents();
        },
      });
      return;
    }

    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const saved = await performSaveFlow();
      const currentFlowId = saved?._id || savedFlowId;
      const result = await canvasApi.deployAgentRelease(normalizedAgentId, {
        notes: agentReleaseNotes,
        activate: false,
      });
      applyAgentReleaseMetadata(result);
      if (result.release?.release) {
        setAgentTabAgentRelease(String(result.release.release));
        setTestAgentRelease(String(result.release.release));
        setTestRuntimeMode('agentVersion');
      }
      const currentFlowVersion = currentFlowId && result.release?.versions
        ? result.release.versions[currentFlowId]
        : undefined;
      if (currentFlowVersion) {
        setAgentTabFlowVersion(String(currentFlowVersion));
        setTestFlowVersion(String(currentFlowVersion));
      }
      if (currentFlowId) {
        const refreshedFlow = await canvasApi.getFlow(currentFlowId);
        const refreshedVersionState = await canvasApi.getFlowVersions(currentFlowId).catch(() => null);
        const currentFlowVersionRecord = currentFlowVersion
          ? (refreshedVersionState?.versions || []).find((version) => Number(version.version) === Number(currentFlowVersion))
          : undefined;
        setSavedFlowId(refreshedFlow._id);
        setFlowName(refreshedFlow.name);
        setAgentId(refreshedFlow.agentId || normalizedAgentId);
        setSavedAgentId(refreshedFlow.agentId || normalizedAgentId);
        setConfig(withConfigDefaults(currentFlowVersionRecord?.config || refreshedFlow.config));
        applyFlowVersionMetadata(refreshedVersionState || refreshedFlow, refreshedVersionState?.versions || []);
        setEditorFlowVersion(currentFlowVersionRecord ? Number(currentFlowVersionRecord.version) : undefined);
      }
      setAgentReleaseNotes('');
      setFlowVersionMessage(`Pacote r${result.release?.release} criado para homologação usando as últimas versões dos fluxos.`);
      await loadAgents();
      await loadFlows(normalizedAgentId);
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível criar a versão do agente.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const activateAgentRelease = async (release: number) => {
    if (!release || flowVersionSaving || virtualDefaultAgent) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const result = await canvasApi.activateAgentRelease(normalizedAgentId, release);
      applyAgentReleaseMetadata(result);
      setFlowVersionMessage(`Versão do agente r${release} ativada para clientes.`);
      await loadAgents();
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível ativar a versão do agente.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const requestActivateAgentRelease = (release: number) => {
    if (!release) return;
    setConfirmDialog({
      title: `Ativar pacote r${release} para clientes?`,
      message: 'Este pacote passa a ser o padrão de produção do agente. Chamadas sem override usarão as versões dos fluxos deste pacote.',
      confirmLabel: `Ativar r${release}`,
      variant: 'primary',
      onConfirm: () => void activateAgentRelease(release),
    });
  };

  const deleteAgentRelease = async (release: number) => {
    if (!release || flowVersionSaving || virtualDefaultAgent) return;
    setFlowVersionSaving(true);
    setFlowVersionError('');
    setFlowVersionMessage('');
    try {
      const result = await canvasApi.deleteAgentRelease(normalizedAgentId, release);
      applyAgentReleaseMetadata(result);
      setFlowVersionMessage(`Versão do agente r${release} excluída.`);
      window.setTimeout(() => setFlowVersionMessage(''), 2600);
      await loadAgents();
    } catch (error) {
      setFlowVersionError(error instanceof Error ? error.message : 'Não foi possível excluir a versão do agente.');
    } finally {
      setFlowVersionSaving(false);
    }
  };

  const requestDeleteAgentRelease = (release: number) => {
    const token = `r${release}`;
    setConfirmDialog({
      title: `Excluir ${token}?`,
      message: 'Esta ação remove definitivamente esta versão do agente. Para excluir uma versão ativa, ative outra versão antes.',
      confirmLabel: `Excluir ${token}`,
      variant: 'danger',
      confirmationText: token,
      confirmationPrompt: `Digite ${token} para confirmar.`,
      onConfirm: () => void deleteAgentRelease(release),
    });
  };

  const createNewFlowDraft = async (nextAgentId = agentId, existingFlows = flows) => {
    const scopedAgentId = nextAgentId.trim();
    if (scopedAgentId && scopedAgentId !== 'default-agent') {
      const nextName = createNextFlowName(existingFlows);
      const nextConfig = withConfigDefaults({
        ...createEmptyFlow(),
        title: nextName,
      });
      const saved = await canvasApi.createFlow({
        name: nextName,
        agentId: scopedAgentId,
        config: nextConfig,
      });
      const versioned = await canvasApi.deployFlowVersion(saved._id, {
        notes: 'Versão inicial criada automaticamente.',
        activate: false,
      });
      await loadFlows(scopedAgentId);
      await loadAgents();
      await loadFlow(versioned, { preferVersion: true, preferredVersion: versioned.latestVersion });
      setTestMessages([{ role: 'system', text: `Fluxo criado e atrelado à v${versioned.latestVersion}. Clique em Reiniciar para testar esta versão.` }]);
      return versioned;
    }

    const nextConfig = createEmptyFlow();
    setSavedFlowId('');
    setSavedAgentId('');
    applyFlowVersionMetadata(null);
    setEditorFlowVersion(undefined);
    setAgentId(scopedAgentId || 'default-agent');
    setFlowName(nextConfig.title || 'Fluxo IA Gen');
    setConfig(nextConfig);
    setSelectedStepId('');
    setSelectedEdgeId('');
    setEdgeActionId('');
    setFlowConfigOpen(false);
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestConversationId('');
    setTestSlots({});
    setTestGraphRuntime(null);
    setTestMessages([{ role: 'system', text: 'Selecione um agente antes de criar um fluxo.' }]);
    return null;
  };

  const enterAgent = async (agentIdentifier: string) => {
    const nextAgentId = agentIdentifier.trim() || 'default-agent';
    setAgentId(nextAgentId);
    const nextFlows = await loadFlows(nextAgentId);
    const releaseState = await loadAgentReleaseState(nextAgentId);
    setAgentsOpen(false);
    setAgentSearch('');
    if (nextFlows[0]) {
      const activeRelease = releaseState?.releases?.find((release) => Number(release.release) === Number(releaseState.activeRelease));
      const releaseVersion = activeRelease?.versions
        ? Number(activeRelease.versions[nextFlows[0]._id] || 0)
        : 0;
      await loadFlow(nextFlows[0], {
        preferVersion: true,
        preferredVersion: releaseVersion,
        preferredVersionLabel: releaseVersion && releaseState?.activeRelease ? `pacote r${releaseState.activeRelease}` : undefined,
      });
    } else {
      await createNewFlowDraft(nextAgentId, nextFlows);
    }
  };

  const openAgentStudioForAgent = async (agent: CanvasFlowAgentRecord) => {
    const nextAgentId = getAgentRecordId(agent);
    setAgentStudioError('');
    setAgentStudioMessage('');
    if (nextAgentId && nextAgentId !== normalizedAgentId) {
      await enterAgent(nextAgentId);
    } else {
      applyAgentProfileToConfig(getAgentProfileConfig(agent, config));
    }
    setAgentsOpen(false);
    setAgentStudioOpen(true);
  };

  const moveAgentToTarget = (sourceAgentId: string, targetAgentId: string) => {
    if (!sourceAgentId || !targetAgentId || sourceAgentId === targetAgentId) return;
    setAgents((current) => {
      const byId = new Map<string, CanvasFlowAgentRecord>();
      current.forEach((agent) => byId.set(getAgentRecordId(agent), agent));
      [sourceAgentId, targetAgentId, normalizedAgentId].forEach((id) => {
        if (!id || byId.has(id)) return;
        byId.set(id, { agentId: id, name: id, flowCount: id === normalizedAgentId ? flows.length : 0 });
      });
      const nextAgents = Array.from(byId.values());
      const fromIndex = nextAgents.findIndex((agent) => getAgentRecordId(agent) === sourceAgentId);
      const toIndex = nextAgents.findIndex((agent) => getAgentRecordId(agent) === targetAgentId);
      return reorderByIndex(nextAgents, fromIndex, toIndex);
    });
  };

  const saveAgentOrder = async () => {
    setAgentOrderSaving(true);
    setAgentsError('');
    try {
      const ordered = await canvasApi.reorderAgents(visibleAgents.map((agent) => getAgentRecordId(agent)));
      setAgents(ordered);
    } catch (error) {
      setAgentsError(error instanceof Error ? error.message : 'Nao foi possivel salvar a ordem dos agentes.');
    } finally {
      setAgentOrderSaving(false);
    }
  };

  const createAgent = async () => {
    const name = agentCreateName.trim();
    if (!name || agentsLoading) return;
    setAgentsLoading(true);
    setAgentsError('');
    try {
      const created = await canvasApi.createAgent({ name });
      setAgentCreateName('');
      await loadAgents();
      await enterAgent(created?.agentId || created?.name || name);
    } catch (error) {
      setAgentsError(error instanceof Error ? error.message : 'Nao foi possivel criar o agente.');
    } finally {
      setAgentsLoading(false);
    }
  };

  const startAgentRename = (agent: CanvasFlowAgentRecord) => {
    setAgentEditingName(getAgentRecordId(agent));
    setAgentEditingDraft(getAgentRecordName(agent));
    setAgentsError('');
  };

  const saveAgentRename = async () => {
    const from = agentEditingName.trim();
    const to = agentEditingDraft.trim();
    const currentName = getAgentRecordName(agents.find((agent) => getAgentRecordId(agent) === from));
    if (!from || !to || currentName === to || agentsLoading) {
      setAgentEditingName('');
      setAgentEditingDraft('');
      return;
    }
    setAgentsLoading(true);
    setAgentsError('');
    try {
      await canvasApi.renameAgent(from, { name: to });
      setAgentEditingName('');
      setAgentEditingDraft('');
      await loadAgents();
      await loadFlows(normalizedAgentId);
    } catch (error) {
      setAgentsError(error instanceof Error ? error.message : 'Nao foi possivel renomear o agente.');
    } finally {
      setAgentsLoading(false);
    }
  };

  const requestAgentDelete = (agent: CanvasFlowAgentRecord) => {
    setAgentDeleteTarget(agent);
    setAgentDeleteConfirm('');
    setAgentsError('');
  };

  const deleteAgent = async () => {
    if (!agentDeleteTarget) return;
    const target = getAgentRecordId(agentDeleteTarget);
    const targetName = getAgentRecordName(agentDeleteTarget);
    if (!target || agentDeleteConfirm.trim() !== targetName || agentsLoading) return;

    setAgentsLoading(true);
    setAgentsError('');
    try {
      const result = await canvasApi.deleteAgent(target, { confirmationName: agentDeleteConfirm.trim() });
      setAgents(result.agents || []);
      setAgentDeleteTarget(null);
      setAgentDeleteConfirm('');

      if (normalizedAgentId === target) {
        const nextAgent = getAgentRecordId((result.agents || []).find((agent) => getAgentRecordId(agent) !== target)) || 'default-agent';
        setAgentId(nextAgent);
        const nextFlows = await loadFlows(nextAgent);
        const releaseState = await loadAgentReleaseState(nextAgent);
        if (nextFlows[0]) {
          const activeRelease = releaseState?.releases?.find((release) => Number(release.release) === Number(releaseState.activeRelease));
          const releaseVersion = activeRelease?.versions
            ? Number(activeRelease.versions[nextFlows[0]._id] || 0)
            : 0;
          await loadFlow(nextFlows[0], {
            preferVersion: true,
            preferredVersion: releaseVersion,
            preferredVersionLabel: releaseVersion && releaseState?.activeRelease ? `pacote r${releaseState.activeRelease}` : undefined,
          });
        } else {
          await createNewFlowDraft(nextAgent, nextFlows);
        }
      } else {
        await loadAgents();
        await loadFlows(normalizedAgentId);
      }
    } catch (error) {
      setAgentsError(error instanceof Error ? error.message : 'Nao foi possivel excluir o agente.');
    } finally {
      setAgentsLoading(false);
    }
  };

  const duplicateCurrentFlow = async () => {
    setSaving(true);
    try {
      const duplicateName = `${flowName || config.title || 'Fluxo'} copia`;
      const duplicateConfig = withConfigDefaults({
        ...JSON.parse(JSON.stringify(config)),
        title: `${config.title || 'Fluxo'} copia`,
        isMainFlow: false,
      });
      const saved = await canvasApi.createFlow({
        name: duplicateName,
        agentId,
        config: duplicateConfig,
      });
      const versioned = await canvasApi.deployFlowVersion(saved._id, {
        notes: 'Versão inicial criada automaticamente a partir da cópia.',
        activate: false,
      });
      await loadFlow(versioned, { preferVersion: true, preferredVersion: versioned.latestVersion });
      setTestActiveFlowId('');
      setTestCurrentStepId('');
      setTestSlots({});
      await loadFlows();
      await loadAgents();
    } finally {
      setSaving(false);
    }
  };

  const performDeleteCurrentFlow = async () => {
    if (!savedFlowId) return;

    const deletingFlowId = savedFlowId;
    const deletingAgentId = normalizedAgentId;
    setSaving(true);
    try {
      await canvasApi.deleteFlow(deletingFlowId);
      const nextFlows = await loadFlows(deletingAgentId);
      await loadAgents();
      await loadAgentReleaseState(deletingAgentId);

      if (nextFlows[0]) {
        await loadFlow(nextFlows[0]);
      } else {
        await createNewFlowDraft(deletingAgentId, nextFlows);
      }
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteCurrentFlow = () => {
    if (!savedFlowId) return;
    setConfirmDialog({
      title: 'Excluir fluxo?',
      message: `Deseja realmente excluir o fluxo "${flowName || 'sem nome'}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir fluxo',
      onConfirm: () => void performDeleteCurrentFlow(),
    });
  };

  const runTestFlowRequest = async (
    payload: Record<string, unknown>,
    onMessage: (message: TestMessage) => void,
  ): Promise<Awaited<ReturnType<typeof canvasApi.testFlow>>> => {
    const apiWithStream = canvasApi as typeof canvasApi & {
      streamTestFlow?: (
        payload: Record<string, unknown>,
        onMessage: (message: TestMessage) => void,
      ) => Promise<Awaited<ReturnType<typeof canvasApi.testFlow>>>;
    };

    if (typeof apiWithStream.streamTestFlow === 'function') {
      return apiWithStream.streamTestFlow(payload, onMessage);
    }

    const result = await canvasApi.testFlow(payload);
    for (const message of result.messages || []) {
      const delayMs = Math.max(0, Number(message.delayBeforeMs || 0));
      if (delayMs) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
      }
      onMessage(message);
    }
    return { ...result, messages: [] };
  };

  const withTestRuntimePayload = (payload: Record<string, unknown>) => {
    if (testRuntimeMode === 'active' && savedFlowId) {
      return payload;
    }
    if (testRuntimeMode === 'agentVersion' && savedFlowId && selectedTestAgentRelease) {
      return { ...payload, agentRelease: selectedTestAgentRelease };
    }
    if (testRuntimeMode === 'flowVersion' && savedFlowId && selectedTestFlowVersion) {
      return { ...payload, ignoreAgentRelease: true, flowVersionMap: { [savedFlowId]: selectedTestFlowVersion } };
    }
    return { ...payload, config };
  };

  const resetTest = async () => {
    if (testNeedsVersionSelection) {
      setTestTrace([]);
      setTestTracePage(null);
      setTestMessages([{ role: 'system', text: 'Selecione uma versão para iniciar o teste.' }]);
      return;
    }
    setTestLoading(true);
    const conversationId = `canvas-flow-test-${Date.now()}`;
    setTestActiveFlowId('');
    setTestCurrentStepId('');
    setTestSlots({});
    setTestTrace([]);
    setTestTracePage(null);
    setTestMessages([]);
    try {
      let streamedMessages = 0;
      const result = await runTestFlowRequest(withTestRuntimePayload({
        flowId: savedFlowId || undefined,
        agentId: normalizedAgentId,
        channel,
        conversationId,
        text: '',
        slots: {},
        traceMode: 'debug',
        traceLimit: 200,
        traceCollectLimit: 1200,
      }), (message) => {
        streamedMessages += 1;
        setTestMessages((current) => [...current, message]);
      });
      setTestConversationId(result.conversationId || conversationId);
      setTestCurrentStepId(result.currentStepId || '');
      setTestActiveFlowId(result.activeFlowId || savedFlowId || '');
      setTestSlots(result.slots || {});
      setTestTrace(result.trace || []);
      setTestTracePage(result.tracePage || null);
      setTestGraphRuntime(result.runtime || null);
      if (!streamedMessages && !result.messages?.length) {
        setTestMessages([{ role: 'system', text: 'Fluxo iniciado.' }]);
      } else if (result.messages?.length) {
        setTestMessages((current) => [...current, ...(result.messages || [])]);
      }
      setOpenDebugMessages({});
    } catch (error: any) {
      setTestMessages([{ role: 'system', text: error?.message || 'Falha ao iniciar teste.' }]);
      setOpenDebugMessages({});
    } finally {
      setTestLoading(false);
    }
  };

  const runTestMessage = async (rawMessage: string, displayMessage?: string) => {
    const userMessage = rawMessage.trim();
    if (!userMessage || testLoading || testNeedsVersionSelection) return;
    setTestMessages((current) => [...current, { role: 'user', text: (displayMessage || userMessage).trim() || userMessage }]);
    setTestLoading(true);
    try {
      const result = await runTestFlowRequest(withTestRuntimePayload({
        flowId: savedFlowId || undefined,
        activeFlowId: testActiveFlowId || savedFlowId || undefined,
        entryFlowId: savedFlowId || undefined,
        agentId: normalizedAgentId,
        channel,
        conversationId: testConversationId || `canvas-flow-test-${Date.now()}`,
        currentStepId: testCurrentStepId || undefined,
        text: userMessage,
        slots: testSlots,
        traceMode: 'debug',
        traceLimit: 200,
        traceCollectLimit: 1200,
      }), (message) => {
        setTestMessages((current) => [...current, message]);
      });
      setTestConversationId(result.conversationId || testConversationId);
      setTestCurrentStepId(result.currentStepId || '');
      setTestActiveFlowId(result.activeFlowId || testActiveFlowId || savedFlowId || '');
      setTestSlots(result.slots || {});
      setTestTrace(result.trace || []);
      setTestTracePage(result.tracePage || null);
      setTestGraphRuntime(result.runtime || null);
      if (result.messages?.length) {
        setTestMessages((current) => [...current, ...(result.messages || [])]);
      }
    } catch (error: any) {
      setTestMessages((current) => [...current, { role: 'system', text: error?.message || 'Falha no teste.' }]);
    } finally {
      setTestLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testInput.trim() || testLoading) return;
    const userMessage = testInput.trim();
    setTestInput('');
    await runTestMessage(userMessage);
  };

  const sendRichInteraction = async (value: string, label: string) => {
    await runTestMessage(value, label);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  };

  const copyVariableTemplate = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedVariable(value);
    window.setTimeout(() => setCopiedVariable((current) => (current === value ? '' : current)), 1400);
  };

  const copyFlowExport = async () => {
    await navigator.clipboard.writeText(flowExportJson);
    setFlowImportMessage('JSON do fluxo copiado.');
    window.setTimeout(() => setFlowImportMessage(''), 1800);
  };

  const downloadFlowExport = () => {
    const blob = new Blob([flowExportJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(flowName || config.title || 'fluxo')}.canvas-flow.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFlowImportMessage('Arquivo de exportação gerado.');
    window.setTimeout(() => setFlowImportMessage(''), 1800);
  };

  const applyImportedFlow = (raw: string) => {
    setFlowImportError('');
    setFlowImportMessage('');
    try {
      const parsed = JSON.parse(raw);
      const imported = parseImportedFlow(parsed);
      setSavedFlowId('');
      setSavedAgentId('');
      applyFlowVersionMetadata(null);
      setEditorFlowVersion(undefined);
      if (imported.agentId) setAgentId(imported.agentId);
      setFlowName(imported.name);
      setConfig(imported.config);
      setSelectedStepId('');
      setSelectedEdgeId('');
      setEdgeActionId('');
      setFlowConfigOpen(false);
      setTestActiveFlowId('');
      setTestCurrentStepId('');
      setTestConversationId('');
      setTestSlots({});
      setTestGraphRuntime(null);
      setTestMessages([{ role: 'system', text: 'Fluxo importado como rascunho. Clique em Salvar para criar o registro.' }]);
      setFlowImportText('');
      setFlowImportMessage('Fluxo importado como rascunho. Revise e clique em Salvar.');
      setFlowImportExportOpen(false);
    } catch (error) {
      setFlowImportError(error instanceof Error ? error.message : 'Não foi possível importar o fluxo.');
    }
  };

  const importFlowFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setFlowImportText(text);
      applyImportedFlow(text);
    } catch (error) {
      setFlowImportError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    }
  };

  const refreshCronLog = useCallback(async (stepId: string) => {
    if (!savedFlowId) return;
    const saved = await canvasApi.getFlow(savedFlowId);
    const savedStep = saved.config?.steps?.find((step) => step.id === stepId);
    if (savedStep?.component?.type !== 'cron') return;

    setConfig((current) => ({
      ...current,
      steps: current.steps.map((step) => {
        if (step.id !== stepId || step.component?.type !== 'cron') return step;
        return {
          ...step,
          component: {
            ...step.component,
            cronLastRunAt: savedStep.component?.cronLastRunAt,
            cronNextRunAt: savedStep.component?.cronNextRunAt,
            cronExecutionLog: savedStep.component?.cronExecutionLog || [],
          },
        };
      }),
    }));
  }, [savedFlowId]);

  const actionEdgeSource = actionEdge ? config.steps.find((step) => step.id === actionEdge.source) : undefined;
  const actionEdgeTarget = actionEdge ? config.steps.find((step) => step.id === actionEdge.target) : undefined;
  const tagHistoryPagination = (tagDashboard?.historyPagination || {}) as Record<string, any>;
  const tagHistoryPage = Number(tagHistoryPagination.page || tagDashboardHistoryPage || 1);
  const tagHistoryLimit = Number(tagHistoryPagination.limit || tagDashboardHistoryLimit || 50);
  const tagHistoryTotal = Number(tagHistoryPagination.total || 0);
  const tagHistoryTotalPages = Math.max(1, Number(tagHistoryPagination.totalPages || (tagHistoryTotal ? Math.ceil(tagHistoryTotal / tagHistoryLimit) : 1)));
  const tagHistoryStart = tagHistoryTotal > 0 ? ((tagHistoryPage - 1) * tagHistoryLimit) + 1 : 0;
  const tagHistoryEnd = tagHistoryTotal > 0 ? Math.min(tagHistoryTotal, tagHistoryPage * tagHistoryLimit) : 0;
  const tagDashboardSeries = getTagDashboardSeries(tagDashboard);
  const tagDashboardInsights = (tagDashboard?.insights || {}) as Record<string, any>;
  const tagDashboardTrace = (tagDashboard?.traceInsights || {}) as Record<string, any>;
  const insightFlowSeries = toDashboardSeries(tagDashboardInsights.byFlow, ['flowName', 'flowId']);
  const insightChannelSeries = toDashboardSeries(tagDashboardInsights.byChannel, ['channel']);
  const traceNodeSeries = toDashboardSeries(tagDashboardTrace.byStep, ['title', 'key']);
  const traceCallSeries = toDashboardSeries(tagDashboardTrace.calls, ['key']);
  const agentOpsSummary = (agentOpsDashboard?.summary || {}) as Record<string, any>;
  const agentOpsQueue = (agentOpsDashboard?.queue || {}) as Record<string, any>;
  const agentOpsTrace = (agentOpsDashboard?.traceInsights || {}) as Record<string, any>;
  const agentOpsCapabilities = (agentOpsDashboard?.capabilities || {}) as Record<string, any>;
  const agentOpsReadiness = Array.isArray(agentOpsDashboard?.readiness?.warnings) ? agentOpsDashboard?.readiness?.warnings : [];
  const agentOpsHotNodes = Array.isArray(agentOpsDashboard?.hotNodes) ? agentOpsDashboard?.hotNodes : [];
  const agentOpsErrors = Array.isArray(agentOpsDashboard?.errors) ? agentOpsDashboard?.errors : [];
  const agentOpsFlows = Array.isArray(agentOpsDashboard?.flows) ? agentOpsDashboard?.flows : [];
  const agentOpsReleases = (agentOpsDashboard?.releases || {}) as Record<string, any>;
  const agentOpsReleaseItems = Array.isArray(agentOpsReleases.items)
    ? agentOpsReleases.items
    : Array.isArray(agentOpsReleases.releases)
      ? agentOpsReleases.releases
      : [];

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="header-title-block">
            <h1>{editorBlockedByMissingAgent ? 'Nenhum fluxo aberto' : flowName || config.title}</h1>
            <span>{agentDisplayName}</span>
          </div>
          <div className="header-actions">
            <label className={`header-field agent-field ${agentChangedOnSavedFlow ? 'agent-changed' : ''}`}>
              <span>Agente</span>
              <button
                type="button"
                className="agent-select-button"
                onClick={() => {
                  setAgentsOpen(true);
                  void loadAgents();
                }}
                title="Abrir agentes"
              >
                <Bot size={15} />
                <strong>{agentDisplayName}</strong>
                <ChevronDown size={14} />
              </button>
            </label>
            <label className="header-field agent-os-field">
              <span>Agent OS</span>
              <button
                type="button"
                disabled={editorBlockedByMissingAgent}
                onClick={() => openAgentStudio()}
                title="Configurar modelo, skills, subagents, rules, MCP e guardrails do agente"
              >
                <ShieldCheck size={16} />
                Perfil
              </button>
            </label>
            <label className="header-field channel-field">
              <span>Canal</span>
              <select
                className="channel-select"
                value={channel}
                aria-label="Canal"
                disabled={editorBlockedByMissingAgent}
                onChange={(event) => updateConfig({ channel: event.target.value as FlowChannel })}
              >
                <option value="webWidget">Web widget</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label className="header-field header-action-field">
              <span className="header-spacer-label" aria-hidden="true">&nbsp;</span>
              <div className="header-actions-menu" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
                  setHeaderActionsOpen(false);
                }
              }}>
                <button type="button" onClick={() => setHeaderActionsOpen((open) => !open)}>
                  <Ellipsis size={16} />
                  Ações
                  <ChevronDown size={14} />
                </button>
                {headerActionsOpen && (
                  <div className="header-actions-dropdown">
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); void loadFlows(); }} disabled={editorBlockedByMissingAgent || loadingFlows}>
                    {loadingFlows ? <Loader2 size={16} className="spin" /> : <ChevronDown size={16} />}
                    Atualizar fluxos
                  </button>
                  <button type="button" onClick={() => void openFlowOrder()} disabled={editorBlockedByMissingAgent || loadingFlows}>
                    <ArrowUpDown size={16} />
                    Fluxos do agente
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); duplicateCurrentFlow(); }} disabled={saving || editorBlockedByMissingAgent}>
                    <Copy size={16} />
                    Duplicar fluxo
                  </button>
                  <button type="button" className="danger-button" onClick={() => { setHeaderActionsOpen(false); requestDeleteCurrentFlow(); }} disabled={!savedFlowId || saving}>
                    <Trash2 size={16} />
                    Excluir fluxo
                  </button>
                  <div className="header-actions-separator" />
                  <button
                    type="button"
                    disabled={editorBlockedByMissingAgent}
                    onClick={() => {
                      setHeaderActionsOpen(false);
                      setSelectedStepId('');
                      setSelectedEdgeId('');
                      setEdgeActionId('');
                      setFlowConfigOpen(true);
                    }}
                  >
                    <Settings size={16} />
                    Config Padrão
                  </button>
                  <button
                    type="button"
                    disabled={editorBlockedByMissingAgent}
                    onClick={() => {
                      setHeaderActionsOpen(false);
                      openAgentStudio();
                    }}
                  >
                    <ShieldCheck size={16} />
                    Agent OS
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); setProviderConfigOpen(true); }}>
                    <Database size={16} />
                    Provedores
                  </button>
                  <button type="button" onClick={() => void openTagDashboard()} disabled={editorBlockedByMissingAgent}>
                    <BarChart3 size={16} />
                    Dashboard
                  </button>
                  <button type="button" onClick={() => void openAgentOpsDashboard()} disabled={editorBlockedByMissingAgent}>
                    <LineChart size={16} />
                    AgentOps
                  </button>
                  <button type="button" onClick={openSimulation} disabled={editorBlockedByMissingAgent}>
                    <Play size={16} />
                    Simular/Evals
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); setJsonOpen(true); }} disabled={editorBlockedByMissingAgent}>
                    <FileJson size={16} />
                    JSON gerado
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); setFlowImportExportOpen(true); setFlowImportError(''); }} disabled={editorBlockedByMissingAgent}>
                    <Download size={16} />
                    Importar/Exportar Fluxo
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); setApiDocsOpen(true); }} disabled={editorBlockedByMissingAgent}>
                    <Code2 size={16} />
                    API
                  </button>
                  <button type="button" onClick={() => { setHeaderActionsOpen(false); setApiKeysOpen(true); }} disabled={editorBlockedByMissingAgent}>
                    <KeyRound size={16} />
                    API Keys
                  </button>
                  </div>
                )}
              </div>
            </label>
            <div
              ref={flowVersionsQuickRef}
              className="header-field header-version-field"
            >
              <span>Versões</span>
              <button
                type="button"
                title="Selecionar release ou gerenciar versões"
                disabled={editorBlockedByMissingAgent}
                onClick={() => {
                  setHeaderActionsOpen(false);
                  setFlowVersionsQuickOpen((open) => !open);
                  setFlowVersionError('');
                }}
              >
                <GitBranch size={16} />
                Versões
              </button>
              {flowVersionsQuickOpen && (
                <div className="header-version-popover">
                  <label className="flow-version-select-field">
                    <span>Pacote do agente</span>
                    <select
                      value={agentTabAgentRelease}
                      onChange={(event) => handleAgentTabAgentReleaseChange(event.target.value)}
                      disabled={agentReleaseLoading || flowVersionSwitchLoading || !sortedAgentReleases.length}
                    >
                      <option value="">{sortedAgentReleases.length ? 'Selecione um pacote' : 'Nenhum pacote criado'}</option>
                      {sortedAgentReleases.map((release) => (
                        <option key={release.release} value={String(release.release)}>
                          r{release.release}{release.name ? ` - ${release.name}` : ''}{Number(release.release) === Number(agentActiveRelease) ? ' (produção)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flow-version-select-field">
                    <span>Versões dos fluxos da release</span>
                    <select
                      value={agentTabReleasePreviewKey}
                      onChange={(event) => void loadAgentReleaseFlowVersionIntoEditor(event.target.value)}
                      disabled={flowVersionSwitchLoading || !selectedAgentTabReleaseFlowVersions.length}
                    >
                      {!selectedAgentTabReleaseFlowVersions.length && (
                        <option value="">{agentTabAgentRelease ? 'Nenhum snapshot neste pacote' : 'Selecione um pacote'}</option>
                      )}
                      {selectedAgentTabReleaseFlowVersions.map((flow) => (
                        <option key={flow.key} value={flow.key}>
                          {formatAgentReleaseFlowVersionOption(flow, isAgentReleaseFlowVersionProduction(flow, activeAgentReleaseRecord))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="primary-button header-version-manage-button"
                    onClick={() => {
                      setFlowVersionsQuickOpen(false);
                      setFlowVersionsOpen(true);
                      setFlowVersionTab('agent');
                      setFlowVersionManageOpen(true);
                      setFlowVersionError('');
                    }}
                  >
                    <Settings size={16} />
                    Gerenciar versões
                  </button>
                </div>
              )}
            </div>
            <label className="header-field header-save-field">
              <span className="header-spacer-label" aria-hidden="true">&nbsp;</span>
              <button
                className="primary-button"
                title={savePublishesFlowVersion ? `Publicar alterações na ${primarySaveTargetVersionLabel}` : `Criar v${nextFlowVersion}`}
                onClick={() => void saveEditorChanges()}
                disabled={editorBlockedByMissingAgent || saving || flowVersionSaving || flowVersionSwitchLoading}
              >
                {saving || flowVersionSaving || flowVersionSwitchLoading
                  ? <Loader2 size={16} className="spin" />
                  : <Upload size={16} />}
                {flowVersionSwitchLoading
                  ? 'Carregando versão...'
                  : savePublishesFlowVersion ? `Publicar ${primarySaveTargetVersionLabel}` : `Criar v${nextFlowVersion}`}
              </button>
            </label>
          </div>
        </header>

        <main className={`workspace ${editorBlockedByMissingAgent ? 'workspace-missing-agent' : ''}`}>
          {editorBlockedByMissingAgent ? (
            <section className="missing-agent-panel">
              <div>
                <span className="missing-agent-icon"><Bot size={24} /></span>
                <strong>Selecione um agente para começar</strong>
                <p>Nenhum fluxo fica visível ou editável enquanto não houver um agente selecionado. Isso evita alterar um rascunho solto e perder trabalho depois.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setAgentsOpen(true);
                    void loadAgents();
                  }}
                >
                  <Bot size={16} />
                  Abrir agentes
                </button>
              </div>
            </section>
          ) : (
            <>
          <section className="canvas-panel">
            <div className="toolbar">
              <button
                className="templates-button"
                onClick={() => {
                  setTemplatesOpen((open) => !open);
                  setComponentPaletteOpen(false);
                }}
              >
                <PanelsTopLeft size={16} />
                Templates
              </button>
              <button className="assistant-button" onClick={openFlowAssistant}>
                <Wand2 size={16} />
                Assistente IA
              </button>
              <button onClick={() => addStep('message')}><MessageSquarePlus size={16} />Mensagem</button>
              <button onClick={() => addStep('richMessage')}><PanelsTopLeft size={16} />Mensagem rica</button>
              <button onClick={() => addStep('input')}><Plus size={16} />Input</button>
              <button onClick={() => addStep('api')}><SquareTerminal size={16} />API</button>
              <button onClick={() => addStep('condition')}><GitBranch size={16} />Condição</button>
              <button onClick={() => addStep('end')}><Plus size={16} />Fim</button>
              <button onClick={() => addStep('group')}><FolderPlus size={16} />Encapsulador</button>
              <button
                className="components-button"
                onClick={() => {
                  setComponentPaletteOpen((open) => !open);
                  setTemplatesOpen(false);
                }}
              >
                <Bot size={16} />
                Componentes
              </button>
            </div>

            <div className="flow-canvas">
              {templatesOpen && (
                <div className="component-palette template-palette" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="component-palette-header">
                    <div>
                      <strong>Templates multi-agente</strong>
                      <span>Fluxos prontos com roteamento, governanca e observabilidade</span>
                    </div>
                    <button type="button" onClick={() => setTemplatesOpen(false)} aria-label="Fechar templates">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="template-grid">
                    {flowTemplates.map((template) => (
                      <button
                        type="button"
                        className="template-card"
                        key={template.id}
                        onClick={() => applyFlowTemplate(template)}
                      >
                        <span>{template.segment}</span>
                        <strong>{template.name}</strong>
                        <em>{template.description}</em>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {componentPaletteOpen && (
                <div className="component-palette" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="component-palette-header">
                    <div>
                      <strong>Componentes</strong>
                      <span>Escolha um bloco para adicionar ao fluxo</span>
                    </div>
                    <button type="button" onClick={() => setComponentPaletteOpen(false)} aria-label="Fechar componentes">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="component-search">
                    <Search size={15} />
                    <input
                      autoFocus
                      value={componentSearch}
                      placeholder="Buscar RAG, MongoDB, Dashboard..."
                      onChange={(event) => setComponentSearch(event.target.value)}
                    />
                  </div>
                  <div className="component-grid">
                    {filteredComponents.map((item) => {
                      const Icon = item.Icon;
                      return (
                        <button
                          type="button"
                          className="component-card"
                          key={item.type}
                          onClick={() => addComponent(item.type)}
                          style={{ borderColor: `${item.color}40` }}
                        >
                          <span className="component-card-icon" style={{ color: item.color, background: `${item.color}12` }}>
                            <Icon size={18} />
                          </span>
                          <span className="component-card-main">
                            <strong>{item.title}</strong>
                            <small>{item.category}</small>
                            <em>{item.description}</em>
                          </span>
                        </button>
                      );
                    })}
                    {!filteredComponents.length && <div className="component-empty">Nenhum componente encontrado.</div>}
                  </div>
                </div>
              )}
              {selectedNodeIds.length > 0 && (
                <div className="canvas-selection-toolbar nodrag nopan" onMouseDown={(event) => event.stopPropagation()}>
                  <span>{selectedNodeIds.length} selecionado{selectedNodeIds.length > 1 ? 's' : ''}</span>
                  <button type="button" onClick={duplicateSelectedNodes}>
                    <Copy size={14} />
                    Duplicar
                  </button>
                  <button type="button" onClick={encapsulateSelectedNodes}>
                    <FolderPlus size={14} />
                    Encapsular
                  </button>
                  <button type="button" className="danger-button" onClick={requestDeleteSelectedNodes}>
                    <Trash2 size={14} />
                    Excluir
                  </button>
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                onSelectionChange={handleSelectionChange}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onSelectionDrag={onSelectionDrag}
                onSelectionDragStop={onSelectionDragStop}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onEdgesDelete={handleEdgesDelete}
                deleteKeyCode={null}
                multiSelectionKeyCode={['Control', 'Meta']}
                selectionKeyCode={null}
                panActivationKeyCode={null}
                onlyRenderVisibleElements={largeCanvasMode}
                onPaneClick={closeInspector}
                fitView
              >
                {variableLibraryOpen && (
                  <Panel
                    position="bottom-left"
                    className="flow-variable-library-panel"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flow-variable-library-popover">
                      <div className="flow-variable-library-header">
                        <strong>Variaveis do fluxo</strong>
                        <span>Copie templates para prompts, headers, body, condicoes e mensagens.</span>
                      </div>
                      <div className="flow-variable-library-section">
                        <span className="flow-variable-library-section-title">Nativas</span>
                        {variableLibraryItems.native.map((item) => (
                          <button
                            type="button"
                            className="flow-variable-library-item"
                            key={item.value}
                            onClick={() => void copyVariableTemplate(item.value)}
                          >
                            <span>
                              <strong>{item.label}</strong>
                              <code>{item.value}</code>
                              <em>{item.description}</em>
                            </span>
                            <small>{copiedVariable === item.value ? 'Copiado' : <Copy size={13} />}</small>
                          </button>
                        ))}
                      </div>
                      <div className="flow-variable-library-section">
                        <span className="flow-variable-library-section-title">Criadas por responseName</span>
                        {variableLibraryItems.response.length === 0 && (
                          <div className="flow-variable-library-empty">
                            Nenhum responseName configurado ainda.
                          </div>
                        )}
                        {variableLibraryItems.response.map((item) => (
                          <button
                            type="button"
                            className="flow-variable-library-item"
                            key={item.value}
                            onClick={() => void copyVariableTemplate(item.value)}
                          >
                            <span>
                              <strong>{item.label}</strong>
                              <code>{item.value}</code>
                              <em>{item.source ? `${item.source}: ${item.description}` : item.description}</em>
                            </span>
                            <small>{copiedVariable === item.value ? 'Copiado' : <Copy size={13} />}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Panel>
                )}
                <Controls>
                  <ControlButton
                    className={`flow-variable-library-control ${variableLibraryOpen ? 'active' : ''}`}
                    title="Lib. Contexto"
                    aria-label="Lib. Contexto"
                    onClick={() => setVariableLibraryOpen((open) => !open)}
                  >
                    <Library size={16} />
                    <span>Lib. Contexto</span>
                  </ControlButton>
                </Controls>
                {!largeCanvasMode && (
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={getMiniMapNodeColor}
                  />
                )}
                {largeCanvasMode && (
                  <Panel position="top-right" className="canvas-performance-badge">
                    Modo leve: minimapa oculto
                  </Panel>
                )}
                <Background gap={18} color="#dbeafe" />
              </ReactFlow>
            </div>
          </section>

          <aside className="test-panel">
            <div className="test-header">
              <strong><Database size={16} />Try it do fluxo</strong>
              <div className={`test-header-actions ${testRuntimeMode === 'agentVersion' || testRuntimeMode === 'flowVersion' ? 'has-version-select' : ''}`}>
                <label>
                  <span>Modo do teste</span>
                  <select
                    value={testRuntimeMode}
                    onChange={(event) => {
                      const mode = event.target.value as TestRuntimeMode;
                      setTestRuntimeMode(mode);
                      if (mode !== 'agentVersion') setTestAgentRelease('');
                      if (mode !== 'flowVersion') setTestFlowVersion('');
                      setTestMessages([{ role: 'system', text: 'Clique em Reiniciar para iniciar o teste neste modo.' }]);
                      setTestConversationId('');
                      setTestCurrentStepId('');
                      setTestActiveFlowId('');
                      setTestSlots({});
                      setTestTrace([]);
                      setTestTracePage(null);
                      setTestGraphRuntime(null);
                    }}
                  >
                    <option value="draft">Rascunho do editor</option>
                    <option value="active">Ativo para clientes</option>
                    <option value="agentVersion">Versão do agente</option>
                    <option value="flowVersion">Versão do fluxo</option>
                  </select>
                </label>
                {testRuntimeMode === 'agentVersion' && (
                  <label>
                    <span>Versão agente</span>
                    <select
                      value={testAgentRelease}
                      onChange={(event) => setTestAgentRelease(event.target.value)}
                      disabled={agentReleaseLoading || !sortedAgentReleases.length}
                    >
                      {!sortedAgentReleases.length && <option value="">Nenhuma versão</option>}
                      {sortedAgentReleases.map((release) => (
                        <option key={release.release} value={String(release.release)}>
                          r{release.release}{Number(release.release) === Number(agentActiveRelease) ? ' ativa' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {testRuntimeMode === 'flowVersion' && (
                  <label>
                    <span>Versão fluxo</span>
                    <select
                      value={testFlowVersion}
                      onChange={(event) => setTestFlowVersion(event.target.value)}
                      disabled={flowVersionsLoading || !sortedFlowVersions.length}
                    >
                      {flowVersionsLoading && <option value="">Carregando versoes...</option>}
                      {!sortedFlowVersions.length && <option value="">Nenhuma versão</option>}
                      {sortedFlowVersions.map((version) => (
                        <option key={version.version} value={String(version.version)}>
                          v{version.version}{Number(version.version) === Number(productionFlowVersion) ? ' produção' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button onClick={resetTest} disabled={testLoading || testNeedsVersionSelection}>
                  <Play size={15} />
                  Reiniciar
                </button>
              </div>
            </div>
            {testGraphRuntime && (
              <div className="test-langgraph-summary" title={testGraphRuntime.threadId}>
                <strong>LangGraph</strong>
              </div>
            )}
            {hasTestTrace && (
              <div className="test-trace-summary">
                <span>{testTraceSummaryText}</span>
                {(testTraceDropped > 0 || testTraceHasMore) && (
                  <small>
                    {testTraceDropped > 0 ? `${testTraceDropped} evento(s) antigo(s) descartado(s). ` : ''}
                    {testTraceHasMore ? 'Há mais eventos no buffer desta execução.' : ''}
                  </small>
                )}
                <button
                  type="button"
                  onClick={() => setDebugJsonModal({
                    title: 'Trace do teste',
                    payload: {
                      page: testTracePage,
                      edgeConditions: testTraceConditionEvents,
                      trace: testTrace,
                    },
                  })}
                >
                  <Maximize2 size={14} />
                  Ver trace
                </button>
              </div>
            )}
            <div className="messages">
              {testMessages.map((message, index) => {
                const debugPayload = getDebugPayload(message);
                const dashboardPayload = getDashboardPayload(message);
                const richContent = getRichMessageContent(message);
                const debugKey = `${message.role}-${index}`;

                if (dashboardPayload) {
                  return (
                    <div key={debugKey} className="message dashboard-message">
                      <span>{message.role}</span>
                      <DashboardPreview payload={dashboardPayload} />
                    </div>
                  );
                }

                if (debugPayload) {
                  const isOpen = openDebugMessages[debugKey] === true;
                  const formattedDebugJson = JSON.stringify(debugPayload.payload, null, 2);
                  return (
                    <div key={debugKey} className="message debug-message">
                      <div className="debug-toolbar">
                        <button
                          type="button"
                          className="debug-toggle"
                          onClick={() => setOpenDebugMessages((current) => ({ ...current, [debugKey]: !isOpen }))}
                        >
                          <span className="debug-toggle-label">
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            Debug
                          </span>
                          <span>{debugPayload.title}</span>
                        </button>
                        <button
                          type="button"
                          className="debug-open-button"
                          onClick={() => setDebugJsonModal(debugPayload)}
                          title="Abrir JSON em modal"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                      {isOpen && <pre className="debug-json">{formattedDebugJson}</pre>}
                    </div>
                  );
                }

                if (richContent) {
                  return (
                    <div key={debugKey} className={`message ${message.role} rich-message`}>
                      <span>{message.role}</span>
                      <RichMessagePreview
                        content={richContent}
                        disabled={testLoading}
                        onSelect={(value, label) => void sendRichInteraction(value, label)}
                      />
                    </div>
                  );
                }

                return (
                  <div key={debugKey} className={`message ${message.role}`}>
                    <span>{message.role}</span>
                    <p>{message.text}</p>
                  </div>
                );
              })}
              {testLoading && <div className="message system"><span>system</span><p>Executando...</p></div>}
            </div>
            <div className="test-input-row">
              <input
                value={testInput}
                placeholder="Digite uma mensagem"
                onChange={(event) => setTestInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void sendTestMessage();
                }}
              />
              <button onClick={sendTestMessage} disabled={testLoading || testNeedsVersionSelection || !testInput.trim()}><Send size={18} /></button>
            </div>
          </aside>
            </>
          )}
        </main>

        {actionEdge && (
          <div className="modal-backdrop" onMouseDown={() => setEdgeActionId('')}>
            <div className="edge-action-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>Ligação selecionada</strong>
                <button aria-label="Fechar" onClick={() => setEdgeActionId('')}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="edge-action-body">
                <div className="edge-summary">
                  <div className="edge-summary-box">
                    <span>Origem</span>
                    <strong>{actionEdgeSource?.title || actionEdge.source}</strong>
                  </div>
                  <ArrowRight size={18} />
                  <div className="edge-summary-box">
                    <span>Destino</span>
                    <strong>{actionEdgeTarget?.title || actionEdge.target}</strong>
                  </div>
                </div>
                <div className="edge-action-grid">
                  <button
                    className="edge-action-card"
                    onClick={() => {
                      setSelectedEdgeId(actionEdge.id);
                      setSelectedStepId('');
                      setEdgeActionId('');
                      setFlowConfigOpen(false);
                    }}
                  >
                    <Pencil size={18} />
                    <span>
                      <strong>Editar</strong>
                      <small>Alterar texto da linha ou condição.</small>
                    </span>
                  </button>
                  <button
                    className="edge-action-card danger-edge-action"
                    onClick={() => {
                      const edgeId = actionEdge.id;
                      setEdgeActionId('');
                      requestDeleteEdge(edgeId);
                    }}
                  >
                    <Trash2 size={18} />
                    <span>
                      <strong>Excluir</strong>
                      <small>Remover esta ligação do fluxo.</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {flowAssistantOpen && (
          <div className="modal-backdrop" onMouseDown={() => setFlowAssistantOpen(false)}>
            <div className="flow-assistant-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div className="flow-assistant-title">
                  <strong>Assistente IA</strong>
                  <span>{flowAssistantResult?.model || config.model}</span>
                </div>
                <button aria-label="Fechar" onClick={() => setFlowAssistantOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="flow-assistant-body">
                <section className="flow-assistant-compose">
                  <div className="flow-assistant-scope">
                    <div>
                      <strong>Escopo</strong>
                      <span>
                        {flowAssistantScope === 'selection'
                          ? `${assistantSelectedStepIds.length} nó(s) selecionado(s)`
                          : 'Enviar o fluxo inteiro'}
                      </span>
                    </div>
                    <div role="group" aria-label="Escopo do assistente">
                      <button
                        type="button"
                        className={flowAssistantScope === 'flow' ? 'active' : ''}
                        onClick={() => {
                          setFlowAssistantScope('flow');
                          setFlowAssistantResult(null);
                          setFlowAssistantError('');
                        }}
                      >
                        Fluxo inteiro
                      </button>
                      <button
                        type="button"
                        className={flowAssistantScope === 'selection' ? 'active' : ''}
                        disabled={!config.steps.length}
                        onClick={() => {
                          setFlowAssistantScope('selection');
                          setFlowAssistantResult(null);
                          setFlowAssistantError('');
                        }}
                      >
                        Nós selecionados
                      </button>
                    </div>
                  </div>
                  {flowAssistantScope === 'selection' && (
                    <div className="flow-assistant-selection-panel">
                      <div className="flow-assistant-selection-header">
                        <div>
                          <strong>Nós que a IA pode alterar</strong>
                          <span>{filteredAssistantSteps.length} de {config.steps.length} nó(s)</span>
                        </div>
                        <div>
                          <button type="button" onClick={selectAllFlowAssistantSteps} disabled={!filteredAssistantSteps.length}>
                            {flowAssistantNodeSearch.trim() ? 'Selecionar filtro' : 'Todos'}
                          </button>
                          <button type="button" onClick={clearFlowAssistantStepSelection} disabled={!assistantSelectedStepIds.length}>
                            Limpar
                          </button>
                        </div>
                      </div>
                      <div className="flow-assistant-node-search">
                        <Search size={15} />
                        <input
                          value={flowAssistantNodeSearch}
                          placeholder="Buscar por nome, tipo, texto, responseName..."
                          onChange={(event) => setFlowAssistantNodeSearch(event.target.value)}
                        />
                        {flowAssistantNodeSearch && (
                          <button type="button" onClick={() => setFlowAssistantNodeSearch('')} aria-label="Limpar busca">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flow-assistant-node-picker">
                        {filteredAssistantSteps.map((step) => {
                          const checked = assistantSelectedStepIds.includes(step.id);
                          return (
                            <label className={checked ? 'selected' : ''} key={step.id}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFlowAssistantStepSelection(step.id)}
                              />
                              <span>
                                <strong>{step.title || step.id}</strong>
                                <small>{step.responseName || step.component?.responseName || step.type}</small>
                              </span>
                            </label>
                          );
                        })}
                        {!config.steps.length && <div className="component-empty">Nenhum nó no fluxo.</div>}
                        {config.steps.length > 0 && !filteredAssistantSteps.length && (
                          <div className="component-empty">Nenhum nó encontrado para esta busca.</div>
                        )}
                      </div>
                      <div className="flow-assistant-selected-list">
                      {assistantSelectedSteps.length > 0 ? assistantSelectedSteps.map((step) => (
                        <span key={step.id}>{step.title || step.id}</span>
                      )) : (
                        <span>Nenhum nó selecionado</span>
                      )}
                      </div>
                    </div>
                  )}
                  <div className="flow-assistant-scope">
                    <div>
                      <strong>Fonte</strong>
                      <span>{flowAssistantSource === 'whatsappTranscript' ? 'Transcrição WhatsApp' : 'Brief livre'}</span>
                    </div>
                    <div role="group" aria-label="Fonte do pedido">
                      <button
                        type="button"
                        className={flowAssistantSource === 'brief' ? 'active' : ''}
                        onClick={() => {
                          setFlowAssistantSource('brief');
                          setFlowAssistantResult(null);
                          setFlowAssistantError('');
                        }}
                      >
                        Brief
                      </button>
                      <button
                        type="button"
                        className={flowAssistantSource === 'whatsappTranscript' ? 'active' : ''}
                        onClick={() => {
                          setFlowAssistantSource('whatsappTranscript');
                          setFlowAssistantResult(null);
                          setFlowAssistantError('');
                        }}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                  <div className="flow-assistant-scope">
                    <div>
                      <strong>Motor</strong>
                      <span>{LLM_PROVIDER_OPTIONS.find((item) => item.value === (config.llmProvider || 'openai'))?.label || 'OpenAI'} · {config.model}</span>
                    </div>
                    <div role="group" aria-label="Motor do assistente">
                      <select
                        value={config.llmProvider || 'openai'}
                        onChange={(event) => {
                          const provider = event.target.value as FlowLlmProvider;
                          setConfig((current) => ({
                            ...current,
                            llmProvider: provider,
                            model: getDefaultLlmModelForProvider(provider) || current.model,
                          }));
                          setFlowAssistantResult(null);
                        }}
                      >
                        {LLM_PROVIDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={config.model}
                        onChange={(event) => {
                          setConfig((current) => ({ ...current, model: event.target.value }));
                          setFlowAssistantResult(null);
                        }}
                      >
                        {getLlmModelValuesForProvider(config.llmProvider || 'openai', config.model).map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flow-assistant-scope">
                    <div>
                      <strong>Agent OS</strong>
                      <span>{(config.agentSpec?.skills || []).length} skills - {(config.agentSpec?.subagents || []).length} subagents - {(config.agentSpec?.rules || []).length} rules - {(config.agentSpec?.mcpServers || []).length} MCP</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFlowAssistantOpen(false);
                        openAgentStudio();
                      }}
                    >
                      <ShieldCheck size={15} />
                      Editar agente
                    </button>
                  </div>
                  <div className="flow-assistant-prompt-field">
                    <span>{flowAssistantSource === 'whatsappTranscript' ? 'Cole a conversa' : 'Pedido'}</span>
                    <textarea
                      rows={12}
                      value={flowAssistantPrompt}
                      placeholder={flowAssistantSource === 'whatsappTranscript'
                        ? 'Cole a transcricao do WhatsApp com falas do cliente e do operador.'
                        : 'Descreva o fluxo, alteracao, insercao ou remocao desejada.'}
                      onChange={(event) => {
                        setFlowAssistantPrompt(event.target.value);
                        setFlowAssistantResult(null);
                      }}
                    />
                    <small className="flow-assistant-prompt-hint">
                      Para Gmail, Google Drive, OneDrive, Notion, GitHub, GitLab ou AWS, descreva a tarefa desejada. O assistente monta Agent Plan, orquestrador, skill especialista e MCP remoto.
                    </small>
                  </div>
                  {flowAssistantError && <div className="auth-error">{flowAssistantError}</div>}
                  <div className="flow-assistant-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setFlowAssistantPrompt(FLOW_ASSISTANT_EXAMPLE);
                        setFlowAssistantResult(null);
                      }}
                      disabled={flowAssistantLoading}
                    >
                      <Copy size={15} />
                      Usar exemplo
                    </button>
                    <button className="primary-button" type="button" onClick={() => void generateFlowWithAssistant()} disabled={flowAssistantLoading || !flowAssistantPrompt.trim()}>
                      {flowAssistantLoading ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                      {flowAssistantScope === 'selection' ? 'Gerar ajuste' : 'Gerar fluxo'}
                    </button>
                  </div>
                </section>

                <section className="flow-assistant-result">
                  {!flowAssistantResult && (
                    <div className="flow-assistant-empty">
                      <Wand2 size={22} />
                      <strong>Nenhum fluxo gerado ainda.</strong>
                    </div>
                  )}
                  {flowAssistantResult && (
                    <>
                      <div className="flow-assistant-summary">
                        <div>
                          <span>Nós</span>
                          <strong>{flowAssistantResult.config.steps.length}</strong>
                        </div>
                        <div>
                          <span>Ligações</span>
                          <strong>{flowAssistantResult.config.edges.length}</strong>
                        </div>
                        <div>
                          <span>Escopo</span>
                          <strong>{flowAssistantResult.scope === 'selection' ? 'Seleção' : 'Fluxo'}</strong>
                        </div>
                      </div>
                      <div className="flow-assistant-notes">
                        <strong>{flowAssistantResult.config.title || 'Fluxo gerado'}</strong>
                        <p>{flowAssistantResult.summary || 'Resultado pronto para aplicar no canvas.'}</p>
                      </div>
                      {(flowAssistantResult.warnings || []).length > 0 && (
                        <div className="flow-assistant-warnings">
                          {(flowAssistantResult.warnings || []).map((warning, index) => (
                            <span key={`${warning}-${index}`}>
                              <AlertTriangle size={14} />
                              {warning}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flow-assistant-node-list">
                        {flowAssistantResult.config.steps.slice(0, 8).map((step) => (
                          <div key={step.id}>
                            <span>{step.type === 'component' ? step.component?.type || step.type : step.type}</span>
                            <strong>{step.title || step.id}</strong>
                          </div>
                        ))}
                        {flowAssistantResult.config.steps.length > 8 && (
                          <div>
                            <span>+</span>
                            <strong>{flowAssistantResult.config.steps.length - 8} no(s)</strong>
                          </div>
                        )}
                      </div>
                      <div className="modal-actions flow-assistant-apply">
                        <button type="button" onClick={() => setFlowAssistantResult(null)}>
                          Descartar
                        </button>
                        <button className="primary-button" type="button" onClick={applyFlowAssistantResult}>
                          <Save size={16} />
                          {flowAssistantResult.scope === 'selection' ? 'Aplicar nos nós' : 'Aplicar no canvas'}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {inspectorOpen && (
          <div className="modal-backdrop" onMouseDown={closeInspector}>
            <div
              className={`inspector-modal ${selectedEdge ? 'edge-modal' : ''} ${selectedStep?.component?.type === 'cron' ? 'cron-modal' : ''} ${selectedStep?.component?.type === 'mcp' ? 'mcp-modal' : ''}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <strong>{inspectorTitle}</strong>
                <button aria-label="Fechar" onClick={closeInspector}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <Inspector
                config={config}
                selectedStep={flowConfigOpen ? undefined : selectedStep}
                selectedEdge={flowConfigOpen ? undefined : selectedEdge}
                flows={flows}
                currentFlowId={savedFlowId}
                agentId={selectedAgentStableId}
                onUpdateConfig={updateConfig}
                onUpdateStep={updateStep}
                onUpdateEdge={updateEdge}
                onRefreshCronLog={refreshCronLog}
                canRefreshCronLog={Boolean(savedFlowId)}
              />
            </div>
          </div>
        )}

        {jsonOpen && (
          <div className="modal-backdrop" onClick={() => setJsonOpen(false)}>
            <div className="json-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>JSON gerado</strong>
                <button onClick={copyJson}><Copy size={16} />Copiar</button>
              </div>
              <pre>{JSON.stringify(config, null, 2)}</pre>
            </div>
          </div>
        )}

        {debugJsonModal && (
          <div className="modal-backdrop debug-modal-backdrop" onClick={() => setDebugJsonModal(null)}>
            <div className="json-modal wide-modal debug-json-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Debug JSON</strong>
                  <span>{debugJsonModal.title}</span>
                </div>
                <div className="debug-modal-actions">
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(debugJsonModal.payload, null, 2))}>
                    <Copy size={16} />
                    Copiar
                  </button>
                  <button onClick={() => setDebugJsonModal(null)}>
                    <X size={16} />
                    Fechar
                  </button>
                </div>
              </div>
              <DebugJsonTree value={debugJsonModal.payload} />
            </div>
          </div>
        )}

        {flowVersionsOpen && (
          <div className="modal-backdrop" onMouseDown={() => setFlowVersionsOpen(false)}>
            <div className="flow-version-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Publicação</strong>
                  <span>Trabalhe com Rascunho, Homologação e Produção sem precisar combinar versões manualmente.</span>
                </div>
                <button aria-label="Fechar" onClick={() => setFlowVersionsOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="flow-version-body">
                {(flowVersionError || flowVersionMessage) && (
                  <div className={flowVersionError ? 'api-warning flow-transfer-error' : 'provider-config-success'}>
                    {flowVersionError || flowVersionMessage}
                  </div>
                )}
                <section className="publish-environments flow-version-list-panel">
                  <article className={testRuntimeMode === 'draft' ? 'selected' : ''}>
                    <div>
                      <strong>Rascunho</strong>
                      <span>O que está aberto no editor agora.</span>
                    </div>
                    <button type="button" onClick={() => {
                      setTestRuntimeMode('draft');
                    }}>
                      Testar rascunho
                    </button>
                  </article>
                  <article className={testRuntimeMode === 'agentVersion' || testRuntimeMode === 'flowVersion' ? 'selected' : ''}>
                    <div>
                      <strong>Homologação</strong>
                      <span>Escolha um pacote e uma versão dos fluxos incluídos para abrir no editor.</span>
                    </div>
                    <div className="publish-homolog-grid">
                      <label className="flow-version-select-field">
                        <span>Pacote do agente</span>
                        <select
                          value={agentTabAgentRelease}
                          onChange={(event) => handleAgentTabAgentReleaseChange(event.target.value)}
                          disabled={agentReleaseLoading || flowVersionSwitchLoading || !sortedAgentReleases.length}
                        >
                          <option value="">{sortedAgentReleases.length ? 'Selecione um pacote' : 'Nenhum pacote criado'}</option>
                          {sortedAgentReleases.map((release) => (
                            <option key={release.release} value={String(release.release)}>
                              r{release.release}{release.name ? ` - ${release.name}` : ''}{Number(release.release) === Number(agentActiveRelease) ? ' (produção)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flow-version-select-field">
                        <span>Versões dos fluxos da release</span>
                        <select
                          value={agentTabReleasePreviewKey}
                          onChange={(event) => void loadAgentReleaseFlowVersionIntoEditor(event.target.value)}
                          disabled={flowVersionSwitchLoading || !selectedAgentTabReleaseFlowVersions.length}
                        >
                          {!selectedAgentTabReleaseFlowVersions.length && (
                            <option value="">{agentTabAgentRelease ? 'Nenhum snapshot neste pacote' : 'Selecione um pacote'}</option>
                          )}
                          {selectedAgentTabReleaseFlowVersions.map((flow) => (
                            <option key={flow.key} value={flow.key}>
                              {formatAgentReleaseFlowVersionOption(flow, isAgentReleaseFlowVersionProduction(flow, activeAgentReleaseRecord))}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                  <article className={testRuntimeMode === 'active' ? 'selected' : ''}>
                    <div>
                      <strong>Produção</strong>
                      <span>{agentActiveRelease ? `Clientes usam o pacote r${agentActiveRelease}.` : flowActiveVersion ? `Clientes usam o fluxo v${flowActiveVersion}.` : 'Nenhuma versão ativa para clientes.'}</span>
                    </div>
                    <button type="button" onClick={() => setTestRuntimeMode('active')} disabled={!savedFlowId}>
                      Testar produção
                    </button>
                  </article>
                  <div className="flow-version-summary">
                    <span>Try it usa: <strong>{testRuntimeMode === 'agentVersion' && testAgentRelease ? `homologação: pacote r${testAgentRelease}` : testRuntimeMode === 'flowVersion' && testFlowVersion ? `homologação: fluxo v${testFlowVersion}` : testRuntimeMode === 'active' ? 'produção' : 'rascunho'}</strong></span>
                    <span>Fluxo aberto: <strong>{flowName || config.title}</strong></span>
                  </div>
                </section>
                <details
                  className="publish-advanced flow-version-list-panel"
                  open={flowVersionManageOpen}
                  onToggle={(event) => setFlowVersionManageOpen(event.currentTarget.open)}
                >
                  <summary>Gerenciar versões</summary>
                <div className="flow-version-tabs" role="tablist" aria-label="Tipo de versionamento">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={flowVersionTab === 'agent'}
                    className={flowVersionTab === 'agent' ? 'active' : ''}
                    onClick={() => setFlowVersionTab('agent')}
                  >
                    Agente
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={flowVersionTab === 'flow'}
                    className={flowVersionTab === 'flow' ? 'active' : ''}
                    onClick={() => setFlowVersionTab('flow')}
                  >
                    Fluxos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={flowVersionTab === 'deploy'}
                    className={flowVersionTab === 'deploy' ? 'active' : ''}
                    onClick={() => setFlowVersionTab('deploy')}
                  >
                    API
                  </button>
                </div>
                {flowVersionTab === 'agent' && (
                  <>
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Novo pacote do agente</strong>
                      <span>Cria r{nextAgentRelease} apontando para a última versão criada de cada fluxo. Se algum fluxo não tiver versão, cria a v1 inicial. Não ativa em produção.</span>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void deployAgentRelease()}
                      disabled={flowVersionSaving || saving || virtualDefaultAgent}
                    >
                      {flowVersionSaving ? <Loader2 size={15} className="spin" /> : <GitBranch size={15} />}
                      Criar pacote r{nextAgentRelease}
                    </button>
                  </div>
                  <textarea
                    value={agentReleaseNotes}
                    rows={3}
                    placeholder="Notas opcionais, ex: Login v4 + Área logada v3 para homologação."
                    onChange={(event) => setAgentReleaseNotes(event.target.value)}
                  />
                </section>
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Pacotes criados</strong>
                      <span>{sortedAgentReleases.length ? `${sortedAgentReleases.length} pacote(s)` : 'Nenhum pacote criado ainda.'}</span>
                    </div>
                  </div>
                  <div className="flow-version-list">
                    {sortedAgentReleases.map((release) => {
                      const isActive = Number(release.release) === Number(agentActiveRelease);
                      const releaseFlows = getAgentReleaseSnapshotOptions(release, flows);
                      const flowCount = releaseFlows.length;
                      return (
                        <div className={`flow-version-card ${isActive ? 'active' : ''}`} key={release.release}>
                          <div>
                            <strong>r{release.release}</strong>
                             <span>{release.name || `Pacote ${release.release}`}</span>
                            <span>{flowCount} fluxo(s) versionados</span>
                            {!!releaseFlows.length && (
                              <div className="flow-version-release-map">
                                {releaseFlows.map((item) => (
                                  <span className={item.id === savedFlowId ? 'current' : ''} key={`${release.release}-${item.id}`}>
                                    {formatAgentReleaseSnapshotOption(item, isActive)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <small>Deploy: {formatDateTime(release.deployedAt || release.createdAt)} por {formatAuditActor(release.deployedByEmail, release.deployedBy)}</small>
                            {(release.activatedAt || release.activatedByEmail || release.activatedBy) && (
                              <small>Ativação: {formatDateTime(release.activatedAt)} por {formatAuditActor(release.activatedByEmail, release.activatedBy)}</small>
                            )}
                            {release.notes && <p>{release.notes}</p>}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => openVersionOverwrite({ kind: 'agent', version: release.release, isActive, currentName: release.name || '' })}
                              disabled={flowVersionSaving || saving}
                            >
                              <Upload size={15} />
                              Publicar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAgentTabAgentReleaseChange(String(release.release))}
                              disabled={flowVersionSaving}
                            >
                              <Play size={15} />
                              Abrir e testar
                            </button>
                            {isActive ? (
                              <span className="status-pill active">Ativa</span>
                            ) : (
                              <button type="button" onClick={() => requestActivateAgentRelease(release.release)} disabled={flowVersionSaving}>
                                <Check size={15} />
                                Ativar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openVersionRename({ kind: 'agent', version: release.release, currentName: release.name || '' })}
                              disabled={flowVersionSaving}
                            >
                              <Pencil size={15} />
                              Renomear
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteAgentRelease(release.release)}
                              disabled={flowVersionSaving || isActive}
                              title={isActive ? 'Ative outra versão antes de excluir esta.' : `Excluir r${release.release}`}
                            >
                              <Trash2 size={15} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!sortedAgentReleases.length && (
                      <div className="api-warning">
                        Crie um pacote para homologação. Quando estiver aprovado, ative pela lista acima sem criar outro pacote.
                      </div>
                    )}
                  </div>
                </section>
                  </>
                )}

                {flowVersionTab === 'deploy' && (
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Como a API escolhe a versão</strong>
                      <span>Sem override, a chamada usa o pacote ativo do agente. Se não houver pacote ativo, usa a versão ativa do fluxo.</span>
                    </div>
                  </div>
                  <div className="flow-version-summary">
                    <span>Padrão sem override: <strong>{agentActiveRelease ? `pacote r${agentActiveRelease}` : flowActiveVersion ? `fluxo v${flowActiveVersion}` : 'rascunho'}</strong></span>
                    <span>Teste de pacote: <strong>{selectedAgentTabReleaseRecord ? `r${selectedAgentTabReleaseRecord.release}` : 'nenhum selecionado'}</strong></span>
                    <span>Teste de fluxo: <strong>{selectedAgentTabFlowVersionRecord ? `v${selectedAgentTabFlowVersionRecord.version}` : 'nenhum selecionado'}</strong></span>
                  </div>
                </section>
                )}

                {flowVersionTab === 'deploy' && (
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Payload padrão</strong>
                      <span>Não envie agentRelease nem flowVersion para usar o que está ativo para clientes.</span>
                    </div>
                    <button type="button" onClick={() => navigator.clipboard.writeText(versionDefaultPayload)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{versionDefaultPayload}</pre>
                  <div className="flow-version-subsection">
                    <div className="flow-transfer-section-header">
                      <div>
                        <strong>Payload de teste</strong>
                        <span>Envie agentRelease para testar um pacote específico sem alterar o que está ativo para clientes.</span>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(versionQaPayload)}>
                        <Copy size={15} />
                        Copiar
                      </button>
                    </div>
                  </div>
                  <pre>{versionQaPayload}</pre>
                </section>
                )}

                {flowVersionTab === 'flow' && (
                  <>
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Nova versão deste fluxo</strong>
                      <span>Cria v{nextFlowVersion} com o que está aberto no editor agora.</span>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={deployFlowVersion}
                      disabled={flowVersionSaving || saving || virtualDefaultAgent}
                    >
                      {flowVersionSaving ? <Loader2 size={15} className="spin" /> : <GitBranch size={15} />}
                      Criar v{nextFlowVersion}
                    </button>
                  </div>
                  <textarea
                    value={flowVersionNotes}
                    rows={3}
                    placeholder="Notas opcionais desta versão, ex: ajuste do fallback de CPF para homologação."
                    onChange={(event) => setFlowVersionNotes(event.target.value)}
                  />
                </section>
                <section className="flow-version-panel flow-version-list-panel">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Versões deste fluxo</strong>
                      <span>{sortedFlowVersions.length ? `${sortedFlowVersions.length} versão(ões)` : 'Nenhuma versão criada ainda.'}</span>
                    </div>
                  </div>
                  <div className="flow-version-list">
                    {sortedFlowVersions.map((version) => {
                      const isFlowActive = Number(version.version) === Number(flowActiveVersion);
                      const isProduction = Number(version.version) === Number(productionFlowVersion);
                      return (
                        <div className={`flow-version-card ${isProduction ? 'active' : ''}`} key={version.version}>
                          <div>
                            <strong>v{version.version}</strong>
                            <span>{version.name || `Versão ${version.version}`}</span>
                            <small>Deploy: {formatDateTime(version.deployedAt || version.createdAt)} por {formatAuditActor(version.deployedByEmail, version.deployedBy)}</small>
                            {(version.activatedAt || version.activatedByEmail || version.activatedBy) && (
                              <small>Ativação: {formatDateTime(version.activatedAt)} por {formatAuditActor(version.activatedByEmail, version.activatedBy)}</small>
                            )}
                            {version.notes && <p>{version.notes}</p>}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => openVersionOverwrite({ kind: 'flow', version: version.version, isActive: isProduction, currentName: version.name || '' })}
                              disabled={flowVersionSaving || saving}
                            >
                              <Upload size={15} />
                              Publicar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAgentTabFlowVersionChange(String(version.version))}
                              disabled={flowVersionSaving}
                            >
                              <Play size={15} />
                              Abrir e testar
                            </button>
                            {isProduction ? (
                              <span className="status-pill active">Produção</span>
                            ) : (
                              <button type="button" onClick={() => requestActivateFlowVersion(version.version)} disabled={flowVersionSaving}>
                                <Check size={15} />
                                Ativar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openVersionRename({ kind: 'flow', version: version.version, currentName: version.name || '' })}
                              disabled={flowVersionSaving}
                            >
                              <Pencil size={15} />
                              Renomear
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteFlowVersion(version)}
                              disabled={flowVersionSaving || isFlowActive || isProduction}
                              title={isProduction ? 'Esta versão está em produção.' : isFlowActive ? 'Ative outra versão antes de excluir esta versão.' : `Excluir v${version.version}`}
                            >
                              <Trash2 size={15} />
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!sortedFlowVersions.length && (
                      <div className="api-warning">
                        Crie uma versão nova para homologação. Quando estiver aprovada, ative pela lista acima.
                      </div>
                    )}
                  </div>
                </section>
                  </>
                )}
                </details>
              </div>
            </div>
          </div>
        )}

        {flowImportExportOpen && (
          <div className="modal-backdrop" onMouseDown={() => setFlowImportExportOpen(false)}>
            <div className="flow-transfer-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Importar/Exportar Fluxo</strong>
                  <span>Use para mover um fluxo entre ambientes ou criar um rascunho a partir de um JSON.</span>
                </div>
                <button aria-label="Fechar" onClick={() => setFlowImportExportOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="flow-transfer-body">
                {(flowImportError || flowImportMessage) && (
                  <div className={flowImportError ? 'api-warning flow-transfer-error' : 'provider-config-success'}>
                    {flowImportError || flowImportMessage}
                  </div>
                )}
                <section className="flow-transfer-section">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Exportar fluxo atual</strong>
                      <span>{flowName || config.title} {savedFlowId ? `· ${savedFlowId}` : '· rascunho sem flowId'}</span>
                    </div>
                    <div>
                      <button type="button" onClick={copyFlowExport}>
                        <Copy size={15} />
                        Copiar JSON
                      </button>
                      <button type="button" className="primary-button" onClick={downloadFlowExport}>
                        <Download size={15} />
                        Baixar arquivo
                      </button>
                    </div>
                  </div>
                  <textarea value={flowExportJson} readOnly rows={18} />
                </section>

                <section className="flow-transfer-section">
                  <div className="flow-transfer-section-header">
                    <div>
                      <strong>Importar fluxo</strong>
                      <span>O importado entra como rascunho e não sobrescreve o fluxo salvo até clicar em Salvar.</span>
                    </div>
                    <div>
                      <input
                        ref={flowImportFileRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden-file-input"
                        onChange={importFlowFromFile}
                      />
                      <button type="button" onClick={() => flowImportFileRef.current?.click()}>
                        <Upload size={15} />
                        Escolher arquivo
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={flowImportText}
                    rows={18}
                    placeholder="Cole aqui o JSON exportado do Canvas Flow."
                    onChange={(event) => {
                      setFlowImportText(event.target.value);
                      setFlowImportError('');
                    }}
                  />
                  <div className="modal-actions">
                    <button type="button" onClick={() => { setFlowImportText(''); setFlowImportError(''); }}>
                      Limpar
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => applyImportedFlow(flowImportText)}
                      disabled={!flowImportText.trim()}
                    >
                      <Upload size={15} />
                      Importar fluxo
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {agentOpsOpen && (
          <div className="modal-backdrop" onClick={() => setAgentOpsOpen(false)}>
            <div className="json-modal wide-modal tag-dashboard-modal agentops-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header tag-dashboard-modal-header">
                <div>
                  <strong>AgentOps</strong>
                  <small>Operacao, governanca e saude dos fluxos do agente.</small>
                </div>
                <button onClick={() => setAgentOpsOpen(false)}><X size={16} />Fechar</button>
              </div>
              <div className="tag-dashboard-body">
                <section className="tag-dashboard-filter-panel">
                  <div className="tag-dashboard-section-title">
                    <strong>Filtros</strong>
                    <span>Combine periodo, fluxo e conversa para investigar execucoes.</span>
                  </div>
                  <div className="tag-dashboard-filters">
                    <label>
                      Data inicial
                      <input
                        type="datetime-local"
                        value={agentOpsFilters.dateFrom}
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Data final
                      <input
                        type="datetime-local"
                        value={agentOpsFilters.dateTo}
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      />
                    </label>
                    <label className="tag-dashboard-filter-wide">
                      Fluxo
                      <select
                        value={agentOpsFilters.flowId}
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, flowId: event.target.value }))}
                      >
                        <option value="">Todos os fluxos</option>
                        {flows.map((flow) => (
                          <option key={flow._id} value={flow._id}>{flow.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Conversa
                      <input
                        value={agentOpsFilters.conversationId}
                        placeholder="conversation-id"
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, conversationId: event.target.value }))}
                      />
                    </label>
                    <label>
                      Historico
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={agentOpsFilters.historyLimit}
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, historyLimit: Number(event.target.value) || 80 }))}
                      />
                    </label>
                    <label>
                      Trace
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        value={agentOpsFilters.traceLimit}
                        onChange={(event) => setAgentOpsFilters((current) => ({ ...current, traceLimit: Number(event.target.value) || 600 }))}
                      />
                    </label>
                    <div className="tag-dashboard-filter-actions">
                      <button className="primary-button tag-dashboard-filter-button" onClick={() => void applyAgentOpsFilters()} disabled={agentOpsLoading}>
                        {agentOpsLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                        Atualizar
                      </button>
                    </div>
                  </div>
                </section>

                {agentOpsError && <div className="api-warning">{agentOpsError}</div>}

                {agentOpsDashboard && (
                  <>
                    <div className="dashboard-card-grid agentops-card-grid">
                      <div className="dashboard-card"><span>Conversas</span><strong>{formatMetric(agentOpsSummary.conversations)}</strong></div>
                      <div className="dashboard-card"><span>Mensagens</span><strong>{formatMetric(agentOpsSummary.messages)}</strong></div>
                      <div className="dashboard-card"><span>Execucoes</span><strong>{formatMetric(agentOpsSummary.runs)}</strong></div>
                      <div className="dashboard-card"><span>Erro %</span><strong>{formatMetric(Number(agentOpsSummary.errorRate || 0) * 100, 1)}</strong></div>
                      <div className="dashboard-card"><span>Tokens est.</span><strong>{formatMetric(agentOpsSummary.estimatedTokens)}</strong></div>
                      <div className="dashboard-card"><span>Fila SQS</span><strong>{formatMetric(agentOpsQueue.jobs?.pending || agentOpsQueue.jobs?.queued || agentOpsQueue.activeLocks || 0)}</strong></div>
                      <div className="dashboard-card"><span>MCP tools</span><strong>{formatMetric(agentOpsCapabilities.exposedMcpTools)}</strong></div>
                      <div className="dashboard-card"><span>Aprovações</span><strong>{formatMetric(agentOpsCapabilities.approvalGates)}</strong></div>
                      <div className="dashboard-card"><span>RAG/Dados</span><strong>{formatMetric(agentOpsCapabilities.ragNodes)}</strong></div>
                      <div className="dashboard-card"><span>Webhooks</span><strong>{formatMetric(agentOpsCapabilities.webhookNodes)}</strong></div>
                    </div>

                    {agentOpsReadiness.length > 0 && (
                      <section className="tag-dashboard-tab-panel agentops-warning-panel">
                        <div className="tag-dashboard-section-title">
                          <strong>Alertas de prontidao</strong>
                          <span>{agentOpsReadiness.length} ponto(s) pedem revisao antes de publicar.</span>
                        </div>
                        <ul>
                          {agentOpsReadiness.map((warning: string, index: number) => (
                            <li key={`${warning}-${index}`}>{warning}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="tag-dashboard-insight-grid">
                      <DashboardBarList
                        title="Nos mais quentes"
                        subtitle="Execucoes por node"
                        series={toDashboardSeries(agentOpsHotNodes, ['title', 'stepId'], 'count')}
                        emptyText="Nenhum node apareceu no trace para estes filtros."
                      />
                      <DashboardBarList
                        title="Chamadas por tipo"
                        subtitle="Componentes e operacoes"
                        series={toDashboardSeries(agentOpsTrace.calls, ['key'], 'count')}
                        emptyText="Nenhuma chamada registrada no trace."
                      />
                    </div>

                    <div className="tag-dashboard-insight-grid">
                      <section className="tag-dashboard-tab-panel">
                        <div className="tag-dashboard-section-title">
                          <strong>Erros recentes</strong>
                          <span>Falhas capturadas no trace.</span>
                        </div>
                        <div className="dashboard-table-wrap">
                          <table>
                            <thead><tr><th>Data</th><th>Tipo</th><th>No</th><th>Mensagem</th></tr></thead>
                            <tbody>
                              {agentOpsErrors.length > 0 ? agentOpsErrors.slice(0, 8).map((item: any, index: number) => (
                                <tr key={`${item.conversationId || 'error'}-${index}`}>
                                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-'}</td>
                                  <td>{item.type || '-'}</td>
                                  <td>{item.stepId || '-'}</td>
                                  <td>{item.message || '-'}</td>
                                </tr>
                              )) : (
                                <tr><td colSpan={4}>Nenhum erro encontrado.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="tag-dashboard-tab-panel">
                        <div className="tag-dashboard-section-title">
                          <strong>Publicacao</strong>
                          <span>Releases e fluxos disponiveis para o agente.</span>
                        </div>
                        <div className="agentops-release-summary">
                          <span>Release ativa: <strong>{agentOpsReleases.activeRelease || '-'}</strong></span>
                          <span>Ultima release: <strong>{agentOpsReleases.latestRelease || '-'}</strong></span>
                          <button type="button" onClick={() => { setAgentOpsOpen(false); setFlowVersionsOpen(true); setFlowVersionTab('agent'); setFlowVersionManageOpen(true); }}>
                            <GitBranch size={15} />
                            Abrir publicacao
                          </button>
                        </div>
                        <div className="agentops-flow-list">
                          {agentOpsFlows.slice(0, 8).map((flow: any) => (
                            <span key={flow.id}>{flow.name || flow.id} v{flow.activeVersion || flow.latestVersion || '-'}</span>
                          ))}
                          {!agentOpsFlows.length && <span>Nenhum fluxo salvo para este agente.</span>}
                        </div>
                        {agentOpsReleaseItems.length > 0 && (
                          <div className="agentops-flow-list compact">
                            {agentOpsReleaseItems.slice(0, 6).map((release: any) => (
                              <span key={release.release}>r{release.release}{release.active ? ' ativa' : ''}</span>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {simulationOpen && (
          <div className="modal-backdrop" onClick={() => setSimulationOpen(false)}>
            <div className="json-modal wide-modal simulation-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Simulação e evals</strong>
                  <span>Rode conversas em lote contra rascunho, produção ou versões selecionadas.</span>
                </div>
                <button onClick={() => { setSimulationResultsOpen(false); setSimulationOpen(false); }}><X size={16} />Fechar</button>
              </div>
              <div className="simulation-body">
                <section className="tag-dashboard-filter-panel">
                  <div className="tag-dashboard-filters">
                    <label>
                      Modo
                      <select value={simulationMode} onChange={(event) => setSimulationMode(event.target.value as 'conversation' | 'isolated')}>
                        <option value="conversation">Conversa contínua</option>
                        <option value="isolated">Casos isolados</option>
                      </select>
                    </label>
                    <label>
                      Runtime
                      <input value={testRuntimeMode === 'draft' ? 'Rascunho' : testRuntimeMode === 'active' ? 'Produção' : testRuntimeMode === 'agentVersion' ? `Agente r${testAgentRelease || '?'}` : `Fluxo v${testFlowVersion || '?'}`} readOnly />
                    </label>
                    <div className="tag-dashboard-filter-actions">
                      <button className="primary-button tag-dashboard-filter-button" onClick={() => void runSimulation()} disabled={simulationLoading || testNeedsVersionSelection}>
                        {simulationLoading ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                        Rodar eval
                      </button>
                    </div>
                  </div>
                </section>
                {testNeedsVersionSelection && <div className="api-warning">Selecione a versão no Try it antes de rodar este modo.</div>}
                <div className="simulation-suite-main-tabs" role="tablist" aria-label="Suites de simulacao">
                  <button
                    type="button"
                    className={simulationSuiteTab === 'saved' ? 'active' : ''}
                    onClick={() => setSimulationSuiteTab('saved')}
                  >
                    Suites salvas
                  </button>
                  <button
                    type="button"
                    className={simulationSuiteTab === 'editor' ? 'active' : ''}
                    onClick={() => setSimulationSuiteTab('editor')}
                  >
                    Criar suite
                  </button>
                </div>
                {simulationError && <div className="api-warning">{simulationError}</div>}
                {simulationMessage && <div className="provider-config-success">{simulationMessage}</div>}
                {simulationSuiteTab === 'saved' && (
                  <section className="simulation-run-panel">
                    <div className="simulation-run-header">
                      <div>
                        <strong>Suites para rodar</strong>
                        <span>{selectedSimulationRunSuites.length} suite(s), {selectedSimulationRunCaseCount} caso(s) selecionado(s).</span>
                      </div>
                      <div>
                        <button type="button" onClick={selectAllSimulationRunSuites} disabled={!savedSimulationSuites.length}>
                          <Check size={15} />
                          Selecionar todas
                        </button>
                        <button type="button" onClick={clearSimulationRunSuites} disabled={!simulationSelectedRunSuiteIds.length}>
                          <X size={15} />
                          Limpar
                        </button>
                        <button className="primary-button" type="button" onClick={() => void runSimulation()} disabled={simulationLoading || testNeedsVersionSelection || !simulationSelectedRunSuiteIds.length}>
                          {simulationLoading ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                          Rodar selecionadas
                        </button>
                      </div>
                    </div>
                    {!savedSimulationSuites.length && (
                      <div className="component-empty">
                        Nenhuma suite salva. Abra a tab Criar suite, monte os casos e salve.
                      </div>
                    )}
                    {savedSimulationSuites.length > 0 && (
                      <div className="simulation-run-layout">
                        <div className="simulation-run-library">
                          {savedSimulationSuites.map((suite) => {
                            const selected = simulationSelectedRunSuiteIds.includes(suite.id);
                            return (
                              <article
                                key={suite.id}
                                className={`simulation-saved-suite ${selected ? 'active' : ''}`}
                              >
                                <div className="simulation-saved-suite-header">
                                  <label className="simulation-suite-check">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleSimulationRunSuite(suite.id)}
                                    />
                                    <span>
                                      <strong>{suite.name}</strong>
                                      <small>
                                        {suite.cases.length} caso(s)
                                        {suite.updatedAt ? ` · ${new Date(suite.updatedAt).toLocaleString('pt-BR')}` : ''}
                                      </small>
                                    </span>
                                  </label>
                                  <button type="button" onClick={() => loadSimulationSuite(suite.id)}>
                                    <Pencil size={15} />
                                    Editar
                                  </button>
                                </div>
                                {suite.description && <p>{suite.description}</p>}
                                <div className="simulation-saved-case-list">
                                  {suite.cases.map((testCase: any, index) => (
                                    <span key={`${suite.id}-run-${index}`}>
                                      {String(testCase?.name || testCase?.title || testCase?.text || testCase?.input || `Caso ${index + 1}`).slice(0, 90)}
                                    </span>
                                  ))}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        <aside className="simulation-run-order">
                          <div>
                            <strong>Ordem da rodada</strong>
                            <span>Arraste para mudar a sequencia.</span>
                          </div>
                          {selectedSimulationRunSuites.length ? selectedSimulationRunSuites.map((suite, index) => (
                            <div
                              key={suite.id}
                              className={`simulation-run-order-item ${simulationDraggingSuiteId === suite.id ? 'dragging' : ''}`}
                              draggable
                              onDragStart={(event) => {
                                setSimulationDraggingSuiteId(suite.id);
                                event.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(event) => {
                                if (!simulationDraggingSuiteId || simulationDraggingSuiteId === suite.id) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                moveSimulationRunSuite(simulationDraggingSuiteId, suite.id);
                              }}
                              onDragEnd={() => setSimulationDraggingSuiteId('')}
                            >
                              <GripVertical size={16} />
                              <span>{index + 1}</span>
                              <strong>{suite.name}</strong>
                              <small>{suite.cases.length} caso(s)</small>
                            </div>
                          )) : (
                            <div className="component-empty">Selecione suites para montar a ordem.</div>
                          )}
                        </aside>
                      </div>
                    )}
                  </section>
                )}
                {simulationSuiteTab === 'editor' && (
                  <>
                <section className="simulation-suite-panel">
                  <div className="tag-dashboard-section-title">
                    <strong>Suite salva</strong>
                    <span>{savedSimulationSuites.length ? `${savedSimulationSuites.length} suite(s) neste fluxo.` : 'Nenhuma suite salva neste fluxo ainda.'}</span>
                  </div>
                  <div className="simulation-suite-grid">
                    <label>
                      Carregar
                      <select
                        value={simulationSelectedSuiteId}
                        onChange={(event) => {
                          const nextSuiteId = event.target.value;
                          if (nextSuiteId) loadSimulationSuite(nextSuiteId);
                          else startNewSimulationSuite();
                        }}
                      >
                        <option value="">Nova suite</option>
                        {savedSimulationSuites.map((suite) => (
                          <option key={suite.id} value={suite.id}>{suite.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nome
                      <input
                        value={simulationSuiteName}
                        placeholder="Ex: Regressao atendimento WhatsApp"
                        onChange={(event) => setSimulationSuiteName(event.target.value)}
                      />
                    </label>
                    <label className="simulation-suite-description">
                      Descricao
                      <input
                        value={simulationSuiteDescription}
                        placeholder="Opcional: objetivo da suite"
                        onChange={(event) => setSimulationSuiteDescription(event.target.value)}
                      />
                    </label>
                    <div className="simulation-suite-actions">
                      <button type="button" onClick={startNewSimulationSuite} disabled={simulationSaving}>
                        <Plus size={15} />
                        Nova
                      </button>
                      <button type="button" className="primary-button" onClick={() => void saveSimulationSuite()} disabled={simulationSaving}>
                        {simulationSaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                        Salvar suite
                      </button>
                      <button type="button" className="danger-button" onClick={() => void deleteSimulationSuite()} disabled={simulationSaving || !simulationSelectedSuiteId}>
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </div>
                  </div>
                  {savedSimulationSuites.length > 0 && (
                    <div className="simulation-saved-list">
                      {savedSimulationSuites.map((suite) => (
                        <article
                          key={suite.id}
                          className={`simulation-saved-suite ${simulationSelectedSuiteId === suite.id ? 'active' : ''}`}
                        >
                          <div className="simulation-saved-suite-header">
                            <div>
                              <strong>{suite.name}</strong>
                              <span>
                                {suite.cases.length} caso(s)
                                {suite.updatedAt ? ` · atualizado em ${new Date(suite.updatedAt).toLocaleString('pt-BR')}` : ''}
                              </span>
                            </div>
                            <button type="button" onClick={() => loadSimulationSuite(suite.id)}>
                              <ArrowRight size={15} />
                              Carregar
                            </button>
                          </div>
                          {suite.description && <p>{suite.description}</p>}
                          <div className="simulation-saved-case-list">
                            {suite.cases.map((testCase: any, index) => (
                              <span key={`${suite.id}-${index}`}>
                                {String(testCase?.name || testCase?.title || testCase?.text || testCase?.input || `Caso ${index + 1}`).slice(0, 90)}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <div className="simulation-editor-panel">
                  <div className="simulation-editor-header">
                    <div>
                      <strong>Cenarios</strong>
                      <span>Monte casos por campos ou edite o JSON direto.</span>
                    </div>
                    <div className="simulation-editor-actions">
                      <div className="simulation-editor-tabs" role="tablist" aria-label="Editor de cenarios">
                        <button type="button" className={simulationEditorMode === 'visual' ? 'active' : ''} onClick={() => setSimulationEditorMode('visual')}>Visual</button>
                        <button type="button" className={simulationEditorMode === 'json' ? 'active' : ''} onClick={() => setSimulationEditorMode('json')}>JSON</button>
                      </div>
                      <button type="button" onClick={resetSimulationExampleDrafts}>
                        <Copy size={15} />
                        Exemplo
                      </button>
                      <button type="button" className="primary-button" onClick={addSimulationCaseDraft}>
                        <Plus size={15} />
                        Novo caso
                      </button>
                    </div>
                  </div>

                  {simulationEditorMode === 'visual' ? (
                    <div className="simulation-builder">
                      {simulationCaseDrafts.map((draft, index) => (
                        <section className="simulation-case-card" key={draft.id}>
                          <div className="simulation-case-header">
                            <div>
                              <span>Caso {index + 1}</span>
                              <input
                                value={draft.name}
                                placeholder="Nome do cenario"
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { name: event.target.value })}
                              />
                            </div>
                            <div>
                              <button type="button" title="Duplicar caso" onClick={() => duplicateSimulationCaseDraft(draft.id)}>
                                <Copy size={15} />
                              </button>
                              <button type="button" title="Remover caso" onClick={() => removeSimulationCaseDraft(draft.id)} disabled={simulationCaseDrafts.length <= 1}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          <label className="simulation-field simulation-field-wide">
                            Mensagem do usuario
                            <textarea
                              rows={3}
                              value={draft.text}
                              placeholder="Ex: Quero remarcar minha consulta"
                              onChange={(event) => updateSimulationCaseDraft(draft.id, { text: event.target.value })}
                            />
                          </label>

                          <div className="simulation-case-grid">
                            <label className="simulation-field">
                              Texto esperado
                              <textarea
                                rows={3}
                                value={draft.expectedContainsText}
                                placeholder="Uma palavra/frase por linha"
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { expectedContainsText: event.target.value })}
                              />
                            </label>
                            <label className="simulation-field">
                              Slots esperados JSON
                              <textarea
                                rows={3}
                                value={draft.expectedSlotsText}
                                placeholder={'{\n  "triagem.intencao": "agendamento"\n}'}
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { expectedSlotsText: event.target.value })}
                              />
                            </label>
                            <label className="simulation-field">
                              Estado final
                              <select
                                value={draft.expectedEnded}
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { expectedEnded: event.target.value as SimulationExpectedEnded })}
                              >
                                <option value="any">Indiferente</option>
                                <option value="false">Deve continuar</option>
                                <option value="true">Deve encerrar</option>
                              </select>
                            </label>
                            <label className="simulation-checkbox-field">
                              <input
                                type="checkbox"
                                checked={draft.allowErrors}
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { allowErrors: event.target.checked })}
                              />
                              Permitir erros no trace
                            </label>
                            <label className="simulation-field">
                              Slots iniciais JSON
                              <textarea
                                rows={3}
                                value={draft.slotsText}
                                placeholder={'{\n  "cpf": "12345678909"\n}'}
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { slotsText: event.target.value })}
                              />
                            </label>
                            <label className="simulation-field">
                              Aprovacoes JSON
                              <textarea
                                rows={3}
                                value={draft.approvalsText}
                                placeholder={'{\n  "aprovacaoReembolso": "approved"\n}'}
                                onChange={(event) => updateSimulationCaseDraft(draft.id, { approvalsText: event.target.value })}
                              />
                            </label>
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="simulation-json-editor">
                      <div className="simulation-json-toolbar">
                        <span>Use text, expectedContains, expectedSlots, expectedEnded, slots e approvals.</span>
                        <div>
                          <button type="button" onClick={formatSimulationJson}>
                            <FileJson size={15} />
                            Formatar
                          </button>
                          <button type="button" onClick={applySimulationJsonToVisual}>
                            <ArrowRight size={15} />
                            Aplicar no visual
                          </button>
                        </div>
                      </div>
                      <textarea rows={12} value={simulationCasesText} onChange={(event) => setSimulationCasesText(event.target.value)} />
                    </div>
                  )}
                </div>
                  </>
                )}
                {simulationResult && (
                  <>
                    <div className="dashboard-card-grid">
                      <div className="dashboard-card"><span>Total</span><strong>{formatMetric(simulationResult.summary?.total)}</strong></div>
                      <div className="dashboard-card"><span>Passou</span><strong>{formatMetric(simulationResult.summary?.passed)}</strong></div>
                      <div className="dashboard-card"><span>Falhou</span><strong>{formatMetric(simulationResult.summary?.failed)}</strong></div>
                      <div className="dashboard-card"><span>Taxa</span><strong>{formatMetric(Number(simulationResult.summary?.passRate || 0) * 100, 1)}%</strong></div>
                    </div>
                    <div className="dashboard-table-wrap">
                      <div className="simulation-results-title">
                        <strong>Resultados</strong>
                        <button
                          type="button"
                          onClick={() => setSimulationResultsOpen(true)}
                        >
                          <Maximize2 size={15} />
                          Expandir tudo
                        </button>
                      </div>
                      <table>
                        <thead>
                          <tr><th>#</th><th>Status</th><th>Entrada</th><th>Ultima resposta</th><th>Checks</th><th>Detalhes</th></tr>
                        </thead>
                        <tbody>
                          {(simulationResult.results || []).map((item: any) => (
                            <tr key={item.index}>
                              <td>{item.index}{item.name ? ` - ${item.name}` : ''}</td>
                              <td>{item.passed ? 'ok' : 'falhou'}</td>
                              <td>{item.text}</td>
                              <td>{item.lastMessage?.text || '-'}</td>
                              <td>{(item.checks || []).map((check: any) => `${check.type}:${check.passed ? 'ok' : 'fail'}`).join(', ') || '-'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="simulation-result-detail-button"
                                  onClick={() => openSimulationResultDetail(item)}
                                >
                                  <Maximize2 size={14} />
                                  Abrir
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {simulationResultsOpen && simulationResult && (
          <div className="modal-backdrop simulation-results-backdrop" onClick={() => setSimulationResultsOpen(false)}>
            <div className="simulation-results-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Resultados da simulacao</strong>
                  <span>
                    {formatMetric(simulationResult.summary?.total)} caso(s) - {formatMetric(Number(simulationResult.summary?.passRate || 0) * 100, 1)}% passou
                  </span>
                </div>
                <div className="debug-modal-actions">
                  <button type="button" onClick={openSimulationFinalState}>
                    <FileJson size={16} />
                    Estado final
                  </button>
                  <button type="button" onClick={() => setSimulationResultsOpen(false)}>
                    <X size={16} />
                    Fechar
                  </button>
                </div>
              </div>
              <div className="simulation-results-modal-body">
                <div className="dashboard-table-wrap simulation-results-full-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Status</th>
                        <th>Entrada</th>
                        <th>Ultima resposta</th>
                        <th>Checks</th>
                        <th>Contexto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(simulationResult.results || []).map((item: any) => (
                        <tr key={`expanded-${item.index}`}>
                          <td>{item.index}{item.name ? ` - ${item.name}` : ''}</td>
                          <td>{item.passed ? 'ok' : 'falhou'}</td>
                          <td>{item.text}</td>
                          <td>{item.lastMessage?.text || '-'}</td>
                          <td>{(item.checks || []).map((check: any) => `${check.type}:${check.passed ? 'ok' : 'fail'}`).join(', ') || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="simulation-result-detail-button"
                              onClick={() => openSimulationResultDetail(item)}
                            >
                              <Maximize2 size={14} />
                              Abrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {tagDashboardOpen && (
          <div className="modal-backdrop" onClick={() => setTagDashboardOpen(false)}>
            <div className="json-modal wide-modal tag-dashboard-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header tag-dashboard-modal-header">
                <div>
                  <strong>Dashboard</strong>
                  <small>Métricas por tag e histórico das conversas do fluxo.</small>
                </div>
                <button onClick={() => setTagDashboardOpen(false)}><X size={16} />Fechar</button>
              </div>
              <div className="tag-dashboard-body">
                <section className="tag-dashboard-filter-panel">
                  <div className="tag-dashboard-section-title">
                    <strong>Filtros</strong>
                    <span>Use uma ou várias tags separadas por vírgula.</span>
                  </div>
                  <div className="tag-dashboard-filters">
                    <label>
                      Data inicial
                      <input
                        type="datetime-local"
                        value={tagDashboardFilters.dateFrom}
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Data final
                      <input
                        type="datetime-local"
                        value={tagDashboardFilters.dateTo}
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      />
                    </label>
                    <label className="tag-dashboard-filter-wide">
                      Fluxo
                      <select
                        value={tagDashboardFilters.flowId}
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, flowId: event.target.value }))}
                      >
                        <option value="">Todos os fluxos</option>
                        {flows.map((flow) => (
                          <option key={flow._id} value={flow._id}>{flow.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Conversa
                      <input
                        value={tagDashboardFilters.conversationId}
                        placeholder="whatsapp-5511999999999"
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, conversationId: event.target.value }))}
                      />
                    </label>
                    <label className="tag-dashboard-filter-wide">
                      Tags
                      <input
                        value={tagDashboardFilters.tags}
                        placeholder="lead_qualificado, conversao, abandono"
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, tags: event.target.value }))}
                      />
                      <span className="field-hint">Exemplo: <code>lead_qualificado, agendamento_confirmado</code></span>
                      {parseTagFilters(tagDashboardFilters.tags).length > 0 && (
                        <div className="tag-filter-chips">
                          {parseTagFilters(tagDashboardFilters.tags).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </label>
                    <label>
                      Limite de eventos
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={tagDashboardFilters.limit}
                        onChange={(event) => setTagDashboardFilters((current) => ({ ...current, limit: Number(event.target.value) || 100 }))}
                      />
                    </label>
                    <div className="tag-dashboard-filter-actions">
                      <button className="primary-button tag-dashboard-filter-button" onClick={() => void applyTagDashboardFilters()} disabled={tagDashboardLoading}>
                        {tagDashboardLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                        Filtrar
                      </button>
                    </div>
                  </div>
                </section>

                <div className="tag-dashboard-tabs">
                  <button className={tagDashboardTab === 'dashboard' ? 'active' : ''} onClick={() => setTagDashboardTab('dashboard')}>
                    Dashboard
                  </button>
                  <button className={tagDashboardTab === 'insights' ? 'active' : ''} onClick={() => setTagDashboardTab('insights')}>
                    Insights
                  </button>
                  <button className={tagDashboardTab === 'trace' ? 'active' : ''} onClick={() => setTagDashboardTab('trace')}>
                    Dados do trace
                  </button>
                  <button className={tagDashboardTab === 'history' ? 'active' : ''} onClick={() => setTagDashboardTab('history')}>
                    Histórico de mensagens
                  </button>
                </div>

                {/* <button className="primary-button" onClick={() => void applyTagDashboardFilters()} disabled={tagDashboardLoading}>
                  {tagDashboardLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                  Filtrar
                </button> */}
                {tagDashboardError && <div className="api-warning">{tagDashboardError}</div>}

                {tagDashboard && (
                  <>
                    <div className="dashboard-card-grid">
                      <div className="dashboard-card"><span>Eventos</span><strong>{String(tagDashboard.summary?.total || 0)}</strong></div>
                      <div className="dashboard-card"><span>Conversas</span><strong>{String(tagDashboard.summary?.conversations || 0)}</strong></div>
                      <div className="dashboard-card"><span>Tags</span><strong>{String(tagDashboard.summary?.tags || 0)}</strong></div>
                      <div className="dashboard-card"><span>Fluxos</span><strong>{String(tagDashboard.summary?.flows || 0)}</strong></div>
                    </div>

                    {tagDashboardTab === 'dashboard' && (
                      <div className="tag-dashboard-tab-panel">
                        <div className="tag-dashboard-view-toolbar">
                          <div>
                            <strong>Tags mais usadas</strong>
                            <span>Escolha como visualizar a distribuição dos eventos.</span>
                          </div>
                          <div className="tag-dashboard-view-toggle" role="group" aria-label="Formato do dashboard de tags">
                            <button className={tagDashboardView === 'table' ? 'active' : ''} onClick={() => setTagDashboardView('table')}>
                              <Table2 size={15} />Tabela
                            </button>
                            <button className={tagDashboardView === 'bar' ? 'active' : ''} onClick={() => setTagDashboardView('bar')}>
                              <ChartColumn size={15} />Barras
                            </button>
                            <button className={tagDashboardView === 'pie' ? 'active' : ''} onClick={() => setTagDashboardView('pie')}>
                              <PieChart size={15} />Pizza
                            </button>
                            <button className={tagDashboardView === 'line' ? 'active' : ''} onClick={() => setTagDashboardView('line')}>
                              <LineChart size={15} />Gráfico
                            </button>
                          </div>
                        </div>

                        {tagDashboardView === 'table' ? (
                          <div className="dashboard-table-wrap">
                            <strong>Tags mais usadas</strong>
                            <table>
                              <thead>
                                <tr><th>Tag</th><th>Eventos</th><th>Conversas</th></tr>
                              </thead>
                              <tbody>
                                {(tagDashboard.byTag || []).length > 0 ? (tagDashboard.byTag || []).map((item: any) => (
                                  <tr key={item.tag}>
                                    <td>{item.tag}</td>
                                    <td>{item.count}</td>
                                    <td>{item.conversations}</td>
                                  </tr>
                                )) : (
                                  <tr>
                                    <td colSpan={3}>Nenhuma tag encontrada para os filtros atuais.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <TagDashboardVisualization mode={tagDashboardView} series={tagDashboardSeries} />
                        )}

                        <div className="dashboard-table-wrap tag-dashboard-events-table">
                          <strong>Eventos recentes</strong>
                          <table>
                            <thead>
                              <tr><th>Data</th><th>Tag</th><th>Nó</th><th>Fluxo</th><th>Conversa</th><th>Valor</th></tr>
                            </thead>
                            <tbody>
                              {(tagDashboard.events || []).map((event: any) => (
                                <tr key={event._id}>
                                  <td>{event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : ''}</td>
                                  <td>{event.tag}</td>
                                  <td>{event.stepTitle || event.stepId}</td>
                                  <td>{event.flowName || event.flowId}</td>
                                  <td>{event.conversationId}</td>
                                  <td>{typeof event.value === 'object' ? JSON.stringify(event.value) : String(event.value ?? '')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {tagDashboardTab === 'insights' && (
                      <div className="tag-dashboard-tab-panel">
                        <div className="dashboard-card-grid">
                          <div className="dashboard-card"><span>Mensagens</span><strong>{formatMetric(tagDashboardInsights.summary?.totalMessages)}</strong></div>
                          <div className="dashboard-card"><span>Usuarios</span><strong>{formatMetric(tagDashboardInsights.summary?.userMessages)}</strong></div>
                          <div className="dashboard-card"><span>Media por conversa</span><strong>{formatMetric(tagDashboardInsights.summary?.avgMessagesPerConversation, 1)}</strong></div>
                          <div className="dashboard-card"><span>Conversas longas</span><strong>{formatMetric(tagDashboardInsights.summary?.longConversations)}</strong></div>
                        </div>
                        <div className="tag-dashboard-insight-grid">
                          <DashboardBarList
                            title="Acesso por fluxo"
                            subtitle="Mensagens registradas"
                            series={insightFlowSeries}
                            emptyText="Nenhum dado de mensagem encontrado para os filtros atuais."
                          />
                          <DashboardBarList
                            title="Canais"
                            subtitle="Origem das conversas"
                            series={insightChannelSeries}
                            emptyText="Nenhum canal encontrado para os filtros atuais."
                          />
                        </div>
                        <div className="dashboard-table-wrap">
                          <strong>Conversas com mais friccao</strong>
                          <table>
                            <thead>
                              <tr><th>Conversa</th><th>Mensagens</th><th>Usuario</th><th>Assistente</th><th>Ultima interacao</th></tr>
                            </thead>
                            <tbody>
                              {(tagDashboardInsights.topConversations || []).length > 0 ? (tagDashboardInsights.topConversations || []).map((item: any) => (
                                <tr key={item.conversationId}>
                                  <td>{item.conversationId}</td>
                                  <td>{item.messages}</td>
                                  <td>{item.userMessages}</td>
                                  <td>{item.assistantMessages}</td>
                                  <td>{item.lastAt ? new Date(item.lastAt).toLocaleString('pt-BR') : ''}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={5}>Nenhuma conversa encontrada para os filtros atuais.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {tagDashboardTab === 'trace' && (
                      <div className="tag-dashboard-tab-panel">
                        <div className="dashboard-card-grid">
                          <div className="dashboard-card"><span>Execucoes</span><strong>{formatMetric(tagDashboardTrace.summary?.runs)}</strong></div>
                          <div className="dashboard-card"><span>Eventos de trace</span><strong>{formatMetric(tagDashboardTrace.summary?.totalEvents)}</strong></div>
                          <div className="dashboard-card"><span>Erros</span><strong>{formatMetric(tagDashboardTrace.summary?.errorCount)}</strong></div>
                          <div className="dashboard-card"><span>Nos tocados</span><strong>{formatMetric(tagDashboardTrace.summary?.nodesTouched)}</strong></div>
                        </div>
                        <div className="tag-dashboard-insight-grid">
                          <DashboardBarList
                            title="Nos mais acessados"
                            subtitle="Contagem por step"
                            series={traceNodeSeries}
                            emptyText="Nenhum dado de no encontrado no trace."
                          />
                          <DashboardBarList
                            title="Chamadas e componentes"
                            subtitle="Eventos por tipo"
                            series={traceCallSeries}
                            emptyText="Nenhuma chamada registrada no trace."
                          />
                        </div>
                        <div className="dashboard-table-wrap">
                          <strong>Erros recentes do trace</strong>
                          <table>
                            <thead>
                              <tr><th>Data</th><th>Tipo</th><th>No</th><th>Conversa</th><th>Mensagem</th></tr>
                            </thead>
                            <tbody>
                              {(tagDashboardTrace.errors || []).length > 0 ? (tagDashboardTrace.errors || []).map((item: any, index: number) => (
                                <tr key={`${item.conversationId || 'trace'}-${index}`}>
                                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : ''}</td>
                                  <td>{item.type}</td>
                                  <td>{item.stepId || '-'}</td>
                                  <td>{item.conversationId || '-'}</td>
                                  <td>{item.message}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={5}>Nenhum erro de trace encontrado para os filtros atuais.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {tagDashboardTab === 'history' && (
                      <div className="tag-dashboard-history-panel">
                        <div className="tag-dashboard-pagination">
                          <div>
                            <strong>Histórico de mensagens</strong>
                            <span>
                              {tagHistoryTotal > 0
                                ? `Mostrando ${tagHistoryStart}-${tagHistoryEnd} de ${tagHistoryTotal}`
                                : 'Nenhuma mensagem encontrada'}
                            </span>
                          </div>
                          <div className="tag-dashboard-page-controls">
                            <label>
                              Por página
                              <select
                                value={tagDashboardHistoryLimit}
                                onChange={(event) => void changeTagDashboardHistoryLimit(Number(event.target.value))}
                                disabled={tagDashboardLoading}
                              >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                              </select>
                            </label>
                            <button
                              onClick={() => void changeTagDashboardHistoryPage(tagHistoryPage - 1)}
                              disabled={tagDashboardLoading || tagHistoryPage <= 1}
                            >
                              Anterior
                            </button>
                            <span>Página {tagHistoryPage} de {tagHistoryTotalPages}</span>
                            <button
                              onClick={() => void changeTagDashboardHistoryPage(tagHistoryPage + 1)}
                              disabled={tagDashboardLoading || tagHistoryPage >= tagHistoryTotalPages || tagHistoryTotal === 0}
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                        <div className="dashboard-table-wrap tag-dashboard-history-table">
                          <table>
                            <colgroup>
                              <col className="history-date-col" />
                              <col className="history-conversation-col" />
                              <col className="history-role-col" />
                              <col className="history-message-col" />
                            </colgroup>
                            <thead>
                              <tr><th>Data</th><th>Conversa</th><th>Papel</th><th>Mensagem</th></tr>
                            </thead>
                            <tbody>
                              {(tagDashboard.history || []).length > 0 ? (tagDashboard.history || []).map((message: any) => (
                                <tr key={message._id}>
                                  <td>{message.createdAt ? new Date(message.createdAt).toLocaleString('pt-BR') : ''}</td>
                                  <td>{message.conversationId}</td>
                                  <td>{message.role}</td>
                                  <td>{message.content}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={4}>Nenhuma mensagem encontrada para os filtros atuais.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {agentsOpen && (
          <div className="modal-backdrop" onMouseDown={() => setAgentsOpen(false)}>
            <div className="agents-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Agentes</strong>
                  <span>Escolha o agente antes de criar ou editar fluxos.</span>
                </div>
                <button aria-label="Fechar" onClick={() => setAgentsOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="agents-body">
                <div className="component-search">
                  <Search size={16} />
                  <input
                    value={agentSearch}
                    placeholder="Filtrar agente"
                    onChange={(event) => setAgentSearch(event.target.value)}
                  />
                </div>
                <div className="agent-create-row">
                  <input
                    value={agentCreateName}
                    placeholder="Novo agente, ex: clinica-medica"
                    onChange={(event) => setAgentCreateName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void createAgent();
                    }}
                  />
                  <button type="button" className="primary-button" onClick={() => void createAgent()} disabled={agentsLoading || !agentCreateName.trim()}>
                    <Plus size={16} />
                    Criar agente
                  </button>
                </div>
                {agentsError && <div className="auth-error">{agentsError}</div>}
                <div className="agent-grid">
                  {agentsLoading && filteredAgents.length === 0 && (
                    <div className="component-empty">Carregando agentes...</div>
                  )}
                  {!agentsLoading && filteredAgents.length === 0 && (
                    <div className="component-empty">Nenhum agente encontrado.</div>
                  )}
                  {filteredAgents.map((agent) => {
                    const itemAgentId = getAgentRecordId(agent);
                    const itemAgentName = getAgentRecordName(agent);
                    const isCurrent = itemAgentId === normalizedAgentId;
                    const isEditing = agentEditingName === itemAgentId;
                    return (
                      <div
                        className={`agent-card ${isCurrent ? 'active' : ''} ${draggingAgentName === itemAgentId ? 'dragging' : ''} ${dragOverAgentName === itemAgentId && draggingAgentName !== itemAgentId ? 'drag-over' : ''}`}
                        key={itemAgentId}
                        role="button"
                        tabIndex={isEditing ? -1 : 0}
                        aria-current={isCurrent ? 'true' : undefined}
                        title={isCurrent ? 'Agente atual' : `Entrar no agente ${itemAgentName}`}
                        onDragOver={(event) => {
                          if (!draggingAgentName || draggingAgentName === itemAgentId) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDragOverAgentName(itemAgentId);
                        }}
                        onDrop={(event) => {
                          if (!draggingAgentName) return;
                          event.preventDefault();
                          event.stopPropagation();
                          moveAgentToTarget(draggingAgentName, itemAgentId);
                          setDraggingAgentName('');
                          setDragOverAgentName('');
                        }}
                        onClick={() => {
                          if (!isEditing && (!isCurrent || agentChangedOnSavedFlow)) void enterAgent(itemAgentId);
                        }}
                        onKeyDown={(event) => {
                          if (isEditing) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            if (!isCurrent || agentChangedOnSavedFlow) void enterAgent(itemAgentId);
                          }
                        }}
                      >
                        <div className="agent-card-icon">
                          <Bot size={20} />
                        </div>
                        <div className="agent-card-main">
                          {isEditing ? (
                            <input
                              value={agentEditingDraft}
                              autoFocus
                              onChange={(event) => setAgentEditingDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') void saveAgentRename();
                                if (event.key === 'Escape') {
                                  setAgentEditingName('');
                                  setAgentEditingDraft('');
                                }
                              }}
                            />
                          ) : (
                            <strong>{itemAgentName}</strong>
                          )}
                          <small>ID: {itemAgentId}</small>
                          <span>{agent.flowCount || 0} fluxo{Number(agent.flowCount || 0) === 1 ? '' : 's'}</span>
                        </div>
                        <div className="agent-card-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                title="Salvar nome"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void saveAgentRename();
                                }}
                                disabled={agentsLoading}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                title="Cancelar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAgentEditingName('');
                                  setAgentEditingDraft('');
                                }}
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className="drag-handle"
                                title="Arraste para ordenar"
                                draggable={!agentsLoading && !agentOrderSaving}
                                onClick={(event) => event.stopPropagation()}
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData('text/plain', itemAgentId);
                                  setDraggingAgentName(itemAgentId);
                                  setDragOverAgentName('');
                                }}
                                onDragEnd={() => {
                                  setDraggingAgentName('');
                                  setDragOverAgentName('');
                                }}
                              >
                                <GripVertical size={15} />
                              </span>
                              <button
                                type="button"
                                title="Configurar Agent OS"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openAgentStudioForAgent(agent);
                                }}
                              >
                                <ShieldCheck size={15} />
                              </button>
                              <button
                                type="button"
                                title="Editar nome"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startAgentRename(agent);
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                title="Excluir agente"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  requestAgentDelete(agent);
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-actions agent-order-actions">
                <button type="button" onClick={() => setAgentsOpen(false)}>Fechar</button>
                <button className="primary-button" type="button" onClick={() => void saveAgentOrder()} disabled={agentOrderSaving || visibleAgents.length === 0}>
                  {agentOrderSaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  Salvar ordem
                </button>
              </div>
            </div>
          </div>
        )}

        {agentDeleteTarget && (
          <div className="modal-backdrop" onMouseDown={() => setAgentDeleteTarget(null)}>
            <div className="agent-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="confirm-body">
                <div className="confirm-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <strong>Excluir agente?</strong>
                  <p>
                    Esta acao remove o agente <code>{getAgentRecordName(agentDeleteTarget)}</code> e todos os {agentDeleteTarget.flowCount || 0} fluxo{Number(agentDeleteTarget.flowCount || 0) === 1 ? '' : 's'} dele. Para confirmar, digite o nome exato do agente.
                  </p>
                </div>
              </div>
              <label className="agent-delete-confirm">
                Nome do agente
                <input
                  value={agentDeleteConfirm}
                  autoFocus
                  placeholder={getAgentRecordName(agentDeleteTarget)}
                  onChange={(event) => setAgentDeleteConfirm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void deleteAgent();
                    if (event.key === 'Escape') setAgentDeleteTarget(null);
                  }}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setAgentDeleteTarget(null);
                    setAgentDeleteConfirm('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void deleteAgent()}
                  disabled={agentsLoading || agentDeleteConfirm.trim() !== getAgentRecordName(agentDeleteTarget)}
                >
                  <Trash2 size={16} />
                  Excluir agente
                </button>
              </div>
            </div>
          </div>
        )}

        {apiDocsOpen && (
          <div className="modal-backdrop" onClick={() => setApiDocsOpen(false)}>
            <div className="api-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>Consumir API do fluxo</strong>
                <button onClick={() => setApiDocsOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="api-docs">
                {!savedFlowId && (
                  <div className="api-warning">
                    Salve o fluxo para gerar um <strong>flowId</strong> real. Enquanto isso o exemplo usa
                    {' '}<code>&lt;FLOW_ID_SALVO&gt;</code>.
                  </div>
                )}
                <div className="api-endpoint">
                  <span>Endpoint</span>
                  <code>{apiExamples.endpoint}</code>
                </div>
                <div className="api-warning">
                  Use o <strong>agentId estavel</strong> no payload:
                  {' '}<code>{apiExampleAgentId}</code>
                  {agentDisplayName && agentDisplayName !== apiExampleAgentId ? (
                    <>
                      {' '}<span>Nome exibido: </span><code>{agentDisplayName}</code>.
                    </>
                  ) : null}
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>Autenticação</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.auth)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.auth}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>Payload base</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.payloadJson)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.payloadJson}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>cURL</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.curl)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.curl}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>JavaScript</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.javascript)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.javascript}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>Web widget</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.widget)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.widget}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>WhatsApp adapter</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.whatsapp)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.whatsapp}</pre>
                </div>
                <div className="api-doc-section">
                  <div className="api-doc-section-header">
                    <strong>Flow-to-MCP</strong>
                    <button onClick={() => navigator.clipboard.writeText(apiExamples.mcp)}>
                      <Copy size={15} />
                      Copiar
                    </button>
                  </div>
                  <pre>{apiExamples.mcp}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {apiKeysOpen && (
          <div className="modal-backdrop" onMouseDown={() => setApiKeysOpen(false)}>
            <div className="api-keys-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>API Keys</strong>
                <button aria-label="Fechar" onClick={() => setApiKeysOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <ApiKeysModal
                flowId={savedFlowId || undefined}
                flowName={flowName}
                agentId={selectedAgentStableId}
              />
            </div>
          </div>
        )}

        {flowOrderOpen && (
          <div className="modal-backdrop" onMouseDown={() => setFlowOrderOpen(false)}>
            <div className="flow-order-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <strong>Fluxos do agente</strong>
                  <span>{normalizedAgentId}</span>
                </div>
                <button aria-label="Fechar" onClick={() => setFlowOrderOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <div className="flow-order-body">
                <div className="component-search">
                  <Search size={16} />
                  <input
                    value={flowSearch}
                    placeholder="Filtrar fluxo"
                    onChange={(event) => setFlowSearch(event.target.value)}
                  />
                </div>
                <div className="flow-create-row">
                  <input
                    value={flowCreateName}
                    placeholder="Novo fluxo, ex: boas-vindas"
                    onChange={(event) => setFlowCreateName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void createFlowFromManager();
                    }}
                  />
                  <button type="button" className="primary-button" onClick={() => void createFlowFromManager()} disabled={flowOrderSaving || !flowCreateName.trim()}>
                    <Plus size={16} />
                    Criar fluxo
                  </button>
                </div>
                {flowOrderError && <div className="auth-error">{flowOrderError}</div>}
                <div className="flow-grid">
                  {loadingFlows && flowOrderDraft.length === 0 && (
                    <div className="component-empty">Carregando fluxos...</div>
                  )}
                  {!loadingFlows && flowOrderDraft.length === 0 && (
                    <div className="component-empty">Nenhum fluxo salvo.</div>
                  )}
                  {!loadingFlows && flowOrderDraft.length > 0 && filteredFlowOrderDraft.length === 0 && (
                    <div className="component-empty">Nenhum fluxo encontrado.</div>
                  )}
                  {filteredFlowOrderDraft.map(({ flow, index }) => {
                    const isCurrent = flow._id === savedFlowId;
                    const isEditing = flowEditingId === flow._id;
                    return (
                      <div
                        key={flow._id}
                        className={`flow-card ${isCurrent ? 'active' : ''} ${draggingFlowId === flow._id ? 'dragging' : ''} ${dragOverFlowId === flow._id && draggingFlowId !== flow._id ? 'drag-over' : ''}`}
                        role="button"
                        tabIndex={isEditing ? -1 : 0}
                        aria-current={isCurrent ? 'true' : undefined}
                        title={isCurrent ? 'Fluxo atual' : `Abrir fluxo ${flow.name}`}
                        onDragOver={(event) => {
                          if (!draggingFlowId || draggingFlowId === flow._id) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDragOverFlowId(flow._id);
                        }}
                        onDrop={(event) => {
                          if (!draggingFlowId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          moveFlowToTarget(draggingFlowId, flow._id);
                          setDraggingFlowId('');
                          setDragOverFlowId('');
                        }}
                        onClick={() => {
                          if (!isEditing) void enterFlow(flow);
                        }}
                        onKeyDown={(event) => {
                          if (isEditing) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            void enterFlow(flow);
                          }
                        }}
                      >
                        <span className="flow-card-index">{index + 1}</span>
                        <div className="flow-card-main">
                          {isEditing ? (
                            <input
                              value={flowEditingDraft}
                              autoFocus
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setFlowEditingDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') void saveFlowRename(flow);
                                if (event.key === 'Escape') {
                                  setFlowEditingId('');
                                  setFlowEditingDraft('');
                                }
                              }}
                            />
                          ) : (
                            <strong>{flow.name}</strong>
                          )}
                          <span>{flow.config?.title || flow.config?.responseName || 'Fluxo salvo'}</span>
                        </div>
                        <div className="flow-card-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                title="Salvar nome"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void saveFlowRename(flow);
                                }}
                                disabled={flowOrderSaving}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                title="Cancelar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setFlowEditingId('');
                                  setFlowEditingDraft('');
                                }}
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className="drag-handle"
                                title="Arraste para ordenar"
                                draggable={!flowOrderSaving}
                                onClick={(event) => event.stopPropagation()}
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData('text/plain', flow._id);
                                  setDraggingFlowId(flow._id);
                                  setDragOverFlowId('');
                                }}
                                onDragEnd={() => {
                                  setDraggingFlowId('');
                                  setDragOverFlowId('');
                                }}
                              >
                                <GripVertical size={15} />
                              </span>
                              <button
                                type="button"
                                title="Editar nome"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startFlowRename(flow);
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                title="Excluir fluxo"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  requestDeleteFlowRecord(flow);
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-actions flow-order-actions">
                <button onClick={() => setFlowOrderOpen(false)}>Cancelar</button>
                <button className="primary-button" onClick={() => void saveFlowOrder()} disabled={flowOrderSaving || flowOrderDraft.length === 0}>
                  {flowOrderSaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                  Salvar ordem
                </button>
              </div>
            </div>
          </div>
        )}

        {agentStudioOpen && (
          <AgentStudioModal
            agentId={selectedAgentStableId}
            agentName={agentDisplayName}
            config={{
              model: config.model,
              llmProvider: config.llmProvider || 'openai',
              agentSpec: config.agentSpec,
            }}
            providerOptions={LLM_PROVIDER_OPTIONS}
            modelOptions={getLlmModelValuesForProvider(config.llmProvider || 'openai', config.model)}
            saving={agentStudioSaving}
            workspaceBusy={agentStudioWorkspaceBusy}
            error={agentStudioError}
            message={agentStudioMessage}
            onChange={(patch) => {
              setAgentStudioMessage('');
              updateConfig(patch as Partial<FlowConfig>);
            }}
            onSave={() => void saveAgentStudioConfig()}
            onExportWorkspace={() => void exportAgentWorkspace()}
            onImportWorkspace={(raw) => void importAgentWorkspace(raw)}
            onClose={() => setAgentStudioOpen(false)}
            onOpenProviders={() => {
              setAgentStudioOpen(false);
              setProviderConfigOpen(true);
            }}
            onOpenAgentOps={() => {
              setAgentStudioOpen(false);
              void openAgentOpsDashboard();
            }}
          />
        )}

        {providerConfigOpen && (
          <div className="modal-backdrop" onMouseDown={() => setProviderConfigOpen(false)}>
            <div className="provider-config-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <strong>Provedores</strong>
                <button aria-label="Fechar" onClick={() => setProviderConfigOpen(false)}>
                  <X size={16} />
                  Fechar
                </button>
              </div>
              <ProviderConfigModal
                agentId={virtualDefaultAgent ? undefined : selectedAgentStableId}
                flowId={savedFlowId || undefined}
                flowName={flowName}
                onClose={() => setProviderConfigOpen(false)}
              />
            </div>
          </div>
        )}

        {versionRenameTarget && (
          <div className="modal-backdrop" onMouseDown={closeVersionRename}>
            <div className="confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="confirm-body">
                <div className="confirm-icon primary">
                  <Pencil size={20} />
                </div>
                <div>
                  <strong>
                    Renomear {versionRenameTarget.kind === 'agent' ? `r${versionRenameTarget.version}` : `v${versionRenameTarget.version}`}
                  </strong>
                  <p>Use nomes como dev, hml ou prd para identificar melhor cada versão.</p>
                </div>
              </div>
              <label className="confirm-text-input">
                <span>Nome da versão</span>
                <input
                  value={versionRenameDraft}
                  autoFocus
                  placeholder={versionRenameTarget.kind === 'agent' ? 'Ex: hml agente' : 'Ex: hml'}
                  onChange={(event) => setVersionRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveVersionRename();
                    if (event.key === 'Escape') closeVersionRename();
                  }}
                />
              </label>
              {versionRenameError && <div className="api-warning flow-transfer-error">{versionRenameError}</div>}
              <div className="modal-actions">
                <button onClick={closeVersionRename}>Cancelar</button>
                <button className="primary-button" onClick={() => void saveVersionRename()} disabled={versionRenameSaving || !versionRenameDraft.trim()}>
                  {versionRenameSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  Salvar nome
                </button>
              </div>
            </div>
          </div>
        )}

        {versionOverwriteTarget && (
          <div className="modal-backdrop" onMouseDown={closeVersionOverwrite}>
            <div className="confirm-modal version-overwrite-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="confirm-body">
                <div className="confirm-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <strong>
                    Publicar {versionOverwriteTarget.kind === 'agent' ? `r${versionOverwriteTarget.version}` : `v${versionOverwriteTarget.version}`}
                  </strong>
                  <p>
                    {versionOverwriteTarget.kind === 'agent'
                      ? 'Escolha se esta versão do agente será atualizada com as últimas versões criadas dos fluxos ou por outra versão do agente.'
                      : 'Escolha se esta versão do fluxo será publicada com o rascunho atual do editor ou substituída por outra versão do fluxo.'}
                  </p>
                </div>
              </div>
              {versionOverwriteTarget.isActive && (
                <div className="api-warning flow-transfer-error">
                  Esta versão está ativa. Publicar nela altera o que os clientes recebem.
                </div>
              )}
              <label className="confirm-text-input">
                <span>{versionOverwriteTarget.kind === 'agent' ? 'Origem da atualização' : 'Origem da publicação'}</span>
                <select
                  value={versionOverwriteSource}
                  onChange={(event) => {
                    setVersionOverwriteSource(event.target.value as VersionOverwriteSource);
                    setVersionOverwriteSourceVersion('');
                    setVersionOverwriteError('');
                  }}
                >
                  <option value="draft">
                    {versionOverwriteTarget.kind === 'agent' ? 'Últimas versões criadas dos fluxos' : 'Rascunho atual do editor'}
                  </option>
                  <option value="version">
                    {versionOverwriteTarget.kind === 'agent' ? 'Outra versão do agente' : 'Outra versão do fluxo'}
                  </option>
                </select>
              </label>
              {versionOverwriteSource === 'version' && (
                <label className="confirm-text-input">
                  <span>Versão de origem</span>
                  <select
                    value={effectiveOverwriteSourceVersion}
                    onChange={(event) => {
                      setVersionOverwriteSourceVersion(event.target.value);
                      setVersionOverwriteError('');
                    }}
                    disabled={!overwriteVersionOptions.length}
                  >
                    {!overwriteVersionOptions.length && <option value="">Nenhuma versão disponível</option>}
                    {overwriteVersionOptions.map((item: any) => {
                      const number = versionOverwriteTarget.kind === 'agent' ? item.release : item.version;
                      const label = versionOverwriteTarget.kind === 'agent' ? `r${number}` : `v${number}`;
                      return (
                        <option key={label} value={String(number)}>
                          {label}{item.name ? ` - ${item.name}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}
              {versionOverwriteError && <div className="api-warning flow-transfer-error">{versionOverwriteError}</div>}
              <div className="modal-actions">
                <button onClick={closeVersionOverwrite}>Cancelar</button>
                <button
                  className="danger-button"
                  onClick={() => void saveVersionOverwrite()}
                  disabled={flowVersionSaving || overwriteNeedsSourceVersion}
                >
                  {flowVersionSaving ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  Publicar
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="modal-backdrop" onMouseDown={() => setConfirmDialog(null)}>
            <div className="confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
              <div className="confirm-body">
                <div className="confirm-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <strong>{confirmDialog.title}</strong>
                  <p>{confirmDialog.message}</p>
                </div>
              </div>
              {confirmDialog.confirmationText && (
                <label className="confirm-text-input">
                  <span>{confirmDialog.confirmationPrompt || `Digite ${confirmDialog.confirmationText} para confirmar.`}</span>
                  <input
                    value={confirmInput}
                    autoFocus
                    onChange={(event) => setConfirmInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && confirmInput.trim() === confirmDialog.confirmationText) {
                        const dialog = confirmDialog;
                        setConfirmDialog(null);
                        dialog.onConfirm();
                      }
                    }}
                  />
                </label>
              )}
              <div className="modal-actions">
                <button onClick={() => setConfirmDialog(null)}>Cancelar</button>
                <button
                  className={confirmDialog.variant === 'primary' ? 'primary-button' : 'danger-button'}
                  disabled={Boolean(confirmDialog.confirmationText && confirmInput.trim() !== confirmDialog.confirmationText)}
                  onClick={() => {
                    const dialog = confirmDialog;
                    setConfirmDialog(null);
                    dialog.onConfirm();
                  }}
                >
                  {confirmDialog.confirmLabel.toLowerCase().startsWith('ativar')
                    ? <Check size={16} />
                    : confirmDialog.variant === 'primary'
                      ? <Save size={16} />
                      : confirmDialog.confirmLabel.toLowerCase().startsWith('excluir')
                      ? <Trash2 size={16} />
                      : <Upload size={16} />}
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
