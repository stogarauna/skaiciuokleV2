<script lang="ts">
 import type {Screen} from './project';
 import {physicalPanelNumber, signalOutputs} from './signal-output';
 import SignalCanvas from './SignalCanvas.svelte';
 import {defaultSignalOutput, defaultSignalSettings, fitPortRoute, signalEntryEdge, signalPartKey, signalPresets, snakePanelBlock, validPortCapacity, validSignalTrackLimit, type Cell, type SignalEntryEdge, type SignalOutputSettings, type SignalPartPositions, type SignalSettings} from './signal';

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
 let blockDirection: SignalSettings['direction'] = 'rows';
 let lastBlock: {key: string; index: number; route: Cell[]; count: number} | null = null;
 const colors = ['#5eead4', '#facc6b', '#93c5fd', '#f9a8d4', '#a3e635', '#c4b5fd', '#fdba74', '#67e8f9'];
 const color = (port: number) => colors[(port - 1) % colors.length];
 const format = new Intl.NumberFormat('lt-LT');
 const corners = [
  {corner: 'top-left', label: 'iš viršaus kairėje', flip: ''},
  {corner: 'top-right', label: 'iš viršaus dešinėje', flip: 'translate(24 0) scale(-1 1)'},
  {corner: 'bottom-left', label: 'iš apačios kairėje', flip: 'translate(0 24) scale(1 -1)'},
  {corner: 'bottom-right', label: 'iš apačios dešinėje', flip: 'translate(24 24) scale(-1 -1)'}
 ] as const;
 const patterns = [
  {direction: 'rows', label: 'Horizontaliai', name: 'Horizontalios schemos', path: 'M4 5h16v7H4v7h16'},
  {direction: 'columns', label: 'Vertikaliai', name: 'Vertikalios schemos', path: 'M4 5v14h8V5h8v14'}
 ] as const;
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
 $: blockPart = panelBlock && outputs.parts.find(part => part.number === panelBlock?.part);
 $: differentPart = !!(blockPart && editingPort && manualSelection?.key !== signalPartKey(blockPart));
 $: assignedInBlockPart = assignedCells(blockPart ? blockPart.plan.ports : []);
 $: blockCandidates = panelBlock && blockPart
  ? panelBlock.cells.filter(cell => !assignedInBlockPart.has(cellKey(cell))) : [];
 $: fittingCells = panelBlock && !differentPart
  ? fitPortRoute(snakePanelBlock(blockCandidates, {direction: blockDirection, corner: panelBlock.corner}),
   editingPort?.cells ?? [], panelsPerPort) : [];
 $: markedBlock = panelBlock && {...panelBlock, cells: fittingCells};
 $: previewTail = editingPort?.cells.at(-1);
 $: hasManualRoutes = Object.values(settings.manualRoutes ?? {}).some(routes => routes.length);
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

 function clearManualRoutes() {
  panelBlock = null;
  lastBlock = null;
  startPort();
  onchange({...settings, manualRoutes: undefined});
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

 function connectBlock() {
  if (markedBlock && appendPanels(markedBlock.part, markedBlock.cells)) panelBlock = null;
 }

 function choosePattern(direction: SignalSettings['direction'], corner: SignalSettings['corner']) {
  if (!panelBlock) return;
  blockDirection = direction;
  panelBlock = {...panelBlock, corner};
 }

 function cellKey({c, r}: Cell) {
  return `${c},${r}`;
 }

 function assignedCells(ports: {cells: Cell[]}[]) {
  return new Set(ports.flatMap(port => port.cells.map(cellKey)));
 }

 function appendPanels(partNumber: number, cells: Cell[]) {
  const part = outputs.parts.find(candidate => candidate.number === partNumber);
  if (!part || !cells.length) return false;
  const key = signalPartKey(part);
  if (editingPort && manualSelection?.key !== key) {
   manualError = 'Kitai ekrano daliai pradėkite naują portą.';
   return false;
  }
  const assigned = assignedCells(part.plan.ports);
  if (cells.some(cell => assigned.has(cellKey(cell)))) {
   manualError = cells.length === 1 ? 'Ši panelė jau prijungta.' : 'Pažymėk dar neprijungtas paneles.';
   return false;
  }
  if (fitPortRoute(cells, editingPort?.cells ?? [], panelsPerPort).length < cells.length) {
   manualError = 'Panelė netelpa į porto pikselių limitą.';
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

{#snippet toolIcon(path: string)}
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={path} />
 </svg>
{/snippet}

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
  {@const undoLabel = blockStep ? 'Atšaukti paskutinį bloką' : 'Atšaukti paskutinę panelę'}
  <div class="manual-tools" role="group" aria-label="Rankinio jungimo įrankiai">
   <div class="tool-set">
    <button class="manual-icon" type="button" title="Naujas portas" aria-label="Naujas portas" on:click={startPort}>{@render toolIcon('M12 5v14M5 12h14')}</button>
    <button class="manual-icon" type="button" title={undoLabel} aria-label={undoLabel} disabled={!editingPort} on:click={undoPanel}>{@render toolIcon('M9 5l-5 5 5 5M4 10h10a5 5 0 0 1 0 10h-2')}</button>
    <button class="manual-icon clear-icon" type="button" title="Išvalyti visus portus" aria-label="Išvalyti visus portus" disabled={!hasManualRoutes} on:click={clearManualRoutes}>{@render toolIcon('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6')}</button>
   </div>
   {#each patterns as pattern}
    <div class="tool-set pattern-set" role="group" aria-label={pattern.name}>
     {#each corners as option}
      {@const title = `${pattern.label} ${option.label}`}
      <button class="manual-icon pattern-icon" type="button" title={title} aria-label={title} disabled={!panelBlock}
       aria-pressed={!!panelBlock && blockDirection === pattern.direction && panelBlock.corner === option.corner}
       on:click={() => choosePattern(pattern.direction, option.corner)}>
       <svg viewBox="0 0 24 24" aria-hidden="true">
        <g transform={option.flip}>
         <path d={pattern.path} fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" />
         <circle cx="4" cy="5" r="2.5" fill="currentColor" />
        </g>
       </svg>
      </button>
     {/each}
    </div>
   {/each}
   <div class="tool-set">
    <button class="manual-icon apply-icon" type="button" title="Prijungti bloką" aria-label="Prijungti bloką" disabled={!fittingCells.length} on:click={connectBlock}>{@render toolIcon('M4 12l5 5 11-11')}</button>
    <button class="manual-icon" type="button" title="Nuimti žymėjimą" aria-label="Nuimti žymėjimą" disabled={!panelBlock} on:click={() => selectPanelBlock(null)}>{@render toolIcon('M6 6l12 12M6 18 18 6')}</button>
   </div>
   <span class="manual-status" aria-live="polite">
    {#if editingPort}<strong style:--port-tint={color(editingPort.number)}>P{editingPort.number}</strong>{/if}
    {#if panelBlock}
     <span title="Panelės, kurios telpa į portą" aria-label={`Pažymėta ${fittingCells.length} panel.`}>{format.format(fittingCells.length)}/{format.format(blockCandidates.length)}</span>
    {/if}
   </span>
  </div>
  {#if manualError}<p class="signal-notice" role="alert">{manualError}</p>{/if}
  {#if differentPart}
   <p class="signal-notice">Kitai ekrano daliai pradėk naują portą.</p>
  {:else if panelBlock && !fittingCells.length}
   <p class="signal-notice">Į šį portą panelės netelpa.</p>
  {/if}
 {/if}
 <SignalCanvas {screen} parts={outputs.parts} positions={settings.output?.positions}
  editable={settings.output !== undefined} activePart={selectedPart} {focusedPort} {colors}
  bind:selected={selectedParts} onselect={selectPart} onlayout={saveLayout}
  panelBlock={markedBlock} {previewTail} onpanelblock={selectPanelBlock} onpanel={manual ? addPanel : undefined} />
 {#if manual}<p class="part-position">Spustelėk panelę arba apibrėžk bloką ir pasirink jungimo schemą.</p>{/if}
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
 .manual-tools,.tool-set,.manual-status{display:flex;align-items:center;gap:5px}
 .manual-tools{flex-wrap:wrap;gap:8px;padding:6px;background:#19212b;border:1px solid var(--line);border-radius:8px}
 .tool-set+.tool-set{padding-left:8px;border-left:1px solid var(--line)}
 .manual-icon{width:34px;height:34px;padding:5px;background:#24303d;border-color:#354557;color:#c1d5df}
 .manual-icon svg{width:22px;height:22px}
 .manual-icon:not(:disabled):hover{background:#35495c;color:#f8fafc}
 .pattern-icon[aria-pressed=true]{background:#264945;border-color:#66ddc8;color:#a2f5e5}
 .clear-icon:not(:disabled){color:#f4b2ad}
 .apply-icon:not(:disabled){background:#65d8c3;border-color:#65d8c3;color:#102a29}
 .apply-icon:not(:disabled):hover{background:#91ead9;color:#102a29}
 .manual-status{gap:8px;font-size:12px;color:#a3b4c7}
 .manual-status strong{color:var(--port-tint)}
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
