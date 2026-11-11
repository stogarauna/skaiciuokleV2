import type {Screen} from './project.ts';
import {defaultSignalSettings, signalPlan} from './signal.ts';

export interface SignalOutputPart {
 number: number;
 column: number;
 row: number;
 width: number;
 height: number;
 screen: Screen;
 plan: ReturnType<typeof signalPlan>;
}

function spans(length: number, count: number) {
 const spans: {start: number; size: number}[] = [];
 const base = Math.floor(length / count);
 const remainder = length % count;
 let start = 0;
 for (let i = 0; i < count; i++) {
  const size = base + Number(i < remainder);
  spans.push({start, size});
  start += size;
 }
 return spans;
}

export function signalOutputs(screen: Screen, settings = screen.signal ?? defaultSignalSettings) {
 const parts: SignalOutputPart[] = [];
 const {resX, resY, widthM, heightM} = screen.panel;
 const output = settings.output;
 if (!output) {
  parts.push({
   number: 1, column: 0, row: 0, width: screen.cols * resX, height: screen.rows * resY,
   screen, plan: signalPlan(screen, settings)
  });
  return {parts, issue: null, minAcross: 1};
 }

 const maxCols = Math.floor(output.width / resX);
 const maxRows = Math.floor(output.height / resY);
 if (maxCols === 0 || maxRows === 0) {
  return {parts, issue: `Į pasirinktą raišką netelpa viena ${resX} × ${resY} px panelė.`, minAcross: 0};
 }
 const minAcross = Math.ceil(screen.cols / maxCols);
 const across = output.partsAcross ?? minAcross;
 if (across < minAcross || across > screen.cols) {
  return {
   parts, minAcross,
   issue: across < minAcross
    ? `Į ${output.width} × ${output.height} px telpa iki ${maxCols} stulp. vienoje dalyje. Pasirinkite bent ${minAcross} dalis per plotį.`
    : `Ekranas turi ${screen.cols} stulp. Pasirinkite iki ${screen.cols} dalių per plotį.`
  };
 }

 const removed = new Set(screen.removed);
 const columns = spans(screen.cols, across);
 const rows = spans(screen.rows, Math.ceil(screen.rows / maxRows));
 for (const {start: row, size: height} of rows) {
  for (const {start: column, size: width} of columns) {
   const removedInPart: string[] = [];
   for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
     if (removed.has(`${column + c},${row + r}`)) removedInPart.push(`${c},${r}`);
    }
   }
   const part: Screen = {
    ...screen, cols: width, rows: height, removed: removedInPart,
    x: screen.x + column * widthM, y: screen.y + row * heightM, signal: settings
   };
   parts.push({
    number: parts.length + 1, column, row, width: width * resX, height: height * resY,
    screen: part, plan: signalPlan(part, settings)
   });
  }
 }
 return {parts, issue: null, minAcross};
}

export function physicalPanelNumber(screen: Pick<Screen, 'cols'>, part: Pick<SignalOutputPart, 'column' | 'row'>, cell: {c: number; r: number}) {
 return (part.row + cell.r) * screen.cols + part.column + cell.c + 1;
}
