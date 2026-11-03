/**
 * "Say it, see it": one sentence, spoken, turned into text. Records until you pause (or 12 s), then transcribes it
 * on the server (api/stt, Sarvam). Without a server key, the browser's own speech recognition does it instead.
 */
import { ui } from "./store";
import { toggleVoiceDrive } from "./voiceDrive";

export type DictateState = "idle" | "listening" | "thinking";
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};
const Ctor = (() => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
})();
export const dictateSupported = typeof MediaRecorder !== "undefined" || Boolean(Ctor);

let stopNow: (() => void) | null = null;
/** Ends the recording early (the button, tapped again). */
export const stopDictation = () => stopNow?.();

/** Listens for one sentence. Resolves with the text and how long you spoke, or null if nothing was heard. */
export async function dictate(onState: (s: DictateState) => void, onLevel: (v: number) => void): Promise<{ text: string; seconds: number } | null> {
  if (ui.get().voiceDrive) toggleVoiceDrive(); // one mic at a time
  let server = typeof MediaRecorder !== "undefined";
  if (server) {
    try { server = Boolean(((await (await fetch("/api/stt")).json()) as { configured?: boolean }).configured); } catch { server = false; }
  }
  return server ? viaServer(onState, onLevel) : viaBrowser(onState);
}

async function viaServer(onState: (s: DictateState) => void, onLevel: (v: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  onState("listening");
  const t0 = performance.now();
  let spokeAt = 0, firstWord = 0, floor = 0.01;
  const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  rec.start();
  const timer = window.setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length), now = performance.now();
    onLevel(Math.min(1, rms * 12));
    const loud = rms > Math.max(0.02, floor * 3);
    if (!loud) floor = floor * 0.98 + rms * 0.02;
    if (loud) { spokeAt = now; if (!firstWord) firstWord = now; }
    // stop after a 1.2 s pause once you've started, after 6 s of silence, or at 12 s
    if ((firstWord && now - spokeAt > 1200) || (!firstWord && now - t0 > 6000) || now - t0 > 12000) stop();
  }, 50);
  const stop = () => { if (rec.state === "recording") rec.stop(); };
  stopNow = stop;
  await done;
  window.clearInterval(timer); stopNow = null; onLevel(0);
  stream.getTracks().forEach((t) => t.stop()); ctx.close();
  if (!firstWord) { onState("idle"); return null; }
  onState("thinking");
  const seconds = Math.max(0.5, (spokeAt - firstWord) / 1000);
  try {
    const blob = new Blob(chunks, { type: rec.mimeType });
    const r = await fetch("/api/stt", { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
    const { text } = (await r.json()) as { text?: string };
    onState("idle");
    return text?.trim() ? { text: text.trim(), seconds } : null;
  } catch { onState("idle"); return null; }
}

function viaBrowser(onState: (s: DictateState) => void) {
  return new Promise<{ text: string; seconds: number } | null>((resolve) => {
    if (!Ctor) return resolve(null);
    const r = new Ctor();
    r.lang = "en-IN"; r.continuous = false; r.interimResults = false;
    const t0 = performance.now();
    let text = "";
    r.onresult = (e) => { text = Array.from(e.results).map((x) => x[0].transcript).join(" "); };
    r.onerror = () => {};
    r.onend = () => { stopNow = null; onState("idle"); resolve(text.trim() ? { text: text.trim(), seconds: Math.max(0.5, (performance.now() - t0) / 1000 - 0.8) } : null); };
    stopNow = () => r.stop();
    onState("listening");
    try { r.start(); } catch { resolve(null); }
  });
}
