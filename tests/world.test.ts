import { describe, it, expect } from "vitest";
import {
  blankProject,
  polygon,
  area,
  union,
  intersect,
  difference,
  clone,
  validateProject,
  splitGeometry,
} from "../src/model";
import {
  addLand,
  eraseLand,
  strokeGeometry,
  drawTerritory,
  resizeCanvas,
  canvasBounds,
  canvasSettings,
  fitCanvasToContent,
  setRealmParent,
  rulerId,
  descendants,
  uniteRealms,
  dissolveRealm,
} from "../src/world";
import { proceduralProject } from "../src/generator";
const rect = (x: number, y: number, w: number, h: number) =>
  polygon([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
const secondRealm = (w: ReturnType<typeof blankProject>["world"]) => {
  const c = { ...clone(w.countries[0]), id: "second", name: "Second realm" };
  w.countries.push(c);
  return c.id;
};
describe("Freeform custom worlds", () => {
  it("resizes the canvas beyond the former dimensions without scaling artwork", () => {
    const p = blankProject("Custom", { width: 7000, height: 4000, grow: true });
    p.world = addLand(p.world, rect(100, 200, 500, 350));
    const before = clone(p.world.lands);
    p.world = resizeCanvas(p.world, 5000000, 3000000);
    expect(p.world.lands).toEqual(before);
    expect(canvasBounds(p.world)).toEqual([0, 0, 5000000, 3000000]);
    expect(validateProject(p)).toEqual(p);
  });
  it("expands left and above the canvas while preserving geometry coordinates", () => {
    const w = addLand(
      blankProject("Custom", { width: 400, height: 300, grow: true }).world,
      rect(-300, -200, 100, 100),
    );
    expect(canvasSettings(w).x).toBeLessThan(-300);
    expect(canvasSettings(w).y).toBeLessThan(-200);
    expect(w.lands[0].geometry[0][0][0]).toEqual([-300, -200]);
  });
  it("keeps a fixed print canvas when automatic expansion is disabled", () => {
    const w = addLand(
      blankProject("Print", { width: 400, height: 300, grow: false }).world,
      rect(-300, -200, 100, 100),
    );
    expect(canvasBounds(w)).toEqual([0, 0, 400, 300]);
  });
  it("supports a single click and overlapping brush strokes as editable land", () => {
    let w = blankProject().world;
    w = addLand(w, strokeGeometry([[300, 300]], 40), "#ff9900");
    w = addLand(
      w,
      strokeGeometry(
        [
          [300, 300],
          [340, 300],
          [350, 310],
        ],
        40,
      ),
    );
    expect(w.lands.length).toBe(1);
    expect(area(w.lands[0].geometry)).toBeGreaterThan(2000);
    expect(w.lands[0].color).toBe("#ff9900");
  });
  it("carves custom borders from existing territories without gaps or overlaps", () => {
    let w = addLand(blankProject().world, rect(0, 0, 200, 100));
    const first = w.countries[0].id,
      second = secondRealm(w);
    w = drawTerritory(w, rect(0, 0, 200, 100), first);
    w = drawTerritory(w, rect(60, -20, 80, 140), second);
    expect(w.provinces.length).toBe(2);
    expect(
      area(intersect(w.provinces[0].geometry, w.provinces[1].geometry)),
    ).toBeLessThan(0.0001);
    expect(
      area(
        difference(
          union(...w.lands.map((l) => l.geometry)),
          union(...w.provinces.map((p) => p.geometry)),
        ),
      ),
    ).toBeLessThan(0.0001);
    expect(w.provinces.find((p) => p.countryId === second)).toBeDefined();
  });
  it("erases coast and political geometry together while preserving cities", () => {
    let w = addLand(blankProject().world, rect(0, 0, 200, 100));
    w = drawTerritory(w, rect(0, 0, 200, 100), w.countries[0].id);
    w.features.push({
      id: "city",
      name: "Harbor",
      kind: "city",
      points: [[20, 20]],
      layerId: "settlements",
      size: 1,
      color: "#123456",
      rotation: 0,
      notes: "",
      countryId: w.countries[0].id,
    });
    const next = eraseLand(
      w,
      strokeGeometry(
        [
          [100, -10],
          [100, 110],
        ],
        30,
      ),
    );
    expect(area(next.lands[0].geometry)).toBeLessThan(20000);
    expect(next.features).toEqual(w.features);
    expect(
      area(
        difference(
          union(...next.lands.map((l) => l.geometry)),
          union(...next.provinces.map((p) => p.geometry)),
        ),
      ),
    ).toBeLessThan(0.0001);
  });
  it("rejects a brush or border edit against a locked neighbor without changing the world", () => {
    let w = addLand(blankProject().world, rect(0, 0, 200, 100));
    w = drawTerritory(w, rect(0, 0, 200, 100), w.countries[0].id);
    w.layers.find((l) => l.id === "political")!.locked = true;
    const before = clone(w);
    expect(() => eraseLand(w, rect(90, -10, 20, 120))).toThrow(/Unlock/);
    expect(() =>
      drawTerritory(w, rect(90, -10, 20, 120), w.countries[0].id),
    ).toThrow(/Unlock/);
    expect(w).toEqual(before);
  });
  it("fits artwork to a custom canvas without modifying its coordinates", () => {
    const w = addLand(blankProject().world, rect(300, 200, 500, 100)),
      next = fitCanvasToContent(w);
    expect(next.lands).toEqual(w.lands);
    expect(canvasBounds(next)).toEqual([250, 150, 850, 350]);
  });
  it("splits a territory larger than the former dividing-line bounds", () => {
    const g = rect(2000000, 3000000, 5000000, 3000000);
    const [a, b] = splitGeometry(g, [4500000, 2000000], [4500000, 7000000]);
    expect(area(a) + area(b)).toBeCloseTo(area(g), 0);
    expect(area(intersect(a, b))).toBeLessThan(0.001);
  });
  it("round trips custom colors, dimensions, and borders, including historical states", () => {
    const p = blankProject("Custom", {
      width: 12345,
      height: 6789,
      grow: true,
    });
    p.world.appearance = {
      ocean: "#123456",
      land: "#eeeeee",
      borderColor: "#ff0000",
      borderWidth: 4,
      borderPattern: "dotted",
      fillOpacity: 0.8,
    };
    p.world.countries[0].border = {
      color: "#aa3344",
      width: 6,
      pattern: "dashed",
      opacity: 0.7,
    };
    p.snapshots.push({
      id: "old",
      name: "An era",
      year: "1",
      createdAt: Date.now(),
      world: clone(p.world),
    });
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const bad = clone(p);
    bad.world.canvas!.width = 0;
    expect(() => validateProject(bad)).toThrow(/canvas/);
    bad.world.canvas!.width = 100;
    bad.world.appearance!.borderWidth = -1;
    expect(() => validateProject(bad)).toThrow(/width/);
  });
});
describe("Empires and flexible realm hierarchies", () => {
  it("shows empire colors while retaining country-level province ownership", () => {
    let w = addLand(blankProject().world, rect(0, 0, 200, 100));
    const kingdom = w.countries[0].id,
      empire = secondRealm(w);
    w = drawTerritory(w, rect(0, 0, 200, 100), kingdom);
    w = setRealmParent(w, kingdom, empire);
    w.politicalView = "empires";
    expect(rulerId(w, kingdom)).toBe(empire);
    expect(w.provinces[0].countryId).toBe(kingdom);
    expect(descendants(w, empire).has(kingdom)).toBe(true);
  });
  it("prevents hierarchy cycles and safely unites an empire into a descendant", () => {
    const p = blankProject();
    let w = p.world;
    const a = w.countries[0].id,
      b = secondRealm(w);
    w = setRealmParent(w, b, a);
    expect(() => setRealmParent(w, a, b)).toThrow(/descendants/);
    w = uniteRealms(w, a, b);
    p.world = w;
    expect(w.countries.find((c) => c.id === b)!.parentId).toBeNull();
    expect(() => validateProject(p)).not.toThrow();
  });
  it("dissolves an empire without deleting member realms or their provinces", () => {
    let w = addLand(blankProject().world, rect(0, 0, 200, 100));
    const kingdom = w.countries[0].id,
      empire = secondRealm(w);
    w = drawTerritory(w, rect(0, 0, 200, 100), kingdom);
    w = setRealmParent(w, kingdom, empire);
    const next = dissolveRealm(w, empire);
    expect(next.countries.find((c) => c.id === kingdom)!.parentId).toBeNull();
    expect(next.provinces).toEqual(w.provinces);
    expect(next.countries.length).toBe(1);
  });
});
describe("Independent geography generation", () => {
  it("generates different geography for different seeds and respects custom sizes", () => {
    const a = proceduralProject(1, {
        width: 3200,
        height: 1800,
        continents: 4,
        countries: 7,
      }),
      b = proceduralProject(2, {
        width: 3200,
        height: 1800,
        continents: 4,
        countries: 7,
      });
    expect(canvasSettings(a.world).width).toBe(3200);
    expect(a.world.lands.length).toBe(4);
    expect(a.world.countries.length).toBe(7);
    expect(a.world.lands.map((l) => l.geometry)).not.toEqual(
      b.world.lands.map((l) => l.geometry),
    );
    expect(() => validateProject(a)).not.toThrow();
  });
  it("partitions new continents into valid editable regions without gaps", () => {
    for (const seed of [0, 7, 13, 42, 777, 4294967295]) {
      const p = proceduralProject(seed, {
        width: 6400,
        height: 3600,
        continents: 6,
        countries: 12,
      });
      expect(() => validateProject(p)).not.toThrow();
      const land = union(...p.world.lands.map((l) => l.geometry)),
        regions = union(...p.world.provinces.map((pr) => pr.geometry));
      expect(area(difference(land, regions))).toBeLessThan(0.001);
    }
  });
});
