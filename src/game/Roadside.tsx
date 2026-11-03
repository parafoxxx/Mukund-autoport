import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { STOPS } from "../content";
import { sim, ui, useUI } from "./store";
import { COLLIDERS, ROAD_HALF, SAMPLES, SAMPLE_COUNT, STOP_POS, STOP_U, roadHeading, rng } from "./track";

export const FONT_SERIF = "/fonts/DMSerifDisplay-Regular.ttf";
export const FONT_MONO = "/fonts/SpaceMono-Bold.ttf";

/* ---------- Indian highway milestones mark each chapter ---------- */
export function Milestones() {
  const visited = useUI((s) => s.visited);
  const next = useUI((s) => s.nextStop);
  return (
    <group>
      {STOPS.map((s, i) => <Milestone key={s.id} i={i} visited={visited.includes(i)} next={next === i} />)}
    </group>
  );
}

function Milestone({ i, visited, next }: { i: number; visited: boolean; next: boolean }) {
  const stop = STOPS[i];
  const h = roadHeading(STOP_U[i]);
  const right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const pos = STOP_POS[i].clone().addScaledVector(right, -(ROAD_HALF + 2.2));
  const ring = useRef<THREE.Mesh>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const p = STOP_POS[i];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const away = THREE.MathUtils.clamp((Math.hypot(sim.pos.x - p.x, sim.pos.z - p.z) - 10) / 20, 0, 1);
    if (shaft.current) {
      shaft.current.visible = next && ui.get().active === null;
      (shaft.current.material as THREE.MeshBasicMaterial).opacity = (0.16 + Math.sin(t * 2) * 0.04) * away;
    }
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = (next ? 0.75 : 0.28) + Math.sin(t * 3 + i) * 0.08;
  });
  return (
    <group>
      {/* a soft ring on the tarmac */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[p.x, 0.05, p.z]}>
        <ringGeometry args={[4.6, 4.9, 64]} />
        <meshBasicMaterial color={visited && !next ? "#f4ead8" : stop.color} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* a thin shaft of light marks only the next chapter */}
      <mesh ref={shaft} position={[p.x, 22, p.z]}>
        <cylinderGeometry args={[0.35, 0.9, 44, 20, 1, true]} />
        <meshBasicMaterial color={stop.color} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* the milestone itself: white stone, painted dome, chapter number */}
      <group position={pos} rotation-y={h + Math.PI / 2} scale={1.6}>
        <mesh position-y={0.62} castShadow><boxGeometry args={[0.9, 1.24, 0.34]} /><meshStandardMaterial color="#f3efe6" roughness={0.9} /></mesh>
        <mesh position-y={1.24} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.34, 24]} />
          <meshStandardMaterial color={visited ? "#d9d2c3" : stop.color} roughness={0.8} />
        </mesh>
        <mesh position-y={0.04}><boxGeometry args={[1.05, 0.08, 0.46]} /><meshStandardMaterial color="#8c8274" /></mesh>
        {[1, -1].map((side) => (
          <group key={side} rotation-y={side > 0 ? 0 : Math.PI} position-z={0.175 * side}>
            <Text font={FONT_MONO} position={[0, 1.36, 0.002]} fontSize={0.14} color="#1a1208">{`CH ${String(i + 1).padStart(2, "0")}`}</Text>
            <Text font={FONT_SERIF} position={[0, 0.86, 0.002]} fontSize={0.2} color="#1a1208" maxWidth={0.8} textAlign="center" lineHeight={1}>{stop.name}</Text>
            <Text font={FONT_MONO} position={[0, 0.38, 0.002]} fontSize={0.1} color="#6d6457">{visited ? "VISITED" : `${String(i + 1).padStart(2, "0")} / ${STOPS.length}`}</Text>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ---------- electricity poles with sagging wires along the road ---------- */
const POLES = (() => {
  const list: { x: number; z: number; rot: number }[] = [];
  const step = 24;
  let dist = 0, last = -999;
  for (let i = 1; i <= SAMPLE_COUNT; i++) {
    dist += SAMPLES[i].distanceTo(SAMPLES[i - 1]);
    if (dist - last < step) continue;
    const u = i / SAMPLE_COUNT, h = roadHeading(u);
    const side = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    const p = SAMPLES[i].clone().addScaledVector(side, ROAD_HALF + 3.4);
    if (STOP_POS.some((s) => s.distanceTo(p) < 11)) continue;
    if (COLLIDERS.some((c) => c.r > 2 && (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < (c.r + 2) ** 2)) continue;
    list.push({ x: p.x, z: p.z, rot: h });
    last = dist;
  }
  return list;
})();

export function Poles() {
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const wires = useMemo(() => {
    const pts: number[] = [];
    for (let k = 0; k < POLES.length - 1; k++) {
      const a = POLES[k], b = POLES[k + 1];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 40) continue;
      for (const off of [-0.7, 0, 0.7]) {
        const ax = a.x + Math.cos(a.rot) * off, az = a.z - Math.sin(a.rot) * off;
        const bx = b.x + Math.cos(b.rot) * off, bz = b.z - Math.sin(b.rot) * off;
        const seg = 10;
        for (let s = 0; s < seg; s++) {
          const t0 = s / seg, t1 = (s + 1) / seg;
          const sag = (t: number) => 7.6 - Math.sin(Math.PI * t) * 0.9;
          pts.push(ax + (bx - ax) * t0, sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, sag(t1), az + (bz - az) * t1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    POLES.forEach((p, i) => {
      poles.current!.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 4, p.z), q.identity(), one));
      arms.current!.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 7.7, p.z), q.setFromEuler(e.set(0, p.rot, 0)), one));
    });
    poles.current!.instanceMatrix.needsUpdate = true;
    arms.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, POLES.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 8, 6]} />
        <meshStandardMaterial color="#a39a8c" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, POLES.length]}>
        <boxGeometry args={[1.8, 0.12, 0.12]} />
        <meshStandardMaterial color="#6f675c" />
      </instancedMesh>
      <lineSegments geometry={wires}>
        <lineBasicMaterial color="#2a2018" transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

/* ---------- golden dust drifting in the low sun, always around the camera ---------- */
export function Dust() {
  const COUNT = 420, SIZE = 60;
  const ref = useRef<THREE.Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const r = rng(42), pos = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) { pos.set([(r() - 0.5) * SIZE, r() * 14, (r() - 0.5) * SIZE], i * 3); seeds[i] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: g, seeds };
  }, []);
  useFrame(({ clock }, dt) => {
    const pts = ref.current; if (!pts) return;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      let x = pos.getX(i) + Math.sin(t * 0.3 + seeds[i] * 9) * dt * 0.6;
      let y = pos.getY(i) + dt * (0.15 + seeds[i] * 0.2);
      let z = pos.getZ(i) + Math.cos(t * 0.25 + seeds[i] * 7) * dt * 0.6;
      // wrap around the auto so the dust never runs out
      const dx = x - sim.pos.x, dz = z - sim.pos.z;
      if (dx > SIZE / 2) x -= SIZE; if (dx < -SIZE / 2) x += SIZE;
      if (dz > SIZE / 2) z -= SIZE; if (dz < -SIZE / 2) z += SIZE;
      if (y > 14) y = 0;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.09} color="#ffd9a3" transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}
