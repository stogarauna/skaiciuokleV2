<script lang="ts">
 import type {Panel,Screen} from './project';
 import type {VwxScene} from './vwx-types';
 import {alreadyImported,createVwxScreen,detectVwxScreens,matchingVwxModels,suggestedVwxModel} from './vwx-screens';
 export let scene:VwxScene;
 export let catalog:Panel[];
 export let screens:Screen[];
 export let oncreate:(screens:Screen[])=>void;
 let included:Record<string,boolean>={},names:Record<string,string>={},mapping:Record<string,string>={},message='';
 $: groups=detectVwxScreens(scene);
 $: models=[...new Map(groups.flatMap(g=>g.models).map(m=>[m.key,m])).values()];
 $: { mapping=Object.fromEntries(models.map(m=>[m.key,suggestedVwxModel(m,catalog)])); }
 $: { included=Object.fromEntries(groups.map(g=>[g.id,!g.issue]));names=Object.fromEntries(groups.map(g=>[g.id,g.name]));message=''; }
 $: pending=groups.filter(g=>included[g.id]&&!g.issue&&!alreadyImported(g,screens));
 const metres=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3}).format(n/1000);
 function create(){
  try{
   if(screens.length+pending.length>50)throw Error('Projektas gali turėti iki 50 ekranų. Pažymėkite mažiau ekranų.');
   const items=pending.map(g=>createVwxScreen(g,names[g.id],mapping,catalog));
   if(items.length){oncreate(items);message='Ekranai pridėti prie projekto.';}
  }catch(e){message=e instanceof Error?e.message:'Nepavyko sukurti ekranų.';}
 }
</script>

{#if groups.length}
 <details open class="vwx-import">
  <summary>Ekranai projekte</summary>
  <div class="models">
   {#each models as m (m.key)}
    <label><span>{m.name} · {metres(m.width)} × {metres(m.height)} m</span>
     <select value={mapping[m.key]} on:change={e=>mapping={...mapping,[m.key]:e.currentTarget.value}} aria-label={'Katalogo modelis: '+m.name}>
      <option value="">Pasirinkti katalogo modelį</option>
      {#each matchingVwxModels(m,catalog) as p}<option value={p.name}>{p.name}</option>{/each}
     </select>
    </label>
   {/each}
  </div>
  <div class="groups">
   {#each groups as g (g.id)}
    {@const exists=alreadyImported(g,screens)}
    <div class="group">
     <input type="checkbox" aria-label={'Kurti '+names[g.id]} checked={!!included[g.id]&&!exists} disabled={exists||!!g.issue}
      on:change={e=>included={...included,[g.id]:e.currentTarget.checked}}/>
     <input type="text" aria-label="Ekrano pavadinimas" bind:value={names[g.id]} disabled={exists} />
     <span>{g.count} panel. {#if g.cols}· {metres(g.cols*g.models[0].width)} × {metres(g.rows*g.models[0].height)} m {g.folded?'(išklotinė)':''}{/if}</span>
     {#if g.issue}<span class="note">{g.issue}</span>{:else if exists}<span>Jau projekte</span>{/if}
    </div>
   {/each}
  </div>
  <details class="coordinates">
   <summary>Ekranų gabaritų centrai 3D modelyje</summary>
   <table><thead><tr><th>Ekranas</th><th>X, m</th><th>Y, m</th><th>Z, m</th></tr></thead>
    <tbody>{#each groups as g (g.id)}<tr><th>{names[g.id]||g.name}</th>{#each g.centre as coordinate}<td>{metres(coordinate)}</td>{/each}</tr>{/each}</tbody>
   </table>
  </details>
  <button type="button" on:click={create} disabled={!pending.length}>Sukurti pažymėtus ekranus{pending.length?' ('+pending.length+')':''}</button>
  {#if message}<p role="status">{message}</p>{/if}
 </details>
{/if}

<style>
 .vwx-import{border-top:1px solid var(--line,#334150);margin-top:1rem;padding:1rem 0}
 summary{cursor:pointer;font-weight:700}
 .models,.groups{display:grid;gap:.5rem;margin:.8rem 0}
 .models{grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr))}
 label{display:grid;gap:.3rem;font-size:.8rem;color:var(--muted,#adb9c4)}
 input[type="text"],select{width:100%;min-width:0}
 .group{display:grid;grid-template-columns:auto minmax(7rem,14rem) minmax(8rem,auto) auto;align-items:center;gap:.6rem}
 .group span,p{font-size:.83rem}.note{color:#f8bd75}
 .coordinates{font-size:.82rem;margin:.6rem 0 1rem}.coordinates table{border-collapse:collapse}.coordinates th,.coordinates td{padding:.35rem .75rem;text-align:right}.coordinates th:first-child{text-align:left}
 @media(max-width:750px){.group{grid-template-columns:auto minmax(7rem,1fr)}.group span{grid-column:2}}
</style>
