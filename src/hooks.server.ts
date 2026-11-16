import {redirect,error} from '@sveltejs/kit';
import {sessionUser} from '$lib/server/admin-auth';
import type {Handle} from '@sveltejs/kit';
import {recordOpening,usageEnabled} from '$lib/server/usage';

export const handle:Handle=async ({event,resolve})=>{
 const {request,url,isDataRequest}=event;
 event.locals.user=await sessionUser(event.cookies);
 if(url.pathname!=='/login'){
  if(!event.locals.user){if(url.pathname.startsWith('/api/'))error(401,'Prisijunkite.');redirect(303,'/login');}
  if((url.pathname==='/admin'||url.pathname.startsWith('/admin/'))&&event.locals.user.role!=='admin')error(403,'Administravimas prieinamas tik administratoriams.');
 }

 const opening=usageEnabled()&&url.pathname==='/'&&request.method==='GET'&&!isDataRequest&&
  request.headers.get('accept')?.includes('text/html')&&
  !['sec-purpose','purpose'].some(header=>request.headers.get(header)?.includes('prefetch'));
 const now=opening?Date.now():0;
 const response=await resolve(event);
 if(opening&&response.ok&&response.headers.get('content-type')?.startsWith('text/html')){
  try{await recordOpening(now);}
  catch(cause){console.error('Opening count failed',cause instanceof Error?cause.name:'UnknownError');}
 }
 response.headers.set('Cache-Control','private, no-store');
 return response;
};
