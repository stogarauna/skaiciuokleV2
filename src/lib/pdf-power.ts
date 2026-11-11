import type {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {drawSignalMap} from './pdf-signal.ts';
import type {Screen} from './project.ts';
import {defaultPowerSettings, powerPlan, powerPlanIssue} from './power.ts';

const number = new Intl.NumberFormat('lt-LT', {maximumFractionDigits: 2});
const watts = (value: number) => number.format(value).replace(/\u00a0/g, ' ') + ' W';

export function appendPowerPage(doc: jsPDF, screen: Screen) {
 const settings = screen.powerRouting ?? defaultPowerSettings;
 const plan = powerPlan(screen, settings);
 const issue = powerPlanIssue(plan);
 doc.addPage();
 doc.setFont('OpenSans');
 doc.setTextColor(36, 67, 79);
 doc.setFontSize(15);
 doc.text('Maitinimo komutacija', 12, 16);
 doc.setFontSize(11);
 const name = doc.splitTextToSize(screen.name, 273).slice(0, 2);
 doc.text(name, 12, 24);

 const top = 25 + name.length * 5;
 const chartHeight = 85;
 const width = screen.cols * screen.panel.widthM;
 const height = screen.rows * screen.panel.heightM;
 const scale = Math.min(261 / width, (chartHeight - 8) / height);
 doc.setFillColor(247, 250, 252);
 doc.setDrawColor(214, 223, 231);
 doc.setLineWidth(0.15);
 doc.rect(12, top, 273, chartHeight, 'FD');
 drawSignalMap(doc, screen, plan, {
  x: (297 - width * scale) / 2, y: top + (chartHeight - height * scale) / 2,
  cellWidth: screen.panel.widthM * scale, cellHeight: screen.panel.heightM * scale
 }, undefined, 'M');

 const tableTop = top + chartHeight + 6;
 doc.setFontSize(8);
 doc.setTextColor(36, 67, 79);
 const total = plan.totalWatts === null ? 'nenurodyta' : watts(plan.totalWatts);
 doc.text(`Grandinės riba ${watts(settings.limitW)} · Bendra katalogo galia ${total}`, 12, tableTop);
 if (issue) {
  doc.text(doc.splitTextToSize(issue, 273), 12, tableTop + 5);
  return;
 }

 autoTable(doc, {
  startY: tableTop + 4,
  head: [['Grandinė', 'Įėjimo panelė', 'Panelių kiekis', 'Apkrova', 'Laisva']],
  body: plan.ports.map(port => [
   `M${port.number}`, String(port.cells[0].r * screen.cols + port.cells[0].c + 1),
   String(port.cells.length), watts(port.watts), watts(port.remaining)
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
   doc.text(doc.splitTextToSize(`${screen.name} · Maitinimo grandinės`, 273).slice(0, 2), 12, 13);
  }
 });
}
