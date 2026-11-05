import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Angry,
  Annoyed,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpLeft,
  ArrowUpRight,
  Ban,
  ChartColumn,
  ChartLine,
  ChartPie,
  Check,
  CircleAlert,
  CircleHelp,
  Code,
  Coffee,
  Contact,
  Divide,
  Dumbbell,
  Equal,
  Flag,
  Frown,
  Heart,
  Image as ImageIcon,
  Info,
  Laugh,
  Meh,
  Minus,
  Music,
  Pause,
  Pen,
  Phone,
  Pin,
  Plane,
  Plus,
  RefreshCw,
  ShoppingCart,
  Smile,
  Star,
  Tag,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Trophy,
  User,
  X,
  Banknote,
} from "lucide-react";

const PRIORITY = ["bg-red-600", "bg-orange-500", "bg-blue-600", "bg-zinc-500", "bg-sky-700", "bg-teal-700", "bg-violet-700", "bg-zinc-600", "bg-zinc-800"];

const NAMED: Record<string, string> = {
  red: "#dc2626",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#16a34a",
  blue: "#2563eb",
  purple: "#7c3aed",
  gray: "#52525b",
  "dark-blue": "#1e3a8a",
  "dark-green": "#14532d",
  "dark-gray": "#27272a",
};

const TASK_FRACTION: Record<string, number> = {
  "task-start": 0,
  "task-oct": 0.125,
  "task-quarter": 0.25,
  "task-3oct": 0.375,
  "task-half": 0.5,
  "task-5oct": 0.625,
  "task-3quar": 0.75,
  "task-7oct": 0.875,
};

const SMILEY: Record<string, LucideIcon> = {
  "smiley-smile": Smile,
  "smiley-laugh": Laugh,
  "smiley-cry": Frown,
  "smiley-surprise": CircleAlert,
  "smiley-boring": Meh,
  "smiley-angry": Angry,
  "smiley-embarrass": Annoyed,
};

const ARROW: Record<string, LucideIcon> = {
  "arrow-up": ArrowUp,
  "arrow-up-right": ArrowUpRight,
  "arrow-right": ArrowRight,
  "arrow-down-right": ArrowDownRight,
  "arrow-down": ArrowDown,
  "arrow-down-left": ArrowDownLeft,
  "arrow-left": ArrowLeft,
  "arrow-up-left": ArrowUpLeft,
  "arrow-left-right": ArrowLeftRight,
  "arrow-up-down": ArrowUpDown,
  "arrow-refresh": RefreshCw,
};

const SYMBOL: Record<string, LucideIcon> = {
  "symbol-plus": Plus,
  "symbol-minus": Minus,
  "symbol-question": CircleHelp,
  "symbol-info": Info,
  "symbol-attention": TriangleAlert,
  "symbol-wrong": X,
  "symbol-right": Check,
  "symbol-pause": Pause,
  "symbol-no-entry": Ban,
  "symbol-divide": Divide,
  "symbol-equality": Equal,
  "symbol-code": Code,
  "symbol-image": ImageIcon,
  "symbol-pin": Pin,
  "symbol-exclam": CircleAlert,
};

const SIGN: Record<string, LucideIcon> = {
  c_symbol_pen: Pen,
  c_symbol_heart: Heart,
  c_symbol_like: ThumbsUp,
  c_symbol_dislike: ThumbsDown,
  c_symbol_trophy: Trophy,
  c_symbol_medals: Trophy,
  c_symbol_telephone: Phone,
  c_symbol_music: Music,
  c_symbol_money: Banknote,
  c_symbol_shopping_cart: ShoppingCart,
  c_symbol_flight: Plane,
  c_symbol_thermometer: Thermometer,
  c_symbol_contact: Contact,
  c_symbol_exercise: Dumbbell,
  c_symbol_drink: Coffee,
  c_symbol_bar_chart: ChartColumn,
  c_symbol_pie_chart: ChartPie,
  c_symbol_line_graph: ChartLine,
};

function namedColor(markerId: string): string {
  const body = markerId.replace(/^(flag|star|people)-/, "");
  return NAMED[body] ?? "#52525b";
}

function TaskRing({ fraction }: { fraction: number }) {
  const radius = 5;
  const turn = 2 * Math.PI * radius;
  const drawn = Math.max(0, Math.min(1, fraction)) * turn;
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r={radius} fill="none" stroke="#d4d4d8" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="#047857"
        strokeWidth="2"
        strokeDasharray={`${drawn} ${turn}`}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

function Glyph({ icon: Icon, color }: { icon: LucideIcon; color?: string }) {
  return <Icon className="size-3.5" color={color} fill={color} aria-hidden />;
}

/** Lucide stand-in for a markerId. Unknown ids use a generic tag. */
export function MarkerGlyph({ markerId }: { markerId: string }) {
  const priority = /^priority-(\d)$/.exec(markerId);
  let body: ReactNode = <Tag className="size-3.5 text-zinc-500" aria-hidden />;
  if (priority) {
    const index = Number(priority[1]) - 1;
    body = (
      <span className={`inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white ${PRIORITY[index] ?? "bg-zinc-500"}`}>
        {priority[1]}
      </span>
    );
  } else if (markerId === "task-done") {
    body = <Check className="size-3.5 text-emerald-700" aria-hidden />;
  } else if (markerId === "task-pause") {
    body = <Pause className="size-3.5 text-zinc-600" aria-hidden />;
  } else if (markerId in TASK_FRACTION) {
    body = <TaskRing fraction={TASK_FRACTION[markerId] ?? 0} />;
  } else if (markerId.startsWith("star-")) {
    body = <Glyph icon={Star} color={namedColor(markerId)} />;
  } else if (markerId.startsWith("flag-")) {
    body = <Glyph icon={Flag} color={namedColor(markerId)} />;
  } else if (markerId.startsWith("people-")) {
    body = <User className="size-3.5" color={namedColor(markerId)} aria-hidden />;
  } else if (SMILEY[markerId]) {
    const Icon = SMILEY[markerId];
    body = <Icon className="size-3.5 text-zinc-700" aria-hidden />;
  } else if (ARROW[markerId]) {
    const Icon = ARROW[markerId];
    body = <Icon className="size-3.5 text-zinc-700" aria-hidden />;
  } else if (SYMBOL[markerId]) {
    const Icon = SYMBOL[markerId];
    body = <Icon className="size-3.5 text-zinc-700" aria-hidden />;
  } else if (SIGN[markerId]) {
    const Icon = SIGN[markerId];
    body = <Icon className="size-3.5 text-zinc-700" aria-hidden />;
  } else if (markerId.startsWith("month-") || markerId.startsWith("week-")) {
    const token = markerId.split("-")[1] ?? "";
    body = <span className="text-[8px] font-semibold uppercase leading-none tracking-tight text-zinc-700">{token.slice(0, 3)}</span>;
  }

  return (
    <span data-marker-id={markerId} className="inline-flex size-4 shrink-0 items-center justify-center">
      {body}
    </span>
  );
}
