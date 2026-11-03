import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ME, STOPS, type Act } from "../content";
import { FIRST } from "./guest";
import { input, driving } from "./input";
import { beat, bubbleAnchor, ESTABLISH, focus, sim, ui, walker } from "./store";
import { BESIDE, BOUNDS, COLLIDERS, CURVE, PLACEMENTS, ROAD_HALF, SAMPLES, SAMPLE_COUNT, START, STOP_POS, STOP_U, guidePoint, nearestSample } from "./track";
import { FONT_MONO, FONT_SERIF } from "./Roadside";
import { AVATAR_URL, characterSpot, heroSpot, mirrorDir, useActs } from "./Character";
import { MIRROR_AT } from "./Mirror";
import { scripted, SEAT } from "./Player";
import { ENTRANCE, inHall, PARKING } from "./hall";
import { bonk, bump, horn, setEngine, voiceLevel } from "./sound";

const ACCEL = 9, BRAKE = 18, COAST = 0.55, MAX_ROAD = 21, MAX_OFF = 11, MAX_REV = -6, STEER = 1.9, RADIUS = 1.4;
const fwd = new THREE.Vector3();

sim.pos.copy(START.pos);
sim.heading = START.heading;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

let stuckFor = 0, unstickFor = 0, unstickSteer = 0;

/** Follows the road toward the target stop. Returns [throttle, steer]. */
function autopilot(target: number, dt: number): [number, number] {
  // pinned against a tree or landmark: back up and swing the other way for a moment
  if (unstickFor > 0) { unstickFor -= dt; return [-1, unstickSteer]; }
  const near = nearestSample(sim.pos);
  const dir = STOP_U[target] >= near.u ? 1 : -1;
  const lookAhead = Math.round(SAMPLE_COUNT * 0.012) + Math.round(Math.abs(sim.speed) * 0.5);
  const aim = SAMPLES[THREE.MathUtils.clamp(near.index + dir * lookAhead, 0, SAMPLE_COUNT)];
  const toStop = Math.hypot(STOP_POS[target].x - sim.pos.x, STOP_POS[target].z - sim.pos.z);
  const goal = toStop < 10 ? STOP_POS[target] : aim;
  const desired = Math.atan2(goal.x - sim.pos.x, goal.z - sim.pos.z);
  const diff = wrapAngle(desired - sim.heading);
  const steer = THREE.MathUtils.clamp(diff * 2.4, -1, 1);
  // aim for a speed that eases to zero at the stop and slows for sharp turns
  let want = Math.min(MAX_ROAD, Math.max(0, toStop - 2.5) * 0.85);
  if (Math.abs(diff) > 0.6) want = Math.min(want, 9);
  const throttle = toStop < 3 ? (sim.speed > 0.3 ? -1 : 0) : THREE.MathUtils.clamp((want - sim.speed) * 0.45, -1, 1);

  if (throttle > 0.3 && Math.abs(sim.speed) < 1.2) stuckFor += dt; else stuckFor = 0;
  if (stuckFor > 1.2) { stuckFor = 0; unstickFor = 0.9; unstickSteer = -Math.sign(steer || 1); }
  return [throttle, steer];
}

/** On foot, the auto is his sidekick: it trails him, keeps its distance, and honks if he wanders off. */
let hornCooldown = 0;
function follow(dt: number): [number, number] {
  if (unstickFor > 0) { unstickFor -= dt; return [-1, unstickSteer]; }
  // near or inside the hall he's on his own: the auto goes to its spot by the door, out of the camera's way
  const e = ENTRANCE(), nearDoor = Math.hypot(walker.pos.x - e.x, walker.pos.z - e.z) < 12;
  const goal = inHall(walker.pos) || nearDoor ? PARKING() : walker.pos;
  const d = Math.hypot(goal.x - sim.pos.x, goal.z - sim.pos.z);
  if (d > 150) { // hopelessly lost: reappear just behind him
    sim.pos.set(walker.pos.x - Math.sin(walker.heading) * 10, 0, walker.pos.z - Math.cos(walker.heading) * 10);
    sim.heading = walker.heading; sim.speed = 0;
    return [0, 0];
  }
  hornCooldown -= dt;
  if (d > 28 && hornCooldown <= 0 && goal === walker.pos) { horn(); hornCooldown = 8; }
  const desired = Math.atan2(goal.x - sim.pos.x, goal.z - sim.pos.z);
  const diff = wrapAngle(desired - sim.heading);
  const steer = THREE.MathUtils.clamp(diff * 2.4, -1, 1);
  if (d < 7) return [sim.speed > 0.3 ? -1 : 0, 0]; // close enough: wait for him
  const want = Math.min(MAX_ROAD, (d - 6) * 1.1);
  const throttle = THREE.MathUtils.clamp((want - sim.speed) * 0.45, -1, 1);
  if (throttle > 0.3 && Math.abs(sim.speed) < 1.2) stuckFor += dt; else stuckFor = 0;
  if (stuckFor > 1.2) { stuckFor = 0; unstickFor = 0.9; unstickSteer = -Math.sign(steer || 1); }
  return [throttle, steer];
}

/** Voice driving: keeps to the road toward the next chapter at the spoken speed; a spoken "left" or "right" steers for a moment. */
function voiceCruise(dt: number): [number, number] {
  const vd = sim.vd;
  if (vd.steerT > 0) vd.steerT -= dt;
  const turning = vd.steerT > 0 ? vd.steer : 0;
  if (vd.speed < 0) return [sim.speed > vd.speed ? -1 : 0, turning];
  if (vd.speed === 0) return [sim.speed > 0.3 ? -1 : sim.speed < -0.3 ? 1 : 0, turning];
  let [throttle, steer] = autopilot(ui.get().nextStop, dt);
  if (turning) steer = turning;
  if (sim.speed > vd.speed) throttle = Math.min(throttle, -0.4);
  return [throttle, steer];
}

function step(dt: number) {
  const s = ui.get();
  let throttle = 0, steer = 0;
  if (s.phase === "ride" && scripted()) {
    throttle = sim.speed > 0.3 ? -1 : sim.speed < -0.3 ? 1 : 0; // hold still while he gets in or out
    if (Math.abs(sim.speed) < 0.3) sim.speed = 0;
  } else if (s.phase === "ride" && s.onFoot) {
    if (s.active === null) [throttle, steer] = follow(dt);
    else throttle = sim.speed > 0.3 ? -0.6 : sim.speed < -0.3 ? 0.6 : 0;
  } else if (s.phase === "ride") {
    if (s.active !== null) {
      // a chapter is open: pull up at the checkpoint, whatever the speed and whatever keys are held
      sim.speed -= Math.sign(sim.speed) * Math.min(Math.abs(sim.speed), 32 * dt);
    } else if (driving()) {
      if (s.target !== null || s.express) ui.set({ target: null, express: false });
      throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    } else if (s.target !== null) {
      [throttle, steer] = autopilot(s.target, dt);
    } else if (s.voiceDrive) {
      [throttle, steer] = voiceCruise(dt);
    }
  }
  sim.throttle = throttle;
  sim.steer += (steer - sim.steer) * Math.min(1, dt * 8);

  const near = nearestSample(sim.pos);
  const onRoad = near.dist < ROAD_HALF + 0.6;
  const max = onRoad ? MAX_ROAD : MAX_OFF;
  if (throttle > 0) sim.speed += (sim.speed < 0 ? BRAKE : ACCEL) * throttle * dt;
  else if (throttle < 0) sim.speed += (sim.speed > 0 ? BRAKE : ACCEL * 0.6) * throttle * dt;
  else sim.speed -= Math.sign(sim.speed) * Math.min(Math.abs(sim.speed), COAST * 4 * dt);
  if (sim.speed > max) sim.speed += (max - sim.speed) * Math.min(1, dt * 3);
  sim.speed = Math.max(MAX_REV, sim.speed);

  const grip = THREE.MathUtils.clamp(Math.abs(sim.speed) / 5, 0, 1) * Math.sign(sim.speed);
  sim.heading += sim.steer * STEER * grip * dt;
  fwd.set(Math.sin(sim.heading), 0, Math.cos(sim.heading));
  sim.pos.addScaledVector(fwd, sim.speed * dt);
  sim.distance += Math.abs(sim.speed * dt);

  // collisions: push out of landmarks and trees
  for (const c of COLLIDERS) {
    const dx = sim.pos.x - c.x, dz = sim.pos.z - c.z, min = c.r + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 1;
      sim.pos.x = c.x + (dx / d) * min; sim.pos.z = c.z + (dz / d) * min;
      if (Math.abs(sim.speed) > 3) { bonk(); sim.shake = Math.max(sim.shake, 0.35); }
      sim.speed *= -0.25;
    }
  }
  sim.pos.x = THREE.MathUtils.clamp(sim.pos.x, -BOUNDS.x, BOUNDS.x);
  sim.pos.z = THREE.MathUtils.clamp(sim.pos.z, -BOUNDS.z, BOUNDS.z);

  // the CPI 7.0 speed breaker
  const bi = STOPS.findIndex((st) => st.id === "comeback");
  const b = STOP_POS[bi];
  if (Math.hypot(sim.pos.x - b.x, sim.pos.z - b.z) < 1.2 && Math.abs(sim.speed) > 3 && sim.lift === 0) {
    sim.liftV = 2.2 + Math.abs(sim.speed) * 0.12; sim.shake = 0.8; bump();
  }
  if (sim.lift > 0 || sim.liftV > 0) {
    sim.liftV -= 20 * dt; sim.lift += sim.liftV * dt;
    if (sim.lift <= 0) { sim.lift = 0; sim.liftV = 0; }
  }
  setEngine(THREE.MathUtils.clamp(Math.abs(sim.speed) / MAX_ROAD * 0.8 + Math.max(0, throttle) * 0.2, 0, 1));
}

const AUTO_URL = "/models/auto.glb";
const AUTO_SCALE = 1.15; // the model is life-size; a touch bigger reads better from the chase cam

export function Auto() {
  const body = useRef<THREE.Group>(null);
  const chassis = useRef<THREE.Group>(null);
  const tail = useRef<THREE.MeshBasicMaterial>(null);
  const tip = useRef({ r: 0, v: 0 });
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    step(dt);
    const g = body.current, c = chassis.current;
    if (!g || !c) return;
    g.position.set(sim.pos.x, sim.lift, sim.pos.z);
    g.rotation.y = sim.heading;
    const ui0 = ui.get();
    g.visible = !(ui0.phase === "intro" && ui0.profile); // out of the way while he's at the mirror
    const t = clock.elapsedTime;
    c.position.y = Math.sin(t * 46) * 0.012 * (1 + Math.abs(sim.speed) * 0.05); // two-stroke shiver
    // body roll on a spring: hard turns at speed tip it up onto two wheels a little, then it rocks back (never over)
    const want = -sim.steer * THREE.MathUtils.clamp(sim.speed / MAX_ROAD, -1, 1) * 0.16;
    tip.current.v += ((want - tip.current.r) * 55 - tip.current.v * 6.5) * dt;
    tip.current.r = THREE.MathUtils.clamp(tip.current.r + tip.current.v * dt, -0.18, 0.18);
    c.rotation.z = tip.current.r;
    c.position.y += Math.abs(tip.current.r) * 0.55; // pivot on the outer wheels, not through the floor
    c.rotation.x = -sim.throttle * 0.025 + sim.liftV * 0.02;
    if (tail.current) tail.current.color.set(sim.throttle < 0 && sim.speed > 0.5 ? "#ff1744" : "#5a0810");
  });

  return (
    <group ref={body}>
      <group ref={chassis} scale={AUTO_SCALE}>
        <Suspense fallback={null}><AutoBody /></Suspense>
        {/* the paint job: plate, slogans and his name on the yellow stripe */}
        <mesh position={[0.56, 0.53, -1.505]}><boxGeometry args={[0.44, 0.16, 0.01]} /><meshStandardMaterial color="#fffde7" /></mesh>
        <Text font={FONT_MONO} position={[0.56, 0.53, -1.512]} rotation-y={Math.PI} fontSize={0.07} color="#111">{ME.plate}</Text>
        <Text font={FONT_SERIF} position={[0, 1.04, -1.505]} rotation-y={Math.PI} fontSize={0.1} color="#111">HORN OK PLEASE</Text>
        <Text font={FONT_SERIF} position={[0, 0.66, -1.505]} rotation-y={Math.PI} fontSize={FIRST ? 0.075 : 0.06} color="#ff80ab">{FIRST ? `Reserved for ${FIRST}` : "buri nazar wale tera muh kala"}</Text>
        {[-0.52, 0.52].map((x) => (
          <mesh key={x} position={[x, 0.82, -1.5]}><boxGeometry args={[0.1, 0.13, 0.01]} /><meshBasicMaterial ref={x < 0 ? tail : undefined} color="#5a0810" toneMapped={false} transparent opacity={0.85} /></mesh>
        ))}
        {[-1, 1].map((s) => (
          <Text font={FONT_SERIF} key={s} position={[0.805 * s, 1.04, -0.75]} rotation-y={(s * Math.PI) / 2} fontSize={0.11} color="#111">{ME.first.toUpperCase()} AUTO</Text>
        ))}
        <Suspense fallback={null}><Driver /></Suspense>
      </group>
      <Exhaust />
    </group>
  );
}

function AutoBody() {
  const { scene } = useGLTF(AUTO_URL);
  useMemo(() => scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }), [scene]);
  return <primitive object={scene} />;
}
useGLTF.preload(AUTO_URL);

/** Mukund himself at the handlebar. He hops out for the title screen and for every chapter. */
function Driver() {
  const { scene } = useGLTF(AVATAR_URL);
  const clips = useActs();
  const me = useMemo(() => {
    const c = cloneSkinned(scene);
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return c;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(me), [me]);
  useEffect(() => { mixer.clipAction(clips.sit).play(); return () => { mixer.stopAllAction(); }; }, [mixer, clips]);
  const ref = useRef<THREE.Group>(null);
  const head = useMemo(() => {
    let h: THREE.Object3D | undefined;
    me.traverse((o) => { if (!h && /(^|:)Head$/.test(o.name)) h = o; });
    return h;
  }, [me]);
  useFrame(({ camera, size }, dt) => {
    const s = ui.get();
    const on = (s.phase === "ride" || s.phase === "finale") && s.active === null && !s.onFoot;
    if (ref.current) ref.current.visible = on;
    if (!on) return;
    mixer.update(Math.min(dt, 0.05));
    sim.talk = Math.max(sim.talk * Math.pow(0.02, Math.min(dt, 0.05)), voiceLevel());
    // his speech bubble follows him at the handlebar
    const p = new THREE.Vector3();
    (head ?? me).getWorldPosition(p);
    p.y += 0.5;
    p.project(camera);
    bubbleAnchor.x = ((p.x + 1) / 2) * size.width;
    bubbleAnchor.y = ((1 - p.y) / 2) * size.height;
    bubbleAnchor.visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
  });
  // hips over the driver's seat, leaning back a little less than in a director's chair
  // undo the auto's scale so he's the same size as when he's walking; same seat as Player's SEAT
  return (
    <group ref={ref} position={[0, SEAT.y / AUTO_SCALE, SEAT.z / AUTO_SCALE]} rotation-x={0.12} scale={1 / AUTO_SCALE}>
      <primitive object={me} />
    </group>
  );
}

/** Puffs of smoke from the back, more when accelerating. */
function Exhaust() {
  const COUNT = 18;
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => Array.from({ length: COUNT }, () => ({ life: 1, x: 0, y: 0, z: 0 })), []);
  const timer = useRef(0), next = useRef(0);
  useFrame((_, dt) => {
    timer.current += dt;
    const rate = sim.throttle > 0 ? 0.045 : 0.22;
    if (timer.current > rate) {
      timer.current = 0;
      const p = parts[next.current]; next.current = (next.current + 1) % COUNT;
      p.life = 0; p.x = 0.45; p.y = 0.45; p.z = -1.45;
    }
    group.current?.children.forEach((m, i) => {
      const p = parts[i];
      p.life = Math.min(1, p.life + dt * 1.2);
      p.y += dt * 0.6; p.z -= dt * (0.4 + Math.max(0, sim.speed) * 0.15);
      m.position.set(p.x, p.y, p.z);
      m.scale.setScalar(0.12 + p.life * 0.55);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - p.life) * 0.35;
    });
  });
  return (
    <group ref={group}>
      {parts.map((_, i) => <mesh key={i}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#d7ccc8" transparent opacity={0} depthWrite={false} /></mesh>)}
    </group>
  );
}

const CHEVRON = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55); s.lineTo(0.62, -0.25); s.lineTo(0.38, -0.25); s.lineTo(0, 0.22); s.lineTo(-0.38, -0.25); s.lineTo(-0.62, -0.25); s.closePath();
  return new THREE.ShapeGeometry(s);
})();

/** A slim chevron floating over the auto, pointing at the next chapter. */
export function NextArrow() {
  const ref = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const s = ui.get(), g = ref.current;
    if (!g) return;
    g.visible = s.phase === "ride" && s.active === null;
    const f = focus();
    const p = guidePoint(f, s.nextStop); // along the road, not as the crow flies
    g.position.set(f.x, 3.5 + sim.lift + Math.sin(clock.elapsedTime * 2.4) * 0.12, f.z);
    g.rotation.y = Math.atan2(p.x - f.x, p.z - f.z);
    mat.current?.color.set(STOPS[s.nextStop].color);
  });
  return (
    <group ref={ref}>
      <mesh geometry={CHEVRON} rotation-x={Math.PI / 2} position-z={0.6}>
        <meshBasicMaterial ref={mat} toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

/** Intro: slow orbit. Riding: smooth chase cam. Chapter open: a cinematic orbit around the landmark. */
export function CameraRig() {
  const { camera } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const lookNow = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const orbitStart = useRef(0);
  const radius = useRef(20);
  const shotT0 = useRef(0);
  const closeDir = useRef(new THREE.Vector3(0, 0, 1));
  const lastActive = useRef<number | null>(null);
  const cutSeen = useRef(0);
  const lastShot = useRef<Shot>("none"); // "none" makes the very first frame a cut straight into the opening shot
  const film = useRef({ kind: "chase" as "chase" | "driveby" | "front" | "drone", until: 0, next: 0, anchor: new THREE.Vector3() });
  const roll = useRef(0);
  const side = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const s = ui.get();
    const cam = camera as THREE.PerspectiveCamera;
    let ease = 1 - Math.exp(-dt * 4.5);
    let kind: Shot = "chase";
    if (s.phase === "intro" && s.profile) {
      kind = "intro";
      // the mirror: over his shoulder, his reflection and the garlanded frame right of centre, clear of the card
      const hero = heroSpot(), toMirror = mirrorDir();
      const tall = cam.aspect < 1;
      const side = new THREE.Vector3(toMirror.z, 0, -toMirror.x);
      const mirror = hero.pos.clone().addScaledVector(toMirror, MIRROR_AT);
      want.copy(hero.pos).addScaledVector(toMirror, tall ? -2.1 : -1.35).addScaledVector(side, tall ? -0.5 : -0.95).setY(1.7);
      look.copy(mirror).setY(tall ? 1.25 : 1.5);
      look.addScaledVector(side, tall ? 0.1 : 0.42);
      ease = 1 - Math.exp(-dt * 2.4);
    } else if (s.phase === "intro") {
      kind = "intro";
      // a composed two-shot: Mukund and his auto on the right third, the title on the left, a slow drift
      const hero = heroSpot();
      const c = hero.pos.clone().lerp(sim.pos, 0.4);
      const tall = cam.aspect < 1;
      const dir = hero.fwd.clone().multiplyScalar(0.85).addScaledVector(hero.right, -0.55).normalize()
        .applyAxisAngle(UP, Math.sin(clock.elapsedTime * 0.12) * 0.18);
      want.copy(c).addScaledVector(dir, tall ? 9.5 : 6.6).setY(tall ? 2.6 : 2.0);
      look.copy(c).setY(tall ? -1.3 : 1.15); // phones: tilt down so he stands in the top half, above the title
      if (!tall) look.addScaledVector(new THREE.Vector3(dir.z, 0, -dir.x), -1.5);
      ease = 1 - Math.exp(-dt * 1.5);
    } else if (s.active !== null) {
      const stop = s.active;
      const establish = ESTABLISH;
      if (lastActive.current !== stop) {
        lastActive.current = stop;
        const c = focusOf(stop);
        const from = Math.atan2(cam.position.x - c.x, cam.position.z - c.z);
        const shot = planShot(c, from);
        orbitStart.current = shot.start; radius.current = shot.r; shotT0.current = clock.elapsedTime;
        closeDir.current = planCloseUp(stop);
      }
      if (beat.cut !== cutSeen.current) { cutSeen.current = beat.cut; shotT0.current = Math.min(shotT0.current, clock.elapsedTime - establish); }
      const since = clock.elapsedTime - shotT0.current;
      if (since < establish) {
        // 1. establishing shot: a slow sweep along an arc checked clear of buildings and trees
        kind = "establish";
        const c = focusOf(stop);
        const k = 0.5 - 0.5 * Math.cos(since * 0.13);
        const a = orbitStart.current + k * SWEEP;
        want.set(c.x + Math.sin(a) * radius.current, c.h, c.z + Math.cos(a) * radius.current);
        // on tall phone screens the story text fills the lower half: tilt down so the landmark sits up top
        look.set(c.x, c.lookY - (cam.aspect < 1 ? 7 : 0), c.z);
        ease = 1 - Math.exp(-dt * 1.6);
      } else {
        // 2. close-up: Mukund by the milestone, landmark behind him, slow push-in
        kind = "close";
        const spot = characterSpot(stop), d = closeDir.current;
        const f = FRAMING[sim.act];
        const dist = f.dist - 0.9 * Math.min(1, (since - establish) / 9);
        want.copy(spot.pos).addScaledVector(d, dist).setY(f.camY);
        const right = new THREE.Vector3(d.z, 0, -d.x); // camera's right when looking along -d
        look.copy(spot.pos).setY(cam.aspect < 1 ? f.lookY - 0.85 : f.lookY);
        if (cam.aspect >= 1) look.addScaledVector(right, -1.1); // frame him on the right third, clear of the text
        ease = 1 - Math.exp(-dt * 2.2);
      }
    } else {
      lastActive.current = null;
      if (s.onFoot) {
        // third person, over his right shoulder
        kind = "foot";
        fwd.set(Math.sin(walker.heading), 0, Math.cos(walker.heading));
        side.set(fwd.z, 0, -fwd.x);
        want.copy(walker.pos).addScaledVector(fwd, -4.4).addScaledVector(side, 0.9).setY(2.15);
        look.copy(walker.pos).addScaledVector(fwd, 4).addScaledVector(side, 0.35).setY(1.45);
        ease = 1 - Math.exp(-dt * 3.5);
      } else {
        fwd.set(Math.sin(sim.heading), 0, Math.cos(sim.heading));
        side.set(fwd.z, 0, -fwd.x);
        const sp = Math.min(1, Math.abs(sim.speed) / MAX_ROAD), t = clock.elapsedTime;
        // hands-free (the film, the map, voice driving): every so often, cut to a film shot and back
        const handsFree = (s.express || s.target !== null || s.voiceDrive) && !driving() && Math.abs(sim.speed) > 5;
        if (!handsFree) { film.current.kind = "chase"; film.current.next = t + 6; }
        else if (film.current.kind === "chase" && t > film.current.next) {
          const shots = ["driveby", "front", "drone"] as const;
          film.current.kind = shots[Math.floor(Math.random() * shots.length)];
          film.current.until = t + 3.6;
          // a drive-by: a low camera planted beside the road ahead, the auto sweeping past it
          film.current.anchor.copy(sim.pos).addScaledVector(fwd, 18 + sim.speed * 0.6).addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * 7.5).setY(1.0);
        } else if (film.current.kind !== "chase" && t > film.current.until) {
          film.current.kind = "chase"; film.current.next = t + 7 + Math.random() * 5;
        }
        kind = film.current.kind === "chase" ? "chase" : film.current.kind;
        if (film.current.kind === "driveby") {
          want.copy(film.current.anchor);
          look.copy(sim.pos).setY(1.3 + sim.lift);
          ease = 1;
        } else if (film.current.kind === "front") {
          // tracking shot from ahead, low, looking back at him
          want.copy(sim.pos).addScaledVector(fwd, 7.5).addScaledVector(side, -1.6).setY(1.15 + sim.lift);
          look.copy(sim.pos).setY(1.5 + sim.lift);
          ease = 1;
        } else if (film.current.kind === "drone") {
          want.copy(sim.pos).addScaledVector(fwd, -9).setY(19);
          look.copy(sim.pos).addScaledVector(fwd, 14);
          ease = 1 - Math.exp(-dt * 6);
        } else {
          // the chase: low, a touch off-centre, pulling back as the speed builds
          want.copy(sim.pos).addScaledVector(fwd, -(7.0 + sp * 2.6)).addScaledVector(side, 1.0).setY(2.55 + sp * 0.5 + sim.lift);
          look.copy(sim.pos).addScaledVector(fwd, 7 + sp * 5).setY(1.4 + sim.lift);
        }
      }
    }
    // a change of shot is a hard cut, like film: never fly the camera through the set to get there.
    // (leaving the intro is the one exception: that glide down to the road is the opening move)
    if (kind !== lastShot.current && lastShot.current !== "intro") {
      cam.position.copy(want);
      lookNow.copy(look);
      cam.fov = fovFor(s.active, 0); cam.updateProjectionMatrix();
    } else {
      cam.position.lerp(want, ease);
      lookNow.lerp(look, Math.min(1, ease * 1.6));
    }
    lastShot.current = kind;
    if (sim.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * sim.shake; cam.position.y += (Math.random() - 0.5) * sim.shake;
      sim.shake = Math.max(0, sim.shake - dt * 2.2);
    }
    cam.lookAt(lookNow);
    // lean into the turns, like a camera car
    const lean = kind === "chase" ? -sim.steer * THREE.MathUtils.clamp(sim.speed / MAX_ROAD, -1, 1) * 0.07 : 0;
    roll.current += (lean - roll.current) * Math.min(1, dt * 4);
    cam.rotateZ(roll.current);
    const fov = kind === "driveby" ? 34 : kind === "drone" ? 50 : fovFor(s.active, s.onFoot ? walker.speed : sim.speed);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * 0.06; cam.updateProjectionMatrix(); }
  });
  return null;
}

type Shot = "none" | "intro" | "chase" | "foot" | "establish" | "close" | "driveby" | "front" | "drone";
const fovFor = (active: number | null, speed: number) => (active !== null ? 42 : 55) + Math.abs(speed) * 0.5;

const SWEEP = 0.9; // radians the chapter camera drifts across
const UP = new THREE.Vector3(0, 1, 0);
const CURVE_TAN = STOP_U.map((u) => CURVE.getTangentAt(u));

/** Close-up framing per act: lower for the floor work, wider for anything acrobatic. */
const FRAMING: Record<Act, { dist: number; camY: number; lookY: number }> = {
  talk: { dist: 6.2, camY: 1.6, lookY: 1.4 },
  idle: { dist: 6.2, camY: 1.6, lookY: 1.4 },
  facepalm: { dist: 5.9, camY: 1.6, lookY: 1.45 },
  pose: { dist: 6.2, camY: 1.6, lookY: 1.35 },
  box: { dist: 6.4, camY: 1.6, lookY: 1.35 },
  lounge: { dist: 5.6, camY: 1.35, lookY: 0.55 },
  sit: { dist: 5.8, camY: 1.4, lookY: 0.85 },
  pushups: { dist: 5.6, camY: 1.5, lookY: 0.45 },
  sneak: { dist: 6.6, camY: 1.5, lookY: 1.05 },
  backflip: { dist: 7.6, camY: 1.7, lookY: 1.45 },
  land: { dist: 7.4, camY: 1.6, lookY: 1.2 },
  dance: { dist: 7.2, camY: 1.6, lookY: 1.3 },
  march: { dist: 7.0, camY: 1.6, lookY: 1.3 },
  run: { dist: 6.8, camY: 1.6, lookY: 1.3 },
  conduct: { dist: 7.0, camY: 1.6, lookY: 1.4 },
};

/** Direction from Mukund to the close-up camera: in front of him, nudged until nothing blocks the shot. */
function planCloseUp(i: number) {
  const spot = characterSpot(i);
  // with a second landmark (Agra), look at him with both behind him: aim mostly at the smaller one
  const B = BESIDE[i];
  if (B) {
    const P = PLACEMENTS[i].pos, mx = P.x * 0.3 + B.pos.x * 0.7, mz = P.z * 0.3 + B.pos.z * 0.7; // the Taj is big enough to fill in from the side
    spot.away.set(spot.pos.x - mx, 0, spot.pos.z - mz).normalize();
  }
  for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
    const d = spot.away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    const x = spot.pos.x + d.x * 5, z = spot.pos.z + d.z * 5;
    if (clearAt(x, z) && sightClear(x, z, spot.pos.x, spot.pos.z)) return d;
  }
  return spot.away.clone();
}

/** True if a camera standing at (x, z) is clear of every landmark and tree. */
function clearAt(x: number, z: number) {
  for (const c of COLLIDERS) {
    if (c.decor) continue;
    const m = c.r + (c.r > 2 ? 4 : 2.4);
    if ((c.x - x) ** 2 + (c.z - z) ** 2 < m * m) return false;
  }
  return true;
}

/** Every milestone stone, so close-ups don't end up staring at the back of one. */
const MILESTONES = STOP_POS.map((p, i) => {
  const h = Math.atan2(CURVE_TAN[i].x, CURVE_TAN[i].z);
  return p.clone().addScaledVector(new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)), -(ROAD_HALF + 2.2));
});

/** True if no tree or milestone stands between the camera and the subject. */
function sightClear(x: number, z: number, fx: number, fz: number) {
  for (const t of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    const px = x + (fx - x) * t, pz = z + (fz - z) * t;
    for (const c of COLLIDERS) {
      if (c.r > 2 || c.decor) continue; // landmarks are the subject; only trees can block the shot
      if ((c.x - px) ** 2 + (c.z - pz) ** 2 < (c.r + 1.6) ** 2) return false;
    }
    for (const m of MILESTONES) if ((m.x - px) ** 2 + (m.z - pz) ** 2 < 1.6 * 1.6) return false;
  }
  return true;
}

/** Picks the clear arc closest to where the camera already is; shrinks the radius if nothing fits. */
function planShot(c: ReturnType<typeof focusOf>, from: number) {
  for (const scale of [1, 0.8, 0.62, 1.25]) {
    const r = c.r * scale;
    let best: number | null = null, bestD = Infinity;
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2;
      let ok = true;
      for (let s = 0; s <= 6 && ok; s++) {
        const a = a0 + (s / 6) * SWEEP;
        const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
        ok = clearAt(x, z) && sightClear(x, z, c.x, c.z);
      }
      if (!ok) continue;
      const d = Math.abs(wrapAngle(a0 + SWEEP / 2 - from));
      if (d < bestD) { bestD = d; best = a0; }
    }
    if (best !== null) return { start: best, r };
  }
  return { start: from - SWEEP / 2, r: c.r };
}

/** The point a chapter's camera orbits: between the auto's stop and its landmark. */
function focusOf(i: number) {
  const P = PLACEMENTS[i], S = STOP_POS[i], A = BESIDE[i];
  if (A) {
    // two landmarks: aim between them and pull back far enough to hold both
    const cx = (P.pos.x + A.pos.x + S.x) / 3, cz = (P.pos.z + A.pos.z + S.z) / 3;
    const span = Math.hypot(P.pos.x - A.pos.x, P.pos.z - A.pos.z);
    return { x: cx, z: cz, r: span * 0.85 + 12, h: 10, lookY: 5 };
  }
  const big = P.radius;
  const cx = big > 0 ? (P.pos.x * 0.65 + S.x * 0.35) : S.x, cz = big > 0 ? (P.pos.z * 0.65 + S.z * 0.35) : S.z;
  return { x: cx, z: cz, r: 14 + big * 1.6, h: 5 + big * 0.45, lookY: 2.5 + big * 0.25 };
}
