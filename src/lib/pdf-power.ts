import type {jsPDF} from 'jspdf';
import {drawRouteEntries} from './pdf-routing.ts';
import {drawSignalMap} from './pdf-signal.ts';
import {physicalPanelNumber} from './signal-output.ts';
import type {Screen} from './project.ts';
import {powerPlanIssue, type powerPlan} from './power.ts';
import {stageboxOutlet, stageboxPowerSettings, type OutletAssignment} from './stagebox.ts';

const number = new Intl.NumberFormat('lt-LT', {maximumFractionDigits: 2});
const watts = (value: number) => number.format(value).replace(/\u00a0/g, ' ') + ' W';

export function appendPowerPage(doc: jsPDF, screen: Screen, plan: ReturnType<typeof powerPlan>,
 assignments?: Map<number, OutletAssignment>) {
 const settings = stageboxPowerSettings(screen);
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
 doc.text(`Grandinės riba ${watts(settings.limitW)} · Grandinių kiekis ${plan.ports.length}`, 12, tableTop);
 if (issue) {
  doc.text(doc.splitTextToSize(issue, 273), 12, tableTop + 5);
  return;
 }

 const entries=plan.ports.map(port=>{
  const start=physicalPanelNumber(screen,{row:0,column:0},port.cells[0]);
  const outlet=assignments?.get(port.number);
  return `M${port.number} → ${start} · ${watts(port.watts)}${outlet ? `\n${stageboxOutlet(outlet)}` : ''}`;
 });
 drawRouteEntries(doc,tableTop+4,`${screen.name} · Grandinė → įėjimo panelė · Apkrova`,entries);
}
