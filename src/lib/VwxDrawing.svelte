<script lang="ts">
 import {onDestroy,onMount} from 'svelte';
 import {readVwxScene} from './drawing-files';
 import type {VwxDrawing} from './drawing-project';
 import type {VwxScene} from './vwx-types';
 import type {VwxViewSettings} from './vwx-view';
 import type {Panel,Screen} from './project';
 import VwxViewport from './VwxViewport.svelte';
 import VwxScreenImport from './VwxScreenImport.svelte';

 export let source:VwxDrawing;
 export let screens:Screen[],catalog:Panel[];
 export let oncreate:(items:Screen[])=>void;
 export let onsettings:(settings:VwxViewSettings)=>void;

 let scene:VwxScene|undefined,error='',revision=0;
 async function restore(hash:string){
  const request=++revision;
  scene=undefined;error='';
  try{
   const value=await readVwxScene({hash,name:source.name});
   if(request===revision)scene=value;
  }catch(e){if(request===revision)error=e instanceof Error?e.message:'Nepavyko atidaryti 3D modelio.';}
 }
 onMount(()=>{void restore(source.hash);});
 onDestroy(()=>{revision++;});
</script>
{#if scene}
 {#if scene.classes===undefined}
  <p class="legacy-model">Jei norite matyti VWX klases ir iš naujo atpažinti ekranus, viršuje dar kartą įkelkite tą patį VWX failą.</p>
 {:else if !scene.panels.length}
  <p class="legacy-model">Šiame modelyje LED ekranų neatpažinta. Jei brėžinį įkėlėte ankstesnėje „LED Studijos“ versijoje, dar kartą įkelkite originalų VWX failą.</p>
 {/if}
 <VwxViewport {scene} settings={source.settings} {onsettings}/>
 <VwxScreenImport {scene} {catalog} {screens} {oncreate}/>
{:else if error}
 <p role="alert">{error} Galite dar kartą įkelti pradinį VWX failą.</p>
{:else}
 <p role="status">Atidaromas 3D modelis…</p>
{/if}

<style>
 .legacy-model{margin:0;color:#bcd1de;font-size:.88rem}
</style>
