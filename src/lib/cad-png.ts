import type {CadEntity} from './dxf.ts';

const palette: Record<string,string> = {
 PANELES:'#77bec2', GEOMETRIJA:'#77d8cd', MATMENYS:'#aae8b3',
 ISGAUBIMAS:'#ffcf7b', KAMPAI:'#ffcf7b', NUMERIAI:'#d4e0ee', PASTABOS:'#eef4fa'
};

function drawCad(entities: CadEntity[]): HTMLCanvasElement {
 const canvas=document.createElement('canvas');
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Nepavyko sukurti PNG brėžinio.');
 const font=(height:number)=>`${height*1.3}px Arial, sans-serif`;
 let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 function include(x:number,y:number){
  left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);
 }
 for(const entity of entities){
  if(entity.type==='text'){
   ctx.font=font(entity.height);
   const halfWidth=ctx.measureText(entity.text).width/2;
   const halfHeight=entity.height*.9;
   const rotated=entity.rotation===90;
   const x=rotated?halfHeight:halfWidth,y=rotated?halfWidth:halfHeight;
   include(entity.at.x-x,entity.at.y-y);include(entity.at.x+x,entity.at.y+y);
  }else{
   const points=entity.type==='line'?[entity.a,entity.b]:entity.points;
   for(const point of points)include(point.x,point.y);
  }
 }
 const padding=160;
 const scale=3200/Math.max(right-left+2*padding,top-bottom+2*padding);
 canvas.width=Math.ceil((right-left+2*padding)*scale);
 canvas.height=Math.ceil((top-bottom+2*padding)*scale);
 ctx.fillStyle='#101923';
 ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.setTransform(scale,0,0,scale,(padding-left)*scale,(padding+top)*scale);
 ctx.textAlign='center';
 ctx.textBaseline='middle';
 ctx.lineWidth=Math.max(8,1/scale);
 for(const entity of entities){
  const color=palette[entity.layer]??'#eef4fa';
  if(entity.type==='text'){
   ctx.save();
   ctx.translate(entity.at.x,-entity.at.y);
   ctx.rotate(-(entity.rotation??0)*Math.PI/180);
   ctx.font=font(entity.height);
   ctx.fillStyle=color;
   ctx.fillText(entity.text,0,0);
   ctx.restore();
   continue;
  }
  const points=entity.type==='line'?[entity.a,entity.b]:entity.points;
  ctx.beginPath();
  ctx.moveTo(points[0].x,-points[0].y);
  for(const point of points.slice(1))ctx.lineTo(point.x,-point.y);
  if(entity.type==='polyline'&&entity.closed){
   ctx.closePath();
   ctx.fillStyle=entity.layer==='GEOMETRIJA'?'#1b494d':'#172f3c';
   ctx.fill();
  }
  ctx.strokeStyle=color;
  ctx.stroke();
 }
 return canvas;
}

export async function downloadCadPNG(entities:CadEntity[],filename:string){
 const canvas=drawCad(entities);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>{
  if(result)resolve(result);
  else reject(Error('Nepavyko sukurti PNG brėžinio.'));
 },'image/png'));
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download=filename;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
