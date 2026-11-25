import type {Screen} from './project.ts';
import {cabinetPositions} from './mixed-panels.ts';
import {defaultSignalSettings, signalPartKey, signalPlan} from './signal.ts';

export interface SignalOutputPart {
 number: number;
 column: number;
 row: number;
 width: number;
 height: number;
 screen: Screen;
 plan: ReturnType<typeof signalPlan>;
}

function spans(length: number, count: number, capacity: number) {
 const spans: {start: number; size: number}[] = [];
 // Use full output spans when using the minimum number of parts.
 const fillToLimit = count === Math.ceil(length / capacity);
 const base = Math.floor(length / count);
 const remainder = length % count;
 let start = 0;
 for (let i = 0; i < count; i++) {
  const size = fillToLimit ? Math.min(capacity, length - start) : base + Number(i < remainder);
  spans.push({start, size});
  start += size;
 }
 return spans;
}

type Span = {start:number; size:number};

// A vertical cut may only land between physical cabinets. If rows are
// staggered, different row bands may need different cuts.
function cabinetSpans(length:number, capacity:number, blocked:Set<number>, requested?:number):Span[]|undefined {
 const cuts=Array.from({length:length+1},(_,c)=>c).filter(c=>!blocked.has(c));
 const last=cuts.length-1,unit=cuts[1];
 if(cuts.every((cut,index)=>cut===index*unit)){
  const unitsPerPart=Math.floor(capacity/unit);
  if(!unitsPerPart)return;
  const minimum=Math.ceil(last/unitsPerPart),count=requested??minimum;
  if(count<minimum||count>last)return;
  return spans(last,count,unitsPerPart).map(({start,size})=>({start:start*unit,size:size*unit}));
 }
 const minimum=new Array<number>(cuts.length).fill(Infinity);
 minimum[last]=0;
 for(let i=last-1;i>=0;i--){
  for(let j=i+1;j<=last && cuts[j]-cuts[i]<=capacity;j++)
   minimum[i]=Math.min(minimum[i],1+minimum[j]);
 }
 const count=requested??minimum[0];
 if(!Number.isFinite(count)||count<minimum[0]||count>last)return;
 const out:Span[]=[];
 let i=0;
 for(let n=0;n<count;n++){
  const remaining=count-n-1;
  const target=count===minimum[0]?cuts[i]+capacity:(n+1)*length/count;
  let best=-1;
  for(let j=i+1;j<=last && cuts[j]-cuts[i]<=capacity;j++){
   if(minimum[j]>remaining||last-j<remaining)continue;
   if(best<0||Math.abs(cuts[j]-target)<Math.abs(cuts[best]-target))best=j;
  }
  if(best<0)return;
  out.push({start:cuts[i],size:cuts[best]-cuts[i]});
  i=best;
 }
 return out;
}

function mixedSections(screen:Screen, maxCols:number, maxRows:number, across?:number) {
 const blocked=Array.from({length:screen.rows},()=>new Set<number>());
 for(const key of screen.mixed!.anchors){
  const [c,r]=key.split(',').map(Number);
  blocked[r].add(c+1);
 }
 const perRow=blocked.map(cuts=>cabinetSpans(screen.cols,maxCols,cuts));
 const minAcross=Math.max(...perRow.map(spans=>spans?.length??0));
 const bands:{row:Span;columns:Span[]}[]=[];
 if(perRow.some(spans=>!spans))return {bands,minAcross,issue:'Į išvesties plotį netelpa plačioji panelė.'};
 for(let r=0;r<screen.rows;){
  let cuts=new Set(blocked[r]);
  let columns=cabinetSpans(screen.cols,maxCols,cuts,across);
  if(!columns)return {bands:[],minAcross,issue:'Pasirinktas dalių skaičius kirstų fizinę panelę. Pakeiskite dalių skaičių arba išvesties plotį.'};
  let end=r+1;
  while(end<screen.rows && end-r<maxRows){
   const combined=new Set([...cuts,...blocked[end]]);
   const next=cabinetSpans(screen.cols,maxCols,combined,across);
   if(!next)break;
   cuts=combined;columns=next;end++;
  }
  bands.push({row:{start:r,size:end-r},columns});r=end;
 }
 return {bands,minAcross,issue:null};
}

export function signalOutputs(screen: Screen, settings = screen.signal ?? defaultSignalSettings) {
 const parts: SignalOutputPart[] = [];
 const {resX, resY, widthM, heightM} = screen.panel;
 const output = settings.output;
 if (!output) {
  parts.push({
   number: 1, column: 0, row: 0, width: screen.cols * resX, height: screen.rows * resY,
   screen, plan: signalPlan(screen, settings)
  });
  return {parts, issue: null, minAcross: 1};
 }

 const maxCols = Math.floor(output.width / resX);
 const maxRows = Math.floor(output.height / resY);
 if (maxCols === 0 || maxRows === 0) {
  return {parts, issue: `Į pasirinktą raišką netelpa viena ${resX} × ${resY} px panelė.`, minAcross: 0};
 }
 const mixed=screen.mixed?mixedSections(screen,maxCols,maxRows,output.partsAcross):null;
 const minAcross = mixed?.minAcross??Math.ceil(screen.cols / maxCols);
 if(mixed?.issue)return {parts,minAcross,issue:mixed.issue};
 const across = output.partsAcross ?? minAcross;
 if (across < minAcross || across > screen.cols) {
  return {
   parts, minAcross,
   issue: across < minAcross
    ? `Į ${output.width} × ${output.height} px telpa iki ${maxCols} stulp. vienoje dalyje. Pasirinkite bent ${minAcross} dalis per plotį.`
    : `Ekranas turi ${screen.cols} stulp. Pasirinkite iki ${screen.cols} dalių per plotį.`
  };
 }

 const removed = new Set(screen.removed);
 const wide = new Set(screen.mixed?.anchors);
 const columns = spans(screen.cols, across, maxCols);
 const rows = spans(screen.rows, Math.ceil(screen.rows / maxRows), maxRows);
 let portOffset = 0;
 const bands=mixed?.bands??rows.map(row=>({row,columns}));
 for (const {row:{start:row,size:height},columns:acrossBand} of bands) {
  for (const {start: column, size: width} of acrossBand) {
   const removedInPart: string[] = [], wideInPart:string[]=[];
   for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
     const key=`${column+c},${row+r}`;
     if (removed.has(key)) removedInPart.push(`${c},${r}`);
     if (wide.has(key)) wideInPart.push(`${c},${r}`);
    }
   }
   const part: Screen = {
    ...screen, cols: width, rows: height, removed: removedInPart,
    x: screen.x + column * widthM, y: screen.y + row * heightM, signal: settings
   };
   if(screen.mixed)part.mixed={large:screen.mixed.large,anchors:wideInPart};
   const plan = signalPlan(part, settings, signalPartKey({column, row, screen: part}));
   const ports = plan.ports.map(port => ({...port, number: port.number + portOffset}));
   portOffset += ports.length;
   parts.push({
    number: parts.length + 1, column, row, width: width * resX, height: height * resY,
    screen: part, plan: {...plan, ports}
   });
  }
 }
 return {parts, issue: null, minAcross};
}

type NumberingScreen = Pick<Screen,'cols'> & Partial<Screen>;
const numberingCache = new WeakMap<Screen, {layout:Screen['mixed']; removed:string[]; cols:number; rows:number; numbers:Map<string,number>}>();
export function physicalPanelNumber(screen: NumberingScreen, part: Pick<SignalOutputPart, 'column' | 'row'>, cell: {c: number; r: number}) {
 const r=part.row+cell.r,c=part.column+cell.c;
 if(screen.mixed){
  const original=screen as Screen;
  let cached=numberingCache.get(original);
  if(!cached||cached.layout!==original.mixed||cached.removed!==original.removed||cached.cols!==original.cols||cached.rows!==original.rows){
   const numbers=new Map(cabinetPositions(original).map(p=>[`${p.c},${p.r}`,p.number]));
   cached={layout:original.mixed,removed:original.removed,cols:original.cols,rows:original.rows,numbers};numberingCache.set(original,cached);
  }
  const number=cached.numbers.get(`${c},${r}`);
  if(number!==undefined)return number;
 }
 return r*screen.cols+c+1;
}

export function signalLineSummary(output: ReturnType<typeof signalOutputs>) {
 let count = 0;
 let unassigned = 0;
 let overloaded = false;
 for (const {plan} of output.parts) {
  count += plan.ports.length;
  unassigned += plan.cells.length;
  for (const port of plan.ports) {
   unassigned -= port.cells.length;
   overloaded ||= port.remaining < 0;
  }
 }
 return {count, backup: count, total: count * 2, unassigned, complete: !output.issue && unassigned === 0 && !overloaded};
}
