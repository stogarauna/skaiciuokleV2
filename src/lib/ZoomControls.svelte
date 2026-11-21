<script lang="ts">
 export let percent: number;
 export let onchange: (percent: number) => void;
 export let onfit: () => void = () => onchange(100);
 export let min = 40;
 export let max = 300;
 export let step = 20;
 export let presets: number[] = [];
 $: choices = presets.includes(percent) ? presets : [...presets, percent].sort((a, b) => a - b);
</script>

<div class="zoom-toolbar">
<button class="fit-view" type="button" on:click={onfit}>⛶ Sutalpinti vaizdą</button>
<div class="zoom-controls" role="group" aria-label="Brėžinio mastelis">
 <button type="button" aria-label="Atitolinti" title="Atitolinti"
  disabled={percent <= min} on:click={() => onchange(Math.max(min, percent - step))}>−</button>
 {#if presets.length}
  <select aria-label="Brėžinio priartinimas" value={percent} on:change={e => onchange(Number(e.currentTarget.value))}>
   {#each choices as value}<option {value}>{value}%</option>{/each}
  </select>
 {:else}
  <button type="button" title="Sutalpinti vaizdą" aria-label={`Sutalpinti vaizdą · ${percent}%`}
   on:click={onfit}>{percent}%</button>
 {/if}
 <button type="button" aria-label="Priartinti" title="Priartinti"
  disabled={percent >= max} on:click={() => onchange(Math.min(max, percent + step))}>+</button>
</div>

</div>
<style>
 .zoom-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}
 .fit-view{font-size:11px;padding:6px 9px;background:#202733;border:1px solid #354352;color:#c9dae5;white-space:nowrap}
 .fit-view:hover{background:#303b49}
 .zoom-controls select{width:auto;min-width:5.1rem;padding:3px 5px;border:0;background:#202733;color:#e2eff8;font-size:12px;font-variant-numeric:tabular-nums;cursor:pointer}
</style>
