<script lang="ts">
 import {phaseLimitW, type StageboxPlan} from './stagebox';
 export let distribution: StageboxPlan;
 const format = new Intl.NumberFormat('lt-LT', {maximumFractionDigits: 3});
 const kw = (watts: number) => format.format(watts / 1000) + ' kW';
</script>

<section class="stageboxes" aria-label="Projekto maitinimo paskirstymas">
 <h3>Viso projekto maitinimas</h3>
 <p class="summary"><strong>{distribution.feeds.length} × 32 A įv.</strong> · {distribution.boxCount} × stagebox</p>
 <p>6 išvadai dėžėje · 3,6 kW išvadui · 7,2 kW fazei · 21,6 kW įvadui</p>
 {#if distribution.incomplete}<p class="warning">Paskirstymas nepilnas. Patikrinkite ekranus, kuriems nepavyko sudaryti maitinimo grandinių.</p>{/if}
 <div class="feeds">
  {#each distribution.feeds as feed (feed.number)}
   <article>
    <h4>Įvadas {feed.number} · {feed.boxCount > 1 ? `${feed.boxCount} sujungti stagebox` : '1 stagebox'}</h4>
    <p class="feed-total">Iš viso {kw(feed.phases.reduce((sum, phase) => sum + phase.watts, 0))}</p>
    <dl>
     {#each feed.phases as phase (phase.name)}
      <div><dt>{phase.name}</dt><dd>{kw(phase.watts)}<small>Laisva {kw(phaseLimitW-phase.watts)}</small></dd></div>
     {/each}
    </dl>
   </article>
  {/each}
 </div>
</section>

<style>
 .stageboxes{padding:14px;border:1px solid var(--line);border-radius:8px;background:#19232d}
 h3,h4,p,dl,dd{margin:0}
 h3{font-size:14px}
 p{margin-top:6px;font-size:11px;color:#a3b4c7}
 .summary{font-size:13px;color:#e2e8f0}
 .warning{color:#f3d498}
 .feeds{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:8px;margin-top:10px}
 article{border:1px solid var(--line);border-radius:6px;padding:9px}
 h4{font-size:12px}
 .feed-total{margin:4px 0 8px}
 dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
 dt,small{font-size:10px;color:#a3b4c7}
 dd{font-size:12px}
 small{display:block}
</style>
