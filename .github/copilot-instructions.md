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
- Base font size: 22px, mobile: 2.2rem with `!important`
- iOS safe-area support in `src/app.css` 
- Touch-optimized inputs with `padding: 1rem` and `touch-action: manipulation`
- Apple mobile web app meta tags in `app.html`

## Development Patterns

### Reactive Calculations
All calculations use Svelte's `$:` reactive statements. Example pattern from `+page.svelte`:
```svelte
$: totalPanels = width * height;
$: totalWidthPx = width * selected.resX;
$: totalHeightPx = height * selected.resY;
```

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
- **Language**: Lithuanian (lang="lt" in html, Lithuanian text in UI)
- **Units**: Metric only (meters, kilograms, watts)
- **Aspect Ratio**: Uses GCD algorithm for simplified ratios
- **Mobile**: All touch targets >= 44px (iOS guidelines)
- **TypeScript**: Strict mode enabled, allow JS files for data

## When Adding Features
- Add new calculations as reactive statements (`$:`)
- Follow mobile-first responsive patterns from existing code
- Keep panel data structure consistent when adding new panels
- Use Tailwind classes for styling (already configured)
- Maintain Lithuanian language throughout UI text