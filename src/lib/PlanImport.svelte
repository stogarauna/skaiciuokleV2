<script lang="ts">
 import DrawingViewport from './DrawingViewport.svelte';
 import {onDestroy} from 'svelte';
 import {arenaExample,arenaHash,regions,type Candidate,type Mark} from './plan-recognition';
 import type {Screen,Panel} from './project';
 import {makeScreen,stats} from './project';
 import {defaultMounting} from './mounting';
 export let screens:Screen[],catalog:Panel[],apply:(items:Screen[])=>void;
 type Picture={name:string;url:string;hash:string;img:HTMLImageElement};
 type Row=Candidate & {target:string;model:string;cols:number|null;rows:number|null;include:boolean;
  customName?:string;widthText?:string;heightText?:string};
 let files:Picture[]=[], plan:Picture|undefined, front:Picture|undefined;
 let rows:Row[]=[],marks:Mark[]=[],active='',status='',busy=false,deleteMode=false;
 type Point={x:number;y:number};
 let pins:Record<string,Record<string,Point>>={};
 let mode:'mark'|'scale'|'measure'='mark';
 let reference:Point[]=[], chain:Point[]=[], known:number|undefined, scale=0;
 let completed:Point[][]=[];
 $: groups=[...completed,chain];
 function groupName(index:number):string{
  let label='';
  for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;
  return label;
 }
 function newMeasurement(){
  if(chain.length<2)return;
  completed=[...completed,chain];
  chain=[];
 }
 const fmt=(v:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:2}).format(v);
 const metres=new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3});
 let showFront=true, showPlan=true;
 function screenName(row:Row){
  return row.customName?.trim()||screens.find(s=>s.id===row.target)?.name||row.name;
 }
 function readMetres(text?:string){
  const raw=text?.trim();
  if(!raw)return undefined;
  const value=Number(raw.replace(',','.'));
  return /^(?:\d+|\d*[.,]\d+)$/.test(raw)&&Number.isFinite(value)&&value>0?value:NaN;
 }
 function catalogueSize(row:Row){
  const screen=screens.find(s=>s.id===row.target);
  if(screen?.removed.length)return stats(screen);
  const panel=screen?.panel??catalog.find(p=>p.name===row.model);
  return {width:(screen?.cols??row.cols??0)*(panel?.widthM??0),height:(screen?.rows??row.rows??0)*(panel?.heightM??0)};
 }
 function screenWidth(r:Row){
  const existing=screens.find(s=>s.id===r.target);
  if(existing?.curvature?.angleDeg||existing?.removed.length)return 0;
  return readMetres(r.widthText)??catalogueSize(r).width;
 }
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
 function resetMeasure(){reference=[];completed=[];chain=[];scale=0;known=undefined;mode='mark';}
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
  active=rows[0]?.id??'';pins={};frontPins(front,rows,plan.hash===arenaHash);resetMeasure();
 }
 function addRow(){const row=asRow({id:crypto.randomUUID(),name:'Ekranas '+(rows.length+1)});rows=[...rows,row];active=row.id;}
 function number(id:string){return marks.filter(p=>p.owner===id).length;}
 function commit(){
  try{
   const out:Screen[]=[],targets=new Set<string>();
   let x=Math.max(0,...screens.map(s=>s.x+s.cols*s.panel.widthM))+1;
   for(const r of rows.filter(r=>r.include)){
    const count=number(r.id);
    const name=screenName(r);
    if(count<2||count>8)throw Error(name+' – kabinimui reikia 2–8 patvirtintų taškų.');
    const existing=screens.find(s=>s.id===r.target);let s:Screen;
    if(existing){
     if(targets.has(existing.id))throw Error('Tas pats projekto ekranas pasirinktas du kartus.');
     targets.add(existing.id);s={...existing};
    }else{
     const panel=catalog.find(p=>p.name===r.model),cols=r.cols??0,height=r.rows??0;
     if(!panel||!Number.isInteger(cols)||!Number.isInteger(height)||cols<1||height<1||cols>100||height>100||cols*height>5000||!name.trim())throw Error(name+' – pasirinkite modelį ir įrašykite panelių kiekį horizontaliai bei vertikaliai.');
     s={...makeScreen(panel),name,cols,rows:height,x};x+=cols*panel.widthM+1;
    }
    s.mounting={...(s.mounting??defaultMounting()),mode:'hanging',supportCount:count};out.push(s);
   }
   if(screens.length+out.filter(s=>!targets.has(s.id)).length>50||out.some(s=>s.x>1000))throw Error('Viršytos projekto ribos.');
   if(out.length)apply(out);
  }catch(e){status=e instanceof Error?e.message:String(e);}
 }
 function sizeLabel(row:Row){
  const fallback=catalogueSize(row);
  const width=readMetres(row.widthText)??fallback.width,height=readMetres(row.heightText)??fallback.height;
  if(Number.isNaN(width)||Number.isNaN(height))throw Error('Patikrinkite ekrano „'+screenName(row)+'“ matmenis. Įrašykite teigiamą skaičių metrais.');
  if(width>0&&height>0){
   const unfolded=!row.widthText?.trim()&&screens.find(s=>s.id===row.target)?.curvature?.angleDeg;
   return (unfolded?'išklotinė ':'')+metres.format(width)+' × '+metres.format(height)+' m';
  }
  if(width>0)return 'plotis '+metres.format(width)+' m';
  if(height>0)return 'aukštis '+metres.format(height)+' m';
  return '';
 }
 async function downloadImage(canvas:HTMLCanvasElement,fileName:string,format:'jpg'|'png'){
  const mime=format==='jpg'?'image/jpeg':'image/png';
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,0.95));
  if(!blob||blob.type!==mime)throw Error('Nepavyko eksportuoti vaizdo '+format.toUpperCase()+' formatu.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=fileName+'.'+format;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status='Paruoštas failas „'+a.download+'“.';
 }
 async function exportScreenList(){
  try{
   const entries=rows.map(row=>({name:screenName(row),size:sizeLabel(row)}));
   if(!entries.length)return;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error();
   ctx.font='24px sans-serif';
   const nameWidth=Math.min(1300,Math.max(360,...entries.map(e=>ctx.measureText(e.name).width)));
   const sizeWidth=Math.min(700,Math.max(210,...entries.map(e=>ctx.measureText(e.size).width)));
   canvas.width=Math.ceil(nameWidth+sizeWidth+96);canvas.height=106+entries.length*50;
   ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.fillStyle='#17252e';ctx.font='bold 28px sans-serif';ctx.fillText('Ekranų informacija',32,46);
   ctx.font='bold 18px sans-serif';ctx.fillText('Pavadinimas',32,84);ctx.fillText('Matmenys',64+nameWidth,84);
   ctx.font='24px sans-serif';
   entries.forEach((entry,i)=>{
    const y=96+i*50;
    ctx.fillStyle=i%2?'#fff':'#edf2f5';ctx.fillRect(0,y,canvas.width,50);
    ctx.fillStyle='#17252e';ctx.fillText(entry.name,32,y+34,nameWidth);ctx.fillText(entry.size||'—',64+nameWidth,y+34,sizeWidth);
   });
   await downloadImage(canvas,'Ekranų informacija','png');
  }catch(e){status=(e instanceof Error&&e.message)||'Nepavyko eksportuoti ekranų sąrašo.';}
 }
 async function exportDrawing(view:'front'|'plan',format:'jpg'|'png'){
  const pic=view==='front'?front:plan;
  if(!pic)return;
  try{
   const canvas=document.createElement('canvas');
   const w=canvas.width=pic.img.naturalWidth,h=canvas.height=pic.img.naturalHeight;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error();
   if(format==='jpg'){
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,w,h);
   }
   ctx.drawImage(pic.img,0,0);
   const font=Math.max(12,Math.round(Math.min(w,h)/95));
   ctx.font='600 '+font+'px sans-serif';ctx.lineJoin='round';
   function line(a:Point,b:Point,color:string){
    if(!ctx)return;
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,font/8);ctx.beginPath();
    ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();
   }
   function dot(p:Point,color:string){
    if(!ctx)return;
    ctx.fillStyle=color;ctx.strokeStyle='white';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(p.x*w,p.y*h,font*.32,0,2*Math.PI);ctx.fill();ctx.stroke();
   }
   const labels:{x:number;y:number;width:number;value:string}[]=[];
   function caption(p:Point,value:string){
    if(!ctx)return;
    const width=Math.min(w,ctx.measureText(value).width+10),height=font+8;
    const x=Math.min(w-width,Math.max(0,p.x*w-width/2));
    let y=Math.max(0,Math.min(h-height,p.y*h-height-4));
    const overlaps=(top:number)=>labels.some(l=>x<l.x+l.width&&x+width>l.x&&top<l.y+height&&top+height>l.y);
    if(overlaps(y)){
     for(let k=1;k<2*Math.ceil(h/height);k++){
      const alt=y+(k%2?1:-1)*Math.ceil(k/2)*(height+2);
      if(alt>=0&&alt+height<=h&&!overlaps(alt)){y=alt;break;}
     }
    }
    labels.push({x,y,width,value});
   }
   if(view==='plan'){
    for(const m of marks)dot(m,m.owner?'#007e72':'#a25800');
    groups.forEach((points,g)=>{
     const prefix=groupName(g);
     points.forEach((pt,i)=>{
      if(i){
       const prev=points[i-1];line(prev,pt,'#be2350');
       if(scale)caption({x:(prev.x+pt.x)/2,y:(prev.y+pt.y)/2},fmt(distance(prev,pt,pic)*scale)+' m');
      }
      dot(pt,'#be2350');caption(pt,prefix+(i+1));
     });
    });
   }
   for(const r of rows){
    const points=view==='front'?[pins[pic.hash]?.[r.id]].filter(Boolean):marks.filter(m=>m.owner===r.id);
    if(!points.length)continue;
    const center={x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
    if(view==='front')dot(center,'#007e72');
    caption(center,[screenName(r),sizeLabel(r)].filter(Boolean).join(' · '));
   }
   for(const {x,y,width,value} of labels){
    const height=font+8;
    ctx.fillStyle='#16232e';ctx.fillRect(x,y,width,height);
    ctx.fillStyle='white';ctx.textBaseline='middle';ctx.fillText(value,x+5,y+height/2,Math.max(1,width-10));
   }
   await downloadImage(canvas,pic.name.replace(/\.[^.]+$/,'')+(view==='front'?' - priekis':' - planas'),format);
  }catch(e){status=(e instanceof Error&&e.message)||'Nepavyko eksportuoti brėžinio '+format.toUpperCase()+' formatu.';}
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
 <div class="controls picture-heading"><h3>Vaizdas iš priekio</h3>
 <button aria-expanded={showFront} on:click={()=>showFront=!showFront}>{showFront?'Slėpti vaizdą':'Rodyti vaizdą'}</button>
 <button on:click={()=>exportDrawing('front','jpg')}>Eksportuoti JPG</button>
 <button on:click={()=>exportDrawing('front','png')}>Eksportuoti PNG</button></div>
 <div class="picture-body" hidden={!showFront}>
 <label>Žymimas ekranas <select bind:value={active}>{#each rows as r}<option value={r.id}>{screenName(r)}</option>{/each}</select></label>
 <small>Spustelėkite ekraną vaizde. Jei pasirinktas ekranas jau pažymėtas, bus pridėtas kitas. Norėdami perkelti žymę, pirmiausia ją nuimkite.</small>
 {#key front.hash}<DrawingViewport label="Vaizdas iš priekio" aspect={front.img.naturalWidth/front.img.naturalHeight}><button class="drawing" aria-label="Žymėti ekraną" on:click={pinFront}><img src={front.url} alt="Priekinis ekranų vaizdas"/></button>
 {#each rows as r,i}{@const pt=pins[front.hash]?.[r.id]}{#if pt}<button class="pin" class:current={r.id===active} style:left={pt.x*100+'%'} style:top={pt.y*100+'%'} title={screenName(r)} on:click={()=>active=r.id}>{i+1}</button>{/if}{/each}</DrawingViewport>{/key}
 {#if pins[front.hash]?.[active]}<button on:click={()=>{if(front){const next={...pins[front.hash]};delete next[active];pins={...pins,[front.hash]:next};}}}>Nuimti pasirinkto ekrano žymę</button>{/if}
 </div>
 {/if}
 {#if plan}
 <div class="controls picture-heading"><h3>Planas iš viršaus</h3>
 <button aria-expanded={showPlan} on:click={()=>showPlan=!showPlan}>{showPlan?'Slėpti vaizdą':'Rodyti vaizdą'}</button>
 <button on:click={()=>exportDrawing('plan','jpg')}>Eksportuoti JPG</button>
 <button on:click={()=>exportDrawing('plan','png')}>Eksportuoti PNG</button></div>
 <div class="picture-body" hidden={!showPlan}>
 <div class="controls"><button class:current={mode==='mark'} on:click={()=>mode='mark'}>Kabinimo taškai</button>
 <button class:current={mode==='scale'} on:click={()=>{mode='scale';deleteMode=false;}}>Nustatyti mastelį</button>
 <button disabled={!scale} class:current={mode==='measure'} on:click={()=>{mode='measure';deleteMode=false;}}>Matuoti atstumus</button></div>
 {#if mode==='scale'}<div class="controls"><span>Pažymėkite žinomo ilgio atkarpos galus ({reference.length}/2).</span>
 {#if rows.some(r=>screenWidth(r)>0)}
 <label>Naudoti ekrano plotį<select value="" on:change={e=>{
  const row=rows.find(r=>r.id===e.currentTarget.value);
  if(row){known=screenWidth(row);reference=[];status='Plane pažymėkite abu ekrano „'+screenName(row)+'“ pločio galus.';}
  e.currentTarget.value='';
 }}><option value="">Pasirinkite ekraną</option>{#each rows as r}{#if screenWidth(r)>0}<option value={r.id}>{screenName(r)} · {metres.format(screenWidth(r))} m</option>{/if}{/each}</select></label>{/if}
 <label>Žinomas atstumas, m<input type="number" min="0" step="any" bind:value={known}/></label><button disabled={reference.length!==2||!known||known<=0} on:click={calibrate}>Taikyti mastelį</button></div>{/if}
 {#if mode==='measure'}<div class="controls"><strong>Matavimas {groupName(completed.length)}</strong><span>Pažymėkite {groupName(completed.length)}{chain.length+1}.</span><button disabled={!chain.length} on:click={()=>chain=chain.slice(0,-1)}>Atšaukti tašką</button><button disabled={chain.length<2} on:click={newMeasurement}>Naujas matavimas</button></div>{/if}
 <div class="controls"><strong>{rows.length} ekranai · {marks.length} taškai</strong>
 <button disabled={mode!=='mark'} aria-pressed={deleteMode} on:click={()=>deleteMode=!deleteMode}>{deleteMode?'Baigti trynimą':'Trinti taškus'}</button></div>
 {#if mode==='mark'}<small>Pasirinkite ekraną ir spustelėkite jo taškus. Spustelėję tuščią plano vietą pridėsite tašką.</small>{/if}
 {#key plan.hash}<DrawingViewport label="Planas iš viršaus" aspect={plan.img.naturalWidth/plan.img.naturalHeight}>
 <button class="drawing" aria-label="Pridėti tašką plane" on:click={e=>{if(mode!=='mark'){pick(location(e));return;}if(!active||deleteMode)return;const b=e.currentTarget.getBoundingClientRect();marks=[...marks,{x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height,owner:active}];}}><img src={plan.url} alt="Įkeltas pakabinimo planas"/></button>
 {#each marks as m,i}{@const owner=rows.find(r=>r.id===m.owner)}<button class="dot" class:selected={m.owner===active&&!!active} class:assigned={!!m.owner} style:left={m.x*100+'%'} style:top={m.y*100+'%'} aria-label={'Taškas '+(i+1)} title={owner?screenName(owner):'Nepriskirtas'} on:click={()=>{if(mode!=='mark'){pick(m);return;}if(deleteMode)marks=marks.filter((_,j)=>i!==j);else if(active)marks=marks.map((p,j)=>i===j?{...p,owner:p.owner===active?'':active}:p);}}></button>{/each}
 <svg class="overlay" viewBox={'0 0 '+plan.img.width+' '+plan.img.height} aria-hidden="true">
 {#each (mode==='scale'?[reference]:groups) as points,g}
 {@const prefix=mode==='scale'?'M':groupName(g)}
 {#each points as pt,i}
 {@const prev=points[i-1]}
 {#if prev}<line x1={prev.x*plan.img.width} y1={prev.y*plan.img.height} x2={pt.x*plan.img.width} y2={pt.y*plan.img.height}/>
 {#if scale&&mode!=='scale'}<text x={(prev.x+pt.x)/2*plan.img.width} y={(prev.y+pt.y)/2*plan.img.height-6}>{fmt(distance(prev,pt,plan)*scale)} m</text>{/if}{/if}
 <circle cx={pt.x*plan.img.width} cy={pt.y*plan.img.height} r="4"/><text x={pt.x*plan.img.width} y={pt.y*plan.img.height+20}>{prefix}{i+1}</text>{/each}
 {/each}
 </svg>
 </DrawingViewport>{/key}
 </div>
 <section class="measurements" aria-label="Išmatuoti atstumai">
  <h3>Išmatuoti atstumai</h3>
  {#if groups.some(points=>points.length>1)}
   {#each groups as points,g}
    {#if points.length>1}
     {@const prefix=groupName(g)}
     <div class="measure-group"><strong>Matavimas {prefix}</strong>
      <ul>{#each points.slice(1) as pt,i}
       <li><span>{prefix}{i+1}–{prefix}{i+2}</span>
        <b>{scale?fmt(distance(points[i],pt,plan)*scale)+' m':'Nustatykite mastelį'}</b>
       </li>{/each}</ul>
     </div>
    {/if}
   {/each}
  {:else}<small>{scale?'Pažymėkite du taškus plane.':'Nustatykite mastelį ir pažymėkite du taškus plane.'}</small>{/if}
 </section>
 {/if}
 {#if front||plan}
 <details class="import-settings">
 <summary>Ekranų informacija ir importas ({rows.length})</summary>
 <div class="settings-body">
 {#each rows as r (r.id)}
 {@const fallback=catalogueSize(r)}
 <div class="info-row">
 <div class="controls">
 <label>Pavadinimas<input aria-label="Ekrano pavadinimas" value={r.customName??screenName(r)} placeholder={screens.find(s=>s.id===r.target)?.name||r.name} on:input={e=>r.customName=e.currentTarget.value}/></label>
 <label>Plotis, m<input class="size" inputmode="decimal" placeholder={fallback.width?metres.format(fallback.width):'—'} bind:value={r.widthText} aria-invalid={Number.isNaN(readMetres(r.widthText))}/></label>
 <label>Aukštis, m<input class="size" inputmode="decimal" placeholder={fallback.height?metres.format(fallback.height):'—'} bind:value={r.heightText} aria-invalid={Number.isNaN(readMetres(r.heightText))}/></label>
 {#if Number.isNaN(readMetres(r.widthText))||Number.isNaN(readMetres(r.heightText))}<small>Matmenis įrašykite teigiamais skaičiais.</small>{/if}
 </div>
 <div class="controls">{#if plan}<input type="checkbox" aria-label={'Importuoti '+screenName(r)} bind:checked={r.include}/>{/if}<button class:current={active===r.id} on:click={()=>active=r.id}>{screenName(r)}{#if plan} · {number(r.id)} tšk.{/if}</button>
 <select aria-label="Projekto ekranas" bind:value={r.target}><option value="">Naujas ekranas</option>{#each screens as s}<option value={s.id}>{s.name}</option>{/each}</select>
 {#if !r.target}<select aria-label="Panelės modelis" bind:value={r.model}><option value="">Panelės modelis</option>{#each catalog as p}<option value={p.name}>{p.name}</option>{/each}</select>
 <input class="size" aria-label="Stulpeliai" placeholder="Stulp." type="number" min="1" max="100" bind:value={r.cols}/> × <input class="size" aria-label="Eilės" placeholder="Eilės" type="number" min="1" max="100" bind:value={r.rows}/>{/if}</div></div>
 {/each}
 <div class="controls"><button on:click={addRow}>＋ Ekranas</button>
 <button disabled={!rows.length} on:click={exportScreenList}>Ekranų sąrašas (PNG)</button>
 {#if front}<button on:click={()=>exportDrawing('front','png')}>Vaizdas iš priekio (PNG)</button>{/if}
 {#if plan}<button on:click={()=>exportDrawing('plan','png')}>Planas iš viršaus (PNG)</button>{/if}</div>
 {#if plan}<p>Į „Kabinimą“ perkeliami pažymėtų ekranų taškų skaičiai. Atstumus tarp taškų skaičiuoklė modeliuoja vienodus.</p>
 <button class="primary" disabled={!rows.some(r=>r.include)} on:click={commit}>Patvirtinti ir perkelti į kabinimą</button>{/if}
 </div></details>
 {/if}
 {#if status}<p role="status">{status}</p>{/if}
</section>
<style>
 .picture-heading h3{margin:0 auto 0 0}.picture-body{display:grid;gap:.75rem;min-width:0}.picture-body[hidden]{display:none}

 .controls button:not(.current),.settings-body>button:not(.primary),.picture-body>button{color:#edf3f8;background:#263340;border:1px solid #526376;padding:6px 10px}
 .controls button.current{background:#72dece;color:#102422;border-color:#72dece;padding:6px 10px}
 .controls button:disabled,.settings-body button:disabled{opacity:1;color:#b5c2cf;background:#25303a;border-color:#394553;cursor:default}
 .importer :global(.zoom-controls button:disabled){opacity:1;color:#a4b2c0}
 .measurements,.import-settings{padding:12px;border:1px solid #344251;border-radius:7px;background:#19222c}
 .measurements h3{margin:0 0 8px;font-size:15px}.measure-group{display:flex;align-items:baseline;gap:1em;flex-wrap:wrap;padding:5px 0}
 .measure-group ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5em 1.2em}
 .measure-group li{display:flex;gap:.45em;font-variant-numeric:tabular-nums}.measure-group li span{color:#c0cedb}
 .import-settings summary{cursor:pointer;font-weight:600}.settings-body{display:grid;gap:.6rem;margin-top:.75rem}
 .info-row{display:grid;gap:.5rem;padding:.5rem 0 .75rem;border-bottom:1px solid #344251}.info-row input[aria-invalid=true]{border-color:#e9a070}

 .pin{position:absolute;transform:translate(-50%,-50%);border:1px solid white;background:#143046;color:white;border-radius:50%;min-width:24px;padding:.15rem}
 .overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.overlay line{stroke:#dd3860;stroke-width:2;vector-effect:non-scaling-stroke}.overlay circle{fill:#dd3860;stroke:white}.overlay text{font:bold 16px sans-serif;text-anchor:middle;fill:#111;stroke:white;stroke-width:3;paint-order:stroke}

 .importer{display:grid;grid-template-columns:minmax(0,1fr);gap:.75rem}.controls{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.controls select{max-width:100%}.controls label{display:grid;gap:.25rem}.size{width:6em}.drawing{padding:0;display:block;background:white;border:0;width:100%;line-height:0}.drawing img{width:100%;height:auto;display:block}.dot{position:absolute;padding:0;width:11px;height:11px;border:2px solid #8c4200;border-radius:50%;background:#ffe087;transform:translate(-50%,-50%)}.dot.assigned{background:#a1b6c5;border-color:#314658}.dot.selected,.current{outline:2px solid #009591;background:#8bfff1;color:#102422}.importer label{font-weight:600}
</style>
