/** All sound is synthesised: a two-stroke engine putt, the horn, bumps and the stop bell. */
import { sim } from "./store";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engine: { osc: OscillatorNode; lfo: OscillatorNode; lfoGain: GainNode; filter: BiquadFilterNode; out: GainNode } | null = null;
let muted = false;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** The shared audio graph, for the background score (music.ts). */
export function audioGraph() {
  const a = audio();
  return { ctx: a, out: master! };
}

/** True while Mukund is speaking (a recorded line, an AI reply, or the browser reading one out). */
export const speaking = () => (!!voiceEl && !voiceEl.paused) || ("speechSynthesis" in window && speechSynthesis.speaking);

/** Is sound actually playing? (browsers hold it back until the visitor clicks or presses a key) */
export const audioRunning = () => ctx?.state === "running";
/** Call from a click or key press: creates or resumes the audio, which browsers only allow then. */
export function wakeAudio() { audio(); }

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
}

export function startEngine() {
  const a = audio();
  if (engine || !master) return;
  const osc = a.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 42;
  const filter = a.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 380; filter.Q.value = 4;
  const body = a.createGain(); body.gain.value = 0.5;
  // amplitude "putt putt": an LFO modulating the gain
  const lfo = a.createOscillator(); lfo.type = "square"; lfo.frequency.value = 9;
  const lfoGain = a.createGain(); lfoGain.gain.value = 0.4;
  lfo.connect(lfoGain).connect(body.gain);
  const out = a.createGain(); out.gain.value = 0.1;
  osc.connect(filter).connect(body).connect(out).connect(master);
  osc.start(); lfo.start();
  engine = { osc, lfo, lfoGain, filter, out };
}

/** rev: 0 idle .. 1 flat out. */
export function setEngine(rev: number) {
  if (!engine || !ctx) return;
  const t = ctx.currentTime;
  engine.osc.frequency.setTargetAtTime(42 + rev * 58, t, 0.08);
  engine.lfo.frequency.setTargetAtTime(9 + rev * 17, t, 0.08);
  engine.filter.frequency.setTargetAtTime(380 + rev * 900, t, 0.1);
  engine.out.gain.setTargetAtTime((0.08 + rev * 0.09) * (voiceEl ? 0.3 : 1), t, 0.1); // duck under the voice
}

/* ---------- Mukund's recorded voice, one clip per chapter: public/voice/<stop id>.(mp3|m4a|wav|webm) ---------- */
const VOICE_EXT = ["mp3", "m4a", "wav", "webm"];
const voices = new Map<string, { url: string; dur: number }>();
let voiceEl: HTMLAudioElement | null = null;
let voiceAn: AnalyserNode | null = null;
let voiceBuf = new Uint8Array(0);

/** Finds which chapter clips exist and how long they are. Missing files are simply skipped. */
export async function probeVoices(ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    for (const ext of VOICE_EXT) {
      const url = `/voice/${id}.${ext}`;
      try {
        const r = await fetch(url, { method: "HEAD" });
        // dev servers answer missing files with index.html, so check it really is audio
        if (!r.ok || !/audio|video\/webm|ogg/.test(r.headers.get("content-type") ?? "")) continue;
        if (await addVoice(id, url)) return;
      } catch { /* offline or blocked: try the next format */ }
    }
  }));
}

/** Registers a clip under an id once its length is known (recorded lines, and his AI replies). */
async function addVoice(id: string, url: string) {
  const el = new Audio();
  el.preload = "metadata";
  await new Promise<void>((res) => { el.onloadedmetadata = () => res(); el.onerror = () => res(); el.src = url; });
  if (el.duration === Infinity) {
    // browser recordings often lack a length header: seeking to the end makes the browser work it out
    await new Promise<void>((res) => { el.ondurationchange = () => { if (Number.isFinite(el.duration)) res(); }; el.currentTime = 1e9; setTimeout(res, 3000); });
  }
  if (!Number.isFinite(el.duration) || el.duration <= 0) return false;
  voices.set(id, { url, dur: el.duration });
  return true;
}

export const voiceDuration = (id: string) => voices.get(id)?.dur ?? 0;

/** Debug view of playback, for the dev harness. */
export const voiceState = () => (voiceEl ? { t: Math.round(voiceEl.currentTime * 10) / 10, paused: voiceEl.paused } : null);

export function playVoice(id: string) {
  stopVoice();
  const v = voices.get(id);
  if (!v) return;
  const a = audio();
  if (!master) return;
  const el = new Audio(v.url);
  const an = a.createAnalyser();
  an.fftSize = 512;
  a.createMediaElementSource(el).connect(an);
  an.connect(master);
  voiceEl = el; voiceAn = an; voiceBuf = new Uint8Array(an.fftSize);
  el.onended = () => { if (voiceEl === el) stopVoice(); };
  el.play().catch(() => stopVoice());
}

export function stopVoice() {
  voiceEl?.pause();
  voiceEl = null; voiceAn = null;
}

/** 0..1 loudness of the voice right now, for lip sync. */
export function voiceLevel() {
  if (!voiceAn || !voiceEl || voiceEl.paused) return 0;
  voiceAn.getByteTimeDomainData(voiceBuf);
  let s = 0;
  for (let i = 0; i < voiceBuf.length; i++) { const v = (voiceBuf[i] - 128) / 128; s += v * v; }
  return Math.min(1, Math.max(0, (Math.sqrt(s / voiceBuf.length) - 0.015) * 7));
}

function tone(f: number, start: number, dur: number, type: OscillatorType, vol: number, to?: number) {
  const a = audio(); if (!master) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master); o.start(start); o.stop(start + dur + 0.05);
}

export function horn() {
  sim.honks++;
  const t = audio().currentTime;
  // the classic double "pom pom"
  for (const k of [0, 0.22]) { tone(392, t + k, 0.18, "square", 0.12); tone(494, t + k, 0.18, "square", 0.08); }
}

export function bump() {
  const t = audio().currentTime;
  tone(110, t, 0.25, "sine", 0.5, 40);
}

export function bonk() {
  const t = audio().currentTime;
  tone(180, t, 0.15, "triangle", 0.3, 70);
}

/** One syllable of cartoon babble, played as speech-bubble letters type out. */
export function babble() {
  const t = audio().currentTime, f = 190 + Math.random() * 150;
  tone(f, t, 0.055, "triangle", 0.045, f * 0.82);
}

export function bell() {
  const t = audio().currentTime;
  tone(1318, t, 0.9, "sine", 0.18); tone(1975, t + 0.02, 0.7, "sine", 0.08);
}

export function fanfare() {
  const t = audio().currentTime;
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.1, 0.45, "triangle", 0.14));
}

/* ---------- the toys ---------- */

function burst(start: number, dur: number, freq: number, q: number, vol: number) {
  const a = audio(); if (!master) return;
  const len = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  src.connect(f).connect(g).connect(master); src.start(start);
}

/** A clay pot shattering. */
export function smash() {
  const t = audio().currentTime;
  burst(t, 0.35, 1800, 0.8, 0.9);
  tone(240 + Math.random() * 80, t, 0.12, "triangle", 0.12, 120);
  for (let k = 0; k < 3; k++) tone(2200 + Math.random() * 1800, t + 0.03 + k * 0.035, 0.05, "sine", 0.04);
}

/** A cone or crate knocked flying. */
export function clack() {
  const t = audio().currentTime;
  burst(t, 0.12, 900, 1.2, 0.5);
  tone(160 + Math.random() * 60, t, 0.1, "square", 0.05, 90);
}

let combo = 0, comboAt = 0;
/** Coin pickup: quick runs climb the scale. */
export function coin() {
  const a = audio(), t = a.currentTime;
  combo = t - comboAt < 0.9 ? Math.min(combo + 1, 12) : 0; comboAt = t;
  const f = 880 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][combo] / 12);
  tone(f, t, 0.08, "square", 0.05); tone(f * 1.5, t + 0.06, 0.16, "sine", 0.07);
}

/** Off the ramp. */
export function whoosh() {
  const a = audio(); if (!master) return;
  const t = a.currentTime, len = a.sampleRate * 0.6, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = "bandpass"; f.Q.value = 1.5;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(f).connect(g).connect(master); src.start(t);
}

/** Achievement unlocked. */
export function chime() {
  const t = audio().currentTime;
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.5, "triangle", 0.09));
}
