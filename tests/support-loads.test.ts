import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen,parseProject,type Screen} from '../src/lib/project.ts';
import {defaultMounting,catalogWeights,type Mounting} from '../src/lib/mounting.ts';
import {supportLoads,supportShares} from '../src/lib/support-loads.ts';
const screen=():Screen & {mounting:Mounting}=>({...makeScreen({name:'Test',resX:192,resY:192,widthM:.5,heightM:.5,power:100,weightKg:0}),mounting:{...defaultMounting(),mode:'hanging',frame1Kg:0,frameHalfKg:0}});
const weights={...catalogWeights(),truss30:250,shackle:0,sling1:0};
test('DashMaster 1000kg reference cases and conservation for 2 to 8 points',()=>{
 const s=screen();
 for(let n=2;n<=8;n++){
 s.mounting.supportCount=n;
 const result=supportLoads(s,weights);
 assert.equal(result.total,1000);assert.equal(result.ready,true);assert.equal(result.points.length,n);
 assert.ok(Math.abs(result.points.reduce((sum,p)=>sum+p.kg!,0)-1000)<1e-9);
 assert.equal(result.points[0].x,0);assert.equal(result.points[n-1].x,4);
 for(let i=0;i<n;i++)assert.equal(result.points[i].share,supportShares[n][n-i-1]);
 }
 s.mounting.supportCount=2;assert.deepEqual(supportLoads(s,weights).points.map(p=>p.kg),[500,500]);
 s.mounting.supportCount=3;assert.deepEqual(supportLoads(s,weights).points.map(p=>p.kg),[187.5,625,187.5]);
 s.mounting.supportCount=4;assert.deepEqual(supportLoads(s,weights).points.map(p=>p.kg),[133,367,367,133]);
});
test('point count changes share but not assembly weight; dimensions and catalog change loads',()=>{
 const s=screen();s.mounting.supportCount=3;
 const before=supportLoads(s,weights);
 s.cols=6;const after=supportLoads(s,weights);
 assert.equal(after.total,750);assert.equal(after.spacing,1.5);assert.equal(after.peak,468.75);
 assert.equal(before.total,1000);
 const changed=supportLoads(s,{...weights,truss30:100});assert.equal(changed.total,300);
});
test('unknown and unsupported loads never become apparently complete kilograms',()=>{
 const s=screen();
 for(const patch of [{panel:{...s.panel,weightKg:null}},{curvature:{angleDeg:5}},{removed:['0,0']}]){
 const result=supportLoads({...s,...patch},weights);assert.equal(result.ready,false);assert.equal(result.total,null);assert.equal(result.peak,null);assert.ok(result.issues.length);assert.ok(result.points.every(p=>p.kg===null));
 }
 s.mounting.slingLength=3;assert.equal(supportLoads(s,weights).ready,false);
 s.mounting.mode='standing';assert.equal(supportLoads(s,weights).ready,false);
});
test('support count is optional for old projects, persists and rejects unsupported imports',()=>{
 const s=screen(),p={version:1,name:'Test',screens:[s]};
 assert.equal(supportLoads(s,weights).count,2);
 s.mounting.supportCount=7;assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))),p);
 for(const n of [0,1,9,2.5,null,'3',NaN])assert.throws(()=>parseProject({...p,screens:[{...s,mounting:{...s.mounting,supportCount:n}}]}));
});
