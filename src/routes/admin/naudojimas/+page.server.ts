import {redirect} from '@sveltejs/kit';
import {isAdmin} from '$lib/server/admin-auth';
import {loadVisits,usageEnabled} from '$lib/server/usage';
import {summarizeVisits} from '$lib/usage';
import type {PageServerLoad} from './$types';

export const load:PageServerLoad=async ({cookies,setHeaders})=>{
 setHeaders({'cache-control':'private, no-store','x-robots-tag':'noindex'});
 if(!isAdmin(cookies))redirect(303,'/admin');
 try{
  if(!usageEnabled())return {browsers:[],available:false};
  return {browsers:summarizeVisits(await loadVisits()),available:true};
 }catch(cause){
  console.error('Usage read failed',cause instanceof Error?cause.name:'UnknownError');
  return {browsers:[],available:false};
 }
};
