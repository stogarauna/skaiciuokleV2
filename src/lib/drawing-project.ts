import type {Candidate,Mark} from './plan-recognition.ts';

export type DrawingPoint={x:number;y:number};
export type DrawingSource={hash:string;name:string};
export type DrawingRow=Candidate & {
 target:string;model:string;cols:number|null;rows:number|null;include:boolean;
 customName?:string;widthText?:string;heightText?:string;
};
export type DrawingField='resolution'|'dimensions'|'power'|'utp';
export interface DrawingProject {
 files:DrawingSource[];front:string;plan:string;
 rows:DrawingRow[];marks:Mark[];active:string;pins:Record<string,Record<string,DrawingPoint>>;
 mode:'mark'|'scale'|'measure';reference:DrawingPoint[];known?:number|null;scale:number;
 completed:DrawingPoint[][];chain:DrawingPoint[];
 selectedFields:DrawingField[];exportFormat:'png'|'jpg';
 showFront:boolean;showPlan:boolean;infoOpen:boolean;measureOpen:boolean;
}

export function emptyDrawings():DrawingProject {
 return {files:[],front:'',plan:'',rows:[],marks:[],active:'',pins:{},mode:'mark',reference:[],known:undefined,scale:0,
  completed:[],chain:[],selectedFields:[],exportFormat:'png',showFront:true,showPlan:true,infoOpen:true,measureOpen:true};
}

const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const point=(p:unknown)=>record(p)&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const points=(v:unknown)=>Array.isArray(v)&&v.every(point);

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
  &&d.marks.every(m=>point(m)&&(m.owner===''||ids.has(m.owner)))
  &&Object.entries(d.pins).every(([hash,pins])=>hashes.has(hash)&&record(pins)&&Object.entries(pins).every(([id,p])=>ids.has(id)&&point(p)))
  &&(d.mode==='mark'||d.mode==='scale'||d.mode==='measure')&&points(d.reference)&&points(d.chain)
  &&Array.isArray(d.completed)&&d.completed.every(points)&&finite(d.scale)&&d.scale>=0&&(d.known==null||finite(d.known))
  &&[d.showFront,d.showPlan,d.infoOpen,d.measureOpen].every(v=>typeof v==='boolean')
  &&(d.exportFormat==='png'||d.exportFormat==='jpg')&&Array.isArray(d.selectedFields)
  &&d.selectedFields.every(v=>['resolution','dimensions','power','utp'].includes(v));
}
