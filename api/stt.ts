import { stt, sttConfigured } from "../server/stt";

/** GET /api/stt -> { configured } : is server-side transcription available? */
export function GET() {
  return Response.json({ configured: sttConfigured() });
}

/** POST /api/stt  (raw audio body) -> { text } */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await stt(await request.arrayBuffer(), request.headers.get("content-type") ?? "", ip);
  return Response.json(result.body, { status: result.status });
}
