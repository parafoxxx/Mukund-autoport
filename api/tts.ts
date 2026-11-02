import { tts } from "../server/tts";

/** POST /api/tts  { text } -> audio/mpeg in the cloned voice (501 when none is configured) */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await tts(await request.json().catch(() => null), ip);
  if (!result.audio) return Response.json({ error: result.error }, { status: result.status });
  return new Response(result.audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
