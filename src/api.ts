import { type Project, validateProject } from "./model";
import { sampleProject } from "./sample";

const requestOptions = (): RequestInit => ({
  signal: AbortSignal.timeout(5000),
  headers: { Accept: "application/json" },
});

/** Use Netlify when available, with the same editable generator available offline. */
export async function generateWorld(
  seed: number,
  name: string,
): Promise<{ project: Project; source: "server" | "local" }> {
  try {
    const query = new URLSearchParams({ seed: String(seed), name });
    const response = await fetch(
      `/api/generate-world?${query}`,
      requestOptions(),
    );
    if (!response.ok)
      throw new Error("World generation service is unavailable.");
    const project = validateProject(await response.json());
    return { project, source: "server" };
  } catch {
    const project = sampleProject(seed);
    if (name.trim()) project.name = name.trim();
    return { project, source: "local" };
  }
}

/** Validate locally first. An optional remote check never changes or stores the project. */
export async function checkProject(
  project: Project,
): Promise<"server" | "local"> {
  validateProject(project);
  let response: Response;
  try {
    response = await fetch("/api/validate-project", {
      ...requestOptions(),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(project),
    });
    if (
      !response.headers.get("content-type")?.includes("application/json") ||
      response.status >= 500 ||
      response.status === 404 ||
      response.status === 413
    )
      return "local";
  } catch {
    return "local";
  }
  const result = await response.json();
  if (!response.ok || result.valid !== true)
    throw new Error(result.error || "Server validation rejected this project.");
  return "server";
}
