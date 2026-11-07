<script lang="ts">
 import type {Screen} from './project';
 import {defaultMounting,catalogWeights,frameWeight,mountingSummary,type Mounting,type EquipmentWeights,type EquipmentKey} from './mounting';
 export let screen:Screen;
 export let weights:EquipmentWeights=catalogWeights();
 export let onchange:(m:Mounting)=>void;
 export let onweights:(w:EquipmentWeights)=>void;
 $: m=screen.mounting??{...defaultMounting(),frameLength:0.5 as const,frameKg:frameWeight(screen.panel.name,.5)};
 $: summary=mountingSummary(screen,weights);
 const f=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(n);
 const fields=[{key:'length',label:'Surinktos santvaros ilgis, m'},{key:'shackles',label:'Šekelių kiekis'},{key:'sling1',label:'1 m stropų kiekis'},{key:'sling2',label:'2 m stropų kiekis'},{key:'sling3',label:'3 m stropų kiekis'},{key:'frames',label:'Pakabinimo rėmų kiekis'}] as const;
 const weightFields:{key:EquipmentKey;label:string}[]=[{key:'truss30',label:'Santvara 30, kg/m'},{key:'trussF45',label:'Santvara F45, kg/m'},{key:'shackle',label:'Šekelis, kg/vnt.'},{key:'sling1',label:'1 m stropas, kg/vnt.'},{key:'sling2',label:'2 m stropas, kg/vnt.'},{key:'sling3',label:'3 m stropas, kg/vnt.'}];
</script>
<section class="mounting">
 <div class="section-heading">MONTAVIMAS IR SVORIS · {screen.name}</div>
 <label class="field">Montavimo būdas<select value={m.mode} on:change={e=>onchange({...m,mode:e.currentTarget.value as Mounting['mode']})}><option value="standing">Statomas</option><option value="hanging">Kabinamas</option></select></label>
 {#if m.mode==='hanging'}
 <label class="field">Santvaros tipas<select value={m.truss} on:change={e=>onchange({...m,truss:e.currentTarget.value as Mounting['truss']})}><option value="truss30">Santvara 30</option><option value="trussF45">Santvara F45</option></select></label>
 <label class="field">Pakabinimo rėmo ilgis<select value={m.frameLength??.5} on:change={e=>{const length=+e.currentTarget.value as .5|1;onchange({...m,frameLength:length,frameKg:frameWeight(screen.panel.name,length)});}}><option value="0.5">0,5 m</option><option value="1">1 m</option></select></label>
 <p class="help">Rėmo svoris parenkamas pagal modelį iš senosios skaičiuoklės. Jei naudojamas kitoks rėmas, patikslinkite svorį. Rėmų kiekį nurodykite pagal realią komplektaciją.</p>
 <div class="mount-grid">{#each fields as field}<label class="field">{field.label}<input type="number" min="0" max={field.key==='length'?1000:10000} step={field.key==='length'?0.1:1} value={m[field.key]} on:change={e=>{const v=+e.currentTarget.value;if(Number.isFinite(v)&&v>=0&&v<=(field.key==='length'?1000:10000))onchange({...m,[field.key]:field.key==='length'?v:Math.round(v)});}} /></label>{/each}
 <label class="field">Pakabinimo rėmo svoris, kg/vnt.<input type="number" min="0" step="any" placeholder="Nenurodyta" value={m.frameKg??''} on:change={e=>{const v=e.currentTarget.value; if(v===''||(+v>=0&&Number.isFinite(+v)))onchange({...m,frameKg:v===''?null:+v});}} /></label></div>
 <details><summary>Įrangos svoriai – visam projektui</summary><div class="mount-grid">{#each weightFields as field}<label class="field">{field.label}<input type="number" min="0" step="any" placeholder="Nenurodyta" value={weights[field.key]??''} on:change={e=>{const v=e.currentTarget.value;if(v===''||(+v>=0&&Number.isFinite(+v)))onweights({...weights,[field.key]:v===''?null:+v});}} /></label>{/each}</div></details>
 <p class="help">Pradiniai svoriai iš senosios skaičiuoklės: santvara 30 – 6,6 kg / 2 m, F45 – 28,44 kg / 2 m. 3 m stropo svoris nenurodytas. Įrašykite realiai surinktos santvaros ilgį (pvz., 3 × 2 m = 6 m). Bendrą kelių ekranų santvarą įtraukite tik prie vieno ekrano.</p>
 {:else}<p class="help">Rodomas panelių svoris. Statymo atramos ir pagrindo rėmai į šią sumą neįtraukti.</p>{/if}
 <dl class="spec-list">{#each summary.lines as line}<div><dt>{line.name} · {f(line.quantity)} {line.unit}</dt><dd>{line.kg===null?'Svoris nenurodytas':f(line.quantity*line.kg)+' kg'}</dd></div>{/each}<div><dt>{m.mode==='hanging'?'Pakabinamas svoris':'Panelių svoris'}</dt><dd>{f(summary.total)} kg{summary.incomplete?' · nepilna suma':''}</dd></div></dl>
 {#if m.mode==='hanging'}<p class="help">Tai nurodytos komplektacijos masė. Kabelius, variklius ir kitą neįrašytą įrangą reikia pridėti atskirai. Kabinimo taškų apkrovos ir leistinos apkrovos neskaičiuojamos.</p>{/if}
</section>
<style>.mounting{background:#1b222c;border:1px solid #354352;border-radius:10px;padding:20px;margin-bottom:20px}.mount-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 16px;margin-top:15px}summary{cursor:pointer;font-size:12px;color:#66ddc8;padding:10px 0}@media(max-width:900px){.mount-grid{grid-template-columns:1fr 1fr}}</style>
