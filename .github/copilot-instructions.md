# LED Calculator (Skaičiuoklė) - AI Coding Instructions

## Project Overview
This is a Lithuanian LED panel calculator built with **SvelteKit 2 + TypeScript + Tailwind CSS**. It calculates total resolution, power, weight, and physical dimensions for LED video walls based on panel selection and grid configuration.

## Architecture & Key Files

### Core Structure
- **`src/routes/+page.svelte`** - Main calculator interface with reactive calculations
- **`src/routes/+layout.svelte`** - App shell with mobile-optimized styling
- **`src/lib/data/panels.js`** - LED panel specifications database (15+ panel types)
- **`src/app.html`** - HTML template with Lithuanian language, Inter font, and mobile viewport

### Mobile-First Design
This is a **mobile-first PWA** with aggressive mobile optimizations:

**Typography & Spacing:**
- Base font size: 22px, mobile: 2.2rem with `!important`

**iOS Support:**
- iOS safe-area support in `src/app.css`
- Apple mobile web app meta tags in `app.html`

**Touch Interactions:**
- Touch-optimized inputs with `padding: 1rem` and `touch-action: manipulation`

## Development Patterns

### Reactive Calculations
All calculations use Svelte's `$:` reactive statements. Example pattern from `+page.svelte`:
```svelte
$: totalPanels = width * height;
$: totalWidthPx = width * selected.resX;
$: totalHeightPx = height * selected.resY;
```

### Input Validation
Validate grid dimensions on the user-facing boundary. Width and height must be positive integers (>= 1). Display an inline error message in Lithuanian when invalid values are entered and prevent calculations from running until values are corrected.

### Data Structure
Panel objects in `panels.js` follow this exact schema:
```javascript
{
  name: "P3 INFI G1",
  resX: 128, resY: 256,        // pixel resolution
  widthM: 0.5, heightM: 1.0,   // physical size in meters  
  power: 340,                  // watts per panel
  weightKg: 13.4               // weight per panel
}
```
If a panel object is missing required fields, log an error and skip the panel during calculations.

### Smart Formatting
Use conditional formatting for large values:
- Power: `>= 1000W` displays as `kW`
- Weight: `>= 1000kg` displays as `t` (metric tons)
- Numbers use `toLocaleString()` for thousands separators

## Development Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript + Svelte check
npm run check:watch  # Watch mode checking
```

## Key Constraints

Constraints are ranked by priority. If two constraints conflict, the higher-ranked (lower Rank number) constraint takes precedence.

| Rank | Priority | Category | Constraint | Rule |
|------|----------|----------|------------|------|
| 1 | Critical | Localisation | Language | Lithuanian (`lang="lt"` in HTML, Lithuanian text in all UI) |
| 2 | Critical | Localisation | Units | Metric only (meters, kilograms, watts) |
| 3 | Critical | UI | Mobile | All touch targets >= 44px (iOS guidelines) |
| 4 | Critical | Validation | Input Validation | Width and height must be positive integers (>= 1); display inline Lithuanian error and block calculations on invalid input. |
| 5 | Optional | Technical | TypeScript | Strict mode enabled, allow JS files for data |
| 6 | Optional | Technical | Aspect Ratio | Uses GCD algorithm for simplified ratios |

## When Adding Features
- Add new calculations as reactive statements (`$:`), strictly using only the listed panel properties (resolution, power, weight) and grid configuration (width, height). Do not use other properties.
- Follow mobile-first responsive patterns from existing code
- Keep panel data structure consistent when adding new panels
- Use Tailwind classes for styling (already configured)
- Maintain Lithuanian language throughout UI text