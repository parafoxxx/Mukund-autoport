import { STOPS } from "../content";

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
