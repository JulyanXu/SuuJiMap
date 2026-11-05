import type { Manifest, ZipMember } from "./types.js";

const XAP_RESOURCES = "xap:resources/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Zip path for `topic.image.src`.
 * Measured form: `xap:resources/<uuid>` → `resources/<uuid>` (no extension).
 * A name that already has an extension is kept; this writer does not add one.
 */
export function resourceZipPath(src: string | undefined): string | null {
  if (!src || !src.startsWith(XAP_RESOURCES)) return null;
  const name = src.slice(XAP_RESOURCES.length);
  if (!name || name.endsWith("/") || name.startsWith("/") || name.includes("..")) return null;
  return `resources/${name}`;
}

/**
 * List every `resources/*` file in `manifest["file-entries"]`.
 * A missing key becomes `{}`. An existing entry object is left unchanged.
 * Directory placeholders such as `resources/` are not entries, and `content.xml` is not added.
 */
export function updateManifestMetadata(manifest: Manifest, members: readonly ZipMember[]): void {
  if (!isRecord(manifest["file-entries"])) manifest["file-entries"] = {};
  const entries = manifest["file-entries"];
  for (const member of members) {
    if (typeof member?.name !== "string") continue;
    if (!member.name.startsWith("resources/") || member.name.endsWith("/")) continue;
    if (!Object.prototype.hasOwnProperty.call(entries, member.name)) entries[member.name] = {};
  }
}
