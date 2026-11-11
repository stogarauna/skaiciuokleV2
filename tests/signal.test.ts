import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {defaultSignalSettings, signalPlan, signalPresets} from '../src/lib/signal.ts';

const panel = {name: 'P2', widthM: 0.5, heightM: 0.5, resX: 192, resY: 192, weightKg: null, power: null};

test('signal allocates full panels without exceeding the port capacity', () => {
 const screen = makeScreen(panel);
 const plan = signalPlan(screen);
 assert.equal(plan.panelsPerPort, 21);
 assert.deepEqual(plan.ports.map(port => [port.cells.length, port.pixels, port.remaining]), [
  [21, 774_144, 5_856], [19, 700_416, 79_584]
 ]);
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
 assert.deepEqual(signalPlan(screen, settings).ports.map(port => port.cells.length), [17, 17, 6]);
 screen.signal = settings;
 const project = {version: 1 as const, name: 'Testas', screens: [screen]};
 assert.deepEqual(parseProject(project).screens[0].signal, settings);
 screen.signal = {...settings, portCapacity: 780_000};
 assert.throws(() => parseProject(project), /komutacijos/);
});

test('every starting corner and direction respects adjacency and removed panels', () => {
 const screen = makeScreen(panel);
 screen.removed = ['3,4', '4,2', '0,1'];
 for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
  for (const direction of ['rows', 'columns'] as const) {
   const settings = {...defaultSignalSettings, corner, direction};
   const plan = signalPlan(screen, settings);
   const routed = plan.ports.flatMap(port => port.cells.map(({c, r}) => `${c},${r}`));
   assert.equal(routed.length, 37);
   assert.equal(new Set(routed).size, 37);
   assert.ok(screen.removed.every(cell => !routed.includes(cell)));
   assert.deepEqual(plan.ports[0].cells[0], {
    c: corner.endsWith('right') ? 7 : 0,
    r: corner.startsWith('bottom') ? 4 : 0
   });
   for (const port of plan.ports) {
    assert.ok(port.pixels <= settings.portCapacity);
    assert.ok(port.cells.slice(1).every((cell, i) =>
     Math.abs(cell.c - port.cells[i].c) + Math.abs(cell.r - port.cells[i].r) === 1));
   }
  }
 }
});

test('a gap splits a route and a limit below one panel yields no port', () => {
 const screen = makeScreen(panel);
 screen.rows = 1;
 screen.cols = 3;
 screen.removed = ['1,0'];
 const plan = signalPlan(screen);
 assert.deepEqual(plan.ports.map(port => port.cells.length), [1, 1]);
 assert.equal(plan.splitAtGap, true);
 assert.equal(signalPlan(screen, {...defaultSignalSettings, preset: undefined, portCapacity: 36_863}).ports.length, 0);
 screen.removed = ['0,0', '1,0', '2,0'];
 assert.equal(signalPlan(screen).ports.length, 0);
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
