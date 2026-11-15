import {error} from '@sveltejs/kit';
import {randomUUID} from 'node:crypto';
import {browserCode, recordVisit, setUsageCookie, usageEnabled} from '$lib/server/usage';
import type {RequestHandler} from './$types';

export const POST:RequestHandler=async ({request,url,cookies})=>{
 if(request.headers.get('origin')!==url.origin)error(403);
 const action=request.headers.get('x-led-usage');
 if(action==='decline'){
  setUsageCookie(cookies,'off');
  return new Response(null,{status:204});
 }
 if(action!=='allow'&&action!=='visit')error(400);
 if(!usageEnabled())error(503);
 let browser=browserCode(cookies);
 if(action==='allow'&&!browser){
  browser=randomUUID();
  setUsageCookie(cookies,browser);
 }
 if(browser){
  try{await recordVisit(browser);}
  catch(cause){
   console.error('Usage write failed',cause instanceof Error?cause.name:'UnknownError');
   error(503);
  }
 }
 return new Response(null,{status:204});
};
