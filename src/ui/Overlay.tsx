import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProgress } from "@react-three/drei";
import { CHAPTER_COUNT_WORD, DECKS, EXHIBITS, ME, STOPS, WISPR_PLAN } from "../content";
import { STORIES, type Story } from "../stories";
import { HALL_STOP, inHall, spotNear, stepDeck, type Spot } from "../game/hall";
import { startVoiceDrive, toggleVoiceDrive, voiceDriveSupported } from "../game/voiceDrive";
import { FIRST, GUEST } from "../game/guest";
import { bubbleAnchor, cue, openPoster, poster, sim, ui, useUI, walker } from "../game/store";
import { closeStop, readTime, startExpress } from "../game/Director";
import { input } from "../game/input";
import { audioRunning, babble, clack, setMuted, startEngine, voiceDuration, wakeAudio } from "../game/sound";
import { nearestSample, roadHeading, SAMPLES } from "../game/track";
import { board, EMOTES, parkAutoAhead, nearAuto, placeWalkerAtStart, toggleAuto, walkerToRoad } from "../game/Player";
import { IconArrow, IconBolt, IconHelp, IconRestart, IconLink, IconMap, IconMic, IconPlay, IconReset, IconSound, IconTrophy } from "./icons";
import { BADGES } from "../game/achievements";
import { RouteMap, travelTo } from "./RouteMap";
import { MiniMap } from "./MiniMap";
import { markTip, Tip } from "./Tip";
import { CHARMS, openCharm } from "./links";
import { FourthWall } from "./FourthWall";
import { saveTier } from "../game/quality";
import { onCounts, riderNumber, track, type Counts } from "../game/counter";
import { dictate, dictateSupported, stopDictation, type DictateState } from "../game/dictate";
import { sayOnBillboard } from "../game/store";

const N = STOPS.length;
const EASE = [0.22, 1, 0.36, 1] as const;
/** Meter fare, plus every coin he picked up off the road (₹10 each). */
const fare = (km: number) => Math.round(30 + km * 15 + ui.get().coins * 10);
const pad = (n: number) => String(n).padStart(2, "0");
const coarse = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
const COACH_KEY = "mukund-auto-coached";

function coachedBefore() { try { return localStorage.getItem(COACH_KEY) === "1"; } catch { return false; } }
function markCoached() { try { localStorage.setItem(COACH_KEY, "1"); } catch { /* storage blocked */ } }

/* ---------- actions shared with the keyboard handler ---------- */
export function beginRide(express: boolean) {
  startEngine();
  track("ride");
  placeWalkerAtStart();
  // the express cut is a guided tour in the auto; otherwise he starts on foot,
  // with the auto pulled up the road ahead of where he'll stand, so it's in view when the chapter ends
  if (!express) parkAutoAhead();
  if (express) ui.set({ phase: "ride", express: true, target: 0, coach: "done", onFoot: false, boarded: true });
  else ui.set({ phase: "ride", coach: coachedBefore() ? "done" : "drive", onFoot: true });
}

/** From the title straight to Competitions & Hackathons: the decks, the prototypes, the podium. */
export function jumpToWork() {
  if (ui.get().phase === "intro") beginRide(false);
  ui.set({ coach: "done" });
  travelTo(HALL_STOP);
}

/** Drive by voice from anywhere: starts the ride if needed. */
export function voiceDriveNow() {
  if (ui.get().phase === "intro") beginRide(false);
  startVoiceDrive();
}

export function resetToRoad() {
  if (ui.get().onFoot) { walkerToRoad(); ui.set({ offroad: false }); return; }
  const n = nearestSample(sim.pos);
  sim.pos.set(SAMPLES[n.index].x, 0, SAMPLES[n.index].z);
  sim.heading = roadHeading(n.u);
  sim.speed = 0;
  ui.set({ offroad: false });
}

function goTo(i: number) {
  closeStop();
  board();
  ui.set({ target: i, express: false, reply: `Heading to ${STOPS[i].name}.` });
}

/* ---------- root ---------- */
export function Overlay() {
  const phase = useUI((s) => s.phase);
  const active = useUI((s) => s.active);
  const ready = useUI((s) => s.ready);
  const cinema = phase === "intro" || active !== null || phase === "finale";
  return (
    <>
      <Letterbox size={cinema ? 8 : phase === "ride" ? 3.2 : 0} />
      <AnimatePresence>{phase === "intro" && ready && <TitleSequence key="title" />}</AnimatePresence>
      {phase !== "intro" && <Hud hidden={active !== null || phase === "finale"} />}
      {phase === "ride" && <BoardPrompt />}
      <Lightbox />
      <Embed />
      <PlanCard />
      {phase === "ride" && <ExhibitCard />}
      {phase === "ride" && <RouteMap />}
      {phase !== "intro" && <Toast />}
      <BadgesPanel />
      <Chapter />
      <Bubble />
      <AnimatePresence>{phase === "finale" && <Credits key="credits" />}</AnimatePresence>
      <AvatarPrompt />
      {phase === "ride" && <PosterPrompt />}
      <ControlsGuide />
      <FourthWall />
      <Loader />
    </>
  );
}

/* ---------- the poster on the auto's back is a button, not paint: a tag above it says so, until it's tapped ---------- */
function PosterPrompt() {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    // first after ~10 s of driving behind it, then once more later; 14 s each time
    let shows = 0, on = false, since = 0;
    const t = setInterval(() => {
      const s = ui.get(), now = performance.now();
      const calm = s.phase === "ride" && !s.onFoot && s.active === null && s.plan === null && !s.mapOpen && !s.wallNote && !s.guide && !s.embed && !s.lightbox;
      const due = (shows === 0 && sim.posterSeen > 10) || (shows === 1 && sim.posterSeen > 90);
      let next = on;
      if (poster.tapped) next = false;
      else if (!calm) { next = false; if (on && now - since < 4000) shows--; } // cut short by something else: try again when it's calm
      else if (on && now - since > 14000) next = false;
      else if (!on && due) { shows++; since = now; next = true; }
      if (next !== on) { on = next; setShow(next); ui.set({ posterPrompt: next }); }
    }, 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    const tick = () => {
      const el = box.current;
      if (el) {
        el.style.transform = `translate(${poster.x}px, ${poster.y}px) translate(-50%, -100%)`;
        el.style.visibility = poster.visible ? "visible" : "hidden";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  return (
    <div ref={box} className="poster-prompt-anchor">
      <AnimatePresence>
        {show && (
          <motion.button className="poster-prompt" onClick={openPoster}
            initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 320, damping: 20 }}>
            <span><b>That's not decoration.</b> {coarse ? "Tap" : "Click"} it.</span>
            <span className="pp-arrow" aria-hidden><IconArrow dir="down" /></span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- title screen: a tag beside him that says he's clickable, until you've clicked ---------- */
let garlandSeen = false;
function AvatarPrompt() {
  const phase = useUI((s) => s.phase);
  const ready = useUI((s) => s.ready && s.avatarReady);
  const profile = useUI((s) => s.profile);
  const box = useRef<HTMLDivElement>(null);
  const [late, setLate] = useState(false);
  useEffect(() => { if (profile) garlandSeen = true; }, [profile]);
  useEffect(() => { const t = setTimeout(() => setLate(true), 2400); return () => clearTimeout(t); }, []);
  const show = phase === "intro" && ready && late && !profile && !garlandSeen;
  // ride along beside his head
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    const tick = () => {
      const el = box.current;
      if (el) {
        const x = Math.min(innerWidth - 200, bubbleAnchor.x + 46);
        el.style.transform = `translate(${x}px, ${bubbleAnchor.y + 64}px)`;
        el.style.visibility = bubbleAnchor.visible ? "visible" : "hidden";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  return (
    <div ref={box} className="avatar-prompt-anchor">
      <AnimatePresence>
        {show && (
          <motion.button className="avatar-prompt" onClick={() => ui.set({ profile: true })}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8, transition: { duration: 0.2 } }} transition={{ duration: 0.5, ease: EASE }}>
            <span className="ap-arrow" aria-hidden><IconArrow dir="left" /></span>
            <span className="ap-dot" aria-hidden />
            <span><b>{coarse ? "Tap me" : "Click me"}</b> · my links are here</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Mukund's speech bubble: types out over his head, with a little babble ---------- */
function Bubble() {
  const quip = useUI((s) => s.quip);
  const quipId = useUI((s) => s.quipId);
  const phase = useUI((s) => s.phase);
  const active = useUI((s) => s.active);
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState("");
  const [open, setOpen] = useState(false);

  // type the line out, one letter at a time, babbling on letters unless his real voice is playing
  useEffect(() => {
    if (!quip) return;
    setOpen(true); setShown("");
    // with a real recording, type at his speaking pace so the words land as he says them
    const dur = voiceDuration(ui.get().quipVoice);
    const hasVoice = dur > 0;
    const step = hasVoice ? Math.min(120, Math.max(30, (dur * 1000 * 0.9) / quip.length)) : 42;
    let i = 0;
    const type = window.setInterval(() => {
      i++;
      setShown(quip.slice(0, i));
      const ch = quip[i - 1];
      if (/[a-z0-9]/i.test(ch ?? "")) {
        if (!hasVoice) sim.talk = 1; // a real clip drives the nod by its loudness instead
        if (!hasVoice && i % 2 === 0) babble();
      }
      if (i >= quip.length) window.clearInterval(type);
    }, step);
    const hide = window.setTimeout(() => setOpen(false), Math.max(quip.length * step, dur * 1000) + 3600);
    return () => { window.clearInterval(type); window.clearTimeout(hide); };
  }, [quipId]); // eslint-disable-line react-hooks/exhaustive-deps

  // close it whenever the scene changes
  useEffect(() => { setOpen(false); }, [phase, active]);

  // follow his head every frame
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = box.current;
      if (el) {
        // keep the whole bubble on screen, even when he's near an edge
        const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
        const x = Math.min(innerWidth - w / 2 - 12, Math.max(w / 2 + 12, bubbleAnchor.x));
        el.style.transform = `translate(${x}px, ${bubbleAnchor.y}px) translate(-50%, -100%)`;
        el.style.visibility = bubbleAnchor.visible ? "visible" : "hidden";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={box} className="bubble-anchor" aria-live="polite">
      <AnimatePresence>
        {open && shown && (
          <motion.div key={quipId} className="bubble" initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
            {shown}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Film bars: full for scenes and chapters, slim while you ride. */
function Letterbox({ size }: { size: number }) {
  return (
    <>
      <motion.div className="bar top" animate={{ height: `${size}vh` }} transition={{ duration: 0.9, ease: EASE }} />
      <motion.div className="bar bottom" animate={{ height: `${size}vh` }} transition={{ duration: 0.9, ease: EASE }} />
    </>
  );
}

/* ---------- film-leader loader ---------- */
function Loader() {
  const sceneReady = useUI((s) => s.ready);
  const avatarReady = useUI((s) => s.avatarReady);
  const { progress } = useProgress();
  const [gone, setGone] = useState(false);
  const [waitedEnough, setWaited] = useState(false);
  // the opening shot stars Mukund, so wait for him, but once the scene is up, never more than 2.5 s more
  const ready = sceneReady && (avatarReady || waitedEnough);
  useEffect(() => { if (!sceneReady) return; const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, [sceneReady]);
  // the reel: downloads fill the first 80%, then it keeps creeping while the GPU gets the film ready, so it never sits still
  const [pct, setPct] = useState(0);
  const live = useRef({ progress: 0, ready: false });
  live.current = { progress, ready };
  useEffect(() => {
    let raf = 0, last = performance.now(), v = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const { progress: p, ready: r } = live.current;
      if (r) v = Math.min(100, v + dt * 160);
      else {
        const target = p < 100 ? p * 0.8 : 98;
        const rate = p < 100 ? 3 : 0.35; // developing: slows as it nears the end, but always moves
        v = Math.min(98.5, Math.max(v + dt * 0.4, v + (target - v) * Math.min(1, dt * rate)));
      }
      setPct(v);
      if (v < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // ready: the clapper snaps shut (with a clack, if sound is already allowed), then in we go, or one tap to begin
  const [clapped, setClapped] = useState(false);
  const [askTap, setAskTap] = useState(false);
  useEffect(() => {
    if (!ready || pct < 100 || clapped) return;
    setClapped(true);
    ui.set({ opened: true }); // now the rest of the world can load, behind the title screen
    if (audioRunning()) clack();
  }, [ready, pct, clapped]);
  useEffect(() => {
    if (!clapped) return;
    const t = setTimeout(() => (audioRunning() ? setGone(true) : setAskTap(true)), 250);
    return () => clearTimeout(t);
  }, [clapped]);
  const begin = () => { wakeAudio(); setGone(true); };
  useEffect(() => {
    if (!askTap || gone) return;
    const key = (e: KeyboardEvent) => { e.preventDefault(); begin(); };
    addEventListener("keydown", key, { once: true });
    return () => removeEventListener("keydown", key);
  }, [askTap, gone]);
  const status = clapped ? "Action!" : pct < 80 ? "Loading the print" : "Developing the film";
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");
  return (
    <AnimatePresence>
      {!gone && (
        <motion.div className="loader" exit={{ opacity: 0 }} transition={{ duration: 0.7 }} onClick={askTap ? begin : undefined} style={{ cursor: askTap ? "pointer" : undefined }}>
          <div className={"slate" + (clapped ? " clapped" : "")} aria-hidden>
            <div className="slate-arm" />
            <div className="slate-hinge" />
            <div className="slate-body">
              <div className="slate-stick" />
              <div className="slate-row big"><span>Prod.</span><b>Mukund ki Auto</b></div>
              <div className="slate-grid">
                <div><span>Scene</span><b>01</b></div>
                <div><span>Take</span><b>01</b></div>
                <div><span>Roll</span><b>{String(Math.floor(pct)).padStart(2, "0")}</b></div>
              </div>
              <div className="slate-row"><span>Director</span><b>{ME.name}</b></div>
              <div className="slate-row"><span>Date</span><b>{today}</b><span className="slate-sound">Sound on</span></div>
            </div>
          </div>
          <div className="reel" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)} aria-label="Loading">
            <i style={{ width: `${pct}%` }} />
          </div>
          {askTap ? (
            <button className="btn-primary begin" onClick={begin} autoFocus>
              <IconSound />Tap to begin · sound on
            </button>
          ) : (
            <p className="mono loader-t">{status} · {Math.floor(pct)}%</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- title sequence ---------- */
/** Beside the mirror: who he is, and the garland's links as plain buttons too. */
function ProfileCard() {
  const links = CHARMS;
  return (
    <motion.div className="profile" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.5, ease: EASE }}>
      <p className="mono eyebrow">Self-respect, daily</p>
      <h2>{ME.name}</h2>
      <p className="profile-role">Growth and product · IIT Kanpur, class of 2027 · Can start in May, Bengaluru</p>
      <p className="profile-hint">Every morning, an aarti for the man in the mirror. His links hang on the garland: {coarse ? "tap" : "click"} one, or pick it here.</p>
      <div className="profile-links">
        {links.map((l) => <button key={l.id} className={`plink plink-${l.id}`} onClick={() => openCharm(l)}><i />{l.label}</button>)}
      </div>
      <button className="btn-ghost sm" onClick={() => ui.set({ profile: false })}><IconArrow dir="left" />Back{!coarse && <kbd>Esc</kbd>}</button>
    </motion.div>
  );
}

function TitleSequence() {
  const profile = useUI((s) => s.profile);
  const up = (d: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay: d, ease: EASE } });
  const primary = coarse
    ? { label: "Watch the film", on: () => beginRide(true) }
    : { label: "Start the ride", on: () => beginRide(false) };
  const secondary = coarse
    ? { label: "Drive it yourself", on: () => beginRide(false) }
    : { label: "Watch the film · 4 min", on: () => beginRide(true) };
  return (
    <motion.div className="title-seq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      <div className="title-scrim" />
      <AnimatePresence>{profile && <ProfileCard key="profile" />}</AnimatePresence>
      <div className={"title-body" + (profile ? " away" : "")}>
        <motion.p className="mono eyebrow" {...up(0.2)}>A film by {ME.name}{GUEST && <> · made for {GUEST}</>}</motion.p>
        <motion.h1 className="film-title" initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }} transition={{ duration: 1.4, delay: 0.45, ease: EASE }}>
          Mukund ki <em>Auto</em>
        </motion.h1>
        <motion.p className="hindi" {...up(1.1)}>मुकुंद की ऑटो</motion.p>
        <motion.p className="logline" {...up(1.35)}>
          {FIRST && <><b className="guest">Namaste {FIRST}, this ride is for you.</b><br /></>}
          A road movie in {CHAPTER_COUNT_WORD} chapters.<br />Agra → IIT Kanpur → Wispr Flow.
        </motion.p>
        <motion.div className="cta" {...up(1.6)}>
          <button className="btn-primary" onClick={primary.on} autoFocus>
            {coarse ? <IconPlay /> : null}{primary.label}{!coarse && <kbd>↵</kbd>}
          </button>
          <button className="btn-ghost" onClick={secondary.on}>{coarse ? null : <IconPlay />}{secondary.label}</button>
        </motion.div>
        {voiceDriveSupported && (
          <motion.button className="voice-cta" onClick={voiceDriveNow} {...up(1.75)}>
            <span className="voice-ic"><IconMic /></span>
            <span><b>Drive it with your voice.</b> Say “move”.</span>
            {!coarse && <kbd>B</kbd>}
          </motion.button>
        )}
        <motion.button className="work-jump" onClick={jumpToWork} {...up(1.7)}>
          Short on time? <b>Jump straight to my work</b><IconArrow dir="right" />
        </motion.button>
        {!coarse && (
          <motion.div className="controls mono" {...up(1.85)}>
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span>
            <span><kbd>F</kbd> get in / out</span>
            <span><kbd>B</kbd> drive by voice</span>
            <span><kbd>M</kbd> map</span>
            <span><kbd>H</kbd> horn</span>
          </motion.div>
        )}
      </div>
      {!profile && <motion.p className="mono title-credit" {...up(2.1)}>Written &amp; directed by voice · Wispr Flow · sound on</motion.p>}
    </motion.div>
  );
}

/* ---------- HUD ---------- */
function Hud({ hidden }: { hidden: boolean }) {
  return (
    <motion.div className="hud" initial={{ opacity: 0 }} animate={{ opacity: hidden ? 0 : 1 }} transition={{ duration: 0.5 }} style={{ pointerEvents: hidden ? "none" : undefined }}>
      <div className="hud-tl"><ChapterChip /><ScoreChip /></div>
      <div className="hud-tc"><LedBoard /></div>
      <div className="hud-tr"><Controls /></div>
      <div className="hud-bl"><MiniMap /></div>
      <div className="hud-bc"><Hint /><Moves /><Route /></div>
      <div className="hud-br"><VoiceDrivePill /><AutoPill /><ReplyBubble /></div>
      {coarse && <TouchPad />}
    </motion.div>
  );
}

/** Coins, chaos and trophies: the little numbers that make you want to poke around more. */
function ScoreChip() {
  const coins = useUI((s) => s.coins);
  const smashed = useUI((s) => s.smashed);
  const badges = useUI((s) => s.badges.length);
  const active = useUI((s) => s.active);
  const open = useUI((s) => s.badgesOpen);
  useEffect(() => { if (open) markTip("badges"); }, [open]);
  return (
    <Tip id="badges" when={active === null && coins + smashed + badges > 0} place="below" align="left" title={`${BADGES.length} things to find`}
      action={{ label: "See them", run: () => ui.set({ badgesOpen: true }) }}
      anchor={
        <button className="glass chip-score" onClick={() => ui.set({ badgesOpen: true })} aria-label="Achievements">
          <span title="Coins"><i className="dot-coin" /><b>{coins}</b></span>
          <span title="Smashed"><i className="dot-matka" /><b>{smashed}</b></span>
          <span title="Achievements"><IconTrophy /><b>{badges}</b>/{BADGES.length}</span>
        </button>
      }>
      Coins, smashed matkas and secret achievements. Tap here to see what's still locked.
    </Tip>
  );
}

/** Pops up whenever an achievement unlocks. */
function Toast() {
  const toast = useUI((s) => s.toast);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!toast.n) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 3600);
    return () => clearTimeout(t);
  }, [toast.n]);
  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={toast.n} className="toast glass" initial={{ opacity: 0, y: -18, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: EASE }}>
          <span className="toast-ic"><IconTrophy /></span>
          <div><p className="mono label">Achievement unlocked</p><h4>{toast.title}</h4><p className="toast-sub">{toast.sub}</p></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Every achievement, the locked ones as teasers. */
function BadgesPanel() {
  const open = useUI((s) => s.badgesOpen);
  const have = useUI((s) => s.badges);
  const setOpen = (v: boolean) => ui.set({ badgesOpen: v });
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="map-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div className="badges glass" initial={{ y: 14 }} animate={{ y: 0 }} exit={{ y: 10 }} transition={{ duration: 0.35, ease: EASE }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Achievements">
            <header className="map-head">
              <div><p className="mono label">Achievements · {have.length}/{BADGES.length}</p><h2>Things to do on this road.</h2></div>
              <button className="ibtn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </header>
            <ul className="badge-grid">
              {BADGES.map((b) => {
                const got = have.includes(b.id);
                return (
                  <li key={b.id} className={got ? "got" : ""}>
                    <span className="badge-ic"><IconTrophy /></span>
                    <div><h4>{b.title}</h4><p>{got ? b.sub : "Locked. Keep exploring."}</p></div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChapterChip() {
  const visited = useUI((s) => s.visited.length);
  return (
    <div className="glass chip-ch">
      <span className="mono label">Chapters</span>
      <span className="ch-count"><b>{pad(visited)}</b><span>/{N}</span></span>
      <div className="ch-bar"><motion.i animate={{ width: `${(visited / N) * 100}%` }} transition={{ duration: 0.8, ease: EASE }} /></div>
    </div>
  );
}

function LedBoard() {
  const next = useUI((s) => s.nextStop);
  const distance = useUI((s) => s.distance);
  const target = useUI((s) => s.target);
  const msg = `${STOPS[next].name.toUpperCase()}  ·  ${distance} M`;
  return (
    <div className="led" aria-live="polite">
      <span className="led-tag mono">{target !== null ? "Autopilot" : "Next stop"}</span>
      <div className="led-screen"><div className="led-track"><span>{msg}</span><span aria-hidden>{msg}</span></div></div>
    </div>
  );
}

function Controls() {
  const express = useUI((s) => s.express);
  const muted = useUI((s) => s.muted);
  const [help, setHelp] = useState(false);
  const quality = useUI((s) => s.quality);
  const [restart, setRestart] = useState(false);
  // first-time tips: the map after chapter one, the express cut after chapter two
  const seen = useUI((s) => s.visited.length);
  const active = useUI((s) => s.active);
  const mapOpen = useUI((s) => s.mapOpen);
  useEffect(() => { if (mapOpen) markTip("map"); }, [mapOpen]);
  useEffect(() => { if (express) markTip("express"); }, [express]);
  const calm = active === null && !mapOpen;
  const openMap = () => ui.set({ mapOpen: true });
  const target = useUI((s) => s.target);
  return (
    <div className="ctrls">
      {target !== HALL_STOP && active !== HALL_STOP && (
        <button className="ibtn wide work" onClick={jumpToWork} aria-label="Jump straight to my work (J)" title="Jump straight to my work (J)">
          <IconTrophy /><span>My work</span>
        </button>
      )}
      <Tip id="express" when={calm && seen >= 2 && !express} title="Short on time?"
        action={{ label: "Start it", run: startExpress }}
        anchor={
          <button className={"ibtn wide" + (express ? " on" : "")} onClick={() => (express ? ui.set({ express: false, target: null }) : startExpress())} aria-pressed={express}>
            <IconBolt /><span>{express ? "Stop express" : "Express cut"}</span>
          </button>
        }>
        Express cut drives the rest of the route for you, chapter by chapter, hands-free.
      </Tip>
      <Tip id="map" when={calm && seen >= 1 && !express} title="Skip ahead"
        action={{ label: "Open map", kbd: coarse ? undefined : "M", run: openMap }}
        anchor={<button className="ibtn wide" onClick={openMap} aria-label="Map (M)" title="Map (M)"><IconMap /><span>Map</span></button>}>
        Jump to any chapter from the map. The auto drives you there.
      </Tip>
      <button className="ibtn" onClick={() => { setMuted(!muted); ui.set({ muted: !muted }); }} aria-label={muted ? "Unmute" : "Mute"}><IconSound off={muted} /></button>
      <button className="ibtn" onClick={resetToRoad} aria-label="Back on the road (R)" title="Back on the road (R)"><IconReset /></button>
      <span className="restart-wrap">
        <button className={"ibtn" + (restart ? " on" : "")} onClick={() => setRestart(!restart)} aria-label="Start over" title="Start over" aria-expanded={restart}><IconRestart /></button>
        <AnimatePresence>
          {restart && (
            <motion.div className="glass restart-pop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <p><b>Start over from the beginning?</b></p>
              <p className="restart-sub">Back to the title screen. This ride's chapters, coins and fare reset.</p>
              <div className="restart-row">
                <button className="btn-primary sm" onClick={() => location.reload()} autoFocus>Start over</button>
                <button className="btn-ghost sm" onClick={() => setRestart(false)}>Keep riding</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </span>
      <button className={"ibtn" + (help ? " on" : "")} onClick={() => setHelp(!help)} aria-label="Help" aria-expanded={help}><IconHelp /></button>
      <AnimatePresence>
        {help && (
          <motion.div className="glass help" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <p className="mono label">Controls</p>
            <ul>
              <li><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>Walk, or drive the auto</li>
              <li><span><kbd>F</kbd><kbd>↵</kbd></span>Get in / out of the auto</li>
              <li><span><kbd>1</kbd>–<kbd>9</kbd></span>His moves (on foot)</li>
              <li><span><kbd>B</kbd></span>Drive by voice: “move”, “faster”, “slowly”, “stop”, “left”, “right”, “horn”</li>
              <li><span><kbd>J</kbd></span>Jump straight to my work</li>
              <li><span><kbd>M</kbd></span>Route map: jump to any chapter</li>
              <li><span><kbd>H</kbd></span>Horn (cows have opinions)</li>
              <li><span><kbd>Space</kbd></span>Continue a chapter</li>
              <li><span><kbd>R</kbd></span>Back on the road</li>
              <li><span><kbd>H</kbd></span>Horn</li>
            </ul>
            <div className="help-row">
              <button className={"btn-ghost sm" + (quality === 0 ? " on" : "")} onClick={() => { const t = quality === 0 ? 2 : 0; ui.set({ quality: t }); saveTier(t === 0 ? 0 : null); }} aria-pressed={quality === 0}>
                {quality === 0 ? "Smooth mode: on (tap for full detail)" : "Laggy? Turn on smooth mode"}
              </button>
              <button className="btn-ghost sm" onClick={() => { setHelp(false); ui.set({ guide: true }); }}>Show the controls guide</button>
              <button className="btn-ghost sm" onClick={() => { setHelp(false); ui.set({ phase: "finale", active: null, target: null, express: false }); }}>Skip to the end credits</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



function Route() {
  const visited = useUI((s) => s.visited);
  const next = useUI((s) => s.nextStop);
  const target = useUI((s) => s.target);
  return (
    <nav className="glass route" aria-label="Chapters">
      <div className="route-line" />
      {STOPS.map((s, i) => {
        const cls = ["stop", visited.includes(i) && "done", next === i && "next", target === i && "target"].filter(Boolean).join(" ");
        return (
          <button key={s.id} className={cls} style={{ "--c": s.color } as CSSProperties} onClick={() => goTo(i)} aria-label={`Ride to chapter ${i + 1}: ${s.name}`}>
            <i />
            <span className="tip"><b className="mono">{pad(i + 1)}</b>{s.name}</span>
          </button>
        );
      })}
    </nav>
  );
}

const MOVE_NAMES: Record<string, string> = { dance: "Dance", backflip: "Backflip", pushups: "Push-ups", box: "Box", conduct: "Conduct", facepalm: "Facepalm", land: "Superhero", sneak: "Sneak", march: "March" };

/** On foot: the nine moves on the number keys, as chips you can also click. */
function Moves() {
  const onFoot = useUI((s) => s.onFoot);
  const active = useUI((s) => s.active);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!onFoot) return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), 7000);
    return () => clearTimeout(t);
  }, [onFoot]);
  if (!onFoot || active !== null) return null;
  return (
    <div className={"moves glass" + (open ? " open" : "")} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="moves-tag mono">{coarse ? "Moves" : <>Press <kbd>1</kbd>–<kbd>9</kbd> for his moves</>}</span>
      <span className="moves-list">
        {EMOTES.map((a, i) => (
          <button key={a} onClick={() => cue(a)}>{!coarse && <kbd>{i + 1}</kbd>}{MOVE_NAMES[a] ?? a}</button>
        ))}
      </span>
    </div>
  );
}

function Hint() {
  const coach = useUI((s) => s.coach);
  const boarded = useUI((s) => s.boarded); // before the first boarding, the "walk to your auto" prompt does the coaching
  const offroad = useUI((s) => s.offroad);
  const active = useUI((s) => s.active);
  // progress the first-ride coaching: drive → follow → voice → done
  useEffect(() => {
    if (coach === "drive") {
      const t = setInterval(() => { if (Math.abs(sim.speed) > 4 || Math.abs(walker.speed) > 2) ui.set({ coach: "follow" }); }, 200);
      return () => clearInterval(t);
    }
    if (coach === "follow") { const t = setTimeout(() => ui.set({ coach: "voice" }), 5500); return () => clearTimeout(t); }
    if (coach === "voice") { const t = setTimeout(() => ui.set({ coach: "done" }), 9000); return () => clearTimeout(t); }
    if (coach === "done") markCoached();
  }, [coach]);
  let text = "";
  if (offroad) text = coarse ? "Off-road. Tap ↺ to hop back on." : "Off-road. Press R to hop back on.";
  else if (active === null && coach === "drive" && boarded) text = coarse ? "Hold ▲ to walk. Tap “Hop in” to drive." : "W A S D to walk or drive · F to get in and out.";
  else if (active === null && coach === "follow") text = "Follow the chevron to the next milestone.";
  else if (active === null && coach === "voice") text = coarse ? "Tap Map to jump to any chapter." : "Press M for the map: jump to any chapter.";
  return (
    <AnimatePresence mode="wait">
      {text && <motion.p key={text} className="hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>{text}</motion.p>}
    </AnimatePresence>
  );
}


/* ---------- the controls guide: the first time he's on foot, and any time from Help ---------- */
const GUIDE_KEY = "mukund-auto-guide";
const guideSeen = () => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch { return false; } };
const KEYS: [string[], string][] = [
  [["W", "A", "S", "D"], "Walk, or drive"],
  [["F"], "Get in / out"],
  [["1", "–", "9"], "His moves"],
  [["M"], "Route map"],
  [["J"], "Jump to my work"],
  [["B"], "Drive by voice"],
  [["H"], "Horn"],
  [["R"], "Back on the road"],
  [["Space"], "Next, in a chapter"],
  [["?"], "This guide"],
];
const TOUCH: [string, string][] = [
  ["▲ ▼", "Walk, or drive the auto"],
  ["◀ ▶", "Turn"],
  ["Hop in", "Get in or out of the auto"],
  ["Map", "Jump to any chapter"],
  ["My work", "Straight to the decks and prototypes"],
];
function ControlsGuide() {
  const open = useUI((s) => s.guide);
  const phase = useUI((s) => s.phase);
  const onFoot = useUI((s) => s.onFoot);
  const active = useUI((s) => s.active);
  const visited = useUI((s) => s.visited.length);
  // first time: once chapter one is done and he's standing on the road
  useEffect(() => {
    if (guideSeen() || phase !== "ride" || !onFoot || active !== null || visited < 1) return;
    const t = setTimeout(() => ui.set({ guide: true }), 900);
    return () => clearTimeout(t);
  }, [phase, onFoot, active, visited]);
  const close = () => { try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* storage blocked */ } ui.set({ guide: false }); };
  // walking off counts as "got it"
  useEffect(() => {
    if (!open) return;
    let moved = 0;
    const t = setInterval(() => { moved = Math.abs(walker.speed) > 1.2 || Math.abs(sim.speed) > 2 ? moved + 1 : 0; if (moved > 15) close(); }, 200);
    return () => clearInterval(t);
  }, [open]);
  return (
    <AnimatePresence>
      {open && phase === "ride" && active === null && (
        <motion.aside className="glass guide" role="dialog" aria-label="Controls"
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16, transition: { duration: 0.25 } }} transition={{ duration: 0.45, ease: EASE }}>
          <p className="mono guide-eyebrow">How to ride</p>
          <h3>You're on foot. The auto's yours.</h3>
          <ul>
            {coarse
              ? TOUCH.map(([k, l]) => <li key={k}><span className="guide-keys"><kbd>{k}</kbd></span>{l}</li>)
              : KEYS.map(([ks, l]) => <li key={l}><span className="guide-keys">{ks.map((k) => (k === "–" ? <i key={k}>–</i> : <kbd key={k}>{k}</kbd>))}</span>{l}</li>)}
          </ul>
          <div className="guide-row">
            <button className="btn-primary sm" onClick={close}>Let's go</button>
            <span className="mono">{coarse ? "Help (?) shows this again" : "Start walking, or press ? for this again"}</span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Hop in / get out, for touch screens (and as a reminder of E on desktop). */
function AutoPill() {
  const onFoot = useUI((s) => s.onFoot);
  const active = useUI((s) => s.active);
  const [near, setNear] = useState(false);
  useEffect(() => { const t = setInterval(() => setNear(nearAuto()), 250); return () => clearInterval(t); }, []);
  if (active !== null || (onFoot && !near)) return null;
  return (
    <button className="voice auto-pill" onClick={() => { const m = toggleAuto(); if (m) ui.set({ reply: m }); }}>
      <span className="voice-txt">{onFoot ? "Hop in the auto" : "Get out"}</span>
      {!coarse && <kbd>F</kbd>}
    </button>
  );
}

/** Drive by voice: a pill to start it, then a live panel of what it heard. */
function VoiceDrivePill() {
  const on = useUI((s) => s.voiceDrive);
  const status = useUI((s) => s.voiceStatus);
  const heard = useUI((s) => s.voiceHeard);
  const phase = useUI((s) => s.phase);
  const active = useUI((s) => s.active);
  const mapOpen = useUI((s) => s.mapOpen);
  useEffect(() => { if (on) markTip("voice"); }, [on]);
  if (!voiceDriveSupported) return null;
  if (!on) return (
    <Tip id="voice" when={phase === "ride" && active === null && !mapOpen} delay={6000} place="above" align="right" title="Drive with your voice"
      action={{ label: "Try it", kbd: coarse ? undefined : "B", run: voiceDriveNow }}
      anchor={
        <button className="voice auto-pill" onClick={voiceDriveNow}>
          <span className="voice-txt">Drive by voice</span>{!coarse && <kbd>B</kbd>}
        </button>
      }>
      Say “move”, “left”, “stop”, or “take me to NoBroker”.
    </Tip>
  );
  return (
    <button className="glass vd-panel" onClick={toggleVoiceDrive} aria-label="Stop driving by voice">
      <span className="vd-head"><i className="vd-dot" />{status || "Listening"}</span>
      <span className="vd-heard">{heard ? `“${heard}”` : "Say “move”, “faster”, “stop”…"}</span>
      <span className="mono vd-words">move · faster · slowly · stop · left · right · back · horn · map{!coarse && " · B to stop"}</span>
    </button>
  );
}

/** Short lines from the game ("Pehle rukne do!"), shown for a few seconds. */
function ReplyBubble() {
  const reply = useUI((s) => s.reply);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!reply) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 4000);
    return () => clearTimeout(t);
  }, [reply]);
  if (!shown) return null;
  return <div className="voice said" role="status"><span className="voice-txt">{reply}</span></div>;
}

function TouchPad() {
  const hold = (k: "up" | "down" | "left" | "right") => ({
    onPointerDown: (e: RPointerEvent) => { e.preventDefault(); input[k] = true; },
    onPointerUp: () => { input[k] = false; }, onPointerLeave: () => { input[k] = false; }, onPointerCancel: () => { input[k] = false; },
  });
  return (
    <div className="touch">
      <div className="touch-l"><button aria-label="Steer left" {...hold("left")}><IconArrow dir="left" /></button><button aria-label="Steer right" {...hold("right")}><IconArrow dir="right" /></button></div>
      <div className="touch-r"><button aria-label="Brake" {...hold("down")}><IconArrow dir="down" /></button><button className="gas" aria-label="Accelerate" {...hold("up")}><IconArrow dir="up" /></button></div>
    </div>
  );
}

/* ---------- chapter: lower-third over a cinematic orbit ---------- */
function Chapter() {
  const active = useUI((s) => s.active);
  const express = useUI((s) => s.express);
  const stop = active !== null ? STOPS[active] : null;
  return (
    <AnimatePresence mode="wait">
      {stop && active !== null && (
        <motion.section key={stop.id} className="chapter" style={{ "--c": stop.color } as CSSProperties} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
          <div className="ch-scrim" />
          <div className="ch-body">
            <motion.p className="mono ch-meta" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.6, ease: EASE }}>
              <i />Chapter {pad(active + 1)} <span>/ {N}</span> · {stop.name}
            </motion.p>
            <motion.h2 className="ch-title" initial={{ opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} transition={{ delay: 0.5, duration: 0.9, ease: EASE }}>
              {stop.title}
            </motion.h2>
            <div className="ch-subs">
              {stop.lines.map((l, k) => (
                <motion.p key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + k * 0.75, duration: 0.6, ease: EASE }}>{l}</motion.p>
              ))}
            </div>
            {stop.points && (
              <ul className="ch-points">
                {stop.points.map((pt, k) => (
                  <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + stop.lines.length * 0.75 + k * 0.3, duration: 0.5, ease: EASE }}>{pt}</motion.li>
                ))}
              </ul>
            )}
            {stop.stats && (
              <div className="ch-figs">
                {stop.stats.map((s, k) => (
                  <motion.div key={s.l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + stop.lines.length * 0.55 + k * 0.15, duration: 0.6, ease: EASE }}>
                    <b>{s.n}</b><span className="mono">{s.l}</span>
                  </motion.div>
                ))}
              </div>
            )}
            <Photos stop={active} />
            <motion.div className="ch-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
              {express ? (
                <div className="xtimer"><span className="mono">Next chapter</span><div><motion.i initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: readTime(active), ease: "linear" }} /></div></div>
              ) : (
                <>
                  {stop.walkIn ? (
                    <>
                      <button className="btn-primary sm walk-in" onClick={() => closeStop(true)}>Walk in and explore<IconArrow dir="right" />{!coarse && <kbd>Space</kbd>}</button>
                      <button className="btn-ghost sm" onClick={() => closeStop(false)}>Keep driving{!coarse && <kbd>Esc</kbd>}</button>
                    </>
                  ) : (
                    <button className="btn-primary sm" onClick={() => closeStop(true)}>Continue{!coarse && <kbd>Space</kbd>}</button>
                  )}
                  {stop.link && (stop.link.embed
                    ? <button className="btn-ghost sm ch-link" onClick={() => ui.set({ embed: stop.link!.url })}><IconPlay />{stop.link.label}</button>
                    : <a className="btn-ghost sm ch-link" href={stop.link.url} target="_blank" rel="noopener"><IconLink />{stop.link.label}</a>)}
                  {!stop.walkIn && <span className="mono ch-or">{coarse ? "or tap ▲ to drive on" : "or just start driving"}</span>}
                </>
              )}
            </motion.div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/* ---------- chapter photos ----------
   Drop files into public/photos/ named after the chapter id: agra-1.jpg, agra-2.jpg … (up to 8, jpg / jpeg / png / webp).
   A chapter's `photo` in content.ts is shown first. Chapters with no files just show no photos. */
const photoCache = new Map<number, Promise<string[]>>();
const loads = (src: string) => new Promise<boolean>((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
function findPhotos(i: number) {
  if (!photoCache.has(i)) photoCache.set(i, (async () => {
    const st = STOPS[i], out: string[] = [];
    if (st.photo && (await loads(st.photo))) out.push(st.photo);
    for (let n = 1; n <= 8; n++) {
      const found = await Promise.all(["jpg", "jpeg", "png", "webp"].map(async (ext) => { const u = `/photos/${st.gallery ?? st.id}-${n}.${ext}`; return (await loads(u)) ? u : null; }));
      const hit = found.find(Boolean);
      if (!hit) break; // numbering stops at the first gap
      out.push(hit);
    }
    return out;
  })());
  return photoCache.get(i)!;
}
function usePhotos(i: number | null) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => { setList([]); if (i === null) return; let live = true; findPhotos(i).then((l) => { if (live) setList(l); }); return () => { live = false; }; }, [i]);
  return list;
}

function Photos({ stop }: { stop: number }) {
  const list = usePhotos(stop);
  if (!list.length) return null;
  return (
    <motion.div className="ch-photos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.6, ease: EASE }}>
      {list.slice(0, 5).map((src, k) => (
        <button key={src} className="ch-thumb" onClick={() => ui.set({ lightbox: { stop, index: k } })} aria-label={`Open photo ${k + 1}`}>
          <img src={src} alt="" />
          {k === 4 && list.length > 5 && <span>+{list.length - 5}</span>}
        </button>
      ))}
      <span className="mono ch-photos-label">{list.length === 1 ? "1 photo" : `${list.length} photos`} · tap to open</span>
    </motion.div>
  );
}

/** A chapter photo, full screen. Arrow keys to flip through, Esc to close. */
export function lightboxKey(code: string) {
  const lb = ui.get().lightbox;
  if (!lb) return;
  if (code === "Escape" || code === "Space") { ui.set({ lightbox: null }); return; }
  const step = code === "ArrowRight" || code === "KeyD" ? 1 : code === "ArrowLeft" || code === "KeyA" ? -1 : 0;
  if (step) findPhotos(lb.stop).then((l) => ui.set({ lightbox: { stop: lb.stop, index: (lb.index + step + l.length) % l.length } }));
}

function Lightbox() {
  const lb = useUI((s) => s.lightbox);
  const list = usePhotos(lb ? lb.stop : null);
  const src = lb ? list[lb.index] : undefined;
  const go = (d: number) => { if (lb && list.length) ui.set({ lightbox: { stop: lb.stop, index: (lb.index + d + list.length) % list.length } }); };
  return (
    <AnimatePresence>
      {lb && (
        <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => ui.set({ lightbox: null })} role="dialog" aria-label="Photo">
          {src && <motion.img key={src} src={src} alt="" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: EASE }} onClick={(e) => e.stopPropagation()} />}
          <p className="mono lb-cap">{STOPS[lb.stop].name} · {lb.index + 1} / {list.length || 1}</p>
          {list.length > 1 && (
            <>
              <button className="ibtn lb-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo"><IconArrow dir="left" /></button>
              <button className="ibtn lb-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo"><IconArrow dir="right" /></button>
            </>
          )}
          <button className="ibtn lb-close" onClick={() => ui.set({ lightbox: null })} aria-label="Close">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- inside Competitions & Hackathons ---------- */

type Shown = { title: string; kicker: string; blurb: string; facts: { n: string; l: string }[]; story?: Story; image?: string; nav?: { i: number; n: number }; actions: { label: string; run: () => void }[] };

/** What's on the exhibit card right now; Enter runs its first action, Space opens the full story. */
let current: Shown | null = null;
let toggleStory: (() => void) | null = null;
export function exhibitStory() {
  if (!toggleStory) return false;
  toggleStory();
  return true;
}
export function exhibitAction() {
  if (!current || !current.actions.length) return false;
  current.actions[0].run();
  return true;
}

function describe(spot: Spot): Shown {
  if (spot.kind === "deck") {
    const d = DECKS[spot.index];
    return {
      title: d.name, kicker: `Case competition · ${spot.index + 1} of ${DECKS.length}`, blurb: d.brief, facts: [], image: `/decks/${d.file}-1.jpg`, story: STORIES[d.file],
      nav: { i: spot.index, n: DECKS.length },
      actions: [{ label: "Open the deck", run: () => window.open(`/decks/${d.file}.pdf`, "_blank", "noopener") }],
    };
  }
  const e = EXHIBITS.find((x) => x.id === spot.exhibit)!;
  return {
    title: e.name, kicker: e.kicker, blurb: e.blurb, facts: e.facts, story: STORIES[e.id],
    actions: e.links.map((l) => ({ label: l.label, run: () => (l.embed ? ui.set({ embed: l.url }) : window.open(l.url, "_blank", "noopener")) })),
  };
}

/** Walk up to an exhibit and its card slides up: the story, the numbers, and a way in. */
function ExhibitCard() {
  const onFoot = useUI((s) => s.onFoot);
  const active = useUI((s) => s.active);
  const [shown, setShown] = useState<{ key: string; data: Shown } | null>(null);
  const [inside, setInside] = useState(false);
  // the full story stays open as you step along the wall, so you can read deck after deck
  const [open, setOpen] = useState(false);
  toggleStory = shown?.data.story ? () => setOpen((o) => !o) : null;
  useEffect(() => {
    const t = setInterval(() => {
      const here = onFoot && active === null;
      const spot = here ? spotNear(walker.pos) : null;
      setInside(here && inHall(walker.pos));
      const key = spot ? (spot.kind === "deck" ? `deck${spot.index}` : spot.exhibit) : "";
      setShown((prev) => (prev?.key === key ? prev : spot ? { key, data: describe(spot) } : null));
    }, 150);
    return () => clearInterval(t);
  }, [onFoot, active]);
  current = shown?.data ?? null;
  return (
    <AnimatePresence mode="wait">
      {shown ? (
        <motion.div key={shown.key} className="exhibit glass" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.35, ease: EASE }}>
          {shown.data.image && <img className="exhibit-img" src={shown.data.image} alt="" />}
          <div className="exhibit-body">
            <p className="mono label">{shown.data.kicker}</p>
            <h3>{shown.data.title}</h3>
            {shown.data.story ? (
              <>
                <p className="exhibit-blurb">{shown.data.story.problem}</p>
                <p className="story-call"><span className="mono">The call</span>{shown.data.story.call}</p>
                <button className="story-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
                  {open ? "Hide the story" : `Full story · ${shown.data.story.did.length} steps`}<IconArrow dir={open ? "up" : "down"} />{!coarse && <kbd>Space</kbd>}
                </button>
                {open && (
                  <div className="story">
                    <p className="mono">What we did</p>
                    <ol>{shown.data.story.did.map((d) => <li key={d}>{d}</li>)}</ol>
                    <p className="mono">What I learned</p>
                    <p className="story-learned">{shown.data.story.learned}</p>
                    {shown.data.story.team && <p className="story-team">{shown.data.story.team}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="exhibit-blurb">{shown.data.blurb}</p>
            )}
            {shown.data.facts.length > 0 && (
              <div className="exhibit-facts">{shown.data.facts.map((f) => <span key={f.l}><b>{f.n}</b>{f.l}</span>)}</div>
            )}
            {shown.data.actions.length > 0 && (
              <div className="exhibit-actions">
                {shown.data.nav && (
                  <span className="deck-nav">
                    <button className="btn-ghost sm" disabled={shown.data.nav.i === 0} onClick={() => stepDeck(walker.pos, -1)} aria-label="Previous deck"><IconArrow dir="left" /></button>
                    <button className="btn-ghost sm" disabled={shown.data.nav.i === shown.data.nav.n - 1} onClick={() => stepDeck(walker.pos, 1)} aria-label="Next deck"><IconArrow dir="right" /></button>
                    {!coarse && <span className="mono deck-nav-keys">A · D or ← →</span>}
                  </span>
                )}
                {shown.data.actions.map((a, k) => (
                  <button key={a.label} className={k === 0 ? "btn-primary sm" : "btn-ghost sm"} onClick={a.run}>{a.label}{k === 0 && !coarse && <kbd>↵</kbd>}</button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : inside ? (
        <motion.div key="hint" className="exhibit-hint glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <IconTrophy /> Walk up to anything: decks on the back wall, Meesho in the middle, Pacto left, Sarvam right. The banners open each company's work. Done? Walk out to your auto and press F.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A live page (the Meesho prototype), in a window inside the ride. */
function Embed() {
  const url = useUI((s) => s.embed);
  return (
    <AnimatePresence>
      {url && (
        <motion.div className="embed-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => ui.set({ embed: null })}>
          <motion.div className="embed glass" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.35, ease: EASE }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live prototype">
            <header className="embed-head">
              <span className="mono label">Live prototype</span>
              <a className="btn-ghost sm" href={url} target="_blank" rel="noopener"><IconLink />Open in a new tab</a>
              <button className="ibtn" onClick={() => ui.set({ embed: null })} aria-label="Close">✕</button>
            </header>
            <iframe src={url} title="Live prototype" allow="autoplay; fullscreen" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- first ride: get him into the auto ---------- */
function BoardPrompt() {
  const onFoot = useUI((s) => s.onFoot);
  const boarded = useUI((s) => s.boarded);
  const active = useUI((s) => s.active);
  const [near, setNear] = useState(false);
  useEffect(() => { const t = setInterval(() => setNear(nearAuto()), 250); return () => clearInterval(t); }, []);
  const show = onFoot && !boarded && active === null;
  return (
    <AnimatePresence>
      {show && (
        <motion.button className="board-prompt" onClick={() => { const m = toggleAuto(); if (m) ui.set({ reply: m }); }}
          initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.45, ease: EASE }}>
          <span className="bp-key">{coarse ? "Tap" : "F"}</span>
          <span><b>{near ? "Get in your auto" : "Walk to your auto"}</b>{near ? (coarse ? " and the ride begins" : " · or press Enter") : " · it’s waiting nearby"}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ---------- the plan for Wispr Flow India: opened from a pitch board or the poster on the auto ---------- */
const PLAN_TINT = ["#e4007c", "#1e88e5", "#00a884"];
export function planKey(code: string) {
  const k = ui.get().plan;
  if (k === null) return false;
  if (ui.get().planNote && code !== "Escape") { if (code === "Enter" || code === "Space" || code === "ArrowRight") ui.set({ planNote: false }); return true; }
  if (code === "Escape" || code === "Space" || code === "Enter") ui.set({ plan: null });
  const step = code === "ArrowRight" || code === "KeyD" ? 1 : code === "ArrowLeft" || code === "KeyA" ? -1 : 0;
  if (step) ui.set({ plan: (k + step + WISPR_PLAN.ideas.length) % WISPR_PLAN.ideas.length });
  return true;
}
/** One icon per idea: a creator's camera, a graduation cap, a rupee tag. */
function PlanIcon({ k }: { k: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (k === 0) return <svg viewBox="0 0 24 24" {...s}><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="M15.5 10.5l6-3v9l-6-3" /><circle cx="9" cy="12" r="2.2" /></svg>;
  if (k === 1) return <svg viewBox="0 0 24 24" {...s}><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.2V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.8" /><path d="M22 9v5" /></svg>;
  return <svg viewBox="0 0 24 24" {...s}><path d="M3 12V4.5A1.5 1.5 0 014.5 3H12l9 9-9 9z" /><path d="M8 7.5h5M8 10h5M11 10c0 2-1.5 3-3 3l4 3.5" /></svg>;
}
/** Opened from the poster on his own auto: he turns to the camera and explains himself. */
function PosterNote({ onNext }: { onNext: () => void }) {
  const secs = Math.round(sim.posterSeen);
  const seen = secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} second${secs === 1 ? "" : "s"}`;
  return (
    <motion.aside key="note" className="poster-note" initial={{ opacity: 0, rotate: 8, y: 40, scale: 0.9 }} animate={{ opacity: 1, rotate: -2, y: 0, scale: 1 }} exit={{ opacity: 0, rotate: -8, y: -30, transition: { duration: 0.25 } }} transition={{ type: "spring", stiffness: 180, damping: 16 }} onClick={(e) => e.stopPropagation()}>
      <p className="mono">Psst. Yes, you. The one behind the auto.</p>
      <p>Why is my growth plan on the back of an auto? Because the back of an auto is India's most-watched billboard. Nobody chooses to look at it. Everyone stuck behind one reads every word anyway.</p>
      {secs >= 45
        ? <p>And you've been stuck behind this one the whole ride: <b>{seen}</b> of it, by my count. ₹0 media spend, 100% viewability, an audience of exactly the one person I wanted. Same playbook as Chill Hai.</p>
        : <p>You've been behind this one for <b>{seen}</b> and you already tapped it. That's a 100% click-through rate. ₹0 media spend, an audience of exactly the one person I wanted. Same playbook as Chill Hai.</p>}
      <p className="pn-sign">Yes, I tracked that. It's a growth role. — Mukund</p>
      <button className="btn-primary sm pn-next" onClick={onNext} autoFocus>Fine. Show me the plan<IconArrow dir="right" /></button>
    </motion.aside>
  );
}

function PlanCard() {
  const k = useUI((s) => s.plan);
  const noteUp = useUI((s) => s.planNote); // opened from the poster: his note first, then the cards
  const n = WISPR_PLAN.ideas.length;
  const go = (j: number) => ui.set({ plan: (j + n) % n });
  return (
    <AnimatePresence>
      {k !== null && (
        <motion.div className="plan-deck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} onClick={() => ui.set({ plan: null })} role="dialog" aria-label="My first 90 days at Wispr Flow India">
          <div className="plan-burst" aria-hidden />
          <AnimatePresence>{noteUp && <PosterNote onNext={() => ui.set({ planNote: false })} />}</AnimatePresence>
          {!noteUp && <>
          <motion.header className="plan-head" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} onClick={(e) => e.stopPropagation()}>
            <p className="mono">★ If you hire me · my first 90 days ★</p>
            <h2>India is <em>#2</em> by users.<br />A small slice of revenue.</h2>
            <p className="plan-sub">That's the job: grow the users who are already here, and turn them into paying ones. Three ways I'd start.</p>
          </motion.header>
          <div className="plan-hand" onClick={(e) => e.stopPropagation()}>
            {WISPR_PLAN.ideas.map((idea, j) => {
              const off = ((j - k + n + 1) % n) - 1; // -1, 0, 1: left, front, right
              const front = off === 0;
              return (
                <motion.article key={idea.tag} className={"plan-cardx" + (front ? " front" : "")} style={{ "--tint": PLAN_TINT[j], zIndex: front ? 3 : 1 } as CSSProperties}
                  initial={{ opacity: 0, y: 120, rotate: 0, scale: 0.8 }}
                  animate={{ opacity: front ? 1 : 0.62, x: `${off * 74}%`, y: front ? 0 : 26, rotate: off * 7, scale: front ? 1 : 0.86 }}
                  transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.12 + j * 0.06 }}
                  onClick={() => !front && go(j)} aria-hidden={!front}>
                  <div className="pc-top">
                    <span className="pc-icon"><PlanIcon k={j} /></span>
                    <span className="mono pc-tag">{idea.tag}</span>
                    <b className="pc-num">{String(j + 1).padStart(2, "0")}</b>
                  </div>
                  <h3>{idea.title}</h3>
                  <p className="pc-what">{idea.what}</p>
                  <dl>
                    <div><dt className="mono">Measure</dt><dd>{idea.measure}</dd></div>
                    <div><dt className="mono">Why me</dt><dd>{idea.proof}</dd></div>
                  </dl>
                </motion.article>
              );
            })}
          </div>
          <motion.footer className="plan-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <button className="ibtn" onClick={() => go(k - 1)} aria-label="Previous idea"><IconArrow dir="left" /></button>
            <span className="plan-dots">{WISPR_PLAN.ideas.map((_, j) => <button key={j} className={j === k ? "on" : ""} style={{ "--tint": PLAN_TINT[j] } as CSSProperties} onClick={() => go(j)} aria-label={`Idea ${j + 1}`} />)}</span>
            <button className="ibtn" onClick={() => go(k + 1)} aria-label="Next idea"><IconArrow dir="right" /></button>
            <button className="btn-primary sm" onClick={() => ui.set({ plan: null })}>Back to the road{!coarse && <kbd>Esc</kbd>}</button>
          </motion.footer>
          </>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- the growth experiment: share your fare ticket ---------- */
function ticketImage(o: { km: number; visited: number; badges: number; rider: number | null }) {
  const c = document.createElement("canvas"); c.width = 1200; c.height = 630;
  const g = c.getContext("2d")!;
  g.fillStyle = "#14100c"; g.fillRect(0, 0, 1200, 630);
  // the ticket, with its punched edge
  g.save(); g.beginPath(); g.roundRect(70, 70, 1060, 490, 28); g.clip();
  g.fillStyle = "#fbf3df"; g.fillRect(70, 70, 1060, 490);
  g.fillStyle = "#ffb547"; g.fillRect(70, 70, 1060, 16);
  g.restore();
  g.fillStyle = "#14100c"; for (let y = 104; y < 560; y += 34) { g.beginPath(); g.arc(800, y, 9, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#6d5a40"; g.font = "bold 22px monospace"; g.fillText("AUTO TICKET · UP 80 · AGRA → BENGALURU", 120, 140);
  g.fillStyle = "#1a1208"; g.font = "86px Georgia, serif"; g.fillText("Mukund ki", 120, 250);
  const after = 120 + g.measureText("Mukund ki ").width;
  g.fillStyle = "#e8902a"; g.font = "italic 86px Georgia, serif"; g.fillText("Auto", after, 250);
  const rows: [string, string][] = [["FARE", `₹${fare(o.km)}`], ["DISTANCE", `${o.km.toFixed(2)} km`], ["CHAPTERS", `${o.visited}/${N}`], ["ACHIEVEMENTS", `${o.badges}/${BADGES.length}`]];
  rows.forEach(([l, v], k) => {
    const x = 120 + (k % 2) * 330, y = 330 + Math.floor(k / 2) * 110;
    g.fillStyle = "#8a7656"; g.font = "bold 20px monospace"; g.fillText(l, x, y);
    g.fillStyle = "#1a1208"; g.font = "bold 46px Georgia, serif"; g.fillText(v, x, y + 52);
  });
  g.fillStyle = "#8a7656"; g.font = "bold 20px monospace"; g.fillText("RIDER", 860, 150);
  g.fillStyle = "#1a1208"; g.font = "bold 74px Georgia, serif"; g.fillText(o.rider ? `#${o.rider}` : "#—", 860, 230, 240);
  g.fillStyle = "#6d5a40"; g.font = "26px Georgia, serif";
  ["A 3D road movie", "of one growth", "builder's life.", "Directed by voice."].forEach((l, k) => g.fillText(l, 860, 320 + k * 38));
  g.fillStyle = "#e8902a"; g.font = "bold 24px monospace"; g.fillText(location.host.toUpperCase(), 860, 520, 240);
  return new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
}

function ShareTicket({ km, visited, badges, rider, onStop }: { km: number; visited: number; badges: number; rider: number | null; onStop: () => void }) {
  const [note, setNote] = useState("");
  const share = async () => {
    onStop();
    const blob = await ticketImage({ km, visited, badges, rider });
    const url = location.origin + "/";
    const text = `I just rode Mukund ki Auto${rider ? ` as rider #${rider}` : ""}: ${visited}/${N} chapters, ₹${fare(km)} fare. A portfolio you drive, by voice.`;
    track("share");
    const file = blob && new File([blob], "mukund-ki-auto-ticket.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (file && nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, url }); setNote("Shared. Thank you for riding."); return; } catch { /* cancelled */ }
    }
    // desktop: save the image, then open LinkedIn ready to post it
    if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mukund-ki-auto-ticket.png"; a.click(); }
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "noopener");
    setNote("Ticket saved. Attach it to your LinkedIn post.");
  };
  return (
    <div className="share-ticket">
      <button className="btn-primary" onClick={share}><IconLink />Share my ticket</button>
      <span className="mono">{note || "Your fare ticket as an image, ready to post"}</span>
    </div>
  );
}

/* ---------- "Say it, see it": what Wispr Flow does, in miniature ---------- */
function SayItSeeIt({ onStop }: { onStop: () => void }) {
  const [state, setState] = useState<DictateState>("idle");
  const [level, setLevel] = useState(0);
  const [said, setSaid] = useState<{ text: string; wpm: number; words: number } | null>(null);
  const [typed, setTyped] = useState("");
  const [miss, setMiss] = useState(false);
  useEffect(() => {
    if (!said) return;
    let i = 0;
    const t = window.setInterval(() => { i++; setTyped(said.text.slice(0, i)); if (i >= said.text.length) window.clearInterval(t); }, 34);
    return () => window.clearInterval(t);
  }, [said]);
  if (!dictateSupported) return null;
  const go = async () => {
    onStop();
    if (state === "listening") { stopDictation(); return; }
    if (state !== "idle") return;
    setMiss(false); setSaid(null); setTyped("");
    try {
      const r = await dictate(setState, setLevel);
      if (!r) { setMiss(true); return; }
      const words = r.text.split(/\s+/).filter(Boolean).length;
      setSaid({ text: r.text, words, wpm: Math.round(words / (r.seconds / 60)) });
      sayOnBillboard(r.text);
    } catch { setState("idle"); setMiss(true); }
  };
  return (
    <section className="say">
      <p className="mono label">Say it, see it</p>
      <h3>Don't type. Just talk.</h3>
      <p className="say-sub">This is what Wispr Flow does in every app. Here's a tiny version: say any sentence, in English or Hinglish, and watch it write itself.</p>
      <div className="say-board" aria-live="polite">
        <span className="mono say-tag">Wispr billboard · live</span>
        <p className="say-text">{typed || (state === "listening" ? "Listening…" : state === "thinking" ? "Writing it down…" : miss ? "Didn't catch that. Try once more?" : "Your words go here.")}{said && typed.length < said.text.length && <i className="say-caret" />}</p>
        {said && typed.length >= said.text.length && said.words >= 4 && (
          <p className="mono say-wpm">You spoke at <b>{said.wpm} words a minute</b>. Most people type around 40.</p>
        )}
      </div>
      <button className={"say-mic" + (state === "listening" ? " on" : "")} onClick={go} disabled={state === "thinking"} style={{ "--lvl": level } as CSSProperties}>
        <IconMic />{state === "listening" ? "Done? Tap to stop" : state === "thinking" ? "Writing…" : said ? "Say another" : "Tap and speak"}
      </button>
      <p className="mono say-note">Nothing is stored.</p>
    </section>
  );
}

/* ---------- finale: rolling end credits ---------- */
const CREDITS: [string, string][] = [
  ["Starring", `${ME.name}, as the notorious driver`],
  ["And", "One black-and-yellow auto, UP 80"],
  ["Product Intern · PPO", "NoBroker"],
  ["Founder", "Chill Hai · ₹3.75L+ revenue, ₹0 on ads"],
  ["Team Lead · Top 7 of 3,000+", "Pacto · The Ken × Zerodha 2026"],
  ["Assistant Placement Coordinator", "IIT Kanpur · 1,200+ offers"],
  ["Plot twist", "CPI 7.0 → 8.0, with two 9.5s"],
  ["Case competitions", "9 decks · BlinkX, Groww, Swiggy, The Body Shop, Meesho DICE and more"],
  ["Hackathon", "Sarvam AI · 2nd place · an agent in 45 minutes"],
  ["Favourite films", "Fight Club · Memories of Murder · Predestination · The Wailing"],
  ["Filmed on location", "Agra · Kanpur · Gurgaon · Bengaluru"],
  ["Available", "From May · full-time · ready to move to Bengaluru"],
  ["Dialogue", "Spoken, not typed, with Wispr Flow"],
  ["Catering", "Every chai tapri on the way"],
];

function Credits() {
  const km = useUI((s) => s.km);
  const badges = useUI((s) => s.badges.length);
  const visited = useUI((s) => s.visited.length);
  const scroller = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const step = (t: number) => {
      const el = scroller.current, dt = t - last; last = t;
      if (el && !userScrolled.current) el.scrollTop += dt * 0.13;
      if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) { setAtEnd(true); return; }
      raf = requestAnimationFrame(step);
    };
    const t0 = setTimeout(() => { raf = requestAnimationFrame(step); }, 1200);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, []);
  const stopAuto = () => { userScrolled.current = true; };
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => { const off = onCounts(setCounts); track("finish"); return off; }, []);
  const rider = riderNumber();
  const skip = () => { stopAuto(); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); };
  return (
    <motion.div className="credits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
      <div className="credits-scroll" ref={scroller} onWheel={stopAuto} onTouchStart={stopAuto}>
        <div className="credits-inner">
          <p className="mono eyebrow">Fin.</p>
          <h2 className="film-title sm">Mukund ki <em>Auto</em></h2>
          <dl className="roll">
            {CREDITS.map(([role, name]) => (
              <Fragment key={role}><dt className="mono">{role}</dt><dd>{name}</dd></Fragment>
            ))}
          </dl>
          <div className="ticket">
            <div><span className="mono">Fare</span><b>₹{fare(km)}</b></div>
            <div><span className="mono">Distance</span><b>{km.toFixed(2)} km</b></div>
            <div><span className="mono">Chapters</span><b>{visited}/{N}</b></div>
            <div><span className="mono">Achievements</span><b>{badges}/{BADGES.length}</b></div>
            {GUEST && <div><span className="mono">Passenger</span><b>{GUEST}</b></div>}
            {rider && <div><span className="mono">Rider</span><b>#{rider}</b></div>}
            <p>Payable in a job offer.</p>
          </div>
          <ShareTicket km={km} visited={visited} badges={badges} rider={rider} onStop={stopAuto} />
          {counts && (
            <p className="mono counts">
              {counts.ride.toLocaleString("en-IN")} rides started · {counts.finish.toLocaleString("en-IN")} finished · {counts.share.toLocaleString("en-IN")} tickets shared
            </p>
          )}
          <SayItSeeIt onStop={stopAuto} />
          <section className="plan">
            <p className="mono label">If you hire me · my first 90 days</p>
            <h3>Growing Wispr Flow in India</h3>
            <p className="plan-hook">{WISPR_PLAN.hook}</p>
            <ol>
              {WISPR_PLAN.ideas.map((x) => (
                <li key={x.tag}>
                  <span className="mono plan-tag">{x.tag}</span>
                  <h4>{x.title}</h4>
                  <p>{x.what}</p>
                  <div className="plan-metas">
                    <p><span className="mono">Measure</span>{x.measure}</p>
                    <p><span className="mono">Why me</span>{x.proof}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <div className="grant">
            <p className="mono label">The oddly specific $3,000 request</p>
            <h3>{ME.setup.item}</h3>
            <p>{ME.setup.why}</p>
          </div>
          <div className="final">
            <p className="mono label">Next stop</p>
            <h3 className="final-title">Wispr Flow.</h3>
            <p className="final-sub">Growth needs someone who talks to people, ships fast and measures everything. I've done all three, and I built this ride by voice.</p>
            <div className="links">
              {ME.links.video !== "#" && <a className="btn-primary" href={ME.links.video} target="_blank" rel="noopener"><IconPlay />Watch me build it</a>}
              <a className="btn-ghost" href={ME.links.linkedin} target="_blank" rel="noopener"><IconLink />LinkedIn</a>
              <a className="btn-ghost" href={ME.links.email}>Email</a>
              <a className="btn-ghost" href={ME.links.letterboxd} target="_blank" rel="noopener">Letterboxd</a>
            </div>
            <div className="again">
              <button className="linkish" onClick={() => ui.set({ phase: "ride" })}>Keep driving around</button>
              <button className="linkish" onClick={() => location.reload()}>Ride again from Agra</button>
            </div>
          </div>
          <p className="sig">Written with Wispr Flow. Not typed.</p>
        </div>
      </div>
      {!atEnd && <button className="skip mono" onClick={skip}>Skip credits ↓</button>}
    </motion.div>
  );
}
