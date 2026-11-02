import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STOPS } from "../content";
import { focus, sim, ui, useUI, walker } from "../game/store";
import { closeStop } from "../game/Director";
import { cancelScript } from "../game/Player";
import { CURVE, nearestSample, PONDS, roadHeading, SAMPLES, STOP_POS, STOP_U } from "../game/track";

/* An illustrated paper map of the route: x across, z down. Everything but the markers is drawn once. */
const PAD = 40, PAD_Z = 52;
const xs = SAMPLES.map((p) => p.x), zs = SAMPLES.map((p) => p.z);
const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD, minZ = Math.min(...zs) - PAD_Z, maxZ = Math.max(...zs) + PAD_Z;
const W = maxX - minX, H = maxZ - minZ;
const ROAD = SAMPLES.filter((_, i) => i % 3 === 0).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join(" ");
const pad = (n: number) => String(n).padStart(2, "0");

/** Where each name goes so neighbours never collide: above a peak, below a dip, beside a slope. */
// hand-placed where neighbouring names would otherwise collide
const LABEL_FIX: Record<string, "up" | "down" | "left" | "right"> = { iitk: "right", arena: "left", cinema: "right" };
const LABEL = STOP_POS.map((p, i): "up" | "down" | "left" | "right" => {
  if (LABEL_FIX[STOPS[i].id]) return LABEL_FIX[STOPS[i].id];
  const a = STOP_POS[Math.max(0, i - 1)], b = STOP_POS[Math.min(STOP_POS.length - 1, i + 1)];
  if (p.z <= Math.min(a.z, b.z)) return "up";
  if (p.z >= Math.max(a.z, b.z)) return "down";
  return b.z < a.z ? "left" : "right";
});
const LABEL_AT = {
  up: { x: 0, y: -36, anchor: "middle" },
  down: { x: 0, y: 17, anchor: "middle" },
  left: { x: -13, y: 4, anchor: "end" },
  right: { x: 13, y: 4, anchor: "start" },
} as const;

/* ---------- the terrain, seeded so it's the same map every time ---------- */
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const roadDist = (x: number, z: number) => {
  let d = Infinity;
  for (let i = 0; i < SAMPLES.length; i += 2) d = Math.min(d, Math.hypot(SAMPLES[i].x - x, SAMPLES[i].z - z));
  return d;
};
// a river from the top edge to the bottom, crossing the road once under a bridge
const RIVER_X = minX + W * 0.66;
const riverAt = (z: number) => RIVER_X + Math.sin((z - minZ) / H * Math.PI * 2.2) * W * 0.05;
const RIVER = Array.from({ length: 30 }, (_, k) => { const z = minZ - 5 + (k / 29) * (H + 10); return `${k ? "L" : "M"}${riverAt(z).toFixed(1)} ${z.toFixed(1)}`; }).join(" ");
// a pond in the open corner below the last stretch
const POND = { x: maxX - W * 0.12, z: maxZ - H * 0.16, rx: W * 0.075, rz: H * 0.09 };
// dirt trails wandering off the road
const TRAILS = [0.18, 0.42, 0.78].map((u, k) => {
  const p = CURVE.getPointAt(u), dir = k % 2 ? -1 : 1;
  const e = { x: p.x + (k - 1) * 40, z: dir > 0 ? maxZ + 5 : minZ - 5 };
  return `M${p.x.toFixed(1)} ${p.z.toFixed(1)} C${(p.x + 30).toFixed(1)} ${(p.z + dir * 30).toFixed(1)} ${(e.x - 30).toFixed(1)} ${(e.z - dir * 40).toFixed(1)} ${e.x.toFixed(1)} ${e.z.toFixed(1)}`;
});
// fields: striped crop patches
const FIELDS = [{ x: minX + W * 0.1, z: minZ + H * 0.72, w: 46, h: 30, r: -8 }, { x: minX + W * 0.43, z: maxZ - H * 0.15, w: 50, h: 26, r: 6 }, { x: minX + W * 0.3, z: minZ + H * 0.12, w: 40, h: 26, r: 4 }];
const inField = (x: number, z: number) => FIELDS.some((f) => Math.abs(x - f.x - f.w / 2) < f.w / 2 + 6 && Math.abs(z - f.z - f.h / 2) < f.h / 2 + 6);
// trees, in clumps: dense woods where a slow "noise" is high, scattered ones elsewhere
const woods = (x: number, z: number) => Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.06 - 0.4) + Math.sin(x * 0.02 - z * 0.03) * 0.6;
type Tree = { x: number; z: number; r: number; pine: boolean; shade: number };
const TREES: Tree[] = [];
for (let gx = minX + 6; gx < maxX - 4; gx += 9) {
  for (let gz = minZ + 8; gz < maxZ - 4; gz += 9) {
    const x = gx + (rand() - 0.5) * 8, z = gz + (rand() - 0.5) * 8;
    const dense = woods(x, z);
    if (rand() > (dense > 0.55 ? 0.85 : dense > 0.1 ? 0.25 : 0.06)) continue;
    if (roadDist(x, z) < 15 || STOP_POS.some((p) => Math.hypot(p.x - x, p.z - z) < 30)) continue;
    if (Math.abs(x - riverAt(z)) < 9 || inField(x, z)) continue;
    if (PONDS.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 6)) continue;
    if (((x - POND.x) / (POND.rx + 8)) ** 2 + ((z - POND.z) / (POND.rz + 8)) ** 2 < 1) continue;
    TREES.push({ x, z, r: 3.4 + rand() * 2.6, pine: dense > 0.6 && rand() < 0.5, shade: Math.floor(rand() * 3) });
  }
}
TREES.sort((a, b) => a.z - b.z); // farther (higher up the sheet) first, so nearer trees overlap them
const CROWN = ["#3f7d3a", "#4b8b3f", "#356f35"], HILITE = ["#6fa552", "#7cb35b", "#5f9a4c"];
const BRIDGE = (() => {
  let best = 0, bd = Infinity;
  SAMPLES.forEach((s, i) => { const d = Math.abs(s.x - riverAt(s.z)); if (d < bd) { bd = d; best = i; } });
  return SAMPLES[best];
})();

function Terrain() {
  return (
    <g aria-hidden>
      <defs>
        <radialGradient id="mg-grass" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#a8cd72" /><stop offset="70%" stopColor="#93bd62" /><stop offset="100%" stopColor="#7fa955" />
        </radialGradient>
        <radialGradient id="mg-patch"><stop offset="0%" stopColor="#c4dc8a" stopOpacity="0.7" /><stop offset="100%" stopColor="#c4dc8a" stopOpacity="0" /></radialGradient>
        <radialGradient id="mg-dark"><stop offset="0%" stopColor="#6e9a48" stopOpacity="0.55" /><stop offset="100%" stopColor="#6e9a48" stopOpacity="0" /></radialGradient>
        <pattern id="mg-crop" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width="5" height="5" fill="#d9c97a" /><rect width="2" height="5" fill="#c9b765" />
        </pattern>
      </defs>
      <rect x={minX} y={minZ} width={W} height={H} fill="url(#mg-grass)" />
      {[[0.2, 0.3, 60], [0.55, 0.62, 70], [0.85, 0.25, 50], [0.35, 0.85, 55]].map(([u, v, r], k) => <circle key={k} cx={minX + W * u} cy={minZ + H * v} r={r} fill="url(#mg-patch)" />)}
      {[[0.1, 0.12, 55], [0.72, 0.85, 60], [0.92, 0.6, 45]].map(([u, v, r], k) => <circle key={k} cx={minX + W * u} cy={minZ + H * v} r={r} fill="url(#mg-dark)" />)}
      {FIELDS.map((f, k) => (
        <g key={k} transform={`rotate(${f.r} ${f.x + f.w / 2} ${f.z + f.h / 2})`}>
          <rect x={f.x} y={f.z} width={f.w} height={f.h} rx={4} fill="url(#mg-crop)" stroke="#b49a5a" strokeWidth={0.8} />
          <rect x={f.x - 3} y={f.z - 3} width={f.w + 6} height={f.h + 6} rx={6} fill="none" stroke="#8a6a3e" strokeWidth={0.7} strokeDasharray="2 2.4" />
        </g>
      ))}
      {TRAILS.map((d, k) => <path key={k} d={d} fill="none" stroke="#e8dcab" strokeWidth={3.2} strokeLinecap="round" opacity={0.85} />)}
      <path d={RIVER} fill="none" stroke="#5d9cc2" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER} fill="none" stroke="#7fbadb" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER} fill="none" stroke="#b6dcef" strokeWidth={1} strokeDasharray="3 9" />
      <ellipse cx={POND.x} cy={POND.z} rx={POND.rx + 2.5} ry={POND.rz + 2.5} fill="#d8cf9c" />
      <ellipse cx={POND.x} cy={POND.z} rx={POND.rx} ry={POND.rz} fill="#5d9cc2" />
      <ellipse cx={POND.x - 3} cy={POND.z - 3} rx={POND.rx * 0.82} ry={POND.rz * 0.7} fill="#7fbadb" />
      {PONDS.map((q) => (
        <g key={q.seed}>
          <ellipse cx={q.x} cy={q.z} rx={q.r + 2} ry={q.r * 0.8 + 2} fill="#d8cf9c" />
          <ellipse cx={q.x} cy={q.z} rx={q.r} ry={q.r * 0.8} fill="#5d9cc2" />
          <ellipse cx={q.x - 1.5} cy={q.z - 1.5} rx={q.r * 0.7} ry={q.r * 0.5} fill="#7fbadb" />
        </g>
      ))}
      {[[-0.4, 0.2], [0.3, -0.3], [0.5, 0.4]].map(([a, b], k) => <ellipse key={k} cx={POND.x + POND.rx * a} cy={POND.z + POND.rz * b} rx={2.4} ry={1.5} fill="#a9a59a" />)}
      {TREES.map((t, k) => t.pine ? (
        <g key={k} transform={`translate(${t.x.toFixed(1)} ${t.z.toFixed(1)})`}>
          <ellipse cx={1.5} cy={1} rx={t.r * 0.9} ry={t.r * 0.4} fill="#2c4f25" opacity={0.35} />
          <path d={`M0 ${-t.r * 2.2} L${t.r * 0.95} 0.6 L${-t.r * 0.95} 0.6Z`} fill={CROWN[2]} />
          <path d={`M0 ${-t.r * 2.2} L${t.r * 0.5} ${-t.r * 0.6} L0 ${-t.r * 0.3}Z`} fill={HILITE[2]} opacity={0.7} />
        </g>
      ) : (
        <g key={k} transform={`translate(${t.x.toFixed(1)} ${t.z.toFixed(1)})`}>
          <ellipse cx={1.6} cy={t.r * 0.55} rx={t.r} ry={t.r * 0.45} fill="#2c4f25" opacity={0.35} />
          <circle r={t.r} fill={CROWN[t.shade]} />
          <circle cx={-t.r * 0.32} cy={-t.r * 0.32} r={t.r * 0.48} fill={HILITE[t.shade]} />
        </g>
      ))}
      {/* the bridge where the road crosses the river */}
      <rect x={BRIDGE.x - 9} y={BRIDGE.z - 6.5} width={18} height={13} rx={1.5} fill="#a77b4f" stroke="#6b4a2c" strokeWidth={0.8} />
      {/* a compass rose */}
      <g transform={`translate(${maxX - 26} ${minZ + 28})`} className="map-compass">
        <circle r={15} fill="#f4ecd8" opacity={0.85} stroke="#6b4a2c" strokeWidth={0.8} />
        <path d="M0 -13 L3.2 0 L0 13 L-3.2 0Z" fill="#6b4a2c" />
        <path d="M0 -13 L3.2 0 L-3.2 0Z" fill="#c0392b" />
        <text y={-17} textAnchor="middle">N</text>
      </g>
    </g>
  );
}

/** Drops the auto just before a chapter, with him at the wheel, and lets it pull in. */
export function travelTo(i: number) {
  closeStop();
  cancelScript();
  const u = Math.max(0, STOP_U[i] - 26 / CURVE.getLength());
  const p = CURVE.getPointAt(u);
  sim.pos.set(p.x, 0, p.z);
  sim.heading = roadHeading(u);
  sim.speed = 0; sim.lift = 0; sim.liftV = 0;
  walker.pos.copy(sim.pos); walker.speed = 0;
  sim.cooldown.delete(i);
  ui.set({ onFoot: false, boarded: true, mapOpen: false, target: i, express: false });
}

export function RouteMap() {
  const open = useUI((s) => s.mapOpen);
  const visited = useUI((s) => s.visited);
  const next = useUI((s) => s.nextStop);
  const you = useRef<SVGGElement>(null);
  const auto = useRef<SVGGElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; below: boolean } | null>(null);

  // live: the auto token, him (when he's walking), and the road travelled so far, in gold
  useEffect(() => {
    if (!open) { setHover(null); return; }
    let raf = 0;
    const tick = () => {
      const s = ui.get(), f = focus();
      auto.current?.setAttribute("transform", `translate(${sim.pos.x.toFixed(1)} ${sim.pos.z.toFixed(1)})`);
      if (you.current) {
        you.current.setAttribute("transform", `translate(${walker.pos.x.toFixed(1)} ${walker.pos.z.toFixed(1)})`);
        you.current.style.display = s.onFoot ? "" : "none";
      }
      trail.current?.setAttribute("stroke-dasharray", `${nearestSample(f).u.toFixed(4)} 2`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const showTip = (i: number, el: SVGGElement) => {
    const a = el.getBoundingClientRect(), b = sheet.current!.getBoundingClientRect();
    const below = a.top - b.top < 190;
    setHover({ i, x: a.left + a.width / 2 - b.left, y: below ? a.bottom - b.top : a.top - b.top, below });
  };
  const status = (i: number) => (visited.includes(i) ? "Seen" : next === i ? "Next stop" : "Not yet");

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="map-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
          onClick={() => ui.set({ mapOpen: false })}>
          <motion.div ref={sheet} className="map" role="dialog" aria-label="Route map" onClick={(e) => e.stopPropagation()}
            initial={{ rotateX: 32, y: 60, scale: 0.94, opacity: 0 }} animate={{ rotateX: 0, y: 0, scale: 1, opacity: 1 }} exit={{ rotateX: 18, y: 30, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ transformPerspective: 1400 }}>
            <header className="map-head">
              <div>
                <p className="mono label">Route map · {STOPS.length} chapters · Agra → Bengaluru</p>
                <h2>Pick any chapter. The auto takes you there.</h2>
              </div>
              <button className="map-close" onClick={() => ui.set({ mapOpen: false })} aria-label="Close map">✕</button>
            </header>
            <div className="map-board">
              <svg className="map-svg" viewBox={`${minX} ${minZ} ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
                <Terrain />
                <path d={ROAD} className="map-road-edge" />
                <path d={ROAD} className="map-road" />
                <path ref={trail} d={ROAD} className="map-road-done" pathLength={1} strokeDasharray="0 2" />
                <path d={ROAD} className="map-road-dash" />
                <g ref={auto} className="map-token" aria-hidden>
                  <g className="map-token-bob">
                    <ellipse cy={1} rx={9} ry={4} fill="#3b2a1a" opacity={0.35} />
                    <ellipse rx={8.5} ry={3.6} fill="#8a5a2b" />
                    <ellipse cy={-1.4} rx={8.5} ry={3.6} fill="#b07a43" />
                    <g transform="translate(0 -3)">
                      <path d="M-6.5 -1 L-6.5 -9 Q-6.5 -13 -2 -13 L5 -13 Q7 -13 7 -10 L7 -1Z" fill="#f6c51b" stroke="#2a2016" strokeWidth={0.8} />
                      <path d="M-6.5 -6 L7 -6 L7 -1 L-6.5 -1Z" fill="#1f6b3a" stroke="#2a2016" strokeWidth={0.8} />
                      <path d="M-4.5 -11.5 L-0.5 -11.5 L-0.5 -7 L-4.5 -7Z" fill="#cfe7f2" />
                      <circle cx={-4} cy={-0.5} r={1.8} fill="#2a2016" /><circle cx={5} cy={-0.5} r={1.8} fill="#2a2016" />
                    </g>
                  </g>
                </g>
                <g ref={you} className="map-you" aria-hidden>
                  <ellipse cy={1} rx={5} ry={2.2} fill="#3b2a1a" opacity={0.35} />
                  <circle cy={-6} r={5} fill="#f2a33a" stroke="#fff8e8" strokeWidth={1.4} />
                  <text y={-4.1} textAnchor="middle">M</text>
                </g>
                {STOPS.map((s, i) => {
                  const p = STOP_POS[i], at = LABEL_AT[LABEL[i]];
                  const cls = ["map-stop", visited.includes(i) && "done", next === i && "next"].filter(Boolean).join(" ");
                  return (
                    <g key={s.id} className={cls} transform={`translate(${p.x.toFixed(1)} ${p.z.toFixed(1)})`} style={{ "--c": s.color } as CSSProperties}
                      onClick={() => travelTo(i)} role="button" tabIndex={0} aria-label={`Go to chapter ${i + 1}: ${s.name}`}
                      onMouseEnter={(e) => showTip(i, e.currentTarget)} onMouseLeave={() => setHover(null)}
                      onFocus={(e) => showTip(i, e.currentTarget)} onBlur={() => setHover(null)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") travelTo(i); }}>
                      <circle r={16} cy={-12} className="map-hit" />
                      <ellipse rx={4} ry={1.8} className="map-pin-base" />
                      <g className="map-pin">
                        <path d="M0 0 C-3 -6 -10 -11 -10 -19 A10 10 0 1 1 10 -19 C10 -11 3 -6 0 0Z" className="map-pin-body" />
                        <circle cy={-19} r={7.2} className="map-pin-face" />
                        <text y={-15.6} textAnchor="middle" className="map-pin-icon">{s.sticker}</text>
                        {visited.includes(i) && <g transform="translate(7.5 -26)"><circle r={3.6} className="map-check" /><path d="M-1.7 0 L-0.4 1.3 L1.8 -1.2" className="map-check-mark" /></g>}
                      </g>
                      <text x={at.x} y={at.y} textAnchor={at.anchor} className="map-name">
                        <tspan className="map-num">{pad(i + 1)}</tspan> {s.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <AnimatePresence>
                {hover && (
                  <motion.div key={hover.i} className={"map-tip" + (hover.below ? " below" : "")} style={{ left: hover.x, top: hover.y }}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <p className="mono">Chapter {pad(hover.i + 1)} · {status(hover.i)}</p>
                    <h4>{STOPS[hover.i].name}</h4>
                    <p className="map-tip-line">{STOPS[hover.i].title}</p>
                    <p className="map-tip-go">Click to ride here →</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <footer className="map-foot">
              <span className="map-key"><i className="k-done" />Seen</span>
              <span className="map-key"><i className="k-next" />Next stop</span>
              <span className="map-key"><i className="k-auto" />Your auto</span>
              <span className="map-keys mono"><kbd>M</kbd> map · <kbd>Esc</kbd> close</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
