<script lang="ts">
 import {onDestroy} from 'svelte';
 import {arenaExample,arenaHash,regions,type Candidate,type Mark} from './plan-recognition';
 import type {Screen,Panel} from './project';
 import {makeScreen} from './project';
 import {defaultMounting} from './mounting';
 export let screens:Screen[],catalog:Panel[],apply:(items:Screen[])=>void;
 type Picture={name:string;url:string;hash:string;img:HTMLImageElement};
 type Row=Candidate & {target:string;model:string;cols:number|null;rows:number|null;include:boolean};
 let files:Picture[]=[], plan:Picture|undefined, front:Picture|undefined;
 let rows:Row[]=[],marks:Mark[]=[],active='',status='',busy=false,zoom=1,deleteMode=false;
 type Point={x:number;y:number};
 let pins:Record<string,Record<string,Point>>={};
 let mode:'mark'|'scale'|'measure'='mark';
 let reference:Point[]=[], chain:Point[]=[], known:number|undefined, scale=0;
 const fmt=(v:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(v);
 function distance(a:Point,b:Point,p:Picture){
  return Math.hypot((a.x-b.x)*p.img.naturalWidth,(a.y-b.y)*p.img.naturalHeight);
 }
 function location(e:MouseEvent):Point{
  const b=(e.currentTarget as HTMLElement).getBoundingClientRect();
  return {x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};
 }
 function pinFront(e:MouseEvent){
  if(!front)return;
  if(!active||pins[front.hash]?.[active])addRow();
  pins={...pins,[front.hash]:{...pins[front.hash],[active]:location(e)}};
 }
 function pick(p:Point){
  if(mode==='scale'){
   if(reference.length===2)reference=[];
   if(reference.length&&plan&&distance(reference[0],p,plan)<1)return;
   reference=[...reference,p];scale=0;
  }else if(mode==='measure'){
   if(!chain.length||!plan||distance(chain[chain.length-1],p,plan)>=1)chain=[...chain,p];
  }
 }
 function calibrate(){
  if(!plan||reference.length!==2||!known||known<=0||!Number.isFinite(known))return;
  scale=known/distance(reference[0],reference[1],plan);mode='measure';
 }
 function resetMeasure(){reference=[];chain=[];scale=0;known=undefined;mode='mark';}
 function frontPins(pic:Picture|undefined,items:Row[],arena:boolean){
  if(!pic)return;
  const pts=detect(pic,'screen').sort((a,b)=>a.x-b.x);
  let ids=items.map(r=>r.id);
  if(arena){
   // The example has six stage screens and two audience screens in the far view.
   if(pts.length!==6&&pts.length!==8)return;
   const middle=pts.slice(pts.length/2-1,pts.length/2+1);
   const centers=middle[0].y<middle[1].y?['1','0']:['0','1'];
   ids=pts.length===8?['6','4','2',...centers,'3','5','7']:['4','2',...centers,'3','5'];
  }
  pins={...pins,[pic.hash]:Object.fromEntries(pts.slice(0,ids.length).map((p,i)=>[ids[i],p]))};
 }
 const asRow=(item:Candidate):Row=>({...item,target:'',model:'',cols:null,rows:null,include:true});
 onDestroy(()=>files.forEach(f=>URL.revokeObjectURL(f.url)));
 async function load(input:HTMLInputElement){
  const batch=Array.from(input.files??[]);input.value='';busy=true;
  try{
   for(const f of batch){
    if(!/\.(jpe?g|png|webp)$/i.test(f.name))throw Error('Pasirinkite JPG, PNG arba WebP vaizdą.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
    if(files.some(p=>p.hash===hash))continue;
    const url=URL.createObjectURL(f),img=new Image();img.src=url;
    try{await img.decode();}catch{URL.revokeObjectURL(url);throw Error('Vaizdo perskaityti nepavyko.');}
    files=[...files,{name:f.name,url,img,hash}];
   }
   const top=files.find(p=>/top|plan|virš/i.test(p.name));
   if(!front)front=files.find(p=>/far/i.test(p.name)&&p!==top&&p!==plan)??files.find(p=>p!==top&&p!==plan);
   if(!plan){
    plan=top??files.find(p=>p!==front);
    if(plan&&!rows.length)scan();
    else if(plan){
     const draft=plan.hash===arenaHash?arenaExample():null;
     marks=draft?draft.marks.map(p=>({...p,owner:''})):detect(plan,'point').map(p=>({...p,owner:''}));
     status='Pasirinkite ekraną ir priskirkite jam plano taškus.';
    }
   }
   if(front&&!rows.length){
    rows=detect(front,'screen').sort((a,b)=>a.x-b.x).map((_,i)=>asRow({id:crypto.randomUUID(),name:'Ekranas '+(i+1)}));
    active=rows[0]?.id??'';
   }
   if(front&&!pins[front.hash])frontPins(front,rows,plan?.hash===arenaHash&&rows.some(r=>r.id==='0'));
  }catch(e){status=String(e);}finally{busy=false;}
 }
 function detect(pic:Picture,kind:'screen'|'point'){
  const canvas=document.createElement('canvas'),ratio=Math.min(1,2048/pic.img.width,2048/pic.img.height);
  canvas.width=Math.max(1,Math.round(pic.img.width*ratio));canvas.height=Math.max(1,Math.round(pic.img.height*ratio));
  const ctx=canvas.getContext('2d')!;ctx.drawImage(pic.img,0,0,canvas.width,canvas.height);
  return regions(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,kind);
 }
 function scan(){
  if(!plan)return;
  if(plan.hash===arenaHash){
   const draft=arenaExample();rows=draft.screens.map(asRow);marks=draft.marks;status='Atvertas anksčiau sužymėtas Žalgirio arenos pavyzdys.';
  }else{
   rows=(front?detect(front,'screen'):[]).map((_,i)=>asRow({id:crypto.randomUUID(),name:'Ekranas '+(i+1)}));
   marks=detect(plan,'point').map(p=>({...p,owner:''}));status='Spalvinio atpažinimo pasiūlymai. Patikrinkite ekranus ir priskirkite plano taškus.';
  }
  active=rows[0]?.id??'';zoom=1;pins={};frontPins(front,rows,plan.hash===arenaHash);resetMeasure();
 }
 function addRow(){const row=asRow({id:crypto.randomUUID(),name:'Ekranas '+(rows.length+1)});rows=[...rows,row];active=row.id;}
 function number(id:string){return marks.filter(p=>p.owner===id).length;}
 function commit(){
  try{
   const out:Screen[]=[],targets=new Set<string>();
   let x=Math.max(0,...screens.map(s=>s.x+s.cols*s.panel.widthM))+1;
   for(const r of rows.filter(r=>r.include)){
    const count=number(r.id);
    if(count<2||count>8)throw Error(r.name+' – kabinimui reikia 2–8 patvirtintų taškų.');
    const existing=screens.find(s=>s.id===r.target);let s:Screen;
    if(existing){
     if(targets.has(existing.id))throw Error('Tas pats projekto ekranas pasirinktas du kartus.');
     targets.add(existing.id);s={...existing};
    }else{
     const panel=catalog.find(p=>p.name===r.model),cols=r.cols??0,height=r.rows??0;
     if(!panel||!Number.isInteger(cols)||!Number.isInteger(height)||cols<1||height<1||cols>100||height>100||cols*height>5000||!r.name.trim())throw Error(r.name+' – pasirinkite modelį ir įrašykite panelių kiekį horizontaliai bei vertikaliai.');
     s={...makeScreen(panel),name:r.name.trim(),cols,rows:height,x};x+=cols*panel.widthM+1;
    }
    s.mounting={...(s.mounting??defaultMounting()),mode:'hanging',supportCount:count};out.push(s);
   }
   if(screens.length+out.filter(s=>!targets.has(s.id)).length>50||out.some(s=>s.x>1000))throw Error('Viršytos projekto ribos.');
   if(out.length)apply(out);
  }catch(e){status=e instanceof Error?e.message:String(e);}
 }
</script>
<section class="importer">
 <label>Įkelti brėžinius ir vizualizacijas <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} on:change={e=>load(e.currentTarget)} /></label>
 {#if files.length}
 <div class="controls"><label>Planas iš viršaus<select value={plan?.hash} on:change={e=>{if(!confirm('Pakeisti planą ir iš naujo sužymėti taškus?')){e.currentTarget.value=plan?.hash??'';return;}plan=files.find(f=>f.hash===e.currentTarget.value);scan();}}><option disabled value="">Pasirinkite planą</option>{#each files as f}<option value={f.hash}>{f.name}</option>{/each}</select></label>
 <label>Vaizdas ekranams atpažinti<select value={front?.hash??''} on:change={e=>{front=files.find(f=>f.hash===e.currentTarget.value);if(front&&!pins[front.hash]&&plan?.hash===arenaHash&&rows.some(r=>r.id==='0'))frontPins(front,rows,true);}}><option value="">Nepasirinkta</option>{#each files as f}<option value={f.hash}>{f.name}</option>{/each}</select></label>
 <button on:click={()=>{if(confirm('Atnaujinti pasiūlymus ir pakeisti rankinius žymėjimus?'))scan();}}>Atpažinti iš naujo</button></div>
 {/if}
 {#if front}
 <h3>Vaizdas iš priekio</h3>
 <label>Žymimas ekranas <select bind:value={active}>{#each rows as r}<option value={r.id}>{r.name}</option>{/each}</select></label>
 <small>Spustelėkite ekraną vaizde. Jei pasirinktas ekranas jau pažymėtas, bus pridėtas kitas. Norėdami perkelti žymę, pirmiausia ją nuimkite.</small>
 <div class="sheet"><button class="drawing" aria-label="Žymėti ekraną" on:click={pinFront}><img src={front.url} alt="Priekinis ekranų vaizdas"/></button>
 {#each rows as r,i}{@const pt=pins[front.hash]?.[r.id]}{#if pt}<button class="pin" class:current={r.id===active} style:left={pt.x*100+'%'} style:top={pt.y*100+'%'} title={r.name} on:click={()=>active=r.id}>{i+1}</button>{/if}{/each}</div>
 {#if pins[front.hash]?.[active]}<button on:click={()=>{if(front){const next={...pins[front.hash]};delete next[active];pins={...pins,[front.hash]:next};}}}>Nuimti pasirinkto ekrano žymę</button>{/if}
 {/if}
 {#if plan}
 <h3>Planas iš viršaus</h3>
 <div class="controls"><button class:current={mode==='mark'} on:click={()=>mode='mark'}>Kabinimo taškai</button>
 <button class:current={mode==='scale'} on:click={()=>{mode='scale';deleteMode=false;}}>Nustatyti mastelį</button>
 <button disabled={!scale} class:current={mode==='measure'} on:click={()=>{mode='measure';deleteMode=false;}}>Matuoti atstumus</button></div>
 {#if mode==='scale'}<div class="controls"><span>Pažymėkite žinomo ilgio atkarpos galus ({reference.length}/2).</span>
 <label>Žinomas atstumas, m<input type="number" min="0" step="any" bind:value={known}/></label><button disabled={reference.length!==2||!known||known<=0} on:click={calibrate}>Taikyti mastelį</button></div>{/if}
 {#if mode==='measure'}<div class="controls"><span>Žymėkite taškus iš eilės.</span><button disabled={!chain.length} on:click={()=>chain=chain.slice(0,-1)}>Atšaukti tašką</button><button disabled={!chain.length} on:click={()=>chain=[]}>Pradėti naują matavimą</button></div>{/if}
 <div class="controls"><strong>{rows.length} ekranai · {marks.length} taškai</strong><button on:click={()=>zoom=Math.max(1,zoom-.5)}>−</button>{zoom}×<button on:click={()=>zoom=Math.min(5,zoom+.5)}>+</button>
 <button disabled={mode!=='mark'} aria-pressed={deleteMode} on:click={()=>deleteMode=!deleteMode}>{deleteMode?'Baigti trynimą':'Trinti taškus'}</button></div>
 {#if mode==='mark'}<small>Pasirinkite ekraną ir spustelėkite jo taškus. Spustelėję tuščią plano vietą pridėsite tašką.</small>{/if}
 <div class="viewport"><div class="sheet" style:width={zoom*100+'%'}>
 <button class="drawing" aria-label="Pridėti tašką plane" on:click={e=>{if(mode!=='mark'){pick(location(e));return;}if(!active||deleteMode)return;const b=e.currentTarget.getBoundingClientRect();marks=[...marks,{x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height,owner:active}];}}><img src={plan.url} alt="Įkeltas pakabinimo planas"/></button>
 {#each marks as m,i}<button class="dot" class:selected={m.owner===active&&!!active} class:assigned={!!m.owner} style:left={m.x*100+'%'} style:top={m.y*100+'%'} aria-label={'Taškas '+(i+1)} title={rows.find(r=>r.id===m.owner)?.name??'Nepriskirtas'} on:click={()=>{if(mode!=='mark'){pick(m);return;}if(deleteMode)marks=marks.filter((_,j)=>i!==j);else if(active)marks=marks.map((p,j)=>i===j?{...p,owner:p.owner===active?'':active}:p);}}></button>{/each}
 <svg class="overlay" viewBox={'0 0 '+plan.img.width+' '+plan.img.height} aria-hidden="true">
 {#each (mode==='scale'?reference:chain) as pt,i}
 {@const prev=(mode==='scale'?reference:chain)[i-1]}
 {#if prev}<line x1={prev.x*plan.img.width} y1={prev.y*plan.img.height} x2={pt.x*plan.img.width} y2={pt.y*plan.img.height}/>
 {#if scale&&mode!=='scale'}<text x={(prev.x+pt.x)/2*plan.img.width} y={(prev.y+pt.y)/2*plan.img.height-6}>{fmt(distance(prev,pt,plan)*scale)} m</text>{/if}{/if}
 <circle cx={pt.x*plan.img.width} cy={pt.y*plan.img.height} r="4"/><text x={pt.x*plan.img.width} y={pt.y*plan.img.height+20}>T{i+1}</text>{/each}
 </svg>
 </div></div>
 {#if chain.length>1&&scale}<div class="controls">{#each chain.slice(1) as pt,i}<span>T{i+1}–T{i+2} · {fmt(distance(chain[i],pt,plan)*scale)} m</span>{/each}</div>{/if}
 {#each rows as r}
 <div class="controls"><input type="checkbox" aria-label={'Importuoti '+r.name} bind:checked={r.include}/><button class:current={active===r.id} on:click={()=>active=r.id}>{r.name} · {number(r.id)} tšk.</button>
 <select aria-label="Projekto ekranas" bind:value={r.target}><option value="">Naujas ekranas</option>{#each screens as s}<option value={s.id}>{s.name}</option>{/each}</select>
 {#if !r.target}<input aria-label="Ekrano pavadinimas" bind:value={r.name}/><select aria-label="Panelės modelis" bind:value={r.model}><option value="">Panelės modelis</option>{#each catalog as p}<option value={p.name}>{p.name}</option>{/each}</select>
 <input class="size" aria-label="Stulpeliai" placeholder="Stulp." type="number" min="1" max="100" bind:value={r.cols}/> × <input class="size" aria-label="Eilės" placeholder="Eilės" type="number" min="1" max="100" bind:value={r.rows}/>{/if}</div>
 {/each}
 <button on:click={addRow}>＋ Ekranas</button>
 <p>Į „Kabinimą“ perkeliami pažymėtų ekranų taškų skaičiai. Atstumus tarp taškų skaičiuoklė modeliuoja vienodus.</p>
 <button class="primary" disabled={!rows.some(r=>r.include)} on:click={commit}>Patvirtinti ir perkelti į kabinimą</button>
 {/if}
 {#if status}<p role="status">{status}</p>{/if}
</section>
<style>
 .pin{position:absolute;transform:translate(-50%,-50%);border:1px solid white;background:#143046;color:white;border-radius:50%;min-width:24px;padding:.15rem}
 .overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.overlay line{stroke:#dd3860;stroke-width:2;vector-effect:non-scaling-stroke}.overlay circle{fill:#dd3860;stroke:white}.overlay text{font:bold 16px sans-serif;text-anchor:middle;fill:#111;stroke:white;stroke-width:3;paint-order:stroke}

 .importer{display:grid;gap:.75rem}.controls{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.controls select{max-width:100%}.controls label{display:grid;gap:.25rem}.size{width:6em}.viewport{overflow:auto;max-height:65vh;background:#28333e}.sheet{position:relative}.drawing{padding:0;display:block;background:white;border:0;width:100%;line-height:0}.drawing img{width:100%;height:auto;display:block}.dot{position:absolute;padding:0;width:11px;height:11px;border:2px solid #8c4200;border-radius:50%;background:#ffe087;transform:translate(-50%,-50%)}.dot.assigned{background:#a1b6c5;border-color:#314658}.dot.selected,.current{outline:2px solid #009591;background:#8bfff1;color:#102422}.importer label{font-weight:600}
</style>
