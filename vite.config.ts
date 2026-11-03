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

/** Dev-only: serves /api/stt and /api/count locally, the same code the Netlify functions run in production. */
let devCounts: unknown = null;
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
        if (route === "/api/count") {
          const { count, memoryStore } = await server.ssrLoadModule("/server/count.ts");
          devCounts ??= memoryStore();
          let event: unknown;
          if (req.method === "POST") {
            const body: Buffer[] = [];
            for await (const c of req) body.push(c as Buffer);
            try { event = JSON.parse(Buffer.concat(body).toString("utf8")).event; } catch { /* no event */ }
          }
          const r = await count(devCounts, event, req.socket.remoteAddress ?? "local");
          res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(r.body));
          return;
        }
        if (req.method !== "POST" || route !== "/api/stt") return next();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const { stt } = await server.ssrLoadModule("/server/stt.ts");
        const raw = Buffer.concat(chunks);
        const r = await stt(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), String(req.headers["content-type"] ?? ""), req.socket.remoteAddress ?? "local");
        res.statusCode = r.status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(r.body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), voiceStudio(), apiRoutes()],
  // scan both pages up front, so opening the studio never invalidates the main page's dependencies
  optimizeDeps: { entries: ["index.html", "studio.html"] },
});
