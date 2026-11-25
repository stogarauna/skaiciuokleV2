<script lang="ts">
 import type {RigAxis} from './drawing-project';

 type Colour = 'blue' | 'red';
 type Tool = 'idle' | 'place' | 'lane' | 'points';
 const colours: Colour[] = ['blue', 'red'];
 const labels = {blue: 'Mėlyni', red: 'Raudoni'};

 export let marksCount: number;
 export let counts: Record<Colour, number>;
 export let colors: Record<Colour, boolean>;
 export let axes: RigAxis[];
 export let activeId: string;
 export let tool: Tool;
 export let scale: number;
 export let toggleColor: (colour: Colour) => void;
 export let createAxis: (orientation: 'vertical' | 'horizontal') => void;
 export let selectAxis: (id: string) => void;
 export let setTool: (tool: Tool) => void;
 export let removeAxis: () => void;
 export let setAll: (all: boolean) => void;

 $: hasActive = axes.some(axis => axis.id === activeId);
</script>

<div data-rig-controls class="rig-controls">
 {#if counts.blue || counts.red}
  <div class="row" role="group" aria-label="Atpažintų taškų spalvos">
   <span class="field-name">Atpažinti simboliai</span>
   {#each colours as colour}
    {#if counts[colour]}
     <label class="toggle">
      <input type="checkbox" data-rig-color={colour} checked={colors[colour]} on:change={() => toggleColor(colour)} />
      <span class="symbol" class:red={colour === 'red'} aria-hidden="true"></span>
      {labels[colour]} ({counts[colour]})
     </label>
    {/if}
   {/each}
  </div>
 {/if}
 <div class="row" role="group" aria-label="Pridėti stogo konstrukcijos ašį">
  <span class="field-name">Pridėti ašį</span>
  <button type="button" data-rig-create="vertical" on:click={() => createAxis('vertical')}>
   <span aria-hidden="true">↕</span> Vertikali
  </button>
  <button type="button" data-rig-create="horizontal" on:click={() => createAxis('horizontal')}>
   <span aria-hidden="true">↔</span> Horizontali
  </button>
 </div>
 {#if axes.length}
  <div class="row">
   <label class="axis-choice"><span class="field-name">Stogo ašis</span>
    <select data-rig-axis-select value={activeId} on:change={e => selectAxis(e.currentTarget.value)}>
     {#each axes as axis, i}
      <option value={axis.id}>{i + 1} · {axis.orientation === 'vertical' ? 'Vertikali' : 'Horizontali'}</option>
     {/each}
    </select>
   </label>
   {#if hasActive}
    <button type="button" data-rig-tool="place" aria-pressed={tool === 'place'} on:click={() => setTool(tool === 'place' ? 'idle' : 'place')}>Perkelti ašį</button>
    <button type="button" data-rig-tool="lane" aria-pressed={tool === 'lane'} on:click={() => setTool(tool === 'lane' ? 'idle' : 'lane')}>Perkelti matmenis</button>
    <button type="button" data-rig-tool="points" aria-pressed={tool === 'points'} on:click={() => setTool(tool === 'points' ? 'idle' : 'points')}>Parinkti taškus</button>
    <button type="button" data-rig-remove class="remove" on:click={removeAxis}>Trinti ašį</button>
   {/if}
  </div>
 {/if}
 {#if tool !== 'idle'}
  <div class="row" role="group" aria-label="Žymėjimas plane">
   <small role="status">
    {#if tool === 'place'}Spustelėkite stogo konstrukcijos ašį plane.
    {:else if tool === 'lane'}Spustelėkite ten, kur norite išdėstyti matmenų linijas.
    {:else}Spustelėję tašką įtrauksite jį į šios ašies matmenis arba iš jų pašalinsite.{/if}
   </small>
   {#if tool === 'points' && marksCount}
    <button type="button" data-rig-all="true" on:click={() => setAll(true)}>Visi taškai</button>
    <button type="button" data-rig-all="false" on:click={() => setAll(false)}>Nė vieno</button>
   {/if}
   <button type="button" data-rig-tool="idle" on:click={() => setTool('idle')}>{tool === 'points' ? 'Baigti' : 'Atšaukti'}</button>
  </div>
 {/if}
 {#if !scale}<small>Kad matmenys būtų rodomi milimetrais, nustatykite plano mastelį.</small>{/if}
</div>

<style>
 .rig-controls{display:grid;gap:.45rem}
 .row,.axis-choice,.toggle{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
 .field-name,.toggle,.axis-choice{font-size:.85rem;font-weight:600}
 .toggle{cursor:pointer;background:#1e2a36;border:1px solid #425366;border-radius:5px;padding:.25rem .45rem}
 .toggle input{width:1rem;height:1rem;margin:0;accent-color:#73dfcf}
 .symbol{width:.8rem;height:.8rem;border-radius:50%;background:conic-gradient(#365da7 0 25%,white 0 50%,#365da7 0 75%,white 0);border:1px solid #b9c7d8}
 .symbol.red{background:conic-gradient(#b32834 0 25%,white 0 50%,#b32834 0 75%,white 0)}
 button,select{color:#edf3f8;background:#263340;border:1px solid #526376;border-radius:5px;font:inherit;font-size:.82rem;padding:.35rem .55rem}
 button{cursor:pointer}button:hover,button:focus-visible,select:focus-visible{border-color:#86cfc2}
 button[aria-pressed="true"]{background:#72dece;color:#102422;border-color:#72dece}
 .row .remove{color:#ffb8b3}
 small{color:#c0cedb}
</style>
