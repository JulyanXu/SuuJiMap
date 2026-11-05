import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { readXMind, writeXMind } from "./index.js";
import type { Workbook } from "./types.js";

export { readXMind, writeXMind } from "./index.js";
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

/** Read a .xmind file from disk. Node only — the core API takes bytes. */
export function readXMindFile(path: string): Workbook {
  return readXMind(readFileSync(path));
}

/** Write a .xmind file to disk. Node only — the core API returns bytes. */
export function writeXMindFile(workbook: Workbook, path: string): void {
  const bytes = writeXMind(workbook);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}
