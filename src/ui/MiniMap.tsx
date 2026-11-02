import { useEffect, useRef } from "react";
import { STOPS } from "../content";
import { focus, sim, ui, useUI, walker } from "../game/store";
import { nearestSample, PLACEMENTS, PONDS, SAMPLES, SAMPLE_COUNT, STOP_POS, STOP_U } from "../game/track";

const SIZE = 172, R = SIZE / 2, SCALE = 1.05; // px per metre: about 80 m to the edge
const STOP_I = STOP_U.map((u) => Math.round(u * SAMPLE_COUNT));

/** The corner radar: turns with you, the route to the next chapter in gold, chapters as blips (the next one pinned to the rim). */
export function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const next = useUI((s) => s.nextStop);
  const distance = useUI((s) => s.distance);

  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = SIZE * dpr;
    const g = cv.getContext("2d")!;
    let raf = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const s = ui.get(), f = focus();
      const h = s.onFoot ? walker.heading : sim.heading;
      const c = Math.cos(h), sn = Math.sin(h);
      // world → radar: forward is up, his right is right
      const P = (x: number, z: number): [number, number] => {
        const vx = x - f.x, vz = z - f.z;
        return [R + (-vx * c + vz * sn) * SCALE, R - (vx * sn + vz * c) * SCALE];
      };
      const near = (x: number, z: number, m = 95) => (x - f.x) ** 2 + (z - f.z) ** 2 < m * m;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);
      g.save();
      g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
      const bg = g.createRadialGradient(R, R, 10, R, R, R);
      bg.addColorStop(0, "rgba(46, 62, 38, 0.92)"); bg.addColorStop(1, "rgba(22, 30, 18, 0.94)");
      g.fillStyle = bg; g.fillRect(0, 0, SIZE, SIZE);
      // landmarks: soft footprints in the chapter's colour
      PLACEMENTS.forEach((pl, i) => {
        if (!near(pl.pos.x, pl.pos.z, 110)) return;
        const [x, y] = P(pl.pos.x, pl.pos.z);
        g.fillStyle = STOPS[i].color + "55";
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
      });
      // ponds
      g.fillStyle = "#4f8fb3";
      for (const q of PONDS) {
        if (!near(q.x, q.z, 110)) continue;
        const [x, y] = P(q.x, q.z);
        g.beginPath(); g.arc(x, y, q.r * SCALE, 0, Math.PI * 2); g.fill();
      }
      // the road
      const line = (from: number, to: number) => {
        g.beginPath();
        let pen = false;
        for (let k = from; k <= to; k += 2) {
          const q = SAMPLES[k];
          if (!near(q.x, q.z, 120)) { pen = false; continue; }
          const [x, y] = P(q.x, q.z);
          if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
        }
        g.stroke();
      };
      g.lineCap = g.lineJoin = "round";
      g.strokeStyle = "rgba(20, 16, 10, 0.6)"; g.lineWidth = 8; line(0, SAMPLE_COUNT);
      g.strokeStyle = "#cfc6a6"; g.lineWidth = 5; line(0, SAMPLE_COUNT);
      // the GPS line: from here along the road to the next chapter
      const at = nearestSample(f).index, goal = STOP_I[s.nextStop];
      g.strokeStyle = "#ffb547"; g.lineWidth = 3.4;
      g.shadowColor = "rgba(255, 181, 71, 0.8)"; g.shadowBlur = 6;
      line(Math.min(at, goal), Math.max(at, goal));
      g.shadowBlur = 0;
      // the auto, when he's walking
      if (s.onFoot) {
        const [x, y] = P(sim.pos.x, sim.pos.z);
        g.fillStyle = "#f6c51b"; g.strokeStyle = "#1a140c"; g.lineWidth = 1.5;
        g.beginPath(); g.roundRect(x - 4.5, y - 4.5, 9, 9, 2); g.fill(); g.stroke();
      }
      // chapter blips
      STOP_POS.forEach((p, i) => {
        const isNext = i === s.nextStop;
        let [x, y] = P(p.x, p.z);
        const dx = x - R, dy = y - R, d = Math.hypot(dx, dy), rim = R - 13;
        if (d > rim) { if (!isNext) return; x = R + (dx / d) * rim; y = R + (dy / d) * rim; }
        const seen = s.visited.includes(i);
        const r = isNext ? 8.5 + Math.sin(t / 220) * 1.2 : 6.5;
        if (isNext) { g.fillStyle = STOPS[i].color + "55"; g.beginPath(); g.arc(x, y, r + 5, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = seen && !isNext ? "#2e8b57" : STOPS[i].color;
        g.strokeStyle = "#fff8e6"; g.lineWidth = 1.6;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = "#1a140c"; g.font = `700 ${isNext ? 9 : 8}px "Space Mono", monospace`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(i + 1), x, y + 0.5);
      });
      g.restore();
      // the rim, and north turning round it
      g.strokeStyle = "rgba(255, 248, 230, 0.35)"; g.lineWidth = 2;
      g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.stroke();
      const nx = R + (-(0) * c + -1 * sn) * (R - 10), ny = R - (0 * sn + -1 * c) * (R - 10); // world "north" is -z on the big map
      g.fillStyle = "#1a140c"; g.beginPath(); g.arc(nx, ny, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff8e6"; g.font = '700 8px "Space Mono", monospace'; g.fillText("N", nx, ny + 0.5);
      // him, at the centre, facing up
      g.save(); g.translate(R, R);
      g.fillStyle = "#ffffff"; g.strokeStyle = "#1a140c"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.stroke(); g.fill();
      g.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button className="minimap" onClick={() => ui.set({ mapOpen: true })} aria-label="Open the map (M)" title="Open the map (M)">
      <canvas ref={ref} style={{ width: SIZE, height: SIZE }} />
      <span className="minimap-dest">
        <i style={{ background: STOPS[next].color }} />
        <b>{String(next + 1).padStart(2, "0")} · {STOPS[next].name}</b>
        <em>{distance} m</em>
      </span>
    </button>
  );
}
