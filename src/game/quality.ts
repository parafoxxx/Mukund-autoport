/**
 * How much 3D the device can take. 2 = the full film look, 1 = balanced (the same look without god rays, FXAA instead
 * of 4x MSAA, smaller shadows, half the grass), 0 = smooth mode (no film pass, no shadows, a quarter of the grass).
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
  // software rendering: smooth mode. Laptop-class integrated graphics and phones: balanced, the full film look and
  // shadows at full resolution, minus the god rays and 4x MSAA (FXAA instead), which is what made them crawl.
  // If even that can't keep up, the frame-rate monitor drops them to smooth mode.
  if (/swiftshader|llvmpipe|software|microsoft basic/i.test(renderer)) return 0;
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega \d|mali|adreno|powervr/i.test(renderer)) return 1;
  if (Math.min(innerWidth, innerHeight) < 600) return 1;
  return 2;
}

/** The player picked it (Help → Smooth mode): remember it for next time. */
export function saveTier(t: Tier | null) {
  try { if (t === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(t)); } catch { /* storage blocked */ }
}

/** Resolution range for each tier. */
export const DPR: Record<Tier, { start: number; min: number; max: number }> = {
  0: { start: 1, min: 0.75, max: 1 },
  1: { start: 1, min: 0.8, max: 1.25 },
  2: { start: 1, min: 1, max: 1.5 },
};
export const GRASS_SHARE: Record<Tier, number> = { 0: 0.25, 1: 0.5, 2: 1 };
