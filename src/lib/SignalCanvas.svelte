<script lang="ts">
 import type {Screen} from './project';
 import {physicalPanelNumber, type SignalOutputPart} from './signal-output';
 import {routeBounds, signalPartKey, type Cell, type RouteMap, type SignalPartPositions, type SignalSettings} from './signal';
 import ZoomControls from './ZoomControls.svelte';

 export let screen: Screen;
 type CanvasPart = Omit<SignalOutputPart, 'plan'> & {plan: RouteMap};
 export let parts: CanvasPart[];
 export let circuitPrefix = 'P';
 export let drawingLabel = 'Signalo portų maršrutai';
 export let positions: SignalPartPositions | undefined = undefined;
 export let editable = false;
 export let activePart: number;
 export let focusedPort: number | null;
 export let selected: number[] = [];
 export let colors: string[];
 export let onselect: (part: number) => void;
 export let onlayout: (positions: SignalPartPositions | undefined) => void;
 export let onpanel: ((part: number, cell: Cell) => void) | undefined = undefined;
 export let panelBlock: {part: number; cells: Cell[]} | null = null;
 export let previewTail: Cell | undefined = undefined;
 export let onpanelblock: ((block: {part: number; cells: Cell[]; corner: SignalSettings['corner']} | null) => void) | undefined = undefined;

 type Point = {x: number; y: number};
 type Box = Point & {width: number; height: number};
 type Tile = Box & {part: CanvasPart; key: string};
 type Gesture = {
  mode: 'move' | 'select'; id: number; start: Point; end: Point; initial: number[];
 } | {
  mode: 'panels'; id: number; start: Point; end: Point; client: Point; dragging: boolean;
  hit?: {part: number; cell: Cell};
 };
 type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
 const alignment: {value: Alignment; label: string}[] = [
  {value: 'left', label: 'Kairė'}, {value: 'center', label: 'Centruoti X'}, {value: 'right', label: 'Dešinė'},
  {value: 'top', label: 'Viršus'}, {value: 'middle', label: 'Centruoti Y'}, {value: 'bottom', label: 'Apačia'}
 ];

 let svg: SVGSVGElement;
 let gesture: Gesture | undefined;
 let viewport: Box | undefined;
 let zoom = 100;
 const format = new Intl.NumberFormat('lt-LT');
 const clamp = (value: number) => Math.max(-10000, Math.min(10000, value));
 const snap = (value: number) => Math.round(value * 4) / 4;

 $: height = Math.min(3, Math.max(0.35, screen.panel.heightM / screen.panel.widthM));
 $: tiles = place(parts, height, positions, editable);
 $: selection = tiles.filter(tile => selected.includes(tile.part.number));
 $: delta = gesture?.mode === 'move'
  ? {x: snap(gesture.end.x - gesture.start.x), y: snap(gesture.end.y - gesture.start.y)}
  : {x: 0, y: 0};
 $: marquee = gesture && (gesture.mode === 'select' || (gesture.mode === 'panels' && gesture.dragging))
  ? boxBetween(gesture.start, gesture.end) : undefined;
 $: selectedCells = new Set(panelBlock?.cells.map(({c,r}) => `${c},${r}`));
 $: previewCells = panelBlock?.cells.length
  ? [...(previewTail ? [previewTail] : []), ...panelBlock.cells] : [];
 $: fitted = fit(tiles, editable);
 $: baseView = viewport ? union(viewport, fitted) : fitted;
 $: view = zoomView(baseView, zoom);

 function zoomView(box: Box, percent: number): Box {
  const width = box.width * 100 / percent;
  const height = box.height * 100 / percent;
  return {x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height};
 }

 function fitView() {
  zoom = 100;
  viewport = undefined;
 }

 function place(parts: CanvasPart[], height: number, saved: SignalPartPositions | undefined, editable: boolean) {
  const gap = 1.6;
  const area = parts.reduce((sum, part) => sum + (part.screen.cols + gap) * (part.screen.rows * height + gap), 0);
  const lineWidth = Math.max(...parts.map(part => part.screen.cols), Math.sqrt(area * 1.8));
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return parts.map(part => {
   const width = part.screen.cols;
   const tileHeight = part.screen.rows * height;
   if (x > 0 && x + width > lineWidth) {
    x = 0;
    y += rowHeight + gap;
    rowHeight = 0;
   }
   const key = signalPartKey(part);
   const point = editable ? saved?.[key] ?? {x, y} : {x: 0, y: 0};
   x += width + gap;
   rowHeight = Math.max(rowHeight, tileHeight);
   return {part, key, ...point, width, height: tileHeight};
  });
 }

 function bounds(items: Box[]): Box {
  const x = Math.min(...items.map(item => item.x));
  const y = Math.min(...items.map(item => item.y));
  return {
   x, y, width: Math.max(...items.map(item => item.x + item.width)) - x,
   height: Math.max(...items.map(item => item.y + item.height)) - y
  };
 }

 function fit(items: Tile[], editable: boolean): Box {
  if (!items.length) return {x: 0, y: 0, width: 1, height: 1};
  const box = bounds(items);
  const margin = editable ? Math.max(0.8, Math.min(2.5, box.width * 0.06)) : 0.25;
  return {x: box.x - margin, y: box.y - margin - (editable ? 0.8 : 0),
   width: box.width + margin * 2, height: box.height + margin * 2 + (editable ? 0.8 : 0)};
 }

 function union(a: Box, b: Box) {
  return bounds([a, b]);
 }

 function boxBetween(a: Point, b: Point): Box {
  return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y)};
 }

 function point(event: PointerEvent) {
  const matrix = svg.getScreenCTM();
  return matrix && new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
 }

 function setSelection(numbers: number[], active = numbers[0]) {
  selected = numbers;
  if (active !== undefined) onselect(active);
 }

 function start(event: PointerEvent, tile?: Tile, cell?: Cell) {
  if ((!editable && !onpanel) || event.button !== 0 || gesture) return;
  const start = point(event);
  if (!start) return;
  // The SVG handles the gesture; Chromium must not focus the SVG hit target on press.
  event.preventDefault();
  event.stopPropagation();
  if (onpanel) {
   gesture = {mode:'panels', id:event.pointerId, start, end:start, client:{x:event.clientX,y:event.clientY},
    dragging:false, hit:tile && cell ? {part:tile.part.number, cell} : undefined};
   svg.setPointerCapture(event.pointerId);
   return;
  }
  const additive = event.shiftKey || event.ctrlKey || event.metaKey;
  if (tile) {
   const number = tile.part.number;
   if (additive && selected.includes(number)) {
    setSelection(selected.filter(id => id !== number));
    return;
   }
   const numbers = selected.includes(number) ? selected : additive ? [...selected, number] : [number];
   setSelection(numbers, number);
  }
  gesture = {mode: tile ? 'move' : 'select', id: event.pointerId, start, end: start, initial: additive ? selected : []};
  svg.setPointerCapture(event.pointerId);
 }

 function move(event: PointerEvent) {
  if (gesture?.id !== event.pointerId) return;
  const end = point(event);
  if (!end) return;
  if (gesture.mode === 'panels') {
   const dragging = gesture.dragging || Math.hypot(event.clientX - gesture.client.x,event.clientY - gesture.client.y) >= 5;
   gesture = {...gesture, end, dragging};
  } else gesture = {...gesture, end};
 }

 function save(items: Tile[], position: (tile: Tile) => Point) {
  if (!items.length) return;
  viewport = baseView;
  const next: SignalPartPositions = {};
  const keys = new Set(items.map(item => item.key));
  for (const tile of tiles) {
   const point = keys.has(tile.key) ? position(tile) : tile;
   next[tile.key] = {x: clamp(point.x), y: clamp(point.y)};
  }
  onlayout(next);
 }

 function end(event: PointerEvent) {
  if (gesture?.id !== event.pointerId) return;
  const finish = point(event) ?? gesture.end;
  if (gesture.mode === 'panels') {
   if (gesture.dragging || Math.hypot(event.clientX - gesture.client.x,event.clientY - gesture.client.y) >= 5) {
    const box = boxBetween(gesture.start, finish);
    const hits = tiles.map(tile => ({part:tile.part.number,cells:unassigned(tile.part.plan).filter(({c,r}) => {
     const x = tile.x + c;
     const y = tile.y + r * height;
     return x < box.x + box.width && x + 1 > box.x &&
      y < box.y + box.height && y + height > box.y;
    })})).filter(item => item.cells.length);
    const corner = `${gesture.start.y <= finish.y ? 'top' : 'bottom'}-${gesture.start.x <= finish.x ? 'left' : 'right'}` as const;
    if (hits.length === 1) onpanelblock?.({...hits[0],corner});
    else onpanelblock?.(hits.length ? {part:0,cells:[],corner} : null);
   } else if (gesture.hit) {
    onpanelblock?.(null);
    onpanel?.(gesture.hit.part,gesture.hit.cell);
   } else onpanelblock?.(null);
  } else if (gesture.mode === 'move') {
   const dx = snap(finish.x - gesture.start.x);
   const dy = snap(finish.y - gesture.start.y);
   if (dx || dy) save(selection, tile => ({x: tile.x + dx, y: tile.y + dy}));
  } else {
   const box = boxBetween(gesture.start, finish);
   const hits = box.width > 0 && box.height > 0 ? tiles.filter(tile =>
    tile.x < box.x + box.width && tile.x + tile.width > box.x
    && tile.y < box.y + box.height && tile.y + tile.height > box.y
   ).map(tile => tile.part.number) : [];
   setSelection([...new Set([...gesture.initial, ...hits])]);
  }
  gesture = undefined;
 }

 function align(side: Alignment) {
  if (selection.length < 2) return;
  const box = bounds(selection);
  save(selection, tile => {
   if (side === 'left') return {x: box.x, y: tile.y};
   if (side === 'center') return {x: box.x + (box.width - tile.width) / 2, y: tile.y};
   if (side === 'right') return {x: box.x + box.width - tile.width, y: tile.y};
   if (side === 'top') return {x: tile.x, y: box.y};
   if (side === 'middle') return {x: tile.x, y: box.y + (box.height - tile.height) / 2};
   return {x: tile.x, y: box.y + box.height - tile.height};
  });
 }

 function arrange(horizontal: boolean) {
  if (selection.length < 2) return;
  const box = bounds(selection);
  let offset = 0;
  save(selection, tile => {
   const position = {x: box.x + (horizontal ? offset : 0), y: box.y + (horizontal ? 0 : offset)};
   offset += (horizontal ? tile.width : tile.height) + 1.6;
   return position;
  });
  viewport = undefined;
 }

 function keydown(event: KeyboardEvent, tile: Tile) {
  if (!editable || onpanel || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  const number = tile.part.number;
  setSelection(event.shiftKey ? [...new Set([...selected, number])] : [number], number);
 }

 function route(cells: {c: number; r: number}[], height: number) {
  return cells.map(({c, r}) => `${c + 0.5},${(r + 0.56) * height}`).join(' ');
 }

 function unassigned(plan: RouteMap) {
  const assigned = new Set(plan.ports.flatMap(port => port.cells.map(cell => `${cell.c},${cell.r}`)));
  return plan.cells.filter(cell => !assigned.has(`${cell.c},${cell.r}`));
 }
</script>

{#if editable && !onpanel}
 <div class="layout-toolbar" role="group" aria-label="Dalių lygiavimas">
  {#each alignment as option}
   <button type="button" disabled={selection.length < 2} on:click={() => align(option.value)}>{option.label}</button>
  {/each}
  <button type="button" disabled={selection.length < 2} on:click={() => arrange(true)}>Į eilę</button>
  <button type="button" disabled={selection.length < 2} on:click={() => arrange(false)}>Į stulpelį</button>
  <button type="button" disabled={!positions} on:click={() => { fitView(); onlayout(undefined); }}>Atkurti išdėstymą</button>
 </div>
 <p class="canvas-help">Tempk dalį pele. Apibrėžk dalis nuo tuščios drobės vietos arba pažymėk kelias laikydamas „Shift“.</p>
{/if}
<div class="signal-drawing" class:editable class:manual={onpanel !== undefined}>
 <div class="signal-viewport">
 <svg bind:this={svg} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
  role={editable || onpanel ? 'group' : 'img'} aria-label={onpanel ? 'Rankinis panelių jungimas' : editable ? 'Ekrano dalių drobė' : drawingLabel}
  on:pointerdown={event => start(event)} on:pointermove={move} on:pointerup={end}
  on:pointercancel={() => gesture = undefined} on:lostpointercapture={() => gesture = undefined}>
  <defs>
   {#each colors as paint, index}
    <marker id={`route-arrow-${circuitPrefix}-${index}`} markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">
     <path d="M0 0 L4 2 L0 4 Z" fill={paint} />
    </marker>
   {/each}
  </defs>
  {#each tiles as tile (tile.key)}
   {@const part = tile.part}
   {@const picked = selected.includes(part.number)}
   {@const plan = part.plan}
   <!-- svelte-ignore a11y_no_noninteractive_tabindex (editable tiles have a button role and keyboard selection) -->
   <g class:tile={editable} class:picked
    transform={`translate(${tile.x + (picked ? delta.x : 0)},${tile.y + (picked ? delta.y : 0)})`}
    role={editable && !onpanel ? 'button' : undefined} tabindex={editable && !onpanel ? 0 : undefined}
    aria-label={editable ? `Dalis ${part.number}, ${part.width} × ${part.height} px` : undefined}
    aria-pressed={editable ? picked : undefined} on:pointerdown={event => start(event, tile)} on:keydown={event => keydown(event, tile)}>
    {#if editable}
     <rect class="tile-outline" x="-0.12" y="-0.72" width={tile.width + 0.24} height={tile.height + 0.84}
      fill="#172330" stroke={picked ? '#facc6b' : activePart === part.number ? '#5eead4' : '#496479'} stroke-width="1" vector-effect="non-scaling-stroke" rx="0.12" />
     <text x="0.12" y="-0.27" fill="#e2e8f0" font-size="0.36" font-weight="700">Dalis {part.number}</text>
     {#if tile.width >= 10}
      <text x={tile.width - 0.12} y="-0.27" text-anchor="end" fill="#a3b4c7" font-size="0.32">{format.format(part.width)} × {format.format(part.height)} px · {plan.ports.length || '—'} port.</text>
     {/if}
    {/if}
     {#each unassigned(plan) as {c, r}}
      <rect x={c + 0.025} y={r * height + 0.025} width="0.95" height={height - 0.05} rx="0.055" fill="#324459" />
      {#if onpanel}<text x={c + 0.11} y={r * height + Math.min(0.22, height * 0.34)}
       fill="#cbd5e1" font-size={Math.min(0.17, height * 0.25)}>{physicalPanelNumber(screen, part, {c, r})}</text>{/if}
     {/each}
    {#each plan.ports as port (port.number)}
     {@const start = port.cells[0]}
     {@const paint = colors[(port.number - 1) % colors.length]}
     <g opacity={activePart !== part.number || focusedPort === null || focusedPort === port.number ? 1 : 0.23}>
      {#each port.cells as {c, r}}
       <rect x={c + 0.025} y={r * height + 0.025} width="0.95" height={height - 0.05}
        rx="0.055" fill={paint} fill-opacity="0.12" stroke={paint} stroke-opacity="0.48" stroke-width="0.016" />
       <text x={c + 0.11} y={r * height + Math.min(0.22, height * 0.34)}
        fill="#cbd5e1" font-size={Math.min(0.17, height * 0.25)}>{physicalPanelNumber(screen, part, {c, r})}</text>
      {/each}
      {#if port.cells.length > 1}
       <polyline points={route(port.cells, height)} fill="none" stroke={paint} stroke-width="0.047" stroke-linecap="round" stroke-linejoin="round" />
       {#each port.cells.slice(1) as cell, index}
        {@const previous = port.cells[index]}
        <line x1={(previous.c + cell.c + 1) / 2 - (cell.c - previous.c) * 0.1}
         y1={((previous.r + cell.r) / 2 + 0.56 - (cell.r - previous.r) * 0.1) * height}
         x2={(previous.c + cell.c + 1) / 2} y2={((previous.r + cell.r) / 2 + 0.56) * height}
         stroke={paint} stroke-width="0.047" marker-end={`url(#route-arrow-${circuitPrefix}-${(port.number - 1) % colors.length})`} />
       {/each}
       {#if onpanel && focusedPort === port.number}
        {@const end = port.cells[port.cells.length - 1]}
        <circle cx={end.c + 0.5} cy={(end.r + 0.56) * height} r="0.075" fill={paint} stroke="#f8fafc" stroke-width="0.028" />
       {/if}
      {/if}
      <rect x={start.c + 0.25} y={(start.r + 0.56) * height - 0.12} width="0.5" height="0.24" rx="0.09" fill={paint} />
      <text x={start.c + 0.5} y={(start.r + 0.56) * height} text-anchor="middle"
       dominant-baseline="central" fill="#10151d" font-size="0.135" font-weight="800">{circuitPrefix}{port.number}</text>
      {#if circuitPrefix === 'P' && focusedPort === port.number}
       {@const box = routeBounds(port.cells)}
       <rect x={box.left + 0.004} y={box.top * height + 0.004}
        width={box.columns - 0.008} height={box.rows * height - 0.008}
        fill="none" stroke={paint} stroke-width="0.035" stroke-dasharray="0.12 0.07" pointer-events="none" />
      {/if}
     </g>
    {/each}
    {#if onpanel}
     {#each plan.cells as cell}
      <rect class="panel-hit" x={cell.c + 0.025} y={cell.r * height + 0.025} width="0.95" height={height - 0.05}
       class:marked={panelBlock?.part === part.number && selectedCells.has(`${cell.c},${cell.r}`)}
       fill="transparent" role="button" tabindex="0" aria-label={`Panelė ${physicalPanelNumber(screen, part, cell)}`}
       on:pointerdown={event => start(event, tile, cell)}
       on:click={event => { if (!event.detail) {onpanelblock?.(null); onpanel?.(part.number, cell);} }}
       on:keydown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onpanelblock?.(null);
        onpanel?.(part.number, cell);
       }} />
     {/each}
    {/if}
    {#if panelBlock?.part === part.number && previewCells.length}
     {@const first = panelBlock.cells[0]}
     <g class="route-preview" pointer-events="none" aria-hidden="true">
      {#if previewCells.length > 1}
       <polyline points={route(previewCells, height)} fill="none" stroke="#e2fff6" stroke-width="2"
        stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      {/if}
      <circle cx={first.c + 0.5} cy={(first.r + 0.56) * height} r="0.075" fill="#e2fff6" />
     </g>
    {/if}
   </g>
  {/each}
  {#if marquee}
   <rect x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height} fill="#5eead4" fill-opacity=".13"
    stroke="#5eead4" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none" />
  {/if}
 </svg>
 </div>
 <div class="canvas-bottom"><ZoomControls percent={zoom} onchange={value => zoom = value} onfit={fitView} /></div>
</div>

<style>
 .layout-toolbar{display:flex;flex-wrap:wrap;gap:6px}
 .layout-toolbar button{padding:6px 9px;border:1px solid var(--line);background:#223044;color:#e2e8f0;font-size:12px}
 .layout-toolbar button:disabled{opacity:.45}
 .layout-toolbar button:not(:disabled):hover{background:#324459}
 .canvas-help{margin:0;font-size:12px;color:#a3b4c7}
 .signal-drawing{min-width:0;overflow:hidden;background:#10151d;border:1px solid var(--line);border-radius:8px}
 .signal-viewport{display:grid;place-items:center;min-height:200px;padding:12px;overflow:hidden}
 .signal-drawing .canvas-bottom{justify-content:flex-end}
 .signal-drawing svg{display:block;width:100%;max-height:560px}
 .editable svg,.manual svg{-webkit-tap-highlight-color:transparent}
 .editable svg{height:clamp(260px,42vh,520px);touch-action:none;user-select:none;cursor:crosshair}
 .manual svg{touch-action:none;user-select:none;cursor:crosshair}
 .tile{cursor:grab}
 .tile.picked{cursor:move}
 .panel-hit{cursor:crosshair;vector-effect:non-scaling-stroke}
 .panel-hit:hover{stroke:#fff;stroke-width:1px}
 .panel-hit.marked{fill:#66ddc846;stroke:#8ff7e5;stroke-width:2px}
 .panel-hit:focus,.tile:focus{outline:none}
 .panel-hit:focus-visible{stroke:#fff;stroke-width:2px}
 .tile:focus-visible .tile-outline{stroke:#fff;stroke-width:2}
</style>
