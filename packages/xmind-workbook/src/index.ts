import { sheetsFromContentXml } from "./legacy.js";
import { coerceTopicFields, prepareWorkbook } from "./prepare.js";
import { CONTENT_XML_STUB_TEXT } from "./stub.js";
import type { Manifest, Metadata, Sheet, Workbook, ZipMember } from "./types.js";
import { unzipMembers, zipStored } from "./zip.js";

export type {
  Boundary,
  Extension,
  Manifest,
  ManifestEntry,
  Marker,
  Metadata,
  NoteContent,
  NoteHtml,
  NoteOps,
  Notes,
  Position,
  Relationship,
  Sheet,
  Style,
  Summary,
  Topic,
  TopicChildren,
  TopicImage,
  Workbook,
  ZipMember,
} from "./types.js";

const MANAGED = new Set(["content.json", "content.xml", "metadata.json", "manifest.json"]);

function asUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("readXMind expects a Uint8Array or ArrayBuffer");
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decodeUtf8(data: Uint8Array): string {
  const text = new TextDecoder().decode(data);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseJson(data: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(decodeUtf8(data)) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid ${label}: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Top-level array, a single sheet, or `{ sheets: [...] }`. */
function sheetsFromContentJson(value: unknown): Sheet[] {
  let sheets: unknown[];
  if (Array.isArray(value)) {
    sheets = value;
  } else if (isRecord(value) && Array.isArray(value.sheets)) {
    sheets = value.sheets;
  } else if (isRecord(value) && (isRecord(value.rootTopic) || "title" in value || "id" in value)) {
    sheets = [value];
  } else {
    throw new Error("content.json must be a sheet array, a sheet, or { sheets: [...] }");
  }
  return sheets.map((sheet) => {
    if (!isRecord(sheet)) throw new Error("content.json sheets must be objects");
    const typed = sheet as unknown as Sheet;
    if (typed.rootTopic && typeof typed.rootTopic === "object") coerceTopicFields(typed.rootTopic);
    return typed;
  });
}

function memberMap(members: readonly ZipMember[]): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const member of members) {
    if (!map.has(member.name)) map.set(member.name, member.data);
  }
  return map;
}

/**
 * Read a modern or legacy .xmind workbook from ZIP bytes.
 * `content.json` wins when both JSON and XML are present. XML is the legacy fallback.
 */
export function readXMind(input: Uint8Array | ArrayBuffer): Workbook {
  const members = unzipMembers(asUint8Array(input));
  const files = memberMap(members);
  const jsonBytes = files.get("content.json");
  const xmlBytes = files.get("content.xml");

  let sheets: Sheet[];
  let source: Workbook["source"];
  if (jsonBytes) {
    sheets = sheetsFromContentJson(parseJson(jsonBytes, "content.json"));
    source = "content.json";
  } else if (xmlBytes) {
    sheets = sheetsFromContentXml(decodeUtf8(xmlBytes));
    source = "content.xml";
  } else {
    throw new Error("xmind workbook is missing content.json and content.xml");
  }

  let metadata: Metadata | undefined;
  const metadataBytes = files.get("metadata.json");
  if (metadataBytes) {
    const value = parseJson(metadataBytes, "metadata.json");
    if (!isRecord(value)) throw new Error("metadata.json must be an object");
    metadata = value as Metadata;
  }

  let manifest: Manifest | undefined;
  const manifestBytes = files.get("manifest.json");
  if (manifestBytes) {
    const value = parseJson(manifestBytes, "manifest.json");
    if (!isRecord(value)) throw new Error("manifest.json must be an object");
    manifest = value as Manifest;
  }

  const extras = members.filter((member) => !MANAGED.has(member.name));
  return { sheets, metadata, manifest, extras, source };
}

/**
 * Write a workbook as ZIP bytes.
 * Always emits content.json (sheet array), the official content.xml stub,
 * metadata.json, and manifest.json, using ZIP_STORED. Other members in
 * `workbook.extras` are copied through.
 */
export function writeXMind(workbook: Workbook): Uint8Array {
  const prepared = prepareWorkbook(workbook);
  const extras = workbook.extras ?? [];
  let mimetype: ZipMember | undefined;
  const rest: ZipMember[] = [];
  const seen = new Set<string>();
  for (const extra of extras) {
    if (!extra || typeof extra.name !== "string" || extra.name.length === 0) {
      throw new TypeError("zip member name must be a non-empty string");
    }
    if (!(extra.data instanceof Uint8Array)) throw new TypeError(`zip member ${extra.name} data must be a Uint8Array`);
    if (MANAGED.has(extra.name) || seen.has(extra.name)) continue;
    seen.add(extra.name);
    if (extra.name === "mimetype" && !mimetype) {
      mimetype = extra;
      continue;
    }
    rest.push(extra);
  }

  const members: ZipMember[] = [];
  if (mimetype) members.push(mimetype);
  members.push(
    { name: "content.json", data: encodeUtf8(JSON.stringify(prepared.sheets)) },
    { name: "metadata.json", data: encodeUtf8(JSON.stringify(prepared.metadata)) },
    { name: "manifest.json", data: encodeUtf8(JSON.stringify(prepared.manifest)) },
    { name: "content.xml", data: encodeUtf8(CONTENT_XML_STUB_TEXT) },
    ...rest,
  );
  return zipStored(members);
}
