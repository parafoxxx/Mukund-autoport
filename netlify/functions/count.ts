import { getStore } from "@netlify/blobs";
import { count, type CountStore } from "../../server/count";

/**
 * /api/count on Netlify, kept in Netlify Blobs.
 * GET -> the totals. POST { event: "visit" | "ride" | "finish" | "share" } -> counts it, then the totals.
 */
export default async (request: Request) => {
  const blobs = getStore("portfolio-counts");
  const store: CountStore = {
    get: async (k) => Number((await blobs.get(k)) ?? 0) || 0,
    set: async (k, n) => { await blobs.set(k, String(n)); },
  };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const event = request.method === "POST" ? ((await request.json().catch(() => ({}))) as { event?: unknown }).event : undefined;
  const result = await count(store, event, ip);
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
};
export const config = { path: "/api/count" };
