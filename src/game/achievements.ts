import { ui } from "./store";
import { chime } from "./sound";

/** Little goals that reward poking around. Unlocked ones survive a reload (this browser only). */
export const BADGES = [
  { id: "matka", title: "Pehla Matka", sub: "Broke your first matka. Kumhar uncle is not happy." },
  { id: "matka25", title: "Matka Massacre", sub: "25 matkas down." },
  { id: "coins", title: "Chillar Collector", sub: "Picked up 40 coins off the road." },
  { id: "air", title: "Udta Auto", sub: "A full second of air time." },
  { id: "jumps", title: "Frequent Flyer", sub: "Five ramp jumps." },
  { id: "cow", title: "Gau Mata Ki Jai", sub: "Honked at a grazing cow. She mooed back." },
  { id: "speed", title: "Tez Raftaar", sub: "Hit 70 km/h in a three-wheeler." },
  { id: "cones", title: "Slalom Champ", sub: "Sent 15 cones flying." },
  { id: "tricks", title: "Showman", sub: "Five tricks on foot." },
  { id: "talk", title: "Baatcheet", sub: "Had a conversation with Mukund." },
  { id: "half", title: "Interval", sub: "Six chapters in. Samosa break?" },
  { id: "all", title: "Poori Picture", sub: "Every chapter of the story." },
] as const;
export type BadgeId = (typeof BADGES)[number]["id"];

const KEY = "mukund-auto-badges";
function load(): string[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } }
function save(b: string[]) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* storage blocked */ } }

ui.set({ badges: load() });

export function unlock(id: BadgeId) {
  const have = ui.get().badges;
  if (have.includes(id)) return;
  const next = [...have, id];
  save(next);
  const b = BADGES.find((x) => x.id === id)!;
  ui.set({ badges: next, toast: { title: b.title, sub: b.sub, n: ui.get().toast.n + 1 } });
  chime();
}

/** Running tallies behind the counting badges. */
export const tally = { matkas: 0, cones: 0, coins: 0, jumps: 0, tricks: 0 };

export function count(k: keyof typeof tally) {
  const n = ++tally[k];
  if (k === "matkas") { ui.set({ smashed: ui.get().smashed + 1 }); if (n === 1) unlock("matka"); if (n === 25) unlock("matka25"); }
  if (k === "cones") { ui.set({ smashed: ui.get().smashed + 1 }); if (n === 15) unlock("cones"); }
  if (k === "coins") { ui.set({ coins: ui.get().coins + 1 }); if (n === 40) unlock("coins"); }
  if (k === "jumps" && n === 5) unlock("jumps");
  if (k === "tricks" && n === 5) unlock("tricks");
}
