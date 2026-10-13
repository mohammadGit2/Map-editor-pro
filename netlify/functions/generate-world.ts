import type { NetlifyFunction } from "@netlify/functions";
import { proceduralProject, type GenerationOptions } from "../../src/generator";
import { json, methodNotAllowed } from "../lib/http";

const handler = async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const url = new URL(request.url);
  const rawSeed = url.searchParams.get("seed") ?? "42";
  if (!/^\d{1,10}$/.test(rawSeed) || Number(rawSeed) > 4294967295)
    return json(
      { error: "Seed must be an integer from 0 to 4294967295." },
      400,
    );
  const name = url.searchParams.get("name")?.trim();
  if (name && name.length > 100)
    return json(
      { error: "World names can contain up to 100 characters." },
      400,
    );
  const options: GenerationOptions = {};
  for (const key of ["width", "height", "continents", "countries"] as const) {
    const value = url.searchParams.get(key);
    if (value !== null) options[key] = Number(value);
  }
  try {
    const project = proceduralProject(Number(rawSeed), options);
    if (name) project.name = name;
    return json(project);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "World generation failed.",
      },
      400,
    );
  }
} satisfies NonNullable<NetlifyFunction["fetch"]>;

export default handler;
