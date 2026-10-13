export function json(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function methodNotAllowed(allowed: string): Response {
  return json({ error: `Use ${allowed} for this endpoint.` }, 405, {
    Allow: allowed,
  });
}

export class InputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new InputError("Send the project as application/json.", 415);
  }
  const size = request.headers.get("content-length");
  if (size && Number(size) > MAX_BODY_BYTES)
    throw new InputError(
      "Online validation accepts projects up to 2 MB. Larger projects can be validated locally.",
      413,
    );
  if (!request.body) throw new InputError("A project JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new InputError(
          "Online validation accepts projects up to 2 MB. Larger projects can be validated locally.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(combined),
    );
  } catch {
    throw new InputError("The request body is not valid UTF-8 JSON.");
  }
}

/** Bound synchronous geometry work before calling the shared project validator. */
export function checkValidationBudget(input: unknown): void {
  if (!input || typeof input !== "object" || !("world" in input))
    throw new InputError("A complete Atlas Forge project is required.");
  const p = input as Record<string, unknown>;
  if (!Array.isArray(p.snapshots))
    throw new InputError("Project snapshots must be an array.");
  if (p.snapshots.length > 10)
    throw new InputError(
      "Online validation accepts up to 10 historical snapshots. Validate larger histories locally.",
      413,
    );
  const worlds = [
    p.world,
    ...p.snapshots.map((s) => (s as Record<string, unknown>)?.world),
  ];
  let objects = 0,
    vertices = 0;
  for (const world of worlds) {
    if (!world || typeof world !== "object")
      throw new InputError("Invalid world data.");
    const w = world as Record<string, unknown>;
    for (const key of [
      "lands",
      "provinces",
      "countries",
      "features",
      "layers",
      "views",
    ]) {
      const records = w[key];
      if (!Array.isArray(records))
        throw new InputError(`Project is missing ${key}.`);
      objects += records.length;
      if (objects > 10000)
        throw new InputError(
          "Online validation accepts up to 10,000 records, including snapshots. Validate larger worlds locally.",
          413,
        );
      for (const record of records) {
        if (!record || typeof record !== "object")
          throw new InputError("Project records must be objects.");
        if (key === "lands" || key === "provinces") {
          if (!Array.isArray(record.geometry))
            throw new InputError(
              "Geographic geometry must be an array of polygons.",
            );
          for (const polygon of record.geometry) {
            if (!Array.isArray(polygon))
              throw new InputError("Invalid polygon data.");
            for (const ring of polygon) {
              if (!Array.isArray(ring))
                throw new InputError("Invalid boundary data.");
              vertices += ring.length;
              if (ring.length > 1024)
                throw new InputError(
                  "Online validation accepts up to 1,024 points per boundary. Validate more detailed coastlines locally.",
                  413,
                );
            }
          }
        }
        if (key === "features" && Array.isArray(record.points)) {
          vertices += record.points.length;
          if (record.kind === "biome" && record.points.length > 1024)
            throw new InputError(
              "Online validation accepts up to 1,024 points per biome. Validate more detailed biomes locally.",
              413,
            );
        }
        if (vertices > 25000)
          throw new InputError(
            "Online validation accepts up to 25,000 geometry points, including snapshots. Validate larger worlds locally.",
            413,
          );
      }
    }
  }
}
