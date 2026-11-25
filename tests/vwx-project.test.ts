import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {emptyDrawings,drawingSources,validDrawings} from '../src/lib/drawing-project.ts';
import {openProjectFile,upgradesLegacyVwx} from '../src/lib/drawing-files.ts';
import {validVwxScene,type VwxScene,type VwxVec3} from '../src/lib/vwx-types.ts';

const scene={fileName:'Modelis.vwx',layers:[{id:'roof',name:'Stogas'}],panels:[],objects:[
 {id:'hoist-1',layerId:'roof',kind:'hoist',name:'M1',position:[0,0,5000]}
]};
const raw=JSON.stringify(scene);
const hash=createHash('sha256').update(raw).digest('hex');
const model={hash,name:scene.fileName};
const project={version:1,name:'3D',screens:[],drawings:{...emptyDrawings(),vwxModels:[model],activeVwx:hash}};
const body=(value:unknown)=>new Blob([JSON.stringify(value)]);

test('VWX drawings are referenced independently of raster scale and included in cache retention',()=>{
 assert.equal(validVwxScene(scene),true);
 assert.equal(validDrawings(project.drawings),true);
 assert.deepEqual(drawingSources(project.drawings),[model]);
 assert.equal(validDrawings({...project.drawings,activeVwx:'missing'}),false);
 assert.equal(validDrawings({...project.drawings,vwxModels:[model,model]}),false);
 assert.equal(validVwxScene({...scene,objects:[{...scene.objects[0],layerId:'absent'}]}),false);
 assert.equal(validVwxScene({...scene,objects:[scene.objects[0],scene.objects[0]]}),false);
});

test('opening rejects an absent/modified embedded model before writing device data',async()=>{
 await assert.rejects(openProjectFile(body(project)),/trūksta VWX/);
 await assert.rejects(openProjectFile(body({...project,drawingModels:{[hash]:raw+' '}})),/Sugadintas VWX/);
 assert.deepEqual((await openProjectFile(body({version:1,name:'Senas projektas',screens:[]}))).screens,[]);
});

test('reimport preserves every previous native placement before replacing legacy geometry',()=>{
 const front:VwxVec3[]=[[0,0,0],[500,0,0],[500,0,500],[0,0,500]];
 const previous:VwxScene={fileName:'Arena.vwx',layers:[{id:'roof',name:'Stogas'},{id:'stage',name:'Scena'}],
  objects:[{id:'11111111111141118211111111111111',layerId:'roof',kind:'hoist',name:'M1',position:[1,2,3]},
   {id:'vwx-42',layerId:'stage',kind:'context',name:'Sija',position:[0,0,0],vertices:[[0,0,0],[0,50,0]]}],
  panels:[{id:'22222222222242228222222222222222',wallId:'siena',layerId:'stage',model:'P4',
   front,back:front.map(([x,y,z])=>[x,y+75,z])}]};
 const current:VwxScene={...structuredClone(previous),classes:[{id:'lights',name:'Šviesos'}]};
 current.layers.push({id:'new',name:'Šviesa'});
 current.objects.push({id:'third',layerId:'new',kind:'context',name:'C',position:[0,0,0],classId:'lights'});
 assert.equal(upgradesLegacyVwx(previous,current),true);
 assert.equal(upgradesLegacyVwx(current,current),false);
 assert.equal(upgradesLegacyVwx(previous,{...current,fileName:'Scena.vwx'}),false);
 for(const change of [
  (s:VwxScene)=>{s.layers[0].name='Kitas stogas';},
  (s:VwxScene)=>{s.objects.splice(1,1);},
  (s:VwxScene)=>{s.objects[1].vertices![1][1]+=1;},
  (s:VwxScene)=>{s.objects[0].position[0]+=1;},
  (s:VwxScene)=>{s.objects[0].layerId='stage';},
  (s:VwxScene)=>{s.panels[0].wallId='kita siena';},
  (s:VwxScene)=>{s.panels[0].front[0][0]+=1;},
  (s:VwxScene)=>{s.panels[0].back[0][0]+=1;}
 ]){
  const revised=structuredClone(current);change(revised);
  assert.equal(upgradesLegacyVwx(previous,revised),false);
 }
 for(const id of ['vwx-42','00000000000000000000000000000000']){
  const boundsOnly:VwxScene={...previous,panels:[],objects:[{...previous.objects[1],id}]};
  assert.equal(upgradesLegacyVwx(boundsOnly,{...boundsOnly,classes:[]}),false);
 }
});

test('placed objects may inherit a class and source class only from the file class directory',()=>{
 const classes=[{id:'panel',name:'Panelės'},{id:'wall',name:'Ekranai'}];
 const item={...scene.objects[0],classId:'panel',sourceClassId:'wall'};
 assert.equal(validVwxScene({...scene,classes,objects:[item]}),true);
 assert.equal(validVwxScene({...scene,classes:[classes[0]],objects:[item]}),false);
 assert.equal(validVwxScene({...scene,classes:[classes[1]],objects:[item]}),false);
 assert.equal(validVwxScene({...scene,classes:[...classes,classes[0]],objects:[item]}),false);
});
