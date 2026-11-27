export type VwxVisibility = 'visible' | 'hidden' | 'grey';

const decoder = new TextDecoder('utf-16le');

function visibilityAt(record: DataView, offset: number): VwxVisibility | undefined {
	if (offset + 2 > record.byteLength) return;
	switch (record.getInt16(offset, true)) {
		case -1: return 'hidden';
		case 0: return 'visible';
		case 2: return 'grey';
	}
}

export function vwxLayerVisibility(record: DataView) {
	return visibilityAt(record, 216);
}

export function vwxClassId(record: DataView): string | undefined {
	if (record.byteLength < 36) return;
	const index = record.getUint32(32, true);
	return index ? `class-${index}` : undefined;
}

// The shared name directory also holds symbols, hatches and record formats.
// Only a class definition identifies a name as a class, even an unused one.
export function createVwxClassIndex() {
	const names = new Map<number, string>();
	const classes = new Map<number, VwxVisibility | undefined>();
	return {
		resourceName(id: number) {
			return names.get(id);
		},
		visit(type: number, record: DataView) {
			if (type === 94 && record.byteLength >= 30) {
				const id = record.getUint32(26, true);
				if (id) classes.set(id, visibilityAt(record, 182));
				return;
			}
			if (type !== 55 || record.byteLength < 92) return;
			const count = record.getUint32(88, true);
			let offset = 92;
			if (count > Math.floor((record.byteLength - offset) / 8)) return;
			for (let i = 0; i < count; i++) {
				if (offset + 8 > record.byteLength) return;
				const id = record.getUint32(offset, true);
				const length = record.getUint32(offset + 4, true);
				offset += 8;
				if (length % 2 || length > record.byteLength - offset) return;
				if (id && length) {
					const bytes = new Uint8Array(record.buffer, record.byteOffset + offset, length);
					const name = decoder.decode(bytes);
					if (name.trim()) names.set(id, name);
				}
				offset += length;
			}
		},
		list() {
			return Array.from(classes).flatMap(([index, nativeVisibility]) => {
				const name = names.get(index);
				return name ? [{ id: `class-${index}`, name, ...(nativeVisibility && { nativeVisibility }) }] : [];
			});
		}
	};
}
