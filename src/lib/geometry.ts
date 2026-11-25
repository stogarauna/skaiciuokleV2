import type { Panel, Screen } from './project';
import {cabinetCounts,cabinetPositions} from './mixed-panels.ts';
export interface BendLimits { min:number; max:number; status:'supported'|'fixed'|'unknown'; note:string }
export function bendLimits(p:Panel):BendLimits {
 if(p.bendAngleText==='Nesilenkia')return {min:0,max:0,status:'fixed',note:'Šio modelio panelės nesilenkia.'};
 const min=p.bendAngleMinDeg,max=p.bendAngleMaxDeg;
 if(typeof min==='number'&&typeof max==='number'&&Number.isFinite(min)&&Number.isFinite(max)&&min<=0&&max>=0&&min>=-90&&max<=90){return {min,max,status:min===0&&max===0?'fixed':'supported',note:'Ribos pagal panelio katalogą. Patikrinkite užraktų žingsnį ir kryptis.'};}
 return {min:0,max:0,status:'unknown',note:'Lenkimo ribos nepatikslintos. Kataloge įrašykite vieną min. ir max. kampą.'};
}
interface ProfileSection {
 width:number;
 depthM:number|null|undefined;
 occupied:boolean;
 startsJoint:boolean;
}

function topProfile(s:Screen):ProfileSection[] {
 if(!s.mixed){
  const removed=new Set(s.removed);
  return Array.from({length:s.cols},(_,c)=>{
   let occupied=false;
   for(let r=0;r<s.rows&&!occupied;r++)occupied=!removed.has(c+','+r);
   return {width:s.panel.widthM,depthM:s.panel.depthM,occupied,startsJoint:c>0};
  });
 }
 // Project the uppermost cabinet in each column and the maximum depth of the
 // stack behind it. A wide cabinet anywhere across a seam keeps that seam flat.
 const columns=Array.from({length:s.cols},()=>({top:-1,depth:0,bridged:false}));
 for(const cabinet of cabinetPositions(s)){
  for(let i=0;i<cabinet.span;i++){
   const col=columns[cabinet.c+i];
   if(col.top<0)col.top=cabinet.number;
   col.depth=Math.max(col.depth,cabinet.panel.depthM??0);
   if(i)col.bridged=true;
  }
 }
 const sections:ProfileSection[]=[];
 for(const [index,column] of columns.entries()){
  const previous=columns[index-1];
  if(previous&&column.bridged&&previous.top===column.top&&previous.depth===column.depth){
   sections[sections.length-1].width+=s.panel.widthM;
  }else{
   sections.push({width:s.panel.widthM,depthM:column.depth||null,occupied:column.top>=0,startsJoint:index>0&&!column.bridged});
  }
 }
 return sections;
}

export function screenBendLimits(s:Screen):BendLimits{
 if(!s.mixed)return bendLimits(s.panel);
 const limits=cabinetCounts(s).filter(item=>item.count>0).map(item=>bendLimits(item.panel));
 if(!limits.length)return bendLimits(s.panel);
 const unavailable=limits.find(item=>item.status!=='supported');
 if(unavailable)return unavailable;
 const min=Math.max(...limits.map(item=>item.min)),max=Math.min(...limits.map(item=>item.max));
 return {min,max,status:min||max?'supported':'fixed',note:'Bendros naudojamų panelių katalogo ribos. Kampas taikomas tik per visą aukštį sutampančioms jungtims.'};
}

export function angleIssue(s:Screen,angle=s.curvature?.angleDeg??0):string|null{
 if(!Number.isFinite(angle))return 'Kampas turi būti skaičius.';
 if(angle===0)return null;
 const runs=s.mixed?1+topProfile(s).filter(p=>p.startsJoint).length:s.cols;
 if(runs<2)return s.mixed?'Lenkimui reikia sutampančių panelių jungčių.':'Lenkimui reikia bent dviejų panelių stulpelių.';
 const limits=screenBendLimits(s);
 if(limits.status!=='supported')return limits.note;
 if(angle<limits.min-1e-8||angle>limits.max+1e-8)return `Leistinas kampas nuo ${limits.min}° iki ${limits.max}°.`;
 if(runs*Math.abs(angle)>360+1e-8)return 'Lankas negali viršyti 360°. Sumažinkite kampą arba stulpelių kiekį.';
 return null;
}
export function geometry(s:Screen){
 const angle=s.curvature?.angleDeg??0,a=angle*Math.PI/180;
 const sections=topProfile(s);
 const jointCount=sections.filter(section=>section.startsJoint).length;
 let heading=-jointCount*a/2;
 const vertices=[{x:0,z:0}];
 const headings:number[]=[],facets:number[]=[];
 for(const section of sections){
  if(section.startsJoint)heading+=a;
  if(!facets.length||section.startsJoint)facets.push(0);
  facets[facets.length-1]+=section.width;
  headings.push(heading);
  const p=vertices[vertices.length-1];
  vertices.push({x:p.x+section.width*Math.cos(heading),z:p.z+section.width*Math.sin(heading)});
 }
 const last=vertices[vertices.length-1],chord=Math.hypot(last.x,last.z);
 // A mixed-width arc can be asymmetric. Use its chord as the horizontal datum.
 const rotation=s.mixed&&chord>1e-8?Math.atan2(last.z,last.x):0;
 const cos=Math.cos(rotation),sin=Math.sin(rotation);
 const rotated=vertices.map(p=>({x:p.x*cos+p.z*sin,z:p.z*cos-p.x*sin}));
 const minX=Math.min(...rotated.map(p=>p.x)),maxX=Math.max(...rotated.map(p=>p.x));
 const points=rotated.map(p=>({x:p.x-(minX+maxX)/2,z:p.z}));
 const segments=sections.map((section,i)=>{
  const front=points[i],end=points[i+1],heading=headings[i]-rotation;
  const {occupied,depthM,startsJoint}=section;
  const segment={front,end,occupied,depthM,startsJoint,heading};
  if(!occupied||typeof depthM!=='number'||!Number.isFinite(depthM)||depthM<=0)return {...segment,outline:null};
  const rear=(point:typeof front)=>({x:point.x+Math.sin(heading)*depthM,z:point.z-Math.cos(heading)*depthM});
  return {...segment,outline:[front,end,rear(end),rear(front)]};
 });
 const footprint=[...points,...segments.flatMap(segment=>segment.outline??[])];
 const left=Math.min(...footprint.map(p=>p.x)),right=Math.max(...footprint.map(p=>p.x));
 const minZ=Math.min(...footprint.map(p=>p.z)),maxZ=Math.max(...footprint.map(p=>p.z));
 const span=facets.length*Math.abs(angle),closed=Math.abs(span-360)<1e-7&&chord<1e-7;
 const chordZ=(points[0].z+points.at(-1)!.z)/2;
 const peak=points.reduce((deepest,point)=>Math.abs(point.z-chordZ)>Math.abs(deepest.z-chordZ)?point:deepest);
 const equalFacets=facets.every(w=>Math.abs(w-facets[0])<1e-8);
 return {angle,points,segments,minX:left,width:right-left,depth:maxZ-minZ,chord,bendDepth:closed?null:Math.abs(peak.z-chordZ),chordZ,peak,minZ,maxZ,surfaceWidth:s.cols*s.panel.widthM,radius:Math.abs(a)<1e-10||!equalFacets?null:facets[0]/(2*Math.sin(Math.abs(a)/2)),jointCount,turn:jointCount*Math.abs(angle),span,closed};
}
