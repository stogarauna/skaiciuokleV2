<script lang="ts">
 import {portSide,anchor,cableIssue,cablePath,cardWidth,deviceHeight,diagramView,exampleFoh,fohCsv,gearCsv,getEnd,library,sameEnd,signalColor,signals,zoneName,zonesFor,type Cable,type Device,type End,type FohDiagram,type Port,type SavedDevice} from './foh-diagram';
 import {exportDiagram} from './signal-diagram-export';
 import {onMount} from 'svelte';
 import type {DeviceLibrary} from './device-library';
 export let projectName:string;
 export let deviceLibrary:DeviceLibrary;
 export let canManageLibrary:boolean;
 export let diagram:FohDiagram|undefined;
 export let onchange:(graph:FohDiagram)=>void;
 export let ondownload:(blob:Blob,name:string)=>void;
 export let onundo:()=>void;
 export let canUndo:boolean;
 export let onredo:()=>void;
 export let canRedo:boolean;

 const empty:FohDiagram={devices:[],cables:[],nextCable:1};
 let zone='',zoneDraft='',query='',templateName='',selectedCable='',zoom=100;
 let viewPort:HTMLDivElement;
 let showUnused=true,showLabels=true,exporting=false;
 let editingPort='';
 let bendDrag:{id:string;pointer:number;clientX:number;x:number;initial:number}|null=null;
 let cableSearch='';
 let shared=deviceLibrary,libraryBusy=false,libraryNotice='';
 onMount(()=>{void refreshLibrary();});
 let folderKey='';
 $: pathFilter=folderKey?JSON.parse(folderKey) as string[]:[];
 let chosen=0,selected='',notice='',portName='';
 let direction:Port['direction']='in';
 let signal:Port['signal']='HDMI';
 let from:End|null=null;
 let drag:{device:string;pointer:number;startX:number;startY:number;x:number;y:number}|null=null;
 let preview:{device:string;x:number;y:number}|null=null;

 $: graph=diagram??empty;
 $: zones=zonesFor(graph);
 $: if(zone&&!zones.some(item=>item.id===zone))zone='';
 $: currentZone=zones.find(item=>item.id===zone);
 $: view=diagramView(graph,zone);
 $: active=graph.devices.find(d=>d.id===selected&&(!zone||d.zone===zone));
 $: source=from?getEnd(graph,from):undefined;
 $: devices=view.devices.map(d=>preview?.device===d.id?{...d,x:preview.x,y:preview.y}:d);
 $: drawn={...view,devices};
 $: drawnCables=view.cables.map(c=>bendDrag?.id===c.id?{...c,bend:bendDrag.x}:c);
 $: width=Math.max(1030,...devices.map(d=>d.x+cardWidth+25),...view.cables.map(c=>(c.bend??0)+25));
 $: height=Math.max(550,...devices.map(d=>d.y+deviceHeight(d)+25));
  $: templates=[
  ...shared.devices.map(template=>({...template,scope:'shared' as const})),
  ...library.map(template=>({...template,id:'',scope:'builtin' as const})),
  ...(graph.templates??[]).map(template=>({...template,scope:'project' as const}))
 ];
 $: chosenTemplate=templates[chosen];
 $: linkedTemplate=active?.libraryId?shared.devices.find(device=>device.id===active.libraryId):undefined;
 $: matches=templates.map((template,index)=>({template,index})).filter(({template})=>!pathFilter.length||('folder' in template&&pathFilter.every((v,i)=>template.folder?.[i]===v))).filter(({template})=>(template.model+("category" in template?" "+template.category:"")).toLowerCase().includes(query.trim().toLowerCase()));
 $: if(matches.length&&!matches.some(item=>item.index===chosen))chosen=matches[0].index;
 $: visibleCables=view.cables.filter(cable=>{
  const a=getEnd(graph,cable.from),b=getEnd(graph,cable.to);
  return [cable.id,cable.name,a?.device.name,b?.device.name,a?.port.name,b?.port.name].join(' ').toLowerCase().includes(cableSearch.trim().toLowerCase());
 });
 $: cable=graph.cables.find(c=>c.id===selectedCable);

 function add(){
  const template=templates[chosen];
  if(!template||!matches.length||graph.devices.length>=100)return;
  const id=crypto.randomUUID();
  const suggested=template.scope==='builtin'?template.zone:zones[0].id;
  const target=zone||(zones.some(item=>item.id===suggested)?suggested:zones[0].id);
  const visible=zone?view.devices:graph.devices;
  const x=30,y=Math.min(4000,Math.max(32,...visible.map(device=>device.y+deviceHeight(device)+24)));
  change({...graph,devices:[...graph.devices,{id,model:template.model,name:template.model,zone:target,libraryId:template.scope==='shared'?template.id:undefined,x,y,ports:structuredClone(template.ports)}]});
  select(id);
 }
 function addZone(){
  const name=zoneDraft.trim();
  if(!name||zones.length>=50)return;
  const id=crypto.randomUUID();
  change({...graph,zones:[...zones,{id,name}]});
  zoneDraft='';
  switchZone(id);
 }
 function renameZone(id:string,input:HTMLInputElement){
  const current=zoneName(graph,id),name=input.value.trim()||current;
  input.value=name;
  if(name!==current)change({...graph,zones:zones.map(z=>z.id===id?{...z,name}:z)});
 }
 function removeZone(id:string){
  if(zones.length<2||graph.devices.some(device=>device.zone===id))return;
  change({...graph,zones:zones.filter(z=>z.id!==id)});
  switchZone('');
 }
 function switchZone(id:string){
  zone=id;
  selected='';
  selectedCable='';
  if(viewPort){viewPort.scrollLeft=0;viewPort.scrollTop=0;}
 }
 function saveTemplate(device:Device){
  const model=templateName.trim()||device.model;
  const saved=graph.templates??[];
  if(saved.length>=100)return;
  change({...graph,templates:[...saved,{id:crypto.randomUUID(),model,ports:structuredClone(device.ports)}]});
  templateName='';
  notice='Šablonas išsaugotas projekto bibliotekoje.';
 }
 async function refreshLibrary(){
  try{
   const response=await fetch('/api/device-library');
   if(!response.ok)throw Error();
   shared=await response.json();
  }catch{libraryNotice='Nepavyko atnaujinti bendros bibliotekos.';}
 }
 async function changeShared(action:'add'|'update'|'remove',entry:SavedDevice){
  if(libraryBusy||!canManageLibrary||!shared.writable)return;
  if(action==='remove'&&!window.confirm('Pašalinti „'+entry.model+'“ iš bendros bibliotekos?'))return;
  libraryBusy=true;
  libraryNotice='';
  try{
   const response=await fetch('/api/device-library',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action,revision:shared.revision,device:entry,id:entry.id})
   });
   const result=await response.json();
   if(!response.ok){
    if(response.status===409)await refreshLibrary();
    libraryNotice=result.message??'Nepavyko pakeisti bibliotekos.';
    return;
   }
   shared=result;
   libraryNotice=action==='remove'?'Modelis pašalintas iš bendros bibliotekos.':'Modelis išsaugotas bendroje bibliotekoje.';
  }catch{libraryNotice='Nepavyko pakeisti bibliotekos.';}
  finally{libraryBusy=false;}
 }
 async function importRentman(event:Event){
  const input=event.currentTarget as HTMLInputElement;
  const file=input.files?.[0];
  if(!file||libraryBusy)return;
  libraryBusy=true;
  try{
   if(file.size>2000000)throw Error('CSV failas per didelis.');
   const folders=JSON.parse(await file.text());
   const response=await fetch('/api/device-library',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rentman',revision:shared.revision,folders})});
   const result=await response.json();
   if(!response.ok){if(response.status===409)await refreshLibrary();throw Error(result.message);}
   shared=result;
   libraryNotice='Importuoti katalogai: '+folders.length+'.';
  }catch(error){libraryNotice=error instanceof Error?error.message:'Importas nepavyko.';}
  finally{input.value='';libraryBusy=false;}
 }
 function publishDevice(device:Device,existing?:SavedDevice){
  const model=templateName.trim()||device.model;
  void changeShared(existing?'update':'add',{id:existing?.id??crypto.randomUUID(),model,ports:device.ports});
 }
 function duplicate(device:Device){
  if(graph.devices.length>=100)return;
  const id=crypto.randomUUID();
  change({...graph,devices:[...graph.devices,{...device,id,x:clamp(device.x+32),y:clamp(device.y+42),ports:structuredClone(device.ports)}]});
  select(id);
 }
 function fit(){
  if(viewPort)zoom=Math.max(20,Math.min(100,Math.floor(100*Math.min(viewPort.clientWidth/width,viewPort.clientHeight/height))));
 }
 async function downloadDiagram(format:'svg'|'png'|'pdf'){
  if(exporting)return;
  exporting=true;
  const title=projectName+' · '+(currentZone?.name??'Signalo schema');
  try{
   const blob=await exportDiagram(view,title,format,showLabels,showUnused);
   ondownload(blob,title.replace(/[<>:"/\|?*]/g,'-')+'.'+format);
  }catch{notice='Nepavyko eksportuoti schemos.';}
  finally{exporting=false;}
 }
 function editCable(id:string,patch:Partial<Cable>){
  change({...graph,cables:graph.cables.map(c=>c.id===id?{...c,...patch}:c)});
 }
 function change(value:FohDiagram){notice='';onchange(value);}
 function select(id:string){if(selected!==id){portName='';editingPort='';templateName='';}selected=id;}
 function edit(id:string,patch:Partial<Device>){
  change({...graph,devices:graph.devices.map(d=>d.id===id?{...d,...patch}:d)});
 }
 function addPort(device:Device){
  const name=portName.trim();
  if(!name||(!editingPort&&device.ports.length>=128))return;
  const prior=device.ports.find(port=>port.id===editingPort);
  const port={id:prior?.id??crypto.randomUUID(),name,direction,signal};
  if(prior&&occupied(graph,{device:device.id,port:prior.id})&&(prior.direction!==direction||prior.signal!==signal)){
   notice='Prieš keisdami kryptį arba signalo tipą atjunkite kabelį.';
   return;
  }
  edit(device.id,{ports:prior?device.ports.map(p=>p.id===prior.id?port:p):[...device.ports,port]});
  editingPort='';
  portName='';
 }
 function remove(device:Device){
  const linked=graph.cables.filter(c=>c.from.device===device.id||c.to.device===device.id);
  if(linked.length&&!window.confirm('Pašalinti „'+device.name+'“ ir visas jo jungtis?'))return;
  change({...graph,devices:graph.devices.filter(d=>d.id!==device.id),cables:graph.cables.filter(c=>!linked.includes(c))});
  selected='';
  if(from?.device===device.id)from=null;
 }
 function occupied(value:FohDiagram,ref:End){return value.cables.some(c=>sameEnd(c.from,ref)||sameEnd(c.to,ref));}
 function connect(device:Device,port:Port){
  const ref={device:device.id,port:port.id};
  notice='';
  if(port.direction==='out'||(port.direction==='io'&&(!from||sameEnd(from,ref)))){
   if(occupied(graph,ref)){notice='Šis išėjimas jau prijungtas.';return;}
   from=from&&sameEnd(from,ref)?null:ref;
   return;
  }
  if(!from||!source){from=null;notice='Pirmiausia pasirinkite išėjimą.';return;}
  const issue=cableIssue(graph,from,ref);
  if(issue){notice=issue;return;}
  if(graph.cables.length>=1000||graph.nextCable>=Number.MAX_SAFE_INTEGER-1001){notice='Pasiekta kabelių numeracijos riba.';return;}
  const ids=new Set(graph.cables.map(c=>c.id));
  let next=graph.nextCable;
  const id=()=> 'C'+String(next).padStart(2,'0');
  while(ids.has(id()))next++;
  change({...graph,nextCable:next+1,cables:[...graph.cables,{id:id(),name:port.signal,from,to:ref}]});
  from=null;
 }
 function startBend(event:PointerEvent,id:string,x:number){
  if(event.button!==0||bendDrag)return;
  event.preventDefault();
  (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
  bendDrag={id,pointer:event.pointerId,clientX:event.clientX,x,initial:x};
 }
 function moveBend(event:PointerEvent){
  if(bendDrag?.pointer!==event.pointerId)return;
  bendDrag={...bendDrag,x:clamp(bendDrag.initial+(event.clientX-bendDrag.clientX)*100/zoom)};
 }
 function finishBend(event:PointerEvent){
  if(bendDrag?.pointer!==event.pointerId)return;
  const {id,x,initial}=bendDrag;
  bendDrag=null;
  if(event.type==='pointerup'&&x!==initial)editCable(id,{bend:x});
 }
 function rename(cable:Cable,input:HTMLInputElement){
  const name=input.value.trim()||cable.name;
  input.value=name;
  if(name!==cable.name)change({...graph,cables:graph.cables.map(c=>c.id===cable.id?{...c,name}:c)});
 }
 const clamp=(n:number)=>Math.max(0,Math.min(4000,Math.round(n)));
 function start(event:PointerEvent,device:Device){
  if(event.button!==0||drag||(zone&&device.zone!==zone))return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  select(device.id);
  drag={device:device.id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:device.x,y:device.y};
 }
 function move(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId)return;
  preview={device:drag.device,x:clamp(drag.x+(event.clientX-drag.startX)*100/zoom),y:clamp(drag.y+(event.clientY-drag.startY)*100/zoom)};
 }
 function finish(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId)return;
  if(event.type==='pointerup'&&preview&&(drag.x!==preview.x||drag.y!==preview.y))edit(preview.device,{x:preview.x,y:preview.y});
  drag=null;
  preview=null;
 }
 function keyboard(event:KeyboardEvent,d:Device){
  const step=event.shiftKey?40:10;
  const arrows:Record<string,[number,number]>={ArrowUp:[0,-step],ArrowDown:[0,step],ArrowLeft:[-step,0],ArrowRight:[step,0]};
  const shift=arrows[event.key];
  if(!shift||(zone&&d.zone!==zone))return;
  event.preventDefault();
  edit(d.id,{x:clamp(d.x+shift[0]),y:clamp(d.y+shift[1])});
 }
</script>

<section aria-label="Signalo schema">
 <div class="toolbar">
  <div><h2>{currentZone?.name??'Visos zonos'}</h2><small>{view.devices.length} įreng. · {view.cables.length} kabel.</small></div>
  <div class="actions">
   {#if !diagram}<button class="primary" type="button" on:click={()=>change(exampleFoh())}>Atidaryti FOH pavyzdį</button>{/if}
   <button class="secondary" type="button" disabled={!canUndo} on:click={()=>{from=null;notice='';onundo();}}>Atšaukti</button>
   <button class="secondary" type="button" disabled={!canRedo} on:click={()=>{from=null;notice='';onredo();}}>Pakartoti</button>
   <button class="secondary" type="button" disabled={!graph.cables.length} on:click={()=>ondownload(new Blob([fohCsv(graph)],{type:'text/csv;charset=utf-8'}),'Signalo-kabeliai.csv')}>↓ Kabeliai CSV</button>
   <button class="secondary" type="button" disabled={!graph.devices.length} on:click={()=>ondownload(new Blob([gearCsv(graph)],{type:'text/csv;charset=utf-8'}),'Įranga.csv')}>↓ Įranga CSV</button>
   {#each (['svg','png','pdf'] as const) as format}
    <button class="secondary" type="button" disabled={!view.devices.length||exporting} on:click={()=>downloadDiagram(format)}>↓ {format.toUpperCase()}</button>
   {/each}
  </div>
 </div>

 <nav class="library" aria-label="Schemos zonos">
  <button class="secondary" aria-pressed={!zone} on:click={()=>switchZone('')}>Visos zonos</button>
  {#each zones as item (item.id)}
   <button class="secondary" aria-pressed={zone===item.id} on:click={()=>switchZone(item.id)}>{item.name}</button>
  {/each}
  <form class="inline" on:submit|preventDefault={addZone}>
   <input aria-label="Naujos zonos pavadinimas" placeholder="Nauja zona" maxlength="120" bind:value={zoneDraft}/>
   <button class="secondary" disabled={!zoneDraft.trim()||zones.length>=50}>＋ Zona</button>
  </form>
  {#if currentZone}
   <input aria-label="Zonos pavadinimas" maxlength="120" value={currentZone.name} on:change={event=>renameZone(zone,event.currentTarget)}/>
   <button class="secondary" disabled={zones.length<2||graph.devices.some(d=>d.zone===zone)} on:click={()=>removeZone(zone)}>Pašalinti tuščią zoną</button>
  {/if}
 </nav>
 <div class="library">
  {#if shared.folders?.length}<label>„Rentman“ katalogas<select bind:value={folderKey}><option value="">Visi įrenginiai</option>{#each shared.folders as path}<option value={JSON.stringify(path)}>{path.join(' › ')}</option>{/each}</select></label>{/if}
  <label>Įrenginių paieška<input placeholder="Modelis" bind:value={query}/></label>
  <label>Įrenginių biblioteka<select bind:value={chosen}>
    {#each matches as {template,index}}<option value={index}>{template.model} · {template.scope==='shared'?(template.category??'Bendra'):template.scope==='project'?'Projektas':'Bendrinis'}</option>{/each}
  </select></label>
  <button class="secondary" type="button" disabled={graph.devices.length>=100||!matches.length} on:click={add}>＋ Pridėti įrenginį</button>
  {#if chosenTemplate?.scope==='project'&&matches.length}
   <button class="secondary" type="button" on:click={()=>change({...graph,templates:graph.templates?.filter(t=>t.id!==chosenTemplate.id)})}>Pašalinti projekto šabloną</button>
  {:else if chosenTemplate?.scope==='shared'&&matches.length&&canManageLibrary&&shared.writable}
   <button class="secondary" type="button" disabled={libraryBusy} on:click={()=>changeShared('remove',chosenTemplate)}>Pašalinti bendrą modelį</button>
  {/if}
  {#if canManageLibrary&&shared.writable}<label>Importuoti „Rentman“ katalogus<input type="file" accept=".json" disabled={libraryBusy} on:change={importRentman}/></label>{/if}
  {#if libraryNotice}<p role="status" class="patch">{libraryNotice}</p>{/if}
 </div>

 {#if view.devices.length}
  <div class="actions">
   <button class="secondary" on:click={()=>zoom=Math.max(20,zoom-10)} aria-label="Sumažinti">−</button>
   <button class="secondary" on:click={()=>zoom=100}>{zoom} %</button>
   <button class="secondary" on:click={()=>zoom=Math.min(200,zoom+10)} aria-label="Padidinti">＋</button>
   <button class="secondary" on:click={fit}>Sutalpinti</button>
   <label class="check"><input type="checkbox" bind:checked={showUnused}/> Laisvi prievadai</label>
   <label class="check"><input type="checkbox" bind:checked={showLabels}/> Kabelių ID</label>
  </div>
  <div class="patch">
   <p role="status">{notice||(source?'Pasirinktas '+source.device.name+' · '+source.port.name+'. Spustelėkite įėjimą.':'Tempkite už įrenginio antraštės. Sujunkite pasirinkdami išėjimą ir įėjimą.')}</p>
   {#if source}<button class="secondary" type="button" on:click={()=>{from=null;notice='';}}>Atšaukti jungimą</button>{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="viewport" bind:this={viewPort} tabindex="0" role="region" aria-label="Slenkama signalo schema">
   <div class="board" style:zoom={zoom/100} style:width={width+'px'} style:height={height+'px'}>
    <svg width={width} height={height} aria-label="Kabelių jungtys">
     {#each drawnCables as cable (cable.id)}
      {@const input=getEnd(drawn,cable.to)}
      {@const output=getEnd(drawn,cable.from)}
      {#if input&&output}
       {@const a=anchor(output)}
       {@const b=anchor(input)}
       <path d={cablePath(a,b,cable.bend)} fill="none" stroke={signalColor[output.port.signal]} stroke-width={selectedCable===cable.id?4:2}
        stroke-dasharray={cable.role==='backup'?'6 4':undefined}/>
       <path class="wire-target" d={cablePath(a,b,cable.bend)} fill="none" stroke="transparent" stroke-width="14"
        role="button" tabindex="0" aria-label={'Kabelis '+cable.id+' · '+cable.name}
        on:click={()=>selectedCable=cable.id} on:keydown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectedCable=cable.id;}}}/>
       {#if selectedCable===cable.id}
        {@const handle=cable.bend??(a.x+b.x)/2}
        <circle class="bend-handle" cx={handle} cy={(a.y+b.y)/2} r="7" fill="#111923" stroke={signalColor[output.port.signal]} stroke-width="2"
         role="slider" tabindex="0" aria-label="Kabelio posūkis" aria-valuemin={0} aria-valuemax={4000} aria-valuenow={Math.round(handle)}
         on:pointerdown={event=>startBend(event,cable.id,handle)} on:pointermove={moveBend}
         on:pointerup={finishBend} on:pointercancel={finishBend} on:lostpointercapture={finishBend}
         on:keydown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();editCable(cable.id,{bend:clamp(handle+(event.key==='ArrowLeft'?-10:10))});}}}/>
       {/if}
       {#if showLabels}<text x={b.x-8} y={b.y-5} text-anchor="end" fill={signalColor[output.port.signal]}>{cable.id}</text>{/if}
      {/if}
     {/each}
    </svg>
    {#each devices as device (device.id)}
     <article class:remote={!!zone&&device.zone!==zone} class:active={selected===device.id} style:left={device.x+'px'} style:top={device.y+'px'} style:width={cardWidth+'px'}>
      <button class="grip" type="button" aria-label={'Pasirinkti įrenginį '+device.name}
       on:click={()=>{if(zone&&device.zone!==zone)switchZone(device.zone);else select(device.id);}} on:pointerdown={event=>start(event,device)} on:pointermove={move}
       on:pointerup={finish} on:pointercancel={finish} on:lostpointercapture={finish} on:keydown={event=>keyboard(event,device)}>
       <strong>{device.name}</strong><small>{zoneName(graph,device.zone)} · {device.model}</small>
      </button>
      <div class="ports">
       {#each (['in','out'] as const) as side}
        <div>
         {#each device.ports.filter(p=>portSide(p)===side) as port (port.id)}
          {@const ref={device:device.id,port:port.id}}
          <button type="button" class="port" class:output={side==='out'} class:armed={!!from&&sameEnd(from,ref)}
           class:connected={occupied(graph,ref)} class:muted={!showUnused&&!occupied(graph,ref)&&!sameEnd(from??{device:'',port:''},ref)} style:--signal={signalColor[port.signal]}
           aria-label={device.name+' · '+port.name+' · '+(port.direction==='io'?'Dvikryptis':side==='out'?'Išėjimas':'Įėjimas')}
           title={port.name+' · '+port.signal} on:click={()=>connect(device,port)}><i></i><span>{port.name}</span></button>
         {/each}
        </div>
       {/each}
      </div>
     </article>
    {/each}
   </div>
  </div>
 {:else}
  <p class="empty">Atidarykite pavyzdį arba įdėkite pirmą įrenginį iš bibliotekos.</p>
 {/if}

 {#if active}
  {@const device=active}
  <details open>
   <summary>Įrenginys · {device.name}</summary>
   <div class="fields">
    <label>Pavadinimas<input maxlength="120" value={device.name} on:change={event=>{
     const name=event.currentTarget.value.trim()||device.name;
     event.currentTarget.value=name;
     if(name!==device.name)edit(device.id,{name});
    }}/></label>
    <label>Modelis<input maxlength="120" value={device.model} on:change={event=>{
     const model=event.currentTarget.value.trim()||device.model;
     event.currentTarget.value=model;
     if(model!==device.model)edit(device.id,{model});
    }}/></label>
    <label>Zona<select value={device.zone} on:change={event=>edit(device.id,{zone:event.currentTarget.value})}>
     {#each zones as item}<option value={item.id}>{item.name}</option>{/each}
    </select></label>
    <button class="secondary" type="button" on:click={()=>duplicate(device)} disabled={graph.devices.length>=100}>Dubliuoti</button>
    <button class="secondary" type="button" on:click={()=>remove(device)}>Pašalinti įrenginį</button>
   </div>
   {#if device.ports.length}<ul>
    {#each device.ports as port (port.id)}
     {@const ref={device:device.id,port:port.id}}
     <li>{port.name} · {port.signal} · {port.direction==='io'?'Dvikryptis':port.direction==='in'?'Įėjimas':'Išėjimas'}
      <button class="secondary" type="button" on:click={()=>{editingPort=port.id;portName=port.name;direction=port.direction;signal=port.signal;}}>Redaguoti</button>
      <button class="secondary" type="button" disabled={occupied(graph,ref)} title="Norėdami pašalinti prievadą, pirmiausia atjunkite kabelį"
       aria-label={'Pašalinti prievadą '+port.name} on:click={()=>{
        if(from&&sameEnd(from,ref))from=null;
        if(editingPort===port.id){editingPort='';portName='';}
        edit(device.id,{ports:device.ports.filter(p=>p.id!==port.id)});
       }}>×</button></li>
    {/each}
   </ul>{/if}
   <form class="fields" on:submit|preventDefault={()=>addPort(device)}>
    <label>Prievado pavadinimas<input maxlength="120" bind:value={portName}/></label>
    <label>Kryptis<select bind:value={direction}><option value="in">Įėjimas</option><option value="out">Išėjimas</option><option value="io">Dvikryptis</option></select></label>
    <label>Signalo tipas<select bind:value={signal}>{#each signals as s}<option value={s}>{s}</option>{/each}</select></label>
    <button class="secondary" type="submit" disabled={!portName.trim()||(!editingPort&&device.ports.length>=128)}>{editingPort?'Išsaugoti prievadą':'＋ Pridėti prievadą'}</button>
    {#if editingPort}<button class="secondary" type="button" on:click={()=>{editingPort='';portName='';}}>Atšaukti</button>{/if}
   </form>
   <form class="fields" on:submit|preventDefault={()=>saveTemplate(device)}>
    <label>Šablono pavadinimas<input maxlength="120" placeholder={device.model} bind:value={templateName}/></label>
    <button class="secondary" disabled={(graph.templates?.length??0)>=100}>Išsaugoti projekte</button>
    {#if canManageLibrary&&shared.writable}
     <button class="secondary" type="button" disabled={libraryBusy} on:click={()=>publishDevice(device)}>Pridėti į bendrą biblioteką</button>
     {#if linkedTemplate}
      <button class="secondary" type="button" disabled={libraryBusy} on:click={()=>publishDevice(device,linkedTemplate)}>Atnaujinti bendrą modelį</button>
     {/if}
    {/if}

  {#if libraryNotice}<p role="status" class="patch">{libraryNotice}</p>{/if}
   </form>
  </details>
 {/if}
 {#if cable}
  <details open>
   <summary>Kabelis · {cable.id}</summary>
   <div class="fields">
    <label>Paskirtis<select value={cable.role??''} on:change={event=>editCable(cable.id,{role:event.currentTarget.value==='main'?'main':event.currentTarget.value==='backup'?'backup':undefined})}>
     <option value="">Nenurodyta</option><option value="main">Pagrindinis</option><option value="backup">Atsarginis</option>
    </select></label>
    <label>Ilgis, m<input type="number" min="0.01" max="4000" step="0.01" value={cable.length??''} on:change={event=>{
     const value=event.currentTarget.valueAsNumber;
     editCable(cable.id,{length:Number.isFinite(value)&&value>0?Math.min(4000,value):undefined});
    }}/></label>
    <label>Linijos posūkis X, px<input type="number" min="0" max="4000" value={cable.bend??''} placeholder="Automatiškai" on:change={event=>{
     const value=event.currentTarget.valueAsNumber;
     editCable(cable.id,{bend:Number.isFinite(value)?clamp(value):undefined});
    }}/></label>
    <label>Pastabos<input maxlength="400" value={cable.notes??''} on:change={event=>editCable(cable.id,{notes:event.currentTarget.value.trim()||undefined})}/></label>
    <button class="secondary" on:click={()=>selectedCable=''}>Uždaryti</button>
   </div>
  </details>
 {/if}
 {#if view.cables.length}
  <details open>
   <summary>Kabeliai</summary>
   <label>Paieška kabelių sąraše<input bind:value={cableSearch}/></label>
   <div class="table">
    <table>
     <thead><tr><th>ID</th><th>Signalas</th><th>Iš</th><th>Į</th><th>Tipas</th><th></th></tr></thead>
     <tbody>{#each visibleCables as cable (cable.id)}
      {@const a=getEnd(graph,cable.from)}
      {@const b=getEnd(graph,cable.to)}
      {#if a&&b}<tr>
       <td><button class="secondary" on:click={()=>selectedCable=cable.id}>{cable.id}</button></td><td><input maxlength="120" aria-label={'Kabelio '+cable.id+' pavadinimas'} value={cable.name} on:change={event=>rename(cable,event.currentTarget)}/></td>
       <td>{zoneName(graph,a.device.zone)} · {a.device.name} · {a.port.name}</td><td>{zoneName(graph,b.device.zone)} · {b.device.name} · {b.port.name}</td>
       <td style:color={signalColor[a.port.signal]}>{a.port.signal}</td>
       <td><button class="secondary" type="button" aria-label={'Atjungti kabelį '+cable.id}
        on:click={()=>change({...graph,cables:graph.cables.filter(c=>c.id!==cable.id)})}>×</button></td>
      </tr>{/if}
     {/each}</tbody>
    </table>
   </div>
  </details>
 {/if}
</section>

<style>
 .inline,.check{display:flex;align-items:center;gap:7px}
 .check input{min-height:0}
 button[aria-pressed=true]{border-color:#64ddc8;color:#91f7e5}
 article.remote{border-style:dashed}
 .port.muted{visibility:hidden}
 .wire-target{pointer-events:stroke;cursor:pointer}
 .bend-handle{pointer-events:all;cursor:ew-resize;touch-action:none}
 section{display:grid;gap:12px;min-width:0}
 h2{margin:0 0 4px;font-size:18px}
 small,.patch,.empty{color:#a8bacb}
 .toolbar,.actions,.library,.patch,.fields{display:flex;align-items:end;flex-wrap:wrap;gap:10px}
 .toolbar{align-items:center;justify-content:space-between}
 .library,details,.empty{background:#19212c;border:1px solid #334052;border-radius:8px;padding:12px}
 label{display:grid;gap:5px;font-size:12px;color:#c4d2df}
 input,select{max-width:100%;min-height:34px;border:1px solid #435367;border-radius:6px;background:#141c26;color:#e5f0fb;padding:6px 8px}
 .patch{align-items:center;min-height:30px;font-size:13px}
 p{margin:0}
 .viewport{overflow:auto;border:1px solid #354659;border-radius:8px;max-height:70vh}
 .board{position:relative;background:#111923 radial-gradient(#354658 1px,transparent 1px) 0 0/20px 20px}
 svg{position:absolute;inset:0;pointer-events:none}
 svg text{font:10px Arial,sans-serif;paint-order:stroke;stroke:#111923;stroke-width:3px}
 article{position:absolute;box-sizing:border-box;background:#1c2734;border:1px solid #42566e;border-radius:8px;padding-bottom:6px}
 article.active{border-color:#66ddc8}
 .grip{display:grid;align-content:center;justify-content:stretch;text-align:left;gap:4px;width:100%;height:57px;padding:8px 10px;border-radius:7px 7px 0 0;border:0;background:#253549;color:#eff5fc;cursor:grab;touch-action:none}
 .grip:active{cursor:grabbing}
 .grip strong,.grip small,.port span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
 .ports{display:grid;grid-template-columns:1fr 1fr}
 .ports>div{min-width:0}
 .port{position:relative;display:flex;align-items:center;justify-content:flex-start;width:100%;height:30px;border:0;background:none;color:#e1ebf5;padding:0 9px;font-size:10px;border-radius:3px}
 .port.output{justify-content:flex-end}
 .port i{position:absolute;left:-5px;width:8px;height:8px;border:1.5px solid var(--signal);border-radius:50%;background:#19212c}
 .port.output i{left:auto;right:-5px}
 .port.connected i,.port.armed i{background:var(--signal)}
 .port:hover,.port.armed{background:#36506b}
 summary{cursor:pointer;font-size:13px;font-weight:600}
 .fields,ul,.table{margin-top:12px}
 ul{list-style:none;padding:0;display:grid;gap:6px;font-size:12px}
 li{display:flex;align-items:center;gap:10px}
 .table{overflow:auto}
 table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}
 th,td{padding:8px;border-bottom:1px solid #334052}
 td input{width:155px}
</style>