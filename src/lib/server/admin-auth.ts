import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import type {Cookies} from '@sveltejs/kit';

const sessionCookie='led-admin';
const duration=8*60*60;
const windowMs=15*60*1000;
const attempts=new Map<string,{count:number;until:number}>();
const digest=(value:string)=>createHash('sha256').update(value).digest();
const equal=(a:string,b:string)=>timingSafeEqual(digest(a),digest(b));
const accounts=[
 {username:'admin',passwordKey:'LED_ADMIN_PASSWORD'},
 {username:'admin1',passwordKey:'LED_ADMIN1_PASSWORD'},
 {username:'admin2',passwordKey:'LED_ADMIN2_PASSWORD'}
];

function credentials(){
 const secret=env.LED_ADMIN_SESSION_SECRET;
 if(!secret||secret.length<32)return [];
 return accounts.flatMap(({username,passwordKey})=>{
  const password=env[passwordKey];
  if(!password||(!dev&&password.length<16))return [];
  // Keep existing admin sessions valid and bind new sessions to their own account.
  const material=username==='admin'?password:`${username}\0${password}`;
  return [{username,password,key:createHmac('sha256',secret).update(material).digest()}];
 });
}

export const adminConfigured=()=>credentials().length>0;

export function isAdmin(cookies:Cookies){
 const session=cookies.get(sessionCookie);
 if(!session||session.length>150)return false;
 const [expiry,nonce,signature,...extra]=session.split('.');
 if(extra.length||!/^\d{10}$/.test(expiry)||!nonce||!signature||Number(expiry)<=Date.now()/1000)return false;
 return credentials().some(({key})=>equal(signature,createHmac('sha256',key).update(expiry+'.'+nonce).digest('base64url')));
}

export function signIn(cookies:Cookies,username:string,password:string,address:string){
 const configured=credentials();
 if(!configured.length)return 'disabled';
 const config=configured.find(account=>account.username===username);
 const now=Date.now();
 const attempt=attempts.get(address);
 if(attempt&&attempt.until>now&&attempt.count>=8)return 'limited';
 if(!config||password.length>256||!equal(password,config.password)){
  if(attempts.size>=4096){
   for(const [key,item] of attempts)if(item.until<=now)attempts.delete(key);
   if(attempts.size>=4096)return 'limited';
  }
  attempts.set(address,attempt&&attempt.until>now?{...attempt,count:attempt.count+1}:{count:1,until:now+windowMs});
  return 'invalid';
 }
 attempts.delete(address);
 const payload=Math.floor(now/1000+duration)+'.'+randomBytes(18).toString('base64url');
 const signature=createHmac('sha256',config.key).update(payload).digest('base64url');
 cookies.set(sessionCookie,payload+'.'+signature,{path:'/admin',httpOnly:true,secure:!dev,sameSite:'strict',maxAge:duration});
 return 'ok';
}

export function signOut(cookies:Cookies){
 cookies.delete(sessionCookie,{path:'/admin'});
}
