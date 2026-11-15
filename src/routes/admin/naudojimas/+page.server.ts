import {redirect} from '@sveltejs/kit';
import {isAdmin} from '$lib/server/admin-auth';
import {loadOpenings,loadVisits,usageEnabled} from '$lib/server/usage';
import {openingDay,summarizeVisits} from '$lib/usage';
import type {PageServerLoad} from './$types';

export const load:PageServerLoad=async ({cookies,setHeaders})=>{
 setHeaders({'cache-control':'private, no-store','x-robots-tag':'noindex'});
 if(!isAdmin(cookies))redirect(303,'/admin');
 const today=openingDay(Date.now());
 if(!usageEnabled())return {browsers:null,openings:null,today};
 const [browsers,openings]=await Promise.allSettled([loadVisits(),loadOpenings()]);
 for(const result of [browsers,openings]){
  if(result.status==='rejected')console.error('Usage read failed',result.reason instanceof Error?result.reason.name:'UnknownError');
 }
 return {
  today,
  browsers:browsers.status==='fulfilled'?summarizeVisits(browsers.value):null,
  openings:openings.status==='fulfilled'?Object.entries(openings.value).sort(([a],[b])=>b.localeCompare(a)):null
 };
};
