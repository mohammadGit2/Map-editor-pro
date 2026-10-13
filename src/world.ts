import {
  area,
  bounds,
  clone,
  difference,
  intersect,
  polygon,
  union,
  uid,
  validateGeometry,
  type BorderStyle,
  type Geometry,
  type MapAppearance,
  type Point,
  type World,
  type WorldCanvas,
} from "./model";

export const mapThemes = {
  atlas: {
    ocean: "#e0e5dc",
    land: "#e5dfca",
    ink: "#494d3c",
    coast: "#72755d",
    river: "#769b9b",
    forest: "#657c59",
    mountain: "#74705a",
  },
  political: {
    ocean: "#dfebed",
    land: "#f6f3e7",
    ink: "#39494c",
    coast: "#7b8d89",
    river: "#729cb9",
    forest: "#809a74",
    mountain: "#84928b",
  },
  parchment: {
    ocean: "#dfd1ad",
    land: "#ebdfbd",
    ink: "#665333",
    coast: "#927854",
    river: "#8c9984",
    forest: "#828052",
    mountain: "#9a8258",
  },
  midnight: {
    ocean: "#233840",
    land: "#405354",
    ink: "#d8d9c4",
    coast: "#9cad9c",
    river: "#8cb5bd",
    forest: "#97ad91",
    mountain: "#bec1a0",
  },
  blueprint: {
    ocean: "#294f65",
    land: "#4c7483",
    ink: "#dde9e7",
    coast: "#beced0",
    river: "#a1c6d9",
    forest: "#afc6ba",
    mountain: "#b5c9d0",
  },
};
export function appearance(world: World): Required<MapAppearance> {
  return {
    ...mapThemes[world.style],
    borderColor: mapThemes[world.style].ink,
    borderWidth: 1.1,
    provinceBorderWidth: 0.7,
    borderPattern: "solid",
    borderOpacity: 0.55,
    fillOpacity:
      world.style === "parchment"
        ? 0.12
        : world.style === "atlas"
          ? 0.63
          : world.style === "midnight" || world.style === "blueprint"
            ? 0.5
            : 1,
    coastlineWidth: 1.2,
    ...world.appearance,
  };
}
export const borderDash = (pattern?: BorderStyle["pattern"]) =>
  pattern === "dashed" ? "5 3" : pattern === "dotted" ? "1 3" : undefined;
export function canvasSettings(world: World): WorldCanvas {
  if (world.canvas) return world.canvas;
  const b = world.views.find((v) => v.id === "world")?.bounds || [
    0, 0, 1200, 820,
  ];
  return {
    x: b[0],
    y: b[1],
    width: b[2] - b[0],
    height: b[3] - b[1],
    grow: true,
  };
}
export function canvasBounds(world: World): [number, number, number, number] {
  const c = canvasSettings(world);
  return [c.x, c.y, c.x + c.width, c.y + c.height];
}
export const displayScale = (world: World) =>
  Math.min(
    canvasSettings(world).width / 1200,
    canvasSettings(world).height / 820,
  );
export function resizeCanvas(
  world: World,
  width: number,
  height: number,
): World {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width * height)
  )
    throw new Error("Enter positive, finite canvas dimensions.");
  const out = clone(world);
  out.canvas = { ...canvasSettings(out), width, height };
  const root = out.views.find((v) => v.id === "world");
  if (root) root.bounds = canvasBounds(out);
  return out;
}
export function growCanvas(world: World, geometry: Geometry): World {
  const c = canvasSettings(world);
  if (!c.grow || !geometry.length) return world;
  const b = bounds(geometry),
    pad = Math.min(c.width, c.height) * 0.035;
  const x = b[0] < c.x ? b[0] - pad : c.x,
    y = b[1] < c.y ? b[1] - pad : c.y,
    right = b[2] > c.x + c.width ? b[2] + pad : c.x + c.width,
    bottom = b[3] > c.y + c.height ? b[3] + pad : c.y + c.height;
  if (
    x === c.x &&
    y === c.y &&
    right === c.x + c.width &&
    bottom === c.y + c.height
  )
    return world;
  world.canvas = { ...c, x, y, width: right - x, height: bottom - y };
  const root = world.views.find((v) => v.id === "world");
  if (root) root.bounds = canvasBounds(world);
  return world;
}
export function fitCanvasToContent(world: World): World {
  const geometry = [...world.lands, ...world.provinces].flatMap(
    (o) => o.geometry,
  );
  const points = [
    ...geometry.flat(2),
    ...world.features.flatMap((f) => f.points),
  ];
  if (!points.length)
    throw new Error(
      "Draw something before fitting the canvas to your artwork.",
    );
  const b = bounds([[points]]),
    pad = Math.max(b[2] - b[0], b[3] - b[1], 1) * 0.1;
  const out = clone(world);
  out.canvas = {
    ...canvasSettings(out),
    x: b[0] - pad,
    y: b[1] - pad,
    width: b[2] - b[0] + 2 * pad,
    height: b[3] - b[1] + 2 * pad,
  };
  const root = out.views.find((v) => v.id === "world");
  if (root) root.bounds = canvasBounds(out);
  return out;
}
export function rulerId(world: World, countryId: string): string {
  if (world.politicalView !== "empires") return countryId;
  let c = world.countries.find((c) => c.id === countryId);
  const seen = new Set<string>();
  while (c?.parentId && !seen.has(c.id)) {
    seen.add(c.id);
    const parent = world.countries.find((p) => p.id === c!.parentId);
    if (!parent) break;
    c = parent;
  }
  return c?.id || countryId;
}
export function descendants(world: World, id: string): Set<string> {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    world.countries.forEach((c) => {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        changed = true;
      }
    });
  }
  return ids;
}
export function setRealmParent(
  world: World,
  childId: string,
  parentId: string | null,
): World {
  const out = clone(world),
    child = out.countries.find((c) => c.id === childId);
  if (!child || (parentId && !out.countries.some((c) => c.id === parentId)))
    throw new Error("Choose an existing realm.");
  if (parentId && descendants(out, childId).has(parentId))
    throw new Error(
      "A realm cannot belong to itself or one of its descendants.",
    );
  child.parentId = parentId;
  return out;
}
export function uniteRealms(
  world: World,
  sourceId: string,
  targetId: string,
): World {
  const out = clone(world),
    source = out.countries.find((c) => c.id === sourceId),
    target = out.countries.find((c) => c.id === targetId);
  if (!source || !target || sourceId === targetId)
    throw new Error("Choose two different existing realms.");
  if (descendants(out, sourceId).has(targetId))
    target.parentId = source.parentId;
  out.provinces
    .filter((p) => p.countryId === sourceId)
    .forEach((p) => {
      unlocked(out, p.layerId);
      p.countryId = targetId;
    });
  out.countries.forEach((c) => {
    if (c.parentId === sourceId) c.parentId = targetId;
  });
  out.countries = out.countries.filter((c) => c.id !== sourceId);
  out.provinces.forEach((p) => {
    p.claims = p.claims.filter((id) => id !== sourceId);
  });
  return out;
}
export function dissolveRealm(
  world: World,
  id: string,
  receiverId?: string,
): World {
  const out = clone(world),
    source = out.countries.find((c) => c.id === id);
  if (!source) throw new Error("Select an existing realm.");
  const owned = out.provinces.filter((p) => p.countryId === id);
  if (
    owned.length &&
    (!receiverId ||
      receiverId === id ||
      !out.countries.some((c) => c.id === receiverId))
  )
    throw new Error("Choose a realm to receive the directly owned provinces.");
  owned.forEach((p) => {
    unlocked(out, p.layerId);
    p.countryId = receiverId!;
  });
  out.countries.forEach((c) => {
    if (c.parentId === id) c.parentId = source.parentId;
  });
  out.countries = out.countries.filter((c) => c.id !== id);
  out.provinces.forEach((p) => {
    p.claims = p.claims.filter((c) => c !== id);
  });
  return out;
}
const minimumArea = 1e-8;
const unlocked = (world: World, id: string) => {
  if (world.layers.find((l) => l.id === id)?.locked)
    throw new Error("Unlock the layers affected by this edit first.");
};
const assertGeometry = (g: Geometry) => {
  const error = validateGeometry(g);
  if (error) throw new Error(error);
};
export function strokeGeometry(points: Point[], diameter: number): Geometry {
  if (!points.length || !Number.isFinite(diameter) || diameter <= 0)
    throw new Error("Choose a positive brush size.");
  const r = diameter / 2,
    parts: Geometry[] = [];
  const pts = points.filter(
    (p, i) =>
      i === 0 ||
      i === points.length - 1 ||
      Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > r * 0.15,
  );
  pts.forEach((p, i) => {
    parts.push(
      polygon(
        Array.from(
          { length: 20 },
          (_, k) =>
            [
              p[0] + Math.cos((k * Math.PI) / 10) * r,
              p[1] + Math.sin((k * Math.PI) / 10) * r,
            ] as Point,
        ),
      ),
    );
    if (i) {
      const a = pts[i - 1],
        dx = p[0] - a[0],
        dy = p[1] - a[1],
        length = Math.hypot(dx, dy);
      if (length > 0) {
        const ox = (-dy / length) * r,
          oy = (dx / length) * r;
        parts.push(
          polygon([
            [a[0] + ox, a[1] + oy],
            [p[0] + ox, p[1] + oy],
            [p[0] - ox, p[1] - oy],
            [a[0] - ox, a[1] - oy],
          ]),
        );
      }
    }
  });
  return union(...parts);
}
export function addLand(
  world: World,
  geometry: Geometry,
  color?: string,
): World {
  assertGeometry(geometry);
  unlocked(world, "land");
  const out = clone(world);
  const affected = out.lands.filter(
    (l) => area(intersect(l.geometry, geometry)) > minimumArea,
  );
  affected.forEach((l) => unlocked(out, l.layerId));
  const merged = union(geometry, ...affected.map((l) => l.geometry));
  assertGeometry(merged);
  out.lands = out.lands.filter((l) => !affected.some((a) => a.id === l.id));
  out.lands.push({
    id: affected[0]?.id || uid(),
    name: affected[0]?.name || `Landmass ${out.lands.length + 1}`,
    layerId: affected[0]?.layerId || "land",
    geometry: merged,
    color: affected[0]?.color || color,
  });
  return growCanvas(out, merged);
}
export function eraseLand(world: World, geometry: Geometry): World {
  const out = clone(world);
  for (const list of [out.lands, out.provinces])
    for (const obj of list) {
      if (area(intersect(obj.geometry, geometry)) > minimumArea) {
        unlocked(out, obj.layerId);
        obj.geometry = difference(obj.geometry, geometry);
        if (obj.geometry.length) assertGeometry(obj.geometry);
      }
    }
  out.lands = out.lands.filter((l) => area(l.geometry) > minimumArea);
  out.provinces = out.provinces.filter((p) => area(p.geometry) > minimumArea);
  return out;
}
/** Carve a new editable region from land; neighboring regions keep their remaining geometry. */
export function drawTerritory(
  world: World,
  geometry: Geometry,
  countryId: string,
): World {
  if (!world.countries.some((c) => c.id === countryId))
    throw new Error("Choose a country or create one first.");
  if (!world.lands.length)
    throw new Error("Draw land first, then give it a country.");
  assertGeometry(geometry);
  unlocked(world, "political");
  const out = clone(world);
  const g = intersect(geometry, union(...out.lands.map((l) => l.geometry)));
  if (area(g) <= minimumArea)
    throw new Error("Draw the border across your land.");
  assertGeometry(g);
  out.provinces.forEach((p) => {
    if (area(intersect(p.geometry, g)) > minimumArea) {
      unlocked(out, p.layerId);
      p.geometry = difference(p.geometry, g);
      if (p.geometry.length) assertGeometry(p.geometry);
    }
  });
  out.provinces = out.provinces.filter((p) => area(p.geometry) > minimumArea);
  out.provinces.push({
    id: uid(),
    name: `Province ${out.provinces.length + 1}`,
    geometry: g,
    countryId,
    layerId: "political",
    claims: [],
    notes: "",
  });
  return out;
}
