<script lang="ts">
 import {vehicles,type Place,type Plan} from './transport';
 export let plan:Plan, placed:Place[], selected:string;
 export let onselect:(p:Place)=>void, onmove:(p:Place)=>void;
 let width=800,height=410,yaw=-28,pitch=30,zoom=1,cut=0;
 let gesture:{id:number;x:number;y:number;yaw:number;pitch:number;box?:Place}|null=null;
 let ghost:Place|null=null;
 $: [,length,depth,roof]=vehicles[plan.vehicle];
 $: scale=Math.min((width-42)/Math.hypot(length,depth),(height-45)/(roof+Math.hypot(length,depth)*.45))*zoom;
 $: layers=Math.max(1,...placed.map(b=>b.level));
 $: if(cut>layers)cut=0;
 const rad=Math.PI/180;
 function start(e:PointerEvent,box?:Place){
  if(e.button!==0||gesture)return;
  e.stopPropagation();
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch,box};
  if(box)onselect(box);
 }
 function move(e:PointerEvent){
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(gesture.box){
   if(Math.hypot(dx,dy)<4&&!ghost)return;
   const a=yaw*rad,across=dx/scale,away=dy/(scale*Math.sin(pitch*rad));
   ghost={...gesture.box,x:Math.round(gesture.box.x+Math.cos(a)*across-Math.sin(a)*away),y:Math.round(gesture.box.y+Math.sin(a)*across+Math.cos(a)*away)};
  }else{yaw=gesture.yaw+dx*.45;pitch=Math.max(12,Math.min(85,gesture.pitch-dy*.4));}
 }
 function finish(e:PointerEvent){
  if(gesture?.id!==e.pointerId)return;
  if(ghost)onmove(ghost);
  ghost=null;gesture=null;
 }
 function resize(factor:number){zoom=Math.max(.45,Math.min(4,zoom*factor));}
 function reset(){yaw=-28;pitch=30;zoom=1;}
</script>
<div class="tools">
 <label>Rodyti <select bind:value={cut}><option value={0}>Visus sluoksnius</option>{#each Array(layers) as _,i}<option value={i+1}>Iki {i+1} sluoksnio</option>{/each}</select></label>
 <button on:click={()=>resize(.85)} aria-label="Atitolinti">−</button><button on:click={reset}>Sutalpinti</button><button on:click={()=>resize(1/.85)} aria-label="Priartinti">+</button>
</div>
<div class="stage" role="group" aria-label="Interaktyvus 3D pakrovimo vaizdas" bind:clientWidth={width} bind:clientHeight={height}
 on:pointerdown={e=>start(e)} on:pointermove={move} on:pointerup={finish} on:pointercancel={()=>{gesture=null;ghost=null;}}
 on:wheel|nonpassive={e=>{e.preventDefault();resize(e.deltaY<0?1.1:1/1.1);}}>
 <div class="world" style:transform={'scale('+scale+') rotateX(-'+pitch+'deg) rotateY('+yaw+'deg)'}>
 <div class="floor" style:width={length+'px'} style:height={depth+'px'} style:transform={'translate3d('+(-length/2)+'px,'+(roof/2)+'px,'+(-depth/2)+'px) rotateX(90deg)'}></div>
 <div class="roof" style:width={length+'px'} style:height={depth+'px'} style:transform={'translate3d('+(-length/2)+'px,'+(-roof/2)+'px,'+(-depth/2)+'px) rotateX(90deg)'}></div>
 {#each [-length/2,length/2] as x}{#each [-depth/2,depth/2] as z}<i style:height={roof+'px'} style:transform={'translate3d('+x+'px,'+(-roof/2)+'px,'+z+'px)'}></i>{/each}{/each}
 {#each placed.filter(b=>!cut||b.level<=cut) as original (original.key)}
 {@const b=ghost?.key===original.key?ghost:original}
 <div class="box" class:chosen={selected===b.key} style={'--l:'+b.l+'px;--h:'+b.h+'px;--w:'+b.w+'px;--hue:'+((b.line*59+170)%360)+';transform:translate3d('+(b.x-length/2)+'px,'+(roof/2-b.z-b.h)+'px,'+(b.y-depth/2)+'px)'} role="button" tabindex="0" aria-label={plan.lines[b.line].name+' · '+b.level+' sluoksnis'} on:pointerdown={e=>start(e,original)} on:keydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onselect(original);}}}>
 <span class="front">{plan.lines[b.line].name}</span><span class="back"></span><span class="left"></span><span class="right"></span><span class="top">{plan.lines[b.line].name}</span></div>
 {/each}</div>
</div>
<small>Tempk foną vaizdui pasukti, dėžę – perstumti jos sluoksnyje. Ratuku keisk mastelį.</small>
<style>
.tools{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.tools label{margin-right:auto}.tools button,.tools select{background:#192734;border:1px solid #455d70;color:inherit;padding:.4rem .65rem;border-radius:.35rem}
.stage{position:relative;height:clamp(280px,48vh,560px);overflow:hidden;border:1px solid #344959;border-radius:.5rem;background:radial-gradient(ellipse at center,#263744,#111a23 80%);touch-action:none;user-select:none;cursor:grab}
.world,.box{transform-style:preserve-3d}.world{position:absolute;left:50%;top:50%}.world,.world *{transform-origin:0 0}.floor,.roof,i,.box,.box span{position:absolute;box-sizing:border-box}
.floor{background-color:#283c49;background-image:linear-gradient(#48606b 1px,transparent 1px),linear-gradient(90deg,#48606b 1px,transparent 1px);background-size:50px 50px;border:2px solid #85a1ad}.roof{border:1px solid #7994a3;pointer-events:none}i{border-left:1px solid #7994a3;pointer-events:none}
.box span{display:grid;place-items:center;overflow:hidden;color:white;font:8px system-ui;background:hsl(var(--hue) 40% 34%);border:1px solid #afc6cb;white-space:nowrap;cursor:move}.box.chosen span,.box:focus-visible span{border:2px solid #ffe993}.front,.back{width:var(--l);height:var(--h)}.front{transform:translateZ(var(--w))}.left,.right{width:var(--w);height:var(--h);transform:rotateY(-90deg);background:hsl(var(--hue) 40% 25%)!important}.right{transform:translateX(var(--l)) rotateY(-90deg)}.box .top{width:var(--l);height:var(--w);transform:rotateX(90deg);background:hsl(var(--hue) 42% 42%)}small{color:#a9bcc7}
</style>
