import type { Topic } from "xmind-workbook";
import { resolveStructure, type StructureId } from "./structures.ts";
import { resolveTheme, type ResolvedTheme, type ThemeKind } from "./theme.ts";
import { isFolded } from "./tree.ts";

export type Side = "left" | "right" | "up" | "down" | "center";
export type NodeKind = ThemeKind;

export interface MapNode {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
  side: Side;
  kind: NodeKind;
  folded: boolean;
  hasChildren: boolean;
  branchIndex: number;
  lineClass: "curve" | "roundedElbow";
  labels: string[];
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
}

export interface Curve {
  id: string;
  d: string;
  title?: string;
}

export interface Scene {
  structure: StructureId;
  nodes: MapNode[];
  boundaries: Bounds[];
  brackets: Curve[];
  relationships: Curve[];
  width: number;
  height: number;
}

interface RawNode {
  id: string;
  title: string;
  w: number;
  h: number;
  children: RawNode[];
  folded: boolean;
  hasChildren: boolean;
  branchIndex: number;
  labels: string[];
}

const H_GAP = 72;
const V_GAP = 22;

function measure(title: string, fontPx: number, root: boolean, labels: string[]): { w: number; h: number } {
  const lines = (title || " ").split("\n");
  const longest = Math.max(...lines.map((line) => Array.from(line).length), 1);
  const char = Math.max(7, fontPx * 0.56);
  let w = Math.min(460, Math.max(root ? 168 : 112, Math.round(longest * char + fontPx * 1.4)));
  let h = Math.max(36, lines.length * (fontPx * 1.25) + 16);
  if (labels.length > 0) {
    const chips = labels.reduce((sum, label) => sum + Array.from(label).length * 6.2 + 14, 8);
    w = Math.min(520, Math.max(w, Math.round(chips)));
    h += 18;
  }
  return { w, h };
}

function shape(topic: Topic, path: string, kind: NodeKind, branchIndex: number, resolved: ResolvedTheme): RawNode {
  const id = topic.id && topic.id.trim() !== "" ? topic.id : path;
  const title = topic.title ?? "";
  const labels = (topic.labels ?? []).map((label) => label.trim()).filter((label) => label.length > 0);
  const paint = resolved.topic(kind, Math.max(0, branchIndex), topic.style?.properties);
  const size = measure(title, paint.fontSize, kind === "central", labels);
  const attached = topic.children?.attached ?? [];
  const children = isFolded(topic)
    ? []
    : attached.map((child, index) =>
        shape(child, `${path}/${index}`, kind === "central" ? "main" : "sub", kind === "central" ? index : branchIndex, resolved),
      );
  return {
    id,
    title,
    w: size.w,
    h: size.h,
    children,
    folded: isFolded(topic),
    hasChildren: attached.length > 0,
    branchIndex: kind === "central" ? -1 : branchIndex,
    labels,
  };
}

function box(node: RawNode, parentId: string | null, x: number, y: number, side: Side, kind: NodeKind): MapNode {
  return {
    id: node.id,
    title: node.title,
    x,
    y,
    w: node.w,
    h: node.h,
    parentId,
    side,
    kind,
    folded: node.folded,
    hasChildren: node.hasChildren,
    branchIndex: node.branchIndex,
    lineClass: "curve",
    labels: node.labels,
  };
}

function layoutHorizontal(root: RawNode, sideName: "left" | "right"): MapNode[] {
  const sign = sideName === "right" ? 1 : -1;
  const nodes: MapNode[] = [];

  function place(node: RawNode, parentId: string | null, edgeX: number, top: number, kind: NodeKind): number {
    const x = sign > 0 ? edgeX : edgeX - node.w;
    if (node.children.length === 0) {
      nodes.push(box(node, parentId, x, top, sideName, kind));
      return node.h;
    }
    let cursor = top;
    for (const child of node.children) {
      const childEdge = sign > 0 ? x + node.w + H_GAP : x - H_GAP;
      const height = place(child, node.id, childEdge, cursor, kind === "central" ? "main" : "sub");
      cursor += height + V_GAP;
    }
    const childrenHeight = cursor - top - V_GAP;
    const height = Math.max(node.h, childrenHeight);
    const shift = (height - childrenHeight) / 2;
    if (shift !== 0) {
      for (const child of node.children) shiftSubtree(nodes, child.id, shift);
    }
    nodes.push(box(node, parentId, x, top + (height - node.h) / 2, sideName, kind));
    return height;
  }

  const edge = sign > 0 ? root.w / 2 + H_GAP : -root.w / 2 - H_GAP;
  let cursor = 0;
  const heights: number[] = [];
  for (const child of root.children) {
    heights.push(place(child, root.id, edge, cursor, "main"));
    cursor += (heights.at(-1) ?? 0) + V_GAP;
  }
  const total = root.children.length === 0 ? 0 : cursor - V_GAP;
  if (total > 0) {
    for (const child of root.children) shiftSubtree(nodes, child.id, -total / 2);
  }
  nodes.push(box(root, null, -root.w / 2, -root.h / 2, "center", "central"));
  return nodes;
}

function subtreeIds(nodes: MapNode[], id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        grew = true;
      }
    }
  }
  return ids;
}

function shiftSubtree(nodes: MapNode[], id: string, dy: number): void {
  for (const node of nodes) {
    if (subtreeIds(nodes, id).has(node.id)) node.y += dy;
  }
}

function splitMap(root: RawNode, balanced: boolean): MapNode[] {
  const right: RawNode[] = [];
  const left: RawNode[] = [];
  root.children.forEach((child, index) => {
    const goRight = balanced ? index % 2 === 0 : index < Math.max(root.children.length - 1, 1);
    (goRight ? right : left).push(child);
  });
  const rightNodes = layoutForest(right, root, "right");
  const leftNodes = layoutForest(left, root, "left");
  return [...rightNodes, ...leftNodes, box(root, null, -root.w / 2, -root.h / 2, "center", "central")];
}

function layoutForest(children: RawNode[], root: RawNode, sideName: "left" | "right"): MapNode[] {
  const clone = { ...root, children };
  const nodes = layoutHorizontal(clone, sideName);
  return nodes.filter((node) => node.id !== root.id);
}

function measureWidth(node: RawNode): number {
  if (node.children.length === 0) return node.w;
  const inner = node.children.reduce((sum, child) => sum + measureWidth(child), 0) + H_GAP * (node.children.length - 1);
  return Math.max(node.w, inner);
}

function layoutDown(root: RawNode): MapNode[] {
  const nodes: MapNode[] = [];
  function place(node: RawNode, parentId: string | null, left: number, top: number, kind: NodeKind) {
    const width = measureWidth(node);
    nodes.push(box(node, parentId, left + (width - node.w) / 2, top, "down", kind));
    if (node.children.length === 0) return;
    const inner = node.children.reduce((sum, child) => sum + measureWidth(child), 0) + H_GAP * (node.children.length - 1);
    let x = left + (width - inner) / 2;
    for (const child of node.children) {
      const childWidth = measureWidth(child);
      place(child, node.id, x, top + node.h + V_GAP, kind === "central" ? "main" : "sub");
      x += childWidth + H_GAP;
    }
  }
  place(root, null, 0, 0, "central");
  const rootNode = nodes.find((node) => node.id === root.id);
  if (rootNode) rootNode.side = "center";
  return nodes;
}

function reflectUp(nodes: MapNode[], rootId: string): void {
  const root = nodes.find((node) => node.id === rootId);
  if (!root) return;
  const axis = root.y + root.h / 2;
  for (const node of nodes) {
    const center = node.y + node.h / 2;
    node.y = axis - (center - axis) - node.h / 2;
    if (node.id !== rootId && node.side === "down") node.side = "up";
  }
}

/**
 * Main topics sit on a circle. direction +1 walks clockwise from the top
 * (screen y grows downward). Subtopics continue outward in the same turn.
 * No published angle table was measured; this is a geometric reading of the structure class.
 */
function layoutRadial(root: RawNode, direction: 1 | -1): MapNode[] {
  const nodes: MapNode[] = [];
  const rootNode = box(root, null, -root.w / 2, -root.h / 2, "center", "central");
  nodes.push(rootNode);
  const count = root.children.length;
  if (count === 0) return nodes;
  const sector = (Math.PI * 2) / count;

  function ring(node: RawNode, parent: MapNode, angle: number, span: number, kind: NodeKind) {
    const parentCx = parent.x + parent.w / 2;
    const parentCy = parent.y + parent.h / 2;
    const parentRadius = Math.hypot(parentCx, parentCy);
    const parentReach = Math.hypot(parent.w, parent.h) / 2;
    const selfReach = Math.hypot(node.w, node.h) / 2;
    const chord = Math.max(node.w, node.h) + V_GAP;
    let radius = parentRadius + parentReach + selfReach + H_GAP;
    const minRadius = chord / Math.max(span, 0.35);
    if (radius < minRadius) radius = minRadius;
    const x = Math.cos(angle) * radius - node.w / 2;
    const y = Math.sin(angle) * radius - node.h / 2;
    const side: Side = Math.cos(angle) >= 0 ? "right" : "left";
    const placed = box(node, parent.id, x, y, side, kind);
    nodes.push(placed);
    const kids = node.children.length;
    if (kids === 0) return;
    const childSpan = Math.min(span, Math.PI * 0.9) / kids;
    const childSweep = childSpan * kids;
    node.children.forEach((child, index) => {
      const childAngle = angle + direction * (-childSweep / 2 + childSpan * (index + 0.5));
      ring(child, placed, childAngle, childSpan * 0.92, "sub");
    });
  }

  root.children.forEach((child, index) => {
    const angle = -Math.PI / 2 + direction * sector * (index + 0.5);
    ring(child, rootNode, angle, Math.min(sector * 0.92, Math.PI * 0.9), "main");
  });
  return nodes;
}

function placeDetached(raw: RawNode, anchorX: number, anchorY: number, parentId: string): MapNode[] {
  const laid = layoutHorizontal(raw, "right");
  const self = laid.find((node) => node.id === raw.id);
  if (!self) return [];
  const dx = anchorX - self.x;
  const dy = anchorY - self.y;
  for (const node of laid) {
    node.x += dx;
    node.y += dy;
    if (node.id === raw.id) {
      node.kind = "floating";
      node.parentId = parentId;
      node.side = "right";
    } else if (node.kind === "main") {
      node.kind = "sub";
    }
  }
  return laid;
}

/** Measured ranges are `master` and `(start,end)`. Other strings are not drawn and are not rewritten. */
function parseSpan(range: string | undefined, count: number): number[] {
  if (!range || range === "master") return Array.from({ length: count }, (_, index) => index);
  const match = /^\((\d+),(\d+)\)$/.exec(range);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2]);
  const indexes: number[] = [];
  for (let index = start; index <= end && index < count; index += 1) indexes.push(index);
  return indexes;
}

function boundsOf(nodes: MapNode[], ids: Set<string>): Bounds | null {
  const picked = nodes.filter((node) => ids.has(node.id));
  if (picked.length === 0) return null;
  const minX = Math.min(...picked.map((node) => node.x));
  const minY = Math.min(...picked.map((node) => node.y));
  const maxX = Math.max(...picked.map((node) => node.x + node.w));
  const maxY = Math.max(...picked.map((node) => node.y + node.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function shiftAll(nodes: MapNode[], dx: number, dy: number): void {
  for (const node of nodes) {
    node.x += dx;
    node.y += dy;
  }
}

export function layoutMap(rootTopic: Topic, structureClass?: string, theme?: Record<string, unknown>): Scene {
  const structure = resolveStructure(structureClass ?? rootTopic.structureClass);
  const resolved = resolveTheme(theme);
  const root = shape(rootTopic, "root", "central", -1, resolved);
  let nodes: MapNode[] = [];
  if (structure === "org.xmind.ui.org-chart.down" || structure === "org.xmind.ui.org-chart.up") {
    nodes = layoutDown(root);
    if (structure === "org.xmind.ui.org-chart.up") reflectUp(nodes, root.id);
  } else if (structure === "org.xmind.ui.logic.left" || structure === "org.xmind.ui.tree.left") {
    nodes = layoutHorizontal(root, "left");
  } else if (structure === "org.xmind.ui.logic.right" || structure === "org.xmind.ui.tree.right") {
    nodes = layoutHorizontal(root, "right");
  } else if (structure === "org.xmind.ui.map.clockwise") {
    nodes = layoutRadial(root, 1);
  } else if (structure === "org.xmind.ui.map.anticlockwise") {
    nodes = layoutRadial(root, -1);
  } else {
    nodes = splitMap(root, structure === "org.xmind.ui.map");
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rootNode = byId.get(root.id);
  const floaters = rootTopic.children?.detached ?? [];
  if (rootNode) {
    floaters.forEach((topic, index) => {
      const raw = shape(topic, `float/${index}`, "floating", 0, resolved);
      const x = rootNode.x + rootNode.w + 48 + (topic.position?.x ?? index * 16);
      const y = rootNode.y + rootNode.h + 28 + (topic.position?.y ?? index * (raw.h + 12));
      for (const node of placeDetached(raw, x, y, root.id)) {
        nodes.push(node);
        byId.set(node.id, node);
      }
    });
  }

  for (const node of [...nodes]) {
    const host = topicNode(rootTopic, node.id);
    if (!host || isFolded(host)) continue;
    (host.children?.callout ?? []).forEach((topic, index) => {
      const raw = shape(topic, `callout/${node.id}/${index}`, "callout", node.branchIndex, resolved);
      const placed = box(raw, node.id, node.x + node.w - 12, node.y - raw.h - 16 - index * (raw.h + 8), "up", "callout");
      nodes.push(placed);
      byId.set(placed.id, placed);
    });
  }

  const brackets: Curve[] = [];
  const topicById = new Map<string, Topic>();
  const collectTopics = (topic: Topic) => {
    if (topic.id) topicById.set(topic.id, topic);
    for (const child of topic.children?.attached ?? []) collectTopics(child);
  };
  collectTopics(rootTopic);

  for (const topic of topicById.values()) {
    if (isFolded(topic)) continue;
    const parentNode = topic.id ? byId.get(topic.id) : undefined;
    if (!parentNode) continue;
    for (const summary of topic.summaries ?? []) {
      const indexes = parseSpan(summary.range, topic.children?.attached?.length ?? 0);
      const ids = new Set<string>();
      for (const index of indexes) {
        const child = topic.children?.attached?.[index];
        if (!child?.id || !byId.has(child.id)) continue;
        for (const id of subtreeIds(nodes, child.id)) ids.add(id);
      }
      const bounds = boundsOf(nodes, ids);
      const summaryTopic = topic.children?.summary?.find((item) => item.id === summary.topicId);
      if (!bounds || !summaryTopic) continue;
      const raw = shape(summaryTopic, `summary/${summary.topicId}`, "summary", parentNode.branchIndex, resolved);
      const side =
        parentNode.side === "left" || nodes.find((node) => ids.has(node.id) && node.side === "left")
          ? "left"
          : parentNode.side === "up"
            ? "up"
            : parentNode.side === "down" || structure.startsWith("org.xmind.ui.org-chart")
              ? "down"
              : "right";
      const placed = placeOutside(raw, bounds, side, summary.topicId ?? raw.id);
      nodes.push(placed);
      byId.set(placed.id, placed);
      brackets.push({ id: summary.id ?? placed.id, d: bracketPath(bounds, side) });
    }
  }

  const treeStructure = structure === "org.xmind.ui.tree.right" || structure === "org.xmind.ui.tree.left";
  for (const node of nodes) {
    const host = topicNode(rootTopic, node.id);
    const paint = resolved.topic(node.kind, Math.max(0, node.branchIndex), host?.style?.properties);
    node.lineClass = treeStructure ? "roundedElbow" : paint.lineClass;
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.w));
  const maxY = Math.max(...nodes.map((node) => node.y + node.h));
  const pad = 80;
  shiftAll(nodes, pad - minX, pad - minY);
  for (const bracket of brackets) bracket.d = translatePath(bracket.d, pad - minX, pad - minY);

  const boundaries: Bounds[] = [];
  for (const topic of topicById.values()) {
    if (!topic.boundaries?.length || !topic.id || isFolded(topic)) continue;
    for (const boundary of topic.boundaries) {
      const indexes = parseSpan(boundary.range, topic.children?.attached?.length ?? 0);
      const ids = new Set<string>();
      for (const index of indexes) {
        const child = topic.children?.attached?.[index];
        if (!child?.id) continue;
        for (const id of subtreeIds(nodes, child.id)) ids.add(id);
      }
      const bounds = boundsOf(nodes, ids);
      if (!bounds) continue;
      boundaries.push({
        x: bounds.x - 16,
        y: bounds.y - 18,
        w: bounds.w + 32,
        h: bounds.h + 32,
        title: boundary.title,
      });
    }
  }

  return {
    structure,
    nodes,
    boundaries,
    brackets,
    relationships: [],
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function placeOutside(raw: RawNode, bounds: Bounds, side: Side, id: string): MapNode {
  if (side === "left") return box({ ...raw, id }, null, bounds.x - H_GAP - raw.w, bounds.y + bounds.h / 2 - raw.h / 2, "left", "summary");
  if (side === "up") return box({ ...raw, id }, null, bounds.x + bounds.w / 2 - raw.w / 2, bounds.y - V_GAP - raw.h, "up", "summary");
  if (side === "down") return box({ ...raw, id }, null, bounds.x + bounds.w / 2 - raw.w / 2, bounds.y + bounds.h + V_GAP, "down", "summary");
  return box({ ...raw, id }, null, bounds.x + bounds.w + H_GAP, bounds.y + bounds.h / 2 - raw.h / 2, "right", "summary");
}

function bracketPath(bounds: Bounds, side: Side): string {
  if (side === "left") {
    const x = bounds.x - 28;
    return `M ${bounds.x} ${bounds.y} C ${x} ${bounds.y}, ${x} ${bounds.y + bounds.h}, ${bounds.x} ${bounds.y + bounds.h}`;
  }
  if (side === "up") {
    const y = bounds.y - 28;
    return `M ${bounds.x} ${bounds.y} C ${bounds.x} ${y}, ${bounds.x + bounds.w} ${y}, ${bounds.x + bounds.w} ${bounds.y}`;
  }
  if (side === "down") {
    const y = bounds.y + bounds.h + 28;
    return `M ${bounds.x} ${bounds.y + bounds.h} C ${bounds.x} ${y}, ${bounds.x + bounds.w} ${y}, ${bounds.x + bounds.w} ${bounds.y + bounds.h}`;
  }
  const x = bounds.x + bounds.w + 28;
  return `M ${bounds.x + bounds.w} ${bounds.y} C ${x} ${bounds.y}, ${x} ${bounds.y + bounds.h}, ${bounds.x + bounds.w} ${bounds.y + bounds.h}`;
}

function translatePath(d: string, dx: number, dy: number): string {
  return d.replace(/([MC])([^MC]+)/g, (_match, command: string, rest: string) => {
    const nums = rest.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const shifted = nums.map((value, index) => value + (index % 2 === 0 ? dx : dy));
    return `${command} ${shifted.join(" ")}`;
  });
}

function topicNode(root: Topic, id: string): Topic | null {
  if (root.id === id) return root;
  for (const key of ["attached", "detached", "summary", "callout"] as const) {
    for (const child of root.children?.[key] ?? []) {
      const found = topicNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function borderPoint(node: MapNode, towardX: number, towardY: number): { x: number; y: number } {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = ux === 0 ? Number.POSITIVE_INFINITY : node.w / 2 / Math.abs(ux);
  const ty = uy === 0 ? Number.POSITIVE_INFINITY : node.h / 2 / Math.abs(uy);
  const t = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}

function radialEdge(parent: MapNode, child: MapNode): string {
  const parentCx = parent.x + parent.w / 2;
  const parentCy = parent.y + parent.h / 2;
  const childCx = child.x + child.w / 2;
  const childCy = child.y + child.h / 2;
  const start = borderPoint(parent, childCx, childCy);
  const end = borderPoint(child, parentCx, parentCy);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const midX = (start.x + end.x) / 2 - (dy / len) * 16;
  const midY = (start.y + end.y) / 2 + (dx / len) * 16;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}

export function edgePath(parent: MapNode, child: MapNode, structure: StructureId): string {
  if (structure === "org.xmind.ui.map.clockwise" || structure === "org.xmind.ui.map.anticlockwise") {
    return radialEdge(parent, child);
  }
  const tree = structure === "org.xmind.ui.tree.right" || structure === "org.xmind.ui.tree.left" || child.lineClass === "roundedElbow";
  if (child.side === "down" || child.side === "up") {
    const fromX = parent.x + parent.w / 2;
    const fromY = child.side === "down" ? parent.y + parent.h : parent.y;
    const toX = child.x + child.w / 2;
    const toY = child.side === "down" ? child.y : child.y + child.h;
    const midY = (fromY + toY) / 2;
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  }
  const fromX = child.side === "left" ? parent.x : parent.x + parent.w;
  const toX = child.side === "left" ? child.x + child.w : child.x;
  const fromY = parent.y + parent.h / 2;
  const toY = child.y + child.h / 2;
  if (tree) {
    const midX = (fromX + toX) / 2;
    return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
  }
  const midX = (fromX + toX) / 2;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

/**
 * Midpoint quadratic. This is a labeled drawing fallback, not a measured curve.
 * Relationship controlPoints stay on the sheet; their coordinate space is unmeasured, so they are not applied here.
 */
export function relationshipCurve(from: MapNode, to: MapNode, title: string | undefined, id: string): Curve {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 28;
  return { id, title, d: `M ${x1} ${y1} Q ${midX} ${midY}, ${x2} ${y2}` };
}
