/**
 * The portfolio as a growth experiment: anonymous totals of visits, rides, finishes and shared tickets (api/count).
 * Each browser counts once per event; the rider number is remembered so the ticket keeps it.
 */
export type Counts = { visit: number; ride: number; finish: number; share: number };
type Event = keyof Counts;

const KEY = "mukund-auto-counted";
const counted: Partial<Record<Event, number>> = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(counted)); } catch { /* storage blocked */ } };

let latest: Counts | null = null;
const subs = new Set<(c: Counts) => void>();
const publish = (c: Counts) => { latest = c; subs.forEach((f) => f(c)); };

/** Counts an event once per browser (a share counts every time), and returns the totals. */
export async function track(event: Event) {
  if (event !== "share" && counted[event]) return refresh();
  try {
    const r = await fetch("/api/count", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event }) });
    if (!r.ok) return null;
    const c = (await r.json()) as Counts;
    if (event !== "share") { counted[event] = c[event]; save(); } // your number: rider #c.ride
    publish(c);
    return c;
  } catch { return null; }
}

export async function refresh() {
  try {
    const r = await fetch("/api/count");
    if (!r.ok) return null;
    const c = (await r.json()) as Counts;
    publish(c);
    return c;
  } catch { return null; }
}

/** This browser's rider number, once it has started a ride. */
export const riderNumber = () => counted.ride ?? null;
export const lastCounts = () => latest;
export function onCounts(f: (c: Counts) => void) { subs.add(f); return () => { subs.delete(f); }; }
