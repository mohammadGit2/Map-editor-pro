# Atlas Forge

An editable worldbuilding and cartography studio. Built from the empty Map-editor-pro repository with React, TypeScript, SVG, and polygon-clipping. No accounts, API keys, database, or paid services are required.

Start with a blank canvas in Simple mode, paint your own land, choose your colors, draw borders, and build countries or empires. Canvas dimensions and artwork are editable; presets are optional starting points.

## Run

Use the existing checkout at `/workspace/Map-editor-pro`; cloud tasks are already isolated and do not need another worktree.

Requires Node.js 22.13 or newer (validated with 24.19.0) and npm. Netlify builds use Node.js 24.

```sh
cd /workspace/Map-editor-pro
npm ci
npm run dev
```

The Vite server uses port 5173. For production output, run `npm run build`, then `npm run preview -- --port 4173`. Fonts and their open-source licenses are bundled under `public/fonts`; editing works without network access after dependencies are installed.

## Netlify deployment and functions

Import `mohammadGit2/Map-editor-pro` into Netlify and select the `main` branch. Leave the base directory empty: `netlify.toml` supplies the build command (`npm run build`), publish directory (`dist`), and functions directory (`netlify/functions`). API redirects run before the single-page application fallback. Static assets use hashed filenames and immutable caching. No environment variables or secrets are needed for the implemented functions.

| Endpoint                                                                                     | Method    | Behavior                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                                                                                | GET, HEAD | Application and project-format readiness.                                                                                                                      |
| `/api/generate-world?seed=7&name=My%20world&width=3600&height=2000&continents=4&countries=7` | GET       | Returns independently generated, editable geography at the chosen dimensions. Seeds range from 0 to 4294967295; names accept up to 100 characters.             |
| `/api/validate-project`                                                                      | POST      | Accepts an Atlas Forge project as `application/json`, validates its records and geometry, and returns a summary. No project data is persisted by the function. |

The **A world of possibility** option uses the generation function when available and falls back to the same generator locally when offline. Optional generation parameters default to a 1200 × 820 canvas, three landmasses, and five countries. Dimensions must be positive finite numbers; a generation batch accepts 1–24 landmasses and 1–100 starting countries. More land and countries can be added afterward. Different seeds produce different coastlines and territory layouts.

**Validate project** in the project menu or command palette checks locally and optionally sends the current project to the same-origin validation function. Imported projects and normal edits remain local. Remote validation rejects malformed records and uses bounded request sizes: 2 MB, 10 snapshots, 10,000 records, 25,000 geometry points, and 1,024 points per individual boundary or biome. Larger projects retain local validation. Responses use `Cache-Control: no-store`; these APIs do not provide cloud saves or sharing.

For local Netlify development, run `npm run dev:netlify` and use port 8888. The functions can also be run separately without Netlify's Edge Functions environment:

```sh
# Terminal 1
npm run functions:serve
# Terminal 2
npm run dev
# After both servers respond:
npm run test:functions
npm run test:browser
```

Vite forwards `/api/*` to the Netlify functions server on port 9999. This two-process workflow is verified in the cloud environment. Full Netlify Dev also tries to download an Edge Functions runtime, which the cloud network could not fetch; this application uses Node functions and does not need Edge Functions. In this sandbox, prefix Netlify commands with `XDG_CONFIG_HOME=/workspace/.atlas-netlify-config` so the CLI can write its local configuration inside the writable workspace. On a normal development machine its default configuration location works.

`npm run functions:build` packages the three handlers into the ignored `.netlify/functions-build` directory. The GitHub Actions workflow checks the application build, unit tests, function bundles, and actual local Netlify function requests. Connecting GitHub to Netlify is a separate deployment step; pushing this repository does not itself establish a live site.

## What works

- Blank custom worlds, independently generated worlds, an optional editable example, recent projects, renaming, duplication, autosave, and project backups.
- Custom canvas width and height, automatic expansion across any edge, fixed print layouts, and fitting the canvas to artwork. Resizing preserves artwork coordinates.
- A Paint-style Simple ribbon with labeled land brush, land eraser, rectangle, fill bucket, borders, territorial assignment, terrain, river, road, city, text, and pan tools. Brush diameter and drawing color are directly editable.
- Overlapping brush strokes and shapes join into editable land. Land erasing cuts coasts and provinces together. Custom border polygons carve existing territories while preserving the remaining land and ownership.
- Polygon-based province splitting, union/merging, ownership transfers, new countries from provinces, country unification, competing claims, and editable political hierarchies and lore.
- Countries, empires, federations, confederations, and custom realm types. Add or release member realms, change hierarchy without cycles, switch country/empire coloring, and dissolve an empire while preserving members and territory.
- Shared-border and coastal vertex operations update all participating geometries. Invalid edits leave the original world intact. Geometry tests cover overlaps, gaps, holes, and area preservation.
- Rivers, roads, mountains, forests, biome polygons, cities, castles, labels, and embedded PNG/JPEG/WebP reference images or reusable custom symbols. Symbols can be moved, duplicated, resized, rotated, recolored, and assigned to layers.
- Custom water, land, ink, coast, river, forest, and mountain colors; country/province colors and border overrides; border thickness, solid/dashed/dotted patterns, opacity, and political fill opacity. Five presets remain available.
- Layers with visibility, locks, opacity, names, and ordering; optional map decorations; label font, size, color, rotation, and outline controls.
- Linked regional views over shared world records; independent historical snapshots; ownership comparisons; snapshot restoration; alternate timelines as separate projects.
- PNG, SVG, editable project JSON, and polygon GeoJSON exports. PDF opens the browser print view for Save as PDF. Exports honor visible layers and can omit the ocean background.
- Search for tools and map objects, a beginner guide, simple/advanced interface modes, and keyboard shortcuts.
- A spatial grid for viewport culling of features. Smaller screens use collapsible panels while retaining the same project data.

## Editing guide

1. Choose **New world**, name it, and set any positive width and height. **A blank canvas** is the default. Choose **A world of possibility** for fresh geography or the example to explore existing tools.
2. In Simple mode, use **Land brush** to paint continents or islands. Click once for an island or drag for a coastline. Overlapping strokes join. **Land eraser** removes land and its political territory; undo restores the whole edit.
3. Open **Canvas & colors** to resize, enable automatic expansion, fit the artwork, change water/land colors, or customize border thickness, pattern, and opacity. Automatic expansion preserves your drawing coordinates, including when drawing left or above the original canvas. Hold Space to pan beyond an edge.
4. Choose a drawing country in the ribbon, then use **Draw border**. Click points and press Enter or **Finish border** to close a territory. Borders are clipped to land and carve territory from existing neighbors. Locked affected layers block edits.
5. Use **Give territory** to give a province to the chosen country, or click unassigned land to claim its unassigned portion. **Fill color** recolors the clicked land, country, or symbol with the ribbon color.
6. Select a province to change **Territorial owner**, customize its border, or choose **Split province**. Click two points across it; the dividing line extends through the polygon. Shift-click provinces and choose **Merge** to combine them using the first selected province's owner.
7. Use **+ Country** or **+ Empire** to create a realm. Empires can contain existing countries without changing province ownership. Select a realm in the country panel to add/release members, customize its border, or dissolve it. Use the **Countries / Empires** map view to show the appropriate hierarchy colors.
8. **Edit vertices** shows boundary handles. Drag a handle, click an edge to insert one, or Alt-click a handle to remove it. Shared boundaries move together; locked neighboring layers block the operation. Switch to Advanced mode for additional tools, layer controls, and history workflows.
9. Add geography and settlements with the ribbon. Select a feature to edit its name, color, size, rotation, and properties; drag an already selected feature to move it. The project menu imports reference images, custom image symbols, and project files.
10. In Advanced mode, create linked regional maps from selected provinces/landmasses or capture eras in **Historical snapshots**. Linked views share records; snapshots preserve independent world states for restoring or branching.
11. Export an **Editable project** backup to move your world between browsers or devices. PNG/SVG are presentation outputs. SVG retains vector geometry and custom colors/borders; PNG resolution has browser memory limits.

Keyboard: `V` select, `H` pan, `B` land brush in Simple mode / land outline in Advanced mode, `P` territory, `A` vertices, `S` split, `M` mountains, `F` forests, `R` river, `C` city, `T` label, `E` land eraser in Simple mode / object eraser in Advanced mode. Space pans temporarily. Scroll zooms around the pointer. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Ctrl/Cmd+S saves, and Ctrl/Cmd+K searches. Escape cancels drawing and clears selection.

## Validation

```sh
npm test
npm run build
npm run functions:build
# With npm run functions:serve running:
npm run test:functions
# With the dev server running, and Python Playwright + Chromium installed:
npm run test:browser
```

The browser runner uses `/usr/bin/chromium` and accepts `ATLAS_TEST_URL` to test a production preview instead. Tests cover custom canvas creation/expansion/resizing, brush and eraser geometry, custom colors/borders, empire creation/membership/dissolution, generated dimensions, save/reload, exports, and the existing advanced editing workflows. Browser artifacts go to `/tmp/atlas-forge-tests`.

## Architecture

- `src/model.ts`: versioned project records, immutable edit operations, polygon validation, topology operations, history, and local persistence.
- `src/world.ts`: canvas growth/resizing, appearance presets, brush/eraser geometry, custom territory carving, and realm hierarchy operations.
- `src/generator.ts`: independently seeded coastlines, custom dimensions and counts, Voronoi provinces clipped to land, and starter geography/settlements.
- `src/sample.ts`: the optional editable deterministic example world.
- `src/WorldControls.tsx`: the Simple drawing ribbon, canvas/color settings, and shared border controls.
- `src/api.ts`: same-origin function integration with local generation and validation fallbacks.
- `netlify/functions/`: Node serverless health, world generation, and project validation handlers. They reuse the editor's generator and validator.
- `netlify/lib/http.ts`: method handling, JSON responses, request limits, and validation-work limits.
- `src/spatial.ts`: spatial indexing for feature culling.
- `src/MapCanvas.tsx`: SVG rendering, styles, symbols, pan/zoom, and pointer interactions. Export uses the same renderer as the editor.
- `src/App.tsx`: workspace controls, contextual properties, project management, import/export, and historical states.
- `tests/`: geometry/data unit tests and real Chromium workflows.

## Current limits

This is a working cartography editor, with a narrower feature set than the complete product vision. It does not implement a spherical planet renderer, a separate street/building editor, GIS projections, custom Bézier handles, arbitrary curved territory cuts, automatic label collision resolution, layer folders/blend modes, cloud collaboration, or an AI assistant. Linked maps currently share the same geometry rather than carrying independent geometry at each scale.

Province cuts use straight lines. Shared vertices are synchronized geometrically; complex geometry work runs on the main thread. Undo history keeps 100 states within a session and is not restored after reload; historical snapshots are persisted. Ownership comparison highlights changes for province IDs present in both states, not geometric differences after a split/merge.

Canvas dimensions have no preset maximum, but must be finite and produce finite area; available browser memory and numerical precision still matter. PNG export is limited to 32 megapixels and 16,384 pixels per side to avoid exhausting browser memory. Use a lower PNG resolution or SVG for larger output; these export limits do not cap the editable canvas. Generation batch limits do not cap the number of objects you can create while editing.

Projects live in browser localStorage, whose capacity varies by browser (often around 5–10 MB). Save errors are visible, and portable backups remain available. Reference images must be under 2 MB. Project imports accept files up to 32 MB but saving still depends on the browser's storage capacity. GeoJSON import supports polygon geometry and names and fits longitude/latitude inputs to canvas coordinates; additional source properties are not imported. GeoJSON export explicitly uses canvas coordinates, not georeferenced coordinates. PDF export depends on the browser print dialog.

Performance measurements are browser-and-machine-specific; the included tests establish behavior for practical sample sizes rather than guaranteeing arbitrary world sizes.
