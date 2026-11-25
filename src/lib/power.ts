import type {Screen} from './project.ts';
import {cabinetPositions} from './mixed-panels.ts';
import {routeBounds, type Cell, type PanelRoute} from './signal.ts';

export interface PowerSettings {
 limitW: number;
 direction: 'rows' | 'columns';
 edge: 'left' | 'right' | 'top' | 'bottom';
}

export const defaultPowerSettings: Readonly<PowerSettings> = {limitW: 3600, direction: 'rows', edge: 'left'};

export function validPowerLimit(value: unknown): value is number {
 return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validatePowerSettings(value: unknown): value is PowerSettings {
 if (!value || typeof value !== 'object') return false;
 const {limitW, direction, edge} = value as PowerSettings;
 return validPowerLimit(limitW) && (
  (direction === 'rows' && (edge === 'left' || edge === 'right'))
  || (direction === 'columns' && (edge === 'top' || edge === 'bottom'))
 );
}

function contiguousLines(cells: Cell[], byRows: boolean, reverse: boolean) {
 const track = ({c, r}: Cell) => byRows ? r : c;
 const depth = ({c, r}: Cell) => byRows ? c : r;
 const sorted = [...cells].sort((a, b) => track(a) - track(b) || (depth(a) - depth(b)) * (reverse ? -1 : 1));
 const lines: Cell[][] = [];
 for (const cell of sorted) {
  const line = lines.at(-1);
  const previous = line?.at(-1);
  const adjacent=previous && (byRows
   ? reverse ? cell.c+(cell.span??1)===previous.c : previous.c+(previous.span??1)===cell.c
   : Math.abs(cell.r-previous.r)===1);
  if (line && previous && track(cell) === track(previous) && adjacent) {
   line.push(cell);
  } else {
   lines.push([cell]);
  }
 }
 return lines;
}

// Bisect overlong lines into the minimum number of consecutive, similarly
// loaded chains. Each indivisible cabinet must fit the circuit on its own.
function splitPowerLine(line:Cell[],limit:number,watts:(cell:Cell)=>number) {
 const prefix=[0];
 for(const cell of line)prefix.push(prefix[prefix.length-1]+watts(cell));
 const nominal=watts(line[0]);
 if(line.every(cell=>watts(cell)===nominal)){
  const pieces:Cell[][]=[];
  const count=Math.ceil(line.length/Math.floor(limit/nominal));
  let start=0;
  for(let i=0;i<count;i++){
   const size=Math.ceil((line.length-start)/(count-i));
   pieces.push(line.slice(start,start+size));start+=size;
  }
  return pieces;
 }
 const n=line.length,minPieces=new Array<number>(n+1).fill(0);
 for(let i=n-1;i>=0;i--){
  let end=i+1;
  while(end<n && prefix[end+1]-prefix[i]<=limit)end++;
  minPieces[i]=1+minPieces[end];
 }
 const pieces:Cell[][]=[];
 for(let i=0;i<n;){
  const remaining=minPieces[i]-1;
  const target=(prefix[n]-prefix[i])/(remaining+1);
  let best=i+1,score=Infinity;
  for(let j=i+1;j<=n && prefix[j]-prefix[i]<=limit;j++){
   if(minPieces[j]>remaining || n-j<remaining)continue;
   const distance=Math.abs(prefix[j]-prefix[i]-target);
   if(distance<=score){score=distance;best=j;}
  }
  pieces.push(line.slice(i,best));i=best;
 }
 return pieces;
}

function powerCircuits(lines: Cell[][], limit: number, byRows: boolean, watts:(cell:Cell)=>number) {
 const ports: PanelRoute[] = [];
 const track = ({c, r}: Cell) => byRows ? r : c;
 const alongGap=(a:Cell,b:Cell)=>byRows
  ? Math.max(0,a.c-b.c-(b.span??1)+1,b.c-a.c-(a.span??1)+1)
  : Math.abs(a.r-b.r);
 const lineWatts=new Map(lines.map(line=>[line,line.reduce((sum,c)=>sum+watts(c),0)]));
 const byTrack = new Map<number, Set<Cell[]>>();
 for (const line of lines) {
  const index = track(line[0]);
  if (!byTrack.has(index)) byTrack.set(index, new Set());
  byTrack.get(index)!.add(line);
 }
 let splitLines = 0;
 function add(cells: Cell[]) {
  const {columns, rows} = routeBounds(cells);
  ports.push({number: ports.length + 1, cells, columns, rows});
 }

 for (const line of lines) {
  if (!byTrack.get(track(line[0]))?.delete(line)) continue;
  let used = lineWatts.get(line)!;
  if (used > limit) {
   splitLines++;
   for(const piece of splitPowerLine(line,limit,watts))add(piece);
   continue;
  }
  const cells = [...line];
  let backwards = false;
  while (used < limit) {
   const tail = cells.at(-1)!;
   const options=[...(byTrack.get(track(tail)+1)??[])];
   if(!byRows&&tail.span===2)options.push(...(byTrack.get(track(tail)+2)??[]));
   let best: {line: Cell[]; backwards: boolean; score: number} | undefined;
   for (const next of options) {
    if (used + lineWatts.get(next)! > limit) continue;
    for (const reverse of [!backwards, backwards]) {
     const start = reverse ? next.at(-1)! : next[0];
     const offset = alongGap(start,tail);
     if (offset > 1) continue;
     // Prefer a straight transition, then preserve the alternating direction.
     const score = offset * 2 + Number(reverse === backwards);
     if (!best || score < best.score) best = {line: next, backwards: reverse, score};
    }
   }
   if (!best) break;
   byTrack.get(track(best.line[0]))?.delete(best.line);
   used+=lineWatts.get(best.line)!;
   backwards = best.backwards;
   cells.push(...(backwards ? [...best.line].reverse() : best.line));
  }
  add(cells);
 }
 return {ports, splitLines};
}

export function powerPlan(screen: Screen, settings = screen.powerRouting ?? defaultPowerSettings) {
 const cabinets=cabinetPositions(screen);
 const cells:Cell[]=cabinets.map(({c,r,span})=>span===2?{c,r,span}:{c,r});
 const powers=cabinets.map(p=>p.panel.power);
 const missingPower=powers.some(w=>w===null||w<=0);
 // A fixed cabinet count is only meaningful on a homogeneous screen.
 const panelWatts = screen.panel.power && screen.panel.power>0 ? screen.panel.power:null;
 const panelsPerCircuit = panelWatts===null?0:Math.floor(settings.limitW/panelWatts);
 const overLimit=powers.some(w=>w!==null&&w>settings.limitW);
 const totalWatts=missingPower || (!screen.mixed && panelWatts===null) ? null : powers.reduce<number>((sum,w)=>sum+w!,0);
 const byPosition=new Map(cells.map((cell,i)=>[cell,powers[i]!]));
 const watts=(cell:Cell)=>byPosition.get(cell)!;
 const byRows = settings.direction === 'rows';
 const reverse = settings.edge === 'right' || settings.edge === 'bottom';
 const lines = !missingPower && !overLimit ? contiguousLines(cells,byRows,reverse) : [];
 const {ports,splitLines}=powerCircuits(lines,settings.limitW,byRows,watts);
 return {
  cells,panelWatts,panelsPerCircuit,splitLines,totalWatts,missingPower,overLimit,
  ports: ports.map(port=>{
   const load=port.cells.reduce((sum,cell)=>sum+watts(cell),0);
   return {...port,watts:load,remaining:Math.max(0,settings.limitW-load)};
  })
 };
}

export function powerPlanIssue(plan: ReturnType<typeof powerPlan>) {
 if (!plan.cells.length) return 'Aktyvių panelių nėra.';
 if (plan.missingPower) return 'Nenurodyta panelės galia. Įrašykite ją panelių kataloge.';
 if (plan.overLimit) return 'Grandinės W riba mažesnė už vienos panelės galią.';
 return null;
}
