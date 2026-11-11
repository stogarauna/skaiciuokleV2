import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen, parseProject} from '../src/lib/project.ts';
import {physicalPanelNumber, signalOutputs} from '../src/lib/signal-output.ts';
import {defaultSignalOutput, defaultSignalSettings} from '../src/lib/signal.ts';

const panel = {name: 'P4', widthM: 0.5, heightM: 0.5, resX: 104, resY: 104, weightKg: 8, power: 160};

test('a 100 × 4 screen fits into three or four UHD outputs without changing physical geometry', () => {
 const screen = {...makeScreen(panel), cols: 100, rows: 4};
 const original = structuredClone(screen);
 const cases = [
  [undefined, [36, 36, 28]],
  [3, [36, 36, 28]],
  [4, [25, 25, 25, 25]]
 ] as const;
 for (const [partsAcross, expected] of cases) {
  const output = {...defaultSignalOutput, partsAcross};
  const result = signalOutputs(screen, {...defaultSignalSettings, output});
  assert.equal(result.issue, null);
  assert.equal(result.minAcross, 3);
  assert.deepEqual(result.parts.map(part => part.screen.cols), expected);
  assert.deepEqual(result.parts.map(part => part.width), expected.map(columns => columns * 104));
  const numbers = result.parts.flatMap(part => {
   assert.ok(part.width <= 3840 && part.height <= 2160);
   assert.equal(part.plan.ports[0].number, 1);
   assert.ok(part.plan.ports.every(port => port.pixels <= defaultSignalSettings.portCapacity));
   return part.plan.ports.flatMap(port => port.cells.map(cell => physicalPanelNumber(screen, part, cell)));
  });
  assert.deepEqual(numbers.sort((a, b) => a - b), Array.from({length: 400}, (_, index) => index + 1));
  assert.deepEqual(screen, original);
 }
 assert.match(signalOutputs(screen, {...defaultSignalSettings, output: {...defaultSignalOutput, partsAcross: 2}}).issue!, /bent 3/);
});

test('splitting tall screens preserves removed cells and physical panel numbers in each part', () => {
 const screen = {...makeScreen(panel), cols: 4, rows: 5, removed: ['2,3']};
 const settings = {...defaultSignalSettings, output: {width: 208, height: 312}};
 const {parts} = signalOutputs(screen, settings);
 assert.deepEqual(parts.map(part => [part.column, part.row, part.width, part.height]), [
  [0, 0, 208, 312], [2, 0, 208, 312], [0, 3, 208, 208], [2, 3, 208, 208]
 ]);
 assert.deepEqual(parts[3].screen.removed, ['0,0']);
 assert.deepEqual(parts[3].plan.cells.map(cell => physicalPanelNumber(screen, parts[3], cell)), [16, 19, 20]);
 assert.match(signalOutputs(screen, {...settings, output: {width: 100, height: 100}}).issue!, /netelpa viena/);
});

test('output settings survive JSON and screens without a split still plan as one screen', () => {
 const screen = makeScreen(panel);
 const project = {version: 1 as const, name: 'Bandymas', screens: [screen]};
 const old = parseProject(project).screens[0];
 assert.deepEqual(signalOutputs(old).parts.map(part => part.screen.cols), [old.cols]);
 screen.signal = {...defaultSignalSettings, output: {
  ...defaultSignalOutput, partsAcross: 4, positions: {'0,0,2,5': {x: 2.25, y: -1}}
 }};
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))).screens[0].signal, screen.signal);
 assert.equal(signalOutputs(screen).parts[0].screen.x, screen.x);
 assert.equal(signalOutputs(screen).parts[0].screen.y, screen.y);
 screen.signal.output!.width = 0;
 assert.throws(() => parseProject(project), /komutacijos/);
});
