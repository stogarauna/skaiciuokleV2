import {BlobPreconditionFailedError,get,put} from '@vercel/blob';
import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import type {Cookies} from '@sveltejs/kit';
import {openingDay, recentOpenings, recentVisits, registerVisit, usageDays, type DailyOpenings, type Visit} from '../usage';

export const usageCookie='led-usage';
const cookieAge=usageDays*24*60*60;
const visitsPath='usage-v1.json';
const openingsPath='openings-v1.json';
let developmentOpenings:DailyOpenings={};
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

async function readUsage<T>(path:string,token:string,empty:T){
 const blob=await get(path,{access:'private',token,useCache:false});
 if(!blob)return {data:empty,etag:undefined};
 if(blob.statusCode!==200)throw Error('Unable to read usage statistics');
 const data:T=await new Response(blob.stream).json();
 return {data,etag:blob.blob.etag};
}

async function updateUsage<T>(path:string,token:string,empty:T,update:(data:T)=>T|null){
 for(let attempt=0;attempt<5;attempt++){
  const {data,etag}=await readUsage(path,token,empty);
  const updated=update(data);
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
 throw Error('Usage statistics write conflicted');
}

export async function recordVisit(browser:string){
 const token=env.BLOB_READ_WRITE_TOKEN;
 if(token)await updateUsage<Visit[]>(visitsPath,token,[],visits=>registerVisit(visits,browser,Date.now()));
 else if(dev)developmentVisits=registerVisit(developmentVisits,browser,Date.now())??developmentVisits;
}

export async function loadVisits(){
 const token=env.BLOB_READ_WRITE_TOKEN;
 const visits=token?(await readUsage<Visit[]>(visitsPath,token,[])).data:developmentVisits;
 return recentVisits(visits,Date.now());
}

export async function recordOpening(now:number){
 const token=env.BLOB_READ_WRITE_TOKEN;
 const date=openingDay(now);
 const increment=(counts:DailyOpenings)=>{
  // Keep the date captured on entry, including requests that finish after midnight.
  const today=openingDay(Date.now());
  const recent=recentOpenings(counts,today);
  recent[date]=(recent[date]??0)+1;
  return recent;
 };
 if(token)await updateUsage<DailyOpenings>(openingsPath,token,{},increment);
 else if(dev)developmentOpenings=increment(developmentOpenings);
}

export async function loadOpenings(){
 const token=env.BLOB_READ_WRITE_TOKEN;
 const counts=token?(await readUsage<DailyOpenings>(openingsPath,token,{})).data:developmentOpenings;
 return recentOpenings(counts,openingDay(Date.now()));
}
