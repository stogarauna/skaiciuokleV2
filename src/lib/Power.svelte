<script lang="ts">
 import {physicalPanelNumber} from './signal-output';
 import Stageboxes from './Stageboxes.svelte';
 import {outletLimitW, outletsPerPhase, phaseLimitW, stageboxPowerSettings, type OutletAssignment, type StageboxPlan} from './stagebox';
 import type {Screen} from './project';
 import SignalCanvas from './SignalCanvas.svelte';
 import {powerPlan, powerPlanIssue, validPowerLimit, type PowerSettings} from './power';

 export let screen: Screen;
 export let distribution: StageboxPlan;
 export let onchange: (settings: PowerSettings) => void;

 let focused: number | null = null;
 let error = '';
 const colors = ['#facc6b', '#5eead4', '#f9a8d4', '#93c5fd', '#a3e635', '#fdba74', '#c4b5fd', '#67e8f9'];
 const format = new Intl.NumberFormat('lt-LT', {maximumFractionDigits: 2});
 $: settings = stageboxPowerSettings(screen);
 $: plan = powerPlan(screen, settings);
 $: feeds = distribution.feeds.filter(feed => feed.screenId === screen.id);
 $: circuitsByPhase = groupCircuits(plan.ports, distribution.assignments.get(screen.id));
 $: issue = powerPlanIssue(plan);
 $: parts = [{number: 1, column: 0, row: 0,
  width: screen.cols * screen.panel.resX, height: screen.rows * screen.panel.resY, screen, plan}];
 $: focusedCircuit = plan.ports.some(port => port.number === focused) ? focused : null;

 const phaseTints = {L1: '#facc6b', L2: '#5eead4', L3: '#c4b5fd'};
 const kw = (watts: number) => format.format(watts / 1000) + ' kW';

 function groupCircuits(ports: ReturnType<typeof powerPlan>['ports'], assignments?: Map<number, OutletAssignment>) {
  const groups = new Map<string, {circuit: typeof ports[number]; outlet: OutletAssignment}[]>();
  for (const circuit of ports) {
   const outlet = assignments?.get(circuit.number);
   if (!outlet) continue;
   const key = `${outlet.feed}:${outlet.phase}`;
   const group = groups.get(key) ?? [];
   group.push({circuit, outlet});
   groups.set(key, group);
  }
  for (const group of groups.values()) {
   group.sort((a, b) => a.outlet.box - b.outlet.box || a.outlet.outlet - b.outlet.outlet);
  }
  return groups;
 }

 function update(patch: Partial<PowerSettings>) {
  error = '';
  focused = null;
  onchange({...settings, ...patch});
 }

 function changeLimit(input: HTMLInputElement) {
  if (!validPowerLimit(input.valueAsNumber) || input.valueAsNumber > outletLimitW) {
   error = 'Įveskite sveiką skaičių nuo 1 iki 3 600 W.';
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
  <span>{screen.panel.name}{#if screen.mixed} + {screen.mixed.large.name}{:else} · {plan.panelWatts === null ? 'Galia nenurodyta' : `${format.format(plan.panelWatts)} W / panelė`}{/if}</span>
 </div>

 <div class="power-controls">
  <label class="field">
   Vienos grandinės riba, W
   <input type="number" min="1" max={outletLimitW} step="1" value={settings.limitW}
    aria-invalid={error ? 'true' : undefined} on:change={event => changeLimit(event.currentTarget)} />
  </label>
  <label class="field">
   Grandinių kryptis
   <select value={settings.direction} on:change={event => chooseDirection(event.currentTarget.value === 'columns' ? 'columns' : 'rows')}>
    <option value="rows">Horizontaliai</option>
    <option value="columns">Vertikaliai</option>
   </select>
  </label>
  <label class="field">
   Jungimo pradžios pusė
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
  {#if screen.mixed}<div><dt>Fizinės panelės</dt><dd>{plan.cells.length}</dd></div>{:else}<div><dt>Panelių limitas grandinei</dt><dd>{plan.panelWatts === null ? '—' : format.format(plan.panelsPerCircuit)}</dd></div>{/if}
 </dl>
 {#if issue}<p class="power-issue" role="status">{issue}</p>{/if}
 {#if plan.splitLines}
  <p class="power-note">Ilgos linijos padalytos. Kiekviena atkarpa turi atskirą maitinimo įėjimą.</p>
 {/if}

 <Stageboxes {distribution} screenId={screen.id} />

 <SignalCanvas {screen} {parts} activePart={1} focusedPort={focusedCircuit}
  {colors} circuitPrefix="M" drawingLabel="Maitinimo grandinių maršrutai"
  onselect={() => {}} onlayout={() => {}} />

 {#if feeds.length}
  <section class="circuit-list" aria-label="Maitinimo grandinės pagal įvadą ir fazę">
   <h3>Grandinės pagal fazes</h3>
   {#each feeds as feed (feed.number)}
    <article class="feed-group">
     <header class="feed-heading">
      <h4>32 A įvadas {feed.number}</h4>
      <span>{feed.boxCount} × stagebox · {feed.phases.reduce((sum, phase) => sum + phase.outlets, 0)} grand. · {kw(feed.phases.reduce((sum, phase) => sum + phase.watts, 0))}</span>
     </header>
     <div class="phase-grid">
      {#each feed.phases as phase (phase.name)}
       <div class="phase" style:--phase-color={phaseTints[phase.name]}>
        <div class="phase-heading">
         <h5>{phase.name}</h5>
         <strong>{phase.outlets} iš {feed.boxCount * outletsPerPhase} išvadų</strong>
        </div>
        <progress max={phaseLimitW} value={phase.watts} aria-label={`Įvado ${feed.number} fazės ${phase.name} apkrova`}></progress>
        <div class="phase-load"><span>{kw(phase.watts)}</span><span>Rezervas {kw(phaseLimitW - phase.watts)}</span></div>
        {#each circuitsByPhase.get(`${feed.number}:${phase.name}`) ?? [] as {circuit, outlet} (circuit.number)}
         <button class="circuit-row" type="button" aria-pressed={focusedCircuit === circuit.number}
          style:--circuit-color={colors[(circuit.number - 1) % colors.length]}
          on:click={() => focused = focusedCircuit === circuit.number ? null : circuit.number}>
          <strong>M{circuit.number}</strong>
          <span>SB{outlet.box} · {phase.name}.{outlet.outlet}</span>
          <span class="circuit-detail">Panelė {physicalPanelNumber(screen,{row:0,column:0},circuit.cells[0])} · {circuit.cells.length} vnt. · {format.format(circuit.watts)} W</span>
         </button>
        {:else}
         <p class="phase-empty">Fazė laisva</p>
        {/each}
       </div>
      {/each}
     </div>
    </article>
   {/each}
  </section>
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
 .circuit-list h3,.feed-heading h4,.phase-heading h5{margin:0}
 .circuit-list h3{font-size:15px}
 .feed-group{border:1px solid var(--line);border-radius:9px;background:#161f28;padding:12px}
 .feed-heading,.phase-heading,.phase-load{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap}
 .feed-heading{margin-bottom:10px}
 .feed-heading h4{font-size:13px}
 .feed-heading span,.phase-load{font-size:11px;color:#a3b4c7}
 .phase-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 .phase{min-width:0;border:1px solid #344252;border-top:2px solid var(--phase-color);border-radius:6px;background:#19232d;padding:9px}
 .phase-heading h5{font-size:13px;color:var(--phase-color)}
 .phase-heading strong{font-size:11px}
 .phase progress{display:block;width:100%;height:6px;margin:7px 0 5px;accent-color:var(--phase-color)}
 .phase-load{margin-bottom:8px}
 .phase-empty{font-size:11px;color:#a3b4c7;margin:9px 0 0}

 .circuit-row{display:grid;width:100%;justify-content:normal;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;margin-top:5px;text-align:left;padding:7px 8px;background:#1b2530;border-color:#344252}
 .circuit-row:hover,.circuit-row[aria-pressed=true]{border-color:var(--circuit-color);background:#243141}
 .circuit-row strong{color:var(--circuit-color)}
 .circuit-row span{overflow-wrap:anywhere;text-align:right}
 .circuit-row .circuit-detail{grid-column:1/-1;text-align:left;font-size:10px;color:#a3b4c7}
 @media(max-width:600px){.phase-grid{grid-template-columns:1fr}}
 @media(max-width:620px){.power-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
