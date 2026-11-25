import type {Panel,Screen} from './project.ts';
import type {SignalSettings} from './signal.ts';

export type PanelPair={small:Panel;large:Panel};
export type MixedPanels={large:Panel;anchors:string[]};
export type Cabinet={c:number;r:number;span:1|2;panel:Panel;number:number};

const key=(c:number,r:number)=>c+','+r;
const near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
function family(panel:Panel){
 if(typeof panel.mixedFamily==='string'&&panel.mixedFamily.trim())return panel.mixedFamily.trim().toLowerCase();
 // The catalog has both legacy and Rentman display names for this family.
 if(/^(?:P3\s*\/\s*7\s+)?Transparent\s*(?:\(|\d)/i.test(panel.name))return 'p3/7 transparent';
 return undefined;
}

function paired(small:Panel,large:Panel){
 return !!family(small)&&family(small)===family(large)&&small.name!==large.name
  &&near(large.widthM,small.widthM*2)&&near(large.heightM,small.heightM)
  &&large.resX===small.resX*2&&large.resY===small.resY;
}
export function compatiblePair(panel:Panel,catalog:Panel[]):PanelPair|undefined{
 for(const other of catalog){
  if(paired(panel,other))return {small:panel,large:other};
  if(paired(other,panel))return {small:other,large:panel};
 }
}

export function cabinetPositions(screen:Screen):Cabinet[]{
 const cabinets:Cabinet[]=[],removed=new Set(screen.removed),wide=new Set(screen.mixed?.anchors);
 for(let r=0;r<screen.rows;r++){
  for(let c=0;c<screen.cols;c++){
   const id=key(c,r);
   if(removed.has(id))continue;
   const span=wide.has(id)?2:1;
   cabinets.push({c,r,span,panel:span===2?screen.mixed!.large:screen.panel,
    number:screen.mixed?cabinets.length+1:r*screen.cols+c+1});
   c+=span-1;
  }
 }
 return cabinets;
}
export function cabinetCounts(screen:Screen,occupiedSlots?:number):{panel:Panel;count:number}[]{
 const wide=screen.mixed?.anchors.length??0;
 const narrow=occupiedSlots===undefined
  ?cabinetPositions(screen).length-wide
  :occupiedSlots-2*wide;
 const counts=narrow>0?[{panel:screen.panel,count:narrow}]:[];
 if(screen.mixed&&wide)counts.push({panel:screen.mixed.large,count:wide});
 return counts;
}

function legalAnchor(c:number,r:number,s:Screen,blocked:Set<string>){
 return Number.isInteger(c)&&Number.isInteger(r)&&c>=0&&c+1<s.cols&&r>=0&&r<s.rows
  &&!blocked.has(key(c,r))&&!blocked.has(key(c+1,r));
}
function usableAnchors(screen:Screen,anchors:string[]){
 const blocked=new Set(screen.removed),out:string[]=[];
 for(const id of anchors){
  if(typeof id!=='string'||!/^\d+,\d+$/.test(id))continue;
  const [c,r]=id.split(',').map(Number);
  if(id!==key(c,r)||!legalAnchor(c,r,screen,blocked))continue;
  out.push(id);blocked.add(id);blocked.add(key(c+1,r));
 }
 return out;
}

export function validMixed(screen:Screen,validPanel:(p:Panel)=>boolean):boolean{
 const mix=screen.mixed;
 if(mix===undefined)return true;
 return !!mix&&!!mix.large&&validPanel(mix.large)&&paired(screen.panel,mix.large)&&Array.isArray(mix.anchors)
  &&mix.anchors.length<=screen.cols*screen.rows/2&&usableAnchors(screen,mix.anchors).length===mix.anchors.length;
}
export function reconcileMixed(screen:Screen):Screen{
 if(!screen.mixed)return screen;
 const anchors=usableAnchors(screen,screen.mixed.anchors);
 return anchors.length===screen.mixed.anchors.length?screen:{...screen,mixed:{...screen.mixed,anchors}};
}

function doubledPart(key:string){
 const [c,r,w,h]=key.split(',').map(Number);return [c*2,r,w*2,h].join(',');
}
function doubleSignal(signal:SignalSettings):SignalSettings{
 const next={...signal};
 if(signal.manualRoutes)next.manualRoutes=Object.fromEntries(Object.entries(signal.manualRoutes).map(([part,routes])=>
  [doubledPart(part),routes.map(route=>route.map(cell=>({...cell,c:cell.c*2}))) ]));
 if(signal.output?.positions)next.output={...signal.output,positions:Object.fromEntries(
  Object.entries(signal.output.positions).map(([part,p])=>[doubledPart(part),{
   x:Math.max(-10000,Math.min(10000,p.x*2)),y:Math.max(-10000,Math.min(10000,p.y*2))}]))};
 return next;
}

export function enableMixed(screen:Screen,pair:PanelPair):Screen{
 if(!paired(pair.small,pair.large)||![pair.small.name,pair.large.name].includes(screen.panel.name))
  throw Error('Šių panelių negalima derinti viename ekrane.');
 if(screen.mixed)return screen;
 const wide=screen.panel.name===pair.large.name,cols=screen.cols*(wide?2:1);
 if(cols>100||cols*screen.rows>5000)throw Error('Mišrių panelių išdėstymas viršija projekto tinklelio ribas.');
 const base:Screen={...screen,panel:structuredClone(pair.small),cols,mixed:{large:structuredClone(pair.large),anchors:[]}};
 if(wide){
  base.removed=screen.removed.flatMap(id=>{const [c,r]=id.split(',').map(Number);return [key(c*2,r),key(c*2+1,r)];});
  base.mixed!.anchors=cabinetPositions(screen).map(({c,r})=>key(c*2,r));
  if(screen.signal)base.signal=doubleSignal(screen.signal);
  return base;
 }
 // Keep existing manual circuits physically intact when switching an old small-panel screen.
 return Object.values(screen.signal?.manualRoutes??{}).some(routes=>routes.length)?base:autoPlaceMixed(base);
}

// Translate saved port paths when a physical housing is split or merged. An existing
// port's connection can move to a new anchor, but two ports cannot share one housing.
function changeAnchors(screen:Screen,anchors:string[]):Screen{
 if(!screen.mixed)return screen;
 const next:Screen={...screen,mixed:{...screen.mixed,anchors}};
 const routes=screen.signal?.manualRoutes;
 if(!routes||!Object.keys(routes).length)return next;
 const oldWide=new Set(screen.mixed.anchors),newWide=new Set(anchors);
 const adjusted:NonNullable<SignalSettings['manualRoutes']>={};
 for(const [part,lines] of Object.entries(routes)){
  const [left,top,width]=part.split(',').map(Number);
  const owners=new Map<string,number>();
  adjusted[part]=lines.map((line,index)=>{
   const edited:{c:number;r:number}[]=[];
   for(const cell of line){
    const x=cell.c+left,y=cell.r+top,span=oldWide.has(key(x,y))?2:1;
    for(let offset=0;offset<span;offset++){
     const col=x+offset,anchor=newWide.has(key(col-1,y))?col-1:col,id=key(anchor,y);
     if(anchor<left||anchor+(newWide.has(id)?2:1)>left+width)
      throw Error('Panelė kirstų rankinės signalo komutacijos dalies ribą.');
     const owner=owners.get(id);
     if(owner!==undefined){
      if(owner!==index)throw Error('Šios panelės priskirtos skirtingiems signalo portams.');
      continue;
     }
     owners.set(id,index);edited.push({c:anchor-left,r:cell.r});
    }
   }
   return edited;
  });
 }
 return {...next,signal:{...screen.signal!,manualRoutes:adjusted}};
}

export function autoPlaceMixed(screen:Screen):Screen{
 if(!screen.mixed)return screen;
 const removed=new Set(screen.removed);
 // Keep cabinet alignment through profile changes. For a cross the stem retains
 // full cabinets throughout; an odd half-width in each wing falls at its outside tip.
 const profile=Array.from({length:screen.cols},(_,c)=>
  Array.from({length:screen.rows},(_,r)=>removed.has(key(c,r))?'0':'1').join(''));
 const anchors:string[]=[];
 for(let r=0;r<screen.rows;r++){
  let c=0;
  while(c<screen.cols){
   if(removed.has(key(c,r))){c++;continue;}
   const start=c;
   while(c<screen.cols&&!removed.has(key(c,r)))c++;
   const end=c;
   let from=start;
   while(from<end){
    let to=from+1;
    while(to<end&&profile[to]===profile[from])to++;
    const shortAtLeft=(to-from)%2===1&&from+to<start+end;
    for(let x=from+(shortAtLeft?1:0);x+1<to;x+=2)anchors.push(key(x,r));
    from=to;
   }
  }
 }
 return changeAnchors(screen,anchors);
}
export function mergeCabinets(screen:Screen,c:number,r:number):Screen{
 if(!screen.mixed||!legalAnchor(c,r,screen,new Set(screen.removed)))return screen;
 const active=new Set(screen.mixed.anchors);
 if([-1,0,1].some(dx=>active.has(key(c+dx,r))))return screen;
 return changeAnchors(screen,[...screen.mixed.anchors,key(c,r)]);
}
export function splitCabinet(screen:Screen,c:number,r:number):Screen{
 if(!screen.mixed)return screen;
 const anchor=[key(c,r),key(c-1,r)].find(id=>screen.mixed!.anchors.includes(id));
 return anchor?changeAnchors(screen,screen.mixed.anchors.filter(id=>id!==anchor)):screen;
}

export function disableMixed(screen:Screen):Screen{
 if(!screen.mixed)return screen;
 const {mixed,...plain}=changeAnchors(screen,[]);
 return plain;
}
