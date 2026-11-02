import { VOICE_LINES } from "./content";

const list = document.getElementById("list")!;
const progress = document.getElementById("progress")!;
const saved = new Set<string>();
let stream: MediaStream | null = null;
let recording: { stop: () => void } | null = null;

const EXTS = ["webm", "m4a", "ogg", "mp3", "wav"];

/** A take already on disk? (the dev server answers missing files with HTML, so check the type) */
async function existing(id: string) {
  for (const ext of EXTS) {
    const r = await fetch(`/voice/${id}.${ext}`, { method: "HEAD", cache: "no-store" });
    if (r.ok && /audio|video\/webm|ogg/.test(r.headers.get("content-type") ?? "")) return `/voice/${id}.${ext}`;
  }
  return null;
}

function updateProgress() {
  progress.textContent = `${saved.size} of ${VOICE_LINES.length} lines recorded`;
}

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}
const extFor = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

for (const v of VOICE_LINES) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div><div class="where"></div><div class="line"></div><div class="status">Not recorded yet</div></div>
    <div class="btns"><button class="rec">Record</button><button class="play" disabled>Play</button></div>`;
  row.querySelector(".where")!.textContent = v.where;
  row.querySelector(".line")!.textContent = `“${v.line}”`;
  list.appendChild(row);

  const status = row.querySelector(".status") as HTMLElement;
  const rec = row.querySelector(".rec") as HTMLButtonElement;
  const play = row.querySelector(".play") as HTMLButtonElement;
  let url: string | null = null;

  const setSaved = (u: string, note: string) => {
    url = u; play.disabled = false; saved.add(v.id); updateProgress();
    status.textContent = note; status.className = "status ok";
  };
  existing(v.id).then((u) => { if (u) setSaved(u, "Recorded ✓ (record again to replace)"); });

  play.onclick = () => { if (url) new Audio(url).play(); };

  rec.onclick = async () => {
    if (recording && rec.classList.contains("on")) { recording.stop(); return; }
    if (recording) return; // another line is recording
    try { stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { status.textContent = "Microphone blocked. Allow it in the address bar and try again."; return; }
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = async () => {
      recording = null; rec.classList.remove("on"); rec.textContent = "Record again";
      const blob = new Blob(chunks, { type: mr.mimeType });
      if (blob.size < 2000) { status.textContent = "That was empty. Try again."; return; }
      status.textContent = "Saving…";
      const ext = extFor(mr.mimeType);
      const r = await fetch(`/__studio/save?id=${v.id}&ext=${ext}`, { method: "POST", body: blob });
      if (r.ok) setSaved(URL.createObjectURL(blob), "Saved ✓ Reload the site to hear him say it.");
      else status.textContent = "Couldn't save. Is the dev server (npm run dev) running?";
    };
    mr.start();
    recording = { stop: () => mr.stop() };
    rec.classList.add("on"); rec.textContent = "■ Stop";
    status.textContent = "Recording… speak now"; status.className = "status";
  };
}
updateProgress();
