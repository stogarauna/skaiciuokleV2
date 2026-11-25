import type {VwxScene,VwxVec3} from './vwx-types';
import {findVwxEndpoint,vwxAnchorId} from './vwx-endpoints.ts';

export type VwxKind = 'panel'|'hoist'|'truss'|'context';
export type VwxViewSettings = {
 hiddenLayers:string[];
 hiddenClasses?:string[];
 hiddenKinds:VwxKind[];
 hiddenObjects:string[];
 measurements:{from:string;to:string}[];
};
export const defaultVwxView = ():VwxViewSettings => ({
 hiddenLayers:[],hiddenClasses:[],hiddenKinds:['context'],hiddenObjects:[],measurements:[]
});
export type VwxViewMode = 'orbit'|'front'|'top';
export type VwxCamera = {yaw:number;pitch:number;zoom:number;x:number;y:number};
export function presetCamera(mode:VwxViewMode):VwxCamera {
 return {yaw:mode==='orbit'?-.48:0,pitch:mode==='top'?Math.PI/2:mode==='orbit'?.25:0,zoom:1,x:0,y:0};
}
const noClassId='@no-vwx-class';
export function vwxClasses(scene:VwxScene){
 const classes=scene.classes??[];
 if(classes.length&&[...scene.panels,...scene.objects].some(o=>!o.classId)){
  return [...classes,{id:noClassId,name:'Nepriskirta klasei'}];
 }
 return classes;
}
export function nativeVwxVisibility(scene:VwxScene, current:VwxViewSettings):VwxViewSettings {
 return {...current,
  hiddenLayers:scene.layers.filter(layer=>layer.nativeVisibility==='hidden').map(layer=>layer.id),
  hiddenClasses:(scene.classes??[]).filter(cls=>cls.nativeVisibility==='hidden').map(cls=>cls.id),
  hiddenKinds:[],hiddenObjects:[]
 };
}
export function visibleVwxScene(scene:VwxScene, settings:VwxViewSettings):VwxScene {
 const layers=new Set(settings.hiddenLayers),classes=new Set(settings.hiddenClasses),kinds=new Set(settings.hiddenKinds),items=new Set(settings.hiddenObjects);
 const shown=(o:{id:string;layerId:string;classId?:string;sourceClassId?:string},kind:VwxKind)=>
  !layers.has(o.layerId)&&!classes.has(o.classId??noClassId)&&(!o.sourceClassId||!classes.has(o.sourceClassId))&&!kinds.has(kind)&&!items.has(o.id);
 return {...scene,panels:scene.panels.filter(p=>shown(p,'panel')),objects:scene.objects.filter(o=>shown(o,o.kind))};
}

export function vwxBounds(scene:VwxScene){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 function add(p:VwxVec3){for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}}
 for(const panel of scene.panels){panel.front.forEach(add);panel.back.forEach(add);}
 for(const item of scene.objects){
  const vertices=item.vertices?.length?item.vertices:item.corners;
  if(vertices?.length&&item.kind!=='hoist')vertices.forEach(add);else add(item.position);
 }
 if(!Number.isFinite(min[0]))return {center:[0,0,0] as VwxVec3,half:[500,500,500]};
 return {center:min.map((n,i)=>(n+max[i])/2) as VwxVec3,half:min.map((n,i)=>(max[i]-n)/2)};
}

const panelFaces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
type Projected= [number,number,number];
type Hit={id:string;poly:Projected[];depth:number;point?:boolean;stroke?:boolean;box?:boolean};
export type VwxHits=Hit[];
export function nearestVwxAnchors(hits:VwxHits,x:number,y:number){
 const candidates:{id:string;distance:number;depth:number}[]=[];
 for(const hit of hits){
  if(!hit.point)continue;
  const distance=Math.hypot(hit.poly[0][0]-x,hit.poly[0][1]-y);
  if(distance<=12)candidates.push({id:hit.id,distance,depth:hit.depth});
 }
 candidates.sort((a,b)=>a.distance-b.distance||b.depth-a.depth);
 return candidates.filter(c=>c.distance<=candidates[0].distance+1.5).map(c=>c.id);
}
function inside(poly:Projected[],x:number,y:number){
 let result=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;
 }
 return result;
}
export function pickVwxItem(hits:VwxHits,x:number,y:number,hoistsOnly=false):string|undefined{
 let nearest:Hit|undefined,best=14;
 for(const hit of hits){
  if(!hit.point)continue;
  const d=Math.hypot(hit.poly[0][0]-x,hit.poly[0][1]-y);
  if(d<=best){best=d;nearest=hit;}
 }
 if(nearest)return nearest.id;
 if(hoistsOnly)return;
 for(let i=hits.length-1;i>=0;i--){const h=hits[i];if(!h.point&&!h.stroke&&inside(h.poly,x,y))return h.id;}
 let lineId:string|undefined;
 best=6;
 for(const h of hits){
  if(!h.stroke)continue;
  const segment=(a:Projected,b:Projected)=>{
   const dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
   const d=Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
   if(d<best){best=d;lineId=h.id;}
  };
  if(h.box){for(const [a,b] of edges)segment(h.poly[a],h.poly[b]);}
  else {for(let i=1;i<h.poly.length;i++)segment(h.poly[i-1],h.poly[i]);if(h.poly.length===1)segment(h.poly[0],h.poly[0]);}
 }
 return lineId;
}

export const formatVwxMetres=(mm:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3}).format(mm/1000)+' m';
const palette=[['#43bbaa','#318577'],['#e8a55e','#ab773e'],['#83b9ec','#5c88b2'],['#cd8acf','#926294'],['#aace78','#728d50']];
function sizeOfPanel(p:VwxScene['panels'][number]){
 const distance=(a:VwxVec3,b:VwxVec3)=>Math.round(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));
 return [distance(p.front[0],p.front[1]),distance(p.front[0],p.front[3])];
}
export function panelStyles(panels:VwxScene['panels']){
 const sizes=new Map<string,number[]>();
 for(const panel of panels){const size=sizeOfPanel(panel);sizes.set(size.join('×'),size);}
 return new Map([...sizes].sort(([,a],[,b])=>b[0]*b[1]-a[0]*a[1]||b[0]-a[0]).map(([key],i)=>[key,palette[i%palette.length]]));
}
export function drawVwxScene(
 ctx:CanvasRenderingContext2D,width:number,height:number,scene:VwxScene,frame:ReturnType<typeof vwxBounds>,camera:VwxCamera,
 selected:string,pending:string,measurements:VwxViewSettings['measurements'],styles=panelStyles(scene.panels),modelAnchors=false
):VwxHits{
 const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
 const [dx,dy,dz]=frame.half;
 const sw=2*(Math.abs(cy)*dx+Math.abs(sy)*dy);
 const sh=2*(Math.abs(sy*sp)*dx+Math.abs(cy*sp)*dy+Math.abs(cp)*dz);
 const s=Math.max(.000001,Math.min((width-62)/Math.max(200,sw),(height-64)/Math.max(200,sh)))*camera.zoom;
 const [cx,centreY,cz]=frame.center;
 const proj=(p:VwxVec3):Projected=>{
  const x=p[0]-cx,y=p[1]-centreY,z=p[2]-cz;
  return [width/2+camera.x+s*(cy*x+sy*y),height/2+camera.y-s*(-sy*sp*x+cy*sp*y+cp*z),sy*cp*x-cy*cp*y+sp*z];
 };
 ctx.clearRect(0,0,width,height);
 const hits:VwxHits=[];
 function stroke(a:Projected,b:Projected){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
 function path(points:Projected[]){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.closePath();}
 for(const kind of ['context','truss'] as const){
  for(const item of scene.objects){
   if(item.kind!==kind)continue;
   const focus=item.id===selected;
   ctx.strokeStyle=focus?'#fff3a1':kind==='truss'?'#a9b8c9':'#526773';ctx.lineWidth=focus?2:kind==='truss'?1.1:.7;
   const q=(item.vertices?.length?item.vertices:item.corners)?.map(proj)??[];
   ctx.beginPath();
   if(q.length===8&&!item.vertices?.length){for(const [a,b] of edges)stroke(q[a],q[b]);}
   else if(q.length>1){for(let i=1;i<q.length;i++)stroke(q[i-1],q[i]);}
   else{const [x,y]=proj(item.position);ctx.rect(x-1.5,y-1.5,3,3);}
   ctx.stroke();
   hits.push({id:item.id,poly:q.length?q:[proj(item.position)],depth:0,stroke:true,box:q.length===8&&!item.vertices?.length});
  }
 }
 if(modelAnchors){
  for(const o of scene.objects){
   o.vertices?.forEach((v,i)=>{const q=proj(v);hits.push({id:vwxAnchorId('vertex',o.id,i),poly:[q],depth:q[2],point:true});});
  }
  for(const panel of scene.panels){
   panel.front.forEach((v,i)=>{const q=proj(v);hits.push({id:vwxAnchorId('panel',panel.id,i),poly:[q],depth:q[2],point:true});});
  }
 }
 const faces:{q:Projected[];id:string;z:number;color:string}[]=[];
 for(const panel of scene.panels){
  const p=panel.front.concat(panel.back).map(proj);if(p.length!==8)continue;
  const colors=styles.get(sizeOfPanel(panel).join('×'))??palette[0];
  for(let i=0;i<panelFaces.length;i++){
   const q=panelFaces[i].map(j=>p[j]);
   const area=Math.abs((q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]));
   if(area<.06)continue;
   const color=panel.id===selected?'#fff0a3':colors[i<2?0:1];
   faces.push({q,id:panel.id,z:q.reduce((v,t)=>v+t[2],0)/4,color});
  }
 }
 faces.sort((a,b)=>a.z-b.z);
 for(const f of faces){path(f.q);ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle='#143237';ctx.lineWidth=.65;ctx.stroke();hits.push({id:f.id,poly:f.q,depth:f.z});}
 if(modelAnchors){
  ctx.fillStyle='#d0eff3';
  for(const hit of hits){
   if(hit.point){const [x,y]=hit.poly[0];ctx.fillRect(x-1.2,y-1.2,2.4,2.4);}
  }
 }
 const hoists=new Map(scene.objects.filter(o=>o.kind==='hoist').map(o=>[o.id,o]));
 for(const m of measurements){
  const a=findVwxEndpoint(scene,m.from),b=findVwxEndpoint(scene,m.to);if(!a||!b)continue;
  const pa=proj(a.position),pb=proj(b.position);ctx.strokeStyle='#ffbda3';ctx.lineWidth=1.6;
  ctx.beginPath();stroke(pa,pb);ctx.stroke();
  for(const p of [pa,pb]){ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.stroke();}
 }
 const active=pending&&findVwxEndpoint(scene,pending);
 if(active&&active.kind!=='hoist'){
  const [x,y]=proj(active.position);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.strokeStyle='#ffe194';ctx.lineWidth=2;ctx.stroke();
 }
 const labels:{x:number;y:number;w:number}[]=[];
 for(const o of hoists.values()){
  const p=proj(o.position),[x,y]=p;
  const focus=o.id===pending||o.id===selected;
  ctx.strokeStyle=focus?'#fff':'#1b252a';ctx.lineWidth=focus?2:1.5;ctx.fillStyle=focus?'#ff916b':'#f4c860';ctx.beginPath();ctx.arc(x,y,focus?6:4,0,Math.PI*2);ctx.fill();ctx.stroke();
  hits.push({id:o.id,poly:[p],depth:p[2],point:true});
  ctx.font='11px system-ui';const w=ctx.measureText(o.name).width+4;
  const spot=Array.from({length:6},(_,i)=>({x:x+6,y:y-4+i*14,w})).find(a=>!labels.some(b=>Math.abs(a.y-b.y)<13&&a.x<b.x+b.w&&b.x<a.x+a.w));
  if(spot){labels.push(spot);ctx.lineWidth=3;ctx.strokeStyle='#131b24';ctx.strokeText(o.name,spot.x,spot.y);ctx.fillStyle='#f1d9a4';ctx.fillText(o.name,spot.x,spot.y);}
 }
 return hits;
}

export function validVwxViewSettings(value:unknown):value is VwxViewSettings {
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<VwxViewSettings>;
 const strings=(a:unknown):a is string[]=>Array.isArray(a)&&a.every(x=>typeof x==='string');
 return strings(v.hiddenLayers)&&(v.hiddenClasses===undefined||strings(v.hiddenClasses))&&strings(v.hiddenObjects)&&strings(v.hiddenKinds)&&
  v.hiddenKinds.every(x=>['panel','hoist','truss','context'].includes(x))&&Array.isArray(v.measurements)&&
  v.measurements.every(m=>m&&typeof m.from==='string'&&typeof m.to==='string'&&m.from!==m.to);
}
