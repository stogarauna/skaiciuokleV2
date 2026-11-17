import {geometry} from './geometry.ts';
import {stats,resolvePanelDepth,type Panel,type Screen} from './project.ts';
type Point={x:number;y:number};
export type CadEntity={layer:string}&({type:'polyline';points:Point[];closed:boolean}|{type:'line';a:Point;b:Point}|{type:'text';at:Point;text:string;height:number;rotation?:number});
const fmt=(n:number)=>{if(!Number.isFinite(n))throw Error('Netinkama CAD koordinatė.');return String(Math.round(n*1e6)/1e6);};
const label=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(n).replace(/\u00a0/g,' ');
export function cadEntities(screens:Screen[],name:string,catalog:Panel[]=[]):CadEntity[]{
 if(!screens.length)throw Error('Pasirinkite ekraną.');
 screens=screens.map(screen=>({...screen,panel:resolvePanelDepth(screen.panel,catalog)}));
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
 const arrowDimension=(layer:string,a:Point,b:Point,value:string)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<1e-6)return;
  const ux=dx/length,uy=dy/length;
  const arrow=Math.min(75,length*.22);
  line(layer,a,b);
  for(const [tip,direction] of [[a,1],[b,-1]] as const){
   for(const side of [-1,1]){
    line(layer,tip,{x:tip.x+direction*ux*arrow-side*uy*arrow*.32,y:tip.y+direction*uy*arrow+side*ux*arrow*.32});
   }
  }
  text({x:(a.x+b.x)/2-uy*105,y:(a.y+b.y)/2+ux*105},value,72,layer,dx===0?90:0);
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
 let left=minX;
 for(const s of screens){
 const g=geometry(s),width=g.width*1000,depth=g.depth*1000;
 const highest=minY-2000;
 const origin=left-g.minX*1000;
 const topY=highest+g.minZ*1000;
 const convert=(p:{x:number;z:number}):Point=>({x:origin+p.x*1000,y:topY-p.z*1000});
 for(const [c,segment] of g.segments.entries())if(segment.occupied){
 const a=convert(segment.front),b=convert(segment.end);
 if(segment.outline)entities.push({type:'polyline',layer:'GEOMETRIJA',closed:true,points:segment.outline.map(convert)});
 else line('GEOMETRIJA',a,b);
 text({x:(a.x+b.x)/2,y:(a.y+b.y)/2+(segment.outline?-90:70)},String(c+1),60,'NUMERIAI');
 }
 // Each cabinet remains a straight, closed rectangle. Mark the actual turn
 // at every adjoining occupied column, rather than replacing faces with an arc.
 if(Math.abs(g.angle)>1e-8){
  for(let c=1;c<g.segments.length;c++){
   const previous=g.segments[c-1],next=g.segments[c];
   if(!previous.occupied||!next.occupied)continue;
   const joint=convert(next.front);
   const theta=(c-s.cols/2)*g.angle*Math.PI/180;
   const offset=(s.panel.depthM??0)*1000+230;
   const labelAt={x:joint.x+Math.sin(theta)*offset,y:joint.y+Math.cos(theta)*offset};
   line('KAMPAI',joint,labelAt);
   text(labelAt,`${label(g.angle)}°`,50,'KAMPAI');
  }
 }
 const lowest=highest-depth;
 text({x:left,y:highest+650},`${s.name} · VAIZDAS IŠ VIRŠAUS`,100);
 text({x:left,y:highest+400},`${label(g.angle)}° / jungtis · R ${g.radius===null?'∞':label(g.radius*1000)+' mm'}`,75);
 const widthY=lowest-300;
 for(const x of [left,left+width])line('MATMENYS',{x,y:lowest-45},{x,y:widthY-45});
 arrowDimension('MATMENYS',{x:left,y:widthY},{x:left+width,y:widthY},`X · Plotis ${label(width)} mm`);
 const depthX=left+width+350;
 if(depth>1e-6){
  for(const y of [highest,lowest])line('MATMENYS',{x:left+width+45,y},{x:depthX+50,y});
  arrowDimension('MATMENYS',{x:depthX,y:highest},{x:depthX,y:lowest},`Y · Bendras gylis ${label(depth)} mm`);
 }
 if(g.bendDepth!==null&&g.bendDepth>1e-8){
  const layer='ISGAUBIMAS',bendX=depthX+460;
  const chord=convert({x:0,z:g.chordZ});
  const tip=convert(g.peak);
  // Chord reference and outermost face point delimit the bend independently of cabinet depth.
  line(layer,convert(g.points[0]),convert(g.points.at(-1)!));
  for(const point of [chord,tip]){
   line(layer,{x:left+width+45,y:point.y},{x:bendX+50,y:point.y});
  }
  arrowDimension(layer,{x:bendX,y:Math.max(chord.y,tip.y)},{x:bendX,y:Math.min(chord.y,tip.y)},
   `Y · ${g.angle>0?'Įgaubimo':'Išgaubimo'} gylis ${label(g.bendDepth*1000)} mm`);
 }
 if(g.closed)text({x:left+width/2,y:lowest-900},'Uždaras žiedas · gylis nuo stygos netaikomas',65);

 const thickness=s.panel.depthM;
 text({x:left,y:lowest-650},thickness?`Panelės storis: ${label(thickness*1000)} mm`:'Panelės storis nenurodytas.',65);
 left+=Math.max(width,g.surfaceWidth*1000,3500)+2000;
 }
 return entities;
}
// R12/AC1009 interchange: no subclass markers, owner graph or modern objects.
// All coordinates are millimetres (R12 has no $INSUNITS variable).
export function createDXF(screens:Screen[],name:string,catalog:Panel[]=[]):string{
 const entities=cadEntities(screens,name,catalog);
 // R12 is an ASCII/codepage format. Encode every non-ASCII UTF-16 unit using
 // DXF Unicode escapes, including both halves of supplementary characters.
 const ascii=(s:string)=>s.replace(/[\x00-\x1f\x7f]/g,' ').replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
 const pair=(code:number,value:string|number)=>{
  let v=typeof value==='number'?fmt(value):ascii(value);
  // Use explicit real literals for floating point group codes.
  if(typeof value==='number'&&code>=10&&code<=59&&!/[.eE]/.test(v))v+='.0';
  return `${code}\r\n${v}\r\n`;
 };
 const fields=(...items:(string|number)[])=>{let s='';for(let i=0;i<items.length;i+=2)s+=pair(items[i] as number,items[i+1]);return s;};
 const point=(p:Point,code=10)=>fields(code,p.x,code+10,p.y,code+20,0);
 const layers=[['0',7],['PANELES',4],['NUMERIAI',7],['MATMENYS',3],['ISGAUBIMAS',2],['GEOMETRIJA',6],['KAMPAI',2],['PASTABOS',7]] as const;
 let out=fields(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1009',9,'$DWGCODEPAGE',3,'ANSI_1252',9,'$LUNITS',70,2,9,'$LUPREC',70,2,9,'$INSBASE',10,0,20,0,30,0,0,'ENDSEC');
 out+=fields(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',70,1,0,'LTYPE',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0,0,'ENDTAB',0,'TABLE',2,'LAYER',70,layers.length);
 for(const [layer,color] of layers)out+=fields(0,'LAYER',2,layer,70,0,62,color,6,'CONTINUOUS');
 out+=fields(0,'ENDTAB',0,'TABLE',2,'STYLE',70,1,0,'STYLE',2,'STANDARD',70,0,40,0,41,1,50,0,71,0,42,80,3,'arial.ttf',4,'',0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'BLOCKS',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
 for(const e of entities){
  if(e.type==='polyline'){
   out+=fields(0,'POLYLINE',8,e.layer,66,1,70,e.closed?1:0,10,0,20,0,30,0);
   for(const p of e.points)out+=fields(0,'VERTEX',8,e.layer,70,0)+point(p);
   out+=fields(0,'SEQEND',8,e.layer);
  }else if(e.type==='line')out+=fields(0,'LINE',8,e.layer)+point(e.a)+point(e.b,11);
  else out+=fields(0,'TEXT',8,e.layer)+point(e.at)+fields(40,e.height,1,e.text,50,e.rotation??0,7,'STANDARD',72,1,73,2)+point(e.at,11);
 }
 return out+fields(0,'ENDSEC',0,'EOF');
}
export function dxfFilename(name:string){return (name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,90)||'LED-geometrija')+'-R12.dxf';}
export function downloadDXF(screens:Screen[],name:string,catalog:Panel[]=[]){
 const url=URL.createObjectURL(new Blob([createDXF(screens,name,catalog)],{type:'application/dxf;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=dxfFilename(name);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
