type Box = {left:number; top:number; right:number; bottom:number};
export type ScreenRegion = {x:number; y:number; bounds:Box; bands?:Box[]};

// Close narrow dark ruling between adjacent pale printed panel cells.
function bridgeGrid(mask:Uint8Array, width:number, height:number) {
 const gap=Math.max(1,Math.round(Math.max(width,height)/500));
 for(let y=0;y<height;y++){
  let last=-1;
  for(let x=0;x<width;x++)if(mask[y*width+x]){
   if(last>=0&&x-last<=gap+1)mask.fill(1,y*width+last+1,y*width+x);
   last=x;
  }
 }
 for(let x=0;x<width;x++){
  let last=-1;
  for(let y=0;y<height;y++)if(mask[y*width+x]){
   if(last>=0&&y-last<=gap+1)for(let row=last+1;row<y;row++)mask[row*width+x]=1;
   last=y;
  }
 }
}

// Recover long runs of rows with matching left and right edges. Reject noisy
// silhouettes and hollow outlines rather than turning them into filled panels.
function orthogonalBands(queue:Int32Array, count:number, stride:number, box:Box): Box[] | undefined {
 const width=box.right-box.left,height=box.bottom-box.top;
 const starts=new Int32Array(height).fill(width),ends=new Int32Array(height);
 for(let i=0;i<count;i++){
  const p=queue[i],y=Math.floor(p/stride)-box.top,x=p%stride-box.left;
  starts[y]=Math.min(starts[y],x);ends[y]=Math.max(ends[y],x+1);
 }
 const tolerance=Math.max(1,Math.round(width*.006)),minBand=Math.max(3,Math.ceil(height*.02));
 const stable:Box[]=[];
 let start=0;
 for(let y=1;y<=height;y++){
  if(y<height&&Math.abs(starts[y]-starts[start])<=tolerance&&Math.abs(ends[y]-ends[start])<=tolerance)continue;
  if(y-start>=minBand){
   // Use an interior row to avoid antialiasing at a step.
   const middle=Math.floor((start+y)/2);
   stable.push({top:start,bottom:y,left:starts[middle],right:ends[middle]});
  }
  start=y;
 }
 if(stable.length<2||stable.length>24)return;
 const maxGap=Math.max(2,Math.ceil(height*.01));
 const bands:Box[]=[];
 for(const segment of stable){
  const previous=bands.at(-1);
  if(segment.top-(previous?.bottom??0)>maxGap)return;
  if(previous){
   const seam=Math.round((previous.bottom+segment.top)/2);
   previous.bottom=seam;
   if(Math.abs(segment.left-previous.left)<=tolerance&&Math.abs(segment.right-previous.right)<=tolerance){
    previous.bottom=segment.bottom;continue;
   }
   segment.top=seam;
  }else segment.top=0;
  bands.push(segment);
 }
 if(bands.length<2||height-bands[bands.length-1].bottom>maxGap)return;
 bands[bands.length-1].bottom=height;
 let area=0;
 for(const band of bands){
  if(band.left<=tolerance)band.left=0;
  if(band.right>=width-tolerance)band.right=width;
  area+=(band.right-band.left)*(band.bottom-band.top);
 }
 if(area>width*height*.96 || count<area*.90 || count>area*1.06)return;
 return bands.map(b=>({left:b.left/width,top:b.top/height,right:b.right/width,bottom:b.bottom/height}));
}

function extract(mask:Uint8Array,w:number,h:number,queue:Int32Array,regions:ScreenRegion[]) {
 const minArea=Math.ceil(w*h*.0007);
 for(let i=0;i<mask.length;i++){
  if(!mask[i])continue;
  let size=1,left=w,right=0,top=h,bottom=0;
  mask[i]=0;queue[0]=i;
  for(let head=0;head<size;head++){
   const p=queue[head],x=p%w,y=Math.floor(p/w);
   left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
    const k=yy*w+xx;
    if(mask[k]){mask[k]=0;queue[size++]=k;}
   }
  }
  const width=right-left,height=bottom-top,fill=size/(width*height);
  if(size<minArea||width>5*height||height>5*width||fill<.10)continue;
  const bands=fill<.96?orthogonalBands(queue,size,w,{left,top,right,bottom}):undefined;
  if(!bands&&fill<.65)continue;
  let cx=.5,cy=.5;
  if(bands&&!bands.some(b=>b.top<=cy&&b.bottom>=cy&&b.left<=cx&&b.right>=cx)){
   const largest=bands.reduce((best,b)=>(b.bottom-b.top)*(b.right-b.left)>(best.bottom-best.top)*(best.right-best.left)?b:best);
   cx=(largest.left+largest.right)/2;cy=(largest.top+largest.bottom)/2;
  }
  regions.push({x:(left+cx*width)/w,y:(top+cy*height)/h,
   bounds:{left:left/w,right:right/w,top:top/h,bottom:bottom/h},...(bands?{bands}:{})});
  if(regions.length>=50)return;
 }
}

export function screenRegions(data:Uint8ClampedArray,w:number,h:number):ScreenRegion[] {
 const blue=new Uint8Array(w*h);
 let green:Uint8Array|undefined,white=0;
 for(let p=0;p<blue.length;p++){
  const r=data[p*4],g=data[p*4+1],b=data[p*4+2];
  if(b>150&&b>r+85&&g>r+45&&b>g+25)blue[p]=1;
  else if(g>175&&r>110&&g-r>15&&g-r<85&&g-b>11&&b>=r){
   green??=new Uint8Array(w*h);green[p]=1;
  }
  if(Math.min(r,g,b)>235&&Math.max(r,g,b)-Math.min(r,g,b)<15)white++;
 }
 const found:ScreenRegion[]=[],queue=new Int32Array(w*h);
 extract(blue,w,h,queue,found);
 // Pale green on white is used in printed elevations. Rendered stage photos
 // can also contain green lights and seating, so do not merge those colours.
 if(green&&white>w*h*.45&&found.length<50){
  bridgeGrid(green,w,h);extract(green,w,h,queue,found);
 }
 return found;
}
