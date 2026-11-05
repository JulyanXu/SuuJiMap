/**
 * Open marker ids from the public SDK catalog and the open markerref list.
 * The picker writes these strings. Any other markerId still round-trips and
 * draws with a generic glyph.
 */

export interface MarkerGroup {
  id: string;
  label: string;
  ids: readonly string[];
}

const priority = Array.from({ length: 9 }, (_, index) => `priority-${index + 1}`);
const task = [
  "task-start",
  "task-oct",
  "task-quarter",
  "task-3oct",
  "task-half",
  "task-5oct",
  "task-3quar",
  "task-7oct",
  "task-done",
  "task-pause",
];
const flag = ["red", "orange", "yellow", "dark-blue", "purple", "green", "blue", "gray", "dark-green", "dark-gray"].map(
  (name) => `flag-${name}`,
);
const star = ["red", "orange", "dark-blue", "purple", "green", "blue", "gray", "yellow", "dark-green", "dark-gray"].map(
  (name) => `star-${name}`,
);
const people = ["red", "orange", "yellow", "dark-blue", "purple", "green", "blue", "gray", "dark-green", "dark-gray"].map(
  (name) => `people-${name}`,
);
const smiley = ["laugh", "smile", "cry", "surprise", "boring", "angry", "embarrass"].map((name) => `smiley-${name}`);
const arrow = ["left", "right", "up", "down", "left-right", "up-down", "refresh", "up-right", "down-right", "down-left", "up-left"].map(
  (name) => `arrow-${name}`,
);
const symbol = [
  "question",
  "attention",
  "wrong",
  "pause",
  "no-entry",
  "plus",
  "minus",
  "info",
  "divide",
  "equality",
  "right",
  "code",
  "image",
  "pin",
  "exclam",
].map((name) => `symbol-${name}`);
const signs = [
  "pen",
  "heart",
  "like",
  "dislike",
  "trophy",
  "medals",
  "telephone",
  "music",
  "money",
  "shopping_cart",
  "flight",
  "thermometer",
  "contact",
  "exercise",
  "drink",
  "bar_chart",
  "pie_chart",
  "line_graph",
].map((name) => `c_symbol_${name}`);
const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map((name) => `month-${name}`);
const week = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((name) => `week-${name}`);

export const MARKER_GROUPS: readonly MarkerGroup[] = [
  { id: "priority", label: "Priority", ids: priority },
  { id: "task", label: "Task", ids: task },
  { id: "flag", label: "Flag", ids: flag },
  { id: "star", label: "Star", ids: star },
  { id: "people", label: "People", ids: people },
  { id: "smiley", label: "Smiley", ids: smiley },
  { id: "arrow", label: "Arrow", ids: arrow },
  { id: "symbol", label: "Symbol", ids: symbol },
  { id: "sign", label: "Sign", ids: signs },
  { id: "month", label: "Month", ids: month },
  { id: "week", label: "Week", ids: week },
];

export const MARKER_CHOICES: readonly string[] = MARKER_GROUPS.flatMap((group) => group.ids);

const KNOWN = new Set(MARKER_CHOICES);

export function isKnownMarker(markerId: string): boolean {
  return KNOWN.has(markerId);
}

const TASK_LABEL: Record<string, string> = {
  "task-start": "Task start",
  "task-oct": "Task one eighth",
  "task-quarter": "Task quarter",
  "task-3oct": "Task three eighths",
  "task-half": "Task half",
  "task-5oct": "Task five eighths",
  "task-3quar": "Task three quarters",
  "task-7oct": "Task seven eighths",
  "task-done": "Task done",
  "task-pause": "Task pause",
};

const SIGN_LABEL: Record<string, string> = {
  c_symbol_pen: "Pen",
  c_symbol_heart: "Heart",
  c_symbol_like: "Like",
  c_symbol_dislike: "Dislike",
  c_symbol_trophy: "Trophy",
  c_symbol_medals: "Medals",
  c_symbol_telephone: "Telephone",
  c_symbol_music: "Music",
  c_symbol_money: "Money",
  c_symbol_shopping_cart: "Shopping cart",
  c_symbol_flight: "Flight",
  c_symbol_thermometer: "Thermometer",
  c_symbol_contact: "Contact",
  c_symbol_exercise: "Exercise",
  c_symbol_drink: "Drink",
  c_symbol_bar_chart: "Bar chart",
  c_symbol_pie_chart: "Pie chart",
  c_symbol_line_graph: "Line graph",
};

export function markerLabel(markerId: string): string {
  if (TASK_LABEL[markerId]) return TASK_LABEL[markerId];
  if (SIGN_LABEL[markerId]) return SIGN_LABEL[markerId];
  const match = /^(priority|star|flag|people|smiley|arrow|symbol|month|week)-(.+)$/.exec(markerId);
  if (!match?.[1] || !match[2]) return markerId;
  const kind = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const rest = match[2].replace(/-/g, " ");
  const shown = match[1] === "month" || match[1] === "week" ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
  return `${kind} ${shown}`;
}
