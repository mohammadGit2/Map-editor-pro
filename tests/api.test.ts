import { afterEach, describe, it, expect, vi } from "vitest";
import { checkProject, generateWorld } from "../src/api";
import { blankProject } from "../src/model";
import { sampleProject } from "../src/sample";

afterEach(() => vi.unstubAllGlobals());
describe("Optional function integration", () => {
  it("uses a valid server-generated project", async () => {
    const p = sampleProject(7);
    p.name = "Server world";
    const fetch = vi.fn().mockResolvedValue(Response.json(p));
    vi.stubGlobal("fetch", fetch);
    const result = await generateWorld(7, "Server world");
    expect(result.source).toBe("server");
    expect(result.project).toEqual(p);
    expect(fetch.mock.calls[0][0]).toContain("/api/generate-world?seed=7");
  });
  it("generates editable local geography when the endpoint is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const result = await generateWorld(8, "Offline world", {
      width: 7000,
      height: 4000,
      continents: 4,
      countries: 7,
    });
    expect(result.source).toBe("local");
    expect(result.project.name).toBe("Offline world");
    expect(result.project.world.provinces.length).toBeGreaterThan(0);
    expect(result.project.world.canvas).toMatchObject({
      width: 7000,
      height: 4000,
    });
    expect(result.project.world.lands.length).toBe(4);
    expect(result.project.world.countries.length).toBe(7);
  });
  it("does not trust an invalid server project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ version: 900 })),
    );
    expect((await generateWorld(8, "Safe fallback")).source).toBe("local");
  });
  it("reports a successful server validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ valid: true })),
    );
    expect(await checkProject(blankProject())).toBe("server");
  });
  it("retains local validation when Netlify functions are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("SPA document", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    expect(await checkProject(blankProject())).toBe("local");
  });
  it("surfaces remote validation errors instead of treating rejection as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { valid: false, error: "Invalid border" },
            { status: 400 },
          ),
        ),
    );
    await expect(checkProject(blankProject())).rejects.toThrow(
      "Invalid border",
    );
  });
});
