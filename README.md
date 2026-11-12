# Plinth: model viewer

A browser app for viewing architecture and 3D files, 2D drawings, and things you make in Claude. You don't install anything. Open `index.html` in Chrome, Edge, Firefox or Safari, or host the repo on GitHub Pages.

## What it opens

| Kind | Formats |
|---|---|
| BIM / architecture | **IFC** (grouped by walls, slabs, doors…, with IFC properties), Rhino **3DM**, **DAE** (SketchUp export), **KMZ** |
| 2D drawings | **DXF** (layers, blocks, arcs, polylines, text), **PDF** sheets, **SVG**, PNG/JPG/WEBP |
| General 3D | **GLB/glTF** (incl. Draco/Meshopt), **FBX**, **OBJ+MTL**, 3DS, USDZ, VRML, LWO, MD2, three.js JSON |
| Fabrication & scans | STL, 3MF, AMF, PLY, PCD, XYZ, VTK/VTP, G-code |
| Claude artifacts | **HTML**, **React JSX/TSX** (runs live), SVG, or any model text pasted with *Paste from Claude* |
| Bundles | Drop a folder or `.zip` so textures and `.bin` files come along |

Native files from closed software (Revit `.rvt`, SketchUp `.skp`, Archicad `.pln`, AutoCAD `.dwg`, and others) can't be read in a browser. If you open one, the app tells you which export to use: IFC, DAE, FBX or DXF.

## Tools

- Orbit, pan, zoom (zooms toward the cursor), view buttons (top, front, right, iso), perspective or orthographic camera, and a **2D plan** mode
- Shaded, clay, wireframe and X-ray display, edge lines, grid, backdrops (studio, room, blueprint, paper, night)
- Select from the viewport or the scene outline. Move, rotate and scale with a gizmo. Rename, recolour, change roughness, metalness and opacity, hide, isolate, duplicate, delete. Undo with Ctrl+Z
- **Labels** pinned to surfaces that move with the object, and **measurements** shown in metric and feet-and-inches
- **Section cut** on any axis with a solid poché fill, and an **exploded view**
- **Animation**: plays the clips stored in the file, plus a turntable spin, camera tours through saved views, and a sun study across the day with a north offset
- Export GLB, OBJ, STL, or a PNG screenshot

## Files

- `src/plinth.html`: the app source, written as a page body so it can also be published as a claude.ai artifact
- `index.html`: the standalone page, built by `./build.sh`. Rebuild it after you edit the source

IFC, Rhino, Draco and PDF support download small decoders from jsDelivr the first time they're used, so these formats need an internet connection.
