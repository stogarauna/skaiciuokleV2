<script lang="ts">
 import type {Screen} from './project';
 import type {EquipmentWeights} from './mounting';
 import {supportLoads,supportModelNote,supportScopeNote} from './support-loads';
 export let screen:Screen;
 export let weights:EquipmentWeights;
 export let onchange:(count:number)=>void;
 $: load=supportLoads(screen,weights);
 $: maximum=Math.max(...load.points.map(p=>p.share));
 const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n);
</script>
<section class="support-loads" aria-label="Santvaros kabinimo taškų apkrovos">
 <div class="heading"><div><div class="section-heading">SANTVAROS KABINIMO TAŠKAI</div><h2>Apkrova kiekviename taške</h2></div><label class="field">Kabinimo taškų skaičius<select value={load.count} on:change={e=>onchange(+e.currentTarget.value)}>{#each [2,3,4,5,6,7,8] as n}<option value={n}>{n} taškai</option>{/each}</select></label></div>
 <p class="help">Tai viršutiniai santvaros taškai / varikliai. Ekrano stropų ir šekelių kiekiai dėl šio pasirinkimo nesikeičia.</p>
 <div class="load-metrics"><span>Bendra modelio apkrova<strong>{load.total===null?'Nenurodyta':f(load.total)+' kg'}</strong></span><span>Tarpas tarp taškų<strong>{f(load.spacing)} m</strong></span><span>Didžiausia taško apkrova<strong>{load.peak===null?'Nenurodyta':f(load.peak)+' kg'}</strong></span></div>
 {#each load.issues as issue}<p class="issue">{issue} Apkrovos kilogramais neskaičiuojamos.</p>{/each}
 <div class="beam-view"><svg viewBox="0 0 800 210" role="img" aria-label={`${load.count} vienodais tarpais išdėstyti santvaros kabinimo taškai`}>
  <rect x="55" y="137" width="690" height="12" rx="3" fill="#354f5d" />
  {#each load.points as point,i}{@const x=55+i*690/(load.count-1)}
   <line x1={x} y1="91" x2={x} y2="137" stroke={point.share===maximum?'#f4b85b':'#64d7c3'} stroke-width="3" />
   <circle cx={x} cy="137" r="5" fill={point.share===maximum?'#f4b85b':'#64d7c3'} />
   <text x={x} y="27" text-anchor="middle" fill="#dce8ed" font-size="13">{point.name}</text>
   <text x={x} y="52" text-anchor="middle" fill={point.share===maximum?'#f4b85b':'#64d7c3'} font-size="14" font-weight="600">{point.kg===null?'—':f(point.kg)+' kg'}</text>
   <text x={x} y="74" text-anchor="middle" fill="#9aabb8" font-size="12">{f(point.share*100)} %</text>
   <text x={x} y="176" text-anchor="middle" fill="#9aabb8" font-size="12">{f(point.x)} m</text>
  {/each}
 </svg></div>
 <div class="point-cards">{#each load.points as point}<div class:peak={point.share===maximum}><span>{point.name} · {f(point.x)} m</span><strong>{point.kg===null?'Nenurodyta':f(point.kg)+' kg'}</strong><small>{f(point.share*100)} %</small></div>{/each}</div>
 <p class="help">{supportModelNote} Bendra komplektacijos masė šiame modelyje laikoma tolygiai paskirstyta.</p>
 <p class="help">{supportScopeNote} Realų kelių taškų pasiskirstymą patvirtina apkrovos davikliai.</p>
</section>
<style>
 .support-loads{margin-top:24px;border-top:1px solid #354352;padding-top:24px}.heading{display:flex;justify-content:space-between;align-items:start;gap:20px}.heading h2{font-size:20px;margin:8px 0 16px}.heading .field{min-width:185px}.load-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:18px 0}.load-metrics span{color:#9aabb8;font-size:12px}.load-metrics strong{display:block;color:#dce8ed;font-size:20px;margin-top:7px}.beam-view{overflow-x:auto;background:#141b24;border:1px solid #354352;border-radius:9px}.beam-view svg{width:100%;min-width:660px;display:block}.point-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin:12px 0 18px}.point-cards div{border:1px solid #354352;border-radius:8px;padding:12px}.point-cards span,.point-cards small{font-size:11px;color:#9aabb8;display:block}.point-cards strong{font-size:16px;display:block;color:#64d7c3;margin:7px 0}.point-cards .peak{border-color:#a47d42}.point-cards .peak strong{color:#f4b85b}.issue{font-size:13px;color:#f4b85b}@media(max-width:700px){.heading{display:block}.load-metrics{grid-template-columns:1fr}.heading .field{max-width:240px}}
</style>
