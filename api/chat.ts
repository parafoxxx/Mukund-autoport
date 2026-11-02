import { chat } from "../server/chat";

/** POST /api/chat  { message, history } -> { reply, act } */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await chat(await request.json().catch(() => null), ip);
  return Response.json(result.body, { status: result.status });
}
