import {get, head, put, BlobNotFoundError} from '@vercel/blob';
import {env} from '$env/dynamic/private';
import {dev} from '$app/environment';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
export type User={username:string;hash:string;version:string;created:string};
const path='users-v1.json';
export const usersWritable=()=>Boolean(env.BLOB_READ_WRITE_TOKEN||(dev&&env.LED_USERS_DEV_FILE));
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,32).toString('hex');}
export function passwordMatches(password:string,hash:string){const [salt,value]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,32),Buffer.from(value,'hex'));}
export async function readUsers(forWrite=false):Promise<{users:User[];etag?:string}>{
 const token=env.BLOB_READ_WRITE_TOKEN;
 if(token){
  const metadata=forWrite?await head(path,{token}).catch(e=>{if(e instanceof BlobNotFoundError)return null;throw e;}):null;
  const blob=await get(path,{access:'private',token,useCache:false});
  if(!blob){if(metadata)throw new Error('Saugykla pasikeitė. Bandykite dar kartą.');return {users:[]};}
  if(blob.statusCode!==200||(forWrite&&!metadata))throw new Error('Nepavyko nuskaityti vartotojų.');
  return {users:JSON.parse(await new Response(blob.stream).text()),etag:metadata?.etag};
 }
 const file=dev?env.LED_USERS_DEV_FILE:undefined;
 return {users:file&&existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[]};
}
export async function changeUser(action:string,username:string,password:string){
 if(!/^[\p{L}\p{N}_.-]{2,32}$/u.test(username)||['admin','admin1','admin2'].includes(username.toLowerCase()))throw new Error('Vardas turi būti 2–32 simbolių. Administratorių vardai rezervuoti.');
 if(action!=='delete'&&(password.length<2||password.length>256))throw new Error('Slaptažodis turi būti 2–256 simbolių.');
 const {users,etag}=await readUsers(true);
 const index=users.findIndex(u=>u.username.toLowerCase()===username.toLowerCase());
 if(action==='create'){
  if(index>=0)throw new Error('Toks vartotojas jau yra.');
  if(users.length>=500)throw new Error('Pasiekta 500 vartotojų riba.');
  users.push({username,hash:passwordHash(password),version:randomBytes(16).toString('hex'),created:new Date().toISOString()});
 }else{
  if(index<0)throw new Error('Vartotojas nerastas.');
  if(action==='delete')users.splice(index,1);
  else if(action==='password')users[index]={...users[index],hash:passwordHash(password),version:randomBytes(16).toString('hex')};
  else throw new Error('Nežinomas veiksmas.');
 }
 const contents=JSON.stringify(users);
 if(env.BLOB_READ_WRITE_TOKEN)await put(path,contents,{access:'private',token:env.BLOB_READ_WRITE_TOKEN,contentType:'application/json',addRandomSuffix:false,allowOverwrite:Boolean(etag),ifMatch:etag});
 else if(dev&&env.LED_USERS_DEV_FILE){const file=env.LED_USERS_DEV_FILE;writeFileSync(file+'.tmp',contents,{mode:0o600});renameSync(file+'.tmp',file);}
 else throw new Error('Vartotojų saugykla nesukonfigūruota.');
}
