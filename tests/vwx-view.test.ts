import assert from 'node:assert/strict';
import {test} from 'node:test';
import {defaultVwxView,nativeVwxVisibility,validVwxViewSettings,visibleVwxScene,vwxClasses} from '../src/lib/vwx-view.ts';
import type {VwxScene} from '../src/lib/vwx-types.ts';

const sample:VwxScene={
 fileName:'Two stages.vwx',layers:[{id:'l1',name:'Stage'},{id:'l2',name:'Venue'},{id:'unused',name:'Empty layer'}],
 classes:[{id:'motors',name:'Automation'},{id:'video',name:'Video'},{id:'unusedClass',name:'Empty class'}],
 panels:[{id:'screen',wallId:'wall',layerId:'l1',classId:'video',model:'Wall',front:[],back:[]}],
 objects:[
  {id:'h1',layerId:'l1',classId:'motors',kind:'hoist',name:'M1',position:[0,0,0]},
  {id:'h2',layerId:'l2',classId:'motors',kind:'hoist',name:'M2',position:[5,2,1]},
  {id:'unassigned',layerId:'l1',kind:'truss',name:'Beam',position:[2,0,4]}
 ]
};
const ids=(scene:VwxScene)=>[...scene.panels,...scene.objects].map(o=>o.id);
test('class, layer, object type and item filters apply in combination to drawing and export',()=>{
 const state=defaultVwxView();
 assert.deepEqual(ids(visibleVwxScene(sample,{...state,hiddenLayers:['l2'],hiddenClasses:['video'],hiddenKinds:['truss']})),['h1']);
 assert.deepEqual(ids(visibleVwxScene(sample,{...state,hiddenLayers:['l2'],hiddenClasses:['video'],hiddenKinds:['truss'],hiddenObjects:['h1']})),[]);
 assert.deepEqual(ids(visibleVwxScene(sample,{...state,hiddenClasses:['motors']})),['screen','unassigned']);
});
test('full class and layer lists include empty native entries and unassigned objects',()=>{
 const all=vwxClasses(sample);
 assert.ok(all.some(o=>o.id==='unusedClass'));assert.ok(all.some(o=>o.name==='Nepriskirta klasei'));
 assert.deepEqual(ids(visibleVwxScene(sample,{...defaultVwxView(),hiddenClasses:all.map(o=>o.id)})),[]);
 assert.deepEqual(ids(visibleVwxScene(sample,{...defaultVwxView(),hiddenLayers:sample.layers.map(o=>o.id)})),[]);
});
test('saved VWX view predating classes and models without classes continue to work',()=>{
 const before={hiddenLayers:[],hiddenKinds:[],hiddenObjects:[],measurements:[]};
 assert.ok(validVwxViewSettings(before));assert.ok(!validVwxViewSettings({...before,hiddenClasses:[null]}));
 const legacy={...sample,classes:undefined};assert.deepEqual(vwxClasses(legacy),[]);assert.equal(ids(visibleVwxScene(legacy,before)).length,4);
});

test('native preset restores hidden layers and classes, visible grey or unspecified entries, and measurements',()=>{
 const measured=[{from:'h1',to:'h2'}];
 const native:VwxScene={...sample,
  layers:sample.layers.map(l=>({...l,nativeVisibility:l.id==='l2'?'hidden':'grey'})),
  classes:sample.classes!.map(c=>({...c,nativeVisibility:c.id==='video'?'hidden':'visible'}))};
 const reset=nativeVwxVisibility(native,{...defaultVwxView(),hiddenObjects:['h1'],hiddenLayers:['l1'],hiddenClasses:['motors'],measurements:measured});
 assert.deepEqual(reset,{hiddenLayers:['l2'],hiddenClasses:['video'],hiddenObjects:[],hiddenKinds:[],measurements:measured});
 assert.deepEqual(ids(visibleVwxScene(native,reset)),['h1','unassigned']);
});
test('wall and source tile classes both control visibility for native LED Screen grid cabinets',()=>{
 const scene={...sample,panels:sample.panels.map(p=>({...p,sourceClassId:'tile'}))};
 for(const hide of ['video','tile'])assert.ok(!ids(visibleVwxScene(scene,{...defaultVwxView(),hiddenClasses:[hide]})).includes('screen'));
 assert.ok(ids(visibleVwxScene(scene,defaultVwxView())).includes('screen'));
});
