import { describe, it, expect } from "vitest";
import { FeatureSpatialIndex } from "../src/spatial";
import type { Feature } from "../src/model";
const feature = (
  id: string,
  x: number,
  y: number,
  kind: Feature["kind"] = "forest",
): Feature => ({
  id,
  name: "Woodland",
  kind,
  points: [[x, y]],
  size: 1,
  rotation: 0,
  color: "#514a3c",
  countryId: "",
  layerId: "terrain",
  notes: "",
});
describe("Viewport spatial queries", () => {
  it("culls distant symbols while retaining symbols crossing the viewport edge", () => {
    const index = new FeatureSpatialIndex([
      feature("inside", 50, 50),
      feature("edge", 109, 50),
      feature("outside", 400, 50),
    ]);
    expect([...index.query([0, 0, 100, 100])].sort()).toEqual([
      "edge",
      "inside",
    ]);
  });
  it("includes long paths that cross the viewport when their endpoints are outside it", () => {
    const f = feature("river", -400, 50, "river");
    f.points.push([800, 50]);
    const index = new FeatureSpatialIndex([f]);
    expect(index.query([0, 0, 100, 100]).has("river")).toBe(true);
  });
  it("returns each object once when it spans many index cells", () => {
    const f = feature("image", 200, 200, "image");
    f.asset = { dataUrl: "data:image/png;base64,x", width: 500, height: 500 };
    const index = new FeatureSpatialIndex([f]);
    expect(index.query([0, 0, 400, 400]).size).toBe(1);
  });
});
