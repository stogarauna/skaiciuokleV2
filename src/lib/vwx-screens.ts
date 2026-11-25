import {makeScreen,type Panel,type Screen} from './project.ts';
import {compatiblePair} from './mixed-panels.ts';
import type {VwxScene,VwxVec3} from './vwx-types.ts';

type CadPanel=VwxScene['panels'][number];
export type VwxModel={key:string;name:string;width:number;height:number;unidentified?:boolean};
type Cell={c:number;r:number;span:number;model:string};
export type VwxScreenGroup={
 id:string;layerId:string;wallIds:string[];name:string;models:VwxModel[];count:number;
 x:number;y:number;centre:VwxVec3;cols:number;rows:number;cells:Cell[];folded:boolean;issue:string;
};
type Measured={cad:CadPanel;model:VwxModel;low:number;high:number};
const distance=(a:VwxVec3,b:VwxVec3)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const mix=(a:VwxVec3,b:VwxVec3,t:number):VwxVec3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

// Bucket neighbours allow small model seams. Two different points must match
// before two CAD sections are considered adjacent (a shared corner is insufficient).
class Vertices {
 points:VwxVec3[]=[];
 private bins=new Map<string,number[]>();
 private tolerance:number;
 private flat:boolean;
 constructor(tolerance:number,flat=false){this.tolerance=tolerance;this.flat=flat;}
 at(p:VwxVec3){
  const t=this.tolerance,x=Math.floor(p[0]/t),y=Math.floor(p[1]/t),z=this.flat?0:Math.floor(p[2]/t);
  for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)for(let k=this.flat?0:z-1;k<=(this.flat?0:z+1);k++){
   for(const id of this.bins.get(i+','+j+','+k)??[]){
    const q=this.points[id];
    if(Math.hypot(q[0]-p[0],q[1]-p[1],this.flat?0:q[2]-p[2])<=t)return id;
   }
  }
  const id=this.points.push(p)-1,key=x+','+y+','+z;
  if(!this.bins.has(key))this.bins.set(key,[]);
  this.bins.get(key)!.push(id);return id;
 }
}

function connected(panels:Measured[],tolerance:number){
 const vertices=new Vertices(tolerance),parent=new Map<string,string>(),at=new Map<number,Set<string>>();
 const contacts=new Map<string,number>();
 function root(w:string):string{
  let id=w;
  while(parent.has(id))id=parent.get(id)!;
  if(w!==id)parent.set(w,id);return id;
 }
 for(const {cad} of panels){
  const wall=cad.wallId;
  for(const [a,b] of [[cad.front[0],cad.front[1]],[cad.front[3],cad.front[2]]]){
   for(const t of [0,.25,.5,.75,1]){
    const v=vertices.at(mix(a,b,t));
    const owners=at.get(v)??new Set<string>();
    if(owners.has(wall))continue;
    for(const other of owners){
     const x=root(wall),y=root(other);if(x===y)continue;
     const key=JSON.stringify([wall,other].sort());
     const previous=contacts.get(key);
     if(previous!==undefined&&previous!==v)parent.set(x,y);
     else contacts.set(key,v);
    }
    owners.add(wall);at.set(v,owners);
   }
  }
 }
 const groups=new Map<string,Measured[]>();
 for(const p of panels){const key=root(p.cad.wallId);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
 return groups.values();
}

function footprint(panels:Measured[],width:number,height:number,tolerance:number){
 const vertices=new Vertices(tolerance,true),edges=new Set<string>(),panelEdges:string[][]=[];
 let top=-Infinity;
 const adjacent=new Map<number,Set<number>>();
 function link(a:number,b:number){
  if(!adjacent.has(a))adjacent.set(a,new Set());
  adjacent.get(a)!.add(b);
 }
 for(const {cad,model,high} of panels){
  const [a,b,c,d]=cad.front,span=Math.round(model.width/width);
  if(model.height!==height||![1,2].includes(span)||Math.abs(model.width-span*width)>1)
   throw Error('Skaičiuoklėje galima derinti vienodo aukščio paneles, kurių pločiai sutampa arba skiriasi du kartus.');
  if(Math.abs(a[2]-b[2])>2||Math.hypot(d[0]-a[0],d[1]-a[1])>2||Math.hypot(c[0]-b[0],c[1]-b[1])>2)
   throw Error('Pasvirusių panelių 2D išklotinę reikia sudaryti ranka.');
  top=Math.max(top,high);
  const keys:string[]=[];
  let v=vertices.at(a);
  for(let i=1;i<=span;i++){
   const u=vertices.at(mix(a,b,i/span));
   if(u===v)throw Error('Nepavyko atskirti panelės kraštų.');
   const key=Math.min(v,u)+','+Math.max(v,u);
   edges.add(key);link(v,u);link(u,v);keys.push(key);v=u;
  }
  panelEdges.push(keys);
 }
 const ends=[...adjacent.keys()].filter(v=>adjacent.get(v)!.size===1);
 if(ends.length!==2||[...adjacent.values()].some(ns=>ns.size>2))
  throw Error('Šiai uždarai arba išsišakojusiai formai reikia atskirai parinkti išklotinės pjūvį.');
 // Walk from the leftmost free end, with model Y breaking ties in a side view.
 ends.sort((a,b)=>vertices.points[a][0]-vertices.points[b][0]||vertices.points[a][1]-vertices.points[b][1]);
 const indexes=new Map<string,number>(),path=[ends[0]];let previous=-1,current=ends[0];
 while(true){
  const next=[...adjacent.get(current)!].find(n=>n!==previous);
  if(next===undefined)break;
  indexes.set(Math.min(current,next)+','+Math.max(current,next),indexes.size);
  path.push(next);previous=current;current=next;
 }
 if(indexes.size!==edges.size)throw Error('Aptiktos erdvėje atskirtos panelių dalys.');
 const first=vertices.points[path[0]],last=vertices.points[path[path.length-1]];
 const folded=path.some(i=>{
  const p=vertices.points[i],dx=last[0]-first[0],dy=last[1]-first[1];
  return Math.abs((p[0]-first[0])*dy-(p[1]-first[1])*dx)>tolerance*Math.hypot(dx,dy);
 });
 const occupied=new Set<string>(),cells:Cell[]=[];let rows=0;
 for(const [i,p] of panels.entries()){
  const xs=panelEdges[i].map(k=>indexes.get(k)!),c=Math.min(...xs),span=xs.length,r=Math.round((top-p.high)/height);
  if(Math.abs(top-p.high-r*height)>tolerance||Math.max(...xs)-c+1!==span)
   throw Error('VWX panelių žingsnis nesutampa su stačiakampiu 2D tinkleliu.');
  for(let x=c;x<c+span;x++){
   const key=x+','+r;if(occupied.has(key))throw Error('Kelios panelės užima tą pačią išklotinės vietą.');occupied.add(key);
  }
  rows=Math.max(rows,r+1);cells.push({c,r,span,model:p.model.key});
 }
 const cols=indexes.size;
 if(cols>100||rows>100||cols*rows>5000)throw Error('Išklotinė viršija leistiną projekto ekrano tinklelį.');
 return {cols,rows,cells,folded};
}

export function detectVwxScreens(scene:VwxScene):VwxScreenGroup[]{
 const layers=new Map<string,Measured[]>(),groups:VwxScreenGroup[]=[];
 let minSceneX=Infinity,maxSceneZ=-Infinity;
 for(const cad of scene.panels){
  const width=Math.round(distance(cad.front[0],cad.front[1])),height=Math.round(distance(cad.front[0],cad.front[3]));
  const zs=cad.front.map(p=>p[2]),low=Math.min(...zs),high=Math.max(...zs);
  const unidentified=cad.provenance==='screen-grid';
  const model={name:cad.model,width,height,unidentified,key:JSON.stringify([cad.model,width,height,unidentified])};
  if(!layers.has(cad.layerId))layers.set(cad.layerId,[]);
  layers.get(cad.layerId)!.push({model,cad,low,high});
  for(const pt of cad.front)minSceneX=Math.min(minSceneX,pt[0]);
  maxSceneZ=Math.max(maxSceneZ,high);
 }
 for(const [layerId,members] of layers){
  const minEdge=members.reduce((n,p)=>Math.min(n,p.model.width,p.model.height),Infinity);
  const tolerance=Math.max(.5,Math.min(35,minEdge*.07));
  // A Spotlight LED Screen already establishes the whole screen boundary. Two
  // adjacent authored screens may intentionally use different rental models.
  const screensByOwner=new Map<string,Measured[]>(),sections:Measured[]=[];
  for(const tile of members){
   if(!tile.model.unidentified){sections.push(tile);continue;}
   const wall=tile.cad.wallId;
   if(!screensByOwner.has(wall))screensByOwner.set(wall,[]);
   screensByOwner.get(wall)!.push(tile);
  }
  for(const block of [...screensByOwner.values(),...connected(sections,tolerance)]){
   const models=[...new Map(block.map(p=>[p.model.key,p.model])).values()].sort((a,b)=>a.width-b.width);
   const wallIds=[...new Set(block.map(p=>p.cad.wallId))].sort();
   const shape={cols:0,rows:0,cells:[] as Cell[],folded:false,issue:''};
   try{Object.assign(shape,footprint(block,models[0].width,models[0].height,tolerance));}
   catch(e){shape.issue=e instanceof Error?e.message:'Nepavyko sudaryti išklotinės.';}
   const lo:VwxVec3=[Infinity,Infinity,Infinity],hi:VwxVec3=[-Infinity,-Infinity,-Infinity];
   for(const p of block)for(const q of p.cad.front)for(let axis=0;axis<3;axis++){
    lo[axis]=Math.min(lo[axis],q[axis]);hi[axis]=Math.max(hi[axis],q[axis]);
   }
   const centre=mix(lo,hi,.5);
   const x=(centre[0]-minSceneX-shape.cols*models[0].width/2)/1000,y=(maxSceneZ-hi[2])/1000;
   if(Math.abs(x)>1000||Math.abs(y)>1000)shape.issue='Ekrano padėtis viršija projekto koordinačių ribas.';
   groups.push({id:JSON.stringify([layerId,wallIds]),layerId,wallIds,name:'',models,count:block.length,x,y,centre,...shape});
  }
 }
 groups.sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
 return groups.map((g,i)=>({...g,name:`Ekranas ${i+1}`}));
}

export const matchingVwxModels=(model:VwxModel,catalog:Panel[])=>catalog.filter(
 p=>Math.abs(1000*p.widthM-model.width)<=1&&Math.abs(1000*p.heightM-model.height)<=1);
export function suggestedVwxModel(model:VwxModel,catalog:Panel[]){
 if(model.unidentified)return '';
 const choices=matchingVwxModels(model,catalog),normal=(s:string)=>s.replace(/[^\p{L}\d]/gu,'').toLowerCase();
 const matches=choices.filter(p=>normal(p.name)===normal(model.name)||
  (/\bunilumin\s+xv\b/i.test(model.name)&&/^(?:P3\s*\/\s*7\s+)?Transparent\s*(?:\(|\d)/i.test(p.name)));
 return matches.length===1?matches[0].name:'';
}
export function alreadyImported(group:VwxScreenGroup,screens:Screen[]){
 const ids=new Set(group.wallIds);
 return screens.some(s=>s.vwxSource?.layerId===group.layerId&&s.vwxSource.wallIds.some(id=>ids.has(id)));
}
export function createVwxScreen(group:VwxScreenGroup,name:string,mapping:Record<string,string>,catalog:Panel[]):Screen{
 if(group.issue)throw Error(group.issue);
 const selected=group.models.map(m=>matchingVwxModels(m,catalog).find(p=>p.name===mapping[m.key]));
 if(!selected.every((p):p is Panel=>!!p))throw Error('Parinkite katalogo modelį kiekvienam VWX panelių tipui.');
 const distinct=[...new Map(selected.map(p=>[p.name,p])).values()];
 const base=distinct[0],wide=distinct[1];
 if(distinct.length>2||wide&&compatiblePair(base,[wide])?.large.name!==wide.name)
  throw Error('Šių katalogo modelių negalima derinti viename ekrane.');
 if(!name.trim())throw Error('Įrašykite ekrano pavadinimą.');
 const {cols,rows}=group,occupied=new Set<string>(),anchors:string[]=[];
 for(const {c,r,span} of group.cells){for(let dx=0;dx<span;dx++)occupied.add(c+dx+','+r);if(span===2)anchors.push(c+','+r);}
 const removed:string[]=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(!occupied.has(c+','+r))removed.push(c+','+r);
 return {...makeScreen(base),name:name.trim(),cols,rows,x:group.x,y:group.y,removed,
  ...(wide?{mixed:{large:structuredClone(wide),anchors}}:{}),
  vwxSource:{layerId:group.layerId,wallIds:[...group.wallIds],folded:group.folded}};
}
