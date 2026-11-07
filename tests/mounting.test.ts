import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen,parseProject} from '../src/lib/project.ts';
import {defaultMounting,emptyWeights,mountingSummary,frameWeight,catalogWeights} from '../src/lib/mounting.ts';
test('mounting quantities, missing weights, mode and JSON validation',()=>{
 const s=makeScreen({name:'Test',resX:100,resY:100,widthM:.5,heightM:.5,power:100,weightKg:10});
 s.mounting={...defaultMounting(),mode:'hanging',length:5,shackles:4,sling2:2,frames:8,frameKg:3};
 const w={...emptyWeights(),truss30:6,shackle:.5,sling2:1};
 assert.equal(mountingSummary(s,w).total,458);assert.equal(mountingSummary(s,w).incomplete,false);
 assert.equal(mountingSummary(s,emptyWeights()).incomplete,true);
 const p={version:1 as const,name:'Test',screens:[s],equipmentWeights:w};
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))),p);
 s.mounting.mode='standing';assert.equal(mountingSummary(s,w).total,400);
 s.mounting.frames=-1;assert.throws(()=>parseProject(p));
});

test('legacy P2 Yestech 9x5 hanging weight matches observed result',()=>{
 const s=makeScreen({name:'P2 YESTECH',resX:192,resY:192,widthM:.5,heightM:.5,power:145,weightKg:6.7});s.cols=9;s.rows=5;
 s.mounting={...defaultMounting(),mode:'hanging',length:6,shackles:9,sling1:9,frames:9,frameKg:2.2};
 assert.ok(Math.abs(mountingSummary(s).total-356.4)<1e-8);
});

test('frame catalog, F45 and missing 3m slings remain distinct',()=>{
 assert.equal(frameWeight('P2 YESTECH',.5),2.2);
 assert.equal(frameWeight('P2 YESTECH',1),4.2);
 assert.equal(frameWeight('Custom',.5),null);
 const s=makeScreen({name:'Test',resX:100,resY:100,widthM:.5,heightM:.5,power:100,weightKg:10});
 s.mounting={...defaultMounting(),mode:'hanging',truss:'trussF45',length:6};
 assert.ok(Math.abs(mountingSummary(s).total-(400+6*14.22))<1e-8);
 assert.equal(mountingSummary(s).incomplete,false);
 s.mounting.sling3=2;
 assert.equal(mountingSummary(s).incomplete,true);
 assert.equal(mountingSummary(s,{...catalogWeights(),sling3:2.5}).incomplete,false);
 const project={version:1,name:'X',screens:[s],equipmentWeights:catalogWeights()};
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))),project);
 for(const invalid of [-1,NaN,Infinity,'3'])assert.throws(()=>parseProject({...project,equipmentWeights:{...catalogWeights(),trussF45:invalid}}));
});
