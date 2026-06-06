import { memo, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from 'reactflow';
import {
  Bot,
  BarChart3,
  Braces,
  Bug,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  FileText,
  Flag,
  Folder,
  GitBranch,
  Maximize2,
  MessageSquare,
  PanelsTopLeft,
  Repeat2,
  ShieldCheck,
  Minimize2,
  Settings,
  Trash2,
  TextCursorInput,
  Webhook,
} from 'lucide-react';
import type { FlowStep } from '../types/flow';

const GROUP_RESIZE_MIN_WIDTH = 180;
const GROUP_RESIZE_MIN_HEIGHT = 156;

const META = {
  message: { label: 'Mensagem', color: '#2563eb', Icon: MessageSquare },
  richMessage: { label: 'Mensagem rica', color: '#0891b2', Icon: PanelsTopLeft },
  input: { label: 'Input', color: '#0f766e', Icon: TextCursorInput },
  api: { label: 'API', color: '#ea580c', Icon: Braces },
  condition: { label: 'Condição', color: '#7c3aed', Icon: CheckCircle2 },
  end: { label: 'Fim', color: '#475569', Icon: Flag },
  group: { label: 'Encapsulador', color: '#0d9488', Icon: Folder },
  component: { label: 'Componente', color: '#2563eb', Icon: Bot },
};

function componentMeta(step: FlowStep) {
  if (step.component?.type === 'debug') return { label: 'Debug', color: '#f59e0b', Icon: Bug };
  if (step.component?.type === 'rag') return { label: 'RAG IA Gen', color: '#2563eb', Icon: Database };
  if (step.component?.type === 'openaiGen') {
    if (step.component.agentRole === 'orchestrator') return { label: 'Orquestrador', color: '#2563eb', Icon: Bot };
    if (step.component.agentRole === 'subagent') return { label: 'Subagent', color: '#dc2626', Icon: Bot };
    return { label: 'Agente', color: '#2563eb', Icon: Bot };
  }
  if (step.component?.type === 'agentPlan') return { label: 'Agent Plan', color: '#4f46e5', Icon: GitBranch };
  if (step.component?.type === 'azureOpenAI') return { label: 'Azure OpenAI', color: '#0ea5e9', Icon: Bot };
  if (step.component?.type === 'milvus') return { label: 'Milvus', color: '#7c3aed', Icon: Database };
  if (step.component?.type === 'azureSearch') return { label: 'Azure Search', color: '#16a34a', Icon: Database };
  if (step.component?.type === 'azureBlob') return { label: 'Azure Blob', color: '#0891b2', Icon: Folder };
  if (step.component?.type === 'files') return { label: 'Arquivos', color: '#0f766e', Icon: FileText };
  if (step.component?.type === 'mongodb') return { label: 'MongoDB', color: '#16a34a', Icon: Database };
  if (step.component?.type === 'context') return { label: 'Contexto', color: '#0891b2', Icon: Braces };
  if (step.component?.type === 'dashboard') return { label: 'Dashboard', color: '#7c3aed', Icon: BarChart3 };
  if (step.component?.type === 'cron') return { label: 'CRON', color: '#0f766e', Icon: Clock };
  if (step.component?.type === 'loop') return { label: 'Loop', color: '#0ea5e9', Icon: Repeat2 };
  if (step.component?.type === 'flowRouter') return { label: 'Supervisor', color: '#9333ea', Icon: GitBranch };
  if (step.component?.type === 'webhook') return { label: 'Webhook', color: '#dc2626', Icon: Webhook };
  if (step.component?.type === 'mcp') return { label: 'MCP', color: '#0f766e', Icon: Braces };
  if (step.component?.type === 'approval') return { label: 'Aprovação', color: '#be123c', Icon: ShieldCheck };
  return META.component;
}

type CanvasStepNodeData = {
  step: FlowStep;
  onUpdate?: (stepId: string, patch: Partial<Pick<FlowStep, 'title' | 'instruction'>>) => void;
  onEdit?: (stepId: string) => void;
  onInlineEdit?: (stepId: string, field: EditingField) => void;
  onDuplicate?: (stepId: string) => void;
  onDelete?: (stepId: string) => void;
  onResizeGroup?: (stepId: string, size: { width: number; height: number }) => void;
  onToggleGroup?: (stepId: string) => void;
  childrenCount?: number;
  editingField?: EditingField;
  isStart?: boolean;
};

type EditingField = 'title' | 'instruction' | null;

function stopNodeAction(event: SyntheticEvent) {
  event.stopPropagation();
}

function CanvasStepNodeComponent({ data, selected }: NodeProps<CanvasStepNodeData>) {
  const step = data.step;
  const meta = step.type === 'component' ? componentMeta(step) : META[step.type];
  const Icon = meta.Icon;
  const isGroup = step.type === 'group';
  const isCollapsedGroup = Boolean(isGroup && step.group?.collapsed);
  const displayInstruction = step.type === 'condition' ? (step.instruction || step.condition || '') : (step.instruction || '');
  const displayTitle = step.type === 'end' ? meta.label : (step.title || meta.label);
  const editingField = data.editingField || null;
  const [titleDraft, setTitleDraft] = useState(step.title || '');
  const [instructionDraft, setInstructionDraft] = useState(displayInstruction);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    skipBlurCommit.current = false;
    if (editingField === 'title') setTitleDraft(step.title || '');
    if (editingField === 'instruction') setInstructionDraft(displayInstruction);
  }, [editingField, step.id, displayInstruction]);

  const closeInlineEditor = () => data.onInlineEdit?.(step.id, null);
  const commitTitle = () => {
    if (titleDraft !== (step.title || '')) data.onUpdate?.(step.id, { title: titleDraft });
    closeInlineEditor();
  };
  const commitInstruction = () => {
    if (instructionDraft !== displayInstruction) data.onUpdate?.(step.id, { instruction: instructionDraft });
    closeInlineEditor();
  };
  const cancelInlineEdit = () => {
    skipBlurCommit.current = true;
    setTitleDraft(step.title || '');
    setInstructionDraft(displayInstruction);
    closeInlineEditor();
  };
  const commitTitleOnBlur = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    commitTitle();
  };
  const commitInstructionOnBlur = () => {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    commitInstruction();
  };

  const openInlineEditor = (field: EditingField) => (event: SyntheticEvent) => {
    if (isGroup && field === 'instruction') return;
    const pointerEvent = event as SyntheticEvent & { ctrlKey?: boolean; metaKey?: boolean };
    if (pointerEvent.ctrlKey || pointerEvent.metaKey) return;
    stopNodeAction(event);
    data.onInlineEdit?.(step.id, field);
  };

  const openInlineEditorWithKeyboard = (field: EditingField) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (isGroup && field === 'instruction') return;
    stopNodeAction(event);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      data.onInlineEdit?.(step.id, field);
    }
  };

  return (
    <div
      className={`canvas-node ${selected ? 'canvas-node-selected' : ''} ${isGroup ? 'canvas-node-group' : ''} ${isCollapsedGroup ? 'canvas-node-group-collapsed' : ''}`}
      title={`${displayTitle} - ${meta.label}${displayInstruction ? `\n${displayInstruction}` : ''}`}
      style={{
        borderColor: selected ? meta.color : `${meta.color}55`,
        boxShadow: selected && isGroup ? `0 0 0 4px ${meta.color}20, 0 14px 30px rgba(15,23,42,0.12)` : undefined,
      }}
    >
      {isGroup && (
        <NodeResizer
          isVisible={!isCollapsedGroup}
          minWidth={GROUP_RESIZE_MIN_WIDTH}
          minHeight={GROUP_RESIZE_MIN_HEIGHT}
          color={meta.color}
          handleClassName="canvas-group-resize-handle"
          lineClassName="canvas-group-resize-line"
          onResizeEnd={(_event, params) => {
            data.onResizeGroup?.(step.id, {
              width: params.width,
              height: params.height,
            });
          }}
        />
      )}
      <Handle type="target" position={Position.Left} className="node-handle" style={{ background: meta.color }} />
      <div className="canvas-node-header" style={{ background: `${meta.color}13`, borderColor: `${meta.color}35` }}>
        <span className="canvas-node-icon-shell" style={{ color: meta.color, background: `${meta.color}12`, borderColor: `${meta.color}24` }}>
          <Icon size={18} />
        </span>
        <span className="canvas-node-kind" style={{ color: meta.color }}>{isGroup ? displayTitle : meta.label}</span>
        {isGroup && !isCollapsedGroup && <em className="group-node-count">{data.childrenCount || 0} nos</em>}
        {isGroup && (
          <span className="group-node-help" tabIndex={0} aria-label="Arraste nos para dentro ou redimensione pelas bordas.">
            ?
            <span>Arraste nos para dentro ou redimensione pelas bordas.</span>
          </span>
        )}
        {data.isStart && <em className="start-node-badge">Início</em>}
        <div className="canvas-node-actions nodrag nopan" onMouseDown={stopNodeAction} onClick={stopNodeAction}>
          {isGroup && (
            <button
              type="button"
              title={isCollapsedGroup ? 'Expandir encapsulador' : 'Minimizar encapsulador'}
              aria-label={isCollapsedGroup ? 'Expandir encapsulador' : 'Minimizar encapsulador'}
              onClick={(event) => {
                stopNodeAction(event);
                data.onToggleGroup?.(step.id);
              }}
            >
              {isCollapsedGroup ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          )}
          <button
            type="button"
            title="Editar nó"
            aria-label="Editar nó"
            onClick={(event) => {
              stopNodeAction(event);
              data.onEdit?.(step.id);
            }}
          >
            <Settings size={12} />
          </button>
          <button
            type="button"
            title="Duplicar nó"
            aria-label="Duplicar nó"
            onClick={(event) => {
              stopNodeAction(event);
              data.onDuplicate?.(step.id);
            }}
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            title="Deletar nó"
            aria-label="Deletar nó"
            className="node-action-danger"
            onClick={(event) => {
              stopNodeAction(event);
              data.onDelete?.(step.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div
        className={`canvas-node-body ${isGroup ? 'canvas-group-body' : ''} ${isCollapsedGroup ? 'canvas-group-body-collapsed' : ''}`}
      >
        {!isGroup && (editingField === 'title' ? (
          <input
            autoFocus
            className="node-title-input nodrag nopan"
            value={titleDraft}
            placeholder={meta.label}
            aria-label="Nome do nó"
            onBlur={commitTitleOnBlur}
            onKeyDown={(event) => {
              stopNodeAction(event);
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelInlineEdit();
              }
            }}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setTitleDraft(event.target.value);
            }}
          />
        ) : (
          <div
            className="node-title-display"
            role="button"
            tabIndex={0}
            title="Duplo clique para editar"
            onDoubleClick={openInlineEditor('title')}
            onKeyDown={openInlineEditorWithKeyboard('title')}
          >
            {displayTitle}
          </div>
        ))}
        {!isGroup && (
          <>
            {editingField === 'instruction' ? (
              <textarea
                autoFocus
                className="node-text-input nodrag nopan"
                value={instructionDraft}
                placeholder="Sem instrução."
                aria-label="Texto do nó"
                onBlur={commitInstructionOnBlur}
                onKeyDown={(event) => {
                  stopNodeAction(event);
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelInlineEdit();
                  }
                }}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setInstructionDraft(event.target.value);
                }}
              />
            ) : (
              <div
                className="node-text-display"
                role="button"
                tabIndex={0}
                title="Duplo clique para editar"
                onDoubleClick={openInlineEditor('instruction')}
                onKeyDown={openInlineEditorWithKeyboard('instruction')}
              >
                <p>{displayInstruction || 'Sem instrução.'}</p>
              </div>
            )}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" style={{ background: meta.color }} />
    </div>
  );
}

function areCanvasStepNodePropsEqual(
  previous: NodeProps<CanvasStepNodeData>,
  next: NodeProps<CanvasStepNodeData>,
) {
  return previous.selected === next.selected
    && previous.data.step === next.data.step
    && previous.data.isStart === next.data.isStart
    && previous.data.childrenCount === next.data.childrenCount
    && previous.data.editingField === next.data.editingField;
}

export const CanvasStepNode = memo(CanvasStepNodeComponent, areCanvasStepNodePropsEqual);
CanvasStepNode.displayName = 'CanvasStepNode';
