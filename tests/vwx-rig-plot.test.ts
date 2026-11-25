import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVwxRigPlot, vwxDistance } from '../src/lib/vwx-rig-plot.ts';
import type { VwxScene } from '../src/lib/vwx-types.ts';

test('native XYZ distance includes elevation, with a signed height difference in object order', () => {
	assert.deepEqual(vwxDistance([0, 0, 8], [3, 4, -4]), { xy: 5, xyz: 13, dz: -12 });
	assert.deepEqual(vwxDistance([12, 8, -12], [12, 8, 7]), { xy: 0, xyz: 19, dz: 19 });
});

test('coincident hoists have distinct labels, a zero plan distance and their real height difference', () => {
	const sample: VwxScene = {
		fileName: 'LED & <VWX>.vwx', layers: [{ id: 'vp', name: 'VP LED' }], panels: [],
		objects: [
			{ id: 'h1', name: 'M2', kind: 'hoist', layerId: 'vp', position: [1200, 1500, 55] },
			{ id: 'h2', name: 'M2', kind: 'hoist', layerId: 'vp', position: [1200, 1500, 99] }
		]
	};
	const svg = createVwxRigPlot(sample, [{ from: 'h1', to: 'h2' }, { from: 'h1', to: 'hidden' }]);
	assert.match(svg, /LED &amp; &lt;VWX&gt;/);
	assert.match(svg, /M2·2/);
	assert.match(svg, /D1 · 0 mm/);
	assert.match(svg, />44<\/text>/);
	assert.doesNotMatch(svg, /hidden|D2|NaN|Infinity/);
});

test('empty filtered scenes still have finite graphic coordinates and a scale', () => {
	const svg = createVwxRigPlot({ fileName: 'test.vwx', layers: [], objects: [], panels: [] }, []);
	assert.match(svg, /<svg/);
	assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('a panel corner and real roof-line vertex export without hoists, with their measured coordinates and levels', async () => {
	const { vwxAnchorId } = await import('../src/lib/vwx-endpoints.ts');
	const sample: VwxScene = {
		fileName: 'Roof.vwx',
		layers: [{ id: 'roof', name: 'Stogo linijos' }, { id: 'led', name: 'Ekranai' }],
		panels: [{ id: 'side', layerId: 'led', wallId: '1', model: 'XV',
			front: [[-1000, 0, 1200], [0, 0, 1200], [0, 0, 1700], [-1000, 0, 1700]],
			back: [[-1000, 80, 1200], [0, 80, 1200], [0, 80, 1700], [-1000, 80, 1700]]
		}],
		objects: [{ id: 'line', name: 'Sija A', kind: 'context', layerId: 'roof', position: [50000, 60000, 1000],
			vertices: [[-1200, 900, 0], [300, 400, 2400]] }]
	};
	const to = vwxAnchorId('vertex', 'line', 1);
	const from = vwxAnchorId('panel', 'side', 1);
	const svg = createVwxRigPlot(sample, [
		{ from, to }, { from, to: vwxAnchorId('vertex', 'hidden', 1) },
		{ from, to: vwxAnchorId('vertex', 'line', 2) }
	]);
	assert.match(svg, /D1 · 500 mm/);
	assert.doesNotMatch(svg, /D2|NaN|Infinity/);
	assert.match(svg, /1[\s\u00a0]300<\/text>/);
	assert.match(svg, /1[\s\u00a0]200<\/text>/);
	for (const label of ['P1', 'V1', 'Stogo linijos', 'Ekranai']) assert.ok(svg.includes(label));
});
