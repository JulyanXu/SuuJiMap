import { useRef } from "react";
import type { Topic } from "xmind-workbook";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { isKnownMarker, MARKER_GROUPS, markerLabel } from "./marker-catalog.ts";
import { MarkerGlyph } from "./markers.tsx";
import { activeQuickRole, QUICK_ROLES, quickRoleProperties, type QuickRole } from "./theme.ts";

const QUICK_LABEL: Record<QuickRole, string> = {
  importantTopic: "Important",
  minorTopic: "Minor",
  expiredTopic: "Expired",
};

export function Inspector({
  topic,
  sheetTheme,
  linking,
  onToggleMarker,
  onQuickStyle,
  onAddLabel,
  onRemoveLabel,
  onNotes,
  onHref,
  imageUrl,
  onAttachImage,
  onClearImage,
  onBoundary,
  onSummary,
  onStartLink,
  onRename,
}: {
  topic: Topic | null;
  sheetTheme: Record<string, unknown> | undefined;
  linking: boolean;
  onToggleMarker: (markerId: string) => void;
  onQuickStyle: (role: QuickRole | null) => void;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  onNotes: (text: string) => void;
  onHref: (href: string) => void;
  imageUrl: string | null;
  onAttachImage: (file: File) => void;
  onClearImage: () => void;
  onBoundary: () => void;
  onSummary: () => void;
  onStartLink: () => void;
  onRename: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!topic) {
    return <aside className="hidden w-72 shrink-0 border-l border-zinc-200 bg-white p-4 text-sm text-zinc-500 lg:block">Select a topic.</aside>;
  }
  const active = new Set((topic.markers ?? []).map((marker) => marker.markerId));
  const hasImage = Boolean(topic.image?.src);
  const unknown = [...active].filter((markerId) => !isKnownMarker(markerId));
  const quick = activeQuickRole(sheetTheme, topic.style?.properties);
  return (
    <aside className="max-h-[42vh] min-h-0 w-full shrink-0 overflow-y-auto border-t border-zinc-200 bg-white p-4 lg:max-h-full lg:w-72 lg:border-t-0 lg:border-l">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Topic</h2>
        <Button size="sm" variant="outline" onClick={onRename}>
          Rename
        </Button>
      </div>
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-600">Image</p>
        {imageUrl ? (
          <img data-testid="topic-image-preview" src={imageUrl} alt="" className="mt-2 max-h-40 w-full rounded-md border border-zinc-200 bg-zinc-50 object-contain" />
        ) : (
          <p className="mt-1 text-xs text-zinc-500">{hasImage ? "This image is not in the package." : "PNG, JPEG, WebP, or SVG."}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-3.5" /> {hasImage ? "Replace" : "Attach"}
          </Button>
          {hasImage && (
            <Button size="sm" variant="ghost" onClick={onClearImage}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          data-testid="topic-image-file"
          aria-label="Attach image"
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAttachImage(file);
            event.target.value = "";
          }}
        />
      </div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Quick style</p>
      <div className="mb-4 flex flex-wrap gap-1">
        {QUICK_ROLES.map((role) => {
          const bag = quickRoleProperties(sheetTheme, role);
          const fill = bag["svg:fill"];
          const swatch = fill && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(fill) ? fill : "transparent";
          const pressed = quick === role;
          return (
            <button
              key={role}
              type="button"
              aria-label={QUICK_LABEL[role]}
              aria-pressed={pressed}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${pressed ? "border-indigo-600 bg-indigo-50" : "border-zinc-200"}`}
              style={{ textDecoration: bag["fo:text-decoration"] === "line-through" ? "line-through" : undefined }}
              onClick={() => onQuickStyle(pressed ? null : role)}
            >
              <span className="inline-block size-2.5 rounded-full border border-zinc-300" style={{ background: swatch }} />
              {QUICK_LABEL[role]}
            </button>
          );
        })}
      </div>
      <div className="mb-4 space-y-2">
        {MARKER_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{group.label}</p>
            <div className="flex flex-wrap gap-1">
              {group.ids.map((markerId) => (
                <button
                  key={markerId}
                  type="button"
                  aria-label={markerLabel(markerId)}
                  title={markerLabel(markerId)}
                  aria-pressed={active.has(markerId)}
                  className={`inline-flex size-7 items-center justify-center rounded-md border ${active.has(markerId) ? "border-indigo-600 bg-indigo-50" : "border-zinc-200"}`}
                  onClick={() => onToggleMarker(markerId)}
                >
                  <MarkerGlyph markerId={markerId} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {unknown.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">On this topic</p>
            <div className="flex flex-wrap gap-1">
              {unknown.map((markerId) => (
                <button
                  key={markerId}
                  type="button"
                  aria-label={markerLabel(markerId)}
                  title={markerLabel(markerId)}
                  aria-pressed="true"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-indigo-600 bg-indigo-50"
                  onClick={() => onToggleMarker(markerId)}
                >
                  <MarkerGlyph markerId={markerId} />
                </button>
              ))}
            </div>
          </div>
        )}
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
