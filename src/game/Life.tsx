import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOUNDS, COLLIDERS, CURVE, ROAD_HALF, rng, roadHeading } from "./track";
import { sim, ui, walker } from "./store";
import { bonk, moo } from "./sound";
import { unlock } from "./achievements";
import { featureAt, GAPS } from "./Toys";

/* Life on the road: cows who own it, kites over it. */

const focus = () => (ui.get().onFoot ? walker.pos : sim.pos);
const roadFrame = (u: number) => {
  const p = CURVE.getPointAt(THREE.MathUtils.clamp(u, 0, 1)), h = roadHeading(THREE.MathUtils.clamp(u, 0, 1));
  return { p: new THREE.Vector3(p.x, 0, p.z), h, right: new THREE.Vector3(Math.cos(h), 0, -Math.sin(h)) };
};

/** Pushes the auto (and him) out of a solid circle. Returns true on a fresh hit. */
function solid(x: number, z: number, r: number) {
  let hit = false;
  const s = ui.get();
  const dx = sim.pos.x - x, dz = sim.pos.z - z, min = r + 1.2, d2 = dx * dx + dz * dz;
  if (d2 < min * min && sim.lift < 1) {
    const d = Math.sqrt(d2) || 1;
    sim.pos.x = x + (dx / d) * min; sim.pos.z = z + (dz / d) * min;
    if (Math.abs(sim.speed) > 3) { hit = true; bonk(); sim.shake = Math.max(sim.shake, 0.4); }
    sim.speed *= -0.25;
  }
  if (s.onFoot) {
    const dx = walker.pos.x - x, dz = walker.pos.z - z, min = r + 0.45, d2 = dx * dx + dz * dz;
    if (d2 < min * min) { const d = Math.sqrt(d2) || 1; walker.pos.x = x + (dx / d) * min; walker.pos.z = z + (dz / d) * min; }
  }
  return hit;
}

/* ---------- cows: grazing in the fields beside the road ---------- */
type Cow = { home: THREE.Vector3; away: THREE.Vector3; pos: THREE.Vector3; target: THREE.Vector3; h: number; t: number; mooIn: number; walk: number; pace: number };

function buildCows(): Cow[] {
  const r = rng(11), cows: Cow[] = [];
  GAPS.forEach(([a, b], gap) => {
    if (!featureAt(gap).includes("cows")) return;
    for (const k of [0.3, 0.55, 0.8]) {
      const { p, h, right } = roadFrame(a + (b - a) * k);
      const side = r() < 0.5 ? -1 : 1;
      const out = ROAD_HALF + 7 + r() * 9;
      const home = p.clone().addScaledVector(right, side * out);
      if (COLLIDERS.some((c) => (c.x - home.x) ** 2 + (c.z - home.z) ** 2 < (c.r + 3) ** 2)) continue; // not in a tree
      cows.push({
        home, away: right.clone().multiplyScalar(side), pos: home.clone(), target: home.clone(),
        h: h + (r() - 0.5) * 3, t: 3 + r() * 8, mooIn: 4 + r() * 12, walk: 0, pace: 0.7,
      });
    }
  });
  return cows;
}

function Cows() {
  const cows = useMemo(buildCows, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[][]>([]);
  const heads = useRef<(THREE.Group | null)[]>([]);
  const honks = useRef(sim.honks);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05), s = ui.get(), f = focus(), t = clock.elapsedTime;
    const honked = sim.honks !== honks.current;
    honks.current = sim.honks;
    cows.forEach((c, i) => {
      const dist = Math.hypot(f.x - c.pos.x, f.z - c.pos.z);
      // honk nearby: a moo of protest and a trot further out into the field
      if (honked && dist < 24 && s.phase === "ride") {
        c.mooIn = 0.3; c.pace = 2.1; c.t = 6;
        c.target.copy(c.home).addScaledVector(c.away, 3 + Math.random() * 3);
        unlock("cow");
      }
      if (c.mooIn > 0) {
        c.mooIn -= dt;
        if (c.mooIn <= 0) { if (dist < 30) moo(); c.mooIn = 10 + Math.random() * 16; }
      }
      // graze a while, then amble to another patch nearby (never back onto the road)
      c.t -= dt;
      if (c.t <= 0) {
        c.t = 6 + Math.random() * 9; c.pace = 0.7;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
        c.target.set(c.home.x + Math.cos(a) * r, 0, c.home.z + Math.sin(a) * r).addScaledVector(c.away, 1.5);
      }
      c.walk = 0;
      const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const want = Math.atan2(dx, dz);
        c.h += Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h)) * Math.min(1, dt * 2.5);
        const step = Math.min(d, c.pace * dt);
        c.pos.x += (dx / d) * step; c.pos.z += (dz / d) * step; c.walk = c.pace > 1 ? 1.4 : 1;
      }
      if (s.phase === "ride" && solid(c.pos.x, c.pos.z, 0.9)) moo();
      const g = refs.current[i];
      if (g) { g.position.copy(c.pos); g.rotation.y = c.h; }
      legs.current[i]?.forEach((leg, k) => { if (leg) leg.rotation.x = Math.min(1, c.walk) * Math.sin(t * 7 * c.walk + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.45; });
      const hd = heads.current[i];
      if (hd) hd.rotation.x = c.walk ? 0.15 : 0.45 + Math.sin(t * 0.8 + i) * 0.25; // head down, grazing
    });
  });
  return (
    <group>
      {cows.map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <CowBody legRefs={(k, el) => { (legs.current[i] ??= [])[k] = el; }} headRef={(el) => { heads.current[i] = el; }} />
        </group>
      ))}
    </group>
  );
}

const COW_WHITE = new THREE.MeshStandardMaterial({ color: "#efe7da", roughness: 0.9 });
const COW_DARK = new THREE.MeshStandardMaterial({ color: "#3b2e28", roughness: 0.8 });
const COW_HORN = new THREE.MeshStandardMaterial({ color: "#d7c9a7", roughness: 0.6 });
function CowBody({ legRefs, headRef }: { legRefs: (k: number, el: THREE.Group | null) => void; headRef: (el: THREE.Group | null) => void }) {
  return (
    <group>
      <mesh position={[0, 1.05, 0]} material={COW_WHITE} castShadow><boxGeometry args={[0.62, 0.62, 1.45]} /></mesh>
      {/* the zebu hump and dewlap */}
      <mesh position={[0, 1.42, 0.42]} material={COW_WHITE} castShadow><sphereGeometry args={[0.22, 10, 8]} /></mesh>
      <mesh position={[0, 0.78, 0.66]} material={COW_WHITE}><boxGeometry args={[0.16, 0.3, 0.3]} /></mesh>
      {[[-0.22, 0.5], [0.22, 0.5], [-0.22, -0.55], [0.22, -0.55]].map(([x, z], k) => (
        // each leg swings from the hip
        <group key={k} ref={(el) => legRefs(k, el)} position={[x, 0.78, z]}>
          <mesh position-y={-0.39} material={COW_WHITE} castShadow><boxGeometry args={[0.14, 0.78, 0.14]} /></mesh>
        </group>
      ))}
      <group ref={headRef} position={[0, 1.2, 0.78]}>
        <mesh position={[0, 0, 0.22]} material={COW_WHITE} castShadow><boxGeometry args={[0.34, 0.36, 0.46]} /></mesh>
        <mesh position={[0, -0.08, 0.47]} material={COW_DARK}><boxGeometry args={[0.28, 0.2, 0.06]} /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.15, 0.25, 0.12]} rotation-z={sd * -0.5} material={COW_HORN}><coneGeometry args={[0.04, 0.26, 6]} /></mesh>)}
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.22, 0.08, 0.1]} rotation-z={sd * 0.9} material={COW_WHITE}><boxGeometry args={[0.16, 0.06, 0.1]} /></mesh>)}
      </group>
      <mesh position={[0, 1.05, -0.78]} rotation-x={0.4} material={COW_DARK}><boxGeometry args={[0.05, 0.6, 0.05]} /></mesh>
    </group>
  );
}

/* ---------- kites over the road ---------- */
function Kites() {
  const kites = useMemo(() => {
    const r = rng(5);
    const colors = ["#ff3d00", "#ffd600", "#00c853", "#2979ff", "#d500f9", "#ff4081", "#ff9100"];
    return Array.from({ length: 9 }, (_, i) => {
      const p = CURVE.getPointAt((i + 0.5) / 9);
      const anchor = new THREE.Vector3(p.x + (r() - 0.5) * 60, 0, p.z + (r() - 0.5) * 60);
      anchor.x = THREE.MathUtils.clamp(anchor.x, -BOUNDS.x, BOUNDS.x); anchor.z = THREE.MathUtils.clamp(anchor.z, -BOUNDS.z, BOUNDS.z);
      const kite = anchor.clone().add(new THREE.Vector3((r() - 0.5) * 14, 26 + r() * 22, (r() - 0.5) * 14));
      // just the top stretch of string: a full line to the ground reads as a glitch, not a kite
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([kite, kite]), new THREE.LineBasicMaterial({ color: "#fff3e0", transparent: true, opacity: 0.3 }));
      return { anchor, kite, color: colors[i % colors.length], phase: r() * 10, line };
    });
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    kites.forEach((k, i) => {
      const g = refs.current[i];
      if (!g) return;
      const x = k.kite.x + Math.sin(t * 0.5 + k.phase) * 2.2, y = k.kite.y + Math.sin(t * 0.8 + k.phase * 2) * 1.2, z = k.kite.z + Math.cos(t * 0.4 + k.phase) * 2;
      g.position.set(x, y, z);
      g.rotation.set(0.25, Math.atan2(k.anchor.x - x, k.anchor.z - z), Math.sin(t * 1.3 + k.phase) * 0.35);
      const pos = k.line.geometry.attributes.position as THREE.BufferAttribute;
      const down = new THREE.Vector3(k.anchor.x - x, k.anchor.y - y, k.anchor.z - z).normalize().multiplyScalar(16);
      pos.setXYZ(0, x, y - 0.9, z); pos.setXYZ(1, x + down.x, y - 0.9 + down.y, z + down.z); pos.needsUpdate = true;
    });
  });
  return (
    <group>
      {kites.map((k, i) => (
        <group key={i}>
          <primitive object={k.line} />
          <group ref={(el) => { refs.current[i] = el; }}>
            {/* a patang: paper diamond, bamboo cross, a little tail */}
            <mesh rotation-z={Math.PI / 4}><planeGeometry args={[1.5, 1.5]} /><meshLambertMaterial color={k.color} side={THREE.DoubleSide} /></mesh>
            <mesh position-z={0.02}><boxGeometry args={[0.04, 2.1, 0.02]} /><meshLambertMaterial color="#5d4037" /></mesh>
            <mesh position={[0, 0.25, 0.02]}><boxGeometry args={[2.0, 0.04, 0.02]} /><meshLambertMaterial color="#5d4037" /></mesh>
            {[-1.2, -1.55].map((y, n) => <mesh key={y} position-y={y} rotation-z={n ? 0.5 : -0.5}><planeGeometry args={[0.3, 0.16]} /><meshLambertMaterial color="#fff8e1" side={THREE.DoubleSide} /></mesh>)}
          </group>
        </group>
      ))}
    </group>
  );
}

export function Life() {
  return (
    <>
      <Cows />
      <Kites />
    </>
  );
}
