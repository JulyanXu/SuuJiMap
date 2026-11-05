import type { Sheet } from "xmind-workbook";
import { edgePath, relationshipCurve, topicImageBlock, topicImageOrigin, type Scene } from "./layout.ts";
import { pdfFromRgb } from "./pdf.ts";
import { chipFill, resolveTheme, type ResolvedTheme } from "./theme.ts";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function dash(pattern: string): number[] {
  return pattern ? pattern.split(" ").map((part) => Number(part)) : [];
}

export function renderSceneCanvas(
  scene: Scene,
  sheet: Sheet,
  theme: ResolvedTheme = resolveTheme(sheet.theme),
  images?: ReadonlyMap<string, CanvasImageSource>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const maxEdge = 4096;
  const scale = Math.min(2, maxEdge / Math.max(scene.width, scene.height, 1));
  canvas.width = Math.max(1, Math.ceil(scene.width * scale));
  canvas.height = Math.max(1, Math.ceil(scene.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.scale(scale, scale);
  ctx.fillStyle = theme.canvas;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const boundary = theme.boundary();
  for (const item of scene.boundaries) {
    ctx.save();
    ctx.setLineDash(dash(boundary.dash));
    ctx.strokeStyle = boundary.color;
    ctx.lineWidth = boundary.width;
    roundRect(ctx, item.x, item.y, item.w, item.h, 12);
    if (boundary.fill !== "none") {
      ctx.fillStyle = boundary.fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.restore();
    if (item.title) {
      ctx.fillStyle = boundary.text;
      ctx.font = `${boundary.fontSize}px ${boundary.fontFamily}`;
      ctx.fillText(item.title, item.x + 8, item.y + 14);
    }
  }

  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  for (const node of scene.nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent || node.kind === "summary" || node.kind === "floating" || node.kind === "callout") continue;
    const paint = theme.topic(node.kind, Math.max(0, node.branchIndex));
    ctx.save();
    ctx.setLineDash(dash(paint.lineDash));
    ctx.strokeStyle = paint.lineColor;
    ctx.lineWidth = paint.lineWidth;
    ctx.stroke(new Path2D(edgePath(parent, node, scene.structure)));
    ctx.restore();
  }

  const summary = theme.summaryLine();
  for (const bracket of scene.brackets) {
    ctx.save();
    ctx.setLineDash(dash(summary.dash));
    ctx.strokeStyle = summary.color;
    ctx.lineWidth = summary.width;
    ctx.stroke(new Path2D(bracket.d));
    ctx.restore();
  }

  const relationship = theme.relationship();
  for (const link of sheet.relationships ?? []) {
    if (!link.end1Id || !link.end2Id) continue;
    const from = byId.get(link.end1Id);
    const to = byId.get(link.end2Id);
    if (!from || !to) continue;
    const curve = relationshipCurve(from, to, link.title, link.id ?? `${link.end1Id}-${link.end2Id}`);
    ctx.save();
    ctx.setLineDash(dash(relationship.dash));
    ctx.strokeStyle = relationship.color;
    ctx.lineWidth = relationship.width;
    ctx.stroke(new Path2D(curve.d));
    ctx.restore();
    if (curve.title) {
      ctx.fillStyle = relationship.text;
      ctx.font = `${relationship.fontSize}px ${relationship.fontFamily}`;
      ctx.fillText(curve.title, (from.x + to.x) / 2, (from.y + to.y) / 2 - 8);
    }
  }

  for (const node of scene.nodes) {
    const paint = theme.topic(node.kind, Math.max(0, node.branchIndex));
    const radius = Math.min(paint.radius, node.h / 2);
    roundRect(ctx, node.x, node.y, node.w, node.h, radius);
    ctx.fillStyle = chipFill(paint.fill, theme.canvas);
    ctx.fill();
    if (paint.borderWidth > 0) {
      ctx.strokeStyle = paint.border;
      ctx.lineWidth = paint.borderWidth;
      ctx.stroke();
    }
    const picture = images?.get(node.id);
    const origin = topicImageOrigin(node);
    if (picture && origin) ctx.drawImage(picture, origin.x, origin.y, node.imageW, node.imageH);
    ctx.fillStyle = paint.text;
    ctx.font = `${paint.fontWeight} ${paint.fontSize}px ${paint.fontFamily}`;
    const line = (node.title.trim() ? node.title : "Untitled").split("\n")[0] ?? "";
    const titleY = node.labels.length > 0 || node.imageH > 0 ? node.y + 8 + paint.fontSize : node.y + node.h / 2 + paint.fontSize * 0.3;
    ctx.fillText(line, node.x + 12, titleY);
    if (node.labels.length > 0) {
      ctx.font = `500 9px ${paint.fontFamily}`;
      let labelX = node.x + 10;
      const labelY = node.y + node.h - topicImageBlock(node) - 5;
      for (const label of node.labels) {
        const width = ctx.measureText(label).width + 8;
        if (labelX + width > node.x + node.w - 4) break;
        ctx.strokeStyle = paint.text;
        ctx.lineWidth = 0.6;
        roundRect(ctx, labelX, labelY - 10, width, 12, 6);
        ctx.stroke();
        ctx.fillText(label, labelX + 4, labelY - 1);
        labelX += width + 4;
      }
    }
  }

  return canvas;
}

async function decodeImages(images?: ReadonlyMap<string, string>): Promise<Map<string, HTMLImageElement>> {
  const loaded = new Map<string, HTMLImageElement>();
  if (!images || images.size === 0) return loaded;
  await Promise.all(
    [...images.entries()].map(async ([id, src]) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      try {
        await img.decode();
        loaded.set(id, img);
      } catch {
        // A broken resource leaves the chip text in place.
      }
    }),
  );
  return loaded;
}

export async function sceneToPng(scene: Scene, sheet: Sheet, theme?: ResolvedTheme, images?: ReadonlyMap<string, string>): Promise<Blob> {
  const canvas = renderSceneCanvas(scene, sheet, theme, await decodeImages(images));
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
  if (!blob) throw new Error("Could not export PNG");
  return blob;
}

export async function sceneToPdf(scene: Scene, sheet: Sheet, theme?: ResolvedTheme, images?: ReadonlyMap<string, string>): Promise<Blob> {
  const canvas = renderSceneCanvas(scene, sheet, theme, await decodeImages(images));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let index = 0, target = 0; index < image.data.length; index += 4, target += 3) {
    const alpha = (image.data[index + 3] ?? 255) / 255;
    rgb[target] = Math.round((image.data[index] ?? 0) * alpha + 255 * (1 - alpha));
    rgb[target + 1] = Math.round((image.data[index + 1] ?? 0) * alpha + 255 * (1 - alpha));
    rgb[target + 2] = Math.round((image.data[index + 2] ?? 0) * alpha + 255 * (1 - alpha));
  }
  const bytes = await pdfFromRgb(canvas.width, canvas.height, rgb);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
