<script lang="ts">
 import {cableIssue,exampleFoh,fohCsv,getEnd,library,sameEnd,signalColor,signals,zoneLabel,type Cable,type Device,type End,type FohDiagram,type Port} from './foh-diagram';
 export let diagram:FohDiagram|undefined;
 export let onchange:(graph:FohDiagram)=>void;
 export let ondownload:(blob:Blob,name:string)=>void;
 export let onundo:()=>void;
 export let canUndo:boolean;
 export let onredo:()=>void;
 export let canRedo:boolean;

 const empty:FohDiagram={devices:[],cables:[],nextCable:1};
 const cardWidth=192,headerHeight=58,rowHeight=30;
 let chosen=0,selected='',notice='',portName='';
 let direction:Port['direction']='in';
 let signal:Port['signal']='HDMI';
 let from:End|null=null;
 let drag:{device:string;pointer:number;startX:number;startY:number;x:number;y:number}|null=null;
 let preview:{device:string;x:number;y:number}|null=null;

 $: graph=diagram??empty;
 $: active=graph.devices.find(d=>d.id===selected);
 $: source=from?getEnd(graph,from):undefined;
 $: devices=graph.devices.map(d=>preview?.device===d.id?{...d,x:preview.x,y:preview.y}:d);
 $: drawn={...graph,devices};
 $: width=Math.max(1030,...devices.map(d=>d.x+cardWidth+25));
 $: height=Math.max(550,...devices.map(d=>d.y+headerHeight+rowHeight*Math.max(
  d.ports.filter(p=>p.direction==='in').length,d.ports.filter(p=>p.direction==='out').length)+22));

 function add(){
  const template=library[chosen],id=crypto.randomUUID();
  const offset=graph.devices.length%5;
  change({...graph,devices:[...graph.devices,{...structuredClone(template),id,name:template.model,x:30+offset*28,y:32+offset*31}]});
  select(id);
 }
 function change(value:FohDiagram){notice='';onchange(value);}
 function select(id:string){if(selected!==id)portName='';selected=id;}
 function edit(id:string,patch:Partial<Device>){
  change({...graph,devices:graph.devices.map(d=>d.id===id?{...d,...patch}:d)});
 }
 function addPort(device:Device){
  const name=portName.trim();
  if(!name||device.ports.length>=64)return;
  edit(device.id,{ports:[...device.ports,{id:crypto.randomUUID(),name,direction,signal}]});
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
  if(port.direction==='out'){
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
 function rename(cable:Cable,input:HTMLInputElement){
  const name=input.value.trim()||cable.name;
  input.value=name;
  if(name!==cable.name)change({...graph,cables:graph.cables.map(c=>c.id===cable.id?{...c,name}:c)});
 }
 const clamp=(n:number)=>Math.max(0,Math.min(4000,Math.round(n)));
 function start(event:PointerEvent,device:Device){
  if(event.button!==0||drag)return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  select(device.id);
  drag={device:device.id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:device.x,y:device.y};
 }
 function move(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId)return;
  preview={device:drag.device,x:clamp(drag.x+event.clientX-drag.startX),y:clamp(drag.y+event.clientY-drag.startY)};
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
  if(!shift)return;
  event.preventDefault();
  edit(d.id,{x:clamp(d.x+shift[0]),y:clamp(d.y+shift[1])});
 }
 function anchor(end:NonNullable<ReturnType<typeof getEnd>>){
  const {device,port}=end;
  const index=device.ports.filter(p=>p.direction===port.direction).findIndex(p=>p.id===port.id);
  return {x:device.x+(port.direction==='out'?cardWidth:0),y:device.y+headerHeight+rowHeight*(index+.5)};
 }
 function path(a:ReturnType<typeof anchor>,b:ReturnType<typeof anchor>){
  if(b.x-a.x>=24){const x=(a.x+b.x)/2;return 'M '+a.x+' '+a.y+' H '+x+' V '+b.y+' H '+b.x;}
  const y=Math.min(a.y,b.y)-22;
  return 'M '+a.x+' '+a.y+' h 12 V '+y+' H '+(b.x-12)+' V '+b.y+' H '+b.x;
 }
</script>

<section aria-label="FOH signalo schema">
 <div class="toolbar">
  <div><h2>FOH</h2><small>{graph.devices.length} įreng. · {graph.cables.length} kabel.</small></div>
  <div class="actions">
   {#if !diagram}<button class="primary" type="button" on:click={()=>change(exampleFoh())}>Atidaryti FOH pavyzdį</button>{/if}
   <button class="secondary" type="button" disabled={!canUndo} on:click={()=>{from=null;notice='';onundo();}}>Atšaukti</button>
   <button class="secondary" type="button" disabled={!canRedo} on:click={()=>{from=null;notice='';onredo();}}>Pakartoti</button>
   <button class="secondary" type="button" disabled={!graph.cables.length} on:click={()=>ondownload(new Blob([fohCsv(graph)],{type:'text/csv;charset=utf-8'}),'FOH-kabeliai.csv')}>↓ Kabeliai CSV</button>
  </div>
 </div>

 <div class="library">
  <label>Įrenginių biblioteka<select bind:value={chosen}>
   {#each library as template,i}<option value={i}>{template.model}</option>{/each}
  </select></label>
  <button class="secondary" type="button" disabled={graph.devices.length>=100} on:click={add}>＋ Pridėti įrenginį</button>
 </div>

 {#if graph.devices.length}
  <div class="patch">
   <p role="status">{notice||(source?'Pasirinktas '+source.device.name+' · '+source.port.name+'. Spustelėkite įėjimą.':'Tempkite už įrenginio antraštės. Sujunkite pasirinkdami išėjimą ir įėjimą.')}</p>
   {#if source}<button class="secondary" type="button" on:click={()=>{from=null;notice='';}}>Atšaukti jungimą</button>{/if}
  </div>
  <div class="viewport" tabindex="0" role="region" aria-label="Slenkama FOH schema">
   <div class="board" style:width={width+'px'} style:height={height+'px'}>
    <svg {width} {height} aria-hidden="true">
     {#each graph.cables as cable (cable.id)}
      {@const input=getEnd(drawn,cable.to)}
      {@const output=getEnd(drawn,cable.from)}
      {#if input&&output}
       {@const a=anchor(output)}
       {@const b=anchor(input)}
       <path d={path(a,b)} fill="none" stroke={signalColor[output.port.signal]} stroke-width="2"/>
       <text x={b.x-8} y={b.y-5} text-anchor="end" fill={signalColor[output.port.signal]}>{cable.id}</text>
      {/if}
     {/each}
    </svg>
    {#each devices as device (device.id)}
     <article class:active={selected===device.id} style:left={device.x+'px'} style:top={device.y+'px'} style:width={cardWidth+'px'}>
      <button class="grip" type="button" aria-label={'Pasirinkti įrenginį '+device.name}
       on:click={()=>select(device.id)} on:pointerdown={event=>start(event,device)} on:pointermove={move}
       on:pointerup={finish} on:pointercancel={finish} on:lostpointercapture={finish} on:keydown={event=>keyboard(event,device)}>
       <strong>{device.name}</strong><small>{zoneLabel[device.zone]} · {device.model}</small>
      </button>
      <div class="ports">
       {#each (['in','out'] as const) as side}
        <div>
         {#each device.ports.filter(p=>p.direction===side) as port (port.id)}
          {@const ref={device:device.id,port:port.id}}
          <button type="button" class="port" class:output={side==='out'} class:armed={!!from&&sameEnd(from,ref)}
           class:connected={occupied(graph,ref)} style:--signal={signalColor[port.signal]}
           aria-label={device.name+' · '+port.name+' · '+(side==='out'?'Išėjimas':'Įėjimas')}
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
    <label>Zona<select value={device.zone} on:change={event=>edit(device.id,{zone:event.currentTarget.value==='stage'?'stage':'foh'})}>
     <option value="foh">FOH</option><option value="stage">Scena</option>
    </select></label>
    <button class="secondary" type="button" on:click={()=>remove(device)}>Pašalinti įrenginį</button>
   </div>
   {#if device.ports.length}<ul>
    {#each device.ports as port (port.id)}
     {@const ref={device:device.id,port:port.id}}
     <li>{port.name} · {port.signal} · {port.direction==='in'?'Įėjimas':'Išėjimas'}
      <button class="secondary" type="button" disabled={occupied(graph,ref)} title="Norėdami pašalinti prievadą, pirmiausia atjunkite kabelį"
       aria-label={'Pašalinti prievadą '+port.name} on:click={()=>{
        if(from&&sameEnd(from,ref))from=null;
        edit(device.id,{ports:device.ports.filter(p=>p.id!==port.id)});
       }}>×</button></li>
    {/each}
   </ul>{/if}
   <form class="fields" on:submit|preventDefault={()=>addPort(device)}>
    <label>Prievado pavadinimas<input maxlength="120" bind:value={portName}/></label>
    <label>Kryptis<select bind:value={direction}><option value="in">Įėjimas</option><option value="out">Išėjimas</option></select></label>
    <label>Signalo tipas<select bind:value={signal}>{#each signals as s}<option value={s}>{s}</option>{/each}</select></label>
    <button class="secondary" type="submit" disabled={!portName.trim()||device.ports.length>=64}>＋ Pridėti prievadą</button>
   </form>
  </details>
 {/if}
 {#if graph.cables.length}
  <details open>
   <summary>Kabeliai</summary>
   <div class="table">
    <table>
     <thead><tr><th>ID</th><th>Signalas</th><th>Iš</th><th>Į</th><th>Tipas</th><th></th></tr></thead>
     <tbody>{#each graph.cables as cable (cable.id)}
      {@const a=getEnd(graph,cable.from)}
      {@const b=getEnd(graph,cable.to)}
      {#if a&&b}<tr>
       <td>{cable.id}</td><td><input maxlength="120" aria-label={'Kabelio '+cable.id+' pavadinimas'} value={cable.name} on:change={event=>rename(cable,event.currentTarget)}/></td>
       <td>{a.device.name} · {a.port.name}</td><td>{b.device.name} · {b.port.name}</td>
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