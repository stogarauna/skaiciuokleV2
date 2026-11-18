import {json} from '@sveltejs/kit';
import {randomUUID} from 'node:crypto';
import {cleanSharedDevice,sharedDevices} from '$lib/device-library';
import {canWriteCatalog,CatalogChanged,readCatalog,writeCatalog} from '$lib/server/catalog';
import type {RequestHandler} from './$types';

const headers={'cache-control':'no-store'};
export const GET:RequestHandler=async ({fetch})=>{
 const {catalog,revision}=await readCatalog(fetch);
 return json({folders:catalog.rentmanFolders,devices:sharedDevices(catalog.signalDevices,catalog.wireflowPresetsInstalled),revision,writable:canWriteCatalog()},{headers});
};

export const POST:RequestHandler=async ({fetch,locals,request,url})=>{
 const fail=(message:string,status:number)=>json({message},{status,headers});
 if(locals.user?.role!=='admin'||request.headers.get('origin')!==url.origin)return fail('Biblioteką gali keisti tik administratoriai.',403);
 if(!canWriteCatalog())return fail('Katalogo saugykla nesukonfigūruota.',503);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=='object'||!['add','update','remove','rentman'].includes(body.action)||typeof body.revision!=='string')
  return fail('Netinkami bibliotekos duomenys.',400);
 const device=['remove','rentman'].includes(body.action)?null:cleanSharedDevice(body.device);
 if(!['remove','rentman'].includes(body.action)&&!device)return fail('Patikrinkite modelio pavadinimą ir prievadus.',400);
 try{
  const {catalog,revision,etag}=await readCatalog(fetch,true);
  if(body.revision!==revision)return fail('Biblioteka pasikeitė. Patikrinkite naujausius duomenis ir bandykite dar kartą.',409);
  const devices=[...sharedDevices(catalog.signalDevices,catalog.wireflowPresetsInstalled)];
  if(body.action==='rentman'){
   const folders=body.folders;
   const roots=['IT','Other','Presentations equipment','LED','Projectors','TV','Sound','Rigging','Signal & Processing','KTS'];
   if(!Array.isArray(folders)||!folders.length||folders.length>2000)return fail('Netinkamas katalogų sąrašas.',400);
   const byId=new Map(devices.map((d,i)=>[d.id,i]));
   const ids=new Set<string>();
   const paths=new Set<string>();
   for(const folder of folders){
    if(!folder||!Array.isArray(folder.path)||!roots.includes(folder.path[0])||folder.path.some((v:unknown)=>typeof v!=='string'||!v.trim()||v.length>160)||!Array.isArray(folder.items))return fail('Netinkamas katalogo kelias.',400);
    const key=JSON.stringify(folder.path);
    if(paths.has(key))return fail('Pasikartojantis katalogas.',400);
    paths.add(key);
    for(const item of folder.items){
     if(!item||typeof item.id!=='string'||!/^\d{1,20}$/.test(item.id)||typeof item.model!=='string'||!item.model.trim()||item.model.length>120)return fail('Netinkamas įrangos įrašas.',400);
     const id='rentman-'+item.id;
     if(ids.has(id))return fail('Pasikartojantis įrangos ID.',400);
     ids.add(id);
     const index=byId.get(id);
     const model={id,model:item.model,category:'Rentman',folder:folder.path,ports:index===undefined?[]:devices[index].ports};
     if(index===undefined)devices.push(model);
     else devices[index]=model;
    }
   }
   catalog.rentmanFolders=folders.map((f:{path:string[]})=>f.path);
   if(devices.length>10000)return fail('Viršyta 10 000 modelių riba.',422);
  }else{
   const i=devices.findIndex(item=>item.id===(device?.id??body.id));
   if(body.action!=='add'&&i<0)return fail('Modelis nerastas.',404);
   if(device&&devices.some((item,index)=>(body.action==='add'||index!==i)&&item.model.toLowerCase()===device.model.toLowerCase()))
    return fail('Toks modelio pavadinimas jau naudojamas.',409);
   if(body.action==='remove')devices.splice(i,1);
   else if(device&&body.action==='update')devices[i]={...devices[i],...device};
   else if(device){
    if(devices.length>=10000)return fail('Pasiekta bibliotekos įrašų riba.',422);
    devices.push({...device,id:randomUUID()});
   }
  }
  await writeCatalog({...catalog,signalDevices:devices,wireflowPresetsInstalled:true},revision,etag);
  const saved=await readCatalog(fetch);
  return json({folders:saved.catalog.rentmanFolders,devices:sharedDevices(saved.catalog.signalDevices,saved.catalog.wireflowPresetsInstalled),revision:saved.revision,writable:true},{headers});
 }catch(cause){
  if(cause instanceof CatalogChanged)return fail('Biblioteka pasikeitė. Patikrinkite naujausius duomenis ir bandykite dar kartą.',409);
  console.error('Device library write failed',cause instanceof Error?cause.name:'UnknownError');
  return fail('Nepavyko išsaugoti bibliotekos pakeitimų.',503);
 }
};
