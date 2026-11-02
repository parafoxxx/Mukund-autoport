import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { FIRST } from "./guest";
import { ui } from "./store";
import { DECKS, EXHIBITS, ME, STOPS } from "../content";
import { BOOTH, COLUMNS_Z, deckX, HALL } from "./hall";
import { PLACEMENTS, ROAD_HALF, STOP_POS, STOP_U, rng, roadHeading } from "./track";
import { FONT_MONO, FONT_SERIF } from "./Roadside";

const MARBLE = "#e8dcc6";

function Placed({ i, children }: { i: number; children: ReactNode }) {
  const { pos, rotY } = PLACEMENTS[i];
  return <group position={pos} rotation-y={rotY}>{children}</group>;
}

/** Sits on the road itself, its local x axis across the road. */
function OnRoad({ i, children }: { i: number; children: ReactNode }) {
  const p = STOP_POS[i];
  return <group position={[p.x, 0, p.z]} rotation-y={roadHeading(STOP_U[i])}>{children}</group>;
}

/* ---------- 01 Agra: the Taj Mahal ---------- */
function onionDome() {
  const pts = [[0, 0], [5.4, 0], [6.5, 1.6], [6.9, 3.6], [6.3, 6.1], [4.4, 8.3], [2, 9.9], [0.45, 11], [0, 11.7]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
}

function Taj() {
  const dome = useMemo(onionDome, []);
  const marble = <meshStandardMaterial color={MARBLE} roughness={0.55} emissive="#ff9a5c" emissiveIntensity={0.08} />;
  const minaret = (x: number, z: number) => (
    <group position={[x, 1.2, z]} key={`${x}${z}`}>
      <mesh position-y={10} castShadow><cylinderGeometry args={[0.75, 1, 20, 12]} />{marble}</mesh>
      {[6, 12, 17.5].map((y) => <mesh key={y} position-y={y}><cylinderGeometry args={[1.35, 1.35, 0.4, 12]} />{marble}</mesh>)}
      <mesh position-y={21.2} scale={0.17} geometry={dome}>{marble}</mesh>
    </group>
  );
  return (
    <group>
      <mesh position-y={0.6} receiveShadow castShadow><boxGeometry args={[36, 1.2, 36]} />{marble}</mesh>
      <mesh position-y={6.2} castShadow><boxGeometry args={[17, 10, 17]} />{marble}</mesh>
      <mesh position={[0, 5.6, 8.55]}><boxGeometry args={[5.2, 7.5, 0.3]} /><meshStandardMaterial color="#3c3448" /></mesh>
      {[-5.6, 5.6].map((x) => <mesh key={x} position={[x, 4.4, 8.55]}><boxGeometry args={[2.2, 4, 0.3]} /><meshStandardMaterial color="#4a4058" /></mesh>)}
      <mesh position-y={12.2} castShadow><cylinderGeometry args={[5.6, 5.8, 2, 32]} />{marble}</mesh>
      <mesh position-y={13} geometry={dome} castShadow>{marble}</mesh>
      <mesh position-y={25.6}><cylinderGeometry args={[0.15, 0.3, 2.4, 8]} /><meshStandardMaterial color="#d4a73a" metalness={0.6} roughness={0.3} /></mesh>
      {[[-6, -6], [6, -6], [-6, 6], [6, 6]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 11.2, z]}>
          <mesh position-y={1}><cylinderGeometry args={[1.5, 1.5, 2, 8]} />{marble}</mesh>
          <mesh position-y={2} scale={0.25} geometry={dome}>{marble}</mesh>
        </group>
      ))}
      {minaret(-16, -16)}{minaret(16, -16)}{minaret(-16, 16)}{minaret(16, 16)}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 25]}><planeGeometry args={[3.6, 14]} /><meshStandardMaterial color="#5d8fbf" metalness={0.4} roughness={0.15} /></mesh>
      {[-4.5, 4.5].map((x) => [19, 23, 27, 31].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 2.5, z]} scale={[1, 2.7, 1]} castShadow><sphereGeometry args={[0.9, 18, 14]} /><meshStandardMaterial color="#2f5a2c" roughness={0.95} /></mesh>
      )))}
    </group>
  );
}

/* ---------- 02 JEE: a tower of the books every aspirant knows ---------- */
function Books() {
  const books = [
    { t: "NCERT", c: "#1565c0", w: 8, r: 0.05 }, { t: "H.C. VERMA", c: "#c62828", w: 7.4, r: -0.08 },
    { t: "IRODOV", c: "#2e7d32", w: 7, r: 0.12 }, { t: "CENGAGE", c: "#f9a825", w: 6.6, r: -0.04 }, { t: "MOCK TEST #47", c: "#6a1b9a", w: 6.2, r: 0.1 },
  ];
  return (
    <group>
      {books.map((b, i) => (
        <group key={b.t} position-y={0.75 + i * 1.5} rotation-y={b.r}>
          <mesh castShadow receiveShadow><boxGeometry args={[b.w, 1.4, 5]} /><meshStandardMaterial color={b.c} roughness={0.8} /></mesh>
          <mesh position-z={2.51}><planeGeometry args={[b.w - 0.3, 1.2]} /><meshStandardMaterial color="#fff6e0" /></mesh>
          <Text font={FONT_SERIF} position={[0, 0, 2.53]} fontSize={0.62} color="#1a1208" maxWidth={b.w - 0.6}>{b.t}</Text>
        </group>
      ))}
      <group position={[3.2, 4.5, 3.2]} rotation={[0.2, 0.4, -0.45]}>
        <mesh castShadow><cylinderGeometry args={[0.35, 0.35, 9, 6]} /><meshStandardMaterial color="#ffca28" /></mesh>
        <mesh position-y={5.1}><coneGeometry args={[0.35, 1.2, 6]} /><meshStandardMaterial color="#e0c39a" /></mesh>
        <mesh position-y={-4.7}><cylinderGeometry args={[0.36, 0.36, 0.5, 6]} /><meshStandardMaterial color="#f48fb1" /></mesh>
      </group>
      <StudyRoom />
    </group>
  );
}

/* The JEE years, around the book tower: his notes wall, his organic-chemistry chart, the lectures, and him in class.
   Photos are public/photos/jee-1..4.jpg (the same ones the chapter's gallery shows). Each one opens full screen. */
const JEE_STOP = STOPS.findIndex((s) => s.id === "jee");
const openPhoto = (stop: number, index: number) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (stop >= 0) ui.set({ lightbox: { stop, index } }); };
const zoomCursor = (on: boolean) => { document.body.style.cursor = on ? "zoom-in" : ""; };

function usePhoto(url: string) {
  const t = useLoader(THREE.TextureLoader, url);
  useMemo(() => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; }, [t]);
  return t;
}

/** A photo you can click, in a frame. */
function Framed({ map, w, h, frame, border = 0.12, glow = 0.3, index }: { map: THREE.Texture; w: number; h: number; frame: string; border?: number; glow?: number; index: number }) {
  return (
    <group onClick={openPhoto(JEE_STOP, index)} onPointerOver={() => zoomCursor(true)} onPointerOut={() => zoomCursor(false)}>
      <mesh castShadow><boxGeometry args={[w + border * 2, h + border * 2, 0.12]} /><meshStandardMaterial color={frame} roughness={0.7} /></mesh>
      <mesh position-z={0.065}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={glow} roughness={0.6} />
      </mesh>
    </group>
  );
}

function StudyRoom() {
  const me = usePhoto("/photos/jee-1.jpg");
  const notes = usePhoto("/photos/jee-2.jpg");
  const chem = usePhoto("/photos/jee-3.jpg");
  const lecture = usePhoto("/photos/jee-4.jpg");
  const wood = <meshStandardMaterial color="#6d4c2f" roughness={0.85} />;
  return (
    <group>
      {/* the notes wall: a free-standing board papered with his notes */}
      <group position={[-6.6, 0, 1.4]} rotation-y={0.35}>
        {[-1.9, 1.9].map((x) => <mesh key={x} position={[x, 2.9, -0.1]} castShadow><boxGeometry args={[0.16, 5.8, 0.16]} />{wood}</mesh>)}
        <group position-y={3.3}><Framed map={notes} w={3.6} h={4.96} frame="#d7c4a3" border={0.15} glow={0.25} index={1} /></group>
        <Text font={FONT_SERIF} position={[0, 0.5, 0.1]} fontSize={0.3} color="#fff4dc" outlineWidth={0.015} outlineColor="#1a1208">Every wall, a formula sheet</Text>
      </group>
      {/* the organic-chemistry chart, on a big board */}
      <group position={[7.0, 0, 1.2]} rotation-y={-0.4}>
        {[-2.7, 2.7].map((x) => <mesh key={x} position={[x, 2.3, -0.1]} castShadow><boxGeometry args={[0.18, 4.6, 0.18]} />{wood}</mesh>)}
        <group position-y={3.3}><Framed map={chem} w={6.0} h={2.82} frame="#2b3a2f" border={0.22} glow={0.25} index={2} /></group>
      </group>
      {/* the lectures, on a giant laptop */}
      <group position={[4.9, 0, 5.4]} rotation-y={-0.35}>
        <mesh position-y={0.12} castShadow><boxGeometry args={[4.6, 0.24, 3.0]} /><meshStandardMaterial color="#b0b6bd" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[0, 0.25, 0.35]}><planeGeometry args={[3.8, 1.6]} /><meshStandardMaterial color="#2a2d31" /></mesh>
        <group position={[0, 1.55, -1.45]} rotation-x={-0.18}>
          <mesh castShadow><boxGeometry args={[4.6, 2.8, 0.14]} /><meshStandardMaterial color="#b0b6bd" metalness={0.6} roughness={0.35} /></mesh>
          <group position-z={0.02}><Framed map={lecture} w={4.25} h={2.4} frame="#111" border={0.06} glow={0.7} index={3} /></group>
        </group>
      </group>
      {/* him in class, as a big polaroid on a stand */}
      <group position={[-4.2, 0, 5.4]} rotation-y={0.4}>
        <mesh position={[0, 1.0, -0.1]} castShadow><boxGeometry args={[0.16, 2.0, 0.16]} />{wood}</mesh>
        <group position-y={3.2}>
          <mesh position={[0, -0.2, -0.02]} castShadow><boxGeometry args={[2.0, 3.85, 0.08]} /><meshStandardMaterial color="#f7f1e6" /></mesh>
          <group position-y={0.1}><Framed map={me} w={1.62} h={3.4} frame="#f7f1e6" border={0.06} glow={0.25} index={0} /></group>
          <Text font={FONT_SERIF} position={[0, -1.95, 0.05]} fontSize={0.2} color="#2a1f16">JEE days</Text>
        </group>
      </group>
    </group>
  );
}

/* ---------- 03 IIT Kanpur: a gate over the road ---------- */
function Gate() {
  const half = ROAD_HALF + 1.6;
  const brick = <meshStandardMaterial color="#a2432e" roughness={0.9} />;
  return (
    <group>
      {[-half, half].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={4.5} castShadow><boxGeometry args={[2.4, 9, 2.4]} />{brick}</mesh>
          <mesh position-y={9.4}><boxGeometry args={[3, 0.8, 3]} /><meshStandardMaterial color="#e9d9bf" /></mesh>
        </group>
      ))}
      <mesh position-y={10.4} castShadow><boxGeometry args={[half * 2 + 3, 1.9, 1.6]} />{brick}</mesh>
      {[1, -1].map((s) => (
        <Text font={FONT_SERIF} key={s} position={[0, 10.4, 0.82 * s]} rotation-y={s > 0 ? 0 : Math.PI} fontSize={1.05} color="#fff3d6" letterSpacing={0.08}>
          IIT KANPUR
        </Text>
      ))}
    </group>
  );
}

/* ---------- 04 The CPI 7.0 speed breaker ---------- */
function stripes() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 16;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#111" : "#ffcc00"; g.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Breaker() {
  const map = useMemo(stripes, []);
  return (
    <group>
      <mesh position-y={0.12} castShadow receiveShadow><boxGeometry args={[ROAD_HALF * 2, 0.26, 1.3]} /><meshStandardMaterial map={map} /></mesh>
      <group position={[ROAD_HALF + 2.4, 0, 6]}>
        <mesh position-y={2.2}><cylinderGeometry args={[0.1, 0.1, 4.4, 6]} /><meshStandardMaterial color="#888" /></mesh>
        <mesh position-y={4.6} rotation-x={Math.PI / 2}><cylinderGeometry args={[1.5, 1.5, 0.1, 32]} /><meshStandardMaterial color="#d32f2f" /></mesh>
        <mesh position={[0, 4.6, 0.06]} rotation-x={Math.PI / 2}><cylinderGeometry args={[1.15, 1.15, 0.1, 32]} /><meshStandardMaterial color="#fff" /></mesh>
        <Text font={FONT_SERIF} position={[0, 4.85, 0.13]} fontSize={0.42} color="#111">CPI</Text>
        <Text font={FONT_SERIF} position={[0, 4.35, 0.13]} fontSize={0.62} color="#d32f2f" fontWeight={700}>7.0</Text>
      </group>
      <group position={[-ROAD_HALF - 2.4, 0, -7]} rotation-y={Math.PI}>
        <mesh position-y={2}><cylinderGeometry args={[0.1, 0.1, 4, 6]} /><meshStandardMaterial color="#888" /></mesh>
        <mesh position-y={4.4} rotation-z={Math.PI / 4}><boxGeometry args={[2.3, 2.3, 0.1]} /><meshStandardMaterial color="#ffcc00" /></mesh>
        <Text font={FONT_SERIF} position={[0, 4.4, 0.07]} fontSize={0.36} color="#111" maxWidth={2} textAlign="center">{"SEM 1\nAHEAD"}</Text>
      </group>
    </group>
  );
}

/* ---------- 05 The climb: CPI/SPI pillars rising ---------- */
function Climb() {
  const bars = [{ v: "7.0", l: "CPI · sem 1" }, { v: "8.0", l: "CPI · sem 6" }, { v: "9.5", l: "SPI" }, { v: "9.5", l: "SPI again" }];
  const heights = [5, 8, 12.5, 12.5];
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (glow.current) glow.current.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 3) * 0.5; });
  return (
    <group>
      {bars.map((b, i) => {
        const x = -7.5 + i * 5, h = heights[i];
        return (
          <group key={i} position-x={x}>
            <mesh position-y={h / 2} castShadow><boxGeometry args={[3.4, h, 3.4]} /><meshStandardMaterial color={i < 2 ? "#5e35b1" : "#7c4dff"} roughness={0.5} /></mesh>
            <mesh position-y={h + 0.15}>
              <boxGeometry args={[3.5, 0.3, 3.5]} />
              {i >= 2 ? <meshStandardMaterial ref={i === 3 ? glow : undefined} color="#b39dff" emissive="#b39dff" emissiveIntensity={1.4} toneMapped={false} /> : <meshStandardMaterial color="#9575cd" />}
            </mesh>
            <Text font={FONT_SERIF} position={[0, h + 1.6, 0]} fontSize={1.6} color="#fff8e6" outlineWidth={0.08} outlineColor="#2a1650">{b.v}</Text>
            <Text font={FONT_SERIF} position={[0, h / 2, 1.72]} fontSize={0.5} color="#efe7ff" maxWidth={3}>{b.l}</Text>
          </group>
        );
      })}
      <group position={[7.5, 12.8, 0]}>
        <mesh position-y={1.6}><cylinderGeometry args={[0.07, 0.07, 3.2, 6]} /><meshStandardMaterial color="#ddd" /></mesh>
        <mesh position={[0.6, 2.7, 0]}><boxGeometry args={[1.2, 0.8, 0.05]} /><meshStandardMaterial color="#ff3d00" /></mesh>
      </group>
    </group>
  );
}

/* ---------- 06 Chill Hai: the campus brand stall ---------- */
function Stall() {
  const awning = Array.from({ length: 8 }, (_, i) => i);
  return (
    <group>
      <mesh position-y={1.1} castShadow><boxGeometry args={[7, 2.2, 3]} /><meshStandardMaterial color="#e4007c" /></mesh>
      <Text font={FONT_SERIF} position={[0, 1.2, 1.52]} fontSize={0.62} color="#fff">₹3.75L+ · ₹0 ads</Text>
      {[-3.3, 3.3].map((x) => <mesh key={x} position={[x, 2.6, 1.2]}><cylinderGeometry args={[0.08, 0.08, 3, 6]} /><meshStandardMaterial color="#ddd" /></mesh>)}
      {awning.map((i) => (
        <mesh key={i} position={[-3.06 + i * 0.875, 4.1, 0.8]} rotation-x={-0.35} castShadow>
          <boxGeometry args={[0.875, 0.1, 3.2]} />
          <meshStandardMaterial color={i % 2 ? "#fff4dc" : "#e4007c"} />
        </mesh>
      ))}
      <mesh position={[0, 5.4, 0]}><boxGeometry args={[6.4, 1.6, 0.2]} /><meshStandardMaterial color="#ffcc00" /></mesh>
      <Text font={FONT_SERIF} position={[0, 5.42, 0.12]} fontSize={1.0} color="#e4007c" letterSpacing={0.04}>CHILL HAI</Text>
      {/* the merch: tees on a rail under the awning, in the brand's colours */}
      <mesh position={[0, 3.62, 1.6]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.035, 0.035, 6.2, 6]} /><meshStandardMaterial color="#cfcfcf" metalness={0.6} roughness={0.3} /></mesh>
      {["#ffe9a8", "#ffc4dd", "#f5b3ff", "#1d1d1d", "#fff4dc"].map((c, i) => (
        <group key={c} position={[-2.4 + i * 1.2, 2.95, 1.62]} rotation-z={(i - 2) * 0.04}>
          <mesh geometry={TEE} castShadow><meshStandardMaterial color={c} roughness={0.95} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0.68, 0]}><torusGeometry args={[0.07, 0.012, 4, 10, Math.PI]} /><meshStandardMaterial color="#888" /></mesh>
        </group>
      ))}
      <InstaPhone />
    </group>
  );
}

/** A T-shirt silhouette, about 1 m across. */
const TEE = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.16, 0.62); sh.quadraticCurveTo(0, 0.52, 0.16, 0.62);
  sh.lineTo(0.5, 0.5); sh.lineTo(0.62, 0.22); sh.lineTo(0.4, 0.14); sh.lineTo(0.34, 0.28);
  sh.lineTo(0.34, -0.55); sh.lineTo(-0.34, -0.55); sh.lineTo(-0.34, 0.28);
  sh.lineTo(-0.4, 0.14); sh.lineTo(-0.62, 0.22); sh.lineTo(-0.5, 0.5); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
})();

const INSTA_URL = STOPS.find((s) => s.id === "chillhai")?.link?.url ?? "https://www.instagram.com/";

/**
 * The brand's Instagram page, on a giant phone beside the stall. Logo, highlights and the first posts are cut
 * from a screenshot of the real page (public/photos/chillhai-insta.png); handle, stats and bio are copied from it.
 * Drop real post images in as public/photos/chillhai-1.jpg, -2.jpg … and they fill the grid instead.
 */
function instaScreen() {
  const W = 600, H = 1240;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const font = (w: number, px: number) => `${w} ${px}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;
  const shot = new Image();
  const posts: HTMLImageElement[] = [];
  const crop = (img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, round = 0) => {
    g.save();
    if (round) { g.beginPath(); g.arc(dx + dw / 2, dy + dh / 2, round, 0, Math.PI * 2); g.clip(); }
    g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    g.restore();
  };
  const draw = () => {
    g.fillStyle = "#0c0f14"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#f5f5f5";
    g.font = font(600, 22); g.fillText("9:41", 34, 46);
    g.fillRect(W - 92, 32, 44, 18); g.fillRect(W - 46, 37, 4, 8);
    g.font = font(700, 32); g.fillText("chill_hai.official", 34, 112);
    g.font = font(700, 30); g.fillText("⋯", W - 64, 110);
    const ready = shot.complete && shot.naturalWidth > 0;
    // profile picture: the hanger logo, from the screenshot
    g.beginPath(); g.arc(112, 238, 86, 0, Math.PI * 2); g.fillStyle = "#e9c5c8"; g.fill();
    if (ready) crop(shot, 255, 103, 150, 150, 32, 158, 160, 160, 80);
    g.lineWidth = 4; g.strokeStyle = "#d62976"; g.beginPath(); g.arc(112, 238, 88, 0, Math.PI * 2); g.stroke();
    [["15", "posts", 290], ["185", "followers", 412], ["1", "following", 532]].forEach(([n, l, x]) => {
      g.textAlign = "center"; g.fillStyle = "#f5f5f5";
      g.font = font(700, 32); g.fillText(String(n), Number(x), 232);
      g.font = font(400, 22); g.fillText(String(l), Number(x), 266);
    });
    g.textAlign = "left";
    g.fillStyle = "#f5f5f5"; g.font = font(700, 26); g.fillText("Chill Hai", 34, 372);
    g.fillStyle = "#a8a8a8"; g.font = font(400, 23); g.fillText("Clothing (Brand)", 34, 406);
    g.fillStyle = "#f5f5f5";
    ["@_.mukund_ll", "Where style meets comfort", "Grab a tee and elevate your wardrobe", "with our cozy chic collection"].forEach((line, k) => g.fillText(line, 34, 440 + k * 32));
    // buttons
    const btn = (x: number, w: number, label: string, fill: string) => {
      g.fillStyle = fill; g.beginPath(); g.roundRect(x, 584, w, 58, 14); g.fill();
      g.fillStyle = "#fff"; g.font = font(700, 23); g.textAlign = "center"; g.fillText(label, x + w / 2, 621); g.textAlign = "left";
    };
    btn(34, 260, "Follow", "#0095f6"); btn(306, 260, "Message", "#262a31");
    // story highlights, from the screenshot
    [[312, "♥"], [410, "DISCOUNT"], [507, "NEW"]].forEach(([sx, label], k) => {
      const cx = 92 + k * 150;
      g.lineWidth = 3; g.strokeStyle = "#5a5e66"; g.beginPath(); g.arc(cx, 728, 54, 0, Math.PI * 2); g.stroke();
      if (ready) crop(shot, Number(sx) - 40, 441, 80, 80, cx - 48, 680, 96, 96, 48);
      g.fillStyle = "#f5f5f5"; g.font = font(600, 19); g.textAlign = "center"; g.fillText(String(label), cx, 812); g.textAlign = "left";
    });
    // grid tabs
    g.fillStyle = "#30343b"; g.fillRect(0, 846, W, 2); g.fillStyle = "#f5f5f5"; g.fillRect(0, 846, W / 2, 3);
    // the grid: real posts if given, else the first posts from the screenshot
    const tile = (W - 6) / 3;
    for (let k = 0; k < 6; k++) {
      const x = (k % 3) * (tile + 3), y = 852 + Math.floor(k / 3) * (tile + 3);
      if (posts[k]) {
        const im = posts[k], sq = Math.min(im.naturalWidth, im.naturalHeight);
        g.drawImage(im, (im.naturalWidth - sq) / 2, (im.naturalHeight - sq) / 2, sq, sq, x, y, tile, tile);
      } else if (ready && k < 4) {
        crop(shot, 33 + k * 281, 627, 281, 119, x, y, tile, tile);
      } else {
        const gr = g.createLinearGradient(x, y, x + tile, y + tile);
        gr.addColorStop(0, "#feda75"); gr.addColorStop(0.5, "#d62976"); gr.addColorStop(1, "#4f5bd5");
        g.fillStyle = gr; g.fillRect(x, y, tile, tile);
        g.fillStyle = "#fff"; g.font = font(700, 22); g.textAlign = "center";
        g.fillText("See more on", x + tile / 2, y + tile / 2 - 6); g.fillText("Instagram →", x + tile / 2, y + tile / 2 + 24); g.textAlign = "left";
      }
    }
    tex.needsUpdate = true;
  };
  draw();
  shot.onload = draw;
  shot.src = "/photos/chillhai-insta.png";
  // real posts, if any have been added (chillhai-1.jpg, -2.jpg, …)
  for (let n = 1; n <= 6; n++) {
    const im = new Image();
    im.onload = () => { posts[n - 1] = im; draw(); };
    im.src = `/photos/chillhai-${n}.jpg`;
  }
  return tex;
}

/** Instagram's brand gradient, for the glow around the phone. */
function instaGlow() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 512, 256, 0);
  gr.addColorStop(0, "#feda75"); gr.addColorStop(0.35, "#fa7e1e"); gr.addColorStop(0.6, "#d62976"); gr.addColorStop(0.85, "#962fbf"); gr.addColorStop(1, "#4f5bd5");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HEART = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.18);
  sh.bezierCurveTo(-0.32, 0.02, -0.2, 0.3, 0, 0.14);
  sh.bezierCurveTo(0.2, 0.3, 0.32, 0.02, 0, -0.18);
  return new THREE.ShapeGeometry(sh);
})();

function InstaPhone() {
  const screen = useMemo(instaScreen, []);
  const glow = useMemo(instaGlow, []);
  const hearts = useRef<(THREE.Mesh | null)[]>([]);
  const state = useMemo(() => Array.from({ length: 14 }, () => ({ t: 1, x: 0, sway: 0 })), []);
  const spawn = useRef(0), burst = useRef(0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    spawn.current -= dt;
    // a steady trickle of likes, and a flurry when someone taps the phone
    if (spawn.current <= 0 || burst.current > 0) {
      const free = state.findIndex((h) => h.t >= 1);
      if (free >= 0) { state[free].t = 0; state[free].x = (Math.random() - 0.5) * 2.4; state[free].sway = Math.random() * 6; }
      spawn.current = 0.9 + Math.random() * 0.8;
      if (burst.current > 0) burst.current--;
    }
    state.forEach((h, i) => {
      const m = hearts.current[i];
      if (!m) return;
      if (h.t < 1) h.t += dt / 2.6;
      m.visible = h.t < 1;
      m.position.set(1.9 + h.x * 0.4 + Math.sin(h.t * 6 + h.sway) * 0.25, 4.5 + h.t * 4.2, 0.4);
      m.scale.setScalar(0.6 + Math.sin(Math.min(1, h.t * 4) * Math.PI / 2) * 0.9);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - h.t;
    });
  });
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); burst.current = 8; window.open(INSTA_URL, "_blank", "noopener"); };
  const hover = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  return (
    <group position={[5.6, 0, 0.4]} rotation-y={-0.3}>
      <group onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
        {/* Instagram-gradient glow behind the phone */}
        <mesh position={[0, 5.2, -0.12]}><planeGeometry args={[3.9, 7.4]} /><meshBasicMaterial map={glow} toneMapped={false} /></mesh>
        <RoundedBox args={[3.5, 7.0, 0.28]} radius={0.3} position={[0, 5.2, 0]} castShadow>
          <meshStandardMaterial color="#111317" roughness={0.35} metalness={0.4} />
        </RoundedBox>
        <mesh position={[0, 5.2, 0.145]}>
          <planeGeometry args={[3.2, 6.6]} />
          <meshStandardMaterial map={screen} emissiveMap={screen} emissive="#ffffff" emissiveIntensity={0.85} roughness={0.25} />
        </mesh>
      </group>
      {/* the stand, so the screen sits up where the camera can see it, and an invitation */}
      <mesh position={[0, 0.9, -0.05]} castShadow><boxGeometry args={[0.5, 1.8, 0.3]} /><meshStandardMaterial color="#e4007c" /></mesh>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[2.2, 0.4, 1.1]} /><meshStandardMaterial color="#e4007c" /></mesh>
      <Text font={FONT_SERIF} position={[0, 0.22, 0.56]} fontSize={0.2} color="#fff4dc">Tap the phone · @chill_hai.official</Text>
      {state.map((_, i) => (
        <mesh key={i} ref={(el) => { hearts.current[i] = el; }} geometry={HEART} visible={false}>
          <meshBasicMaterial color="#ff3040" transparent toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- 07 Placement office ---------- */
function Office() {
  const windows = useMemo(() => {
    const w: [number, number][] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = -5 + c * 2, y = 2.6 + r * 2.6;
      if (Math.abs(x) < 4.2 && y > 2 && y < 9) continue; // the SPO Day photo hangs here
      w.push([x, y]);
    }
    return w;
  }, []);
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.5) * 0.25; });
  return (
    <group>
      <mesh position-y={5} castShadow receiveShadow><boxGeometry args={[14, 10, 9]} /><meshStandardMaterial color="#efe3cc" /></mesh>
      {windows.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 4.52]}><planeGeometry args={[1.2, 1.5]} /><meshStandardMaterial color="#3d5a80" emissive="#ffcf86" emissiveIntensity={i % 3 === 0 ? 0.9 : 0.15} /></mesh>
      ))}
      <mesh position={[0, 10.9, 4]}><boxGeometry args={[10, 1.6, 0.3]} /><meshStandardMaterial color="#1e88e5" /></mesh>
      <Text font={FONT_SERIF} position={[0, 10.9, 4.18]} fontSize={0.72} color="#fff">PLACEMENT OFFICE · IITK</Text>
      <Text font={FONT_SERIF} position={[0, 0.9, 4.53]} fontSize={0.55} color="#1e3a5f">1,200+ OFFERS · 75+ COMPANIES</Text>
      <SpoDay />
      <IdCard />
      <group position={[-8.5, 0, 5]}>
        <mesh position-y={6}><cylinderGeometry args={[0.1, 0.12, 12, 8]} /><meshStandardMaterial color="#ccc" /></mesh>
        <mesh ref={flag} position={[1, 11, 0]}><boxGeometry args={[2, 1.2, 0.05]} /><meshStandardMaterial color="#ff9933" /></mesh>
      </group>
    </group>
  );
}

/** SPO Day 2026, on stage: the photo hung big on the office front, lit pink like the night itself. Click for full screen. */
const SPO_STOP = STOPS.findIndex((s) => s.id === "spo");
function SpoDay() {
  const photo = useLoader(THREE.TextureLoader, "/photos/spo-1.jpg");
  useMemo(() => { photo.colorSpace = THREE.SRGBColorSpace; photo.anisotropy = 8; photo.needsUpdate = true; }, [photo]);
  const confetti = useRef<(THREE.Mesh | null)[]>([]);
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: (Math.random() - 0.5) * 9, y: Math.random() * 9, s: 0.4 + Math.random() * 0.6, spin: Math.random() * 6, c: ["#ff4fa3", "#ffd54f", "#ffffff", "#b388ff"][i % 4] })), []);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05), t = clock.elapsedTime;
    bits.forEach((b, i) => {
      b.y -= dt * b.s; if (b.y < 0.3) b.y = 9.5;
      const m = confetti.current[i];
      if (m) { m.position.set(b.x + Math.sin(t * 1.3 + i) * 0.3, b.y, 5.4); m.rotation.set(t * b.spin, t * b.spin * 0.7, 0); }
    });
    if (glow.current) glow.current.opacity = 0.32 + Math.sin(t * 1.6) * 0.06;
  });
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (SPO_STOP >= 0) ui.set({ lightbox: { stop: SPO_STOP, index: 0 } }); };
  const hover = (on: boolean) => { document.body.style.cursor = on ? "zoom-in" : ""; };
  return (
    <group>
      {/* stage light: a soft pink wash behind the frame */}
      <mesh position={[0, 5.4, 4.53]}><planeGeometry args={[10.4, 7.6]} /><meshBasicMaterial ref={glow} color="#ff4fa3" transparent opacity={0.32} toneMapped={false} depthWrite={false} /></mesh>
      <group onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
        <mesh position={[0, 5.4, 4.6]} castShadow><boxGeometry args={[8.3, 5.65, 0.16]} /><meshStandardMaterial color="#f7f1e6" roughness={0.6} /></mesh>
        <mesh position={[0, 5.45, 4.69]}>
          <planeGeometry args={[7.8, 5.2]} />
          <meshStandardMaterial map={photo} emissiveMap={photo} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, 2.25, 4.62]}><boxGeometry args={[5.6, 0.62, 0.1]} /><meshStandardMaterial color="#e91e8c" /></mesh>
      <Text font={FONT_SERIF} position={[0, 2.26, 4.69]} fontSize={0.34} color="#fff">SPO Day 2026 · IIT Kanpur</Text>
      {bits.map((b, i) => (
        <mesh key={i} ref={(el) => { confetti.current[i] = el; }}>
          <planeGeometry args={[0.16, 0.24]} />
          <meshBasicMaterial color={b.c} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** His Campus Recruitment 2025-26 ID, giant, on an SPO-yellow lanyard: it swings a little and turns to catch the light. */
function IdCard() {
  const card = useLoader(THREE.TextureLoader, "/photos/spo-2.jpg");
  useMemo(() => { card.colorSpace = THREE.SRGBColorSpace; card.anisotropy = 8; card.needsUpdate = true; }, [card]);
  const swing = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, g = swing.current;
    if (g) { g.rotation.z = Math.sin(t * 1.1) * 0.05; g.rotation.y = Math.sin(t * 0.45) * 0.35; }
  });
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (SPO_STOP >= 0) ui.set({ lightbox: { stop: SPO_STOP, index: 1 } }); };
  const hover = (on: boolean) => { document.body.style.cursor = on ? "zoom-in" : ""; };
  const W = 3.1, H = W * (943 / 698);
  return (
    <group position={[8.7, 0, 6.6]} rotation-y={-0.25}>
      {/* a little gantry to hang it from */}
      {[-2.05, 2.05].map((x) => <mesh key={x} position={[x, 3.7, 0]} castShadow><boxGeometry args={[0.2, 7.4, 0.2]} /><meshStandardMaterial color="#455a64" /></mesh>)}
      <mesh position={[0, 7.35, 0]}><boxGeometry args={[4.4, 0.22, 0.22]} /><meshStandardMaterial color="#455a64" /></mesh>
      <group ref={swing} position={[0, 7.2, 0]}>
        {/* lanyard: two yellow straps meeting at the clip */}
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x / 2, -0.5, 0]} rotation-z={x > 0 ? 0.5 : -0.5}><boxGeometry args={[0.16, 1.15, 0.02]} /><meshStandardMaterial color="#f9b800" /></mesh>
        ))}
        <mesh position={[0, -1.0, 0]}><torusGeometry args={[0.12, 0.035, 6, 14]} /><meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.25} /></mesh>
        <group position={[0, -1.15 - H / 2, 0]} onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
          <RoundedBox args={[W + 0.12, H + 0.12, 0.06]} radius={0.08} castShadow><meshStandardMaterial color="#1c1c1c" roughness={0.4} /></RoundedBox>
          {[0.035, -0.035].map((z) => (
            <mesh key={z} position-z={z} rotation-y={z < 0 ? Math.PI : 0}>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial map={card} emissiveMap={card} emissive="#ffffff" emissiveIntensity={0.3} roughness={0.35} metalness={0.05} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ---------- 03 IIT Kanpur: the P.K. Kelkar Library, its black sculpture and the flower garden ---------- */

/** Exposed red brick with pale mortar, for the library's upper floor. */
function brickTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9b8a2"; g.fillRect(0, 0, 256, 256);
  const r = rng(31);
  for (let row = 0; row < 16; row++) {
    const off = row % 2 ? 16 : 0;
    for (let col = -1; col < 9; col++) {
      const shade = 0.85 + r() * 0.3;
      g.fillStyle = `rgb(${Math.round(176 * shade)}, ${Math.round(86 * shade)}, ${Math.round(62 * shade)})`;
      g.fillRect(col * 32 + off + 1.5, row * 16 + 1.5, 29, 13);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const LIB = { bays: 13, bay: 2.6, depth: 14 };

function KelkarLibrary() {
  const brick = useMemo(() => {
    const t = brickTexture(); t.repeat.set(1.3, 2.2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  }, []);
  const concrete = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d6ccbb", roughness: 0.85 }), []);
  const darkConcrete = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a39b8f", roughness: 0.9 }), []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d2329", roughness: 0.25, metalness: 0.5 }), []);
  const W = LIB.bays * LIB.bay, D = LIB.depth, front = D / 2;
  const fins = Array.from({ length: LIB.bays + 1 }, (_, k) => -W / 2 + k * LIB.bay);
  const bays = Array.from({ length: LIB.bays }, (_, k) => -W / 2 + (k + 0.5) * LIB.bay);
  return (
    <group position={[0, 0, -9]}>
      {/* ground floor: open, on pillars, the reading rooms in shadow behind */}
      <mesh position={[0, 2.1, -1.5]} material={glass}><boxGeometry args={[W - 3, 4.2, D - 6]} /></mesh>
      {fins.map((x) => [front - 0.4, -front + 0.4].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 2.1, z]} material={concrete} castShadow><boxGeometry args={[0.45, 4.2, 0.45]} /></mesh>
      )))}
      {/* first-floor slab, then the band of tall dark windows */}
      <mesh position={[0, 4.4, 0]} material={concrete} castShadow><boxGeometry args={[W + 0.6, 0.4, D + 0.6]} /></mesh>
      <mesh position={[0, 6.1, 0]} material={brick}><boxGeometry args={[W - 0.2, 3.0, D - 1.2]} /></mesh>
      {bays.map((x) => (
        <group key={x} position={[x, 6.1, front - 0.58]}>
          <mesh material={glass}><boxGeometry args={[1.25, 2.4, 0.06]} /></mesh>
          {[-0.4, 0, 0.4].map((dx) => <mesh key={dx} position={[dx, 0, 0.04]} material={concrete}><boxGeometry args={[0.05, 2.4, 0.04]} /></mesh>)}
          <mesh position={[0, 0.35, 0.04]} material={concrete}><boxGeometry args={[1.25, 0.05, 0.04]} /></mesh>
        </group>
      ))}
      {/* the deep ledge, and the tall brick top floor broken up by concrete fins */}
      <mesh position={[0, 7.8, 0.3]} material={concrete} castShadow><boxGeometry args={[W + 1, 0.5, D + 1.2]} /></mesh>
      <mesh position={[0, 10.0, 0]} material={brick} castShadow><boxGeometry args={[W, 4.0, D]} /></mesh>
      {fins.map((x) => (
        <group key={x}>
          <mesh position={[x, 6.3, front + 0.25]} material={concrete} castShadow><boxGeometry args={[0.5, 12.6, 0.7]} /></mesh>
          <mesh position={[x, 12.75, front + 0.1]} material={darkConcrete}><boxGeometry args={[0.8, 0.5, 0.9]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 12.15, 0]} material={concrete}><boxGeometry args={[W + 0.4, 0.3, D + 0.4]} /></mesh>
      {/* the cluster of concrete towers on the roof */}
      {[[3.2, 5.2, 1.4], [5.0, 6.4, 1.7], [6.9, 5.9, 1.5], [8.5, 4.6, 1.2], [4.2, 3.6, 1.1]].map(([x, h, r], k) => (
        <mesh key={k} position={[x, 12.3 + h / 2, -1 + (k % 2) * 1.2]} rotation-y={Math.PI / 4} material={darkConcrete} castShadow>
          <cylinderGeometry args={[r * 0.55, r, h, 4]} />
        </mesh>
      ))}
      <Sculpture position={[4.5, 0, front + 12]} />
      <Garden front={front} />
      {/* the old carved brick column on the lawn */}
      <group position={[W / 2 - 2.5, 0, front + 6]}>
        {[0, 1, 2, 3].map((k) => <mesh key={k} position-y={0.55 + k * 1.05} material={brick} castShadow><cylinderGeometry args={[0.62 - k * 0.04, 0.66 - k * 0.04, 1.0, 10]} /></mesh>)}
        <mesh position-y={4.35} material={darkConcrete}><boxGeometry args={[1.3, 0.3, 1.3]} /></mesh>
      </group>
    </group>
  );
}

/** The black, folded-paper sculpture on its white dome. */
function Sculpture({ position }: { position: [number, number, number] }) {
  const parts = useMemo(() => {
    const hull = (pts: number[][]) => new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return [
      // the leaning left wing
      hull([[-2.2, 1.0, 0.4], [-0.6, 0.9, 0.9], [-0.9, 1.0, -0.8], [-0.2, 5.6, 0.2], [0.4, 6.4, -0.3], [-1.6, 3.4, 0.9]]),
      // the tall right body, folded at the top
      hull([[0.2, 0.9, 0.8], [1.9, 0.9, 0.5], [1.5, 1.0, -0.9], [0.0, 1.0, -0.6], [0.6, 7.6, 0.3], [2.4, 7.2, -0.2], [1.9, 5.0, 1.0]]),
      // the cap that juts out above
      hull([[-0.4, 7.0, 0.2], [2.3, 7.4, 0.0], [1.0, 8.6, -0.5], [0.2, 8.2, 0.8], [-0.6, 6.4, -0.4]]),
    ];
  }, []);
  const black = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e2126", roughness: 0.55, metalness: 0.25, flatShading: true }), []);
  return (
    <group position={position} rotation-y={0.35}>
      <mesh position-y={-1.9} scale={[1, 0.36, 1]} receiveShadow castShadow>
        <sphereGeometry args={[3.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f1efe9" roughness={0.6} />
      </mesh>
      {parts.map((g, k) => <mesh key={k} geometry={g} material={black} castShadow />)}
    </group>
  );
}

/** Flower beds edged with trimmed hedges, and the paved walk. */
function Garden({ front }: { front: number }) {
  const flowers = useRef<THREE.InstancedMesh>(null);
  const beds = useMemo(() => [
    { x: -12, z: front + 18, w: 10, d: 5, r: 0.25 }, { x: 0, z: front + 20, w: 9, d: 5.5, r: -0.15 },
    { x: 9, z: front + 15, w: 8, d: 5, r: -0.4 }, { x: -2, z: front + 9, w: 7, d: 3.5, r: 0.1 },
  ], [front]);
  useLayoutEffect(() => {
    const m = flowers.current; if (!m) return;
    const r = rng(17), mat = new THREE.Matrix4(), c = new THREE.Color();
    const colors = ["#ffd21f", "#ff9b1a", "#ff4f8b", "#ffffff", "#e8203a", "#c86bff", "#ffeb7a"];
    let n = 0;
    for (const b of beds) for (let k = 0; k < 110; k++) {
      const lx = (r() - 0.5) * (b.w - 1.2), lz = (r() - 0.5) * (b.d - 1.2);
      const x = b.x + lx * Math.cos(b.r) + lz * Math.sin(b.r), z = b.z - lx * Math.sin(b.r) + lz * Math.cos(b.r);
      const sz = 0.16 + r() * 0.14;
      mat.makeScale(sz, sz, sz).setPosition(x, 0.35 + r() * 0.35, z);
      m.setMatrixAt(n, mat);
      m.setColorAt(n, c.set(colors[Math.floor(r() * colors.length)]));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [beds]);
  const hedge = <meshStandardMaterial color="#7d9a2e" roughness={0.95} />;
  return (
    <group>
      {/* a wide lawn in front of the library */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, front + 13]} receiveShadow><planeGeometry args={[40, 24]} /><meshStandardMaterial color="#6f8f3a" roughness={1} /></mesh>
      {beds.map((b, k) => (
        <group key={k} position={[b.x, 0, b.z]} rotation-y={b.r}>
          <mesh position-y={0.05} receiveShadow><boxGeometry args={[b.w, 0.1, b.d]} /><meshStandardMaterial color="#6b4a32" roughness={1} /></mesh>
          {/* the clipped hedge border */}
          {[[0, b.d / 2, b.w, 0.6], [0, -b.d / 2, b.w, 0.6], [b.w / 2, 0, 0.6, b.d], [-b.w / 2, 0, 0.6, b.d]].map(([x, z, w, d], j) => (
            <RoundedBox key={j} args={[w as number, 0.7, d as number]} radius={0.22} position={[x as number, 0.35, z as number]} castShadow>{hedge}</RoundedBox>
          ))}
        </group>
      ))}
      <instancedMesh ref={flowers} args={[undefined, undefined, 440]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {/* the paved walk curving off to the right */}
      <mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[15, 0.03, front + 14]} receiveShadow><planeGeometry args={[3.2, 26]} /><meshStandardMaterial color="#a89a8c" roughness={0.95} /></mesh>
    </group>
  );
}

/* ---------- Competitions & Hackathons: a grand open hall you can walk into ---------- */

const loadTex = (url: string) => {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};
const openUrl = (url: string) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); window.open(url, "_blank", "noopener"); };
const pointer = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };

/** Pale marble tiles with a thin gold seam. */
function marbleTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!, r = rng(9);
  g.fillStyle = "#efe9df"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 40; k++) {
    g.strokeStyle = `rgba(150,140,128,${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath(); g.moveTo(r() * 256, r() * 256); g.bezierCurveTo(r() * 256, r() * 256, r() * 256, r() * 256, r() * 256, r() * 256); g.stroke();
  }
  g.strokeStyle = "#c9a24a"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 253);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const BANNERS: [string, string][] = [["BlinkX", "#5b2bd6"], ["Groww", "#00b386"], ["Swiggy", "#fc8019"], ["Spotify", "#1db954"], ["Meesho DICE", "#9f2089"], ["Sarvam AI", "#3d5afe"], ["The Ken × Zerodha", "#1d3557"], ["SARCathon", "#c1121f"]];

function Hall() {
  const floorMap = useMemo(() => { const t = marbleTexture(); t.repeat.set(9, 8); return t; }, []);
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ddd4c3", roughness: 0.62 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4a83a", metalness: 0.8, roughness: 0.3 }), []);
  const navy = useMemo(() => new THREE.MeshStandardMaterial({ color: "#14213d", roughness: 0.55 }), []);
  const W = HALL.halfW, D = HALL.halfD, Z = HALL.doorZ;
  return (
    <group>
      {/* the floor, raised a step, and the red carpet from the door */}
      <mesh position={[0, 0.12, (Z - D) / 2]} receiveShadow><boxGeometry args={[W * 2 + 1.6, 0.24, Z + D + 1.6]} /><meshStandardMaterial map={floorMap} color="#d9d0c1" roughness={0.4} /></mesh>
      <mesh position={[0, 0.25, (Z + 2) / 2 - 4]} receiveShadow><boxGeometry args={[3.2, 0.03, Z + 6]} /><meshStandardMaterial color="#a4161a" roughness={0.9} /></mesh>
      {[-1.7, 1.7].map((x) => <mesh key={x} position={[x, 0.27, (Z + 2) / 2 - 4]} material={gold}><boxGeometry args={[0.12, 0.02, Z + 6]} /></mesh>)}

      {/* the colonnade: white columns, gold capitals, a beam along the top, and low marble rails between */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          {COLUMNS_Z.map((z) => (
            <group key={z} position={[sx * W, 0, z]}>
              <mesh position-y={0.55} material={white} castShadow><boxGeometry args={[1.3, 0.6, 1.3]} /></mesh>
              <mesh position-y={4.9} material={white} castShadow><cylinderGeometry args={[0.42, 0.5, 8.4, 20]} /></mesh>
              <mesh position-y={9.25} material={gold}><boxGeometry args={[1.25, 0.5, 1.25]} /></mesh>
            </group>
          ))}
          <mesh position={[sx * W, 9.75, (COLUMNS_Z[0] + COLUMNS_Z[COLUMNS_Z.length - 1]) / 2]} material={white} castShadow><boxGeometry args={[1.0, 0.7, 21.2]} /></mesh>
          <mesh position={[sx * W, 0.7, (Z - D) / 2]} material={white}><boxGeometry args={[0.35, 1.1, Z + D - 0.6]} /></mesh>
          {/* banners: the competitions, hanging between the columns */}
          {[-7.5, -2.5, 2.5, 7.5].map((z, k) => {
            const [name, color] = BANNERS[(sx < 0 ? 0 : 4) + k];
            return (
              <group key={z} position={[sx * (W - 0.2), 6.7, z]} rotation-y={-sx * Math.PI / 2}>
                <mesh><planeGeometry args={[2.2, 4.4]} /><meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} /></mesh>
                <mesh position-y={2.25} material={gold}><boxGeometry args={[2.4, 0.08, 0.08]} /></mesh>
                <Text font={FONT_SERIF} position={[0, 0, 0.02]} fontSize={0.36} color="#ffffff" maxWidth={2} textAlign="center" rotation-z={Math.PI / 2}>{name}</Text>
              </group>
            );
          })}
        </group>
      ))}
      {/* the front: a rail either side of a grand entrance */}
      {[-1, 1].map((sx) => <mesh key={sx} position={[sx * (HALL.doorHalf + W) / 2 + sx * 0.35, 0.7, Z]} material={white}><boxGeometry args={[W - HALL.doorHalf - 0.2, 1.1, 0.35]} /></mesh>)}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (HALL.doorHalf + 0.6), 0, Z]}>
          <mesh position-y={5.5} material={white} castShadow><boxGeometry args={[1.5, 11, 1.5]} /></mesh>
          <mesh position-y={11.2} material={gold}><boxGeometry args={[1.8, 0.4, 1.8]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 12.2, Z]} material={navy} castShadow><boxGeometry args={[HALL.doorHalf * 2 + 4.6, 2.2, 0.8]} /></mesh>
      <Text font={FONT_SERIF} position={[0, 12.45, Z + 0.42]} fontSize={0.78} color="#e9c46a" letterSpacing={0.05}>COMPETITIONS & HACKATHONS</Text>
      <Text font={FONT_MONO} position={[0, 11.6, Z + 0.42]} fontSize={0.26} color="#f6f2ea" letterSpacing={0.18}>CASE DECKS · NATIONAL FINAL · PODIUM</Text>
      <mesh position={[0, 14.1, Z]} material={gold} rotation-z={Math.PI / 4}><octahedronGeometry args={[0.9, 0]} /></mesh>

      {/* the deck wall across the back, the booths, and the voice tower in the middle */}
      <group position={[0, 0.24, HALL.wallZ]}><DeckWall /></group>
      <group position={[BOOTH.meesho.x, 0.24, BOOTH.meesho.z]} rotation-y={0.45}><MeeshoBooth /></group>
      <group position={[BOOTH.sarvam.x, 0.24, BOOTH.sarvam.z]} rotation-y={-0.45} scale={0.85}><Podium /></group>
      <group position={[BOOTH.pacto.x, 0.24, BOOTH.pacto.z]}><PactoBooth /></group>
      {/* soft spotlights on each booth */}
      {[BOOTH.meesho, BOOTH.sarvam, BOOTH.pacto].map((b, k) => (
        <mesh key={k} position={[b.x, 5.2, b.z + 0.5]}>
          <coneGeometry args={[3.2, 9.6, 32, 1, true]} />
          <meshBasicMaterial color="#fff2c6" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** The case decks: nine screens on a long wall, each flicking through its first slides. Tap one to open the deck. */
function DeckWall() {
  const slides = useMemo(() => DECKS.map((d) => Array.from({ length: d.slides }, (_, k) => loadTex(`/decks/${d.file}-${k + 1}.jpg`))), []);
  const mats = useMemo(() => slides.map((t) => new THREE.MeshStandardMaterial({ map: t[0], emissiveMap: t[0], emissive: "#ffffff", emissiveIntensity: 0.6, roughness: 0.5 })), [slides]);
  useFrame(({ clock }) => {
    mats.forEach((m, i) => {
      const list = slides[i], k = Math.floor((clock.elapsedTime + i * 1.4) / 3.2) % list.length;
      if (m.map !== list[k]) { m.map = list[k]; m.emissiveMap = list[k]; }
    });
  });
  const len = HALL.halfW * 2 - 1.2;
  return (
    <group>
      <mesh position={[0, 2.6, -0.25]} castShadow receiveShadow><boxGeometry args={[len, 5.2, 0.5]} /><meshStandardMaterial color="#14213d" roughness={0.6} /></mesh>
      <mesh position={[0, 5.25, -0.25]}><boxGeometry args={[len, 0.12, 0.56]} /><meshStandardMaterial color="#d4a83a" metalness={0.8} roughness={0.3} /></mesh>
      <Text font={FONT_SERIF} position={[0, 4.55, 0.02]} fontSize={0.42} color="#e9c46a" letterSpacing={0.06}>THE DECK WALL</Text>
      <Text font={FONT_MONO} position={[0, 4.05, 0.02]} fontSize={0.17} color="#f6f2ea" letterSpacing={0.14}>NINE CASE COMPETITIONS · WALK UP TO ONE, OR TAP IT</Text>
      {DECKS.map((d, i) => (
        <group key={d.file} position={[deckX(i), 0, 0.02]}>
          <group onClick={openUrl(`/decks/${d.file}.pdf`)} onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
            <mesh position={[0, 2.55, 0]}><boxGeometry args={[2.72, 1.6, 0.06]} /><meshStandardMaterial color="#0b0b10" /></mesh>
            <mesh position={[0, 2.55, 0.035]} material={mats[i]}><planeGeometry args={[2.6, 1.46]} /></mesh>
          </group>
          <Text font={FONT_SERIF} position={[0, 1.42, 0.04]} fontSize={0.15} color="#f6f2ea" maxWidth={2.6} textAlign="center">{d.name}</Text>
        </group>
      ))}
    </group>
  );
}

/** Meesho DICE: the parcel with a free sample rising out of it, the live prototype, and the deck. */
function MeeshoBooth() {
  const proto = useMemo(() => loadTex("/decks/meesho-proto.jpg"), []);
  const sachet = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, g = sachet.current;
    if (g) { g.position.y = 3.6 + Math.sin(t * 1.4) * 0.25; g.rotation.y = Math.sin(t * 0.6) * 0.6; }
  });
  const url = EXHIBITS.find((e) => e.id === "meesho")?.links.find((l) => l.embed)?.url ?? "";
  const purple = <meshStandardMaterial color="#9f2089" roughness={0.75} />;
  return (
    <group>
      <mesh position-y={1.1} castShadow receiveShadow><boxGeometry args={[2.8, 2.2, 2.4]} />{purple}</mesh>
      <mesh position={[0, 2.21, 0]}><boxGeometry args={[2.66, 0.02, 2.26]} /><meshStandardMaterial color="#5c1150" /></mesh>
      <mesh position={[0, 1.1, 1.21]}><boxGeometry args={[0.5, 2.2, 0.02]} /><meshStandardMaterial color="#e8c9a0" /></mesh>
      {[[0, 2.2, 1.2, -0.9, 0], [0, 2.2, -1.2, 0.9, 0], [1.4, 2.2, 0, 0, -0.9], [-1.4, 2.2, 0, 0, 0.9]].map(([x, y, z, rx, rz], k) => (
        <group key={k} position={[x, y, z]} rotation={[rx, 0, rz]}>
          <mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={k < 2 ? [2.8, 1.2, 0.05] : [0.05, 1.2, 2.4]} />{purple}</mesh>
        </group>
      ))}
      <Text font={FONT_SERIF} position={[-0.7, 1.5, 1.23]} fontSize={0.36} color="#ffffff">meesho</Text>
      <Text font={FONT_SERIF} position={[0.8, 0.6, 1.23]} fontSize={0.18} color="#ffe3f4" maxWidth={1.2} textAlign="center">{"Pehle Try,\nPhir Buy"}</Text>
      <group ref={sachet} position={[0, 3.6, 0.2]}>
        <RoundedBox args={[1.0, 1.4, 0.1]} radius={0.08} castShadow><meshStandardMaterial color="#ff5fae" roughness={0.4} metalness={0.2} /></RoundedBox>
        <Text font={FONT_SERIF} position={[0, 0.22, 0.06]} fontSize={0.2} color="#fff">SAMPLE</Text>
        <Text font={FONT_SERIF} position={[0, -0.14, 0.06]} fontSize={0.1} color="#fff" maxWidth={0.9} textAlign="center">try it free, tell the brand</Text>
      </group>
      <group position={[3.2, 0, 0.4]} rotation-y={-0.5} onClick={(e) => { e.stopPropagation(); ui.set({ embed: url }); }} onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
        <mesh position={[0, 0.9, -0.08]} castShadow><boxGeometry args={[0.2, 1.8, 0.2]} /><meshStandardMaterial color="#2b2b30" /></mesh>
        <mesh position={[0, 2.75, -0.06]} castShadow><boxGeometry args={[3.5, 2.24, 0.1]} /><meshStandardMaterial color="#14141a" roughness={0.4} /></mesh>
        <mesh position={[0, 2.75, 0.0]}><planeGeometry args={[3.36, 2.1]} /><meshStandardMaterial map={proto} emissiveMap={proto} emissive="#ffffff" emissiveIntensity={0.7} /></mesh>
        <Text font={FONT_SERIF} position={[0, 1.45, 0.02]} fontSize={0.17} color="#f6f2ea">Live prototype · tap to try</Text>
      </group>
      <mesh position={[0, 0.3, 2.3]}><boxGeometry args={[4.6, 0.5, 0.15]} /><meshStandardMaterial color="#9f2089" /></mesh>
      <Text font={FONT_SERIF} position={[0, 0.32, 2.39]} fontSize={0.24} color="#ffffff">MEESHO DICE · ROUND 2</Text>
    </group>
  );
}

/** Pacto: a voice tower broadcasting rings, and the national-finalist plaque. */
function PactoBooth() {
  return (
    <group>
      <group scale={0.4}><Tower /></group>
      <mesh position={[0, 0.5, 2.2]}><boxGeometry args={[4.2, 0.9, 0.18]} /><meshStandardMaterial color="#00c853" /></mesh>
      <Text font={FONT_SERIF} position={[0, 0.62, 2.3]} fontSize={0.24} color="#062e16">PACTO · NATIONAL FINALIST</Text>
      <Text font={FONT_MONO} position={[0, 0.3, 2.3]} fontSize={0.13} color="#062e16">THE KEN × ZERODHA 2026</Text>
    </group>
  );
}

/* ---------- Sarvam AI hackathon: the podium, a silver cup, and a 45-minute clock ---------- */
const TROPHY = new THREE.LatheGeometry(
  [[0, 0], [0.42, 0], [0.42, 0.12], [0.14, 0.22], [0.1, 0.6], [0.16, 0.7], [0.5, 0.95], [0.6, 1.45], [0.55, 1.5], [0.0, 1.5]].map(([x, y]) => new THREE.Vector2(x, y)), 32);

function Podium() {
  const clock = useRef(45 * 60);
  const label = useRef<THREE.Mesh & { text: string }>(null);
  const hand = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    // the 45 minutes, run fast: one minute a second, then round again
    clock.current -= Math.min(dt, 0.1) * 60;
    if (clock.current < 0) clock.current += 45 * 60;
    const m = Math.floor(clock.current / 60), sec = Math.floor(clock.current % 60);
    const t = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    if (label.current && label.current.text !== t) label.current.text = t;
    if (hand.current) hand.current.rotation.z = -(clock.current / (45 * 60)) * Math.PI * 2;
  });
  const block = (x: number, h: number, n: string, color: string, glow: boolean) => (
    <group position={[x, 0, 0]}>
      <mesh position-y={h / 2} castShadow receiveShadow><boxGeometry args={[2.4, h, 2.2]} /><meshStandardMaterial color={glow ? "#ffffff" : "#e9e6f2"} roughness={0.5} emissive={glow ? "#3d5afe" : "#000"} emissiveIntensity={glow ? 0.12 : 0} /></mesh>
      <Text font={FONT_SERIF} position={[0, h / 2, 1.11]} fontSize={0.9} color={color}>{n}</Text>
    </group>
  );
  return (
    <group>
      {block(-2.45, 1.5, "2", "#8e9aaf", true)}
      {block(0, 2.1, "1", "#d4a017", false)}
      {block(2.45, 1.0, "3", "#b5713b", false)}
      {/* the silver cup, on his step */}
      <group position={[-2.45, 1.5, 0]}>
        <mesh geometry={TROPHY} castShadow><meshStandardMaterial color="#e3e7ef" metalness={0.95} roughness={0.18} /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.62, 1.15, 0]} rotation-z={Math.PI / 2}><torusGeometry args={[0.2, 0.05, 8, 16, Math.PI]} /><meshStandardMaterial color="#e3e7ef" metalness={0.95} roughness={0.18} /></mesh>)}
      </group>
      {/* the clock */}
      <group position={[0, 6.2, -1.6]}>
        <mesh rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[2.2, 2.2, 0.3, 48]} /><meshStandardMaterial color="#1b1f3a" roughness={0.4} /></mesh>
        <mesh position-z={0.16}><circleGeometry args={[2.0, 48]} /><meshStandardMaterial color="#f5f6fb" /></mesh>
        {Array.from({ length: 12 }, (_, k) => (
          <mesh key={k} position={[Math.sin((k / 12) * Math.PI * 2) * 1.75, Math.cos((k / 12) * Math.PI * 2) * 1.75, 0.18]} rotation-z={-(k / 12) * Math.PI * 2}>
            <boxGeometry args={[0.06, 0.26, 0.02]} /><meshStandardMaterial color="#1b1f3a" />
          </mesh>
        ))}
        <mesh ref={hand} position-z={0.2}><boxGeometry args={[0.07, 1.6, 0.02]} /><meshStandardMaterial color="#ff3d00" /></mesh>
        <Text ref={label} font={FONT_MONO} position={[0, -0.75, 0.2]} fontSize={0.42} color="#1b1f3a">45:00</Text>
        <mesh position={[0, 2.45, 0]}><cylinderGeometry args={[0.25, 0.25, 0.4, 16]} /><meshStandardMaterial color="#1b1f3a" /></mesh>
      </group>
      <mesh position={[0, 3.25, -1.6]}><boxGeometry args={[0.25, 3.2, 0.25]} /><meshStandardMaterial color="#1b1f3a" /></mesh>
      <mesh position={[0, 0.5, 2.6]}><boxGeometry args={[7.8, 0.85, 0.2]} /><meshStandardMaterial color="#3d5afe" /></mesh>
      <Text font={FONT_SERIF} position={[0, 0.52, 2.72]} fontSize={0.36} color="#ffffff">SARVAM AI HACKATHON · 2ND PLACE</Text>
    </group>
  );
}

/* ---------- 08 Pacto: a radio tower broadcasting voice ---------- */
function Tower() {
  const rings = useRef<THREE.Group>(null);
  const light = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rings.current?.children.forEach((r, i) => {
      const k = ((t * 0.6 + i / 3) % 1);
      r.scale.setScalar(1 + k * 9);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
    });
    if (light.current) light.current.color.set(Math.sin(t * 5) > 0 ? "#ff1744" : "#4a0010");
  });
  const leg = (x: number, z: number) => (
    <mesh key={`${x}${z}`} position={[x * 0.9, 11, z * 0.9]} rotation={[z * -0.07, 0, x * 0.07]} castShadow>
      <cylinderGeometry args={[0.12, 0.16, 22, 6]} /><meshStandardMaterial color="#cfd8dc" metalness={0.5} />
    </mesh>
  );
  return (
    <group>
      {leg(-1, -1)}{leg(1, -1)}{leg(-1, 1)}{leg(1, 1)}
      {[3, 7, 11, 15, 19].map((y) => (
        <mesh key={y} position-y={y}><boxGeometry args={[3.6 - y * 0.14, 0.15, 3.6 - y * 0.14]} /><meshStandardMaterial color="#b0bec5" wireframe /></mesh>
      ))}
      <mesh position-y={22.4}><sphereGeometry args={[0.45, 12, 12]} /><meshBasicMaterial ref={light} toneMapped={false} /></mesh>
      <group ref={rings} position-y={22.4}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={Math.PI / 2}><torusGeometry args={[1, 0.06, 6, 48]} /><meshBasicMaterial color="#00e676" transparent toneMapped={false} /></mesh>
        ))}
      </group>
      <mesh position={[0, 1.6, 3.6]}><boxGeometry args={[6, 2, 0.2]} /><meshStandardMaterial color="#00c853" /></mesh>
      <Text font={FONT_SERIF} position={[0, 1.6, 3.72]} fontSize={0.6} color="#062e16">PACTO · HINGLISH VOICE AI</Text>
    </group>
  );
}

/* ---------- 09 NoBroker: housing societies ---------- */
function Society() {
  const blocks = [{ x: -7, h: 14, w: 5 }, { x: -1.5, h: 19, w: 5 }, { x: 4.5, h: 11, w: 5.5 }, { x: 9.5, h: 16, w: 4 }];
  return (
    <group>
      {blocks.map((b, bi) => (
        <group key={bi} position={[b.x, 0, bi % 2 ? -2 : 0]}>
          <mesh position-y={b.h / 2} castShadow><boxGeometry args={[b.w, b.h, 5]} /><meshStandardMaterial color={["#d7ccc8", "#ffe0b2", "#cfd8dc", "#f8bbd0"][bi]} /></mesh>
          {Array.from({ length: Math.floor(b.h / 2.4) }, (_, r) => [-1, 1].map((c) => (
            <mesh key={`${r}${c}`} position={[c * b.w * 0.24, 1.8 + r * 2.4, 2.51]}>
              <planeGeometry args={[0.9, 1.1]} />
              <meshStandardMaterial color="#37474f" emissive="#ffd180" emissiveIntensity={(r + c + bi) % 3 === 0 ? 1 : 0.1} />
            </mesh>
          )))}
        </group>
      ))}
      <mesh position={[0, 2, 4.2]}><boxGeometry args={[8.5, 2, 0.2]} /><meshStandardMaterial color="#fd3752" /></mesh>
      <Text font={FONT_SERIF} position={[0, 2.25, 4.32]} fontSize={0.8} color="#fff">NoBroker</Text>
      <Text font={FONT_SERIF} position={[0, 1.45, 4.32]} fontSize={0.42} color="#ffe0e4">HomeServices · Gurgaon launch</Text>
      <FounderPost />
    </group>
  );
}

const FOUNDER_POST = STOPS.find((s) => s.id === "nobroker")?.link?.url ?? "https://www.linkedin.com/";

/**
 * The LinkedIn post NoBroker's founder wrote about the internship, as a big card in front of the society.
 * The post's image (public/photos/nobroker-1.png, which also shows in the chapter's photos) sits in the middle,
 * like the real post; without it the card shows one exact line from the post instead.
 */
function postCard() {
  const W = 800, H = 1120;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const font = (w: number, px: number) => `${w} ${px}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;
  const wrap = (text: string, x: number, y: number, max: number, lh: number) => {
    let line = "";
    for (const word of text.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > max && line) { g.fillText(line, x, y); line = word; y += lh; } else line = test;
    }
    g.fillText(line, x, y);
    return y + lh;
  };
  const drawCard = (shot?: HTMLImageElement) => {
    g.fillStyle = "#f4f2ee"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(24, 24, W - 48, H - 48, 22); g.fill();
    // author: initials rather than a photo we don't have
    g.fillStyle = "#fd3752"; g.beginPath(); g.arc(104, 112, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.font = font(700, 38); g.textAlign = "center"; g.fillText("AA", 104, 126); g.textAlign = "left";
    g.fillStyle = "#191919"; g.font = font(700, 32); g.fillText("Amit Kumar Agarwal", 174, 100);
    g.fillStyle = "#666"; g.font = font(400, 24); g.fillText("Founder & CEO at NoBroker.com", 174, 136);
    g.fillText("1mo · 🌐", 174, 168);
    g.fillStyle = "#0a66c2"; g.font = font(700, 28); g.fillText("in", W - 92, 104);
    if (shot) {
      // the post's own image, as LinkedIn shows it
      const size = W - 96, sq = Math.min(shot.naturalWidth, shot.naturalHeight);
      g.drawImage(shot, (shot.naturalWidth - sq) / 2, (shot.naturalHeight - sq) / 2, sq, sq, 48, 204, size, size);
      reactionsAndButton(924, 1000);
      tex.needsUpdate = true;
      return;
    }
    // the one line we can quote exactly
    g.fillStyle = "#e9e5df"; g.fillRect(64, 232, 8, 238);
    g.fillStyle = "#191919"; g.font = `italic 400 46px Georgia, "Times New Roman", serif`;
    wrap("“I always assumed interns rarely get to interact with the CEO.”", 96, 290, W - 170, 60);
    g.fillStyle = "#666"; g.font = font(400, 26);
    wrap("On my internship with NoBroker’s HomeServices team.", 64, 540, W - 128, 36);
    g.fillStyle = "#0a66c2"; g.font = font(600, 28); g.fillText("#NoBroker   #Culture", 64, 640);
    reactionsAndButton(740, 860);
    tex.needsUpdate = true;
  };
  function reactionsAndButton(rowY: number, buttonY: number) {
    [["#378fe9", "👍"], ["#df704d", "❤"], ["#6dae4f", "👏"]].forEach(([bg, e], k) => {
      g.fillStyle = bg; g.beginPath(); g.arc(88 + k * 30, rowY + 10, 20, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#fff"; g.font = font(400, 20); g.textAlign = "center"; g.fillText(e, 88 + k * 30, rowY + 17); g.textAlign = "left";
    });
    g.fillStyle = "#666"; g.font = font(400, 26); g.fillText("457 reactions", 168, rowY + 20);
    g.fillStyle = "#0a66c2"; g.beginPath(); g.roundRect(64, buttonY, W - 128, 80, 40); g.fill();
    g.fillStyle = "#fff"; g.font = font(700, 29); g.textAlign = "center"; g.fillText("Tap to read the full post on LinkedIn", W / 2, buttonY + 51); g.textAlign = "left";
  }
  drawCard();
  const img = new Image();
  img.onload = () => drawCard(img);
  img.src = "/photos/nobroker-1.png";
  return tex;
}

/** LinkedIn's reactions, as little round badges. */
function reactionBadge(bg: string, glyph: string) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#fff"; g.font = '64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(glyph, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function FounderPost() {
  const card = useMemo(postCard, []);
  const badges = useMemo(() => [reactionBadge("#378fe9", "👍"), reactionBadge("#df704d", "❤"), reactionBadge("#6dae4f", "👏")], []);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const state = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ t: 1, x: 0, kind: i % 3 })), []);
  const spawn = useRef(0), burst = useRef(0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    spawn.current -= dt;
    if (spawn.current <= 0 || burst.current > 0) {
      const free = state.findIndex((h) => h.t >= 1);
      if (free >= 0) { state[free].t = 0; state[free].x = (Math.random() - 0.5) * 4; }
      spawn.current = 0.8 + Math.random() * 0.8;
      if (burst.current > 0) burst.current--;
    }
    state.forEach((h, i) => {
      const sp = sprites.current[i];
      if (!sp) return;
      if (h.t < 1) h.t += dt / 3;
      sp.visible = h.t < 1;
      sp.position.set(h.x + Math.sin(h.t * 5 + i) * 0.3, 5.4 + h.t * 4, 0.3);
      sp.scale.setScalar(0.5 + Math.min(1, h.t * 5) * 0.35);
      sp.material.opacity = 1 - h.t * h.t;
    });
  });
  const open = (e: { stopPropagation: () => void }) => { e.stopPropagation(); burst.current = 8; window.open(FOUNDER_POST, "_blank", "noopener"); };
  const hover = (on: boolean) => { document.body.style.cursor = on ? "pointer" : ""; };
  return (
    <group position={[-4.8, 0, 5.4]} rotation-y={0.12}>
      <Text font={FONT_SERIF} position={[0, 7.75, 0.05]} fontSize={0.38} color="#ffffff" outlineWidth={0.02} outlineColor="#1a1208" textAlign="center" maxWidth={6}>
        {"Written about my internship\nby NoBroker’s Founder & CEO"}
      </Text>
      <group onClick={open} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)}>
        <RoundedBox args={[4.7, 6.5, 0.22]} radius={0.18} position={[0, 3.85, -0.06]} castShadow>
          <meshStandardMaterial color="#0a66c2" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 3.85, 0.06]}>
          <planeGeometry args={[4.4, 6.16]} />
          <meshStandardMaterial map={card} emissiveMap={card} emissive="#ffffff" emissiveIntensity={0.6} roughness={0.5} />
        </mesh>
      </group>
      {[-1.5, 1.5].map((x) => <mesh key={x} position={[x, 0.35, -0.1]} castShadow><boxGeometry args={[0.18, 0.7, 0.18]} /><meshStandardMaterial color="#37474f" /></mesh>)}
      {state.map((h, i) => (
        <sprite key={i} ref={(el) => { sprites.current[i] = el; }} visible={false}>
          <spriteMaterial map={badges[h.kind]} transparent toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

/* ---------- 10 Drive-in cinema showing Letterboxd favourites ---------- */
function marquee() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, "#1b1030"); grd.addColorStop(1, "#08060f");
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#ffd54f"; g.font = "bold 46px Georgia, serif"; g.textAlign = "center";
  g.fillText("★  NOW SHOWING  ★", 512, 80);
  g.fillStyle = "#fff8e6"; g.font = "italic 54px Georgia, serif";
  ["Fight Club", "Memories of Murder", "Predestination", "The Wailing"].forEach((f, i) => g.fillText(f, 512, 170 + i * 72));
  g.fillStyle = "#ff8a65"; g.font = "28px Georgia, serif";
  g.fillText("Mukund's Letterboxd top 4 · 56 films and counting", 512, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Cinema() {
  const map = useMemo(marquee, []);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (screen.current) screen.current.emissiveIntensity = 0.95 + Math.sin(clock.elapsedTime * 23) * 0.04 + Math.sin(clock.elapsedTime * 3.1) * 0.05; });
  const bulbs = useMemo(() => {
    const b: [number, number][] = [];
    for (let i = 0; i <= 20; i++) { b.push([-10.6 + i * 1.06, 13.6]); b.push([-10.6 + i * 1.06, 2.4]); }
    for (let i = 1; i < 11; i++) { b.push([-10.6, 2.4 + i * 1.02]); b.push([10.6, 2.4 + i * 1.02]); }
    return b;
  }, []);
  return (
    <group>
      {[-8, 8].map((x) => <mesh key={x} position={[x, 2, -0.3]}><boxGeometry args={[0.6, 4, 0.6]} /><meshStandardMaterial color="#3e2723" /></mesh>)}
      <mesh position={[0, 8, -0.2]} castShadow><boxGeometry args={[22, 12, 0.4]} /><meshStandardMaterial color="#2a1a14" /></mesh>
      <mesh position={[0, 8, 0.02]}><planeGeometry args={[20.4, 10.4]} /><meshStandardMaterial ref={screen} map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={1} toneMapped={false} /></mesh>
      {bulbs.map(([x, y], i) => <mesh key={i} position={[x, y, 0.1]}><sphereGeometry args={[0.13, 8, 8]} /><meshBasicMaterial color="#ffe082" toneMapped={false} /></mesh>)}
      {[-6, -2, 2, 6].map((x) => <mesh key={x} position={[x, 0.5, 9]}><boxGeometry args={[2.6, 1, 1.2]} /><meshStandardMaterial color="#b71c1c" /></mesh>)}
    </group>
  );
}

/* ---------- 11 Wispr Flow billboard (uses /photos/mukund.jpg if present) ---------- */
function billboardTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (photo?: HTMLImageElement) => {
    g.fillStyle = "#fff4dc"; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = "#ff3d00"; g.fillRect(0, 0, 1024, 18); g.fillRect(0, 494, 1024, 18);
    const textX = photo ? 420 : 60;
    if (photo) {
      const s = Math.min(photo.width, photo.height);
      g.save(); g.beginPath(); g.arc(210, 256, 170, 0, Math.PI * 2); g.clip();
      g.drawImage(photo, (photo.width - s) / 2, (photo.height - s) / 2, s, s, 40, 86, 340, 340);
      g.restore();
      g.lineWidth = 10; g.strokeStyle = "#1a1208"; g.beginPath(); g.arc(210, 256, 170, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = "#1a1208"; g.font = "bold 40px Georgia, serif"; g.fillText(FIRST ? `NAMASTE ${FIRST.toUpperCase()} · NEXT STOP` : "NEXT STOP", textX, 130);
    g.fillStyle = "#ff3d00"; g.font = "bold 96px Georgia, serif"; g.fillText("Wispr Flow", textX, 230);
    g.fillStyle = "#1a1208"; g.font = "38px Georgia, serif";
    g.fillText(`${ME.name} · Growth, India`, textX, 310);
    g.font = "italic 32px Georgia, serif"; g.fillStyle = "#5d4037";
    g.fillText("This whole ride was built by voice.", textX, 380);
    g.font = "bold 30px Georgia, serif"; g.fillStyle = "#ff3d00";
    g.fillText("Can start in November · Bengaluru", textX, 440);
    tex.needsUpdate = true;
  };
  draw();
  const img = new Image();
  img.onload = () => draw(img);
  img.src = "/photos/mukund.jpg";
  return tex;
}

function Billboard() {
  const map = useMemo(billboardTexture, []);
  return (
    <group>
      {[-6, 6].map((x) => <mesh key={x} position={[x, 4, -0.3]} castShadow><boxGeometry args={[0.6, 8, 0.6]} /><meshStandardMaterial color="#455a64" /></mesh>)}
      <mesh position={[0, 11, -0.2]} castShadow><boxGeometry args={[17, 8.6, 0.4]} /><meshStandardMaterial color="#263238" /></mesh>
      <mesh position={[0, 11, 0.02]}><planeGeometry args={[16.4, 8.2]} /><meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.55} /></mesh>
    </group>
  );
}

const BY_TYPE = {
  taj: Taj, books: Books, climb: Climb, stall: Stall, office: Office, hall: Hall,
  society: Society, cinema: Cinema, billboard: Billboard,
} as const;

export function Landmarks() {
  return (
    <group>
      {STOPS.map((s, i) => {
        // IIT Kanpur: the gate over the road, and the library (with its sculpture and garden) beside it
        if (s.landmark === "gate") return <group key={s.id}><OnRoad i={i}><Gate /></OnRoad><Placed i={i}><KelkarLibrary /></Placed></group>;
        // the comeback: the speed breaker on the road, and the climb beside it
        if (s.id === "comeback") return <group key={s.id}><OnRoad i={i}><Breaker /></OnRoad><Placed i={i}><Climb /></Placed></group>;
        const C = BY_TYPE[s.landmark];
        return <Placed key={s.id} i={i}><C /></Placed>;
      })}
    </group>
  );
}
