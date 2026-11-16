import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {Cookies} from '@sveltejs/kit';
import {readUsers,passwordMatches} from './users';
export type Identity={username:string;role:'admin'|'user'};
const cookie='led-session-v2',duration=8*60*60;
const attempts=new Map<string,{count:number;until:number}>();
const digest=(s:string)=>createHash('sha256').update(s).digest();
const equal=(a:string,b:string)=>timingSafeEqual(digest(a),digest(b));
const secret=()=>env.LED_ADMIN_SESSION_SECRET;
const admins=()=>['admin1','admin2'].flatMap(username=>{const password=env[username==='admin1'?'LED_ADMIN1_PASSWORD':'LED_ADMIN2_PASSWORD'];return password?[{username,password}]:[];});
export const adminConfigured=()=>Boolean(secret()&&secret()!.length>=32&&admins().length);
function signature(payload:string,version:string){return createHmac('sha256',secret()!).update(payload+'\0'+version).digest('base64url');}
export async function sessionUser(cookies:Cookies):Promise<Identity|null>{
 const value=cookies.get(cookie);
 if(!adminConfigured()||!value||value.length>600)return null;
 const [body,sig,...extra]=value.split('.');if(extra.length||!sig)return null;
 try{
  const {username,expiry}=JSON.parse(Buffer.from(body,'base64url').toString());
  if(typeof username!=='string'||!Number.isFinite(expiry)||expiry<=Date.now()/1000)return null;
  const admin=admins().find(a=>a.username===username);
  const user=admin?null:(await readUsers()).users.find(u=>u.username===username);
  const version=admin?.password??user?.version;
  if(!version||!equal(sig,signature(body,version)))return null;
  return {username,role:admin?'admin':'user'};
 }catch{return null;}
}
export const isAdmin=async(cookies:Cookies)=>(await sessionUser(cookies))?.role==='admin';
export async function signIn(cookies:Cookies,username:string,password:string,address:string){
 if(!adminConfigured())return 'disabled';
 const now=Date.now();const attempt=attempts.get(address);
 if(attempt&&attempt.until>now&&attempt.count>=8)return 'limited';
 // Bound both input and password hashing work before reading account data.
 if(username.length>32||password.length>256)return 'invalid';
 const admin=admins().find(a=>a.username===username);
 const user=admin?null:(await readUsers()).users.find(u=>u.username===username);
 const valid=admin?equal(password,admin.password):user?passwordMatches(password,user.hash):false;
 if(!valid){
  if(attempts.size>=4096){for(const [key,item] of attempts)if(item.until<=now)attempts.delete(key);if(attempts.size>=4096)return 'limited';}
  attempts.set(address,attempt&&attempt.until>now?{...attempt,count:attempt.count+1}:{count:1,until:now+900000});return 'invalid';
 }
 attempts.delete(address);
 const body=Buffer.from(JSON.stringify({username,expiry:Math.floor(now/1000+duration),nonce:randomBytes(18).toString('hex')})).toString('base64url');
 cookies.set(cookie,body+'.'+signature(body,admin?.password??user!.version),{path:'/',httpOnly:true,secure:!dev,sameSite:'lax',maxAge:duration});
 cookies.delete('led-admin',{path:'/admin'});return 'ok';
}
export function signOut(cookies:Cookies){cookies.delete(cookie,{path:'/'});cookies.delete('led-admin',{path:'/admin'});}
