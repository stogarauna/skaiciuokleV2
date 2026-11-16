import {fail,redirect,error} from '@sveltejs/kit';
import {signIn,adminConfigured} from '$lib/server/admin-auth';
import type {Actions,PageServerLoad} from './$types';
export const load:PageServerLoad=({locals})=>{if(locals.user)redirect(303,'/');return {configured:adminConfigured()};};
export const actions:Actions={default:async({request,url,cookies,getClientAddress})=>{
 if(request.headers.get('origin')!==url.origin)error(403,'Užklausa atmesta.');
 const form=await request.formData();
 const username=String(form.get('username')??'').trim();
 try{
 const result=await signIn(cookies,username,String(form.get('password')??''),getClientAddress());
 if(result!=='ok')return fail(result==='limited'?429:401,{message:result==='limited'?'Per daug bandymų. Pabandykite po 15 minučių.':'Neteisingas prisijungimo vardas arba slaptažodis.',username});
 }catch{return fail(503,{message:'Prisijungimas laikinai nepasiekiamas. Bandykite dar kartą.',username});}
 redirect(303,'/');
}};
