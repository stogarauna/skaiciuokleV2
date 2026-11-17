import {BlobNotFoundError, BlobPreconditionFailedError, get, head, put} from '@vercel/blob';
import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import type {EquipmentWeights} from '../mounting';
import type {Panel} from '../project';
import type {SavedDevice} from '../foh-diagram';
import {seedCatalog} from './catalog-seed';

export interface Catalog {
 panels: Panel[];
 equipmentWeights: EquipmentWeights;
 signalDevices?: SavedDevice[];
}

const pathname='catalog-v1.json';
const revision=(contents:string)=>createHash('sha256').update(contents).digest('hex');
const localPath=()=>dev?env.LED_CATALOG_DEV_FILE:undefined;
const blobToken=()=>env.BLOB_READ_WRITE_TOKEN;
export const canWriteCatalog=()=>Boolean(blobToken()||localPath());
export class CatalogChanged extends Error {}

export async function readCatalog(fetch: typeof globalThis.fetch, forWrite=false){
 const file=localPath();
 const token=blobToken();
 if(token){
  // Use the storage API's ETag for conditional writes and a content hash for forms.
  const metadata=forWrite?await head(pathname,{token}).catch(cause=>{
   if(cause instanceof BlobNotFoundError)return null;
   throw cause;
  }):undefined;
  const blob=await get(pathname,{access:'private',token,useCache:false});
  if(blob?.statusCode===200){
   if(forWrite&&!metadata?.etag)throw new CatalogChanged();
   const contents=await new Response(blob.stream).text();
   const catalog:Catalog=JSON.parse(contents);
   return {catalog,revision:revision(contents),etag:metadata?.etag};
  }
  if(forWrite&&metadata)throw new CatalogChanged();
  if(blob)throw new Error('Nepavyko nuskaityti katalogo.');
 }else if(file&&existsSync(file)){
  const contents=readFileSync(file,'utf8');
  const catalog:Catalog=JSON.parse(contents);
  return {catalog,revision:revision(contents)};
 }
 return {catalog:await seedCatalog(fetch),revision:''};
}

export async function writeCatalog(catalog:Catalog,expected:string,etag?:string){
 const contents=JSON.stringify(catalog);
 const token=blobToken();
 if(token){
  if(expected&&!etag)throw new CatalogChanged();
  try{
   await put(pathname,contents,{
    access:'private',token,contentType:'application/json',addRandomSuffix:false,
    allowOverwrite:Boolean(etag),ifMatch:etag
   });
   return;
  }catch(error){
   if(error instanceof BlobPreconditionFailedError||
      (!expected&&error instanceof Error&&error.message.includes('already exists')))throw new CatalogChanged();
   throw error;
  }
 }
 const file=localPath();
 if(!file)throw new Error('Katalogo saugykla nesukonfigūruota.');
 const current=existsSync(file)?revision(readFileSync(file,'utf8')):'';
 if(current!==expected)throw new CatalogChanged();
 // Local development writes are synchronous and published as one atomic rename.
 const temporary=file+'.'+randomUUID();
 try{
  writeFileSync(temporary,contents,{mode:0o600});
  renameSync(temporary,file);
 }finally{
  rmSync(temporary,{force:true});
 }
}
