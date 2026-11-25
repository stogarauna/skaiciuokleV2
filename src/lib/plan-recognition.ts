export type Mark = {x:number;y:number;owner:string;symbol?:'blue'|'red'};
export type Candidate = {id:string;name:string};

export const arenaHash='f0cdac83ffcc17e02449acd6dcdef5e7f86a964195230df091632ac00b5d3842';
export function arenaExample(){
 const rows:[string,number[][]][]=[
  ['Pagrindinis ekranas',[889,928,968,1007,1047,1086,1125,1165].map(x=>[x,109])],
  ['Viršutinis centrinis',[[986,286],[1068,286]]],
  ['Vertikalus kairysis',[[781,164],[878,109]]],
  ['Vertikalus dešinysis',[[1176,109],[1272,164]]],
  ['Scenos kairysis',[[686,170],[774,170]]],
  ['Scenos dešinysis',[[1280,170],[1368,170]]],
  ['Salės kairysis',[[686,1092],[774,1092]]],
  ['Salės dešinysis',[[1280,1092],[1368,1092]]]
 ];
 return {screens:rows.map(([name],i)=>({id:String(i),name})),
  marks:rows.flatMap(([,points],i)=>points.map(([x,y])=>({x:x/2048,y:y/1448,owner:String(i)})))};
}

// Connected colour regions. Inputs are downsampled before scanning to bound memory use.
export function regions(data:Uint8ClampedArray,w:number,h:number,kind:'screen'|'point'){
 const mask=new Uint8Array(w*h),stack=new Int32Array(w*h);
 for(let i=0;i<mask.length;i++){
  const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
  mask[i]=Number(kind==='screen'?b>150&&b>r+85&&g>r+45&&b>g+25:r>110&&g>85&&Math.min(r,g)>b+43);
 }
 const found:{x:number;y:number}[]=[];
 for(let i=0;i<mask.length;i++){
  if(!mask[i])continue;
  let n=1,count=0,x0=w,y0=h,x1=0,y1=0;stack[0]=i;mask[i]=0;
  while(n){
   const p=stack[--n],x=p%w,y=Math.floor(p/w);
   count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,k=yy*w+xx;
    if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[k]){mask[k]=0;stack[n++]=k;}
   }
  }
  const width=x1-x0+1,height=y1-y0+1;
  if(kind==='screen'){
   if(count<w*h*.0007||count/(width*height)<.65||width/height>5||height/width>5)continue;
  }else if(count<2||width>24||height>24)continue;
  found.push({x:(x0+x1+1)/(2*w),y:(y0+y1+1)/(2*h)});
 }
 if(kind==='screen')return found.slice(0,50);
 const merged:typeof found=[];
 for(const p of found){
  const match=merged.find(q=>Math.hypot((q.x-p.x)*w,(q.y-p.y)*h)<6);
  if(match){match.x=(p.x+match.x)/2;match.y=(p.y+match.y)/2;}else merged.push(p);
  if(merged.length>=500)break;
 }
 return merged;
}
