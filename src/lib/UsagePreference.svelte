<script lang="ts">
 import {onMount} from 'svelte';
 import {usageDays,visitInterval} from './usage';
 type Preference='allowed'|'declined'|'undecided';
 export let initial:Preference;
 let preference=initial;
 let expanded=initial==='undecided';
 let busy=false;
 let failed=false;
 let lastAttempt=0;

 async function send(action:'allow'|'decline'|'visit'){
  const response=await fetch('/api/usage',{method:'POST',headers:{'x-led-usage':action},keepalive:true});
  if(!response.ok)throw Error('Usage preference request failed');
 }

 function trackVisit(){
  if(preference!=='allowed'||document.visibilityState!=='visible'||Date.now()-lastAttempt<visitInterval)return;
  lastAttempt=Date.now();
  void send('visit').catch(()=>{lastAttempt=0;});
 }

 async function choose(choice:'allow'|'decline'){
  if(busy)return;
  busy=true;
  failed=false;
  try{
   await send(choice);
   preference=choice==='allow'?'allowed':'declined';
   lastAttempt=choice==='allow'?Date.now():0;
   expanded=false;
  }catch{failed=true;}
  finally{busy=false;}
 }

 onMount(()=>{
  trackVisit();
  document.addEventListener('visibilitychange',trackVisit);
  return ()=>document.removeEventListener('visibilitychange',trackVisit);
 });
</script>

{#if expanded}
 <section class="preference" aria-labelledby="usage-preference-title">
  <h2 id="usage-preference-title">Naudojimo statistika</h2>
  <p>Jei sutiksite, skaičiuoklė {usageDays} dienų slapuku atpažins šią naršyklę. Įrašomas atsitiktinis naršyklės kodas ir apsilankymo laikas. Pasirinkimą galėsite pakeisti bet kada.</p>
  {#if failed}<p role="alert">Pasirinkimo išsaugoti nepavyko. Bandykite dar kartą.</p>{/if}
  <div class="choices">
   <button type="button" class="secondary" disabled={busy} on:click={()=>choose('decline')}>Nesutinku</button>
   <button type="button" class="secondary" disabled={busy} on:click={()=>choose('allow')}>Sutinku</button>
  </div>
 </section>
{:else}
 <button class="preference-link" type="button" on:click={()=>expanded=true}>Statistikos nustatymai</button>
{/if}

<style>
 .preference{position:fixed;bottom:16px;right:16px;z-index:9;width:min(350px,calc(100vw - 32px));padding:14px 16px;background:#202733;border:1px solid #465364;border-radius:9px;box-shadow:0 4px 18px #0005}
 h2{margin:0 0 6px;font-size:14px}
 p{margin:0 0 12px;font-size:12px;line-height:1.45;color:#c0ccd8}
 .choices{display:flex;gap:8px}
 .choices button{flex:1}
 .preference-link{display:flex;margin:8px 0 0;padding:0;background:none;border:0;color:#9ba9bb;text-align:left;font-size:10px}
 @media print{.preference,.preference-link{display:none}}
</style>
