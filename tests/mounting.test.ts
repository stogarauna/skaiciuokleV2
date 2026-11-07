import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen,parseProject,type Screen} from '../src/lib/project.ts';
import {defaultMounting,emptyWeights,mountingSummary,frameWeight,catalogWeights,hangingPlan,type Mounting} from '../src/lib/mounting.ts';
const make=(cols:number):Screen & {mounting:Mounting}=>({...makeScreen({name:'P2 YESTECH',resX:192,resY:192,widthM:.5,heightM:.5,power:145,weightKg:6.7}),cols,mounting:{...defaultMounting(),mode:'hanging' as const}});
test('3m and 3.5m screens follow confirmed hanging rules',()=>{
 const a=make(6),b=make(7);
 assert.deepEqual(hangingPlan(a),{width:3,fullFrames:3,halfFrames:0,attachments:6,supported:true});
 assert.deepEqual(hangingPlan(b),{width:3.5,fullFrames:3,halfFrames:1,attachments:7,supported:true});
 const summary=mountingSummary(b);
 assert.equal(summary.incomplete,false);
 // 35 panels, 3.5m truss, 7 shackles, 7 one-metre slings, 3 full frames and a half frame.
 assert.ok(Math.abs(summary.total-(35*6.7+3.5*3.3+7*.6+7*1.1+3*4.2+2.2))<1e-8);
});
test('width, sling selection and frame weights update derived totals; legacy quantities do not override rules',()=>{
 const s=make(7);
 s.mounting={...s.mounting,length:90,frames:90,shackles:90,slingLength:2};
 let summary=mountingSummary(s);
 assert.equal(summary.lines.find(l=>l.name==='Stropai 2 m')?.quantity,7);
 assert.equal(summary.lines.find(l=>l.name==='Prolyte HV30')?.quantity,3.5);
 s.cols=8;
 assert.equal(hangingPlan(s).attachments,8);
 s.mounting.slingLength=3;
 assert.equal(mountingSummary(s).incomplete,true);
 assert.equal(mountingSummary(s,{...catalogWeights(),sling3:2.5}).incomplete,false);
 s.mounting.frame1Kg=null;
 assert.equal(mountingSummary(s,{...catalogWeights(),sling3:2.5}).incomplete,true);
 s.mounting.mode='standing';
 assert.equal(mountingSummary(s).total,40*6.7);
});
test('mounting and equipment validation, snapshots and old JSON compatibility',()=>{
 const s=make(6),p={version:1,name:'Test',screens:[s],equipmentWeights:catalogWeights()};
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))),p);
 for(const mounting of [{...s.mounting,slingLength:4},{...s.mounting,frame1Kg:-1},{...s.mounting,frameHalfKg:'2'},{...s.mounting,frames:-1}])assert.throws(()=>parseProject({...p,screens:[{...s,mounting}]}));
 for(const invalid of [-1,NaN,Infinity,'3'])assert.throws(()=>parseProject({...p,equipmentWeights:{...catalogWeights(),trussF45:invalid}}));
 assert.equal(mountingSummary(s,emptyWeights()).incomplete,true);
 assert.equal(frameWeight('P2 YESTECH',.5),2.2);
 assert.equal(frameWeight('P2 YESTECH',1),4.2);
 assert.equal(frameWeight('Custom',1),null);
});
test('irregular and curved screens use unfolded active width; unsupported frame lengths stay incomplete',()=>{
 const s=make(7);s.curvature={angleDeg:5};
 assert.equal(hangingPlan(s).width,3.5);
 s.removed=Array.from({length:s.rows},(_,r)=>`0,${r}`);
 assert.equal(hangingPlan(s).width,3);
 s.panel.widthM=.6;
 assert.equal(hangingPlan(s).supported,false);
 assert.equal(mountingSummary(s).incomplete,true);
 assert.ok(mountingSummary(s).issues.length);
});
