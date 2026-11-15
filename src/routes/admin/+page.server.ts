import {error, fail, redirect} from '@sveltejs/kit';
import {panelFields} from '$lib/catalog-fields';
import {equipmentFields, equipmentKeys, type EquipmentWeights} from '$lib/mounting';
import type {Panel} from '$lib/project';
import {adminConfigured, isAdmin, signIn, signOut} from '$lib/server/admin-auth';
import {canWriteCatalog, CatalogChanged, readCatalog, writeCatalog, type Catalog} from '$lib/server/catalog';
import type {Actions, PageServerLoad, RequestEvent} from './$types';

export const load:PageServerLoad=async ({cookies,fetch,setHeaders})=>{
 setHeaders({'cache-control':'private, no-store','x-robots-tag':'noindex'});
 if(!isAdmin(cookies))return {signedIn:false as const, configured:adminConfigured()};
 const {catalog,revision}=await readCatalog(fetch);
 return {signedIn:true as const,catalog,revision,writable:canWriteCatalog()};
};

class InvalidField extends Error {}

function numberField(form:FormData,key:string,label:string,min:number,max:number,required=false,integer=false){
 const raw=form.get(key);
 if(raw===null||raw===''){
  if(required)throw new InvalidField(label+' – užpildykite lauką.');
  return null;
 }
 const value=typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
 if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw new InvalidField(label+' – netinkama reikšmė.');
 return value;
}

function angles(form:FormData,key:string,min:number,max:number){
 const raw=form.get(key);
 if(raw===null||raw==='')return undefined;
 if(typeof raw!=='string'||raw.length>120)throw new InvalidField('Netinkami lenkimo kampai.');
 const values=raw.split(';').map(part=>part.trim().replace(',','.'));
 const numbers=values.map(Number);
 if(values.some(value=>value==='')||numbers.some(n=>!Number.isFinite(n)||n<min||n>max))throw new InvalidField('Patikrinkite lenkimo kampų ribas.');
 return numbers.length===1?numbers[0]:numbers;
}

function requireSameOrigin({request,url}:RequestEvent){
 if(request.headers.get('origin')!==url.origin)error(403,'Užklausa atmesta.');
}

async function save(event:RequestEvent,change:(catalog:Catalog,form:FormData)=>void){
 requireSameOrigin(event);
 if(!isAdmin(event.cookies))error(403,'Reikia administratoriaus prisijungimo.');
 if(!canWriteCatalog())return fail(503,{message:'Katalogo saugykla nesukonfigūruota.'});
 try{
  const form=await event.request.formData();
  const {catalog,revision}=await readCatalog(event.fetch);
  if(form.get('revision')!==revision)throw new CatalogChanged();
  change(catalog,form);
  await writeCatalog(catalog,revision);
  return {saved:true,message:'Pakeitimai išsaugoti.'};
 }catch(cause){
  if(cause instanceof CatalogChanged)return fail(409,{message:'Katalogas pasikeitė. Peržiūrėkite naujausius duomenis ir išsaugokite dar kartą.'});
  if(cause instanceof InvalidField)return fail(400,{message:cause.message});
  console.error('Catalog write failed',cause instanceof Error?cause.name:'UnknownError');
  return fail(503,{message:'Nepavyko išsaugoti katalogo. Bandykite dar kartą.'});
 }
}

export const actions:Actions={
 login:async event=>{
  requireSameOrigin(event);
  const {request,cookies,getClientAddress}=event;
  const password=(await request.formData()).get('password');
  if(typeof password!=='string')return fail(400,{message:'Įveskite slaptažodį.'});
  const result=signIn(cookies,password,getClientAddress());
  if(result==='disabled')return fail(503,{message:'Administratoriaus prisijungimas dar nesukonfigūruotas.'});
  if(result==='limited')return fail(429,{message:'Per daug bandymų. Pabandykite po 15 minučių.'});
  if(result!=='ok')return fail(401,{message:'Neteisingas slaptažodis.'});
  redirect(303,'/admin');
 },
 logout:event=>{
  requireSameOrigin(event);
  signOut(event.cookies);
  redirect(303,'/admin');
 },
 panel:event=>save(event,(catalog,form)=>{
  const original=form.get('original');
  const index=catalog.panels.findIndex(panel=>panel.name===original);
  if(typeof original!=='string'||(original!==''&&index<0))throw new InvalidField('Panelės modelis nerastas.');
  const name=String(form.get('name')??'').trim();
  if(!name||name.length>120||/[\u0000-\u001f]/.test(name))throw new InvalidField('Įrašykite tinkamą panelės pavadinimą.');
  if(catalog.panels.some((panel,i)=>i!==index&&panel.name.toLowerCase()===name.toLowerCase()))throw new InvalidField('Toks panelės pavadinimas jau yra kataloge.');
  if(index<0&&catalog.panels.length>=200)throw new InvalidField('Kataloge leidžiama iki 200 panelių modelių.');
  const values=Object.fromEntries(panelFields.map(field=>[field.key,numberField(form,field.key,field.label,field.min,field.max,field.required,'integer' in field)]));
  if(values.frameHeightMinM!==null&&values.frameHeightMaxM!==null&&values.frameHeightMinM>values.frameHeightMaxM)throw new InvalidField('Minimalus rėmo aukštis viršija maksimalų.');
  const fixed=form.get('fixed')==='on';
  const panel={
   ...catalog.panels[index],...values,name,
   bendAngleText:fixed?'Nesilenkia':undefined,
   bendAngleDeg:fixed?null:numberField(form,'bendAngleDeg','Lenkimo kampas, °',-90,90),
   bendAngleMinDeg:fixed?undefined:angles(form,'bendAngleMinDeg',-90,90),
   bendAngleMaxDeg:fixed?undefined:angles(form,'bendAngleMaxDeg',0,90)
  } as Panel;
  if(index<0)catalog.panels.push(panel);
  else catalog.panels[index]=panel;
 }),
 equipment:event=>save(event,(catalog,form)=>{
  catalog.equipmentWeights=Object.fromEntries(equipmentKeys.map(key=>[key,numberField(form,key,equipmentFields[key].name,0,1000)])) as EquipmentWeights;
 })
};
