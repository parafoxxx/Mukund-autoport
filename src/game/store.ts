import { useSyncExternalStore } from "react";
import * as THREE from "three";
import type { Act } from "../content";

export type Phase = "intro" | "ride" | "finale";

/** UI-facing state. Changes trigger React re-renders, so only coarse values live here. */
type UIState = {
  phase: Phase;
  active: number | null;   // stop whose story card is open
  visited: number[];
  target: number | null;   // autopilot destination
  express: boolean;        // autopilot through every stop in order
  nextStop: number;        // where the arrow points
  distance: number;        // metres to nextStop
  kmh: number;
  km: number;
  muted: boolean;
  heard: string;           // live / last voice transcript
  reply: string;           // what the driver says back
  listening: boolean;
  offroad: boolean;        // been off the tarmac for a while
  coach: "drive" | "follow" | "voice" | "done";
  ready: boolean;          // 3D scene has rendered its first frame
  avatarReady: boolean;    // Mukund's 3D body has loaded
  quip: string;            // what Mukund is saying in his speech bubble
  quipId: number;          // bumps on every new line, so the same line can be said twice
  quipVoice: string;       // id of the recorded clip for this line ("" = babble)
  onFoot: boolean;         // walking around as Mukund (the auto tags along) vs driving it
  thinking: boolean;       // waiting on Mukund's AI reply
  mapOpen: boolean;        // the route map is up
  lightbox: { stop: number; index: number } | null; // a chapter photo open full screen
  embed: string | null;    // a live page (the Meesho prototype) open in a window inside the ride
  boarded: boolean;        // has got into the auto at least once this ride (until then, we nudge)
  voiceStatus: string;     // what the voice-drive mic is up to, or what's wrong with it
  voiceDrive: boolean;     // hands-free: driving by voice commands
  voiceHeard: string;      // the last few words heard in voice-drive mode
  badgesOpen: boolean;     // the achievements panel is up
  badges: string[];        // achievements unlocked
  toast: { title: string; sub: string; n: number }; // latest achievement popup (n bumps each time)
  coins: number;           // coins picked up this ride
  smashed: number;         // matkas, cones and crates sent flying
};

let state: UIState = {
  phase: "intro", active: null, visited: [], target: null, express: false,
  nextStop: 1, distance: 0, kmh: 0, km: 0, muted: false, heard: "", reply: "", listening: false,
  offroad: false, coach: "drive", ready: false, avatarReady: false, quip: "", quipId: 0, quipVoice: "",
  onFoot: true, thinking: false, mapOpen: false, badgesOpen: false, lightbox: null, embed: null, boarded: false, voiceStatus: "", voiceDrive: false, voiceHeard: "",
  badges: [], toast: { title: "", sub: "", n: 0 }, coins: 0, smashed: 0,
};

/** Seconds a chapter holds on its landmark before cutting to Mukund. */
export const ESTABLISH = 3.2;

/** Puts a line in Mukund's speech bubble. */
export function say(line: string, voice = "") { ui.set({ quip: line, quipId: state.quipId + 1, quipVoice: voice }); }
const listeners = new Set<() => void>();

export const ui = {
  get: () => state,
  set(patch: Partial<UIState>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** Select a primitive or stable slice of UI state. */
export function useUI<T>(select: (s: UIState) => T): T {
  return useSyncExternalStore(ui.subscribe, () => select(state));
}

/** Per-frame simulation state. Mutated in render loops, never via React. */
export const sim = {
  pos: new THREE.Vector3(),
  heading: 0,
  speed: 0,           // m/s, negative = reverse
  steer: 0,
  throttle: 0,
  lift: 0,            // vertical bounce from speed breakers
  liftV: 0,
  shake: 0,
  distance: 0,        // total metres driven
  lastStop: 0,        // last stop whose card opened
  cooldown: new Set<number>(), // stops dismissed until the auto leaves their radius
  expressTimer: 0,
  talk: 0,            // 0..1 how hard Mukund is talking right now (voice or speech-bubble babble)
  act: "talk" as Act, // what the avatar is performing, so the camera can frame it
  honks: 0,           // bumps on every horn press, so cows and traffic can react
  airStart: -1,       // seconds in the air on the current jump, -1 when grounded
  vd: { speed: 0, steer: 0, steerT: 0 }, // voice driving: target speed (m/s, <0 reverses) and a timed turn
  cue: { act: "talk" as Act, n: 0 }, // an act requested from outside (AI reply, emote key); n bumps on every request
};

/** Mukund on foot. */
export const walker = {
  pos: new THREE.Vector3(),
  heading: 0,
  speed: 0,
};

/** Whatever the player is controlling right now: Mukund on foot, or the auto. */
export const focus = () => (state.onFoot ? walker.pos : sim.pos);

/** Asks whichever Mukund is on screen to perform an act. */
export function cue(act: Act) { sim.cue = { act, n: sim.cue.n + 1 }; }

/** Where Mukund's speech bubble goes on screen. Written every frame by the avatar, read by the DOM bubble. */
export const bubbleAnchor = { x: 0, y: 0, visible: false };
