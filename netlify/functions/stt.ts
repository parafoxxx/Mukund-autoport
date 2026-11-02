// Netlify entry for the same handlers Vercel runs from api/stt.ts
import { GET, POST } from "../../api/stt";

export default (request: Request) => (request.method === "GET" ? GET() : POST(request));
export const config = { path: "/api/stt" };
