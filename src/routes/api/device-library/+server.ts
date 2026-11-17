import {json} from '@sveltejs/kit';
import {randomUUID} from 'node:crypto';
import {cleanSharedDevice,sharedDevices} from '$lib/device-library';
import {canWriteCatalog,CatalogChanged,readCatalog,writeCatalog} from '$lib/server/catalog';
import type {RequestHandler} from './$types';

const headers={'cache-control':'no-store'};
export const GET:RequestHandler=async ({fetch})=>{
 const {catalog,revision}=await readCatalog(fetch);
 return json({devices:sharedDevices(catalog.signalDevices),revision,writable:canWriteCatalog()},{headers});
};

export const POST:RequestHandler=async ({fetch,locals,request,url})=>{
 const fail=(message:string,status:number)=>json({message},{status,headers});
 if(locals.user?.role!=='admin'||request.headers.get('origin')!==url.origin)return fail('Biblioteką gali keisti tik administratoriai.',403);
 if(!canWriteCatalog())return fail('Katalogo saugykla nesukonfigūruota.',503);
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=='object'||!['add','update','remove'].includes(body.action)||typeof body.revision!=='string')
  return fail('Netinkami bibliotekos duomenys.',400);
 const device=body.action==='remove'?null:cleanSharedDevice(body.device);
 if(body.action!=='remove'&&!device)return fail('Patikrinkite modelio pavadinimą ir prievadus.',400);
 try{
  const {catalog,revision,etag}=await readCatalog(fetch,true);
  if(body.revision!==revision)return fail('Biblioteka pasikeitė. Patikrinkite naujausius duomenis ir bandykite dar kartą.',409);
  const devices=[...sharedDevices(catalog.signalDevices)];
  const i=devices.findIndex(item=>item.id===(device?.id??body.id));
  if(body.action!=='add'&&i<0)return fail('Modelis nerastas.',404);
  if(device&&devices.some((item,index)=>(body.action==='add'||index!==i)&&item.model.toLowerCase()===device.model.toLowerCase()))
   return fail('Toks modelio pavadinimas jau naudojamas.',409);
  if(body.action==='remove')devices.splice(i,1);
  else if(device&&body.action==='update')devices[i]=device;
  else if(device){
   if(devices.length>=500)return fail('Pasiekta bibliotekos įrašų riba.',422);
   devices.push({...device,id:randomUUID()});
  }
  await writeCatalog({...catalog,signalDevices:devices},revision,etag);
  const saved=await readCatalog(fetch);
  return json({devices:sharedDevices(saved.catalog.signalDevices),revision:saved.revision,writable:true},{headers});
 }catch(cause){
  if(cause instanceof CatalogChanged)return fail('Biblioteka pasikeitė. Patikrinkite naujausius duomenis ir bandykite dar kartą.',409);
  console.error('Device library write failed',cause instanceof Error?cause.name:'UnknownError');
  return fail('Nepavyko išsaugoti bibliotekos pakeitimų.',503);
 }
};
