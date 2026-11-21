// A small alphabet for the metric scale printed on Vectorworks plots. Each glyph
// covers six columns and nine rows from cap height to baseline (0 = white).
const inkShapes: Record<string, string> = {
  '0': '136630 387772 583484 772286 771286 771286 683385 387782 146640',
  '1': '002453 136884 578984 445784 002684 002684 002685 002684 002453',
  '2': '146641 587785 562287 110386 003783 147840 378411 688775 566665',
  '3': '146531 587774 442485 013773 015873 011376 452277 687785 246641',
  '4': '001452 003773 016983 048773 375573 586785 588897 122573 000352',
  '5': '255552 388873 584220 698752 675784 110386 541376 686773 257631',
  // Competing glyphs keep a 6, 8, 9 or a footed 1 from matching a similar digit.
  '1-foot': '246897 577897 222687 001687 001687 001687 001687 345798 689999',
  '6': '038961 287683 582111 785751 897794 781187 681187 396694 048950',
  '7': '999997 555696 000592 001870 004930 017710 029500 059200 078100',
  '8': '169961 496596 582187 386583 179872 583287 781079 596597 169971',
  '9': '159840 596793 881196 880188 695698 178788 111286 485792 179830',
  'm': '000000 000000 335252 778886 745637 724527 724527 724527 523315'
};

function normalized(values: number[]): number[] {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map(value => value - mean);
  const length = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0)) || 1;
  return centered.map(value => value / length);
}

const alphabet = Object.entries(inkShapes).map(([letter, pixels]) => ({
  letter: letter[0], values: normalized([...pixels.replaceAll(' ', '')].map(Number))
}));

type Span = { first: number; last: number };
function inkRuns(first: number, last: number, hasInk: (position: number) => boolean): Span[] {
  const spans: Span[] = [];
  for (let index = first; index <= last; index++) {
    if (!hasInk(index)) continue;
    const previous = spans[spans.length - 1];
    if (previous?.last === index - 1) previous.last = index;
    else spans.push({ first: index, last: index });
  }
  return spans;
}

function glyphScores(gray: Uint8Array, stride: number, span: Span, row: Span) {
  const values: number[] = [];
  for (let gy = 0; gy < 9; gy++) {
    const y = row.first - 0.5 + (gy + 0.5) * (row.last - row.first + 1) / 9;
    const iy = Math.floor(y), fy = y - iy;
    for (let gx = 0; gx < 6; gx++) {
      const x = span.first - 0.5 + (gx + 0.5) * (span.last - span.first + 1) / 6;
      const ix = Math.floor(x), fx = x - ix, index = iy * stride + ix;
      const top = gray[index] * (1 - fx) + gray[index + 1] * fx;
      const bottom = gray[index + stride] * (1 - fx) + gray[index + stride + 1] * fx;
      values.push(255 - (top * (1 - fy) + bottom * fy));
    }
  }
  const ink = normalized(values);
  const scores = new Map<string, number>();
  for (const template of alphabet) {
    const score = template.values.reduce((sum, value, index) => sum + value * ink[index], 0);
    scores.set(template.letter, Math.max(score, scores.get(template.letter) ?? -1));
  }
  return [...scores].map(([letter, score]) => ({letter, score})).sort((a, b) => b.score - a.score);
}

// A candidate geometry must have legible labels centered on its individual ticks,
// followed by the metre unit. A drawing grid or the same bar in feet must fail.
export function metricRulerLabels(
  gray: Uint8Array, width: number, height: number, x: number, y: number, step: number
): boolean {
  const left = Math.max(1, Math.round(x - 0.48 * step));
  const right = Math.min(width - 2, Math.round(x + 6.6 * step));
  const zeroEnd = Math.min(right, Math.round(x + 0.48 * step));
  const top = Math.max(1, Math.round(y - 1.35 * step));
  const bottom = Math.min(height - 2, Math.round(y - 0.12 * step));
  const isInk = (col: number, row: number) => gray[row * width + col] < 165;
  const rows = inkRuns(top, bottom, row => {
    for (let col = left; col <= zeroEnd; col++) if (isInk(col, row)) return true;
    return false;
  });
  if (rows.length !== 1) return false;
  const row = rows[0], capHeight = row.last - row.first + 1;
  if (capHeight < 7 || capHeight < step * 0.17 || capHeight > step * 0.74) return false;

  // Project above the decimal point so the comma in "5,0" stays distinct even
  // when JPEG compression makes its tail touch the zero near the baseline.
  const upperEnd = row.first + Math.floor(0.7 * capHeight) - 1;
  const spans = inkRuns(left, right, col => {
    for (let r = row.first; r <= upperEnd; r++) if (isInk(col, r)) return true;
    return false;
  });
  const decimals = spans.length === 12;
  const expected = decimals ? '01020304050m' : '012345m';
  if (spans.length !== expected.length) return false;

  for (let tick = 0; tick <= 5; tick++) {
    const index = decimals && tick > 0 ? tick * 2 - 1 : tick;
    const first = spans[index];
    const last = decimals && tick > 0 ? spans[index + 1] : first;
    if (Math.abs((first.first + last.last) / 2 - (x + step * tick)) > step * 0.19) return false;
    if (first !== last) {
      // Confirm there really is a decimal separator: "10 ... 50 m" carries a
      // different scale from "1,0 ... 5,0 m" even though the tall glyphs agree.
      const mid = (first.last + last.first) / 2;
      const pad = Math.max(0.55, 0.24 * (last.first - first.last));
      let separator = false;
      for (let col = Math.ceil(mid - pad); col <= Math.floor(mid + pad); col++) {
        for (let r = upperEnd + 1; r <= Math.min(bottom, row.last + 2); r++) {
          if (isInk(col, r)) separator = true;
        }
      }
      if (!separator) return false;
    }
  }
  const unit = spans[spans.length - 1], lastDigit = spans[spans.length - 2];
  const unitWidth = unit.last - unit.first + 1;
  if (unitWidth < 0.64 * capHeight || unitWidth > 1.43 * capHeight ||
      unit.first - lastDigit.last > 0.9 * step || right - unit.last < 0.19 * step) return false;

  let scoreSum = 0;
  for (let index = 0; index < spans.length; index++) {
    const [best, next] = glyphScores(gray, width, spans[index], row);
    if (best.letter !== expected[index] || best.score < 0.57 || best.score - next.score < 0.075) return false;
    scoreSum += best.score;
  }
  return scoreSum / spans.length >= 0.77;
}
