import {BlobPreconditionFailedError,get,put} from '@vercel/blob';
import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import type {Cookies} from '@sveltejs/kit';
import {recentVisits, registerVisit, usageDays, type Visit} from '../usage';

export const usageCookie='led-usage';
const cookieAge=usageDays*24*60*60;
const path='usage-v1.json';
let developmentVisits:Visit[]=[];
const idPattern=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/;

export const usageEnabled=()=>dev||Boolean(env.BLOB_READ_WRITE_TOKEN);

export function browserCode(cookies:Cookies){
 const value=cookies.get(usageCookie);
 return value&&idPattern.test(value)?value:undefined;
}

export function usagePreference(cookies:Cookies){
 if(browserCode(cookies))return 'allowed';
 return cookies.get(usageCookie)==='off'?'declined':'undecided';
}

export function setUsageCookie(cookies:Cookies,value:string){
 cookies.set(usageCookie,value,{path:'/',httpOnly:true,secure:!dev,sameSite:'lax',maxAge:cookieAge});
}

async function readVisits(token:string){
 const blob=await get(path,{access:'private',token,useCache:false});
 if(!blob)return {visits:[] as Visit[],etag:undefined};
 if(blob.statusCode!==200)throw Error('Unable to read the usage log');
 const visits:Visit[]=await new Response(blob.stream).json();
 return {visits,etag:blob.blob.etag};
}

export async function recordVisit(browser:string){
 const token=env.BLOB_READ_WRITE_TOKEN;
 if(!token){
  if(dev)developmentVisits=registerVisit(developmentVisits,browser,Date.now())??developmentVisits;
  return;
 }
 for(let attempt=0;attempt<5;attempt++){
  const {visits,etag}=await readVisits(token);
  const updated=registerVisit(visits,browser,Date.now());
  if(!updated)return;
  try{
   await put(path,JSON.stringify(updated),{
    access:'private',token,contentType:'application/json',addRandomSuffix:false,
    allowOverwrite:Boolean(etag),ifMatch:etag
   });
   return;
  }catch(cause){
   if(!(cause instanceof BlobPreconditionFailedError)&&
     !(!etag&&cause instanceof Error&&cause.message.includes('already exists')))throw cause;
   await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
  }
 }
 throw Error('Usage log write conflicted');
}

export async function loadVisits(){
 const token=env.BLOB_READ_WRITE_TOKEN;
 const visits=token?(await readVisits(token)).visits:developmentVisits;
 return recentVisits(visits,Date.now());
}
