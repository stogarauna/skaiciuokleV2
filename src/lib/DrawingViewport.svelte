<script lang="ts">
 import {tick} from 'svelte';
 import ZoomControls from './ZoomControls.svelte';

 export let aspect:number;
 export let label:string;
 const maxZoom=1000;
 let percent=100;
 let viewport:HTMLDivElement, sheet:HTMLDivElement;
 async function magnify(next:number, x?:number, y?:number){
  next=Math.min(maxZoom,Math.max(100,next));
  if(next===percent)return;
  const frame=viewport.getBoundingClientRect();
  const before=sheet.getBoundingClientRect();
  const cx=x??frame.left+viewport.clientWidth/2;
  const cy=y??frame.top+viewport.clientHeight/2;
  const u=(cx-before.left)/before.width,v=(cy-before.top)/before.height;
  percent=next;
  await tick();
  const after=sheet.getBoundingClientRect();
  viewport.scrollLeft+=after.left+u*after.width-cx;
  viewport.scrollTop+=after.top+v*after.height-cy;
 }
 function wheel(e:WheelEvent){
  if(!(e.ctrlKey||e.metaKey)||!e.deltaY)return;
  e.preventDefault();
  magnify(percent+(e.deltaY<0?25:-25),e.clientX,e.clientY);
 }
</script>

<div class="frame">
 <ZoomControls {percent} min={100} max={maxZoom} step={25} onchange={magnify} />
 <div class="viewport" role="region" aria-label={label} bind:this={viewport} on:wheel|nonpassive={wheel}>
  <div class="sheet" bind:this={sheet} style:width={'min('+percent+'%, '+65*aspect*percent/100+'vh)'}><slot /></div>
 </div>
</div>

<style>
 .frame{min-width:0;display:grid;gap:.4rem}
 .viewport{min-width:0;max-height:65vh;overflow:auto;background:#222c37}
 .sheet{position:relative;margin-inline:auto}
</style>
