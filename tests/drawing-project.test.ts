import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingLayoutReference,emptyDrawings,onRigAxis,removedFromRegion,visibleRigMarks,type DrawingProject} from '../src/lib/drawing-project.ts';
import {frontDrawingHeight} from '../src/lib/drawing-layout.ts';
import {openProjectFile,projectFile} from '../src/lib/drawing-files.ts';
import {parseProject,stats} from '../src/lib/project.ts';

const front='a'.repeat(64),plan='b'.repeat(64);
const a={x:.1,y:.3},b={x:.5,y:.3};
const drawings:DrawingProject={
 ...emptyDrawings(),files:[{hash:front,name:'Front.jpg'},{hash:plan,name:'Top.png'}],front,plan,
 rows:[{id:'a',name:'DJ',target:'',model:'P4',cols:8,rows:4,include:true,widthText:'4,',customName:'DJ stalas'}],
 active:'a',pins:{[front]:{a}},marks:[{...b,owner:'a'}],reference:[a,b],known:null,scale:.0125,
 completed:[[a,b]],chain:[b],mode:'measure',showFront:false,infoOpen:false,selectedFields:['power','utp'],exportFormat:'jpg'
};
const project={version:1 as const,name:'Scena',screens:[]};
const panel={name:'P4',widthM:.5,heightM:.5,resX:104,resY:104,weightKg:6.5,power:150};
const cross={
 x:.5,y:.5,bounds:{left:.3,top:.2,right:.7,bottom:.8},bands:[
  {left:13/32,top:0,right:19/32,bottom:12/27},
  {left:0,top:12/27,right:1,bottom:17/27},
  {left:13/32,top:17/27,right:19/32,bottom:1}
 ]
};
test('front shapes become active modules, retained along with the measured outlines on reopening',()=>{
 const row={...drawings.rows[0],region:cross,regionSource:front};
 const removed=removedFromRegion(row.region,32,27);
 const screen={id:row.id,name:'Main',panel,cols:32,rows:27,removed,x:0,y:0};
 const state={...project,screens:[screen],drawings:{...drawings,rows:[row]}};
 const reopened=parseProject(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(reopened.drawings?.rows[0].region,cross);
 assert.deepEqual(reopened.screens[0].removed,removed);
 const {n,width,height,area}=stats(reopened.screens[0]);
 assert.deepEqual({n,width,height,area},{n:292,width:16,height:13.5,area:73});
 assert.equal(removed.includes('0,11'),true);
 assert.equal(removed.includes('0,12'),false);
 assert.equal(removed.includes('0,16'),false);
 assert.equal(removed.includes('0,17'),true);
 assert.deepEqual(removedFromRegion({...cross,bands:undefined},4,5),[]);
 assert.deepEqual(removedFromRegion(undefined,4,5),[]);
 const badRow=(patch:Record<string,unknown>)=>({...state,drawings:{...drawings,rows:[{...row,...patch}]}});
 assert.throws(()=>parseProject(badRow({regionSource:'no such source'})),/brėžinių/);
 assert.throws(()=>parseProject(badRow({region:{...cross,bands:[{left:.7,right:.3,top:0,bottom:1}]}})),/brėžinių/);
});
test('mixed cabinet selection remains an explicit option on a recognized drawing row',()=>{
 const row={...drawings.rows[0],model:'Transparent(500x500)',mixedWidths:true,region:cross,regionSource:front};
 const state={...project,drawings:{...drawings,rows:[row]}};
 const reopened=parseProject(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(reopened.drawings?.rows[0],row);
 assert.throws(()=>parseProject({...state,drawings:{...drawings,rows:[{...row,mixedWidths:'true'}]}}),/brėžinių/);
});
test('only matching front outlines and original pins supply physical spacing',()=>{
 const screens=[0,1].map(i=>({id:String(i),name:'LED',panel,cols:4,rows:5,removed:[],x:0,y:0}));
 const aspect=2,heightInMetres=20;
 const rows=screens.map((s,i)=>{
  const x=.2+.6*i,y=.5;
  const w=2/heightInMetres/aspect,h=2.5/heightInMetres;
  return {...drawings.rows[0],id:s.id,target:s.id,regionSource:front,region:{x,y,bounds:{left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2}}};
 });
 const pins=new Map(rows.map(r=>[r.target,{x:r.region.x,y:r.region.y}]));
 const state={...drawings,rows,pins:{[front]:Object.fromEntries(pins)}};
 assert.ok(Math.abs(frontDrawingHeight(state,screens,pins,aspect)!-heightInMetres)<1e-8);
 assert.equal(frontDrawingHeight(state,[screens[0],{...screens[1],cols:6}],pins,aspect),undefined);
 assert.equal(frontDrawingHeight({...state,front:plan},screens,pins,aspect),undefined);
 state.pins[front]['1']={x:.9,y:.4};
 assert.equal(frontDrawingHeight(state,screens,pins,aspect),undefined);
});
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
