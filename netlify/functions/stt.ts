import { stt, sttConfigured } from "../../server/stt";

/**
 * /api/stt on Netlify.
 * GET  -> { configured } : is server-side transcription available?
 * POST (raw audio body) -> { text }
 */
export default async (request: Request) => {
  if (request.method === "GET") return Response.json({ configured: sttConfigured() });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await stt(await request.arrayBuffer(), request.headers.get("content-type") ?? "", ip);
  return Response.json(result.body, { status: result.status });
};
export const config = { path: "/api/stt" };
