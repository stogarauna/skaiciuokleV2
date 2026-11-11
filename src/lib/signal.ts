import {stats, type Screen} from './project.ts';

// 1 Gb/s at 93.6% utilisation. This table's 10/12-bit mode uses 16 bits per channel.
const signalModes = [
 {id: '50-8', hz: 50, depth: '8', channelBits: 8},
 {id: '60-8', hz: 60, depth: '8', channelBits: 8},
 {id: '30-8', hz: 30, depth: '8', channelBits: 8},
 {id: '50-10-12', hz: 50, depth: '10 / 12', channelBits: 16},
 {id: '60-10-12', hz: 60, depth: '10 / 12', channelBits: 16},
 {id: '30-10-12', hz: 30, depth: '10 / 12', channelBits: 16}
] as const;

export const signalPresets = signalModes.map(mode => ({
 id: mode.id,
 label: `${mode.depth} bitų · ${mode.hz} Hz`,
 capacity: Math.floor(936_000_000 / (mode.hz * 3 * mode.channelBits))
}));

export interface SignalSettings {
 portCapacity: number;
 preset?: typeof signalModes[number]['id'];
 direction: 'rows' | 'columns';
 corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const defaultSignalSettings: Readonly<SignalSettings> = {
 portCapacity: signalPresets[0].capacity,
 preset: signalPresets[0].id,
 direction: 'rows',
 corner: 'bottom-left'
};

export function validPortCapacity(value: unknown): value is number {
 return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateSignalSettings(value: unknown): value is SignalSettings {
 if (!value || typeof value !== 'object') return false;
 const {portCapacity, preset, direction, corner} = value as SignalSettings;
 return validPortCapacity(portCapacity)
  && (preset === undefined || signalPresets.some(mode => mode.id === preset && mode.capacity === portCapacity))
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
