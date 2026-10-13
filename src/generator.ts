import { Delaunay } from "d3-delaunay";
import {
  blankProject,
  center,
  intersect,
  pointInside,
  polygon,
  smoothRing,
  uid,
  type Feature,
  type Point,
  type Project,
} from "./model";
import { displayScale } from "./world";

export interface GenerationOptions {
  width?: number;
  height?: number;
  continents?: number;
  countries?: number;
}
export function proceduralProject(
  seed: number,
  options: GenerationOptions = {},
): Project {
  const width = options.width ?? 1200,
    height = options.height ?? 820,
    continents = options.continents ?? 3,
    countries = options.countries ?? 5;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width * height)
  )
    throw new Error("Choose positive, finite dimensions.");
  if (
    !Number.isInteger(continents) ||
    continents < 1 ||
    continents > 24 ||
    !Number.isInteger(countries) ||
    countries < 1 ||
    countries > 100
  )
    throw new Error(
      "Generate 1–24 landmasses and 1–100 starting countries per batch. More can be added while editing.",
    );
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const p = blankProject("An untold world", { width, height, grow: true });
  const w = p.world,
    scale = displayScale(w);
  const cols = Math.max(
      1,
      Math.min(continents, Math.ceil(Math.sqrt((continents * width) / height))),
    ),
    rows = Math.ceil(continents / cols),
    cw = width / cols,
    ch = height / rows;
  for (let i = 0; i < continents; i++) {
    const cx = ((i % cols) + 0.5) * cw + (random() - 0.5) * cw * 0.08,
      cy = (Math.floor(i / cols) + 0.5) * ch + (random() - 0.5) * ch * 0.08;
    const a = random() * Math.PI * 2,
      b = random() * Math.PI * 2,
      c = random() * Math.PI * 2;
    const rx = cw * (0.28 + random() * 0.06),
      ry = ch * (0.28 + random() * 0.06);
    const points: Point[] = Array.from({ length: 96 }, (_, j) => {
      const angle = (j / 96) * Math.PI * 2,
        r =
          1 +
          0.2 * Math.sin(angle * 3 + a) +
          0.1 * Math.sin(angle * 7 + b) +
          0.05 * Math.cos(angle * 11 + c);
      return [cx + Math.cos(angle) * rx * r, cy + Math.sin(angle) * ry * r];
    });
    w.lands.push({
      id: uid(),
      name: `Continent ${i + 1}`,
      layerId: "land",
      geometry: [[smoothRing(polygon(points)[0][0], 1)]],
    });
  }
  const syllables = [
    "Ar",
    "Bel",
    "Cor",
    "Da",
    "Ely",
    "Far",
    "Gal",
    "Hal",
    "Ith",
    "Jun",
    "Kel",
    "Lor",
    "Mor",
    "Nor",
    "Or",
    "Pel",
    "Quin",
    "Ren",
    "Syl",
    "Tal",
    "Ul",
    "Val",
    "Wyn",
    "Xan",
    "Ys",
    "Zel",
  ];
  const endings = [
    "aria",
    "oria",
    "mere",
    "haven",
    "eth",
    "en",
    "dor",
    "ia",
    "vale",
    "wyn",
  ];
  const names = new Set<string>();
  w.countries = Array.from({ length: countries }, (_, i) => {
    let name =
      syllables[Math.floor(random() * syllables.length)] +
      endings[Math.floor(random() * endings.length)];
    if (names.has(name)) name += ` ${i + 1}`;
    names.add(name);
    const hue = Math.floor((i * 137.5 + seed * 0.37) % 360);
    return {
      id: uid(),
      name: `${name}`,
      color: pastel(hue),
      government: "Kingdom",
      ruler: "",
      capital: `${name} City`,
      description: "",
      parentId: null,
    };
  });
  const geography = w.lands.flatMap((l) => l.geometry);
  const randomPoint = (index: number): Point => {
    const land = w.lands[index % w.lands.length];
    const origin = center(land.geometry);
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate: Point = [
        origin[0] + (random() - 0.5) * cw * 0.7,
        origin[1] + (random() - 0.5) * ch * 0.7,
      ];
      if (pointInside(candidate, land.geometry)) return candidate;
    }
    return origin;
  };
  const seeds: Point[] = Array.from(
    { length: Math.max(countries * 3, continents * 2) },
    (_, i) => randomPoint(i),
  );
  const voronoi = Delaunay.from(seeds).voronoi([0, 0, width, height]);
  seeds.forEach((_, i) => {
    const cell = voronoi.cellPolygon(i);
    if (!cell) return;
    const g = intersect(polygon(Array.from(cell) as Point[]), geography);
    if (g.length)
      w.provinces.push({
        id: uid(),
        name: `${w.countries[Math.floor(i / 3) % countries].name} · ${i + 1}`,
        geometry: g,
        countryId: w.countries[Math.floor(i / 3) % countries].id,
        layerId: "political",
        claims: [],
        notes: "",
      });
  });
  const feature = (
    kind: Feature["kind"],
    name: string,
    points: Point[],
    size = 1,
  ): Feature => ({
    id: uid(),
    kind,
    name,
    points,
    size: size * scale,
    layerId:
      kind === "river"
        ? "waterways"
        : kind === "road"
          ? "routes"
          : kind === "city"
            ? "settlements"
            : "terrain",
    color: kind === "river" ? "#688e94" : "#514a3c",
    rotation: 0,
    notes: "",
    countryId:
      w.provinces.find((p) => pointInside(points[0], p.geometry))?.countryId ||
      "",
  });
  w.countries.forEach((c) => {
    const region = w.provinces.find((pr) => pr.countryId === c.id);
    if (region)
      w.features.push(
        feature("city", c.capital, [center(region.geometry)], 1.1),
      );
  });
  w.lands.forEach((land, i) => {
    const [x, y] = center(land.geometry);
    for (let j = 0; j < 32; j++)
      w.features.push(
        feature(
          "forest",
          `${land.name} woodland`,
          [randomPoint(i)],
          0.5 + random() * 0.5,
        ),
      );
    for (let j = 0; j < 15; j++) {
      const pt: Point = [
        x + (j - 7) * cw * 0.016,
        y + Math.sin(j * 0.5) * ch * 0.04,
      ];
      if (pointInside(pt, land.geometry))
        w.features.push(
          feature(
            "mountain",
            `${land.name} mountains`,
            [pt],
            0.6 + random() * 0.5,
          ),
        );
    }
    const edge =
      land.geometry[0][0][Math.floor(random() * land.geometry[0][0].length)];
    w.features.push(
      feature(
        "river",
        `${land.name} river`,
        [
          [x, y],
          [x * 0.6 + edge[0] * 0.4, y * 0.6 + edge[1] * 0.4],
          [x * 0.3 + edge[0] * 0.7, y * 0.3 + edge[1] * 0.7],
          edge,
        ],
        1,
      ),
    );
  });
  return p;
}
function pastel(hue: number): string {
  const s = 0.28,
    l = 0.68,
    a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
