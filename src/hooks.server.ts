import type {Handle} from '@sveltejs/kit';
import {recordOpening,usageEnabled} from '$lib/server/usage';

export const handle:Handle=async ({event,resolve})=>{
 const {request,url,isDataRequest}=event;
 const opening=usageEnabled()&&url.pathname==='/'&&request.method==='GET'&&!isDataRequest&&
  request.headers.get('accept')?.includes('text/html')&&
  !['sec-purpose','purpose'].some(header=>request.headers.get(header)?.includes('prefetch'));
 const now=opening?Date.now():0;
 const response=await resolve(event);
 if(opening&&response.ok&&response.headers.get('content-type')?.startsWith('text/html')){
  try{await recordOpening(now);}
  catch(cause){console.error('Opening count failed',cause instanceof Error?cause.name:'UnknownError');}
 }
 return response;
};
