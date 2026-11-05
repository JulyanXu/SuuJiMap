import { defaultSheetTheme } from "xmind-workbook";
import { displayFont } from "./structures.ts";

/** Kinds the measured theme roles map onto. */
export type ThemeKind = "central" | "main" | "sub" | "floating" | "summary" | "callout";

export interface TopicPaint {
  fill: string;
  text: string;
  border: string;
  borderWidth: number;
  fontSize: number;
  fontWeight: number;
  radius: number;
  fontFamily: string;
  decoration: "none" | "line-through";
  lineColor: string;
  lineWidth: number;
  lineDash: string;
  lineClass: "curve" | "roundedElbow";
}

export interface LinePaint {
  color: string;
  width: number;
  dash: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  arrow: boolean;
  /** Region fill. "none" means stroke only. Boundary uses this; summary and relationship stay "none". */
  fill: string;
}

/** Theme roles the quick-style picker can copy onto topic.style.properties. */
export const QUICK_ROLES = ["importantTopic", "minorTopic", "expiredTopic"] as const;
export type QuickRole = (typeof QUICK_ROLES)[number];

export interface ResolvedTheme {
  canvas: string;
  topic: (kind: ThemeKind, branchIndex: number, override?: Record<string, string>) => TopicPaint;
  boundary: () => LinePaint;
  summaryLine: () => LinePaint;
  relationship: () => LinePaint;
}

const ROLE: Record<ThemeKind, string> = {
  central: "centralTopic",
  main: "mainTopic",
  sub: "subTopic",
  floating: "floatingTopic",
  summary: "summaryTopic",
  callout: "calloutTopic",
};

const FALLBACK_PX: Record<ThemeKind, number> = {
  central: 28,
  main: 18,
  sub: 14,
  floating: 14,
  summary: 14,
  callout: 14,
};

let fallbackTheme: Record<string, unknown> | undefined;

function sourceTheme(theme: Record<string, unknown> | undefined): Record<string, unknown> {
  if (theme && Object.keys(theme).length > 0) return theme;
  fallbackTheme ??= defaultSheetTheme();
  return fallbackTheme;
}

function roleProps(theme: Record<string, unknown>, role: string): Record<string, string> {
  const value = theme[role];
  if (!value || typeof value !== "object") return {};
  const properties = (value as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(properties as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function merge(base: Record<string, string>, override?: Record<string, string>): Record<string, string> {
  if (!override) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && value !== "inherited") out[key] = value;
  }
  return out;
}

function parseColor(value: string | undefined): string | null {
  if (!value || value === "inherited" || value === "none") return null;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : null;
}

/** pt → CSS px. Unitless numbers stay as px (boundary line-width is unitless in the sample). */
function parseSize(value: string | undefined): number | null {
  if (!value || value === "inherited") return null;
  const size = Number.parseFloat(value);
  if (!Number.isFinite(size)) return null;
  return /pt\s*$/i.test(value) ? (size * 96) / 72 : size;
}

function colorsOf(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter((entry) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(entry));
}

function isDark(hex: string): boolean {
  const body = hex.slice(1);
  const full = body.length === 3 ? body.split("").map((char) => char + char).join("") : body;
  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 150;
}

function lineClassOf(value: string | undefined): "curve" | "roundedElbow" {
  return value && /elbow/i.test(value) ? "roundedElbow" : "curve";
}

function radiusFor(shape: string | undefined): number {
  if (!shape) return 8;
  if (/ellipse|circle/i.test(shape)) return 999;
  if (/underline/i.test(shape)) return 0;
  if (/rounded|round/i.test(shape)) return 10;
  if (/rect/i.test(shape)) return 2;
  return 8;
}

function dashOf(pattern: string | undefined): string {
  return pattern === "dash" ? "5 4" : "";
}

/**
 * `inherited` is not a computed color in the file.
 * Explicit hex wins. A summary topic with fill-pattern none and a hex svg:fill paints that hex as text.
 * Boundary svg:fill is not a label color: solid fill paints the region, and fo:color inherited
 * does not fall back to that fill. A dark solid boundary title uses light type.
 * Inherited line/text color on a main or sub topic uses map multi-line-colors in attached order.
 * color-list is preserved on the theme and is not read here.
 * A solid dark topic shape with inherited text uses light type so the label stays readable.
 */
function paintRole(props: Record<string, string>, kind: ThemeKind, branchColor: string | null): TopicPaint {
  const svgFill = parseColor(props["svg:fill"]);
  const textColor = parseColor(props["fo:color"]);
  const patternNone = props["fill-pattern"] === "none";
  const shapeFill = patternNone || !svgFill ? "transparent" : svgFill;
  let text = textColor ?? "";
  if (!text && patternNone && svgFill) text = svgFill;
  if (!text && branchColor && !svgFill) text = branchColor;
  if (!text && shapeFill !== "transparent" && isDark(shapeFill)) text = "#f8fafc";
  if (!text) text = "#18181b";

  const borderColor = parseColor(props["border-line-color"]);
  const borderWidth = parseSize(props["border-line-width"]);
  let border = "transparent";
  let borderPx = 0;
  if (borderColor && borderWidth && borderWidth > 0) {
    border = borderColor;
    borderPx = borderWidth;
  } else if (shapeFill === "transparent") {
    border = "#d4d4d8";
    borderPx = 1;
  }

  const fontWeight = Number(props["fo:font-weight"]);
  return {
    fill: shapeFill,
    text,
    border,
    borderWidth: borderPx,
    fontSize: parseSize(props["fo:font-size"]) ?? FALLBACK_PX[kind],
    fontWeight: Number.isFinite(fontWeight) ? fontWeight : 400,
    radius: radiusFor(props["shape-class"]),
    fontFamily: displayFont(props["fo:font-family"]),
    decoration: props["fo:text-decoration"] === "line-through" ? "line-through" : "none",
    lineColor: parseColor(props["line-color"]) ?? branchColor ?? "#71717a",
    lineWidth: parseSize(props["line-width"]) ?? 1.5,
    lineDash: dashOf(props["line-pattern"]),
    lineClass: lineClassOf(props["line-class"]),
  };
}

function paintLine(props: Record<string, string>, fallback: string): LinePaint {
  const color = parseColor(props["line-color"]) ?? fallback;
  return {
    color,
    width: parseSize(props["line-width"]) ?? 1.5,
    dash: dashOf(props["line-pattern"]),
    text: parseColor(props["fo:color"]) ?? parseColor(props["svg:fill"]) ?? color,
    fontSize: parseSize(props["fo:font-size"]) ?? 12,
    fontFamily: displayFont(props["fo:font-family"]),
    arrow: (props["arrow-end-class"] ?? "").includes("triangle"),
    fill: "none",
  };
}

/**
 * Measured boundary is fill-pattern solid + svg:fill + fo:color inherited.
 * The hex is the region fill. Inherited text does not reuse svg:fill as a label mask.
 * A dark region gets light title type so the boundary title stays readable.
 */
function paintBoundary(props: Record<string, string>, fallback: string): LinePaint {
  const line = paintLine(props, fallback);
  const svgFill = parseColor(props["svg:fill"]);
  const solid = props["fill-pattern"] === "solid" && svgFill != null;
  const fill = solid && svgFill ? svgFill : "none";
  const explicit = parseColor(props["fo:color"]);
  let text = explicit ?? "";
  if (!text && solid && svgFill && isDark(svgFill)) text = "#f8fafc";
  if (!text) text = line.color;
  return { ...line, fill, text };
}

/** A topic with no shape fill sits on the canvas color so a solid boundary behind it does not hide the title. */
export function chipFill(fill: string, canvas: string): string {
  return fill === "transparent" ? canvas : fill;
}

export function quickRoleProperties(theme: Record<string, unknown> | undefined, role: QuickRole): Record<string, string> {
  return roleProps(sourceTheme(theme), role);
}

export function quickStyleKeys(theme: Record<string, unknown> | undefined): string[] {
  const keys = new Set<string>();
  for (const role of QUICK_ROLES) {
    for (const key of Object.keys(quickRoleProperties(theme, role))) keys.add(key);
  }
  return [...keys];
}

export function activeQuickRole(
  theme: Record<string, unknown> | undefined,
  properties: Record<string, string> | undefined,
): QuickRole | null {
  if (!properties) return null;
  for (const role of QUICK_ROLES) {
    const bag = quickRoleProperties(theme, role);
    const keys = Object.keys(bag);
    if (keys.length > 0 && keys.every((key) => properties[key] === bag[key])) return role;
  }
  return null;
}

export function resolveTheme(theme: Record<string, unknown> | undefined): ResolvedTheme {
  const source = sourceTheme(theme);
  // Branch color is multi-line-colors. color-list stays on the file and is not painted.
  const branchColors = colorsOf(roleProps(source, "map")["multi-line-colors"]);
  const canvas = parseColor(roleProps(source, "map")["svg:fill"]) ?? "#f7f4ee";
  return {
    canvas,
    topic(kind, branchIndex, override) {
      const props = merge(roleProps(source, ROLE[kind]), override);
      const branched = kind === "main" || kind === "sub";
      const branch = branched && branchColors.length > 0 ? branchColors[Math.abs(branchIndex) % branchColors.length] ?? null : null;
      return paintRole(props, kind, branch);
    },
    boundary: () => paintBoundary(roleProps(source, "boundary"), "#71717a"),
    summaryLine: () => paintLine(roleProps(source, "summary"), "#52525b"),
    relationship: () => paintLine(roleProps(source, "relationship"), "#3f3f46"),
  };
}
