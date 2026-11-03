/**
 * The portfolio's own growth numbers: visits, rides started, rides finished, tickets shared.
 * Anonymous totals only, nothing about who. Shared by the Netlify function (Netlify Blobs) and the dev server (memory).
 */
export const EVENTS = ["visit", "ride", "finish", "share"] as const;
export type CountEvent = (typeof EVENTS)[number];
export type Counts = Record<CountEvent, number>;

export interface CountStore {
  get(key: CountEvent): Promise<number>;
  set(key: CountEvent, n: number): Promise<void>;
}

// one of each event per visitor per 10 minutes, so a refresh loop can't pump the numbers
const seen = new Map<string, number>();
function repeat(ip: string, event: CountEvent) {
  const key = `${ip}:${event}`, now = Date.now(), last = seen.get(key) ?? 0;
  seen.set(key, now);
  if (seen.size > 5000) seen.clear();
  return now - last < 10 * 60_000;
}

async function all(store: CountStore): Promise<Counts> {
  const values = await Promise.all(EVENTS.map((e) => store.get(e)));
  return Object.fromEntries(EVENTS.map((e, k) => [e, values[k]])) as Counts;
}

/** No event: just the totals. An event: count it (once per visitor per 10 min), then the totals. */
export async function count(store: CountStore, event: unknown, ip: string): Promise<{ status: number; body: Counts | { error: string } }> {
  try {
    if (event !== undefined && event !== null) {
      if (!EVENTS.includes(event as CountEvent)) return { status: 400, body: { error: "Unknown event." } };
      const e = event as CountEvent;
      if (!repeat(ip, e)) await store.set(e, (await store.get(e)) + 1);
    }
    return { status: 200, body: await all(store) };
  } catch (err) {
    console.error("[count]", err);
    return { status: 500, body: { error: "Counter unavailable." } };
  }
}

/** For local dev: totals that last until the dev server restarts. */
export function memoryStore(): CountStore {
  const m = new Map<CountEvent, number>();
  return { get: async (k) => m.get(k) ?? 0, set: async (k, n) => { m.set(k, n); } };
}
