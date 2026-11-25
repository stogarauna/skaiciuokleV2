import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen} from '../src/lib/project.ts';
import {cabinetPositions} from '../src/lib/mixed-panels.ts';
import {signalPlan, defaultSignalSettings, fitPortRoute} from '../src/lib/signal.ts';
import {signalOutputs,physicalPanelNumber} from '../src/lib/signal-output.ts';
import {defaultPowerSettings,powerPlan,powerPlanIssue} from '../src/lib/power.ts';
import {stageboxPlan} from '../src/lib/stagebox.ts';

const small={name:'P3/7 Transparent 0.5m x 0.5m',widthM:.5,heightM:.5,resX:128,resY:64,weightKg:4,power:150};
const large={...small,name:'P3/7 Transparent 1m x 0.5m',widthM:1,resX:256,weightKg:7,power:250};
const screen={...makeScreen(small),cols:6,rows:2,mixed:{large,anchors:['0,0','2,0','4,0','1,1','3,1']}};
const px=small.resX*small.resY;

test('signal ports charge the entire enclosing rectangle and route actual cabinets only',()=>{
 const settings={...defaultSignalSettings,portCapacity:4*px};
 const plan=signalPlan(screen,settings);
 assert.equal(plan.issue,null);
 assert.equal(plan.cells.length,7);assert.equal(plan.pixels,12*px);
 const covered=new Set<string>();
 for(const port of plan.ports){
  const left=Math.min(...port.cells.map(c=>c.c)),right=Math.max(...port.cells.map(c=>c.c+(c.span??1)));
  assert.equal(port.columns,right-left);assert.ok(port.pixels<=4*px);
  for(const {c,r} of port.cells) {assert.ok(!covered.has(c+','+r));covered.add(c+','+r);}
 }
 assert.equal(covered.size,7);
 assert.equal(plan.ports.reduce((sum,p)=>sum+p.activePixels,0),12*px);
 assert.equal(signalPlan(screen,{...settings,portCapacity:px}).issue,'cabinet');
 const manual=signalPlan(screen,{...settings,routeMode:'manual',manualRoutes:{'0,0,6,2':[[{c:0,r:1},{c:1,r:1},{c:2,r:1}]]}});
 assert.equal(manual.ports[0].cells.length,2);
 assert.equal(manual.ports[0].pixels,3*px);
 assert.equal(fitPortRoute([{c:1,r:1,span:2}],[{c:0,r:1}],2).length,0);
});

test('staggered rows split independently when no vertical cut crosses the whole wall',()=>{
 const result=signalOutputs(screen,{...defaultSignalSettings,output:{width:2*small.resX,height:4*small.resY}});
 assert.equal(result.issue,null);
 const numbers:number[]=[];
 for(const part of result.parts){
  assert.ok(part.width<=2*small.resX);
  for(const cell of part.plan.cells){
   assert.ok(cell.c+(cell.span??1)<=part.screen.cols);
   numbers.push(physicalPanelNumber(screen,part,cell));
  }
 }
 assert.deepEqual(numbers.sort((a,b)=>a-b),[1,2,3,4,5,6,7]);
 assert.ok(signalOutputs(screen,{...defaultSignalSettings,output:{width:small.resX,height:4*small.resY}}).issue);
});

test('mixed power sums catalogue wattage for each assigned cabinet and never overloads an outlet',()=>{
 const expected=cabinetPositions(screen);
 for(const opts of [defaultPowerSettings,{...defaultPowerSettings,edge:'right' as const},{...defaultPowerSettings,direction:'columns' as const,edge:'bottom' as const}]){
  const plan=powerPlan(screen,{...opts,limitW:480});
  assert.equal(powerPlanIssue(plan),null);assert.equal(plan.totalWatts,1550);
  const assigned=plan.ports.flatMap(p=>p.cells);
  assert.equal(new Set(assigned.map(c=>c.c+','+c.r)).size,expected.length);
  assert.equal(assigned.length,expected.length);
  for(const port of plan.ports){
   assert.ok(port.watts<=480);assert.equal(480-port.watts,port.remaining);
   assert.equal(port.watts,port.cells.reduce((sum,cell)=>sum+(cell.span===2?250:150),0));
  }
 }
 assert.ok(powerPlanIssue(powerPlan(screen,{...defaultPowerSettings,limitW:200})));
 const missing={...screen,mixed:{...screen.mixed,large:{...large,power:null}}};
 assert.equal(powerPlan(missing).totalWatts,null);
 assert.equal(stageboxPlan([missing]).feeds.length,0);
});
