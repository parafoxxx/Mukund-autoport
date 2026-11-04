import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { bubbleAnchor, sim, ui, walker } from "./game/store";
import { voiceDuration, voiceLevel, voiceState } from "./game/sound";
import { scripted } from "./game/Player";
import * as hall from "./game/hall";
import { travelTo } from "./ui/RouteMap";

// dev-only handle for automated screenshots and debugging
if (import.meta.env.DEV) (window as unknown as { __ride: unknown }).__ride = { sim, ui, walker, voiceDuration, voiceLevel, voiceState, bubbleAnchor, scripted, hall, travelTo };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ?trace: log the loading milestones with their times, for measuring start-up on slow machines
if (new URLSearchParams(location.search).has("trace")) {
  const seen = new Set<string>();
  ui.subscribe(() => {
    const s = ui.get();
    for (const k of ["ready", "avatarReady", "opened"] as const) if (s[k] && !seen.has(k)) { seen.add(k); console.log(`[trace] ${k} ${(performance.now() / 1000).toFixed(2)}s`); }
  });
}
