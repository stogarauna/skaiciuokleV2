<script lang="ts">
 import {supportLoads} from './support-loads';
 import SupportLoads from './SupportLoads.svelte';
 import type {Screen} from './project';
 import {defaultMounting,catalogWeights,equipmentFields,equipmentKeys,hangingPlan,hangingFrameWeight,selectedSlingLength,mountingSummary,type Mounting,type EquipmentWeights} from './mounting';
 export let screen:Screen;
 export let weights:EquipmentWeights=catalogWeights();
 export let onchange:(m:Mounting)=>void;
 $: m=screen.mounting??defaultMounting();
 $: plan=hangingPlan(screen);
 $: slingLength=selectedSlingLength(m);
 $: summary=mountingSummary(screen,weights);
 $: load=m.mode==='hanging'?supportLoads(screen,weights):null;
 const f=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(n);
</script>
<section class="mounting">
 <div class="section-heading">MONTAVIMAS IR SVORIS · {screen.name}</div>
 <details class="mount-section" open>
 <summary><span>Montavimo būdas ir komplektacija</span><small>{m.mode==='hanging'?'Kabinamas · '+f(plan.width)+' m':'Statomas'}</small></summary>
 <div class="section-content">
 <label class="field">Montavimo būdas<select value={m.mode} on:change={e=>onchange({...m,mode:e.currentTarget.value as Mounting['mode']})}><option value="standing">Statomas</option><option value="hanging">Kabinamas</option></select></label>
 {#if m.mode==='hanging'}
 <label class="field">Santvaros tipas<select value={m.truss} on:change={e=>onchange({...m,truss:e.currentTarget.value as Mounting['truss']})}><option value="truss30">Prolyte H30V</option><option value="trussF45">Global Truss F45</option></select></label>
 <label class="field">Stropų ilgis<select value={slingLength} on:change={e=>onchange({...m,slingLength:+e.currentTarget.value as 1|2|3})}><option value={1}>1 m</option><option value={2}>2 m</option><option value={3}>3 m</option></select></label>
 <p class="help">Kiekiai skaičiuojami pagal ištiesinto ekrano plotį: 1 m rėmui – 2 stropai ir 2 šekeliai; likusiam 0,5 m rėmui – 1 stropas ir 1 šekelis. Keičiant ekraną kiekiai atsinaujina automatiškai.</p>
 <dl class="spec-list"><div><dt>Ekrano ir santvaros ilgis</dt><dd>{f(plan.width)} m</dd></div><div><dt>Pakabinimo rėmai</dt><dd>{plan.fullFrames} × 1 m + {plan.halfFrames} × 0,5 m</dd></div><div><dt>Stropai / šekeliai</dt><dd>{plan.attachments} / {plan.attachments} vnt.</dd></div></dl>
 {#each summary.issues as issue}<p class="help">{issue}</p>{/each}
 <details open>
  <summary>Įrangos svoriai – visam projektui</summary>
  <dl class="spec-list">
   {#each equipmentKeys as key}<div><dt>{equipmentFields[key].name}</dt><dd>{weights[key]===null?'Nenurodyta':f(weights[key])+' '+equipmentFields[key].unit}</dd></div>{/each}
   {#each [1,0.5] as length}{@const weight=hangingFrameWeight(screen,length as 0.5|1)}<div><dt>{length===1?'1 m':'0,5 m'} pakabinimo rėmas</dt><dd>{weight===null?'Nenurodyta':f(weight)+' kg/vnt.'}</dd></div>{/each}
  </dl>
  <p class="help">Bendrą katalogą galima keisti administravimo skiltyje.</p>
 </details>
 {:else}<p class="help">Rodomas panelių svoris. Statymo atramos ir pagrindo rėmai į šią sumą neįtraukti.</p>{/if}
 </div></details>
 <details class="mount-section" open>
 <summary><span>Svorio suvestinė</span><small class:attention={summary.incomplete}>{f(summary.total)} kg{summary.incomplete?' · nepilna suma':''}</small></summary>
 <div class="section-content">
 <dl class="spec-list">{#each summary.lines as line}<div><dt>{line.name} · {f(line.quantity)} {line.unit}</dt><dd>{line.kg===null?'Svoris nenurodytas':f(line.quantity*line.kg)+' kg'}</dd></div>{/each}<div><dt>{m.mode==='hanging'?'Pakabinamas svoris':'Panelių svoris'}</dt><dd>{f(summary.total)} kg{summary.incomplete?' · nepilna suma':''}</dd></div></dl>
 {#if m.mode==='hanging'}<p class="help">Tai nurodytos komplektacijos masė. Kabelius, variklius ir kitą neįrašytą įrangą reikia pridėti atskirai. Leistinos apkrovos netikrinamos.</p>{/if}
</div></details>
{#if m.mode==='hanging'&&load}<details class="mount-section" open><summary><span>Kabinimo taškai ir apkrovos</span><small class:attention={!load.ready}>{load.count} taškai · {load.peak===null?'Apkrovos neskaičiuojamos':'max '+f(load.peak)+' kg'}</small></summary><div class="section-content"><SupportLoads {screen} {weights} onchange={supportCount=>onchange({...m,supportCount})} onoffset={supportOffset=>onchange({...m,supportOffset})} /></div></details>{/if}
</section>
<style>.mounting{background:#1b222c;border:1px solid #354352;border-radius:10px;padding:20px;margin-bottom:20px}summary{cursor:pointer;font-size:12px;color:#66ddc8;padding:10px 0}.mount-section{border-top:1px solid #354352}.mount-section>summary{padding:16px 0;font-weight:600;line-height:1.6}.mount-section>summary small{display:inline-block;margin-left:12px;color:#9eafbd;font-size:11px;font-weight:400}.mount-section>summary small.attention{color:#f4b85b}.section-content{padding:3px 0 15px}.mount-section[open]>summary{color:#b7f3e7}@media(max-width:700px){.mount-section>summary small{display:block;margin-left:16px;margin-top:4px}}</style>
