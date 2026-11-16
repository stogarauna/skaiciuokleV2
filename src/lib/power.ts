import {stats, type Screen} from './project.ts';
import type {Cell, PanelRoute} from './signal.ts';

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

function contiguousLines(cells: Cell[], byRows: boolean, reverse: boolean) {
 const track = ({c, r}: Cell) => byRows ? r : c;
 const depth = ({c, r}: Cell) => byRows ? c : r;
 const sorted = [...cells].sort((a, b) => track(a) - track(b) || (depth(a) - depth(b)) * (reverse ? -1 : 1));
 const lines: Cell[][] = [];
 for (const cell of sorted) {
  const line = lines.at(-1);
  const previous = line?.at(-1);
  if (line && previous && track(cell) === track(previous) && Math.abs(depth(cell) - depth(previous)) === 1) {
   line.push(cell);
  } else {
   lines.push([cell]);
  }
 }
 return lines;
}

function powerCircuits(lines: Cell[][], panelLimit: number, byRows: boolean) {
 const ports: PanelRoute[] = [];
 const key = ({c, r}: Cell) => `${c},${r}`;
 const byStart = new Map(lines.map(line => [key(line[0]), line]));
 let splitLines = 0;
 function add(cells: PanelRoute['cells'], depth: number, tracks: number) {
  ports.push({
   number: ports.length + 1, cells, columns: byRows ? depth : tracks, rows: byRows ? tracks : depth
  });
 }

 for (const line of lines) {
  if (!byStart.delete(key(line[0]))) continue;
  const length = line.length;
  if (length > panelLimit) {
   splitLines++;
   const count = Math.ceil(length / panelLimit);
   const base = Math.floor(length / count);
   const remainder = length % count;
   let start = 0;
   for (let segment = 0; segment < count; segment++) {
    const size = base + Number(segment < remainder);
    add(line.slice(start, start + size), size, 1);
    start += size;
   }
   continue;
  }

  const maxTracks = Math.floor(panelLimit / length);
  const cells = [...line];
  const {c, r} = line[0];
  let tracks = 1;
  while (tracks < maxTracks) {
   const nextKey = key(byRows ? {c, r: r + tracks} : {c: c + tracks, r});
   const next = byStart.get(nextKey);
   if (next?.length !== length) break;
   byStart.delete(nextKey);
   cells.push(...(tracks % 2 ? [...next].reverse() : next));
   tracks++;
  }
  add(cells, length, tracks);
 }
 return {ports, splitLines};
}

export function powerPlan(screen: Screen, settings = screen.powerRouting ?? defaultPowerSettings) {
 const panelWatts = screen.panel.power && screen.panel.power > 0 ? screen.panel.power : null;
 const panelsPerCircuit = panelWatts === null ? 0 : Math.floor(settings.limitW / panelWatts);
 const {cells} = stats(screen);
 const byRows = settings.direction === 'rows';
 const reverse = settings.edge === 'right' || settings.edge === 'bottom';
 const lines = panelsPerCircuit ? contiguousLines(cells, byRows, reverse) : [];
 const {ports, splitLines} = powerCircuits(lines, panelsPerCircuit, byRows);
 return {
  cells, panelWatts, panelsPerCircuit, splitLines,
  totalWatts: panelWatts === null ? null : panelWatts * cells.length,
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
 return null;
}
