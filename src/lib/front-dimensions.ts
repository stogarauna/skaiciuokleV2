import {glyphScores} from './plan-scale-labels.ts';
import type {ScreenRegion} from './screen-regions.ts';

type Glyph = {left:number;right:number;top:number;bottom:number};

// Only inspect black text immediately above a dimension line with endpoints on
// the outline. Using a local window keeps unrelated numbers out of the reading.
function caption(gray:Uint8Array, width:number, mid:number, lineY:number, halfWidth:number, depth:number) {
 const x0=Math.max(1,Math.floor(mid-halfWidth)), x1=Math.min(width-2,Math.ceil(mid+halfWidth));
 const y0=Math.max(1,lineY-depth), y1=lineY-2;
 if(x1<=x0||y1<=y0)return;
 const stride=x1-x0+1, count=stride*(y1-y0+1);
 const visited=new Uint8Array(count), stack=new Int32Array(count);
 const glyphs:Glyph[]=[];
 for(let seed=0;seed<count;seed++){
  const sx=seed%stride+x0,sy=Math.floor(seed/stride)+y0;
  if(visited[seed]||gray[sy*width+sx]>=150)continue;
  let n=1,left=sx,right=sx,top=sy,bottom=sy;
  visited[seed]=1;stack[0]=seed;
  while(n){
   const p=stack[--n],x=p%stride+x0,y=Math.floor(p/stride)+y0;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let yy=Math.max(y0,y-1);yy<=Math.min(y1,y+1);yy++){
    for(let xx=Math.max(x0,x-1);xx<=Math.min(x1,x+1);xx++){
     const q=(yy-y0)*stride+xx-x0;
     if(!visited[q]&&gray[yy*width+xx]<150){visited[q]=1;stack[n++]=q;}
    }
   }
  }
  glyphs.push({left,right,top,bottom});
 }
 const candidates=glyphs.filter(g=>{
  const h=g.bottom-g.top+1,w=g.right-g.left+1;
  return h>=7&&h<=depth*.75&&w>=h*.22&&w<=h*.99&&lineY-g.bottom<=h*2.4;
 });
 for(const first of candidates){
  const h=first.bottom-first.top+1;
  const sameRow=candidates.filter(g=>Math.abs(g.top-first.top)<=h*.16&&Math.abs(g.bottom-first.bottom)<=h*.16)
   .sort((a,b)=>a.left-b.left);
  if(sameRow.length<4||sameRow.length>5)continue;
  const last=sameRow[sameRow.length-1],start=sameRow[0];
  if(Math.abs((start.left+last.right)/2-mid)>Math.max(2,h*.3))continue;
  if(sameRow.some((g,i)=>i>0&&(g.left<=sameRow[i-1].right||g.left-sameRow[i-1].right-1>h*.5)))continue;
  // Reject a decimal point, comma or unit attached to this number.
  if(glyphs.some(g=>!sameRow.includes(g)&&g.right>=start.left-h*.65&&g.left<=last.right+h*.65&&
    g.top<=first.bottom+2&&g.bottom>=first.top+2))continue;
  let digits='',sum=0;
  for(const g of sameRow){
   const [best,next]=glyphScores(gray,width,{first:g.left,last:g.right},{first:g.top,last:g.bottom});
   if(!/^\d$/.test(best.letter)||best.score<.60||best.score-next.score<.04)break;
   digits+=best.letter;sum+=best.score;
  }
  if(digits.length===sameRow.length&&sum/digits.length>.76&&digits[0]!=='0')return Number(digits);
 }
}

function hasExtension(gray:Uint8Array,w:number,h:number,x:number,y:number,radius:number) {
 for(let xx=Math.max(0,Math.round(x)-2);xx<=Math.min(w-1,Math.round(x)+2);xx++){
  let up=0,down=0;
  for(let k=2;k<=radius;k++){
   if(y>=k&&gray[(y-k)*w+xx]<248)up++;
   if(y+k<h&&gray[(y+k)*w+xx]<248)down++;
  }
  if(Math.max(up,down)>=(radius-1)*.76)return true;
 }
 return false;
}

// CAD elevations commonly label unqualified four/five-digit dimensions in mm.
// Require multiple *different* dimension values to independently establish the
// same scale. Duplicate values on mirrored wings alone cannot calibrate a page.
export function detectFrontScale(data:Uint8ClampedArray,width:number,height:number,regions:ScreenRegion[]):number|undefined {
 if(!regions.length||width<100||height<40||data.length!==4*width*height)return;
 const gray=new Uint8Array(width*height);
 for(let i=0;i<gray.length;i++){
  const p=i*4,light=(data[p]*77+data[p+1]*150+data[p+2]*29)>>8;
  gray[i]=255-Math.round((255-light)*data[p+3]/255);
 }
 const readings:{mm:number;pixels:number}[]=[];
 const longest=Math.max(width,height),depth=Math.max(25,Math.round(longest*.019));
 for(const region of regions){
  const b=region.bounds, widthPx=(b.right-b.left)*width;
  const pairs:[number,number][]=[[0,1]];
  for(const band of region.bands??[]){
   pairs.push([band.left,band.right],[0,band.left],[band.right,1]);
  }
  const spans=new Set<string>();
  for(const [lo,hi] of pairs){
   const left=Math.round(b.left*width+lo*widthPx),right=Math.round(b.left*width+hi*widthPx);
   const len=right-left,key=left+':'+right;
   if(len<35||spans.has(key)||spans.size>=24)continue;
   spans.add(key);
   const mid=(left+right)/2,half=Math.min(len*.45,depth*1.55);
   const margin=longest*.11;
   const top=Math.max(2,Math.floor(b.top*height-margin)),bottom=Math.min(height-2,Math.ceil(b.bottom*height+margin));
   let previousLine=false;
   for(let y=top;y<=bottom;y++){
    let hits=0;
    for(let i=0;i<17;i++)if(gray[y*width+Math.round(left+(i+.5)*len/17)]<247)hits++;
    const line=hits>=16;
    if(line&&!previousLine&&hasExtension(gray,width,height,left,y,7)&&hasExtension(gray,width,height,right,y,7)){
     const mm=caption(gray,width,mid,y,half,depth);
     if(mm)readings.push({mm,pixels:len});
    }
    previousLine=line;
   }
  }
 }
 if(new Set(readings.map(r=>r.mm)).size<2)return;
 const total=readings.reduce((a,b)=>({mm:a.mm+b.mm,pixels:a.pixels+b.pixels}),{mm:0,pixels:0});
 const scale=total.mm/total.pixels;
 if(readings.some(r=>Math.abs(r.mm/r.pixels-scale)>scale*.025))return;
 return scale/1000;
}
