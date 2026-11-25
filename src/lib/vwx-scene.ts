import { readVwxBlocks } from './vwx-stream.ts';
import type { VwxObject, VwxPanel, VwxScene, VwxVec3 } from './vwx-types.ts';

type Matrix = number[];
type Bounds = [number, number, number, number, number, number];
type Layer = VwxScene['layers'][number];
type Equipment = { kind: string; name: string; tag: string };
type NativeNode = { id: string; parent: number; matrix: Matrix; bounds?: Bounds; equipment?: Equipment };
type Pending = { parent: number; node?: NativeNode; layer?: boolean; group?: boolean };

const little = true;
const utf16 = new TextDecoder('utf-16le');
// The payload of a mesh/embedded image can be tens of megabytes. Native object
// metadata and the modest polygon preview we use fit in the record prefix.
const prefixLimit = 8192;
const contextPerLayer = 180;
const identity: Matrix = [1,0,0, 0,1,0, 0,0,1, 0,0,0];
const round = (n: number) => Math.round(n * 1000) / 1000;
const sane = (n: number) => Number.isFinite(n) && Math.abs(n) < 1e9;
const invalidRecord = () => new Error('Nepavyko perskaityti VWX objektų struktūros.');

function objectId(d: DataView, offset: number) {
 const b = new Uint8Array(d.buffer, d.byteOffset + 56, 16);
 return b.some(Boolean) ? Array.from(b, v => v.toString(16).padStart(2, '0')).join('') : 'vwx-' + offset;
}

function point(d: DataView, off: number): VwxVec3 {
 return [d.getFloat64(off, little), d.getFloat64(off+8, little), d.getFloat64(off+16, little)];
}

function bounds(d: DataView): Bounds | undefined {
 if (d.byteLength < 204) return;
 const box: Bounds = [...point(d,156), ...point(d,180)];
 if (box.every(sane) && box.slice(0,3).every((v,i) => v >= box[3+i]) &&
     box.slice(0,3).some((v,i) => v > box[3+i])) return box;
}

function matrixAt(d: DataView, offset: number): Matrix | undefined {
 if (d.byteLength < offset + 96) return;
 const m = Array.from({length:12}, (_,i) => d.getFloat64(offset+i*8, little));
 if (m.every(sane) && [0,3,6].every(i => Math.hypot(m[i],m[i+1],m[i+2]) > 0)) return m;
}

function apply(m: Matrix, p: VwxVec3): VwxVec3 {
 const [x,y,z] = p;
 return [x*m[0]+y*m[3]+z*m[6]+m[9], x*m[1]+y*m[4]+z*m[7]+m[10], x*m[2]+y*m[5]+z*m[8]+m[11]];
}

function corners(b: Bounds, m: Matrix, parent=identity): VwxVec3[] {
 const [X,Y,Z,x,y,z]=b;
 const vertices: VwxVec3[]=[[x,y,z],[X,y,z],[X,y,Z],[x,y,Z],[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]];
 return vertices.map(v => apply(parent,apply(m,v)).map(round) as VwxVec3);
}

function stringAt(d: DataView, offset: number, bytes: number) {
 if (bytes < 0 || bytes%2 || offset+bytes > d.byteLength) return '';
 return utf16.decode(new Uint8Array(d.buffer,d.byteOffset+offset,bytes)).trim();
}

// Spotlight equipment records contain a types table, then (length,offset)
// entries. Read the actual field boundaries so model names, equipment IDs and
// categories remain independent even though their UTF-16 bytes are adjacent.
function equipment(d: DataView): Equipment | undefined {
 if (d.byteLength < 158 || d.getUint16(84,little) !== 8) return;
 const base=94;
 const field = (i:number) => {
  const len=d.getUint32(base+i*8,little), off=d.getUint32(base+i*8+4,little);
  return off<64 ? '' : stringAt(d,base+off,len);
 };
 const kind=field(6);
 if (!['LED Wall','LED Panel','Hoist','Truss'].includes(kind)) return;
 return {kind, name:field(0)||field(1)||kind, tag:field(4)};
}

function makeLayer(name: string, id: string) {
 return {info:{name,id} as Layer, pointer:0, groups:new Set<number>(), nodes:new Map<number,NativeNode>(),
  layerBounds:undefined as Bounds|undefined, context:[] as VwxObject[], seen:0, seed:73};
}
type LayerData=ReturnType<typeof makeLayer>;

// Keep a repeatable, bounded sample across the whole layer, not just the first
// imported objects (a venue may contain tens of thousands of mesh faces).
function addContext(layer: LayerData, make:()=>VwxObject|undefined) {
 layer.seen++;
 let index=layer.context.length;
 if (index>=contextPerLayer) {
  layer.seed=(Math.imul(1664525,layer.seed)+1013904223)>>>0;
  index=Math.floor((layer.seed/4294967296)*layer.seen);
  if(index>=contextPerLayer)return;
 }
 const item=make();
 if(item)layer.context[index]=item;
}

function contextObject(layer: LayerData, id: string, name: string, points: VwxVec3[], path = false): VwxObject | undefined {
 if (!points.length || !points.every(p=>p.every(sane))) return;
 const center: VwxVec3=[0,0,0];
 for(const p of points) for(const dim of [0,1,2])center[dim]+=p[dim]/points.length;
 return {id,layerId:layer.info.id,kind:'context',name,position:center.map(round) as VwxVec3,...(path ? {vertices:points} : {corners:points})};
}

function nativeContext(d: DataView, type: number, layer: LayerData, offset: number) {
 // Groups have no local transform. Only trace their real placed children, never
 // children of a PIO/symbol that already has a placed transform of its own.
 if(type===25 && d.byteLength>=258) {
  const count=d.getUint16(208,little);
  if(count<2 || count>32 || 210+count*24>d.byteLength)return;
  addContext(layer,()=>{
   const pts=Array.from({length:count},(_,i)=>point(d,210+i*24).map(round) as VwxVec3);
   return contextObject(layer,objectId(d,offset),'3D linija',pts,true);
  });
 } else if([24,40,84].includes(type)) {
  const box=bounds(d), transform=type===40?identity:matrixAt(d,204);
  if(box && transform)addContext(layer,()=>contextObject(layer,objectId(d,offset),'3D objekto gabaritai',corners(box,transform)));
 }
}

function finishLayer(layer: LayerData, scene: VwxScene) {
 const direct=(n:NativeNode)=>n.parent===layer.pointer||layer.groups.has(n.parent);
 const layerId=layer.info.id, before=scene.objects.length;
 for(const n of layer.nodes.values()){
  const e=n.equipment, owner=layer.nodes.get(n.parent);
  if(e?.kind==='LED Panel' && n.bounds && (direct(n) || (owner?.equipment?.kind==='LED Wall' && direct(owner)))) {
   // Freeform walls also carry an internal edit-group copy. Only take the
   // cabinet directly owned by the authored wall (or directly placed cabinet).
   const pts=corners(n.bounds,n.matrix,owner?.matrix);
   if(pts.every(p=>p.every(sane))) {
    const panel:VwxPanel={id:n.id,layerId,wallId:owner?.id||n.id,model:e.name,front:pts.slice(0,4),back:pts.slice(4)};
    scene.panels.push(panel);
   }
  } else if(direct(n) && (e?.kind==='Hoist'||e?.kind==='Truss')) {
   const pos=apply(n.matrix,[0,0,0]).map(round) as VwxVec3;
   scene.objects.push({id:n.id,layerId,kind:e.kind==='Hoist'?'hoist':'truss',name:e.tag||e.name,position:pos,
    ...(n.bounds?{corners:corners(n.bounds,n.matrix)}:{})});
  } else if(direct(n) && !e && n.bounds) {
   addContext(layer,()=>contextObject(layer,n.id,'Objekto gabaritai',corners(n.bounds!,n.matrix)));
  }
 }
 // For layers with unsupported symbol/solid graphics, preserve their native
 // overall bounds rather than presenting the layer as a detailed mesh.
 if (!layer.context.length && scene.objects.length===before && !scene.panels.some(p=>p.layerId===layerId) && layer.layerBounds) {
  const item=contextObject(layer,layerId+'-bounds','Sluoksnio gabaritai',corners(layer.layerBounds,identity));
  if(item)layer.context.push(item);
 }
 if(layer.context.length)scene.contextSimplified=true;
 scene.objects.push(...layer.context);
 scene.layers.push(layer.info);
}

function sceneBuilder(fileName: string) {
 const scene: VwxScene={fileName,layers:[],panels:[],objects:[]};
 let layer: LayerData|undefined, pending:Pending|undefined;
 function visit(bytes: Uint8Array, offset: number){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const type=d.getUint16(24,false);
  if (type===31){
   if(layer)finishLayer(layer,scene);
   layer=undefined;pending=undefined;
   if(d.byteLength<680 || d.getUint16(322,little)!==1)return; // sheet layers use 0
   const name=stringAt(d,678,d.getUint32(674,little));
   if(!name)return;
   layer=makeLayer(name,objectId(d,offset)); layer.layerBounds=bounds(d);
   pending={parent:-1,layer:true};return;
  }
  if(!layer)return;
  // The six-byte file-local owner key is exact in a JavaScript number.
  const parent=d.getUint32(38,little)+4294967296*d.getUint16(42,little);
  if(pending && pending.parent!==parent) {
   if(pending.layer)layer.pointer=parent;
   else if(pending.group)layer.groups.add(parent);
   else if(pending.node)layer.nodes.set(parent,pending.node);
  }
  pending=undefined;
  const direct=parent===layer.pointer||layer.groups.has(parent);
  if(type===11&&direct){pending={parent,group:true};return;}
  if(type===86 && (direct || layer.nodes.has(parent))) {
   const matrix=matrixAt(d,240);
   if(matrix)pending={parent,node:{id:objectId(d,offset),parent,matrix,bounds:bounds(d)}};
  } else if(type===48 && layer.nodes.has(parent)) {
   const n=layer.nodes.get(parent)!;
   const e=equipment(d);
   if(e && (!n.equipment || (!n.equipment.tag && e.tag)))n.equipment=e;
  } else if(direct)nativeContext(d,type,layer,offset);
 }
 return {visit,finish(){
  if(layer)finishLayer(layer,scene);
  if(!scene.panels.length&&!scene.objects.length)throw new Error('Šiame VWX faile nerasta palaikomos modelio geometrijos.');
  return scene;
 }};
}

export async function sceneFromVwxBlocks(fileName: string, blocks: AsyncIterable<Uint8Array>): Promise<VwxScene> {
 const scene=sceneBuilder(fileName);
 // Most records lie entirely inside a decoded block. Keep at most one short
 // prefix when a record straddles blocks; skip large payload tails in place.
 const prefix=new Uint8Array(prefixLimit);
 let used=0, size=0, start=0, absolute=0;
 const recordLength=(b:Uint8Array, i:number)=>{
  const v=new DataView(b.buffer,b.byteOffset+i,8), n=v.getUint32(0,little);
  if(v.getUint32(4,little)!==0 || n<80)throw invalidRecord();
  return n;
 };
 for await(const block of blocks){
  let i=0;
  while(i<block.length){
   if(!used){
    start=absolute+i;
    if(i+8<=block.length) {
     size=recordLength(block,i);
     if(size<=block.length-i) {
      scene.visit(block.subarray(i,i+Math.min(size,prefixLimit)),start);
      i+=size;size=0;continue;
     }
    }
   }
   if(used<8){
    const take=Math.min(8-used,block.length-i);
    prefix.set(block.subarray(i,i+take),used);i+=take;used+=take;
    if(used<8)continue;
    size=recordLength(prefix,0);
   }
   const take=Math.min(size-used,block.length-i);
   if(used<prefixLimit)prefix.set(block.subarray(i,i+Math.min(take,prefixLimit-used)),used);
   used+=take;i+=take;
   if(used===size){scene.visit(prefix.subarray(0,Math.min(size,prefixLimit)),start);used=0;size=0;}
  }
  absolute+=block.length;
 }
 if(used)throw invalidRecord();
 return scene.finish();
}

export function readVwxScene(file: File, onProgress?: (percent:number)=>void): Promise<VwxScene> {
 return sceneFromVwxBlocks(file.name, readVwxBlocks(file,onProgress));
}
