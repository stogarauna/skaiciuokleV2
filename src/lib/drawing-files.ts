import {parseProject,type Panel,type Project} from './project.ts';
import {drawingSources,type DrawingSource} from './drawing-project.ts';
import {validVwxScene,type VwxScene} from './vwx-types.ts';

type ImageEntry={hash:string;blob:Blob};
let connection:Promise<IDBDatabase>|undefined;
const cacheLock='led-studija-drawing-images';
const managedKey=(hash:string)=>'managed:'+hash;
const pendingPrefix='cleared:';
let cacheSession=Promise.resolve();
let trackImages=false;

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

async function updateImages(update:(store:IDBObjectStore)=>void){
 const db=await openImages();
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('images','readwrite');
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error);
  update(tx.objectStore('images'));
 });
}

async function collectClearedImages(active:()=>readonly DrawingSource[]){
 await updateImages(store=>{
  const keys=store.getAllKeys(IDBKeyRange.bound(pendingPrefix,pendingPrefix+'\uffff'));
  keys.onsuccess=()=>{
   if(!keys.result.length)return;
   try{
    const saved=localStorage.getItem('led-studija-project-v1');
    const persisted=saved?drawingSources(parseProject(JSON.parse(saved)).drawings):[];
    const keep=new Set([...active(),...persisted].map(f=>f.hash));
    for(const key of keys.result){
     const hash=String(key).slice(pendingPrefix.length);
     if(!keep.has(hash)){store.delete(hash);store.delete(managedKey(hash));}
     store.delete(key);
    }
   }catch{ /* Leave the pending entries for a later load if the manifest is unreadable. */ }
  };
 });
}

// A project tab holds a shared lock for its lifetime, including its undo/redo history.
// Only a fresh session with exclusive access may reclaim explicitly cleared originals.
export function startDrawingCacheSession(active:()=>readonly DrawingSource[]){
 const locks=globalThis.navigator?.locks;
 if(!locks)return;
 let closed=false;
 let release!:()=>void;
 const lifetime=new Promise<void>(resolve=>release=resolve);
 void locks.request(cacheLock,{ifAvailable:true},lock=>lock&&!closed?collectClearedImages(active):undefined).catch(()=>{});
 cacheSession=new Promise(resolve=>{
  void locks.request(cacheLock,{mode:'shared'},()=>{
   if(!closed)trackImages=true;
   resolve();
   return lifetime;
  }).catch(()=>resolve());
 });
 return ()=>{closed=true;trackImages=false;release();};
}

export function retireDrawingImages(sources:readonly DrawingSource[]){
 if(!sources.length)return;
 void cacheSession.then(()=>{
  if(!trackImages)return;
  return updateImages(store=>{
   for(const {hash} of sources){
    const owned=store.getKey(managedKey(hash));
    owned.onsuccess=()=>{if(owned.result!==undefined)store.put(true,pendingPrefix+hash);};
   }
  });
 }).catch(()=>{}); // The manifest is still cleared if the device cache is unavailable.
}

export async function storeDrawingImages(images:ImageEntry[]){
 if(!images.length)return;
 try{
  await cacheSession;
  await updateImages(store=>{
   for(const image of images){
    if(!trackImages){store.put(image.blob,image.hash);continue;}
    const existing=store.getKey(image.hash);
    existing.onsuccess=()=>{
     if(existing.result===undefined){
      store.put(image.blob,image.hash);
      // A pre-existing hash can also be in use by an older, uncoordinated version.
      store.put(true,managedKey(image.hash));
     }
     store.delete(pendingPrefix+image.hash);
    };
   }
  });
 }catch{throw Error('Nepavyko įrašyti brėžinių vaizdų šiame įrenginyje. Patikrinkite naršyklės saugyklą ir laisvą vietą.');}
}

export async function readDrawingImage(source:DrawingSource):Promise<Blob>{
 await cacheSession;
 const db=await openImages();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readonly'),req=tx.objectStore('images').get(source.hash);
  req.onsuccess=()=>req.result instanceof Blob?resolve(req.result):reject(Error('Trūksta brėžinio „'+source.name+'“.'));
  req.onerror=()=>reject(req.error);
  tx.onabort=()=>reject(tx.error);
 });
}

export async function decodeDrawingImage(source:DrawingSource,blob:Blob){
 const url=URL.createObjectURL(blob),img=new Image();
 img.src=url;
 try{
  await img.decode();
  return {...source,url,img};
 }catch{
  URL.revokeObjectURL(url);
  throw Error('Nepavyko perskaityti vaizdo „'+source.name+'“.');
 }
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
 const models:Record<string,string>={};
 for(const model of project.drawings?.vwxModels??[]){
  models[model.hash]=await (await readDrawingImage(model)).text();
 }
 const payload={...project,...(Object.keys(images).length?{drawingImages:images}:{}),...(Object.keys(models).length?{drawingModels:models}:{})};
 return new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
}

export async function storeVwxScene(scene:VwxScene):Promise<DrawingSource>{
 if(!validVwxScene(scene))throw Error('Nepavyko patikrinti VWX modelio geometrijos.');
 const blob=new Blob([JSON.stringify(scene)],{type:'application/json'});
 const hash=await imageHash(blob);
 await storeDrawingImages([{hash,blob}]);
 return {hash,name:scene.fileName};
}

export async function readVwxScene(source:DrawingSource):Promise<VwxScene>{
 const blob=await readDrawingImage(source);
 const scene:unknown=JSON.parse(await blob.text());
 if(!validVwxScene(scene))throw Error('Netinkama išsaugoto VWX modelio geometrija.');
 return scene;
}

const projectEntry='LED-projektas.json';

export async function projectPackage(project:Project){
 const json=await projectFile(project);
 const drawings=project.drawings;
 if(!drawings?.files.length)return json;
 const {zipSync}=await import('fflate');
 const entries:Record<string,Uint8Array>={[projectEntry]:new Uint8Array(await json.arrayBuffer())};
 for(const [hash,label] of [[drawings.front,'Vaizdas iš priekio'],[drawings.plan,'Planas iš viršaus']]){
  const source=drawings.files.find(f=>f.hash===hash);
  if(!source)continue;
  const image=await readDrawingImage(source);
  const ext=image.type==='image/jpeg'?'jpg':image.type==='image/webp'?'webp':'png';
  entries[label+'.'+ext]=new Uint8Array(await image.arrayBuffer());
 }
 return new Blob([new Uint8Array(zipSync(entries,{level:0}))],{type:'application/zip'});
}

export async function openProjectFile(file:Blob,catalog:Panel[]=[]){
 const signature=new Uint8Array(await file.slice(0,4).arrayBuffer());
 if(signature[0]===80&&signature[1]===75&&signature[2]===3&&signature[3]===4){
  const {unzipSync}=await import('fflate');
  const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:e=>
   e.name===projectEntry&&e.compression===0&&e.originalSize===e.size&&e.size<=file.size});
  if(!entries[projectEntry])throw Error('ZIP pakete nerastas LED Studijos projekto failas.');
  file=new Blob([new Uint8Array(entries[projectEntry])],{type:'application/json'});
 }
 const raw=JSON.parse(await file.text());
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Netinkamas projekto failas.');
 const {drawingImages,drawingModels,...metadata}=raw;
 if(file.size>5_000_000&&!metadata.drawings?.files?.length&&!metadata.drawings?.vwxModels?.length)throw Error('Failas per didelis.');
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
 for(const model of project.drawings?.vwxModels??[]){
  const source=drawingModels?.[model.hash];
  if(typeof source!=='string')throw Error('Projekto faile trūksta VWX modelio „'+model.name+'“.');
  const blob=new Blob([source],{type:'application/json'});
  if(await imageHash(blob)!==model.hash||!validVwxScene(JSON.parse(source)))throw Error('Sugadintas VWX modelis „'+model.name+'“.');
  entries.push({hash:model.hash,blob});
 }
 await storeDrawingImages(entries);
 return project;
}
