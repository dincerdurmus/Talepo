/**
 * Semantic icon well tones for Signal Rail / dock nav.
 * Labels stay neutral frost; only icon wells carry color.
 */

export type SignalNavIconTone =
  | "home"
  | "sayfam"
  | "explore"
  | "my-requests"
  | "incoming"
  | "outgoing"
  | "opportunities"
  | "follows"
  | "analytics"
  | "plan"
  | "messages"
  | "profile"
  | "inventory"
  | "team"
  | "default";

type ToneClasses = {
  idle: string;
  active: string;
};

const TONE_CLASSES: Record<SignalNavIconTone, ToneClasses> = {
  home: {
    idle: "border-[#3C8C7A]/30 bg-[#3C8C7A]/14 text-[#7dceb8]",
    active: "border-[#3C8C7A]/48 bg-[#3C8C7A]/28 text-[#d2f3e8]",
  },
  sayfam: {
    idle: "border-[#4B78A8]/30 bg-[#4B78A8]/15 text-[#9cbcde]",
    active: "border-[#4B78A8]/48 bg-[#4B78A8]/30 text-[#d9e8f7]",
  },
  explore: {
    idle: "border-[#2C8F85]/28 bg-[#2C8F85]/14 text-[#7ad4c8]",
    active: "border-[#2C8F85]/45 bg-[#2C8F85]/28 text-[#c6f3ec]",
  },
  "my-requests": {
    idle: "border-[#436A9A]/30 bg-[#436A9A]/16 text-[#9cbcde]",
    active: "border-[#436A9A]/48 bg-[#436A9A]/30 text-[#d7e7f7]",
  },
  incoming: {
    idle: "border-[#28786B]/28 bg-[#28786B]/14 text-[#6dcfbf]",
    active: "border-[#28786B]/45 bg-[#28786B]/28 text-[#c8f2e9]",
  },
  outgoing: {
    idle: "border-[#655B87]/30 bg-[#655B87]/16 text-[#b5a9d8]",
    active: "border-[#655B87]/48 bg-[#655B87]/30 text-[#e4ddf5]",
  },
  opportunities: {
    idle: "border-[#A85B68]/32 bg-[#A85B68]/16 text-[#e0a8b0]",
    active: "border-[#A85B68]/50 bg-[#A85B68]/30 text-[#f6d8dc]",
  },
  follows: {
    idle: "border-[#6671B8]/32 bg-[#6671B8]/16 text-[#b0b7e8]",
    active: "border-[#6671B8]/50 bg-[#6671B8]/30 text-[#dde0f8]",
  },
  analytics: {
    idle: "border-[#7564A5]/30 bg-[#7564A5]/16 text-[#b9aad8]",
    active: "border-[#7564A5]/48 bg-[#7564A5]/30 text-[#e4ddf4]",
  },
  plan: {
    idle: "border-amber-300/28 bg-amber-400/12 text-amber-100/88",
    active: "border-amber-300/45 bg-amber-400/26 text-amber-50",
  },
  messages: {
    idle: "border-sky-300/28 bg-sky-400/12 text-sky-100/88",
    active: "border-sky-300/42 bg-sky-400/24 text-sky-50",
  },
  profile: {
    idle: "border-white/20 bg-white/12 text-white/80",
    active: "border-teal-300/35 bg-teal-400/22 text-white",
  },
  inventory: {
    idle: "border-emerald-300/28 bg-emerald-400/12 text-emerald-100/88",
    active: "border-emerald-300/42 bg-emerald-400/24 text-emerald-50",
  },
  team: {
    idle: "border-cyan-300/28 bg-cyan-400/12 text-cyan-100/88",
    active: "border-cyan-300/42 bg-cyan-400/24 text-cyan-50",
  },
  default: {
    idle: "border-white/20 bg-white/12 text-white/78",
    active: "border-teal-400/30 bg-teal-400/20 text-white",
  },
};

export function signalNavIconToneForHref(href: string): SignalNavIconTone {
  const path = href.split("?")[0] ?? href;
  if (path === "/") return "home";
  if (path === "/panel") return "sayfam";
  if (path === "/panel/talepler") return "explore";
  if (path === "/panel/taleplerim") return "my-requests";
  if (path === "/panel/gelen-teklifler") return "incoming";
  if (path === "/panel/teklifler") return "outgoing";
  if (path === "/panel/firsatlar") return "opportunities";
  if (path === "/panel/takiplerim") return "follows";
  if (path === "/panel/analiz") return "analytics";
  if (path === "/panel/plan") return "plan";
  if (path === "/panel/mesajlar") return "messages";
  if (path === "/panel/profil") return "profile";
  if (path === "/panel/envanter") return "inventory";
  if (path === "/panel/ekip") return "team";
  return "default";
}

export function signalNavIconWellClass(
  tone: SignalNavIconTone,
  active: boolean,
): string {
  const classes = TONE_CLASSES[tone] ?? TONE_CLASSES.default;
  return active ? classes.active : classes.idle;
}
