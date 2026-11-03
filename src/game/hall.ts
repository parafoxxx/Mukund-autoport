/**
 * The floor plan of Competitions & Hackathons, the one landmark you can walk into.
 * The 3D model (Landmarks.tsx), the walking (Player.tsx) and the exhibit cards (Overlay.tsx) all read it,
 * so they always agree on where things stand.
 *
 * Local coordinates: the entrance faces the road along +z; x runs across the hall.
 */
import * as THREE from "three";
import { DECKS, STOPS, type Exhibit } from "../content";
import { COLLIDERS, PLACEMENTS } from "./track";

export const HALL_STOP = STOPS.findIndex((s) => s.landmark === "hall");
export const HALL = { halfW: 14, halfD: 12, doorZ: 12.5, doorHalf: 3.6, wallZ: -10 };

/** Where each part stands, in the hall's own coordinates. */
export const BOOTH = {
  meesho: new THREE.Vector3(-8.6, 0, -1.5),
  sarvam: new THREE.Vector3(8.6, 0, -1.5),
  pacto: new THREE.Vector3(0, 0, -3.2),
};
const DECK_SPACING = 2.95;
export const deckX = (i: number) => (i - (DECKS.length - 1) / 2) * DECK_SPACING;
export const COLUMNS_Z = [-10, -5, 0, 5, 10];

const placement = HALL_STOP >= 0 ? PLACEMENTS[HALL_STOP] : null;
const UP = new THREE.Vector3(0, 1, 0);
/** Hall coordinates to world coordinates. */
function toWorld(x: number, z: number) {
  if (!placement) return new THREE.Vector3(x, 0, z);
  return new THREE.Vector3(x, 0, z).applyAxisAngle(UP, placement.rotY).add(placement.pos);
}
/** Just outside the entrance, facing in: where "Walk in" puts him. */
export const ENTRANCE = () => toWorld(0, HALL.doorZ + 4.5);
/** Where the auto waits while he looks around, clear of the hall. */
export const PARKING = () => toWorld(0, HALL.doorZ + 9);
export const INSIDE = () => toWorld(0, HALL.doorZ - 4);

/** Is this point inside the hall's footprint? */
export function inHall(p: { x: number; z: number }) {
  if (!placement) return false;
  const local = new THREE.Vector3(p.x - placement.pos.x, 0, p.z - placement.pos.z).applyAxisAngle(UP, -placement.rotY);
  return Math.abs(local.x) < HALL.halfW + 1 && local.z > -HALL.halfD - 1 && local.z < HALL.doorZ + 0.5;
}

/* What you can walk up to: each deck screen, and the three booths. */
export type Spot =
  | { kind: "deck"; index: number; at: THREE.Vector3; reach: number }
  | { kind: "booth"; exhibit: Exhibit["id"]; at: THREE.Vector3; reach: number };

const SPOTS: Spot[] = placement ? [
  ...DECKS.map((_, i) => ({ kind: "deck" as const, index: i, at: toWorld(deckX(i), HALL.wallZ + 1.6), reach: 1.7 })),
  { kind: "booth", exhibit: "meesho", at: toWorld(BOOTH.meesho.x, BOOTH.meesho.z + 3.4), reach: 3.4 },
  { kind: "booth", exhibit: "sarvam", at: toWorld(BOOTH.sarvam.x, BOOTH.sarvam.z + 3.4), reach: 3.4 },
  { kind: "booth", exhibit: "pacto", at: toWorld(BOOTH.pacto.x, BOOTH.pacto.z + 2.6), reach: 2.6 },
] : [];

/* Browsing the deck wall. At a screen, left/right (A/D or the arrows) glide him to the next one instead of turning. */
export const browse = { to: -1, at: 0 };
const deckSpot = (i: number) => SPOTS[i] as Extract<Spot, { kind: "deck" }>;
/** The deck screen he's at (or gliding to), or -1. */
export function deckAt(p: { x: number; z: number }) {
  if (browse.to >= 0) return browse.to;
  const s = spotNear(p);
  return s?.kind === "deck" ? s.index : -1;
}
/** Step one screen along the wall; false if he isn't at the wall. */
export function stepDeck(p: { x: number; z: number }, dir: 1 | -1) {
  const i = deckAt(p);
  if (i < 0) return false;
  const now = performance.now();
  if (now - browse.at < 260) return true; // a held key walks along at a steady pace
  browse.at = now;
  browse.to = THREE.MathUtils.clamp(i + dir, 0, DECKS.length - 1);
  return true;
}
/** Where to stand for screen i, and the heading that faces the wall. */
export function deckStand(i: number) {
  const at = deckSpot(i).at, w = toWorld(0, -1).sub(toWorld(0, 0));
  return { at, heading: Math.atan2(w.x, w.z) };
}

/** The exhibit he's standing at, if any. */
export function spotNear(p: { x: number; z: number }) {
  let best: Spot | null = null, bestD = Infinity;
  for (const s of SPOTS) {
    const d = Math.hypot(p.x - s.at.x, p.z - s.at.z);
    if (d < s.reach && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/* What's solid inside: the walls, the columns and the booths. The hall's own big circle (registered in track.ts so
   trees, grass and the camera keep out) is marked open, so he can walk in through the door. */
if (placement) {
  const big = COLLIDERS.find((c) => Math.hypot(c.x - placement.pos.x, c.z - placement.pos.z) < 0.01);
  if (big) big.open = true;
  const add = (x: number, z: number, r: number) => { const w = toWorld(x, z); COLLIDERS.push({ x: w.x, z: w.z, r, decor: true }); };
  // the deck wall across the back
  for (let x = -HALL.halfW + 1; x <= HALL.halfW - 1; x += 1.6) add(x, HALL.wallZ - 0.3, 0.8);
  // side colonnades, and a low rail between the columns so the sides read as walls
  for (const sx of [-1, 1]) for (let z = -HALL.halfD + 0.5; z <= HALL.doorZ - 0.5; z += 1.4) add(sx * HALL.halfW, z, 0.7);
  // the front, either side of the door
  for (let x = HALL.doorHalf + 0.7; x <= HALL.halfW; x += 1.4) { add(x, HALL.doorZ, 0.7); add(-x, HALL.doorZ, 0.7); }
  // the booths
  add(BOOTH.meesho.x, BOOTH.meesho.z, 2.6);
  add(BOOTH.sarvam.x, BOOTH.sarvam.z, 2.4);
  add(BOOTH.pacto.x, BOOTH.pacto.z, 1.5);
}
