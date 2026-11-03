/**
 * Drive by voice: an always-on mic that turns spoken words into driving, word by word as you say them.
 * In plain English, so any speech service gets it right: "move" to go, "faster", "slowly", "stop", "left" / "right",
 * "back", "horn". The Hindi words ("chalo", "tez", "dheere", "ruko", "peeche", "pom pom") still work too.
 * "Chill Hai le chalo" to head to a chapter, and anything you ask Mukund goes to him.
 *
 * Two ears. First choice: record each phrase and transcribe it on the server (api/stt, Sarvam AI), which
 * understands Hinglish far better and works in every browser. If the server has no speech key, the browser's
 * own speech recognition (Chrome, Edge, Safari) takes over.
 */
import { STOPS } from "../content";
import { sim, ui } from "./store";
import { horn } from "./sound";
import { closeStop, startExpress } from "./Director";
import { board } from "./Player";
import { parse } from "./voice";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecCtor = new () => Rec;
const Ctor: RecCtor | null = (() => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
})();
// Brave ships the API but blocks the service behind it, so it never hears anything
const blockedBrowser = Boolean((navigator as unknown as { brave?: unknown }).brave);

export const voiceDriveSupported = Boolean(Ctor) || typeof MediaRecorder !== "undefined";

/* ---------- what the words mean ---------- */
const CRUISE = 12, TOP = 21;
// Indian-English recognisers spell Hindi words many ways, so each command lists the usual ones
const WORDS: [RegExp, () => void][] = [
  [/^(chalo|challo|chalu|charlo|chalein|chal|chalte|chello|go|start|drive|aage|aagey|age|forward|move|moves|moving|mood|moon|मूव|चलो|चल|आगे)$/, () => go()],
  [/^(tez|tej|tes|test|taze|fast|faster|quick|quicker|quickly|speed|jaldi|jaldee|zoom|bhagao|तेज़|तेज|जल्दी)$/, () => { if (!started()) go(); sim.vd.speed = Math.min(TOP, Math.max(sim.vd.speed, CRUISE) + 5); }],
  [/^(dheere|dhire|dheeray|deere|slow|slower|slowly|slowdown|aaram|araam|धीरे)$/, () => { sim.vd.speed = Math.max(5, sim.vd.speed - 5); }],
  [/^(ruko|ruk|roko|rook|rocco|rukho|stop|stopp|halt|wait|brake|break|bas|bus|hold|thamo|रुको|रुक|बस|स्टॉप)$/, () => { sim.vd.speed = 0; }],
  [/^(left|lift|baaye|baye|bayen|baen|baaen|लेफ्ट|बाएं|बाएँ)$/, () => turn(1)],
  [/^(right|write|daaye|daye|dayen|daaen|dahine|राइट|दाएं|दाएँ)$/, () => turn(-1)],
  [/^(peeche|piche|pichhe|peechay|back|backward|backwards|reverse|पीछे)$/, () => { started(); sim.vd.speed = -5; }],
  [/^(pom|pompom|bom|bomb|horn|honk|beep|bajao|popo|पोम|हॉर्न)$/, () => horn()],
  [/^(map|naksha)$/, () => ui.set({ mapOpen: !ui.get().mapOpen })],
];

/** Makes sure he's in the auto and the ride is running. Returns true if it already was. */
function started() {
  const s = ui.get();
  if (s.phase !== "ride") return false;
  if (s.onFoot) board();
  return true;
}

function go() {
  const s = ui.get();
  // in a chapter, "move" (or "chalo") means "next"
  if (s.active !== null) { closeStop(); if (sim.vd.speed <= 0) sim.vd.speed = CRUISE; return; }
  started();
  if (sim.vd.speed <= 0) sim.vd.speed = CRUISE;
}

function turn(dir: number) {
  started();
  sim.vd.steer = dir; sim.vd.steerT = 0.9;
  if (sim.vd.speed === 0) sim.vd.speed = 7; // a turn from standstill rolls forward into it
}

/** Acts on any command words. Returns true if at least one was understood. */
function onWords(words: string[]) {
  let hit = false;
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^\p{L}\p{M}']/gu, ""); // keep Devanagari vowel signs
    for (const [re, fn] of WORDS) if (re.test(clean)) { fn(); hit = true; break; }
  }
  return hit;
}

const TRIP = /\b(chalo|chal|le chalo|go to|go|take me|drive me|show me|open|jaana|jana|le jao|lejao)\b/i;
const ANYWHERE = /\b(anywhere|somewhere|next|kahin|kahi|kahi bhi|kahin bhi|surprise)\b/i;
const HELLO = /^\W*(hello|hi|hey|hii|namaste|namaskar|hola|yo)\b/i;

/** Sets off for chapter i, in the auto. */
function tripTo(i: number) {
  board(); closeStop();
  ui.set({ target: i, express: false, reply: `Chalo! Heading to ${STOPS[i].name}.` });
}

/** A finished phrase: a trip to a chapter, the express tour, a hello, or a nudge towards what works. */
function onPhrase(text: string, hadCommand: boolean) {
  const cmd = parse(text);
  if (cmd.kind === "go" && TRIP.test(text)) return tripTo(cmd.stop);
  if (cmd.kind === "express") { startExpress(); return; }
  if (TRIP.test(text) && ANYWHERE.test(text)) return tripTo(ui.get().nextStop);
  if (HELLO.test(text)) { ui.set({ reply: "Namaste! Say “move” and we’re off." }); return; }
  // heard, but nothing to act on: say what it heard and what it understands, instead of doing nothing
  if (!hadCommand) ui.set({ reply: `Heard “${text.replace(/[.!?]+$/, "")}”. Try “move”, “left”, “stop”, or “take me to NoBroker”.` });
}

const status = (voiceStatus: string) => ui.set({ voiceStatus });

/* ---------- switching it on and off ---------- */
let mode: "browser" | "server" | null = null;

export function startVoiceDrive() {
  if (ui.get().voiceDrive) return;
  ui.set({ voiceDrive: true, voiceHeard: "", voiceStatus: "Starting the mic…" });
  startServerEar();
}

/** The server has no speech key: the browser's own recognition takes over, if it has one that works. */
function useBrowserEar() {
  stopServerEar();
  if (Ctor && !blockedBrowser) { mode = "browser"; lang = "en-IN"; failures = 0; listen(); return; }
  stopVoiceDrive();
  ui.set({ reply: "This browser can't do speech recognition. Open the site in Chrome or Edge to drive by voice." });
}

function stopVoiceDrive() {
  ui.set({ voiceDrive: false, voiceHeard: "", voiceStatus: "" });
  sim.vd.speed = 0; sim.vd.steerT = 0;
  mode = null;
  rec?.abort(); rec = null;
  stopServerEar();
}

export const toggleVoiceDrive = () => (ui.get().voiceDrive ? stopVoiceDrive() : startVoiceDrive());

/* ---------- ear 1: the browser's speech recognition ---------- */
let rec: Rec | null = null, lang = "en-IN", failures = 0;

function listen() {
  if (!Ctor || mode !== "browser" || !ui.get().voiceDrive) return;
  const r = new Ctor();
  r.lang = lang; r.continuous = true; r.interimResults = true;
  const spent = new Map<number, number>(); // per result: how many words have already been acted on
  const commanded = new Set<number>();
  r.onstart = () => status("Listening. Say “move”.");
  r.onresult = (e) => {
    failures = 0;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i], text = res[0].transcript.trim();
      const words = text.split(/\s+/).filter(Boolean);
      // act on each word as soon as it's settled: all of them once final, all but the last while still talking
      const ready = res.isFinal ? words.length : Math.max(0, words.length - 1);
      const done = spent.get(i) ?? 0;
      if (ready > done) {
        if (onWords(words.slice(done, ready))) commanded.add(i);
        spent.set(i, ready);
      }
      ui.set({ voiceHeard: words.slice(-6).join(" ") });
      if (res.isFinal) onPhrase(text, commanded.has(i));
    }
  };
  r.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return; // just a pause: it restarts itself
    if (e.error === "not-allowed") { stopVoiceDrive(); ui.set({ reply: "Mic is blocked. Allow it in the address bar, then press B again." }); return; }
    if (e.error === "audio-capture") { stopVoiceDrive(); ui.set({ reply: "No microphone found. Plug one in and press B again." }); return; }
    if (e.error === "language-not-supported" && lang !== "en-US") { lang = "en-US"; return; }
    // "network" / "service-not-allowed": this browser can't reach its speech service either
    failures++;
    if (failures >= 2 || e.error === "service-not-allowed") {
      rec = null; r.abort(); stopVoiceDrive();
      ui.set({ reply: "This browser can't reach its speech service. Open the site in Chrome or Edge to drive by voice." });
    }
  };
  // browsers stop listening after a pause: quietly start again while the mode is on
  r.onend = () => { if (rec === r) { rec = null; setTimeout(listen, 250); } };
  rec = r;
  try { r.start(); } catch { setTimeout(listen, 500); }
}

/* ---------- ear 2: record each phrase, transcribe it on the server ---------- */
let ear: { stream: MediaStream; ctx: AudioContext; timer: number; recorder: MediaRecorder | null } | null = null;

async function startServerEar() {
  mode = "server";
  status("Starting the mic…");
  // does the server have a speech key?
  try {
    const probe = await fetch("/api/stt");
    const { configured } = (await probe.json()) as { configured?: boolean };
    if (!configured) { useBrowserEar(); return; }
  } catch { useBrowserEar(); return; }
  if (!ui.get().voiceDrive || mode !== "server") return;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    stopVoiceDrive(); ui.set({ reply: "Mic is blocked. Allow it in the address bar, then press B again." }); return;
  }
  if (!ui.get().voiceDrive || mode !== "server") { stream.getTracks().forEach((t) => t.stop()); return; }
  const ctx = new AudioContext();
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  let floor = 0.01, loudAt = 0, startedAt = 0, chunks: Blob[] = [];
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  ear = { stream, ctx, timer: 0, recorder: null };
  status("Listening. Say “move”.");
  // a simple voice detector: record from the first loud moment until 0.6 s of quiet (or 4 s)
  ear.timer = window.setInterval(() => {
    if (!ear) return;
    an.getFloatTimeDomainData(buf);
    let sum = 0; for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length), now = performance.now();
    const loud = rms > Math.max(0.02, floor * 3);
    if (!loud) floor = floor * 0.98 + rms * 0.02;
    if (loud) loudAt = now;
    const r = ear.recorder;
    if (loud && !r) {
      chunks = [];
      const m = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      m.ondataavailable = (e) => chunks.push(e.data);
      m.onstop = () => transcribe(new Blob(chunks, { type: m.mimeType }));
      m.start(); ear.recorder = m; startedAt = now;
      status("Hearing you…");
    } else if (r && (now - loudAt > 600 || now - startedAt > 4000)) {
      r.stop(); ear.recorder = null;
    }
  }, 50);
}

function stopServerEar() {
  if (!ear) return;
  window.clearInterval(ear.timer);
  if (ear.recorder?.state === "recording") { ear.recorder.onstop = null; ear.recorder.stop(); }
  ear.stream.getTracks().forEach((t) => t.stop());
  ear.ctx.close();
  ear = null;
}

let serverMisses = 0;
async function transcribe(blob: Blob) {
  if (blob.size < 1500 || mode !== "server") return; // a click, not a word
  status("Understanding…");
  try {
    const r = await fetch("/api/stt", { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
    if (r.status === 501) { useBrowserEar(); return; }
    if (mode !== "server") return;
    // a failing speech service shouldn't loop silently: say so, and after a few misses use the browser's ear
    if (!r.ok) {
      if (++serverMisses >= 3) { useBrowserEar(); return; }
      status("Didn't catch that. Still listening…");
      return;
    }
    serverMisses = 0;
    const { text } = (await r.json()) as { text?: string };
    status("Listening. Say “move”.");
    if (!text) return;
    const words = text.split(/\s+/).filter(Boolean);
    ui.set({ voiceHeard: words.slice(-6).join(" ") });
    onPhrase(text, onWords(words));
  } catch {
    status("Couldn't reach the server. Still listening…");
  }
}
