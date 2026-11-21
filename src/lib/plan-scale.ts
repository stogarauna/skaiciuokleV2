import {metricRulerLabels} from './plan-scale-labels.ts';

type Stroke = {left:number; right:number};
type Bar = {left:number; right:number; top:number; bottom:number};
export type PlanScale = {start:{x:number;y:number};end:{x:number;y:number};metres:number};

// The Vectorworks graphic ruler has three strokes along its top and two between
// them along its bottom. Its thin antialiased lines may be nearly white in a JPG.
const paper = 247;

function grayOnWhite(rgba:Uint8ClampedArray) {
 const gray=new Uint8Array(rgba.length/4);
 for(let i=0;i<gray.length;i++){
  const p=i*4;
  const luminance=(77*rgba[p]+150*rgba[p+1]+29*rgba[p+2])>>8;
  gray[i]=255-Math.round((255-luminance)*rgba[p+3]/255);
 }
 return gray;
}

function upperStrokes(gray:Uint8Array,width:number,y:number) {
 const runs:Stroke[]=[];
 const offset=y*width;
 let start=0;
 for(let x=0;x<=width;x++){
  if(x<width&&gray[offset+x]<paper)continue;
  if(x-start>=10)runs.push({left:start,right:x-1});
  start=x+1;
 }
 return runs;
}

function readBar(gray:Uint8Array,width:number,height:number,y:number,a:Stroke,b:Stroke,c:Stroke):Bar|undefined {
 const step=(c.right-a.left)/5;
 const tolerance=Math.max(2,step*0.09);
 const guide=[a.left,a.right,b.left,b.right,c.left,c.right];
 if(step<10||guide.some((x,i)=>Math.abs(x-a.left-i*step)>tolerance))return;
 // Reject solid rectangular grids: at the lower edge only spans 2 and 4 are inked.
 let bottom=0;
 for(let row=y+Math.max(5,Math.round(step*0.35));row<Math.min(height,y+step*3);row++){
  let matches=true;
  for(let cell=0;cell<5&&matches;cell++){
   for(const fraction of [0.25,0.5,0.75]){
    const x=Math.round(a.left+(cell+fraction)*step);
    if((gray[row*width+x]<paper)!==(cell%2===1)){matches=false;break;}
   }
  }
  if(matches){bottom=row;break;}
 }
 if(!bottom)return;
 // Refine each tick by the centre of its vertical stroke, independent of line thickness.
 const radius=Math.max(2,Math.round(step*0.08));
 const pad=Math.max(1,Math.round((bottom-y)*0.15));
 const first=y+pad,last=bottom-pad;
 const ticks:number[]=[];
 for(const x of guide){
  let total=0,moment=0,bestCoverage=0;
  for(let col=Math.max(0,x-radius);col<=Math.min(width-1,x+radius);col++){
   let weight=0,coverage=0;
   for(let row=first;row<=last;row++){
    const ink=Math.max(0,paper-gray[row*width+col]);
    weight+=ink;
    if(ink>0)coverage++;
   }
   total+=weight;
   moment+=weight*col;
   bestCoverage=Math.max(bestCoverage,coverage);
  }
  if(!total||bestCoverage<(last-first+1)*0.8)return;
  ticks.push(moment/total);
 }
 const spacing=(ticks[5]-ticks[0])/5;
 if(ticks.some((x,i)=>Math.abs(x-ticks[0]-i*spacing)>Math.max(1,spacing*0.04)))return;
 return {left:ticks[0],right:ticks[5],top:y,bottom};
}

/** Read a labelled 0–5 m stepped graphic ruler from an upright raster plan.
 * Coordinates refer to the full image, even when the caller sampled a smaller copy.
 * Other markings and conflicting scales intentionally leave calibration to the user.
 */
export function detectPlanScale(data:Uint8ClampedArray,width:number,height:number):PlanScale|undefined {
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<60||height<15||data.length!==4*width*height)return;
 const gray=grayOnWhite(data);
 let found:Bar|undefined;
 for(let y=1;y<height-5;y++){
  const runs=upperStrokes(gray,width,y);
  for(let i=2;i<runs.length;i++){
   const bar=readBar(gray,width,height,y,runs[i-2],runs[i-1],runs[i]);
   if(!bar)continue;
   if(found&&Math.abs(bar.left-found.left)<2&&Math.abs(bar.top-found.top)<3)continue;
   const length=bar.right-bar.left;
   if(!metricRulerLabels(gray,width,height,bar.left,bar.top,length/5))continue;
   if(found&&Math.abs(length-(found.right-found.left))>Math.max(1,length*0.01))return;
   found=bar;
  }
 }
 if(!found)return;
 const y=(found.top+found.bottom+1)/(2*height);
 return {start:{x:(found.left+0.5)/width,y},end:{x:(found.right+0.5)/width,y},metres:5};
}
