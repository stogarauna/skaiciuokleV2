import {parseProject,type Panel,type Project} from './project.ts';
import {drawingSources,type DrawingSource,type VwxDrawing} from './drawing-project.ts';
import {validVwxScene,type VwxScene,type VwxVec3} from './vwx-types.ts';

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

function vwxSceneBlob(scene:VwxScene){
 return new Blob([JSON.stringify(scene)],{type:'application/json'});
}

export async function prepareVwxScene(scene:VwxScene){
 if(!validVwxScene(scene))throw Error('Nepavyko patikrinti VWX modelio geometrijos.');
 const blob=vwxSceneBlob(scene);
 const hash=await imageHash(blob);
 return {source:{hash,name:scene.fileName},blob};
}

function samePoint(a:VwxVec3,b:VwxVec3){
 return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
}

function sameGeometry(a:VwxVec3[]|undefined,b:VwxVec3[]|undefined){
 if(!a||!b)return a===b;
 return a.length===b.length&&a.every((point,i)=>samePoint(point,b[i]));
}

// The legacy file has no original CAD hash. Shared venue layers and objects can
// recur in many revisions. An upgrade must preserve every stored placement.
export function upgradesLegacyVwx(previous:VwxScene, current:VwxScene){
 if(previous.classes!==undefined||current.classes===undefined||previous.fileName!==current.fileName||!previous.layers.length)return false;
 const layerNames=new Map(current.layers.map(layer=>[layer.id,layer.name]));
 if(!previous.layers.every(layer=>layerNames.get(layer.id)===layer.name))return false;

 const realId=(item:{id:string})=>/^(?!0{32}$)[a-f0-9]{32}$/i.test(item.id);
 if(!previous.objects.some(realId)&&!previous.panels.some(realId))return false;

 const objects=new Map(current.objects.map(item=>[item.id,item]));
 const objectsMatch=previous.objects.every(old=>{
  const placed=objects.get(old.id);
  return placed?.layerId===old.layerId&&placed.kind===old.kind&&placed.name===old.name
   &&samePoint(old.position,placed.position)&&sameGeometry(old.corners,placed.corners)
   &&sameGeometry(old.vertices,placed.vertices);
 });
 if(!objectsMatch)return false;
 const panels=new Map(current.panels.map(item=>[item.id,item]));
 return previous.panels.every(old=>{
  const panel=panels.get(old.id);
  return panel?.layerId===old.layerId&&panel.wallId===old.wallId&&panel.model===old.model
   &&sameGeometry(old.front,panel.front)&&sameGeometry(old.back,panel.back);
 });
}

export async function previousVwxDrawing(sources:VwxDrawing[],source:DrawingSource,scene:VwxScene,readPrevious:()=>Promise<VwxScene>){
 if(sources.some(item=>item.hash===source.hash))return;
 const candidates=sources.filter(item=>item.name===source.name);
 if(!candidates.length)return;
 // Older projects kept the extracted geometry only. Reproduce its exact hash
 // from this upload so the user's existing model and filters can be updated.
 try{
  const previousHash=await imageHash(vwxSceneBlob(await readPrevious()));
  const exact=candidates.find(item=>item.hash===previousHash);
  if(exact)return exact;
 }catch(error){
  if(error instanceof Error&&error.name==='AbortError')throw error;
  // A drawing understood only by the current reader has no previous snapshot.
  return;
 }
 let match:VwxDrawing|undefined;
 for(const item of candidates){
  let previous:VwxScene;
  try{previous=await readVwxScene(item);}catch{continue;}
  if(upgradesLegacyVwx(previous,scene)){
   if(match)return;
   match=item;
  }
 }
 return match;
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
