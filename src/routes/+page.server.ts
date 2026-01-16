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

function parseMaybeArray(value: unknown): number | number[] | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) {
    const arr = value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    return arr.length <= 1 ? arr[0] : arr;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((v) => Number.isFinite(v));
    return parts.length <= 1 ? parts[0] : parts;
  }
  const n = Number(value as number);
  return Number.isFinite(n) ? n : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function isNesilenkia(value: unknown): boolean {
  const s = asString(value);
  return s ? s.toLowerCase() === 'nesilenkia' : false;
}

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const xres = await fetch('/panels.xlsx');
    if (xres.ok) {
      const buf = await xres.arrayBuffer();
      // @ts-ignore: optional runtime dependency resolved only if present
      const XLSX = (await import('xlsx')) as any;
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;
      const panels = rows.map((r: Record<string, unknown>) => {
        const rawMin = r.bendAngleMinDeg ?? r.BendAngleMinDeg;
        const rawMax = r.bendAngleMaxDeg ?? r.BendAngleMaxDeg;
        const rawSingle = r.bendAngleDeg ?? r.BendAngleDeg;
        const bendText = [rawMin, rawMax, rawSingle].some(isNesilenkia) ? 'nesilenkia' : undefined;

        return {
          name: String((r.name ?? r.Name) ?? ''),
          resX: toNumber(r.resX ?? r.ResX),
          resY: toNumber(r.resY ?? r.ResY),
          widthM: toNumber(r.widthM ?? r.WidthM),
          heightM: toNumber(r.heightM ?? r.HeightM),
          power: toNumber(r.power ?? r.Power),
          weightKg: toNumber(r.weightKg ?? r.WeightKg),
          depthM: toNumberOrNull(r.depthM ?? r.DepthM),
          bendAngleText: bendText,
          bendAngleDeg: bendText ? null : toNumberOrNull(rawSingle),
          bendAngleMinDeg: bendText ? undefined : parseMaybeArray(rawMin),
          bendAngleMaxDeg: bendText ? undefined : parseMaybeArray(rawMax),
          frameHeightM: toNumberOrNull(r.frameHeightM ?? r.FrameHeightM),
          frameHeightMinM: toNumberOrNull(r.frameHeightMinM ?? r.FrameHeightMinM) ?? undefined,
          frameHeightMaxM: toNumberOrNull(r.frameHeightMaxM ?? r.FrameHeightMaxM) ?? undefined,
        } as Record<string, unknown>;
      });
      return { panels };
    }
  } catch {}

  // If Excel is missing, return empty dataset.
  return { panels: [] };
};
