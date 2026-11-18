<script lang="ts">
 import Transport3D from './Transport3D.svelte';
 let three=true;
 import {vehicles,pack,fits,supports,type Box,type Plan,type Place} from './transport';
 export let boxes:Box[],admin:boolean,plan:Plan,onchange:(p:Plan)=>void;
 let choice=0,qty=1,level=1,selected='',notice='',raw='',busy=false,svg:SVGSVGElement;
 let drag:{p:Place;dx:number;dy:number}|null=null,preview:Place|null=null;
 const f=(n:number)=>n.toLocaleString('lt-LT',{maximumFractionDigits:2});
 $: vehicle=vehicles[plan.vehicle];
 $: result=pack(plan);
 $: levels=Math.max(1,...result.placed.map(p=>p.level));
 $: if(level>levels)level=1;
 $: used=Math.max(0,...result.placed.map(p=>p.x+p.l))/100;
 $: weight=plan.lines.reduce((a,b)=>a+(b.kg??0)*b.qty,0);
 $: unknown=plan.lines.reduce((a,b)=>a+(b.kg===null?b.qty:0),0);
 $: active=result.placed.find(b=>b.key===selected&&b.level===level);
 function update(lines:Plan['lines'],vehicle=plan.vehicle){
  if(lines.reduce((a,b)=>a+b.qty,0)>500||lines.some(b=>b.qty>250)){notice='Vienam tipui galima pasirinkti iki 250 vnt., planui – iki 500 vnt.';return;}
  selected='';notice='';onchange({vehicle,lines});
 }
 function add(){
  if(!boxes[choice]||!Number.isInteger(qty)||qty<1)return;
  const box=boxes[choice],lines=[...plan.lines],i=lines.findIndex(b=>b.name===box.name);
  if(i<0)lines.push({...box,qty,stack:false});else lines[i]={...lines[i],qty:lines[i].qty+qty};
  update(lines);
 }
 function move(p:Place){
  const others=result.placed.filter(b=>b.key!==p.key);
  if(!fits(p,others,plan)||others.some(b=>active&&supports(active,b)&&!supports(p,b))){notice='Šioje vietoje krovinys netelpa arba prarastų atramą.';return;}
  onchange({...plan,positions:result.placed.map(b=>b.key===p.key?p:b)});notice='';
 }
 function point(e:PointerEvent){const m=svg.getScreenCTM();return new DOMPoint(e.clientX,e.clientY).matrixTransform(m?.inverse());}
 function start(e:PointerEvent,p:Place){selected=p.key;const pos=point(e);drag={p,dx:pos.x-p.x,dy:pos.y-p.y};svg.setPointerCapture(e.pointerId);}
 function motion(e:PointerEvent){if(!drag)return;const pos=point(e);preview={...drag.p,x:Math.round(pos.x-drag.dx),y:Math.round(pos.y-drag.dy)};}
 function end(){if(preview)move(preview);drag=null;preview=null;}
 async function upload(){
  busy=true;
  try{const r=await fetch('/api/cargo',{method:'POST',headers:{'content-type':'application/json'},body:raw});if(!r.ok)throw Error();boxes=await r.json();raw='';notice='Dėžių biblioteka išsaugota.';}catch{notice='Nepavyko išsaugoti bibliotekos. Patikrink JSON ir bandyk dar kartą.';}finally{busy=false;}
 }
</script>
<div class="transport">
 <div class="row"><label>Transportas<select value={plan.vehicle} on:change={e=>update(plan.lines,+e.currentTarget.value)}>{#each vehicles as v,i}<option value={i}>{v[0]}</option>{/each}</select></label><span>{vehicle[1]} × {vehicle[2]} × {vehicle[3]} cm · {f(vehicle[4])} kg</span></div>
 <div class="row"><label>Dėžė<select bind:value={choice}>{#each boxes as b,i}<option value={i}>{b.name} · {b.l} × {b.w} × {b.h} cm</option>{/each}</select></label><label>Kiekis<input type="number" min="1" max="250" bind:value={qty}></label><button disabled={!boxes.length} on:click={add}>＋ Pridėti</button></div>
 {#if admin}<details><summary>Dėžių bibliotekos importas</summary><label>Pasirink katalogo failą<input type="file" accept=".json" on:change={async e=>{const file=e.currentTarget.files?.[0];if(file)raw=await file.text();}}></label><label>Katalogo JSON<textarea bind:value={raw} rows="3"></textarea></label><button disabled={busy||!raw} on:click={upload}>Įrašyti katalogą</button></details>{/if}
 <div class="facts"><b>Pakrauta {result.placed.length} / {plan.lines.reduce((a,b)=>a+b.qty,0)}</b><b>Užimta {f(used)} m</b><b>Laisva gale {f(vehicle[1]/100-used)} m</b><b class:warn={weight>vehicle[4]}>Žinomas svoris {f(weight)} / {f(vehicle[4])} kg</b></div>
 {#if unknown}<small>{unknown} vnt. svoris nenurodytas.</small>{/if}
 {#if weight>vehicle[4]}<strong class="warn">Viršyta transporto keliamoji galia.</strong>{/if}
 <div class="row"><button aria-pressed={three} on:click={()=>three=true}>3D</button><button aria-pressed={!three} on:click={()=>three=false}>2D</button>{#if !three}<label>Sluoksnis<select bind:value={level}>{#each Array(levels) as _,i}<option value={i+1}>{i+1}</option>{/each}</select></label>{/if}<button disabled={!active} on:click={()=>active&&move({...active,l:active.w,w:active.l})}>Pasukti 90°</button><button disabled={!plan.positions} on:click={()=>update(plan.lines)}>Išdėstyti automatiškai</button></div>
 {#if three}
 <Transport3D {plan} placed={result.placed} {selected} onselect={b=>{selected=b.key;level=b.level;}} onmove={move}/>
 {#if active}<small>{plan.lines[active.line].name} · {active.l} × {active.w} × {active.h} cm · {active.level} sluoksnis</small>{/if}
 {:else}
 <svg bind:this={svg} viewBox={'-2 -2 '+(vehicle[1]+4)+' '+(vehicle[2]+4)} role="img" aria-label="Transporto pakrovimo planas iš viršaus" on:pointermove={motion} on:pointerup={end} on:pointercancel={()=>{drag=null;preview=null;}}>
 <rect width={vehicle[1]} height={vehicle[2]} fill="#15202b" stroke="#81a1b6" stroke-width="2"/>
 {#each result.placed.filter(b=>b.level===level) as box}
 {@const b=preview?.key===box.key?preview:box}
 <g role="img" aria-label={plan.lines[b.line].name} on:pointerdown={e=>start(e,box)}>
 <title>{plan.lines[b.line].name} · {b.l} × {b.w} cm</title>
 <rect x={b.x+0.5} y={b.y+0.5} width={b.l-1} height={b.w-1} fill={'hsl('+((b.line*59+170)%360)+' 45% 30%)'} stroke={b.key===selected?'white':'#96b1c0'} stroke-width={b.key===selected?2:1}/>
 <text x={b.x+b.l/2} y={b.y+b.w/2} text-anchor="middle" dominant-baseline="central" font-size={Math.min(13,b.l/(plan.lines[b.line].name.length*.65))} fill="white">{plan.lines[b.line].name}</text></g>
 {/each}</svg>{/if}
 {#if notice}<p role="status">{notice}</p>{/if}
 {#each plan.lines as line,i}<div class="line"><strong>{line.name}</strong><label>Vnt. <input type="number" min="1" max="250" value={line.qty} on:change={e=>{const q=e.currentTarget.valueAsNumber;if(Number.isInteger(q)&&q>0)update(plan.lines.map((b,j)=>i===j?{...b,qty:q}:b));}}></label><label><input type="checkbox" checked={line.stack} on:change={e=>update(plan.lines.map((b,j)=>i===j?{...b,stack:e.currentTarget.checked}:b))}> Galima krauti ant viršaus</label>{#if result.missed[i]}<b class="warn">Netilpo {result.missed[i]} vnt.</b>{/if}<button aria-label={'Pašalinti '+line.name} on:click={()=>update(plan.lines.filter((_,j)=>j!==i))}>×</button></div>{/each}
</div>
<style>
.transport{display:grid;gap:1rem}.row,.line,.facts{display:flex;align-items:center;flex-wrap:wrap;gap:1rem}.line,.facts{padding:.7rem;background:#1c2935;border-radius:.4rem}.row label,details label{display:grid;gap:.3rem}.row{align-items:end}.line strong{min-width:8rem}.transport input[type=number]{width:5rem}.transport select,.transport button,.transport input,.transport textarea{background:#15202b;color:inherit;padding:.5rem;border:1px solid #496071;border-radius:.3rem}.transport button[aria-pressed=true]{border-color:#5ed9c8;color:#75e0d2}.transport button:disabled{opacity:.45}.transport svg{width:100%;touch-action:none}.transport g{cursor:grab}.warn{color:#ffbd76}summary{cursor:pointer}
</style>
