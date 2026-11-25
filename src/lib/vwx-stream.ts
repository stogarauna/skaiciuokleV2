// VWX uses a document header followed by little-endian lengths and raw Snappy blocks.
// Limit peak memory to a block at a time, including when reading a several-hundred-MB File.
const headerLimit = 1024 * 1024;
const maxBlockBytes = 128 * 1024 * 1024;
const maxCompressedBytes = maxBlockBytes + Math.ceil(maxBlockBytes / 6) + 32;
const damaged = () => new Error('VWX failas nepilnas arba jo duomenys sugadinti.');
const unsupported = () => new Error('Neatpažintas VWX formatas. Palaikomi „Vectorworks 2027“ VWX failai su milimetrų vienetais.');

async function dataStart(file: Blob) {
	const prefix = new Uint8Array(await file.slice(0, 148).arrayBuffer());
	if (prefix.length < 64) throw unsupported();
	const version = new TextDecoder('ascii').decode(prefix.subarray(14, 64));
	if (!/^VW\d+\.\d+\.\d+ VW32\.\d+\.\d+\x00/.test(version)) throw unsupported();
	const view = new DataView(prefix.buffer);
	const size = view.getUint32(0);
	const offset = view.getUint32(8);
	if (offset < 32 || size < 356 || offset + size > headerLimit || offset + size + 4 > file.size) throw damaged();
	const header = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
	if (new DataView(header.buffer).getUint32(0, true) !== size) throw unsupported();
	// The primary length-unit abbreviation precedes the area, volume and secondary unit fields.
	const unit = new TextDecoder('utf-16le').decode(header.subarray(348, 356)).split('\0')[0].trim();
	if (unit.toLowerCase() !== 'mm') throw unsupported();
	return offset + size;
}

function decompressBlock(input: Uint8Array) {
	let pos = 0;
	let expected = 0;
	let shift = 0;
	let byte: number;
	do {
		if (pos >= input.length || pos >= 5) throw damaged();
		byte = input[pos++];
		expected += (byte & 0x7f) * 2 ** shift;
		shift += 7;
	} while (byte >= 128);
	if (expected > maxBlockBytes) throw new Error('VWX duomenų blokas per didelis šiai peržiūrai.');
	if (expected === 0 || expected > input.length * 32) throw damaged();

	const output = new Uint8Array(expected);
	let written = 0;
	while (pos < input.length) {
		const tag = input[pos++];
		const kind = tag & 3;
		let length = tag >>> 2;
		if (kind === 0) {
			if (length >= 60) {
				const bytes = length - 59;
				if (pos + bytes > input.length) throw damaged();
				length = 0;
				for (let i = 0; i < bytes; i++) length += input[pos++] * 2 ** (8 * i);
			}
			length++;
			if (length > input.length - pos || length > expected - written) throw damaged();
			output.set(input.subarray(pos, pos + length), written);
			pos += length;
			written += length;
			continue;
		}
		let offset: number;
		if (kind === 1) {
			if (pos >= input.length) throw damaged();
			offset = ((tag & 0xe0) << 3) + input[pos++];
			length = 4 + (length & 7);
		} else {
			const bytes = kind === 2 ? 2 : 4;
			if (pos + bytes > input.length) throw damaged();
			offset = input[pos++] + 256 * input[pos++];
			if (bytes === 4) offset += 65536 * input[pos++] + 16777216 * input[pos++];
			length++;
		}
		if (!offset || offset > written || length > expected - written) throw damaged();
		// Snappy permits overlapping references. Newly written bytes are immediately readable.
		const end = written + length;
		while (written < end) {
			output[written] = output[written - offset];
			written++;
		}
	}
	if (written !== expected) throw damaged();
	return output;
}

export async function* readVwxBlocks(
	file: Blob,
	onProgress?: (percent: number) => void,
	signal?: AbortSignal
): AsyncGenerator<Uint8Array> {
	signal?.throwIfAborted();
	let offset = await dataStart(file);
	let lastPercent = 0;
	onProgress?.(0);
	while (offset < file.size) {
		signal?.throwIfAborted();
		const prefix = await file.slice(offset, offset + 4).arrayBuffer();
		if (prefix.byteLength !== 4) throw damaged();
		const size = new DataView(prefix).getUint32(0, true);
		offset += 4;
		if (!size || size > file.size - offset) throw damaged();
		if (size > maxCompressedBytes) throw new Error('VWX duomenų blokas per didelis šiai peržiūrai.');
		const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
		signal?.throwIfAborted();
		const block = decompressBlock(bytes);
		offset += size;
		yield block;
		const percent = Math.floor(100 * offset / file.size);
		if (percent > lastPercent) onProgress?.(percent);
		lastPercent = percent;
	}
}
