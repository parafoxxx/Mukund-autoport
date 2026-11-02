import { STOPS } from "../content";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecCtor = new () => Rec;

const Ctor: RecCtor | null = (() => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
})();

export const voiceSupported = Boolean(Ctor);

export type Command = { kind: "go"; stop: number } | { kind: "express" } | { kind: "horn" } | { kind: "none" };

/** Turns "Bhaiya, Chill Hai chalo" into a destination. English and Hinglish both work. */
export function parse(text: string): Command {
  const t = ` ${text.toLowerCase().replace(/[.,!?]/g, " ")} `;
  if (/(poora|pura|full|whole|everything|sab|tour|express|ghuma)/.test(t)) return { kind: "express" };
  if (/(horn|pom|beep|honk)/.test(t)) return { kind: "horn" };
  let best = -1, score = 0;
  STOPS.forEach((s, i) => {
    // whole words only: "bhaiya" must not match "ai"
    const sc = s.keywords.reduce((n, k) => n + (t.includes(` ${k} `) ? k.length : 0), 0);
    if (sc > score) { score = sc; best = i; }
  });
  return best >= 0 ? { kind: "go", stop: best } : { kind: "none" };
}

let rec: Rec | null = null;

/** Listens for one phrase. Resolves with the transcript, or "" if nothing was heard. */
export function listenOnce(onPartial: (t: string) => void): Promise<string> {
  return new Promise((resolve) => {
    if (!Ctor) return resolve("");
    rec?.abort();
    const r = new Ctor();
    r.lang = "en-IN"; r.continuous = false; r.interimResults = true;
    let text = "";
    r.onresult = (e) => { text = Array.from(e.results).map((x) => x[0].transcript).join(" "); onPartial(text); };
    r.onerror = () => {};
    r.onend = () => { rec = null; resolve(text.trim()); };
    rec = r;
    try { r.start(); } catch { resolve(""); }
  });
}

export function stopListening() { rec?.stop(); }
