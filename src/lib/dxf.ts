import {dxfPrefix,dxfSuffix,modelSpaceHandle} from './dxf-template.ts';
import {geometry} from './geometry.ts';
import {stats,type Screen} from './project.ts';
type Point={x:number;y:number};
export type CadEntity={layer:string}&({type:'polyline';points:Point[];closed:boolean}|{type:'line';a:Point;b:Point}|{type:'text';at:Point;text:string;height:number;rotation?:number});
const fmt=(n:number)=>{if(!Number.isFinite(n))throw Error('Netinkama CAD koordinatė.');return String(Math.round(n*1e6)/1e6);};
const label=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(n).replace(/\u00a0/g,' ');
export function cadEntities(screens:Screen[],name:string):CadEntity[]{
 if(!screens.length)throw Error('Pasirinkite ekraną.');
 const entities:CadEntity[]=[];
 const line=(layer:string,a:Point,b:Point)=>entities.push({type:'line',layer,a,b});
 const text=(at:Point,value:string,height=80,layer='PASTABOS',rotation=0)=>entities.push({type:'text',layer,at,text:value,height,rotation});
 const horizontal=(x:number,y:number,w:number,value:string)=>{
 line('MATMENYS',{x,y},{x:x+w,y});for(const end of [x,x+w])line('MATMENYS',{x:end,y:y-70},{x:end,y:y+70});
 text({x:x+w/2,y:y+90},value,65,'MATMENYS');
 };
 const vertical=(x:number,y:number,h:number,value:string)=>{
 line('MATMENYS',{x,y},{x,y:y-h});for(const end of [y,y-h])line('MATMENYS',{x:x-70,y:end},{x:x+70,y:end});
 text({x:x+90,y:y-h/2},value,65,'MATMENYS',90);
 };
 const minX=Math.min(...screens.map(s=>s.x*1000)),maxY=Math.max(...screens.map(s=>-s.y*1000));
 const minY=Math.min(...screens.map(s=>-(s.y+s.rows*s.panel.heightM)*1000));
 text({x:minX,y:maxY+1300},name,150);
 text({x:minX,y:maxY+1000},'2D CAD · mastelis 1:1 · visi matmenys mm',85);
 for(const s of screens){
 const x=s.x*1000,y=-s.y*1000,w=s.panel.widthM*1000,h=s.panel.heightM*1000,t=stats(s);
 text({x,y:y+700},`${s.name} · IŠKLOTINĖ`,100);
 for(const {c,r} of t.cells){
 const left=x+c*w,top=y-r*h;
 entities.push({type:'polyline',layer:'PANELES',closed:true,points:[{x:left,y:top},{x:left+w,y:top},{x:left+w,y:top-h},{x:left,y:top-h}]});
 text({x:left+w/2,y:top-h/2},String(r*s.cols+c+1),Math.min(65,w*.14,h*.14),'NUMERIAI');
 }
 horizontal(x,y+300,s.cols*w,`${label(s.cols*w)} mm`);
 vertical(x+s.cols*w+300,y,s.rows*h,`${label(s.rows*h)} mm`);
 text({x:x+s.cols*w/2,y:y-s.rows*h-300},`${s.panel.name} · ${t.n} panelių · ${t.pxW} × ${t.pxH} px`,75);
 }
 const maxDepth=Math.max(...screens.map(s=>geometry(s).depth))*1000;
 const topY=minY-2000-maxDepth;let left=minX;
 for(const s of screens){
 const g=geometry(s),width=g.width*1000,depth=g.depth*1000;
 const origin=left+width/2;
 const convert=(p:{x:number;z:number}):Point=>({x:origin+p.x*1000,y:topY-p.z*1000});
 const occupied=new Set(stats(s).cells.map(p=>p.c));
 for(let c=0;c<s.cols;c++)if(occupied.has(c)){
 const a=convert(g.points[c]),b=convert(g.points[c+1]);line('GEOMETRIJA',a,b);
 text({x:(a.x+b.x)/2,y:(a.y+b.y)/2+70},String(c+1),60,'NUMERIAI');
 }
 const highest=topY-g.minZ*1000,lowest=topY-g.maxZ*1000;
 text({x:left,y:highest+650},`${s.name} · VAIZDAS IŠ VIRŠAUS`,100);
 text({x:left,y:highest+400},`${label(g.angle)}° / jungtis · R ${g.radius===null?'∞':label(g.radius*1000)+' mm'}`,75);
 horizontal(left,lowest-300,width,`${label(width)} mm`);
 if(depth>1e-6)vertical(left+width+300,highest,depth,`${label(depth)} mm`);
 text({x:left,y:lowest-650},'Standžios panelės. Panelių storis ir konstrukcijos neįvertinti.',65);
 left+=Math.max(width,g.surfaceWidth*1000,3500)+2000;
 }
 return entities;
}
// AutoCAD 2007 ASCII DXF (UTF-8); editable 2D entities with explicit millimetre units.
export function createDXF(screens:Screen[],name:string):string{
 const entities=cadEntities(screens,name);let counter=0x1000;
 const handle=()=> (counter++).toString(16).toUpperCase();
 const pair=(code:number,value:string|number)=>`${code}\r\n${typeof value==='number'?fmt(value):value}\r\n`;
 const fields=(...items:(string|number)[])=>{let s='';for(let i=0;i<items.length;i+=2)s+=pair(items[i] as number,items[i+1]);return s;};
 const model=modelSpaceHandle;
 let body='';
 const point=(p:Point,code=10)=>fields(code,p.x,code+10,p.y,code+20,0);
 for(const e of entities){
 body+=fields(0,e.type==='polyline'?'LWPOLYLINE':e.type==='line'?'LINE':'TEXT',5,handle(),330,model,100,'AcDbEntity',8,e.layer);
 if(e.type==='polyline'){body+=fields(100,'AcDbPolyline',90,e.points.length,70,e.closed?1:0);for(const p of e.points)body+=fields(10,p.x,20,p.y);}
 else if(e.type==='line')body+=fields(100,'AcDbLine')+point(e.a)+point(e.b,11);
 else{const value=e.text.replace(/[\x00-\x1f\x7f]/g,' ');body+=fields(100,'AcDbText')+point(e.at)+fields(40,e.height,1,value,50,e.rotation??0,7,'STANDARD',72,1)+point(e.at,11)+fields(100,'AcDbText',73,2);}
 }
 // HANDSEED must exceed every handle in tables, objects and generated entities.
 return dxfPrefix.replace('__HANDSEED__',handle())+body+dxfSuffix;
}
export function dxfFilename(name:string){return (name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,90)||'LED-geometrija')+'.dxf';}
export function downloadDXF(screens:Screen[],name:string){
 const url=URL.createObjectURL(new Blob([createDXF(screens,name)],{type:'application/dxf;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=dxfFilename(name);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
