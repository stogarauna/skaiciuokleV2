import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {emptyDrawings,drawingSources,validDrawings} from '../src/lib/drawing-project.ts';
import {openProjectFile} from '../src/lib/drawing-files.ts';
import {validVwxScene} from '../src/lib/vwx-types.ts';

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
