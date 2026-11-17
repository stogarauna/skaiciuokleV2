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

test('linked boxes share the phase budget and circuit assignments remain unique across screens', () => {
 const routing = {...defaultPowerSettings,limitW:1500};
 const main = {...makeScreen(panel),cols:10,rows:4,powerRouting:routing};
 const side = {...makeScreen(panel),cols:10,rows:3,powerRouting:routing};
 const distribution = stageboxPlan([main,side]);
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
