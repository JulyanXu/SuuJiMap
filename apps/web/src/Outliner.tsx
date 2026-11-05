import type { Topic } from "xmind-workbook";
import { ChevronDown, ChevronRight } from "lucide-react";
import { attachedOf, isFolded } from "./tree.ts";

export function Outliner({
  root,
  selectedId,
  editingId,
  draft,
  onDraft,
  onSelect,
  onEdit,
  onFinish,
  onCancel,
  onFold,
  onIndent,
  onOutdent,
}: {
  root: Topic;
  selectedId: string | null;
  editingId: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onFinish: () => void;
  onCancel: () => void;
  onFold: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6" data-testid="outliner">
      <Row
        topic={root}
        depth={0}
        selectedId={selectedId}
        editingId={editingId}
        draft={draft}
        onDraft={onDraft}
        onSelect={onSelect}
        onEdit={onEdit}
        onFinish={onFinish}
        onCancel={onCancel}
        onFold={onFold}
        onIndent={onIndent}
        onOutdent={onOutdent}
      />
    </div>
  );
}

function Row(props: {
  topic: Topic;
  depth: number;
  selectedId: string | null;
  editingId: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onFinish: () => void;
  onCancel: () => void;
  onFold: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
}) {
  const { topic, depth } = props;
  const id = topic.id ?? "";
  const label = topic.title?.trim() ? topic.title : "Untitled";
  const children = isFolded(topic) ? [] : attachedOf(topic);
  const editing = props.editingId === id;
  return (
    <div>
      <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: depth * 18 }}>
        {attachedOf(topic).length > 0 ? (
          <button
            type="button"
            aria-label={`${isFolded(topic) ? "Expand" : "Collapse"} ${label}`}
            className="flex size-5 items-center justify-center text-zinc-500"
            onClick={() => id && props.onFold(id)}
          >
            {isFolded(topic) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : (
          <span className="inline-block size-5" />
        )}
        {editing ? (
          <input
            autoFocus
            aria-label={`Rename ${label}`}
            className="h-8 flex-1 rounded-md border border-indigo-600 bg-white px-2 text-sm"
            value={props.draft}
            onChange={(event) => props.onDraft(event.target.value)}
            onBlur={props.onFinish}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.shiftKey) {
                event.preventDefault();
                const el = event.currentTarget;
                props.onDraft(`${el.value.slice(0, el.selectionStart ?? 0)}\n${el.value.slice(el.selectionEnd ?? 0)}`);
              } else if (event.key === "Enter") {
                event.preventDefault();
                props.onFinish();
              } else if (event.key === "Escape") {
                event.preventDefault();
                props.onCancel();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`min-h-8 flex-1 rounded-md px-2 text-left text-sm ${props.selectedId === id ? "bg-indigo-100 text-indigo-950" : "hover:bg-zinc-100"}`}
            onClick={() => {
              if (!id) return;
              if (props.selectedId === id) window.setTimeout(() => props.onEdit(id), 0);
              else props.onSelect(id);
            }}
            onDoubleClick={() => {
              if (!id) return;
              window.setTimeout(() => props.onEdit(id), 0);
            }}
            onKeyDown={(event) => {
              if (!id || event.key !== "Tab") return;
              event.preventDefault();
              if (event.shiftKey) props.onOutdent(id);
              else props.onIndent(id);
            }}
          >
            {label}
          </button>
        )}
      </div>
      {children.map((child) => (
        <Row key={child.id} {...props} topic={child} depth={depth + 1} />
      ))}
    </div>
  );
}
