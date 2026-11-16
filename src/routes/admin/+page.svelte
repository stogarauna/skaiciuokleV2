<script lang="ts">
 import {equipmentFields,equipmentKeys} from '$lib/mounting';
 import PanelForm from './PanelForm.svelte';
 import type {ActionData,PageData} from './$types';
 export let data:PageData;
 export let form:ActionData;
 let query='';
 const f=(n:number)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:3}).format(n);
 $: panels=data.signedIn?data.catalog.panels.filter(panel=>panel.name.toLowerCase().includes(query.trim().toLowerCase())):[];
</script>

<svelte:head><title>Administravimas · LED Studija</title></svelte:head>

<main class="admin">
 <header>
  <a href="/" class="button secondary">← Projektavimas</a>
  {#if data.signedIn}<div class="admin-actions"><a href="/admin/naudojimas" class="button secondary">Naudojimo statistika</a><form method="POST" action="?/logout"><button class="secondary" type="submit">Atsijungti</button></form></div>{/if}
 </header>
 {#if data.signedIn}
  <h1>Administravimas</h1>
  <p class="intro">Nauji projektai naudoja katalogo duomenis. Esamuose projektuose katalogas užpildo trūkstamus montavimo įrangos svorius. Jau įrašyti svoriai ir panelių specifikacijos lieka projekto kopijoje.</p>
  {#if !data.writable}<p class="notice" role="alert">Katalogo saugykla nesukonfigūruota.</p>{/if}
  {#if form?.message}<p class="notice" class:success={'saved' in form} role={'saved' in form?'status':'alert'}>{form.message}</p>{/if}
  {#key data.revision}
   <section class="card" aria-labelledby="equipment-heading">
    <h2 id="equipment-heading">Montavimo įranga</h2>
    <form method="POST" action="?/equipment">
     <input type="hidden" name="revision" value={data.revision} />
     <fieldset disabled={!data.writable}>
      <div class="grid">
       {#each equipmentKeys as key}
        <label class="field">{equipmentFields[key].name}, {equipmentFields[key].unit}<input name={key} inputmode="decimal" value={String(data.catalog.equipmentWeights[key]??'').replace('.',',')} /></label>
       {/each}
      </div>
      <button class="primary" type="submit">Išsaugoti įrangą</button>
     </fieldset>
    </form>
   </section>
   <section class="card" aria-labelledby="panels-heading">
    <div class="section-header">
     <h2 id="panels-heading">Panelės <span>{data.catalog.panels.length}</span></h2>
     <input aria-label="Ieškoti panelių" placeholder="Ieškoti modelio" bind:value={query} />
    </div>
    <p class="help">Atverkite modelį, kad pamatytumėte ir galėtumėte pakeisti jo parametrus bei pakabinimo rėmų svorius.</p>
    {#each panels as panel (panel.name)}
     <details>
      <summary><strong>{panel.name}</strong><span>{f(panel.widthM*1000)} × {f(panel.heightM*1000)}{panel.depthM? ` × ${f(panel.depthM*1000)}`:''} mm · {panel.resX} × {panel.resY} px</span></summary>
      <PanelForm model={panel} revision={data.revision} writable={data.writable} />
     </details>
    {/each}
    {#if !panels.length}<p class="help">Modelių nerasta.</p>{/if}
    <details class="new-model"><summary>＋ Naujas modelis</summary><PanelForm revision={data.revision} writable={data.writable} /></details>
   </section>
  {/key}
 {:else}
  <section class="card login">
   <h1>Administravimas</h1>
   {#if data.configured}
    <form method="POST" action="?/login">
     <label class="field">Prisijungimo vardas<input name="username" value="admin" required maxlength="32" autocomplete="username" /></label>
     <label class="field">Slaptažodis<input name="password" type="password" required maxlength="256" autocomplete="current-password" /></label>
     {#if form?.message}<p class="notice" role="alert">{form.message}</p>{/if}
     <button class="primary" type="submit">Prisijungti</button>
    </form>
   {:else}
    <p class="notice" role="alert">Administratoriaus prisijungimas dar nesukonfigūruotas.</p>
   {/if}
  </section>
 {/if}
</main>

<style>
 .admin{width:min(100% - 32px,1050px);margin:0 auto;padding:28px 0 52px}
 header,.section-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
 header{margin-bottom:28px}
 .admin-actions{display:flex;flex-wrap:wrap;gap:8px}
 h1{font-size:clamp(23px,4vw,34px);margin:0 0 10px}
 h2{font-size:20px;margin:0 0 14px}
 h2 span,.intro,summary span{color:#a0afbc}
 h2 span{font-size:14px;margin-left:5px}
 .intro{margin:0 0 20px}
 .card{background:#1b222c;border:1px solid #354352;border-radius:10px;padding:clamp(16px,3vw,24px);margin-bottom:18px}
 .login{max-width:430px;margin:12vh auto 0}
 .login h1{margin-bottom:24px}
 .login button{width:100%}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 16px}
 fieldset{margin:0;padding:0;border:0;min-width:0}
 .notice{font-size:13px;color:#f4b85b}
 .success{color:#6cddc9}
 details{border-top:1px solid #354352}
 summary{cursor:pointer;padding:12px 0;line-height:1.5}
 summary span{display:inline-block;margin-left:12px;font-size:12px}
 details[open]{padding-bottom:16px}
 .new-model{color:#6cddc9}
 .section-header input{padding:9px 12px;background:#121922;border:1px solid #354352;border-radius:6px;color:#edf4fa;max-width:100%}
</style>
