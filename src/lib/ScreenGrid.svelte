<script lang="ts">
 import {cabinetPositions} from './mixed-panels';
 import type {Screen} from './project';

 export let screen:Screen;
 export let selected:boolean, numbers:boolean, projectView:boolean;
 export let tool:'select'|'edit'|'size';
 export let pending:{id:string;c:number;r:number}|null;
 export let ondrag:(event:PointerEvent,screen:Screen)=>void;
 export let oncell:(id:string,c:number,r:number,span:number,off:boolean)=>void;

 function displayCells(s:Screen,editing:boolean){
  const cells=cabinetPositions(s).map(({c,r,span,number})=>({c,r,span,number,off:false}));
  if(editing||!s.mixed){
   for(const key of s.removed){
    const [c,r]=key.split(',').map(Number);
    cells.push({c,r,span:1,number:r*s.cols+c+1,off:true});
   }
  }
  return cells;
 }
 $: cells=displayCells(screen,tool==='edit');
</script>

{#each cells as cell (cell.r+','+cell.c)}
 {@const {c,r,span,number,off}=cell}
 {@const width=screen.panel.widthM*span}
 {@const focused=pending?.id===screen.id&&pending.c===c&&pending.r===r&&tool==='size'}
 {@const label=off?`panelė ${number}, pašalinta`:`panelė ${number}${screen.mixed?', '+((screen.panel.widthM*span).toLocaleString('lt-LT')+' m'):''}`}
 <g class="panel-cell" role="button" tabindex="0" aria-label={`${screen.name}, ${label}`}
  on:pointerdown={e=>{if(e.button!==0)return;e.preventDefault();if(tool==='select')ondrag(e,screen);else oncell(screen.id,c,r,span,off);}}
  on:keydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();oncell(screen.id,c,r,span,off);}}}
  style={`cursor:${tool==='select'?(projectView?'grab':'pointer'):'crosshair'}`}>
  <rect x={c*screen.panel.widthM+0.008} y={r*screen.panel.heightM+0.008} width={width-0.016} height={screen.panel.heightM-0.016} rx="0.018"
   fill={off?'#141c26':screen.mixed&&span===1?'#2c4c63':'url(#panel-fill)'}
   stroke={off?'#344254':selected?'#4c9b9c':'#456071'} stroke-width="0.009" stroke-dasharray={off?'0.04 0.03':undefined}/>
  {#if focused}<rect data-size-selection x={c*screen.panel.widthM+0.014} y={r*screen.panel.heightM+0.014}
   width={width-0.028} height={screen.panel.heightM-0.028} rx="0.014" fill="#775e2f" stroke="#ffd479" stroke-width="0.018" pointer-events="none"/>{/if}
  {#if numbers&&!off}<text x={(c+span/2)*screen.panel.widthM} y={(r+0.5)*screen.panel.heightM+0.025} text-anchor="middle" fill="#a1c4cb" font-family="Arial,sans-serif" font-size="0.085" pointer-events="none">{number}</text>{/if}
  {#if off&&tool==='edit'}<text x={(c+0.5)*screen.panel.widthM} y={(r+0.5)*screen.panel.heightM+0.04} text-anchor="middle" fill="#657689" font-size="0.15" pointer-events="none">+</text>{/if}
 </g>
{/each}
