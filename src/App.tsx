import {
  useState,
  useEffect,
  useRef,
  useCallback,
  isValidElement,
  cloneElement,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Castle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Flag,
  FolderOpen,
  Grid3X3,
  Hand,
  History as HistoryIcon,
  Landmark,
  Layers,
  Leaf,
  LockKeyhole,
  Map as MapIcon,
  MapPinned,
  MoreHorizontal,
  Mountain,
  MousePointer2,
  PanelLeftClose,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  Route,
  Save,
  Scissors,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Spline,
  Trash2,
  Type,
  Undo2,
  UnlockKeyhole,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type Project,
  type World,
  type Tool,
  type Selected,
  type Point,
  type Feature,
  type History,
  type Country,
  type Style,
  clone,
  uid,
  palette,
  blankProject,
  saveProject,
  readProjects,
  removeProject,
  validateProject,
  download,
  polygon,
  smoothRing,
  validateGeometry,
  union,
  intersect,
  difference,
  area,
  bounds,
  splitProvince,
  mergeProvinces,
  transferProvinces,
  moveSharedVertex,
  insertBoundaryVertex,
  removeBoundaryVertex,
  commit,
  undo,
  redo,
  layerIds,
  pointInside,
} from "./model";
import { sampleProject } from "./sample";
import MapCanvas, { MapContent, themes } from "./MapCanvas";
import { generateWorld, checkProject } from "./api";

const toolGroups: {
  tool: Tool;
  name: string;
  icon: LucideIcon;
  key?: string;
}[][] = [
  [
    { tool: "select", name: "Select", icon: MousePointer2, key: "V" },
    { tool: "pan", name: "Pan", icon: Hand, key: "H" },
  ],
  [
    { tool: "land", name: "Draw land", icon: Pencil, key: "B" },
    { tool: "territory", name: "Draw territory", icon: Spline, key: "P" },
    { tool: "vertex", name: "Edit vertices", icon: MousePointer2, key: "A" },
    { tool: "split", name: "Split province", icon: Scissors, key: "S" },
    { tool: "rectangle", name: "Rectangle land", icon: Square },
  ],
  [
    { tool: "mountain", name: "Mountain brush", icon: Mountain, key: "M" },
    { tool: "forest", name: "Forest brush", icon: Leaf, key: "F" },
    { tool: "biome", name: "Biome brush", icon: PaintBucket },
    { tool: "river", name: "River", icon: Spline, key: "R" },
    { tool: "road", name: "Road", icon: Route },
  ],
  [
    { tool: "city", name: "City", icon: Landmark, key: "C" },
    { tool: "castle", name: "Castle", icon: Castle },
    { tool: "label", name: "Label", icon: Type, key: "T" },
    { tool: "erase", name: "Delete object", icon: Trash2, key: "E" },
  ],
];
const allTools = toolGroups.flat();
const styleNames: Record<Style, string> = {
  atlas: "Natural atlas",
  political: "Political atlas",
  parchment: "Antique parchment",
  midnight: "Midnight realm",
  blueprint: "Celestial blueprint",
};
type Modal =
  | "projects"
  | "new"
  | "export"
  | "search"
  | "timeline"
  | "guide"
  | "history"
  | "country"
  | null;
type InputDialog = {
  title: string;
  label: string;
  value: string;
  onSubmit: (v: string) => void;
};
type ConfirmDialog = { title: string; description: string; action: () => void };
const objectIcons: Record<string, LucideIcon> = {
  labels: Type,
  settlements: Landmark,
  routes: Route,
  waterways: Spline,
  terrain: Mountain,
  political: Flag,
  land: MapIcon,
};

function Thumbnail({ world }: { world: World }) {
  return (
    <svg viewBox="100 100 1000 580" className="map-thumbnail">
      <rect
        x="0"
        y="0"
        width="1200"
        height="820"
        fill={themes[world.style].ocean}
      />
      {world.lands.map((l) => (
        <path
          key={l.id}
          d={l.geometry
            .map((p) =>
              p
                .map((r) => "M" + r.map((p) => p.join(",")).join("L") + "Z")
                .join(""),
            )
            .join("")}
          fill={themes[world.style].land}
          stroke="#7c836d"
          strokeWidth="5"
        />
      ))}
      {world.provinces.map((p) => (
        <path
          key={p.id}
          d={p.geometry
            .map((poly) =>
              poly
                .map((r) => "M" + r.map((p) => p.join(",")).join("L") + "Z")
                .join(""),
            )
            .join("")}
          fill={world.countries.find((c) => c.id === p.countryId)?.color}
          stroke="#676b58"
          strokeWidth="2"
        />
      ))}
      {world.features
        .filter((f) => f.kind === "river")
        .map((f) => (
          <path
            key={f.id}
            d={"M" + f.points.map((p) => p.join(",")).join("L")}
            stroke="#648d99"
            strokeWidth="3"
            fill="none"
          />
        ))}
    </svg>
  );
}
function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const dialog = ref.current;
    (
      dialog?.querySelector<HTMLElement>("input,textarea,select") ||
      dialog?.querySelector<HTMLElement>("button")
    )?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && dialog) {
        const items = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,[tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            title="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const child =
    isValidElement<{ "aria-label"?: string }>(children) &&
    ["input", "select", "textarea"].includes(String(children.type))
      ? cloneElement(children, {
          "aria-label": children.props["aria-label"] || label,
        })
      : children;
  return (
    <label className="field">
      <span>{label}</span>
      {child}
    </label>
  );
}

export default function App() {
  const initial = useRef<Project | null>(null);
  const initialError = useRef("");
  if (!initial.current) {
    try {
      initial.current = readProjects()[0] || sampleProject();
    } catch (e) {
      initialError.current = (e as Error).message;
      initial.current = sampleProject();
    }
  }
  const [history, setHistory] = useState<History>({
    current: initial.current,
    past: [],
    future: [],
    entries: [],
  });
  const project = history.current,
    world = project.world;
  const [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState<Selected[]>([]),
    [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [tab, setTab] = useState<"layers" | "world">("layers"),
    [modal, setModal] = useState<Modal>(null),
    [inputDialog, setInputDialog] = useState<InputDialog | null>(null),
    [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [menu, setMenu] = useState(false),
    [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      initialError.current ? { text: initialError.current, error: true } : null,
    );
  const [saveStatus, setSaveStatus] = useState(
      initialError.current ? "Recovery needed" : "All changes saved",
    ),
    [brushSize, setBrushSize] = useState(1),
    [advanced, setAdvanced] = useState(true),
    [coordinates, setCoordinates] = useState<Point>([0, 0]);
  const [activeView, setActiveView] = useState("world"),
    [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 800),
    [search, setSearch] = useState(""),
    [newName, setNewName] = useState("My untold world"),
    [newTemplate, setNewTemplate] = useState("sample");
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null),
    [exportFormat, setExportFormat] = useState("png"),
    [exportScale, setExportScale] = useState(2),
    [transparent, setTransparent] = useState(false),
    [exportView, setExportView] = useState("world"),
    [exporting, setExporting] = useState(false);
  const [comparison, setComparison] = useState<string | null>(null),
    [snapshotName, setSnapshotName] = useState("A new era"),
    [snapshotYear, setSnapshotYear] = useState("1247"),
    [guideStep, setGuideStep] = useState(0),
    [projectList, setProjectList] = useState<Project[]>([]);
  const [newCountry, setNewCountry] = useState("The new kingdom"),
    [newCountryColor, setNewCountryColor] = useState(palette[5]),
    [countryFilter, setCountryFilter] = useState("");
  const svgRef = useRef<SVGSVGElement>(null),
    importRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    saveFailed = useRef(!!initialError.current);
  const [creating, setCreating] = useState(false);
  const createRequest = useRef(0);
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 8000 : 3500);
  }, []);
  const change = useCallback(
    (label: string, apply: (p: Project) => Project) => {
      setHistory((h) => {
        try {
          return commit(h, apply(clone(h.current)), label);
        } catch (e) {
          notify((e as Error).message, true);
          return h;
        }
      });
    },
    [notify],
  );
  const changeWorld = (label: string, apply: (w: World) => World) =>
    change(label, (p) => {
      const next = apply(p.world);
      next.features.forEach((f) => {
        f.countryId =
          next.provinces.find((pr) => pointInside(f.points[0], pr.geometry))
            ?.countryId || "";
      });
      return { ...p, world: next };
    });
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth <= 800) setLeftOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const isLocked = (id: string) =>
    world.layers.find((l) => l.id === id)?.locked;
  const requireUnlocked = (layerId: string) => {
    if (isLocked(layerId))
      throw new Error(
        "This layer is locked. Unlock it in the Layers panel to edit.",
      );
  };
  useEffect(() => {
    if (saveFailed.current) return;
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      try {
        saveProject(project);
        setSaveStatus("All changes saved");
      } catch (e) {
        setSaveStatus("Save failed");
        notify(
          `${(e as Error).message} Download a project backup to protect your work.`,
          true,
        );
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [project, notify]);
  const manualSave = () => {
    try {
      if (saveFailed.current)
        throw new Error(
          "Recovery is needed before overwriting saved data. Export a project backup first.",
        );
      saveProject(project);
      setSaveStatus("All changes saved");
      notify("Your world is saved on this device.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const load = (p: Project) => {
    setHistory({ current: clone(p), past: [], future: [], entries: [] });
    setSelected([]);
    setSelectedCountry(null);
    setActiveView("world");
    setComparison(null);
    setModal(null);
    setTool("select");
  };
  const cancelNewWorld = () => {
    createRequest.current += 1;
    setCreating(false);
    setModal(null);
  };
  const createWorld = async () => {
    if (creating) return;
    const request = ++createRequest.current;
    setCreating(true);
    try {
      const result =
        newTemplate === "generate"
          ? await generateWorld(Date.now() % 100000, newName.trim())
          : null;
      if (createRequest.current !== request) return;
      const p =
        result?.project ||
        (newTemplate === "blank" ? blankProject() : sampleProject());
      p.name = newName.trim() || p.name;
      load(p);
      notify(
        result
          ? `An editable world was generated ${result.source === "server" ? "by the server" : "locally"}.`
          : "A new world is ready to explore.",
      );
    } catch (e) {
      if (createRequest.current === request) notify((e as Error).message, true);
    } finally {
      if (createRequest.current === request) setCreating(false);
    }
  };
  const validateCurrentProject = async () => {
    try {
      const source = await checkProject(project);
      notify(
        source === "server"
          ? "Your project passed local and server validation. No project data was stored on the server."
          : "Your project passed local validation. Server validation is unavailable for this request.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const openProjects = () => {
    try {
      setProjectList(readProjects());
      setModal("projects");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const ask = (
    title: string,
    label: string,
    value: string,
    onSubmit: (v: string) => void,
  ) => setInputDialog({ title, label, value, onSubmit });
  const renameProject = () =>
    ask("Name your world", "Project name", project.name, (name) =>
      change("Renamed project", (p) => ({ ...p, name })),
    );
  const makeCountry = () => {
    changeWorld("Created country", (w) => {
      const id = uid();
      w.countries.push({
        id,
        name: newCountry.trim() || "New kingdom",
        color: newCountryColor,
        government: "Kingdom",
        ruler: "",
        capital: "",
        description: "",
        parentId: null,
      });
      selected
        .filter((s) => s.type === "province")
        .forEach((s) => {
          const p = w.provinces.find((p) => p.id === s.id);
          if (p) {
            requireUnlocked(p.layerId);
            p.countryId = id;
          }
        });
      setSelectedCountry(id);
      return w;
    });
    setModal(null);
    setTab("world");
  };
  const deleteSelection = useCallback(() => {
    change("Deleted selected objects", (p) => {
      for (const s of selected) {
        const obj =
          s.type === "province"
            ? p.world.provinces.find((o) => o.id === s.id)
            : s.type === "land"
              ? p.world.lands.find((o) => o.id === s.id)
              : p.world.features.find((o) => o.id === s.id);
        if (obj && p.world.layers.find((l) => l.id === obj.layerId)?.locked)
          throw new Error(
            "Unlock the selected layer before deleting its contents.",
          );
        if (s.type === "land" && obj) {
          const land = obj as (typeof p.world.lands)[number];
          if (
            p.world.provinces.some(
              (v) => area(intersect(v.geometry, land.geometry)) > 0.05,
            )
          )
            throw new Error(
              "Remove the provinces on this land before deleting its coastline.",
            );
        }
        if (s.type === "province")
          p.world.provinces = p.world.provinces.filter((o) => o.id !== s.id);
        if (s.type === "feature")
          p.world.features = p.world.features.filter((o) => o.id !== s.id);
        if (s.type === "land")
          p.world.lands = p.world.lands.filter((o) => o.id !== s.id);
      }
      return p;
    });
    setSelected([]);
  }, [selected, change]);
  const onSelect = (s: Selected | null, shift = false) => {
    if (tool === "erase" && s) {
      setSelected([s]);
      change("Erased object", (p) => {
        const list =
          s.type === "province"
            ? p.world.provinces
            : s.type === "land"
              ? p.world.lands
              : p.world.features;
        const obj = list.find((o) => o.id === s.id);
        if (obj) requireUnlocked(obj.layerId);
        if (
          s.type === "land" &&
          p.world.provinces.some(
            (v) =>
              area(
                intersect(
                  v.geometry,
                  (obj as (typeof p.world.lands)[number]).geometry,
                ),
              ) > 0.05,
          )
        )
          throw new Error(
            "Delete the political territories on this land first.",
          );
        if (s.type === "province")
          p.world.provinces = p.world.provinces.filter((o) => o.id !== s.id);
        if (s.type === "land")
          p.world.lands = p.world.lands.filter((o) => o.id !== s.id);
        if (s.type === "feature")
          p.world.features = p.world.features.filter((o) => o.id !== s.id);
        return p;
      });
      setSelected([]);
      return;
    }
    setSelectedCountry(null);
    setSelected((prev) =>
      s
        ? shift
          ? prev.some((o) => o.id === s.id)
            ? prev.filter((o) => o.id !== s.id)
            : [...prev, s]
          : [s]
        : [],
    );
  };
  const onDraw = (drawTool: Tool, points: Point[]) => {
    if (drawTool === "split") {
      const province = selected.find((s) => s.type === "province");
      if (!province) {
        notify("Select a province, then choose the split tool.", true);
        return;
      }
      changeWorld("Split province", (w) => {
        requireUnlocked(w.provinces.find((p) => p.id === province.id)!.layerId);
        const result = splitProvince(w, province.id, points[0], points[1]);
        setSelected([{ type: "province", id: result.provinces.at(-2)!.id }]);
        return result;
      });
      return;
    }
    if (["land", "territory", "rectangle", "ellipse"].includes(drawTool)) {
      if (drawTool === "land" && points.length < 3) {
        notify("Draw a closed coastline with at least three points.", true);
        return;
      }
      let pts = points;
      if (drawTool === "rectangle") {
        const [a, b] = points;
        pts = [a, [b[0], a[1]], b, [a[0], b[1]]];
      }
      if (drawTool === "ellipse") {
        const [a, b] = points;
        pts = Array.from(
          { length: 64 },
          (_, i) =>
            [
              (a[0] + b[0]) / 2 +
                (Math.cos((i / 64) * Math.PI * 2) * Math.abs(a[0] - b[0])) / 2,
              (a[1] + b[1]) / 2 +
                (Math.sin((i / 64) * Math.PI * 2) * Math.abs(a[1] - b[1])) / 2,
            ] as Point,
        );
      }
      let geometry = polygon(pts);
      if (drawTool === "land" && points.length > 6)
        geometry = [[smoothRing(geometry[0][0], 1)]];
      changeWorld(
        drawTool === "territory" ? "Created territory" : "Drew landmass",
        (w) => {
          requireUnlocked(drawTool === "territory" ? "political" : "land");
          const error = validateGeometry(geometry);
          if (error) throw new Error(error);
          if (drawTool === "territory") {
            if (!w.countries.length)
              throw new Error(
                "Create a country before drawing its territories.",
              );
            if (!w.lands.length)
              throw new Error(
                "Draw a landmass first, then add a political territory.",
              );
            geometry = intersect(
              geometry,
              union(...w.lands.map((l) => l.geometry)),
            );
            if (w.provinces.length)
              geometry = difference(
                geometry,
                union(...w.provinces.map((p) => p.geometry)),
              );
            if (area(geometry) < 1)
              throw new Error(
                "There is no unassigned land inside this boundary. Split an existing province to divide it.",
              );
            const id = uid();
            w.provinces.push({
              id,
              name: `Province ${w.provinces.length + 1}`,
              geometry,
              countryId: selectedCountry || w.countries[0]?.id || "",
              layerId: "political",
              claims: [],
              notes: "",
            });
            setSelected([{ type: "province", id }]);
          } else {
            if (
              w.lands.some((l) => area(intersect(geometry, l.geometry)) > 0.05)
            )
              throw new Error(
                "This land overlaps an existing coastline. Draw on the ocean or edit its vertices.",
              );
            const id = uid();
            w.lands.push({
              id,
              name: `Landmass ${w.lands.length + 1}`,
              geometry,
              layerId: "land",
            });
            setSelected([{ type: "land", id }]);
          }
          return w;
        },
      );
      return;
    }
    if (
      ![
        "river",
        "road",
        "mountain",
        "forest",
        "city",
        "castle",
        "label",
        "biome",
      ].includes(drawTool)
    )
      return;
    if (["river", "road"].includes(drawTool) && points.length < 2) return;
    if (drawTool === "biome") {
      const error = validateGeometry(polygon(points));
      if (error) {
        notify(
          "Draw a biome with at least three points and no crossing boundaries.",
          true,
        );
        return;
      }
    }
    const kind = drawTool as Feature["kind"];
    const layerId = {
      river: layerIds.waterways,
      road: layerIds.routes,
      mountain: layerIds.terrain,
      forest: layerIds.terrain,
      city: layerIds.settlements,
      castle: layerIds.settlements,
      label: layerIds.labels,
      image: layerIds.terrain,
      biome: layerIds.terrain,
    }[kind];
    changeWorld(`Added ${kind}`, (w) => {
      requireUnlocked(layerId);
      const groups = ["mountain", "forest"].includes(kind)
        ? points.map((p) => [p])
        : [points];
      const features = groups.map((pts) => ({
        id: uid(),
        name:
          kind === "label"
            ? "Your story here"
            : `${kind[0].toUpperCase() + kind.slice(1)} ${w.features.filter((f) => f.kind === kind).length + 1}`,
        kind,
        points: pts,
        layerId,
        size: brushSize,
        color:
          kind === "river"
            ? "#688e94"
            : kind === "biome"
              ? "#b5a877"
              : "#514a3c",
        rotation: 0,
        notes: "",
        countryId:
          w.provinces.find((p) => pointInside(pts[0], p.geometry))?.countryId ||
          "",
      }));
      w.features.push(...features);
      if (["city", "castle", "label"].includes(kind))
        setSelected([{ type: "feature", id: features[0].id }]);
      return w;
    });
  };
  const onVertex = (s: Selected, from: Point, to: Point) =>
    changeWorld("Reshaped boundary", (w) => {
      if (s.type === "province") return moveSharedVertex(w, s.id, from, to);
      const land = w.lands.find((l) => l.id === s.id);
      if (!land) return w;
      requireUnlocked(land.layerId);
      // Coastlines that carry a province boundary are edited through the same shared vertex operation.
      const shared = w.provinces.find((p) =>
        p.geometry
          .flat(2)
          .some((v) => Math.hypot(v[0] - from[0], v[1] - from[1]) < 0.01),
      );
      if (shared) return moveSharedVertex(w, shared.id, from, to);
      land.geometry.forEach((poly) =>
        poly.forEach((r) =>
          r.forEach((v) => {
            if (Math.hypot(v[0] - from[0], v[1] - from[1]) < 0.01) {
              v[0] = to[0];
              v[1] = to[1];
            }
          }),
        ),
      );
      const error = validateGeometry(land.geometry);
      if (error) throw new Error(error);
      if (
        w.lands.some(
          (l) =>
            l.id !== land.id &&
            area(intersect(l.geometry, land.geometry)) > 0.05,
        )
      )
        throw new Error("This coastline would overlap another landmass.");
      return w;
    });
  const onMove = (s: Selected, dx: number, dy: number) =>
    changeWorld("Moved map feature", (w) => {
      const f = w.features.find((f) => f.id === s.id);
      if (f) {
        requireUnlocked(f.layerId);
        f.points = f.points.map((p) => [p[0] + dx, p[1] + dy]);
      }
      return w;
    });
  const selectedObject =
    selected[0]?.type === "province"
      ? world.provinces.find((p) => p.id === selected[0].id)
      : selected[0]?.type === "land"
        ? world.lands.find((p) => p.id === selected[0].id)
        : world.features.find((p) => p.id === selected[0]?.id);
  const province =
    selected[0]?.type === "province"
      ? world.provinces.find((p) => p.id === selected[0].id)
      : null;
  const feature =
    selected[0]?.type === "feature"
      ? world.features.find((p) => p.id === selected[0].id)
      : null;
  const country = world.countries.find((c) => c.id === selectedCountry);
  const updateObject = (key: string, value: unknown) =>
    changeWorld(`Updated ${key}`, (w) => {
      const s = selected[0];
      const obj =
        s?.type === "province"
          ? w.provinces.find((p) => p.id === s.id)
          : s?.type === "land"
            ? w.lands.find((p) => p.id === s.id)
            : w.features.find((p) => p.id === s?.id);
      if (obj) {
        requireUnlocked(obj.layerId);
        if (key === "layerId") requireUnlocked(String(value));
        Object.assign(obj, { [key]: value });
      }
      return w;
    });
  const updateCountry = (key: keyof Country, value: Country[keyof Country]) =>
    changeWorld(`Updated country ${key}`, (w) => {
      const c = w.countries.find((c) => c.id === country?.id);
      if (c) Object.assign(c, { [key]: value });
      return w;
    });
  const transfer = (id: string) =>
    changeWorld("Transferred territory", (w) => {
      const ids = selected
        .filter((s) => s.type === "province")
        .map((s) => s.id);
      w.provinces
        .filter((p) => ids.includes(p.id))
        .forEach((p) => requireUnlocked(p.layerId));
      return transferProvinces(w, ids, id);
    });
  const merge = () =>
    changeWorld("Merged provinces", (w) => {
      const ids = selected
        .filter((s) => s.type === "province")
        .map((s) => s.id);
      w.provinces
        .filter((p) => ids.includes(p.id))
        .forEach((p) => requireUnlocked(p.layerId));
      const result = mergeProvinces(w, ids);
      setSelected([{ type: "province", id: result.provinces.at(-1)!.id }]);
      return result;
    });
  const duplicateFeature = () =>
    changeWorld("Duplicated map feature", (w) => {
      if (!feature) return w;
      requireUnlocked(feature.layerId);
      const f = {
        ...clone(feature),
        id: uid(),
        name: `${feature.name} copy`,
        points: feature.points.map(([x, y]) => [x + 20, y + 20] as Point),
      };
      w.features.push(f);
      setSelected([{ type: "feature", id: f.id }]);
      return w;
    });
  const createView = () => {
    if (!selectedObject || !("geometry" in selectedObject)) {
      notify(
        "Select a landmass or province to create a linked regional view.",
        true,
      );
      return;
    }
    const b = bounds(selectedObject.geometry);
    const pad = Math.max(b[2] - b[0], b[3] - b[1]) * 0.12;
    ask(
      "Create a linked map",
      "Map name",
      `${selectedObject.name} region`,
      (name) =>
        changeWorld("Created linked map", (w) => {
          const id = uid();
          w.views.push({
            id,
            name,
            parentId: activeView,
            bounds: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad],
          });
          setActiveView(id);
          return w;
        }),
    );
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        modal ||
        inputDialog ||
        confirmDialog
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          setHistory(redo);
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          manualSave();
        }
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          setModal("search");
          setSearch("");
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selected.length) deleteSelection();
      }
      if (e.key === "Escape") {
        setSelected([]);
        setSelectedCountry(null);
        setTool("select");
      }
      const match = allTools.find(
        (t) => t.key?.toLowerCase() === e.key.toLowerCase(),
      );
      if (match) setTool(match.tool);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal, inputDialog, confirmDialog, selected, deleteSelection, project]);
  const importFile = async (file: File) => {
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error(
          "Import files up to 32 MB. Split larger datasets before importing.",
        );
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        if (file.size > 2 * 1024 * 1024)
          throw new Error("Use an image under 2 MB for reliable local saving.");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the image."));
          reader.readAsDataURL(file);
        });
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Unsupported image."));
          image.src = dataUrl;
        });
        const width = 400,
          height = (width * image.naturalHeight) / image.naturalWidth;
        changeWorld("Imported image asset", (w) => {
          if (!w.layers.some((l) => l.id === "references"))
            w.layers.push({
              id: "references",
              name: "Images & references",
              visible: true,
              locked: false,
              opacity: 1,
            });
          requireUnlocked("references");
          const id = uid();
          w.features.push({
            id,
            name: file.name,
            kind: "image",
            points: [[600, 410]],
            layerId: "references",
            size: 1,
            color: "#514a3c",
            rotation: 0,
            notes:
              "Imported reference image. Move to another layer to use it as a custom symbol.",
            countryId: "",
            asset: { dataUrl, width, height },
          });
          setSelected([{ type: "feature", id }]);
          return w;
        });
        setModal(null);
        notify(
          "Image imported as an editable reference. Change its layer to use it as a custom symbol.",
        );
        return;
      }
      const data = JSON.parse(await file.text());
      if (data.type === "FeatureCollection") {
        const incoming: World["lands"] = [];
        for (const f of data.features || []) {
          if (!["Polygon", "MultiPolygon"].includes(f.geometry?.type))
            throw new Error(
              "This import supports Polygon and MultiPolygon GeoJSON. Other geometry types must be imported separately.",
            );
          const geometry =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates]
              : f.geometry.coordinates;
          const error = validateGeometry(geometry);
          if (error) throw new Error(error);
          incoming.push({
            id: uid(),
            name: String(f.properties?.name || "Imported land"),
            layerId: "land",
            geometry,
          });
        }
        if (!incoming.length)
          throw new Error("The GeoJSON contains no polygons.");
        const b = bounds(incoming.flatMap((l) => l.geometry));
        const scale = Math.min(
          850 / Math.max(1, b[2] - b[0]),
          480 / Math.max(1, b[3] - b[1]),
        );
        incoming.forEach((l) =>
          l.geometry.forEach((p) =>
            p.forEach((r) =>
              r.forEach((v) => {
                v[0] = 175 + (v[0] - b[0]) * scale;
                v[1] = 650 - (v[1] - b[1]) * scale;
              }),
            ),
          ),
        );
        const p = blankProject(file.name.replace(/\.[^.]+$/, ""));
        p.world.lands = incoming;
        load(p);
        notify(
          `Imported ${incoming.length} editable land polygons. GeoJSON coordinates were fitted to the map canvas.`,
        );
      } else {
        const p = validateProject(data);
        p.id = uid();
        p.updatedAt = Date.now();
        load(p);
        notify(
          "Project imported. All geometry and historical snapshots preserved.",
        );
      }
    } catch (e) {
      notify(`Import failed: ${(e as Error).message}`, true);
    }
  };
  const exportMap = async () => {
    setExporting(true);
    try {
      const filename = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (exportFormat === "project") {
        download(`${filename}.atlas.json`, JSON.stringify(project, null, 2));
        notify("Editable project backup exported.");
        setModal(null);
        return;
      }
      if (exportFormat === "geojson") {
        download(
          `${filename}.geojson`,
          JSON.stringify(
            {
              type: "FeatureCollection",
              coordinateSystem:
                "Atlas Forge canvas coordinates, not geographic longitude/latitude",
              features: [
                ...world.lands.map((l) => ({
                  type: "Feature",
                  properties: { id: l.id, name: l.name, kind: "land" },
                  geometry: { type: "MultiPolygon", coordinates: l.geometry },
                })),
                ...world.provinces.map((p) => ({
                  type: "Feature",
                  properties: {
                    id: p.id,
                    name: p.name,
                    country: world.countries.find((c) => c.id === p.countryId)
                      ?.name,
                    kind: "province",
                  },
                  geometry: { type: "MultiPolygon", coordinates: p.geometry },
                })),
              ],
            },
            null,
            2,
          ),
        );
        notify("Map geometry exported as GeoJSON in canvas coordinates.");
        setModal(null);
        return;
      }
      const view =
        exportView === "world"
          ? [0, 0, 1200, 820]
          : world.views.find((v) => v.id === exportView)?.bounds || [
              0, 0, 1200, 820,
            ];
      const w = view[2] - view[0],
        h = view[3] - view[1];
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={Math.round(w * exportScale)}
          height={Math.round(h * exportScale)}
          viewBox={`${view[0]} ${view[1]} ${w} ${h}`}
        >
          <MapContent world={world} title={project.name} interactive={false} />
        </svg>,
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const node = container.querySelector("svg")!;
      if (transparent) {
        node.querySelectorAll("rect").forEach((r) => {
          if (
            r.getAttribute("x") === "-10000" ||
            ["url(#sea-lines)", "url(#paper-grain)", "url(#map-grid)"].includes(
              r.getAttribute("fill") || "",
            )
          )
            r.remove();
        });
      }
      const xml = new XMLSerializer().serializeToString(node);
      root.unmount();
      container.remove();
      if (exportFormat === "svg") {
        download(`${filename}.svg`, xml, "image/svg+xml");
      } else {
        const image = new Image();
        const url = URL.createObjectURL(
          new Blob([xml], { type: "image/svg+xml" }),
        );
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(
              new Error("The map image could not be rendered. Try SVG export."),
            );
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * exportScale);
        canvas.height = Math.round(h * exportScale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        if (exportFormat === "pdf") {
          const win = window.open("", "atlas-forge-print");
          if (!win) throw new Error("Allow pop-ups to open the print view.");
          win.document.write(
            `<html><head><title>${filename}</title><style>@page{size:landscape;margin:0}body{margin:0;display:grid;place-items:center}img{width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${canvas.toDataURL("image/png")}"/></body></html>`,
          );
          win.document.close();
          const img = win.document.querySelector("img")!;
          img.onload = () => win.print();
        } else {
          const blob = await new Promise<Blob | null>((r) =>
            canvas.toBlob(r, "image/png"),
          );
          if (!blob) throw new Error("PNG export failed.");
          download(`${filename}.png`, blob);
        }
      }
      notify(
        exportFormat === "pdf"
          ? "Print view opened. Choose Save as PDF in your browser."
          : `${exportFormat.toUpperCase()} map exported with the visible layers.`,
      );
      setModal(null);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setExporting(false);
    }
  };
  const checkedLayerCount = world.layers.filter((l) => l.visible).length;
  const searchItems = [
    ...allTools.map((t) => ({
      name: t.name,
      category: "Tool",
      icon: t.icon,
      action: () => setTool(t.tool),
    })),
    ...world.countries.map((c) => ({
      name: c.name,
      category: "Country",
      icon: Flag,
      action: () => {
        setSelectedCountry(c.id);
        setSelected([]);
        setTab("world");
      },
    })),
    ...world.provinces.map((p) => ({
      name: p.name,
      category: "Province",
      icon: MapPinned,
      action: () => {
        setSelected([{ type: "province", id: p.id }]);
        setSelectedCountry(null);
      },
    })),
    ...world.features.map((f) => ({
      name: f.name,
      category: f.kind,
      icon: MapPinned,
      action: () => {
        setSelected([{ type: "feature", id: f.id }]);
        setSelectedCountry(null);
      },
    })),
    {
      name: "New world",
      category: "Project",
      icon: FilePlus2,
      action: () => setModal("new"),
    },
    {
      name: "Import image reference / symbol",
      category: "Project",
      icon: Upload,
      action: () => importRef.current?.click(),
    },
    {
      name: "Export map",
      category: "Project",
      icon: Download,
      action: () => setModal("export"),
    },
    {
      name: "Validate project",
      category: "Project",
      icon: CheckCheck,
      action: () => void validateCurrentProject(),
    },
    {
      name: "Historical snapshots",
      category: "World",
      icon: HistoryIcon,
      action: () => setModal("timeline"),
    },
  ].filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const guide = [
    {
      title: "A world that belongs to you",
      text: "This is an editable atlas. Explore its countries, move a city, or start a blank world from the project menu.",
      tool: "select" as Tool,
    },
    {
      title: "Shape the geography",
      text: "Choose Draw land and drag a coastline in the sea. Rivers, forests, and mountains live on separate layers.",
      tool: "land" as Tool,
    },
    {
      title: "Every border tells a story",
      text: "Select a province, choose Split province, and click two points across it. Change its owner in the properties panel.",
      tool: "split" as Tool,
    },
    {
      title: "Keep your world safe",
      text: "Changes save automatically on this device. Use Export → Editable project for a portable backup, including your historical snapshots.",
      tool: "select" as Tool,
    },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          title="Open your worlds"
          onClick={openProjects}
        >
          <div className="brand-mark">
            <CompassLogo />
          </div>
          <span>
            ATLAS<span className="brand-forge">FORGE</span>
          </span>
        </button>
        <div className="header-divider" />
        <div className="project-menu-wrap">
          <button className="project-title" onClick={() => setMenu(!menu)}>
            <span>{project.name}</span>
            <ChevronDown size={13} />
          </button>
          <span className="project-tag">WORLD PROJECT</span>
          {menu && (
            <>
              <div className="menu-dismiss" onClick={() => setMenu(false)} />
              <div className="dropdown project-dropdown">
                {[
                  {
                    name: "New world",
                    icon: FilePlus2,
                    action: () => setModal("new"),
                  },
                  {
                    name: "Open a world",
                    icon: FolderOpen,
                    action: openProjects,
                  },
                  {
                    name: "Rename project",
                    icon: Pencil,
                    action: renameProject,
                  },
                  { name: "Save project", icon: Save, action: manualSave },
                  {
                    name: "Validate project",
                    icon: CheckCheck,
                    action: () => void validateCurrentProject(),
                  },
                  {
                    name: "Duplicate project",
                    icon: Copy,
                    action: () => {
                      const copy = clone(project);
                      copy.id = uid();
                      copy.name += " copy";
                      load(copy);
                      notify("Project duplicated.");
                    },
                  },
                  {
                    name: "Import project / GeoJSON",
                    icon: Upload,
                    action: () => importRef.current?.click(),
                  },
                  {
                    name: "Import image / custom symbol",
                    icon: Upload,
                    action: () => importRef.current?.click(),
                  },
                  {
                    name: "Export map or backup",
                    icon: Download,
                    action: () => setModal("export"),
                  },
                  ...(saveFailed.current
                    ? [
                        {
                          name: "Recover local storage",
                          icon: HistoryIcon,
                          action: () =>
                            setConfirmDialog({
                              title: "Back up and reset unreadable storage?",
                              description:
                                "The original storage will be downloaded as a recovery file before a fresh copy of your active project is saved. Keep the recovery file to recover other project records.",
                              action: () => {
                                try {
                                  download(
                                    "atlas-forge-storage-recovery.json",
                                    localStorage.getItem(
                                      "atlas-forge-projects-v1",
                                    ) || "[]",
                                  );
                                  localStorage.setItem(
                                    "atlas-forge-projects-v1",
                                    JSON.stringify([project]),
                                  );
                                  saveFailed.current = false;
                                  setSaveStatus("All changes saved");
                                  notify(
                                    "Recovery backup downloaded. Local saving has resumed.",
                                  );
                                } catch (e) {
                                  notify((e as Error).message, true);
                                }
                              },
                            }),
                        },
                      ]
                    : []),
                ].map((i) => (
                  <button
                    key={i.name}
                    onClick={() => {
                      setMenu(false);
                      i.action();
                    }}
                  >
                    <i.icon size={15} />
                    {i.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="save-indicator">
          <span
            className={
              saveStatus === "Save failed" ? "status-error" : "status-dot"
            }
          />
          {saveStatus}
        </div>
        <div className="header-spacer" />
        <button
          className="search-trigger"
          onClick={() => {
            setSearch("");
            setModal("search");
          }}
        >
          <Search size={15} />
          <span>Search your world...</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className="icon-button help-button"
          title="Worldbuilding guide"
          onClick={() => setModal("guide")}
        >
          <CircleHelp size={18} />
        </button>
        <button className="export-button" onClick={() => setModal("export")}>
          <Download size={15} />
          Export map
          <ChevronDown size={13} />
        </button>
      </header>
      <div className="workspace-toolbar">
        <div className="toolbar-left">
          <button
            className="icon-button"
            title="Toggle world panel"
            onClick={() => setLeftOpen(!leftOpen)}
          >
            <PanelLeftClose size={16} />
          </button>
          <span className="toolbar-label">WORKSPACE</span>
          <span className="toolbar-divider" />
          <button
            className="undo-button"
            title="Undo (Ctrl+Z)"
            disabled={!history.past.length}
            onClick={() => setHistory(undo)}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="undo-button"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!history.future.length}
            onClick={() => setHistory(redo)}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-center">
          <MapIcon size={14} />
          <select
            aria-label="Active map view"
            value={activeView}
            onChange={(e) => {
              setActiveView(e.target.value);
              setSelected([]);
            }}
          >
            {world.views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
          <span className="toolbar-divider" />
          <span className="view-note">
            {world.provinces.length} provinces · {world.countries.length}{" "}
            countries
          </span>
        </div>
        <div className="toolbar-right">
          <button
            className={`mode-button ${!advanced ? "active" : ""}`}
            onClick={() => setAdvanced(!advanced)}
          >
            <Sparkles size={13} />
            {advanced ? "Advanced mode" : "Simple mode"}
          </button>
          <span className="toolbar-divider" />
          <button
            className={`icon-button ${world.grid ? "active" : ""}`}
            title="Toggle map grid"
            onClick={() =>
              changeWorld("Toggled grid", (w) => ({ ...w, grid: !w.grid }))
            }
          >
            <Grid3X3 size={15} />
          </button>
          <button
            className="icon-button"
            title="Historical snapshots"
            onClick={() => setModal("timeline")}
          >
            <HistoryIcon size={16} />
          </button>
        </div>
      </div>
      <main className="workspace">
        {leftOpen && (
          <aside className="left-panel">
            <div className="panel-title">
              <span>YOUR WORLD</span>
              <button
                className="icon-button"
                title="New world"
                onClick={() => setModal("new")}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="left-tabs">
              <button
                className={tab === "layers" ? "active" : ""}
                onClick={() => setTab("layers")}
              >
                <Layers size={14} />
                Layers<span>{world.layers.length}</span>
              </button>
              <button
                className={tab === "world" ? "active" : ""}
                onClick={() => setTab("world")}
              >
                <Flag size={14} />
                Countries<span>{world.countries.length}</span>
              </button>
            </div>
            <div className="panel-scroll">
              {tab === "layers" ? (
                <>
                  <div className="section-heading">
                    <span>MAP LAYERS</span>
                    <button
                      title="Add layer"
                      onClick={() =>
                        ask(
                          "Create a layer",
                          "Layer name",
                          "New layer",
                          (name) =>
                            changeWorld("Created layer", (w) => {
                              w.layers.unshift({
                                id: uid(),
                                name,
                                visible: true,
                                locked: false,
                                opacity: 1,
                              });
                              return w;
                            }),
                        )
                      }
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="layer-list">
                    {world.layers.map((l) => {
                      const Icon = objectIcons[l.id] || Layers;
                      const objects = [
                        ...world.features.filter((f) => f.layerId === l.id),
                        ...world.provinces.filter((p) => p.layerId === l.id),
                        ...world.lands.filter((p) => p.layerId === l.id),
                      ];
                      return (
                        <div
                          key={l.id}
                          className={`layer-group ${!l.visible ? "layer-hidden" : ""}`}
                        >
                          <div className="layer-row">
                            <button
                              className="layer-expand"
                              title={`Expand ${l.name}`}
                              onClick={() =>
                                setExpandedLayer(
                                  expandedLayer === l.id ? null : l.id,
                                )
                              }
                            >
                              {expandedLayer === l.id ? (
                                <ChevronDown size={11} />
                              ) : (
                                <ChevronRight size={11} />
                              )}
                            </button>
                            <Icon size={15} />
                            <button
                              className="layer-name"
                              onDoubleClick={() =>
                                ask(
                                  "Rename layer",
                                  "Layer name",
                                  l.name,
                                  (name) =>
                                    changeWorld("Renamed layer", (w) => {
                                      w.layers.find(
                                        (x) => x.id === l.id,
                                      )!.name = name;
                                      return w;
                                    }),
                                )
                              }
                              onClick={() =>
                                setExpandedLayer(
                                  expandedLayer === l.id ? null : l.id,
                                )
                              }
                            >
                              {l.name}
                            </button>
                            <button
                              className={`layer-control ${l.locked ? "is-locked" : ""}`}
                              title={l.locked ? "Unlock layer" : "Lock layer"}
                              onClick={() =>
                                changeWorld("Changed layer lock", (w) => {
                                  w.layers.find((x) => x.id === l.id)!.locked =
                                    !l.locked;
                                  return w;
                                })
                              }
                            >
                              {l.locked ? (
                                <LockKeyhole size={12} />
                              ) : (
                                <UnlockKeyhole size={12} />
                              )}
                            </button>
                            <button
                              className="layer-control visibility"
                              title={
                                l.visible ? `Hide ${l.name}` : `Show ${l.name}`
                              }
                              onClick={() =>
                                changeWorld("Changed layer visibility", (w) => {
                                  w.layers.find((x) => x.id === l.id)!.visible =
                                    !l.visible;
                                  return w;
                                })
                              }
                            >
                              {l.visible ? (
                                <Eye size={13} />
                              ) : (
                                <EyeOff size={13} />
                              )}
                            </button>
                          </div>
                          {expandedLayer === l.id && (
                            <div className="layer-details">
                              <div className="layer-settings">
                                <input
                                  title="Layer opacity"
                                  type="range"
                                  min="0"
                                  max="1"
                                  step=".05"
                                  value={l.opacity}
                                  onChange={(e) =>
                                    changeWorld(
                                      "Changed layer opacity",
                                      (w) => {
                                        w.layers.find(
                                          (x) => x.id === l.id,
                                        )!.opacity = +e.target.value;
                                        return w;
                                      },
                                    )
                                  }
                                />
                                <span>{Math.round(l.opacity * 100)}%</span>
                                <button
                                  title="Move layer up"
                                  onClick={() =>
                                    changeWorld("Reordered layer", (w) => {
                                      const i = w.layers.findIndex(
                                        (x) => x.id === l.id,
                                      );
                                      if (i > 0)
                                        [w.layers[i], w.layers[i - 1]] = [
                                          w.layers[i - 1],
                                          w.layers[i],
                                        ];
                                      return w;
                                    })
                                  }
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  title="Move layer down"
                                  onClick={() =>
                                    changeWorld("Reordered layer", (w) => {
                                      const i = w.layers.findIndex(
                                        (x) => x.id === l.id,
                                      );
                                      if (i < w.layers.length - 1)
                                        [w.layers[i], w.layers[i + 1]] = [
                                          w.layers[i + 1],
                                          w.layers[i],
                                        ];
                                      return w;
                                    })
                                  }
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>
                              <button
                                className="text-action"
                                onClick={() =>
                                  ask(
                                    "Rename layer",
                                    "Layer name",
                                    l.name,
                                    (name) =>
                                      changeWorld("Renamed layer", (w) => {
                                        w.layers.find(
                                          (x) => x.id === l.id,
                                        )!.name = name;
                                        return w;
                                      }),
                                  )
                                }
                              >
                                Rename layer
                              </button>
                              {objects.slice(0, 40).map((o) => (
                                <button
                                  className="layer-object"
                                  key={o.id}
                                  onClick={() =>
                                    onSelect({
                                      id: o.id,
                                      type:
                                        "kind" in o
                                          ? "feature"
                                          : "countryId" in o
                                            ? "province"
                                            : "land",
                                    })
                                  }
                                >
                                  <span />
                                  {o.name}
                                </button>
                              ))}
                              {objects.length > 40 && (
                                <small>
                                  {objects.length - 40} more objects · search to
                                  find one
                                </small>
                              )}
                              {!objects.length && (
                                <small>No objects on this layer yet.</small>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="layer-footer">
                    <Layers size={12} />
                    {checkedLayerCount} visible layers
                    <span>Drag the story forward.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="country-search">
                    <Search size={13} />
                    <input
                      placeholder="Find a country..."
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                    />
                  </div>
                  <div className="section-heading">
                    <span>POLITICAL ENTITIES</span>
                    <button
                      title="Create country"
                      onClick={() => setModal("country")}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {world.countries
                    .filter((c) =>
                      c.name
                        .toLowerCase()
                        .includes(countryFilter.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className={`country-row ${selectedCountry === c.id ? "active" : ""}`}
                        onClick={() => {
                          setSelectedCountry(c.id);
                          setSelected([]);
                        }}
                      >
                        <span
                          className="country-swatch"
                          style={{ background: c.color }}
                        />
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {
                              world.provinces.filter(
                                (p) => p.countryId === c.id,
                              ).length
                            }{" "}
                            provinces · {c.government}
                          </small>
                        </div>
                        <ChevronRight size={13} />
                      </button>
                    ))}
                  <button
                    className="add-country"
                    onClick={() => setModal("country")}
                  >
                    <Plus size={14} />
                    Create a country
                  </button>
                </>
              )}
              <div className="section-heading linked-heading">
                <span>LINKED MAPS</span>
                <button
                  title="Create linked map from selection"
                  onClick={createView}
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="linked-maps">
                {world.views.map((v) => (
                  <button
                    key={v.id}
                    className={activeView === v.id ? "active" : ""}
                    onClick={() => {
                      setActiveView(v.id);
                      setSelected([]);
                    }}
                  >
                    <span className="linked-line">
                      {v.parentId ? (
                        <ChevronRight size={12} />
                      ) : (
                        <MapIcon size={14} />
                      )}
                    </span>
                    {v.name}
                    <span className="map-level">
                      {v.parentId ? "REGION" : "WORLD"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="style-preview">
                <div className="section-heading">
                  <span>MAP STYLE</span>
                  <SlidersHorizontal size={12} />
                </div>
                <div className="style-preview-image">
                  <Thumbnail world={world} />
                  <div className="style-label">
                    {styleNames[world.style]}
                    <span>LIVE STYLE</span>
                  </div>
                </div>
                <select
                  aria-label="Map style"
                  value={world.style}
                  onChange={(e) =>
                    changeWorld("Changed map style", (w) => ({
                      ...w,
                      style: e.target.value as Style,
                    }))
                  }
                >
                  {Object.entries(styleNames).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="guide-card" onClick={() => setModal("guide")}>
              <span className="guide-icon">
                <BookOpen size={18} />
              </span>
              <span>
                <strong>A little help. A bigger world.</strong>
                <small>
                  Explore the worldbuilding guide <ArrowUpRight size={11} />
                </small>
              </span>
            </button>
          </aside>
        )}
        <nav className="drawing-toolbar" aria-label="Drawing tools">
          {toolGroups.map((group, i) => (
            <div className="tool-group" key={i}>
              {group
                .filter(
                  (t) =>
                    advanced ||
                    !["vertex", "split", "rectangle", "erase"].includes(t.tool),
                )
                .map((t) => (
                  <button
                    key={t.tool}
                    className={`tool-button ${tool === t.tool ? "active" : ""}`}
                    aria-label={t.name}
                    aria-pressed={tool === t.tool}
                    title={`${t.name}${t.key ? ` (${t.key})` : ""}`}
                    onClick={() => setTool(t.tool)}
                  >
                    <t.icon size={18} />
                    <span className="tool-tooltip">
                      {t.name}
                      {t.key && <kbd>{t.key}</kbd>}
                    </span>
                  </button>
                ))}
            </div>
          ))}
          <div className="tool-bottom">
            <button
              className="tool-button"
              title="Draw an elliptical island"
              aria-label="Ellipse land"
              onClick={() => setTool("ellipse")}
            >
              <CircleIsland />
            </button>
          </div>
        </nav>
        <div className="canvas-column">
          <div className="canvas-context">
            <div>
              <span className="context-dot" />
              <strong>
                {allTools.find((t) => t.tool === tool)?.name || "Ellipse land"}
              </strong>
              <span className="context-hint">
                {tool === "select"
                  ? "Click an object to explore its properties"
                  : tool === "split"
                    ? "Select a province · draw a dividing line"
                    : tool === "vertex"
                      ? "Precise geometry · shared boundaries"
                      : "Make your mark on the world"}
              </span>
            </div>
            {[
              "mountain",
              "forest",
              "river",
              "road",
              "land",
              "city",
              "castle",
              "label",
              "biome",
            ].includes(tool) ? (
              <label className="brush-control">
                Size
                <input
                  type="range"
                  min=".3"
                  max="3"
                  step=".1"
                  value={brushSize}
                  onChange={(e) => setBrushSize(+e.target.value)}
                />
                <span>{brushSize.toFixed(1)}</span>
              </label>
            ) : (
              <button
                className="subtle-button"
                onClick={() => {
                  setSearch("");
                  setModal("search");
                }}
              >
                <Command size={12} />
                Tool finder
              </button>
            )}
          </div>
          <MapCanvas
            ref={svgRef}
            world={world}
            title={project.name}
            tool={tool}
            selected={selected}
            brushSize={brushSize}
            viewBounds={
              activeView === "world"
                ? null
                : world.views.find((v) => v.id === activeView)?.bounds || null
            }
            comparison={
              comparison
                ? project.snapshots.find((s) => s.id === comparison)?.world ||
                  null
                : null
            }
            onSelect={onSelect}
            onDraw={onDraw}
            onVertex={onVertex}
            onVertexAction={(action, p) =>
              changeWorld(
                action === "insert"
                  ? "Inserted boundary vertex"
                  : "Removed boundary vertex",
                (w) =>
                  action === "insert"
                    ? insertBoundaryVertex(w, p)
                    : removeBoundaryVertex(w, p),
              )
            }
            onMove={onMove}
            onCoordinates={setCoordinates}
          />
          {comparison && (
            <div className="compare-banner">
              <HistoryIcon size={14} />
              Comparing with{" "}
              {project.snapshots.find((s) => s.id === comparison)?.name} ·
              changed ownership is highlighted
              <button onClick={() => setComparison(null)}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <aside
          className={`right-panel ${selectedObject || country ? "has-selection" : ""}`}
        >
          <div className="panel-title">
            <span>
              {selectedObject
                ? "OBJECT PROPERTIES"
                : country
                  ? "COUNTRY PROPERTIES"
                  : "WORLD PROPERTIES"}
            </span>
            <Settings2 size={14} />
          </div>
          <div className="inspector-scroll">
            {country ? (
              <>
                <div className="entity-heading">
                  <div
                    className="entity-symbol"
                    style={{
                      background: country.color + "30",
                      color: country.color,
                    }}
                  >
                    <Flag size={23} />
                  </div>
                  <small>{country.government}</small>
                  <h2>{country.name}</h2>
                  <span>
                    {
                      world.provinces.filter((p) => p.countryId === country.id)
                        .length
                    }{" "}
                    provinces in this realm
                  </span>
                </div>
                <section className="inspector-section">
                  <h3>Identity</h3>
                  <Field label="Country name">
                    <input
                      value={country.name}
                      onChange={(e) => updateCountry("name", e.target.value)}
                    />
                  </Field>
                  <div className="field-row">
                    <Field label="Map color">
                      <div className="color-input">
                        <input
                          type="color"
                          value={country.color}
                          onChange={(e) =>
                            updateCountry("color", e.target.value)
                          }
                        />
                        <span>{country.color.toUpperCase()}</span>
                      </div>
                    </Field>
                  </div>
                  <Field label="Government">
                    <input
                      value={country.government}
                      onChange={(e) =>
                        updateCountry("government", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Ruler / leader">
                    <input
                      value={country.ruler}
                      onChange={(e) => updateCountry("ruler", e.target.value)}
                    />
                  </Field>
                  <Field label="Capital">
                    <input
                      value={country.capital}
                      onChange={(e) => updateCountry("capital", e.target.value)}
                    />
                  </Field>
                  <Field label="Parent realm">
                    <select
                      value={country.parentId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        let parent = world.countries.find((c) => c.id === id);
                        const seen = new Set([country.id]);
                        while (parent) {
                          if (seen.has(parent.id)) {
                            notify(
                              "A political hierarchy cannot contain a cycle.",
                              true,
                            );
                            return;
                          }
                          seen.add(parent.id);
                          parent = world.countries.find(
                            (c) => c.id === parent?.parentId,
                          );
                        }
                        updateCountry("parentId", id || null);
                      }}
                    >
                      <option value="">Independent</option>
                      {world.countries
                        .filter((c) => c.id !== country.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Description & lore">
                    <textarea
                      rows={4}
                      value={country.description}
                      placeholder="Tell this country's story..."
                      onChange={(e) =>
                        updateCountry("description", e.target.value)
                      }
                    />
                  </Field>
                </section>
                <section className="inspector-section">
                  <h3>Provinces</h3>
                  {world.provinces
                    .filter((p) => p.countryId === country.id)
                    .map((p) => (
                      <button
                        className="province-link"
                        key={p.id}
                        onClick={() => onSelect({ type: "province", id: p.id })}
                      >
                        <MapPinned size={13} />
                        {p.name}
                        <ChevronRight size={12} />
                      </button>
                    ))}
                  <Field label="Unite with another country">
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        setConfirmDialog({
                          title: "Unite these countries?",
                          description: `All provinces of ${country.name} will transfer to ${world.countries.find((c) => c.id === id)?.name}. The operation can be undone.`,
                          action: () =>
                            changeWorld("United countries", (w) => {
                              w.provinces
                                .filter((p) => p.countryId === country.id)
                                .forEach((p) => {
                                  requireUnlocked(p.layerId);
                                  p.countryId = id;
                                });
                              w.countries = w.countries.filter(
                                (c) => c.id !== country.id,
                              );
                              w.countries.forEach((c) => {
                                if (c.parentId === country.id) c.parentId = id;
                              });
                              w.provinces.forEach((p) => {
                                p.claims = p.claims.filter(
                                  (c) => c !== country.id,
                                );
                              });
                              setSelectedCountry(id);
                              return w;
                            }),
                        });
                      }}
                    >
                      <option value="">Choose a country...</option>
                      {world.countries
                        .filter((c) => c.id !== country.id)
                        .map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </section>
              </>
            ) : selectedObject ? (
              <>
                <div className="entity-heading">
                  <div className="entity-symbol">
                    <MapPinned size={23} />
                  </div>
                  <small>
                    {selected[0].type === "province"
                      ? "POLITICAL TERRITORY"
                      : feature
                        ? feature.kind.toUpperCase()
                        : "LANDMASS"}
                  </small>
                  <h2>{selectedObject.name}</h2>
                  {selected.length > 1 ? (
                    <span>{selected.length} objects selected</span>
                  ) : (
                    <span>
                      {province
                        ? world.countries.find(
                            (c) => c.id === province.countryId,
                          )?.name
                        : feature
                          ? "A detail worth remembering"
                          : "The shape of your world"}
                    </span>
                  )}
                </div>
                <section className="inspector-section">
                  <h3>General</h3>
                  <Field label="Name">
                    <input
                      aria-label="Object name"
                      value={selectedObject.name}
                      onChange={(e) => updateObject("name", e.target.value)}
                    />
                  </Field>
                  {province && (
                    <>
                      <Field label="Territorial owner">
                        <select
                          aria-label="Territorial owner"
                          value={province.countryId}
                          onChange={(e) => transfer(e.target.value)}
                        >
                          {world.countries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="property-stat">
                        <span>Area</span>
                        <strong>
                          {Math.round(area(province.geometry)).toLocaleString()}{" "}
                          map units²
                        </strong>
                      </div>
                      {advanced && (
                        <>
                          <h3 className="subsection-title">
                            Territory operations
                          </h3>
                          <div className="action-grid">
                            <button onClick={() => setTool("split")}>
                              <Scissors size={14} />
                              Split
                            </button>
                            <button onClick={() => setTool("vertex")}>
                              <Spline size={14} />
                              Edit border
                            </button>
                            <button
                              disabled={
                                selected.filter((s) => s.type === "province")
                                  .length < 2
                              }
                              onClick={merge}
                            >
                              <Layers size={14} />
                              Merge
                            </button>
                            <button onClick={() => setModal("country")}>
                              <Flag size={14} />
                              New country
                            </button>
                          </div>
                          <p className="field-note">
                            Shift-click to select multiple provinces. Merging
                            adopts the first selected province's owner.
                          </p>
                          <h3 className="subsection-title">Competing claims</h3>
                          {world.countries
                            .filter((c) => c.id !== province.countryId)
                            .map((c) => (
                              <label className="claim-row" key={c.id}>
                                <input
                                  type="checkbox"
                                  checked={province.claims.includes(c.id)}
                                  onChange={(e) =>
                                    updateObject(
                                      "claims",
                                      e.target.checked
                                        ? [...province.claims, c.id]
                                        : province.claims.filter(
                                            (id) => id !== c.id,
                                          ),
                                    )
                                  }
                                />
                                <span
                                  className="mini-swatch"
                                  style={{ background: c.color }}
                                />
                                {c.name}
                              </label>
                            ))}
                        </>
                      )}
                    </>
                  )}
                  {feature && (
                    <>
                      <div className="field-row">
                        <Field label="Size">
                          <input
                            aria-label="Feature size"
                            type="number"
                            min=".1"
                            max="10"
                            step=".1"
                            value={feature.size}
                            onChange={(e) =>
                              updateObject(
                                "size",
                                Math.max(0.1, Math.min(10, +e.target.value)),
                              )
                            }
                          />
                        </Field>
                        <Field label="Rotation">
                          <input
                            type="number"
                            value={feature.rotation}
                            onChange={(e) =>
                              updateObject("rotation", +e.target.value)
                            }
                          />
                        </Field>
                      </div>
                      {feature.kind !== "image" && (
                        <Field label="Color">
                          <div className="color-input">
                            <input
                              type="color"
                              value={feature.color}
                              onChange={(e) =>
                                updateObject("color", e.target.value)
                              }
                            />
                            <span>{feature.color.toUpperCase()}</span>
                          </div>
                        </Field>
                      )}
                      <div className="field-row">
                        <Field label="X position">
                          <input
                            type="number"
                            value={Math.round(feature.points[0][0])}
                            onChange={(e) =>
                              onMove(
                                selected[0],
                                +e.target.value - feature.points[0][0],
                                0,
                              )
                            }
                          />
                        </Field>
                        <Field label="Y position">
                          <input
                            type="number"
                            value={Math.round(feature.points[0][1])}
                            onChange={(e) =>
                              onMove(
                                selected[0],
                                0,
                                +e.target.value - feature.points[0][1],
                              )
                            }
                          />
                        </Field>
                      </div>
                      {["label", "city", "castle"].includes(feature.kind) && (
                        <>
                          <Field label="Label font">
                            <select
                              value={feature.font || "Georgia,serif"}
                              onChange={(e) =>
                                updateObject("font", e.target.value)
                              }
                            >
                              <option value="Georgia,serif">
                                Classic serif
                              </option>
                              <option value="Arial,sans-serif">
                                Modern sans
                              </option>
                              <option value="monospace">Technical mono</option>
                            </select>
                          </Field>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={
                                feature.outline ?? feature.kind !== "label"
                              }
                              onChange={(e) =>
                                updateObject("outline", e.target.checked)
                              }
                            />
                            Label outline
                          </label>
                        </>
                      )}
                      {feature.kind === "biome" && (
                        <Field label="Biome category">
                          <select
                            value={feature.biome || "Grassland"}
                            onChange={(e) => {
                              updateObject("biome", e.target.value);
                              updateObject("name", e.target.value);
                              updateObject(
                                "color",
                                (
                                  {
                                    Grassland: "#98b67a",
                                    Desert: "#d7b46b",
                                    Wetland: "#70988e",
                                    Tundra: "#c4ccd0",
                                    Jungle: "#55775b",
                                    Volcanic: "#8f716b",
                                  } as Record<string, string>
                                )[e.target.value],
                              );
                            }}
                          >
                            {[
                              "Grassland",
                              "Desert",
                              "Wetland",
                              "Tundra",
                              "Jungle",
                              "Volcanic",
                            ].map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="Layer">
                        <select
                          value={feature.layerId}
                          onChange={(e) =>
                            updateObject("layerId", e.target.value)
                          }
                        >
                          {world.layers.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className="secondary-button full"
                        onClick={duplicateFeature}
                      >
                        <Copy size={14} />
                        Duplicate feature
                      </button>
                      <p className="field-note">
                        With Select active, drag the selected symbol to move it.
                      </p>
                    </>
                  )}
                  {selected[0].type === "land" && (
                    <button
                      className="secondary-button full"
                      onClick={() => setTool("vertex")}
                    >
                      <Spline size={14} />
                      Edit coastline vertices
                    </button>
                  )}
                  {province && project.snapshots.length > 0 && (
                    <div className="ownership-history">
                      <h3>Ownership through history</h3>
                      {project.snapshots.map((s) => {
                        const historical = s.world.provinces.find(
                          (p) => p.id === province.id,
                        );
                        return (
                          <div key={s.id}>
                            <small>
                              {s.year} · {s.name}
                            </small>
                            <span>
                              {historical
                                ? s.world.countries.find(
                                    (c) => c.id === historical.countryId,
                                  )?.name
                                : "This province did not exist yet"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Field label="Notes & worldbuilding">
                    <textarea
                      rows={3}
                      value={
                        "notes" in selectedObject ? selectedObject.notes : ""
                      }
                      placeholder="Add a story, a secret, a little history..."
                      onChange={(e) => updateObject("notes", e.target.value)}
                    />
                  </Field>
                  <button
                    className="secondary-button full"
                    disabled={feature != null}
                    onClick={createView}
                  >
                    <ZoomIn size={14} />
                    Create linked regional map
                  </button>
                  <button
                    className="danger-button full"
                    onClick={() =>
                      setConfirmDialog({
                        title: "Remove selected objects?",
                        description:
                          "This removes the selected objects from the map. Undo restores them.",
                        action: deleteSelection,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    Delete {selected.length > 1 ? "selection" : "object"}
                  </button>
                </section>
              </>
            ) : (
              <>
                <div className="world-overview">
                  <div className="overview-icon">
                    <CompassLogo />
                  </div>
                  <small>THE CARTOGRAPHER'S DESK</small>
                  <h2>
                    Your world.
                    <br />
                    <em>Limitless possibilities.</em>
                  </h2>
                  <p>
                    Shape a coastline. Raise a kingdom.
                    <br />
                    Give your imagination a place.
                  </p>
                </div>
                <section className="inspector-section">
                  <div className="section-heading">
                    <span>MAP APPEARANCE</span>
                    <SlidersHorizontal size={13} />
                  </div>
                  <div className="style-choices">
                    {(
                      ["atlas", "political", "parchment", "midnight"] as Style[]
                    ).map((s) => (
                      <button
                        className={world.style === s ? "active" : ""}
                        key={s}
                        onClick={() =>
                          changeWorld("Changed map style", (w) => ({
                            ...w,
                            style: s,
                          }))
                        }
                      >
                        <div className={`style-sample style-${s}`}>
                          <span />
                          <span />
                          <span />
                        </div>
                        <span>
                          {s === "atlas"
                            ? "Natural atlas"
                            : s === "political"
                              ? "Political"
                              : s === "parchment"
                                ? "Parchment"
                                : "Midnight"}
                        </span>
                        {world.style === s && <Check size={11} />}
                      </button>
                    ))}
                  </div>
                  <div className="toggle-row">
                    <span>Compass & map frame</span>
                    <button
                      className={`toggle ${world.decorations ? "on" : ""}`}
                      aria-label="Toggle map decorations"
                      onClick={() =>
                        changeWorld("Toggled decorations", (w) => ({
                          ...w,
                          decorations: !w.decorations,
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <span>Coordinate grid</span>
                    <button
                      className={`toggle ${world.grid ? "on" : ""}`}
                      aria-label="Toggle coordinate grid"
                      onClick={() =>
                        changeWorld("Toggled grid", (w) => ({
                          ...w,
                          grid: !w.grid,
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <span>Snap drawing to 10-unit grid</span>
                    <button
                      className={`toggle ${world.snap ? "on" : ""}`}
                      aria-label="Toggle grid snapping"
                      onClick={() =>
                        changeWorld("Toggled snapping", (w) => ({
                          ...w,
                          snap: !w.snap,
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>
                </section>
                <section className="inspector-section">
                  <div className="section-heading">
                    <span>WORLD AT A GLANCE</span>
                    <MapPinned size={13} />
                  </div>
                  <div className="world-stats">
                    <div>
                      <strong>{world.countries.length}</strong>
                      <span>Countries</span>
                    </div>
                    <div>
                      <strong>{world.provinces.length}</strong>
                      <span>Provinces</span>
                    </div>
                    <div>
                      <strong>
                        {
                          world.features.filter(
                            (f) => f.kind === "city" || f.kind === "castle",
                          ).length
                        }
                      </strong>
                      <span>Settlements</span>
                    </div>
                    <div>
                      <strong>{world.lands.length}</strong>
                      <span>Landmasses</span>
                    </div>
                  </div>
                  <button
                    className="text-action"
                    onClick={() => {
                      setTab("world");
                      setSelectedCountry(world.countries[0]?.id || null);
                    }}
                  >
                    Explore your political world <ArrowUpRight size={12} />
                  </button>
                </section>
                <section className="inspector-section">
                  <div className="section-heading">
                    <span>RECENT ACTIVITY</span>
                    <button
                      title="Open editing history"
                      onClick={() => setModal("history")}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                  {history.entries.length ? (
                    history.entries
                      .slice(-3)
                      .reverse()
                      .map((entry, i) => (
                        <div className="activity-row" key={i}>
                          <span />
                          <div>
                            {entry}
                            <small>
                              {i === 0
                                ? "Latest edit"
                                : "Earlier in this session"}
                            </small>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="empty-activity">
                      <span>
                        <Pencil size={15} />
                      </span>
                      <p>
                        Your next great story
                        <br />
                        starts with the first edit.
                      </p>
                    </div>
                  )}
                  <button
                    className="timeline-link"
                    onClick={() => setModal("timeline")}
                  >
                    <HistoryIcon size={14} />
                    <span>Write your world's history</span>
                    <ChevronRight size={13} />
                  </button>
                </section>
              </>
            )}
          </div>
          <div className="inspector-tip">
            <MousePointer2 size={13} />
            <span>
              {selectedObject
                ? "Your edits save automatically."
                : "Select anything on the map to edit it."}
            </span>
          </div>
        </aside>
      </main>
      <footer className="status-bar">
        <div>
          <span className="status-dot" />
          LOCAL WORKSPACE
          <span className="status-separator" />
          <span>
            {allTools.find((t) => t.tool === tool)?.name || "Ellipse"} tool
          </span>
        </div>
        <div>
          <span>X {Math.round(coordinates[0])}</span>
          <span>Y {Math.round(coordinates[1])}</span>
          <span className="status-separator" />
          <span>1200 × 820 map units</span>
        </div>
        <div>
          <span className="key-hint">
            <kbd>Space</kbd> to pan
          </span>
          <span className="key-hint">
            <kbd>Scroll</kbd> to zoom
          </span>
          <button onClick={() => setModal("guide")}>
            Made for worlds of your own <Sparkles size={11} />
          </button>
        </div>
      </footer>
      <input
        type="file"
        ref={importRef}
        className="hidden-input"
        accept=".json,.geojson,.atlas,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} role="status">
          {toast.error ? <CircleHelp size={17} /> : <CheckCheck size={17} />}
          <span>{toast.text}</span>
          <button title="Dismiss message" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "new" && (
        <Dialog
          title="Begin a new world"
          subtitle="Every great story needs somewhere to happen."
          onClose={cancelNewWorld}
        >
          <Field label="World name">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Give your world a name"
            />
          </Field>
          <div className="template-options">
            {[
              {
                id: "sample",
                title: "The Aurelian Reach",
                text: "An editable world to make your own",
                icon: MapIcon,
              },
              {
                id: "generate",
                title: "A world of possibility",
                text: "Procedural land, realms, and terrain",
                icon: WandSparkles,
              },
              {
                id: "blank",
                title: "A blank canvas",
                text: "Your imagination. No boundaries.",
                icon: FilePlus2,
              },
            ].map((t) => (
              <button
                className={newTemplate === t.id ? "active" : ""}
                key={t.id}
                onClick={() => setNewTemplate(t.id)}
              >
                <t.icon size={24} />
                <div>
                  <strong>{t.title}</strong>
                  <span>{t.text}</span>
                </div>
                {newTemplate === t.id ? (
                  <Check size={16} />
                ) : (
                  <span className="radio-circle" />
                )}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={cancelNewWorld}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={creating}
              onClick={() => void createWorld()}
            >
              {creating ? "Creating…" : "Create world"}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === "projects" && (
        <Dialog
          title="Your worlds"
          subtitle="A home for every place you've imagined. Saved on this device."
          onClose={() => setModal(null)}
          wide
        >
          <div className="dashboard-actions">
            <button className="primary-button" onClick={() => setModal("new")}>
              <Plus size={15} />
              New world
            </button>
            <button
              className="secondary-button"
              onClick={() => importRef.current?.click()}
            >
              <Upload size={15} />
              Import project
            </button>
          </div>
          <div className="project-cards">
            {projectList.map((p) => (
              <div className="project-card" key={p.id}>
                <button className="project-card-open" onClick={() => load(p)}>
                  <Thumbnail world={p.world} />
                  <div>
                    <h3>{p.name}</h3>
                    <span>
                      {p.world.countries.length} countries ·{" "}
                      {p.world.provinces.length} provinces
                    </span>
                    <small>
                      Edited {new Date(p.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                </button>
                <button
                  className="delete-project"
                  title={`Delete ${p.name}`}
                  onClick={() =>
                    setConfirmDialog({
                      title: "Delete this saved project?",
                      description:
                        "This removes its local saved copy. Download a backup first if you need it later.",
                      action: () => {
                        if (p.id === project.id) {
                          notify(
                            "Open a different world before deleting the active project.",
                            true,
                          );
                          return;
                        }
                        removeProject(p.id);
                        setProjectList(readProjects());
                      },
                    })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              className="example-card"
              onClick={() => {
                const p = sampleProject();
                load(p);
              }}
            >
              <div>
                <Sparkles size={28} />
                <h3>Explore the Aurelian Reach</h3>
                <p>Our sample world. Your next story.</p>
                <span>
                  Open example <ArrowUpRight size={13} />
                </span>
              </div>
            </button>
          </div>
        </Dialog>
      )}
      {modal === "search" && (
        <Dialog title="Find your next idea" onClose={() => setModal(null)}>
          <div className="command-search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search tools, countries, provinces, cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>Esc</kbd>
          </div>
          <div className="command-results">
            {searchItems.slice(0, 40).map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setModal(null);
                  item.action();
                }}
              >
                <item.icon size={17} />
                <span>{item.name}</span>
                <small>{item.category}</small>
                <ArrowUpRight size={12} />
              </button>
            ))}
            {!searchItems.length && (
              <div className="empty-state">
                No matches. Try a name or a drawing tool.
              </div>
            )}
          </div>
        </Dialog>
      )}
      {modal === "export" && (
        <Dialog
          title="Let your world travel"
          subtitle="A beautiful map. Or every detail, safely backed up."
          onClose={() => setModal(null)}
        >
          <div className="export-preview">
            <Thumbnail world={world} />
            <span>{project.name}</span>
          </div>
          <Field label="Export format">
            <select
              aria-label="Export format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="png">PNG · High-resolution image</option>
              <option value="svg">SVG · Vector map</option>
              <option value="pdf">PDF · Browser print view</option>
              <option value="project">
                Editable project · Complete backup
              </option>
              <option value="geojson">GeoJSON · Polygon geometry</option>
            </select>
          </Field>
          {!["project", "geojson"].includes(exportFormat) && (
            <>
              <div className="field-row">
                <Field label="Resolution">
                  <select
                    value={exportScale}
                    onChange={(e) => setExportScale(+e.target.value)}
                  >
                    {[1, 2, 3, 4].map((s) => (
                      <option value={s} key={s}>
                        {s}× {1200 * s} × {820 * s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Map view">
                  <select
                    value={exportView}
                    onChange={(e) => setExportView(e.target.value)}
                  >
                    {world.views.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                Transparent ocean background
              </label>
              <p className="field-note">
                Exports include visible layers and the current style. PDF uses
                your browser's Save as PDF option.
              </p>
            </>
          )}
          {exportFormat === "project" && (
            <p className="field-note">
              Includes geometry, ownership, layers, style, linked views, and
              historical snapshots. Import this file to continue editing on
              another device.
            </p>
          )}
          {exportFormat === "geojson" && (
            <p className="field-note">
              Uses map canvas coordinates, not longitude and latitude. Contains
              land and territory polygons; decorative features remain in the
              project backup.
            </p>
          )}
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={exporting}
              onClick={() => void exportMap()}
            >
              <Download size={15} />
              {exporting
                ? "Preparing…"
                : exportFormat === "project"
                  ? "Export backup"
                  : "Export map"}
            </button>
          </div>
        </Dialog>
      )}
      {modal === "timeline" && (
        <Dialog
          title="The history of your world"
          subtitle="Preserve an era. Follow the rise and fall of your realms."
          onClose={() => setModal(null)}
          wide
        >
          <div className="snapshot-form">
            <Field label="Period name">
              <input
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
              />
            </Field>
            <Field label="Year / date">
              <input
                value={snapshotYear}
                onChange={(e) => setSnapshotYear(e.target.value)}
              />
            </Field>
            <button
              className="primary-button"
              onClick={() => {
                change("Created historical snapshot", (p) => {
                  p.snapshots.push({
                    id: uid(),
                    name: snapshotName.trim() || "Untitled era",
                    year: snapshotYear,
                    createdAt: Date.now(),
                    world: clone(p.world),
                  });
                  return p;
                });
                notify("An independent snapshot of your world has been saved.");
              }}
            >
              <Plus size={15} />
              Capture era
            </button>
          </div>
          <div className="snapshot-list">
            {project.snapshots.map((s) => (
              <div className="snapshot-card" key={s.id}>
                <Thumbnail world={s.world} />
                <div>
                  <small>{s.year}</small>
                  <h3>{s.name}</h3>
                  <span>
                    {s.world.countries.length} countries ·{" "}
                    {s.world.provinces.length} provinces
                  </span>
                  <div className="snapshot-actions">
                    <button
                      onClick={() => {
                        setComparison(s.id);
                        setModal(null);
                      }}
                    >
                      Compare ownership
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          title: `Restore ${s.name}?`,
                          description:
                            "Your current world will be replaced by this snapshot. Undo can restore your current state.",
                          action: () => {
                            change("Restored historical era", (p) => ({
                              ...p,
                              world: clone(s.world),
                            }));
                            setSelected([]);
                            setSelectedCountry(null);
                            setComparison(null);
                            setActiveView("world");
                            setModal(null);
                          },
                        })
                      }
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        const p = clone(project);
                        p.id = uid();
                        p.name = `${project.name} · ${s.name}`;
                        p.world = clone(s.world);
                        load(p);
                        notify(
                          "An alternate timeline was created as a separate project.",
                        );
                      }}
                    >
                      Branch timeline
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!project.snapshots.length && (
              <div className="empty-timeline">
                <HistoryIcon size={35} />
                <h3>History is yours to write.</h3>
                <p>
                  Capture your first era, change a border, and compare the world
                  across time.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}
      {modal === "country" && (
        <Dialog
          title="Raise a new realm"
          subtitle={
            selected.some((s) => s.type === "province")
              ? "Selected provinces will become part of this new country."
              : "Create a political entity and give it a place in your world."
          }
          onClose={() => setModal(null)}
        >
          <Field label="Country name">
            <input
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
            />
          </Field>
          <Field label="Political color">
            <div className="palette-picker">
              {palette.map((color) => (
                <button
                  key={color}
                  title={color}
                  className={newCountryColor === color ? "active" : ""}
                  style={{ background: color }}
                  onClick={() => setNewCountryColor(color)}
                >
                  {newCountryColor === color && <Check size={17} />}
                </button>
              ))}
              <input
                aria-label="Custom country color"
                type="color"
                value={newCountryColor}
                onChange={(e) => setNewCountryColor(e.target.value)}
              />
            </div>
          </Field>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="primary-button" onClick={makeCountry}>
              <Flag size={15} />
              Create country
            </button>
          </div>
        </Dialog>
      )}
      {modal === "guide" && (
        <Dialog
          title="A cartographer's first steps"
          subtitle={`A short introduction · ${guideStep + 1} of ${guide.length}`}
          onClose={() => setModal(null)}
        >
          <div className="guide-illustration">
            <Mountain size={55} />
            <Spline size={42} />
            <Castle size={36} />
            <Flag size={32} />
          </div>
          <h3 className="guide-step-title">{guide[guideStep].title}</h3>
          <p className="guide-text">{guide[guideStep].text}</p>
          <div className="guide-dots">
            {guide.map((_, i) => (
              <button
                title={`Tutorial step ${i + 1}`}
                key={i}
                className={i === guideStep ? "active" : ""}
                onClick={() => setGuideStep(i)}
              />
            ))}
          </div>
          <div className="shortcut-list">
            <span>
              <kbd>V</kbd>Select
            </span>
            <span>
              <kbd>Space</kbd>Pan
            </span>
            <span>
              <kbd>Ctrl Z</kbd>Undo
            </span>
            <span>
              <kbd>Ctrl K</kbd>Search
            </span>
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setTool(guide[guideStep].tool);
                setModal(null);
              }}
            >
              Try this tool
            </button>
            <button
              className="primary-button"
              onClick={() => {
                if (guideStep === guide.length - 1) {
                  setModal(null);
                  setGuideStep(0);
                } else setGuideStep(guideStep + 1);
              }}
            >
              {guideStep === guide.length - 1 ? "Start exploring" : "Next step"}
              <ArrowUpRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === "history" && (
        <Dialog
          title="Your editing history"
          subtitle="Up to 100 reversible changes in this session."
          onClose={() => setModal(null)}
        >
          <div className="history-list">
            {history.entries
              .slice()
              .reverse()
              .map((e, i) => (
                <div key={i}>
                  <span>{history.entries.length - i}</span>
                  {e}
                </div>
              ))}
            {!history.entries.length && (
              <div className="empty-state">
                Make your first edit to begin your world's story.
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              disabled={!history.past.length}
              onClick={() => setHistory(undo)}
            >
              <Undo2 size={15} />
              Undo latest
            </button>
            <button
              className="primary-button"
              disabled={!history.future.length}
              onClick={() => setHistory(redo)}
            >
              <Redo2 size={15} />
              Redo
            </button>
          </div>
        </Dialog>
      )}
      {inputDialog && (
        <Dialog title={inputDialog.title} onClose={() => setInputDialog(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputDialog.value.trim()) {
                inputDialog.onSubmit(inputDialog.value.trim());
                setInputDialog(null);
              }
            }}
          >
            <Field label={inputDialog.label}>
              <input
                autoFocus
                value={inputDialog.value}
                onChange={(e) =>
                  setInputDialog({ ...inputDialog, value: e.target.value })
                }
              />
            </Field>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setInputDialog(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={!inputDialog.value.trim()}
              >
                Save
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {confirmDialog && (
        <Dialog
          title={confirmDialog.title}
          onClose={() => setConfirmDialog(null)}
        >
          <p className="confirm-description">{confirmDialog.description}</p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirmDialog(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                confirmDialog.action();
                setConfirmDialog(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function CompassLogo() {
  return (
    <svg viewBox="0 0 40 40" fill="none">
      <path
        d="M20 2L25 15L38 20L25 25L20 38L15 25L2 20L15 15Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M20 2V20L25 15M2 20H20L15 25M20 38V20L25 25M38 20H20L25 15"
        fill="currentColor"
        opacity=".7"
      />
      <circle cx="20" cy="20" r="6" fill="#252e2c" stroke="currentColor" />
      <circle cx="20" cy="20" r="1.6" fill="currentColor" />
    </svg>
  );
}
function CircleIsland() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <ellipse cx="12" cy="12" rx="9" ry="7" />
    </svg>
  );
}
