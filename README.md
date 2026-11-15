# LED Studija — 2D workspace

SvelteKit LED screen planner. Initial catalog comes from `static/panels.xlsx`.

## Development

- `npm ci`
- `npm run dev`
- `npm run check`
- `node --experimental-strip-types --test tests/project.test.ts` (Node 22+)
- `npm run build` — SvelteKit server and assets in `.vercel/output/`.

## Features

Multi-screen projects, screen/project SVG views, physical placement snapped to 0.1 m, dimensions and numbering, adding/removing grid panels, size in panels or rounded-up metres, catalog search and administrator-only editing, undo/redo, browser-local autosave, validated versioned JSON import/export, PNG export, direct downloadable PDF summary.

Project JSON embeds a panel specification snapshot for each screen. Catalog updates do not silently change existing screens. Missing weight/power stays null and produces an explicitly incomplete total. Active LED area/pixels and occupied shape bounds are calculated separately.

## Initial data and limits

Catalog values are existing v2 Excel values, not manufacturer-verified specifications. In particular P2 YESTECH is 145 W / 6.7 kg in this source; earlier planning notes contain different values. UI labels expose this provenance. Average power is not yet available.

Project autosave is local to the browser and JSON is its portable backup. Shared catalogue edits are stored on the server. Limits: 50 screens/project, 100 rows/columns, 5000 grid cells/screen, 5 MB import. PDF downloads directly with vector screen drawings, embedded Lithuanian font and a summary; large projects span multiple pages. No wiring, power circuits, output mapping, 3D, curved walls or mixed panels in one screen yet.

## Validation

Four Node tests cover physical/px geometry, irregular active-panel totals, unknown specifications, snapshot JSON round trip and malformed imports. Browser QA covers panel deletion/undo, duplication, autosave reload, mixed model projects, rounding to full panels, catalog creation and incomplete totals.

## Curved geometry

Open **Forma ir lenkimas** for a top view of rigid panels joined at a uniform horizontal angle. Positive is concave, negative convex in the displayed audience convention. The footprint uses actual polygon vertices, and the radius is the circumradius to panel corners: width / (2 sin(|angle| / 2)). Total joint turn is (columns - 1) × |angle|; arc coverage is columns × |angle|. Pixel/weight totals are unaffected by bending.

Scalar min/max catalog limits are enforced. Fixed or ambiguous multi-range profiles cannot bend until clarified in the catalog. Limits are from the user's Excel, not verified manufacturer latch increments. Empty columns retain their nominal positions. The top view and DXF include catalogue panel thickness. Structural stability is outside the geometry model. Curvature is an optional backward-compatible field in v1 JSON, included in autosave, JSON, geometry PNG and print summary.

## Administration

The public planner reads the shared panel and mounting catalogue. `/admin` is password-protected and is the only route that can save catalogue changes. Existing project snapshots keep their saved panel specifications and mounting weights.

Set `LED_ADMIN_PASSWORD` (at least 16 characters in production) and an independent random `LED_ADMIN_SESSION_SECRET` (at least 32 characters) as private Vercel environment variables. Connect a private Vercel Blob store to supply `BLOB_READ_WRITE_TOKEN`. The original Excel catalogue and built-in mounting weights are used until the first save. For local development without Blob, set `LED_CATALOG_DEV_FILE` to a writable path outside the repository.
