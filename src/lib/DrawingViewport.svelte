<script lang="ts">
 import {onDestroy,tick} from 'svelte';
 import ZoomControls from './ZoomControls.svelte';

 export let aspect:number;
 export let label:string;
 export let enabled=true;
 export let expanded=false;
 export let finishMeasurement:(()=>boolean)|undefined=undefined;

 const maxZoom=5000;
 const presets=[100,200,500,1000,2000,3000,4000,maxZoom];
 let percent=100;
 $: step=percent<500?25:percent<1000?100:250;
 let frame:HTMLDivElement,viewport:HTMLDivElement,sheet:HTMLDivElement,toggle:HTMLButtonElement;
 let hadNativeFullscreen=false;

 function screenPoint(x?:number,y?:number){
  const box=viewport.getBoundingClientRect();
  return {x:x??box.left+viewport.clientWidth/2,y:y??box.top+viewport.clientHeight/2};
 }
 function drawingPoint(x?:number,y?:number){
  const point=screenPoint(x,y),box=sheet.getBoundingClientRect();
  if(!box.width||!box.height)return;
  return {x:Math.max(0,Math.min(1,(point.x-box.left)/box.width)),y:Math.max(0,Math.min(1,(point.y-box.top)/box.height))};
 }
 async function keepPoint(point:ReturnType<typeof drawingPoint>,x?:number,y?:number){
  if(!point)return;
  await tick();
  if(!viewport||!sheet)return;
  const target=screenPoint(x,y),box=sheet.getBoundingClientRect();
  viewport.scrollLeft+=box.left+point.x*box.width-target.x;
  viewport.scrollTop+=box.top+point.y*box.height-target.y;
 }
 function magnify(next:number,x?:number,y?:number){
  next=Math.min(maxZoom,Math.max(100,next));
  if(next===percent)return;
  const point=drawingPoint(x,y);
  percent=next;
  keepPoint(point,x,y);
 }
 function wheel(event:WheelEvent){
  if(!(event.ctrlKey||event.metaKey)||!event.deltaY)return;
  event.preventDefault();
  magnify(percent+(event.deltaY<0?step:-step),event.clientX,event.clientY);
 }
 function setExpanded(value:boolean){
  const point=percent>100?drawingPoint():undefined;
  expanded=value;
  keepPoint(point);
  return point;
 }
 function openExpanded(){
  const point=setExpanded(true),openingZoom=percent;
  // The same editor also fills the window when native fullscreen is unavailable.
  frame.requestFullscreen?.().then(()=>{
   if(expanded&&percent===openingZoom)keepPoint(point);
  }).catch(()=>{});
  toggle.focus({preventScroll:true});
 }
 function closeExpanded(){
  const point=setExpanded(false),closingZoom=percent;
  if(document.fullscreenElement===frame)document.exitFullscreen().then(()=>{
   if(!expanded&&percent===closingZoom)keepPoint(point);
  }).catch(()=>{});
  if(enabled)toggle.focus({preventScroll:true});
 }
 function nativeChanged(){
  if(document.fullscreenElement===frame){
   hadNativeFullscreen=true;
   if(!expanded)document.exitFullscreen().catch(()=>{});
  }else if(hadNativeFullscreen){
   hadNativeFullscreen=false;
   // Browsers may consume Esc themselves. End the chain and keep the editor open.
   if(expanded&&!document.hidden&&!(enabled&&finishMeasurement?.()))closeExpanded();
  }
 }
 function keydown(event:KeyboardEvent){
  if(!enabled||event.defaultPrevented)return;
  if(event.key==='Escape'&&!event.repeat){
   if(event.target instanceof Element){
    if(event.target.closest('input, select, textarea, [contenteditable="true"]'))return;
    const origin=event.target.closest('[data-drawing-viewport], dialog, [role="dialog"]');
    if(origin&&origin!==frame)return;
   }
   if(finishMeasurement?.())event.preventDefault();
   else if(expanded){event.preventDefault();closeExpanded();}
  }else if(event.key==='Tab'&&expanded){
   const items=frame.querySelectorAll<HTMLElement>('button:enabled, select:enabled, input:enabled');
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 }
 $: if(!enabled&&expanded&&frame)closeExpanded();
 onDestroy(()=>{expanded=false;});
</script>

<svelte:window on:keydown={keydown}/>
<svelte:document on:fullscreenchange={nativeChanged}/>
<div class="frame" class:expanded bind:this={frame} data-drawing-viewport role={expanded?'dialog':'group'} aria-modal={expanded||undefined} aria-label={label}>
 <div class="tools">
  <div class="toolbar">
   {#if expanded}<strong>{label}</strong>{/if}
   <ZoomControls {percent} min={100} max={maxZoom} {step} {presets} onchange={magnify}/>
   <button class="expand" type="button" bind:this={toggle} aria-pressed={expanded} on:click={()=>expanded?closeExpanded():openExpanded()}>{expanded?'Grįžti į puslapį':'Visas ekranas'}</button>
  </div>
  {#if expanded}<div class="editing"><slot name="tools"/></div>{/if}
 </div>
 <div class="viewport" role="region" aria-label={label} bind:this={viewport} on:wheel|nonpassive={wheel}>
  <div class="sheet" bind:this={sheet} style:--width={percent+'%'} style:--inline-fit={65*aspect*percent/100+'vh'} style:--full-fit={aspect*percent+'cqh'}><slot/></div>
 </div>
</div>

<style>
 .frame{min-width:0;display:grid;gap:.4rem}
 .toolbar{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:.5rem}
 .toolbar strong{margin-inline-end:auto}.expand{padding:6px 10px;background:#253440;color:#edf3f8;border:1px solid #526376;font-size:12px}
 .viewport{min-width:0;min-height:0;max-height:65vh;overflow:auto;background:#222c37}
 .sheet{position:relative;width:min(var(--width),var(--inline-fit));margin-inline:auto}
 .expanded{position:fixed;inset:0;z-index:100;box-sizing:border-box;width:100%;height:100%;grid-template-rows:auto minmax(0,1fr);padding:.65rem;background:#10141b;color:#e2e8f0}
 .expanded .tools{display:grid;gap:.5rem;max-height:42dvh;overflow:auto}
 .editing{display:grid;gap:.4rem}
 .expanded .viewport{display:flex;flex-direction:column;max-height:none;container-type:size;overscroll-behavior:contain}
 .expanded .sheet{flex:none;width:min(var(--width),var(--full-fit));margin-block:auto}
</style>
