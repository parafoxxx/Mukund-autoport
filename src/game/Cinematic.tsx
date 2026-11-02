import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SUN_DIR } from "./World";

/**
 * The "shader pack" look, kept light: the scene renders once into a buffer, god rays are traced
 * from the sun at quarter resolution, and one final pass adds them with a sun halo and a warm golden-hour grade.
 * (Three cheap passes, against the half-dozen a stock bloom / film pipeline would cost.)
 */

const quadVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// light shafts: march from each pixel toward the sun, collecting open sky (anything at the far depth)
const raysFrag = /* glsl */ `
  uniform sampler2D tDepth; uniform vec2 sun; uniform float aspect;
  varying vec2 vUv;
  void main() {
    vec2 delta = (vUv - sun) / 36.0 * 0.92;
    vec2 uv = vUv; float light = 0.0, decay = 1.0;
    for (int i = 0; i < 36; i++) {
      uv -= delta;
      float sky = step(0.99999, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x);
      float near = smoothstep(0.55, 0.0, length((uv - sun) * vec2(aspect, 1.0)));
      light += sky * near * decay;
      decay *= 0.965;
    }
    gl_FragColor = vec4(vec3(light / 36.0), 1.0);
  }`;

const compositeFrag = /* glsl */ `
  uniform sampler2D tScene; uniform sampler2D tRays; uniform vec2 sun; uniform float aspect, sunVis, rays, time;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 col = texture2D(tScene, vUv).rgb;
    vec3 gold = vec3(1.0, 0.88, 0.68); // morning sun: warm white, not orange
    // god rays and a soft halo round the sun
    col += texture2D(tRays, vUv).rgb * gold * 1.8 * sunVis * rays;
    float d = length((vUv - sun) * vec2(aspect, 1.0));
    col += gold * (0.55 * exp(-d * 7.0) + 0.12 * exp(-d * 2.2)) * sunVis;
    // 1. a soft shoulder: bright surfaces roll off gently instead of clipping to flat white
    col *= 0.92;
    col = col / (1.0 + max(col - 0.55, 0.0) * 0.85);
    // 2. the film look: cool teal shadows, warm highlights, a touch more colour
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(vec3(0.84, 0.97, 1.08), vec3(1.08, 1.0, 0.86), smoothstep(0.04, 0.6, l));
    col = mix(vec3(l), col, 1.14);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    // 3. an S-curve for contrast, then fine grain
    gl_FragColor.rgb = mix(gl_FragColor.rgb, smoothstep(0.0, 1.0, gl_FragColor.rgb), 0.32);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(vUv * 1024.0 + fract(time * 7.0) * 100.0) - 0.5) * 0.028;
  }`;

export function Cinematic({ rays = true }: { rays?: boolean }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const kit = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(1, 1);
    const raysRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const raysMat = new THREE.ShaderMaterial({
      vertexShader: quadVert, fragmentShader: raysFrag, depthTest: false, depthWrite: false,
      uniforms: { tDepth: { value: rt.depthTexture }, sun: { value: new THREE.Vector2() }, aspect: { value: 1 } },
    });
    const compMat = new THREE.ShaderMaterial({
      vertexShader: quadVert, fragmentShader: compositeFrag, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: rt.texture }, tRays: { value: raysRT.texture }, sun: { value: new THREE.Vector2() },
        aspect: { value: 1 }, sunVis: { value: 0 }, rays: { value: 1 }, time: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene(); quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { rt, raysRT, raysMat, compMat, quad, quadScene, quadCam };
  }, []);

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * viewport.dpr)), h = Math.max(1, Math.floor(size.height * viewport.dpr));
    kit.rt.setSize(w, h);
    kit.raysRT.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }, [kit, size, viewport.dpr]);

  useEffect(() => () => { kit.rt.dispose(); kit.raysRT.dispose(); kit.raysMat.dispose(); kit.compMat.dispose(); }, [kit]);

  const sunPos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    kit.compMat.uniforms.time.value = clock.elapsedTime;
    // where the sun is on screen, and how much it's in view (none when it's behind us)
    sunPos.copy(camera.position).addScaledVector(SUN_DIR, 1000).project(camera);
    camera.getWorldDirection(look);
    const facing = THREE.MathUtils.smoothstep(look.dot(SUN_DIR), 0.0, 0.5);
    const onScreen = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sunPos.x), Math.abs(sunPos.y)), 1.1, 1.8);
    const sun = new THREE.Vector2(sunPos.x * 0.5 + 0.5, sunPos.y * 0.5 + 0.5);
    const aspect = size.width / size.height;

    gl.setRenderTarget(kit.rt);
    gl.render(scene, camera);
    if (rays && facing > 0) {
      kit.raysMat.uniforms.sun.value.copy(sun); kit.raysMat.uniforms.aspect.value = aspect;
      kit.quad.material = kit.raysMat;
      gl.setRenderTarget(kit.raysRT);
      gl.render(kit.quadScene, kit.quadCam);
    }
    const u = kit.compMat.uniforms;
    u.sun.value.copy(sun); u.aspect.value = aspect; u.sunVis.value = facing * onScreen; u.rays.value = rays ? 1 : 0;
    kit.quad.material = kit.compMat;
    gl.setRenderTarget(null);
    gl.render(kit.quadScene, kit.quadCam);
  }, 1);
  return null;
}
