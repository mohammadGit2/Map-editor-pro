import type { Feature } from "./model";

type Bounds = [number, number, number, number];
const overlaps = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
function featureBounds(f: Feature): Bounds {
  if (["river", "road", "biome"].includes(f.kind)) {
    const xs = f.points.map((p) => p[0]),
      ys = f.points.map((p) => p[1]);
    return [
      Math.min(...xs) - 10,
      Math.min(...ys) - 10,
      Math.max(...xs) + 10,
      Math.max(...ys) + 10,
    ];
  }
  const [x, y] = f.points[0];
  const r =
    f.kind === "image" && f.asset
      ? (Math.hypot(f.asset.width, f.asset.height) * f.size) / 2
      : Math.max(20, f.name.length * 4) * f.size;
  return [x - r, y - r, x + r, y + r];
}
/** A uniform spatial grid indexes editable symbols without coupling them to rendering. */
export class FeatureSpatialIndex {
  private cells = new Map<string, Feature[]>();
  private bounds = new Map<string, Bounds>();
  private oversized: Feature[] = [];
  constructor(
    features: Feature[],
    private cellSize = 100,
  ) {
    for (const feature of features) {
      const b = featureBounds(feature);
      this.bounds.set(feature.id, b);
      const x1 = Math.floor(b[0] / cellSize),
        x2 = Math.floor(b[2] / cellSize),
        y1 = Math.floor(b[1] / cellSize),
        y2 = Math.floor(b[3] / cellSize);
      if ((x2 - x1 + 1) * (y2 - y1 + 1) > 1000) {
        this.oversized.push(feature);
        continue;
      }
      for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
          const key = `${x}:${y}`,
            cell = this.cells.get(key) || [];
          cell.push(feature);
          this.cells.set(key, cell);
        }
    }
  }
  query(view: Bounds): Set<string> {
    const found = new Set<string>();
    for (const f of this.oversized)
      if (overlaps(this.bounds.get(f.id)!, view)) found.add(f.id);
    for (
      let x = Math.floor(view[0] / this.cellSize);
      x <= Math.floor(view[2] / this.cellSize);
      x++
    )
      for (
        let y = Math.floor(view[1] / this.cellSize);
        y <= Math.floor(view[3] / this.cellSize);
        y++
      )
        for (const f of this.cells.get(`${x}:${y}`) || [])
          if (overlaps(this.bounds.get(f.id)!, view)) found.add(f.id);
    return found;
  }
}
