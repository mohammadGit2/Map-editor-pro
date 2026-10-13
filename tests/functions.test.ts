import { describe, it, expect } from "vitest";
import health from "../netlify/functions/health";
import generate from "../netlify/functions/generate-world";
import validate from "../netlify/functions/validate-project";
import { MAX_BODY_BYTES } from "../netlify/lib/http";
import { blankProject, validateProject } from "../src/model";

const post = (body: unknown) =>
  new Request("http://localhost/api/validate-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Netlify HTTP endpoints", () => {
  it("reports health and supports a bodyless HEAD readiness request", async () => {
    const response = await health(new Request("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      application: "Atlas Forge",
      projectVersion: 1,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const head = await health(
      new Request("http://localhost/api/health", { method: "HEAD" }),
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
  it("rejects unsupported methods with the correct Allow header", async () => {
    const requests = [
      health(new Request("http://localhost", { method: "POST" })),
      generate(new Request("http://localhost", { method: "POST" })),
      validate(new Request("http://localhost")),
    ];
    const responses = await Promise.all(requests);
    responses.forEach((response) => expect(response.status).toBe(405));
    expect(responses[2].headers.get("allow")).toBe("POST");
  });
  it("generates a complete, editable, valid world with seeded geography", async () => {
    const a = await (
      await generate(
        new Request(
          "http://localhost/api/generate-world?seed=7&name=Test%20Realm",
        ),
      )
    ).json();
    const b = await (
      await generate(new Request("http://localhost/api/generate-world?seed=7"))
    ).json();
    const project = validateProject(a);
    expect(project.name).toBe("Test Realm");
    expect(project.world.provinces.length).toBeGreaterThan(0);
    expect(project.world.features.length).toBeGreaterThan(0);
    expect(project.world.lands.map((l) => l.geometry)).toEqual(
      b.world.lands.map((l: { geometry: unknown }) => l.geometry),
    );
    expect(project.id).not.toBe(b.id);
  });
  it.each(["-1", "1.5", "4294967296", "NaN", "abc"])(
    "rejects invalid seed %s",
    async (seed) => {
      expect(
        (
          await generate(
            new Request(`http://localhost/api/generate-world?seed=${seed}`),
          )
        ).status,
      ).toBe(400);
    },
  );
  it("rejects excessively long names", async () => {
    expect(
      (
        await generate(
          new Request(
            `http://localhost/api/generate-world?name=${"x".repeat(101)}`,
          ),
        )
      ).status,
    ).toBe(400);
  });
  it("validates a project and returns a summary without echoing private project data", async () => {
    const project = blankProject("Private world");
    const before = JSON.stringify(project);
    const response = await validate(post(project));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({
      valid: true,
      version: 1,
      summary: { countries: 1, provinces: 0, features: 0, snapshots: 0 },
    });
    expect(JSON.stringify(result)).not.toContain("Private world");
    expect(JSON.stringify(project)).toBe(before);
  });
  it("rejects invalid political records and malformed geometry", async () => {
    const project = blankProject();
    project.world.countries[0].parentId = "missing";
    expect((await validate(post(project))).status).toBe(400);
    expect(
      (await validate(post({ version: 1, world: null, snapshots: [] }))).status,
    ).toBe(400);
  });
  it("rejects wrong content type and malformed JSON", async () => {
    const type = await validate(
      new Request("http://localhost", { method: "POST", body: "{}" }),
    );
    expect(type.status).toBe(415);
    const malformed = await validate(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid }",
      }),
    );
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toMatch(/valid UTF-8 JSON/);
  });
  it("limits actual body bytes even when Content-Length is absent", async () => {
    const response = await validate(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: " ".repeat(MAX_BODY_BYTES + 1),
      }),
    );
    expect(response.status).toBe(413);
  });
  it("bounds costly geometry validation before evaluating large boundary rings", async () => {
    const p = blankProject();
    p.world.lands.push({
      id: "large",
      name: "Detailed coastline",
      layerId: "land",
      geometry: [[Array.from({ length: 1025 }, (_, i) => [i, 0])]],
    });
    const response = await validate(post(p));
    expect(response.status).toBe(413);
    expect((await response.json()).error).toMatch(/1,024 points/);
  });
});
