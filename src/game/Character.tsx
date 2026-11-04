import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { HERO_ACTS, HERO_GREETING, STOPS, type Act } from "../content";
import { FIRST } from "./guest";
import { beat, bubbleAnchor, ESTABLISH, say, sim, ui, useUI } from "./store";
import { PLACEMENTS, ROAD_HALF, START, STOP_POS, STOP_U, roadHeading } from "./track";
import { bell, playVoice, voiceDuration, voiceLevel } from "./sound";
import { MirrorScene } from "./Mirror";

/** Mukund's body (Avaturn export, carries the backflip). The other acts are animation-only files sharing its skeleton. */
export const AVATAR_URL = "/avatar/mukund.glb";
const LOADED_ACTS = [
  "talk", "pose", "lounge", "dance", "idle", "land", "facepalm",
  "sneak", "sit", "march", "run", "box", "pushups", "conduct",
] as const satisfies readonly Act[];
const actUrl = (a: Act) => `/avatar/acts/${a}.glb`;
/** Clips exported facing sideways: turned to face forward like the rest. */
const TURN: Partial<Record<Act, number>> = { sit: -Math.PI / 2 };

/** Where Mukund stands at a chapter, and which way he faces (towards the camera, away from the landmark). */
export function characterSpot(i: number) {
  const h = roadHeading(STOP_U[i]);
  const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const pos = STOP_POS[i].clone().addScaledVector(right, -(ROAD_HALF + 1.1)).addScaledVector(fwd, 3.6); // clear of the milestone
  const P = PLACEMENTS[i];
  const behind = P.radius > 0 ? P.pos : STOP_POS[i].clone().addScaledVector(fwd, 12);
  const away = pos.clone().sub(behind).setY(0).normalize();
  if (away.lengthSq() < 0.01) away.copy(fwd).multiplyScalar(-1);
  return { pos, away, rotY: Math.atan2(away.x, away.z) };
}

/** The way he faces at the mirror: directly away from the title-screen camera. */
export function mirrorDir() {
  const hero = heroSpot();
  return hero.fwd.clone().multiplyScalar(0.85).addScaledVector(hero.right, -0.55).normalize().negate();
}

/** On the title screen he stands beside the parked auto. */
export function heroSpot() {
  const h = START.heading;
  const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const pos = START.pos.clone().addScaledVector(right, -2.3).addScaledVector(fwd, 0.4);
  return { pos, fwd, right };
}

export function Character() {
  const phase = useUI((s) => s.phase);
  const active = useUI((s) => s.active);
  const [hasGlb, setHasGlb] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(AVATAR_URL, { method: "HEAD" })
      .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
      .catch(() => false)
      .then((ok) => { setHasGlb(ok); if (!ok) ui.set({ avatarReady: true }); });
  }, []);
  useEffect(() => () => { bubbleAnchor.visible = false; }, []);
  const mode = phase === "intro" ? "hero" : active !== null ? "chapter" : null;
  if (hasGlb === null || mode === null) { bubbleAnchor.visible = false; return null; }
  const pos = mode === "hero" ? heroSpot().pos : characterSpot(active!).pos;
  return (
    <FacesCamera key={`${mode}-${active}`} position={pos}>
      {hasGlb
        ? <Suspense fallback={<StandIn />}><Avatar mode={mode} chapter={active} /></Suspense>
        : <StandIn />}
    </FacesCamera>
  );
}

/** Turns smoothly to face the camera, so he's always performing for the viewer. */
function FacesCamera({ position, children }: { position: THREE.Vector3; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const first = useRef(true);
  useFrame(({ camera }, dt) => {
    const g = ref.current; if (!g) return;
    let want = Math.atan2(camera.position.x - position.x, camera.position.z - position.z);
    const s = ui.get();
    if (s.phase === "intro" && s.profile) { const d = mirrorDir(); want = Math.atan2(d.x, d.z); }
    if (first.current) { g.rotation.y = want; first.current = false; return; }
    const diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
    g.rotation.y += diff * Math.min(1, dt * 3);
  });
  return <group ref={ref} position={position}>{children}</group>;
}

/* ---------- the real Mukund ---------- */

/** Cancels the clip's horizontal drift so he performs on his mark; keeps the vertical (the backflip needs it). */
function onTheSpot(clip: THREE.AnimationClip, name: Act, armature: THREE.Quaternion) {
  const c = clip.clone();
  c.name = name;
  for (const t of c.tracks) t.values = t.values.slice(); // clone() shares keyframe arrays with the original
  const turn = TURN[name] ?? 0;
  // a turn about the world's vertical, expressed in the armature's own (rotated) frame
  const q = armature.clone().invert()
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn)).multiply(armature);
  const k = new THREE.Quaternion(), p = new THREE.Vector3();
  for (const t of c.tracks) {
    if (turn && /(^|\.)Hips\.quaternion$/.test(t.name)) {
      const v = t.values;
      for (let i = 0; i < v.length; i += 4) k.fromArray(v, i).premultiply(q).toArray(v, i);
    }
    if (!/(^|\.)Hips\.position$/.test(t.name)) continue;
    const v = t.values;
    if (turn) for (let i = 0; i < v.length; i += 3) p.fromArray(v, i).applyQuaternion(q).toArray(v, i);
    const x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] -= x0; v[i + 2] -= z0; }
  }
  return c;
}

/** Every act, keyed by name. The backflip lives in the body file. */
export function useActs() {
  const body = useGLTF(AVATAR_URL);
  const files = useGLTF(LOADED_ACTS.map(actUrl));
  // crisp textures on him from any angle (every copy of him shares these materials)
  useMemo(() => body.scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!(o as THREE.Mesh).isMesh || !mat) return;
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap]) if (t && t.anisotropy < 8) { t.anisotropy = 8; t.needsUpdate = true; }
  }), [body]);
  return useMemo(() => {
    // the rotation of everything above the hips (Avaturn's armature is turned to stand Y-up)
    const armature = new THREE.Quaternion();
    let hips: THREE.Object3D | undefined;
    body.scene.traverse((o) => { if (!hips && /(^|:)Hips$/.test(o.name)) hips = o; });
    for (let o = hips?.parent; o && o !== body.scene; o = o.parent) armature.premultiply(o.quaternion);
    const clips = { backflip: onTheSpot(body.animations[0], "backflip", armature) } as Record<Act, THREE.AnimationClip>;
    LOADED_ACTS.forEach((a, i) => { clips[a] = onTheSpot(files[i].animations[0], a, armature); });
    return clips;
  }, [body, files]);
}

function useMukund() {
  const body = useGLTF(AVATAR_URL);
  const clips = useActs();
  return useMemo(() => {
    const scene = body.scene;
    if (!scene.userData.prepared) {
      const box = new THREE.Box3().setFromObject(scene);
      scene.position.y -= box.min.y; // feet on the ground
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } // animated limbs leave the bind-pose bounds
      });
      scene.userData.prepared = true;
    }
    let head: THREE.Object3D | undefined;
    scene.traverse((o) => { if (!head && /(^|:)Head$/.test(o.name)) head = o; });
    return { scene, clips, head };
  }, [body, clips]);
}

const ONE_SHOT: Act[] = ["backflip", "land", "facepalm"];
const HOLD = 3.8; // seconds he holds a pose / gesture before going back to his base act

function Avatar({ mode, chapter }: { mode: "hero" | "chapter"; chapter: number | null }) {
  const { scene, clips, head } = useMukund();
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const current = useRef<THREE.AnimationAction | null>(null);
  const base = useRef<Act>(mode === "hero" ? "dance" : "talk");
  const timers = useRef<number[]>([]);
  const heroIndex = useRef(0);
  const headBase = useMemo(() => new THREE.Quaternion(), []);
  const hasBase = useRef(false);
  const nod = useRef(0);

  /** Cross-fades into an act. One-shots and held poses then move on to `then`, or back to the base act. */
  const perform = useRef((act: Act, hold = HOLD, then?: Act) => {
    sim.act = act;
    const next = mixer.clipAction(clips[act]);
    const prev = current.current;
    next.reset();
    next.setLoop(ONE_SHOT.includes(act) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = true;
    next.enabled = true;
    next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, 0.35, true);
    current.current = next;
    if (act !== base.current || then) {
      const back = ONE_SHOT.includes(act) ? clips[act].duration * 1000 - 250 : hold * 1000;
      timers.current.push(window.setTimeout(() => perform.current(then ?? base.current, hold), back));
    }
  });

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  /** The next bit of the title-screen routine. */
  const heroBit = useRef(() => {
    const bit = HERO_ACTS[heroIndex.current % HERO_ACTS.length];
    heroIndex.current++;
    clearTimers();
    perform.current(bit.act);
    const voice = `hero-${(heroIndex.current - 1) % HERO_ACTS.length}`;
    say(bit.line, voice);
    playVoice(voice);
  });

  useEffect(() => {
    ui.set({ avatarReady: true });
    perform.current(base.current);
    if (mode === "hero") {
      timers.current.push(window.setTimeout(() => {
        // sent to someone by name: greet them (the recorded greeting doesn't know their name, so it stays silent)
        if (FIRST) say(`Arre ${FIRST}! Aao, baitho, chalte hain.`);
        else { say(HERO_GREETING, "hero-greet"); playVoice("hero-greet"); }
      }, 900));
      // every so often a trick, but not while he's at the mirror
      const loop = window.setInterval(() => { if (!ui.get().profile) heroBit.current(); }, 9000);
      return () => { clearInterval(loop); clearTimers(); mixer.stopAllAction(); };
    }
    // chapter: gesture through the establishing shot, then the chapter's act and line on the cut to him
    const stop = STOPS[chapter!];
    const speak = () => {
      clearTimers();
      beat.spoke = true; beat.speakNow = null;
      base.current = "idle"; // after his bit he hangs about, looking around
      perform.current(stop.act, stop.then ? 3.4 : 6, stop.then);
      say(stop.quip, stop.id);
      playVoice(stop.id); // his recorded line, in sync with the cut to him
      // a follow-up line in the bubble once the recorded one has finished
      if (stop.quip2) timers.current.push(window.setTimeout(() => say(stop.quip2!), (voiceDuration(stop.id) || 2.5) * 1000 + 900));
    };
    beat.speakNow = speak;
    timers.current.push(window.setTimeout(speak, ESTABLISH * 1000 + 150));
    return () => { clearTimers(); mixer.stopAllAction(); if (beat.speakNow === speak) beat.speakNow = null; };
  }, [mode, chapter, mixer]);

  const seenCue = useRef(sim.cue.n);
  useFrame(({ camera, size, clock }, dt) => {
    if (sim.cue.n !== seenCue.current) { seenCue.current = sim.cue.n; perform.current(sim.cue.act); }
    // undo last frame's nod first, so it never accumulates on bones the clip doesn't animate
    if (head && hasBase.current) head.quaternion.copy(headBase);
    mixer.update(Math.min(dt, 0.05));
    // head nods while talking, layered on top of whatever the act is doing
    if (head) {
      headBase.copy(head.quaternion);
      hasBase.current = true;
      const talk = Math.max(voiceLevel(), sim.talk);
      sim.talk *= Math.pow(0.02, dt);
      nod.current += (talk - nod.current) * Math.min(1, dt * 12);
      head.rotateX(nod.current * 0.11 * Math.sin(clock.elapsedTime * 13));
      head.rotateY(nod.current * 0.06 * Math.sin(clock.elapsedTime * 5.3));
    }
    // speech-bubble anchor: just above his head, in screen pixels
    const p = new THREE.Vector3();
    (head ?? scene).getWorldPosition(p);
    p.y += 0.42;
    p.project(camera);
    bubbleAnchor.x = ((p.x + 1) / 2) * size.width;
    bubbleAnchor.y = ((1 - p.y) / 2) * size.height;
    bubbleAnchor.visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  });

  // on the title screen, clicking him sends him to the mirror: aarti for his own reflection, with a bell
  const profile = useUI((s) => s.profile);
  useEffect(() => {
    if (mode !== "hero") return;
    clearTimers();
    if (profile) { base.current = "conduct"; perform.current("conduct", 999); bell(); window.setTimeout(bell, 450); }
    else { base.current = "dance"; perform.current("dance"); }
  }, [profile, mode]);
  const hover = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  return (
    <group>
      <primitive object={scene} />
      <DirectorChair />
      {mode === "hero" && profile && <MirrorScene scene={scene} />}
      {/* an invisible, generous hit area: click him on the title screen and he goes to the mirror */}
      {!profile && (
        <mesh
          position-y={0.95}
          onClick={(e) => { e.stopPropagation(); if (mode === "hero") ui.set({ profile: true }); else heroBit.current(); }}
          onPointerOver={() => hover(true)}
          onPointerOut={() => hover(false)}
        >
          <capsuleGeometry args={[0.45, 1.1, 4, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

useGLTF.preload(AVATAR_URL);
LOADED_ACTS.forEach((a) => useGLTF.preload(actUrl(a)));

/** A director's chair that appears whenever he sits down. */
function DirectorChair() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.visible = sim.act === "sit"; });
  const wood = <meshStandardMaterial color="#6d4c2f" roughness={0.8} />;
  const canvas = <meshStandardMaterial color="#1b1b1f" roughness={0.9} side={THREE.DoubleSide} />;
  return (
    <group ref={ref} visible={false}>
      {/* crossed legs, both sides */}
      {[-0.27, 0.27].map((x) => [0.62, -0.62].map((r) => (
        <mesh key={`${x}${r}`} position={[x, 0.21, 0]} rotation-x={r} castShadow><boxGeometry args={[0.035, 0.5, 0.035]} />{wood}</mesh>
      )))}
      <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.52, 0.025, 0.42]} />{canvas}</mesh>
      {/* arm rests + back posts, the back raked to match how he leans */}
      {[-0.27, 0.27].map((x) => <mesh key={x} position={[x, 0.62, 0.02]}><boxGeometry args={[0.04, 0.03, 0.46]} />{wood}</mesh>)}
      <group position={[0, 0.42, -0.2]} rotation-x={-0.38}>
        {[-0.27, 0.27].map((x) => <mesh key={x} position={[x, 0.32, 0]}><boxGeometry args={[0.035, 0.64, 0.035]} />{wood}</mesh>)}
        <mesh position={[0, 0.48, 0]}><boxGeometry args={[0.54, 0.24, 0.01]} />{canvas}</mesh>
      </group>
    </group>
  );
}

/* ---------- stand-in if no avatar file is present ---------- */
function StandIn() {
  const body = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (body.current) { body.current.rotation.y = Math.sin(t * 0.7) * 0.06; body.current.position.y = Math.sin(t * 1.5) * 0.01; }
    if (mouth.current) mouth.current.scale.y += ((0.25 + Math.max(voiceLevel(), sim.talk) * 2.2) - mouth.current.scale.y) * Math.min(1, dt * 16);
  });
  const skin = <meshStandardMaterial color="#a8714f" roughness={0.7} />;
  const jacket = <meshStandardMaterial color="#1f2a36" roughness={0.8} />;
  const dark = <meshStandardMaterial color="#141418" roughness={0.9} />;
  return (
    <group ref={body}>
      {[-0.12, 0.12].map((x) => <mesh key={x} position={[x, 0.45, 0]} castShadow><capsuleGeometry args={[0.085, 0.75, 4, 8]} />{dark}</mesh>)}
      <mesh position={[0, 1.12, 0]} castShadow><capsuleGeometry args={[0.2, 0.42, 4, 12]} />{jacket}</mesh>
      {[-0.27, 0.27].map((x) => <mesh key={x} position={[x, 1.08, 0]} rotation-z={x < 0 ? 0.12 : -0.12} castShadow><capsuleGeometry args={[0.06, 0.5, 4, 8]} />{jacket}</mesh>)}
      <mesh position={[0, 1.47, 0]}><cylinderGeometry args={[0.06, 0.07, 0.12, 10]} />{skin}</mesh>
      <mesh position={[0, 1.66, 0]} scale={[1, 1.12, 1]} castShadow><sphereGeometry args={[0.15, 20, 16]} />{skin}</mesh>
      <mesh position={[0, 1.75, -0.015]} scale={[1.05, 0.75, 1.08]}><sphereGeometry args={[0.152, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />{dark}</mesh>
      {[-0.05, 0.05].map((x) => <mesh key={x} position={[x, 1.69, 0.135]}><sphereGeometry args={[0.016, 8, 6]} />{dark}</mesh>)}
      <mesh ref={mouth} position={[0, 1.6, 0.14]} scale={[1, 0.25, 1]}><boxGeometry args={[0.06, 0.03, 0.01]} /><meshStandardMaterial color="#5a2a22" /></mesh>
    </group>
  );
}
