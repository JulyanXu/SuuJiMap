import { unzipSync, zipSync } from "fflate/browser";
import type { ZipMember } from "./types.js";

const STORED = { level: 0 } as const;

export function unzipMembers(data: Uint8Array): ZipMember[] {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new Error("not a zip archive");
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid xmind zip: ${message}`);
  }
  const members: ZipMember[] = [];
  for (const name of Object.keys(files)) {
    const bytes = files[name];
    if (!bytes) continue;
    members.push({ name, data: new Uint8Array(bytes) });
  }
  return members;
}

/** ZIP_STORED (method 0), matching Vana and the official SDK Zipper. */
export function zipStored(members: readonly ZipMember[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const member of members) {
    files[member.name] = [member.data, STORED];
  }
  return zipSync(files, STORED);
}
