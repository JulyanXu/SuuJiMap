import type { Manifest, Marker, Metadata, Sheet, Topic, Workbook } from "./types.js";

const CHILD_KEYS = ["attached", "detached", "summary", "callout"] as const;
const DEFAULT_STRUCTURE = "org.xmind.ui.map.unbalanced";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (!cryptoApi?.randomUUID) throw new Error("crypto.randomUUID is not available");
  return cryptoApi.randomUUID();
}

function blank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/** Labels are string[]. A lone string is the old model.d.ts typo, not the file shape. */
export function coerceTopicFields(topic: Topic): void {
  const rawLabels = (topic as { labels?: unknown }).labels;
  if (typeof rawLabels === "string") topic.labels = [rawLabels];

  const rawMarkers = topic.markers as unknown;
  if (Array.isArray(rawMarkers)) {
    topic.markers = rawMarkers.map((marker): Marker => {
      if (typeof marker === "string") return { markerId: marker };
      return marker as Marker;
    });
  }

  const children = topic.children;
  if (!children) return;
  for (const key of CHILD_KEYS) {
    const list = children[key];
    if (!Array.isArray(list)) continue;
    for (const child of list) {
      if (child && typeof child === "object") coerceTopicFields(child);
    }
  }
}

function prepareTopic(topic: Topic, isRoot: boolean): Topic {
  if (!isRecord(topic)) throw new Error("topic must be an object");
  if (blank(topic.id)) topic.id = newId();
  if (typeof topic.title !== "string") topic.title = "";
  if (isRoot) {
    if (blank(topic.class)) topic.class = "topic";
    if (blank(topic.structureClass)) topic.structureClass = DEFAULT_STRUCTURE;
  }
  coerceTopicFields(topic);
  if (isRecord(topic.children)) {
    for (const key of CHILD_KEYS) {
      const list = topic.children[key];
      if (!Array.isArray(list)) continue;
      topic.children[key] = list.map((child) => prepareTopic(child, false));
    }
  }
  if (Array.isArray(topic.boundaries)) {
    for (const boundary of topic.boundaries) {
      if (isRecord(boundary) && blank(boundary.id)) boundary.id = newId();
    }
  }
  if (Array.isArray(topic.summaries)) {
    for (const summary of topic.summaries) {
      if (isRecord(summary) && blank(summary.id)) summary.id = newId();
    }
  }
  return topic;
}

function prepareSheet(input: Sheet): Sheet {
  if (!isRecord(input)) throw new Error("each sheet must be an object");
  const sheet = cloneJson(input);
  if (blank(sheet.id)) sheet.id = newId();
  if (blank(sheet.class)) sheet.class = "sheet";
  if (typeof sheet.title !== "string") sheet.title = "";
  if (!isRecord(sheet.rootTopic)) throw new Error("sheet.rootTopic is required");
  sheet.rootTopic = prepareTopic(sheet.rootTopic, true);
  if (Array.isArray(sheet.relationships)) {
    for (const relationship of sheet.relationships) {
      if (isRecord(relationship) && blank(relationship.id)) relationship.id = newId();
    }
  }
  return sheet;
}

export interface PreparedWorkbook {
  sheets: Sheet[];
  metadata: Metadata;
  manifest: Manifest;
}

export function prepareWorkbook(workbook: Workbook): PreparedWorkbook {
  if (!workbook || !Array.isArray(workbook.sheets) || workbook.sheets.length === 0) {
    throw new Error("workbook.sheets must be a non-empty array");
  }
  const metadata = workbook.metadata
    ? cloneJson(workbook.metadata)
    : {
        dataStructureVersion: "2",
        creator: { name: "xmind-workbook", version: "0.1.0" },
        layoutEngineVersion: "3",
      };
  const manifest: Manifest = workbook.manifest ? cloneJson(workbook.manifest) : {};
  if (!isRecord(manifest["file-entries"])) {
    manifest["file-entries"] = {};
  }
  const entries = manifest["file-entries"];
  if (!Object.prototype.hasOwnProperty.call(entries, "content.json")) entries["content.json"] = {};
  if (!Object.prototype.hasOwnProperty.call(entries, "metadata.json")) entries["metadata.json"] = {};
  return { sheets: workbook.sheets.map(prepareSheet), metadata, manifest };
}
