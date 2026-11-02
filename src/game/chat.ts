import type { Act } from "../content";
import { cue, say, ui } from "./store";
import { addVoice, playVoice } from "./sound";
import { unlock } from "./achievements";
import { GUEST } from "./guest";

/** The last few exchanges, so he can follow up ("aur batao?"). */
const history: { role: "user" | "assistant"; text: string }[] = [];
let turn = 0;

/** Sends what the visitor said to Mukund's AI, then he acts it out and says the answer. */
export async function askMukund(text: string) {
  const mine = ++turn;
  ui.set({ thinking: true });
  cue("talk");
  let reply = "", act: Act = "talk";
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(-8), guest: GUEST }),
    });
    const data = await r.json().catch(() => ({}));
    reply = typeof data.reply === "string" ? data.reply : "";
    if (typeof data.act === "string") act = data.act as Act;
  } catch { /* offline: handled below */ }
  if (mine !== turn) return; // a newer question overtook this one
  if (!reply) {
    ui.set({ thinking: false });
    cue("facepalm");
    say("Network ne dhoka de diya. Ek baar aur bolo?");
    return;
  }
  history.push({ role: "user", text }, { role: "assistant", text: reply });
  unlock("talk");
  const voiced = await voice(reply, mine);
  if (mine !== turn) return;
  ui.set({ thinking: false });
  cue(act);
  if (voiced) { say(reply, voiced); playVoice(voiced); }
  else { say(reply, "tts"); speakInBrowser(reply); }
}

/** His cloned voice, if the site has one set up. Returns the clip id, or "" to fall back. */
async function voice(text: string, n: number): Promise<string> {
  try {
    const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("audio")) return "";
    const id = `ai-${n}`;
    return (await addVoice(id, URL.createObjectURL(await r.blob()))) ? id : "";
  } catch {
    return "";
  }
}

/** No cloned voice configured: the browser reads it out, with an Indian-English voice if there is one. */
function speakInBrowser(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-IN" && /male|ravi|prabhat/i.test(v.name))
    ?? voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang.startsWith("hi")) ?? null;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}
