<script lang="ts">
 import {onDestroy} from 'svelte';
 import type {VwxScene} from './vwx-types';
 import {createVwxRigPlot,vwxDistance} from './vwx-rig-plot';
 import {findVwxEndpoint,vwxAnchorId} from './vwx-endpoints';
 import type {VwxEndpoint} from './vwx-endpoints';
 import {defaultVwxView,drawVwxScene,formatVwxMetres,nativeVwxVisibility,nearestVwxAnchors,pickVwxItem,panelStyles,presetCamera,visibleVwxScene,vwxBounds,vwxClasses} from './vwx-view';
 import type {VwxKind,VwxViewMode,VwxViewSettings,VwxHits} from './vwx-view';
 import ZoomControls from './ZoomControls.svelte';

 export let scene:VwxScene;
 export let settings:VwxViewSettings|undefined=undefined;
 export let onsettings:(value:VwxViewSettings)=>void=()=>{};
 const defaults=defaultVwxView();
 const kinds:{id:VwxKind;name:string}[]=[{id:'panel',name:'Ekranai'},{id:'hoist',name:'Keltuvai'},{id:'truss',name:'Santvaros'},{id:'context',name:'Arena ir kiti objektai'}];
 const modes:{id:VwxViewMode;name:string}[]=[{id:'orbit',name:'3D'},{id:'front',name:'Iš priekio'},{id:'top',name:'Iš viršaus'}];
 type FilterName='hiddenLayers'|'hiddenClasses';
 let searches:Record<FilterName,string>={hiddenLayers:'',hiddenClasses:''};
 let showNativeInfo=false;
 let mode:VwxViewMode='orbit',camera=presetCamera('orbit');
 let canvas:HTMLCanvasElement,frame:HTMLElement,width=0,height=0,expanded=false;
 let hits:VwxHits=[],selected='',origin='',endpoint='',measure=false,query='',limit=40;
 let modelMeasure=false,candidates:VwxEndpoint[]=[],lookup=false,lookupQuery='',lookupOwner='',lookupPoint='';
 let drag:{id:number;x:number;y:number;lastX:number;lastY:number;moved:boolean;pan:boolean}|null=null;
 let animation=0;
 $: state=settings??defaults;
 $: visible=visibleVwxScene(scene,state);
 $: bounds=vwxBounds(visible);
 $: styles=panelStyles(scene.panels);
 $: hoists=visible.objects.filter(o=>o.kind==='hoist').sort((a,b)=>a.name.localeCompare(b.name,'lt',{numeric:true}));
 $: hasNativePoints=visible.panels.length>0||visible.objects.some(o=>o.vertices?.length);
 $: pointSources=lookup&&modelMeasure?[
  ...hoists.map(o=>({id:o.id,name:o.name+' · '+(layerNames.get(o.layerId)??''),points:[o.id]})),
  ...visible.panels.map(p=>({id:p.id,name:p.model+' · '+p.id.slice(0,6).toUpperCase(),points:p.front.map((_,i)=>vwxAnchorId('panel',p.id,i))})),
  ...visible.objects.filter(o=>o.vertices?.length).map(o=>({id:o.id,name:o.name+' · '+o.id.slice(0,6).toUpperCase()+' · '+(layerNames.get(o.layerId)??''),points:o.vertices!.map((_,i)=>vwxAnchorId('vertex',o.id,i))}))
 ]:[];
 $: sourceMatches=pointSources.filter(o=>o.name.toLocaleLowerCase().includes(lookupQuery.toLocaleLowerCase()));
 $: pointOptions=sourceMatches.find(o=>o.id===lookupOwner)?.points??[];
 $: hasNativeVisibility=scene.layers.some(l=>l.nativeVisibility)||scene.classes?.some(c=>c.nativeVisibility);
 $: hasNativeGrey=scene.layers.some(l=>l.nativeVisibility==='grey')||scene.classes?.some(c=>c.nativeVisibility==='grey');
 $: classes=vwxClasses(scene);
 $: classNames=new Map(classes.map(c=>[c.id,c.name]));
 $: groups=[
  {key:'hiddenLayers' as const,title:'Sluoksniai',placeholder:'Ieškoti sluoksnio',options:scene.layers},
  {key:'hiddenClasses' as const,title:'Klasės',placeholder:'Ieškoti klasės',options:classes}
 ];
 $: layerNames=new Map(scene.layers.map(l=>[l.id,l.name]));
 $: items=[...scene.objects.map(o=>({id:o.id,layer:o.layerId,cls:o.classId,kind:o.kind as VwxKind,name:o.name})),
  ...scene.panels.map((p,i)=>({id:p.id,layer:p.layerId,cls:p.classId,kind:'panel' as VwxKind,name:p.model+' · '+(i+1)}))];
 $: filtered=items.filter(item=>!query||[item.name,layerNames.get(item.layer),classNames.get(item.cls??'')].some(s=>s?.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
 $: chosen=items.find(o=>o.id===selected);
 $: visibleMeasurements=state.measurements.filter(m=>findVwxEndpoint(visible,m.from)&&findVwxEndpoint(visible,m.to));
 $: if(canvas&&width&&height)schedule(canvas,width,height,visible,bounds,camera,selected,origin,visibleMeasurements,styles,modelMeasure);
 function schedule(el:HTMLCanvasElement,w:number,h:number,v:VwxScene,b:ReturnType<typeof vwxBounds>,cam:typeof camera,id:string,pending:string,m:typeof visibleMeasurements,colors:typeof styles,anchors:boolean){
  cancelAnimationFrame(animation);
  animation=requestAnimationFrame(()=>{
   const ratio=Math.min(window.devicePixelRatio||1,2);
   if(el.width!==Math.round(w*ratio)||el.height!==Math.round(h*ratio)){el.width=Math.round(w*ratio);el.height=Math.round(h*ratio);}
   const ctx=el.getContext('2d');if(!ctx)return;
   ctx.setTransform(ratio,0,0,ratio,0,0);hits=drawVwxScene(ctx,w,h,v,b,cam,id,pending,m,colors,anchors);
  });
 }
 onDestroy(()=>{if(animation)cancelAnimationFrame(animation);});
 function update(next:VwxViewSettings){settings=next;onsettings(next);}
 function toggle<T>(values:T[],id:T){return values.includes(id)?values.filter(x=>x!==id):[...values,id];}
 function changeMode(next:VwxViewMode){mode=next;camera=presetCamera(next);}
 function fit(){camera={...camera,zoom:1,x:0,y:0};}
 function magnify(percent:number){camera={...camera,zoom:Math.max(.2,Math.min(50,percent/100))};}
 function useNativeVisibility(){
  update(nativeVwxVisibility(scene,state));selected='';resetMeasure();fit();showNativeInfo=true;
 }
 function presetVisibility(screensOnly:boolean){showNativeInfo=false;update({...state,hiddenKinds:screensOnly?['hoist','truss','context']:[],hiddenLayers:[],hiddenClasses:[],hiddenObjects:[]});selected='';origin='';fit();}
 function measurePoint(id:string){
  if(!findVwxEndpoint(visible,id))return;
  candidates=[];
  if(!origin||!findVwxEndpoint(visible,origin)){origin=id;return;}
  if(origin===id)return;
  if(!state.measurements.some(m=>(m.from===origin&&m.to===id)||(m.from===id&&m.to===origin))){
   update({...state,measurements:[...state.measurements,{from:origin,to:id}]});
  }
  origin=id;endpoint='';
 }
 function resetMeasure(){origin='';endpoint='';candidates=[];lookupPoint='';}
 function keydown(e:KeyboardEvent){
  if(e.key==='Escape'&&(expanded||frame?.contains(document.activeElement))){
   if(origin||candidates.length){resetMeasure();e.preventDefault();}
   else if(expanded){expanded=false;e.preventDefault();}
  }
 }
 function canvasKey(e:KeyboardEvent){
  const delta:Record<string,[number,number]>={ArrowLeft:[-.13,0],ArrowRight:[.13,0],ArrowUp:[0,.13],ArrowDown:[0,-.13]};
  if(delta[e.key]){e.preventDefault();rotate(...delta[e.key]);}
  if(e.key==='+'||e.key==='=')magnify(camera.zoom*125);
  if(e.key==='-')magnify(camera.zoom*80);
 }
 function rotate(dx:number,dy:number){mode='orbit';camera={...camera,yaw:camera.yaw+dx,pitch:Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch+dy))};}
 function pointerDown(e:PointerEvent){
  if(e.button>1||drag)return;
  e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,pan:e.shiftKey||e.button===1||mode!=='orbit'};
 }
 function pointerMove(e:PointerEvent){
  if(!drag||drag.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3)drag.moved=true;
  if(!drag.moved)return;
  const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;
  if(drag.pan)camera={...camera,x:camera.x+dx,y:camera.y+dy};else rotate(-dx*.008,dy*.008);
  drag.lastX=e.clientX;drag.lastY=e.clientY;
 }
 function pointerUp(e:PointerEvent){
  if(!drag||drag.id!==e.pointerId)return;
  if(!drag.moved){
   const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;
   if(modelMeasure){
    const matches=nearestVwxAnchors(hits,x,y).map(id=>findVwxEndpoint(visible,id)).filter((a):a is VwxEndpoint=>!!a);
    if(matches.length===1)measurePoint(matches[0].id);else candidates=matches;
   }else{
    const id=pickVwxItem(hits,x,y,measure);
    selected=id??'';if(id&&measure)measurePoint(id);
   }
  }
  drag=null;
 }
 function wheel(e:WheelEvent){e.preventDefault();magnify(camera.zoom*100*Math.exp(-Math.max(-140,Math.min(140,e.deltaY))*.002));}
 function exportRig(){
  const svg=createVwxRigPlot(visible,visibleMeasurements);
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=(scene.fileName.replace(/\.vwx$/i,'')||'VWX')+'-kabinimo-planas.svg';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
</script>

<svelte:window on:keydown={keydown}/>
<section class="vwx" bind:this={frame} class:expanded aria-label="Vectorworks modelis">
 <div class="bar">
  <div class="buttons" role="group" aria-label="Modelio vaizdas">{#each modes as m}<button type="button" aria-pressed={mode===m.id} on:click={()=>changeMode(m.id)}>{m.name}</button>{/each}</div>
  <div class="buttons"><button type="button" on:click={()=>presetVisibility(true)}>Tik ekranai</button><button type="button" on:click={()=>presetVisibility(false)}>Rodyti viską</button>
   {#if hasNativeVisibility}<button type="button" on:click={useNativeVisibility}>Kaip VWX brėžinyje</button>{/if}</div>
  <button type="button" aria-pressed={expanded} on:click={()=>expanded=!expanded}>{expanded?'Grįžti į puslapį':'Visas ekranas'}</button>
 </div>
 <div class="stage" bind:clientWidth={width} bind:clientHeight={height}>
  <canvas bind:this={canvas} tabindex="0" aria-label="VWX modelis. Rodyklėmis pasukite, pliusu ir minusu keiskite mastelį."
    on:wheel|nonpassive={wheel} on:keydown={canvasKey} on:pointerdown={pointerDown} on:pointermove={pointerMove} on:pointerup={pointerUp} on:pointercancel={()=>drag=null} on:lostpointercapture={()=>drag=null}></canvas>
  {#if !visible.panels.length&&!visible.objects.length}<span class="empty">Nėra matomų objektų. Patikrinkite sluoksnių, klasių ir objektų filtrus.</span>{/if}
 </div>
 <div class="bar"><small>{mode==='orbit'?'Tempkite, kad pasuktumėte. Laikykite Shift, kad pastumtumėte.':'Tempkite, kad pastumtumėte vaizdą.'}</small>
  <ZoomControls percent={Math.round(camera.zoom*100)} min={20} max={5000} step={camera.zoom<2?25:100} onchange={magnify} onfit={fit}/></div>
 {#if visible.panels.length}<div class="legend">{#each [...styles] as [size,colors]}<span><i style:background={colors[0]}></i>{size} mm</span>{/each}</div>{/if}
 {#if showNativeInfo&&hasNativeGrey}<small>Brėžinyje papilkinti sluoksniai ir klasės čia rodomi įprastomis spalvomis.</small>{/if}
 {#if scene.contextSimplified&&!state.hiddenKinds.includes('context')}<small>Arenos ir kitų objektų geometrija rodoma supaprastintai.</small>{/if}
 {#if chosen}<div class="bar selection"><span>{chosen.name} · {layerNames.get(chosen.layer)}</span><button type="button" on:click={()=>{update({...state,hiddenObjects:toggle(state.hiddenObjects,chosen!.id)});selected='';}}> {state.hiddenObjects.includes(chosen.id)?'Rodyti objektą':'Slėpti objektą'}</button></div>{/if}
 <details>
  <summary>Sluoksniai, klasės ir objektai <small>{visible.panels.length} panel. · {hoists.length} kelt.</small></summary>
  <div class="checks" aria-label="Objektų tipai">{#each kinds as kind}<label><input type="checkbox" checked={!state.hiddenKinds.includes(kind.id)} on:change={()=>update({...state,hiddenKinds:toggle(state.hiddenKinds,kind.id)})}/>{kind.name}</label>{/each}</div>
  <div class="filter-columns">
   {#each groups as group}
    {@const hidden=state[group.key]??[]}
    {@const search=searches[group.key].trim().toLocaleLowerCase()}
    {@const matches=group.options.filter(o=>o.name.toLocaleLowerCase().includes(search))}
    <section class="filter-group" aria-label={group.title}>
     <div class="filter-heading"><strong>{group.title}</strong><small>{group.options.filter(o=>!hidden.includes(o.id)).length} / {group.options.length}</small></div>
     {#if group.options.length}
      <input type="search" aria-label={group.placeholder} placeholder={group.placeholder} bind:value={searches[group.key]}/>
      <div class="bulk"><button type="button" on:click={()=>update({...state,[group.key]:[]})}>{group.key==='hiddenClasses'?'Įjungti visas':'Įjungti visus'}</button>
      <button type="button" on:click={()=>update({...state,[group.key]:group.options.map(o=>o.id)})}>{group.key==='hiddenClasses'?'Išjungti visas':'Išjungti visus'}</button></div>
      <div class="filter-options" class:layers={group.key==='hiddenLayers'} class:classes={group.key==='hiddenClasses'}>
       {#each matches as opt (opt.id)}
        <label><input type="checkbox" checked={!hidden.includes(opt.id)} on:change={()=>update({...state,[group.key]:toggle(hidden,opt.id)})}/>{opt.name}</label>
       {/each}
       {#if !matches.length}<small>Atitikmenų nerasta.</small>{/if}
      </div>
     {:else}<small>Šiame modelyje {group.key==='hiddenClasses'?'klasės':'sluoksniai'} nenuskaityti.</small>{/if}
    </section>
   {/each}
  </div>
  <details><summary>Atskiri objektai</summary>
   <label class="search">Ieškoti objekto<input type="search" bind:value={query} on:input={()=>limit=40} placeholder="Pavadinimas, sluoksnis arba klasė"/></label>
   <div class="object-list">{#each filtered.slice(0,limit) as item (item.id)}<label><input type="checkbox" checked={!state.hiddenObjects.includes(item.id)} on:change={()=>update({...state,hiddenObjects:toggle(state.hiddenObjects,item.id)})}/>{item.name}<small>{[layerNames.get(item.layer),classNames.get(item.cls??'')].filter(Boolean).join(' · ')}</small></label>{/each}</div>
   {#if filtered.length>limit}<button type="button" on:click={()=>limit+=40}>Rodyti daugiau</button>{/if}
  </details>
 </details>
 <div class="bar"><button type="button" aria-pressed={measure} disabled={!hoists.length} on:click={()=>{measure=!measure;modelMeasure=false;resetMeasure();}}>Matuoti tarp keltuvų</button>
  <button type="button" aria-pressed={modelMeasure} disabled={!hasNativePoints} on:click={()=>{modelMeasure=!modelMeasure;measure=false;resetMeasure();}}>Matuoti modelio taškus</button>
  <button type="button" class="export" disabled={!hoists.length&&!visibleMeasurements.length} on:click={exportRig}>Eksportuoti kabinimo planą (SVG)</button></div>
 {#if measure&&hoists.length}
  <div class="measure-controls">
   <label>Nuo<select bind:value={origin}><option value="">Pasirinkite tašką</option>{#each hoists as o}<option value={o.id}>{o.name} · Z {formatVwxMetres(o.position[2])}</option>{/each}</select></label>
   <label>Iki<select bind:value={endpoint}><option value="">Pasirinkite tašką</option>{#each hoists as o}<option value={o.id} disabled={o.id===origin}>{o.name} · Z {formatVwxMetres(o.position[2])}</option>{/each}</select></label>
   <button type="button" disabled={!origin||!endpoint||origin===endpoint} on:click={()=>measurePoint(endpoint)}>Matuoti</button>
   <button type="button" disabled={!origin} on:click={resetMeasure}>Nauja atkarpų seka</button>
  </div>
  <small>Taškus galite spragtelėti brėžinyje. Esc užbaigia atkarpų seką.</small>
 {/if}
 {#if modelMeasure}
  <div class="bar"><span>{origin?'Nuo '+(findVwxEndpoint(scene,origin)?.name??''):'Pasirinkite pirmą tašką'}</span>
   <button type="button" disabled={!origin&&!candidates.length} on:click={resetMeasure}>Nauja atkarpų seka</button></div>
  <small>Spragtelėkite keltuvą, priekinį panelės kampą arba modelio linijos viršūnę.</small>
  {#if candidates.length}<div class="ambiguous"><strong>Pasirinkite tašką šioje vietoje</strong>
   {#each candidates as opt (opt.id)}<button type="button" on:click={()=>measurePoint(opt.id)}>{opt.name} · Z {formatVwxMetres(opt.position[2])}</button>{/each}</div>{/if}
  <details bind:open={lookup}><summary>Parinkti tašką iš sąrašo</summary>
  {#if lookup}
   <div class="measure-controls">
    <label>Ieškoti objekto<input type="search" bind:value={lookupQuery} placeholder="Modelis, sluoksnis, ID"/></label>
    <label>Objektas<select bind:value={lookupOwner} on:change={()=>lookupPoint=''}><option value="">Pasirinkite objektą</option>
     {#each sourceMatches.slice(0,150) as o}<option value={o.id}>{o.name}</option>{/each}</select></label>
    <label>Taškas<select bind:value={lookupPoint}><option value="">Pasirinkite tašką</option>{#each pointOptions as id}
     {@const p=findVwxEndpoint(visible,id)}{#if p}<option value={id}>{p.name} · Z {formatVwxMetres(p.position[2])}</option>{/if}{/each}</select></label>
    <button type="button" disabled={!pointOptions.includes(lookupPoint)} on:click={()=>measurePoint(lookupPoint)}>Pridėti tašką</button>
   </div>{#if sourceMatches.length>150}<small>Rodomi pirmi 150 objektų. Patikslinkite paiešką.</small>{/if}
  {/if}</details>
 {/if}
 {#if state.measurements.length}
  <div class="metrics"><table><thead><tr><th>Taškai</th><th>Plane (XY)</th><th>Erdvėje (XYZ)</th><th aria-label="Pašalinti"></th></tr></thead><tbody>
  {#each state.measurements as m,i}
   {@const a=findVwxEndpoint(scene,m.from)}{@const b=findVwxEndpoint(scene,m.to)}
   {#if a&&b}{@const d=vwxDistance(a.position,b.position)}
   <tr><td>{a.name} – {b.name}</td><td>{formatVwxMetres(d.xy)}</td><td>{formatVwxMetres(d.xyz)}</td>
   <td><button type="button" aria-label={'Trinti '+a.name+' – '+b.name} on:click={()=>update({...state,measurements:state.measurements.filter((_,index)=>index!==i)})}>×</button></td></tr>{/if}
  {/each}
  </tbody></table></div>
 {/if}
</section>
<style>
 .vwx{display:grid;gap:.65rem;min-width:0}.bar,.buttons,.checks,.measure-controls{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}.bar{justify-content:space-between}
 .vwx button{padding:.42rem .68rem;border:1px solid #485462;border-radius:6px;background:#24303c;color:#e4edf2;font:inherit;font-size:.82rem;cursor:pointer}
 .vwx button:hover{border-color:#7b93a5}.vwx button:disabled{opacity:.5;cursor:default}.vwx button[aria-pressed=true]{background:#28544f;border-color:#69d0c0;color:white}
 .stage{position:relative;height:clamp(300px,56vh,780px);overflow:hidden;background:#111923;border:1px solid #34404d;border-radius:6px}
 canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}canvas:active{cursor:grabbing}.empty{position:absolute;inset:45% 1rem auto;text-align:center;color:#c6d1d6;pointer-events:none}
 small{color:#a3b5c1;font-size:.78rem}.vwx details{padding:.6rem;border:1px solid #354351;border-radius:6px}.vwx summary{cursor:pointer;font-weight:600;color:#d4e4e8}.vwx summary small{font-weight:400;margin-left:.5rem}
 .legend{display:flex;gap:1rem;flex-wrap:wrap;color:#b5c5cf;font-size:.8rem}.legend span{display:inline-flex;align-items:center;gap:.35rem}.legend i{width:.75rem;height:.75rem;border-radius:2px}
 .checks{padding:.45rem 0;gap:.45rem 1rem}.checks label,.object-list label{display:flex;align-items:center;gap:.35rem;color:#cfdee4}.checks input,.object-list input{width:auto;margin:0;accent-color:#64dbca}
 .filter-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:.7rem;margin:.5rem 0 .65rem}
 .filter-group{display:flex;flex-direction:column;gap:.4rem;padding:.55rem;border:1px solid #354351;border-radius:6px;min-width:0}
 .filter-heading,.bulk{display:flex;align-items:center;gap:.4rem}.filter-heading{justify-content:space-between}.bulk button{font-size:.76rem;padding:.25rem .45rem}.filter-group input[type=search]{width:100%}
 .filter-options{display:grid;gap:.3rem;max-height:11rem;overflow:auto;overscroll-behavior:contain}
 .filter-options label{display:flex;align-items:center;gap:.35rem;word-break:break-word;color:#cfdee4}.filter-options input{width:auto;margin:0;accent-color:#64dbca}.object-list{display:grid;gap:.35rem;max-height:16rem;overflow:auto;margin:.5rem 0}.object-list small{margin-left:auto}
 .search,.measure-controls label{display:grid;gap:.15rem;color:#cddde6;font-size:.8rem}.measure-controls{align-items:end}.selection{padding:.4rem .6rem;background:#22313c}
 .ambiguous{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;max-height:12rem;overflow:auto}.ambiguous strong{width:100%;font-size:.85rem}
 .metrics{max-height:22rem;overflow:auto}.metrics table{border-collapse:collapse;width:100%;font-size:.85rem}.metrics td,.metrics th{padding:.35rem;border-bottom:1px solid #333f4d;text-align:left}
 .vwx .export{border-color:#47897f}.expanded{display:block;position:fixed;inset:0;z-index:110;overflow:auto;background:#141c25;padding:1rem}.expanded>*{margin-bottom:.65rem}.expanded .stage{height:70dvh}
 @media(max-width:620px){.bar{justify-content:flex-start}.stage{height:390px}.measure-controls label{max-width:48%}}
</style>
