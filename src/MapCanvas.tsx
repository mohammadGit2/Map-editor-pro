import { useRef, useState, useEffect, useMemo, forwardRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Compass,
  Maximize,
  Minus,
  Plus,
  MousePointer2,
  Map as MapIcon,
} from "lucide-react";
import {
  type World,
  type Selected,
  type Point,
  type Tool,
  type Geometry,
  type Feature,
  geometryPath,
  center,
  union,
  bounds,
} from "./model";
import { FeatureSpatialIndex } from "./spatial";

export const themes = {
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
const pathLine = (pts: Point[]) => {
  if (pts.length < 3) return `M${pts.map((p) => p.join(",")).join("L")}`;
  let d = `M${pts[0].join(",")}`;
  for (let i = 1; i < pts.length - 1; i++)
    d += `Q${pts[i].join(",")} ${(pts[i][0] + pts[i + 1][0]) / 2},${(pts[i][1] + pts[i + 1][1]) / 2}`;
  return `${d}L${pts.at(-1)!.join(",")}`;
};
export function FeatureGlyph({
  feature: f,
  world,
  selected = false,
}: {
  feature: Feature;
  world: World;
  selected?: boolean;
}) {
  const t = themes[world.style],
    [x, y] = f.points[0];
  const ink = f.color === "#514a3c" ? t.ink : f.color;
  const font = f.font || "Georgia,serif";
  const s = f.size;
  const line = f.kind === "river" || f.kind === "road";
  return (
    <g data-feature={f.id}>
      {f.kind === "biome" ? (
        <path
          transform={`rotate(${f.rotation} ${x} ${y})`}
          d={`M${f.points.map((p) => p.join(",")).join("L")}Z`}
          fill={f.color}
          fillOpacity={0.2 * f.size}
          stroke={selected ? "#3e8f7b" : f.color}
          strokeWidth=".8"
          strokeDasharray="3 2"
        />
      ) : line ? (
        <>
          {selected && (
            <path
              d={pathLine(f.points)}
              fill="none"
              stroke="#42a993"
              strokeWidth={6}
              opacity=".4"
            />
          )}
          <path
            transform={`rotate(${f.rotation} ${x} ${y})`}
            d={pathLine(f.points)}
            fill="none"
            stroke={
              f.kind === "river"
                ? f.color === "#688e94"
                  ? t.river
                  : f.color
                : f.color
            }
            strokeWidth={(f.kind === "river" ? 1.8 : 1.4) * s}
            strokeDasharray={f.kind === "road" ? "3 4" : undefined}
            strokeLinecap="round"
          />
        </>
      ) : (
        <g transform={`translate(${x} ${y}) rotate(${f.rotation}) scale(${s})`}>
          {selected && (
            <circle
              r="17"
              fill="#6abda5"
              fillOpacity=".15"
              stroke="#3e8f7b"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
          )}
          {f.kind === "mountain" && (
            <g
              fill={world.style === "midnight" ? "#536367" : t.land}
              stroke={f.color === "#514a3c" ? t.mountain : ink}
              strokeWidth=".8"
            >
              <path d="M-10 7L-1-12L11 7Z" />
              <path d="M-1-12L2 7M-5-3L-1-5L2-3" fill="none" />
              <path d="M-7 3L-3 0M-5 5L-2 3M6 4L3 0" opacity=".7" />
            </g>
          )}
          {f.kind === "forest" && (
            <g
              stroke={f.color === "#514a3c" ? t.forest : ink}
              strokeWidth=".7"
              fill={f.color === "#514a3c" ? t.forest : ink}
              fillOpacity=".22"
            >
              <path d="M0-10L-5-2H-3L-7 5H7L3-2H5Z" />
              <path d="M0 5V9M0-5V4" fill="none" />
            </g>
          )}
          {f.kind === "city" && (
            <>
              <circle
                r={f.size > 1 ? 5.5 : 3.8}
                fill={t.land}
                stroke={ink}
                strokeWidth="1.3"
              />
              <circle r={f.size > 1 ? 2.8 : 1.5} fill={ink} />
              {f.size > 1 && (
                <path d="M-2-9L0-12L2-9" stroke={ink} fill="none" />
              )}
              <text
                x="0"
                y="19"
                textAnchor="middle"
                fill={ink}
                fontFamily={font}
                fontSize="12"
                paintOrder="stroke"
                stroke={t.land}
                strokeWidth={f.outline === false ? 0 : 3}
                strokeLinejoin="round"
              >
                {f.name}
              </text>
            </>
          )}
          {f.kind === "castle" && (
            <>
              <path
                d="M-5 5V-7H-2V-4H2V-7H5V5ZM-7 5H7M-1 5V1H1V5"
                stroke={ink}
                strokeWidth="1.3"
                fill={t.land}
              />
              <text
                y="18"
                textAnchor="middle"
                fill={ink}
                fontFamily={font}
                fontSize="11"
                paintOrder="stroke"
                stroke={t.land}
                strokeWidth={f.outline === false ? 0 : 3}
              >
                {f.name}
              </text>
            </>
          )}
          {f.kind === "label" && (
            <text
              textAnchor="middle"
              fill={ink}
              fontFamily={font}
              fontSize="13"
              letterSpacing="3"
              fontStyle="italic"
              opacity=".73"
              paintOrder="stroke"
              stroke={t.land}
              strokeWidth={f.outline ? 3 : 0}
            >
              {f.name}
            </text>
          )}
          {f.kind === "image" && f.asset && (
            <image
              href={f.asset.dataUrl}
              x={-f.asset.width / 2}
              y={-f.asset.height / 2}
              width={f.asset.width}
              height={f.asset.height}
            />
          )}
        </g>
      )}
    </g>
  );
}
interface ContentProps {
  world: World;
  title?: string;
  viewportBounds?: [number, number, number, number];
  selected?: Selected[];
  onSelect?: (s: Selected, shift: boolean) => void;
  tool?: Tool;
  interactive?: boolean;
  comparison?: World | null;
}
export function MapContent({
  world,
  title = "The Aurelian Reach",
  viewportBounds,
  selected = [],
  onSelect,
  tool = "select",
  interactive = true,
  comparison,
}: ContentProps) {
  const t = themes[world.style];
  const layer = (id: string) => world.layers.find((l) => l.id === id);
  const select = (s: Selected, e: React.MouseEvent) => {
    if (tool === "select" || tool === "vertex" || tool === "erase") {
      e.stopPropagation();
      onSelect?.(s, e.shiftKey);
    }
  };
  const groups = useMemo(
    () =>
      world.countries.map((c) => {
        const territories = world.provinces.filter(
          (p) => p.countryId === c.id && layer(p.layerId)?.visible,
        );
        return {
          country: c,
          geometry: territories.length
            ? union(...territories.map((p) => p.geometry))
            : [],
        };
      }),
    [world.countries, world.provinces, world.layers],
  );
  const chosen = new Set(selected.map((s) => s.id));
  const spatial = useMemo(
    () => new FeatureSpatialIndex(world.features),
    [world.features],
  );
  const visible = useMemo(
    () => (viewportBounds ? spatial.query(viewportBounds) : null),
    [spatial, viewportBounds],
  );
  return (
    <>
      <defs>
        <pattern
          id="sea-lines"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 24H48M24 0V48"
            stroke={t.ink}
            opacity=".035"
            strokeWidth=".6"
          />
        </pattern>
        <pattern
          id="paper-grain"
          width="120"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="13" cy="28" r=".7" fill={t.ink} opacity=".11" />
          <circle cx="88" cy="65" r=".5" fill={t.ink} opacity=".12" />
          <circle cx="48" cy="6" r=".6" fill={t.ink} opacity=".1" />
          <path
            d="M30 84L31 83M99 23L101 23M4 63H5M65 46H66"
            stroke={t.ink}
            opacity=".07"
          />
        </pattern>
        <pattern
          id="map-grid"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M50 0H0V50"
            fill="none"
            stroke={t.ink}
            opacity=".2"
            strokeWidth=".5"
          />
        </pattern>
        <pattern
          id="disputed"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <path d="M0 0V7" stroke={t.ink} opacity=".3" strokeWidth="2" />
        </pattern>
        <filter
          id="coastal-shadow"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
        >
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect x="-10000" y="-10000" width="20000" height="20000" fill={t.ocean} />
      <rect width="1200" height="820" fill="url(#sea-lines)" />
      {world.lands
        .filter((l) => layer(l.layerId)?.visible)
        .map((l) => (
          <g key={l.id} opacity={layer(l.layerId)?.opacity}>
            <path
              d={geometryPath(l.geometry)}
              fill="none"
              stroke={t.coast}
              strokeWidth="11"
              opacity=".12"
            />
            <path
              d={geometryPath(l.geometry)}
              fill="none"
              stroke={t.coast}
              strokeWidth="5"
              opacity=".22"
            />
          </g>
        ))}
      {[...world.layers].reverse().map((l) =>
        !l.visible ? null : (
          <g key={l.id} opacity={l.opacity} data-layer={l.id}>
            {world.lands
              .filter((p) => p.layerId === l.id)
              .map((p) => (
                <path
                  key={p.id}
                  data-object={p.id}
                  d={geometryPath(p.geometry)}
                  fill={t.land}
                  fillRule="evenodd"
                  stroke={chosen.has(p.id) ? "#349a83" : t.coast}
                  strokeWidth={chosen.has(p.id) ? 2 : 1.2}
                  onClick={(e) => select({ type: "land", id: p.id }, e)}
                  className={interactive ? "map-land" : ""}
                />
              ))}
            {world.provinces
              .filter((p) => p.layerId === l.id)
              .map((p) => {
                const c = world.countries.find((c) => c.id === p.countryId),
                  changed =
                    comparison?.provinces.find((q) => q.id === p.id)
                      ?.countryId !== p.countryId;
                return (
                  <g key={p.id}>
                    <path
                      data-object={p.id}
                      d={geometryPath(p.geometry)}
                      fill={
                        world.style === "parchment"
                          ? t.land
                          : c?.color || t.land
                      }
                      fillOpacity={
                        world.style === "midnight" ||
                        world.style === "blueprint"
                          ? ".5"
                          : world.style === "atlas"
                            ? ".63"
                            : "1"
                      }
                      stroke={t.ink}
                      strokeOpacity=".36"
                      strokeWidth=".7"
                      strokeDasharray="2 1.7"
                      fillRule="evenodd"
                      onClick={(e) => select({ type: "province", id: p.id }, e)}
                      className={interactive ? "map-province" : ""}
                    />
                    {p.claims.length > 0 && (
                      <path
                        d={geometryPath(p.geometry)}
                        fill="url(#disputed)"
                        pointerEvents="none"
                      />
                    )}
                    {comparison && changed && (
                      <path
                        d={geometryPath(p.geometry)}
                        fill="#e0a048"
                        fillOpacity=".55"
                        stroke="#ad6d22"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}
            {world.features
              .filter(
                (f) => f.layerId === l.id && (!visible || visible.has(f.id)),
              )
              .map((f) => (
                <g
                  key={f.id}
                  className={interactive ? "map-feature" : ""}
                  onClick={(e) => select({ type: "feature", id: f.id }, e)}
                >
                  <FeatureGlyph
                    feature={f}
                    world={world}
                    selected={chosen.has(f.id)}
                  />
                  {interactive && ["river", "road"].includes(f.kind) && (
                    <path
                      d={pathLine(f.points)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="10"
                    />
                  )}
                </g>
              ))}
          </g>
        ),
      )}
      {groups
        .filter((g) => g.geometry.length)
        .map(({ country: c, geometry: g }) => (
          <g key={c.id} pointerEvents="none">
            <path
              d={geometryPath(g)}
              fill="none"
              stroke={t.ink}
              strokeWidth="1.1"
              strokeOpacity=".55"
            />
            {layer("labels")?.visible &&
              (() => {
                const [x, y] = c.labelPosition || center(g),
                  b = bounds(g),
                  small = b[2] - b[0] < 180;
                const lines = c.name
                  .replace("Kingdom of ", "KINGDOM OF|")
                  .replace("The Crimson ", "THE CRIMSON|")
                  .replace("Valorian ", "VALORIAN|")
                  .replace("Sylvan ", "SYLVAN|")
                  .replace("Isles of ", "ISLES OF|")
                  .toUpperCase()
                  .split("|");
                return (
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fontFamily="Georgia,serif"
                    fontSize={small ? 12 : 15}
                    letterSpacing={small ? 2 : 3}
                    fill={t.ink}
                    opacity={layer("labels")?.opacity}
                    paintOrder="stroke"
                    stroke={t.land}
                    strokeOpacity=".6"
                    strokeWidth="2.5"
                  >
                    {lines.map((line, i) => (
                      <tspan key={i} x={x} dy={i === 0 ? 0 : 21}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                );
              })()}
          </g>
        ))}
      {selected
        .filter((s) => s.type === "province")
        .map((s) => {
          const p = world.provinces.find((p) => p.id === s.id);
          return p && layer(p.layerId)?.visible ? (
            <path
              key={s.id}
              d={geometryPath(p.geometry)}
              fill="#8dd3be"
              fillOpacity=".1"
              stroke="#297e6c"
              strokeWidth="2.2"
              pointerEvents="none"
            />
          ) : null;
        })}
      <rect
        width="1200"
        height="820"
        fill="url(#paper-grain)"
        pointerEvents="none"
      />
      {world.grid && (
        <rect
          width="1200"
          height="820"
          fill="url(#map-grid)"
          pointerEvents="none"
        />
      )}
      {world.decorations && (
        <g fill={t.ink} stroke={t.ink} pointerEvents="none" opacity=".8">
          <rect
            x="71"
            y="74"
            width="1058"
            height="674"
            fill="none"
            strokeWidth=".6"
            opacity=".4"
          />
          <path
            d="M71 93V74H90M1110 74H1129V93M71 729V748H90M1110 748H1129V729"
            fill="none"
            strokeWidth="1.2"
          />
          <g transform="translate(1047 184)">
            <circle r="37" fill="none" strokeWidth=".6" opacity=".5" />
            <circle r="30" fill="none" strokeWidth=".4" />
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 45})`}>
                <path
                  d="M0-39L5-4L0 0Z"
                  strokeWidth=".5"
                  fill={i % 2 ? t.ocean : t.ink}
                />
                <path d="M0-39L-5-4L0 0Z" strokeWidth=".5" fill={t.ocean} />
              </g>
            ))}
            <circle r="3" fill={t.ocean} />
            <text
              y="-49"
              textAnchor="middle"
              fontSize="12"
              fontFamily="Georgia"
              stroke="none"
            >
              N
            </text>
            <text
              y="56"
              textAnchor="middle"
              fontSize="10"
              fontFamily="Georgia"
              stroke="none"
            >
              S
            </text>
            <text
              x="-48"
              y="4"
              textAnchor="middle"
              fontSize="10"
              fontFamily="Georgia"
              stroke="none"
            >
              W
            </text>
            <text
              x="48"
              y="4"
              textAnchor="middle"
              fontSize="10"
              fontFamily="Georgia"
              stroke="none"
            >
              E
            </text>
          </g>
          <g transform="translate(110 684)" stroke="none">
            <text fontFamily="Georgia,serif" fontSize="12" letterSpacing="4">
              A WORLD IN THE MAKING
            </text>
            <text
              y="29"
              fontFamily="Georgia,serif"
              fontSize={title.length > 25 ? 21 : 28}
              letterSpacing="1"
            >
              {title}
            </text>
            <path d="M0 44H260" stroke={t.ink} strokeWidth=".6" />
            <text
              y="60"
              fontFamily="Georgia,serif"
              fontSize="9"
              letterSpacing="2"
            >
              CHARTED WITH ATLAS FORGE
            </text>
          </g>
          <g transform="translate(928 699)">
            <path d="M0 0H150M0-4V4M50-4V4M100-4V4M150-4V4" strokeWidth=".8" />
            <rect width="50" height="3" />
            <rect x="100" width="50" height="3" />
            <text x="0" y="17" fontFamily="Georgia" fontSize="8" stroke="none">
              0
            </text>
            <text
              x="50"
              y="17"
              fontFamily="Georgia"
              fontSize="8"
              stroke="none"
              textAnchor="middle"
            >
              100
            </text>
            <text
              x="100"
              y="17"
              fontFamily="Georgia"
              fontSize="8"
              stroke="none"
              textAnchor="middle"
            >
              200
            </text>
            <text
              x="150"
              y="17"
              fontFamily="Georgia"
              fontSize="8"
              stroke="none"
              textAnchor="middle"
            >
              300 leagues
            </text>
          </g>
        </g>
      )}
    </>
  );
}
interface Props {
  world: World;
  title: string;
  tool: Tool;
  selected: Selected[];
  brushSize: number;
  viewBounds: [number, number, number, number] | null;
  comparison: World | null;
  onSelect: (s: Selected | null, shift?: boolean) => void;
  onDraw: (tool: Tool, points: Point[]) => void;
  onVertex: (selected: Selected, from: Point, to: Point) => void;
  onVertexAction: (action: "insert" | "remove", point: Point) => void;
  onMove: (selected: Selected, dx: number, dy: number) => void;
  onCoordinates: (p: Point) => void;
}
type Drag = {
  type: "pan" | "draw" | "vertex" | "move";
  start: Point;
  last: Point;
  view?: number[];
  selected?: Selected;
  points: Point[];
};
const instructions: Partial<Record<Tool, string>> = {
  land: "Drag to draw a coastline. Release to create land.",
  territory: "Click to place boundary points · Enter or double-click to finish",
  split: "Click two points to divide the selected province",
  vertex:
    "Drag to move · click an edge to insert · Alt-click a vertex to remove",
  river: "Drag to draw a river",
  road: "Drag to draw a road or trade route",
  mountain: "Click or drag to place mountains",
  forest: "Click or drag to plant a forest",
  city: "Click to place a city",
  castle: "Click to place a castle",
  label: "Click to add a label",
  rectangle: "Drag to draw rectangular land",
  ellipse: "Drag to draw an island",
  biome: "Drag to draw a biome boundary",
  erase: "Click an object to remove it",
  pan: "Drag to explore your world",
};
const MapCanvas = forwardRef<SVGSVGElement, Props>(function MapCanvas(
  {
    world,
    title,
    tool,
    selected,
    brushSize,
    viewBounds,
    comparison,
    onSelect,
    onDraw,
    onVertex,
    onVertexAction,
    onMove,
    onCoordinates,
  },
  ref,
) {
  const svg = useRef<SVGSVGElement | null>(null),
    box = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState([0, 0, 1200, 820]);
  const [size, setSize] = useState([1000, 700]);
  const [draft, setDraft] = useState<Point[]>([]),
    drag = useRef<Drag | null>(null);
  const [space, setSpace] = useState(false);
  const [vertexGhost, setVertexGhost] = useState<Point | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setSize([entries[0].contentRect.width, entries[0].contentRect.height]);
    });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const fit = (b: [number, number, number, number] = [0, 0, 1200, 820]) => {
    const aspect = size[0] / size[1],
      w = b[2] - b[0],
      h = b[3] - b[1];
    const vw = Math.max(w, h * aspect) * 1.02,
      vh = vw / aspect;
    setViewport([(b[0] + b[2] - vw) / 2, (b[1] + b[3] - vh) / 2, vw, vh]);
  };
  useEffect(() => {
    fit(viewBounds || [0, 0, 1200, 820]);
  }, [viewBounds, size[0], size[1]]); // Resize retains an entire linked view.
  useEffect(() => {
    setDraft([]);
  }, [tool]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpace(true);
      }
      if (e.key === "Escape") setDraft([]);
      if (e.key === "Enter" && draft.length >= 3) {
        onDraw(tool, draft);
        setDraft([]);
      }
      if (e.key === "Backspace" && draft.length) {
        e.preventDefault();
        setDraft(draft.slice(0, -1));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [draft, tool, onDraw]);
  const location = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    const p: Point = [
      viewport[0] + ((e.clientX - r.left) / r.width) * viewport[2],
      viewport[1] + ((e.clientY - r.top) / r.height) * viewport[3],
    ];
    return world.snap && tool !== "pan" && tool !== "select"
      ? [Math.round(p[0] / 10) * 10, Math.round(p[1] / 10) * 10]
      : p;
  };
  const zoom = (factor: number, at?: Point) =>
    setViewport((v) => {
      const p = at || [v[0] + v[2] / 2, v[1] + v[3] / 2],
        newW = Math.min(6000, Math.max(100, v[2] * factor)),
        f = newW / v[2];
      return [
        p[0] - (p[0] - v[0]) * f,
        p[1] - (p[1] - v[1]) * f,
        newW,
        v[3] * f,
      ];
    });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.1 : 0.91, location(e));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [viewport]);
  const pointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const p = location(e);
    if (tool === "pan" || space || e.button === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        type: "pan",
        start: [e.clientX, e.clientY],
        last: p,
        view: viewport,
        points: [],
      };
      return;
    }
    if (tool === "select") {
      const element = (e.target as Element).closest(
        "[data-object],[data-feature]",
      );
      const id =
        element?.getAttribute("data-feature") ||
        element?.getAttribute("data-object");
      const s = selected.find((s) => s.id === id);
      if (s?.type === "feature") {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          type: "move",
          start: p,
          last: p,
          selected: s,
          points: [],
        };
      }
      return;
    }
    if (tool === "vertex") {
      const target = selected[0],
        g =
          target?.type === "province"
            ? world.provinces.find((pr) => pr.id === target.id)?.geometry
            : target?.type === "land"
              ? world.lands.find((l) => l.id === target.id)?.geometry
              : null;
      let nearest: Point | null = null,
        minimum = (12 * viewport[2]) / size[0];
      if (g)
        for (const poly of g)
          for (const r of poly)
            for (let i = 0; i < r.length - 1; i++) {
              const a = r[i],
                b = r[i + 1],
                dx = b[0] - a[0],
                dy = b[1] - a[1],
                t = Math.max(
                  0,
                  Math.min(
                    1,
                    ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) /
                      (dx * dx + dy * dy),
                  ),
                );
              const q: Point = [a[0] + t * dx, a[1] + t * dy];
              const dist = Math.hypot(q[0] - p[0], q[1] - p[1]);
              if (dist < minimum) {
                minimum = dist;
                nearest = q;
              }
            }
      if (nearest) onVertexAction("insert", nearest);
      return;
    }
    if (tool === "erase") return;
    if (tool === "territory") {
      setDraft((d) => [...d, p]);
      return;
    }
    if (tool === "split") {
      if (!draft.length) setDraft([p]);
      else {
        onDraw(tool, [draft[0], p]);
        setDraft([]);
      }
      return;
    }
    if (["city", "castle", "label"].includes(tool)) {
      onDraw(tool, [p]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { type: "draw", start: p, last: p, points: [p] };
    setDraft([p]);
  };
  const pointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = location(e);
    onCoordinates(p);
    const d = drag.current;
    if (!d) return;
    if (d.type === "pan" && d.view) {
      const v = d.view;
      setViewport([
        v[0] - ((e.clientX - d.start[0]) * v[2]) / size[0],
        v[1] - ((e.clientY - d.start[1]) * v[3]) / size[1],
        v[2],
        v[3],
      ]);
    }
    if (d.type === "vertex") {
      d.last = p;
      setVertexGhost(p);
    }
    if (d.type === "move") {
      d.last = p;
    }
    if (d.type === "draw") {
      if (["rectangle", "ellipse"].includes(tool)) {
        d.last = p;
        setDraft([d.start, p]);
        return;
      }
      const distance = Math.hypot(p[0] - d.last[0], p[1] - d.last[1]);
      const threshold = ["mountain", "forest"].includes(tool)
        ? brushSize * 14
        : 3;
      if (distance > threshold) {
        d.points.push(p);
        d.last = p;
        setDraft([...d.points]);
      }
    }
  };
  const pointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.type === "draw") {
      onDraw(
        tool,
        ["rectangle", "ellipse"].includes(tool) ? [d.start, d.last] : d.points,
      );
      setDraft([]);
    }
    if (d.type === "vertex" && d.selected) {
      onVertex(d.selected, d.start, d.last);
      setVertexGhost(null);
    }
    if (
      d.type === "move" &&
      d.selected &&
      Math.hypot(d.start[0] - d.last[0], d.start[1] - d.last[1]) > 2
    ) {
      onMove(d.selected, d.last[0] - d.start[0], d.last[1] - d.start[1]);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const target = selected[0];
  const geom: Geometry | undefined =
    target?.type === "province"
      ? world.provinces.find((p) => p.id === target.id)?.geometry
      : target?.type === "land"
        ? world.lands.find((p) => p.id === target.id)?.geometry
        : undefined;
  const rectangle =
    draft.length === 2 && ["rectangle", "ellipse"].includes(tool);
  return (
    <div
      ref={box}
      className={`canvas-stage tool-${tool} ${space ? "space-pan" : ""}`}
    >
      <div className="canvas-breadcrumb">
        <MapIcon size={12} />
        <span>World map</span>
        <span className="breadcrumb-slash">/</span>
        <span>Aurelia</span>
      </div>
      <svg
        ref={(el) => {
          svg.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        id="map-canvas"
        role="img"
        aria-label="Editable world map"
        viewBox={viewport.join(" ")}
        preserveAspectRatio="none"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDraft([]);
          setVertexGhost(null);
        }}
        onClick={(e) => {
          if (
            tool === "select" &&
            !space &&
            (e.target === e.currentTarget ||
              (e.target as Element).tagName === "rect")
          )
            onSelect(null);
        }}
        onDoubleClick={() => {
          if (tool === "territory" && draft.length >= 3) {
            onDraw(tool, draft.slice(0, -1));
            setDraft([]);
          }
        }}
      >
        <MapContent
          world={world}
          title={title}
          viewportBounds={[
            viewport[0],
            viewport[1],
            viewport[0] + viewport[2],
            viewport[1] + viewport[3],
          ]}
          selected={selected}
          onSelect={onSelect}
          tool={tool}
          comparison={comparison}
        />
        {draft.length > 0 && (
          <g
            pointerEvents="none"
            stroke="#327c68"
            strokeWidth={(viewport[2] / size[0]) * 1.8}
            fill="none"
          >
            {rectangle ? (
              tool === "rectangle" ? (
                <rect
                  x={Math.min(draft[0][0], draft[1][0])}
                  y={Math.min(draft[0][1], draft[1][1])}
                  width={Math.abs(draft[1][0] - draft[0][0])}
                  height={Math.abs(draft[1][1] - draft[0][1])}
                />
              ) : (
                <ellipse
                  cx={(draft[0][0] + draft[1][0]) / 2}
                  cy={(draft[0][1] + draft[1][1]) / 2}
                  rx={Math.abs(draft[1][0] - draft[0][0]) / 2}
                  ry={Math.abs(draft[1][1] - draft[0][1]) / 2}
                />
              )
            ) : (
              <path
                d={`M${draft.map((p) => p.join(",")).join("L")}${["land", "territory"].includes(tool) ? "Z" : ""}`}
                fill={
                  ["land", "territory"].includes(tool) ? "#65aa8740" : "none"
                }
                strokeDasharray="4 3"
              />
            )}
            {draft.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={(3 * viewport[2]) / size[0]}
                fill="#e8f1e5"
              />
            ))}
          </g>
        )}
        {tool === "vertex" &&
          geom &&
          geom.map((poly, i) =>
            poly.map((r, j) =>
              r.slice(0, -1).map((p, k) => (
                <circle
                  key={`${i}-${j}-${k}`}
                  cx={p[0]}
                  cy={p[1]}
                  r={(3.3 * viewport[2]) / size[0]}
                  fill="#f7f6e7"
                  stroke="#2b8b72"
                  strokeWidth={(viewport[2] / size[0]) * 1.3}
                  className="vertex-handle"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.altKey) {
                      onVertexAction("remove", p);
                      return;
                    }
                    svg.current!.setPointerCapture(e.pointerId);
                    drag.current = {
                      type: "vertex",
                      start: p,
                      last: p,
                      selected: target,
                      points: [],
                    };
                  }}
                />
              )),
            ),
          )}
        {vertexGhost && (
          <circle
            cx={vertexGhost[0]}
            cy={vertexGhost[1]}
            r="5"
            fill="#2b8b72"
            pointerEvents="none"
          />
        )}
      </svg>
      {tool !== "select" && (
        <div className="canvas-instruction">
          <MousePointer2 size={13} />
          {instructions[tool]}
          <kbd>Esc</kbd>
        </div>
      )}
      <div className="canvas-bottom">
        <div className="canvas-attribution">
          <Compass size={13} />
          <span>EVERY WORLD BEGINS WITH A LINE.</span>
        </div>
        <div className="zoom-controls">
          <button title="Zoom out" onClick={() => zoom(1.2)}>
            <Minus size={15} />
          </button>
          <span>{Math.round((1200 / viewport[2]) * 100)}%</span>
          <button title="Zoom in" onClick={() => zoom(0.8)}>
            <Plus size={15} />
          </button>
          <i />
          <button
            title="Fit map to canvas"
            onClick={() => fit(viewBounds || [0, 0, 1200, 820])}
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>
    </div>
  );
});
export default MapCanvas;
