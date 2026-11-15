<script lang="ts">
 import type {Screen} from './project';
 import {physicalPanelNumber, signalOutputs} from './signal-output';
 import SignalCanvas from './SignalCanvas.svelte';
 import {defaultSignalOutput, defaultSignalSettings, signalEntryEdge, signalPartKey, signalPresets, snakePanelBlock, validPortCapacity, validSignalTrackLimit, type Cell, type SignalEntryEdge, type SignalOutputSettings, type SignalPartPositions, type SignalSettings} from './signal';

 export let screen: Screen;
 export let onchange: (settings: SignalSettings) => void;

 let selectedPart = 1;
 let selectedParts: number[] = [];
 let outputError = '';
 let selectedPort: {part: number; number: number} | null = null;
 let capacityError = '';
 let trackError = '';
 let manualSelection: {key: string; index: number} | null = null;
 let manualError = '';
 let panelBlock: {part: number; cells: Cell[]; corner: SignalSettings['corner']} | null = null;
 let lastBlock: {key: string; index: number; route: Cell[]; count: number} | null = null;
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
 $: manual = settings.routeMode === 'manual';
 $: entry = signalEntryEdge(settings);
 $: fullRows = entry === 'left' || entry === 'right';
 $: outputs = signalOutputs(screen, settings);
 $: panelPixels = screen.panel.resX * screen.panel.resY;
 $: panelsPerPort = Math.floor(settings.portCapacity / panelPixels);
 $: activePixels = outputs.parts.reduce((sum, part) => sum + part.plan.pixels, 0);
 $: totalPorts = outputs.parts.reduce((sum, part) => sum + part.plan.ports.length, 0);
 $: unassigned = outputs.parts.reduce((sum, part) =>
  sum + part.plan.cells.length - part.plan.ports.reduce((count, port) => count + port.cells.length, 0), 0);
 $: incomplete = outputs.parts.some(({plan}) => plan.cells.length > 0 && !plan.ports.length);
 $: tracksLimitedByPixels = settings.maxTracksPerPort !== undefined && outputs.parts.some(({plan}) =>
  plan.ports.some(port => {
   if (port.cells.length !== port.columns * port.rows) return false;
   const panelsInTrack = fullRows ? port.columns : port.rows;
   return panelsInTrack * panelPixels * settings.maxTracksPerPort! > settings.portCapacity;
  })
 );
 $: editingPart = manualSelection ? outputs.parts.find(part => signalPartKey(part) === manualSelection?.key) : undefined;
 $: editingPort = editingPart?.plan.ports.find(port => port.manualIndex === manualSelection?.index);
 $: blockStep = lastBlock && manualSelection?.key === lastBlock.key && manualSelection.index === lastBlock.index &&
  settings.manualRoutes?.[lastBlock.key]?.[lastBlock.index] === lastBlock.route ? lastBlock.count : 0;
 $: focusedPort = manual ? editingPort?.number ?? null : selectedPort && outputs.parts.find(part => part.number === selectedPort?.part)
  ?.plan.ports.some(port => port.number === selectedPort?.number) ? selectedPort.number : null;

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
  selectedParts = [];
  outputError = '';
  panelBlock = null;
  startPort();
  update({output});
 }

 function changeOutput(field: 'width' | 'height' | 'partsAcross', input: HTMLInputElement) {
  if (!settings.output) return;
  const value = input.valueAsNumber;
  const blank = input.value === '' && !input.validity.badInput;
  if (field === 'partsAcross' && blank) {
   setOutput({...settings.output, partsAcross: undefined, positions: undefined});
   return;
  }
  if (field === 'partsAcross' ? validSignalTrackLimit(value) : validPortCapacity(value)) {
   setOutput({...settings.output, [field]: value, positions: undefined});
   return;
  }
  outputError = field === 'partsAcross'
   ? 'Įveskite dalių skaičių nuo 1 iki 100 arba palikite lauką tuščią.'
   : 'Įveskite teigiamą sveiką pikselių skaičių.';
  input.value = settings.output[field]?.toString() ?? '';
 }

 function selectPart(number: number) {
  selectedPart = number;
  selectedPort = null;
 }

 function highlightPort(part: number, number: number) {
  selectedPart = part;
  if (manual) {
   const item = outputs.parts.find(candidate => candidate.number === part);
   const port = item?.plan.ports.find(candidate => candidate.number === number);
   if (item && port?.manualIndex !== undefined) manualSelection = {key: signalPartKey(item), index: port.manualIndex};
   manualError = '';
   return;
  }
  selectedPort = selectedPort?.part === part && selectedPort.number === number ? null : {part, number};
 }

 function saveLayout(positions: SignalPartPositions | undefined) {
  if (settings.output) update({output: {...settings.output, positions}});
 }

 function startPort() {
  manualSelection = null;
  manualError = '';
 }

 function chooseRouting(byHand: boolean) {
  panelBlock = null;
  startPort();
  update({routeMode: byHand ? 'manual' : undefined});
 }

 function saveManual(key: string, routes: Cell[][]) {
  manualError = '';
  onchange({...settings, manualRoutes: {...settings.manualRoutes, [key]: routes}});
 }

 function addPanel(partNumber: number, cell: Cell) {
  appendPanels(partNumber, [cell]);
 }

 function selectPanelBlock(block: typeof panelBlock) {
  panelBlock = block?.part ? block : null;
  manualError = block && !block.part ? 'Vienu kartu pažymėk paneles vienoje išvesties dalyje.' : '';
 }

 function connectBlock(direction: SignalSettings['direction']) {
  if (!panelBlock) return;
  const path = snakePanelBlock(panelBlock.cells, {direction, corner: panelBlock.corner});
  if (appendPanels(panelBlock.part, path)) panelBlock = null;
 }

 function appendPanels(partNumber: number, cells: Cell[]) {
  const part = outputs.parts.find(candidate => candidate.number === partNumber);
  if (!part || !cells.length) return false;
  const key = signalPartKey(part);
  if (editingPort && manualSelection?.key !== key) {
   manualError = 'Kitai ekrano daliai pradėkite naują portą.';
   return false;
  }
  const assigned = new Set(part.plan.ports.flatMap(port => port.cells.map(({c,r}) => `${c},${r}`)));
  if (cells.some(({c,r}) => assigned.has(`${c},${r}`))) {
   manualError = cells.length === 1 ? 'Ši panelė jau prijungta.' : 'Pažymėk dar neprijungtas paneles.';
   return false;
  }
  const routes = [...settings.manualRoutes?.[key] ?? []];
  const index = editingPort?.manualIndex ?? routes.length;
  const route = [...editingPort?.cells ?? [], ...cells];
  routes[index] = route;
  selectedPart = partNumber;
  manualSelection = {key, index};
  lastBlock = cells.length > 1 ? {key,index,route,count:cells.length} : null;
  saveManual(key, routes);
  return true;
 }

 function undoPanel() {
  if (!editingPart || editingPort?.manualIndex === undefined) return;
  const key = signalPartKey(editingPart);
  const index = editingPort.manualIndex;
  const routes = [...settings.manualRoutes?.[key] ?? []];
  const remaining = editingPort.cells.slice(0, -(blockStep || 1));
  lastBlock = null;
  if (remaining.length) routes[index] = remaining;
  else {
   routes.splice(index, 1);
   startPort();
  }
  saveManual(key, routes);
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
  {/if}
 </div>
 <div class="segmented routing-mode" role="group" aria-label="Maršruto braižymas">
  <button type="button" class:chosen={!manual} aria-pressed={!manual} on:click={() => chooseRouting(false)}>Automatiškai</button>
  <button type="button" class:chosen={manual} aria-pressed={manual} on:click={() => chooseRouting(true)}>Ranka</button>
 </div>
 {#if outputs.parts.length}
 {#if manual}
  <div class="manual-tools">
   <button class="secondary" type="button" on:click={startPort}>Naujas portas</button>
   <button class="secondary" type="button" disabled={!editingPort} on:click={undoPanel}>{blockStep ? 'Atšaukti paskutinį bloką' : 'Atšaukti paskutinę panelę'}</button>
   <span aria-live="polite">{editingPort ? `P${editingPort.number} · ${format.format(editingPort.pixels)} px` : 'Paspausk pirmą panelę'}</span>
  </div>
  <p class="part-position">Spausk vieną panelę arba pele apibrėžk bloką. Norėdamas tęsti esamą portą, pasirink jį sąraše.</p>
   <div class="manual-tools">
    <strong aria-live="polite">{panelBlock ? `Pažymėta ${format.format(panelBlock.cells.length)} panel.` : 'Blokas nepažymėtas'}</strong>
    <label>Bloko pradžia
     <select disabled={!panelBlock} value={panelBlock?.corner ?? 'top-left'}
      on:change={event => {if (panelBlock) panelBlock = {...panelBlock,corner:event.currentTarget.value as SignalSettings['corner']};}}>
      <option value="top-left">Viršuje kairėje</option>
      <option value="top-right">Viršuje dešinėje</option>
      <option value="bottom-left">Apačioje kairėje</option>
      <option value="bottom-right">Apačioje dešinėje</option>
     </select>
    </label>
    <button class="primary" type="button" disabled={!panelBlock} on:click={() => connectBlock('rows')}>Jungti horizontaliai</button>
    <button class="primary" type="button" disabled={!panelBlock} on:click={() => connectBlock('columns')}>Jungti vertikaliai</button>
    <button class="secondary" type="button" disabled={!panelBlock} on:click={() => selectPanelBlock(null)}>Nuimti žymėjimą</button>
   </div>
  {#if manualError}<p class="signal-notice" role="alert">{manualError}</p>{/if}
 {/if}
 <SignalCanvas {screen} parts={outputs.parts} positions={settings.output?.positions}
  editable={settings.output !== undefined} activePart={selectedPart} {focusedPort} {colors}
  bind:selected={selectedParts} onselect={selectPart} onlayout={saveLayout}
  {panelBlock} onpanelblock={selectPanelBlock} onpanel={manual ? addPanel : undefined} />
 {/if}
 {#if outputs.parts.length}
  <dl class="signal-metrics" aria-live="polite">
   <div><dt>{manual ? 'Sujungti portai' : settings.output ? 'Portai iš viso' : 'Reikia portų'}</dt><dd>{!manual && incomplete ? '—' : format.format(totalPorts)}</dd></div>
   <div><dt>{manual ? 'Neprijungtos panelės' : 'Panelių vietų limitas portui'}</dt><dd>{format.format(manual ? unassigned : panelsPerPort)}</dd></div>
   <div><dt>Aktyvūs pikseliai</dt><dd>{format.format(activePixels)} <small>px</small></dd></div>
  </dl>
  <p class="part-position">Porto apkrova skaičiuojama pagal visą apimantį stačiakampį, įskaitant tuščias vietas.</p>

  <div class="part-summaries" aria-label="Visų dalių portai">
   {#each outputs.parts as part (part.number)}
    {@const plan = part.plan}
    <section class="part-summary" aria-label={settings.output ? `Dalis ${part.number}` : 'Ekrano portai'}>
     {#if settings.output}
      <div class="part-title">
       <h3>Dalis {part.number}</h3>
       <span>{format.format(part.width)} × {format.format(part.height)} px</span>
      </div>
      <p class="part-position">Stulpeliai {part.column + 1}–{part.column + part.screen.cols} · eilės {part.row + 1}–{part.row + part.screen.rows}</p>
      <p class="part-position">{format.format(plan.cells.length)} panel. · {format.format(plan.pixels)} aktyvių px · {plan.ports.length || '—'} port.</p>
     {/if}

     {#if !plan.cells.length}
      <p class="signal-notice">Aktyvių panelių nėra.</p>
     {:else if !manual && !plan.panelsPerPort}
      <p class="signal-notice">Vienai panelei reikia bent {format.format(plan.panelPixels)} px.</p>
     {:else if plan.issue}
      <p class="signal-notice">Pilnai eilei arba stulpeliui neužtenka porto pikselių limito. Pasirinkite kitą įėjimo kraštinę arba didesnį palaikomą limitą.</p>
     {:else}
      <div class="port-list">
       {#each plan.ports as port (port.number)}
        <button type="button" class="port-row" class:overloaded={port.remaining < 0} aria-pressed={focusedPort === port.number}
         style:--port-color={color(port.number)} on:click={() => highlightPort(part.number, port.number)}>
         <strong>P{port.number}</strong>
         <span>{port.cells.length} panel. · {port.columns} × {port.rows} blokas · {format.format(port.pixels)} px</span>
         <span class="port-reserve">{port.remaining < 0 ? 'Viršyta' : 'Laisva'} {format.format(Math.abs(port.remaining))} px</span>
         <span class="port-entry">Įėjimas: panelė {physicalPanelNumber(screen, part, port.cells[0])}</span>
         <span class="port-meter" aria-hidden="true"><span style:width={`${Math.min(100, 100 * port.pixels / settings.portCapacity)}%`}></span></span>
        </button>
       {/each}
      </div>
     {/if}
    </section>
   {/each}
  </div>
 {/if}
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
  {#if !manual}<label class="field">
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
  </label>{/if}
 </div>
 {#if settings.preset}
  <p class="signal-basis">Lentelės limitas pagal 1 Gb/s ir 93,6 % pralaidumo panaudojimą.</p>
 {/if}
 {#if capacityError}<p class="signal-notice" role="alert">{capacityError}</p>{/if}
 {#if !manual}<div class="signal-block-controls">
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
 {/if}

</section>

<style>
 .signal-panel{display:grid;gap:16px}
 .routing-mode{justify-self:start}
 .manual-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
 .manual-tools label{display:flex;align-items:center;gap:6px}
 .manual-tools select{width:auto}
 .port-row.overloaded{--port-color:#fca5a5!important}
 .overloaded .port-reserve{color:#fca5a5}
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
 .signal-notice{margin:0;padding:10px 12px;color:#f3d498;background:#332b1e;border:1px solid #5b4831;border-radius:7px;font-size:12px}
 .part-summaries{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:12px;align-items:start}
 .part-summary{min-width:0;display:grid;gap:8px;padding:11px;border:1px solid var(--line);border-radius:8px;background:#16202c}
 .part-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
 .part-title h3{margin:0;font-size:14px}
 .part-title span{font-size:12px;color:#a3b4c7}
 .port-list{display:grid;gap:6px}
 .port-row{display:grid;grid-template-columns:minmax(2.5rem,auto) minmax(0,1fr) minmax(0,1fr);gap:6px 10px;text-align:left;padding:9px 11px;background:#1b2530;border-color:#344252}
 .port-row:hover,.port-row[aria-pressed=true]{border-color:var(--port-color);background:#243141}
 .port-row strong{color:var(--port-color)}
 .port-row span{overflow-wrap:anywhere}
 .port-reserve{text-align:right;color:#a3b4c7}
 .port-entry{grid-column:2/-1;font-size:10px;color:#a3b4c7}
 .port-meter{grid-column:2/-1;height:3px;background:#344252;border-radius:2px}
 .port-meter span{display:block;height:100%;border-radius:inherit;background:var(--port-color)}
 @media(min-width:1450px){.signal-controls{grid-template-columns:repeat(4,minmax(0,1fr))}}
</style>
