import { Check, Circle, Flag, Star, Tag } from "lucide-react";

const PRIORITY: Record<string, string> = {
  "priority-1": "bg-red-600",
  "priority-2": "bg-orange-500",
  "priority-3": "bg-blue-600",
  "priority-4": "bg-zinc-500",
};

function starColor(markerId: string): string {
  if (markerId.includes("yellow")) return "#ca8a04";
  if (markerId.includes("red")) return "#dc2626";
  if (markerId.includes("green")) return "#16a34a";
  if (markerId.includes("blue")) return "#2563eb";
  return "#52525b";
}

export function MarkerGlyph({ markerId }: { markerId: string }) {
  const priority = /^priority-(\d)$/.exec(markerId);
  if (priority) {
    return (
      <span className={`inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${PRIORITY[markerId] ?? "bg-zinc-500"}`}>
        {priority[1]}
      </span>
    );
  }
  if (markerId.startsWith("star")) return <Star className="size-3.5" color={starColor(markerId)} fill={starColor(markerId)} aria-hidden />;
  if (markerId.startsWith("flag")) return <Flag className="size-3.5" color={starColor(markerId)} fill={starColor(markerId)} aria-hidden />;
  if (markerId === "task-done" || markerId.startsWith("task-done")) return <Check className="size-3.5 text-emerald-700" aria-hidden />;
  if (markerId.startsWith("task")) return <Circle className="size-3.5 text-zinc-500" aria-hidden />;
  return <Tag className="size-3.5 text-zinc-500" aria-hidden />;
}
