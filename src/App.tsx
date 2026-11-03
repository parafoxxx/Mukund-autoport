import { lazy, Suspense, useEffect } from "react";
import { bindKeyboard } from "./game/input";
import { chapterSpace, closeStop } from "./game/Director";
import { horn, probeVoices, setMuted, wakeAudio } from "./game/sound";
import { VOICE_IDS } from "./content";
import { cue, ui, walker } from "./game/store";
import { stepDeck } from "./game/hall";
import { startMusic } from "./game/music";
import { EMOTES, toggleAuto } from "./game/Player";
import { beginRide, exhibitAction, exhibitStory, jumpToWork, lightboxKey, Overlay, resetToRoad, voiceDriveNow } from "./ui/Overlay";
import { toggleVoiceDrive } from "./game/voiceDrive";
import { GUEST } from "./game/guest";

if (GUEST) document.title = `Mukund ki Auto · for ${GUEST}`;

const Scene = lazy(() => import("./game/Scene"));

export default function App() {
  useEffect(() => bindKeyboard((code, down) => {
    const s = ui.get();
    if (down && code === "KeyB" && s.ready && s.phase !== "finale") { if (s.voiceDrive) toggleVoiceDrive(); else voiceDriveNow(); return; }
    if (s.phase === "intro") {
      if (down && code === "Enter" && s.ready) beginRide(false);
      return;
    }
    if (!down) return;
    if (code === "KeyM" && s.phase === "ride") { ui.set({ mapOpen: !s.mapOpen }); return; }
    if (code === "KeyJ" && s.phase === "ride" && !s.mapOpen) { jumpToWork(); return; }
    if (s.mapOpen) { if (code === "Escape") ui.set({ mapOpen: false }); return; }
    if (s.lightbox) { lightboxKey(code); return; }
    if (s.embed) { if (code === "Escape") ui.set({ embed: null }); return; }
    if (code === "KeyH") horn();
    if (code === "KeyR" && s.phase === "ride") resetToRoad();
    if (code === "Enter" && s.onFoot && s.active === null && exhibitAction()) return;
    if (code === "Space" && s.onFoot && s.active === null && exhibitStory()) return;
    // at the deck wall: left/right step to the neighbouring deck
    const side = code === "KeyA" || code === "ArrowLeft" ? -1 : code === "KeyD" || code === "ArrowRight" ? 1 : 0;
    if (side && s.onFoot && s.active === null && s.phase === "ride" && stepDeck(walker.pos, side)) return;
    // F or Enter: get in / out of the auto (Enter continues a chapter while one is open)
    if (code === "KeyF" || code === "KeyE" || (code === "Enter" && s.active === null)) { const msg = toggleAuto(); if (msg) ui.set({ reply: msg }); }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit && s.onFoot && s.active === null) cue(EMOTES[+digit[1] - 1]);
    if (code === "Space" && s.active !== null) chapterSpace();
    else if ((code === "Enter" || code === "Escape") && s.active !== null) closeStop(code !== "Escape");
  }), []);

  // the score is set up straight away (and plays at once if the browser allows it);
  // otherwise the first click or key press, usually the loader's "tap to begin", starts it
  useEffect(() => {
    startMusic();
    const go = () => { wakeAudio(); removeEventListener("pointerdown", go); removeEventListener("keydown", go); };
    addEventListener("pointerdown", go); addEventListener("keydown", go);
    return () => { removeEventListener("pointerdown", go); removeEventListener("keydown", go); };
  }, []);

  // find out which chapters Mukund has recorded (public/voice/<id>.mp3)
  useEffect(() => { probeVoices(VOICE_IDS); }, []);

  // never keep the engine running in a background tab
  useEffect(() => {
    const onVis = () => setMuted(document.hidden || ui.get().muted);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <>
      <div className="stage">
        <Suspense fallback={null}><Scene /></Suspense>
      </div>
      <Overlay />
    </>
  );
}
