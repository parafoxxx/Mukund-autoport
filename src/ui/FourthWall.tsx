import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STOPS } from "../content";
import { sim, ui, useUI, walker } from "../game/store";
import { inHall } from "../game/hall";

/*
 * Breaking the fourth wall: now and then Mukund stops the film and talks straight to whoever is playing,
 * on a sticky note stuck to the screen. Each note is set off by something they actually did, and shows once.
 */
type Ctx = { minutes: number };
type Wall = { id: string; head: string; body: (c: Ctx) => string };

const WALLS: Record<string, Wall> = {
  comeback: { id: "comeback", head: "Breaking character for a second.",
    body: () => "Yes, I put my worst number in my own portfolio. A 7.0 you find on my transcript is a red flag. A 7.0 I show you myself is a comeback story. Same number, different framing. That's most of product, honestly." },
  offroad: { id: "offroad", head: "You've left the road.",
    body: () => "Bold. Recruiters do this with my resume too: skip the boring parts, go straight to the fields. The road's that way. Press R if you'd like a lift back." },
  smash: { id: "smash", head: "That's three smashed.",
    body: () => "A matka is roughly ₹40 at the Agra mandi. I've added ₹120 to your fare. Kidding. But I did do the maths, because I always do the maths." },
  honk: { id: "honk", head: "Five honks in.",
    body: () => "Congratulations, you've passed the Indian driving test. You're now qualified for Bengaluru traffic. Funny, that's exactly where I want to be." },
  idle: { id: "idle", head: "Still there?",
    body: () => "Nothing's moved for a while. No pressure. Go get chai. The auto waits for you, which is more than placement season ever did for me." },
  reverse: { id: "reverse", head: "You're driving backwards.",
    body: () => "Interesting strategy. It worked for my CPI. Less so on a highway." },
  hall: { id: "hall", head: "You made it to the good part.",
    body: () => "This hall is the actual portfolio. Everything outside was context. If you only have two minutes, spend them here: walk up to any deck and it opens." },
  express: { id: "express", head: "Hands-free. Respect.",
    body: () => "You're optimising your time. You'd like my decks: every one of them starts with an executive summary." },
  finish: { id: "finish", head: "You actually finished it.",
    body: ({ minutes }) => `A recruiter spends about 7 seconds on a resume. You just spent ${minutes < 1 ? "under a minute" : `${minutes} minute${minutes === 1 ? "" : "s"}`} on mine. I'm not crying. The auto's exhaust is just very smoky.` },
};

const KEY = "mukund-auto-walls";
const seen: Set<string> = (() => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]") as string[]); } catch { return new Set<string>(); } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch { /* storage blocked */ } };

const COMEBACK = STOPS.findIndex((s) => s.id === "comeback");

export function FourthWall() {
  const [note, setNote] = useState<{ wall: Wall; text: string } | null>(null);
  const queue = useRef<string[]>([]);
  const phase = useUI((s) => s.phase);
  useEffect(() => {
    const want = (id: string) => { if (!seen.has(id) && !queue.current.includes(id)) queue.current.push(id); };
    let lastInput = performance.now(), rideStart = 0, offFor = 0, backFor = 0, inChapterFor = 0, finaleFor = 0, shownAt = 0;
    const honks0 = sim.honks;
    const poke = () => { lastInput = performance.now(); };
    addEventListener("keydown", poke); addEventListener("pointerdown", poke); addEventListener("pointermove", poke);
    const tick = window.setInterval(() => {
      const s = ui.get(), now = performance.now(), dt = 0.5;
      if (s.phase === "intro") return;
      if (!rideStart) rideStart = now;
      // what they did
      offFor = s.offroad ? offFor + dt : 0; if (offFor > 3) want("offroad");
      backFor = !s.onFoot && sim.speed < -2.5 ? backFor + dt : 0; if (backFor > 2.5) want("reverse");
      if (s.smashed >= 3) want("smash");
      if (sim.honks - honks0 >= 5) want("honk");
      if (s.express) want("express");
      if (s.onFoot && inHall(walker.pos)) want("hall");
      inChapterFor = s.active === COMEBACK ? inChapterFor + dt : 0; if (inChapterFor > 6) want("comeback");
      finaleFor = s.phase === "finale" ? finaleFor + dt : 0; if (finaleFor > 5) want("finish");
      if (s.phase === "ride" && s.active === null && now - lastInput > 35000) want("idle");
      // show the next one when the screen is calm (not over the map, a photo, the plan, a first-time tip or another note)
      const busy = s.mapOpen || s.plan !== null || s.embed || s.lightbox || s.badgesOpen || Boolean(document.querySelector(".ftip"));
      setNote((cur) => {
        if (cur && now - shownAt > 16000) { return null; }
        if (cur || busy || !queue.current.length) return cur;
        const id = queue.current.shift()!;
        seen.add(id); save(); shownAt = now;
        const wall = WALLS[id];
        return { wall, text: wall.body({ minutes: Math.round((now - rideStart) / 60000) }) };
      });
    }, 500);
    return () => { window.clearInterval(tick); removeEventListener("keydown", poke); removeEventListener("pointerdown", poke); removeEventListener("pointermove", poke); };
  }, []);
  if (phase === "intro") return null;
  return (
    <AnimatePresence>
      {note && (
        <motion.aside key={note.wall.id} className="wall-note" role="status"
          initial={{ opacity: 0, x: 40, rotate: 6 }} animate={{ opacity: 1, x: 0, rotate: -2.5 }} exit={{ opacity: 0, y: -20, rotate: -8, transition: { duration: 0.25 } }}
          transition={{ type: "spring", stiffness: 200, damping: 17 }}>
          <p className="mono">{note.wall.head}</p>
          <p>{note.text}</p>
          <div className="wn-row">
            <span className="wn-sign">— Mukund</span>
            <button onClick={() => setNote(null)}>Ha. Okay.</button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
