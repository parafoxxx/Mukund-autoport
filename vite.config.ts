import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

/** Dev-only: lets studio.html save Mukund's recordings straight into public/voice/<id>.<ext>. */
function voiceStudio(): Plugin {
  const dir = path.resolve("public/voice");
  return {
    name: "voice-studio",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__studio/save", (req, res) => {
        const url = new URL(req.url ?? "", "http://x");
        const id = url.searchParams.get("id") ?? "";
        const ext = url.searchParams.get("ext") ?? "";
        if (req.method !== "POST" || !/^[a-z0-9-]+$/.test(id) || !["webm", "m4a", "ogg"].includes(ext)) {
          res.statusCode = 400; res.end("bad request"); return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          fs.mkdirSync(dir, { recursive: true });
          // one clip per line: drop any older take in another format so the new one wins
          for (const e of ["mp3", "m4a", "wav", "webm", "ogg"]) fs.rmSync(path.join(dir, `${id}.${e}`), { force: true });
          fs.writeFileSync(path.join(dir, `${id}.${ext}`), Buffer.concat(chunks));
          res.end("ok");
        });
      });
    },
  };
}

/** Dev-only: serves api/chat, api/tts and api/stt locally, the same code Vercel runs in production. */
function apiRoutes(): Plugin {
  return {
    name: "api-routes",
    apply: "serve",
    configureServer(server) {
      // keys live in .env.local (never committed, never sent to the browser)
      Object.assign(process.env, loadEnv("development", process.cwd(), ""));
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split("?")[0];
        if (req.method === "GET" && route === "/api/stt") {
          const { sttConfigured } = await server.ssrLoadModule("/server/stt.ts");
          res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ configured: sttConfigured() }));
          return;
        }
        if (req.method !== "POST" || (route !== "/api/chat" && route !== "/api/tts" && route !== "/api/stt")) return next();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const ip = req.socket.remoteAddress ?? "local";
        if (route === "/api/stt") {
          const { stt } = await server.ssrLoadModule("/server/stt.ts");
          const raw = Buffer.concat(chunks);
          const r = await stt(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), String(req.headers["content-type"] ?? ""), ip);
          res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(r.body));
          return;
        }
        let body: unknown = null;
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { /* handled as empty */ }
        if (route === "/api/chat") {
          const { chat } = await server.ssrLoadModule("/server/chat.ts");
          const r = await chat(body, ip);
          res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(r.body));
        } else {
          const { tts } = await server.ssrLoadModule("/server/tts.ts");
          const r = await tts(body, ip);
          res.statusCode = r.status;
          if (r.audio) { res.setHeader("content-type", "audio/mpeg"); res.end(Buffer.from(r.audio)); }
          else { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: r.error })); }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), voiceStudio(), apiRoutes()],
  // scan both pages up front, so opening the studio never invalidates the main page's dependencies
  optimizeDeps: { entries: ["index.html", "studio.html"] },
});
