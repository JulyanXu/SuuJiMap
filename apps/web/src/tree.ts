import type { Boundary, Sheet, Summary, Topic } from "xmind-workbook";

const CHILD_KEYS = ["attached", "detached", "summary", "callout"] as const;
type ChildKey = (typeof CHILD_KEYS)[number];

export function isFolded(topic: Topic): boolean {
  return topic.branch === "folded";
}

/** Cited branch value is "folded". Unknown values are left untouched. */
export function setFolded(topic: Topic, folded: boolean): void {
  if (folded) {
    topic.branch = "folded";
    return;
  }
  if (topic.branch === "folded") delete topic.branch;
}

export function attachedOf(topic: Topic): Topic[] {
  return topic.children?.attached ?? [];
}

function childrenOf(topic: Topic, key: ChildKey): Topic[] {
  return topic.children?.[key] ?? [];
}

function walk(topic: Topic, visit: (topic: Topic) => void): void {
  visit(topic);
  for (const key of CHILD_KEYS) {
    for (const child of childrenOf(topic, key)) walk(child, visit);
  }
}

export function indexTopics(root: Topic): Map<string, Topic> {
  const map = new Map<string, Topic>();
  walk(root, (topic) => {
    if (topic.id) map.set(topic.id, topic);
  });
  return map;
}

export function findTopic(root: Topic, id: string): Topic | null {
  return indexTopics(root).get(id) ?? null;
}

export interface Location {
  parent: Topic;
  key: ChildKey;
  index: number;
}

export function locate(root: Topic, id: string): Location | null {
  let found: Location | null = null;
  walk(root, (topic) => {
    if (found) return;
    for (const key of CHILD_KEYS) {
      const index = childrenOf(topic, key).findIndex((child) => child.id === id);
      if (index >= 0) found = { parent: topic, key, index };
    }
  });
  return found;
}

function isDescendant(topic: Topic, id: string): boolean {
  let hit = false;
  walk(topic, (node) => {
    if (node.id === id) hit = true;
  });
  return hit && topic.id !== id;
}

function parseSpan(range: string | undefined): { start: number; end: number } | null {
  if (!range) return null;
  const match = /^\((\d+),(\d+)\)$/.exec(range);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function shiftSpan(range: string, index: number, mode: "remove" | "insert"): string {
  const span = parseSpan(range);
  if (!span) return range;
  let { start, end } = span;
  if (mode === "remove") {
    if (index < start) {
      start -= 1;
      end -= 1;
    } else if (index <= end) end -= 1;
  } else if (index <= start) {
    start += 1;
    end += 1;
  } else if (index <= end) end += 1;
  if (end < start) return range;
  return `(${start},${end})`;
}

function shiftRanges(topic: Topic, index: number, mode: "remove" | "insert"): void {
  const apply = <T extends { range?: string }>(items: T[] | undefined): void => {
    if (!items) return;
    for (const item of items) {
      if (item.range && item.range !== "master") item.range = shiftSpan(item.range, index, mode);
    }
  };
  apply(topic.boundaries);
  apply(topic.summaries);
}

export function addParent(root: Topic, id: string): string | null {
  if (root.id === id) return null;
  const located = locate(root, id);
  if (!located || located.key !== "attached" || !located.parent.children?.attached) return null;
  const list = located.parent.children.attached;
  const child = list[located.index];
  if (!child) return null;
  const newId = crypto.randomUUID();
  list.splice(located.index, 1, { id: newId, title: "New topic", children: { attached: [child] } });
  return newId;
}

export function addFloating(root: Topic): string {
  const id = crypto.randomUUID();
  if (!root.children) root.children = {};
  if (!root.children.detached) root.children.detached = [];
  const index = root.children.detached.length;
  root.children.detached.push({
    id,
    title: "Floating topic",
    position: { x: 48, y: 40 + index * 56 },
  });
  return id;
}

export function addChild(root: Topic, parentId: string): string | null {
  const parent = findTopic(root, parentId);
  if (!parent) return null;
  const id = crypto.randomUUID();
  if (!parent.children) parent.children = {};
  if (!parent.children.attached) parent.children.attached = [];
  parent.children.attached.push({ id, title: "New topic" });
  return id;
}

export function addSibling(root: Topic, id: string): string | null {
  if (root.id === id) return null;
  const located = locate(root, id);
  if (!located || located.key !== "attached") return null;
  const newId = crypto.randomUUID();
  const list = attachedOf(located.parent);
  list.splice(located.index + 1, 0, { id: newId, title: "New topic" });
  shiftRanges(located.parent, located.index + 1, "insert");
  return newId;
}

export function renameTopic(root: Topic, id: string, title: string): void {
  const topic = findTopic(root, id);
  if (topic) topic.title = title;
}

export function deleteTopic(root: Topic, id: string): string | null {
  if (root.id === id) return null;
  const located = locate(root, id);
  if (!located?.parent.children) return null;
  const list = located.parent.children[located.key];
  if (!list) return null;
  list.splice(located.index, 1);
  if (list.length === 0) delete located.parent.children[located.key];
  if (located.key === "attached") shiftRanges(located.parent, located.index, "remove");
  if (located.key === "summary") {
    located.parent.summaries = located.parent.summaries?.filter((item) => item.topicId !== id);
    if (located.parent.summaries?.length === 0) delete located.parent.summaries;
  }
  return located.parent.id ?? root.id ?? null;
}

export function reorderSibling(root: Topic, id: string, delta: -1 | 1): boolean {
  const located = locate(root, id);
  if (!located || located.key !== "attached" || !located.parent.children?.attached) return false;
  const next = located.index + delta;
  const list = located.parent.children.attached;
  if (next < 0 || next >= list.length) return false;
  const [item] = list.splice(located.index, 1);
  if (!item) return false;
  list.splice(next, 0, item);
  return true;
}

export function moveAttached(root: Topic, id: string, newParentId: string, index: number): boolean {
  if (id === root.id || id === newParentId) return false;
  const moving = findTopic(root, id);
  const newParent = findTopic(root, newParentId);
  if (!moving || !newParent) return false;
  if (isDescendant(moving, newParentId)) return false;
  const from = locate(root, id);
  if (!from?.parent.children) return false;
  const source = from.parent.children[from.key];
  if (!source) return false;
  const [item] = source.splice(from.index, 1);
  if (!item) return false;
  if (source.length === 0) delete from.parent.children[from.key];
  if (from.key === "attached") shiftRanges(from.parent, from.index, "remove");
  if (!newParent.children) newParent.children = {};
  if (!newParent.children.attached) newParent.children.attached = [];
  let insertAt = index;
  if (from.parent === newParent && from.key === "attached" && from.index < index) insertAt -= 1;
  insertAt = Math.max(0, Math.min(insertAt, newParent.children.attached.length));
  newParent.children.attached.splice(insertAt, 0, item);
  shiftRanges(newParent, insertAt, "insert");
  return true;
}

export function indentTopic(root: Topic, id: string): boolean {
  const located = locate(root, id);
  if (!located || located.key !== "attached" || located.index === 0) return false;
  const previous = attachedOf(located.parent)[located.index - 1];
  if (!previous?.id) return false;
  return moveAttached(root, id, previous.id, attachedOf(previous).length);
}

export function outdentTopic(root: Topic, id: string): boolean {
  const located = locate(root, id);
  if (!located || located.key !== "attached" || located.parent.id === root.id) return false;
  const parentLocation = located.parent.id ? locate(root, located.parent.id) : null;
  if (!parentLocation || parentLocation.key !== "attached" || !parentLocation.parent.id) return false;
  return moveAttached(root, id, parentLocation.parent.id, parentLocation.index + 1);
}

export function toggleMarker(topic: Topic, markerId: string): void {
  const markers = topic.markers ? [...topic.markers] : [];
  const index = markers.findIndex((marker) => marker.markerId === markerId);
  if (index >= 0) markers.splice(index, 1);
  else markers.push({ markerId });
  if (markers.length > 0) topic.markers = markers;
  else delete topic.markers;
}

export function addLabel(topic: Topic, label: string): void {
  const text = label.trim();
  if (!text) return;
  const labels = topic.labels ? [...topic.labels] : [];
  if (!labels.includes(text)) labels.push(text);
  topic.labels = labels;
}

export function removeLabel(topic: Topic, label: string): void {
  const labels = (topic.labels ?? []).filter((item) => item !== label);
  if (labels.length > 0) topic.labels = labels;
  else delete topic.labels;
}

export function setNotes(topic: Topic, text: string, realHtml: string): void {
  if (!text.trim()) {
    if (!topic.notes) return;
    const notes = { ...topic.notes };
    delete notes.plain;
    delete notes.realHTML;
    if (Object.keys(notes).length === 0) delete topic.notes;
    else topic.notes = notes;
    return;
  }
  topic.notes = { ...topic.notes, plain: { content: text }, realHTML: { content: realHtml } };
}

/** Copy a quick-style role onto topic.style, or clear those keys when properties is null. Other style keys stay. */
export function setQuickStyle(topic: Topic, properties: Record<string, string> | null, ownedKeys: readonly string[]): void {
  const next: Record<string, string> = { ...(topic.style?.properties ?? {}) };
  for (const key of ownedKeys) delete next[key];
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value) next[key] = value;
    }
  }
  if (Object.keys(next).length === 0) {
    if (!topic.style) return;
    const style = { ...topic.style };
    delete style.properties;
    if (Object.keys(style).length === 0) delete topic.style;
    else topic.style = style;
    return;
  }
  topic.style = { ...(topic.style ?? {}), properties: next };
}

export function setHref(topic: Topic, href: string): void {
  const text = href.trim();
  if (!text) delete topic.href;
  else topic.href = text;
}

/** Replace topic.image with the measured fields, or remove it. Does not touch resource bytes. */
export function setTopicImage(topic: Topic, image: { src: string; width?: number; height?: number; align?: string } | null): void {
  if (!image?.src) {
    delete topic.image;
    return;
  }
  const next: NonNullable<Topic["image"]> = { src: image.src };
  if (typeof image.width === "number") next.width = image.width;
  if (typeof image.height === "number") next.height = image.height;
  if (typeof image.align === "string" && image.align.length > 0) next.align = image.align;
  topic.image = next;
}

export function addMasterBoundary(topic: Topic): void {
  const boundaries: Boundary[] = topic.boundaries ? [...topic.boundaries] : [];
  if (boundaries.some((item) => item.range === "master")) return;
  boundaries.push({ id: crypto.randomUUID(), range: "master", title: "Group" });
  topic.boundaries = boundaries;
}

export function addSummary(topic: Topic): void {
  const count = topic.children?.attached?.length ?? 0;
  if (count === 0) return;
  const topicId = crypto.randomUUID();
  if (!topic.children) topic.children = {};
  if (!topic.children.summary) topic.children.summary = [];
  topic.children.summary.push({ id: topicId, title: "Summary" });
  const summaries: Summary[] = topic.summaries ? [...topic.summaries] : [];
  summaries.push({ id: crypto.randomUUID(), range: `(0,${count - 1})`, topicId });
  topic.summaries = summaries;
}

export function addRelationship(sheet: Sheet, end1Id: string, end2Id: string): void {
  if (end1Id === end2Id) return;
  if (!sheet.relationships) sheet.relationships = [];
  sheet.relationships.push({ id: crypto.randomUUID(), end1Id, end2Id, title: "Related" });
}
