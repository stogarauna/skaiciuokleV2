import type {VwxVisibility} from './vwx-classes.ts';

export type VwxVec3 = [number, number, number];
export interface VwxCategory {id:string;name:string;nativeVisibility?:VwxVisibility}

export interface VwxPanel {
 id: string;
 layerId: string;
 classId?: string;
 sourceClassId?: string;
 wallId: string;
 model: string;
 provenance?: 'screen-grid';
 front: VwxVec3[];
 back: VwxVec3[];
}

export interface VwxObject {
 id: string;
 layerId: string;
 classId?: string;
 sourceClassId?: string;
 kind: 'hoist' | 'truss' | 'context';
 name: string;
 position: VwxVec3;
 corners?: VwxVec3[];
 vertices?: VwxVec3[];
}

// Geometry is in model millimetres, with Z up. Sheet viewports have no place here.
export interface VwxScene {
 fileName: string;
 contextSimplified?: boolean;
 layers: VwxCategory[];
 classes?: VwxCategory[];
 panels: VwxPanel[];
 objects: VwxObject[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
 value !== null && typeof value === 'object' && !Array.isArray(value);

const named = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const point = (value: unknown): value is VwxVec3 =>
 Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));
const corners = (value: unknown, count: number) =>
 Array.isArray(value) && value.length === count && value.every(point);

export function validVwxScene(value: unknown): value is VwxScene {
 if (!isRecord(value) || !named(value.fileName) || !Array.isArray(value.layers)
  || !Array.isArray(value.panels) || !Array.isArray(value.objects)) return false;

 if (value.contextSimplified !== undefined && typeof value.contextSimplified !== 'boolean') return false;
 function readIds(rows:unknown){
  if(!Array.isArray(rows))return;
  const ids=new Set<string>();
  for(const row of rows){
   if(!isRecord(row)||!named(row.id)||!named(row.name)||ids.has(row.id)
    ||(row.nativeVisibility!==undefined&&!['visible','hidden','grey'].includes(String(row.nativeVisibility))))return;
   ids.add(row.id);
  }
  return ids;
 }
 const layers=readIds(value.layers);
 const classes=readIds(value.classes??[]);
 if(!layers||!classes||value.classes===null)return false;

 const ids = new Set<string>();
 function placed(item: unknown): item is Record<string, unknown> {
  if (!isRecord(item) || !named(item.id) || ids.has(item.id) || !named(item.layerId) || !layers!.has(item.layerId)
   || [item.classId,item.sourceClassId].some(id=>id!==undefined && (!named(id)||!classes!.has(id)))) return false;
  ids.add(item.id);
  return true;
 }
 return value.panels.every(p => placed(p) && named(p.wallId) && named(p.model) && (p.provenance === undefined || p.provenance === 'screen-grid') && corners(p.front, 4) && corners(p.back, 4))
  && value.objects.every(o => placed(o) && ['hoist', 'truss', 'context'].includes(String(o.kind)) && named(o.name)
   && point(o.position) && (o.corners === undefined || corners(o.corners, 8))
   && (o.vertices === undefined || (Array.isArray(o.vertices) && o.vertices.length >= 2 && o.vertices.length <= 64 && o.vertices.every(point))));
}
