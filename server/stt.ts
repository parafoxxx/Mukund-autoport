/**
 * Speech to text for voice driving. Sarvam AI (Saaras, built for Indian languages and Hinglish) when SARVAM_API_KEY
 * is set; otherwise ElevenLabs Scribe with ELEVENLABS_API_KEY. With neither, it answers 501 and the site
 * falls back to the browser's own speech recognition.
 */
import { STOPS } from "../src/content";

const seen = new Map<string, number[]>();
function overLimit(ip: string) {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  seen.set(ip, hits);
  return hits.length > 240; // short phrases come thick and fast while driving
}

// words we want Sarvam to catch: the driving commands and the chapter names
const KEYTERMS = [
  "move", "faster", "slowly", "stop", "back", "horn", "chalo", "tez", "dheere", "ruko", "left", "right", "peeche", "pom pom", "le chalo", "Mukund",
  ...STOPS.map((s) => s.name),
].slice(0, 50);

export type SttResult = { status: number; body: { text: string } | { error: string } };

export async function stt(audio: ArrayBuffer, type: string, ip: string): Promise<SttResult> {
  const sarvam = process.env.SARVAM_API_KEY, eleven = process.env.ELEVENLABS_API_KEY;
  if (!sarvam && !eleven) return { status: 501, body: { error: "No speech-to-text configured." } };
  if (!audio.byteLength || audio.byteLength > 1_500_000) return { status: 400, body: { error: "Send one short phrase." } };
  if (overLimit(ip)) return { status: 429, body: { error: "Too many requests." } };
  // Sarvam checks the bare type: "audio/webm;codecs=opus" is refused, "audio/webm" is not
  const mime = (type.split(";")[0] || "audio/webm").trim();
  const ext = mime.includes("wav") ? "wav" : mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("mpeg") ? "mp3" : "webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mime }), `phrase.${ext}`);
  let r: Response;
  if (sarvam) {
    form.append("model", process.env.SARVAM_STT_MODEL || "saaras:v4");
    // en-IN keeps Hinglish in Roman letters ("chalo", not "चलो"); SARVAM_STT_LANGUAGE=unknown auto-detects instead
    form.append("language_code", process.env.SARVAM_STT_LANGUAGE || "en-IN");
    form.append("keyterms", JSON.stringify(KEYTERMS));
    r = await fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": sarvam }, body: form });
  } else {
    form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
    // the commands are English words: say so, rather than let it guess (and answer in Devanagari)
    form.append("language_code", process.env.ELEVENLABS_STT_LANGUAGE || "en");
    r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": eleven! }, body: form });
  }
  if (!r.ok) {
    console.error(`[stt] ${sarvam ? "Sarvam" : "ElevenLabs"} error`, r.status, (await r.text()).slice(0, 900));
    return { status: 502, body: { error: "Speech service failed." } };
  }
  const data = (await r.json()) as { transcript?: string; text?: string };
  return { status: 200, body: { text: (data.transcript ?? data.text ?? "").trim() } };
}

/** Lets the page ask whether a speech key is set, without sending audio. */
export const sttConfigured = () => Boolean(process.env.SARVAM_API_KEY || process.env.ELEVENLABS_API_KEY);
