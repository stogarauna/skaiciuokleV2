export type RigSymbolColour = 'blue' | 'red';
type Point = { x: number; y: number };
type Detection = Point & { radius: number; score: number };
type SymbolGroups = Record<RigSymbolColour, Point[]>;

// Half of a quartered circle is inked. Sampling at several angles keeps the
// test independent of which two quarters are coloured and of symbol rotation.
const directions = Array.from({length: 24}, (_, i) => {
 const angle = (i + .5) * Math.PI / 12;
 return {x: Math.cos(angle), y: Math.sin(angle)};
});

function scoreSymbol(mask: Uint8Array, width: number, height: number, colour: number, x: number, y: number, radius: number) {
 const outer = 1.24 * radius;
 if (x < outer || y < outer || x + outer >= width || y + outer >= height) return 0;
 const sample = (dx: number, dy: number, r: number) =>
  Number((mask[Math.round(y + dy * r) * width + Math.round(x + dx * r)] & 3) === colour);
 const ring: number[] = [];
 let outerInk = 0;
 for (const dir of directions) {
  ring.push(sample(dir.x, dir.y, radius * .41) + sample(dir.x, dir.y, radius * .73));
  outerInk += sample(dir.x, dir.y, outer);
 }
 // Background lines may cross a symbol. A solid patch of colour is not a symbol.
 if (outerInk > 7) return 0;
 let best = 0;
 for (let phase = 0; phase < 12; phase++) {
  let lowest = 10, matches = 0;
  for (let q = 0; q < 4; q++) {
   let ink = 0;
   // Ignore the ray closest to a quadrant edge on each side.
   for (let i = 1; i <= 4; i++) ink += ring[(phase + q * 6 + i) % 24];
   const correct = q % 2 === 0 ? ink : 8 - ink;
   matches += correct;
   lowest = Math.min(lowest, correct);
  }
  if (lowest >= 6 && matches >= 29) best = Math.max(best, matches / 32 - outerInk / 120);
 }
 return best;
}

/** Find quartered CAD rigging symbols by their actual centres in normalized image coordinates. */
export function detectRigSymbols(data: Uint8ClampedArray, width: number, height: number): SymbolGroups {
 const groups: SymbolGroups = {blue: [], red: []};
 if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || data.length !== width * height * 4) return groups;
 const mask = new Uint8Array(width * height);
 const stack = new Int32Array(mask.length);
 for (let i = 0; i < mask.length; i++) {
  const p = i * 4, r = data[p], g = data[p + 1], b = data[p + 2];
  if (data[p + 3] < 100) continue;
  if (b > r + 42 && b > g + 35 && r < 170) mask[i] = 1;
  else if (r > b + 45 && r > g + 40 && g < 200) mask[i] = 2;
 }
 const radiusLimit = Math.min(64, Math.max(12, Math.min(width, height) * .035));
 const detections: Detection[][] = [[], [], []];
 for (let i = 0; i < mask.length; i++) {
  const colour = mask[i];
  if (!colour || colour > 2) continue;
  let size = 1, count = 0, l = width, r = 0, t = height, b = 0;
  stack[0] = i;
  mask[i] |= 4;
  while (size) {
   const p = stack[--size], y = Math.floor(p / width), x = p - y * width;
   count++;
   l = Math.min(l, x); r = Math.max(r, x);
   t = Math.min(t, y); b = Math.max(b, y);
   for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
     const k = yy * width + xx;
     if (mask[k] === colour) { mask[k] |= 4; stack[size++] = k; }
    }
   }
  }
  const w = r - l + 1, h = b - t + 1, fill = count / (w * h);
  if (count < 8 || Math.min(w,h) < 3 || Math.max(w,h) > radiusLimit * 5 || fill < .15) continue;
  const evaluate = (x: number, y: number, radius: number) => {
   if (radius < 3 || radius > radiusLimit) return;
   const score = scoreSymbol(mask, width, height, colour, x, y, radius);
   if (score >= .925) detections[colour].push({x,y,radius,score});
  };
  // JPEG compression may split the opposite quarters into two components.
  // A single quarter has its centre at one of its four bounding-box corners.
  const radius = Math.min(w,h) / 2;
  // A nearby motor icon can touch a quartered marker in the same ink.
  if (w > 1.5 * h || h > 1.5 * w) {
   if (w > h) {
    evaluate(l + radius - .5, (t + b) / 2, radius);
    evaluate(r - radius + .5, (t + b) / 2, radius);
   } else {
    evaluate((l + r) / 2, t + radius - .5, radius);
    evaluate((l + r) / 2, b - radius + .5, radius);
   }
   continue;
  }
  if (fill < .79) evaluate((l + r) / 2, (t + b) / 2, radius);
  if (fill > .54 && fill < .94) {
   for (const x of [l - .5, r + .5]) for (const y of [t - .5, b + .5]) evaluate(x, y, radius * 2);
  }
 }
 for (const [colour, name] of [[1, 'blue'], [2, 'red']] as const) {
  const unique: Detection[] = [];
  for (const hit of detections[colour].sort((a,b) => b.score - a.score)) {
   // At low resolution a single antialiased pixel can lower the template score.
   // Keep such a hit only when separate strong symbols corroborate its size.
   if (hit.score < .955 && unique.filter(p => p.score >= .955 && Math.abs(hit.radius-p.radius) <= p.radius * .16).length < 2) continue;
   if (!unique.some(p => Math.hypot(hit.x-p.x, hit.y-p.y) < Math.min(hit.radius,p.radius) * .75)) unique.push(hit);
  }
  // Anchor each row to its first Y, so tiny successive offsets cannot merge a slope into one row.
  unique.sort((a,b) => a.y-b.y || a.x-b.x);
  let start = 0;
  while (start < unique.length) {
   const rowTop = unique[start].y;
   let end = start + 1, minRadius = unique[start].radius;
   while (end < unique.length) {
    minRadius = Math.min(minRadius, unique[end].radius);
    if (unique[end].y - rowTop > .4 * minRadius) break;
    end++;
   }
   for (const p of unique.slice(start,end).sort((a,b) => a.x-b.x || a.y-b.y)) {
    groups[name].push({x:(p.x+.5)/width, y:(p.y+.5)/height});
   }
   start = end;
  }
 }
 return groups;
}
