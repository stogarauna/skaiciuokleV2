import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDrawings,type DrawingProject} from '../src/lib/drawing-project.ts';
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
test('drawing assignments, incomplete edits, calibration and separate chains survive device JSON',()=>{
 const saved=parseProject(JSON.parse(JSON.stringify({...project,drawings})));
 assert.deepEqual(saved.drawings,drawings);
 assert.throws(()=>parseProject({...project,drawings:{...drawings,plan:'missing'}}));
 assert.throws(()=>parseProject({...project,drawings:{...drawings,chain:[{x:2,y:0}]}}));
});
test('projects predating drawings still save and reopen without any image store',async()=>{
 assert.deepEqual(await openProjectFile(await projectFile(project)),project);
});
test('a portable project rejects missing or mismatched image data before replacing the project',async()=>{
 const file=(drawingImages?:Record<string,string>)=>new Blob([JSON.stringify({...project,drawings,drawingImages})]);
 await assert.rejects(openProjectFile(file()),/Front.jpg/);
 await assert.rejects(openProjectFile(file({[front]:'data:image/jpeg;base64,YWJj'})),/Sugadintas.*Front.jpg/);
});
