<script lang="ts">
 import type {Screen} from './project';
 import {physicalPanelNumber, signalOutputs} from './signal-output';
 import {defaultSignalOutput, defaultSignalSettings, signalEntryEdge, signalPresets, validPortCapacity, validSignalTrackLimit, type SignalEntryEdge, type SignalOutputSettings, type SignalSettings} from './signal';

 export let screen: Screen;
 export let onchange: (settings: SignalSettings) => void;

 let selectedPart = 1;
 let outputError = '';
 let selectedPort: number | null = null;
 let capacityError = '';
 let trackError = '';
 const colors = ['#5eead4', '#facc6b', '#93c5fd', '#f9a8d4', '#a3e635', '#c4b5fd', '#fdba74', '#67e8f9'];
 const color = (port: number) => colors[(port - 1) % colors.length];
 const format = new Intl.NumberFormat('lt-LT');
 const entries: Array<{edge: SignalEntryEdge; corner: SignalSettings['corner']; label: string}> = [
  {edge: 'bottom', corner: 'bottom-left', label: 'Apačioje · nuo kairės'},
  {edge: 'bottom', corner: 'bottom-right', label: 'Apačioje · nuo dešinės'},
  {edge: 'top', corner: 'top-left', label: 'Viršuje · nuo kairės'},
  {edge: 'top', corner: 'top-right', label: 'Viršuje · nuo dešinės'},
  {edge: 'left', corner: 'top-left', label: 'Kairėje · nuo viršaus'},
  {edge: 'left', corner: 'bottom-left', label: 'Kairėje · nuo apačios'},
  {edge: 'right', corner: 'top-right', label: 'Dešinėje · nuo viršaus'},
  {edge: 'right', corner: 'bottom-right', label: 'Dešinėje · nuo apačios'}
 ];

 $: settings = screen.signal ?? defaultSignalSettings;
 $: entry = signalEntryEdge(settings);
 $: fullRows = entry === 'left' || entry === 'right';
 $: outputs = signalOutputs(screen, settings);
 $: part = outputs.parts.find(item => item.number === selectedPart) ?? outputs.parts[0];
 $: plan = part?.plan;
 $: panelPixels = screen.panel.resX * screen.panel.resY;
 $: tracksLimitedByPixels = settings.maxTracksPerPort !== undefined && plan?.ports.some(port => {
  const panelsInTrack = fullRows ? port.columns : port.rows;
  return panelsInTrack * panelPixels * settings.maxTracksPerPort! > settings.portCapacity;
 });
 $: height = Math.min(3, Math.max(0.35, screen.panel.heightM / screen.panel.widthM));
 $: focusedPort = selectedPort !== null && selectedPort <= (plan?.ports.length ?? 0) ? selectedPort : null;

 function update(patch: Partial<SignalSettings>) {
  selectedPort = null;
  capacityError = '';
  trackError = '';
  onchange({...settings, ...patch});
 }

 function changeCapacity(input: HTMLInputElement) {
  if (!validPortCapacity(input.valueAsNumber)) {
   capacityError = 'Įveskite teigiamą sveiką pikselių skaičių.';
   input.value = String(settings.portCapacity);
   return;
  }
  update({portCapacity: input.valueAsNumber, preset: undefined});
 }

 function changePreset(id: string) {
  const preset = signalPresets.find(mode => mode.id === id);
  update(preset ? {preset: preset.id, portCapacity: preset.capacity} : {preset: undefined});
 }

 function chooseBlockAxis(byRows: boolean) {
  const [vertical, horizontal] = settings.corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  update({entryEdge: byRows ? horizontal : vertical, direction: byRows ? 'rows' : 'columns'});
 }

 function changeTrackLimit(input: HTMLInputElement) {
  const value = input.valueAsNumber;
  if (!input.validity.badInput && input.value === '') {
   update({maxTracksPerPort: undefined});
  } else if (validSignalTrackLimit(value)) {
   update({maxTracksPerPort: value});
  } else {
   trackError = 'Įveskite sveiką skaičių nuo 1 iki 100 arba palikite lauką tuščią.';
   input.value = settings.maxTracksPerPort?.toString() ?? '';
  }
 }

 function setOutput(output: SignalOutputSettings | undefined) {
  selectedPart = 1;
  outputError = '';
  update({output});
 }

 function changeOutput(field: keyof SignalOutputSettings, input: HTMLInputElement) {
  if (!settings.output) return;
  const value = input.valueAsNumber;
  const blank = input.value === '' && !input.validity.badInput;
  if (field === 'partsAcross' && blank) {
   setOutput({...settings.output, partsAcross: undefined});
   return;
  }
  if (field === 'partsAcross' ? validSignalTrackLimit(value) : validPortCapacity(value)) {
   setOutput({...settings.output, [field]: value});
   return;
  }
  outputError = field === 'partsAcross'
   ? 'Įveskite dalių skaičių nuo 1 iki 100 arba palikite lauką tuščią.'
   : 'Įveskite teigiamą sveiką pikselių skaičių.';
  input.value = settings.output[field]?.toString() ?? '';
 }

 function route(cells: {c: number; r: number}[], height: number) {
  return cells.map(({c, r}) => `${c + 0.5},${(r + 0.56) * height}`).join(' ');
 }
</script>

<section class="signal-panel" aria-label="Signalo komutacija">
 <div class="signal-heading">
  <h2>{screen.name}</h2>
  <span>{screen.panel.name} · {format.format(panelPixels)} px / panelė</span>
 </div>
 <div class="output-controls">
  <label class="output-toggle">
   <input type="checkbox" checked={settings.output !== undefined}
    on:change={event => setOutput(event.currentTarget.checked ? {...defaultSignalOutput} : undefined)} />
   Dalinti pagal išvesties raišką
  </label>
  {#if settings.output}
   <div class="output-fields">
    <label class="field">
     Išvesties plotis, px
     <input type="number" min="1" step="1" value={settings.output.width}
      on:change={event => changeOutput('width', event.currentTarget)} />
    </label>
    <label class="field">
     Išvesties aukštis, px
     <input type="number" min="1" step="1" value={settings.output.height}
      on:change={event => changeOutput('height', event.currentTarget)} />
    </label>
    <label class="field">
     Dalių per plotį
     <input type="number" min="1" max="100" step="1" value={settings.output.partsAcross ?? ''}
      placeholder={outputs.minAcross ? `Automatiškai (${outputs.minAcross})` : 'Automatiškai'}
      on:change={event => changeOutput('partsAcross', event.currentTarget)} />
    </label>
   </div>
   {#if outputError}<p class="signal-notice" role="alert">{outputError}</p>{/if}
   {#if outputs.issue}<p class="signal-notice" role="alert">{outputs.issue}</p>{/if}
   {#if part}
    <label class="field">
     Komutuojama dalis ({outputs.parts.length} iš viso)
     <select value={part.number} on:change={event => {
      selectedPart = Number(event.currentTarget.value);
      selectedPort = null;
     }}>
      {#each outputs.parts as item}
       <option value={item.number}>Dalis {item.number} · {item.width} × {item.height} px</option>
      {/each}
     </select>
    </label>
    <p class="part-position">Ekrano stulpeliai {part.column + 1}–{part.column + part.screen.cols} · eilės {part.row + 1}–{part.row + part.screen.rows}</p>
   {/if}
  {/if}
 </div>
 <div class="signal-controls">
  <label class="field">
   Signalo režimas
   <select value={settings.preset ?? ''} on:change={event => changePreset(event.currentTarget.value)}>
    {#each signalPresets as preset}
     <option value={preset.id}>{preset.label}</option>
    {/each}
    <option value="">Rankinis limitas</option>
   </select>
  </label>
  <label class="field">
   Vieno porto limitas, px
   <input type="number" min="1" step="1" value={settings.portCapacity}
    aria-invalid={capacityError ? 'true' : undefined}
    on:change={event => changeCapacity(event.currentTarget)} />
  </label>
  <label class="field">
   Kabelio eiga bloke
   <select value={settings.direction} on:change={event => update({direction: event.currentTarget.value === 'columns' ? 'columns' : 'rows'})}>
    <option value="rows">Horizontaliai</option>
    <option value="columns">Vertikaliai</option>
   </select>
  </label>
  <label class="field">
   Portų įėjimo kraštinė
   <select value={`${entry}:${settings.corner}`} on:change={event => {
    const selected = entries.find(option => `${option.edge}:${option.corner}` === event.currentTarget.value);
    if (selected) update({entryEdge: selected.edge, corner: selected.corner});
   }}>
    {#each entries as option}<option value={`${option.edge}:${option.corner}`}>{option.label}</option>{/each}
   </select>
  </label>
 </div>
 {#if settings.preset}
  <p class="signal-basis">Lentelės limitas pagal 1 Gb/s ir 93,6 % pralaidumo panaudojimą.</p>
 {/if}
 {#if capacityError}<p class="signal-notice" role="alert">{capacityError}</p>{/if}
 <div class="signal-block-controls">
  <div class="field">
   <span>Portų blokai</span>
   <div class="segmented" role="group" aria-label="Portų blokai">
    <button type="button" class:chosen={fullRows} aria-pressed={fullRows} on:click={() => chooseBlockAxis(true)}>Per visą plotį</button>
    <button type="button" class:chosen={!fullRows} aria-pressed={!fullRows} on:click={() => chooseBlockAxis(false)}>Per visą aukštį</button>
   </div>
  </div>
  <label class="field">
   {fullRows ? 'Daugiausia eilių portui' : 'Daugiausia stulpelių portui'}
   <input type="number" min="1" max="100" step="1" placeholder="Automatiškai"
    value={settings.maxTracksPerPort ?? ''} aria-invalid={trackError ? 'true' : undefined}
    on:change={event => changeTrackLimit(event.currentTarget)} />
  </label>
 </div>
 {#if trackError}<p class="signal-notice" role="alert">{trackError}</p>{/if}
 {#if tracksLimitedByPixels}
  <p class="signal-notice">Pagal pikselių limitą portui gali tekti mažiau {fullRows ? 'eilių' : 'stulpelių'}, nei nustatyta.</p>
 {/if}

 {#if part && plan}
 <dl class="signal-metrics" aria-live="polite">
  <div><dt>Reikia portų</dt><dd>{plan.cells.length && (!plan.panelsPerPort || plan.issue) ? '—' : format.format(plan.ports.length)}</dd></div>
  <div><dt>Panelių limitas portui</dt><dd>{format.format(plan.panelsPerPort)}</dd></div>
  <div><dt>Aktyvūs pikseliai</dt><dd>{format.format(plan.pixels)} <small>px</small></dd></div>
 </dl>

 {#if !plan.cells.length}
  <p class="signal-notice">Šiame ekrane nėra aktyvių panelių.</p>
 {:else if !plan.panelsPerPort}
  <p class="signal-notice" role="alert">Porto limitas per mažas vienai panelei. Reikia bent {format.format(plan.panelPixels)} px.</p>
 {:else if plan.issue}
  <p class="signal-notice" role="alert">
   {plan.issue === 'gap'
    ? 'Dėl panelių išdėstymo nuo šios kraštinės nepavyksta sudaryti pilnų stačiakampių. Pasirinkite kitą įėjimo kraštinę.'
    : 'Nuo šios kraštinės iki priešingo panelių bloko krašto porto limito neužtenka. Pasirinkite kitą įėjimo kraštinę arba didesnį palaikomą limitą.'}
  </p>
 {:else}
  <div class="signal-drawing">
   <svg viewBox={`-0.25 -0.25 ${part.screen.cols + 0.5} ${part.screen.rows * height + 0.5}`}
    role="img" aria-label={`${screen.name}. ${plan.ports.length} signalo portų maršrutai.`}>
    <defs>
     {#each colors as paint, index}
      <marker id={`signal-arrow-${index}`} markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">
       <path d="M0 0 L4 2 L0 4 Z" fill={paint} />
      </marker>
     {/each}
    </defs>
    {#each plan.ports as port (port.number)}
     {@const start = port.cells[0]}
     {@const paint = color(port.number)}
     <g opacity={focusedPort === null || focusedPort === port.number ? 1 : 0.23}>
      {#each port.cells as {c, r}}
       <rect x={c + 0.025} y={r * height + 0.025} width="0.95" height={height - 0.05}
        rx="0.055" fill={paint} fill-opacity="0.12" stroke={paint} stroke-opacity="0.48" stroke-width="0.016" />
       <text x={c + 0.11} y={r * height + Math.min(0.22, height * 0.34)}
        fill="#cbd5e1" font-size={Math.min(0.17, height * 0.25)}>{physicalPanelNumber(screen, part, {c, r})}</text>
      {/each}
      {#if port.cells.length > 1}
       <polyline points={route(port.cells, height)} fill="none" stroke={paint}
        stroke-width="0.047" stroke-linecap="round" stroke-linejoin="round" />
       {#each port.cells.slice(1) as cell, index}
        {@const previous = port.cells[index]}
        <line x1={(previous.c + cell.c + 1) / 2 - (cell.c - previous.c) * 0.1}
         y1={((previous.r + cell.r) / 2 + 0.56 - (cell.r - previous.r) * 0.1) * height}
         x2={(previous.c + cell.c + 1) / 2} y2={((previous.r + cell.r) / 2 + 0.56) * height}
         stroke={paint} stroke-width="0.047" marker-end={`url(#signal-arrow-${(port.number - 1) % colors.length})`} />
       {/each}
      {/if}
      <rect x={start.c + 0.25} y={(start.r + 0.56) * height - 0.12} width="0.5" height="0.24" rx="0.09" fill={paint} />
      <text x={start.c + 0.5} y={(start.r + 0.56) * height} text-anchor="middle"
       dominant-baseline="central" fill="#10151d" font-size="0.135" font-weight="800">P{port.number}</text>
     </g>
    {/each}
   </svg>
  </div>
  <div class="port-list" aria-label="Portų apkrova">
   {#each plan.ports as port (port.number)}
    <button type="button" class="port-row" aria-pressed={focusedPort === port.number}
     style:--port-color={color(port.number)}
     on:click={() => selectedPort = focusedPort === port.number ? null : port.number}>
     <strong>P{port.number}</strong>
     <span>{port.columns} × {port.rows} panel. · {format.format(port.pixels)} px</span>
     <span class="port-reserve">Laisva {format.format(port.remaining)} px</span>
     <span class="port-meter" aria-hidden="true"><span style:width={`${100 * port.pixels / settings.portCapacity}%`}></span></span>
    </button>
   {/each}
  </div>
 {/if}
 {/if}
</section>

<style>
 .signal-panel{display:grid;gap:16px}
 .signal-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
 .output-controls{display:grid;gap:12px;padding:12px;border:1px solid var(--line);border-radius:8px;background:#1b2530}
 .output-toggle{display:flex;align-items:center;gap:8px;font-size:13px}
 .output-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
 .output-controls .field{margin:0;font-size:12px}
 .part-position{margin:0;color:#a3b4c7;font-size:11px}
 @media(max-width:480px){.output-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
 .signal-heading h2{margin:0;font-size:17px;overflow-wrap:anywhere}
 .signal-heading span{font-size:12px;color:#a3b4c7}
 .signal-controls,.signal-block-controls,.signal-metrics{display:grid;gap:12px}
 .signal-controls,.signal-block-controls{grid-template-columns:repeat(2,minmax(0,1fr))}
 .signal-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
 .signal-controls .field,.signal-block-controls .field{font-size:12px;margin:0}
 .signal-block-controls .segmented{margin-top:8px;min-height:37px}
 .signal-block-controls .segmented button{white-space:normal}
 .signal-basis{margin:-6px 0 0;font-size:11px;color:#a3b4c7}
 .signal-metrics{margin:0;padding:13px;border:1px solid var(--line);border-radius:8px;background:#1b2530}
 .signal-metrics dt{color:#a3b4c7;font-size:11px}
 .signal-metrics dd{margin:5px 0 0;font-size:clamp(14px,2vw,23px);font-weight:700;overflow-wrap:anywhere}
 .signal-metrics small{font-size:11px;color:#a3b4c7}
 .signal-drawing{display:grid;place-items:center;min-height:200px;padding:12px;background:#10151d;border:1px solid var(--line);border-radius:8px}
 .signal-drawing svg{display:block;width:100%;max-height:560px}
 .signal-notice{margin:0;padding:10px 12px;color:#f3d498;background:#332b1e;border:1px solid #5b4831;border-radius:7px;font-size:12px}
 .port-list{display:grid;gap:6px;max-height:320px;overflow:auto;padding:3px}
 .port-row{display:grid;grid-template-columns:minmax(2.5rem,auto) minmax(0,1fr) minmax(0,1fr);gap:6px 10px;text-align:left;padding:9px 11px;background:#1b2530;border-color:#344252}
 .port-row:hover,.port-row[aria-pressed=true]{border-color:var(--port-color);background:#243141}
 .port-row strong{color:var(--port-color)}
 .port-row span{overflow-wrap:anywhere}
 .port-reserve{text-align:right;color:#a3b4c7}
 .port-meter{grid-column:2/-1;height:3px;background:#344252;border-radius:2px}
 .port-meter span{display:block;height:100%;border-radius:inherit;background:var(--port-color)}
 @media(min-width:1450px){.signal-controls{grid-template-columns:repeat(4,minmax(0,1fr))}}
</style>
