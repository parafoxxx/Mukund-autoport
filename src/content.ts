/* ============================================================================
   MUKUND'S AUTO: every word and number on the ride lives here.
   Photos: drop files into public/photos/ with the names below. Missing ones show a doodle instead.
   ============================================================================ */

export const ME = {
  name: "Mukund Singhal",
  first: "Mukund",
  plate: "UP 80 · MS 27",
  links: {
    linkedin: "https://linkedin.com/in/mukund-singhal",
    email: "mailto:mukunds23@iitk.ac.in",
    github: "https://github.com/parafoxxx",
    letterboxd: "https://letterboxd.com/mvkndd/",
    video: "#", // your 3-minute build video
  },
  // Your oddly specific $3,000 setup request. TODO: make it yours.
  setup: {
    item: "A projector + a pair of noise-cancelling headphones",
    why: "One for movie nights with the team, one for deep work in a loud office. Both, somehow, make me more productive.",
  },
};

export type Landmark =
  | "taj" | "books" | "gate" | "climb" | "stall" | "office" | "hall" | "society" | "cinema" | "billboard";

/** A case-competition deck: its PDF and first slides live in public/decks/<file>.pdf and <file>-1..4.jpg. */
export type Deck = { file: string; name: string; brief: string; slides: number };

/** Mukund's animated acts (public/avatar/mukund.glb holds the body + backflip; the rest live in avatar/acts/). */
export type Act =
  | "talk" | "pose" | "lounge" | "backflip" | "dance" | "idle" | "land" | "facepalm"
  | "sneak" | "sit" | "march" | "run" | "box" | "pushups" | "conduct";

/** What he does and says on the title screen when you click him (and every so often if you don't). */
export const HERO_ACTS: { act: Act; line: string }[] = [
  { act: "backflip", line: "Resume mein ye skill likhna bhool gaya." },
  { act: "sneak", line: "Shhh. Recruiter dekh raha hai." },
  { act: "facepalm", line: "Abhi bhi type kar rahe ho? Bol do na." },
  { act: "pushups", line: "Interview se pehle thoda warm-up." },
  { act: "conduct", line: "Main bolta hoon, Wispr likhta hai." },
  { act: "land", line: "Superhero landing. Ab to hire karo." },
  { act: "box", line: "Competition? Aane do." },
  { act: "run", line: "Bengaluru? Abhi bhaag ke aata hoon." },
  { act: "pose", line: "Haan ji. Main hi hoon. Mukund." },
  { act: "dance", line: "Hiring ki khushi mein. Advance mein." },
];
export const HERO_GREETING = "Arre, aao! Baitho, chalte hain.";

export type Stop = {
  id: string;
  name: string;          // shown on the LED board and the 3D sign
  landmark: Landmark;
  color: string;         // beacon + card accent
  sticker: string;
  title: string;
  lines: string[];
  stats?: { n: string; l: string }[];
  photo?: string;        // /photos/<file>
  link?: { label: string; url: string; embed?: boolean }; // a button on the chapter card (embed: opens inside the ride)
  walkIn?: boolean;      // a place you can walk into and explore (the chapter card offers it)
  keywords: string[];    // what you can say to the driver to go here
  act: Act;              // what Mukund does when he steps out at this chapter
  then?: Act;            // a follow-up act, straight after the first
  quip: string;          // his one-liner in the speech bubble
};

export const STOPS: Stop[] = [
  {
    id: "agra", name: "Agra", landmark: "taj", color: "#ffcc00", sticker: "🕌",
    title: "Agra. Where it all started.",
    lines: ["Grew up in the city of the Taj.", "Till class 10 I was an average student. Not bad, not great. Very mid."],
    photo: "/photos/agra.jpg", keywords: ["agra", "taj", "home", "ghar", "start", "shuru"],
    act: "pose", quip: "Agra se hoon. Taj Mahal mera padosi hai.",
  },
  {
    id: "jee", name: "JEE Grind", landmark: "books", color: "#00a19a", sticker: "📚",
    title: "Then something switched.",
    lines: ["After class 10 I decided mid wasn't the plan.", "Studied hard for JEE. Books, mocks, repeat."],
    photo: "/photos/jee.jpg", keywords: ["jee", "coaching", "padhai", "study", "books", "kota"],
    act: "box", quip: "JEE vs Mukund. Do saal, har round. Main jeeta.",
  },
  {
    id: "iitk", name: "IIT Kanpur", landmark: "gate", color: "#e53935", sticker: "🎓",
    title: "IIT Kanpur. Ab to ho gaya.",
    lines: ["Cracked JEE, made it to IIT Kanpur.", "Thought the hard part was over. “Chill karte hain ab.”"],
    photo: "/photos/iitk.jpg", keywords: ["iit", "kanpur", "college", "campus", "iitk"],
    act: "lounge", quip: "Ab to ho gaya. Chill karte hain.",
  },
  {
    id: "comeback", name: "The Comeback", landmark: "climb", color: "#7c4dff", sticker: "📈",
    title: "A speed breaker. Then the climb.",
    lines: ["First semester CPI: 7.0. Turns out the hard part was just getting started.", "No shortcuts after that. Back-to-back 9.5s, and the CPI went from 7.0 to 8.0 by the 6th semester."],
    stats: [{ n: "7.0", l: "CPI after sem 1" }, { n: "9.5", l: "SPI, twice in a row" }, { n: "7.0 → 8.0", l: "CPI by sem 6" }],
    keywords: ["speed breaker", "breaker", "cpi", "seven", "climb", "grind", "grades", "9.5", "comeback", "pahad"],
    act: "facepalm", then: "backflip", quip: "CPI 7.0? Reality check. Phir do baar 9.5. Backflip toh banta hai.",
  },
  {
    id: "chillhai", name: "Chill Hai", landmark: "stall", color: "#e4007c", sticker: "🛍️",
    title: "Built a brand. Named it Chill Hai.",
    lines: ["A campus D2C brand from zero: product design, vendors, pricing, fulfilment and Instagram.", "The call: ₹0 on ads. Every sale came from Instagram and word of mouth.", "(Irony noted: nothing about it was chill.)"],
    stats: [{ n: "₹3.75L+", l: "revenue in a year" }, { n: "₹1L+", l: "in month one" }, { n: "₹0", l: "spent on ads" }],
    photo: "/photos/chillhai.jpg", keywords: ["chill hai", "chill", "brand", "business", "startup", "d2c", "store"],
    link: { label: "@chill_hai.official", url: "https://www.instagram.com/chill_hai.official/" },
    act: "pose", quip: "Naam Chill Hai. Kaam 24x7.",
  },
  {
    id: "spo", name: "Placement Office", landmark: "office", color: "#1e88e5", sticker: "🤝",
    title: "Ran placements for my batch.",
    lines: ["Assistant Placement Coordinator at IIT Kanpur.", "A 4-tier team, 75+ companies, and a lot of phone calls."],
    stats: [{ n: "150+", l: "people on my team" }, { n: "1,200+", l: "placement offers" }, { n: "500+", l: "internship offers" }],
    photo: "/photos/spo.jpg", keywords: ["placement", "spo", "office", "team", "coordinator"],
    act: "run", quip: "1,200 offers. Phone kabhi silent pe nahi gaya, main kabhi ruka nahi.",
  },
  {
    id: "arena", name: "Competitions & Hackathons", landmark: "hall", color: "#ffb300", sticker: "🏆",
    title: "Competitions & hackathons.",
    lines: ["Nine case competitions, a national final and a hackathon podium. Every time: a real problem, a deadline, a team, and something shipped. Walk in and look around."],
    stats: [
      { n: "9", l: "case decks" }, { n: "National finalist", l: "Pacto · The Ken × Zerodha 2026" },
      { n: "2nd", l: "Sarvam AI hackathon" }, { n: "Semifinalist", l: "Meesho DICE Season 3" },
    ],
    walkIn: true,
    keywords: ["competition", "competitions", "hackathon", "hackathons", "case", "cases", "deck", "decks", "meesho", "dice", "sarvam", "pacto", "voice", "agent", "trophy", "hall"],
    act: "conduct", then: "dance", quip: "Ye mera trophy room hai. Andar aao, ghoom lo.",
  },
  {
    id: "nobroker", name: "NoBroker", landmark: "society", color: "#ff5252", sticker: "🏠",
    title: "Product intern at NoBroker → PPO.",
    lines: ["Ran the field research for the HomeServices launch in Gurgaon.", "Found that 30–35% of complaints weren't an ops problem, they were a product problem. My work got featured by the co-founder."],
    stats: [{ n: "50+", l: "on-ground field audits" }, { n: "1,663", l: "societies mapped" }, { n: "PPO", l: "pre-placement offer" }],
    photo: "/photos/nobroker.jpg", keywords: ["nobroker", "no broker", "internship", "intern", "ppo", "gurgaon"],
    link: { label: "Read the founder’s post", url: "https://www.linkedin.com/feed/update/urn:li:activity:7502967474498330624/" },
    act: "land", quip: "Zero brokerage. Full hustle. Aur PPO bhi.",
  },
  {
    id: "cinema", name: "Drive-in", landmark: "cinema", color: "#ffd54f", sticker: "🎬",
    title: "Off duty: movies. Lots of movies.",
    lines: ["Favourites: Fight Club, Memories of Murder, Predestination, The Wailing.", "Recently liked Good Will Hunting. Smart kid, a bit notorious, figuring it out. Relatable."],
    photo: "/photos/movies.jpg", keywords: ["movie", "movies", "cinema", "film", "picture", "letterboxd"],
    act: "sit", quip: "Fight Club ka pehla rule? Is portfolio ke baare mein sabko batao.",
  },
  {
    id: "wispr", name: "Wispr Flow", landmark: "billboard", color: "#ff3d00", sticker: "🚀",
    title: "Last stop: Wispr Flow, Bengaluru.",
    lines: ["Growth needs someone who talks to people, ships fast and measures everything.", "I've done all three. And I built this entire ride by voice."],
    stats: [{ n: "November", l: "can start" }, { n: "Full-time", l: "available" }, { n: "Bengaluru", l: "ready to move" }],
    photo: "/photos/mukund.jpg", keywords: ["wispr", "whisper", "bengaluru", "bangalore", "job", "hire", "end", "last"],
    act: "conduct", then: "dance", quip: "Next stop: Wispr Flow. Main ready hoon.",
  },
];

/* ---------- inside Competitions & Hackathons ---------- */

/** The case decks on the hall's back wall. */
export const DECKS: Deck[] = [
  { file: "blinkx", name: "BlinkX · NotifiMaster", brief: "A push-notification strategy for a stock-broking app", slides: 4 },
  { file: "groww", name: "Groww", brief: "Fixing auto-debit management", slides: 4 },
  { file: "swiggy", name: "Swiggy × IIT Kanpur", brief: "Swiggy as the go-to food companion on campus", slides: 4 },
  { file: "bodyshop", name: "The Body Shop India", brief: "A strategic growth plan", slides: 4 },
  { file: "brainalive", name: "BrainAlive AI", brief: "Go-to-market for FOCII", slides: 4 },
  { file: "spotify", name: "Spotify", brief: "Premium conversion in India", slides: 2 },
  { file: "sarcathon", name: "SARCathon 2024 · ConsultQuest", brief: "Quality education in government schools", slides: 4 },
  { file: "prodmad", name: "ProdMad 4.0 · BioMorph", brief: "A product for bio-printed organ transplants", slides: 4 },
  { file: "meesho", name: "Meesho DICE · Semifinal", brief: "The Bharat Trial Network", slides: 4 },
];

export type Exhibit = {
  id: "meesho" | "sarvam" | "pacto";
  name: string; kicker: string; blurb: string;
  facts: { n: string; l: string }[];
  links: { label: string; url: string; embed?: boolean }[];
};

/** The three booths. (Their facts also feed the AI version of Mukund.) */
export const EXHIBITS: Exhibit[] = [
  {
    id: "meesho", name: "Meesho DICE: Pehle Try, Phir Buy", kicker: "Business track · Season 3",
    blurb: "Brands spend ~₹5,400 Cr a year putting samples in Bharat's hands and learn almost nothing back. Our answer, the Bharat Trial Network: a sample in a chosen household's Meesho parcel, and her answer back to the brand. We took it to the semifinal, with a working prototype.",
    facts: [{ n: "~₹5,400 Cr", l: "spent on sampling a year" }, { n: "Semifinalist", l: "Meesho DICE S3" }, { n: "Live", l: "working prototype" }],
    links: [
      { label: "Try the live prototype", url: "https://vaibhav-itauriya.github.io/moshi-moshi-meesho-dice-3.0/", embed: true },
      { label: "Open the deck", url: "/decks/meesho.pdf" },
    ],
  },
  {
    id: "sarvam", name: "Sarvam AI hackathon", kicker: "2nd place",
    blurb: "The brief: build a working AI agent from scratch, against the clock. 45 minutes later, we were on the podium.",
    facts: [{ n: "2nd", l: "place" }, { n: "45 min", l: "to build an agent" }],
    links: [{ label: "Try the agent", url: "https://saravam-hackon-mgnov3vtemdfbm2uwu6vpt.streamlit.app/" }],
  },
  {
    id: "pacto", name: "Pacto", kicker: "National finalist · The Ken × Zerodha 2026",
    blurb: "I led Pacto: a Hinglish voice-and-chat AI agent that keeps you accountable. In an 8-person pilot, regular no-shows turned into near-daily attendance.",
    facts: [{ n: "National finalist", l: "The Ken × Zerodha 2026" }, { n: "18", l: "test cycles on the prompts" }],
    links: [], // add the working link here: { label: "Try Pacto", url: "https://…" }
  },
];

/** Every line Mukund says out loud, with the clip id it's recorded under (public/voice/<id>.webm). */
export const VOICE_LINES: { id: string; where: string; line: string }[] = [
  { id: "hero-greet", where: "Title screen · greeting", line: HERO_GREETING },
  ...HERO_ACTS.map((h, i) => ({ id: `hero-${i}`, where: `Title screen · ${h.act}`, line: h.line })),
  ...STOPS.map((s, i) => ({ id: s.id, where: `Chapter ${String(i + 1).padStart(2, "0")} · ${s.name}`, line: s.quip })),
];
export const VOICE_IDS = VOICE_LINES.map((v) => v.id);


/** "fourteen", for "a road movie in fourteen chapters". */
export const CHAPTER_COUNT_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"][STOPS.length] ?? String(STOPS.length);
