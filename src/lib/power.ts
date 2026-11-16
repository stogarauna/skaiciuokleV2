import {stats, type Screen} from './project.ts';
import {routeBounds, type Cell, type PanelRoute} from './signal.ts';

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
 const track = ({c, r}: Cell) => byRows ? r : c;
 const along = ({c, r}: Cell) => byRows ? c : r;
 const byTrack = new Map<number, Set<Cell[]>>();
 for (const line of lines) {
  const index = track(line[0]);
  if (!byTrack.has(index)) byTrack.set(index, new Set());
  byTrack.get(index)!.add(line);
 }
 let splitLines = 0;
 function add(cells: Cell[]) {
  const {columns, rows} = routeBounds(cells);
  ports.push({number: ports.length + 1, cells, columns, rows});
 }

 for (const line of lines) {
  if (!byTrack.get(track(line[0]))?.delete(line)) continue;
  const length = line.length;
  if (length > panelLimit) {
   splitLines++;
   const count = Math.ceil(length / panelLimit);
   const base = Math.floor(length / count);
   const remainder = length % count;
   let start = 0;
   for (let segment = 0; segment < count; segment++) {
    const size = base + Number(segment < remainder);
    add(line.slice(start, start + size));
    start += size;
   }
   continue;
  }

  const cells = [...line];
  let backwards = false;
  while (cells.length < panelLimit) {
   const tail = cells.at(-1)!;
   const options = byTrack.get(track(tail) + 1);
   let best: {line: Cell[]; backwards: boolean; score: number} | undefined;
   for (const next of options ?? []) {
    if (next.length + cells.length > panelLimit) continue;
    for (const reverse of [!backwards, backwards]) {
     const start = reverse ? next.at(-1)! : next[0];
     const offset = Math.abs(along(start) - along(tail));
     if (offset > 1) continue;
     // Prefer a straight transition, then preserve the alternating direction.
     const score = offset * 2 + Number(reverse === backwards);
     if (!best || score < best.score) best = {line: next, backwards: reverse, score};
    }
   }
   if (!best) break;
   options?.delete(best.line);
   backwards = best.backwards;
   cells.push(...(backwards ? [...best.line].reverse() : best.line));
  }
  add(cells);
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
