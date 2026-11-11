<script lang="ts">
 import type {Screen} from './project';
 import SignalCanvas from './SignalCanvas.svelte';
 import {defaultPowerSettings, powerPlan, powerPlanIssue, validPowerLimit, type PowerSettings} from './power';

 export let screen: Screen;
 export let onchange: (settings: PowerSettings) => void;

 let focused: number | null = null;
 let error = '';
 const colors = ['#facc6b', '#5eead4', '#f9a8d4', '#93c5fd', '#a3e635', '#fdba74', '#c4b5fd', '#67e8f9'];
 const format = new Intl.NumberFormat('lt-LT', {maximumFractionDigits: 2});
 $: settings = screen.powerRouting ?? defaultPowerSettings;
 $: plan = powerPlan(screen, settings);
 $: issue = powerPlanIssue(plan);
 $: parts = [{number: 1, column: 0, row: 0,
  width: screen.cols * screen.panel.resX, height: screen.rows * screen.panel.resY, screen, plan}];
 $: focusedCircuit = plan.ports.some(port => port.number === focused) ? focused : null;

 function update(patch: Partial<PowerSettings>) {
  error = '';
  focused = null;
  onchange({...settings, ...patch});
 }

 function changeLimit(input: HTMLInputElement) {
  if (!validPowerLimit(input.valueAsNumber)) {
   error = 'Įveskite teigiamą sveiką vatų skaičių.';
   input.value = String(settings.limitW);
   return;
  }
  update({limitW: input.valueAsNumber});
 }

 function chooseDirection(direction: PowerSettings['direction']) {
  if (direction === settings.direction) return;
  update({direction, edge: direction === 'rows' ? 'left' : 'top'});
 }
</script>

<section class="power-panel" aria-label="Maitinimo komutacija">
 <div class="power-heading">
  <h2>{screen.name}</h2>
  <span>{screen.panel.name} · {plan.panelWatts === null ? 'Galia nenurodyta' : `${format.format(plan.panelWatts)} W / panelė`}</span>
 </div>

 <div class="power-controls">
  <label class="field">
   Vienos grandinės riba, W
   <input type="number" min="1" step="1" value={settings.limitW}
    aria-invalid={error ? 'true' : undefined} on:change={event => changeLimit(event.currentTarget)} />
  </label>
  <label class="field">
   Grandinių kryptis
   <select value={settings.direction} on:change={event => chooseDirection(event.currentTarget.value === 'columns' ? 'columns' : 'rows')}>
    <option value="rows">Horizontaliai · po eilę</option>
    <option value="columns">Vertikaliai · po stulpelį</option>
   </select>
  </label>
  <label class="field">
   Įėjimo kraštinė
   <select value={settings.edge} on:change={event => update({edge: event.currentTarget.value as PowerSettings['edge']})}>
    {#if settings.direction === 'rows'}
     <option value="left">Kairėje</option>
     <option value="right">Dešinėje</option>
    {:else}
     <option value="top">Viršuje</option>
     <option value="bottom">Apačioje</option>
    {/if}
   </select>
  </label>
 </div>
 <p class="power-note">Apkrova pagal panelių katalogo galią ir įvestą W ribą.</p>
 {#if error}<p class="power-issue" role="alert">{error}</p>{/if}

 <dl class="power-metrics" aria-live="polite">
  <div><dt>Grandinės</dt><dd>{issue ? '—' : plan.ports.length}</dd></div>
  <div><dt>Bendra galia</dt><dd>{plan.totalWatts === null ? '—' : format.format(plan.totalWatts)} <small>W</small></dd></div>
  <div><dt>Panelių limitas grandinei</dt><dd>{plan.panelWatts === null ? '—' : format.format(plan.panelsPerCircuit)}</dd></div>
 </dl>
 {#if issue}<p class="power-issue" role="status">{issue}</p>{/if}

 <SignalCanvas {screen} {parts} activePart={1} focusedPort={focusedCircuit}
  {colors} circuitPrefix="M" drawingLabel="Maitinimo grandinių maršrutai"
  onselect={() => {}} onlayout={() => {}} />

 {#if plan.ports.length}
  <div class="circuit-list" aria-label="Maitinimo grandinės">
   {#each plan.ports as circuit (circuit.number)}
    <button class="circuit-row" type="button" aria-pressed={focusedCircuit === circuit.number}
     style:--circuit-color={colors[(circuit.number - 1) % colors.length]}
     on:click={() => focused = focusedCircuit === circuit.number ? null : circuit.number}>
     <strong>M{circuit.number}</strong>
     <span>{circuit.cells.length} panel. · {format.format(circuit.watts)} W</span>
     <span>Laisva {format.format(circuit.remaining)} W</span>
     <small>Įėjimas: panelė {circuit.cells[0].r * screen.cols + circuit.cells[0].c + 1}</small>
    </button>
   {/each}
  </div>
 {/if}
</section>

<style>
 .power-panel,.circuit-list{display:grid;gap:12px}
 .power-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
 .power-heading h2{margin:0;font-size:17px;overflow-wrap:anywhere}
 .power-heading span,.power-note{color:#a3b4c7;font-size:12px}
 .power-note{margin:0}
 .power-controls,.power-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
 .power-controls .field{font-size:12px;margin:0}
 .power-metrics{margin:0;padding:13px;border:1px solid var(--line);border-radius:8px;background:#1b2530}
 .power-metrics dt{color:#a3b4c7;font-size:11px}
 .power-metrics dd{margin:5px 0 0;font-size:clamp(14px,2vw,23px);font-weight:700;overflow-wrap:anywhere}
 .power-metrics small{font-size:11px;color:#a3b4c7}
 .power-issue{margin:0;padding:10px 12px;color:#f3d498;background:#332b1e;border:1px solid #5b4831;border-radius:7px;font-size:12px}
 .circuit-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:8px}
 .circuit-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;text-align:left;padding:10px;background:#1b2530;border-color:#344252}
 .circuit-row:hover,.circuit-row[aria-pressed=true]{border-color:var(--circuit-color);background:#243141}
 .circuit-row strong{color:var(--circuit-color)}
 .circuit-row span,.circuit-row small{overflow-wrap:anywhere}
 .circuit-row small{font-size:10px;color:#a3b4c7}
 @media(max-width:620px){.power-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
