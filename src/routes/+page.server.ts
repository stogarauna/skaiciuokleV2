import type { PageServerLoad } from './$types';

function toNumber(value: unknown, defaultVal = 0): number {
  if (value === null || value === undefined || value === '') return defaultVal;
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultVal;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
    return obj;
  });
}

export const load: PageServerLoad = async ({ fetch }) => {
  // 1) Try read Excel from static panels.xlsx
  try {
    const xres = await fetch('/panels.xlsx');
    if (xres.ok) {
      const buf = await xres.arrayBuffer();
      // @ts-ignore: optional runtime dependency resolved only if present
      const XLSX = (await import('xlsx')) as any;
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;
      if (rows && rows.length) {
        const panels = rows.map((r: Record<string, unknown>) => ({
          name: String((r.name ?? r.Name) ?? ''),
          resX: toNumber(r.resX ?? r.ResX),
          resY: toNumber(r.resY ?? r.ResY),
          widthM: toNumber(r.widthM ?? r.WidthM),
          heightM: toNumber(r.heightM ?? r.HeightM),
          power: toNumber(r.power ?? r.Power),
          weightKg: toNumber(r.weightKg ?? r.WeightKg),
          depthM: toNumberOrNull(r.depthM ?? r.DepthM),
          bendAngleDeg: toNumberOrNull(r.bendAngleDeg ?? r.BendAngleDeg),
          frameHeightM: toNumberOrNull(r.frameHeightM ?? r.FrameHeightM),
        }));
        return { panels };
      }
    }
  } catch {}

  // 2) Fallback: CSV from static panels.csv
  try {
    const res = await fetch('/panels.csv');
    if (res.ok) {
      const text = await res.text();
      const rows = parseCsv(text);
      if (rows.length) {
        const panels = rows.map(r => ({
          name: String(r.name ?? r.Name ?? ''),
          resX: toNumber(r.resX ?? r.ResX),
          resY: toNumber(r.resY ?? r.ResY),
          widthM: toNumber(r.widthM ?? r.WidthM),
          heightM: toNumber(r.heightM ?? r.HeightM),
          power: toNumber(r.power ?? r.Power),
          weightKg: toNumber(r.weightKg ?? r.WeightKg),
          depthM: toNumberOrNull(r.depthM ?? r.DepthM),
          bendAngleDeg: toNumberOrNull(r.bendAngleDeg ?? r.BendAngleDeg),
          frameHeightM: toNumberOrNull(r.frameHeightM ?? r.FrameHeightM),
        }));
        return { panels };
      }
    }
  } catch {}

  // 3) Final fallback: bundled JS data
  const { panels } = await import('$lib/data/panels.js');
  return { panels };
};
