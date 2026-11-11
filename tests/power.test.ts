import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {defaultPowerSettings, powerPlan, powerPlanIssue} from '../src/lib/power.ts';

const panel = {name: 'P4', widthM: 0.5, heightM: 0.5, resX: 104, resY: 104, weightKg: 8, power: 150};

test('each circuit is one straight row or column and starts on the selected edge', () => {
 const screen = {...makeScreen(panel), cols: 23, rows: 4};
 const horizontal = powerPlan(screen);
 assert.equal(horizontal.totalWatts, 13_800);
 assert.deepEqual(horizontal.ports.map(port => [port.columns, port.rows, port.watts, port.remaining]), Array.from({length: 4}, () => [23, 1, 3450, 150]));
 assert.deepEqual(horizontal.ports.map(port => port.cells[0]), [0, 1, 2, 3].map(r => ({c: 0, r})));
 const vertical = powerPlan(screen, {...defaultPowerSettings, direction: 'columns', edge: 'bottom'});
 assert.equal(vertical.ports.length, 23);
 assert.ok(vertical.ports.every(port => port.columns === 1 && port.rows === 4 && port.cells[0].r === 3));
});

test('unavailable power and lines over the manual limit do not produce a circuit', () => {
 const screen = {...makeScreen(panel), cols: 25, rows: 4};
 assert.equal(powerPlan(screen).issue, 'depth');
 assert.equal(powerPlan(screen).ports.length, 0);
 assert.equal(powerPlan(screen, {...defaultPowerSettings, limitW: 4000}).ports.length, 4);
 screen.removed = ['10,2'];
 assert.equal(powerPlan(screen, {...defaultPowerSettings, limitW: 4000}).issue, 'gap');
 screen.panel.power = null;
 assert.match(powerPlanIssue(powerPlan(screen))!, /Nenurodyta panelės galia/);
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
