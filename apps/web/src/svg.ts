import type { Sheet } from "xmind-workbook";
import { edgePath, relationshipCurve, type Scene } from "./layout.ts";
import { resolveTheme, type ResolvedTheme } from "./theme.ts";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Vector export of the current scene. Fonts are the resolved open stack (NeverMind → Inter). */
export function sceneToSvg(scene: Scene, sheet: Sheet, theme: ResolvedTheme = resolveTheme(sheet.theme)): string {
  const boundary = theme.boundary();
  const summary = theme.summaryLine();
  const relationship = theme.relationship();
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(scene.width)}" height="${num(scene.height)}" viewBox="0 0 ${num(scene.width)} ${num(scene.height)}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(theme.canvas)}"/>`,
  ];

  if (relationship.arrow) {
    parts.push(
      `<defs><marker id="rel-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(relationship.color)}"/></marker></defs>`,
    );
  }

  for (const item of scene.boundaries) {
    parts.push(
      `<rect x="${num(item.x)}" y="${num(item.y)}" width="${num(item.w)}" height="${num(item.h)}" rx="12" fill="none" stroke="${escapeXml(boundary.color)}" stroke-width="${num(boundary.width)}"${boundary.dash ? ` stroke-dasharray="${boundary.dash}"` : ""}/>`,
    );
    if (item.title) {
      parts.push(
        `<text x="${num(item.x + 8)}" y="${num(item.y + 14)}" fill="${escapeXml(boundary.text)}" font-family="${escapeXml(boundary.fontFamily)}" font-size="${num(boundary.fontSize)}">${escapeXml(item.title)}</text>`,
      );
    }
  }

  for (const node of scene.nodes) {
    if (!node.parentId || node.kind === "summary" || node.kind === "floating" || node.kind === "callout") continue;
    const parent = byId.get(node.parentId);
    if (!parent) continue;
    const paint = theme.topic(node.kind, Math.max(0, node.branchIndex));
    parts.push(
      `<path d="${edgePath(parent, node, scene.structure)}" fill="none" stroke="${escapeXml(paint.lineColor)}" stroke-width="${num(paint.lineWidth)}"${paint.lineDash ? ` stroke-dasharray="${paint.lineDash}"` : ""}/>`,
    );
  }

  for (const bracket of scene.brackets) {
    parts.push(
      `<path d="${bracket.d}" fill="none" stroke="${escapeXml(summary.color)}" stroke-width="${num(summary.width)}"${summary.dash ? ` stroke-dasharray="${summary.dash}"` : ""}/>`,
    );
  }

  for (const link of sheet.relationships ?? []) {
    if (!link.end1Id || !link.end2Id) continue;
    const from = byId.get(link.end1Id);
    const to = byId.get(link.end2Id);
    if (!from || !to) continue;
    const curve = relationshipCurve(from, to, link.title, link.id ?? `${link.end1Id}-${link.end2Id}`);
    parts.push(
      `<path d="${curve.d}" fill="none" stroke="${escapeXml(relationship.color)}" stroke-width="${num(relationship.width)}"${relationship.dash ? ` stroke-dasharray="${relationship.dash}"` : ""}${relationship.arrow ? ` marker-end="url(#rel-arrow)"` : ""}/>`,
    );
    if (curve.title) {
      const labelX = (from.x + from.w / 2 + to.x + to.w / 2) / 2;
      const labelY = (from.y + from.h / 2 + to.y + to.h / 2) / 2 - 10;
      parts.push(
        `<text x="${num(labelX)}" y="${num(labelY)}" text-anchor="middle" fill="${escapeXml(relationship.text)}" font-family="${escapeXml(relationship.fontFamily)}" font-size="${num(relationship.fontSize)}">${escapeXml(curve.title)}</text>`,
      );
    }
  }

  for (const node of scene.nodes) {
    const paint = theme.topic(node.kind, Math.max(0, node.branchIndex));
    const radius = Math.min(paint.radius, node.h / 2);
    const fill = paint.fill === "transparent" ? "none" : paint.fill;
    parts.push(
      `<rect x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(node.h)}" rx="${num(radius)}" fill="${escapeXml(fill)}" stroke="${escapeXml(paint.border)}" stroke-width="${num(paint.borderWidth)}"/>`,
    );
    const lines = (node.title.trim() ? node.title : "Untitled").split("\n");
    lines.forEach((line, index) => {
      const y = node.y + 8 + paint.fontSize + index * (paint.fontSize + 2);
      parts.push(
        `<text x="${num(node.x + 12)}" y="${num(y)}" fill="${escapeXml(paint.text)}" font-family="${escapeXml(paint.fontFamily)}" font-size="${num(paint.fontSize)}" font-weight="${paint.fontWeight}"${paint.decoration === "line-through" ? ` text-decoration="line-through"` : ""}>${escapeXml(line)}</text>`,
      );
    });
  }

  parts.push("</svg>\n");
  return parts.join("");
}
