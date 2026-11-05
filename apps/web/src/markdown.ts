import type { Topic } from "xmind-workbook";

function attached(topic: Topic): Topic[] {
  return topic.children?.attached ?? [];
}

function bullet(topic: Topic, depth: number, lines: string[]): void {
  const title = (topic.title ?? "").replace(/\n/g, " ");
  lines.push(`${"  ".repeat(depth)}- ${title}`);
  for (const child of attached(topic)) bullet(child, depth + 1, lines);
}

export function toMarkdown(root: Topic): string {
  const title = (root.title ?? "Untitled").replace(/\n/g, " ");
  const lines = [`# ${title}`, ""];
  for (const child of attached(root)) bullet(child, 0, lines);
  return `${lines.join("\n").trim()}\n`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function outline(topic: Topic): string {
  const text = escapeXml((topic.title ?? "").replace(/\n/g, " "));
  const children = attached(topic).map(outline).join("");
  return `<outline text="${text}">${children}</outline>`;
}

export function toOpml(root: Topic): string {
  return `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>${escapeXml(root.title ?? "Untitled")}</title></head><body>${outline(root)}</body></opml>\n`;
}

export function plainToRealHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div>${escaped.replace(/\n/g, "<br>")}</div>`;
}
