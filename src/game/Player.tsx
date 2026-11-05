import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Act } from "../content";
import { AVATAR_URL, heroSpot, useActs } from "./Character";
import { input } from "./input";
import { bubbleAnchor, cue, sim, ui, walker } from "./store";
import { BOUNDS, COLLIDERS, CURVE, START, STOP_U, nearestSample, roadHeading, SAMPLES } from "./track";
import { voiceLevel } from "./sound";
import { browse, deckAt, deckStand, ENTRANCE, hallRoute, INSIDE, type HallPlace } from "./hall";
import { count } from "./achievements";

const WALK = 6.5, BACK = 2.6, TURN = 2.7, RADIUS = 0.45;
const ONE_SHOT: Act[] = ["backflip", "land", "facepalm"];

/** Number keys: his party tricks. */
export const EMOTES: Act[] = ["dance", "backflip", "pushups", "box", "conduct", "facepalm", "land", "sneak", "march"];

/** Puts him on his mark beside the parked auto, where he stood on the title screen. */
export function placeWalkerAtStart() {
  walker.pos.copy(heroSpot().pos);
  walker.heading = START.heading;
  walker.speed = 0;
}

/** The ride on foot begins with the auto waiting just up the road, ahead of where he does chapter one,
 *  on his side and close enough (under the 7 m it follows from) that it stays put. */
export function parkAutoAhead() {
  const u = Math.min(1, STOP_U[0] + 7.5 / CURVE.getLength()), at = CURVE.getPointAt(u), h = roadHeading(u);
  sim.pos.set(at.x - Math.cos(h) * 2, 0, at.z + Math.sin(h) * 2);
  sim.heading = h;
  sim.speed = 0;
}

export function walkerToRoad() {
  const n = nearestSample(walker.pos);
  walker.pos.set(SAMPLES[n.index].x, 0, SAMPLES[n.index].z);
  walker.heading = roadHeading(n.u);
  walker.speed = 0;
}

const autoDist = () => Math.hypot(sim.pos.x - walker.pos.x, sim.pos.z - walker.pos.z);
export const nearAuto = () => autoDist() < 4.2;

/* ---------- getting in and out: little scripted moves he plays out on his own ---------- */

type Step =
  | { kind: "walk"; to: () => THREE.Vector3 }
  | { kind: "enter" }
  | { kind: "exit" }
  | { kind: "do"; fn: () => void };

let script: Step[] = [];
let started = false, stepT = 0, fromHeading = 0;
const from = new THREE.Vector3();
const STROLL = 3.4;

/** True while he's busy getting in, getting out or walking to his mark (the controls wait). */
export const scripted = () => script.length > 0;
function runScript(steps: Step[]) { script = steps; started = false; }
export function cancelScript() { script = []; started = false; walker.pos.y = 0; }

const autoFwd = () => new THREE.Vector3(Math.sin(sim.heading), 0, Math.cos(sim.heading));
const autoRight = () => new THREE.Vector3(Math.cos(sim.heading), 0, -Math.sin(sim.heading));
/** Where he sits: the same spot the driver model uses (Auto.tsx, Driver). */
export const SEAT = { y: 0.42, z: 0.25 };
const seatPoint = () => sim.pos.clone().addScaledVector(autoFwd(), SEAT.z).setY(SEAT.y + sim.lift);
/** The open side of the cab nearest to him (autos have no doors, just a gap on each side). */
function doorPoint() {
  const r = autoRight();
  const side = (walker.pos.x - sim.pos.x) * r.x + (walker.pos.z - sim.pos.z) * r.z >= 0 ? 1 : -1;
  return sim.pos.clone().addScaledVector(autoFwd(), SEAT.z).addScaledVector(r, side * 1.3).setY(0);
}
const toDoorAndIn = (): Step[] => [{ kind: "walk", to: doorPoint }, { kind: "enter" }];

const ease = (k: number) => k * k * (3 - 2 * k);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Moves the script along one frame. Returns the clip he should be playing. */
function advanceScript(dt: number): { act: Act; rate?: number } {
  const st = script[0];
  if (!started) {
    started = true; stepT = 0;
    if (st.kind === "exit") {
      // the driver model hands over to the walking one, mid-seat
      ui.set({ onFoot: true });
      walker.pos.copy(seatPoint()); walker.heading = sim.heading;
    }
    from.copy(walker.pos); fromHeading = walker.heading;
  }
  stepT += dt;
  const done = () => { script.shift(); started = false; };
  switch (st.kind) {
    case "do":
      done(); st.fn();
      return { act: "idle" };
    case "walk": {
      const to = st.to();
      const dx = to.x - walker.pos.x, dz = to.z - walker.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.12 || stepT > 7) { walker.pos.set(to.x, 0, to.z); walker.speed = 0; done(); return { act: "idle" }; }
      walker.heading += wrap(Math.atan2(dx, dz) - walker.heading) * Math.min(1, dt * 10);
      const move = Math.min(d, STROLL * dt);
      walker.pos.x += (dx / d) * move; walker.pos.z += (dz / d) * move; walker.pos.y = 0;
      walker.speed = STROLL;
      return { act: "run", rate: 0.6 };
    }
    case "enter": {
      // swing round to face forward and drop into the seat
      const k = ease(Math.min(1, stepT / 0.85));
      walker.pos.lerpVectors(from, seatPoint(), k);
      walker.heading = fromHeading + wrap(sim.heading - fromHeading) * k;
      walker.speed = 0;
      if (stepT >= 0.85) { walker.pos.y = 0; ui.set({ onFoot: false, boarded: true }); done(); }
      return { act: "sit" };
    }
    case "exit": {
      // slide out of the seat and stand up beside the auto
      const k = ease(Math.min(1, stepT / 0.8));
      const door = sim.pos.clone().addScaledVector(autoFwd(), SEAT.z).addScaledVector(autoRight(), -1.3);
      walker.pos.lerpVectors(from, door, k);
      walker.speed = 0;
      if (stepT >= 0.8) { walker.pos.y = 0; done(); }
      return { act: stepT < 0.3 ? "sit" : "idle" };
    }
  }
}

/** E: walk over and hop into the auto, or climb out once it has (nearly) stopped. */
export function toggleAuto(): string {
  const s = ui.get();
  if (s.phase !== "ride" || s.active !== null || scripted()) return "";
  if (s.onFoot) {
    if (!nearAuto()) return "Auto thoda door hai. Paas jao, phir F.";
    runScript(toDoorAndIn());
    return "";
  }
  if (Math.abs(sim.speed) > 3) return "Pehle rukne do!";
  sim.speed = 0;
  ui.set({ target: null, express: false });
  runScript([{ kind: "exit" }]);
  return "";
}

/** The hall: out of the auto, up to the door and in. The auto waits outside. */
export function walkIntoHall() {
  if (ui.get().phase !== "ride") return;
  cancelScript();
  sim.speed = 0;
  ui.set({ target: null, express: false, boarded: true });
  const steps: Step[] = ui.get().onFoot ? [] : [{ kind: "exit" }];
  steps.push({ kind: "walk", to: ENTRANCE }, { kind: "walk", to: INSIDE });
  runScript(steps);
}

/** Inside the hall: walk him to the deck wall or a booth, along the aisles. */
export function walkInHall(to: HallPlace) {
  const s = ui.get();
  if (s.phase !== "ride" || !s.onFoot || s.active !== null || scripted()) return;
  const { pts, heading } = hallRoute(walker.pos, to);
  runScript([...pts.map((p): Step => ({ kind: "walk", to: () => p })), { kind: "do", fn: () => { walker.heading = heading; } }]);
}

/** For trips that need the auto: if it's far, it pulls up behind him first; then he gets in. */
export function board() {
  if (!ui.get().onFoot || scripted()) return;
  if (autoDist() > 12) {
    const back = new THREE.Vector3(Math.sin(walker.heading), 0, Math.cos(walker.heading)).multiplyScalar(-4);
    sim.pos.copy(walker.pos).add(back);
    sim.heading = walker.heading;
    sim.speed = 0;
  }
  runScript(toDoorAndIn());
}



function stepWalker(dt: number) {
  const s = ui.get();
  const live = s.phase === "ride" && s.active === null;
  const fwdIn = live ? (input.up ? 1 : 0) - (input.down ? 1 : 0) : 0;
  // at the deck wall, left/right step between screens (handled in App), so they don't turn him
  const atWall = live && deckAt(walker.pos) >= 0;
  const turnIn = live && !atWall ? (input.left ? 1 : 0) - (input.right ? 1 : 0) : 0;
  if (live && browse.to >= 0 && fwdIn === 0) {
    // glide sideways to the next screen and face it
    const { at, heading } = deckStand(browse.to);
    const dx = at.x - walker.pos.x, dz = at.z - walker.pos.z, d = Math.hypot(dx, dz);
    const k = Math.min(1, dt * 9);
    walker.pos.x += dx * k; walker.pos.z += dz * k;
    walker.heading += Math.atan2(Math.sin(heading - walker.heading), Math.cos(heading - walker.heading)) * k;
    walker.speed = Math.min(d * 3, 3);
    if (d < 0.04) { browse.to = -1; walker.speed = 0; }
    return;
  }
  browse.to = -1;
  const want = fwdIn > 0 ? WALK : fwdIn < 0 ? -BACK : 0;
  walker.speed += (want - walker.speed) * Math.min(1, dt * 10);
  walker.heading += turnIn * TURN * dt;
  walker.pos.x += Math.sin(walker.heading) * walker.speed * dt;
  walker.pos.z += Math.cos(walker.heading) * walker.speed * dt;
  // trees, landmarks and the auto are solid
  const solids = [...COLLIDERS.filter((c) => !c.open), { x: sim.pos.x, z: sim.pos.z, r: 1.3 }];
  for (const c of solids) {
    const dx = walker.pos.x - c.x, dz = walker.pos.z - c.z, min = c.r + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 1;
      walker.pos.x = c.x + (dx / d) * min; walker.pos.z = c.z + (dz / d) * min;
    }
  }
  walker.pos.x = THREE.MathUtils.clamp(walker.pos.x, -BOUNDS.x, BOUNDS.x);
  walker.pos.z = THREE.MathUtils.clamp(walker.pos.z, -BOUNDS.z, BOUNDS.z);
}

export function Player() {
  return <Suspense fallback={null}><Walker /></Suspense>;
}

function Walker() {
  const { scene } = useGLTF(AVATAR_URL);
  const clips = useActs();
  const me = useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return c;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(me), [me]);
  const ref = useRef<THREE.Group>(null);
  const current = useRef<{ act: Act; action: THREE.AnimationAction } | null>(null);
  const emote = useRef<{ act: Act; until: number } | null>(null);
  const seenCue = useRef(sim.cue.n);
  const headBase = useMemo(() => new THREE.Quaternion(), []);
  const nodBase = useRef(false);
  const head = useMemo(() => {
    let h: THREE.Object3D | undefined;
    me.traverse((o) => { if (!h && /(^|:)Head$/.test(o.name)) h = o; });
    return h;
  }, [me]);

  const replay = useRef(false);
  const play = (act: Act) => {
    if (current.current?.act === act && !replay.current) return;
    replay.current = false;
    const next = mixer.clipAction(clips[act]);
    const prev = current.current?.action;
    next.reset();
    next.setLoop(ONE_SHOT.includes(act) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = true;
    next.enabled = true;
    next.play();
    // fade out what was playing, or the two blend half-and-half and the trick barely shows
    if (prev && prev !== next) next.crossFadeFrom(prev, 0.25, true);
    current.current = { act, action: next };
  };

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  useFrame(({ camera, size, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = ui.get();
    // (a waiting script runs too: climbing out is what puts him back on foot)
    const on = (s.phase === "ride" || s.phase === "finale") && (s.onFoot || scripted()) && s.active === null;
    const g = ref.current;
    if (g) g.visible = on;
    if (!on) { nodBase.current = false; return; }
    const busy = scripted() ? advanceScript(dt) : null;
    if (!busy) stepWalker(dt);
    if (g) { g.position.copy(walker.pos); g.rotation.y = walker.heading; }

    // a trick asked for by a key, a click or his AI reply
    if (sim.cue.n !== seenCue.current) {
      seenCue.current = sim.cue.n;
      const act = sim.cue.act;
      if (act !== "talk") count("tricks");
      emote.current = { act, until: clock.elapsedTime + (ONE_SHOT.includes(act) ? clips[act].duration - 0.2 : 4) };
      replay.current = true; // play it from the top even if it's the same act again
    }
    const moving = Math.abs(walker.speed) > 0.4;
    if (busy || moving || (emote.current && clock.elapsedTime > emote.current.until)) emote.current = null;
    if (busy) {
      play(busy.act);
      if (busy.rate) current.current!.action.timeScale = busy.rate;
    } else if (emote.current) play(emote.current.act);
    else if (moving) {
      play("run");
      current.current!.action.timeScale = walker.speed > 0 ? walker.speed / WALK * 1.15 : -0.8;
    } else play("idle");
    // undo last frame's nod first, so it never piles up on bones a clip leaves alone
    if (head && nodBase.current) head.quaternion.copy(headBase);
    mixer.update(dt);

    // nod while he talks, and carry the speech bubble
    if (head) {
      headBase.copy(head.quaternion); nodBase.current = true;
      const talk = Math.max(voiceLevel(), sim.talk);
      sim.talk *= Math.pow(0.02, dt);
      head.rotateX(talk * 0.1 * Math.sin(clock.elapsedTime * 13));
    }
    const p = new THREE.Vector3();
    (head ?? me).getWorldPosition(p);
    p.y += 0.42;
    p.project(camera);
    bubbleAnchor.x = ((p.x + 1) / 2) * size.width;
    bubbleAnchor.y = ((1 - p.y) / 2) * size.height;
    bubbleAnchor.visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  });

  const hover = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  return (
    <group ref={ref} visible={false}>
      <primitive object={me} />
      {/* click him for a random trick */}
      <mesh
        position-y={0.95}
        onClick={(e) => { e.stopPropagation(); cue(EMOTES[Math.floor(Math.random() * EMOTES.length)]); }}
        onPointerOver={() => hover(true)}
        onPointerOut={() => hover(false)}
      >
        <capsuleGeometry args={[0.45, 1.1, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// he starts on his mark, so the sun's shadow box is centred on him from the title screen on
placeWalkerAtStart();
