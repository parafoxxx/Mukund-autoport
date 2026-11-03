/**
 * The background score, composed live so it never loops the same way twice.
 * Tanpura drone, tabla on a keherwa groove, a bassline, and santoor / bansuri melodies
 * written phrase by phrase. It follows the film: soft on the title screen, a groove on the road
 * (busier the faster you go), hushed in the chapters, bright for the end credits.
 */
import { ui, sim, walker } from "./store";
import { audioGraph, speaking } from "./sound";

type Mood = "intro" | "ride" | "chapter" | "finale";

const BPM = 96, STEP = 60 / BPM / 4; // sixteenth notes
const D = 146.83; // the home note, D3
const hz = (semi: number) => D * Math.pow(2, semi / 12);

// the mode shifts with the mood: Khamaj on the road, Kafi in the chapters, Bilawal at the finale
const SCALES: Record<Mood, number[]> = {
  intro: [0, 2, 4, 5, 7, 9, 10],
  ride: [0, 2, 4, 5, 7, 9, 10],
  chapter: [0, 2, 3, 5, 7, 9, 10],
  finale: [0, 2, 4, 5, 7, 9, 11],
};
const PROGRESSIONS = [[0, -2, -7, 0], [0, 5, 7, 5], [0, -2, 3, -2], [0, -5, -2, 0], [5, 3, -2, 0]];

// keherwa, one cycle per bar on eighth notes: dha ge na ti na ka dhi na
const THEKAS: string[][] = [
  ["dha", "ge", "na", "ti", "na", "ka", "dhi", "na"],
  ["dha", "-", "na", "ti", "na", "ge", "dhi", "na"],
  ["dha", "ge", "na", "-", "na", "ka", "dhi", "ge"],
  ["dha", "ti", "na", "ge", "-", "ka", "dhi", "na"],
];

let ctx: AudioContext | null = null;
let bus: GainNode | null = null, verbIn: GainNode | null = null;
let noise: AudioBuffer | null = null;
let nextTime = 0, step = 0;
let mood: Mood = "intro";
let prog = PROGRESSIONS[0], theka = THEKAS[0], lead: "santoor" | "bansuri" = "santoor";
let phrase: { at: number; deg: number; len: number }[] = [], motif: number[] = [];
let degree = 7;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Starts the score (call from a user gesture, so the browser lets audio play). */
export function startMusic() {
  if (ctx) return;
  const g = audioGraph();
  ctx = g.ctx;
  bus = ctx.createGain(); bus.gain.value = 0;
  bus.connect(g.out);
  // a little room: a feedback delay, low-passed, for the plucks and the flute
  verbIn = ctx.createGain(); verbIn.gain.value = 0.35;
  const dl = ctx.createDelay(1); dl.delayTime.value = STEP * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
  verbIn.connect(dl).connect(lp).connect(fb).connect(dl);
  lp.connect(bus);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  nextTime = ctx.currentTime + 0.1;
  window.setInterval(schedule, 25); // runs for the life of the page
}


/* ---------- the conductor ---------- */

function currentMood(): Mood {
  const s = ui.get();
  if (s.phase === "intro") return "intro";
  if (s.phase === "finale") return "finale";
  return s.active !== null ? "chapter" : "ride";
}

/** 0..1: how hard the ride is pushing, from the speed of whatever he's driving or running. */
const drive = () => Math.min(1, Math.abs(ui.get().onFoot ? walker.speed / 6.5 : sim.speed / 21));

function schedule() {
  if (!ctx || !bus) return;
  const m = currentMood();
  if (m !== mood) { mood = m; phrase = []; }
  // level: the whole score sits back under his voice and during chapters
  const target = (speaking() ? 0.28 : 1) * (mood === "chapter" ? 0.55 : mood === "intro" ? 0.8 : 1) * 0.42;
  bus.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
  while (nextTime < ctx.currentTime + 0.12) {
    play(step, nextTime);
    nextTime += STEP * (step % 2 ? 0.94 : 1.06); // a touch of swing
    step++;
  }
}

function play(n: number, t: number) {
  const s16 = n % 16, bar = Math.floor(n / 16);
  // every eight bars, a new section: fresh chords, groove and lead
  if (s16 === 0 && bar % 8 === 0) {
    prog = pick(PROGRESSIONS); theka = pick(THEKAS);
    lead = mood === "chapter" ? "bansuri" : Math.random() < 0.6 ? "santoor" : "bansuri";
  }
  const root = prog[bar % 4];
  const energy = mood === "ride" ? 0.35 + drive() * 0.65 : mood === "finale" ? 1 : 0.2;

  // tanpura: Pa Sa Sa Sa, one string per beat, always there
  if (s16 % 4 === 0) {
    const strings = [-5, 0, 0, -12];
    tanpura(hz(strings[(s16 / 4) | 0]), t);
  }
  if (mood === "chapter" || mood === "intro") {
    if (s16 === 0 && bar % 2 === 0) pad(root, t);
  } else {
    // bass: on the one, and pushing into the next beat
    if (s16 === 0 || s16 === 6 || (s16 === 10 && Math.random() < energy)) bass(hz(root - 12), t, s16 === 0 ? 0.42 : 0.26);
    // tabla on eighths, with a tirakita fill to close every fourth bar
    if (bar % 4 === 3 && s16 >= 12 && energy > 0.4) tabla(s16 % 2 ? "ti" : "na", t, 0.6);
    else if (s16 % 2 === 0) {
      const bol = theka[s16 / 2];
      if (bol !== "-" && (Math.random() < 0.55 + energy * 0.45 || s16 === 0)) tabla(bol, t, s16 === 0 ? 1 : 0.75);
    } else if (Math.random() < energy * 0.18) tabla("ti", t, 0.35); // ghost notes
    // shaker, louder the faster you go
    if (energy > 0.45) shaker(t, (s16 % 4 === 2 ? 0.9 : 0.45) * (energy - 0.35));
  }
  melody(n, t, root);
}

/** Writes a phrase every couple of bars: a short motif, repeated with a twist, then space to breathe. */
function melody(n: number, t: number, root: number) {
  const s16 = n % 16, bar = Math.floor(n / 16);
  const busy = mood === "ride" || mood === "finale" ? 0.7 : 0.4;
  if (s16 === 0 && bar % 2 === 0) {
    phrase = [];
    if (Math.random() < busy) {
      // new motif sometimes; otherwise vary the last one, which is what makes it feel composed
      if (!motif.length || Math.random() < 0.4) motif = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => pick([-2, -1, -1, 1, 1, 2, 0, 3]));
      degree = Math.max(3, Math.min(12, degree + pick([-2, 0, 2]) + (root > 0 ? 1 : 0)));
      let at = pick([0, 2, 4]), d = degree;
      const steps = [...motif, ...motif.map((x) => (Math.random() < 0.3 ? -x : x))];
      for (const mv of steps) {
        if (at >= 30) break;
        d = Math.max(0, Math.min(14, d + mv));
        const len = lead === "bansuri" ? pick([4, 4, 6, 8]) : pick([2, 2, 2, 4]);
        phrase.push({ at, deg: d, len });
        at += len;
      }
      // land the phrase on a strong note: Sa or Pa
      const last = phrase[phrase.length - 1];
      if (last) last.deg = Math.round(last.deg / 7) * 7 + (Math.random() < 0.5 ? 0 : 4);
    }
  }
  const pos = (bar % 2) * 16 + s16;
  for (const p of phrase) if (p.at === pos) {
    const sc = SCALES[mood];
    const semi = sc[p.deg % 7] + 12 * Math.floor(p.deg / 7) + 12;
    const dur = p.len * STEP;
    if (lead === "santoor") santoor(hz(semi), t, dur);
    else bansuri(hz(semi), t, dur, p === phrase[phrase.length - 1]);
  }
}

/* ---------- the instruments ---------- */

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tanpura(f: number, t: number) {
  const c = ctx!, o = c.createOscillator(), o2 = c.createOscillator(), f1 = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.value = f; o2.type = "sawtooth"; o2.frequency.value = f * 1.003;
  // the jawari buzz: a resonant band sweeping down through the overtones
  f1.type = "bandpass"; f1.Q.value = 6;
  f1.frequency.setValueAtTime(f * 9, t); f1.frequency.exponentialRampToValueAtTime(f * 2.5, t + 2.4);
  env(g, t, 0.07, 0.02, 2.8);
  o.connect(f1); o2.connect(f1); f1.connect(g).connect(bus!);
  o.start(t); o2.start(t); o.stop(t + 3); o2.stop(t + 3);
}

function pad(root: number, t: number) {
  const c = ctx!, g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 32);
  lp.connect(g).connect(bus!);
  for (const semi of [root, root + 7, root + (mood === "chapter" ? 15 : 16)]) {
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = hz(semi); o.detune.value = rnd(-6, 6);
    o.connect(lp); o.start(t); o.stop(t + STEP * 32 + 0.1);
  }
}

function bass(f: number, t: number, vol: number) {
  const c = ctx!, o = c.createOscillator(), s = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
  o.type = "sine"; o.frequency.value = f; s.type = "triangle"; s.frequency.value = f * 2;
  lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.3);
  env(g, t, vol, 0.01, 0.45);
  o.connect(g); s.connect(lp).connect(g); g.connect(bus!);
  o.start(t); s.start(t); o.stop(t + 0.5); s.stop(t + 0.5);
}

function santoor(f: number, t: number, dur: number) {
  // struck strings: bright, quick decay, and the hammer's tremolo on longer notes
  const hits = dur > STEP * 3 ? Math.floor(dur / (STEP / 2)) : 1;
  for (let k = 0; k < hits; k++) {
    const c = ctx!, at = t + k * STEP / 2, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = f; o2.type = "sine"; o2.frequency.value = f * 2.01;
    lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 10, at); lp.frequency.exponentialRampToValueAtTime(f * 2, at + 0.4);
    env(g, at, (k ? 0.035 : 0.075) * (1 - k / (hits + 2)), 0.004, 0.9);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus!); g.connect(verbIn!);
    o.start(at); o2.start(at); o.stop(at + 1); o2.stop(at + 1);
  }
}

function bansuri(f: number, t: number, dur: number, last: boolean) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
  o.type = "sine";
  // meend: slide up into the note
  o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
  vib.connect(vg).connect(o.frequency);
  const len = dur * (last ? 2.2 : 1.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
  g.gain.setValueAtTime(0.055, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  // breath
  const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = noise; nf.type = "bandpass"; nf.frequency.value = f * 2; nf.Q.value = 2;
  env(ng, t, 0.012, 0.05, len);
  n.connect(nf).connect(ng).connect(bus!);
  o.connect(g); g.connect(bus!); g.connect(verbIn!);
  o.start(t); vib.start(t); n.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05); n.stop(t + len + 0.05);
}

function tabla(bol: string, t: number, vol: number) {
  const c = ctx!;
  const bayan = bol === "dha" || bol === "dhi" || bol === "ge";
  const dayan = bol !== "ge";
  if (bayan) {
    // the big drum: a low thump that bends down (the palm pressing the skin)
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(rnd(105, 125), t); o.frequency.exponentialRampToValueAtTime(62, t + 0.28);
    env(g, t, 0.34 * vol, 0.005, 0.38);
    o.connect(g).connect(bus!); o.start(t); o.stop(t + 0.45);
  }
  if (dayan) {
    // the small drum: a tuned ring (on Sa) plus the finger's slap
    const ring = bol === "na" || bol === "dhi" || bol === "dha";
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = hz(12) * (ring ? 1 : 1.5);
    env(g, t, (ring ? 0.12 : 0.05) * vol, 0.002, ring ? 0.32 : 0.07);
    o.connect(g).connect(bus!); o.start(t); o.stop(t + 0.4);
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = noise; nf.type = "bandpass"; nf.frequency.value = ring ? 3200 : 2200; nf.Q.value = 1.4;
    env(ng, t, 0.06 * vol, 0.001, 0.045);
    n.connect(nf).connect(ng).connect(bus!); n.start(t, Math.random() * 0.5); n.stop(t + 0.08);
  }
}

function shaker(t: number, vol: number) {
  const c = ctx!, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = noise; f.type = "highpass"; f.frequency.value = 6500;
  env(g, t, 0.05 * vol, 0.004, 0.05);
  n.connect(f).connect(g).connect(bus!); n.start(t, Math.random() * 0.5); n.stop(t + 0.08);
}
