import type { NetlifyFunction } from "@netlify/functions";
import { version } from "../../package.json";
import { json, methodNotAllowed } from "../lib/http";

const handler = async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD")
    return methodNotAllowed("GET, HEAD");
  const response = json({
    status: "ok",
    application: "Atlas Forge",
    version,
    projectVersion: 1,
  });
  return request.method === "HEAD"
    ? new Response(null, { status: 200, headers: response.headers })
    : response;
} satisfies NonNullable<NetlifyFunction["fetch"]>;

export default handler;
