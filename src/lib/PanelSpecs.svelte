<script lang="ts">
 import type {Panel} from './project';
 export let panel:Panel;
 const f=(value:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3}).format(value);
 function value(raw:unknown,unit='',scale=1):string{
  if(Array.isArray(raw))return raw.map(item=>value(item,unit,scale)).join(' / ');
  return typeof raw==='number'&&Number.isFinite(raw)?`${f(raw*scale)}${unit?' '+unit:''}`:'Nenurodyta';
 }
 $: groups=[
  {title:'Matmenys ir raiška',rows:[
   ['Plotis',value(panel.widthM,'mm',1000)],['Aukštis',value(panel.heightM,'mm',1000)],['Storis',value(panel.depthM,'mm',1000)],
   ['Raiška',`${f(panel.resX)} × ${f(panel.resY)} px`],['Pikselių skaičius',value(panel.resX*panel.resY,'px')],
   ['Pikselio žingsnis X',value(panel.widthM*1000/panel.resX,'mm')],['Pikselio žingsnis Y',value(panel.heightM*1000/panel.resY,'mm')],
   ['Plotas',value(panel.widthM*panel.heightM,'m²')]
  ]},
  {title:'Svoris ir galia',rows:[['Panelės svoris',value(panel.weightKg,'kg')],['Panelės galia',value(panel.power,'W')]]},
  {title:'Lenkimas',rows:panel.bendAngleText==='Nesilenkia'?[['Lenkimas','Nesilenkia']]:[
   ['Min. lenkimo kampas',value(panel.bendAngleMinDeg,'°')],['Maks. lenkimo kampas',value(panel.bendAngleMaxDeg,'°')],
   ...(typeof panel.bendAngleText==='string'&&panel.bendAngleText?[['Pastaba',panel.bendAngleText]]:[])
  ]},
  {title:'Montavimo rėmai',rows:[
   ['Min. rėmo aukštis',value(panel.frameHeightMinM,'mm',1000)],['Maks. rėmo aukštis',value(panel.frameHeightMaxM,'mm',1000)],
   ['0,5 m pakabinimo rėmo svoris',value(panel.frameHalfKg,'kg')],['1 m pakabinimo rėmo svoris',value(panel.frame1Kg,'kg')]
  ]}
 ];
</script>
<div class="panel-specifications">
 {#each groups as group}
  <section aria-label={group.title}><h3>{group.title}</h3><dl>{#each group.rows as [label,description]}<div><dt>{label}</dt><dd>{description}</dd></div>{/each}</dl></section>
 {/each}
</div>
<style>
 section{margin-top:18px}h3{font-size:10px;color:#a5b8c8;margin:0 0 8px;font-weight:700}dl{margin:0;font-size:10px}dl>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #29313e;align-items:start}dt{color:#8390a2;line-height:1.5}dd{margin:0;text-align:right;color:#dce4ee;line-height:1.5;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
</style>
