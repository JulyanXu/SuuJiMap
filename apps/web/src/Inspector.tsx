import type { Topic } from "xmind-workbook";
import { Button } from "@/components/ui/button.tsx";
import { MARKER_CHOICES, markerLabel } from "./marker-catalog.ts";
import { MarkerGlyph } from "./markers.tsx";

export function Inspector({
  topic,
  linking,
  onToggleMarker,
  onAddLabel,
  onRemoveLabel,
  onNotes,
  onHref,
  onBoundary,
  onSummary,
  onStartLink,
  onRename,
}: {
  topic: Topic | null;
  linking: boolean;
  onToggleMarker: (markerId: string) => void;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  onNotes: (text: string) => void;
  onHref: (href: string) => void;
  onBoundary: () => void;
  onSummary: () => void;
  onStartLink: () => void;
  onRename: () => void;
}) {
  if (!topic) {
    return <aside className="hidden w-72 shrink-0 border-l border-zinc-200 bg-white p-4 text-sm text-zinc-500 lg:block">Select a topic.</aside>;
  }
  const active = new Set((topic.markers ?? []).map((marker) => marker.markerId));
  return (
    <aside className="w-full shrink-0 border-t border-zinc-200 bg-white p-4 lg:w-72 lg:border-t-0 lg:border-l">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Topic</h2>
        <Button size="sm" variant="outline" onClick={onRename}>
          Rename
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {MARKER_CHOICES.map((markerId) => (
          <button
            key={markerId}
            type="button"
            aria-label={markerLabel(markerId)}
            aria-pressed={active.has(markerId)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${active.has(markerId) ? "border-indigo-600 bg-indigo-50" : "border-zinc-200"}`}
            onClick={() => onToggleMarker(markerId)}
          >
            <MarkerGlyph markerId={markerId} />
            {markerLabel(markerId)}
          </button>
        ))}
      </div>
      <label className="mb-3 block text-xs font-medium text-zinc-600">
        Labels
        <input
          aria-label="Add label"
          className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm"
          placeholder="Add a label"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onAddLabel(event.currentTarget.value);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="mb-3 flex flex-wrap gap-1">
        {(topic.labels ?? []).map((label) => (
          <button key={label} type="button" className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs" onClick={() => onRemoveLabel(label)}>
            {label} ×
          </button>
        ))}
      </div>
      <label className="mb-3 block text-xs font-medium text-zinc-600">
        Notes
        <textarea
          aria-label="Notes"
          key={topic.id}
          defaultValue={topic.notes?.plain?.content ?? ""}
          className="mt-1 h-24 w-full resize-y rounded-md border border-zinc-300 px-2 py-1 text-sm"
          onBlur={(event) => onNotes(event.target.value)}
        />
      </label>
      <label className="mb-4 block text-xs font-medium text-zinc-600">
        Web link
        <input
          aria-label="Link"
          key={`${topic.id}-href`}
          defaultValue={topic.href ?? ""}
          className="mt-1 h-8 w-full rounded-md border border-zinc-300 px-2 text-sm"
          placeholder="https://"
          onBlur={(event) => onHref(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onBoundary}>
          Boundary
        </Button>
        <Button size="sm" variant="outline" onClick={onSummary}>
          Summary
        </Button>
        <Button size="sm" variant={linking ? "default" : "outline"} onClick={onStartLink}>
          {linking ? "Click a topic" : "Relationship"}
        </Button>
      </div>
    </aside>
  );
}
