import type {Screen} from './project.ts';
import {rectangularRoutes, type BlockRoutingSettings, type PanelRoute} from './signal.ts';

export interface PowerSettings {
 limitW: number;
 direction: 'rows' | 'columns';
 edge: 'left' | 'right' | 'top' | 'bottom';
}

export const defaultPowerSettings: Readonly<PowerSettings> = {limitW: 3600, direction: 'rows', edge: 'left'};

export function validPowerLimit(value: unknown): value is number {
 return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validatePowerSettings(value: unknown): value is PowerSettings {
 if (!value || typeof value !== 'object') return false;
 const {limitW, direction, edge} = value as PowerSettings;
 return validPowerLimit(limitW) && (
  (direction === 'rows' && (edge === 'left' || edge === 'right'))
  || (direction === 'columns' && (edge === 'top' || edge === 'bottom'))
 );
}

function powerCircuits(lines: PanelRoute[], panelLimit: number, byRows: boolean) {
 const ports: PanelRoute[] = [];
 let splitLines = 0;
 function add(cells: PanelRoute['cells'], depth: number, tracks: number) {
  ports.push({
   number: ports.length + 1, cells, columns: byRows ? depth : tracks, rows: byRows ? tracks : depth
  });
 }

 for (let index = 0; index < lines.length;) {
  const line = lines[index];
  const length = line.cells.length;
  if (length > panelLimit) {
   splitLines++;
   const count = Math.ceil(length / panelLimit);
   const base = Math.floor(length / count);
   const remainder = length % count;
   let start = 0;
   for (let segment = 0; segment < count; segment++) {
    const size = base + Number(segment < remainder);
    add(line.cells.slice(start, start + size), size, 1);
    start += size;
   }
   index++;
   continue;
  }

  const maxTracks = Math.floor(panelLimit / length);
  const cells = [...line.cells];
  let tracks = 1;
  while (tracks < maxTracks && index + tracks < lines.length) {
   const previous = lines[index + tracks - 1].cells[0];
   const next = lines[index + tracks].cells;
   const adjacent = Math.abs(previous.c - next[0].c) + Math.abs(previous.r - next[0].r) === 1;
   if (next.length !== length || !adjacent) break;
   cells.push(...(tracks % 2 ? [...next].reverse() : next));
   tracks++;
  }
  add(cells, length, tracks);
  index += tracks;
 }
 return {ports, splitLines};
}

export function powerPlan(screen: Screen, settings = screen.powerRouting ?? defaultPowerSettings) {
 const panelWatts = screen.panel.power && screen.panel.power > 0 ? screen.panel.power : null;
 const panelsPerCircuit = panelWatts === null ? 0 : Math.floor(settings.limitW / panelWatts);
 const corners: Record<PowerSettings['edge'], BlockRoutingSettings['corner']> = {
  left: 'top-left', right: 'top-right', top: 'top-left', bottom: 'bottom-left'
 };
 const routes = rectangularRoutes(screen, {
  direction: settings.direction, entryEdge: settings.edge, corner: corners[settings.edge], maxTracksPerPort: 1
 }, panelsPerCircuit ? Infinity : 0);
 const {ports, splitLines} = powerCircuits(routes.ports, panelsPerCircuit, settings.direction === 'rows');
 return {
  ...routes, panelWatts, panelsPerCircuit, splitLines,
  totalWatts: panelWatts === null ? null : panelWatts * routes.cells.length,
  ports: ports.map(port => {
   const watts = port.cells.length * panelWatts!;
   return {...port, watts, remaining: Math.max(0, settings.limitW - watts)};
  })
 };
}

export function powerPlanIssue(plan: ReturnType<typeof powerPlan>) {
 if (!plan.cells.length) return 'Aktyvių panelių nėra.';
 if (plan.panelWatts === null) return 'Nenurodyta panelės galia. Įrašykite ją panelių kataloge.';
 if (!plan.panelsPerCircuit) return 'Grandinės W riba mažesnė už vienos panelės galią.';
 if (plan.issue === 'gap') return 'Nuo pasirinktos kraštinės dėl tarpų nepavyksta sudaryti tiesių grandinių.';
 return null;
}
