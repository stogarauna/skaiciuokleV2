import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// The viewer and its worker load only when a drawing PDF is opened. Keep their
// supplementary fonts, CMaps and image decoders on the same origin and version.
const require = createRequire(import.meta.url);
const pdfPackage = require.resolve('pdfjs-dist/package.json');
const pdfSource = dirname(pdfPackage);
const pdfTarget = join('static', 'pdfjs', require(pdfPackage).version);
mkdirSync(pdfTarget, { recursive: true });
for (const asset of ['cmaps', 'iccs', 'standard_fonts', 'wasm', 'LICENSE']) {
	cpSync(join(pdfSource, asset), join(pdfTarget, asset), { recursive: true });
}
for (const module of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
	cpSync(join(pdfSource, 'legacy', 'build', module), join(pdfTarget, module));
}

export default defineConfig({
	plugins: [sveltekit()]
});
