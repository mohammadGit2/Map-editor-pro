import polygonClipping from "polygon-clipping";

export type Point = [number, number];
export type Geometry = Point[][][];
export type Tool =
  | "select"
  | "pan"
  | "land"
  | "territory"
  | "split"
  | "vertex"
  | "river"
  | "road"
  | "mountain"
  | "forest"
  | "city"
  | "castle"
  | "label"
  | "erase"
  | "rectangle"
  | "ellipse"
  | "biome";
export type Style =
  | "atlas"
  | "political"
  | "parchment"
  | "midnight"
  | "blueprint";
export type FeatureKind =
  | "river"
  | "road"
  | "mountain"
  | "forest"
  | "city"
  | "castle"
  | "label"
  | "image"
  | "biome";
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}
export interface Land {
  id: string;
  name: string;
  geometry: Geometry;
  layerId: string;
}
export interface Country {
  id: string;
  name: string;
  color: string;
  government: string;
  ruler: string;
  capital: string;
  description: string;
  parentId: string | null;
  labelPosition?: Point;
}
export interface Province {
  id: string;
  name: string;
  geometry: Geometry;
  countryId: string;
  layerId: string;
  claims: string[];
  notes: string;
}
export interface Feature {
  id: string;
  name: string;
  kind: FeatureKind;
  points: Point[];
  layerId: string;
  size: number;
  color: string;
  rotation: number;
  notes: string;
  countryId: string;
  population?: number;
  font?: string;
  outline?: boolean;
  asset?: { dataUrl: string; width: number; height: number };
  biome?: string;
}
export interface MapView {
  id: string;
  name: string;
  parentId: string | null;
  bounds: [number, number, number, number];
}
export interface World {
  lands: Land[];
  provinces: Province[];
  countries: Country[];
  features: Feature[];
  layers: Layer[];
  views: MapView[];
  style: Style;
  grid: boolean;
  decorations: boolean;
  snap?: boolean;
}
export interface Snapshot {
  id: string;
  name: string;
  year: string;
  createdAt: number;
  world: World;
}
export interface Project {
  version: 1;
  id: string;
  name: string;
  updatedAt: number;
  world: World;
  snapshots: Snapshot[];
}
export type Selected = { type: "province" | "land" | "feature"; id: string };
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => structuredClone(value);
export const palette = [
  "#b9be93",
  "#cea99b",
  "#d9c796",
  "#a5bba7",
  "#b6aac1",
  "#a1bec6",
  "#ceaf7d",
  "#9eb3a5",
];
export const layerIds = {
  land: "land",
  political: "political",
  terrain: "terrain",
  waterways: "waterways",
  routes: "routes",
  settlements: "settlements",
  labels: "labels",
};
export const defaultLayers = (): Layer[] =>
  [
    ["labels", "Labels & annotations"],
    ["settlements", "Cities & landmarks"],
    ["routes", "Roads & trade routes"],
    ["waterways", "Rivers & lakes"],
    ["terrain", "Mountains & forests"],
    ["political", "Countries & provinces"],
    ["land", "Land & coastlines"],
  ].map(([id, name]) => ({
    id,
    name,
    visible: true,
    locked: false,
    opacity: 1,
  }));

export function ring(points: Point[]): Point[] {
  const out = points.map((p) => [p[0], p[1]] as Point);
  if (
    out.length &&
    (out[0][0] !== out.at(-1)![0] || out[0][1] !== out.at(-1)![1])
  )
    out.push([...out[0]]);
  return out;
}
export const polygon = (points: Point[]): Geometry => [[ring(points)]];
export function area(geometry: Geometry): number {
  const signed = (r: Point[]) =>
    Math.abs(
      r.reduce((n, p, i) => {
        const q = r[(i + 1) % r.length];
        return n + p[0] * q[1] - q[0] * p[1];
      }, 0) / 2,
    );
  return geometry.reduce(
    (n, poly) =>
      n + signed(poly[0]) - poly.slice(1).reduce((s, r) => s + signed(r), 0),
    0,
  );
}
export function pointInside(p: Point, geometry: Geometry): boolean {
  const inRing = (r: Point[]) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    return inside;
  };
  return geometry.some(
    (poly) => inRing(poly[0]) && !poly.slice(1).some(inRing),
  );
}
export function bounds(g: Geometry): [number, number, number, number] {
  const points = g.flat(2);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
export function center(g: Geometry): Point {
  // A polygon's centroid may lie in an ocean bay. Prefer a point in the largest component.
  const poly = [...g].sort((a, b) => area([b]) - area([a]))[0];
  if (!poly) return [0, 0];
  const b = bounds([poly]);
  const c: Point = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  if (pointInside(c, [poly])) return c;
  for (let y = 1; y < 10; y++)
    for (let x = 1; x < 10; x++) {
      const p: Point = [
        b[0] + ((b[2] - b[0]) * x) / 10,
        b[1] + ((b[3] - b[1]) * y) / 10,
      ];
      if (pointInside(p, [poly])) return p;
    }
  return poly[0][0];
}
export function geometryPath(g: Geometry): string {
  return g
    .map((poly) =>
      poly
        .map(
          (r) =>
            `M${r.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("L")}Z`,
        )
        .join(""),
    )
    .join("");
}
export function smoothRing(points: Point[], iterations = 1): Point[] {
  let r = points.slice(0, -1);
  for (let k = 0; k < iterations; k++) {
    const out: Point[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    r = out;
  }
  return ring(r);
}
function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
export function validateGeometry(g: Geometry): string | null {
  if (!g.length) return "The territory has no geographic area.";
  for (const poly of g)
    for (const r of poly) {
      if (
        r.length < 4 ||
        r.some(
          (p) =>
            p.length !== 2 ||
            p.some((n) => !Number.isFinite(n) || Math.abs(n) > 1000000),
        )
      )
        return "A polygon needs at least three valid points.";
      if (r[0][0] !== r.at(-1)![0] || r[0][1] !== r.at(-1)![1])
        return "The polygon is not closed.";
      for (let i = 0; i < r.length - 1; i++)
        for (let j = i + 2; j < r.length - 1; j++) {
          if (i === 0 && j === r.length - 2) continue;
          const a = r[i],
            b = r[i + 1],
            c = r[j],
            d = r[j + 1];
          if (
            cross(a, b, c) * cross(a, b, d) < -1e-8 &&
            cross(c, d, a) * cross(c, d, b) < -1e-8
          )
            return "The boundary crosses itself. Move the crossing points before continuing.";
        }
    }
  return area(g) < 0.05 ? "The territory is too small to create." : null;
}
export const intersect = (a: Geometry, b: Geometry): Geometry =>
  polygonClipping.intersection(a, b) as Geometry;
export const difference = (a: Geometry, b: Geometry): Geometry =>
  polygonClipping.difference(a, b) as Geometry;
export const union = (...g: Geometry[]): Geometry =>
  g.length ? (polygonClipping.union(g[0], ...g.slice(1)) as Geometry) : [];
export function splitGeometry(
  g: Geometry,
  a: Point,
  b: Point,
): [Geometry, Geometry] {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy);
  if (len < 1)
    throw new Error("Choose two distinct points for the dividing line.");
  const u: Point = [(dx / len) * 100000, (dy / len) * 100000],
    v: Point = [(-dy / len) * 100000, (dx / len) * 100000];
  const p: Point = [a[0] - u[0], a[1] - u[1]],
    q: Point = [a[0] + u[0], a[1] + u[1]];
  const half = (s: number) =>
    polygon([
      p,
      q,
      [q[0] + v[0] * s, q[1] + v[1] * s],
      [p[0] + v[0] * s, p[1] + v[1] * s],
    ]);
  const result: [Geometry, Geometry] = [
    intersect(g, half(1)),
    intersect(g, half(-1)),
  ];
  if (result.some((x) => area(x) < 1))
    throw new Error(
      "The dividing line must pass through the selected territory.",
    );
  return result;
}
export function splitProvince(
  world: World,
  id: string,
  a: Point,
  b: Point,
): World {
  const source = world.provinces.find((p) => p.id === id);
  if (!source) throw new Error("Select a province to split.");
  const halves = splitGeometry(source.geometry, a, b);
  const out = clone(world);
  out.provinces = out.provinces
    .filter((p) => p.id !== id)
    .concat(
      halves.map((g, i) => ({
        ...clone(source),
        id: uid(),
        name: `${source.name} ${i ? "South" : "North"}`,
        geometry: g,
      })),
    );
  return out;
}
export function mergeProvinces(world: World, ids: string[]): World {
  const selected = ids
    .map((id) => world.provinces.find((p) => p.id === id))
    .filter((p): p is Province => !!p);
  if (selected.length < 2)
    throw new Error("Select at least two provinces with Shift-click.");
  const geometry = union(...selected.map((p) => p.geometry));
  const error = validateGeometry(geometry);
  if (error) throw new Error(error);
  const out = clone(world);
  out.provinces = out.provinces
    .filter((p) => !ids.includes(p.id))
    .concat({
      ...selected[0],
      id: uid(),
      name: `${selected[0].name} Union`,
      geometry,
      claims: [...new Set(selected.flatMap((p) => p.claims))],
    });
  out.features.forEach((f) => {
    if (pointInside(f.points[0], geometry)) f.countryId = selected[0].countryId;
  });
  return out;
}
function assertTopology(before: World, after: World) {
  for (const obj of [...after.lands, ...after.provinces]) {
    const error = validateGeometry(obj.geometry);
    if (error) throw new Error(error);
  }
  for (let i = 0; i < after.provinces.length; i++)
    for (let j = i + 1; j < after.provinces.length; j++)
      if (
        area(
          intersect(after.provinces[i].geometry, after.provinces[j].geometry),
        ) > 0.05
      )
        throw new Error(
          "This edit would overlap another province. The original boundary is preserved.",
        );
  if (after.lands.length && after.provinces.length) {
    const gap = (w: World) =>
      area(
        difference(
          union(...w.lands.map((l) => l.geometry)),
          union(...w.provinces.map((p) => p.geometry)),
        ),
      );
    if (gap(after) > gap(before) + 0.05)
      throw new Error(
        "This edit would open a gap between shared borders. The original boundary is preserved.",
      );
  }
}
export function insertBoundaryVertex(world: World, point: Point): World {
  const out = clone(world);
  let inserted = false;
  for (const obj of [...out.lands, ...out.provinces])
    for (const poly of obj.geometry)
      for (const r of poly)
        for (let i = 0; i < r.length - 1; i++) {
          const a = r[i],
            b = r[i + 1],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (
            length < 0.01 ||
            Math.hypot(a[0] - point[0], a[1] - point[1]) < 0.01 ||
            Math.hypot(b[0] - point[0], b[1] - point[1]) < 0.01
          )
            continue;
          const d = Math.abs(cross(a, b, point)) / length,
            t =
              ((point[0] - a[0]) * (b[0] - a[0]) +
                (point[1] - a[1]) * (b[1] - a[1])) /
              (length * length);
          if (d < 0.001 && t > 0 && t < 1) {
            if (out.layers.find((l) => l.id === obj.layerId)?.locked)
              throw new Error(
                "Unlock all layers sharing this boundary before inserting a vertex.",
              );
            r.splice(i + 1, 0, [...point]);
            i++;
            inserted = true;
          }
        }
  if (!inserted)
    throw new Error(
      "Choose a point on the boundary, away from existing vertices.",
    );
  assertTopology(world, out);
  return out;
}
export function removeBoundaryVertex(world: World, point: Point): World {
  const out = clone(world);
  let removed = false;
  for (const obj of [...out.lands, ...out.provinces])
    for (const poly of obj.geometry)
      for (let j = 0; j < poly.length; j++) {
        const open = poly[j].slice(0, -1),
          remaining = open.filter(
            (v) => Math.hypot(v[0] - point[0], v[1] - point[1]) >= 0.01,
          );
        if (remaining.length !== open.length) {
          if (out.layers.find((l) => l.id === obj.layerId)?.locked)
            throw new Error(
              "Unlock all layers sharing this boundary before removing a vertex.",
            );
          if (remaining.length < 3)
            throw new Error("A boundary needs at least three vertices.");
          poly[j] = ring(remaining);
          removed = true;
        }
      }
  if (!removed) throw new Error("No matching boundary vertex was found.");
  assertTopology(world, out);
  return out;
}
export function transferProvinces(
  world: World,
  ids: string[],
  countryId: string,
): World {
  if (!world.countries.some((c) => c.id === countryId))
    throw new Error("Choose an existing country.");
  const out = clone(world);
  out.provinces.forEach((p) => {
    if (ids.includes(p.id)) p.countryId = countryId;
  });
  const changed = out.provinces.filter((p) => ids.includes(p.id));
  out.features.forEach((f) => {
    if (changed.some((p) => pointInside(f.points[0], p.geometry)))
      f.countryId = countryId;
  });
  return out;
}
export function moveSharedVertex(
  world: World,
  provinceId: string,
  from: Point,
  to: Point,
): World {
  const out = clone(world);
  const province = out.provinces.find((p) => p.id === provinceId);
  if (!province) return out;
  const locked = new Set(out.layers.filter((l) => l.locked).map((l) => l.id));
  // Insert the vertex into any boundary segment that shares it, including T-junctions
  // and coastline segments. This keeps land and province coverage synchronized.
  for (const obj of [...out.lands, ...out.provinces])
    for (const poly of obj.geometry)
      for (const r of poly) {
        for (let i = 0; i < r.length - 1; i++) {
          const a = r[i],
            b = r[i + 1],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (
            length < 0.01 ||
            Math.hypot(a[0] - from[0], a[1] - from[1]) < 0.01 ||
            Math.hypot(b[0] - from[0], b[1] - from[1]) < 0.01
          )
            continue;
          const distance = Math.abs(cross(a, b, from)) / length;
          const projection =
            ((from[0] - a[0]) * (b[0] - a[0]) +
              (from[1] - a[1]) * (b[1] - a[1])) /
            (length * length);
          if (distance < 0.001 && projection > 0 && projection < 1) {
            r.splice(i + 1, 0, [...from]);
            i++;
          }
        }
      }
  for (const p of out.provinces)
    for (const poly of p.geometry)
      for (const r of poly)
        for (const v of r) {
          if (Math.hypot(v[0] - from[0], v[1] - from[1]) < 0.01) {
            if (locked.has(p.layerId))
              throw new Error(
                "A neighboring territory is locked. Unlock its layer to edit this shared border.",
              );
            v[0] = to[0];
            v[1] = to[1];
          }
        }
  // Coastline vertices remain shared with the underlying landmass.
  for (const land of out.lands)
    for (const poly of land.geometry)
      for (const r of poly)
        for (const v of r) {
          if (Math.hypot(v[0] - from[0], v[1] - from[1]) < 0.01) {
            if (locked.has(land.layerId))
              throw new Error(
                "Unlock the coastline layer before moving a coastal vertex.",
              );
            v[0] = to[0];
            v[1] = to[1];
          }
        }
  for (const p of out.provinces) {
    const error = validateGeometry(p.geometry);
    if (error) throw new Error(error);
  }
  for (let i = 0; i < out.provinces.length; i++)
    for (let j = i + 1; j < out.provinces.length; j++) {
      if (
        area(intersect(out.provinces[i].geometry, out.provinces[j].geometry)) >
        0.05
      )
        throw new Error(
          "This movement would overlap another province. The original border is preserved.",
        );
    }
  assertTopology(world, out);
  return out;
}
export function blankProject(name = "Untitled world"): Project {
  return {
    version: 1,
    id: uid(),
    name,
    updatedAt: Date.now(),
    world: {
      lands: [],
      provinces: [],
      countries: [
        {
          id: uid(),
          name: "New kingdom",
          color: palette[0],
          government: "Kingdom",
          ruler: "",
          capital: "",
          description: "",
          parentId: null,
        },
      ],
      features: [],
      layers: defaultLayers(),
      views: [
        {
          id: "world",
          name: "World map",
          parentId: null,
          bounds: [0, 0, 1200, 820],
        },
      ],
      style: "atlas",
      grid: false,
      decorations: true,
    },
    snapshots: [],
  };
}
export interface History {
  current: Project;
  past: Project[];
  future: Project[];
  entries: string[];
}
export function commit(h: History, project: Project, label: string): History {
  return {
    current: { ...project, updatedAt: Date.now() },
    past: [...h.past.slice(-99), h.current],
    future: [],
    entries: [...h.entries.slice(-99), label],
  };
}
export function undo(h: History): History {
  return h.past.length
    ? {
        current: h.past.at(-1)!,
        past: h.past.slice(0, -1),
        future: [h.current, ...h.future],
        entries: h.entries.slice(0, -1),
      }
    : h;
}
export function redo(h: History): History {
  return h.future.length
    ? {
        current: h.future[0],
        past: [...h.past, h.current],
        future: h.future.slice(1),
        entries: [...h.entries, "Restored edit"],
      }
    : h;
}

export function validateProject(input: unknown): Project {
  const p = input as Project;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    typeof p.id !== "string" ||
    !p.world ||
    !Array.isArray(p.snapshots)
  )
    throw new Error("This is not a supported Atlas Forge project (version 1).");
  const validateWorld = (w: World) => {
    for (const key of [
      "lands",
      "provinces",
      "countries",
      "features",
      "layers",
      "views",
    ] as const)
      if (!Array.isArray(w[key])) throw new Error(`Project is missing ${key}.`);
    const all = [
      ...w.lands,
      ...w.provinces,
      ...w.countries,
      ...w.features,
      ...w.layers,
      ...w.views,
    ];
    const ids = new Set<string>();
    for (const obj of all) {
      if (
        typeof obj.id !== "string" ||
        ids.has(obj.id) ||
        typeof obj.name !== "string"
      )
        throw new Error("Object names and unique identifiers are required.");
      ids.add(obj.id);
    }
    if (
      !["atlas", "political", "parchment", "midnight", "blueprint"].includes(
        w.style,
      )
    )
      throw new Error("Unsupported map style.");
    for (const l of w.layers)
      if (
        typeof l.visible !== "boolean" ||
        typeof l.locked !== "boolean" ||
        !Number.isFinite(l.opacity) ||
        l.opacity < 0 ||
        l.opacity > 1
      )
        throw new Error("Invalid layer settings.");
    const countryIds = new Set(w.countries.map((c) => c.id)),
      layerSet = new Set(w.layers.map((l) => l.id));
    for (const obj of [...w.lands, ...w.provinces]) {
      if (!layerSet.has(obj.layerId))
        throw new Error("An object refers to a missing layer.");
      const error = validateGeometry(obj.geometry);
      if (error) throw new Error(`${obj.name}: ${error}`);
    }
    for (const c of w.countries) {
      if (
        !/^#[0-9a-fA-F]{6}$/.test(c.color) ||
        ["government", "ruler", "capital", "description"].some(
          (key) => typeof c[key as keyof Country] !== "string",
        ) ||
        (c.parentId && !countryIds.has(c.parentId))
      )
        throw new Error("Invalid political entity color or parent.");
      const seen = new Set([c.id]);
      let ancestor = w.countries.find((a) => a.id === c.parentId);
      while (ancestor) {
        if (seen.has(ancestor.id))
          throw new Error("A political hierarchy cannot contain a cycle.");
        seen.add(ancestor.id);
        ancestor = w.countries.find((a) => a.id === ancestor?.parentId);
      }
    }
    for (const province of w.provinces)
      if (
        !countryIds.has(province.countryId) ||
        !Array.isArray(province.claims) ||
        province.claims.some((c) => !countryIds.has(c)) ||
        typeof province.notes !== "string"
      )
        throw new Error("A territory refers to a missing country.");
    for (const f of w.features) {
      if (
        !layerSet.has(f.layerId) ||
        ![
          "river",
          "road",
          "mountain",
          "forest",
          "city",
          "castle",
          "label",
          "image",
          "biome",
        ].includes(f.kind) ||
        !Array.isArray(f.points) ||
        !f.points.length ||
        f.points.some(
          (pt) => pt.length !== 2 || pt.some((n) => !Number.isFinite(n)),
        ) ||
        !Number.isFinite(f.size) ||
        f.size <= 0 ||
        f.size > 100 ||
        !Number.isFinite(f.rotation) ||
        !/^#[0-9a-fA-F]{6}$/.test(f.color) ||
        typeof f.notes !== "string" ||
        (f.countryId && !countryIds.has(f.countryId))
      )
        throw new Error("Invalid map feature.");
      if (
        f.kind === "image" &&
        (!f.asset ||
          !/^data:image\/(png|jpeg|webp);base64,/.test(f.asset.dataUrl) ||
          !Number.isFinite(f.asset.width) ||
          !Number.isFinite(f.asset.height) ||
          f.asset.width <= 0 ||
          f.asset.height <= 0 ||
          f.asset.width > 10000 ||
          f.asset.height > 10000)
      )
        throw new Error(
          "Only embedded PNG, JPEG, and WebP image assets are supported.",
        );
      if (f.kind === "biome" && validateGeometry(polygon(f.points)))
        throw new Error("Invalid biome boundary.");
    }
    for (const view of w.views)
      if (
        !Array.isArray(view.bounds) ||
        view.bounds.length !== 4 ||
        view.bounds.some((n) => !Number.isFinite(n)) ||
        view.bounds[2] <= view.bounds[0] ||
        view.bounds[3] <= view.bounds[1]
      )
        throw new Error("Invalid map view.");
  };
  validateWorld(p.world);
  p.snapshots.forEach((s) => {
    if (typeof s.name !== "string" || typeof s.year !== "string")
      throw new Error("Invalid historical snapshot.");
    validateWorld(s.world);
  });
  return clone(p);
}
const STORAGE_KEY = "atlas-forge-projects-v1";
export function readProjects(): Project[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error("Invalid project storage.");
    return values
      .map(validateProject)
      .sort((a: Project, b: Project) => b.updatedAt - a.updatedAt);
  } catch {
    throw new Error(
      "Saved project data could not be read. Export a recovery backup before replacing it.",
    );
  }
}
export function saveProject(p: Project): void {
  const all = readProjects().filter((v) => v.id !== p.id);
  all.unshift(p);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
export function removeProject(id: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(readProjects().filter((p) => p.id !== id)),
  );
}
export function download(
  name: string,
  content: string | Blob,
  type = "application/json",
): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
