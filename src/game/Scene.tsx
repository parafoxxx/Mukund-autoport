import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Dust, Milestones, Poles } from "./Roadside";
import { Character } from "./Character";
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

/** Daylight from where the sun sits in the sky photo; its shadow box follows the player. */
function SunLight() {
  const light = useRef<THREE.DirectionalLight>(null);
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
        ref={light} target={target} castShadow intensity={2.7} color="#ffeccc"
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}
        shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-far={220}
      />
    </>
  );
}

export default function Scene() {
  const mobile = typeof window !== "undefined" && Math.min(innerWidth, innerHeight) < 600;
  // start at normal resolution and only go sharper once the device shows it has frames to spare
  const maxDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  const [dpr, setDpr] = useState(1);
  // the god rays are the first thing to go if the frame rate can't keep up; the grade stays
  const [rays, setRays] = useState(true);
  return (
    <Canvas shadows dpr={dpr} camera={{ fov: 55, near: 0.5, far: 2000, position: [30, 14, 30] }} gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 0.95 }}
      onCreated={({ camera, scene, gl }) => { if (import.meta.env.DEV) Object.assign(window, { __cam: camera, __scene: scene, __gl: gl }); }}>
      <PerformanceMonitor
        onDecline={() => { if (dpr <= 1) setRays(false); setDpr((d) => Math.max(1, d - 0.25)); }}
        onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))}
        flipflops={3}
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
      <Player />
      <NextArrow />
      <CameraRig />
      <Director />
      <ReadySignal />
      </Suspense>
      {/* the rest of the world streams in right behind it, without holding up the curtain */}
      <Suspense fallback={null}>
      <Trees />
      <Ponds />
      <Landmarks />
      <Toys />
      <Life />
      </Suspense>
      <Cinematic rays={rays} />

    </Canvas>
  );
}
