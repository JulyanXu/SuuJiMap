import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileCode,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  ListTree,
  Pin,
  Plus,
  Printer,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { defaultSheetTheme, readXMind, writeXMind, type Sheet, type Topic, type Workbook } from "xmind-workbook";
import { Button } from "@/components/ui/button.tsx";
import { Inspector } from "./Inspector.tsx";
import { layoutMap } from "./layout.ts";
import { MapView } from "./MapView.tsx";
import { plainToRealHtml, toMarkdown, toOpml } from "./markdown.ts";
import { Outliner } from "./Outliner.tsx";
import { sceneToPdf, sceneToPng } from "./png.ts";
import { STRUCTURES } from "./structures.ts";
import { sceneToSvg } from "./svg.ts";
import { resolveTheme } from "./theme.ts";
import {
  addChild,
  addFloating,
  addLabel,
  addMasterBoundary,
  addParent,
  addRelationship,
  addSibling,
  addSummary,
  deleteTopic,
  findTopic,
  indentTopic,
  indexTopics,
  locate,
  moveAttached,
  outdentTopic,
  removeLabel,
  renameTopic,
  reorderSibling,
  setFolded,
  setHref,
  setNotes,
  toggleMarker,
} from "./tree.ts";

type DropMode = "before" | "after" | "child";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const bookRef = useRef<Workbook | null>(null);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [fileName, setFileName] = useState("map.xmind");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "outline">("map");
  const [zoom, setZoom] = useState(1);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; mode: DropMode } | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [sheetIndex, setSheetIndex] = useState(0);
  const cancelEdit = useRef(false);
  const dragging = useRef<string | null>(null);
  const sheetIndexRef = useRef(0);

  useEffect(() => {
    bookRef.current = workbook;
    if (workbook && sheetIndexRef.current >= workbook.sheets.length) {
      sheetIndexRef.current = 0;
      setSheetIndex(0);
      setSelectedId(workbook.sheets[0]?.rootTopic.id ?? null);
    }
  }, [workbook]);

  useEffect(() => {
    sheetIndexRef.current = sheetIndex;
  }, [sheetIndex]);

  const sheet = workbook?.sheets[sheetIndex] ?? workbook?.sheets[0];
  const root = sheet?.rootTopic;
  const theme = useMemo(() => resolveTheme(sheet?.theme), [sheet]);
  const scene = useMemo(() => (root ? layoutMap(root, root.structureClass, sheet?.theme) : null), [root, sheet?.theme]);
  const topics = useMemo(() => (root ? indexTopics(root) : new Map<string, Topic>()), [root]);
  const selected = selectedId ? topics.get(selectedId) ?? null : null;

  useEffect(() => {
    if (!root?.id || view !== "map") return;
    document.getElementById(`topic-${root.id}`)?.scrollIntoView({ block: "center", inline: "center" });
  }, [root?.id, fileName, view]);

  function replaceBook(next: Workbook | null) {
    bookRef.current = next;
    setWorkbook(next);
    setEpoch((value) => value + 1);
  }

  function mutate(fn: (sheets: Sheet[]) => void) {
    const current = bookRef.current;
    if (!current?.sheets.length) return;
    past.current.push(JSON.stringify(current.sheets));
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    const sheets = JSON.parse(JSON.stringify(current.sheets)) as Sheet[];
    fn(sheets);
    replaceBook({ ...current, sheets });
  }

  function commit(fn: (sheet: Sheet) => void) {
    const index = sheetIndexRef.current;
    mutate((sheets) => {
      const nextSheet = sheets[index];
      if (nextSheet) fn(nextSheet);
    });
  }

  function selectSheet(index: number) {
    const count = bookRef.current?.sheets.length ?? 0;
    if (count === 0) return;
    const next = Math.max(0, Math.min(index, count - 1));
    sheetIndexRef.current = next;
    setSheetIndex(next);
    setSelectedId(bookRef.current?.sheets[next]?.rootTopic.id ?? null);
    setEditingId(null);
    setLinkFrom(null);
  }

  function addSheet() {
    let nextIndex = 0;
    mutate((sheets) => {
      nextIndex = sheets.length;
      const id = crypto.randomUUID();
      sheets.push({
        id,
        class: "sheet",
        title: `Sheet ${sheets.length + 1}`,
        theme: defaultSheetTheme(),
        rootTopic: {
          id: crypto.randomUUID(),
          class: "topic",
          title: "Central topic",
          structureClass: "org.xmind.ui.map.unbalanced",
          children: { attached: [] },
        },
      });
    });
    selectSheet(nextIndex);
  }

  function undo() {
    const current = bookRef.current;
    const prev = past.current.pop();
    if (!current || !prev) return;
    future.current.push(JSON.stringify(current.sheets));
    replaceBook({ ...current, sheets: JSON.parse(prev) as Sheet[] });
    setEditingId(null);
  }

  function redo() {
    const current = bookRef.current;
    const next = future.current.pop();
    if (!current || !next) return;
    past.current.push(JSON.stringify(current.sheets));
    replaceBook({ ...current, sheets: JSON.parse(next) as Sheet[] });
  }

  function openBuffer(buffer: ArrayBuffer, name: string) {
    try {
      const book = readXMind(buffer);
      if (!book.sheets[0]?.rootTopic) throw new Error("This workbook has no sheet.");
      past.current = [];
      future.current = [];
      replaceBook(book);
      setFileName(name.toLowerCase().endsWith(".xmind") ? name : `${name}.xmind`);
      sheetIndexRef.current = 0;
      setSheetIndex(0);
      setSelectedId(book.sheets[0].rootTopic.id ?? null);
      setEditingId(null);
      setLinkFrom(null);
      setError(null);
      setZoom(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  function activeRoot(): Topic | null {
    const book = bookRef.current;
    if (!book) return null;
    return book.sheets[sheetIndexRef.current]?.rootTopic ?? book.sheets[0]?.rootTopic ?? null;
  }

  function beginEdit(id: string) {
    const rootTopic = activeRoot();
    const topic = rootTopic ? findTopic(rootTopic, id) : null;
    if (!topic) return;
    setSelectedId(id);
    setDraft(topic.title ?? "");
    setEditingId(id);
  }

  function finishEdit() {
    if (cancelEdit.current) {
      cancelEdit.current = false;
      setEditingId(null);
      return;
    }
    const id = editingId;
    const next = draft;
    setEditingId(null);
    if (!id || next.trim().length === 0) return;
    commit((sheet) => renameTopic(sheet.rootTopic, id, next));
  }

  function onSelect(id: string) {
    if (linkFrom && linkFrom !== id) {
      const source = linkFrom;
      setLinkFrom(null);
      commit((sheet) => addRelationship(sheet, source, id));
    }
    setSelectedId(id);
  }

  function onDrop(targetId: string, mode: DropMode) {
    setDropHint(null);
    const from = dragging.current;
    dragging.current = null;
    if (!from || from === targetId) return;
    commit((next) => {
      const rootTopic = next.rootTopic;
      if (mode === "child") {
        const parent = findTopic(rootTopic, targetId);
        moveAttached(rootTopic, from, targetId, parent?.children?.attached?.length ?? 0);
        return;
      }
      const located = locate(rootTopic, targetId);
      if (!located || located.key !== "attached" || !located.parent.id) return;
      const index = mode === "before" ? located.index : located.index + 1;
      moveAttached(rootTopic, from, targetId === rootTopic.id ? rootTopic.id : located.parent.id, index);
    });
  }

  function saveWorkbook() {
    const current = bookRef.current;
    if (!current) return;
    const bytes = writeXMind(current);
    saveBlob(new Blob([bytes as BlobPart], { type: "application/vnd.xmind.workbook" }), fileName);
  }

  function exportName(extension: string): string {
    return fileName.replace(/\.xmind$/i, "") + extension;
  }

  async function exportPng() {
    if (!scene || !sheet) return;
    const blob = await sceneToPng(scene, sheet, theme);
    saveBlob(blob, exportName(".png"));
  }

  function exportSvg() {
    if (!scene || !sheet) return;
    const svg = sceneToSvg(scene, sheet, theme);
    saveBlob(new Blob([svg], { type: "image/svg+xml" }), exportName(".svg"));
  }

  async function exportPdf() {
    if (!scene || !sheet) return;
    const blob = await sceneToPdf(scene, sheet, theme);
    saveBlob(blob, exportName(".pdf"));
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10));
        return;
      }
      if (meta && event.key === "-") {
        event.preventDefault();
        setZoom((value) => Math.max(0.4, Math.round((value - 0.1) * 10) / 10));
        return;
      }
      if (meta && event.key === "0") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if (typing || !bookRef.current || !selectedId) return;
      const rootTopic = activeRoot();
      if (!rootTopic) return;
      if (meta && event.key === "Enter") {
        event.preventDefault();
        let created: string | null = null;
        commit((next) => {
          created = addParent(next.rootTopic, selectedId);
        });
        if (created) setSelectedId(created);
      } else if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (rootTopic.id === selectedId) return;
        let created: string | null = null;
        commit((next) => {
          created = addSibling(next.rootTopic, selectedId);
        });
        if (created) setSelectedId(created);
      } else if (event.key === "Tab" && view === "map") {
        event.preventDefault();
        let created: string | null = null;
        commit((next) => {
          created = addChild(next.rootTopic, selectedId);
        });
        if (created) setSelectedId(created);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (rootTopic.id === selectedId) return;
        let nextId: string | null = null;
        commit((next) => {
          nextId = deleteTopic(next.rootTopic, selectedId);
        });
        setSelectedId(nextId);
      } else if (meta && event.key.toLowerCase() === "b") {
        event.preventDefault();
        commit((next) => {
          const topic = findTopic(next.rootTopic, selectedId);
          if (topic) addMasterBoundary(topic);
        });
      } else if (meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (rootTopic.id) {
          setSelectedId(rootTopic.id);
          document.getElementById(`topic-${rootTopic.id}`)?.scrollIntoView({ block: "center", inline: "center" });
        }
      } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        commit((next) => reorderSibling(next.rootTopic, selectedId, event.key === "ArrowUp" ? -1 : 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-full min-h-svh flex-col bg-[#f3eee4] text-[#241f1a]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#e7e0d4] bg-[#fffdf8] px-3 py-2">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold">Mind map</p>
          <p className="truncate text-xs text-zinc-500">
            {sheet ? `${sheet.title?.trim() || "Untitled sheet"} · ${fileName}` : "Open a .xmind file"}
          </p>
        </div>
        <input
          ref={fileRef}
          data-testid="open-file"
          className="sr-only"
          type="file"
          accept=".xmind,application/vnd.xmind.workbook"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.arrayBuffer().then((buffer) => openBuffer(buffer, file.name));
            event.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FolderOpen className="size-3.5" /> Open
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void fetch("/samples/mab-example.xmind").then(async (response) => {
              if (!response.ok) {
                setError("Sample workbook is missing.");
                return;
              }
              openBuffer(await response.arrayBuffer(), "mab-example.xmind");
            });
          }}
        >
          Sample
        </Button>
        <Button size="sm" disabled={!workbook} onClick={saveWorkbook}>
          <Save className="size-3.5" /> Save
        </Button>
        <Button variant="ghost" size="sm" aria-label="Undo" disabled={!workbook} onClick={undo}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Redo" disabled={!workbook} onClick={redo}>
          <Redo2 className="size-3.5" />
        </Button>
        <label className="flex items-center gap-1 text-xs text-zinc-600">
          <span className="sr-only">Structure</span>
          <select
            data-testid="structure"
            aria-label="Structure"
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs"
            disabled={!root}
            value={root?.structureClass && STRUCTURES.some((item) => item.id === root.structureClass) ? root.structureClass : "org.xmind.ui.map.unbalanced"}
            onChange={(event) => commit((next) => {
              next.rootTopic.structureClass = event.target.value;
            })}
          >
            {STRUCTURES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant={view === "outline" ? "default" : "outline"} aria-pressed={view === "outline"} onClick={() => setView((value) => (value === "map" ? "outline" : "map"))}>
          <ListTree className="size-3.5" /> Outliner
        </Button>
        <Button variant="ghost" size="sm" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.4, Math.round((value - 0.1) * 10) / 10))}>
          <ZoomOut className="size-3.5" />
        </Button>
        <span className="w-10 text-center text-xs text-zinc-500">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="sm" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 10) / 10))}>
          <ZoomIn className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!root}
          onClick={() => root && saveBlob(new Blob([toMarkdown(root)], { type: "text/markdown" }), "map.md")}
        >
          <FileText className="size-3.5" /> Markdown
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!root}
          onClick={() => root && saveBlob(new Blob([toOpml(root)], { type: "text/xml" }), "map.opml")}
        >
          OPML
        </Button>
        <Button variant="outline" size="sm" disabled={!scene || !sheet} onClick={() => void exportPng()}>
          <ImageIcon className="size-3.5" /> PNG
        </Button>
        <Button variant="outline" size="sm" disabled={!scene || !sheet} onClick={exportSvg}>
          <FileCode className="size-3.5" /> SVG
        </Button>
        <Button variant="outline" size="sm" disabled={!scene || !sheet} onClick={() => void exportPdf()}>
          <Printer className="size-3.5" /> PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!root}
          onClick={() => {
            let created: string | null = null;
            commit((next) => {
              created = addFloating(next.rootTopic);
            });
            if (created) setSelectedId(created);
          }}
        >
          <Pin className="size-3.5" /> Floating
        </Button>
      </header>
      {workbook && sheet && (
        <div className="flex items-center gap-1 border-b border-[#e7e0d4] bg-[#fffdf8] px-3 py-1">
          <div role="tablist" aria-label="Sheets" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {workbook.sheets.map((item, index) => (
              <button
                key={item.id ?? index}
                type="button"
                role="tab"
                aria-selected={index === sheetIndex}
                className={`max-w-48 truncate rounded-md px-2.5 py-1 text-xs ${index === sheetIndex ? "bg-[#24211c] text-[#f6f1e7]" : "text-[#5c564c] hover:bg-[#efe8dc]"}`}
                onClick={() => selectSheet(index)}
              >
                {item.title?.trim() || `Sheet ${index + 1}`}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addSheet}>
            <Plus className="size-3.5" /> Add sheet
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {linkFrom && <p className="border-b border-indigo-200 bg-indigo-50 px-4 py-1 text-xs text-indigo-900">Click another topic to relate it.</p>}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={scrollerRef}
          data-testid="map"
          data-structure={root?.structureClass ?? "org.xmind.ui.map.unbalanced"}
          data-sheet-index={sheet ? sheetIndex : undefined}
          className="relative min-h-0 flex-1 overflow-auto"
          style={{ fontFamily: theme.topic("central", 0).fontFamily, background: scene ? theme.canvas : "#f3eee4" }}
          onPointerDown={(event) => {
            const target = event.target;
            if (!(target instanceof Element) || target.closest("[data-topic], button, input, textarea, select, a")) return;
            const scroller = scrollerRef.current;
            if (!scroller) return;
            dragRef.current = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const scroller = scrollerRef.current;
            if (!drag || !scroller) return;
            scroller.scrollLeft = drag.left - (event.clientX - drag.x);
            scroller.scrollTop = drag.top - (event.clientY - drag.y);
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void file.arrayBuffer().then((buffer) => openBuffer(buffer, file.name));
          }}
        >
          {!scene && (
            <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-3 px-6 py-16">
              <h1 className="text-2xl font-semibold tracking-tight">Open a workbook</h1>
              <p className="text-sm leading-6 text-zinc-600">
                The first sheet opens as a map. Branches fold, markers and notes stay in the file, and Save writes a .xmind workbook.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => fileRef.current?.click()}>Open</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void fetch("/samples/mab-example.xmind").then(async (response) => {
                      if (!response.ok) return;
                      openBuffer(await response.arrayBuffer(), "mab-example.xmind");
                    });
                  }}
                >
                  Sample
                </Button>
              </div>
            </div>
          )}
          {scene && root && view === "map" && (
            <div style={{ width: scene.width * zoom, height: scene.height * zoom }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                <MapView
                  scene={scene}
                  sheet={sheet!}
                  theme={theme}
                  topics={topics}
                  selectedId={selectedId}
                  editingId={editingId}
                  draft={draft}
                  dropHint={dropHint}
                  onDraft={setDraft}
                  onSelect={onSelect}
                  onEdit={beginEdit}
                  onFinish={finishEdit}
                  onCancel={() => {
                    cancelEdit.current = true;
                    setEditingId(null);
                  }}
                  onFold={(id) => commit((next) => {
                    const topic = findTopic(next.rootTopic, id);
                    if (topic && topic.branch == null) setFolded(topic, true);
                    else if (topic?.branch === "folded") setFolded(topic, false);
                  })}
                  onDragStart={(id) => {
                    dragging.current = id;
                  }}
                  onDragHint={(id, mode) => setDropHint({ id, mode })}
                  onDrop={onDrop}
                />
              </div>
            </div>
          )}
          {root && view === "outline" && (
            <Outliner
              root={root}
              selectedId={selectedId}
              editingId={editingId}
              draft={draft}
              onDraft={setDraft}
              onSelect={onSelect}
              onEdit={beginEdit}
              onFinish={finishEdit}
              onCancel={() => {
                cancelEdit.current = true;
                setEditingId(null);
              }}
              onFold={(id) => commit((next) => {
                const topic = findTopic(next.rootTopic, id);
                if (topic && topic.branch == null) setFolded(topic, true);
                else if (topic?.branch === "folded") setFolded(topic, false);
              })}
              onIndent={(id) => commit((next) => indentTopic(next.rootTopic, id))}
              onOutdent={(id) => commit((next) => outdentTopic(next.rootTopic, id))}
            />
          )}
        </div>
        <Inspector
          key={epoch}
          topic={selected}
          linking={linkFrom != null}
          onToggleMarker={(markerId) => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) toggleMarker(topic, markerId);
          })}
          onAddLabel={(label) => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) addLabel(topic, label);
          })}
          onRemoveLabel={(label) => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) removeLabel(topic, label);
          })}
          onNotes={(text) => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) setNotes(topic, text, plainToRealHtml(text));
          })}
          onHref={(href) => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) setHref(topic, href);
          })}
          onBoundary={() => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) addMasterBoundary(topic);
          })}
          onSummary={() => selectedId && commit((next) => {
            const topic = findTopic(next.rootTopic, selectedId);
            if (topic) addSummary(topic);
          })}
          onStartLink={() => setLinkFrom(selectedId)}
          onRename={() => selectedId && beginEdit(selectedId)}
        />
      </div>
    </div>
  );
}

