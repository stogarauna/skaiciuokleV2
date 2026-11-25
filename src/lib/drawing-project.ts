import type {Candidate,Mark} from './plan-recognition.ts';

export type DrawingPoint={x:number;y:number};
export type DrawingSource={hash:string;name:string};
export type DrawingRow=Candidate & {
 target:string;model:string;cols:number|null;rows:number|null;include:boolean;
 customName?:string;widthText?:string;heightText?:string;
};
export type DrawingField='resolution'|'dimensions'|'power'|'utp';
export type RigAxis={id:string;orientation:'vertical'|'horizontal';position:number;lane?:number;excluded?:DrawingPoint[]};
export type RigColors=Record<'blue'|'red',boolean>;
export function visibleRigMarks(marks:Mark[],colors?:RigColors){
 return marks.filter(m=>!m.symbol||!colors||colors[m.symbol]);
}
export function onRigAxis(axis:RigAxis,p:DrawingPoint){
 return !axis.excluded?.some(q=>q.x===p.x&&q.y===p.y);
}
export interface DrawingProject {
 files:DrawingSource[];front:string;plan:string;
 rows:DrawingRow[];marks:Mark[];active:string;pins:Record<string,Record<string,DrawingPoint>>;
 mode:'mark'|'scale'|'measure'|'datum';reference:DrawingPoint[];known?:number|null;scale:number;
 rigAxes?:RigAxis[];rigColors?:RigColors;
 completed:DrawingPoint[][];chain:DrawingPoint[];
 selectedFields:DrawingField[];exportFormat:'png'|'jpg';
 showFront:boolean;showPlan:boolean;infoOpen:boolean;measureOpen:boolean;
}

export function emptyDrawings():DrawingProject {
 return {files:[],front:'',plan:'',rows:[],marks:[],active:'',pins:{},mode:'mark',reference:[],known:undefined,scale:0,
  completed:[],chain:[],selectedFields:[],exportFormat:'png',showFront:true,showPlan:true,infoOpen:true,measureOpen:true};
}

function centresOfRiggingPoints(marks:Mark[]){
 const groups=new Map<string,{left:number;right:number;top:number;bottom:number}>();
 for(const {owner,x,y} of marks){
  if(!owner)continue;
  const bounds=groups.get(owner);
  if(bounds){
   bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);
   bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);
  }else groups.set(owner,{left:x,right:x,top:y,bottom:y});
 }
 return new Map(Array.from(groups,([id,bounds])=>[id,{x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2}]));
}

export function drawingLayoutReference(drawings:DrawingProject,screens:readonly {id:string}[]){
 const ids=new Set(screens.map(s=>s.id));
 for(const view of ['front','plan'] as const){
  const source=drawings.files.find(file=>file.hash===drawings[view]);
  if(!source)continue;
  const byRow=view==='front'?new Map(Object.entries(drawings.pins[source.hash]??{})):centresOfRiggingPoints(visibleRigMarks(drawings.marks,drawings.rigColors));
  const pins=new Map<string,DrawingPoint>();
  for(const row of drawings.rows){
   const pin=byRow.get(row.id);
   if(!pin||!row.include||!ids.has(row.target))continue;
   const previous=pins.get(row.target);
   if(previous&&(previous.x!==pin.x||previous.y!==pin.y)){
    throw Error('Dvi brėžinio ekranų eilutės priskirtos tam pačiam projekto ekranui. Patikrinkite priskyrimą skiltyje „Brėžiniai“.');
   }
   pins.set(row.target,pin);
  }
  if(pins.size>=2)return {view,source,pins};
 }
}

const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const point=(p:unknown)=>record(p)&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const points=(v:unknown)=>Array.isArray(v)&&v.every(point);
const fraction=(v:unknown)=>finite(v)&&v>=0&&v<=1;
function validAxes(axes:unknown){
 if(!Array.isArray(axes))return false;
 const ids=new Set<string>();
 return axes.every(a=>{
  if(!record(a)||typeof a.id!=='string'||!a.id||ids.has(a.id))return false;
  ids.add(a.id);
  return (a.orientation==='vertical'||a.orientation==='horizontal')&&fraction(a.position)
   &&(a.lane===undefined||fraction(a.lane))&&(a.excluded===undefined||points(a.excluded));
 });
}

export function validDrawings(d:unknown):d is DrawingProject {
 if(!record(d)||!Array.isArray(d.files)||!Array.isArray(d.rows)||!Array.isArray(d.marks)||!record(d.pins))return false;
 const hashes=new Set<string>(),ids=new Set<string>();
 for(const f of d.files){
  if(!record(f)||typeof f.hash!=='string'||!/^[a-f0-9]{64}$/.test(f.hash)||hashes.has(f.hash)||typeof f.name!=='string'||!f.name)return false;
  hashes.add(f.hash);
 }
 for(const r of d.rows){
  if(!record(r)||typeof r.id!=='string'||!r.id||Object.hasOwn(Object.prototype,r.id)||ids.has(r.id)
   ||typeof r.name!=='string'||typeof r.target!=='string'||typeof r.model!=='string'||typeof r.include!=='boolean'
   ||![r.cols,r.rows].every(n=>n===null||finite(n))||![r.customName,r.widthText,r.heightText].every(s=>s===undefined||typeof s==='string'))return false;
  ids.add(r.id);
 }
 return [d.front,d.plan].every(h=>h===''||typeof h==='string'&&hashes.has(h))
  &&(d.active===''||typeof d.active==='string'&&ids.has(d.active))
  &&d.marks.every(m=>point(m)&&(m.owner===''||ids.has(m.owner))&&(m.symbol===undefined||m.symbol==='blue'||m.symbol==='red'))
  &&(d.rigAxes===undefined||validAxes(d.rigAxes))
  &&(d.rigColors===undefined||(record(d.rigColors)&&typeof d.rigColors.blue==='boolean'&&typeof d.rigColors.red==='boolean'))
  &&Object.entries(d.pins).every(([hash,pins])=>hashes.has(hash)&&record(pins)&&Object.entries(pins).every(([id,p])=>ids.has(id)&&point(p)))
  &&(d.mode==='mark'||d.mode==='scale'||d.mode==='measure'||d.mode==='datum')&&points(d.reference)&&points(d.chain)
  &&Array.isArray(d.completed)&&d.completed.every(points)&&finite(d.scale)&&d.scale>=0&&(d.known==null||finite(d.known))
  &&[d.showFront,d.showPlan,d.infoOpen,d.measureOpen].every(v=>typeof v==='boolean')
  &&(d.exportFormat==='png'||d.exportFormat==='jpg')&&Array.isArray(d.selectedFields)
  &&d.selectedFields.every(v=>['resolution','dimensions','power','utp'].includes(v));
}
