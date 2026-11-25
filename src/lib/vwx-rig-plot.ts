import type { VwxScene, VwxVec3 } from './vwx-types';
import { findVwxEndpoint, type VwxEndpoint } from './vwx-endpoints.ts';

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Pair = { from: string; to: string };

const pageWidth = 1120;
const maxPlot: Box = { x: 42, y: 88, w: 1036, h: 504 };
const ink = '#173f50';
const dimensionInk = '#a53c2d';
const mm = new Intl.NumberFormat('lt-LT', { maximumFractionDigits: 1 });

export function vwxDistance(a: VwxVec3, b: VwxVec3): { xy: number; xyz: number; dz: number } {
	const xy = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const dz = b[2] - a[2];
	return { xy, xyz: Math.hypot(xy, dz), dz };
}

function xml(value: string) {
	return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const fmt = (n: number) => n.toFixed(2);
function line(a: Point, b: Point, color: string, width = 1) {
	return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${color}" stroke-width="${width}"/>`;
}
function text(x: number, y: number, value: string, size = 12, attrs = '') {
	return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" ${attrs}>${xml(value)}</text>`;
}

// Convex footprints preserve rotated cabinet and symbol bounds when flattened into XY.
function footprint(points: Point[]): Point[] {
	const ordered = points.sort((a, b) => a.x - b.x || a.y - b.y)
		.filter((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
	if (ordered.length < 3) return ordered;
	const chain = (list: Point[]) => {
		const result: Point[] = [];
		for (const p of list) {
			while (result.length >= 2) {
				const a = result[result.length - 2], b = result[result.length - 1];
				if ((b.x - a.x) * (p.y - a.y) > (b.y - a.y) * (p.x - a.x)) break;
				result.pop();
			}
			result.push(p);
		}
		result.pop();
		return result;
	};
	return [...chain(ordered), ...chain([...ordered].reverse())];
}

function fitPlan(scene: VwxScene) {
	let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
	const include = (p: VwxVec3) => {
		if (!p.every(Number.isFinite)) return;
		xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]);
		ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]);
	};
	for (const obj of scene.objects) {
		const outline = obj.vertices ?? obj.corners;
		if (obj.kind === 'hoist' || !outline?.length) include(obj.position);
		if (obj.kind !== 'hoist') outline?.forEach(include);
	}
	for (const p of scene.panels) { p.front.forEach(include); p.back.forEach(include); }
	if (xmin === Infinity) { xmin = ymin = 0; xmax = ymax = 1000; }
	const planAspect = Math.max(1000, ymax - ymin) / Math.max(1000, xmax - xmin);
	const plot = { ...maxPlot, h: Math.min(maxPlot.h, Math.max(230, Math.ceil((maxPlot.w - 120) * planAspect + 125))) };
	const scale = Math.min((plot.w - 120) / Math.max(1000, xmax - xmin), (plot.h - 118) / Math.max(1000, ymax - ymin));
	return {
		scale, plot,
		project: (p: VwxVec3): Point => ({
			x: plot.x + plot.w / 2 + (p[0] - (xmin + xmax) / 2) * scale,
			y: plot.y + plot.h / 2 - (p[1] - (ymin + ymax) / 2) * scale
		})
	};
}

function overlap(a: Box, b: Box) {
	return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
		* Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function withinPlot(plot: Box, anchor: Point, w: number): Box {
	return {
		x: Math.max(plot.x + 3, Math.min(anchor.x - w / 2, plot.x + plot.w - w - 3)),
		y: Math.max(plot.y + 3, Math.min(anchor.y - 8, plot.y + plot.h - 19)),
		w, h: 16
	};
}

function allocate(plot: Box, anchors: Point[], label: string, occupied: Box[], rails: Box[] = []) {
	const w = label.length * 7.2 + 6;
	let best = withinPlot(plot, anchors[0], w), cost = Infinity, index = 0;
	for (let i = 0; i < anchors.length; i++) {
		const box = withinPlot(plot, anchors[i], w);
		const hit = occupied.reduce((sum, reserved) => sum + overlap(reserved, box) + (rails[i] ? overlap(reserved, rails[i]) : 0), 0);
		if (hit < cost) { cost = hit; best = box; index = i; }
		if (hit === 0) break;
	}
	occupied.push(best);
	if (rails[index]) occupied.push(rails[index]);
	return { box: best, index };
}

const short = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export function createVwxRigPlot(scene: VwxScene, measurements: readonly Pair[]): string {
	const points = new Map<string, VwxEndpoint>();
	for (const o of scene.objects) {
		if (o.kind !== 'hoist') continue;
		const point = findVwxEndpoint(scene, o.id);
		if (point) points.set(point.id, point);
	}
	const valid = measurements.flatMap(({ from, to }) => {
		const a = points.get(from) ?? findVwxEndpoint(scene, from);
		const b = points.get(to) ?? findVwxEndpoint(scene, to);
		if (!a || !b || a.id === b.id) return [];
		points.set(a.id, a);
		points.set(b.id, b);
		return [{ a, b, distance: vwxDistance(a.position, b.position) }];
	});
	const { project, scale, plot } = fitPlan(scene);
	const marked = [...points.values()].sort((a, b) => a.name.localeCompare(b.name, 'lt', { numeric: true }) || a.id.localeCompare(b.id));
	const title = marked.some(o => o.kind === 'hoist') ? 'Kabinimo taškų planas' : 'Matavimų planas';
	const used = new Set<string>();
	const labels = new Map<string, string>();
	// Preserve hoist IDs and assign concise drawing labels to the measured geometry.
	for (const o of [...marked.filter(o => o.kind === 'hoist'), ...marked.filter(o => o.kind !== 'hoist')]) {
		const type = o.kind === 'panel' ? 'P' : 'V';
		const base = o.kind === 'hoist' ? short(o.name.trim() || 'T', 17) : type;
		let n = 1, label = o.kind === 'hoist' ? base : base + n;
		while (used.has(label)) label = o.kind === 'hoist' ? base + '·' + ++n : base + ++n;
		used.add(label);
		labels.set(o.id, label);
	}
	const svg: string[] = [];
	const drawFootprint = (points: VwxVec3[], color: string, fill: string) => {
		const hull = footprint(points.filter(p => p.every(Number.isFinite)).map(project));
		if (hull.length < 2) return;
		svg.push(`<polygon points="${hull.map(p => fmt(p.x) + ',' + fmt(p.y)).join(' ')}" stroke="${color}" fill="${fill}" stroke-width=".8"/>`);
	};
	const layerNames = new Map(scene.layers.map(l => [l.id, l.name]));
	svg.push(text(42, 44, title, 29, 'font-weight="700"'));
	svg.push(text(42, 69, short(scene.fileName, 90), 14));
	svg.push(text(1078, 44, 'PLANAS IŠ VIRŠAUS', 14, 'text-anchor="end" font-weight="700"'));
	svg.push(text(1078, 68, '+X į dešinę · +Y į viršų', 12, 'text-anchor="end"'));
	svg.push(`<rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" fill="#fcfdfc" stroke="#c9d4d2"/>`);
	for (const kind of ['context', 'truss'] as const) {
		for (const o of scene.objects) {
			if (o.kind !== kind) continue;
			const color = kind === 'truss' ? '#93a6af' : '#d6dcd9';
			if (o.vertices?.length) {
				const points = o.vertices.map(project).map(p => fmt(p.x) + ',' + fmt(p.y)).join(' ');
				svg.push(`<polyline points="${points}" stroke="${color}" fill="none" stroke-width=".8"/>`);
			} else if (o.corners?.length) drawFootprint(o.corners, color, 'none');
			else if (o.position.every(Number.isFinite)) {
				const p = project(o.position);
				svg.push(`<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="1.3" fill="${color}"/>`);
			}
		}
	}
	for (const p of scene.panels) drawFootprint([...p.front, ...p.back], '#41958b', '#d6f1ea');
	const occupied: Box[] = marked.map(o => {
		const p = project(o.position);
		return { x: p.x - 5, y: p.y - 5, w: 10, h: 10 };
	});
	const labelText = (box: Box, label: string, color: string) =>
		`<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" fill="white" fill-opacity=".92"/>` +
		text(box.x + box.w / 2, box.y + 12, label, 11, `text-anchor="middle" fill="${color}" font-weight="bold"`);
	const distanceLabels: string[] = [];
	for (const [i, m] of valid.entries()) {
		const a = project(m.a.position), b = project(m.b.position);
		const dx = b.x - a.x, dy = b.y - a.y, span = Math.hypot(dx, dy);
		const normal = span ? { x: -dy / span, y: dx / span } : { x: 0, y: -1 };
		const offsets = [19, -19, 35, -35, 51, -51, 67, -67];
		const anchors = offsets.map(t => ({ x: (a.x + b.x) / 2 + normal.x * t, y: (a.y + b.y) / 2 + normal.y * t }));
		const label = `D${i + 1} · ${mm.format(m.distance.xy)} mm`;
		const rails = offsets.map(t => ({
			x: Math.min(a.x, b.x) + normal.x * t - 1.5,
			y: Math.min(a.y, b.y) + normal.y * t - 1.5,
			w: Math.abs(dx) + 3, h: Math.abs(dy) + 3
		}));
		const { box, index } = allocate(plot, anchors, label, occupied, rails);
		const shift = (p: Point, t: number): Point => ({ x: p.x + t * normal.x, y: p.y + t * normal.y });
		const t = offsets[index];
		if (span > 0.5) {
			for (const p of [a, b]) svg.push(line(p, shift(p, t + Math.sign(t) * 4), dimensionInk, .7));
			svg.push(line(shift(a, t), shift(b, t), dimensionInk));
			for (const p of [a, b]) {
				const c = shift(p, t);
				const tick = { x: (dx / span + normal.x) * 2.3, y: (dy / span + normal.y) * 2.3 };
				svg.push(line({ x: c.x - tick.x, y: c.y - tick.y }, { x: c.x + tick.x, y: c.y + tick.y }, dimensionInk));
			}
		} else {
			svg.push(line(a, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, dimensionInk));
		}
		distanceLabels.push(labelText(box, label, dimensionInk));
	}
	svg.push(...distanceLabels);
	for (const o of marked) {
		const p = project(o.position), label = labels.get(o.id)!;
		const offset = label.length * 3.6 + 10;
		const anchors: Point[] = [];
		for (let band = 0; band < 5; band++) {
			for (const y of [-12 - band * 16, 13 + band * 16]) {
				for (const x of [offset, -offset, 0]) anchors.push({ x: p.x + x, y: p.y + y });
			}
		}
		const { box } = allocate(plot, anchors, label, occupied);
		const end = { x: Math.max(box.x, Math.min(p.x, box.x + box.w)), y: Math.max(box.y, Math.min(p.y, box.y + box.h)) };
		svg.push(`<g><title>${xml(o.name)} · ${xml(o.id)}</title>`, line(p, end, ink, .7),
			`<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="4" stroke="${ink}" fill="white" stroke-width="1.4"/>`,
			line({ x: p.x - 3, y: p.y }, { x: p.x + 3, y: p.y }, ink),
			line({ x: p.x, y: p.y - 3 }, { x: p.x, y: p.y + 3 }, ink), labelText(box, label, ink), '</g>');
	}
	const sheetOffset = plot.h - maxPlot.h;
	svg.push(`<g transform="translate(0 ${sheetOffset})">`);
	const ideal = 130 / scale, power = 10 ** Math.floor(Math.log10(ideal));
	const scaleMm = ([1, 2, 5].filter(m => m * power <= ideal).pop() ?? 1) * power;
	const left = { x: 46, y: 618 }, right = { x: 46 + scaleMm * scale, y: 618 };
	svg.push(line(left, right, ink, 2));
	for (const p of [left, right]) svg.push(line({ x: p.x, y: p.y - 4 }, { x: p.x, y: p.y + 2 }, ink));
	svg.push(text(right.x + 10, 622, `${mm.format(scaleMm / 1000)} m`));
	svg.push('<circle cx="602" cy="618" r="4" fill="white" stroke="#173f50"/>', text(612, 622, 'Taškas'));
	svg.push('<rect x="681" y="613" width="15" height="9" fill="#d6f1ea" stroke="#41958b"/>', text(703, 622, 'LED panelė'));
	svg.push(line({ x: 813, y: 618 }, { x: 833, y: 618 }, '#93a6af', 2), text(841, 622, 'Kontūras'));
	svg.push(line({ x: 941, y: 618 }, { x: 961, y: 618 }, dimensionInk), text(969, 622, 'Matmuo'));
	let y = 657;
	if (scene.contextSimplified && scene.objects.some(o => o.kind === 'context')) {
		svg.push(text(42, y, 'Rodoma dalis modelio aplinkos geometrijos.', 12));
		y += 24;
	}
	const columns = (values: string[], positions: number[], bold = false) => {
		for (let i = 0; i < values.length; i++) svg.push(text(positions[i], y, values[i], 12, bold ? 'font-weight="bold"' : ''));
		svg.push(line({ x: 42, y: y + 6 }, { x: 1078, y: y + 6 }, '#dce4e3', .7));
		y += 22;
	};
	if (marked.length) {
		svg.push(text(42, y, 'Taškų koordinatės modelyje (mm)', 17, 'font-weight="bold"')); y += 25;
		const geometryPoints = marked.some(o => o.kind !== 'hoist');
		const positions = geometryPoints ? [42, 185, 455, 663, 810, 950] : [42, 240, 620, 770, 925];
		columns(['Taškas', ...(geometryPoints ? ['Objekto taškas'] : []), 'Sluoksnis', 'X', 'Y', 'Z'], positions, true);
		for (const o of marked) {
			const name = geometryPoints ? [short(o.name, 36)] : [];
			columns([labels.get(o.id)!, ...name, short(layerNames.get(o.layerId) || o.layerId, geometryPoints ? 27 : 45),
				...o.position.map(v => mm.format(v))], positions);
		}
	}
	if (valid.length) {
		y += 12; svg.push(text(42, y, 'Atstumai tarp taškų (mm)', 17, 'font-weight="bold"')); y += 25;
		const positions = [42, 120, 355, 600, 770, 945];
		columns(['Matmuo', 'Nuo', 'Iki', 'Plane (XY)', 'Erdvėje (XYZ)', 'ΔZ (iki − nuo)'], positions, true);
		for (const [i, m] of valid.entries()) {
			columns([`D${i + 1}`, labels.get(m.a.id)!, labels.get(m.b.id)!, mm.format(m.distance.xy),
				mm.format(m.distance.xyz), mm.format(m.distance.dz)], positions);
		}
	}
	svg.push('</g>');
	const height = y + 20 + sheetOffset;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${height}" viewBox="0 0 ${pageWidth} ${height}" role="img"><title>${title} · ${xml(scene.fileName)}</title><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="${ink}">${svg.join('')}</g></svg>`;
}
