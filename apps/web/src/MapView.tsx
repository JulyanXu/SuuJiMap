import type { Sheet, Topic } from "xmind-workbook";
import { ChevronDown, ChevronRight, Link } from "lucide-react";
import { edgePath, relationshipCurve, type MapNode, type Scene } from "./layout.ts";
import { MarkerGlyph } from "./markers.tsx";
import type { ResolvedTheme } from "./theme.ts";

export function MapView({
  scene,
  sheet,
  theme,
  topics,
  selectedId,
  editingId,
  draft,
  dropHint,
  onDraft,
  onSelect,
  onEdit,
  onFinish,
  onCancel,
  onFold,
  onDragStart,
  onDragHint,
  onDrop,
}: {
  scene: Scene;
  sheet: Sheet;
  theme: ResolvedTheme;
  topics: Map<string, Topic>;
  selectedId: string | null;
  editingId: string | null;
  draft: string;
  dropHint: { id: string; mode: "before" | "after" | "child" } | null;
  onDraft: (value: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onFinish: () => void;
  onCancel: () => void;
  onFold: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragHint: (id: string, mode: "before" | "after" | "child") => void;
  onDrop: (id: string, mode: "before" | "after" | "child") => void;
}) {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const boundaryPaint = theme.boundary();
  const summaryPaint = theme.summaryLine();
  const relationshipPaint = theme.relationship();
  return (
    <div className="relative" style={{ width: scene.width, height: scene.height, background: theme.canvas }}>
      <svg className="absolute inset-0" width={scene.width} height={scene.height} aria-hidden="true">
        {relationshipPaint.arrow && (
          <defs>
            <marker id="rel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={relationshipPaint.color} />
            </marker>
          </defs>
        )}
        {scene.boundaries.map((boundary, index) => (
          <g key={`b-${index}`}>
            <rect
              x={boundary.x}
              y={boundary.y}
              width={boundary.w}
              height={boundary.h}
              rx="12"
              fill="none"
              stroke={boundaryPaint.color}
              strokeWidth={boundaryPaint.width}
              strokeDasharray={boundaryPaint.dash || undefined}
            />
            {boundary.title && (
              <text x={boundary.x + 8} y={boundary.y + 14} fill={boundaryPaint.text} fontSize={boundaryPaint.fontSize} fontFamily={boundaryPaint.fontFamily}>
                {boundary.title}
              </text>
            )}
          </g>
        ))}
        {scene.nodes.map((node) => {
          if (!node.parentId || node.kind === "summary" || node.kind === "floating" || node.kind === "callout") return null;
          const parent = byId.get(node.parentId);
          if (!parent) return null;
          const paint = theme.topic(node.kind, Math.max(0, node.branchIndex));
          return (
            <path
              key={`e-${node.id}`}
              d={edgePath(parent, node, scene.structure)}
              fill="none"
              stroke={paint.lineColor}
              strokeWidth={paint.lineWidth}
              strokeDasharray={paint.lineDash || undefined}
            />
          );
        })}
        {scene.brackets.map((bracket) => (
          <path key={bracket.id} d={bracket.d} fill="none" stroke={summaryPaint.color} strokeWidth={summaryPaint.width} strokeDasharray={summaryPaint.dash || undefined} />
        ))}
        {(sheet.relationships ?? []).map((relationship) => {
          if (!relationship.end1Id || !relationship.end2Id) return null;
          const from = byId.get(relationship.end1Id);
          const to = byId.get(relationship.end2Id);
          if (!from || !to) return null;
          const curve = relationshipCurve(from, to, relationship.title, relationship.id ?? `${relationship.end1Id}-${relationship.end2Id}`);
          const labelX = (from.x + from.w / 2 + to.x + to.w / 2) / 2;
          const labelY = (from.y + from.h / 2 + to.y + to.h / 2) / 2 - 10;
          return (
            <g key={curve.id}>
              <path
                d={curve.d}
                fill="none"
                stroke={relationshipPaint.color}
                strokeWidth={relationshipPaint.width}
                strokeDasharray={relationshipPaint.dash || undefined}
                markerEnd={relationshipPaint.arrow ? "url(#rel-arrow)" : undefined}
              />
              {curve.title && (
                <text x={labelX} y={labelY} fill={relationshipPaint.text} fontSize={relationshipPaint.fontSize} fontFamily={relationshipPaint.fontFamily} textAnchor="middle">
                  {curve.title}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {scene.nodes.map((node) => (
        <TopicNode
          key={node.id}
          node={node}
          topic={topics.get(node.id)}
          theme={theme}
          selected={node.id === selectedId}
          editing={node.id === editingId}
          draft={draft}
          dropMode={dropHint?.id === node.id ? dropHint.mode : null}
          onDraft={onDraft}
          onSelect={() => onSelect(node.id)}
          onEdit={() => onEdit(node.id)}
          onFinish={onFinish}
          onCancel={onCancel}
          onFold={() => onFold(node.id)}
          onDragStart={() => onDragStart(node.id)}
          onDragHint={(mode) => onDragHint(node.id, mode)}
          onDrop={(mode) => onDrop(node.id, mode)}
        />
      ))}
    </div>
  );
}

function TopicNode({
  node,
  topic,
  theme,
  selected,
  editing,
  draft,
  dropMode,
  onDraft,
  onSelect,
  onEdit,
  onFinish,
  onCancel,
  onFold,
  onDragStart,
  onDragHint,
  onDrop,
}: {
  node: MapNode;
  topic: Topic | undefined;
  theme: ResolvedTheme;
  selected: boolean;
  editing: boolean;
  draft: string;
  dropMode: "before" | "after" | "child" | null;
  onDraft: (value: string) => void;
  onSelect: () => void;
  onEdit: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onFold: () => void;
  onDragStart: () => void;
  onDragHint: (mode: "before" | "after" | "child") => void;
  onDrop: (mode: "before" | "after" | "child") => void;
}) {
  const label = node.title.trim() ? node.title : "Untitled";
  const paint = theme.topic(node.kind, Math.max(0, node.branchIndex), topic?.style?.properties);
  const dropRing = dropMode === "child" ? "ring-2 ring-indigo-600" : dropMode === "before" ? "ring-2 ring-emerald-600 ring-offset-2" : dropMode === "after" ? "ring-2 ring-amber-600" : "";
  const face = {
    background: paint.fill === "transparent" ? "transparent" : paint.fill,
    color: paint.text,
    borderStyle: "solid",
    borderWidth: paint.borderWidth,
    borderColor: paint.border,
    borderRadius: Math.min(paint.radius, node.h / 2),
    fontFamily: paint.fontFamily,
    fontSize: paint.fontSize,
    fontWeight: paint.fontWeight,
    textDecoration: paint.decoration,
  } as const;

  return (
    <div
      data-topic
      data-topic-id={node.id}
      className="absolute z-10"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onDragOver={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / rect.height;
        const mode = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "child";
        event.dataTransfer.dropEffect = "move";
        onDragHint(mode);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / rect.height;
        onDrop(ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "child");
      }}
    >
      {node.hasChildren && (
        <button
          type="button"
          aria-label={`${node.folded ? "Expand" : "Collapse"} ${label}`}
          className="absolute -left-5 top-1/2 z-20 flex size-4 -translate-y-1/2 items-center justify-center rounded bg-white text-zinc-600 shadow-sm"
          onClick={(event) => {
            event.stopPropagation();
            onFold();
          }}
        >
          {node.folded ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      )}
      {editing ? (
        <input
          autoFocus
          aria-label={`Rename ${label}`}
          className="h-full w-full rounded-lg border border-indigo-600 bg-white px-3 text-sm text-zinc-900 outline-none"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onBlur={onFinish}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              const el = event.currentTarget;
              const next = `${el.value.slice(0, el.selectionStart ?? 0)}\n${el.value.slice(el.selectionEnd ?? 0)}`;
              onDraft(next);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              onFinish();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      ) : (
        <button
          id={`topic-${node.id}`}
          type="button"
          draggable={node.kind !== "central"}
          title={label}
          className={`flex h-full w-full items-center gap-1.5 overflow-hidden px-3 text-left whitespace-pre leading-tight ${selected ? "outline-2 outline-offset-2 outline-indigo-600" : ""} ${dropRing}`}
          style={face}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", node.id);
            event.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
        >
          <span aria-hidden className="flex shrink-0 gap-0.5">
            {(topic?.markers ?? []).map((marker) => (
              <MarkerGlyph key={marker.markerId} markerId={marker.markerId} />
            ))}
          </span>
          <span className="truncate">{label}</span>
          {topic?.href?.startsWith("http") && <Link className="size-3 shrink-0" aria-hidden />}
        </button>
      )}
    </div>
  );
}

