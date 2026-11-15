import {BlobPreconditionFailedError, get, put} from '@vercel/blob';
import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import type {EquipmentWeights} from '../mounting';
import type {Panel} from '../project';
import {seedCatalog} from './catalog-seed';

export interface Catalog {
 panels: Panel[];
 equipmentWeights: EquipmentWeights;
}

const pathname='catalog-v1.json';
const revision=(contents:string)=>createHash('sha256').update(contents).digest('hex');
const localPath=()=>dev?env.LED_CATALOG_DEV_FILE:undefined;
const blobToken=()=>env.BLOB_READ_WRITE_TOKEN;
export const canWriteCatalog=()=>Boolean(blobToken()||localPath());
export class CatalogChanged extends Error {}

export async function readCatalog(fetch: typeof globalThis.fetch){
 const file=localPath();
 const token=blobToken();
 if(token){
  const blob=await get(pathname,{access:'private',token,useCache:false});
  if(blob?.statusCode===200){
   const catalog:Catalog=await new Response(blob.stream).json();
   return {catalog,revision:blob.blob.etag};
  }
  if(blob)throw new Error('Nepavyko nuskaityti katalogo.');
 }else if(file&&existsSync(file)){
  const contents=readFileSync(file,'utf8');
  const catalog:Catalog=JSON.parse(contents);
  return {catalog,revision:revision(contents)};
 }
 return {catalog:await seedCatalog(fetch),revision:''};
}

export async function writeCatalog(catalog:Catalog,expected:string){
 const contents=JSON.stringify(catalog);
 const token=blobToken();
 if(token){
  try{
   await put(pathname,contents,{
    access:'private',token,contentType:'application/json',addRandomSuffix:false,
    allowOverwrite:Boolean(expected),ifMatch:expected||undefined
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
