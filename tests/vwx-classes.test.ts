import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVwxClassIndex, vwxClassId, vwxLayerVisibility } from '../src/lib/vwx-classes.ts';

test('uses declarations to distinguish an unused class from other named resources', () => {
	const index = createVwxClassIndex();
	const declaration = new DataView(new ArrayBuffer(188));
	declaration.setUint32(26, 17, true);
	declaration.setInt16(182, -1, true);
	index.visit(94, declaration);
	const entries = [[12, 'Symbol'], [17, 'Šviesa']] as const;
	const directory = Buffer.alloc(92 + entries.reduce((n, [, name]) => n + 8 + name.length * 2, 0));
	directory.writeUInt32LE(entries.length, 88);
	let offset = 92;
	for (const [id, name] of entries) {
		directory.writeUInt32LE(id, offset);
		directory.writeUInt32LE(name.length * 2, offset + 4);
		offset += 8 + directory.write(name, offset + 8, 'utf16le');
	}
	index.visit(55, new DataView(directory.buffer, directory.byteOffset, directory.length));
	assert.deepEqual(index.list(), [{ id: 'class-17', name: 'Šviesa', nativeVisibility: 'hidden' }]);
	const object = new DataView(new ArrayBuffer(218));
	object.setUint32(32, 17, true);
	object.setInt16(216, 2, true);
	assert.equal(vwxClassId(object), 'class-17');
	assert.equal(vwxLayerVisibility(object), 'grey');
});
