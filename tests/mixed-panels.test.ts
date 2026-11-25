import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeScreen,parseProject,stats,type Panel,type Screen} from '../src/lib/project.ts';
import {autoPlaceMixed,cabinetCounts,cabinetPositions,compatiblePair,disableMixed,enableMixed,mergeCabinets,reconcileMixed,splitCabinet} from '../src/lib/mixed-panels.ts';
import {defaultSignalSettings} from '../src/lib/signal.ts';

const small:Panel={name:'P3/7 Transparent 0.5m x 0.5m',resX:128,resY:64,widthM:.5,heightM:.5,weightKg:4.6,power:100};
const large:Panel={name:'P3/7 Transparent 1m x 0.5m',resX:256,resY:64,widthM:1,heightM:.5,weightKg:6.5,power:210};
const pair={small,large};
const parse=(s:Screen)=>parseProject({version:1,name:'T',screens:[s]}).screens[0];
function cross(){
 const removed:string[]=[];
 for(let r=0;r<27;r++)for(let c=0;c<32;c++)
  if((r<12||r>=17)&&(c<13||c>=19))removed.push(c+','+r);
 return {...makeScreen(small),cols:32,rows:27,removed};
}

test('the UTMA cross retains wide stems and places half cabinets on both exposed wing tips',()=>{
 const screen=enableMixed(cross(),pair),s=stats(screen);
 assert.equal(s.n,151);assert.equal(s.cells.length,292);assert.equal(s.area,73);
 assert.equal(s.width,16);assert.equal(s.height,13.5);assert.equal(s.pxW,4096);assert.equal(s.pxH,1728);
 assert.equal(s.pixels,292*128*64);assert.equal(s.weight,962.5);assert.equal(s.power,30610);
 assert.deepEqual(cabinetCounts(screen),[{panel:small,count:10},{panel:large,count:141}]);
 const cabinets=cabinetPositions(screen);
 assert.deepEqual(cabinets.filter(c=>c.span===1).map(c=>[c.c,c.r]),
  [12,13,14,15,16].flatMap(r=>[[0,r],[31,r]]));
 assert.deepEqual(cabinets.map(c=>c.number),Array.from({length:151},(_,i)=>i+1));
 assert.deepEqual(parse(screen),screen);
});

test('only compatible catalog snapshots pair, including the legacy transparent names',()=>{
 assert.deepEqual(compatiblePair(large,[large,small]),pair);
 const legacy={...small,name:'Transparent(500x500)'};
 assert.deepEqual(compatiblePair(legacy,[large]),{small:legacy,large});
 assert.equal(compatiblePair(small,[{...large,name:'P4 OTHER 1m x 0.5m'}]),undefined);
 assert.equal(compatiblePair(small,[{...large,resX:257}]),undefined);
 assert.equal(compatiblePair(small,[{...large,heightM:1}]),undefined);
});

test('wide projects retain footprint, blanks, routes and output positions on switching to a mixed grid',()=>{
 const old:Screen={...makeScreen(large),cols:3,rows:2,removed:['2,1'],signal:{
  ...defaultSignalSettings,routeMode:'manual',manualRoutes:{'0,0,3,2':[[{c:2,r:0},{c:1,r:0}]]},
  output:{width:3840,height:2160,positions:{'0,0,3,2':{x:2,y:-1}}}}};
 const next=enableMixed(old,pair);
 assert.equal(next.cols,6);assert.deepEqual(next.removed,['4,1','5,1']);assert.equal(stats(next).n,5);
 for(const field of ['pixels','area','power','weight','width','height'] as const)assert.equal(stats(next)[field],stats(old)[field]);
 assert.deepEqual(next.signal?.manualRoutes,{'0,0,6,2':[[{c:4,r:0},{c:2,r:0}]]});
 assert.deepEqual(next.signal?.output?.positions,{'0,0,6,2':{x:4,y:-2}});
 assert.deepEqual(parse(next),next);
 const split=splitCabinet(next,5,0);
 assert.deepEqual(split.signal?.manualRoutes,{'0,0,6,2':[[{c:4,r:0},{c:5,r:0},{c:2,r:0}]]});
 assert.deepEqual(mergeCabinets(split,4,0).signal?.manualRoutes,next.signal?.manualRoutes);
 assert.equal(stats(disableMixed(next)).n,10);
});

test('explicit packing respects manual port assignments and empty or out-of-grid cells',()=>{
 const old:Screen={...makeScreen(small),cols:2,rows:1,signal:{...defaultSignalSettings,manualRoutes:{'0,0,2,1':[[{c:0,r:0}],[{c:1,r:0}]]}}};
 const next=enableMixed(old,pair);
 assert.equal(next.mixed?.anchors.length,0);assert.throws(()=>autoPlaceMixed(next),/portams/);
 const wide=enableMixed({...old,signal:undefined},pair);
 assert.deepEqual(reconcileMixed({...wide,removed:['1,0']}).mixed?.anchors,[]);
 assert.deepEqual(reconcileMixed({...wide,cols:1}).mixed?.anchors,[]);
 assert.throws(()=>parse({...wide,mixed:{large,anchors:['0,0','0,0']}}));
 assert.throws(()=>parse({...wide,mixed:{large,anchors:['1,0']}}));
 assert.throws(()=>parse({...wide,removed:['1,0']}));
 assert.throws(()=>parse({...wide,mixed:{large:{...large,power:-1},anchors:[]}}));
 assert.throws(()=>parse({...wide,mixed:{large:{...large,resY:32},anchors:[]}}));
});

test('unknown parameters affect totals only when that panel model is actually installed',()=>{
 const shape={...makeScreen(small),cols:2,rows:1};
 const m=enableMixed(shape,{small,large:{...large,power:null}});
 assert.equal(stats(m).power,null);
 assert.equal(stats(splitCabinet(m,1,0)).power,200);
});
