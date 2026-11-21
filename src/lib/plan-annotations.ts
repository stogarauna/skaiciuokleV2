type Point = {x:number; y:number};
type Box = {x:number; y:number; width:number; height:number};
type Label = {text:string; center:Point; angle:number; width:number; color:string; box:Box};

export interface DrawingAnnotations {
 marks: (Point & {owner:string})[];
 groups: {name:string; points:Point[]; distances:string[]}[];
 screens: {point:Point; label:string}[];
}

const red='#b32834', teal='#005f66';
const plus=(a:Point,b:Point,factor:number):Point=>({x:a.x+b.x*factor,y:a.y+b.y*factor});
const midpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
function overlap(a:Box,b:Box){
 return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
        Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
}

// Coordinates from the editor are fractions of the original, uncropped image.
export function drawAnnotations(ctx:CanvasRenderingContext2D,w:number,h:number,data:DrawingAnnotations){
 ctx.save();
 const font=Math.max(6,Math.min(w,h)/200),pen=Math.max(.55,font*.085);
 ctx.font='600 '+font+'px Arial, sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineCap='butt';
 const paper:Box={x:0,y:0,width:w,height:h};
 const labels:Label[]=[];
 const lanes:{a:Point;b:Point;axis:Point}[]=[];
 const pixels=(p:Point):Point=>({x:p.x*w,y:p.y*h});
 const pointsToKeepClear=[...data.marks,...data.screens.map(s=>s.point),...data.groups.flatMap(g=>g.points)];
 const keepClear=pointsToKeepClear.map(point=>{
  const p=pixels(point),r=font*.5;
  return {x:p.x-r,y:p.y-r,width:2*r,height:2*r};
 });
 function labelAt(text:string,center:Point,angle:number,width:number,color:string):Label{
  const cs=Math.abs(Math.cos(angle)),sn=Math.abs(Math.sin(angle));
  const bw=cs*(width+3*pen)+sn*(font+3*pen),bh=sn*(width+3*pen)+cs*(font+3*pen);
  return {text,center,angle,width,color,box:{x:center.x-bw/2,y:center.y-bh/2,width:bw,height:bh}};
 }
 function cost(box:Box){
  const outside=Math.max(0,box.width*box.height-overlap(box,paper));
  return outside*10+labels.reduce((total,l)=>total+overlap(box,l.box),0)
        +keepClear.reduce((total,p)=>total+overlap(box,p),0);
 }
 function line(a:Point,b:Point,color:string){
  ctx.strokeStyle=color;ctx.lineWidth=pen;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 function mark(p:Point,color:string){
  ctx.fillStyle=color;ctx.strokeStyle='white';ctx.lineWidth=pen;
  ctx.beginPath();ctx.arc(p.x,p.y,2.1*pen,0,2*Math.PI);ctx.fill();ctx.stroke();
 }
 function crosshair(p:Point){
  const r=Math.max(2,font*.45);
  ctx.beginPath();
  ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x+r,p.y);
  ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);
  ctx.lineWidth=pen*2.7;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.stroke();
  ctx.lineWidth=pen;ctx.strokeStyle=red;ctx.stroke();
 }
 function arrow(tip:Point,inward:Point,normal:Point,length:number){
  const base=plus(tip,inward,length),left=plus(base,normal,length*.32),right=plus(base,normal,-length*.32);
  ctx.fillStyle=red;ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.lineTo(left.x,left.y);ctx.lineTo(right.x,right.y);ctx.closePath();ctx.fill();
 }
 function dimension(start:Point,end:Point,text:string){
  // The same side of a chain stays the preferred side, even if it was picked backwards.
  let a=start,b=end;
  const vertical=Math.abs(b.y-a.y)>Math.abs(b.x-a.x);
  if(vertical?b.y<a.y:b.x<a.x)[a,b]=[b,a];
  const length=Math.hypot(b.x-a.x,b.y-a.y);
  if(length<.01)return;
  const u={x:(b.x-a.x)/length,y:(b.y-a.y)/length},n={x:u.y,y:-u.x};
  const direction=Math.atan2(u.y,u.x);
  const angle=direction>=Math.PI/2?direction-Math.PI:direction;
  const width=ctx.measureText(text).width;
  const arrowSize=Math.min(font*.58,length*.32);
  const gap=width/2+font*.28, fits=!!text&&length>2*(gap+arrowSize);
  function candidate(offset:number){
   const first=plus(a,n,offset),last=plus(b,n,offset),mid=midpoint(first,last);
   const center=fits?mid:plus(mid,n,(Math.sign(offset)||1)*font*.9);
   const proposed=labelAt(text,center,angle,width,red);
   const halfW=proposed.box.width/2,halfH=proposed.box.height/2;
   const inside={x:Math.max(halfW,Math.min(w-halfW,center.x)),y:Math.max(halfH,Math.min(h-halfH,center.y))};
   const shift=Math.hypot(inside.x-center.x,inside.y-center.y);
   const label=labelAt(text,inside,angle,width,red);
   let score=text?cost(label.box)+shift*font:0;
   for(const p of [first,last]){
    score+=font*10*(Math.max(0,-p.x,p.x-w)+Math.max(0,-p.y,p.y-h));
   }
   for(const lane of lanes){
    if(Math.abs(dot(u,lane.axis))<.985)continue;
    if(Math.abs(dot({x:first.x-lane.a.x,y:first.y-lane.a.y},n))>font*.65)continue;
    const x1=dot(lane.a,u),x2=dot(lane.b,u);
    score+=font*Math.max(0,Math.min(dot(last,u),Math.max(x1,x2))-Math.max(dot(first,u),Math.min(x1,x2)));
   }
   return {first,last,mid,label,offset,score,inline:fits&&shift<.01};
  }
  let best=candidate(2.5*font);
  for(const step of [4.4,6.3,8.2,10.1,-2.5,-4.4,-6.3,-8.2,-10.1,0]){
   if(best.score<.01)break;
   const next=candidate(step*font);
   if(next.score<best.score)best=next;
  }
  const {first,last,mid,label,offset}=best;
  const side=Math.sign(offset);
  if(side){
   line(a,plus(first,n,side*pen*3),red);
   line(b,plus(last,n,side*pen*3),red);
  }
  if(best.inline){line(first,plus(mid,u,-gap),red);line(plus(mid,u,gap),last,red);}
  else line(first,last,red);
  arrow(first,u,n,arrowSize);arrow(last,{x:-u.x,y:-u.y},n,arrowSize);
  if(text&&!best.inline){
   const delta={x:mid.x-label.center.x,y:mid.y-label.center.y};
   const extent=Math.max(Math.abs(dot(delta,u))/(width/2+pen),Math.abs(dot(delta,n))/(font*.55+pen));
   if(extent>1)line(mid,plus(label.center,delta,1/extent),red);
  }
  if(text)labels.push(label);
  lanes.push({a:first,b:last,axis:u});
 }
 function callout(p:Point,text:string,color:string,offset:number){
  const width=Math.min(ctx.measureText(text).width,Math.max(1,w-6*pen)),half=width/2;
  let best:Label|undefined,score=Infinity;
  for(const step of [1,-1,2,-2,3,-3,4,-4]){
   for(const side of [1,-1]){
    const center={x:Math.max(half+2*pen,Math.min(w-half-2*pen,p.x+side*(half+offset))),
                  y:Math.max(font*.65,Math.min(h-font*.65,p.y-offset*step))};
    const candidate=labelAt(text,center,0,width,color),rank=cost(candidate.box);
    if(rank<score){best=candidate;score=rank;}
    if(score<.01)break;
   }
   if(score<.01)break;
  }
  if(!best)return;
  // Terminate the leader at the nearest edge of the label.
  const box=best.box;
  const edge={x:Math.max(box.x,Math.min(box.x+box.width,p.x)),y:Math.max(box.y,Math.min(box.y+box.height,p.y))};
  line(p,edge,color);labels.push(best);
 }
 // Reserve the nearest dimension lanes for the shortest spans sharing a baseline.
 const spans=data.groups.flatMap(group=>{
  const points=group.points.map(pixels);
  return points.slice(1).map((b,i)=>{
   const a=points[i];
   return {a,b,text:group.distances[i]??'',length:Math.hypot(b.x-a.x,b.y-a.y)};
  });
 });
 spans.sort((a,b)=>a.length-b.length);
 for(const span of spans)dimension(span.a,span.b,span.text);
 for(const p of data.marks)mark(pixels(p),p.owner?teal:'#a25800');
 for(const screen of data.screens){
  const p=pixels(screen.point);callout(p,screen.label,teal,font*1.65);mark(p,teal);
 }
 for(const group of data.groups){
  group.points.forEach((point,i)=>{
   const p=pixels(point);callout(p,group.name+(i+1),red,font*1.2);
  });
 }
 for(const l of labels){
  ctx.save();ctx.translate(l.center.x,l.center.y);ctx.rotate(l.angle);
  ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=pen*2.6;ctx.strokeText(l.text,0,0,l.width);
  ctx.fillStyle=l.color;ctx.fillText(l.text,0,0,l.width);ctx.restore();
 }
 // Crosshairs are drawn last so their centers remain visible under overlapping leaders.
 for(const group of data.groups)for(const point of group.points)crosshair(pixels(point));
 ctx.restore();
}
