import { useRef, useState, type MouseEvent } from 'react';
import { EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { Pencil, Trash2 } from 'lucide-react';
import type { FlowEdge } from '../types/flow';

type CanvasFlowEdgeData = FlowEdge & {
  onEdit?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
};

function stopEdgeAction(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function CanvasFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps<CanvasFlowEdgeData>) {
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const edgeData = data || ({} as CanvasFlowEdgeData);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const isActive = hovered || selected;
  const hasLabel = Boolean(edgeData.label);

  const showTools = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setHovered(true);
  };

  const hideTools = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setHovered(false);
      hideTimer.current = null;
    }, 160);
  };

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path canvas-edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <path
        className="canvas-edge-hit-path"
        d={edgePath}
        onMouseEnter={showTools}
        onMouseLeave={hideTools}
      />
      <EdgeLabelRenderer>
        <div
          className={`canvas-edge-tools nodrag nopan ${isActive ? 'is-active' : ''} ${hasLabel ? 'has-label' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: isActive ? 'all' : 'none',
          }}
          onMouseEnter={showTools}
          onMouseLeave={hideTools}
        >
          {hasLabel && <span className="canvas-edge-label">{edgeData.label}</span>}
          <span className="canvas-edge-actions">
            <button
              type="button"
              title="Editar ligacao"
              aria-label="Editar ligacao"
              onMouseDown={stopEdgeAction}
              onClick={(event) => {
                stopEdgeAction(event);
                edgeData.onEdit?.(id);
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              title="Excluir ligacao"
              aria-label="Excluir ligacao"
              className="danger-edge-tool"
              onMouseDown={stopEdgeAction}
              onClick={(event) => {
                stopEdgeAction(event);
                edgeData.onDelete?.(id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
