import Anthropic from "@anthropic-ai/sdk";
import { DECKS, EXHIBITS, ME, STOPS } from "../src/content";
import { EXTRA_FACTS, STYLE } from "../src/persona";

/** Server side of "Talk to Mukund": shared by the Vercel function (api/chat.ts) and the dev server. */

const MODEL = process.env.CHAT_MODEL || "claude-opus-5-5";
// on a policy decline, Anthropic re-runs the request on a suitable model instead of returning a refusal
const FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/.test(MODEL);

export const AI_ACTS = [
  "talk", "pose", "dance", "backflip", "facepalm", "pushups", "box", "conduct", "land", "sneak", "run", "march", "idle",
] as const;

const KNOWLEDGE = [
  `Name: ${ME.name}. Contact: ${ME.links.email.replace("mailto:", "")}. LinkedIn: ${ME.links.linkedin}. GitHub: ${ME.links.github}.`,
  ...EXTRA_FACTS,
  "The ride's chapters, in order (this is his story):",
  ...STOPS.map((s, i) => [
    `${i + 1}. ${s.name}: ${s.title}`,
    ...s.lines,
    ...(s.stats ?? []).map((x) => `${x.n}: ${x.l}`),
    `(His line at this stop: "${s.quip}")`,
  ].join(" ")),
  "Inside Competitions & Hackathons:",
  ...EXHIBITS.map((e) => `${e.name} (${e.kicker}): ${e.blurb} ${e.facts.map((f) => `${f.n}: ${f.l}`).join("; ")}`),
  `Case-competition decks (with teammates): ${DECKS.map((d) => `${d.name}: ${d.brief}`).join("; ")}.`,
].join("\n");

const SYSTEM = `${STYLE}\n\n<knowledge>\n${KNOWLEDGE}\n</knowledge>`;

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "What Mukund says out loud." },
    act: { type: "string", enum: [...AI_ACTS] },
  },
  required: ["reply", "act"],
  additionalProperties: false,
};

let client: Anthropic | null = null;

/** A small per-visitor budget, so a public page can't run up the bill. Best effort: resets when the function cold-starts. */
const seen = new Map<string, number[]>();
function overLimit(ip: string) {
  const now = Date.now(), window = 10 * 60_000;
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < window);
  hits.push(now);
  seen.set(ip, hits);
  return hits.length > 25;
}

type Turn = { role: "user" | "assistant"; text: string };
export type ChatResult = { status: number; body: { reply: string; act: string } | { error: string } };

export async function chat(input: unknown, ip: string): Promise<ChatResult> {
  const body = (input ?? {}) as { message?: unknown; history?: unknown; guest?: unknown };
  const guest = typeof body.guest === "string" ? body.guest.replace(/[^\p{L}\p{M} .'-]/gu, "").slice(0, 24) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 400) : "";
  if (!message) return { status: 400, body: { error: "Say something first." } };
  if (overLimit(ip)) return { status: 429, body: { reply: "Itni baatein? Thoda saans lene do. Interview mein poori kahaani sunaunga.", act: "facepalm" } };

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t): t is Turn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-8);
  // the conversation must open with the visitor and alternate from there
  while (history.length && history[0].role !== "user") history.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.text.slice(0, 600) })),
    // the visitor's name rides along with their message, so the cached system prompt stays the same for everyone
    { role: "user", content: guest ? `(The visitor's name is ${guest}.) ${message}` : message },
  ];

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...(FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      // a quick, chatty reply matters more here than deep reasoning
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") {
      return { status: 200, body: { reply: "Ye wala sawaal main skip karunga. Kuch aur poocho, ride ke baare mein?", act: "facepalm" } };
    }
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as { reply?: unknown; act?: unknown };
    const reply = typeof parsed.reply === "string" ? parsed.reply.slice(0, 500) : "";
    const act = AI_ACTS.includes(parsed.act as (typeof AI_ACTS)[number]) ? (parsed.act as string) : "talk";
    if (!reply) throw new Error("empty reply");
    return { status: 200, body: { reply, act } };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("[chat] ANTHROPIC_API_KEY is missing or invalid");
    else if (err instanceof Anthropic.RateLimitError) console.error("[chat] rate limited by the API");
    else if (err instanceof Anthropic.APIError) console.error(`[chat] API error ${err.status}:`, err.message);
    else console.error("[chat]", err);
    return { status: 502, body: { error: "Mukund is offline right now." } };
  }
}
