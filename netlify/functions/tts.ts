// Netlify entry for the same handler Vercel runs from api/tts.ts
import { POST } from "../../api/tts";

export default (request: Request) => POST(request);
export const config = { path: "/api/tts" };
