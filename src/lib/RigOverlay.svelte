<script lang="ts">
 import {rigDimensionInk, type RigDimensionLayout} from './rig-dimensions';

 export let layouts: RigDimensionLayout[];
 export let width: number;
 export let height: number;
</script>

<svg data-rig-overlay aria-hidden="true" class="rig-overlay" viewBox={'0 0 ' + width + ' ' + height} preserveAspectRatio="none">
 {#each layouts as layout}
  <g data-rig-axis fill="none" stroke={rigDimensionInk} stroke-width={layout.lineWidth} stroke-linejoin="round">
   {#if layout.axis}
    <line {...layout.axis} stroke-opacity=".55" stroke-dasharray={`${3 * layout.lineWidth} ${3 * layout.lineWidth}`} />
   {/if}
   {#each layout.dimensions as dimension}
    <g data-rig-mm={dimension.mm}>
     {#each dimension.lines as segment}<line {...segment} />{/each}
    </g>
   {/each}
  </g>
 {/each}
 {#each layouts as layout}
  <g font-family="Arial, sans-serif" font-weight="600" font-size={layout.fontSize} text-anchor="middle"
   dominant-baseline="central" fill={rigDimensionInk} stroke="white" stroke-opacity=".95"
   stroke-width={Math.max(1, layout.fontSize * .25)} stroke-linejoin="round" paint-order="stroke">
   {#each layout.dimensions as {label, mm}}
    <text data-rig-label={mm} x={label.x} y={label.y} transform={label.angle ? `rotate(${label.angle} ${label.x} ${label.y})` : undefined}>{label.text}</text>
   {/each}
  </g>
 {/each}
</svg>

<style>
 .rig-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;user-select:none}
</style>
