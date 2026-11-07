<script lang="ts">
 import {supportLoads} from './support-loads';
 import SupportLoads from './SupportLoads.svelte';
 import type {Screen} from './project';
 import {defaultMounting,catalogWeights,hangingPlan,hangingFrameWeight,selectedSlingLength,mountingSummary,type Mounting,type EquipmentWeights,type EquipmentKey} from './mounting';
 export let screen:Screen;
 export let weights:EquipmentWeights=catalogWeights();
 export let onchange:(m:Mounting)=>void;
 export let onweights:(w:EquipmentWeights)=>void;
 $: m=screen.mounting??defaultMounting();
 $: plan=hangingPlan(screen);
 $: slingLength=selectedSlingLength(m);
 $: summary=mountingSummary(screen,weights);
 $: load=m.mode==='hanging'?supportLoads(screen,weights):null;
 const f=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(n);
 const weightFields:{key:EquipmentKey;label:string}[]=[{key:'truss30',label:'Santvara 30, kg/m'},{key:'trussF45',label:'Santvara F45, kg/m'},{key:'shackle',label:'Šekelis, kg/vnt.'},{key:'sling1',label:'1 m stropas, kg/vnt.'},{key:'sling2',label:'2 m stropas, kg/vnt.'},{key:'sling3',label:'3 m stropas, kg/vnt.'}];
</script>
<section class="mounting">
 <div class="section-heading">MONTAVIMAS IR SVORIS · {screen.name}</div>
 <details class="mount-section">
 <summary><span>Montavimo būdas ir komplektacija</span><small>{m.mode==='hanging'?'Kabinamas · '+f(plan.width)+' m':'Statomas'}</small></summary>
 <div class="section-content">
 <label class="field">Montavimo būdas<select value={m.mode} on:change={e=>onchange({...m,mode:e.currentTarget.value as Mounting['mode']})}><option value="standing">Statomas</option><option value="hanging">Kabinamas</option></select></label>
 {#if m.mode==='hanging'}
 <label class="field">Santvaros tipas<select value={m.truss} on:change={e=>onchange({...m,truss:e.currentTarget.value as Mounting['truss']})}><option value="truss30">Santvara 30</option><option value="trussF45">Santvara F45</option></select></label>
 <label class="field">Stropų ilgis<select value={slingLength} on:change={e=>onchange({...m,slingLength:+e.currentTarget.value as 1|2|3})}><option value={1}>1 m</option><option value={2}>2 m</option><option value={3}>3 m</option></select></label>
 <p class="help">Kiekiai skaičiuojami pagal ištiesinto ekrano plotį: 1 m rėmui – 2 stropai ir 2 šekeliai; likusiam 0,5 m rėmui – 1 stropas ir 1 šekelis. Keičiant ekraną kiekiai atsinaujina automatiškai.</p>
 <dl class="spec-list"><div><dt>Ekrano ir santvaros ilgis</dt><dd>{f(plan.width)} m</dd></div><div><dt>Pakabinimo rėmai</dt><dd>{plan.fullFrames} × 1 m + {plan.halfFrames} × 0,5 m</dd></div><div><dt>Stropai / šekeliai</dt><dd>{plan.attachments} / {plan.attachments} vnt.</dd></div></dl>
 {#each summary.issues as issue}<p class="help">{issue}</p>{/each}
 <div class="mount-grid">{#each [1,0.5] as length}<label class="field">{length===1?'1 m':'0,5 m'} rėmo svoris, kg/vnt.<input type="number" min="0" step="any" placeholder="Nenurodyta" value={hangingFrameWeight(screen,length as 0.5|1)??''} on:change={e=>{const v=e.currentTarget.value;if(v===''||(+v>=0&&Number.isFinite(+v)))onchange({...m,[length===1?'frame1Kg':'frameHalfKg']:v===''?null:+v});}} /></label>{/each}</div>
 <details><summary>Įrangos svoriai – visam projektui</summary><div class="mount-grid">{#each weightFields as field}<label class="field">{field.label}<input type="number" min="0" step="any" placeholder="Nenurodyta" value={weights[field.key]??''} on:change={e=>{const v=e.currentTarget.value;if(v===''||(+v>=0&&Number.isFinite(+v)))onweights({...weights,[field.key]:v===''?null:+v});}} /></label>{/each}</div></details>
 <p class="help">Pradiniai svoriai iš senosios skaičiuoklės: santvara 30 – 6,6 kg / 2 m, F45 – 28,44 kg / 2 m. 3 m stropo svoris nenurodytas. Santvaros ilgis lygus ekrano pločiui. Rėmų svoriai parenkami pagal panelių modelį; juos galima patikslinti.</p>
 {:else}<p class="help">Rodomas panelių svoris. Statymo atramos ir pagrindo rėmai į šią sumą neįtraukti.</p>{/if}
 </div></details>
 <details class="mount-section">
 <summary><span>Svorio suvestinė</span><small class:attention={summary.incomplete}>{f(summary.total)} kg{summary.incomplete?' · nepilna suma':''}</small></summary>
 <div class="section-content">
 <dl class="spec-list">{#each summary.lines as line}<div><dt>{line.name} · {f(line.quantity)} {line.unit}</dt><dd>{line.kg===null?'Svoris nenurodytas':f(line.quantity*line.kg)+' kg'}</dd></div>{/each}<div><dt>{m.mode==='hanging'?'Pakabinamas svoris':'Panelių svoris'}</dt><dd>{f(summary.total)} kg{summary.incomplete?' · nepilna suma':''}</dd></div></dl>
 {#if m.mode==='hanging'}<p class="help">Tai nurodytos komplektacijos masė. Kabelius, variklius ir kitą neįrašytą įrangą reikia pridėti atskirai. Leistinos apkrovos netikrinamos.</p>{/if}
</div></details>
{#if m.mode==='hanging'&&load}<details class="mount-section"><summary><span>Kabinimo taškai ir apkrovos</span><small class:attention={!load.ready}>{load.count} taškai · {load.peak===null?'Apkrovos neskaičiuojamos':'max '+f(load.peak)+' kg'}</small></summary><div class="section-content"><SupportLoads {screen} {weights} onchange={supportCount=>onchange({...m,supportCount})} onoffset={supportOffset=>onchange({...m,supportOffset})} /></div></details>{/if}
</section>
<style>.mounting{background:#1b222c;border:1px solid #354352;border-radius:10px;padding:20px;margin-bottom:20px}.mount-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 16px;margin-top:15px}summary{cursor:pointer;font-size:12px;color:#66ddc8;padding:10px 0}@media(max-width:900px){.mount-grid{grid-template-columns:1fr 1fr}}.mount-section{border-top:1px solid #354352}.mount-section>summary{padding:16px 0;font-weight:600;line-height:1.6}.mount-section>summary small{display:inline-block;margin-left:12px;color:#9eafbd;font-size:11px;font-weight:400}.mount-section>summary small.attention{color:#f4b85b}.section-content{padding:3px 0 15px}.mount-section[open]>summary{color:#b7f3e7}@media(max-width:700px){.mount-section>summary small{display:block;margin-left:16px;margin-top:4px}}</style>
