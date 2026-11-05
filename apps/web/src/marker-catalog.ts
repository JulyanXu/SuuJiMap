export const MARKER_CHOICES = [
  "priority-1",
  "priority-2",
  "priority-3",
  "priority-4",
  "task-done",
  "star-blue",
  "star-yellow",
  "flag-red",
  "flag-green",
] as const;

export function markerLabel(markerId: string): string {
  if (markerId.startsWith("priority-")) return `Priority ${markerId.slice("priority-".length)}`;
  if (markerId === "task-done") return "Task done";
  if (markerId.startsWith("star-")) return `Star ${markerId.slice("star-".length)}`;
  if (markerId.startsWith("flag-")) return `Flag ${markerId.slice("flag-".length)}`;
  return markerId;
}
