import * as THREE from "three";
import { STOPS } from "../content";

/** Deterministic RNG so the world looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = STOPS.length;
export const ROAD_HALF = 4.2;
export const BOUNDS = { x: 225, z: 150 };

/** The journey is one winding highway: Agra at one end, Wispr Flow at the other. */
// spread the chapters evenly across the land, however many there are
export const STOP_POS = STOPS.map((_, i) => new THREE.Vector3(-185 + i * (375 / Math.max(1, STOPS.length - 1)), 0, Math.sin(i * 1.05 + 0.4) * 70));

const lead = STOP_POS[0].clone().add(new THREE.Vector3(-26, 0, -14));
const tail = STOP_POS[N - 1].clone().add(new THREE.Vector3(26, 0, -16));
export const CURVE = new THREE.CatmullRomCurve3([lead, ...STOP_POS, tail], false, "centripetal");

export const SAMPLE_COUNT = 1000;
export const SAMPLES = CURVE.getSpacedPoints(SAMPLE_COUNT); // SAMPLE_COUNT + 1 points

export function nearestSample(p: { x: number; z: number }) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const s = SAMPLES[i], d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { index: best, u: best / SAMPLE_COUNT, dist: Math.sqrt(bd) };
}

/** Arc-length position of each stop along the road, 0..1. */
export const STOP_U = STOP_POS.map((p) => nearestSample(p).u);

const GUIDE_STEP = Math.ceil(14 / (CURVE.getLength() / SAMPLE_COUNT)); // ~14 m of road
/** Which way to head for stop i: a point a little further along the road toward it, or the stop itself once close. */
export function guidePoint(p: { x: number; z: number }, i: number) {
  const stop = STOP_POS[i];
  if (Math.hypot(stop.x - p.x, stop.z - p.z) < 26) return stop;
  const from = nearestSample(p).index, to = Math.round(STOP_U[i] * SAMPLE_COUNT);
  return SAMPLES[to > from ? Math.min(to, from + GUIDE_STEP) : Math.max(to, from - GUIDE_STEP)];
}

/** Heading (radians, forward = (sin h, cos h)) of the road at parameter u. */
export function roadHeading(u: number) {
  const t = CURVE.getTangentAt(THREE.MathUtils.clamp(u, 0, 1));
  return Math.atan2(t.x, t.z);
}

const LANDMARK_SIZE: Record<string, { offset: number; radius: number }> = {
  taj: { offset: 36, radius: 19 }, books: { offset: 14, radius: 9 }, gate: { offset: 30, radius: 18 },
  climb: { offset: 15, radius: 8 }, stall: { offset: 12, radius: 7.5 },
  hall: { offset: 25, radius: 15.5 },
  office: { offset: 17, radius: 11 }, society: { offset: 19, radius: 12 },
  cinema: { offset: 20, radius: 11 }, billboard: { offset: 14, radius: 5 },
};

/** Puts each landmark beside its stop, on whichever side keeps it clear of the road, facing the road. */
function place(i: number) {
  const { offset, radius } = LANDMARK_SIZE[STOPS[i].landmark];
  const h = roadHeading(STOP_U[i]);
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  let best = { pos: STOP_POS[i].clone(), clear: -Infinity, dir: right };
  for (const extra of [0, 6, 12, 18]) {
    for (const side of [1, -1]) {
      const dir = right.clone().multiplyScalar(side);
      const pos = STOP_POS[i].clone().addScaledVector(dir, offset + extra);
      const clear = nearestSample(pos).dist - radius - ROAD_HALF;
      if (clear > best.clear) best = { pos, clear, dir };
    }
    if (best.clear > 2) break;
  }
  return { pos: best.pos, rotY: Math.atan2(-best.dir.x, -best.dir.z), radius };
}

/** IIT Kanpur's library stands past the gate, on the far side of the road from the Taj. */
function placeLibrary(i: number) {
  const { offset, radius } = LANDMARK_SIZE.gate;
  const u = STOP_U[i] + 26 / CURVE.getLength();
  const at = CURVE.getPointAt(u), h = roadHeading(u);
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const taj = STOP_POS[STOPS.findIndex((s) => s.landmark === "taj")];
  const away = (taj.x - at.x) * right.x + (taj.z - at.z) * right.z > 0 ? -1 : 1;
  const dir = right.multiplyScalar(away);
  const pos = new THREE.Vector3(at.x, 0, at.z).addScaledVector(dir, offset);
  return { pos, rotY: Math.atan2(-dir.x, -dir.z), radius };
}

export const PLACEMENTS = STOPS.map((s, i) => (s.landmark === "gate" ? placeLibrary(i) : place(i)));

/** The book tower in Agra: on the Taj's side of the road, up the road from it and nearer the road,
 *  so the shot that looks at him with the Taj behind him holds the tower too. */
function placeBeside(i: number) {
  const kind = STOPS[i].beside!, { offset, radius } = LANDMARK_SIZE[kind];
  const main = PLACEMENTS[i];
  for (const ahead of [20, 24, 28, 32]) {
    const u = Math.min(1, STOP_U[i] + ahead / CURVE.getLength());
    const at = CURVE.getPointAt(u), h = roadHeading(u);
    const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    const side = (main.pos.x - at.x) * right.x + (main.pos.z - at.z) * right.z > 0 ? 1 : -1;
    const dir = right.multiplyScalar(side);
    for (let extra = 0; extra <= 10; extra += 2) {
      const pos = new THREE.Vector3(at.x, 0, at.z).addScaledVector(dir, offset + extra);
      const roadOk = nearestSample(pos).dist - radius - ROAD_HALF > 1.5;
      const tajOk = Math.hypot(pos.x - main.pos.x, pos.z - main.pos.z) > radius + main.radius + 2;
      if (roadOk && tajOk) return { kind, pos, rotY: Math.atan2(-dir.x, -dir.z), radius };
    }
  }
  throw new Error("no room beside the landmark");
}
export const BESIDE = STOPS.map((s, i) => (s.beside ? placeBeside(i) : null));

/** open: he can walk through it (the hall's outline, entered by its door). decor: the camera ignores it. */
export type Collider = { x: number; z: number; r: number; open?: boolean; decor?: boolean };
export const COLLIDERS: Collider[] = [];

STOPS.forEach((s, i) => {
  const P = PLACEMENTS[i];
  if (P.radius > 0) COLLIDERS.push({ x: P.pos.x, z: P.pos.z, r: P.radius });
  const A = BESIDE[i];
  if (A) COLLIDERS.push({ x: A.pos.x, z: A.pos.z, r: A.radius });
  if (s.landmark === "gate") {
    const h = roadHeading(STOP_U[i]);
    const side = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    for (const k of [-1, 1]) {
      const p = STOP_POS[i].clone().addScaledVector(side, k * (ROAD_HALF + 1.6));
      COLLIDERS.push({ x: p.x, z: p.z, r: 1.3 });
    }
  }
});

/** Ponds in the fields between chapters, clear of the road and the landmarks. Solid, so trees and grass keep out. */
export const PONDS: { x: number; z: number; r: number; seed: number }[] = [];
for (let i = 0; i < STOP_POS.length - 1; i += 2) {
  const u = (STOP_U[i] + STOP_U[i + 1]) / 2, at = CURVE.getPointAt(u), h = roadHeading(u);
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const r = 7 + (i % 3) * 1.8;
  for (const side of i % 4 ? [1, -1] : [-1, 1]) {
    const pos = new THREE.Vector3(at.x, 0, at.z).addScaledVector(right, side * (ROAD_HALF + r + 7));
    if (nearestSample(pos).dist < ROAD_HALF + r + 4) continue;
    if (COLLIDERS.some((c) => Math.hypot(c.x - pos.x, c.z - pos.z) < c.r + r + 4)) continue;
    PONDS.push({ x: pos.x, z: pos.z, r, seed: i });
    COLLIDERS.push({ x: pos.x, z: pos.z, r: r + 0.6 });
    break;
  }
}

/** Scatter trees off the road and away from landmarks. */
export const TREES: { x: number; z: number; s: number; kind: number }[] = [];
{
  const r = rng(7);
  let guard = 0;
  while (TREES.length < 220 && guard++ < 8000) {
    const x = (r() * 2 - 1) * (BOUNDS.x - 5), z = (r() * 2 - 1) * (BOUNDS.z + 20);
    if (nearestSample({ x, z }).dist < ROAD_HALF + 5) continue;
    if (COLLIDERS.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 6) ** 2)) continue;
    if (STOP_POS.some((sp) => (sp.x - x) ** 2 + (sp.z - z) ** 2 < 144)) continue;
    TREES.push({ x, z, s: 0.8 + r() * 0.9, kind: r() < 0.7 ? 0 : 1 });
  }
  TREES.forEach((t) => COLLIDERS.push({ x: t.x, z: t.z, r: 0.7 * t.s }));
}

export const START = { pos: STOP_POS[0].clone(), heading: roadHeading(STOP_U[0]) };
