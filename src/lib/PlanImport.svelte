<script lang="ts">
 import {drawAnnotations,type DrawingAnnotations} from './plan-annotations';
 import DrawingViewport from './DrawingViewport.svelte';
 import {onDestroy,onMount,tick} from 'svelte';
 import {arenaExample,arenaHash,regions,type Candidate} from './plan-recognition';
 import {emptyDrawings,type DrawingProject,type DrawingPoint as Point,type DrawingSource,type DrawingRow as Row,type DrawingField} from './drawing-project';
 import {imageHash,readDrawingImage,storeDrawingImages} from './drawing-files';
 import type {Screen,Panel} from './project';
 import {makeScreen,stats} from './project';
 import {signalLineSummary,signalOutputs} from './signal-output';
 import {defaultMounting} from './mounting';
 export let screens:Screen[],catalog:Panel[],apply:(items:Screen[],action:'create'|'mounting',drawings:DrawingProject)=>void;
 export let initial:DrawingProject|undefined;
 export let onchange:(drawings:DrawingProject)=>void;
 export let busy=false;
 const draft={...emptyDrawings(),...structuredClone(initial)};
 type Picture=DrawingSource & {url:string;img:HTMLImageElement};
 let sources=draft.files,frontHash=draft.front,planHash=draft.plan;
 let files:Picture[]=[], plan:Picture|undefined, front:Picture|undefined;
 $: front=files.find(file=>file.hash===frontHash);
 $: plan=files.find(file=>file.hash===planHash);
 let rows=draft.rows,marks=draft.marks,active=draft.active,status='',deleteMode=false;
 let pins=draft.pins,mode=draft.mode;
 let reference=draft.reference,chain=draft.chain,known=draft.known,scale=draft.scale;
 let completed=draft.completed;
 let disposed=false,lastPublished=JSON.stringify(draft);
 let hover:Point|undefined,shiftHeld=false;
 $: groups=[...completed,chain];
 $: rowInfo=new Map(rows.map(row=>[row.id,inspectRow(row,screens,catalog)]));
 $: newCount=rows.filter(row=>row.include&&!row.target).length;
 $: anchor=mode==='measure'?chain[chain.length-1]:mode==='scale'&&reference.length===1?reference[0]:undefined;
 $: preview=hover&&anchor&&plan?endpoint(hover,anchor,shiftHeld,plan):undefined;
 function groupName(index:number):string{
  let label='';
  for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;
  return label;
 }
 function newMeasurement(){
  if(chain.length<2)return;
  completed=[...completed,chain];
  chain=[];
 }
 const fmt=(v:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(v);
 const metres=new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3});
 const exportFields=[
  {key:'resolution',label:'Raiška (px)',prefix:''},
  {key:'dimensions',label:'Matmenys (m)',prefix:''},
  {key:'power',label:'Galia (kW)',prefix:'Galia '},
  {key:'utp',label:'UTP portai su atsarga',prefix:'UTP '}
 ] as const;
 let selectedFields=draft.selectedFields,exportFormat=draft.exportFormat;
 let showFront=draft.showFront,showPlan=draft.showPlan,infoOpen=draft.infoOpen,measureOpen=draft.measureOpen;
 let drawing:DrawingProject;
 $: drawing={files:sources,front:frontHash,plan:planHash,rows,marks,active,pins,mode,reference,known,scale,
  completed,chain,selectedFields,exportFormat,showFront,showPlan,infoOpen,measureOpen};
 $: if(!busy)publish(drawing);
 function publish(next:DrawingProject){
  if(disposed||!next.files.length)return;
  const json=JSON.stringify(next);
  if(json===lastPublished)return;
  lastPublished=json;
  onchange(structuredClone(next));
 }
 function screenName(row:Row){
  return row.customName?.trim()||screens.find(s=>s.id===row.target)?.name||row.name;
 }
 function readMetres(text?:string){
  const raw=text?.trim();
  if(!raw)return undefined;
  const value=Number(raw.replace(',','.'));
  return /^(?:\d+|\d*[.,]\d+)$/.test(raw)&&Number.isFinite(value)&&value>0?value:NaN;
 }
 function panelCount(text:string|undefined,count:number|null,panelMetres:number){
  const length=readMetres(text);
  if(length===undefined)return count??0;
  const ratio=length/panelMetres,nearest=Math.round(ratio);
  return nearest>0&&Math.abs(ratio-nearest)<1e-8?nearest:Math.ceil(ratio);
 }
 function inspectRow(row:Row,projectScreens:Screen[],models:Panel[]){
  let screen=projectScreens.find(item=>item.id===row.target);
  let issue='';
  const panel=screen?.panel??models.find(item=>item.name===row.model);
  const cols=screen?.cols??(panel?panelCount(row.widthText,row.cols,panel.widthM):row.cols);
  const height=screen?.rows??(panel?panelCount(row.heightText,row.rows,panel.heightM):row.rows);
  if(!screen){
   if(row.target)issue='Pasirinkite projekto ekraną iš naujo.';
   else if(!panel)issue='Pasirinkite panelės modelį.';
   else if(!cols||!height||![cols,height].every(n=>Number.isInteger(n)&&n>0))issue='Įrašykite plotį ir aukštį metrais arba panelių skaičių.';
   else if(cols>100||height>100||cols*height>5000)issue='Ekranas viršija projekto dydžio ribas.';
   else screen={id:row.id,name:row.customName?.trim()||row.name,panel,cols,rows:height,removed:[],x:0,y:0};
  }
  if(!screen)return {screen,issue,cols,height,resolution:'',power:'',utp:'',assembled:''};
  const actual=stats(screen),output=signalOutputs(screen),lines=signalLineSummary(output);
  const resolution=fmt(actual.pxW)+' × '+fmt(actual.pxH)+' px';
  const power=actual.power===null?'Nenurodyta':metres.format(actual.power/1000)+' kW';
  const utp=output.issue?'Nesuskaičiuota':lines.total+' ('+lines.count+' pagr. + '+lines.backup+' atsarg.)'+(lines.complete?'':' · nepilna');
  const different=(text:string|undefined,value:number)=>Math.abs((readMetres(text)??value)-value)>1e-8;
  const assembled=different(row.widthText,actual.width)||different(row.heightText,actual.height)
   ?metres.format(actual.width)+' × '+metres.format(actual.height)+' m':'';
  return {screen,issue,cols,height,resolution,power,utp,assembled};
 }
 function catalogueSize(row:Row){
  const screen=screens.find(s=>s.id===row.target);
  if(screen?.removed.length)return stats(screen);
  const panel=screen?.panel??catalog.find(p=>p.name===row.model);
  return {width:(screen?.cols??row.cols??0)*(panel?.widthM??0),height:(screen?.rows??row.rows??0)*(panel?.heightM??0)};
 }
 function screenWidth(r:Row){
  const existing=screens.find(s=>s.id===r.target);
  if(existing?.curvature?.angleDeg||existing?.removed.length)return 0;
  return readMetres(r.widthText)??catalogueSize(r).width;
 }
 function distance(a:Point,b:Point,p:Picture){
  return Math.hypot((a.x-b.x)*p.img.naturalWidth,(a.y-b.y)*p.img.naturalHeight);
 }
 function location(e:MouseEvent):Point{
  const b=(e.currentTarget as HTMLElement).getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};
 }
 function pinFront(e:MouseEvent){
  if(!front)return;
  if(!active||pins[front.hash]?.[active])addRow();
  pins={...pins,[front.hash]:{...pins[front.hash],[active]:location(e)}};
 }
 function unpinFront(id:string){
  if(!front)return;
  const next={...pins[front.hash]};
  delete next[id];
  pins={...pins,[front.hash]:next};
 }
 function endpoint(point:Point,from:Point|undefined,lockAxis:boolean,picture:Picture):Point{
  if(!lockAxis||!from)return point;
  const dx=Math.abs(point.x-from.x)*picture.img.naturalWidth;
  const dy=Math.abs(point.y-from.y)*picture.img.naturalHeight;
  return dx>=dy?{x:point.x,y:from.y}:{x:from.x,y:point.y};
 }
 function trackPointer(event:PointerEvent,mark?:Point){
  if(mode==='mark'||event.pointerType==='touch')return;
  hover=mark??location(event);
  shiftHeld=event.shiftKey;
 }
 function updateModifier(event:KeyboardEvent){
  if(event.key==='Shift')shiftHeld=event.shiftKey;
 }
 function pick(raw:Point,lockAxis:boolean){
  if(!plan||mode==='mark')return;
  const p=endpoint(raw,anchor,lockAxis,plan);
  hover=undefined;
  if(anchor&&distance(anchor,p,plan)<1)return;
  if(mode==='scale'){
   reference=reference.length===1?[reference[0],p]:[p];
  }else{
   chain=[...chain,p];
  }
 }
 function calibrate(){
  if(!plan||reference.length!==2||!known||known<=0||!Number.isFinite(known))return;
  scale=known/distance(reference[0],reference[1],plan);mode='measure';
 }
 function resetMeasure(){reference=[];completed=[];chain=[];hover=undefined;scale=0;known=undefined;mode='mark';}
 function frontPins(pic:Picture|undefined,items:Row[],arena:boolean){
  if(!pic)return;
  const pts=detect(pic,'screen').sort((a,b)=>a.x-b.x);
  let ids=items.map(r=>r.id);
  if(arena){
   // The example has six stage screens and two audience screens in the far view.
   if(pts.length!==6&&pts.length!==8)return;
   const middle=pts.slice(pts.length/2-1,pts.length/2+1);
   const centers=middle[0].y<middle[1].y?['1','0']:['0','1'];
   ids=pts.length===8?['6','4','2',...centers,'3','5','7']:['4','2',...centers,'3','5'];
  }
  pins={...pins,[pic.hash]:Object.fromEntries(pts.slice(0,ids.length).map((p,i)=>[ids[i],p]))};
 }
 const asRow=(item:Candidate):Row=>({...item,target:'',model:'',cols:null,rows:null,include:true});
 onMount(()=>{if(sources.length)void restorePictures();});
 onDestroy(()=>{disposed=true;files.forEach(f=>URL.revokeObjectURL(f.url));});
 async function decodePicture(source:DrawingSource,blob:Blob):Promise<Picture>{
  const url=URL.createObjectURL(blob),img=new Image();
  img.src=url;
  try{await img.decode();}catch{URL.revokeObjectURL(url);throw Error('Nepavyko perskaityti vaizdo „'+source.name+'“.');}
  return {...source,url,img};
 }
 async function restorePictures(){
  busy=true;
  const missing:string[]=[];
  try{
   for(const source of sources){
    if(disposed)return;
    try{
     const picture=await decodePicture(source,await readDrawingImage(source));
     if(disposed){URL.revokeObjectURL(picture.url);return;}
     files=[...files,picture];
    }catch{missing.push(source.name);}
   }
   if(missing.length)status='Žymėjimai išsaugoti. Įkelkite šiuos originalius vaizdus dar kartą: '+missing.join(', ')+'.';
  }finally{if(!disposed)busy=false;}
 }
 async function load(input:HTMLInputElement){
  const batch=Array.from(input.files??[]);input.value='';busy=true;
  const oldFront=frontHash,oldPlan=planHash;
  const images:{hash:string;blob:Blob}[]=[],staged:Picture[]=[];
  try{
   for(const f of batch){
    if(disposed)return;
    const ext=/\.(jpe?g|png|webp)$/i.exec(f.name)?.[1].toLowerCase();
    if(!ext)throw Error('Pasirinkite JPG, PNG arba WebP vaizdą.');
    const hash=await imageHash(f);
    if(files.some(p=>p.hash===hash)||staged.some(p=>p.hash===hash))continue;
    const blob=f.slice(0,f.size,'image/'+(ext==='jpg'?'jpeg':ext));
    const source=sources.find(s=>s.hash===hash)??{hash,name:f.name};
    staged.push(await decodePicture(source,blob));images.push({hash,blob});
   }
   if(!staged.length||disposed)return;
   await storeDrawingImages(images);
   if(disposed)return;
   sources=[...sources,...staged.filter(p=>!sources.some(s=>s.hash===p.hash)).map(({hash,name})=>({hash,name}))];
   files=[...files,...staged];staged.length=0;
   const top=files.find(p=>/top|plan|virš/i.test(p.name));
   if(!frontHash)frontHash=(files.find(p=>/far/i.test(p.name)&&p!==top&&p.hash!==planHash)??files.find(p=>p!==top&&p.hash!==planHash))?.hash??'';
   if(!planHash)planHash=(top??files.find(p=>p.hash!==frontHash))?.hash??'';
   await tick();
   if(disposed)return;
   status='';
   if(!oldPlan&&plan){
    if(!rows.length)scan();
    else{
     const draft=plan.hash===arenaHash?arenaExample():null;
     marks=draft?draft.marks.map(p=>({...p,owner:''})):detect(plan,'point').map(p=>({...p,owner:''}));
     status='Pasirinkite ekraną ir priskirkite jam plano taškus.';
    }
   }
   if(!oldFront&&front&&!rows.length){
    rows=detect(front,'screen').sort((a,b)=>a.x-b.x).map((_,i)=>asRow({id:crypto.randomUUID(),name:'Ekranas '+(i+1)}));
    active=rows[0]?.id??'';
   }
   if(!oldFront&&front&&!pins[front.hash])frontPins(front,rows,plan?.hash===arenaHash&&rows.some(r=>r.id==='0'));
  }catch(e){status=e instanceof Error?e.message:String(e);}
  finally{staged.forEach(p=>URL.revokeObjectURL(p.url));if(!disposed)busy=false;}
 }
 function detect(pic:Picture,kind:'screen'|'point'){
  const canvas=document.createElement('canvas'),ratio=Math.min(1,2048/pic.img.width,2048/pic.img.height);
  canvas.width=Math.max(1,Math.round(pic.img.width*ratio));canvas.height=Math.max(1,Math.round(pic.img.height*ratio));
  const ctx=canvas.getContext('2d')!;ctx.drawImage(pic.img,0,0,canvas.width,canvas.height);
  return regions(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,kind);
 }
 function scan(top=plan){
  if(!top)return;
  if(top.hash===arenaHash){
   const draft=arenaExample();rows=draft.screens.map(asRow);marks=draft.marks;status='Atvertas anksčiau sužymėtas Žalgirio arenos pavyzdys.';
  }else{
   rows=(front?detect(front,'screen'):[]).map((_,i)=>asRow({id:crypto.randomUUID(),name:'Ekranas '+(i+1)}));
   marks=detect(top,'point').map(p=>({...p,owner:''}));status='Spalvinio atpažinimo pasiūlymai. Patikrinkite ekranus ir priskirkite plano taškus.';
  }
  active=rows[0]?.id??'';pins={};frontPins(front,rows,top.hash===arenaHash);resetMeasure();
 }
 function addRow(){const row=asRow({id:crypto.randomUUID(),name:'Ekranas '+(rows.length+1)});rows=[...rows,row];active=row.id;}
 function number(id:string){return marks.filter(p=>p.owner===id).length;}
 function commit(action:'create'|'mounting'){
  try{
   const out:Screen[]=[],targets=new Set<string>(),created=new Map<string,string>();
   let x=screens.length?Math.max(0,...screens.map(s=>s.x+s.cols*s.panel.widthM))+1:0;
   for(const r of rows.filter(r=>r.include&&(action==='mounting'||!r.target))){
    const name=screenName(r);
    const info=rowInfo.get(r.id);
    if(!info?.screen)throw Error(name+' – '+(info?.issue||'Patikrinkite ekrano duomenis.'));
    let s=info.screen;
    if(r.target){
     if(targets.has(s.id))throw Error('Tas pats projekto ekranas pasirinktas du kartus.');
     targets.add(s.id);
    }else{
     s={...makeScreen(s.panel),name,cols:s.cols,rows:s.rows,x};
     x+=s.cols*s.panel.widthM+1;created.set(r.id,s.id);
    }
    if(action==='mounting'){
     const count=number(r.id);
     if(count<2||count>8)throw Error(name+' – kabinimui reikia 2–8 patvirtintų taškų.');
     s={...s,mounting:{...(s.mounting??defaultMounting()),mode:'hanging',supportCount:count}};
    }
    out.push(s);
   }
   if(screens.length+created.size>50||out.some(s=>s.x>1000))throw Error('Viršytos projekto ribos.');
   if(!out.length)return;
   const linkedRows=created.size?rows.map(r=>created.has(r.id)?{...r,target:created.get(r.id)!}:r):rows;
   const linkedDrawing={...drawing,rows:linkedRows};
   apply(out,action,structuredClone(linkedDrawing));
   rows=linkedRows;lastPublished=JSON.stringify(linkedDrawing);
   if(action==='create')status='Projekte sukurta ekranų: '+created.size+'.';
  }catch(e){status=e instanceof Error?e.message:String(e);}
 }
 function sizeLabel(row:Row){
  const fallback=catalogueSize(row);
  const width=readMetres(row.widthText)??fallback.width,height=readMetres(row.heightText)??fallback.height;
  if(Number.isNaN(width)||Number.isNaN(height))throw Error('Patikrinkite ekrano „'+screenName(row)+'“ matmenis. Įrašykite teigiamą skaičių metrais.');
  if(width>0&&height>0){
   const unfolded=!row.widthText?.trim()&&screens.find(s=>s.id===row.target)?.curvature?.angleDeg;
   return (unfolded?'išklotinė ':'')+metres.format(width)+' × '+metres.format(height)+' m';
  }
  if(width>0)return 'plotis '+metres.format(width)+' m';
  if(height>0)return 'aukštis '+metres.format(height)+' m';
  return '';
 }
 async function downloadImage(canvas:HTMLCanvasElement,fileName:string,format:'jpg'|'png'){
  const mime=format==='jpg'?'image/jpeg':'image/png';
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,0.95));
  if(!blob||blob.type!==mime)throw Error('Nepavyko eksportuoti vaizdo '+format.toUpperCase()+' formatu.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fileName+'.'+format;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status='Paruoštas failas „'+a.download+'“.';
 }
 function exportValue(row:Row,field:DrawingField){
  const info=rowInfo.get(row.id);
  if(field==='dimensions'){
   return [sizeLabel(row),info?.assembled?'surinktas '+info.assembled:''].filter(Boolean).join(' · ');
  }
  return info?.[field]??'';
 }
 async function exportScreenList(){
  try{
   const fields=exportFields.filter(f=>selectedFields.includes(f.key));
   const entries=rows.map(row=>{
    const info=rowInfo.get(row.id);
    return [screenName(row),info?.screen?.panel.name||row.model||'—',...fields.map(f=>exportValue(row,f.key)||'—')];
   });
   if(!entries.length)return;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error();
   ctx.font='24px sans-serif';
   const headings=['Pavadinimas','Modelis',...fields.map(f=>f.label)];
   const widths=headings.map((heading,i)=>Math.ceil(Math.min(1300,Math.max(ctx.measureText(heading).width,...entries.map(e=>ctx.measureText(e[i]).width)))));
   const offsets:number[]=[];let tableWidth=32;
   for(const width of widths){offsets.push(tableWidth);tableWidth+=width+32;}
   canvas.width=tableWidth;canvas.height=106+entries.length*50;
   ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.fillStyle='#17252e';ctx.font='bold 28px sans-serif';ctx.fillText('Ekranų informacija',32,46);
   ctx.font='bold 18px sans-serif';headings.forEach((s,i)=>ctx.fillText(s,offsets[i],84,widths[i]));
   ctx.font='24px sans-serif';
   entries.forEach((entry,i)=>{
    const y=96+i*50;
    ctx.fillStyle=i%2?'#fff':'#edf2f5';ctx.fillRect(0,y,canvas.width,50);
    ctx.fillStyle='#17252e';entry.forEach((s,col)=>ctx.fillText(s,offsets[col],y+34,widths[col]));
   });
   await downloadImage(canvas,'Ekranų informacija',exportFormat);
  }catch(e){status=(e instanceof Error&&e.message)||'Nepavyko eksportuoti ekranų sąrašo.';}
 }
 function renderView(ctx:CanvasRenderingContext2D,pic:Picture,view:'front'|'plan'){
  const w=pic.img.naturalWidth,h=pic.img.naturalHeight;
  ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
  ctx.drawImage(pic.img,0,0);
  const labels:DrawingAnnotations['screens']=[];
  rows.forEach((row,index)=>{
   let anchor:Point|undefined;
   if(view==='front')anchor=pins[pic.hash]?.[row.id];
   else{
    const assigned=marks.filter(m=>m.owner===row.id);
    if(assigned.length){
     const center={x:assigned.reduce((sum,m)=>sum+m.x,0)/assigned.length,
                   y:assigned.reduce((sum,m)=>sum+m.y,0)/assigned.length};
     anchor=assigned.reduce((near,m)=>distance(m,center,pic)<distance(near,center,pic)?m:near);
    }
   }
   if(anchor){
    const parts=['E'+(index+1),screenName(row)];
    for(const field of exportFields){
     if(!selectedFields.includes(field.key))continue;
     const value=exportValue(row,field.key);
     if(value)parts.push(field.prefix+value);
    }
    labels.push({point:anchor,label:parts.join(' · ')});
   }
  });
  drawAnnotations(ctx,w,h,{
   marks:view==='plan'?marks:[],screens:labels,
   groups:view==='plan'?groups.map((points,i)=>({
    name:groupName(i),points,
    distances:scale?points.slice(1).map((pt,j)=>fmt(distance(points[j],pt,pic)*scale)+' m'):[]
   })):[]
  });
  ctx.restore();
 }
 async function exportDrawing(view:'front'|'plan'|'both',format:'jpg'|'png'){
  try{
   const sheets:{view:'front'|'plan';pic:Picture;title:string}[]=[];
   if(view!=='plan'&&front)sheets.push({view:'front',pic:front,title:'Vaizdas iš priekio'});
   if(view!=='front'&&plan)sheets.push({view:'plan',pic:plan,title:'Planas iš viršaus'});
   const combined=view==='both';
   if(!sheets.length||(combined&&sheets.length!==2))return;
   const canvas=document.createElement('canvas');
   const w=canvas.width=Math.max(...sheets.map(s=>s.pic.img.naturalWidth));
   const titleSize=Math.max(16,Math.round(w/100)),header=combined?titleSize*2:0;
   canvas.height=sheets.reduce((sum,s)=>sum+header+s.pic.img.naturalHeight,0);
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error();
   if(combined||format==='jpg'){ctx.fillStyle='white';ctx.fillRect(0,0,w,canvas.height);}
   let y=0;
   for(const sheet of sheets){
    if(combined){
     ctx.fillStyle='#eaf0f2';ctx.fillRect(0,y,w,header);
     ctx.font='600 '+titleSize+'px sans-serif';ctx.textBaseline='middle';ctx.fillStyle='#183942';
     ctx.fillText(sheet.title,titleSize,y+header/2);y+=header;
    }
    ctx.save();ctx.translate(Math.floor((w-sheet.pic.img.naturalWidth)/2),y);
    renderView(ctx,sheet.pic,sheet.view);
    ctx.restore();y+=sheet.pic.img.naturalHeight;
   }
   const base=sheets[0].pic.name.replace(/\.[^.]+$/,'');
   const suffix=combined?' - priekis ir planas':view==='front'?' - priekis':' - planas';
   await downloadImage(canvas,base+suffix,format);
  }catch(e){status=(e instanceof Error&&e.message)||'Nepavyko eksportuoti brėžinio '+format.toUpperCase()+' formatu.';}
 }
</script>
<svelte:window on:keydown={updateModifier} on:keyup={updateModifier} on:blur={()=>{shiftHeld=false;hover=undefined;}}/>
{#snippet screenInformation()}
 <details class="import-settings" bind:open={infoOpen}>
 <summary>Ekranų informacija ({rows.length})</summary>
 <div class="settings-body">
 {#each rows as r,i (r.id)}
 {@const fallback=catalogueSize(r)}
 {@const info=rowInfo.get(r.id)}
 <div class="info-row">
 <div class="controls">
 <label>E{i+1} · Pavadinimas<input aria-label="Ekrano pavadinimas" value={r.customName??screenName(r)} placeholder={screens.find(s=>s.id===r.target)?.name||r.name} on:input={e=>r.customName=e.currentTarget.value}/></label>
 {#if r.target}<span class="reading">Modelis<strong>{info?.screen?.panel.name??'—'}</strong></span>
 {:else}<label>Panelės modelis<select aria-label="Panelės modelis" bind:value={r.model}><option value="">Pasirinkite modelį</option>{#each catalog as p}<option value={p.name}>{p.name}</option>{/each}</select></label>{/if}
 <label>Plotis, m<input class="size" inputmode="decimal" placeholder={fallback.width?metres.format(fallback.width):'—'} bind:value={r.widthText} aria-invalid={Number.isNaN(readMetres(r.widthText))}/></label>
 <label>Aukštis, m<input class="size" inputmode="decimal" placeholder={fallback.height?metres.format(fallback.height):'—'} bind:value={r.heightText} aria-invalid={Number.isNaN(readMetres(r.heightText))}/></label>
 {#if Number.isNaN(readMetres(r.widthText))||Number.isNaN(readMetres(r.heightText))}<small>Matmenis įrašykite teigiamais skaičiais.</small>{/if}
 <span class="reading">Raiška<strong>{info?.resolution||'—'}</strong></span>
 <span class="reading">Galia pagal katalogą<strong>{info?.power||'—'}</strong></span>
 <span class="reading">UTP portai su atsarga<strong>{info?.utp||'—'}</strong></span>
 {#if info?.assembled}<span class="reading">Surinktas dydis<strong>{info.assembled}</strong></span>{/if}
 </div>
 <div class="controls"><input type="checkbox" aria-label={'Importuoti '+screenName(r)} bind:checked={r.include}/><button class:current={active===r.id} aria-pressed={active===r.id} title="Pasirinkti žymimą ekraną" on:click={()=>active=r.id}>{screenName(r)}{#if plan} · {number(r.id)} tšk.{/if}</button>
 {#if active===r.id&&front&&pins[front.hash]?.[r.id]}<button on:click={()=>unpinFront(r.id)}>Nuimti žymę</button>{/if}
 <select aria-label="Projekto ekranas" bind:value={r.target}><option value="">Naujas ekranas</option>{#each screens as s}<option value={s.id}>{s.name}</option>{/each}</select>
 {#if !r.target}<span>Panelės</span>
 <input class="size" aria-label="Stulpeliai" placeholder="Stulp." type="number" min="1" max="100" value={info?.cols||''} on:input={e=>{r.cols=e.currentTarget.valueAsNumber||null;r.widthText='';}}/> ×
 <input class="size" aria-label="Eilės" placeholder="Eilės" type="number" min="1" max="100" value={info?.height||''} on:input={e=>{r.rows=e.currentTarget.valueAsNumber||null;r.heightText='';}}/>{/if}</div></div>
 {/each}
 <div class="controls"><button on:click={addRow}>＋ Ekranas</button>
 <button class="primary" disabled={!newCount} on:click={()=>commit('create')}>Sukurti ekranus projekte ({newCount})</button></div>
 </div></details>
{/snippet}
<section class="importer">
 <label>Įkelti brėžinius ir vizualizacijas <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} on:change={e=>load(e.currentTarget)} /></label>
 {#if files.length}
 <div class="controls"><label>Planas iš viršaus<select value={planHash} disabled={busy} on:change={e=>{if(!confirm('Pakeisti planą ir iš naujo sužymėti taškus?')){e.currentTarget.value=planHash;return;}planHash=e.currentTarget.value;scan(files.find(f=>f.hash===planHash));}}><option disabled value="">Pasirinkite planą</option>{#each files as f}<option value={f.hash}>{f.name}</option>{/each}</select></label>
 <label>Vaizdas ekranams atpažinti<select value={frontHash} disabled={busy} on:change={e=>{frontHash=e.currentTarget.value;const next=files.find(f=>f.hash===frontHash);if(next&&!pins[next.hash]&&plan?.hash===arenaHash&&rows.some(r=>r.id==='0'))frontPins(next,rows,true);}}><option value="">Nepasirinkta</option>{#each files as f}<option value={f.hash}>{f.name}</option>{/each}</select></label>
 <button on:click={()=>{if(confirm('Atnaujinti pasiūlymus ir pakeisti rankinius žymėjimus?'))scan();}}>Atpažinti iš naujo</button></div>
 {/if}
 {#if front}
 <div class="controls picture-heading"><h3>Vaizdas iš priekio</h3>
 <button aria-expanded={showFront} on:click={()=>showFront=!showFront}>{showFront?'Slėpti vaizdą':'Rodyti vaizdą'}</button>
 </div>
 <div class="picture-body" hidden={!showFront}>
 {#key front.hash}<DrawingViewport label="Vaizdas iš priekio" aspect={front.img.naturalWidth/front.img.naturalHeight}><button class="drawing" aria-label="Žymėti ekraną" on:click={pinFront}><img src={front.url} alt="Priekinis ekranų vaizdas"/></button>
 {#each rows as r,i}{@const pt=pins[front.hash]?.[r.id]}{#if pt}<button class="pin" class:current={r.id===active} aria-pressed={r.id===active} aria-label={'E'+(i+1)+' · '+screenName(r)} style:left={pt.x*100+'%'} style:top={pt.y*100+'%'} title={screenName(r)} on:click={()=>active=r.id}>{i+1}</button>{/if}{/each}</DrawingViewport>{/key}
 </div>
 {@render screenInformation()}
 {/if}
 {#if plan}
 <div class="controls picture-heading"><h3>Planas iš viršaus</h3>
 <button aria-expanded={showPlan} on:click={()=>showPlan=!showPlan}>{showPlan?'Slėpti vaizdą':'Rodyti vaizdą'}</button>
 </div>
 <div class="picture-body" hidden={!showPlan}>
 {#key plan.hash}<DrawingViewport label="Planas iš viršaus" aspect={plan.img.naturalWidth/plan.img.naturalHeight}>
 <button class="drawing" aria-label="Pridėti tašką plane" on:pointermove={e=>trackPointer(e)} on:pointerleave={()=>hover=undefined} on:click={e=>{const p=location(e);if(mode!=='mark'){pick(p,e.shiftKey);return;}if(active&&!deleteMode)marks=[...marks,{...p,owner:active}];}}><img src={plan.url} draggable="false" alt="Įkeltas pakabinimo planas"/></button>
 {#each marks as m,i}{@const owner=rows.find(r=>r.id===m.owner)}<button class="dot" class:selected={m.owner===active&&!!active} class:assigned={!!m.owner} style:left={m.x*100+'%'} style:top={m.y*100+'%'} aria-label={'Taškas '+(i+1)} title={owner?screenName(owner):'Nepriskirtas'} on:pointermove={e=>trackPointer(e,m)} on:pointerleave={()=>hover=undefined} on:click={e=>{if(mode!=='mark'){pick(m,e.shiftKey);return;}if(deleteMode)marks=marks.filter((_,j)=>i!==j);else if(active)marks=marks.map((p,j)=>i===j?{...p,owner:p.owner===active?'':active}:p);}}></button>{/each}
 <svg class="overlay" viewBox={'0 0 '+plan.img.width+' '+plan.img.height} aria-hidden="true">
 {#each (mode==='scale'?[reference]:groups) as points,g}
 {@const prefix=mode==='scale'?'M':groupName(g)}
 {#each points as pt,i}
 {@const prev=points[i-1]}
 {#if prev}<line x1={prev.x*plan.img.width} y1={prev.y*plan.img.height} x2={pt.x*plan.img.width} y2={pt.y*plan.img.height}/>
 {#if scale&&mode!=='scale'}<text x={(prev.x+pt.x)/2*plan.img.width} y={(prev.y+pt.y)/2*plan.img.height-6}>{fmt(distance(prev,pt,plan)*scale)} m</text>{/if}{/if}
 <circle cx={pt.x*plan.img.width} cy={pt.y*plan.img.height} r="4"/><text x={pt.x*plan.img.width} y={pt.y*plan.img.height+20}>{prefix}{i+1}</text>{/each}
 {/each}
 {#if anchor&&preview}
 <g class="preview"><line x1={anchor.x*plan.img.width} y1={anchor.y*plan.img.height} x2={preview.x*plan.img.width} y2={preview.y*plan.img.height}/>
 <circle cx={preview.x*plan.img.width} cy={preview.y*plan.img.height} r="4"/></g>
 {/if}
 </svg>
 </DrawingViewport>{/key}
 </div>
 <details class="measurements" bind:open={measureOpen}>
 <summary>Taškai ir atstumai</summary>
 <div class="settings-body">
 <div class="controls"><button class:current={mode==='mark'} on:click={()=>mode='mark'}>Kabinimo taškai ({marks.length})</button>
 <button class:current={mode==='scale'} on:click={()=>{mode='scale';deleteMode=false;}}>Nustatyti mastelį</button>
 <button disabled={!scale} class:current={mode==='measure'} on:click={()=>{mode='measure';deleteMode=false;}}>Matuoti atstumus</button></div>
 {#if mode==='scale'}<div class="controls"><span>Pažymėkite žinomo ilgio atkarpos galus ({reference.length}/2).</span>
 {#if rows.some(r=>screenWidth(r)>0)}
 <label>Naudoti ekrano plotį<select value="" on:change={e=>{
  const row=rows.find(r=>r.id===e.currentTarget.value);
  if(row){known=screenWidth(row);reference=[];status='Plane pažymėkite abu ekrano „'+screenName(row)+'“ pločio galus.';}
  e.currentTarget.value='';
 }}><option value="">Pasirinkite ekraną</option>{#each rows as r}{#if screenWidth(r)>0}<option value={r.id}>{screenName(r)} · {metres.format(screenWidth(r))} m</option>{/if}{/each}</select></label>{/if}
 <label>Žinomas atstumas, m<input type="number" min="0" step="any" bind:value={known}/></label><button disabled={reference.length!==2||!known||known<=0} on:click={calibrate}>Taikyti mastelį</button></div>{/if}
 {#if mode==='measure'}<div class="controls"><strong>Matavimas {groupName(completed.length)}</strong><span>Pažymėkite {groupName(completed.length)}{chain.length+1}.</span><button disabled={!chain.length} on:click={()=>chain=chain.slice(0,-1)}>Atšaukti tašką</button><button disabled={chain.length<2} on:click={newMeasurement}>Naujas matavimas</button></div>{/if}
 {#if mode==='mark'}<div class="controls">
 {#if deleteMode}<small>Spustelėkite tašką, kurį norite pašalinti.</small>
 {:else}<small>Pasirinkite ekraną jo informacijos eilutėje ir pažymėkite taškus plane.</small>{/if}
 <button aria-pressed={deleteMode} on:click={()=>deleteMode=!deleteMode}>{deleteMode?'Baigti trynimą':'Trinti taškus'}</button></div>
 {:else}<small>Laikykite <kbd>Shift</kbd>, kad atkarpa būtų horizontali arba vertikali.</small>{/if}
  <h4>Išmatuoti atstumai</h4>
  {#if groups.some(points=>points.length>1)}
   {#each groups as points,g}
    {#if points.length>1}
     {@const prefix=groupName(g)}
     <div class="measure-group"><strong>Matavimas {prefix}</strong>
      <ul>{#each points.slice(1) as pt,i}
       <li><span>{prefix}{i+1}–{prefix}{i+2}</span>
        <b>{scale?fmt(distance(points[i],pt,plan)*scale)+' m':'Nustatykite mastelį'}</b>
       </li>{/each}</ul>
     </div>
    {/if}
   {/each}
  {:else}<small>{scale?'Pažymėkite du taškus plane.':'Nustatykite mastelį ir pažymėkite du taškus plane.'}</small>{/if}
 <div class="controls mounting-transfer">
 <small>Į „Kabinimą“ perkeliami pažymėtų ekranų taškų skaičiai. Atstumus tarp taškų skaičiuoklė modeliuoja vienodus.</small>
 <button disabled={!rows.some(r=>r.include)} on:click={()=>commit('mounting')}>Patvirtinti ir perkelti į kabinimą</button>
 </div>
 </div></details>
 {#if !front}{@render screenInformation()}{/if}
 {/if}
 {#if front||plan}
 <section class="export-panel" aria-labelledby="drawing-export-title">
  <h3 id="drawing-export-title">Eksportas</h3>
  <p>{#if front}Priekiniame vaizde rodomi ekranų pavadinimai. {/if}{#if plan}Plane iš viršaus rodomi išmatuoti atstumai.{/if}</p>
  <fieldset>
   <legend>Papildomi ekranų duomenys</legend>
   <div class="export-options">
    {#each exportFields as field}
     <label><input type="checkbox" value={field.key} bind:group={selectedFields}/> {field.label}</label>
    {/each}
   </div>
  </fieldset>
  <div class="controls export-actions">
   <label>Formatas <select bind:value={exportFormat}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
   <button disabled={!front} on:click={()=>exportDrawing('front',exportFormat)}>Eksportuoti vaizdą iš priekio</button>
   <button disabled={!plan} on:click={()=>exportDrawing('plan',exportFormat)}>Eksportuoti planą iš viršaus</button>
   <button disabled={!front||!plan} on:click={()=>exportDrawing('both',exportFormat)}>Abu viename lape</button>
   <button class="list-export" disabled={!rows.length} on:click={exportScreenList}>Ekranų sąrašas</button>
  </div>
 </section>
 {/if}
 {#if status}<p role="status">{status}</p>{/if}
</section>
<style>
 .picture-heading h3{margin:0 auto 0 0}.picture-body{display:grid;gap:.75rem;min-width:0}.picture-body[hidden]{display:none}

 .controls button:where(:not(.current,.primary)){color:#edf3f8;background:#263340;border:1px solid #526376;padding:6px 10px}
 .controls button.current{background:#72dece;color:#102422;border-color:#72dece;padding:6px 10px}
 .controls button:disabled,.settings-body button:disabled{opacity:1;color:#b5c2cf;background:#25303a;border-color:#394553;cursor:default}
 .importer :global(.zoom-controls button:disabled){opacity:1;color:#a4b2c0}
 .measurements,.import-settings,.export-panel{padding:12px;border:1px solid #344251;border-radius:7px;background:#19222c}
 .measurements h4{margin:.5rem 0 0;font-size:14px}.measure-group{display:flex;align-items:baseline;gap:1em;flex-wrap:wrap;padding:5px 0}
 .measure-group ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5em 1.2em}
 .measure-group li{display:flex;gap:.45em;font-variant-numeric:tabular-nums}.measure-group li span{color:#c0cedb}
 .importer summary{cursor:pointer;font-weight:600}.settings-body{display:grid;gap:.6rem;margin-top:.75rem}
 .mounting-transfer{padding-top:.7rem;border-top:1px solid #344251}
 .export-panel{display:grid;gap:.65rem}.export-panel h3,.export-panel p{margin:0}.export-panel p{font-size:.9em;color:#c0cedb}
 .export-panel fieldset{border:0;margin:0;padding:0;min-width:0}.export-panel legend{font-weight:600;padding:0;margin-bottom:.35rem}
 .export-options{display:flex;gap:.5rem 1rem;flex-wrap:wrap}.export-options label,.controls.export-actions label{display:flex;align-items:center;gap:.4rem}
 .export-options input{width:1rem;height:1rem;margin:0;accent-color:#72dece}.export-actions{padding-top:.65rem;border-top:1px solid #344251}
 .export-actions .list-export{margin-inline-start:auto}
 @media(max-width:700px){.export-actions .list-export{margin-inline-start:0}}
 .info-row{display:grid;gap:.5rem;padding:.5rem 0 .75rem;border-bottom:1px solid #344251}.info-row input[aria-invalid=true]{border-color:#e9a070}
 .reading{display:grid;gap:.25rem;font-size:.85em;color:#c0cedb}.reading strong{color:#edf3f8;font-variant-numeric:tabular-nums}

 .pin{position:absolute;transform:translate(-50%,-50%);border:1px solid white;background:#143046;color:white;border-radius:50%;min-width:24px;padding:.15rem}
 .drawing{user-select:none;-webkit-user-select:none}.overlay .preview line{stroke-dasharray:5 4}.overlay .preview circle{fill:white;stroke:#dd3860;vector-effect:non-scaling-stroke}
 .overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.overlay line{stroke:#dd3860;stroke-width:2;vector-effect:non-scaling-stroke}.overlay circle{fill:#dd3860;stroke:white}.overlay text{font:bold 16px sans-serif;text-anchor:middle;fill:#111;stroke:white;stroke-width:3;paint-order:stroke}

 .importer{display:grid;grid-template-columns:minmax(0,1fr);gap:.75rem}.controls{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.controls select{max-width:100%}.controls label{display:grid;gap:.25rem}.size{width:6em}.drawing{padding:0;display:block;background:white;border:0;width:100%;line-height:0}.drawing img{width:100%;height:auto;display:block}.dot{position:absolute;padding:0;width:11px;height:11px;border:2px solid #8c4200;border-radius:50%;background:#ffe087;transform:translate(-50%,-50%)}.dot.assigned{background:#a1b6c5;border-color:#314658}.dot.selected,.current{outline:2px solid #009591;background:#8bfff1;color:#102422}.importer label{font-weight:600}
</style>
