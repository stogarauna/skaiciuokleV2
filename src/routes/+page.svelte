<script lang="ts">
 import {stageboxPlan} from '$lib/stagebox';
 import PanelSpecs from '$lib/PanelSpecs.svelte';
 import {downloadDXF} from '$lib/dxf';
 import {createPixelMap,pixelMapDimensions,type PixelMapFormat} from '$lib/pixel-map';
 import UsagePreference from '$lib/UsagePreference.svelte';
 import Mounting from '$lib/Mounting.svelte';
 import {resolveEquipmentWeights,type EquipmentWeights} from '$lib/mounting';
 import Power from '$lib/Power.svelte';
 import {defaultPowerSettings} from '$lib/power';
 import Signal from '$lib/Signal.svelte';
 import Transport from '$lib/Transport.svelte';
 import type {Box} from '$lib/transport';
 import FohDiagram from '$lib/FohDiagram.svelte';
 import type {DeviceLibrary} from '$lib/device-library';
 import Geometry from '$lib/Geometry.svelte';
 import ZoomControls from '$lib/ZoomControls.svelte';
 import {angleIssue,geometry} from '$lib/geometry';
 import {onMount,tick} from 'svelte';
 import {makeScreen,stats,parseProject,resolvePanelDepth,uid,type Panel,type Screen,type Project} from '$lib/project';
 export let data:{cargo:Box[];deviceLibrary:DeviceLibrary;panels:Panel[];equipmentWeights:EquipmentWeights;usage:'allowed'|'declined'|'undecided'|null;user:{username:string;role:'admin'|'user'}};
 $: catalog=data.panels;
 $: equipmentWeights=resolveEquipmentWeights(project.equipmentWeights,data.equipmentWeights);
 const first=data.panels.find(p=>p.name==='P2 YESTECH')??data.panels[0];
 let project:Project={version:1,name:'Naujas LED projektas',screens:first?[makeScreen(first)]:[]};
 let selected=project.screens[0]?.id??'';
 let ready=false;let saveState='';let message='';let showCatalog=false;let query='';
 const viewTabs=[{id:'screen',label:'Ekranas'},{id:'project',label:'Projektas'}] as const;
 const workTabs=[{id:'mounting',label:'Kabinimas'},{id:'geometry',label:'Lenkimas'},{id:'signal',label:'Komutacija'},{id:'power',label:'Maitinimas'},{id:'foh',label:'Signalo schemos'},{id:'transport',label:'Transportas'}] as const;
 type WorkspaceMode=(typeof viewTabs)[number]['id']|(typeof workTabs)[number]['id'];
 const modeTitles:Record<WorkspaceMode,string>={
  screen:'Ekrano išklotinė',project:'Projekto vaizdas',signal:'Signalo komutacija',
  power:'Maitinimo komutacija',geometry:'Forma ir lenkimas',mounting:'Montavimas ir svoris',foh:'Signalo schemos',transport:'Transporto pakrovimas'
 };
 let mode:WorkspaceMode='screen';let tool:'select'|'edit'='select';let numbers=true;let dimensions=true;let zoom=100;
 let pdfBusy=false;
 let pixelMapBusy=false;
 let units:'panels'|'meters'='panels';let targetW=4;let targetH=2.5;
 let undoStack:string[]=[];let redoStack:string[]=[];let svg:SVGSVGElement;
 let drag:{id:string;startX:number;startY:number;x:number;y:number;viewBox:string}|null=null;
 const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n);
 $: screen=project.screens.find(s=>s.id===selected)??project.screens[0];
 $: distribution=mode==='power'?stageboxPlan(project.screens):null;
 $: panelSpecs=screen?resolvePanelDepth(screen.panel,catalog):null;
 $: result=screen?stats(screen):null;
 $: mappingSize=screen?pixelMapDimensions(screen):null;
 $: ratioRows=screen?Math.max(1,Math.min(100,Math.floor(5000/screen.cols),Math.round(screen.cols*screen.panel.widthM*9/(16*screen.panel.heightM)))):1;
 $: ratioExact=screen?Math.abs(screen.cols*screen.panel.widthM*9-ratioRows*screen.panel.heightM*16)<1e-8:false;
 $: totals=project.screens.reduce((a,s)=>{const t=stats(s);return {n:a.n+t.n,area:a.area+t.area,weight:a.weight+(t.weight??0),power:a.power+(t.power??0),missingWeight:a.missingWeight||(t.n>0&&t.weight===null),missingPower:a.missingPower||(t.n>0&&t.power===null)};},{n:0,area:0,weight:0,power:0,missingWeight:false,missingPower:false});
 $: visible=mode==='project'?project.screens:screen?[{...screen,x:0,y:0}]:[];
 $: bounds=visible.length?{minX:Math.min(...visible.map(s=>s.x)),minY:Math.min(...visible.map(s=>s.y)),maxX:Math.max(...visible.map(s=>s.x+s.cols*s.panel.widthM)),maxY:Math.max(...visible.map(s=>s.y+s.rows*s.panel.heightM))}:{minX:0,minY:0,maxX:4,maxY:3};
 $: boxW=Math.max(5,bounds.maxX-bounds.minX+2.6)*100/zoom;
 $: boxH=Math.max(4,bounds.maxY-bounds.minY+2.6)*100/zoom;
 $: viewBox=drag?drag.viewBox:`${(bounds.minX+bounds.maxX-boxW)/2} ${(bounds.minY+bounds.maxY-boxH)/2} ${boxW} ${boxH}`;
 $: filtered=catalog.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
 $: if(ready){persist(project);}
 onMount(()=>{
  try{
   const saved=localStorage.getItem('led-studija-project-v1');
   if(saved){project=parseProject(JSON.parse(saved),catalog);selected=project.screens[0]?.id??'';}
  }catch{message='Nepavyko atkurti išsaugoto projekto. Galite atidaryti projekto JSON.';}
  ready=true;
 });
 function focusModal(node:HTMLElement){const previous=document.activeElement as HTMLElement;const get=()=>Array.from(node.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')).filter(e=>!e.hasAttribute('disabled'));get()[0]?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){showCatalog=false;}if(e.key==='Tab'){const items=get();const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};node.addEventListener('keydown',handler);return {destroy(){node.removeEventListener('keydown',handler);previous?.focus();}};}
 function persist(p:Project){try{localStorage.setItem('led-studija-project-v1',JSON.stringify(p));saveState='Išsaugota šiame įrenginyje';}catch{saveState='Nepavyko išsaugoti';}}
 function checkpoint(){undoStack=[...undoStack.slice(-39),JSON.stringify(project)];redoStack=[];}
 function update(patch:Partial<Screen>){if(!screen)return;if(patch.panel&&screen.mounting)patch={...patch,mounting:{...screen.mounting,frame1Kg:undefined,frameHalfKg:undefined}};const candidate={...screen,...patch};const issue=angleIssue(candidate);if(issue){if(patch.panel){patch={...patch,curvature:{angleDeg:0}};message='Naujam modeliui lenkimas grąžintas į 0°. '+issue;}else{message=issue;return;}}checkpoint();project={...project,equipmentWeights:project.equipmentWeights??(patch.mounting?structuredClone(data.equipmentWeights):undefined),screens:project.screens.map(s=>s.id===screen.id?{...s,...patch}:s)};}
 function resize(cols:number,rows:number){cols=Math.max(1,Math.min(100,Math.round(cols)||1));rows=Math.max(1,Math.min(100,Math.round(rows)||1));if(cols*rows>5000){message='Vienam ekranui leidžiama iki 5 000 panelių.';return;}update({cols,rows,removed:screen.removed.filter(k=>{const [c,r]=k.split(',').map(Number);return c<cols&&r<rows;})});}
 function metricSize(){resize(Math.ceil((targetW||0.5)/screen.panel.widthM),Math.ceil((targetH||0.5)/screen.panel.heightM));}
 function toggle(c:number,r:number,id=screen.id){const target=project.screens.find(s=>s.id===id);if(!target)return;const key=`${c},${r}`;checkpoint();project={...project,screens:project.screens.map(s=>s.id===id?{...s,removed:target.removed.includes(key)?target.removed.filter(k=>k!==key):[...target.removed,key]}:s)};}
 function add(panel:Panel){if(project.screens.length>=50){message='Projekte leidžiama iki 50 ekranų.';return;}checkpoint();const s=makeScreen(panel,project.screens.length);if(project.screens.length)s.x=Math.max(0,...project.screens.map(p=>p.x+p.cols*p.panel.widthM))+1;project={...project,screens:[...project.screens,s]};selected=s.id;showCatalog=false;}
 function remove(){if(project.screens.length===1)return;checkpoint();project={...project,screens:project.screens.filter(s=>s.id!==selected)};selected=project.screens[0]?.id??'';}
 function clearScreens(){
  if(!project.screens.length||!window.confirm('Išvalyti visus šio projekto ekranus?'))return;
  checkpoint();
  project={...project,screens:[]};
  selected='';
  drag=null;
  mode='screen';
  message='Visi ekranai išvalyti.';
 }
 function undo(){if(!undoStack.length)return;redoStack=[...redoStack,JSON.stringify(project)];project=JSON.parse(undoStack.at(-1)!);undoStack=undoStack.slice(0,-1);selected=project.screens.some(s=>s.id===selected)?selected:project.screens[0]?.id??'';}
 function redo(){if(!redoStack.length)return;undoStack=[...undoStack,JSON.stringify(project)];project=JSON.parse(redoStack.at(-1)!);redoStack=redoStack.slice(0,-1);selected=project.screens.some(s=>s.id===selected)?selected:project.screens[0]?.id??'';}
 function download(content:Blob,name:string){const url=URL.createObjectURL(content);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportJSON(){const snapshot=project.equipmentWeights?{...project,equipmentWeights}:project;download(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}),'LED-projektas.json');}
 async function importJSON(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw Error('Failas per didelis.');const p=parseProject(JSON.parse(await file.text()),catalog);checkpoint();project=p;selected=p.screens[0]?.id??'';message='Projektas sėkmingai atidarytas.';}catch(e){message=e instanceof Error?e.message:'Nepavyko atidaryti projekto.';}input.value='';}
 function point(e:PointerEvent){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform(svg.getScreenCTM()!.inverse());}
 function startDrag(e:PointerEvent,s:Screen){selected=s.id;if(mode!=='project'||tool!=='select')return;checkpoint();const p=point(e);drag={id:s.id,startX:p.x,startY:p.y,x:s.x,y:s.y,viewBox};svg.setPointerCapture(e.pointerId);}
 function moveDrag(e:PointerEvent){if(!drag)return;const p=point(e);const d=drag;project={...project,screens:project.screens.map(s=>s.id===d.id?{...s,x:Math.round((d.x+p.x-d.startX)*10)/10,y:Math.round((d.y+p.y-d.startY)*10)/10}:s)};}
 async function exportPDF(){if(pdfBusy)return;pdfBusy=true;const snapshot=structuredClone(project);
  snapshot.equipmentWeights=structuredClone(equipmentWeights);
  if(mode==='power'){
   const active=snapshot.screens.find(s=>s.id===screen?.id);
   if(active&&!active.powerRouting)active.powerRouting={...defaultPowerSettings};
  }
  try{const [{createProjectPDF,pdfFilename},response]=await Promise.all([import('$lib/pdf'),fetch('/fonts/OpenSans-Latin.base64')]);if(!response.ok)throw Error('Nepavyko įkelti PDF šrifto.');const doc=createProjectPDF(snapshot,await response.text());download(doc.output('blob'),pdfFilename(snapshot.name));}catch(e){message='Nepavyko sukurti PDF. Bandykite dar kartą.';console.error(e);}finally{pdfBusy=false;}}
 async function exportPixelMap(format:PixelMapFormat){
  if(!screen||pixelMapBusy)return;
  const target=screen;
  const {width,height}=pixelMapDimensions(target);
  pixelMapBusy=true;
  try{
   const {blob,filename}=await createPixelMap(target,format);
   download(blob,filename);
  }catch{
   message=`Nepavyko eksportuoti ${width} × ${height} px pikselių žemėlapio ${format.toUpperCase()} formatu.`;
  }finally{
   pixelMapBusy=false;
  }
 }
 function exportDXF(){try{downloadDXF(visible,mode==='project'?project.name:screen.name,catalog);}catch{message='Nepavyko eksportuoti DXF.';}}
 async function exportPNG(){if(!svg)return;const clone=svg.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','2000');clone.setAttribute('height','1400');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1400;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#10151d';ctx.fillRect(0,0,2000,1400);ctx.drawImage(img,0,0);canvas.toBlob(b=>{if(b)download(b,'LED-2D-planas.png');},'image/png');}catch{message='Nepavyko eksportuoti PNG.';}finally{URL.revokeObjectURL(url);}}
</script>

<svelte:head><title>LED Studija · 2D projektavimas</title><meta name="description" content="LED ekranų 2D planavimas, panelių katalogas, svorio ir galios skaičiuoklė." /></svelte:head>

<div class="app-shell">
 <header class="topbar">
  <a href="/" class="brand"><span class="brand-mark">▦</span><span>LED<span class="brand-light">STUDIJA</span><small>EKRANŲ PLANAVIMAS</small></span></a>
  <div class="project-title"><input aria-label="Projekto pavadinimas" value={project.name} on:change={e=>{checkpoint();project={...project,name:e.currentTarget.value};}} /><span><i></i> {saveState||'2D darbo aplinka'}</span></div>
  <div class="header-actions"><label class="button secondary">↥ <span>Atidaryti</span><input class="file-input" type="file" accept=".json,application/json" on:change={importJSON} /></label><button class="secondary" on:click={exportJSON}>↓ <span>Išsaugoti</span></button><button class="primary" on:click={exportPDF} disabled={pdfBusy||!project.screens.length}>↓ <span>{pdfBusy?'Ruošiamas PDF…':'Suvestinė'}</span></button>{#if data.user.role==='admin'}<a href="/admin" class="button secondary">Administravimas</a>{/if}<form method="POST" action="/logout"><button class="secondary" title={data.user.username}>Atsijungti</button></form></div>
 </header>
 <div class="workspace" class:foh-workspace={mode==='foh'}>
  <aside class="sidebar">
   <div class="section-heading"><span>PROJEKTO EKRANAI</span><span class="count">{project.screens.length}</span></div>
   <div class="screen-list">{#each project.screens as s,i}<button class:active={s.id===selected} class="screen-card" on:click={()=>selected=s.id}><span class="screen-icon">▦</span><span><strong>{s.name}</strong><small>{s.panel.name} · {s.cols} × {s.rows}</small></span><span class="screen-index">{String(i+1).padStart(2,'0')}</span></button>{/each}</div>
   <button class="add-screen" on:click={()=>showCatalog=true}>＋ Pridėti ekraną</button>
   {#if screen}
    <button class="secondary remove-screen" type="button" disabled={project.screens.length===1} on:click={remove}>Pašalinti pasirinktą ekraną</button>
   {/if}
   {#if project.screens.length}
    <button class="secondary clear-screens" type="button" on:click={clearScreens}>Išvalyti visus ekranus</button>
   {/if}
   <div class="sidebar-divider"></div>
   {#if screen}
    <div class="section-heading">PASIRINKTAS EKRANAS</div>
    <label class="field">Pavadinimas<input value={screen.name} on:change={e=>update({name:e.currentTarget.value})} /></label>
    <label class="field">Panelio modelis<select value={screen.panel.name} on:change={e=>{const p=catalog.find(p=>p.name===e.currentTarget.value);if(p)update({panel:structuredClone(p)});}}>{#if !catalog.some(p=>p.name===screen.panel.name)}<option>{screen.panel.name}</option>{/if}{#each catalog as p}<option>{p.name}</option>{/each}</select></label>
    <button class="text-button catalog-link" on:click={()=>showCatalog=true}>▤ Atidaryti panelių katalogą <span>↗</span></button>
    <div class="section-heading space-top">EKRANO DYDIS</div>
    <div class="segmented"><button class:chosen={units==='panels'} on:click={()=>units='panels'}>Panelėmis</button><button class:chosen={units==='meters'} on:click={()=>{units='meters';targetW=screen.cols*screen.panel.widthM;targetH=screen.rows*screen.panel.heightM;}}>Metrais</button></div>
    {#if units==='panels'}
    <div class="size-fields">{#each ['Plotis','Aukštis'] as label,i}<label class="field">{label}<div class="stepper"><button aria-label={`Mažinti ${label}`} on:click={()=>resize(screen.cols-(i===0?1:0),screen.rows-(i===1?1:0))}>−</button><input aria-label={label} type="number" min="1" max="100" value={i===0?screen.cols:screen.rows} on:change={e=>resize(i===0?+e.currentTarget.value:screen.cols,i===1?+e.currentTarget.value:screen.rows)} /><button aria-label={`Didinti ${label}`} on:click={()=>resize(screen.cols+(i===0?1:0),screen.rows+(i===1?1:0))}>+</button></div></label>{/each}</div>
    {:else}<div class="size-fields"><label class="field">Plotis, m<input type="number" min="0.1" max="100" step="0.1" bind:value={targetW} /></label><label class="field">Aukštis, m<input type="number" min="0.1" max="100" step="0.1" bind:value={targetH} /></label></div><button class="secondary full" on:click={metricSize}>Pritaikyti dydį</button><p class="help">Apvalinama į didesnį pilnų panelių kiekį.</p>{/if}
    <div class="ratio-suggestion">
     <div class="ratio-heading"><strong>16:9</strong><span>{ratioExact?'Tikslus santykis':'Artimiausias aukštis'}</span></div>
     <p>{f(screen.cols*screen.panel.widthM)} × {f(ratioRows*screen.panel.heightM)} m <span>· {screen.cols} × {ratioRows} panelių</span></p>
     <button class="secondary full" disabled={screen.rows===ratioRows} on:click={()=>{resize(screen.cols,ratioRows);targetW=screen.cols*screen.panel.widthM;targetH=screen.rows*screen.panel.heightM;}}>{screen.rows===ratioRows?'Dydis pritaikytas':'Pritaikyti 16:9 pasiūlymą'}</button>
     <small>Pagal surinktą plotį, iš pilnų panelių.{#if !ratioExact} Tikslus 16:9 šiam pločiui neįmanomas.{/if}{#if screen.removed.length} Santykis taikomas bendriems gabaritams.{/if}</small>
    </div>
    <div class="actual-size"><span>Surinktas dydis</span><strong>{f(screen.cols*screen.panel.widthM)} × {f(screen.rows*screen.panel.heightM)} m</strong></div>
   {/if}
   <div class="sidebar-bottom"><span class="version-dot"></span> 2D pagrindas <span>v0.1</span></div>
  </aside>
  <main class="editor">
   <div class="editor-heading">
    <div><span class="eyebrow">DARBO APLINKA</span><h1>{modeTitles[mode]}{#if mode==='screen'||mode==='project'}<span>2D</span>{/if}</h1></div>
    <nav class="workspace-tabs" aria-label="Darbo aplinka">
     <div class="segmented" role="group" aria-label="Peržiūros">
      {#each viewTabs as tab (tab.id)}
       <button type="button" class:chosen={mode===tab.id} aria-pressed={mode===tab.id} on:click={()=>{mode=tab.id;zoom=100;}}>{tab.label}</button>
      {/each}
     </div>
     <div class="segmented" role="group" aria-label="Darbo režimai">
      {#each workTabs as tab (tab.id)}
       <button type="button" class:chosen={mode===tab.id} aria-pressed={mode===tab.id} on:click={()=>mode=tab.id}>{tab.label}</button>
      {/each}
     </div>
    </nav>
   </div>
   {#if mode==='transport'}
    <Transport boxes={data.cargo} admin={data.user.role==='admin'} plan={project.transport??{vehicle:0,lines:[]}} onchange={transport=>{checkpoint();project={...project,transport};}}/>
   {:else if mode==='foh'}
    <FohDiagram deviceLibrary={data.deviceLibrary} canManageLibrary={data.user.role==='admin'} projectName={project.name} diagram={project.fohDiagram} onchange={fohDiagram=>{checkpoint();project={...project,fohDiagram};}}
     ondownload={download} onundo={undo} onredo={redo} canUndo={undoStack.length>0} canRedo={redoStack.length>0}/>
   {:else if !screen}
    <div class="canvas-frame empty-project">
     <p>Projekte nėra ekranų.</p>
     <div class="empty-actions">
      <button class="primary" type="button" on:click={()=>showCatalog=true}>＋ Pridėti ekraną</button>
      {#if undoStack.length}<button class="secondary" type="button" on:click={undo}>↶ Atšaukti</button>{/if}
      {#if redoStack.length}<button class="secondary" type="button" on:click={redo}>↷ Pakartoti</button>{/if}
     </div>
    </div>
   {:else if mode==='signal'}
    {#if screen}
     {#key screen.id}<Signal {screen} onchange={signal=>update({signal})} />{/key}
    {/if}
   {:else if mode==='power'}
    {#if screen&&distribution}
     {#key screen.id}<Power {screen} {distribution} onchange={powerRouting=>update({powerRouting})} />{/key}
    {/if}
   {:else if mode==='geometry'}
    {#key screen.id}<Geometry {screen} {catalog} onchange={angle=>update({curvature:{angleDeg:angle}})} />{/key}
   {:else if mode==='mounting'}
    {#key screen.id}<Mounting {screen} weights={equipmentWeights} onchange={mounting=>update({mounting})} />{/key}
   {:else}
   <div class="canvas-frame">
    <div class="canvas-toolbar"><div class="tool-group"><button title="Pasirinkti ir perkelti ekraną" aria-label="Pasirinkti" class:tool-active={tool==='select'} on:click={()=>tool='select'}>↖</button><button title="Įjungti arba išjungti paneles" aria-label="Redaguoti paneles" class:tool-active={tool==='edit'} on:click={()=>tool='edit'}>▧</button><span class="tool-separator"></span><button title="Atšaukti" aria-label="Atšaukti" disabled={!undoStack.length} on:click={undo}>↶</button><button title="Pakartoti" aria-label="Pakartoti" disabled={!redoStack.length} on:click={redo}>↷</button></div><div class="canvas-exports">
     {#if mode==='screen' && mappingSize}
      <div class="pixel-map-exports" role="group" aria-label="Pikselių žemėlapis">
       <span>Pikselių žemėlapis · {mappingSize.width} × {mappingSize.height} px</span>
       <button class="export-image" type="button" aria-label="Atsisiųsti pikselių žemėlapį PNG formatu" disabled={pixelMapBusy} on:click={()=>exportPixelMap('png')}>↓ PNG</button>
       <button class="export-image" type="button" aria-label="Atsisiųsti pikselių žemėlapį JPG formatu" disabled={pixelMapBusy} on:click={()=>exportPixelMap('jpg')}>↓ JPG</button>
      </div>
     {/if}
     <button class="export-image" aria-label="Atsisiųsti brėžinį PNG formatu" on:click={exportPNG}>↓ Brėžinys PNG</button>
     <button class="export-image" on:click={exportDXF}>↓ DXF R12</button>
    </div></div>
    <div class="drawing-area">
    <svg bind:this={svg} {viewBox} aria-label="LED ekranų 2D brėžinys" on:pointermove={moveDrag} on:pointerup={()=>drag=null} on:pointercancel={()=>drag=null}>
     <defs><pattern id="dots" width="0.25" height="0.25" patternUnits="userSpaceOnUse"><circle cx="0.01" cy="0.01" r="0.007" fill="#35404f" /></pattern><linearGradient id="panel-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#254c55"/><stop offset="1" stop-color="#1b313f"/></linearGradient></defs>
     <rect x={bounds.minX-boxW*2} y={bounds.minY-boxH*2} width={boxW*5} height={boxH*5} fill="url(#dots)" />
     {#each visible as s}
      {@const t=stats(s)}{@const w=s.cols*s.panel.widthM}{@const h=s.rows*s.panel.heightM}
      <g transform={`translate(${s.x},${s.y})`}>
       <text x="0" y="-0.48" fill={s.id===selected?'#65dece':'#bac5d2'} font-size="0.115" font-family="Arial,sans-serif" font-weight="600">{s.name.toUpperCase()}</text>
       <text x={w} y="-0.48" text-anchor="end" fill="#7f91a6" font-size="0.1" font-family="Arial,sans-serif">{t.pxW} × {t.pxH} px</text>
       {#each Array(s.rows) as _,r}{#each Array(s.cols) as _,c}
        {@const off=s.removed.includes(`${c},${r}`)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g class="panel-cell" role="button" tabindex="0" aria-label={`${s.name}, panelė ${r*s.cols+c+1}${off?', pašalinta':''}`} on:pointerdown={e=>{if(e.button!==0)return;e.preventDefault();if(tool==='edit'){selected=s.id;toggle(c,r,s.id);}else startDrag(e,s);}} on:keydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=s.id;if(tool==='edit')toggle(c,r,s.id);}}} style={`cursor:${tool==='edit'?'crosshair':mode==='project'?'grab':'pointer'}`}>
         <rect x={c*s.panel.widthM+0.008} y={r*s.panel.heightM+0.008} width={s.panel.widthM-0.016} height={s.panel.heightM-0.016} rx="0.018" fill={off?'#141c26':'url(#panel-fill)'} stroke={off?'#344254':s.id===selected?'#4c9b9c':'#456071'} stroke-width="0.009" stroke-dasharray={off?'0.04 0.03':undefined}/>
         {#if numbers&&!off}<text x={(c+0.5)*s.panel.widthM} y={(r+0.5)*s.panel.heightM+0.025} text-anchor="middle" fill="#a1c4cb" font-family="Arial,sans-serif" font-size="0.085" pointer-events="none">{r*s.cols+c+1}</text>{/if}
         {#if off&&tool==='edit'}<text x={(c+0.5)*s.panel.widthM} y={(r+0.5)*s.panel.heightM+0.04} text-anchor="middle" fill="#657689" font-size="0.15" pointer-events="none">+</text>{/if}
        </g>
       {/each}{/each}
       {#if dimensions}<g stroke="#657789" stroke-width="0.008" fill="none"><path d={`M 0 -0.12 V -0.3 M 0 -0.22 H ${w} M ${w} -0.12 V -0.3`} /><path d={`M ${w+0.12} 0 H ${w+0.3} M ${w+0.22} 0 V ${h} M ${w+0.12} ${h} H ${w+0.3}`} /></g><text x={w/2} y="-0.27" text-anchor="middle" fill="#d1dbe5" font-size="0.1" font-family="Arial,sans-serif">{f(w)} m</text><text x={w+0.37} y={h/2} fill="#d1dbe5" font-size="0.1" font-family="Arial,sans-serif">{f(h)} m</text>{/if}
       <text x={w/2} y={h+0.3} text-anchor="middle" fill="#71869a" font-size="0.095" font-family="Arial,sans-serif">{s.panel.name} · {t.n} panelių</text>
      </g>
     {/each}
    </svg>
    </div>
    <div class="canvas-bottom"><span><i></i> {tool==='edit'?'Spustelėkite panelę, kad ją išimtumėte arba grąžintumėte':mode==='project'?'Tempkite ekranus · pritraukimas kas 0,1 m':'Ištiesinta išklotinė · lenkimą žr. skiltyje „Lenkimas“'}</span><ZoomControls percent={zoom} onchange={value=>zoom=value} /></div>
   </div>
   <div class="display-options"><label><input type="checkbox" bind:checked={numbers} /> Panelių numeracija</label><label><input type="checkbox" bind:checked={dimensions} /> Matmenys</label><span>1 panelė = 1 tinklelio langelis</span></div>
   <section class="project-summary"><div class="section-heading">VISO PROJEKTO SUVESTINĖ <span>{project.screens.length} ekran.</span></div><div class="summary-grid"><div><small>Panelės</small><strong>{f(totals.n,0)} <em>vnt.</em></strong></div><div><small>LED plotas</small><strong>{f(totals.area)} <em>m²</em></strong></div><div><small>Panelių svoris{totals.missingWeight?' · nepilnas':''}</small><strong>{f(totals.weight,1)} <em>kg</em></strong></div><div><small>Galia pagal katalogą{totals.missingPower?' · nepilna':''}</small><strong>{f(totals.power/1000)} <em>kW</em></strong></div></div></section>
   {/if}
  </main>
  <aside class="inspector">
   <div class="section-heading">EKRANO PARAMETRAI <span class="live">● GYVAI</span></div>
   {#if screen&&result}
   <div class="resolution-card"><span>REZOLIUCIJA</span><strong>{result.pxW} <b>×</b> {result.pxH}</strong><small>{f(result.pixels,0)} aktyvių pikselių</small></div>
   <dl class="spec-list"><div><dt>Panelių kiekis</dt><dd>{result.n} <small>vnt.</small></dd></div><div><dt>Aktyvus LED plotas</dt><dd>{f(result.area)} <small>m²</small></dd></div><div><dt>Panelių svoris</dt><dd>{result.weight===null?'Nenurodyta':f(result.weight,1)} {#if result.weight!==null}<small>kg</small>{/if}</dd></div><div><dt>Galia pagal katalogą</dt><dd>{result.power===null?'Nenurodyta':f(result.power/1000)} {#if result.power!==null}<small>kW</small>{/if}</dd></div><div><dt>Aktyvios formos gabaritai</dt><dd>{f(result.width)} × {f(result.height)} <small>m</small></dd></div></dl>
   <div class="section-heading space-top">PANELĖS SPECIFIKACIJA</div>
   <div class="panel-profile"><div class="panel-illustration"><div><span>▦</span></div><small>{f(screen.panel.widthM*1000,0)} × {f(screen.panel.heightM*1000,0)} mm</small></div><h2>{screen.panel.name}</h2><p>{screen.panel.resX} × {screen.panel.resY} px / panelė</p>{#if panelSpecs}<PanelSpecs panel={panelSpecs} />{/if}</div>

   {/if}
  </aside>
 </div>
 {#if data.usage}
  <footer class="workspace-footer"><UsagePreference initial={data.usage} /></footer>
 {/if}
</div>
{#if message}<div class="toast" role="status">{message}<button aria-label="Uždaryti pranešimą" on:click={()=>message=''}>×</button></div>{/if}
{#if showCatalog}
 <div class="modal-backdrop"><div class="catalog-modal" use:focusModal role="dialog" aria-modal="true" aria-label="Panelių katalogas" tabindex="-1"><div class="modal-header"><div><span class="eyebrow">ĮRANGOS BIBLIOTEKA</span><h2>Panelių katalogas <small>{catalog.length} modelių</small></h2></div><button aria-label="Uždaryti katalogą" on:click={()=>{showCatalog=false;}}>×</button></div><div class="catalog-tools"><input aria-label="Ieškoti panelių" placeholder="Ieškoti pagal modelį…" bind:value={query}/>{#if data.user.role==='admin'}<a class="button secondary" href="/admin">Administravimas</a>{/if}</div>
 <div class="catalog-grid">{#each filtered as p}<article class="catalog-card"><span class="mini-panel">▦</span><h3>{p.name}</h3><p>{f(p.widthM*1000,0)} × {f(p.heightM*1000,0)}{p.depthM?` × ${f(p.depthM*1000)}`:''} mm · {p.resX} × {p.resY} px</p><div class="catalog-metrics"><span>{p.weightKg===null?'—':`${f(p.weightKg)} kg`}</span><span>{p.power===null?'—':`${f(p.power)} W`}</span></div><div class="form-actions"><button class="primary" on:click={()=>add(p)}>＋ Ekranas</button></div></article>{/each}{#if !filtered.length}<p>Modelių nerasta.</p>{/if}</div>
 <p class="catalog-footnote">Ekrano specifikacijos išsaugomos projekto JSON faile.</p></div></div>
{/if}
<section class="print-report"><h1>{project.name}</h1><p>LED ekranų suvestinė · {new Date().toLocaleDateString('lt-LT')}</p><table><thead><tr><th>Ekranas / modelis</th><th>Geometrija</th><th>Rezoliucija</th><th>Panelės</th><th>Plotas</th><th>Svoris</th><th>Galia</th></tr></thead><tbody>{#each project.screens as s}{@const t=stats(s)}{@const geo=geometry({...s,panel:resolvePanelDepth(s.panel,catalog)})}<tr><td>{s.name}<br/>{s.panel.name}</td><td>{f(geo.angle)}° / jungtis<br/>{f(geo.width)} × {f(geo.depth)} m (plotis × gylis)<br/>R: {geo.radius===null?'∞':`${f(geo.radius)} m`}</td><td>{t.pxW} × {t.pxH}</td><td>{t.n}</td><td>{f(t.area)} m²</td><td>{t.weight===null?'—':`${f(t.weight)} kg`}</td><td>{t.power===null?'—':`${f(t.power/1000)} kW`}</td></tr>{/each}</tbody></table><p>Iš viso: {totals.n} panelių · {f(totals.area)} m² · {f(totals.weight)} kg{totals.missingWeight?' (nepilna suma)':''} · {f(totals.power/1000)} kW{totals.missingPower?' (nepilna suma)':''}</p><p>Galia ir panelių svoris pagal projekto katalogą. Konstrukcijų svoris neįtrauktas. Duomenis reikia patikrinti.</p></section>

<style>
 .ratio-suggestion{margin-top:14px;padding:12px;border:1px solid #354352;border-radius:8px;background:#1d2b33}
 .ratio-heading{display:flex;justify-content:space-between;gap:8px;align-items:center}.ratio-heading strong{color:#66ddc8;font-size:16px}.ratio-heading span{font-size:10px;color:#9eb0c1}
 .ratio-suggestion p{font-size:11px;line-height:1.6;margin:8px 0 10px}.ratio-suggestion p span{display:block;color:#a0afbc}.ratio-suggestion small{display:block;color:#8f9eae;font-size:10px;line-height:1.5;margin-top:9px}
 .remove-screen,.clear-screens{margin-top:8px;color:#f0aaa7}
 .workspace-footer{display:flex;justify-content:flex-end;border-top:1px solid #303a47;padding:5px 16px 12px}
 @media print{.workspace-footer{display:none}}
 .empty-project{min-height:240px;display:grid;align-content:center;justify-items:center;gap:14px;padding:20px}
 .empty-project p{margin:0;color:#afbdcc}
 .empty-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
 .editor-heading{flex-wrap:wrap;gap:12px}
 .workspace-tabs{display:flex;width:100%;justify-content:space-between;flex-wrap:wrap;gap:12px}
 .workspace-tabs .segmented{flex-wrap:wrap}
 .workspace.foh-workspace{grid-template-columns:minmax(0,1fr)}
 .foh-workspace>.sidebar,.foh-workspace>.inspector{display:none}
 .canvas-toolbar,.canvas-exports{flex-wrap:wrap;gap:8px}
 .pixel-map-exports{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding-right:10px;border-right:1px solid var(--line)}
 .pixel-map-exports span{color:#b6c5d5;font-size:11px}
</style>
