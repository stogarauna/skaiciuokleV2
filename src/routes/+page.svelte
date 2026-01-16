<script lang="ts">
	export let data: { panels: unknown };

	// Tipai LED panelių objektams
	interface Panel {
		name: string;
		resX: number; resY: number;
		widthM: number; heightM: number;
		power: number; weightKg: number;
		depthM: number | null;
		bendAngleText?: string; // jei Excel'e reikšmė "nesilenkia", rodome tekstą
		bendAngleDeg?: number | null; // senas vienos reikšmės formatas (gali nebebūti)
		bendAngleMinDeg?: number | number[]; // naujas – minimalus kampas (viena arba kelios reikšmės)
		bendAngleMaxDeg?: number | number[]; // naujas – maksimalus kampas (viena arba kelios reikšmės)
		frameHeightM: number | null;
		frameHeightMinM?: number; // naujas – minimali rėmo aukščio reikšmė (m)
		frameHeightMaxM?: number; // naujas – maksimali rėmo aukščio reikšmė (m)
	}

	const typedPanels: Panel[] = (data.panels ?? []) as Panel[];

	let selected: Panel = typedPanels[0];
	let width = 1;
	let height = 1;
	// rankinio parametrų redagavimo UI pašalintas pagal užklausą

	// (pašalinta dubliuota pradinių kintamųjų deklaracija, žr. typedPanels/selected aukščiau)

	// derived values
	$: totalPanels = width * height;

	// total resolution
	$: totalWidthPx = width * selected.resX;
	$: totalHeightPx = height * selected.resY;
	$: resolutionText = `${totalWidthPx} × ${totalHeightPx}`;

	// (pašalinta): Aspect ratio ir total pixels nenaudojami pagal naują UI

	// physical dimensions
	$: totalWidthM = width * selected.widthM;
	$: totalHeightM = height * selected.heightM;
	$: totalArea = totalWidthM * totalHeightM;

	// power and weight
	$: totalPower = totalPanels * selected.power;
	$: totalWeight = totalPanels * selected.weightKg;

	// smart formatting
	$: powerDisplay =
		totalPower >= 1000
			? `${(totalPower / 1000).toFixed(2)} kW`
			: `${totalPower.toFixed(0)} W`;

	$: weightDisplay =
		totalWeight >= 1000
			? `${(totalWeight / 1000).toFixed(2)} t`
			: `${totalWeight.toFixed(1)} kg`;

	// papildomi modulio parametrai (saugus formatavimas)
	$: moduleWidthDisplay = `${selected.widthM.toFixed(2)} m`;
	$: moduleHeightDisplay = `${selected.heightM.toFixed(2)} m`;
	$: depthDisplay =
		selected.depthM !== null && selected.depthM !== undefined ? `${selected.depthM.toFixed(3)} m` : "—";
	// Pagalbinė: gudrus ilgio formatavimas – jei < 1 m, rodom cm, kitaip m
	function formatLengthSmart(meters: number): string {
		if (meters < 1) {
			const cm = meters * 100;
			const isInt = Math.abs(cm - Math.round(cm)) < 1e-6;
			return isInt ? `${Math.round(cm)} cm` : `${cm.toFixed(1)} cm`;
		}
		return `${meters.toFixed(2)} m`;
	}
	// Lenkimo kampo rodymas: jei turime diapazoną – rodome min…max; jei vieną reikšmę – ją; jei nėra – em dash.
	function formatSigned(n: number): string {
		return n > 0 ? `+${n}` : `${n}`; // neigiami jau turi '-'
	}
	function toArray(val: number | number[] | undefined | null): number[] {
		if (val === null || val === undefined) return [];
		return Array.isArray(val) ? val : [val];
	}
	$: bendDisplay = (() => {
		if (selected.bendAngleText && selected.bendAngleText.trim() !== '') {
			return selected.bendAngleText;
		}
		const mins = toArray(selected.bendAngleMinDeg);
		const maxs = toArray(selected.bendAngleMaxDeg);
		if (mins.length || maxs.length) {
			const len = Math.max(mins.length, maxs.length);
			const pairs: string[] = [];
			for (let i = 0; i < len; i++) {
				const minStr = mins[i] !== undefined ? `${formatSigned(mins[i])}°` : '—';
				const maxStr = maxs[i] !== undefined ? `${formatSigned(maxs[i])}°` : '—';
				pairs.push(`${minStr}; ${maxStr}`);
			}
			return pairs.join(' | ');
		}
		if (selected.bendAngleDeg !== null && selected.bendAngleDeg !== undefined) {
			return `${formatSigned(selected.bendAngleDeg)}°`;
		}
		return '—';
	})();
	$: frameHeightDisplay = (() => {
		if (selected.frameHeightMinM !== undefined && selected.frameHeightMaxM !== undefined) {
			return `${formatLengthSmart(selected.frameHeightMinM)}; ${formatLengthSmart(selected.frameHeightMaxM)}`;
		}
		if (selected.frameHeightM !== null && selected.frameHeightM !== undefined) {
			return `${formatLengthSmart(selected.frameHeightM as number)}`;
		}
		return "—";
	})();
</script>

<section class="space-y-5">
	<!-- Panel selector -->
	<div class="bg-white p-5 rounded-2xl shadow-md">
		<div style="display:block;width:100%">
			<label for="panelSelect" class="font-semibold text-gray-700 mb-1" style="display:block">LED panelės tipas:</label>
			<select
				id="panelSelect"
				bind:value={selected}
				class="w-full border border-gray-300 rounded-xl p-3 text-gray-700 focus:ring-2 focus:ring-blue-500"
			>
				{#each typedPanels as panel}
					<option value={panel}>{panel.name}</option>
				{/each}
			</select>
		</div>

		<!-- Papildomi pasirinkto modulio parametrai (nurodyta eilės tvarka) -->
		<div class="mt-3 grid grid-cols-1 gap-1 text-gray-700 text-sm">
			<p><strong>Modulio plotis:</strong> {moduleWidthDisplay}</p>
			<p><strong>Modulio aukštis:</strong> {moduleHeightDisplay}</p>
			<p><strong>Modulio gylis:</strong> {depthDisplay}</p>
			<p><strong>Lenkimo kampas:</strong> {bendDisplay}</p>
			<p><strong>Statymo rėmo aukštis:</strong> {frameHeightDisplay}</p>
		</div>


	</div>

	<!-- Size inputs -->
	<div class="bg-white p-5 rounded-2xl shadow-md grid grid-cols-2 gap-4">
		<div>
			<label for="widthInput" class="block mb-1 font-semibold text-gray-700">
				Plotis (modulių)
			</label>
			<div class="flex items-center gap-2">
				<button type="button" aria-label="Mažinti plotį" class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center select-none active:bg-gray-300" on:click={() => width = Math.max(1, width - 1)}>-</button>
				<input
					id="widthInput"
					type="number"
					min="1"
					bind:value={width}
					on:input={(e: Event) => { const target = e.target as HTMLInputElement; width = Math.max(1, parseInt(target.value) || 1); }}
					class="border border-gray-300 rounded-xl p-3 text-center focus:ring-2 focus:ring-blue-500"
					style="width: 4.5rem; min-width: 0;"
				/>
				<button type="button" aria-label="Didinti plotį" class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center select-none active:bg-gray-300" on:click={() => width = width + 1}>+</button>
			</div>
		</div>

		<div>
			<label for="heightInput" class="block mb-1 font-semibold text-gray-700">
				Aukštis (modulių)
			</label>
			<div class="flex items-center gap-2">
				<button type="button" aria-label="Mažinti aukštį" class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center select-none active:bg-gray-300" on:click={() => height = Math.max(1, height - 1)}>-</button>
				<input
					id="heightInput"
					type="number"
					min="1"
					bind:value={height}
					on:input={(e: Event) => { const target = e.target as HTMLInputElement; height = Math.max(1, parseInt(target.value) || 1); }}
					class="border border-gray-300 rounded-xl p-3 text-center focus:ring-2 focus:ring-blue-500"
					style="width: 4.5rem; min-width: 0;"
				/>
				<button type="button" aria-label="Didinti aukštį" class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center select-none active:bg-gray-300" on:click={() => height = height + 1}>+</button>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div class="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5 rounded-2xl shadow-md space-y-2">
		<p><strong>Modulių skaičius:</strong> {totalPanels}</p>
		<p><strong>Rezoliucija:</strong> {resolutionText}</p>
		<!-- Aspect Ratio ir Total Pixels pašalinti pagal užklausą -->
		<p>
			<strong>Sienos dydis:</strong> {totalWidthM.toFixed(2)} m × {totalHeightM.toFixed(2)} m
		</p>
		<p><strong>Bendras plotas:</strong> {totalArea.toFixed(2)} m²</p>
		<p><strong>Bendra galia:</strong> {powerDisplay}</p>
		<p><strong>Bendras svoris:</strong> {weightDisplay}</p>
	</div>
</section>

<!-- Link to image page -->
<div class="mt-5">
	<a href="/paveiksliukas" class="inline-block bg-indigo-600 text-white px-4 py-2 rounded-xl shadow hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500">Peržiūrėti paveikslėlį</a>
	<p class="text-gray-500 text-sm mt-2">Įkelkite PNG failą į <code>static/panel.png</code>.</p>
</div>
