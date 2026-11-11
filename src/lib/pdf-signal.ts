import type {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {Screen} from './project.ts';
import {physicalPanelNumber, type SignalOutputPart} from './signal-output.ts';
import {defaultSignalSettings, signalEntryEdge, signalPresets, type signalPlan} from './signal.ts';

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

export function drawSignalMap(doc: jsPDF, screen: Screen, plan: SignalPlan, drawing: Drawing,
 numbering?: PartContext, portPrefix = '') {
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

 if (!plan.ports.length) {
  drawCells(plan.cells, [68, 130, 133]);
  return;
 }

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
   const dx = Math.sign(end.x - start.x);
   const dy = Math.sign(end.y - start.y);
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
  const label = `${portPrefix}P${port.number}`;
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

export function appendSignalPage(doc: jsPDF, screen: Screen, plan: SignalPlan, context?: PartContext) {
 const settings = screen.signal ?? defaultSignalSettings;
 const mode = signalPresets.find(preset => preset.id === settings.preset);
 const edge = {bottom: 'apačioje', top: 'viršuje', left: 'kairėje', right: 'dešinėje'}[signalEntryEdge(settings)];

 doc.addPage();
 doc.setFont('OpenSans');
 doc.setTextColor(36, 67, 79);
 doc.setFontSize(15);
 doc.text('Signalo komutacija', 12, 16);
 doc.setFontSize(11);
 const name = context ? `${screen.name} · Dalis ${context.part.number}` : screen.name;
 const title = doc.splitTextToSize(name, 273).slice(0, 2);
 doc.text(title, 12, 24);
 const infoY = 25 + title.length * 5;
 doc.setFontSize(8);
 doc.text(`${mode?.label ?? 'Rankinis limitas'}  ·  ${format(settings.portCapacity)} px / portui  ·  Įėjimai ${edge}`, 12, infoY);
 if (context) {
  const {part} = context;
  doc.text(`${part.width} × ${part.height} px · ekrano stulpeliai ${part.column + 1}–${part.column + screen.cols} · eilės ${part.row + 1}–${part.row + screen.rows}`, 12, infoY + 5);
 } else if (plan.ports.length) {
  doc.text('P1, P2 ir t. t. žymi kabelių įėjimus. Rodyklės žymi signalo kryptį.', 12, infoY + 5);
 }

 const chartY = infoY + 10;
 const chartHeight = 90;
 const widthM = screen.cols * screen.panel.widthM;
 const heightM = screen.rows * screen.panel.heightM;
 const scale = Math.min(261 / widthM, (chartHeight - 8) / heightM);
 doc.setFillColor(247, 250, 252);
 doc.setDrawColor(214, 223, 231);
 doc.setLineWidth(0.15);
 doc.rect(12, chartY, 273, chartHeight, 'FD');
 drawSignalMap(doc, screen, plan, {
  x: (297 - widthM * scale) / 2,
  y: chartY + (chartHeight - heightM * scale) / 2,
  cellWidth: screen.panel.widthM * scale,
  cellHeight: screen.panel.heightM * scale
 }, context);

 const tableY = chartY + chartHeight + 5;
 if (!plan.ports.length) {
  const reason = !plan.cells.length
   ? 'Ekrane nėra aktyvių panelių.'
   : !plan.panelsPerPort
    ? `Vienai panelei reikia bent ${format(plan.panelPixels)} px.`
    : plan.issue === 'gap'
     ? 'Nuo pasirinktos kraštinės nepavyksta sudaryti pilnų stačiakampių blokų.'
     : 'Porto pikselių limito neužtenka pilnai eilei arba stulpeliui nuo pasirinktos kraštinės.';
  doc.setFontSize(9);
  doc.setTextColor(112, 63, 18);
  doc.text(doc.splitTextToSize(`Schema nesudaryta. ${reason}`, 273), 12, tableY + 2);
  return;
 }

 autoTable(doc, {
  startY: tableY,
  head: [['Portas', 'Įėjimo panelė', 'Blokas (stulp. × eil.)', 'Apkrova', 'Laisva']],
  body: plan.ports.map(port => [
   `P${port.number}`,
   String(context
    ? physicalPanelNumber(context.original, context.part, port.cells[0])
    : port.cells[0].r * screen.cols + port.cells[0].c + 1),
   `${port.columns} × ${port.rows}`,
   `${format(port.pixels)} px`,
   `${format(port.remaining)} px`
  ]),
  margin: {top: 23, left: 12, right: 12, bottom: 17},
  styles: {font: 'OpenSans', fontStyle: 'normal', fontSize: 8, cellPadding: 2},
  headStyles: {fillColor: [35, 65, 72], fontStyle: 'normal'},
  rowPageBreak: 'avoid',
  willDrawPage: data => {
   if (data.pageNumber === 1) return;
   doc.setFont('OpenSans');
   doc.setFontSize(10);
   doc.setTextColor(36, 67, 79);
   doc.text(doc.splitTextToSize(`${name} · Signalo portai`, 273).slice(0, 2), 12, 13);
  },
  didParseCell: data => {
   if (data.section === 'body' && data.column.index === 0) {
    data.cell.styles.textColor = portColor(plan.ports[data.row.index].number);
   }
  }
 });
}
