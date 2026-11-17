import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen} from '../src/lib/project.ts';
import {defaultPowerSettings} from '../src/lib/power.ts';
import {outletLimitW, phaseLimitW, stageboxPlan} from '../src/lib/stagebox.ts';

const panel = {name:'P4',widthM:.5,heightM:.5,resX:104,resY:104,weightKg:8,power:150};

test('six fully loaded circuits share a 32 A feed and a seventh requires another feed', () => {
 const screen = {...makeScreen(panel),cols:24,rows:7,powerRouting:{...defaultPowerSettings,limitW:5000}};
 const distribution = stageboxPlan([screen]);
 assert.equal(distribution.feeds.length,2);
 assert.equal(distribution.boxCount,2);
 assert.deepEqual(distribution.feeds[0].phases.map(phase=>phase.watts),[7200,7200,7200]);
 assert.equal(distribution.screenPlans[0].plan.ports.length,7);
 assert.ok(distribution.screenPlans[0].plan.ports.every(port=>port.watts===outletLimitW));
});

test('linked boxes for one screen share its phase budget', () => {
 const routing = {...defaultPowerSettings,limitW:1500};
 const main = {...makeScreen(panel),cols:10,rows:7,powerRouting:routing};
 const distribution = stageboxPlan([main]);
 assert.equal(distribution.feeds.length,1);
 assert.equal(distribution.boxCount,2);
 assert.deepEqual(distribution.feeds[0].phases.map(phase=>phase.watts),[4500,3000,3000]);
 const assignments = [...distribution.assignments.values()].flatMap(screen=>[...screen.values()]);
 assert.equal(assignments.length,7);
 assert.equal(new Set(assignments.map(item=>JSON.stringify(item))).size,7);
 assert.ok(assignments.every(item=>item.outlet>=1&&item.outlet<=2));
 assert.ok(distribution.feeds[0].phases.every(phase=>phase.watts<=phaseLimitW));
});

test('unknown panel power is flagged without assigning the circuit to an outlet', () => {
 const screen = makeScreen({...panel,power:null});
 const plan = stageboxPlan([screen]);
 assert.equal(plan.incomplete,true);
 assert.equal(plan.feeds.length,0);
 assert.equal(plan.assignments.size,0);
});

test('14 full circuits leave L3 free even with a second screen', () => {
 const main = {...makeScreen(panel),cols:28,rows:12,powerRouting:{...defaultPowerSettings,direction:'columns',edge:'top'} as const};
 const side = {...makeScreen(panel,1),cols:24,rows:1};
 const mainOnly = stageboxPlan([main]);
 assert.equal(mainOnly.boxCount,3);
 assert.deepEqual(mainOnly.feeds.map(feed=>feed.phases.map(phase=>phase.watts)),[
  [7200,7200,7200], [7200,7200,7200], [3600,3600,0]
 ]);
 assert.deepEqual(mainOnly.feeds[2].phases.map(phase=>phase.outlets),[1,1,0]);

 const shared = stageboxPlan([main,side]);
 assert.equal(shared.boxCount,4);
 assert.deepEqual(shared.feeds.map(feed=>feed.screenId),[main.id,main.id,main.id,side.id]);
 assert.equal(shared.screenPlans[0].plan.ports.length,14);
 assert.deepEqual(shared.feeds[2].phases.map(phase=>phase.watts),[3600,3600,0]);
 assert.equal(shared.assignments.get(side.id)?.get(1)?.feed,4);
});
