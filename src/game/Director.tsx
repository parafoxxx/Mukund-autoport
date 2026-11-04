import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STOPS } from "../content";
import { beat, ESTABLISH, focus, sim, ui, walker } from "./store";
import { nearestSample, ROAD_HALF, roadHeading, STOP_POS, STOP_U } from "./track";
import { characterSpot } from "./Character";
import { bell, fanfare, playVoice, stopVoice, voiceDuration } from "./sound";
import { driving } from "./input";
import { board, scripted, walkIntoHall } from "./Player";
import { inHall } from "./hall";

const N = STOPS.length;
const LAST = N - 1;
const ARRIVE = 7, LEAVE = 14;

const dist = (i: number) => { const f = focus(); return Math.hypot(STOP_POS[i].x - f.x, STOP_POS[i].z - f.z); };

/** The controls only count as "let me drive on" once they've been let go after the chapter opened. */
let armed = false, chapterT = 0;

function openStop(i: number) {
  const s = ui.get();
  armed = false; chapterT = 0;
  sim.lastStop = i;
  sim.expressTimer = 0;
  const visited = s.visited.includes(i) ? s.visited : [...s.visited, i];
  if (i === LAST) {
    fanfare();
    playVoice(STOPS[i].id); // his closing line plays over the end credits
    ui.set({ phase: "finale", active: null, visited, target: null, express: false });
    return;
  }
  bell();
  beat.spoke = false;
  ui.set({ active: i, visited, target: s.express ? s.target : s.target === i ? null : s.target });
}

/** walkIn: at a walk-in chapter (the hall), he gets out and walks in. Jumps elsewhere (map, voice, reset) pass false. */
export function closeStop(walkIn = false) {
  const s = ui.get();
  if (s.active === null) return;
  stopVoice();
  sim.cooldown.add(s.active);
  if (s.onFoot) {
    // he carries on from where he just performed, facing down the road
    walker.pos.copy(characterSpot(s.active).pos);
    walker.heading = roadHeading(STOP_U[s.active]);
    walker.speed = 0;
  }
  ui.set({ active: null });
  if (s.express) ui.set({ target: (s.active + 1) % N });
  else if (walkIn && STOPS[s.active].walkIn) walkIntoHall();
}

/** Space in a chapter: the first press cuts to his line; during or after it, the next one moves on. */
export function chapterSpace() {
  if (!beat.spoke && beat.speakNow) { beat.speakNow(); beat.cut++; return; }
  closeStop(true);
}

export function startExpress() {
  const s = ui.get();
  const from = s.active ?? sim.lastStop;
  if (s.active !== null) sim.cooldown.add(s.active);
  if (s.onFoot) board();
  ui.set({ express: true, active: null, target: Math.min(LAST, from + 1), phase: "ride" });
}

/** Where the arrow and LED board point: the autopilot target, else the next unvisited stop. */
function nextStop(): number {
  const s = ui.get();
  if (s.target !== null) return s.target;
  for (let k = 1; k <= N; k++) {
    const i = (sim.lastStop + k) % N;
    if (!s.visited.includes(i)) return i;
  }
  return LAST;
}

let hudTimer = 0, offTimer = 0;

export function Director() {
  useFrame((_, dt) => {
    const s = ui.get();
    if (s.phase !== "ride") return;

    if (scripted()) return;

    for (let i = 0; i < N; i++) {
      const d = dist(i);
      // (measured from the auto: walking around the hall and back to the parked auto mustn't replay the chapter)
      if (Math.hypot(sim.pos.x - STOP_POS[i].x, sim.pos.z - STOP_POS[i].z) > LEAVE) sim.cooldown.delete(i);
      // on the express ride only the current target opens; otherwise any stop you drive into
      const wanted = s.express ? s.target === i : !(s.onFoot && s.visited.includes(i));
      if (d < ARRIVE && s.active === null && wanted && !sim.cooldown.has(i)) { openStop(i); return; }
    }
    // pressing the controls again during a chapter means "I've read it, let me drive"
    // (not the keys you were already holding when you pulled in, and not in the first moment)
    if (s.active !== null) chapterT += dt;
    if (s.active !== null && !s.express && !s.lightbox && !s.embed) {
      if (!driving()) armed = true;
      else if (armed && chapterT > 1.2) { closeStop(); return; }
    }
    if (s.active !== null && !s.express && dist(s.active) > LEAVE) closeStop();
    if (s.active !== null && s.express && !s.lightbox && !s.embed) {
      sim.expressTimer += dt;
      if (sim.expressTimer > readTime(s.active)) closeStop();
    }

    hudTimer += dt;
    if (hudTimer > 0.12) {
      offTimer = nearestSample(focus()).dist > ROAD_HALF + 5 && !inHall(focus()) ? offTimer + hudTimer : 0;
      hudTimer = 0;
      const n = nextStop();
      const patch = {
        nextStop: n, distance: Math.round(dist(n)), kmh: Math.round(Math.abs(s.onFoot ? walker.speed : sim.speed) * 3.6),
        km: Math.round(sim.distance / 10) / 100, offroad: offTimer > 2.5,
      };
      if (patch.nextStop !== s.nextStop || patch.distance !== s.distance || patch.kmh !== s.kmh || patch.km !== s.km || patch.offroad !== s.offroad) ui.set(patch);
    }
  });
  return null;
}

/** Seconds a chapter stays up on the express cut: enough to read it, no more. */
export function readTime(i: number) {
  const st = STOPS[i];
  const reading = 4 + st.lines.length * 1.1 + (st.stats?.length ?? 0) * 0.5;
  // if Mukund recorded this chapter, let him finish (plus the establishing shot before the cut to him)
  const voice = voiceDuration(st.id);
  return voice > 0 ? Math.max(reading, ESTABLISH + voice + 0.8) : reading;
}

/** Flips the ready flag once the first frame can render without a stall: every shader is compiled up front,
 *  in parallel where the GPU driver allows it, instead of one by one while the screen is frozen. */
export function ReadySignal() {
  const started = useRef(false);
  useFrame(({ gl, scene, camera }) => {
    if (started.current || ui.get().ready) return;
    started.current = true;
    const trace = location.search.includes("trace");
    if (trace) console.log(`[trace] firstFrame ${(performance.now() / 1000).toFixed(2)}s`);
    const done = () => { if (trace) console.log(`[trace] compiled ${(performance.now() / 1000).toFixed(2)}s programs ${gl.info.programs?.length}`); ui.set({ ready: true }); };
    const r = gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> };
    if (!r.compileAsync) { done(); return; }
    // with the film look on, the scene is drawn into a buffer, not straight to the screen, and three.js builds a
    // different shader for that (linear colour, no tone mapping). Compile that one, or every material gets built twice.
    const prev = gl.getRenderTarget(), into = ui.get().quality > 0 ? new THREE.WebGLRenderTarget(1, 1) : null;
    if (into) gl.setRenderTarget(into);
    const job = r.compileAsync(scene, camera);
    if (into) gl.setRenderTarget(prev);
    job.then(done, done).finally(() => into?.dispose());
  });
  return null;
}
