import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {defaultSignalSettings, signalPlan, signalPresets} from '../src/lib/signal.ts';

const panel = {name: 'P2', widthM: 0.5, heightM: 0.5, resX: 192, resY: 192, weightKg: null, power: null};

test('8-bit 50 Hz splits the screen into full-height rectangles starting at the bottom', () => {
 const screen = makeScreen(panel);
 const plan = signalPlan(screen);
 assert.equal(plan.panelsPerPort, 21);
 assert.deepEqual(plan.ports.map(port => [port.columns, port.rows, port.pixels, port.remaining]), [
  [4, 5, 737_280, 42_720], [4, 5, 737_280, 42_720]
 ]);
 assert.deepEqual(plan.ports.map(port => port.cells[0]), [{c: 0, r: 4}, {c: 4, r: 4}]);
 assert.deepEqual(plan.ports[0].cells.slice(0, 2), [{c: 0, r: 4}, {c: 1, r: 4}]);
 assert.equal(signalPlan(screen, {...defaultSignalSettings, preset: undefined, portCapacity: 400_000}).ports.length, 4);
});

test('the six table modes use the stated capacities and 8-bit 60 Hz updates the route count', () => {
 assert.deepEqual(Object.fromEntries(signalPresets.map(mode => [mode.id, mode.capacity])), {
  '50-8': 780_000, '60-8': 650_000, '30-8': 1_300_000,
  '50-10-12': 390_000, '60-10-12': 325_000, '30-10-12': 650_000
 });
 const screen = makeScreen(panel);
 const mode = signalPresets.find(mode => mode.id === '60-8')!;
 const settings = {...defaultSignalSettings, preset: mode.id, portCapacity: mode.capacity};
 assert.deepEqual(signalPlan(screen, settings).ports.map(port => port.cells.length), [15, 15, 10]);
 screen.signal = settings;
 const project = {version: 1 as const, name: 'Testas', screens: [screen]};
 assert.deepEqual(parseProject(project).screens[0].signal, settings);
 screen.signal = {...settings, portCapacity: 780_000};
 assert.throws(() => parseProject(project), /komutacijos/);
});

test('each entry edge produces rectangles whose first panels are on that screen edge', () => {
 const screen = makeScreen(panel);
 const cases = [
  {edge: 'bottom', corner: 'bottom-right'},
  {edge: 'top', corner: 'top-left'},
  {edge: 'left', corner: 'bottom-left'},
  {edge: 'right', corner: 'top-right'}
 ] as const;
 for (const {edge, corner} of cases) {
  for (const direction of ['rows', 'columns'] as const) {
   const settings = {...defaultSignalSettings, corner, direction, entryEdge: edge};
   const plan = signalPlan(screen, settings);
   const routed = plan.ports.flatMap(port => port.cells.map(({c, r}) => `${c},${r}`));
   assert.equal(routed.length, 40);
   assert.equal(new Set(routed).size, 40);
   for (const port of plan.ports) {
    const {c, r} = port.cells[0];
    assert.ok(edge === 'bottom' ? r === 4 : edge === 'top' ? r === 0 : edge === 'left' ? c === 0 : c === 7);
    assert.equal(port.cells.length, port.columns * port.rows);
    assert.ok(port.pixels <= settings.portCapacity);
    assert.ok(port.cells.slice(1).every((cell, i) =>
     Math.abs(cell.c - port.cells[i].c) + Math.abs(cell.r - port.cells[i].r) === 1));
   }
  }
 }
});

test('stepped edges can use different rectangle heights and holes block invalid routes', () => {
 const screen = makeScreen(panel);
 screen.removed = ['0,0', '1,0', '2,0', '3,0'];
 const plan = signalPlan(screen);
 assert.deepEqual(plan.ports.map(port => [port.columns, port.rows]), [[4, 4], [4, 5]]);
 assert.deepEqual(plan.ports.map(port => port.cells[0]), [{c: 0, r: 4}, {c: 4, r: 4}]);
 screen.removed.push('6,3');
 const blocked = signalPlan(screen);
 assert.equal(blocked.issue, 'gap');
 assert.equal(blocked.ports.length, 0);
});

test('when a single full-depth track exceeds the port capacity, a different edge can fit', () => {
 const screen = makeScreen(panel);
 screen.cols = 3;
 screen.rows = 8;
 const settings = {...defaultSignalSettings, preset: undefined, portCapacity: 4 * 36_864};
 assert.equal(signalPlan(screen, settings).issue, 'depth');
 const side = signalPlan(screen, {...settings, entryEdge: 'left'});
 assert.equal(side.issue, null);
 assert.equal(side.ports.length, 8);
 assert.ok(side.ports.every(port => port.columns === 3 && port.rows === 1));
 assert.equal(signalPlan(screen, {...settings, portCapacity: 36_863}).ports.length, 0);
});

test('project JSON preserves signal settings and accepts projects from before the feature', () => {
 const screen = makeScreen(panel);
 const project = {version: 1 as const, name: 'Testas', screens: [screen]};
 assert.equal(parseProject(project).screens[0].signal, undefined);
 screen.signal = {portCapacity: 783_000, direction: 'columns', corner: 'bottom-left'};
 const restored = parseProject(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(restored.screens[0].signal, screen.signal);
 screen.signal.portCapacity = 0;
 assert.throws(() => parseProject(project), /komutacijos/);
});
