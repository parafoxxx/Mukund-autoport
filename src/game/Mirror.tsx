import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CHARMS, charmCanvas, openCharm } from "../ui/links";

/*
 * Click Mukund on the title screen and he turns to a framed mirror on a wall and does aarti to his own reflection,
 * diya in hand, the garland on the frame and his links hanging from it. The reflection is a mirrored copy of him
 * standing in a little room behind an opening in the wall, copying his pose bone by bone every frame.
 *
 * Everything here is in the avatar's own frame: +z is the way he faces, so the mirror stands at +z.
 */
export const MIRROR_AT = 1.35; // metres in front of him
const GLASS = { w: 1.1, h: 1.5, y: 1.5 };
const WALL = { w: 5.2, h: 3.4 };

const RIM = new THREE.CylinderGeometry(1.1, 1.1, 0.16, 36);
RIM.rotateX(Math.PI / 2);
const FACE = new THREE.CircleGeometry(1, 36);
const GOLD = new THREE.MeshStandardMaterial({ color: "#d4a83a", metalness: 0.7, roughness: 0.35 });
const BLOOM = new THREE.IcosahedronGeometry(1, 1);
const MARIGOLD = [new THREE.MeshStandardMaterial({ color: "#ff8f00", roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#ffc107", roughness: 0.9 })];

/** The garland across the frame, from one top corner, sagging over the glass, to the other (x, y in the wall's plane). */
const drape = (t: number) => {
  const u = 1 - t, a = [-GLASS.w / 2 - 0.02, GLASS.y + GLASS.h / 2 + 0.04], c = [0, GLASS.y - 0.25], b = [GLASS.w / 2 + 0.02, GLASS.y + GLASS.h / 2 + 0.04];
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as const;
};
const FLOWERS = Array.from({ length: 30 }, (_, k) => drape(k / 29));
const CHARM_T = CHARMS.map((_, k) => 0.16 + (0.68 * k) / (CHARMS.length - 1)); // spread evenly along the drape

/** A lit diya, to sit in his right hand. */
function Diya() {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { const f = flame.current; if (f) { const t = clock.elapsedTime; f.scale.set(1 + Math.sin(t * 31) * 0.08, 1 + Math.sin(t * 23 + 1) * 0.14, 1); } });
  return (
    <group>
      <mesh position-y={-0.02}><cylinderGeometry args={[0.13, 0.11, 0.025, 24]} /><meshStandardMaterial color="#d9a53a" metalness={0.75} roughness={0.3} /></mesh>
      <mesh position-y={0.015}><sphereGeometry args={[0.045, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#b4532a" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh ref={flame} position-y={0.06}><coneGeometry args={[0.018, 0.07, 10]} /><meshBasicMaterial color="#ffc34d" toneMapped={false} /></mesh>
      <mesh position-y={0.06}><sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial color="#ff9a1a" transparent opacity={0.28} toneMapped={false} depthWrite={false} /></mesh>
      <pointLight position-y={0.1} color="#ffb04a" intensity={1.6} distance={2.4} decay={2} />
    </group>
  );
}

/** Copies the pose of one skeleton onto another, bone by bone. */
function boneMap(from: THREE.Object3D, to: THREE.Object3D) {
  const byName = new Map<string, THREE.Object3D>();
  to.traverse((o) => byName.set(o.name, o));
  const pairs: [THREE.Object3D, THREE.Object3D][] = [];
  from.traverse((o) => { if ((o as THREE.Bone).isBone) { const t = byName.get(o.name); if (t) pairs.push([o, t]); } });
  return pairs;
}
const findBone = (root: THREE.Object3D, name: string) => { let f: THREE.Object3D | undefined; root.traverse((o) => { if (!f && new RegExp(`(^|:)${name}$`).test(o.name)) f = o; }); return f; };

export function MirrorScene({ scene }: { scene: THREE.Object3D }) {
  const root = useRef<THREE.Group>(null);
  const reflection = useMemo(() => {
    const c = cloneSkinned(scene);
    // the reflection is mirrored (negative scale), so its faces need drawing from both sides
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = Array.isArray(m.material) ? m.material.map((x) => { const y = x.clone(); y.side = THREE.DoubleSide; return y; }) : Object.assign(m.material.clone(), { side: THREE.DoubleSide });
      m.castShadow = false;
    });
    return c;
  }, [scene]);
  const pairs = useMemo(() => boneMap(scene, reflection), [scene, reflection]);
  const hands = useMemo(() => ({ mine: findBone(scene, "RightHand"), theirs: findBone(reflection, "RightHand") }), [scene, reflection]);
  const myDiya = useRef<THREE.Group>(null), theirDiya = useRef<THREE.Group>(null);
  const maps = useMemo(() => CHARMS.map((c) => { const t = new THREE.CanvasTexture(charmCanvas(c.id)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }), []);
  const charms = useRef<(THREE.Group | null)[]>([]);
  const hovered = useRef(-1);
  const grow = useRef(0);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const g = root.current; if (!g) return;
    grow.current = Math.min(1, grow.current + dt * 2.2);
    const e = 1 - Math.pow(1 - grow.current, 3);
    g.scale.setScalar(0.6 + 0.4 * e);
    g.position.y = (1 - e) * -0.4;
    // the reflection does exactly what he does
    for (const [a, b] of pairs) { b.position.copy(a.position); b.quaternion.copy(a.quaternion); b.scale.copy(a.scale); }
    // the diya rides in his right hand, and in his reflection's
    if (hands.mine && myDiya.current?.parent) myDiya.current.position.copy(myDiya.current.parent.worldToLocal(hands.mine.getWorldPosition(p))).add(new THREE.Vector3(0, 0.06, 0.05));
    if (hands.theirs && theirDiya.current?.parent) theirDiya.current.position.copy(theirDiya.current.parent.worldToLocal(hands.theirs.getWorldPosition(p))).add(new THREE.Vector3(0, 0.06, 0.05));
    charms.current.forEach((m, k) => {
      if (!m) return;
      m.rotation.z = Math.sin(clock.elapsedTime * 1.5 + k) * 0.07;
      const s = 0.062 * (hovered.current === k ? 1.2 : 1);
      m.scale.set(s, s, s);
    });
  });
  const cursor = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  const wallMat = <meshStandardMaterial color="#cdb894" roughness={0.92} />; // an old office wall, warm and a little worn
  const wood = <meshStandardMaterial color="#6b3d14" roughness={0.55} metalness={0.15} />;
  const sideW = (WALL.w - GLASS.w) / 2, topH = WALL.h - (GLASS.y + GLASS.h / 2), botH = GLASS.y - GLASS.h / 2;
  return (
    <group ref={root}>
      <group ref={myDiya}><Diya /></group>
      <group position-z={MIRROR_AT} rotation-y={Math.PI}>
        {/* the wall, built around the mirror's opening; it faces him (local +z after the turn) */}
        <mesh position={[-(GLASS.w + sideW) / 2, WALL.h / 2, 0]}><boxGeometry args={[sideW, WALL.h, 0.06]} />{wallMat}</mesh>
        <mesh position={[(GLASS.w + sideW) / 2, WALL.h / 2, 0]}><boxGeometry args={[sideW, WALL.h, 0.06]} />{wallMat}</mesh>
        <mesh position={[0, WALL.h - topH / 2, 0]}><boxGeometry args={[GLASS.w, topH, 0.06]} />{wallMat}</mesh>
        <mesh position={[0, botH / 2, 0]}><boxGeometry args={[GLASS.w, botH, 0.06]} />{wallMat}</mesh>
        {/* the carved frame and its gold lip */}
        {[[0, GLASS.y + GLASS.h / 2 + 0.06, GLASS.w + 0.24, 0.12], [0, GLASS.y - GLASS.h / 2 - 0.06, GLASS.w + 0.24, 0.12], [-GLASS.w / 2 - 0.06, GLASS.y, 0.12, GLASS.h], [GLASS.w / 2 + 0.06, GLASS.y, 0.12, GLASS.h]].map(([x, y, w, h], k) => (
          <mesh key={k} position={[x, y, 0.06]}><boxGeometry args={[w, h, 0.08]} />{wood}</mesh>
        ))}
        {[[0, GLASS.y + GLASS.h / 2, GLASS.w, 0.02], [0, GLASS.y - GLASS.h / 2, GLASS.w, 0.02], [-GLASS.w / 2, GLASS.y, 0.02, GLASS.h], [GLASS.w / 2, GLASS.y, 0.02, GLASS.h]].map(([x, y, w, h], k) => (
          <mesh key={k} position={[x, y, 0.105]} material={GOLD}><boxGeometry args={[w, h, 0.02]} /></mesh>
        ))}
        {/* a faint sheen on the glass */}
        <mesh position={[0, GLASS.y, 0.01]}><planeGeometry args={[GLASS.w, GLASS.h]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.06} depthWrite={false} /></mesh>
        {/* behind the glass: the mirror world, a warm dim room with him in it, facing out */}
        <mesh position={[0, 1.6, -1.6]}><boxGeometry args={[3.4, 3.2, 3.2]} /><meshStandardMaterial color="#4a3826" roughness={1} side={THREE.BackSide} /></mesh>
        <group position-z={-MIRROR_AT} rotation-y={0} scale={[-1, 1, 1]}>
          <primitive object={reflection} />
          <group ref={theirDiya}><Diya /></group>
        </group>
        {/* the haar on the frame, and his links on it */}
        {FLOWERS.map(([x, y], k) => (
          <mesh key={k} geometry={BLOOM} material={MARIGOLD[k % 2]} position={[x, y, 0.16]} scale={[0.034, 0.028, 0.034]} />
        ))}
        {CHARMS.map((c, k) => {
          const [x, y] = drape(CHARM_T[k]);
          return (
            <group key={c.id} ref={(el) => { charms.current[k] = el; }} position={[x, y - 0.085, 0.19]}
              onClick={(e) => { e.stopPropagation(); openCharm(c); }}
              onPointerOver={(e) => { e.stopPropagation(); hovered.current = k; cursor(true); }}
              onPointerOut={() => { hovered.current = -1; cursor(false); }}>
              <mesh geometry={RIM} material={GOLD} />
              <mesh geometry={FACE} position-z={0.085}><meshStandardMaterial map={maps[k]} roughness={0.7} emissiveMap={maps[k]} emissive="#ffffff" emissiveIntensity={0.25} /></mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
