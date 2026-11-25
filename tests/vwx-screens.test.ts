import assert from 'node:assert/strict';
import test from 'node:test';
import {alreadyImported,createVwxScreen,detectVwxScreens,suggestedVwxModel} from '../src/lib/vwx-screens.ts';
import {parseProject,stats,type Panel} from '../src/lib/project.ts';
import type {VwxPanel,VwxScene,VwxVec3} from '../src/lib/vwx-types.ts';

const catalog:Panel[]=[500,1000].map(width=>({name:`P3/7 Transparent ${width/1000}m x 0.5m`,
 widthM:width/1000,heightM:.5,resX:width===500?128:256,resY:64,weightKg:8,power:width===500?100:210}));
function panel(wallId:string,x:number,y:number,z:number,dx:number,dy=0,layerId='stage'):VwxPanel{
 const front:VwxVec3[]=[[x,y,z],[x+dx,y+dy,z],[x+dx,y+dy,z+500],[x,y,z+500]];
 return {id:[wallId,x,y,z].join('/'),layerId,wallId,model:'Unilumin XV Cabinet '+Math.round(Math.hypot(dx,dy))+'x500',
  front,back:front.map(([x,y,z])=>[x,y+80,z])};
}
const scene=(panels:VwxPanel[]):VwxScene=>({fileName:'fixture.vwx',layers:[{id:'stage',name:'Stage'}],panels,objects:[]});

test('unfolds an offset U and preserves exact physical cabinet inventory and file identity',()=>{
 const panels:VwxPanel[]=[];
 for(let r=0;r<5;r++){
  const z=r*500;
  panels.push(panel('front',0,0,z,1000),panel('front',1000,0,z,1000));
  for(const [x,side] of [[6,'left'],[1994,'right']] as const){
   panels.push(panel(side+'-wide',x,-2,z-25,0,1000),panel(side+'-small',x+4,998,z,0,500));
  }
 }
 const [g,...others]=detectVwxScreens(scene(panels));
 assert.equal(others.length,0);assert.equal(g.issue,'');assert.deepEqual([g.folded,g.cols,g.rows,g.count],[true,10,5,30]);
 const map=Object.fromEntries(g.models.map(m=>[m.key,suggestedVwxModel(m,catalog)]));
 const screen=createVwxScreen(g,'DJ',map,catalog),s=stats(screen);
 assert.deepEqual([s.n,screen.mixed?.anchors.length,s.area,s.pixels,s.power],[30,20,12.5,409600,5200]);
 assert.equal(alreadyImported(g,parseProject({version:1,name:'Fixture',screens:[screen]}).screens),true);
});

test('one irregular screen with empty rows at the arm edges and narrow tips',()=>{
 const panels:VwxPanel[]=[];
 for(let r=0;r<27;r++)for(let c=0;c<3;c++)panels.push(panel('stem',c*1000,0,r*500,1000));
 for(let r=0;r<5;r++)for(const sign of [-1,1]){
  const start=sign===1?3000:-6000,z=5000+r*500;
  for(let c=0;c<6;c++)panels.push(panel('wing'+sign,start+c*1000,1,z,1000));
  panels.push(panel('tip'+sign,sign===1?9000:-6500,1,z,500));
 }
 const [g,...others]=detectVwxScreens(scene(panels));assert.equal(others.length,0);
 const s=createVwxScreen(g,'Kryžius',Object.fromEntries(g.models.map(m=>[m.key,suggestedVwxModel(m,catalog)])),catalog);
 assert.deepEqual([s.cols,s.rows,stats(s).n,s.mixed?.anchors.length,stats(s).area],[32,27,151,141,73]);
 assert.ok(!g.folded&&s.removed.length>0);
});

test('corner contact, detached surfaces and distinct native layers do not merge',()=>{
 const panels=[panel('a',0,0,0,500),panel('b',500,0,500,500),panel('c',2000,0,0,500),
  panel('d',0,0,0,500,0,'balcony')];
 assert.equal(detectVwxScreens(scene(panels)).length,4);
});

test('an unknown or ambiguous catalogue mapping stays unselected; loops and intersecting cabinets stay in 3D',()=>{
 const p=panel('x',0,0,0,500);
 const [g]=detectVwxScreens(scene([{...p,model:'Unknown'}]));
 assert.equal(suggestedVwxModel(g.models[0],catalog),'');
 assert.throws(()=>createVwxScreen(g,'Test',{},catalog),/katalogo/);
 assert.equal(suggestedVwxModel({...g.models[0],name:p.model},[...catalog,{...catalog[0],name:'Transparent(500x500)'}]),'');
 const [overlap]=detectVwxScreens(scene([p,{...p,id:'another'}]));assert.match(overlap.issue,/tą pačią/);
 const loop=scene([panel('a',0,0,0,500),panel('b',500,0,0,0,500),panel('c',500,500,0,-500),panel('d',0,500,0,0,-500)]);
 assert.match(detectVwxScreens(loop)[0].issue,/pjūvį/);
});

test('Spotlight screen owners preserve adjacent screens and leave unbranded cabinet choice to the operator',()=>{
 const panels=[panel('scr1',0,0,0,500),panel('scr1',500,0,0,500),panel('scr2',1000,0,0,500)]
  .map(p=>({...p,model:'VWX LED 500 × 500 mm',provenance:'screen-grid' as const}));
 const groups=detectVwxScreens(scene(panels));
 assert.deepEqual(groups.map(g=>g.count),[2,1]);
 assert.deepEqual(groups.map(g=>g.wallIds),[['scr1'],['scr2']]);
 const choices=[catalog[0],{...catalog[0],name:'P2 XR',resX:192,resY:192,power:150}];
 const model=groups[0].models[0];
 assert.equal(suggestedVwxModel(model,[{...catalog[0],name:model.name}]),'');
 assert.throws(()=>createVwxScreen(groups[0],'A',{},choices));
 assert.equal(createVwxScreen(groups[0],'A',{[model.key]:'P2 XR'},choices).panel.resX,192);
 assert.equal(createVwxScreen(groups[1],'B',{[model.key]:choices[0].name},choices).panel.resX,128);
});
