<script lang="ts">
 import {panelFields} from '$lib/catalog-fields';
 import type {Panel} from '$lib/project';
 export let model:Panel|null=null;
 export let revision:string;
 export let writable:boolean;
 let fixed=model?.bendAngleText==='Nesilenkia';
 const angleText=(value:unknown)=>Array.isArray(value)?value.join('; '):typeof value==='number'?String(value):'';
</script>

<form method="POST" action="?/panel">
 <input type="hidden" name="revision" value={revision} />
 <input type="hidden" name="original" value={model?.name??''} />
 <fieldset disabled={!writable}>
  <label class="field">Modelio pavadinimas<input name="name" required maxlength="120" value={model?.name??''} /></label>
  <div class="catalog-fields">
   {#each panelFields as field}
    <label class="field">{field.label}<input name={field.key} type="number" min={field.min} max={field.max} step={'integer' in field?1:'any'} required={field.required} value={model?.[field.key]??''} /></label>
   {/each}
  </div>
  <label class="checkbox"><input type="checkbox" name="fixed" bind:checked={fixed} /> Panelės nesilenkia</label>
  {#if !fixed}
   <div class="catalog-fields">
    <label class="field">Min. kampas, °<input name="bendAngleMinDeg" maxlength="120" value={angleText(model?.bendAngleMinDeg)} /></label>
    <label class="field">Maks. kampas, °<input name="bendAngleMaxDeg" maxlength="120" value={angleText(model?.bendAngleMaxDeg)} /></label>
    <label class="field">Atskiras katalogo kampas, °<input name="bendAngleDeg" type="number" min="-90" max="90" step="any" value={angleText(model?.bendAngleDeg)} /></label>
   </div>
   <p class="help">Kelioms kampo reikšmėms atskirti naudokite kabliataškį.</p>
  {/if}
  <button class="primary" type="submit">{model?'Išsaugoti panelę':'Pridėti panelę'}</button>
 </fieldset>
</form>

<style>
 fieldset{border:0;padding:0;margin:0;min-width:0}
 .catalog-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 14px}
 .checkbox{display:flex;align-items:center;gap:8px;margin:10px 0 18px;color:var(--muted,#a9b9c7);font-size:13px}
 .checkbox input{accent-color:#64d8c7}
 .primary{margin-top:8px}
</style>
