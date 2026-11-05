import { edgePath, relationshipCurve, type Curve, type Scene } from "./layout.ts";
import type { Sheet } from "xmind-workbook";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function sceneToPng(scene: Scene, sheet: Sheet): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.max(1, Math.ceil(scene.width * scale));
  canvas.height = Math.max(1, Math.ceil(scene.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#a1a1aa";
  ctx.font = '14px Inter, "Noto Sans SC", sans-serif';

  for (const boundary of scene.boundaries) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#71717a";
    roundRect(ctx, boundary.x, boundary.y, boundary.w, boundary.h, 12);
    ctx.stroke();
    ctx.restore();
    if (boundary.title) {
      ctx.fillStyle = "#3f3f46";
      ctx.fillText(boundary.title, boundary.x + 8, boundary.y + 14);
    }
  }

  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  for (const node of scene.nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent || node.kind === "summary" || node.kind === "floating") continue;
    ctx.strokeStyle = "#a1a1aa";
    ctx.stroke(new Path2D(edgePath(parent, node, scene.structure)));
  }
  for (const bracket of scene.brackets) {
    ctx.strokeStyle = "#52525b";
    ctx.stroke(new Path2D(bracket.d));
  }
  for (const relationship of sheet.relationships ?? []) {
    if (!relationship.end1Id || !relationship.end2Id) continue;
    const from = byId.get(relationship.end1Id);
    const to = byId.get(relationship.end2Id);
    if (!from || !to) continue;
    const curve: Curve = relationshipCurve(from, to, relationship.title, relationship.id ?? `${relationship.end1Id}-${relationship.end2Id}`);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#3f3f46";
    ctx.stroke(new Path2D(curve.d));
    ctx.restore();
    if (curve.title) {
      ctx.fillStyle = "#3f3f46";
      ctx.fillText(curve.title, (from.x + to.x) / 2, (from.y + to.y) / 2 - 8);
    }
  }

  for (const node of scene.nodes) {
    ctx.fillStyle = node.kind === "central" ? "#18181b" : node.kind === "floating" ? "#f4f4f5" : "#ffffff";
    roundRect(ctx, node.x, node.y, node.w, node.h, 8);
    ctx.fill();
    if (node.kind !== "central") {
      ctx.strokeStyle = "#d4d4d8";
      ctx.stroke();
    }
    ctx.fillStyle = node.kind === "central" ? "#fafafa" : "#18181b";
    const line = node.title.split("\n")[0] ?? "";
    ctx.fillText(line, node.x + 14, node.y + node.h / 2 + 5);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
  if (!blob) throw new Error("Could not export PNG");
  return blob;
}
