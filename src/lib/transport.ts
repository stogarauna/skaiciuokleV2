export const vehicles = [
 ['Bus 8 EP',420,220,220,1500], ['Bus 10 EP',490,220,230,1500], ['Bus 12 EP',590,230,230,3500],
 ['Solo truck 10 EP Axle',400.8,241.2,280,10505], ['Solo truck 15 EP',620,245,240,5000],
 ['Solo truck 18 EP',720,245,240,6000], ['Solo truck 20 EP',820,245,240,8000],
 ['Set of 765x240x270',765,240,270,6000], ['Set of 775x240x305',775,240,305,6000],
 ['Standard semitrailer 33 EP',1360,245,270,24000], ['Mega semitrailer 33 EP',1360,250,300,24000]
] as const;
export type Box={name:string;l:number;w:number;h:number;kg:number|null};
export type Line=Box & {qty:number;stack:boolean};
export type Place={key:string;x:number;y:number;z:number;l:number;w:number;h:number;level:number;line:number};
export type Plan={vehicle:number;lines:Line[];positions?:Place[]};
export function validBox(b:Box){
 return b && typeof b.name==='string' && b.name.trim().length>0 && b.name.length<=120 &&
 [b.l,b.w,b.h].every(v=>Number.isFinite(v)&&v>=1&&v<=2000) &&
 (b.kg===null||(Number.isFinite(b.kg)&&b.kg>0&&b.kg<=100000));
}
export function validPlan(v:Plan){
 return v && Number.isInteger(v.vehicle)&&!!vehicles[v.vehicle]&&Array.isArray(v.lines)&&v.lines.length<=100 &&
 v.lines.every(l=>validBox(l)&&Number.isInteger(l.qty)&&l.qty>0&&l.qty<=250&&typeof l.stack==='boolean') &&
 v.lines.reduce((n,l)=>n+l.qty,0)<=500 && (v.positions===undefined||(Array.isArray(v.positions)&&v.positions.length<=500&&v.positions.every(p=>p&&typeof p.key==='string'&&[p.x,p.y,p.z,p.l,p.w,p.h,p.level,p.line].every(Number.isFinite))));
}
export function overlaps(a:Place,b:Place){
 return a.x<b.x+b.l && b.x<a.x+a.l && a.y<b.y+b.w && b.y<a.y+a.w && a.z<b.z+b.h && b.z<a.z+a.h;
}
export function supports(a:Place,b:Place){
 return a.z+a.h===b.z && a.x<=b.x && a.y<=b.y && a.x+a.l>=b.x+b.l && a.y+a.w>=b.y+b.w;
}
export function fits(p:Place,others:Place[],plan:Plan){
 const [,l,w,h]=vehicles[plan.vehicle];
 return p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=l&&p.y+p.w<=w&&p.z+p.h<=h&&
 !others.some(b=>overlaps(p,b)) && (p.z===0||others.some(b=>plan.lines[b.line].stack&&supports(b,p)));
}
export function pack(plan:Plan){
 const placed:Place[]=[];const missed:number[]=[];
 const order=plan.lines.map((b,i)=>({b,i})).sort((a,b)=>b.b.l*b.b.w-a.b.l*a.b.w);
 const corners=[{x:0,y:0,z:0,level:1}];
 for(const {b,i} of order)for(let n=0;n<b.qty;n++){
  let best:Place|undefined;
  for(const c of corners)for(const [l,w] of [[b.l,b.w],[b.w,b.l]]){
   const p={...c,l,w,h:b.h,line:i,key:i+'-'+n};
   if(best&&(p.x+l>best.x+best.l||(p.x+l===best.x+best.l&&p.y>=best.y)))continue;
   if(fits(p,placed,plan))best=p;
  }
  if(!best){missed[i]=(missed[i]??0)+1;continue;}
  const p=best;placed.push(p);
  const k=corners.findIndex(c=>c.x===p.x&&c.y===p.y&&c.z===p.z);corners.splice(k,1);
  corners.push({x:p.x+p.l,y:p.y,z:p.z,level:p.level},{x:p.x,y:p.y+p.w,z:p.z,level:p.level});
  if(b.stack)corners.push({x:p.x,y:p.y,z:p.z+p.h,level:p.level+1});
 }
 // Manual changes may move or rotate boxes within their original layer.
 if(plan.positions?.length===placed.length){
  const auto=new Map(placed.map(b=>[b.key,b]));
  const seen=new Set<string>();
  const manual=plan.positions;
  if(manual.every((p,i)=>{
   const a=auto.get(p.key);
   if(!a||seen.has(p.key)||a.line!==p.line||a.z!==p.z||a.level!==p.level||a.h!==p.h)return false;
   seen.add(p.key);
   return ((a.l===p.l&&a.w===p.w)||(a.l===p.w&&a.w===p.l))&&fits(p,manual.filter((_,j)=>j!==i),plan);
  }))return {placed:manual,missed};
 }
 return {placed,missed};
}
