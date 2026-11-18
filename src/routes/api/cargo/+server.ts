import {json} from '@sveltejs/kit';
import {readCatalog,writeCatalog,CatalogChanged} from '$lib/server/catalog';
import {validBox} from '$lib/transport';
import type {RequestHandler} from './$types';
export const POST:RequestHandler=async({request,url,locals,fetch})=>{
 if(locals.user?.role!=='admin'||request.headers.get('origin')!==url.origin)return json({}, {status:403});
 const boxes=await request.json().catch(()=>null);
 if(!Array.isArray(boxes)||!boxes.length||boxes.length>200||!boxes.every(validBox)||new Set(boxes.map(b=>b.name)).size!==boxes.length)return json({}, {status:400});
 const {catalog,revision,etag}=await readCatalog(fetch,true);
 try{
  const merged=new Map((catalog.cargo??[]).map(b=>[b.name,b]));
  for(const {name,l,w,h,kg} of boxes)merged.set(name,{name,l,w,h,kg});
  const cargo=[...merged.values()];
  await writeCatalog({...catalog,cargo},revision,etag);return json(cargo);
 }catch(e){return json({}, {status:e instanceof CatalogChanged?409:503});}
};
