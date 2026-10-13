import type { NetlifyFunction } from "@netlify/functions";
import { validateProject } from "../../src/model";
import {
  checkValidationBudget,
  InputError,
  json,
  methodNotAllowed,
  readJson,
} from "../lib/http";

const handler = async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  try {
    const input = await readJson(request);
    checkValidationBudget(input);
    const project = validateProject(input);
    return json({
      valid: true,
      version: project.version,
      summary: {
        countries: project.world.countries.length,
        provinces: project.world.provinces.length,
        features: project.world.features.length,
        snapshots: project.snapshots.length,
      },
    });
  } catch (error) {
    if (error instanceof InputError)
      return json({ valid: false, error: error.message }, error.status);
    // The shared validator rejects invalid records. Never include input data or stacks.
    return json(
      {
        valid: false,
        error:
          error instanceof TypeError
            ? "The project contains malformed records or geometry."
            : error instanceof Error
              ? error.message
              : "The project could not be validated.",
      },
      400,
    );
  }
} satisfies NonNullable<NetlifyFunction["fetch"]>;

export default handler;
