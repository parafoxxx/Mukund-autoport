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
