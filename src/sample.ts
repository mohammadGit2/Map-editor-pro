import { Delaunay } from "d3-delaunay";
import {
  blankProject,
  type Project,
  type Point,
  polygon,
  smoothRing,
  intersect,
  pointInside,
  palette,
  uid,
  type Feature,
} from "./model";

const coastline: Point[] = [
  [171, 346],
  [144, 326],
  [162, 303],
  [198, 295],
  [185, 271],
  [212, 249],
  [244, 250],
  [248, 222],
  [278, 214],
  [282, 183],
  [310, 174],
  [322, 154],
  [350, 168],
  [374, 146],
  [400, 172],
  [429, 163],
  [454, 189],
  [474, 177],
  [499, 201],
  [532, 187],
  [562, 207],
  [591, 188],
  [606, 205],
  [631, 192],
  [656, 219],
  [688, 209],
  [706, 235],
  [747, 240],
  [769, 222],
  [796, 230],
  [819, 210],
  [835, 229],
  [873, 231],
  [892, 257],
  [922, 252],
  [935, 281],
  [962, 297],
  [951, 323],
  [985, 339],
  [976, 363],
  [1012, 384],
  [1004, 411],
  [978, 425],
  [1003, 450],
  [984, 479],
  [944, 477],
  [924, 497],
  [900, 488],
  [882, 511],
  [852, 513],
  [843, 540],
  [823, 546],
  [835, 572],
  [812, 596],
  [788, 594],
  [775, 627],
  [744, 647],
  [722, 637],
  [702, 659],
  [684, 641],
  [691, 608],
  [670, 596],
  [675, 568],
  [650, 563],
  [652, 543],
  [625, 530],
  [605, 546],
  [580, 537],
  [560, 557],
  [546, 539],
  [520, 552],
  [494, 536],
  [480, 563],
  [457, 569],
  [445, 603],
  [420, 619],
  [392, 609],
  [374, 579],
  [352, 575],
  [354, 543],
  [327, 530],
  [301, 537],
  [276, 519],
  [265, 488],
  [235, 483],
  [226, 457],
  [198, 438],
  [207, 407],
  [179, 390],
  [190, 367],
];
const eastern: Point[] = [
  [1031, 478],
  [1050, 457],
  [1076, 471],
  [1081, 493],
  [1100, 503],
  [1088, 524],
  [1094, 550],
  [1071, 566],
  [1057, 548],
  [1035, 550],
  [1028, 525],
  [1015, 512],
];
const isle: Point[] = [
  [231, 581],
  [251, 568],
  [263, 583],
  [278, 589],
  [269, 609],
  [247, 625],
  [227, 614],
  [219, 598],
];
const seeds: Point[] = [
  [292, 279],
  [392, 247],
  [487, 256],
  [583, 251],
  [688, 291],
  [805, 275],
  [902, 331],
  [308, 391],
  [424, 375],
  [547, 382],
  [665, 406],
  [800, 420],
  [917, 432],
  [400, 500],
  [531, 489],
  [705, 514],
  [776, 561],
  [1061, 515],
  [250, 598],
];
const names = [
  "Westwatch",
  "Highmoor",
  "Eldervale",
  "Northreach",
  "The Silver March",
  "Dawncoast",
  "Frostholm",
  "Briarwood",
  "Greenhollow",
  "Heartlands",
  "Sunmere",
  "Eastmarch",
  "The Salt Coast",
  "Thornwall",
  "Ashen Fields",
  "Golden Vale",
  "Southreach",
  "The Ember Isles",
  "Isle of Whispers",
];
const countryIndex = [0, 0, 0, 2, 2, 3, 3, 0, 0, 1, 2, 3, 3, 0, 1, 1, 4, 4, 0];
function random(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

export function sampleProject(seed = 42): Project {
  const p = blankProject(
    seed === 42
      ? "The Aurelian Reach"
      : `World of ${["Elaria", "Vaeloria", "Orinth", "Thalassar"][seed % 4]}`,
  );
  p.world.countries = [
    "Kingdom of Eldoria",
    "The Crimson Dominion",
    "Valorian Republic",
    "Sylvan Confederacy",
    "Isles of Aether",
  ].map((name, i) => ({
    id: uid(),
    name,
    color: palette[i],
    government: [
      "Kingdom",
      "Empire",
      "Republic",
      "Confederation",
      "City-state",
    ][i],
    ruler: [
      "Queen Elowen III",
      "Emperor Cael",
      "Chancellor Aster",
      "The Circle of Seven",
      "Archon Lyra",
    ][i],
    capital: ["Eldoria", "Crimson Keep", "Valoris", "Sylvanhold", "Aetherport"][
      i
    ],
    description: [
      "An ancient woodland kingdom, bounded by the Mistveil Mountains and the western sea. Its green valleys shelter some of the oldest cities in the Reach.",
      "An ambitious empire of red stone and golden wheat fields.",
      "A republic of scholars, merchants, and mountain cities.",
      "A loose alliance of coastal states and woodland settlements.",
      "A maritime realm of wind, salt, and distant horizons.",
    ][i],
    parentId: null,
  }));
  const labels: Point[] = [
    [364, 424],
    [563, 459],
    [655, 360],
    [853, 445],
    [773, 612],
  ];
  p.world.countries.forEach((c, i) => {
    c.labelPosition = labels[i];
  });
  const jitter = random(seed);
  const phases = Array.from({ length: 4 }, () => jitter() * Math.PI * 2);
  const main = smoothRing(
    polygon(
      coastline.map(([x, y]) =>
        seed === 42
          ? [x, y]
          : // Smooth displacement preserves nearby coast points, unlike independent
            // jitter that can fold narrow peninsulas into self-intersections.
            [
              x +
                14 * Math.sin(y / 100 + phases[0]) +
                10 * Math.sin(x / 180 + phases[1]),
              y +
                18 * Math.sin(x / 160 + phases[2]) +
                10 * Math.cos(y / 130 + phases[3]),
            ],
      ),
    )[0][0],
    2,
  );
  const islands = [
    smoothRing(polygon(eastern)[0][0], 2),
    smoothRing(polygon(isle)[0][0], 1),
  ];
  p.world.lands = [
    { id: uid(), name: "Aurelia", geometry: [[main]], layerId: "land" },
    ...islands.map((r, i) => ({
      id: uid(),
      name: i ? "Isle of Whispers" : "Ember Isles",
      geometry: [[r]],
      layerId: "land",
    })),
  ];
  const geography = p.world.lands.flatMap((l) => l.geometry);
  const voronoi = Delaunay.from(seeds).voronoi([0, 0, 1200, 820]);
  p.world.provinces = seeds.flatMap((_, i) => {
    const cell = voronoi.cellPolygon(i);
    if (!cell) return [];
    const g = intersect(polygon(Array.from(cell) as Point[]), geography);
    return g.length
      ? [
          {
            id: uid(),
            name: names[i],
            geometry: g,
            countryId: p.world.countries[countryIndex[i]].id,
            layerId: "political",
            claims: [],
            notes: "",
          },
        ]
      : [];
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
    size,
    layerId: {
      river: "waterways",
      road: "routes",
      mountain: "terrain",
      forest: "terrain",
      city: "settlements",
      castle: "settlements",
      label: "labels",
      image: "terrain",
      biome: "terrain",
    }[kind],
    color: kind === "river" ? "#688e94" : "#514a3c",
    rotation: 0,
    notes: "",
    countryId:
      p.world.provinces.find((pr) => pointInside(points[0], pr.geometry))
        ?.countryId || "",
  });
  p.world.features = [
    feature("river", "River Aurel", [
      [490, 297],
      [499, 320],
      [482, 348],
      [503, 373],
      [501, 406],
      [520, 432],
      [522, 474],
      [549, 496],
      [564, 533],
    ]),
    feature("river", "The Silverrun", [
      [743, 298],
      [720, 320],
      [732, 340],
      [710, 366],
      [725, 389],
      [709, 419],
      [723, 454],
      [715, 485],
      [740, 513],
    ]),
    feature("river", "River Thorn", [
      [340, 334],
      [329, 368],
      [348, 389],
      [331, 416],
      [332, 447],
      [307, 470],
      [287, 498],
    ]),
    feature("road", "The Kingsroad", [
      [353, 365],
      [410, 372],
      [467, 391],
      [522, 424],
      [589, 414],
      [655, 378],
      [757, 398],
      [811, 421],
    ]),
    feature("road", "Southern trade route", [
      [522, 424],
      [550, 482],
      [640, 484],
      [710, 539],
      [779, 572],
    ]),
    feature("city", "Eldoria", [[353, 365]], 1.25),
    feature("city", "Crimson Keep", [[522, 424]], 1.3),
    feature("city", "Valoris", [[655, 303]], 1.15),
    feature("city", "Sylvanhold", [[820, 361]], 1.2),
    feature("city", "Aetherport", [[774, 573]], 1),
    feature("city", "Westhaven", [[249, 382]], 0.75),
    feature("city", "Oakrest", [[416, 456]], 0.7),
    feature("castle", "Ravenwatch", [[442, 294]], 0.9),
    feature("castle", "Stonegate", [[731, 388]], 0.9),
    feature("city", "Dawnport", [[916, 418]], 0.75),
    feature("city", "Ashford", [[628, 493]], 0.7),
    feature("label", "M I S T V E I L   M O U N T A I N S", [[469, 276]], 0.66),
    feature("label", "THE AMBER SEA", [[575, 671]], 1),
    feature("label", "THE WESTERN EXPANSE", [[139, 508]], 0.85),
    feature("label", "THE SHATTERED SEA", [[1058, 330]], 0.8),
  ];
  p.world.features[
    p.world.features.findIndex(
      (f) => f.name === "M I S T V E I L   M O U N T A I N S",
    )
  ].rotation = 24;
  const r = random(seed);
  for (let i = 0; i < 43; i++) {
    const x = 350 + i * 8.1,
      y = 213 + i * 2.0 + Math.sin(i * 0.47) * 22;
    if (pointInside([x, y], geography))
      p.world.features.push(
        feature("mountain", "Mistveil peak", [[x, y]], 0.6 + r() * 0.6),
      );
  }
  for (let i = 0; i < 22; i++) {
    const x = 782 + i * 4,
      y = 271 + i * 6 + Math.sin(i * 0.6) * 12;
    if (pointInside([x, y], geography))
      p.world.features.push(
        feature("mountain", "Dawnspire peak", [[x, y]], 0.6 + r() * 0.7),
      );
  }
  for (const [cx, cy] of [
    [312, 415],
    [416, 330],
    [585, 324],
    [758, 464],
    [870, 379],
    [385, 500],
    [600, 464],
  ])
    for (let i = 0; i < 20; i++) {
      const point: Point = [cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 46];
      if (pointInside(point, geography))
        p.world.features.push(
          feature("forest", "Woodland", [point], 0.5 + r() * 0.6),
        );
    }
  p.world.views.push({
    id: uid(),
    name: "The Heartlands",
    parentId: "world",
    bounds: [390, 300, 680, 540],
  });
  return p;
}
