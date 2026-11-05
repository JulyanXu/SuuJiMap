import { resourceZipPath, type Topic, type Workbook, type ZipMember } from "xmind-workbook";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

const CHILD_KEYS = ["attached", "detached", "summary", "callout"] as const;

export function sniffImageMime(data: Uint8Array): ImageMime | null {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "image/webp";
  }
  const head = new TextDecoder().decode(data.subarray(0, Math.min(data.length, 256))).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.includes("<svg") && (head.startsWith("<?xml") || head.startsWith("<!doctype")))) return "image/svg+xml";
  return null;
}

export function findResource(extras: readonly ZipMember[] | undefined, src: string | undefined): ZipMember | undefined {
  const path = resourceZipPath(src);
  if (!path || !extras) return undefined;
  return extras.find((entry) => entry.name === path);
}

function walkTopics(topic: Topic, visit: (topic: Topic) => void): void {
  visit(topic);
  for (const key of CHILD_KEYS) {
    for (const child of topic.children?.[key] ?? []) walkTopics(child, visit);
  }
}

/** Changes when an image src or its resource bytes change. Title edits do not. */
export function imageSignature(workbook: Workbook | null): string {
  if (!workbook) return "";
  const parts: string[] = [];
  for (const sheet of workbook.sheets) {
    walkTopics(sheet.rootTopic, (topic) => {
      if (!topic.image?.src) return;
      const member = findResource(workbook.extras, topic.image.src);
      parts.push(`${topic.id ?? ""}\t${topic.image.src}\t${member?.data.byteLength ?? -1}`);
    });
  }
  return parts.join("\n");
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function objectUrlFor(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([copyBytes(bytes)], { type: mime }));
}

export function objectUrlsForWorkbook(workbook: Workbook | null): Map<string, string> {
  const urls = new Map<string, string>();
  if (!workbook) return urls;
  for (const sheet of workbook.sheets) {
    walkTopics(sheet.rootTopic, (topic) => {
      if (!topic.id || !topic.image?.src) return;
      const member = findResource(workbook.extras, topic.image.src);
      if (!member) return;
      const mime = sniffImageMime(member.data);
      if (!mime) return;
      urls.set(topic.id, objectUrlFor(member.data, mime));
    });
  }
  return urls;
}

function bytesToBase64(bytes: Uint8Array): string {
  const copy = copyBytes(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < copy.length; index += chunk) {
    binary += String.fromCharCode(...copy.subarray(index, Math.min(index + chunk, copy.length)));
  }
  return btoa(binary);
}

/** Topic id → data URL, for SVG and PNG export. Bytes that are not png/jpeg/webp/svg are skipped. */
export function topicImageHrefs(workbook: Workbook | null): Map<string, string> {
  const hrefs = new Map<string, string>();
  if (!workbook) return hrefs;
  for (const sheet of workbook.sheets) {
    walkTopics(sheet.rootTopic, (topic) => {
      if (!topic.id || !topic.image?.src) return;
      const member = findResource(workbook.extras, topic.image.src);
      if (!member) return;
      const mime = sniffImageMime(member.data);
      if (!mime) return;
      hrefs.set(topic.id, `data:${mime};base64,${bytesToBase64(member.data)}`);
    });
  }
  return hrefs;
}

/** Fit a newly attached image. Stored width/height on an opened file are not passed through here. */
export function fittedSize(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return { width: 64, height: 64 };
  const down = Math.min(1, 160 / Math.max(width, height));
  let w = Math.max(1, Math.round(width * down));
  let h = Math.max(1, Math.round(height * down));
  if (Math.max(w, h) < 64) {
    const up = 64 / Math.max(w, h);
    w = Math.max(1, Math.round(w * up));
    h = Math.max(1, Math.round(h * up));
  }
  return { width: w, height: h };
}

export function readDisplaySize(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number }> {
  const url = objectUrlFor(bytes, mime);
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (width: number, height: number) => {
      URL.revokeObjectURL(url);
      resolve(fittedSize(width, height));
    };
    img.onload = () => finish(img.naturalWidth, img.naturalHeight);
    img.onerror = () => finish(64, 64);
    img.src = url;
  });
}
