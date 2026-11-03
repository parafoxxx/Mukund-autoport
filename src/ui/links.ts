import { ME } from "../content";
import { bell } from "../game/sound";

/** His links, as they hang on the garland in the mirror scene (and as plain buttons beside it). */
export type LinkCharm = { id: string; label: string; url: string };
export const CHARMS: LinkCharm[] = [
  { id: "instagram", label: "Instagram", url: ME.links.instagram },
  { id: "linkedin", label: "LinkedIn", url: ME.links.linkedin },
  { id: "github", label: "GitHub", url: ME.links.github },
  { id: "letterboxd", label: "Letterboxd", url: ME.links.letterboxd },
  { id: "email", label: "Email", url: ME.links.email },
];
/** A temple bell, then the link. */
export const openCharm = (c: LinkCharm) => { bell(); window.open(c.url, c.url.startsWith("mailto:") ? "_self" : "_blank", "noopener"); };

const GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

/** A medallion face: the brand's mark inside a stitched rim, on a 256 px canvas. */
export function charmCanvas(id: string) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const ring = (fill: string | CanvasGradient) => {
    g.fillStyle = fill; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
    g.setLineDash([9, 7]); g.lineWidth = 5; g.strokeStyle = "rgba(255, 255, 255, 0.8)";
    g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  };
  if (id === "linkedin") {
    ring("#0a66c2");
    g.fillStyle = "#fff"; g.font = "bold 124px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("in", 130, 138);
  } else if (id === "github") {
    ring("#171515");
    g.save(); g.translate(56, 56); g.scale(9, 9); g.fillStyle = "#fff"; g.fill(new Path2D(GITHUB_MARK)); g.restore();
  } else if (id === "instagram") {
    const grd = g.createLinearGradient(20, 236, 236, 20);
    grd.addColorStop(0, "#feda75"); grd.addColorStop(0.35, "#fa7e1e"); grd.addColorStop(0.6, "#d62976"); grd.addColorStop(1, "#4f5bd5");
    ring(grd);
    g.strokeStyle = "#fff"; g.lineWidth = 14;
    g.beginPath(); g.roundRect(68, 68, 120, 120, 34); g.stroke();
    g.beginPath(); g.arc(128, 128, 28, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(165, 91, 9, 0, Math.PI * 2); g.fill();
  } else if (id === "letterboxd") {
    ring("#202830");
    ([["#ff8000", 78], ["#00e054", 128], ["#40bcf4", 178]] as const).forEach(([col, x]) => { g.fillStyle = col; g.globalAlpha = 0.92; g.beginPath(); g.arc(x, 128, 30, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
  } else {
    ring("#e8902a");
    g.strokeStyle = "#fff"; g.lineWidth = 12; g.lineJoin = "round";
    g.beginPath(); g.roundRect(62, 82, 132, 92, 12); g.stroke();
    g.beginPath(); g.moveTo(66, 88); g.lineTo(128, 136); g.lineTo(190, 88); g.stroke();
  }
  return c;
}
