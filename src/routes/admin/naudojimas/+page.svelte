<script lang="ts">
 import {usageDays} from '$lib/usage';
 import type {PageData} from './$types';
 export let data:PageData;
 const format=new Intl.DateTimeFormat('lt-LT',{
  dateStyle:'medium',timeStyle:'medium',timeZone:'Europe/Vilnius'
 });
 const dateFormat=new Intl.DateTimeFormat('lt-LT',{dateStyle:'medium',timeZone:'Europe/Vilnius'});
 const numberFormat=new Intl.NumberFormat('lt-LT');
 $: visits=data.browsers?.reduce((total,browser)=>total+browser.times.length,0)??0;
 $: totalOpenings=data.openings?.reduce((total,[,count])=>total+count,0)??0;
 $: todayOpenings=data.openings?.find(([date])=>date===data.today)?.[1]??0;
</script>

<svelte:head><title>Naudojimo statistika · LED Studija</title></svelte:head>

<main class="usage">
 <a class="button secondary" href="/admin">← Administravimas</a>
 <h1>Naudojimo statistika</h1>
 <p>Paskutinės {usageDays} dienų · Lietuvos laikas</p>
 <section aria-labelledby="openings-title">
  <h2 id="openings-title">Visi skaičiuoklės atidarymai</h2>
  <p>Skaičiuojami puslapio įkėlimai, įskaitant atnaujinimus. Statistika kaupiama be statistikos slapukų ir naršyklių identifikatorių.</p>
  {#if data.openings}
   <dl class="totals">
    <div><dt>Atidarymai šiandien</dt><dd>{numberFormat.format(todayOpenings)}</dd></div>
    <div><dt>Atidarymai per {usageDays} dienų</dt><dd>{numberFormat.format(totalOpenings)}</dd></div>
   </dl>
   {#if data.openings.length}
    <div class="browsers">
     <table aria-label="Atidarymai pagal dieną">
      <thead><tr><th scope="col">Diena</th><th scope="col">Atidarymai</th></tr></thead>
      <tbody>{#each data.openings as [date,count] (date)}
       <tr><td><time datetime={date}>{dateFormat.format(new Date(date))}</time></td><td>{numberFormat.format(count)}</td></tr>
      {/each}</tbody>
     </table>
    </div>
   {:else}
    <p class="empty">Atidarymų dar neužregistruota.</p>
   {/if}
  {:else}
   <p role="alert">Šiuo metu atidarymų statistikos įkelti nepavyko.</p>
  {/if}
 </section>
 <section aria-labelledby="visits-title">
 <h2 id="visits-title">Naršyklių apsilankymai su sutikimu</h2>
 <p>Pakartotiniai atidarymai per 30 minučių skaičiuojami kaip vienas apsilankymas.</p>
 {#if !data.browsers}
  <p role="alert">Šiuo metu statistikos įkelti nepavyko.</p>
 {:else}
  <dl class="totals">
   <div><dt>Naršyklės</dt><dd>{data.browsers.length}</dd></div>
   <div><dt>Apsilankymai</dt><dd>{visits}</dd></div>
  </dl>
  {#if data.browsers.length}
   <section aria-label="Apsilankymai pagal naršyklę" class="browsers">
    <div class="row heading" aria-hidden="true"><span>Naršyklė</span><span>Apsilankymai</span><span>Paskutinis apsilankymas</span></div>
    {#each data.browsers as browser}
     <details>
      <summary class="row">
       <strong><span aria-hidden="true">›</span> {browser.code}</strong>
       <span aria-label={`${browser.times.length} apsilankymų`}>{browser.times.length}</span>
       <time datetime={new Date(browser.times[0]).toISOString()}>{format.format(browser.times[0])}</time>
      </summary>
      <ol aria-label="Apsilankymų laikai">
       {#each browser.times as at}
        <li><time datetime={new Date(at).toISOString()}>{format.format(at)}</time></li>
       {/each}
      </ol>
     </details>
    {/each}
   </section>
  {:else}
   <p class="empty">Apsilankymų dar neužregistruota.</p>
  {/if}
 {/if}
 </section>
</main>

<style>
 .usage{width:min(100% - 32px,960px);margin:auto;padding:28px 0 52px}
 h1{margin:24px 0 8px;font-size:clamp(24px,4vw,34px)}
 h2{font-size:20px;margin:0 0 8px}
 section+section{margin-top:28px}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:left;padding:12px 18px}
 th{font-weight:600;color:#a0afbc}
 td{border-top:1px solid #354352}
 th:last-child,td:last-child{text-align:right}
 p{margin:0 0 20px;color:#a0afbc}
 .totals{display:flex;gap:12px;margin:0 0 20px}
 .totals div{flex:1;background:#1b222c;border:1px solid #354352;border-radius:10px;padding:14px 18px}
 dt,.heading{color:#a0afbc;font-size:12px}
 dd{margin:3px 0 0;font-size:26px;font-weight:700}
 .browsers{overflow:auto;background:#1b222c;border:1px solid #354352;border-radius:10px}
 .row{display:grid;grid-template-columns:minmax(9em,1fr) minmax(7em,.65fr) minmax(12em,1fr);gap:12px;align-items:center;padding:13px 18px;min-width:425px}
 details{border-top:1px solid #354352;min-width:425px}
 summary{cursor:pointer;list-style:none;font-size:13px}
 summary::-webkit-details-marker{display:none}
 summary strong span{color:#66ddc8;margin-right:6px;display:inline-block}
 details[open] summary strong span{transform:rotate(90deg)}
 ol{margin:0;padding:0 40px 14px;font-size:13px}
 li{padding-top:6px;color:#a0afbc}
 .empty{padding:18px;border:1px solid #354352;border-radius:10px}
</style>
