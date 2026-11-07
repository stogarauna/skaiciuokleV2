<script lang="ts">
 import Mounting from '$lib/Mounting.svelte';
 import {catalogWeights} from '$lib/mounting';
 import Geometry from '$lib/Geometry.svelte';
 import {angleIssue,geometry} from '$lib/geometry';
 import {onMount,tick} from 'svelte';
 import {makeScreen,stats,parseProject,uid,type Panel,type Screen,type Project} from '$lib/project';
 export let data:{panels:unknown};
 let catalog:Panel[]=((data.panels??[]) as Panel[]).filter(p=>p.widthM>0&&p.heightM>0&&p.resX>0&&p.resY>0);
 const first=catalog.find(p=>p.name==='P2 YESTECH')??catalog[0];
 let project:Project={version:1,name:'Naujas LED projektas',screens:first?[makeScreen(first)]:[]};
 let selected=project.screens[0]?.id??'';
 let ready=false;let saveState='';let message='';let showCatalog=false;let query='';let draft:Panel|null=null;let draftError='';
 let mode:'screen'|'project'='screen';let tool:'select'|'edit'='select';let numbers=true;let dimensions=true;let zoom=1;
 let mountingOpen=false;let geometryOpen=false;let pdfBusy=false;
 let units:'panels'|'meters'='panels';let targetW=4;let targetH=2.5;
 let undoStack:string[]=[];let redoStack:string[]=[];let svg:SVGSVGElement;
 let drag:{id:string;startX:number;startY:number;x:number;y:number;viewBox:string}|null=null;
 const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n);
 $: screen=project.screens.find(s=>s.id===selected)??project.screens[0];
 $: result=screen?stats(screen):null;
 $: totals=project.screens.reduce((a,s)=>{const t=stats(s);return {n:a.n+t.n,area:a.area+t.area,weight:a.weight+(t.weight??0),power:a.power+(t.power??0),missingWeight:a.missingWeight||(t.n>0&&t.weight===null),missingPower:a.missingPower||(t.n>0&&t.power===null)};},{n:0,area:0,weight:0,power:0,missingWeight:false,missingPower:false});
 $: visible=mode==='project'?project.screens:screen?[{...screen,x:0,y:0}]:[];
 $: bounds=visible.length?{minX:Math.min(...visible.map(s=>s.x)),minY:Math.min(...visible.map(s=>s.y)),maxX:Math.max(...visible.map(s=>s.x+s.cols*s.panel.widthM)),maxY:Math.max(...visible.map(s=>s.y+s.rows*s.panel.heightM))}:{minX:0,minY:0,maxX:4,maxY:3};
 $: boxW=Math.max(5,bounds.maxX-bounds.minX+2.6)/zoom;
 $: boxH=Math.max(4,bounds.maxY-bounds.minY+2.6)/zoom;
 $: viewBox=drag?drag.viewBox:`${(bounds.minX+bounds.maxX-boxW)/2} ${(bounds.minY+bounds.maxY-boxH)/2} ${boxW} ${boxH}`;
 $: filtered=catalog.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
 $: if(ready){persist(project);}
 onMount(()=>{try{const saved=localStorage.getItem('led-studija-project-v1');if(saved){project=parseProject(JSON.parse(saved));selected=project.screens[0].id;}const c=localStorage.getItem('led-studija-catalog-v1');if(c){const parsed=JSON.parse(c);if(Array.isArray(parsed)){for(const p of parsed)parseProject({version:1,name:'Katalogas',screens:[{id:'test',name:'Test',panel:p,cols:1,rows:1,removed:[],x:0,y:0}]});catalog=parsed;}}}catch{message='Nepavyko atkurti išsaugotų duomenų. Galite atidaryti projekto JSON.';}ready=true;});
 function focusModal(node:HTMLElement){const previous=document.activeElement as HTMLElement;const get=()=>Array.from(node.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')).filter(e=>!e.hasAttribute('disabled'));get()[0]?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){showCatalog=false;draft=null;}if(e.key==='Tab'){const items=get();const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};node.addEventListener('keydown',handler);return {destroy(){node.removeEventListener('keydown',handler);previous?.focus();}};}
 function persist(p:Project){try{localStorage.setItem('led-studija-project-v1',JSON.stringify(p));saveState='Išsaugota šiame įrenginyje';}catch{saveState='Nepavyko išsaugoti';}}
 function checkpoint(){undoStack=[...undoStack.slice(-39),JSON.stringify(project)];redoStack=[];}
 function update(patch:Partial<Screen>){if(!screen)return;if(patch.panel&&screen.mounting)patch={...patch,mounting:{...screen.mounting,frame1Kg:undefined,frameHalfKg:undefined}};const candidate={...screen,...patch};const issue=angleIssue(candidate);if(issue){if(patch.panel){patch={...patch,curvature:{angleDeg:0}};message='Naujam modeliui lenkimas grąžintas į 0°. '+issue;}else{message=issue;return;}}checkpoint();project={...project,equipmentWeights:project.equipmentWeights??(patch.mounting?catalogWeights():undefined),screens:project.screens.map(s=>s.id===screen.id?{...s,...patch}:s)};}
 function resize(cols:number,rows:number){cols=Math.max(1,Math.min(100,Math.round(cols)||1));rows=Math.max(1,Math.min(100,Math.round(rows)||1));if(cols*rows>5000){message='Vienam ekranui leidžiama iki 5 000 panelių.';return;}update({cols,rows,removed:screen.removed.filter(k=>{const [c,r]=k.split(',').map(Number);return c<cols&&r<rows;})});}
 function metricSize(){resize(Math.ceil((targetW||0.5)/screen.panel.widthM),Math.ceil((targetH||0.5)/screen.panel.heightM));}
 function toggle(c:number,r:number,id=screen.id){const target=project.screens.find(s=>s.id===id);if(!target)return;const key=`${c},${r}`;checkpoint();project={...project,screens:project.screens.map(s=>s.id===id?{...s,removed:target.removed.includes(key)?target.removed.filter(k=>k!==key):[...target.removed,key]}:s)};}
 function add(panel:Panel){if(project.screens.length>=50){message='Projekte leidžiama iki 50 ekranų.';return;}checkpoint();const s=makeScreen(panel,project.screens.length);s.x=Math.max(0,...project.screens.map(p=>p.x+p.cols*p.panel.widthM))+1;project={...project,screens:[...project.screens,s]};selected=s.id;showCatalog=false;}
 function duplicate(){if(project.screens.length>=50)return;checkpoint();const s={...structuredClone(screen),id:uid(),name:`${screen.name} · kopija`,x:screen.x+screen.cols*screen.panel.widthM+1};project={...project,screens:[...project.screens,s]};selected=s.id;}
 function remove(){if(project.screens.length===1)return;checkpoint();project={...project,screens:project.screens.filter(s=>s.id!==selected)};selected=project.screens[0].id;}
 function undo(){if(!undoStack.length)return;redoStack=[...redoStack,JSON.stringify(project)];project=JSON.parse(undoStack.at(-1)!);undoStack=undoStack.slice(0,-1);selected=project.screens.some(s=>s.id===selected)?selected:project.screens[0].id;}
 function redo(){if(!redoStack.length)return;undoStack=[...undoStack,JSON.stringify(project)];project=JSON.parse(redoStack.at(-1)!);redoStack=redoStack.slice(0,-1);selected=project.screens.some(s=>s.id===selected)?selected:project.screens[0].id;}
 function download(content:Blob,name:string){const url=URL.createObjectURL(content);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportJSON(){download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'LED-projektas.json');}
 async function importJSON(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw Error('Failas per didelis.');const p=parseProject(JSON.parse(await file.text()));checkpoint();project=p;selected=p.screens[0].id;message='Projektas sėkmingai atidarytas.';}catch(e){message=e instanceof Error?e.message:'Nepavyko atidaryti projekto.';}input.value='';}
 function editPanel(p?:Panel){draft=structuredClone(p??{name:'Naujas panelis',resX:192,resY:192,widthM:0.5,heightM:0.5,power:null,weightKg:null});draftError='';}
 function savePanel(){if(!draft)return;try{parseProject({version:1,name:'Katalogas',screens:[{id:'test',name:'Test',panel:draft,cols:1,rows:1,removed:[],x:0,y:0}]});if(!draft.name.trim())throw Error('Įrašykite modelio pavadinimą.');const entry=structuredClone(draft);const index=catalog.findIndex(p=>p.name===entry.name);const next=index<0?[...catalog,entry]:catalog.map((p,i)=>i===index?entry:p);localStorage.setItem('led-studija-catalog-v1',JSON.stringify(next));catalog=next;draft=null;message='Katalogas atnaujintas. Esami ekranai išlaiko savo specifikacijas.';}catch(e){draftError=e instanceof Error?e.message:'Nepavyko išsaugoti.';}}
 function point(e:PointerEvent){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform(svg.getScreenCTM()!.inverse());}
 function startDrag(e:PointerEvent,s:Screen){selected=s.id;if(mode!=='project'||tool!=='select')return;checkpoint();const p=point(e);drag={id:s.id,startX:p.x,startY:p.y,x:s.x,y:s.y,viewBox};svg.setPointerCapture(e.pointerId);}
 function moveDrag(e:PointerEvent){if(!drag)return;const p=point(e);const d=drag;project={...project,screens:project.screens.map(s=>s.id===d.id?{...s,x:Math.round((d.x+p.x-d.startX)*10)/10,y:Math.round((d.y+p.y-d.startY)*10)/10}:s)};}
 async function exportPDF(){if(pdfBusy)return;pdfBusy=true;const snapshot=structuredClone(project);try{const [{createProjectPDF,pdfFilename},response]=await Promise.all([import('$lib/pdf'),fetch('/fonts/OpenSans-Latin.base64')]);if(!response.ok)throw Error('Nepavyko įkelti PDF šrifto.');const doc=createProjectPDF(snapshot,await response.text());download(doc.output('blob'),pdfFilename(snapshot.name));}catch(e){message='Nepavyko sukurti PDF. Bandykite dar kartą.';console.error(e);}finally{pdfBusy=false;}}
 async function exportPNG(){if(!svg)return;const clone=svg.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','2000');clone.setAttribute('height','1400');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1400;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#10151d';ctx.fillRect(0,0,2000,1400);ctx.drawImage(img,0,0);canvas.toBlob(b=>{if(b)download(b,'LED-2D-planas.png');},'image/png');}catch{message='Nepavyko eksportuoti PNG.';}finally{URL.revokeObjectURL(url);}}
</script>

<svelte:head><title>LED Studija · 2D projektavimas</title><meta name="description" content="LED ekranų 2D planavimas, panelių katalogas, svorio ir galios skaičiuoklė." /></svelte:head>

<div class="app-shell">
 <header class="topbar">
  <a href="/" class="brand"><span class="brand-mark">▦</span><span>LED<span class="brand-light">STUDIJA</span><small>EKRANŲ PLANAVIMAS</small></span></a>
  <div class="project-title"><input aria-label="Projekto pavadinimas" value={project.name} on:change={e=>{checkpoint();project={...project,name:e.currentTarget.value};}} /><span><i></i> {saveState||'2D darbo aplinka'}</span></div>
  <div class="header-actions"><label class="button secondary">↥ <span>Atidaryti</span><input class="file-input" type="file" accept=".json,application/json" on:change={importJSON} /></label><button class="secondary" on:click={exportJSON}>↓ <span>Išsaugoti</span></button><button class="primary" on:click={exportPDF} disabled={pdfBusy}>↓ <span>{pdfBusy?'Ruošiamas PDF…':'Suvestinė'}</span></button></div>
 </header>
 <div class="workspace">
  <aside class="sidebar">
   <div class="section-heading"><span>PROJEKTO EKRANAI</span><span class="count">{project.screens.length}</span></div>
   <div class="screen-list">{#each project.screens as s,i}<button class:active={s.id===selected} class="screen-card" on:click={()=>selected=s.id}><span class="screen-icon">▦</span><span><strong>{s.name}</strong><small>{s.panel.name} · {s.cols} × {s.rows}</small></span><span class="screen-index">{String(i+1).padStart(2,'0')}</span></button>{/each}</div>
   <button class="add-screen" on:click={()=>showCatalog=true}>＋ Pridėti ekraną</button>
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
    <div class="actual-size"><span>Surinktas dydis</span><strong>{f(screen.cols*screen.panel.widthM)} × {f(screen.rows*screen.panel.heightM)} m</strong></div>
    <button class="secondary full geometry-toggle" on:click={()=>geometryOpen=!geometryOpen}>{geometryOpen?'Slėpti geometriją':'⌒ Forma ir lenkimas'}</button>
    <button class="secondary full geometry-toggle" on:click={()=>mountingOpen=!mountingOpen}>{mountingOpen?'Slėpti montavimą':'Montavimas ir svoris'}</button>
    <div class="screen-actions"><button class="secondary" on:click={duplicate}>⧉ Dubliuoti</button><button class="secondary danger" aria-label="Pašalinti ekraną" disabled={project.screens.length===1} on:click={remove}>⌫</button></div>
   {/if}
   <div class="sidebar-bottom"><span class="version-dot"></span> 2D pagrindas <span>v0.1</span></div>
  </aside>
  <main class="editor">
   <div class="editor-heading"><div><span class="eyebrow">DARBO APLINKA</span><h1>{mode==='screen'?'Ekrano išklotinė':'Projekto vaizdas'}<span>2D</span></h1></div><div class="segmented view-tabs"><button class:chosen={mode==='screen'} on:click={()=>{mode='screen';zoom=1;}}>▦ Ekranas</button><button class:chosen={mode==='project'} on:click={()=>{mode='project';zoom=1;}}>▥ Projektas</button></div></div>
   {#if screen&&geometryOpen}<Geometry {screen} onchange={angle=>update({curvature:{angleDeg:angle}})} />{/if}
   {#if screen&&mountingOpen}<Mounting {screen} weights={project.equipmentWeights??catalogWeights()} onchange={mounting=>update({mounting})} onweights={equipmentWeights=>{checkpoint();project={...project,equipmentWeights};}} />{/if}
   <div class="canvas-frame">
    <div class="canvas-toolbar"><div class="tool-group"><button title="Pasirinkti ir perkelti ekraną" aria-label="Pasirinkti" class:tool-active={tool==='select'} on:click={()=>tool='select'}>↖</button><button title="Įjungti arba išjungti paneles" aria-label="Redaguoti paneles" class:tool-active={tool==='edit'} on:click={()=>tool='edit'}>▧</button><span class="tool-separator"></span><button title="Atšaukti" aria-label="Atšaukti" disabled={!undoStack.length} on:click={undo}>↶</button><button title="Pakartoti" aria-label="Pakartoti" disabled={!redoStack.length} on:click={redo}>↷</button></div><button class="export-image" on:click={exportPNG}>↓ PNG</button></div>
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
        <g class="panel-cell" role="button" tabindex="0" aria-label={`${s.name}, panelė ${r*s.cols+c+1}${off?', pašalinta':''}`} on:pointerdown={e=>{if(tool==='edit'){selected=s.id;toggle(c,r,s.id);}else startDrag(e,s);}} on:keydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=s.id;if(tool==='edit')toggle(c,r,s.id);}}} style={`cursor:${tool==='edit'?'crosshair':mode==='project'?'grab':'pointer'}`}>
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
    <div class="canvas-bottom"><span><i></i> {tool==='edit'?'Spustelėkite panelę, kad ją išimtumėte arba grąžintumėte':mode==='project'?'Tempkite ekranus · pritraukimas kas 0,1 m':'Ištiesinta išklotinė · lenkimą žr. geometrijoje'}</span><div class="zoom-controls"><button aria-label="Atitolinti" on:click={()=>zoom=Math.max(0.4,zoom-0.2)}>−</button><button title="Sutalpinti vaizdą" on:click={()=>zoom=1}>{Math.round(zoom*100)}%</button><button aria-label="Priartinti" on:click={()=>zoom=Math.min(3,zoom+0.2)}>+</button></div></div>
   </div>
   <div class="display-options"><label><input type="checkbox" bind:checked={numbers} /> Panelių numeracija</label><label><input type="checkbox" bind:checked={dimensions} /> Matmenys</label><span>1 panelė = 1 tinklelio langelis</span></div>
   <section class="project-summary"><div class="section-heading">VISO PROJEKTO SUVESTINĖ <span>{project.screens.length} ekran.</span></div><div class="summary-grid"><div><small>Panelės</small><strong>{f(totals.n,0)} <em>vnt.</em></strong></div><div><small>LED plotas</small><strong>{f(totals.area)} <em>m²</em></strong></div><div><small>Panelių svoris{totals.missingWeight?' · nepilnas':''}</small><strong>{f(totals.weight,1)} <em>kg</em></strong></div><div><small>Galia pagal katalogą{totals.missingPower?' · nepilna':''}</small><strong>{f(totals.power/1000)} <em>kW</em></strong></div></div></section>
  </main>
  <aside class="inspector">
   <div class="section-heading">EKRANO PARAMETRAI <span class="live">● GYVAI</span></div>
   {#if screen&&result}
   <div class="resolution-card"><span>REZOLIUCIJA</span><strong>{result.pxW} <b>×</b> {result.pxH}</strong><small>{f(result.pixels,0)} aktyvių pikselių</small></div>
   <dl class="spec-list"><div><dt>Panelių kiekis</dt><dd>{result.n} <small>vnt.</small></dd></div><div><dt>Aktyvus LED plotas</dt><dd>{f(result.area)} <small>m²</small></dd></div><div><dt>Panelių svoris</dt><dd>{result.weight===null?'Nenurodyta':f(result.weight,1)} {#if result.weight!==null}<small>kg</small>{/if}</dd></div><div><dt>Galia pagal katalogą</dt><dd>{result.power===null?'Nenurodyta':f(result.power/1000)} {#if result.power!==null}<small>kW</small>{/if}</dd></div><div><dt>Aktyvios formos gabaritai</dt><dd>{f(result.width)} × {f(result.height)} <small>m</small></dd></div></dl>
   <div class="section-heading space-top">PANELIO SPECIFIKACIJA</div>
   <div class="panel-profile"><div class="panel-illustration"><div><span>▦</span></div><small>{f(screen.panel.widthM*1000,0)} × {f(screen.panel.heightM*1000,0)} mm</small></div><h2>{screen.panel.name}</h2><p>{screen.panel.resX} × {screen.panel.resY} px / panelė</p><dl class="spec-list compact"><div><dt>Tikras pikselio žingsnis X</dt><dd>{f(screen.panel.widthM*1000/screen.panel.resX,3)} mm</dd></div><div><dt>Svoris</dt><dd>{screen.panel.weightKg===null?'—':`${f(screen.panel.weightKg)} kg`}</dd></div><div><dt>Galia</dt><dd>{screen.panel.power===null?'—':`${f(screen.panel.power)} W`}</dd></div></dl></div>
   <div class="data-note"><span>ⓘ</span><p>Pradiniai duomenys iš v2 katalogo. Svorį ir galios reikšmes reikia patikrinti pagal turimą įrangą. Vidutinė galia dar nenurodyta.</p></div>
   {/if}
  </aside>
 </div>
</div>
{#if message}<div class="toast" role="status">{message}<button aria-label="Uždaryti pranešimą" on:click={()=>message=''}>×</button></div>{/if}
{#if showCatalog}
 <div class="modal-backdrop"><div class="catalog-modal" use:focusModal role="dialog" aria-modal="true" aria-label="Panelių katalogas" tabindex="-1"><div class="modal-header"><div><span class="eyebrow">ĮRANGOS BIBLIOTEKA</span><h2>Panelių katalogas <small>{catalog.length} modelių</small></h2></div><button aria-label="Uždaryti katalogą" on:click={()=>{showCatalog=false;draft=null;}}>×</button></div><div class="catalog-tools"><input aria-label="Ieškoti panelių" placeholder="Ieškoti pagal modelį…" bind:value={query}/><button class="primary" on:click={()=>editPanel()}>＋ Naujas modelis</button></div>
 {#if draft}<form class="panel-form" on:submit|preventDefault={savePanel}><h3>Panelio specifikacija</h3><p class="help">Tas pats pavadinimas atnaujina katalogo modelį. Naujas pavadinimas sukuria naują modelį.</p><label class="field">Pavadinimas<input required bind:value={draft.name}/></label><div class="form-grid">{#each [{key:'widthM',label:'Plotis, m',step:0.001},{key:'heightM',label:'Aukštis, m',step:0.001},{key:'resX',label:'Plotis, px',step:1},{key:'resY',label:'Aukštis, px',step:1},{key:'weightKg',label:'Svoris, kg',step:0.1},{key:'power',label:'Galia, W',step:1}] as field}<label class="field">{field.label}<input type="number" min={field.key==='power'||field.key==='weightKg'?0:field.step} step={field.step} value={draft[field.key]??''} on:input={e=>{if(draft)draft={...draft,[field.key]:e.currentTarget.value===''?null:+e.currentTarget.value};}} /></label>{/each}</div>{#if draftError}<p class="error">{draftError}</p>{/if}<fieldset class="bend-fields"><legend>Lenkimo galimybės</legend><label class="field">Tipas<select value={draft.bendAngleText==='Nesilenkia'?'fixed':'bend'} on:change={e=>{if(draft)draft={...draft,bendAngleText:e.currentTarget.value==='fixed'?'Nesilenkia':undefined};}}><option value="bend">Lenkiamas / ribos tikslinamos</option><option value="fixed">Nesilenkia</option></select></label>{#if draft.bendAngleText!=='Nesilenkia'}<div class="form-grid"><label class="field">Minimalus kampas, °<input aria-label="Minimalus lenkimo kampas" type="number" min="-90" max="0" step="any" value={typeof draft.bendAngleMinDeg==='number'?draft.bendAngleMinDeg:''} on:input={e=>{if(draft)draft={...draft,bendAngleMinDeg:e.currentTarget.value===''?undefined:+e.currentTarget.value};}} /></label><label class="field">Maksimalus kampas, °<input aria-label="Maksimalus lenkimo kampas" type="number" min="0" max="90" step="any" value={typeof draft.bendAngleMaxDeg==='number'?draft.bendAngleMaxDeg:''} on:input={e=>{if(draft)draft={...draft,bendAngleMaxDeg:e.currentTarget.value===''?undefined:+e.currentTarget.value};}} /></label></div><p class="help">− išgaubtas, + įgaubtas. Patikrinkite gamintojo kampų kryptis. Kelių diapazonų duomenys nėra automatiškai sujungiami.</p>{/if}</fieldset><div class="form-actions"><button type="button" class="secondary" on:click={()=>draft=null}>Atšaukti</button><button class="primary">Išsaugoti modelį</button></div></form>{:else}<div class="catalog-grid">{#each filtered as p}<article class="catalog-card"><span class="mini-panel">▦</span><h3>{p.name}</h3><p>{f(p.widthM*1000,0)} × {f(p.heightM*1000,0)} mm · {p.resX} × {p.resY} px</p><div class="catalog-metrics"><span>{p.weightKg===null?'—':`${f(p.weightKg)} kg`}</span><span>{p.power===null?'—':`${f(p.power)} W`}</span></div><div class="form-actions"><button class="secondary" on:click={()=>editPanel(p)}>Redaguoti</button><button class="primary" on:click={()=>add(p)}>＋ Ekranas</button></div></article>{/each}{#if !filtered.length}<p>Modelių nerasta.</p>{/if}</div>{/if}
 <p class="catalog-footnote">Katalogo pakeitimai saugomi šiame įrenginyje. Ekrano specifikacijos išsaugomos projekto JSON faile.</p></div></div>
{/if}
<section class="print-report"><h1>{project.name}</h1><p>LED ekranų suvestinė · {new Date().toLocaleDateString('lt-LT')}</p><table><thead><tr><th>Ekranas / modelis</th><th>Geometrija</th><th>Rezoliucija</th><th>Panelės</th><th>Plotas</th><th>Svoris</th><th>Galia</th></tr></thead><tbody>{#each project.screens as s}{@const t=stats(s)}{@const geo=geometry(s)}<tr><td>{s.name}<br/>{s.panel.name}</td><td>{f(geo.angle)}° / jungtis<br/>{f(geo.width)} × {f(geo.depth)} m (plotis × gylis)<br/>R: {geo.radius===null?'∞':`${f(geo.radius)} m`}</td><td>{t.pxW} × {t.pxH}</td><td>{t.n}</td><td>{f(t.area)} m²</td><td>{t.weight===null?'—':`${f(t.weight)} kg`}</td><td>{t.power===null?'—':`${f(t.power/1000)} kW`}</td></tr>{/each}</tbody></table><p>Iš viso: {totals.n} panelių · {f(totals.area)} m² · {f(totals.weight)} kg{totals.missingWeight?' (nepilna suma)':''} · {f(totals.power/1000)} kW{totals.missingPower?' (nepilna suma)':''}</p><p>Galia ir panelių svoris pagal projekto katalogą. Konstrukcijų svoris neįtrauktas. Duomenis reikia patikrinti.</p></section>
