import { useState, useEffect } from "react";
import {
  Brush,
  Eraser,
  Flag,
  Hand,
  Landmark,
  Leaf,
  Mountain,
  MousePointer2,
  PaintBucket,
  Plus,
  Route,
  Settings2,
  Spline,
  Square,
  Type,
} from "lucide-react";
import {
  type BorderStyle,
  type MapAppearance,
  type Tool,
  type World,
} from "./model";
import { appearance, canvasSettings } from "./world";

export function BorderControls({
  border = {},
  defaults,
  onChange,
  label = "Border",
}: {
  border?: BorderStyle;
  defaults: BorderStyle;
  onChange: (border: BorderStyle) => void;
  label?: string;
}) {
  return (
    <div className="custom-border-controls">
      <label className="field">
        <span>{label} color</span>
        <div className="color-input">
          <input
            aria-label={`${label} color`}
            type="color"
            value={border.color || defaults.color || "#494d3c"}
            onChange={(e) => onChange({ ...border, color: e.target.value })}
          />
          <span>
            {(border.color || defaults.color || "#494d3c").toUpperCase()}
          </span>
        </div>
      </label>
      <div className="field-row">
        <label className="field">
          <span>{label} thickness</span>
          <input
            aria-label={`${label} thickness`}
            type="number"
            min="0"
            step=".25"
            value={border.width ?? defaults.width ?? 1}
            onChange={(e) =>
              onChange({ ...border, width: Math.max(0, +e.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>{label} style</span>
          <select
            aria-label={`${label} style`}
            value={border.pattern || defaults.pattern || "solid"}
            onChange={(e) =>
              onChange({
                ...border,
                pattern: e.target.value as BorderStyle["pattern"],
              })
            }
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>
          {label} opacity ·{" "}
          {Math.round((border.opacity ?? defaults.opacity ?? 1) * 100)}%
        </span>
        <input
          aria-label={`${label} opacity`}
          type="range"
          min="0"
          max="1"
          step=".05"
          value={border.opacity ?? defaults.opacity ?? 1}
          onChange={(e) => onChange({ ...border, opacity: +e.target.value })}
        />
      </label>
    </div>
  );
}

export function WorldSettings({
  world,
  onAppearance,
  onCanvas,
  onResize,
  onFit,
  onWorld,
}: {
  world: World;
  onAppearance: (patch: MapAppearance) => void;
  onCanvas: (grow: boolean) => void;
  onResize: (width: number, height: number) => void;
  onFit: () => void;
  onWorld: (patch: Partial<World>) => void;
}) {
  const c = canvasSettings(world),
    t = appearance(world);
  const [width, setWidth] = useState(String(c.width)),
    [height, setHeight] = useState(String(c.height));
  useEffect(() => {
    setWidth(String(c.width));
    setHeight(String(c.height));
  }, [c.width, c.height]);
  return (
    <div className="world-settings-grid">
      <section>
        <h3>Your canvas, your size</h3>
        <p>
          Choose any positive dimensions. Resizing keeps your artwork in place.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onResize(Number(width), Number(height));
          }}
        >
          <div className="field-row">
            <label className="field">
              <span>Width</span>
              <input
                required
                aria-label="Canvas width"
                type="number"
                min="0"
                step="any"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Height</span>
              <input
                required
                aria-label="Canvas height"
                type="number"
                min="0"
                step="any"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
          </div>
          <button className="secondary-button full" type="submit">
            <Square size={14} />
            Apply canvas size
          </button>
        </form>
        <label className="checkbox-row">
          <input
            aria-label="Auto-expand canvas"
            type="checkbox"
            checked={c.grow}
            onChange={(e) => onCanvas(e.target.checked)}
          />
          Auto-expand while drawing
        </label>
        <p className="field-note">
          Draw past an edge and your canvas grows, including to the left or
          above. Switch this off for a fixed print layout.
        </p>
        <button className="secondary-button full" onClick={onFit}>
          <Settings2 size={14} />
          Fit canvas to artwork
        </button>
        <h3 className="subsection-title">Finishing touches</h3>
        {(
          [
            { key: "decorations", name: "Compass, title & frame" },
            { key: "grid", name: "Coordinate grid" },
            { key: "snap", name: "Snap to grid" },
          ] as const
        ).map((item) => (
          <label className="checkbox-row" key={item.key}>
            <input
              type="checkbox"
              checked={!!world[item.key]}
              onChange={(e) => onWorld({ [item.key]: e.target.checked })}
            />
            {item.name}
          </label>
        ))}
      </section>
      <section>
        <h3>A completely custom palette</h3>
        <p>Your colors apply to the canvas, map, and exports.</p>
        <div className="custom-color-grid">
          {(
            [
              { key: "ocean", name: "Water / background" },
              { key: "land", name: "Default land" },
              { key: "ink", name: "Labels & ink" },
              { key: "coast", name: "Coastline" },
              { key: "river", name: "Rivers" },
              { key: "forest", name: "Forests" },
              { key: "mountain", name: "Mountains" },
            ] as const
          ).map((item) => (
            <label className="field" key={item.key}>
              <span>{item.name}</span>
              <div className="color-input">
                <input
                  type="color"
                  aria-label={item.name}
                  value={t[item.key]}
                  onChange={(e) => onAppearance({ [item.key]: e.target.value })}
                />
                <span>{t[item.key].toUpperCase()}</span>
              </div>
            </label>
          ))}
        </div>
        <BorderControls
          label="Map border"
          border={{
            color: world.appearance?.borderColor,
            width: world.appearance?.borderWidth,
            pattern: world.appearance?.borderPattern,
            opacity: world.appearance?.borderOpacity,
          }}
          defaults={{
            color: t.borderColor,
            width: t.borderWidth,
            pattern: t.borderPattern,
            opacity: t.borderOpacity,
          }}
          onChange={(b) =>
            onAppearance({
              borderColor: b.color,
              borderWidth: b.width,
              borderPattern: b.pattern,
              borderOpacity: b.opacity,
            })
          }
        />
        <div className="field-row">
          <label className="field">
            <span>Province border thickness</span>
            <input
              type="number"
              min="0"
              step=".25"
              aria-label="Province border thickness"
              value={t.provinceBorderWidth}
              onChange={(e) =>
                onAppearance({
                  provinceBorderWidth: Math.max(0, +e.target.value),
                })
              }
            />
          </label>
          <label className="field">
            <span>Coastline thickness</span>
            <input
              type="number"
              min="0"
              step=".25"
              aria-label="Coastline thickness"
              value={t.coastlineWidth}
              onChange={(e) =>
                onAppearance({ coastlineWidth: Math.max(0, +e.target.value) })
              }
            />
          </label>
        </div>
        <label className="field">
          <span>Political fill · {Math.round(t.fillOpacity * 100)}%</span>
          <input
            aria-label="Political fill opacity"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={t.fillOpacity}
            onChange={(e) => onAppearance({ fillOpacity: +e.target.value })}
          />
        </label>
        <button
          className="text-action"
          onClick={() => onWorld({ appearance: undefined })}
        >
          Reset custom palette to the selected style
        </button>
      </section>
    </div>
  );
}

const paintTools = [
  { tool: "select", label: "Select", icon: MousePointer2 },
  { tool: "brush", label: "Land brush", icon: Brush },
  { tool: "land-erase", label: "Land eraser", icon: Eraser },
  { tool: "rectangle", label: "Rectangle", icon: Square },
  { tool: "paint", label: "Fill color", icon: PaintBucket },
  { tool: "territory", label: "Draw border", icon: Spline },
  { tool: "assign", label: "Give territory", icon: Flag },
  { tool: "mountain", label: "Mountains", icon: Mountain },
  { tool: "forest", label: "Forest", icon: Leaf },
  { tool: "river", label: "River", icon: Spline },
  { tool: "road", label: "Road", icon: Route },
  { tool: "city", label: "City", icon: Landmark },
  { tool: "label", label: "Text", icon: Type },
  { tool: "pan", label: "Move view", icon: Hand },
] as const;
export function PaintRibbon({
  tool,
  onTool,
  color,
  onColor,
  diameter,
  onDiameter,
  world,
  ownerId,
  onOwner,
  onCountry,
  onEmpire,
  onSettings,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  diameter: number;
  onDiameter: (n: number) => void;
  world: World;
  ownerId: string;
  onOwner: (id: string) => void;
  onCountry: () => void;
  onEmpire: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="paint-ribbon">
      <div
        className="paint-ribbon-tools"
        role="toolbar"
        aria-label="Easy drawing tools"
      >
        {paintTools.map((item) => (
          <button
            key={item.tool}
            className={tool === item.tool ? "active" : ""}
            aria-label={item.label}
            aria-pressed={tool === item.tool}
            title={item.label}
            onClick={() => onTool(item.tool)}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="paint-ribbon-options">
        <div className="paint-colors">
          <label className="ribbon-color">
            <input
              aria-label="Drawing color"
              type="color"
              value={color}
              onChange={(e) => onColor(e.target.value)}
            />
            <span>Color</span>
          </label>
          {[
            "#e5dfca",
            "#9dbd8a",
            "#5c976f",
            "#83a8b4",
            "#d3a391",
            "#d8bb70",
            "#a49bbd",
            "#494d3c",
            "#ffffff",
          ].map((c) => (
            <button
              key={c}
              aria-label={`Use ${c}`}
              title={c}
              className={color === c ? "active" : ""}
              style={{ background: c }}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
        <label className="ribbon-size">
          Brush
          <input
            aria-label="Land brush size"
            type="number"
            min="1"
            step="1"
            value={diameter}
            onChange={(e) => onDiameter(Math.max(1, +e.target.value))}
          />
          <span>px</span>
        </label>
        <label className="ribbon-owner">
          <Flag size={12} />
          <select
            aria-label="Drawing country"
            value={ownerId}
            onChange={(e) => onOwner(e.target.value)}
          >
            {world.countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="ribbon-action" onClick={onCountry}>
          <Plus size={12} />
          Country
        </button>
        <button className="ribbon-action" onClick={onEmpire}>
          <Plus size={12} />
          Empire
        </button>
        <button className="ribbon-action" onClick={onSettings}>
          <Settings2 size={13} />
          Canvas & colors
        </button>
      </div>
    </div>
  );
}
