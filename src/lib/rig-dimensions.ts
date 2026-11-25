type Point = {x:number; y:number};
type Line = {x1:number; y1:number; x2:number; y2:number};
type Interval = {start:number; end:number};

export type RoofAxis = {orientation:'vertical'|'horizontal'; position:number; lane?:number};
export type RigDimension = {
 index:number;
 mm:number;
 lines:Line[];
 label:{x:number; y:number; text:string; angle:number};
};

export type RigDimensionLayout = {
 axis:Line|null;
 dimensions:RigDimension[];
 fontSize:number;
 lineWidth:number;
};

export const rigDimensionInk='#b32834';

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,max));
const normalized=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

type MeasuredPoint = {u:number; v:number; index:number; mm:number};
type Row = {min:number; max:number; points:MeasuredPoint[]};

// All calculations use the original image pixels. u measures across the roof
// axis and v runs along it; the conversion to drawing X/Y happens only at the end.
export function rigDimensionLayout(width:number,height:number,metresPerPixel:number,marks:readonly Point[],axis:RoofAxis):RigDimensionLayout{
 const validSize=Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0;
 const short=validSize?Math.min(width,height):0;
 const font=Math.min(Math.max(8,short/108),short/12);
 const pen=font*.083;
 const layout:RigDimensionLayout={axis:null,dimensions:[],fontSize:font,lineWidth:pen};
 if(!validSize||!axis||!['vertical','horizontal'].includes(axis.orientation)||!normalized(axis.position))return layout;
 const vertical=axis.orientation==='vertical';
 const across=vertical?width:height,along=vertical?height:width;
 const datum=axis.position*across;
 function point(u:number,v:number):Point{
  const a=clamp(u,0,across),b=clamp(v,0,along);
  return vertical?{x:a,y:b}:{x:b,y:a};
 }
 function line(u1:number,v1:number,u2:number,v2:number):Line{
  const a=point(u1,v1),b=point(u2,v2);
  return {x1:a.x,y1:a.y,x2:b.x,y2:b.y};
 }
 layout.axis=line(datum,0,datum,along);
 if(!Number.isFinite(metresPerPixel)||metresPerPixel<=0)return layout;

 const points:MeasuredPoint[]=[];
 for(const [index,p] of marks.entries()){
  if(!normalized(p.x)||!normalized(p.y))continue;
  const u=vertical?p.x*width:p.y*height,v=vertical?p.y*height:p.x*width;
  const mm=Math.round(Math.abs(u-datum)*metresPerPixel*1000);
  if(Number.isSafeInteger(mm))points.push({u,v,index,mm});
 }
 const rows:Row[]=[];
 for(const p of points.sort((a,b)=>a.v-b.v||a.index-b.index)){
  const row=rows[rows.length-1];
  if(row&&p.v-row.min<font*1.8){
   row.max=p.v;
   row.points.push(p);
  }else rows.push({min:p.v,max:p.v,points:[p]});
 }

 // Closest spans occupy the nearest free dimension lines. Two spans on
 // opposite sides may share a line when only their endpoint at the datum meets.
 const margin=font*1.65;
 const laneCount=Math.max(1,Math.floor((along-2*margin)/(1.7*font))+1);
 const step=laneCount>1?(along-2*margin)/(laneCount-1):0;
 const lanes=Array.from({length:laneCount},(_,i)=>({
  v:laneCount===1?along/2:margin+i*step,
  occupied:[] as Interval[],
  nearby:[] as number[]
 }));
 for(const lane of lanes)lane.nearby=points.filter(p=>Math.abs(p.v-lane.v)<font*1.45).map(p=>p.u);
 for(const row of rows){
  const mid=(row.min+row.max)/2;
  const manual=normalized(axis.lane)?axis.lane*along:undefined;
  const left=row.points.filter(p=>p.u<datum).length;
  const room=(Math.max(left,row.points.length-left)+1)*step;
  const side=manual!==undefined?(manual>=mid?1:-1):(along-row.max>=room||along-row.max>=row.min?1:-1);
  const base=manual??(side>0?row.max+font*2.45:row.min-font*2.45);
  const cost=(v:number)=>{
   const outward=(v-base)*side;
   return Math.abs(outward)+(outward < -step*.5?along*2:0);
  };
  const ordered=[...lanes].sort((a,b)=>cost(a.v)-cost(b.v));
  row.points.sort((a,b)=>Math.abs(a.u-datum)-Math.abs(b.u-datum)||a.index-b.index);
  for(const p of row.points){
   const label=p.mm+' mm';
   const halfText=Math.min(across/2,font*.31*label.length+pen);
   const labelU=clamp((p.u+datum)/2,halfText,across-halfText);
   const start=Math.min(datum,p.u,labelU-halfText),end=Math.max(datum,p.u,labelU+halfText);
   let chosen=ordered[0],best=Infinity;
   for(const lane of ordered){
    const conflicts=lane.occupied.reduce((count,item)=>
     count+Number(Math.min(end,item.end)-Math.max(start,item.start)>pen),0);
    const nearby=lane.nearby.some(u=>u>=start-font*.5&&u<=end+font*.5);
    const score=conflicts*3+Number(nearby);
    if(score<best){chosen=lane;best=score;}
    if(score===0)break;
   }
   chosen.occupied.push({start,end});
   const rail=chosen.v,tick=font*.3;
   const overrun=(rail>=p.v?1:-1)*tick;
   const lines=[line(p.u,p.v,p.u,rail+overrun)];
   // A point exactly on the reference still receives an explicit 0 mm callout.
   if(Math.abs(p.u-datum)>pen){
    lines.push(line(datum,rail,p.u,rail),line(p.u-tick,rail+tick,p.u+tick,rail-tick));
   }
   lines.push(line(datum-tick,rail+tick,datum+tick,rail-tick));
   const center=point(labelU,rail-font*.73);
   layout.dimensions.push({index:p.index,mm:p.mm,lines,label:{...center,text:label,angle:vertical?0:-90}});
  }
 }
 layout.dimensions.sort((a,b)=>a.index-b.index);
 return layout;
}

export function drawRigDimensions(ctx:CanvasRenderingContext2D,layout:RigDimensionLayout){
 if(!layout.axis)return;
 const {fontSize,lineWidth}=layout;
 const path=(l:Line)=>{ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);};
 ctx.save();
 ctx.lineWidth=lineWidth;
 ctx.lineJoin='round';
 ctx.strokeStyle=rigDimensionInk;
 ctx.globalAlpha=.55;
 ctx.setLineDash([3*lineWidth,3*lineWidth]);
 ctx.beginPath();path(layout.axis);ctx.stroke();
 ctx.globalAlpha=1;
 ctx.setLineDash([]);
 ctx.beginPath();
 for(const dimension of layout.dimensions)for(const l of dimension.lines)path(l);
 ctx.stroke();
 ctx.font='600 '+fontSize+'px Arial, sans-serif';
 ctx.fillStyle=rigDimensionInk;
 ctx.strokeStyle='rgba(255,255,255,.95)';
 ctx.lineWidth=Math.max(1,fontSize*.25);
 ctx.textAlign='center';
 ctx.textBaseline='middle';
 for(const {label} of layout.dimensions){
  ctx.save();ctx.translate(label.x,label.y);ctx.rotate(label.angle*Math.PI/180);
  ctx.strokeText(label.text,0,0);ctx.fillText(label.text,0,0);ctx.restore();
 }
 ctx.restore();
}
