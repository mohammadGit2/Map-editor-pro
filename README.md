# Atlas Forge

An editable worldbuilding and cartography studio. Built from the empty Map-editor-pro repository with React, TypeScript, SVG, and polygon-clipping. No accounts, API keys, database, or paid services are required.

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

| Endpoint                                     | Method    | Behavior                                                                                                                                                       |
| -------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`                                | GET, HEAD | Application and project-format readiness.                                                                                                                      |
| `/api/generate-world?seed=7&name=My%20world` | GET       | Returns a complete editable project using the seeded generator. Seeds range from 0 to 4294967295; names accept up to 100 characters.                           |
| `/api/validate-project`                      | POST      | Accepts an Atlas Forge project as `application/json`, validates its records and geometry, and returns a summary. No project data is persisted by the function. |

The **A world of possibility** template uses the generation function when available and falls back to the same generator locally when offline. **Validate project** in the project menu or command palette checks locally and optionally sends the current project to the same-origin validation function. Imported projects and normal edits remain local. Remote validation rejects malformed records and uses bounded request sizes: 2 MB, 10 snapshots, 10,000 records, 25,000 geometry points, and 1,024 points per individual boundary or biome. Larger projects retain local validation. Responses use `Cache-Control: no-store`; these APIs do not provide cloud saves or sharing.

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

- A cartography workspace with an editable sample world, blank worlds, procedural variations, recent projects, renaming, duplication, autosave, and project backups.
- Land and island drawing; rectangular and elliptical land; political polygons; selection and multiselection; pan, zoom, grid snapping, vertex insertion, movement, and removal.
- Polygon-based province splitting, union/merging, ownership transfers, new countries from provinces, country unification, competing claims, and editable political hierarchies and lore.
- Shared-border and coastal vertex operations update all participating geometries. Invalid edits leave the original world intact. Geometry tests cover overlaps, gaps, holes, and area preservation.
- Rivers, roads, mountains, forests, biome polygons, cities, castles, labels, and embedded PNG/JPEG/WebP reference images or reusable custom symbols. Symbols can be moved, duplicated, resized, rotated, recolored, and assigned to layers.
- Layers with visibility, locks, opacity, names, and ordering; five rendering styles; map decorations; label font, size, color, rotation, and outline controls.
- Linked regional views over shared world records; independent historical snapshots; ownership comparisons; snapshot restoration; alternate timelines as separate projects.
- PNG, SVG, editable project JSON, and polygon GeoJSON exports. PDF opens the browser print view for Save as PDF. Exports honor visible layers and can omit the ocean background.
- Search for tools and map objects, a beginner guide, simple/advanced interface modes, and keyboard shortcuts.
- A spatial grid for viewport culling of features. Smaller screens use collapsible panels while retaining the same project data.

## Editing guide

1. Use the project menu to create a **Blank canvas**, or edit the sample world directly.
2. Draw land in the ocean with the pencil, rectangle, or ellipse tool. Overlapping land creation is rejected; edit existing coastline vertices instead.
3. **Draw territory** adds boundaries on unassigned land. Click points and press Enter to close the polygon. Existing territory is preserved.
4. Select a province and choose **Split province**. Click two points across the province. The dividing line extends through the complete polygon; the new regions are named automatically and can be renamed in Properties.
5. Change **Territorial owner**, or create a new country from your selected province(s). Shift-click provinces and choose **Merge** to combine them using the first selected province's owner.
6. **Edit vertices** shows boundary handles. Drag a handle, click an edge to insert one, or Alt-click a handle to remove it. Shared boundaries move together; locked neighboring layers block the operation.
7. Add geography and settlements with the drawing toolbar. Select a feature to edit its name and properties; drag an already selected feature to move it.
8. The project menu imports reference images and project files. An imported image starts on the bottom reference layer. Change its layer and size to reuse it as a symbol.
9. Select a province or landmass and choose **Create linked regional map** for a closer view. These views share entity records.
10. Capture an era in **Historical snapshots** before changing borders. Compare highlights ownership changes for surviving province IDs; restore or branch an era without losing its snapshot.
11. Export an **Editable project** backup to move your world between browsers or devices. PNG/SVG are presentation outputs, not editable project backups.

Keyboard: `V` select, `H` pan, `B` land, `P` territory, `A` vertices, `S` split, `M` mountains, `F` forests, `R` river, `C` city, `T` label, `E` erase. Space pans temporarily. Scroll zooms around the pointer. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, Ctrl/Cmd+S saves, and Ctrl/Cmd+K searches. Escape cancels drawing and clears selection.

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

The browser runner uses `/usr/bin/chromium` and accepts `ATLAS_TEST_URL` to test a production preview instead. Tests cover actual creation, drawing, splitting, transfers, merging, terrain, labels, undo/redo, reload, exports, layer locks, vertex insertion/removal, image references, historical restoration, linked views, mobile layout, and navigation with progressively larger worlds. Browser artifacts go to `/tmp/atlas-forge-tests`.

## Architecture

- `src/model.ts`: versioned project records, immutable edit operations, polygon validation, topology operations, history, and local persistence.
- `src/sample.ts`: editable deterministic example world and procedural variations. Voronoi province cells are clipped against land using exact polygon operations.
- `src/api.ts`: same-origin function integration with local generation and validation fallbacks.
- `netlify/functions/`: Node serverless health, world generation, and project validation handlers. They reuse the editor's generator and validator.
- `netlify/lib/http.ts`: method handling, JSON responses, request limits, and validation-work limits.
- `src/spatial.ts`: spatial indexing for feature culling.
- `src/MapCanvas.tsx`: SVG rendering, styles, symbols, pan/zoom, and pointer interactions. Export uses the same renderer as the editor.
- `src/App.tsx`: workspace controls, contextual properties, project management, import/export, and historical states.
- `tests/`: geometry/data unit tests and real Chromium workflows.

## Current limits

This is a working cartography editor, with a narrower feature set than the complete product vision. It does not implement a spherical planet renderer, a separate street/building editor, GIS projections, custom Bézier handles, arbitrary curved territory cuts, automatic label collision resolution, layer folders/blend modes, cloud collaboration, or an AI assistant. Linked maps currently share the same geometry rather than carrying independent geometry at each scale. Procedural generation creates variations of the example geography.

Province cuts use straight lines. Shared vertices are synchronized geometrically; complex geometry work runs on the main thread. Undo history keeps 100 states within a session and is not restored after reload; historical snapshots are persisted. Ownership comparison highlights changes for province IDs present in both states, not geometric differences after a split/merge.

Projects live in browser localStorage, whose capacity varies by browser (often around 5–10 MB). Save errors are visible, and portable backups remain available. Reference images must be under 2 MB. Project imports accept files up to 32 MB but saving still depends on the browser's storage capacity. GeoJSON import supports polygon geometry and names and fits longitude/latitude inputs to canvas coordinates; additional source properties are not imported. GeoJSON export explicitly uses canvas coordinates, not georeferenced coordinates. PDF export depends on the browser print dialog.

Performance measurements are browser-and-machine-specific; the included tests establish behavior for practical sample sizes rather than guaranteeing arbitrary world sizes.
