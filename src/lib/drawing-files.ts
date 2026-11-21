import {parseProject,type Panel,type Project} from './project.ts';
import type {DrawingSource} from './drawing-project.ts';

type ImageEntry={hash:string;blob:Blob};
let connection:Promise<IDBDatabase>|undefined;

function openImages(){
 if(!connection){
  connection=new Promise<IDBDatabase>((resolve,reject)=>{
   const request=indexedDB.open('led-studija-drawings',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('images');
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result;
    db.onversionchange=()=>{db.close();connection=undefined;};
    db.onclose=()=>{connection=undefined;};
    resolve(db);
   };
  }).catch(error=>{connection=undefined;throw error;});
 }
 return connection;
}

export async function storeDrawingImages(images:ImageEntry[]){
 if(!images.length)return;
 try{
  const db=await openImages();
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('images','readwrite');
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(tx.error);
   for(const image of images)tx.objectStore('images').put(image.blob,image.hash);
  });
 }catch{throw Error('Nepavyko įrašyti brėžinių vaizdų šiame įrenginyje. Patikrinkite naršyklės saugyklą ir laisvą vietą.');}
}

export async function readDrawingImage(source:DrawingSource):Promise<Blob>{
 const db=await openImages();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readonly'),req=tx.objectStore('images').get(source.hash);
  req.onsuccess=()=>req.result instanceof Blob?resolve(req.result):reject(Error('Trūksta brėžinio „'+source.name+'“.'));
  req.onerror=()=>reject(req.error);
  tx.onabort=()=>reject(tx.error);
 });
}

export async function imageHash(blob:Blob){
 const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}

function dataURL(blob:Blob){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result as string);
  reader.onerror=()=>reject(reader.error);
  reader.readAsDataURL(blob);
 });
}

// The device stores only the manifest in the project JSON. Downloaded projects
// also carry the original image bytes so another browser can open them offline.
export async function projectFile(project:Project){
 const images:Record<string,string>={};
 for(const source of project.drawings?.files??[]){
  images[source.hash]=await dataURL(await readDrawingImage(source));
 }
 const payload=Object.keys(images).length?{...project,drawingImages:images}:project;
 return new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
}

export async function openProjectFile(file:Blob,catalog:Panel[]=[]){
 const raw=JSON.parse(await file.text());
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Netinkamas projekto failas.');
 const {drawingImages,...metadata}=raw;
 if(file.size>5_000_000&&!metadata.drawings?.files?.length)throw Error('Failas per didelis.');
 const project=parseProject(metadata,catalog);
 const entries:ImageEntry[]=[];
 for(const source of project.drawings?.files??[]){
  const encoded=drawingImages?.[source.hash];
  const header=typeof encoded==='string'&&/^data:(image\/(?:png|jpeg|webp));base64,/.exec(encoded);
  if(!header)throw Error('Projekto faile trūksta brėžinio „'+source.name+'“.');
  const binary=atob(encoded.slice(header[0].length));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const blob=new Blob([bytes],{type:header[1]});
  if(await imageHash(blob)!==source.hash)throw Error('Sugadintas brėžinio „'+source.name+'“ vaizdas.');
  entries.push({hash:source.hash,blob});
 }
 await storeDrawingImages(entries);
 return project;
}
