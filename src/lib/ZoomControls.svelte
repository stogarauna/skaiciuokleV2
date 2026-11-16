<script lang="ts">
 export let percent: number;
 export let onchange: (percent: number) => void;
 export let onfit: () => void = () => onchange(100);
 const min = 40;
 const max = 300;
 const step = 20;
</script>

<div class="zoom-toolbar">
<button class="fit-view" type="button" on:click={onfit}>⛶ Sutalpinti vaizdą</button>
<div class="zoom-controls" role="group" aria-label="Brėžinio mastelis">
 <button type="button" aria-label="Atitolinti" title="Atitolinti"
  disabled={percent <= min} on:click={() => onchange(Math.max(min, percent - step))}>−</button>
 <button type="button" title="Sutalpinti vaizdą" aria-label={`Sutalpinti vaizdą · ${percent}%`}
  on:click={onfit}>{percent}%</button>
 <button type="button" aria-label="Priartinti" title="Priartinti"
  disabled={percent >= max} on:click={() => onchange(Math.min(max, percent + step))}>+</button>
</div>

</div>
<style>
 .zoom-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}
 .fit-view{font-size:11px;padding:6px 9px;background:#202733;border:1px solid #354352;color:#c9dae5;white-space:nowrap}
 .fit-view:hover{background:#303b49}
</style>
