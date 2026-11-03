import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOUNDS, COLLIDERS, CURVE, ROAD_HALF, rng, roadHeading } from "./track";
import { sim, ui, walker } from "./store";
import { bonk } from "./sound";
import { unlock } from "./achievements";
import { featureAt, GAPS } from "./Toys";

/* Life on the road: cows who own it, dogs who patrol it, goats who don't care, kites over it. */

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
type Cow = { home: THREE.Vector3; away: THREE.Vector3; pos: THREE.Vector3; target: THREE.Vector3; h: number; t: number; walk: number; pace: number };

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
        h: h + (r() - 0.5) * 3, t: 3 + r() * 8, walk: 0, pace: 0.7,
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
      // honk nearby: a trot further out into the field
      if (honked && dist < 24 && s.phase === "ride") {
        c.pace = 2.1; c.t = 6;
        c.target.copy(c.home).addScaledVector(c.away, 3 + Math.random() * 3);
        unlock("cow");
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
      if (s.phase === "ride") solid(c.pos.x, c.pos.z, 0.9);
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

/* ---------- dogs and goats: smaller, quicker, in every stretch without cows ---------- */
type Critter = { kind: "dog" | "goat"; home: THREE.Vector3; pos: THREE.Vector3; target: THREE.Vector3; h: number; t: number; walk: number; pace: number; sit: number };

function buildCritters(): Critter[] {
  const r = rng(23), out: Critter[] = [];
  GAPS.forEach(([a, b], gap) => {
    if (featureAt(gap).includes("cows")) return;
    const kind = gap % 2 ? "goat" : "dog";
    const n = kind === "dog" ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const { p, right } = roadFrame(a + (b - a) * (0.3 + k * 0.18 + r() * 0.06));
      const side = (gap + k) % 2 ? 1 : -1;
      const home = p.clone().addScaledVector(right, side * (ROAD_HALF + (kind === "dog" ? 2.5 : 6) + r() * 5));
      if (COLLIDERS.some((c) => (c.x - home.x) ** 2 + (c.z - home.z) ** 2 < (c.r + 2) ** 2)) continue;
      out.push({ kind, home, pos: home.clone(), target: home.clone(), h: r() * 6.28, t: r() * 5, walk: 0, pace: 1, sit: 0 });
    }
  });
  return out;
}

function Critters() {
  const all = useMemo(buildCritters, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[][]>([]);
  const tails = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const honks = useRef(sim.honks);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05), s = ui.get(), f = focus(), t = clock.elapsedTime;
    const honked = sim.honks !== honks.current;
    honks.current = sim.honks;
    all.forEach((c, i) => {
      const dist = Math.hypot(f.x - c.pos.x, f.z - c.pos.z);
      if (dist > 90) return; // too far to see: don't bother
      // dogs trot over to see who's coming; a honk sends everyone scampering
      if (honked && dist < 22) { c.pace = 3.2; c.t = 3; c.sit = 0; c.target.copy(c.home).add(new THREE.Vector3(c.pos.x - f.x, 0, c.pos.z - f.z).setLength(5)); }
      c.t -= dt;
      if (c.t <= 0) {
        c.t = 3 + Math.random() * 6; c.pace = c.kind === "dog" ? 1.6 : 0.6;
        c.sit = c.kind === "dog" && Math.random() < 0.35 ? 1 : 0;
        const curious = c.kind === "dog" && dist < 16 && Math.random() < 0.6;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 3;
        if (curious) c.target.set(c.home.x + (f.x - c.home.x) * 0.35, 0, c.home.z + (f.z - c.home.z) * 0.35);
        else c.target.set(c.home.x + Math.cos(a) * rr, 0, c.home.z + Math.sin(a) * rr);
      }
      c.walk = 0;
      const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.15 && !(c.sit && d < 1)) {
        const want = Math.atan2(dx, dz);
        c.h += Math.atan2(Math.sin(want - c.h), Math.cos(want - c.h)) * Math.min(1, dt * 4);
        const step = Math.min(d, c.pace * dt);
        c.pos.x += (dx / d) * step; c.pos.z += (dz / d) * step; c.walk = c.pace > 2 ? 1.6 : 1;
      }
      if (s.phase === "ride") solid(c.pos.x, c.pos.z, 0.45);
      const g = refs.current[i];
      if (g) { g.position.copy(c.pos); g.rotation.y = c.h; }
      const sitting = c.sit && !c.walk;
      const bd = bodies.current[i];
      if (bd) bd.rotation.x = THREE.MathUtils.lerp(bd.rotation.x, sitting ? -0.45 : 0, Math.min(1, dt * 6));
      legs.current[i]?.forEach((leg, k) => { if (leg) leg.rotation.x = Math.min(1, c.walk) * Math.sin(t * 11 * c.walk + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.55; });
      const tl = tails.current[i];
      if (tl) tl.rotation.y = c.kind === "dog" ? Math.sin(t * (dist < 14 ? 16 : 6) + i) * 0.6 : Math.sin(t * 3 + i) * 0.2; // a dog wags harder when you're near
    });
  });
  return (
    <group>
      {all.map((c, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <group ref={(el) => { bodies.current[i] = el; }}>
            {c.kind === "dog"
              ? <DogBody coat={["#c8925a", "#e0c08f", "#3a2a20", "#a8744a"][i % 4]} legRef={(k, el) => { (legs.current[i] ??= [])[k] = el; }} tailRef={(el) => { tails.current[i] = el; }} />
              : <GoatBody coat={i % 3 ? "#f1ece2" : "#4a3b31"} legRef={(k, el) => { (legs.current[i] ??= [])[k] = el; }} tailRef={(el) => { tails.current[i] = el; }} />}
          </group>
        </group>
      ))}
    </group>
  );
}

type BodyProps = { coat: string; legRef: (k: number, el: THREE.Group | null) => void; tailRef: (el: THREE.Group | null) => void };

/** An Indian street dog: lean, tan, ears up, tail curled. */
function DogBody({ coat, legRef, tailRef }: BodyProps) {
  const fur = useMemo(() => new THREE.MeshStandardMaterial({ color: coat, roughness: 0.95 }), [coat]);
  return (
    <group>
      <mesh position={[0, 0.52, 0]} material={fur} castShadow><boxGeometry args={[0.28, 0.28, 0.78]} /></mesh>
      <mesh position={[0, 0.5, 0.3]} material={fur} castShadow><boxGeometry args={[0.3, 0.32, 0.26]} /></mesh>
      {[[-0.1, 0.28], [0.1, 0.28], [-0.1, -0.28], [0.1, -0.28]].map(([x, z], k) => (
        <group key={k} ref={(el) => legRef(k, el)} position={[x, 0.42, z]}>
          <mesh position-y={-0.21} material={fur} castShadow><boxGeometry args={[0.07, 0.42, 0.07]} /></mesh>
        </group>
      ))}
      <group position={[0, 0.72, 0.46]}>
        <mesh position={[0, 0, 0.06]} material={fur} castShadow><boxGeometry args={[0.24, 0.22, 0.24]} /></mesh>
        <mesh position={[0, -0.04, 0.23]} material={fur}><boxGeometry args={[0.13, 0.11, 0.16]} /></mesh>
        <mesh position={[0, -0.02, 0.315]}><boxGeometry args={[0.06, 0.05, 0.02]} /><meshStandardMaterial color="#1a1208" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.08, 0.15, 0.02]} rotation-z={sd * -0.25} material={fur}><coneGeometry args={[0.045, 0.13, 4]} /></mesh>)}
      </group>
      <group ref={tailRef} position={[0, 0.62, -0.38]}>
        <mesh position={[0, 0.12, -0.04]} rotation-x={-0.6} material={fur}><cylinderGeometry args={[0.025, 0.035, 0.3, 5]} /></mesh>
      </group>
    </group>
  );
}

/** A goat: boxy, bearded, small horns, a stubby tail. */
function GoatBody({ coat, legRef, tailRef }: BodyProps) {
  const fur = useMemo(() => new THREE.MeshStandardMaterial({ color: coat, roughness: 0.95 }), [coat]);
  return (
    <group>
      <mesh position={[0, 0.62, 0]} material={fur} castShadow><boxGeometry args={[0.38, 0.38, 0.82]} /></mesh>
      {[[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]].map(([x, z], k) => (
        <group key={k} ref={(el) => legRef(k, el)} position={[x, 0.46, z]}>
          <mesh position-y={-0.23} material={fur} castShadow><boxGeometry args={[0.08, 0.46, 0.08]} /></mesh>
        </group>
      ))}
      <group position={[0, 0.86, 0.46]} rotation-x={0.35}>
        <mesh position={[0, 0, 0.08]} material={fur} castShadow><boxGeometry args={[0.2, 0.24, 0.3]} /></mesh>
        <mesh position={[0, -0.17, 0.16]}><boxGeometry args={[0.05, 0.12, 0.05]} /><meshStandardMaterial color="#d8d0c2" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.06, 0.16, -0.02]} rotation-x={-0.5} rotation-z={sd * -0.2}><coneGeometry args={[0.025, 0.16, 5]} /><meshStandardMaterial color="#8d7b62" /></mesh>)}
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.13, 0.04, 0.02]} rotation-z={sd * 1.1} material={fur}><boxGeometry args={[0.12, 0.04, 0.07]} /></mesh>)}
      </group>
      <group ref={tailRef} position={[0, 0.76, -0.42]}>
        <mesh position={[0, 0.04, -0.02]} rotation-x={-0.9} material={fur}><boxGeometry args={[0.06, 0.12, 0.04]} /></mesh>
      </group>
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
      <Critters />
      <Kites />
    </>
  );
}
