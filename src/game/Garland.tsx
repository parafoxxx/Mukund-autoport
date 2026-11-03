import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ME } from "../content";

/*
 * On the title screen, click Mukund and the camera comes in close: he's wearing a marigold garland, and his links
 * hang on it as medallions (Instagram, LinkedIn, GitHub, Letterboxd, email). The garland follows his neck and chest
 * every frame, so it moves with him.
 */
export type LinkCharm = { id: string; label: string; url: string };
export const CHARMS: LinkCharm[] = [
  { id: "instagram", label: "Instagram", url: ME.links.instagram },
  { id: "linkedin", label: "LinkedIn", url: ME.links.linkedin },
  { id: "github", label: "GitHub", url: ME.links.github },
  { id: "letterboxd", label: "Letterboxd", url: ME.links.letterboxd },
  { id: "email", label: "Email", url: ME.links.email },
];

const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

/** A medallion face: a stitched rim around the brand's mark. */
function charmTexture(id: string) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const ring = (fill: string | CanvasGradient) => {
    g.fillStyle = "#f3ead8"; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.fillStyle = fill; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
    g.setLineDash([9, 7]); g.lineWidth = 5; g.strokeStyle = "rgba(255, 255, 255, 0.85)";
    g.beginPath(); g.arc(128, 128, 101, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  };
  if (id === "linkedin") {
    ring("#0a66c2");
    g.fillStyle = "#ffffff"; g.font = "bold 128px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("in", 130, 138);
  } else if (id === "github") {
    ring("#171515");
    g.save(); g.translate(128 - 72, 128 - 72); g.scale(9, 9); g.fillStyle = "#ffffff"; g.fill(new Path2D(GITHUB_MARK)); g.restore();
  } else if (id === "instagram") {
    const grd = g.createLinearGradient(30, 230, 226, 26);
    grd.addColorStop(0, "#feda75"); grd.addColorStop(0.35, "#fa7e1e"); grd.addColorStop(0.6, "#d62976"); grd.addColorStop(1, "#4f5bd5");
    ring(grd);
    g.strokeStyle = "#ffffff"; g.lineWidth = 14;
    g.beginPath(); g.roundRect(68, 68, 120, 120, 34); g.stroke();
    g.beginPath(); g.arc(128, 128, 28, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(165, 91, 9, 0, Math.PI * 2); g.fill();
  } else if (id === "letterboxd") {
    ring("#202830");
    ([["#ff8000", 78], ["#00e054", 128], ["#40bcf4", 178]] as const).forEach(([col, x]) => { g.fillStyle = col; g.globalAlpha = 0.92; g.beginPath(); g.arc(x, 128, 30, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
  } else {
    ring("#e8902a");
    g.strokeStyle = "#ffffff"; g.lineWidth = 12; g.lineJoin = "round";
    g.beginPath(); g.roundRect(62, 82, 132, 92, 12); g.stroke();
    g.beginPath(); g.moveTo(66, 88); g.lineTo(128, 136); g.lineTo(190, 88); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const RIM = new THREE.CylinderGeometry(1.1, 1.1, 0.16, 40);
RIM.rotateX(Math.PI / 2); // a gold coin edge, facing +z (the way he faces)
const FACE = new THREE.CircleGeometry(1, 40); // the icon, on a flat face so it reads the right way round
const GOLD = new THREE.MeshStandardMaterial({ color: "#d4a83a", metalness: 0.7, roughness: 0.35 });
const FLOWERS = 26;
const MARIGOLD = [new THREE.MeshStandardMaterial({ color: "#ff8f00", roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#ffc107", roughness: 0.9 })];
const BLOOM = new THREE.IcosahedronGeometry(1, 1);
const CHARM_AT = CHARMS.map((_, k) => -0.8 + k * 0.4); // where each medallion hangs along the garland, -1..1

/** A point on the garland, in the avatar group's frame: a U from shoulder to shoulder, lowest at the chest. */
function along(t: number, neck: THREE.Vector3, chest: THREE.Vector3, out: THREE.Vector3) {
  const sag = 1 - t * t;
  return out.set(neck.x + t * 0.2, neck.y - 0.04 - sag * (neck.y - chest.y + 0.2), neck.z + 0.1 + sag * 0.08);
}

/** The garland, in the avatar group's own frame (+z is toward the camera, the way he faces). */
export function Garland({ scene, visible, onOpen }: { scene: THREE.Object3D; visible: boolean; onOpen: (c: LinkCharm) => void }) {
  const group = useRef<THREE.Group>(null);
  const charms = useRef<(THREE.Group | null)[]>([]);
  const blooms = useRef<(THREE.Mesh | null)[]>([]);
  const hovered = useRef(-1);
  const maps = useMemo(() => CHARMS.map((c) => charmTexture(c.id)), []);
  const bones = useMemo(() => {
    const find = (name: string) => { let f: THREE.Object3D | undefined; scene.traverse((o) => { if (!f && new RegExp(`(^|:)${name}$`).test(o.name)) f = o; }); return f; };
    return { chest: find("Spine2"), neck: find("Neck") };
  }, [scene]);
  const grow = useRef(0);
  const pts = useMemo(() => ({ neck: new THREE.Vector3(), chest: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  useFrame(({ clock }, dt) => {
    const g = group.current; if (!g) return;
    grow.current += ((visible ? 1 : 0) - grow.current) * Math.min(1, dt * 5);
    g.visible = grow.current > 0.02;
    if (!g.visible || !bones.chest || !bones.neck) return;
    const { neck, chest, p } = pts;
    g.worldToLocal(bones.neck.getWorldPosition(neck));
    g.worldToLocal(bones.chest.getWorldPosition(chest));
    blooms.current.forEach((m, k) => {
      if (!m) return;
      m.position.copy(along(-1 + (2 * k) / (FLOWERS - 1), neck, chest, p));
      const s = 0.032 * grow.current;
      m.scale.set(s, s * 0.8, s);
    });
    charms.current.forEach((m, k) => {
      if (!m) return;
      along(CHARM_AT[k], neck, chest, p);
      // each medallion hangs just below the string, and sways a little
      m.position.set(p.x, p.y - 0.06, p.z + 0.03);
      m.rotation.set(0.06, 0, Math.sin(clock.elapsedTime * 1.6 + k) * 0.08);
      const s = (k === 2 ? 0.068 : 0.058) * grow.current * (hovered.current === k ? 1.22 : 1);
      m.scale.set(s, s, s);
    });
  });
  const cursor = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: FLOWERS }, (_, k) => (
        <mesh key={k} ref={(el) => { blooms.current[k] = el; }} geometry={BLOOM} material={MARIGOLD[k % 2]} castShadow />
      ))}
      {CHARMS.map((c, k) => (
        <group key={c.id} ref={(el) => { charms.current[k] = el; }}
          onClick={(e) => { e.stopPropagation(); onOpen(c); }}
          onPointerOver={(e) => { e.stopPropagation(); hovered.current = k; cursor(true); }}
          onPointerOut={() => { hovered.current = -1; cursor(false); }}>
          <mesh geometry={RIM} material={GOLD} castShadow />
          <mesh geometry={FACE} position-z={0.085}>
            <meshStandardMaterial map={maps[k]} roughness={0.7} emissiveMap={maps[k]} emissive="#ffffff" emissiveIntensity={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
