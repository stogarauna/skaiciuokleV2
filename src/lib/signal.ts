import {stats, type Screen} from './project.ts';

export interface SignalSettings {
 portCapacity: number;
 direction: 'rows' | 'columns';
 corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const defaultSignalSettings: Readonly<SignalSettings> = {
 portCapacity: 783_000,
 direction: 'rows',
 corner: 'bottom-left'
};

export function validPortCapacity(value: unknown): value is number {
 return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateSignalSettings(value: unknown): value is SignalSettings {
 if (!value || typeof value !== 'object') return false;
 const {portCapacity, direction, corner} = value as SignalSettings;
 return validPortCapacity(portCapacity)
  && (direction === 'rows' || direction === 'columns')
  && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(corner);
}

type Cell = ReturnType<typeof stats>['cells'][number];

interface SignalPort {
 number: number;
 cells: Cell[];
 pixels: number;
 remaining: number;
}

export function signalPlan(screen: Screen, settings = screen.signal ?? defaultSignalSettings) {
 const {cells, pixels} = stats(screen);
 const panelPixels = screen.panel.resX * screen.panel.resY;
 const panelsPerPort = Math.floor(settings.portCapacity / panelPixels);
 const ports: SignalPort[] = [];
 if (!panelsPerPort || !cells.length) {
  return {ports, cells, panelPixels, pixels, panelsPerPort, splitAtGap: false};
 }

 // The initial lane starts at the chosen corner of the active panel grid.
 const left = Math.min(...cells.map(cell => cell.c));
 const right = Math.max(...cells.map(cell => cell.c));
 const top = Math.min(...cells.map(cell => cell.r));
 const bottom = Math.max(...cells.map(cell => cell.r));
 const byRows = settings.direction === 'rows';
 const fromBottom = settings.corner.startsWith('bottom');
 const fromRight = settings.corner.endsWith('right');
 const laneLength = byRows ? right - left + 1 : bottom - top + 1;

 function position({c, r}: Cell) {
  const x = fromRight ? right - c : c - left;
  const y = fromBottom ? bottom - r : r - top;
  const lane = byRows ? y : x;
  const offset = byRows ? x : y;
  return lane * laneLength + (lane % 2 ? laneLength - 1 - offset : offset);
 }

 const ordered = [...cells].sort((a, b) => position(a) - position(b));
 let port: SignalPort | undefined;
 let previous: Cell | undefined;
 let splitAtGap = false;
 for (const cell of ordered) {
  const gap = previous && Math.abs(previous.c - cell.c) + Math.abs(previous.r - cell.r) !== 1;
  if (!port || port.cells.length === panelsPerPort || gap) {
   if (gap && port && port.cells.length < panelsPerPort) splitAtGap = true;
   port = {number: ports.length + 1, cells: [], pixels: 0, remaining: settings.portCapacity};
   ports.push(port);
  }
  port.cells.push(cell);
  port.pixels += panelPixels;
  port.remaining -= panelPixels;
  previous = cell;
 }
 return {ports, cells, panelPixels, pixels, panelsPerPort, splitAtGap};
}
