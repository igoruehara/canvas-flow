import { useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  GitBranch,
  Network,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { getDefaultLlmModelForProvider } from '../lib/llmModels';
import type { FlowConfig, FlowLlmProvider } from '../types/flow';

type AgentStudioConfig = Pick<FlowConfig, 'model' | 'llmProvider' | 'agentSpec'>;
type AgentStudioTab = 'profile' | 'guardrails' | 'manifest' | 'skills' | 'subagents' | 'rules' | 'mcp';
type AgentLoadMode = 'always' | 'auto' | 'on_demand' | 'manual';

type AgentStudioModalProps = {
  agentId: string;
  agentName: string;
  config: AgentStudioConfig;
  providerOptions: Array<{ value: FlowLlmProvider; label: string }>;
  modelOptions: string[];
  saving?: boolean;
  workspaceBusy?: boolean;
  error?: string;
  message?: string;
  onChange: (patch: Partial<AgentStudioConfig>) => void;
  onSave: () => void;
  onExportWorkspace?: () => void | Promise<void>;
  onImportWorkspace?: (raw: string) => void | Promise<void>;
  onClose: () => void;
  onOpenProviders?: () => void;
  onOpenAgentOps?: () => void;
};

const emptySpec = {
  agentsMd: '',
  guardrails: '',
  blockedTerms: [] as string[],
  rules: [] as Array<Record<string, unknown>>,
  skills: [] as Array<Record<string, unknown>>,
  subagents: [] as Array<Record<string, unknown>>,
  mcpServers: [] as Array<Record<string, unknown>>,
};

const tabItems: Array<{ id: AgentStudioTab; label: string; icon: typeof Bot }> = [
  { id: 'profile', label: 'Perfil', icon: Bot },
  { id: 'guardrails', label: 'Guardrails', icon: ShieldCheck },
  { id: 'manifest', label: 'Manifest', icon: FileJson },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'subagents', label: 'Subagents', icon: GitBranch },
  { id: 'rules', label: 'Rules', icon: CheckCircle2 },
  { id: 'mcp', label: 'MCP', icon: Network },
];

const agentOsConcepts = [
  {
    title: 'Agents.md',
    mode: 'sempre presente',
    text: 'Arquitetura do projeto, decisões de design, funcionamento do sistema e papel do agente orquestrador.',
  },
  {
    title: 'Rules',
    mode: 'sempre ou sob demanda',
    text: 'Convenções, restrições de segurança e regras que orientam ou redirecionam decisões do agente.',
  },
  {
    title: 'Skills',
    mode: 'contexto principal',
    text: 'Tarefas específicas com instruções e ferramentas/scripts auxiliares, sem delegar para outro agente.',
  },
  {
    title: 'Subagents',
    mode: 'sempre presentes',
    text: 'Especialistas com contexto isolado e modelo próprio; devolvem resumo ao pai e não encadeiam spam.',
  },
  {
    title: 'MCP',
    mode: 'sob demanda',
    text: 'Ferramentas externas, APIs, bancos de dados, Google Drive e outros sistemas conectados.',
  },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}

function asText(value: unknown) {
  return String(value ?? '');
}

function itemId(item: Record<string, unknown>, fallback: string) {
  return asText(item.id || item.key || item.name || item.label || fallback).trim() || fallback;
}

function itemName(item: Record<string, unknown>, fallback: string) {
  return asText(item.name || item.label || item.title || itemId(item, fallback)).trim() || fallback;
}

function itemDescription(item: Record<string, unknown>) {
  return asText(item.description || item.role || item.instructions || item.instruction || item.action).trim();
}

function itemLoadMode(item: Record<string, unknown>, fallback: AgentLoadMode): AgentLoadMode {
  const mode = asText(item.load || item.loadMode || item.when).trim();
  if (mode === 'always' || mode === 'auto' || mode === 'on_demand' || mode === 'manual') return mode;
  return fallback;
}

function defaultPath(folder: string, item: Record<string, unknown>, suffix: string, index: number) {
  const id = itemId(item, `${folder}-${index + 1}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '') || `${folder}-${index + 1}`;
  return `.canvas-flow/${folder}/${id}${suffix}`;
}

function parseJsonList(value: string, fallback: Array<Record<string, unknown>>) {
  try {
    const parsed = JSON.parse(value);
    return safeList(parsed);
  } catch {
    return fallback;
  }
}

function parseJsonObject(value: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback;
  } catch {
    return fallback;
  }
}

function formatJsonObject(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return JSON.stringify(source, null, 2);
}

export function AgentStudioModal({
  agentId,
  agentName,
  config,
  providerOptions,
  modelOptions,
  saving = false,
  workspaceBusy = false,
  error = '',
  message = '',
  onChange,
  onSave,
  onExportWorkspace,
  onImportWorkspace,
  onClose,
  onOpenProviders,
  onOpenAgentOps,
}: AgentStudioModalProps) {
  const [activeTab, setActiveTab] = useState<AgentStudioTab>('profile');
  const workspaceInputRef = useRef<HTMLInputElement | null>(null);
  const spec = { ...emptySpec, ...(config.agentSpec || {}) };
  const skills = safeList(spec.skills);
  const subagents = safeList(spec.subagents);
  const rules = safeList(spec.rules);
  const mcpServers = safeList(spec.mcpServers);
  const selectedProvider = (config.llmProvider || 'openai') as FlowLlmProvider;
  const selectedProviderLabel = providerOptions.find((item) => item.value === selectedProvider)?.label || 'OpenAI';
  const models = useMemo(() => Array.from(new Set([config.model, ...modelOptions].filter(Boolean) as string[])), [config.model, modelOptions]);

  const updateSpec = (patch: Partial<typeof emptySpec>) => {
    onChange({ agentSpec: { ...spec, ...patch } });
  };

  const updateList = (key: 'skills' | 'subagents' | 'rules' | 'mcpServers', list: Array<Record<string, unknown>>) => {
    updateSpec({ [key]: list } as Partial<typeof emptySpec>);
  };

  const updateListItem = (key: 'skills' | 'subagents' | 'rules' | 'mcpServers', index: number, patch: Record<string, unknown>) => {
    const current = safeList(spec[key]);
    const next = current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    updateList(key, next);
  };

  const removeListItem = (key: 'skills' | 'subagents' | 'rules' | 'mcpServers', index: number) => {
    updateList(key, safeList(spec[key]).filter((_, itemIndex) => itemIndex !== index));
  };

  const importWorkspaceFile = async (file?: File | null) => {
    if (!file || !onImportWorkspace) return;
    const raw = await file.text();
    await onImportWorkspace(raw);
  };

  const renderLoadSelect = (
    key: 'skills' | 'subagents' | 'rules' | 'mcpServers',
    index: number,
    item: Record<string, unknown>,
    fallback: AgentLoadMode,
  ) => (
    <label>
      Load
      <select value={itemLoadMode(item, fallback)} onChange={(event) => updateListItem(key, index, { load: event.target.value })}>
        <option value="always">Sempre no contexto</option>
        <option value="auto">Auto</option>
        <option value="on_demand">Sob demanda</option>
        <option value="manual">Manual</option>
      </select>
    </label>
  );

  const renderToolContractFields = (
    key: 'skills' | 'subagents' | 'mcpServers',
    index: number,
    item: Record<string, unknown>,
  ) => (
    <details className="agent-studio-advanced-json">
      <summary>Contrato de execucao</summary>
      <div className="agent-studio-fields two-columns">
        <label>
          Efeito
          <select value={asText(item.sideEffect || 'read')} onChange={(event) => updateListItem(key, index, { sideEffect: event.target.value })}>
            <option value="read">Somente leitura</option>
            <option value="write">Altera dados</option>
            <option value="external_action">Acao externa</option>
            <option value="none">Sem efeito externo</option>
          </select>
        </label>
        <label>
          Max retries
          <input
            type="number"
            min={0}
            max={3}
            value={Number(item.maxRetries ?? 0)}
            onChange={(event) => updateListItem(key, index, { maxRetries: Number(event.target.value || 0) })}
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={item.requiresApproval === true}
          onChange={(event) => updateListItem(key, index, { requiresApproval: event.target.checked })}
        />
        Exigir aprovacao antes de executar
      </label>
      <div className="agent-studio-fields two-columns">
        <label>
          Input schema
          <textarea
            rows={6}
            spellCheck={false}
            value={formatJsonObject(item.inputSchema)}
            onChange={(event) => updateListItem(key, index, { inputSchema: parseJsonObject(event.target.value, (item.inputSchema as Record<string, unknown>) || {}) })}
          />
        </label>
        <label>
          Output schema
          <textarea
            rows={6}
            spellCheck={false}
            value={formatJsonObject(item.outputSchema)}
            onChange={(event) => updateListItem(key, index, { outputSchema: parseJsonObject(event.target.value, (item.outputSchema as Record<string, unknown>) || {}) })}
          />
        </label>
      </div>
      <span className="field-hint">Schemas seguem JSON Schema simples: type, properties, required, enum, items e additionalProperties.</span>
    </details>
  );

  const manifestEntries = useMemo(() => ([
    ...rules.map((item, index) => ({
      kind: 'rule',
      id: itemId(item, `rule-${index + 1}`),
      name: itemName(item, `Rule ${index + 1}`),
      description: itemDescription(item),
      path: asText(item.path) || defaultPath('rules', item, '.rule.json', index),
      load: itemLoadMode(item, 'always'),
      enabled: item.enabled !== false,
    })),
    ...skills.map((item, index) => ({
      kind: 'skill',
      id: itemId(item, `skill-${index + 1}`),
      name: itemName(item, `Skill ${index + 1}`),
      description: itemDescription(item),
      path: asText(item.path) || defaultPath('skills', item, '/SKILL.md', index),
      load: itemLoadMode(item, 'auto'),
      enabled: item.enabled !== false,
    })),
    ...subagents.map((item, index) => ({
      kind: 'subagent',
      id: itemId(item, `subagent-${index + 1}`),
      name: itemName(item, `Subagent ${index + 1}`),
      description: itemDescription(item),
      path: asText(item.path) || defaultPath('subagents', item, '.agent.md', index),
      load: itemLoadMode(item, 'auto'),
      enabled: item.enabled !== false,
    })),
    ...mcpServers.map((item, index) => ({
      kind: 'mcp',
      id: itemId(item, `mcp-${index + 1}`),
      name: itemName(item, `MCP ${index + 1}`),
      description: itemDescription(item),
      path: asText(item.path) || '.canvas-flow/mcp.json',
      load: itemLoadMode(item, 'on_demand'),
      enabled: item.enabled !== false,
    })),
  ]), [rules, skills, subagents, mcpServers]);

  const renderProfile = () => (
    <div className="agent-studio-panel">
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Motor do agente</strong>
          <span>Este provider/modelo vira o default para todos os fluxos deste agente.</span>
        </div>
        <div className="agent-studio-fields two-columns">
          <label>
            Provider
            <select
              value={selectedProvider}
              onChange={(event) => {
                const provider = event.target.value as FlowLlmProvider;
                onChange({ llmProvider: provider, model: getDefaultLlmModelForProvider(provider) || config.model });
              }}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Modelo
            <select value={config.model || ''} onChange={(event) => onChange({ model: event.target.value })}>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="agent-studio-inline-actions">
          <button type="button" onClick={onOpenProviders}>
            <Database size={15} />
            Configurar provedores
          </button>
          <button type="button" onClick={onOpenAgentOps}>
            <Settings size={15} />
            Ver operacao
          </button>
        </div>
      </section>
      <section className="agent-studio-section agent-studio-workspace-card">
        <div className="agent-studio-section-title">
          <strong>Workspace .canvas-flow</strong>
          <span>Exporte ou importe um pacote versionavel com agents.md, rules, skills, subagents, mcp.json e guardrails.</span>
        </div>
        <div className="agent-studio-workspace-summary">
          <FileJson size={18} />
          <span>.canvas-flow/agents.md, rules/, skills/, subagents/, mcp.json</span>
        </div>
        <div className="agent-studio-inline-actions">
          <button type="button" onClick={onExportWorkspace} disabled={!onExportWorkspace || workspaceBusy}>
            <Download size={15} />
            {workspaceBusy ? 'Processando...' : 'Exportar workspace'}
          </button>
          <button type="button" onClick={() => workspaceInputRef.current?.click()} disabled={!onImportWorkspace || workspaceBusy}>
            <Upload size={15} />
            Importar workspace
          </button>
          <input
            ref={workspaceInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden-file-input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void importWorkspaceFile(file);
            }}
          />
        </div>
      </section>
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Agents.md</strong>
          <span>Sempre presente: arquitetura do projeto, decisões de design, funcionamento do sistema e papel do orquestrador.</span>
        </div>
        <textarea
          rows={12}
          value={spec.agentsMd || ''}
          placeholder={'# Agente principal orquestrador\nRecebe instrucoes do usuario, consulta rules e docs, delega tarefas e coordena subagents e skills.\n\n# Arquitetura do projeto\nExplique como o sistema funciona, decisoes de design e convencoes.\n\n# Operacao\n- Use skills no contexto principal\n- Delegue para subagents quando precisar de contexto isolado\n- Use MCP sob demanda para ferramentas externas'}
          onChange={(event) => updateSpec({ agentsMd: event.target.value })}
        />
      </section>
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Mapa mental do Agent OS</strong>
          <span>Como cada bloco entra na execução do agente.</span>
        </div>
        <div className="agent-studio-concept-grid">
          {agentOsConcepts.map((item) => (
            <div className="agent-studio-concept-card" key={item.title}>
              <strong>{item.title}</strong>
              <small>{item.mode}</small>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderGuardrails = () => (
    <div className="agent-studio-panel">
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Politicas e limites</strong>
          <span>Sempre presentes: restrições de segurança e limites duros antes do prompt dos nós LLM.</span>
        </div>
        <textarea
          rows={9}
          value={spec.guardrails || ''}
          placeholder="Nunca invente dados. Nao exponha segredos. Peça aprovacao humana antes de apagar, enviar ou alterar dados sensiveis."
          onChange={(event) => updateSpec({ guardrails: event.target.value })}
        />
      </section>
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Tripwires</strong>
          <span>Se a entrada tiver um termo bloqueado, a chamada LLM e interrompida antes de gastar tokens.</span>
        </div>
        <label>
          Termos bloqueados
          <input
            value={(spec.blockedTerms || []).join(', ')}
            placeholder="apagar banco, excluir cliente, vazar token"
            onChange={(event) => updateSpec({ blockedTerms: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
          />
        </label>
        <div className="agent-studio-chips">
          {(spec.blockedTerms || []).map((term) => <span key={term}>{term}</span>)}
          {!(spec.blockedTerms || []).length && <small>Nenhum termo bloqueado.</small>}
        </div>
      </section>
    </div>
  );

  const renderManifest = () => (
    <div className="agent-studio-panel">
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Manifest do orquestrador</strong>
          <span>Indice leve do que o agente principal pode enxergar antes de carregar conteudo completo.</span>
        </div>
        <div className="agent-studio-manifest-table">
          <div className="agent-studio-manifest-row header">
            <span>Tipo</span>
            <span>Nome</span>
            <span>Load</span>
            <span>Caminho</span>
          </div>
          {manifestEntries.map((entry) => (
            <div className={`agent-studio-manifest-row ${entry.enabled ? '' : 'disabled'}`} key={`${entry.kind}-${entry.id}`}>
              <span>{entry.kind}</span>
              <strong title={entry.description || entry.name}>{entry.name}</strong>
              <span>{entry.load}</span>
              <code>{entry.path}</code>
            </div>
          ))}
        </div>
        {!manifestEntries.length && <div className="component-empty">Crie rules, skills, subagents ou MCP para gerar o manifest.</div>}
      </section>
      <section className="agent-studio-section">
        <div className="agent-studio-section-title">
          <strong>Semantica de load</strong>
          <span>Como o runtime monta o contexto inicial e decide chamadas sob demanda.</span>
        </div>
        <div className="agent-studio-concept-grid">
          <div className="agent-studio-concept-card">
            <strong>always</strong>
            <small>sempre no contexto</small>
            <span>Conteudo completo entra no preamble do agente principal.</span>
          </div>
          <div className="agent-studio-concept-card">
            <strong>auto</strong>
            <small>agente decide</small>
            <span>O agente ve o resumo no manifest e carrega/chama quando for util.</span>
          </div>
          <div className="agent-studio-concept-card">
            <strong>on_demand</strong>
            <small>sob demanda</small>
            <span>Ferramenta ou contexto fica disponivel para chamada pontual.</span>
          </div>
          <div className="agent-studio-concept-card">
            <strong>manual</strong>
            <small>operador decide</small>
            <span>Disponivel para uso explicito, sem autoexecucao.</span>
          </div>
        </div>
      </section>
    </div>
  );

  const renderSkills = () => (
    <div className="agent-studio-panel">
      <div className="agent-studio-list-header">
        <div>
          <strong>Skills do agente</strong>
          <span>Tarefas específicas executadas no contexto principal, com instruções e ferramentas/scripts auxiliares.</span>
        </div>
        <button type="button" onClick={() => {
          const id = uid('skill');
          updateList('skills', [...skills, { id, name: 'Nova skill', description: '', kind: 'workflow', load: 'auto', path: `.canvas-flow/skills/${id}/SKILL.md`, enabled: true, sideEffect: 'read', requiresApproval: false, inputSchema: {}, outputSchema: {} }]);
        }}>
          <Plus size={15} />
          Skill
        </button>
      </div>
      {skills.map((skill, index) => (
        <section className="agent-studio-list-item" key={asText(skill.id) || index}>
          <div className="agent-studio-list-item-header">
            <label className="checkbox-row">
              <input type="checkbox" checked={skill.enabled !== false} onChange={(event) => updateListItem('skills', index, { enabled: event.target.checked })} />
              Ativa
            </label>
            <button type="button" className="danger-button" onClick={() => removeListItem('skills', index)}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="agent-studio-fields two-columns">
            <label>
              Nome
              <input value={asText(skill.name)} onChange={(event) => updateListItem('skills', index, { name: event.target.value })} />
            </label>
            <label>
              Tipo
              <select value={asText(skill.kind || 'workflow')} onChange={(event) => updateListItem('skills', index, { kind: event.target.value })}>
                <option value="workflow">Workflow</option>
                <option value="prompt">Prompt</option>
                <option value="tool">Tool</option>
                <option value="document">Documento</option>
              </select>
            </label>
            {renderLoadSelect('skills', index, skill, 'auto')}
          </div>
          <label>
            Caminho no workspace
            <input value={asText(skill.path || defaultPath('skills', skill, '/SKILL.md', index))} onChange={(event) => updateListItem('skills', index, { path: event.target.value })} />
          </label>
          <label>
            Descricao
            <textarea rows={3} value={asText(skill.description)} onChange={(event) => updateListItem('skills', index, { description: event.target.value })} />
          </label>
          {renderToolContractFields('skills', index, skill)}
        </section>
      ))}
      {!skills.length && <div className="component-empty">Nenhuma skill criada para este agente.</div>}
      <details className="agent-studio-advanced-json">
        <summary>JSON avancado</summary>
        <textarea rows={8} value={JSON.stringify(skills, null, 2)} onChange={(event) => updateList('skills', parseJsonList(event.target.value, skills))} />
      </details>
    </div>
  );

  const renderSubagents = () => (
    <div className="agent-studio-panel">
      <div className="agent-studio-list-header">
        <div>
          <strong>Subagents</strong>
          <span>Especialistas sempre disponíveis, com contexto isolado e modelo próprio; retornam resumo ao agente pai.</span>
        </div>
        <button type="button" onClick={() => {
          const id = uid('subagent');
          updateList('subagents', [...subagents, { id, name: 'Novo subagent', role: '', model: config.model || '', handoff: 'as_tool', load: 'auto', path: `.canvas-flow/subagents/${id}.agent.md`, enabled: true, sideEffect: 'read', requiresApproval: false, inputSchema: {}, outputSchema: {} }]);
        }}>
          <Plus size={15} />
          Subagent
        </button>
      </div>
      {subagents.map((subagent, index) => (
        <section className="agent-studio-list-item" key={asText(subagent.id) || index}>
          <div className="agent-studio-list-item-header">
            <label className="checkbox-row">
              <input type="checkbox" checked={subagent.enabled !== false} onChange={(event) => updateListItem('subagents', index, { enabled: event.target.checked })} />
              Ativo
            </label>
            <button type="button" className="danger-button" onClick={() => removeListItem('subagents', index)}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="agent-studio-fields two-columns">
            <label>
              Nome
              <input value={asText(subagent.name)} onChange={(event) => updateListItem('subagents', index, { name: event.target.value })} />
            </label>
            <label>
              Handoff
              <select value={asText(subagent.handoff || 'as_tool')} onChange={(event) => updateListItem('subagents', index, { handoff: event.target.value })}>
                <option value="as_tool">Manager chama como tool</option>
                <option value="handoff">Transfere conversa</option>
              </select>
            </label>
            {renderLoadSelect('subagents', index, subagent, 'auto')}
          </div>
          <label>
            Modelo
            <select value={asText(subagent.model || config.model || '')} onChange={(event) => updateListItem('subagents', index, { model: event.target.value })}>
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label>
            Caminho no workspace
            <input value={asText(subagent.path || defaultPath('subagents', subagent, '.agent.md', index))} onChange={(event) => updateListItem('subagents', index, { path: event.target.value })} />
          </label>
          <label>
            Papel
            <textarea rows={3} value={asText(subagent.role)} onChange={(event) => updateListItem('subagents', index, { role: event.target.value })} />
          </label>
          {renderToolContractFields('subagents', index, subagent)}
        </section>
      ))}
      {!subagents.length && <div className="component-empty">Nenhum subagent criado.</div>}
      <details className="agent-studio-advanced-json">
        <summary>JSON avancado</summary>
        <textarea rows={8} value={JSON.stringify(subagents, null, 2)} onChange={(event) => updateList('subagents', parseJsonList(event.target.value, subagents))} />
      </details>
    </div>
  );

  const renderRules = () => (
    <div className="agent-studio-panel">
      <div className="agent-studio-list-header">
        <div>
          <strong>Rules</strong>
          <span>Regras sempre presentes ou sob demanda para redirecionar decisões, carregar convenções e aplicar segurança.</span>
        </div>
        <button type="button" onClick={() => {
          const id = uid('rule');
          updateList('rules', [...rules, { id, name: 'Nova rule', timing: 'before_llm', condition: '', action: '', load: 'always', path: `.canvas-flow/rules/${id}.rule.json`, enabled: true }]);
        }}>
          <Plus size={15} />
          Rule
        </button>
      </div>
      {rules.map((rule, index) => (
        <section className="agent-studio-list-item" key={asText(rule.id) || index}>
          <div className="agent-studio-list-item-header">
            <label className="checkbox-row">
              <input type="checkbox" checked={rule.enabled !== false} onChange={(event) => updateListItem('rules', index, { enabled: event.target.checked })} />
              Ativa
            </label>
            <button type="button" className="danger-button" onClick={() => removeListItem('rules', index)}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="agent-studio-fields two-columns">
            <label>
              Nome
              <input value={asText(rule.name)} onChange={(event) => updateListItem('rules', index, { name: event.target.value })} />
            </label>
            <label>
              Momento
              <select value={asText(rule.timing || 'before_llm')} onChange={(event) => updateListItem('rules', index, { timing: event.target.value })}>
                <option value="always">Sempre presente</option>
                <option value="on_demand">Sob demanda</option>
                <option value="before_llm">Antes da LLM</option>
                <option value="before_tool">Antes de tool</option>
                <option value="after_tool">Depois de tool</option>
                <option value="final_output">Resposta final</option>
              </select>
            </label>
            {renderLoadSelect('rules', index, rule, 'always')}
          </div>
          <label>
            Caminho no workspace
            <input value={asText(rule.path || defaultPath('rules', rule, '.rule.json', index))} onChange={(event) => updateListItem('rules', index, { path: event.target.value })} />
          </label>
          <label>
            Condicao
            <textarea rows={2} value={asText(rule.condition)} onChange={(event) => updateListItem('rules', index, { condition: event.target.value })} />
          </label>
          <label>
            Acao
            <textarea rows={2} value={asText(rule.action)} onChange={(event) => updateListItem('rules', index, { action: event.target.value })} />
          </label>
        </section>
      ))}
      {!rules.length && <div className="component-empty">Nenhuma rule criada.</div>}
      <details className="agent-studio-advanced-json">
        <summary>JSON avancado</summary>
        <textarea rows={8} value={JSON.stringify(rules, null, 2)} onChange={(event) => updateList('rules', parseJsonList(event.target.value, rules))} />
      </details>
    </div>
  );

  const renderMcp = () => (
    <div className="agent-studio-panel">
      <div className="agent-studio-list-header">
        <div>
          <strong>MCP servers</strong>
          <span>Sob demanda: ferramentas externas, APIs, bancos, Google Drive e sistemas conectados.</span>
        </div>
        <button type="button" onClick={() => updateList('mcpServers', [...mcpServers, { id: uid('mcp'), label: 'Novo MCP', serverUrl: '', scope: 'agent', load: 'on_demand', path: '.canvas-flow/mcp.json', enabled: true, sideEffect: 'read', requiresApproval: false, inputSchema: {}, outputSchema: {} }])}>
          <Plus size={15} />
          MCP
        </button>
      </div>
      {mcpServers.map((server, index) => (
        <section className="agent-studio-list-item" key={asText(server.id) || index}>
          <div className="agent-studio-list-item-header">
            <label className="checkbox-row">
              <input type="checkbox" checked={server.enabled !== false} onChange={(event) => updateListItem('mcpServers', index, { enabled: event.target.checked })} />
              Ativo
            </label>
            <button type="button" className="danger-button" onClick={() => removeListItem('mcpServers', index)}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="agent-studio-fields two-columns">
            <label>
              Nome
              <input value={asText(server.label)} onChange={(event) => updateListItem('mcpServers', index, { label: event.target.value })} />
            </label>
            <label>
              Escopo
              <select value={asText(server.scope || 'agent')} onChange={(event) => updateListItem('mcpServers', index, { scope: event.target.value })}>
                <option value="agent">Agente</option>
                <option value="team">Time</option>
                <option value="external">Externo</option>
              </select>
            </label>
            {renderLoadSelect('mcpServers', index, server, 'on_demand')}
          </div>
          <label>
            Caminho no workspace
            <input value={asText(server.path || '.canvas-flow/mcp.json')} onChange={(event) => updateListItem('mcpServers', index, { path: event.target.value })} />
          </label>
          <label>
            Server URL
            <input value={asText(server.serverUrl)} placeholder="https://mcp.sua-empresa.com/sse" onChange={(event) => updateListItem('mcpServers', index, { serverUrl: event.target.value })} />
          </label>
          {renderToolContractFields('mcpServers', index, server)}
        </section>
      ))}
      {!mcpServers.length && <div className="component-empty">Nenhum MCP cadastrado para o perfil do agente.</div>}
      <details className="agent-studio-advanced-json">
        <summary>JSON avancado</summary>
        <textarea rows={8} value={JSON.stringify(mcpServers, null, 2)} onChange={(event) => updateList('mcpServers', parseJsonList(event.target.value, mcpServers))} />
      </details>
    </div>
  );

  const renderTab = () => {
    if (activeTab === 'guardrails') return renderGuardrails();
    if (activeTab === 'manifest') return renderManifest();
    if (activeTab === 'skills') return renderSkills();
    if (activeTab === 'subagents') return renderSubagents();
    if (activeTab === 'rules') return renderRules();
    if (activeTab === 'mcp') return renderMcp();
    return renderProfile();
  };

  return (
    <div className="modal-backdrop agent-studio-backdrop" onMouseDown={onClose}>
      <div className="agent-studio-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header agent-studio-header">
          <div>
            <strong>Agent Studio</strong>
            <span>{agentName} · {selectedProviderLabel} · {config.model || 'modelo default'}</span>
          </div>
          <button type="button" onClick={onClose}>
            <X size={16} />
            Fechar
          </button>
        </div>

        <div className="agent-studio-body">
          <aside className="agent-studio-sidebar">
            <div className="agent-studio-agent-badge">
              <Bot size={20} />
              <div>
                <strong>{agentName}</strong>
                <span>{agentId}</span>
              </div>
            </div>
            <div className="agent-studio-metrics">
              <span><strong>{skills.length}</strong> skills</span>
              <span><strong>{subagents.length}</strong> subagents</span>
              <span><strong>{rules.length}</strong> rules</span>
              <span><strong>{mcpServers.length}</strong> MCP</span>
            </div>
            <nav className="agent-studio-tabs" aria-label="Agent Studio">
              {tabItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={activeTab === item.id ? 'active' : ''}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="agent-studio-content">
            {renderTab()}
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="provider-config-success">{message}</div>}
          </main>
        </div>

        <div className="modal-actions agent-studio-actions">
          <span>Salva no perfil do agente e tambem atualiza o fluxo aberto como fallback.</span>
          <div>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="button" className="primary-button" onClick={onSave} disabled={saving}>
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Agent OS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
