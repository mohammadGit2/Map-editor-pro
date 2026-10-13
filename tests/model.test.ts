import { describe, it, expect } from "vitest";
import { sampleProject } from "../src/sample";
import {
  area,
  polygon,
  splitGeometry,
  union,
  intersect,
  difference,
  splitProvince,
  mergeProvinces,
  transferProvinces,
  moveSharedVertex,
  insertBoundaryVertex,
  removeBoundaryVertex,
  clone,
  blankProject,
  commit,
  undo,
  redo,
  validateGeometry,
  validateProject,
  pointInside,
  type World,
  type History,
} from "../src/model";

const rect = (x: number, y: number, w: number, h: number) =>
  polygon([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
function adjacent(): World {
  const w = blankProject().world;
  w.lands = [
    { id: "l", name: "Land", layerId: "land", geometry: rect(0, 0, 20, 10) },
  ];
  w.provinces = [
    {
      id: "a",
      name: "West",
      layerId: "political",
      geometry: rect(0, 0, 10, 10),
      countryId: w.countries[0].id,
      claims: [],
      notes: "",
    },
    {
      id: "b",
      name: "East",
      layerId: "political",
      geometry: rect(10, 0, 10, 10),
      countryId: w.countries[0].id,
      claims: [],
      notes: "",
    },
  ];
  return w;
}
describe("Geographic integrity", () => {
  it("generates valid editable coastlines and provinces across varied seeds", () => {
    for (const seed of [
      0,
      1,
      7,
      8,
      42,
      4294967295,
      ...Array.from({ length: 48 }, (_, i) => i * 7919),
    ]) {
      expect(() => validateProject(sampleProject(seed))).not.toThrow();
    }
  });
  it("partitions the sample land without overlap or gaps", () => {
    const w = sampleProject().world;
    const land = union(...w.lands.map((l) => l.geometry)),
      territory = union(...w.provinces.map((p) => p.geometry));
    expect(area(difference(land, territory))).toBeLessThan(0.001);
    expect(area(territory)).toBeCloseTo(area(land), 5);
    expect(w.provinces.every((p) => !validateGeometry(p.geometry))).toBe(true);
    for (let i = 0; i < w.provinces.length; i++)
      for (let j = i + 1; j < w.provinces.length; j++)
        expect(
          area(intersect(w.provinces[i].geometry, w.provinces[j].geometry)),
        ).toBeLessThan(0.001);
  });
  it("splits a concave province without losing area", () => {
    const g = polygon([
      [0, 0],
      [10, 0],
      [10, 3],
      [3, 3],
      [3, 10],
      [0, 10],
    ]);
    const [a, b] = splitGeometry(g, [-1, 1], [9, 9]);
    expect(area(a) + area(b)).toBeCloseTo(area(g), 5);
    expect(area(intersect(a, b))).toBeLessThan(0.001);
  });
  it("preserves polygon holes during split and union", () => {
    const g = difference(rect(0, 0, 20, 20), rect(7, 7, 6, 6));
    const [a, b] = splitGeometry(g, [10, -5], [10, 25]);
    expect(area(union(a, b))).toBeCloseTo(364, 5);
    expect(pointInside([10, 10], union(a, b))).toBe(false);
  });
  it("rejects a line outside a territory and leaves the source intact", () => {
    const w = adjacent(),
      before = clone(w);
    expect(() => splitProvince(w, "a", [15, -1], [15, 20])).toThrow(
      /pass through/,
    );
    expect(w).toEqual(before);
  });
  it("splits and merges while preserving ownership and total area", () => {
    const w = adjacent();
    const split = splitProvince(w, "a", [5, -1], [5, 20]);
    expect(split.provinces.length).toBe(3);
    const ids = split.provinces.filter((p) => p.id !== "b").map((p) => p.id),
      merged = mergeProvinces(split, ids);
    expect(merged.provinces.length).toBe(2);
    expect(area(merged.provinces.at(-1)!.geometry)).toBeCloseTo(100);
    expect(w.provinces.length).toBe(2);
  });
  it("moves a shared vertex consistently without opening a gap", () => {
    const w = adjacent();
    const next = moveSharedVertex(w, "a", [10, 0], [11, 0]);
    expect(
      area(intersect(next.provinces[0].geometry, next.provinces[1].geometry)),
    ).toBeLessThan(0.001);
    expect(area(union(...next.provinces.map((p) => p.geometry)))).toBeCloseTo(
      200,
    );
    expect(
      next.provinces.every((p) =>
        p.geometry.flat(2).some((pt) => pt[0] === 11 && pt[1] === 0),
      ),
    ).toBe(true);
  });
  it("refuses a shared border move when a neighboring layer is locked", () => {
    const w = adjacent();
    w.layers.push({
      id: "protected",
      name: "Protected provinces",
      visible: true,
      locked: true,
      opacity: 1,
    });
    w.provinces[1].layerId = "protected";
    expect(() => moveSharedVertex(w, "a", [10, 0], [11, 0])).toThrow(/locked/);
  });
  it("inserts and removes a vertex in both sides of a shared border", () => {
    const original = adjacent(),
      inserted = insertBoundaryVertex(original, [10, 5]);
    expect(
      inserted.provinces.every((p) =>
        p.geometry.flat(2).some((v) => v[0] === 10 && v[1] === 5),
      ),
    ).toBe(true);
    expect(removeBoundaryVertex(inserted, [10, 5])).toEqual(original);
  });
  it("propagates a coastal junction movement into the land boundary", () => {
    const moved = moveSharedVertex(adjacent(), "a", [10, 0], [11, -2]);
    expect(
      area(
        difference(
          union(...moved.lands.map((l) => l.geometry)),
          union(...moved.provinces.map((p) => p.geometry)),
        ),
      ),
    ).toBeLessThan(0.001);
  });
  it("rejects vertex removal that would open a territorial gap", () => {
    const w = adjacent(),
      before = clone(w);
    expect(() => removeBoundaryVertex(w, [10, 0])).toThrow(/gap/);
    expect(w).toEqual(before);
  });
  it("rejects self-intersecting boundaries", () =>
    expect(
      validateGeometry(
        polygon([
          [0, 0],
          [10, 10],
          [0, 10],
          [10, 0],
        ]),
      ),
    ).toMatch(/crosses itself/));
});
describe("Political records and project history", () => {
  it("transfers ownership without mutating geometry or duplicating settlements", () => {
    const w = sampleProject().world,
      before = clone(w);
    const p = w.provinces[0],
      owner = w.countries[1].id;
    const next = transferProvinces(w, [p.id], owner);
    expect(next.provinces[0].countryId).toBe(owner);
    expect(next.provinces[0].geometry).toEqual(p.geometry);
    expect(next.features.map((f) => f.id)).toEqual(w.features.map((f) => f.id));
    expect(w).toEqual(before);
    next.features
      .filter((f) => pointInside(f.points[0], p.geometry))
      .forEach((f) => expect(f.countryId).toBe(owner));
  });
  it("undoes and redoes a territory transfer with all project data intact", () => {
    const p = sampleProject(),
      h: History = { current: p, past: [], future: [], entries: [] };
    const next = {
      ...p,
      world: transferProvinces(
        p.world,
        [p.world.provinces[0].id],
        p.world.countries[1].id,
      ),
    };
    const committed = commit(h, next, "Transfer");
    expect(undo(committed).current).toEqual(p);
    expect(redo(undo(committed)).current).toEqual(committed.current);
  });
  it("round trips a complete project including independent historical snapshots", () => {
    const p = sampleProject();
    p.snapshots.push({
      id: "era1",
      name: "Ancient era",
      year: "300",
      createdAt: Date.now(),
      world: clone(p.world),
    });
    p.world.provinces[0].countryId = p.world.countries[1].id;
    expect(p.snapshots[0].world.provinces[0].countryId).not.toBe(
      p.world.provinces[0].countryId,
    );
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("rejects imports with missing ownership and duplicate identifiers", () => {
    const p = sampleProject();
    p.world.provinces[0].countryId = "missing";
    expect(() => validateProject(p)).toThrow(/missing country/);
    const q = sampleProject();
    q.world.features[0].id = q.world.provinces[0].id;
    expect(() => validateProject(q)).toThrow(/unique/);
  });
  it("rejects imports with malformed features before replacing a world", () => {
    const p = sampleProject();
    p.world.features[0].points = [[NaN, 4]];
    expect(() => validateProject(p)).toThrow(/Invalid map feature/);
  });
  it("branches history safely and limits retained undo states to 100", () => {
    let h: History = {
      current: blankProject(),
      past: [],
      future: [],
      entries: [],
    };
    for (let i = 0; i < 130; i++)
      h = commit(h, { ...h.current, name: `World ${i}` }, "Rename");
    expect(h.past.length).toBe(100);
    h = undo(h);
    h = commit(h, { ...h.current, name: "Branch" }, "Branch");
    expect(h.future.length).toBe(0);
  });
});
