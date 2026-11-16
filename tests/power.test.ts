import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {defaultPowerSettings, powerPlan, powerPlanIssue} from '../src/lib/power.ts';

const panel = {name: 'P4', widthM: 0.5, heightM: 0.5, resX: 104, resY: 104, weightKg: 8, power: 150};

test('adjacent full lines share a rectangular circuit when their combined load fits', () => {
 const screen = {...makeScreen(panel), cols: 23, rows: 4};
 const horizontal = powerPlan(screen);
 assert.equal(horizontal.totalWatts, 13_800);
 assert.deepEqual(horizontal.ports.map(port => [port.columns, port.rows, port.watts, port.remaining]), Array.from({length: 4}, () => [23, 1, 3450, 150]));
 assert.deepEqual(horizontal.ports.map(port => port.cells[0]), [0, 1, 2, 3].map(r => ({c: 0, r})));
 const vertical = powerPlan(screen, {...defaultPowerSettings, direction: 'columns', edge: 'bottom'});
 assert.deepEqual(vertical.ports.map(port => [port.columns, port.rows]), [[6, 4], [6, 4], [6, 4], [5, 4]]);
 assert.ok(vertical.ports.every(port => port.cells[0].r === 3));
 const compact = powerPlan({...screen, cols: 12});
 assert.deepEqual(compact.ports.map(port => [port.columns, port.rows, port.watts]), [[12, 2, 3600], [12, 2, 3600]]);
 assert.deepEqual(compact.ports[0].cells.slice(11, 13), [{c: 11, r: 0}, {c: 11, r: 1}]);
});

test('a line over the watt limit is split evenly with an independent feed for each segment', () => {
 const screen = {...makeScreen(panel), cols: 25, rows: 4};
 const plan = powerPlan(screen, {...defaultPowerSettings, edge: 'right'});
 assert.equal(powerPlanIssue(plan), null);
 assert.equal(plan.splitLines, 4);
 assert.deepEqual(plan.ports.slice(0, 2).map(port => [port.cells[0].c, port.columns, port.watts]),
  [[24, 13, 1950], [11, 12, 1800]]);
 assert.equal(plan.ports.length, 8);
 assert.equal(powerPlan(screen, {...defaultPowerSettings, limitW: 4000}).ports.length, 4);
 const longer = powerPlan({...screen, cols: 50, rows: 1});
 assert.deepEqual(longer.ports.map(port => port.cells.length), [17, 17, 16]);
 assert.equal(new Set(plan.ports.flatMap(port => port.cells.map(({c, r}) => `${c},${r}`))).size, 100);
 assert.ok(plan.ports.every(port => port.watts <= 3600));
});

test('missing panels split straight lines, and aligned runs can share one feed', () => {
 const screen = {...makeScreen(panel), cols: 7, rows: 4, removed: ['0,0', '0,1', '3,0', '3,1', '6,3']};
 const plan = powerPlan(screen, {...defaultPowerSettings, limitW: 900});
 assert.deepEqual(plan.ports.slice(0, 2).map(port => [port.cells[0], port.columns, port.rows]),
  [[{c:1,r:0},2,2], [{c:4,r:0},3,2]]);
 for (const [direction, edge] of [['rows','left'], ['rows','right'], ['columns','top'], ['columns','bottom']] as const) {
  const plan = powerPlan(screen, {direction, edge, limitW: 900});
  assert.equal(powerPlanIssue(plan), null);
  assert.equal(plan.totalWatts, 23 * 150);
  assert.deepEqual(plan.ports.flatMap(port => port.cells.map(({c,r}) => `${c},${r}`)).sort(),
   plan.cells.map(({c,r}) => `${c},${r}`).sort());
  for (const port of plan.ports) {
   assert.ok(port.watts <= 900);
   for (let i = 1; i < port.cells.length; i++) {
    const a = port.cells[i-1], b = port.cells[i];
    assert.equal(Math.abs(a.c-b.c) + Math.abs(a.r-b.r), 1);
   }
  }
 }
 assert.match(powerPlanIssue(powerPlan({...screen, panel: {...screen.panel, power:null}}))!, /Nenurodyta panelės galia/);
});

test('power routing settings round-trip independently of signal settings', () => {
 const screen = makeScreen(panel);
 const project = {version: 1 as const, name: 'Bandymas', screens: [screen]};
 assert.equal(parseProject(project).screens[0].powerRouting, undefined);
 screen.powerRouting = {limitW: 3000, direction: 'columns', edge: 'top'};
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))).screens[0].powerRouting, screen.powerRouting);
 screen.powerRouting.edge = 'right';
 assert.throws(() => parseProject(project), /maitinimo komutacijos/);
});
