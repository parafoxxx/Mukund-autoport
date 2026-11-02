// Netlify entry for the same handler Vercel runs from api/chat.ts
import { POST } from "../../api/chat";

export default (request: Request) => POST(request);
export const config = { path: "/api/chat" };
