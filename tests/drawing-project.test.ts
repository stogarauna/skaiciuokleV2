import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingLayoutReference,emptyDrawings,onRigAxis,visibleRigMarks,type DrawingProject} from '../src/lib/drawing-project.ts';
import {openProjectFile,projectFile} from '../src/lib/drawing-files.ts';
import {parseProject} from '../src/lib/project.ts';

const front='a'.repeat(64),plan='b'.repeat(64);
const a={x:.1,y:.3},b={x:.5,y:.3};
const drawings:DrawingProject={
 ...emptyDrawings(),files:[{hash:front,name:'Front.jpg'},{hash:plan,name:'Top.png'}],front,plan,
 rows:[{id:'a',name:'DJ',target:'',model:'P4',cols:8,rows:4,include:true,widthText:'4,',customName:'DJ stalas'}],
 active:'a',pins:{[front]:{a}},marks:[{...b,owner:'a'}],reference:[a,b],known:null,scale:.0125,
 completed:[[a,b]],chain:[b],mode:'measure',showFront:false,infoOpen:false,selectedFields:['power','utp'],exportFormat:'jpg'
};
const project={version:1 as const,name:'Scena',screens:[]};
test('front markers take priority; a top plan uses only each linked screen’s rigging extents',()=>{
 const screens=[{id:'main'},{id:'DJ'}];
 const rows=[
  {...drawings.rows[0],id:'a',target:'main'},
  {...drawings.rows[0],id:'b',target:'DJ'},
  {...drawings.rows[0],id:'c',target:'main',include:false},
  {...drawings.rows[0],id:'d',target:'removed'}
 ];
 const marks=[
  {owner:'a',x:.125,y:.25},{owner:'a',x:.625,y:.25},{owner:'a',x:.125,y:.25},
  {owner:'b',x:.75,y:.5},{owner:'',x:1,y:1},{owner:'c',x:0,y:0},{owner:'d',x:1,y:0}
 ];
 const both={...drawings,rows,marks,pins:{[front]:{a,b}}};
 const first=drawingLayoutReference(both,screens);
 assert.equal(first?.view,'front');
 assert.deepEqual(first?.pins,new Map([['main',a],['DJ',b]]));
 const top=drawingLayoutReference({...both,pins:{[front]:{a}}},screens);
 assert.equal(top?.view,'plan');
 assert.deepEqual(top?.pins,new Map([['main',{x:.375,y:.25}],['DJ',{x:.75,y:.5}]]));
 assert.equal(drawingLayoutReference({...both,pins:{},marks:marks.filter(m=>m.owner!=='b')},screens),undefined);
 assert.throws(()=>drawingLayoutReference({...both,rows:[rows[0],{...rows[1],target:'main'}]},screens),/tam pačiam/);
});
test('drawing assignments, incomplete edits, calibration and separate chains survive device JSON',()=>{
 const saved=parseProject(JSON.parse(JSON.stringify({...project,drawings})));
 assert.deepEqual(saved.drawings,drawings);
 assert.throws(()=>parseProject({...project,drawings:{...drawings,plan:'missing'}}));
 assert.throws(()=>parseProject({...project,drawings:{...drawings,chain:[{x:2,y:0}]}}));
});
test('projects predating drawings still save and reopen without any image store',async()=>{
 assert.deepEqual(await openProjectFile(await projectFile(project)),project);
});
test('roof references, point colours and individual exclusions survive a project round trip',()=>{
 const state:DrawingProject={...drawings,mode:'datum',rigColors:{blue:true,red:false},
  marks:[{...a,owner:'a',symbol:'blue'},{...b,owner:'a',symbol:'red'},{x:.75,y:.8,owner:''}],
  rigAxes:[{id:'roof',orientation:'vertical',position:.5,lane:.7,excluded:[a]}]};
 const restored=parseProject(JSON.parse(JSON.stringify({...project,drawings:state}))).drawings!;
 assert.deepEqual(restored,state);
 const visible=visibleRigMarks(restored.marks,restored.rigColors);
 assert.deepEqual(visible,[state.marks[0],state.marks[2]]);
 assert.deepEqual(visible.filter(m=>onRigAxis(restored.rigAxes![0],m)),[state.marks[2]]);
 for(const patch of [{position:1.1},{orientation:'diagonal'},{lane:NaN},{excluded:[{x:-1,y:0}]}]){
  assert.throws(()=>parseProject({...project,drawings:{...state,rigAxes:[{...state.rigAxes![0],...patch}]}}));
 }
});
test('a portable project rejects missing or mismatched image data before replacing the project',async()=>{
 const file=(drawingImages?:Record<string,string>)=>new Blob([JSON.stringify({...project,drawings,drawingImages})]);
 await assert.rejects(openProjectFile(file()),/Front.jpg/);
 await assert.rejects(openProjectFile(file({[front]:'data:image/jpeg;base64,YWJj'})),/Sugadintas.*Front.jpg/);
});
