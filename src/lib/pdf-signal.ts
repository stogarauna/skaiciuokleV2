import type {jsPDF} from 'jspdf';
import {drawRouteEntries} from './pdf-routing.ts';
import type {Screen} from './project.ts';
import {physicalPanelNumber, signalLineSummary, type SignalOutputPart, type signalOutputs} from './signal-output.ts';
import type {RouteMap, signalPlan} from './signal.ts';

type SignalPlan = ReturnType<typeof signalPlan>;
type Cell = SignalPlan['cells'][number];
type RGB = [number, number, number];
type Drawing = {x: number; y: number; cellWidth: number; cellHeight: number};
type PartContext = {original: Screen; part: SignalOutputPart};

const colors: RGB[] = [
 [0, 110, 112], [154, 73, 0], [35, 82, 162], [147, 45, 100],
 [75, 106, 21], [98, 61, 155], [156, 49, 43], [23, 101, 143]
];
const portColor = (number: number) => colors[(number - 1) % colors.length];
const format = (value: number) => new Intl.NumberFormat('lt-LT').format(value).replace(/\u00a0/g, ' ');

export function drawSignalMap(doc: jsPDF, screen: Screen, plan: RouteMap, drawing: Drawing,
 numbering?: PartContext, circuitPrefix = 'P') {
 const {x, y, cellWidth, cellHeight} = drawing;
 const cellSize = Math.min(cellWidth, cellHeight);
 const stroke = Math.min(0.55, cellSize * 0.075);
 const center = (cell: Cell) => ({
  x: x + (cell.c + 0.5) * cellWidth,
  y: y + (cell.r + 0.56) * cellHeight
 });

 function drawCells(cells: Cell[], color: RGB) {
  const fill = color.map(channel => Math.round(255 * 0.86 + channel * 0.14)) as RGB;
  doc.setFillColor(...fill);
  doc.setDrawColor(...color);
  doc.setLineWidth(Math.min(0.15, cellSize * 0.045));
  for (const cell of cells) {
   const left = x + cell.c * cellWidth;
   const top = y + cell.r * cellHeight;
   doc.rect(left, top, cellWidth, cellHeight, 'FD');
  }
  if (cellSize < 5) return;
  doc.setTextColor(48, 60, 70);
  doc.setFontSize(Math.min(7, cellSize * 0.9));
  for (const {c, r} of cells) {
   const number = numbering ? physicalPanelNumber(numbering.original, numbering.part, {c, r}) : r * screen.cols + c + 1;
   doc.text(String(number), x + (c + 0.13) * cellWidth, y + (r + 0.24) * cellHeight);
  }
 }

 const assigned = new Set(plan.ports.flatMap(port => port.cells.map(({c,r}) => `${c},${r}`)));
 drawCells(plan.cells.filter(({c,r}) => !assigned.has(`${c},${r}`)), [68, 130, 133]);
 for (const port of plan.ports) drawCells(port.cells, portColor(port.number));
 for (const port of plan.ports) {
  const color = portColor(port.number);
  doc.setDrawColor(...color);
  doc.setFillColor(...color);
  doc.setLineWidth(stroke);
  for (let i = 1; i < port.cells.length; i++) {
   const start = center(port.cells[i - 1]);
   const end = center(port.cells[i]);
   doc.line(start.x, start.y, end.x, end.y);
   if (cellSize < 2) continue;
   const length = Math.hypot(end.x - start.x, end.y - start.y);
   const dx = (end.x - start.x) / length;
   const dy = (end.y - start.y) / length;
   const arrow = Math.min(1.35, cellSize * 0.19);
   const midX = (start.x + end.x) / 2;
   const midY = (start.y + end.y) / 2;
   doc.triangle(
    midX + dx * arrow, midY + dy * arrow,
    midX - dx * arrow - dy * arrow * 0.65, midY - dy * arrow + dx * arrow * 0.65,
    midX - dx * arrow + dy * arrow * 0.65, midY - dy * arrow - dx * arrow * 0.65,
    'F'
   );
  }
  const start = center(port.cells[0]);
  const label = `${circuitPrefix}${port.number}`;
  doc.setFontSize(Math.min(8, cellSize * 1.35));
  const badgeWidth = doc.getTextWidth(label) + cellSize * 0.18;
  const badgeHeight = Math.min(4.3, cellSize * 0.56);
  if (cellSize >= 3 && badgeWidth < cellWidth * 0.92) {
   doc.roundedRect(start.x - badgeWidth / 2, start.y - badgeHeight / 2, badgeWidth, badgeHeight, 0.5, 0.5, 'F');
   doc.setTextColor(255, 255, 255);
   doc.text(label, start.x, start.y, {align: 'center', baseline: 'middle'});
  } else {
   doc.circle(start.x, start.y, Math.min(cellSize * 0.18, 0.8), 'F');
  }
 }
}

function unavailable(plan: SignalPlan) {
 if (!plan.cells.length) return 'Aktyvių panelių nėra.';
 if (!plan.issue && plan.panelsPerPort) return 'Panelės dar neprijungtos.';
 if (!plan.panelsPerPort) return `Vienai panelei reikia bent ${format(plan.panelPixels)} px.`;
 return 'Porto pikselių limito neužtenka pilnai eilei arba stulpeliui.';
}

export function appendSignalPage(doc: jsPDF, screen: Screen, output: ReturnType<typeof signalOutputs>) {
 doc.addPage();
 doc.setFont('OpenSans');
 doc.setTextColor(36, 67, 79);
 doc.setFontSize(15);
 doc.text('Signalo komutacija', 12, 16);
 doc.setFontSize(11);
 const title = doc.splitTextToSize(screen.name, 175).slice(0, 2);
 doc.text(title, 12, 24);
 const lines = signalLineSummary(output);
 doc.setFontSize(12);
 doc.text(`UTP linijų: ${output.issue ? '—' : format(lines.count)}`, 285, 16, {align:'right'});
 doc.setFontSize(8);
 doc.text(lines.complete ? '1 UTP linija vienam portui' : 'Komutacija nepilna arba viršytas limitas', 285, 24, {align:'right'});
 const chartY = 25 + title.length * 5;
 if (output.issue) {
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(output.issue, 273), 12, chartY);
  return;
 }
 const {parts} = output;
 const split = screen.signal?.output !== undefined;

 const chartHeight = 90;
 const innerWidth = 261;
 const innerHeight = chartHeight - 8;
 const panelW = screen.panel.widthM;
 const panelH = screen.panel.heightM;
 const maxWidth = Math.max(...parts.map(part => part.screen.cols * panelW));
 const maxHeight = Math.max(...parts.map(part => part.screen.rows * panelH));
 const columns = Math.min(parts.length, Math.max(1,
  Math.round(Math.sqrt(parts.length * innerWidth * maxHeight / (innerHeight * maxWidth)))));
 const rows = Math.ceil(parts.length / columns);
 const slotWidth = innerWidth / columns;
 const slotHeight = innerHeight / rows;
 const labelSpace = split ? Math.min(6, slotHeight * 0.28) : 0;
 const scale = Math.min(slotWidth * (columns > 1 ? 0.94 : 1) / maxWidth, (slotHeight - labelSpace) / maxHeight);
 doc.setFillColor(247, 250, 252);
 doc.setDrawColor(214, 223, 231);
 doc.setLineWidth(0.15);
 doc.rect(12, chartY, 273, chartHeight, 'FD');
 for (const [index, part] of parts.entries()) {
  const x = 18 + (index % columns) * slotWidth + (slotWidth - maxWidth * scale) / 2;
  const top = chartY + 4 + Math.floor(index / columns) * slotHeight;
  const y = top + labelSpace + (slotHeight - labelSpace - maxHeight * scale) / 2;
  if (split && labelSpace >= 2.5) {
   doc.setTextColor(36, 67, 79);
   doc.setFontSize(Math.min(8, labelSpace * 1.8));
   const name = `Dalis ${part.number} · ${part.width} × ${part.height} px`;
   doc.text(doc.splitTextToSize(name, slotWidth * 0.94)[0], x, y - 1.2);
  }
  drawSignalMap(doc, part.screen, part.plan, {
   x, y, cellWidth: panelW * scale, cellHeight: panelH * scale
  }, split ? {original: screen, part} : undefined);
 }

 const entries:string[]=[];
 for(const part of parts){
  for(const port of part.plan.ports){
   const start=physicalPanelNumber(screen,part,port.cells[0]);
   entries.push(`P${port.number} → ${start} · ${format(port.cells.length)} vnt.${port.remaining<0?' · Viršytas limitas':''}`);
  }
  const assigned=part.plan.ports.reduce((count,port)=>count+port.cells.length,0);
  const unassigned=part.plan.cells.length-assigned;
  if(unassigned||!part.plan.ports.length){
   const prefix=split?`Dalis ${part.number} · `:'';
   entries.push(prefix+(part.plan.ports.length?`Neprijungta ${format(unassigned)} panelių`:unavailable(part.plan)));
  }
 }
 drawRouteEntries(doc,chartY+chartHeight+5,`${screen.name} · Portas → įėjimo panelė · Panelių kiekis`,entries);
}
