# LED Studija — 2D workspace

SvelteKit LED screen planner. Initial catalog comes from `static/panels.xlsx`.

## Development

- `npm ci`
- `npm run dev`
- `npm run check`
- `node --experimental-strip-types --test tests/project.test.ts` (Node 22+)
- `npm run build` — static output in `build/`, compatible with Sites and Vercel.

## Features

Multi-screen projects, screen/project SVG views, physical placement snapped to 0.1 m, dimensions and numbering, adding/removing grid panels, size in panels or rounded-up metres, catalog search and editing, undo/redo, browser-local autosave, validated versioned JSON import/export, PNG export, browser print/PDF summary.

Project JSON embeds a panel specification snapshot for each screen. Catalog updates do not silently change existing screens. Missing weight/power stays null and produces an explicitly incomplete total. Active LED area/pixels and occupied shape bounds are calculated separately.

## Initial data and limits

Catalog values are existing v2 Excel values, not manufacturer-verified specifications. In particular P2 YESTECH is 145 W / 6.7 kg in this source; earlier planning notes contain different values. UI labels expose this provenance. Average power is not yet available.

Autosave and catalog edits are local to a browser and origin; JSON is the portable project backup. Limits: 50 screens/project, 100 rows/columns, 5000 grid cells/screen, 5 MB import. PDF uses the browser print dialog, with all screens and a summary; large projects may span several pages. No wiring, power circuits, output mapping, 3D, curved walls or mixed panels in one screen yet.

## Validation

Four Node tests cover physical/px geometry, irregular active-panel totals, unknown specifications, snapshot JSON round trip and malformed imports. Browser QA covers panel deletion/undo, duplication, autosave reload, mixed model projects, rounding to full panels, catalog creation and incomplete totals.
