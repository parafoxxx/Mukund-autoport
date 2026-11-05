import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { focus, ui, walker } from "./store";
import { inHall } from "./hall";

const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const here = new THREE.Vector3();

/**
 * A little "click me" tag floating over a 3D thing you can click, so nobody mistakes it for scenery.
 * It shows while its chapter's cinematic is playing (`stop`), when you get close to it (`near`, in metres),
 * or, for the hall's exhibits, while you're walking around inside the hall (`hall`).
 */
export function ClickTag({ position = [0, 0, 0], label = "Click me", stop = -1, near = 0, hall = false, below = false }: {
  position?: [number, number, number]; label?: string; stop?: number | number[]; near?: number; hall?: boolean; below?: boolean;
}) {
  const stops = Array.isArray(stop) ? stop : [stop];
  const anchor = useRef<THREE.Group>(null);
  const [on, setOn] = useState(false);
  const last = useRef(0);
  useFrame(({ clock }) => {
    // a few checks a second is plenty
    if (clock.elapsedTime - last.current < 0.25) return;
    last.current = clock.elapsedTime;
    const s = ui.get();
    let show = false;
    if (s.opened && s.phase !== "intro" && !s.lightbox && !s.embed && s.plan === null) {
      if (hall) show = s.onFoot && s.active === null && inHall(walker.pos);
      else {
        if (s.active !== null && stops.includes(s.active)) show = true;
        else if (near > 0 && s.active === null && anchor.current) {
          anchor.current.getWorldPosition(here);
          const f = focus();
          show = Math.hypot(here.x - f.x, here.z - f.z) < near;
        }
      }
    }
    if (show !== on) setOn(show);
  });
  return (
    <group ref={anchor} position={position}>
      {on && (
        <Html center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}>
          <div className={"click-tag" + (below ? " below" : "")}><span>{coarse ? "Tap me" : label}</span><i aria-hidden /></div>
        </Html>
      )}
    </group>
  );
}
