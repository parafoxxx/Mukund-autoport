/**
 * How much 3D the device can take. 2 = the full film look, 1 = lighter (no god rays, no extra anti-aliasing,
 * smaller shadows, half the grass), 0 = smooth mode (no film pass, no shadows, a quarter of the grass, lower resolution).
 * We start from a guess (the GPU's name, the screen, a saved choice or ?quality=), then the frame-rate monitor
 * steps down further if it has to.
 */
export type Tier = 0 | 1 | 2;
const KEY = "mukund-auto-quality";

export function initialTier(): Tier {
  const q = new URLSearchParams(location.search).get("quality");
  if (q === "low") return 0;
  if (q === "medium") return 1;
  if (q === "high") return 2;
  try { const saved = localStorage.getItem(KEY); if (saved === "0" || saved === "1" || saved === "2") return Number(saved) as Tier; } catch { /* storage blocked */ }
  let renderer = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    renderer = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch { /* no WebGL info */ }
  // software rendering, laptop-class integrated graphics and phones: smooth mode. Measured on an Intel UHD 630:
  // ~50 fps here, single digits with the full film look, and a far shorter shader compile before the first frame
  if (/swiftshader|llvmpipe|software|microsoft basic/i.test(renderer)) return 0;
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega \d|mali|adreno|powervr/i.test(renderer)) return 0;
  if (Math.min(innerWidth, innerHeight) < 600) return 0;
  return 2;
}

/** The player picked it (Help → Smooth mode): remember it for next time. */
export function saveTier(t: Tier | null) {
  try { if (t === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(t)); } catch { /* storage blocked */ }
}

/** Resolution range for each tier. */
export const DPR: Record<Tier, { start: number; min: number; max: number }> = {
  0: { start: 0.7, min: 0.6, max: 0.85 },
  1: { start: 0.9, min: 0.75, max: 1.1 },
  2: { start: 1, min: 1, max: 1.5 },
};
export const GRASS_SHARE: Record<Tier, number> = { 0: 0.25, 1: 0.5, 2: 1 };
