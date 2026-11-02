/**
 * Mukund's cloned voice, via ElevenLabs. Optional: without ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID
 * this answers 501 and the browser reads replies out in its own voice instead.
 */

const seen = new Map<string, number[]>();
function overLimit(ip: string) {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  seen.set(ip, hits);
  return hits.length > 25;
}

export type TtsResult = { status: number; audio?: ArrayBuffer; error?: string };

export async function tts(input: unknown, ip: string): Promise<TtsResult> {
  const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return { status: 501, error: "No cloned voice configured." };
  const text = typeof (input as { text?: unknown })?.text === "string" ? (input as { text: string }).text.trim().slice(0, 500) : "";
  if (!text) return { status: 400, error: "Nothing to say." };
  if (overLimit(ip)) return { status: 429, error: "Too many requests." };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5" }),
  });
  if (!r.ok) {
    console.error("[tts] ElevenLabs error", r.status, (await r.text()).slice(0, 300));
    return { status: 502, error: "Voice service failed." };
  }
  return { status: 200, audio: await r.arrayBuffer() };
}
