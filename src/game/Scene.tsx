import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Dust, Milestones, Poles } from "./Roadside";
import { Character } from "./Character";
import { DiyaLights } from "./Mirror";
import * as THREE from "three";
import { Auto, CameraRig, NextArrow } from "./Auto";
import { Director, ReadySignal } from "./Director";
import { Landmarks } from "./Landmarks";
import { Grass, Ground, HAZE, Hills, Road, Sky, SUN_DIR, Trees, Ponds } from "./World";
import { Cinematic } from "./Cinematic";
import { focus } from "./store";
import { Player } from "./Player";
import { Toys } from "./Toys";
import { Life } from "./Life";
import { ui, useUI } from "./store";
import { DPR, initialTier, type Tier } from "./quality";

ui.set({ quality: initialTier() });

/** Daylight from where the sun sits in the sky photo; its shadow box follows the player. */
function SunLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const tier = useUI((s) => s.quality);
  const sharp = useUI((s) => s.quality === 2 || (s.quality === 1 && s.hero && s.opened));
  // a bigger shadow map for hero shots: resizing it reallocates the map, but recompiles nothing
  useEffect(() => {
    const l = light.current; if (!l) return;
    const n = sharp ? 2048 : 1024;
    if (l.shadow.mapSize.x === n) return;
    l.shadow.mapSize.set(n, n); l.shadow.map?.dispose(); (l.shadow as { map: unknown }).map = null;
  }, [sharp]);
  const target = useMemo(() => new THREE.Object3D(), []);
  const frame = useRef(0);
  useFrame(({ gl }) => {
    // shadows redraw every other frame: invisible at 60 fps, and half the cost of the shadow pass
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = frame.current++ % 2 === 0;
    const l = light.current;
    if (!l) return;
    target.position.copy(focus());
    l.position.copy(focus()).addScaledVector(SUN_DIR, 90);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        key={tier} ref={light} target={target} castShadow={tier > 0} intensity={2.7} color="#ffeccc"
        shadow-mapSize={tier === 2 ? [2048, 2048] : [1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.04}
        shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-far={220}
      />
    </>
  );
}

export default function Scene() {
  const tier = useUI((s) => s.quality);
  const ready = useUI((s) => s.ready && s.opened);
  const range = DPR[tier];
  // start at the tier's resolution and only go sharper once the device shows it has frames to spare
  const maxDpr = Math.min(window.devicePixelRatio || 1, range.max);
  const [dpr, setDpr] = useState(range.start);
  // hero shots on balanced quality: 4x MSAA, the sharpest edges per frame spent (33 fps on an Intel UHD 630 title
  // screen, vs 11 with a resolution boost too). Never while loading, so the curtain isn't held up.
  const hero = useUI((s) => s.hero && s.opened) && tier === 1;
  useEffect(() => { setDpr(DPR[tier].start); }, [tier]);
  return (
    <Canvas shadows dpr={dpr} camera={{ fov: 55, near: 0.5, far: 2000, position: [30, 14, 30] }} gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 0.95 }}
      onCreated={({ camera, scene, gl }) => { if (import.meta.env.DEV) Object.assign(window, { __cam: camera, __scene: scene, __gl: gl }); }}>
      <PerformanceMonitor
        onDecline={() => {
          if (ui.get().hero) return; // hero shots are slow scripted moves; a lower frame rate there is fine
          // first a lower resolution, then a lighter tier (the film pass, shadows and grass go in steps)
          if (dpr > range.min + 0.01) setDpr((d) => Math.max(range.min, d - 0.15));
          else if (tier > 0) ui.set({ quality: (tier - 1) as Tier });
        }}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.15))}
        // only step down when it's genuinely struggling (under 24 fps); 25-30 fps with the film look beats 50 without it
        bounds={(refresh) => [24, refresh > 90 ? 75 : 55]}
        flipflops={4}
      />
      <fog attach="fog" args={[HAZE, 120, 420]} />
      <hemisphereLight args={["#d6e6fa", "#5c5a3e", 0.55]} />
      <SunLight />
      {/* what the opening shot needs loads first, and the film starts once it has (ReadySignal is inside) */}
      <Suspense fallback={null}>
      <Sky />
      <Ground />
      <Road />
      <Grass />
      <Hills />
      <Milestones />
      <Poles />
      <Dust />
      <Auto />
      <Character />
      <DiyaLights />
      <Player />
      <NextArrow />
      <CameraRig />
      <Director />
      <ReadySignal />
      </Suspense>
      {/* the rest of the world only starts loading once the curtain is up, so it never holds up the loading screen */}
      {ready && <Suspense fallback={null}>
      <Trees />
      <Ponds />
      <Landmarks />
      <Toys />
      <Life />
      </Suspense>}
      {tier > 0 && <Cinematic rays={tier === 2} samples={tier === 2 || hero ? 4 : 0} />}

    </Canvas>
  );
}
