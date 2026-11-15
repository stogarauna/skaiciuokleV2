import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {defaultSignalSettings, signalPlan, signalPresets, snakePanelBlock} from '../src/lib/signal.ts';

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

test('stepped edges retain efficient rectangles and a hole no longer blocks routing', () => {
 const screen = makeScreen(panel);
 screen.removed = ['0,0', '1,0', '2,0', '3,0'];
 const plan = signalPlan(screen);
 assert.deepEqual(plan.ports.map(port => [port.columns, port.rows]), [[4, 4], [4, 5]]);
 assert.deepEqual(plan.ports.map(port => port.cells[0]), [{c: 0, r: 4}, {c: 4, r: 4}]);
 screen.removed.push('6,3');
 const repaired = signalPlan(screen);
 assert.equal(repaired.issue, null);
 const routed = repaired.ports.flatMap(port => port.cells.map(({c, r}) => `${c},${r}`));
 assert.equal(routed.length, 35);
 assert.equal(new Set(routed).size, 35);
 assert.ok(!routed.includes('6,3'));
 assert.ok(repaired.ports.every(port => port.pixels <= defaultSignalSettings.portCapacity));
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

test('23 by 8 P3 panels route in full-width two-row blocks within the pixel limit', () => {
 const screen = makeScreen({...panel, resX: 128, resY: 128});
 screen.cols = 23;
 screen.rows = 8;
 const settings = {
  ...defaultSignalSettings, entryEdge: 'left', corner: 'top-left', maxTracksPerPort: 2
 } as const;
 const plan = signalPlan(screen, settings);
 assert.deepEqual(plan.ports.map(port => [port.columns, port.rows, port.pixels]),
  Array.from({length: 4}, () => [23, 2, 753_664]));
 assert.deepEqual(plan.ports.map(port => port.cells[0]),
  [0, 2, 4, 6].map(r => ({c: 0, r})));
 assert.deepEqual(plan.ports[0].cells.slice(22, 24), [{c: 22, r: 0}, {c: 22, r: 1}]);
 assert.equal(signalPlan(screen, {...settings, maxTracksPerPort: 1}).ports.length, 8);

 const at60Hz = signalPlan(screen, {...settings, preset: '60-8', portCapacity: 650_000});
 assert.equal(at60Hz.ports.length, 8);
 assert.ok(at60Hz.ports.every(port => port.columns === 23 && port.rows === 1));
});

test('project JSON preserves signal settings and accepts projects from before the feature', () => {
 const screen = makeScreen(panel);
 const project = {version: 1 as const, name: 'Testas', screens: [screen]};
 assert.equal(parseProject(project).screens[0].signal, undefined);
 screen.signal = {portCapacity: 783_000, direction: 'columns', corner: 'bottom-left', maxTracksPerPort: 2};
 const restored = parseProject(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(restored.screens[0].signal, screen.signal);
 screen.signal.maxTracksPerPort = 0;
 assert.throws(() => parseProject(project), /komutacijos/);
 screen.signal.maxTracksPerPort = 2;
 screen.signal.portCapacity = 0;
 assert.throws(() => parseProject(project), /komutacijos/);
});

test('a stepped 128 px screen snakes along rows or columns with the depicted diagonal bend', () => {
 const screen = {...makeScreen({...panel, resX:128, resY:128}), cols:5, rows:5, removed:['0,0','1,0','0,1']};
 const horizontal = signalPlan(screen, {...defaultSignalSettings, entryEdge:'left', corner:'top-left'});
 assert.deepEqual(horizontal.ports.map(port=>[port.cells.length,port.pixels]), [[22,409600]]);
 assert.equal(horizontal.ports[0].activePixels,360448);
 assert.deepEqual(horizontal.ports[0].cells.slice(0,9), [
  {c:2,r:0},{c:3,r:0},{c:4,r:0},{c:4,r:1},{c:3,r:1},{c:2,r:1},{c:1,r:1},{c:0,r:2},{c:1,r:2}
 ]);
 const vertical = signalPlan(screen, {...defaultSignalSettings, entryEdge:'top', corner:'top-right', direction:'columns'});
 assert.equal(vertical.ports.length,1);
 assert.deepEqual(vertical.ports[0].cells.slice(0,6), [
  {c:4,r:0},{c:4,r:1},{c:4,r:2},{c:4,r:3},{c:4,r:4},{c:3,r:4}
 ]);
 assert.deepEqual(vertical.ports[0].cells.slice(18,20), [{c:1,r:1},{c:0,r:2}]);
});

test('a gap within a line is bridged, and irregular routes respect capacity and track limits', () => {
 const screen = {...makeScreen({...panel, resX:128, resY:128}), cols:5, rows:2, removed:['3,0']};
 const settings = {...defaultSignalSettings, entryEdge:'left', corner:'top-left'} as const;
 const full = signalPlan(screen,settings);
 assert.equal(full.ports.length,1);
 assert.deepEqual(full.ports[0].cells.slice(2,5),[{c:2,r:0},{c:4,r:0},{c:4,r:1}]);
 const two = signalPlan(screen,{...settings,maxTracksPerPort:1});
 assert.deepEqual(two.ports.map(port=>port.cells.length),[4,5]);
 const small = signalPlan(screen,{...settings,preset:undefined,portCapacity:3*16384});
 assert.deepEqual(small.ports.map(port=>port.cells.length),[3,1,3,2]);
 assert.equal(new Set(small.ports.flatMap(port=>port.cells.map(({c,r})=>`${c},${r}`))).size,9);
 assert.ok(small.ports.every(port=>port.pixels<=3*16384));
});

test('automatic routing splits a stepped shape when the footprint exceeds the port limit', () => {
 const screen = {...makeScreen({...panel, resX:128, resY:128}), cols:5, rows:5, removed:['0,0','1,0','0,1']};
 const options = {...defaultSignalSettings, entryEdge:'left', corner:'top-left', preset:undefined, portCapacity:23*16384} as const;
 const plan = signalPlan(screen,options);
 assert.equal(plan.ports.length,2);
 assert.equal(plan.ports.flatMap(port=>port.cells).length,22);
 assert.ok(plan.ports.every(port=>port.pixels===port.columns*port.rows*16384 && port.remaining>=0));
 const isolated = {...screen,rows:2,removed:['1,0','2,0','3,0','1,1','2,1','3,1','4,1']};
 const gapped = signalPlan(isolated,{...options,portCapacity:2*16384});
 assert.equal(new Set(gapped.ports.flatMap(port=>port.cells.map(c=>`${c.c},${c.r}`))).size,3);
 assert.ok(gapped.ports.every(port=>port.pixels<=2*16384));
});

test('manual routes keep the saved click order, omit removed cells and report overloads', () => {
 const screen=makeScreen(panel);
 Object.assign(screen,{cols:3,rows:3,removed:['1,1']});
 const path=[{c:2,r:2},{c:1,r:1},{c:0,r:0}];
 screen.signal={
  ...defaultSignalSettings, preset:undefined, portCapacity:8*36864, routeMode:'manual',
  manualRoutes:{'0,0,3,3':[path]}
 };
 const saved=parseProject(JSON.parse(JSON.stringify({version:1,name:'Rankinis',screens:[screen]}))).screens[0];
 assert.deepEqual(saved.signal,JSON.parse(JSON.stringify(screen.signal)));
 const [route]=signalPlan(saved).ports;
 assert.deepEqual(route.cells,[path[0],path[2]]);
 assert.equal(route.activePixels,2*36864);
 assert.equal(route.pixels,9*36864);
 assert.equal(route.remaining,-36864);
 screen.signal.manualRoutes!['0,0,3,3'].push([path[0]]);
 assert.throws(()=>parseProject({version:1,name:'Rankinis',screens:[screen]}),/komutacijos/);
});

test('selected cells snake by row or column from the chosen corner, skipping gaps', () => {
 const cells=[{c:2,r:1},{c:4,r:1},{c:2,r:2},{c:3,r:2},{c:4,r:2}];
 assert.deepEqual(snakePanelBlock(cells,{direction:'rows',corner:'top-left'}),
  [cells[0],cells[1],cells[4],cells[3],cells[2]]);
 assert.deepEqual(snakePanelBlock(cells,{direction:'columns',corner:'bottom-right'}),
  [cells[4],cells[1],cells[3],cells[2],cells[0]]);
 assert.deepEqual(cells,[{c:2,r:1},{c:4,r:1},{c:2,r:2},{c:3,r:2},{c:4,r:2}]);
});
