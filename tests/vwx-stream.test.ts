import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readVwxBlocks} from '../src/lib/vwx-stream.ts';

function framed(blocks: number[][], unit = 'mm') {
	const offset = 132, size = 512;
	const header = new Uint8Array(offset + size);
	const view = new DataView(header.buffer);
	view.setUint32(0, size);
	view.setUint32(8, offset);
	view.setUint32(offset, size, true);
	header.set(new TextEncoder().encode('VW23.0.0 VW32.1.0'), 14);
	for (let i = 0; i < unit.length; i++) view.setUint16(offset + 348 + 2 * i, unit.charCodeAt(i), true);
	const frames = blocks.map((block) => {
		const bytes = new Uint8Array(4 + block.length);
		new DataView(bytes.buffer).setUint32(0, block.length, true);
		bytes.set(block, 4);
		return bytes;
	});
	return new Blob([header, ...frames]);
}

async function decode(file: Blob) {
	const parts = [];
	for await (const bytes of readVwxBlocks(file)) parts.push(Buffer.from(bytes));
	return Buffer.concat(parts);
}

test('VWX streams variable-size blocks and expands all three copy encodings, including overlap', async () => {
	const literals = Array.from({length: 80}, (_, i) => i);
	const file = framed([[16, 4, 65, 66, 1, 2, 14, 2, 0, 23, 2, 0, 0, 0], [80, 240, 79, ...literals]]);
	assert.deepEqual(await decode(file), Buffer.concat([Buffer.from('AB'.repeat(8)), Buffer.from(literals)]));
});

test('VWX rejects incomplete framing, impossible copy offsets and misplaced length units', async () => {
	const complete = framed([[1, 0, 42]]);
	await assert.rejects(decode(complete.slice(0, -1)), /nepilnas/);
	await assert.rejects(decode(framed([[4, 1, 1]])), /nepilnas/);
	await assert.rejects(decode(framed([[4, 0, 65]])), /nepilnas/);
	await assert.rejects(decode(framed([[1, 0, 42]], 'cm')), /milimetrų/);
	await assert.rejects(decode(new Blob(['random'])), /formatas/);
});

test('VWX honors cancellation between blocks', async () => {
	const controller = new AbortController();
	const reader = readVwxBlocks(framed([[1, 0, 65], [1, 0, 66]]), undefined, controller.signal);
	assert.equal((await reader.next()).value?.[0], 65);
	controller.abort();
	await assert.rejects(reader.next(), {name: 'AbortError'});
});
