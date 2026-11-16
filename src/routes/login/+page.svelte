<script lang="ts">import type {PageData,ActionData} from './$types';export let data:PageData;export let form:ActionData;</script>
<svelte:head><title>Prisijungimas · LED Studija</title><meta name="robots" content="noindex" /></svelte:head>
<main><section><div class="brand">▥ LED STUDIJA</div><h1>Prisijungti</h1><p>Ekranų projektavimas ir komutacija</p>
<form method="POST"><label>Vartotojo vardas<input name="username" value={form?.username??''} autocomplete="username" required maxlength="32" /></label><label>Slaptažodis<input name="password" type="password" autocomplete="current-password" required maxlength="256" /></label>
{#if form?.message}<p role="alert">{form.message}</p>{/if}
{#if !data.configured}<p role="alert">Prisijungimas dar nesukonfigūruotas.</p>{/if}
<button class="primary" disabled={!data.configured}>Prisijungti →</button></form><small>Paskyrą suteikia jūsų administratorius.</small></section></main>
<style>main{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at top,#203b40,#10151d 65%)}section{width:100%;max-width:410px;padding:36px;background:#1b222c;border:1px solid #354352;border-radius:16px}.brand{color:#6cddc9;font-weight:700;letter-spacing:.15em;margin-bottom:32px}h1{font-size:30px;margin-bottom:8px}p,small{color:#a0afbc}form{margin:28px 0}label{display:block;margin:18px 0;font-size:14px}input{display:block;width:100%;margin-top:8px;padding:12px;background:#121922;border:1px solid #455565;border-radius:6px;color:#edf4fa}button{width:100%;padding:12px}[role=alert]{color:#f4b85b}</style>
