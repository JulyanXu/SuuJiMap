/** Drawing keys for structureClass values cited on the format map. */
export const STRUCTURES = [
  { id: "org.xmind.ui.map.unbalanced", label: "Map, unbalanced" },
  { id: "org.xmind.ui.map", label: "Map, balanced" },
  { id: "org.xmind.ui.logic.right", label: "Logic, right" },
  { id: "org.xmind.ui.logic.left", label: "Logic, left" },
  { id: "org.xmind.ui.org-chart.down", label: "Org chart, down" },
  { id: "org.xmind.ui.org-chart.up", label: "Org chart, up" },
  { id: "org.xmind.ui.tree.right", label: "Tree, right" },
  { id: "org.xmind.ui.tree.left", label: "Tree, left" },
] as const;

export type StructureId = (typeof STRUCTURES)[number]["id"];

export function resolveStructure(value: string | undefined): StructureId {
  const known = STRUCTURES.find((item) => item.id === value);
  return known ? known.id : "org.xmind.ui.map.unbalanced";
}

/** Imported NeverMind (and empty) render as Inter. Other family names pass through. */
export function displayFont(family: string | undefined): string {
  const stack = '"Inter", "Noto Sans SC", sans-serif';
  if (!family || /nevermind/i.test(family)) return stack;
  return `${family}, ${stack}`;
}

export function themeFont(theme: Record<string, unknown> | undefined): string {
  const central = theme?.centralTopic;
  if (!central || typeof central !== "object") return displayFont(undefined);
  const properties = (central as { properties?: Record<string, string> }).properties;
  return displayFont(properties?.["fo:font-family"]);
}
