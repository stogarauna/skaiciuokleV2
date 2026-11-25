import { base } from '$app/paths';
import { version } from 'pdfjs-dist/package.json';

export interface DrawingPdf {
	pageCount: number;
	renderPage(pageNumber: number): Promise<Blob>;
	destroy(): Promise<void>;
}

// Keep individual pages within browser canvas limits while preserving fine
// lines and labels on landscape and portrait drawings.
const maxPageSide = 4800;
const maxPagePixels = 12_000_000;

export async function openDrawingPdf(file: Blob): Promise<DrawingPdf> {
	const assets = new URL(`${base}/pdfjs/${version}/`, window.location.origin).href;
	const pdfjs: typeof import('pdfjs-dist') = await import(/* @vite-ignore */ assets + 'pdf.min.mjs');
	pdfjs.GlobalWorkerOptions.workerSrc = assets + 'pdf.worker.min.mjs';
	const loading = pdfjs.getDocument({
		data: new Uint8Array(await file.arrayBuffer()),
		cMapUrl: assets + 'cmaps/',
		standardFontDataUrl: assets + 'standard_fonts/',
		iccUrl: assets + 'iccs/',
		wasmUrl: assets + 'wasm/'
	});

	try {
		const pdf = await loading.promise;
		return {
			pageCount: pdf.numPages,
			destroy: () => loading.destroy(),
			async renderPage(pageNumber) {
				const page = await pdf.getPage(pageNumber);
				const canvas = document.createElement('canvas');
				try {
					const { width, height } = page.getViewport({ scale: 1 });
					const scale = Math.min(maxPageSide / Math.max(width, height), Math.sqrt(maxPagePixels / (width * height)));
					const viewport = page.getViewport({ scale });
					canvas.width = Math.max(1, Math.floor(viewport.width));
					canvas.height = Math.max(1, Math.floor(viewport.height));
					await page.render({ canvas, viewport, background: '#ffffff' }).promise;
					return await new Promise<Blob>((resolve, reject) => {
						canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nepavyko sukurti PDF puslapio vaizdo.')), 'image/png');
					});
				} finally {
					canvas.width = canvas.height = 0;
					page.cleanup();
				}
			}
		};
	} catch (error) {
		await loading.destroy();
		if (error instanceof Error && error.name === 'PasswordException') {
			throw new Error('PDF apsaugotas slaptažodžiu. Įkelkite atrakintą kopiją.');
		}
		throw new Error('Nepavyko perskaityti PDF dokumento.');
	}
}
