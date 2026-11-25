import type {VwxObject,VwxPanel,VwxScene,VwxVec3} from './vwx-types';

export type VwxEndpoint = {
 id:string; ownerId:string; layerId:string; kind:'hoist'|'vertex'|'panel'; name:string; position:VwxVec3
};

export function vwxAnchorId(kind:'panel'|'vertex', ownerId:string, index:number){
 return '@'+kind+'/'+index+'/'+ownerId;
}
type Owners={panels:Map<string,VwxPanel>;objects:Map<string,VwxObject>};
const indexes=new WeakMap<VwxScene,Owners>();
function owners(scene:VwxScene):Owners{
 let index=indexes.get(scene);
 if(!index){
  index={panels:new Map(scene.panels.map(p=>[p.id,p])),objects:new Map(scene.objects.map(o=>[o.id,o]))};
  indexes.set(scene,index);
 }
 return index;
}
export function findVwxEndpoint(scene:VwxScene,id:string):VwxEndpoint|undefined{
 const {panels,objects}=owners(scene);
 const hoist=objects.get(id);
 if(hoist?.kind==='hoist')return {id,ownerId:id,layerId:hoist.layerId,kind:'hoist',name:hoist.name,position:hoist.position};
 const match=/^@(panel|vertex)\/(\d+)\/(.+)$/.exec(id);
 if(!match)return;
 const kind=match[1],i=Number(match[2]),ownerId=match[3],shortId=ownerId.slice(0,6).toUpperCase();
 if(kind==='panel'){
  const panel=panels.get(ownerId),p=panel?.front[i];
  if(panel&&p)return {id,ownerId,layerId:panel.layerId,kind,name:'Panelė '+shortId+' · K'+(i+1),position:p};
 }else{
  const obj=objects.get(ownerId),p=obj?.vertices?.[i];
  if(obj&&p)return {id,ownerId,layerId:obj.layerId,kind:'vertex',name:obj.name+' '+shortId+' · T'+(i+1),position:p};
 }
}
