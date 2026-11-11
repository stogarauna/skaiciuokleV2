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

const entryEdges = ['bottom', 'top', 'left', 'right'] as const;
export type SignalEntryEdge = typeof entryEdges[number];

export type SignalPartPositions = Record<string, {x: number; y: number}>;

export interface SignalOutputSettings {
 width: number;
 height: number;
 partsAcross?: number;
 positions?: SignalPartPositions;
}

export const defaultSignalOutput: Readonly<SignalOutputSettings> = {width: 3840, height: 2160};

export interface SignalSettings {
 portCapacity: number;
 preset?: typeof signalModes[number]['id'];
 direction: 'rows' | 'columns';
 entryEdge?: SignalEntryEdge;
 maxTracksPerPort?: number;
 output?: SignalOutputSettings;
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

export function validSignalTrackLimit(value: unknown): value is number {
 return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}

function validPartPositions(value: unknown): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 return Object.entries(value).every(([key, point]) =>
  /^\d+,\d+,\d+,\d+$/.test(key) && point && typeof point === 'object'
  && Number.isFinite(point.x) && Number.isFinite(point.y)
  && Math.abs(point.x) <= 10000 && Math.abs(point.y) <= 10000
 );
}

export function validateSignalSettings(value: unknown): value is SignalSettings {
 if (!value || typeof value !== 'object') return false;
 const {portCapacity, preset, direction, entryEdge, corner, maxTracksPerPort, output} = value as SignalSettings;
 return validPortCapacity(portCapacity)
  && (preset === undefined || signalPresets.some(mode => mode.id === preset && mode.capacity === portCapacity))
  && (entryEdge === undefined || entryEdges.includes(entryEdge))
  && (maxTracksPerPort === undefined || validSignalTrackLimit(maxTracksPerPort))
  && (output === undefined || (output !== null && typeof output === 'object'
   && validPortCapacity(output.width) && validPortCapacity(output.height)
   && (output.partsAcross === undefined || validSignalTrackLimit(output.partsAcross))
   && (output.positions === undefined || validPartPositions(output.positions))))
  && (direction === 'rows' || direction === 'columns')
  && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(corner)
  && (entryEdge === undefined || corner.split('-').includes(entryEdge));
}

export type BlockRoutingSettings = Pick<SignalSettings, 'direction' | 'entryEdge' | 'corner' | 'maxTracksPerPort'>;

export function signalEntryEdge(settings: BlockRoutingSettings): SignalEntryEdge {
 return settings.entryEdge ?? (settings.corner.startsWith('bottom') ? 'bottom' : 'top');
}

type Cell = ReturnType<typeof stats>['cells'][number];

export interface PanelRoute {
 number: number;
 cells: Cell[];
 columns: number;
 rows: number;
}

export interface RouteMap {
 cells: Cell[];
 ports: PanelRoute[];
}

function snake(left: number, top: number, columns: number, rows: number, settings: BlockRoutingSettings): Cell[] {
 const edge = signalEntryEdge(settings);
 const sideEntry = edge === 'left' || edge === 'right';
 const fromBottom = sideEntry ? settings.corner.startsWith('bottom') : edge === 'bottom';
 const fromRight = sideEntry ? edge === 'right' : settings.corner.endsWith('right');
 const byRows = settings.direction === 'rows';
 const laneLength = byRows ? columns : rows;
 return Array.from({length: columns * rows}, (_, index) => {
  const lane = Math.floor(index / laneLength);
  const step = index % laneLength;
  const offset = lane % 2 ? laneLength - 1 - step : step;
  const x = byRows ? offset : lane;
  const y = byRows ? lane : offset;
  return {c: left + (fromRight ? columns - 1 - x : x), r: top + (fromBottom ? rows - 1 - y : y)};
 });
}

export function rectangularRoutes(screen: Screen, settings: BlockRoutingSettings, panelsPerPort: number) {
 const {cells, left, top} = stats(screen);
 const ports: PanelRoute[] = [];
 const result = {ports, cells, issue: null as 'gap' | 'depth' | null};
 if (!panelsPerPort || !cells.length) return result;

 const right = Math.max(...cells.map(cell => cell.c));
 const bottom = Math.max(...cells.map(cell => cell.r));
 const edge = signalEntryEdge(settings);
 const sideEntry = edge === 'left' || edge === 'right';
 const reverse = sideEntry ? settings.corner.startsWith('bottom') : settings.corner.endsWith('right');
 const trackCount = sideEntry ? bottom - top + 1 : right - left + 1;
 const tracks = Array.from({length: trackCount}, () => ({length: 0, depth: 0}));

 // A rectangle touching the entry edge must include every panel between
 // that edge and its furthest panel. Adjacent tracks of equal depth can share it.
 for (const {c, r} of cells) {
  const index = sideEntry ? r - top : c - left;
  const track = tracks[reverse ? trackCount - 1 - index : index];
  const depth = edge === 'bottom' ? bottom - r : edge === 'top' ? r - top : edge === 'right' ? right - c : c - left;
  track.length++;
  track.depth = Math.max(track.depth, depth + 1);
 }

 if (tracks.some(track => track.length !== track.depth)) return {...result, issue: 'gap' as const};
 if (tracks.some(track => track.depth > panelsPerPort)) return {...result, issue: 'depth' as const};

 for (let start = 0; start < trackCount;) {
  const {depth} = tracks[start];
  if (!depth) {
   start++;
   continue;
  }
  let end = start + 1;
  while (end < trackCount && tracks[end].depth === depth) end++;
  const capacityTracks = Math.floor(panelsPerPort / depth);
  const maxTracks = Math.min(capacityTracks, settings.maxTracksPerPort ?? capacityTracks);
  const blockCount = Math.ceil((end - start) / maxTracks);

  for (let block = 0; block < blockCount; block++) {
   const width = Math.ceil((end - start) / (blockCount - block));
   const offset = reverse ? trackCount - start - width : start;
   const columns = sideEntry ? depth : width;
   const rows = sideEntry ? width : depth;
   const blockLeft = sideEntry ? (edge === 'right' ? right - depth + 1 : left) : left + offset;
   const blockTop = sideEntry ? top + offset : (edge === 'bottom' ? bottom - depth + 1 : top);
   ports.push({
    number: ports.length + 1, columns, rows,
    cells: snake(blockLeft, blockTop, columns, rows, settings)
   });
   start += width;
  }
 }

 return result;
}

export function signalPlan(screen: Screen, settings = screen.signal ?? defaultSignalSettings) {
 const panelPixels = screen.panel.resX * screen.panel.resY;
 const panelsPerPort = Math.floor(settings.portCapacity / panelPixels);
 const routes = rectangularRoutes(screen, settings, panelsPerPort);
 return {
  ...routes, panelPixels, panelsPerPort, pixels: routes.cells.length * panelPixels,
  ports: routes.ports.map(port => {
   const pixels = port.cells.length * panelPixels;
   return {...port, pixels, remaining: settings.portCapacity - pixels};
  })
 };
}
