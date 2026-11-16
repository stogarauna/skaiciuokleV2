import {error,fail} from '@sveltejs/kit';
import {readUsers,changeUser,usersWritable,revealPassword} from '$lib/server/users';
import type {Actions,PageServerLoad} from './$types';
export const load:PageServerLoad=async({locals,setHeaders})=>{
 if(locals.user?.role!=='admin')error(403);
 setHeaders({'cache-control':'private, no-store','referrer-policy':'same-origin'});
 return {users:(await readUsers()).users.map(({username,created,encryptedPassword})=>({username,created,canReveal:Boolean(encryptedPassword)})),writable:usersWritable()};};
export const actions:Actions={default:async({locals,request,url})=>{
 if(locals.user?.role!=='admin'||request.headers.get('origin')!==url.origin)error(403);
 const form=await request.formData();
 try{
  if(form.get('action')==='reveal'){
   const username=String(form.get('username')??'');
   const password=await revealPassword(username);
   if(password===null)return fail(400,{saved:false,message:'Šis slaptažodis buvo išsaugotas neatkuriama forma. Nustatykite jį iš naujo – tada galėsite peržiūrėti.'});
   return {saved:true,message:'Slaptažodis rodomas tik administratoriui.',revealed:{username,password}};
  }
  await changeUser(String(form.get('action')),String(form.get('username')??'').trim(),String(form.get('password')??''));return {saved:true,message:'Vartotojų duomenys išsaugoti.'};}
 catch(cause){return fail(400,{saved:false,message:cause instanceof Error&& !cause.name.startsWith('Blob')?cause.message:'Nepavyko išsaugoti. Atnaujinkite puslapį ir bandykite dar kartą.'});}
}};
