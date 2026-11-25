<script lang="ts">
 import {cadEntities,downloadDXF,dxfFilename} from './dxf';
 import {downloadCadPNG} from './cad-png';
 import {resolvePanelDepth,type Panel,type Screen} from './project';
 import {geometry,screenBendLimits,angleIssue} from './geometry';
 export let screen:Screen;
 export let catalog:Panel[]=[];
 export let onchange:(angle:number)=>void;
 let error='';
 let angleDraft:string|null=null;
 $: panel=resolvePanelDepth(screen.panel,catalog);
 $: g=geometry({...screen,panel,...(screen.mixed?{mixed:{...screen.mixed,large:resolvePanelDepth(screen.mixed.large,catalog)}}:{})});
 $: limits=screenBendLimits(screen);
 $: currentIssue=angleIssue(screen);
 $: margin=Math.max(0.5,g.width*0.12);
 $: vb=`${g.minX-margin} ${g.minZ-margin} ${g.width+margin*2} ${Math.max(1,g.depth)+margin*2}`;
 $: labelSize=Math.max(.065,g.width*.018);
 $: shape=g.angle===0?'flat':g.angle>0?'concave':'convex';
 const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n);
 function setAngle(n:number){const issue=angleIssue(screen,n);if(issue){error=issue;return;}error='';if(n!==g.angle)onchange(n);}
 function editAngle(input:HTMLInputElement){
  if(input.validity.badInput){setAngle(NaN);return;}
  angleDraft=input.value;
  setAngle(angleDraft===''?0:input.valueAsNumber);
 }
 function finishAngle(){angleDraft=null;error='';}
 function setShape(value:string){finishAngle();if(value==='flat'){setAngle(0);return;}const direction=value==='convex'?-1:1;const maximum=direction<0?-limits.min:limits.max;setAngle(direction*Math.min(Math.abs(g.angle)||5,maximum,360/(g.jointCount+1)));}
 $: exportScreen={...screen,x:0,y:0};
 $: exportName=screen.name+'-geometrija';
 async function downloadPNG(){
  try{
   error='';
   await downloadCadPNG(cadEntities([exportScreen],exportName,catalog),dxfFilename(exportName).replace(/-R12\.dxf$/,'.png'));
  }catch{error='Nepavyko eksportuoti PNG.';}
 }
 function exportDXF(){
  try{
   error='';
   downloadDXF([exportScreen],exportName,catalog);
  }catch{error='Nepavyko eksportuoti DXF.';}
 }
</script>
<section class="geometry-panel">
 <div class="geometry-heading"><div><span class="eyebrow">GEOMETRIJA</span><h2>Forma ir lenkimas</h2></div><div class="geometry-exports"><button class="secondary" on:click={downloadPNG}>↓ PNG</button><button class="secondary" on:click={exportDXF}>↓ DXF R12</button></div></div>
 <div class="geometry-controls">
  <label class="field">Ekrano forma<select aria-label="Ekrano forma" value={shape} on:change={e=>setShape(e.currentTarget.value)}><option value="flat">Plokščias</option><option value="concave" disabled={limits.max<=0||g.jointCount===0}>Įgaubtas (+)</option><option value="convex" disabled={limits.min>=0||g.jointCount===0}>Išgaubtas (−)</option></select></label>
  <label class="field">Kampas tarp panelių, °<input aria-label="Kampas tarp panelių" type="number" step="any" min={Math.max(limits.min,-360/(g.jointCount+1))} max={Math.min(limits.max,360/(g.jointCount+1))} disabled={limits.status!=='supported'||g.jointCount===0} value={angleDraft??g.angle} on:input={e=>editAngle(e.currentTarget)} on:blur={finishAngle}/></label>
  <div class="geometry-limit"><span>Katalogo ribos</span><strong>{limits.status==='unknown'?'Nepatikslintos':`${f(limits.min)}° … +${f(limits.max)}°`}</strong></div>
 </div>
 <p class="help geometry-help">{limits.note} Kampas taikomas kiekvienai horizontaliai jungčiai. + įgaubtas, − išgaubtas, žiūrint iš žiūrovo pusės.</p>
 {#if error||currentIssue}<p class="error" role="alert">{error||currentIssue}</p>{/if}
 <div class="geometry-drawing">
 <svg viewBox={vb} aria-label="Ekrano geometrija iš viršaus">
  <text x={g.minX} y={g.minZ-margin*.55} font-family="Arial,sans-serif" font-size={labelSize} fill="#9eb8c5">{screen.name} · VAIZDAS IŠ VIRŠAUS</text>
  {#each g.segments as {outline}}
   {#if outline}<polygon points={outline.map(p=>`${p.x},${p.z}`).join(' ')} fill="#285762" stroke="#6cddc9" stroke-width={labelSize*.07} />{/if}
  {/each}
  {#each g.segments as {front:p,end:next,occupied},i}
   <line x1={p.x} y1={p.z} x2={next.x} y2={next.z} stroke={occupied?'#6cddc9':'#546376'} stroke-width={labelSize*.1} stroke-dasharray={occupied?undefined:`${labelSize*.5} ${labelSize*.6}`} />
   <circle cx={p.x} cy={p.z} r={labelSize*.22} fill="#c9f3ec"/>
   <text x={(p.x+next.x)/2} y={(p.z+next.z)/2+labelSize*.85} text-anchor="middle" font-family="Arial,sans-serif" font-size={labelSize*.75} fill="#a9c0cf">{i+1}</text>
  {/each}
  <circle cx={g.points.at(-1)!.x} cy={g.points.at(-1)!.z} r={labelSize*.22} fill="#c9f3ec"/>
  <text x="0" y={g.maxZ+margin*.6} text-anchor="middle" font-family="Arial,sans-serif" font-size={labelSize*.8} fill="#7e97ac">{g.closed?'UŽDARAS ŽIEDAS':'↑ ŽIŪROVO PUSĖ'} · {f(g.angle)}° / jungtis</text>
 </svg>
 </div>
 <div class="geometry-metrics">
  <div><small>Fizinis plotis</small><strong>{f(g.width)} <em>m</em></strong></div>
  <div><small>Užimamas gylis</small><strong>{f(g.depth)} <em>m</em></strong></div>
  <div><small>{g.angle>0?'Įgaubimo':'Išgaubimo'} gylis nuo stygos</small><strong>{g.bendDepth===null?'—':f(g.bendDepth*1000)} <em>{g.bendDepth===null?'':'mm'}</em></strong></div>
  <div><small>Spindulys iki kampų</small><strong>{g.radius===null?(g.angle?'Kintamas':'∞'):f(g.radius)} <em>{g.radius===null?'': 'm'}</em></strong></div>
  <div><small>Bendras posūkis</small><strong>{f(g.turn)}<em>°</em></strong></div>
 </div>
 <p class="help geometry-foot">Išklotinės plotis {f(g.surfaceWidth)} m · lanko aprėptis {f(g.span)}° · {g.jointCount} jungtys. {screen.mixed?'':panel.depthM?`Panelės storis ${f(panel.depthM*1000)} mm.`:'Panelės storis nenurodytas.'} {g.closed?'Žiedui uždaryti reikalinga papildoma kraštinių panelių jungtis. ':''}{screen.removed.length?'Brūkšniuota linija žymi visiškai tuščią stulpelį.':''}</p>
</section>

<style>
 .geometry-exports{display:flex;gap:8px;flex-shrink:0}
 .geometry-panel .geometry-metrics{grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr))}
</style>
