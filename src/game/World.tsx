import { useEffect, useMemo } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { COLLIDERS, PONDS, ROAD_HALF, SAMPLES, SAMPLE_COUNT, START, TREES, rng } from "./track";

/* ---------- sky: a real sky photo (Poly Haven, CC0) that also lights the scene ---------- */
// a bright morning with soft grey-white clouds: Poly Haven's Kloofendal 48° Partly Cloudy (CC0)
const PHOTO_SUN = new THREE.Vector3(0.452, 0.785, 0.425).normalize(); // where the sun sits in that photo
// turn the whole sky so the morning sun is behind the title-screen camera and a little to its left:
// the camera looks into clear blue sky, and Mukund and his auto are lit from the front
const SKY_TURN = (() => {
  const h = START.heading, fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), right = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
  const view = fwd.multiplyScalar(-0.85).addScaledVector(right, 0.55).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - 0.7);
  return Math.atan2(view.x, view.z) - Math.atan2(PHOTO_SUN.x, PHOTO_SUN.z);
})();
export const SUN_DIR = PHOTO_SUN.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), SKY_TURN);
export const HAZE = "#c4d2df"; // the photo's pale blue horizon, so distant things fade into it

export function Sky() {
  const scene = useThree((s) => s.scene);
  const tex = useLoader(THREE.TextureLoader, "/env/sky.jpg");
  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    scene.backgroundRotation.set(0, SKY_TURN, 0);
    return () => { scene.background = null; };
  }, [scene, tex]);
  return <Environment files="/env/sky_1k.hdr" environmentIntensity={0.75} environmentRotation={[0, SKY_TURN, 0]} />;
}

/* ---------- small helpers ---------- */
function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
/** Smooth value noise in 0..1. */
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;

function useTiled(url: string, repeat: number, srgb: boolean) {
  const t = useLoader(THREE.TextureLoader, url);
  return useMemo(() => {
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(repeat, repeat); c.anisotropy = 8;
    c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    c.needsUpdate = true;
    return c;
  }, [t, repeat, srgb]);
}

/* ---------- ground: photo-scanned grass, with big soft patches so the tiling never shows ---------- */
const GROUND = 2400;
function patchTexture() {
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d")!, img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = fbm(x / 22, y / 22), i = (y * n + x) * 4;
    // lush green ↔ sun-dried straw
    img.data[i] = 200 + v * 70; img.data[i + 1] = 215 + v * 40; img.data[i + 2] = 170 + v * 30; img.data[i + 3] = 255;
    if (v < 0.42) { img.data[i] = 170; img.data[i + 1] = 215; img.data[i + 2] = 150; }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Ground() {
  const map = useTiled("/tex/grass.webp", GROUND / 7, true);
  const normalMap = useTiled("/tex/grass_n.webp", GROUND / 7, false);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
    const patches = patchTexture();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.patches = { value: patches };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vWorldXZ;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D patches;\nvarying vec2 vWorldXZ;")
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= texture2D(patches, vWorldXZ / 180.0).rgb;");
    };
    return m;
  }, [map, normalMap]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={material}>
      <planeGeometry args={[GROUND, GROUND]} />
    </mesh>
  );
}

/* ---------- road: real asphalt, painted lines, dusty shoulders ---------- */
function ribbon(inner: number, outer: number, y: number, uScale = 9) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let dist = 0;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const p = SAMPLES[i];
    const a = SAMPLES[Math.max(0, i - 1)], b = SAMPLES[Math.min(SAMPLE_COUNT, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, len = Math.hypot(tx, tz) || 1;
    const sx = tz / len, sz = -tx / len;
    if (i > 0) dist += p.distanceTo(SAMPLES[i - 1]);
    pos.push(p.x + sx * outer, y, p.z + sz * outer, p.x + sx * inner, y, p.z + sz * inner);
    uv.push(0, dist / uScale, 1, dist / uScale);
    if (i < SAMPLE_COUNT) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function markingsTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = "rgba(240,236,226,0.92)"; g.fillRect(10, 0, 7, 512); g.fillRect(239, 0, 7, 512);
  g.fillStyle = "rgba(255,204,0,0.95)"; g.fillRect(123, 40, 10, 220);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function shoulderTexture() {
  // packed earth at the tarmac's edge, thinning out into the grass
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  const r = rng(4);
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, "rgba(150,122,88,0)"); grad.addColorStop(0.35, "rgba(150,122,88,0.75)"); grad.addColorStop(1, "rgba(140,112,80,0.95)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? "rgba(90,70,50,0.25)" : "rgba(210,190,150,0.25)"; g.fillRect(r() * 128, r() * 128, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Road() {
  const road = useMemo(() => ribbon(-ROAD_HALF, ROAD_HALF, 0.03), []);
  const lines = useMemo(() => ribbon(-ROAD_HALF, ROAD_HALF, 0.036), []);
  const left = useMemo(() => ribbon(ROAD_HALF - 0.1, ROAD_HALF + 2.2, 0.02, 4), []);
  const right = useMemo(() => ribbon(-ROAD_HALF + 0.1, -ROAD_HALF - 2.2, 0.02, 4), []);
  const asphalt = useLoader(THREE.TextureLoader, "/tex/asphalt.webp");
  const asphaltN = useLoader(THREE.TextureLoader, "/tex/asphalt_n.webp");
  const maps = useMemo(() => {
    const a = asphalt.clone(), n = asphaltN.clone();
    for (const t of [a, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.6); t.anisotropy = 8; t.needsUpdate = true; }
    a.colorSpace = THREE.SRGBColorSpace;
    return { a, n, lines: markingsTexture(), dirt: shoulderTexture() };
  }, [asphalt, asphaltN]);
  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial map={maps.a} normalMap={maps.n} color="#b9b4ae" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={lines} receiveShadow>
        <meshStandardMaterial map={maps.lines} transparent depthWrite={false} roughness={0.7} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {[left, right].map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial map={maps.dirt} transparent depthWrite={false} roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- grass: tens of thousands of blades along the road, swaying in the wind ---------- */
const BLADES = 32000;
export function Grass() {
  const { mesh, material } = useMemo(() => {
    // one blade: a tapering strip, darker at the root
    const g = new THREE.BufferGeometry();
    const segs = 3, pos: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, w = 0.028 * (1 - t * 0.85);
      pos.push(-w, t, 0, w, t, 0);
      const c = new THREE.Color().setHSL(0.22, 0.42, 0.15 + t * 0.3);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    const time = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.6 + root.x * 0.31 + root.z * 0.23) * 0.22 + sin(uTime * 3.3 + root.x * 1.1) * 0.06;
          transformed.x += sway * position.y * position.y;
          transformed.z += sway * 0.5 * position.y * position.y;`);
      // the lighting should treat a blade as facing up, or it goes black when side-on to the sun
      sh.vertexShader = sh.vertexShader.replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);");
    };
    m.userData.time = time;

    const im = new THREE.InstancedMesh(g, m, BLADES);
    const r = rng(99), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const solid = COLLIDERS.filter((k) => k.r > 2);
    let n = 0, guard = 0;
    while (n < BLADES && guard++ < BLADES * 3) {
      const i = Math.floor(r() * SAMPLE_COUNT), a = SAMPLES[i], b = SAMPLES[i + 1];
      const tx = b.x - a.x, tz = b.z - a.z, len = Math.hypot(tx, tz) || 1;
      const side = r() < 0.5 ? -1 : 1, off = ROAD_HALF + 1.1 + Math.pow(r(), 2.2) * 22, along = r();
      p.set(a.x + tx * along + (tz / len) * off * side, 0, a.z + tz * along - (tx / len) * off * side);
      if (solid.some((k) => (k.x - p.x) ** 2 + (k.z - p.z) ** 2 < (k.r + 0.5) ** 2)) continue;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4));
      const h = 0.22 + r() * 0.45 + (off > 12 ? 0.15 : 0);
      s.set(0.8 + r() * 0.6, h, 1);
      im.setMatrixAt(n, mat.compose(p, q, s));
      // patches of fresh and dry grass, like the ground beneath
      const dry = fbm(p.x / 40, p.z / 40);
      im.setColorAt(n, c.setHSL(0.2 + (1 - dry) * 0.06 + r() * 0.02, 0.5, 0.75 + r() * 0.35));
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    return { mesh: im, material: m };
  }, []);
  useFrame(({ clock }) => { (material.userData.time as { value: number }).value = clock.elapsedTime; });
  return <primitive object={mesh} />;
}

/* ---------- trees: real-looking ones (generated with EZ-Tree, MIT), instanced in chunks ---------- */
const TREE_MODELS = [
  { url: "/models/trees/oak-medium.glb", height: [9, 13], weight: 0.24 },
  { url: "/models/trees/ash-medium.glb", height: [10, 14], weight: 0.14 },
  { url: "/models/trees/aspen-medium.glb", height: [9, 12], weight: 0.26 },
  { url: "/models/trees/oak-small.glb", height: [5, 8], weight: 0.28 },
  { url: "/models/trees/bush-1.glb", height: [1.6, 2.8], weight: 0.08 },
] as const;
const CHUNK = 80; // metres per culling chunk (bigger: fewer draw calls; smaller: tighter culling)
const DRAW_TREES = 300; // chunks further than this from the camera are skipped (the haze hides them anyway)

/** The models are quantized (small ints): unpack to floats before moving them, or every value clamps to ±1. */
function toFloat(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const a = attr as THREE.BufferAttribute, arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (g.index) out.setIndex(g.index.clone());
  return out;
}

export function Trees() {
  const gltfs = useGLTF(TREE_MODELS.map((m) => m.url));
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    const r = rng(21);
    // pick a model for each tree spot
    const pickModel = () => {
      let x = r();
      for (let i = 0; i < TREE_MODELS.length; i++) { x -= TREE_MODELS[i].weight; if (x <= 0) return i; }
      return 0;
    };
    const placed = TREES.map((t) => ({ t, model: pickModel(), rot: r() * Math.PI * 2, k: r() }));
    gltfs.forEach((gltf, mi) => {
      const parts: THREE.Mesh[] = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) parts.push(o as THREE.Mesh); });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const modelH = box.max.y - box.min.y;
      const mine = placed.filter((p) => p.model === mi);
      // group by chunk so the camera only draws the trees it can see
      const chunks = new Map<string, typeof mine>();
      for (const p of mine) {
        const key = `${Math.floor(p.t.x / CHUNK)},${Math.floor(p.t.z / CHUNK)}`;
        (chunks.get(key) ?? chunks.set(key, []).get(key)!).push(p);
      }
      for (const list of chunks.values()) for (const part of parts) {
        const geo = toFloat(part.geometry).applyMatrix4(part.matrixWorld);
        const mat = part.material as THREE.MeshStandardMaterial;
        if (mat.alphaTest > 0) mat.side = THREE.DoubleSide;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        list.forEach((p, i) => {
          const [lo, hi] = TREE_MODELS[mi].height;
          const k = (lo + (hi - lo) * p.k) / modelH;
          s.setScalar(k);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
          im.setMatrixAt(i, m4.compose(new THREE.Vector3(p.t.x, -box.min.y * k, p.t.z), q, s));
        });
        im.castShadow = true; im.receiveShadow = false;
        im.computeBoundingSphere();
        out.push(im);
      }
    });
    return out;
  }, [gltfs]);
  useFrame(({ camera }) => {
    for (const m of meshes) {
      const c = m.boundingSphere!.center;
      m.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < DRAW_TREES + m.boundingSphere!.radius;
    }
  });
  return <group>{meshes.map((m, i) => <primitive key={i} object={m} />)}</group>;
}
TREE_MODELS.forEach((m) => useGLTF.preload(m.url));

/* ---------- distant hills: a soft ring of grassy rises fading into the haze ---------- */
export function Hills() {
  const geometry = useMemo(() => {
    const rings = 40, segs = 220, inner = 340, outer = 900;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const green = new THREE.Color("#5f7d45"), dry = new THREE.Color("#9c8f62"), far = new THREE.Color("#8ea0a8");
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, rad = inner + (outer - inner) * t;
      for (let j = 0; j <= segs; j++) {
        const a = (j / segs) * Math.PI * 2, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        const rise = Math.min(1, t * 2.2);
        const h = (fbm(Math.cos(a) * 4 + 10, Math.sin(a) * 4 + t * 3) * 95 + fbm(x / 60, z / 60) * 25) * rise - 2;
        pos.push(x, Math.max(-1, h), z);
        const c = green.clone().lerp(dry, fbm(x / 90, z / 90)).lerp(far, t * 0.7);
        col.push(c.r, c.g, c.b);
        if (i < rings && j < segs) { const k = i * (segs + 1) + j; idx.push(k, k + segs + 1, k + 1, k + 1, k + segs + 1, k + segs + 2); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A wobbly outline, so the ponds don't look like perfect discs. */
function blob(r: number, seed: number, grow = 0) {
  const sh = new THREE.Shape();
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + seed) * 0.09 + Math.sin(a * 5 + seed * 2.3) * 0.05) + grow;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.78;
    if (k) sh.lineTo(x, y); else sh.moveTo(x, y);
  }
  return new THREE.ShapeGeometry(sh, 2);
}

/** Small ponds between chapters: a muddy bank, water that mirrors the sky, lily pads and reeds. */
export function Ponds() {
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3f7590", roughness: 0.06, metalness: 0.35, envMapIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2 }), []);
  const bank = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7a6a48", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), []);
  const pad = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4f7f34", roughness: 0.8 }), []);
  const reed = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6b7d3a", roughness: 0.9 }), []);
  const ponds = useMemo(() => PONDS.map((p) => {
    const r = rng(p.seed + 11);
    return {
      ...p, water: blob(p.r, p.seed), bank: blob(p.r, p.seed, 1.4),
      pads: Array.from({ length: 6 }, () => { const a = r() * 6.28, d = p.r * (0.35 + r() * 0.5); return [Math.cos(a) * d, Math.sin(a) * d * 0.78, 0.35 + r() * 0.3] as const; }),
      reeds: Array.from({ length: 14 }, () => { const a = r() * 6.28; return [Math.cos(a) * (p.r + 0.6), Math.sin(a) * (p.r + 0.6) * 0.78, 0.9 + r() * 0.9] as const; }),
    };
  }), []);
  return (
    <group>
      {ponds.map((p) => (
        <group key={p.seed} position={[p.x, 0, p.z]} rotation-y={p.seed}>
          <mesh geometry={p.bank} material={bank} rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow />
          <mesh geometry={p.water} material={water} rotation-x={-Math.PI / 2} position-y={0.06} receiveShadow />
          {p.pads.map(([x, y, s], k) => <mesh key={k} material={pad} rotation-x={-Math.PI / 2} position={[x, 0.08, -y]}><circleGeometry args={[s, 10, 0.4, 5.6]} /></mesh>)}
          {p.reeds.map(([x, y, h], k) => <mesh key={k} material={reed} position={[x, h / 2, -y]} rotation-z={(k % 3 - 1) * 0.15}><coneGeometry args={[0.05, h, 4]} /></mesh>)}
        </group>
      ))}
    </group>
  );
}
