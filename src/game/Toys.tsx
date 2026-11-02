import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STOPS } from "../content";
import { CURVE, ROAD_HALF, STOP_U, rng, roadHeading } from "./track";
import { sim, ui, walker } from "./store";
import { clack, coin, smash, whoosh, bump } from "./sound";
import { count, unlock } from "./achievements";

/*
 * The toy box along the road: things to smash, coins to grab, ramps to fly off.
 * Everything is placed in the gaps between chapters, clear of where the auto parks.
 */

const L = CURVE.getLength();
const UP = new THREE.Vector3(0, 1, 0);

function frameAt(u: number) {
  const p = CURVE.getPointAt(u);
  const h = roadHeading(u);
  return { p: new THREE.Vector3(p.x, 0, p.z), h, fwd: new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), right: new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)) };
}

/** The stretches of road between chapters, as [from, to] in curve units. */
export const GAPS = STOP_U.slice(0, -1).map((u, i) => [u + 14 / L, STOP_U[i + 1] - 14 / L] as const);
const FEATURES = ["cones", "matka", "ramp", "cows", "crates", "ramp", "matka", "cows+cones", "ramp", "matka+crates", "cones+cows"];
export const featureAt = (gap: number) => FEATURES[gap % FEATURES.length];

/* ---------- particles: one pool for shards, sparkles and dust ---------- */
const MAX_P = 420;
const parts = Array.from({ length: MAX_P }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.1, color: new THREE.Color() }));
let nextP = 0;
export function burst(at: THREE.Vector3, color: string, n: number, speed: number, size = 0.09, up = 1) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const p = parts[nextP]; nextP = (nextP + 1) % MAX_P;
    p.life = p.max = 0.6 + Math.random() * 0.7;
    p.pos.copy(at);
    p.vel.set((Math.random() - 0.5) * speed, (0.4 + Math.random()) * speed * up, (Math.random() - 0.5) * speed);
    p.size = size * (0.6 + Math.random() * 0.8);
    p.color.copy(c).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
  }
}

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05), im = mesh.current;
    if (!im) return;
    parts.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= 14 * dt;
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.03) { p.pos.y = 0.03; p.vel.multiplyScalar(0.4); p.vel.y *= -0.3; }
      }
      s.setScalar(p.life > 0 ? p.size * Math.min(1, (p.life / p.max) * 2) : 0);
      q.setFromAxisAngle(UP, i);
      im.setMatrixAt(i, m.compose(p.pos, q, s));
      im.setColorAt(i, p.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_P]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

/* ---------- knockables ---------- */
type Kind = "matka" | "cone" | "crate";
type Toy = {
  kind: Kind; stack: number; home: THREE.Vector3; homeRot: number;
  pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3;
  state: "rest" | "fly" | "down" | "gone" | "spawn"; t: number; delay: number;
};
const GROUND: Record<Kind, number> = { matka: 0.3, cone: 0.18, crate: 0.34 };
const COLOR: Record<Kind, string> = { matka: "#b5582e", cone: "#ff6d00", crate: "#9c6b3e" };

function buildToys(): Toy[] {
  const r = rng(77), toys: Toy[] = [];
  let stack = 0;
  const add = (kind: Kind, at: THREE.Vector3, h: number) =>
    toys.push({ kind, stack, home: at.clone(), homeRot: h, pos: at.clone(), vel: new THREE.Vector3(), rot: new THREE.Euler(0, h, 0), spin: new THREE.Vector3(), state: "rest", t: 0, delay: 0 });
  GAPS.forEach(([a, b], gap) => {
    const f = featureAt(gap);
    if (f.includes("matka")) {
      // a potter's pyramid at each road edge: 3, 2, 1
      for (const side of [-1, 1]) {
        const { p, h, fwd, right } = frameAt(a + (b - a) * (side < 0 ? 0.3 : 0.6));
        const base = p.clone().addScaledVector(right, side * (ROAD_HALF - 0.9));
        [[-0.68, 0], [0, 0], [0.68, 0], [-0.34, 1], [0.34, 1], [0, 2]].forEach(([x, row]) =>
          add("matka", base.clone().addScaledVector(fwd, x).setY(row * 0.62), h + r() * 6));
        stack++;
      }
    }
    if (f.includes("cones")) {
      // a slalom down the middle of the road
      for (let k = 0; k < 7; k++) {
        const { p, h, right } = frameAt(a + (b - a) * (0.2 + k * 0.1));
        add("cone", p.clone().addScaledVector(right, (k % 2 ? 1 : -1) * 1.4), h);
        stack++;
      }
    }
    if (f.includes("crates")) {
      const { p, h, fwd, right } = frameAt(a + (b - a) * 0.75);
      const base = p.clone().addScaledVector(right, ROAD_HALF - 1.2);
      [[-0.38, 0, 0], [0.38, 0, 0], [0, 0, 0.75], [0, 1, 0.3]].forEach(([x, row, z]) =>
        add("crate", base.clone().addScaledVector(fwd, x).addScaledVector(right, -z).setY(row * 0.7), h));
      stack++;
    }
  });
  return toys;
}

function hitToy(t: Toy, push: THREE.Vector3, power: number, toys: Toy[]) {
  if (t.state !== "rest") return;
  t.state = "fly"; t.t = 0;
  t.vel.copy(push).multiplyScalar(power);
  t.vel.y = 3 + Math.random() * 2.5 + power * 0.12;
  t.spin.set((Math.random() - 0.5) * power, (Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
  if (t.kind === "matka") count("matkas");
  else if (t.kind === "cone") { count("cones"); clack(); }
  else { ui.set({ smashed: ui.get().smashed + 1 }); clack(); }
  // whatever was stacked on it comes down too
  for (const o of toys) if (o !== t && o.stack === t.stack && o.state === "rest" && o.home.y > t.home.y) {
    o.state = "fly"; o.t = 0; o.delay = 0.05 + Math.random() * 0.15;
    o.vel.set((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2).addScaledVector(push, power * 0.25);
    o.spin.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  }
}

function Knockables() {
  const toys = useMemo(buildToys, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05), s = ui.get();
    const fwd = tmp.set(Math.sin(sim.heading), 0, Math.cos(sim.heading)).clone();
    const wf = new THREE.Vector3(Math.sin(walker.heading), 0, Math.cos(walker.heading));
    toys.forEach((t, i) => {
      // hits: the auto (unless it's flying over), or Mukund on foot
      if (t.state === "rest" && s.phase === "ride") {
        const dx = t.pos.x - sim.pos.x, dz = t.pos.z - sim.pos.z;
        if (!s.onFoot && dx * dx + dz * dz < 1.75 * 1.75 && Math.abs(sim.speed) > 1.5 && sim.lift < 1.1) {
          const away = new THREE.Vector3(dx, 0, dz).normalize();
          hitToy(t, fwd.clone().multiplyScalar(Math.sign(sim.speed)).add(away.multiplyScalar(0.6)), Math.abs(sim.speed) * 0.75, toys);
        } else if (s.onFoot) {
          const wx = t.pos.x - walker.pos.x, wz = t.pos.z - walker.pos.z;
          if (wx * wx + wz * wz < 0.8 && Math.abs(walker.speed) > 1) hitToy(t, wf.clone().add(new THREE.Vector3(wx, 0, wz).normalize()), 4.5, toys);
        }
      }
      if (t.state === "fly") {
        if (t.delay > 0) { t.delay -= dt; }
        else {
          t.t += dt;
          t.vel.y -= 22 * dt;
          t.pos.addScaledVector(t.vel, dt);
          t.rot.x += t.spin.x * dt; t.rot.y += t.spin.y * dt; t.rot.z += t.spin.z * dt;
          const g = GROUND[t.kind];
          if (t.pos.y < g && t.vel.y < 0) {
            if (t.kind === "matka" && (t.vel.y < -2.5 || t.vel.length() > 5)) {
              // crash: it's clay
              t.state = "gone"; t.t = 0;
              burst(t.pos, "#b5582e", 14, 5, 0.12); burst(t.pos, "#e8c9a0", 5, 3, 0.06);
              smash();
            } else {
              t.pos.y = g; t.vel.y *= -0.35; t.vel.x *= 0.6; t.vel.z *= 0.6; t.spin.multiplyScalar(0.6);
              if (Math.abs(t.vel.y) < 0.6 && t.vel.length() < 0.8) { t.state = "down"; t.rot.x = Math.PI / 2; t.rot.z = 0; t.t = 0; }
              else if (t.kind === "crate") burst(t.pos, "#c9a56d", 3, 2, 0.06);
            }
          }
        }
      } else if (t.state === "down" || t.state === "gone") {
        // a while later, quietly put back (once nobody is standing on the spot)
        t.t += dt;
        const f = s.onFoot ? walker.pos : sim.pos;
        if (t.t > 10 && Math.hypot(f.x - t.home.x, f.z - t.home.z) > 7) { t.state = "spawn"; t.t = 0; t.pos.copy(t.home); t.rot.set(0, t.homeRot, 0); t.vel.set(0, 0, 0); }
      } else if (t.state === "spawn") {
        t.t += dt;
        if (t.t > 0.4) t.state = "rest";
      }
      const g = refs.current[i];
      if (g) {
        g.visible = t.state !== "gone";
        g.position.copy(t.pos);
        g.rotation.copy(t.rot);
        g.scale.setScalar(t.state === "spawn" ? Math.min(1, t.t / 0.4) : 1);
      }
    });
  });
  return (
    <group>
      {toys.map((t, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          {t.kind === "matka" && <Matka />}
          {t.kind === "cone" && <Cone />}
          {t.kind === "crate" && <mesh position-y={0.34} castShadow><boxGeometry args={[0.68, 0.68, 0.68]} /><meshStandardMaterial color={COLOR.crate} roughness={0.9} /></mesh>}
        </group>
      ))}
    </group>
  );
}

const MATKA_GEO = new THREE.LatheGeometry(
  [[0.02, 0], [0.17, 0.02], [0.29, 0.12], [0.33, 0.27], [0.29, 0.43], [0.18, 0.53], [0.13, 0.57], [0.16, 0.61], [0.15, 0.63]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
const MATKA_MAT = new THREE.MeshStandardMaterial({ color: COLOR.matka, roughness: 0.85 });
function Matka() {
  return (
    <mesh geometry={MATKA_GEO} material={MATKA_MAT} castShadow />
  );
}
function Cone() {
  return (
    <group>
      <mesh position-y={0.025}><boxGeometry args={[0.44, 0.05, 0.44]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh position-y={0.37} castShadow><coneGeometry args={[0.2, 0.68, 14]} /><meshStandardMaterial color={COLOR.cone} roughness={0.6} /></mesh>
      <mesh position-y={0.42}><cylinderGeometry args={[0.105, 0.135, 0.12, 14]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
    </group>
  );
}

/* ---------- coins ---------- */
type Coin = { home: THREE.Vector3; taken: boolean; t: number };

/** Lines of coins weaving down the road, and arcs over every ramp. */
function buildCoins(ramps: Ramp[]): Coin[] {
  const coins: Coin[] = [];
  GAPS.forEach(([a, b], gap) => {
    if (featureAt(gap) === "ramp") return;
    for (let k = 0; k < 6; k++) {
      const { p, right } = frameAt(a + (b - a) * (0.15 + k * 0.13));
      coins.push({ home: p.clone().addScaledVector(right, Math.sin(k * 0.9 + gap) * 2).setY(1.1), taken: false, t: 0 });
    }
  });
  for (const r of ramps) {
    // the arc a full-speed jump flies through
    for (let k = 0; k < 7; k++) {
      const d = 3 + k * 2.6, y = 1.3 + Math.sin((k / 6) * Math.PI) * 2.6;
      coins.push({ home: r.pos.clone().addScaledVector(r.fwd, d).setY(y), taken: false, t: 0 });
    }
  }
  return coins;
}

function Coins({ ramps }: { ramps: Ramp[] }) {
  const coins = useMemo(() => buildCoins(ramps), [ramps]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05), s = ui.get(), t = clock.elapsedTime;
    coins.forEach((c, i) => {
      if (!c.taken && s.phase === "ride") {
        const f = s.onFoot ? walker.pos : sim.pos, y = s.onFoot ? 1 : sim.lift + 1.1;
        const d = Math.hypot(f.x - c.home.x, f.z - c.home.z, (y - c.home.y) * 0.8);
        if (d < (s.onFoot ? 1.1 : 1.8)) {
          c.taken = true; c.t = 0;
          burst(c.home, "#ffd54f", 10, 3.5, 0.07);
          coin(); count("coins");
        }
      } else if (c.taken) {
        c.t += dt;
        if (c.t > 45) c.taken = false;
      }
      const g = refs.current[i];
      if (g) {
        g.visible = !c.taken;
        g.rotation.y = t * 3 + i;
        g.position.set(c.home.x, c.home.y + Math.sin(t * 2.5 + i) * 0.12, c.home.z);
      }
    });
  });
  return (
    <group>
      {coins.map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh rotation-x={Math.PI / 2} geometry={COIN_GEO} material={COIN_MAT} />
        </group>
      ))}
    </group>
  );
}
const COIN_GEO = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 20);
const COIN_MAT = new THREE.MeshStandardMaterial({ color: "#ffc93c", emissive: "#ff9f1a", emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3 });

/* ---------- ramps ---------- */
type Ramp = { pos: THREE.Vector3; h: number; fwd: THREE.Vector3; right: THREE.Vector3 };
const RAMP_LEN = 4.2, RAMP_H = 1.15, RAMP_W = 3;

function buildRamps(): Ramp[] {
  const out: Ramp[] = [];
  GAPS.forEach(([a, b], gap) => {
    if (featureAt(gap) !== "ramp") return;
    const { p, h, fwd, right } = frameAt(a + (b - a) * 0.3);
    out.push({ pos: p, h, fwd, right });
  });
  return out;
}

/** A wedge: low end at -RAMP_LEN/2, lip at +RAMP_LEN/2, along +z. */
const RAMP_GEO = (() => {
  const s = new THREE.Shape();
  s.moveTo(-RAMP_LEN / 2, 0); s.lineTo(RAMP_LEN / 2, 0); s.lineTo(RAMP_LEN / 2, RAMP_H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: RAMP_W, bevelEnabled: false });
  g.translate(0, 0, -RAMP_W / 2);
  g.rotateY(-Math.PI / 2); // shape's x becomes the ramp's z
  return g;
})();

function Ramps({ ramps }: { ramps: Ramp[] }) {
  const slope = Math.atan2(RAMP_H, RAMP_LEN);
  const len = Math.hypot(RAMP_H, RAMP_LEN);
  useFrame((_, raw) => {
    const s = ui.get();
    if (s.phase !== "ride" || s.onFoot) return;
    if (sim.airStart >= 0) sim.airStart += Math.min(raw, 0.05); // counts game time in the air
    for (const r of ramps) {
      const dx = sim.pos.x - r.pos.x, dz = sim.pos.z - r.pos.z;
      const along = dx * r.fwd.x + dz * r.fwd.z, lat = dx * r.right.x + dz * r.right.z;
      const aligned = Math.cos(sim.heading - r.h) > 0.55;
      if (Math.abs(lat) > RAMP_W / 2 + 0.2 || !aligned || sim.speed < 2 || sim.liftV > 0.5) continue;
      if (along > -RAMP_LEN / 2 && along < RAMP_LEN / 2 - 0.3) {
        // riding up the slope
        sim.lift = Math.max(sim.lift, ((along + RAMP_LEN / 2) / RAMP_LEN) * RAMP_H);
        sim.liftV = 0;
      } else if (along >= RAMP_LEN / 2 - 0.3 && along < RAMP_LEN / 2 + 0.8 && sim.lift > RAMP_H * 0.6) {
        // off the lip
        sim.liftV = 2.5 + sim.speed * 0.42;
        sim.airStart = 0;
        whoosh();
      }
    }
    // touchdown: score the jump
    if (sim.airStart >= 0 && sim.lift === 0 && sim.liftV === 0) {
      const air = sim.airStart;
      sim.airStart = -1;
      if (air > 0.35) {
        count("jumps");
        if (air >= 1) unlock("air");
        burst(sim.pos.clone().setY(0.1), "#d9b98a", 18, 4, 0.12, 0.5);
        sim.shake = Math.max(sim.shake, 0.5); bump();
        ui.set({ reply: `Air time: ${air.toFixed(2)} s` });
      }
    }
  });
  return (
    <group>
      {ramps.map((r, i) => (
        <group key={i} position={r.pos} rotation-y={r.h}>
          <mesh geometry={RAMP_GEO} castShadow receiveShadow><meshStandardMaterial color="#f7c600" roughness={0.7} /></mesh>
          {/* black chevrons on the slope */}
          {[-1.4, -0.5, 0.4, 1.3].map((z) => (
            <mesh key={z} position={[0, ((z + RAMP_LEN / 2) / RAMP_LEN) * RAMP_H + 0.012, z]} rotation-x={-Math.PI / 2 - slope}>
              <planeGeometry args={[RAMP_W * 0.98, len / 10]} /><meshStandardMaterial color="#141414" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------- small goals that don't belong to any one toy ---------- */
function Watchers() {
  useFrame(() => {
    const s = ui.get();
    if (s.phase !== "ride") return;
    if (!s.onFoot && Math.abs(sim.speed) * 3.6 >= 70) unlock("speed");
    if (s.visited.length >= 6) unlock("half");
    if (s.visited.length >= STOPS.length) unlock("all");
  });
  return null;
}

export function Toys() {
  const ramps = useMemo(buildRamps, []);
  return (
    <>
      <Knockables />
      <Ramps ramps={ramps} />
      <Coins ramps={ramps} />
      <Particles />
      <Watchers />
    </>
  );
}
