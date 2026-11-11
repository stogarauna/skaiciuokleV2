import {supportLoads,supportModelNote,supportScopeNote} from './support-loads.ts';
import {mountingSummary} from './mounting.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { stats, type Project } from './project.ts';
import { geometry } from './geometry.ts';
import {signalPlan} from './signal.ts';
import {signalOutputs} from './signal-output.ts';
import {appendSignalPage,drawSignalMap} from './pdf-signal.ts';
const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n).replace(/\u00a0/g,' ');
export function createProjectPDF(project:Project,fontBase64:string,date=new Date()):jsPDF {
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.addFileToVFS('OpenSans.ttf',fontBase64);doc.addFont('OpenSans.ttf','OpenSans','normal');doc.setFont('OpenSans');
 doc.setProperties({title:project.name,subject:'LED ekranų brėžinys ir suvestinė',creator:'LED Studija'});
 doc.setFontSize(17);const titleLines=doc.splitTextToSize(project.name||'LED projektas',270).slice(0,2);doc.text(titleLines,12,15);
 const top=17+titleLines.length*7;
 doc.setFontSize(9);doc.setTextColor(85,100,115);doc.text(`LED ekranų suvestinė · ${date.toLocaleDateString('lt-LT',{timeZone:'Europe/Vilnius'})}`,12,top);
 const chartY=top+6,chartH=70;
 doc.setDrawColor(214,223,231);doc.setFillColor(247,250,252);doc.rect(12,chartY,273,chartH,'FD');
 const screens=project.screens;
 const outputPlans=screens.map(screen=>signalOutputs(screen));
 const minX=Math.min(...screens.map(s=>s.x)),minY=Math.min(...screens.map(s=>s.y));
 const maxX=Math.max(...screens.map(s=>s.x+s.cols*s.panel.widthM)),maxY=Math.max(...screens.map(s=>s.y+s.rows*s.panel.heightM));
 const scale=Math.min(255/Math.max(.1,maxX-minX),45/Math.max(.1,maxY-minY));
 const ox=148.5-(maxX-minX)*scale/2,oy=chartY+17+(45-(maxY-minY)*scale)/2;
 for(const [index,s] of screens.entries()){
  const t=stats(s),x=ox+(s.x-minX)*scale,y=oy+(s.y-minY)*scale,w=s.panel.widthM*scale,h=s.panel.heightM*scale;
  const output=outputPlans[index];
  const divided=output.parts.length>1;
  doc.setFontSize(7);doc.setTextColor(36,67,79);
  doc.text(doc.splitTextToSize(s.name,Math.max(8,w*s.cols)).slice(0,2),x,y-(divided?8:5));
  if(output.issue)drawSignalMap(doc,s,{...signalPlan(s),ports:[]},{x,y,cellWidth:w,cellHeight:h});
  for(const part of output.parts){
   const context=s.signal?.output?{original:s,part}:undefined;
   drawSignalMap(doc,part.screen,part.plan,{x:x+part.column*w,y:y+part.row*h,cellWidth:w,cellHeight:h},
    context);
  }
  if(divided){
   for(const part of output.parts){
    const label=`Dalis ${part.number}`;
    const partWidth=part.screen.cols*w;
    doc.setFontSize(7);
    const size=Math.min(7,7*(partWidth-1)/doc.getTextWidth(label));
    if(size<4)continue;
    doc.setFontSize(size);
    const center=x+(part.column+part.screen.cols/2)*w;
    const partTop=y+part.row*h;
    const labelY=part.row===0?partTop-2:partTop+part.screen.rows*h/2;
    if(part.row!==0){
     const width=doc.getTextWidth(label)+1;
     doc.setFillColor(247,250,252);
     doc.roundedRect(center-width/2,labelY-1.6,width,3.2,.45,.45,'F');
    }
    doc.setTextColor(36,67,79);
    doc.text(label,center,labelY,{align:'center',baseline:'middle'});
   }
  }
  doc.setFontSize(6);doc.setTextColor(60,75,88);doc.text(`${f(s.cols*s.panel.widthM)} × ${f(s.rows*s.panel.heightM)} m · ${t.pxW} × ${t.pxH} px`,x,y+s.rows*h+4);
 }
 const rows=screens.map(s=>{const t=stats(s),g=geometry(s);return [s.name+'\n'+s.panel.name,`${t.pxW} × ${t.pxH} px\n${f(t.pixels,0)} aktyvių px`,`${t.n}`,`${f(t.area)} m²`,t.weight===null?'Nenurodyta':`${f(t.weight)} kg`,t.power===null?'Nenurodyta':`${f(t.power/1000)} kW`,`${f(g.angle)}° / jungtis\n${f(g.width)} × ${f(g.depth)} m\nR: ${g.radius===null?'∞':f(g.radius)+' m'}`];});
 const totals=screens.map(stats).reduce((a,t)=>({n:a.n+t.n,area:a.area+t.area,weight:a.weight+(t.weight??0),power:a.power+(t.power??0),mw:a.mw||(t.n>0&&t.weight===null),mp:a.mp||(t.n>0&&t.power===null)}),{n:0,area:0,weight:0,power:0,mw:false,mp:false});
 rows.push(['VISO PROJEKTO','',String(totals.n),`${f(totals.area)} m²`,`${f(totals.weight)} kg${totals.mw?'\n(nepilna suma)':''}`,`${f(totals.power/1000)} kW${totals.mp?'\n(nepilna suma)':''}`,'']);
 autoTable(doc,{startY:chartY+chartH+6,head:[['Ekranas / modelis','Rezoliucija','Panelės','LED plotas','Panelių svoris','Galia pagal katalogą','Geometrija: plotis × gylis']],body:rows,margin:{left:12,right:12,bottom:25},styles:{font:'OpenSans',fontStyle:'normal',fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[35,65,72],fontStyle:'normal'},alternateRowStyles:{fillColor:[243,248,249]},rowPageBreak:'avoid',didParseCell:data=>{if(data.section==='body'&&data.row.index===rows.length-1)data.cell.styles.fillColor=[215,237,232];}});
 if(screens.some(s=>s.mounting?.mode==='hanging')){
 doc.addPage();doc.setFont('OpenSans');doc.setFontSize(15);doc.setTextColor(36,67,79);doc.text('Montavimas ir pakabinamas svoris',12,16);
 const mountingRows=screens.filter(s=>s.mounting?.mode==='hanging').flatMap(s=>{const summary=mountingSummary(s,project.equipmentWeights);return [...summary.issues.map(issue=>[s.name,issue,'','Nepilna suma']),...summary.lines.map(l=>[s.name,l.name,`${f(l.quantity)} ${l.unit}`,l.kg===null?'Nenurodyta':`${f(l.quantity*l.kg)} kg`]),[s.name,'IŠ VISO','',`${f(summary.total)} kg${summary.incomplete?' (nepilna suma)':''}`]];});
 autoTable(doc,{startY:23,head:[['Ekranas','Komplektacija','Kiekis','Svoris']],body:mountingRows,margin:{left:12,right:12,bottom:30},styles:{font:'OpenSans',fontStyle:'normal',fontSize:9},headStyles:{fillColor:[35,65,72],fontStyle:'normal'}});
 }
 for(const s of screens.filter(s=>s.mounting?.mode==='hanging')){
 const load=supportLoads(s,project.equipmentWeights);
 doc.addPage();doc.setFont('OpenSans');doc.setFontSize(15);doc.setTextColor(36,67,79);doc.text('Santvaros kabinimo taškų apkrovos',12,16);
 doc.setFontSize(10);doc.text(doc.splitTextToSize(s.name,270).slice(0,2),12,24);
 doc.setFontSize(8);doc.text(`Taškai: ${load.count} · Tarpai: ${load.spacing===null?'—':f(load.spacing)+' m'} · Nuo galų: ${f(load.offset)} m · Bendra modelio apkrova: ${load.total===null?'nenurodyta':f(load.total)+' kg'}`,12,39);
 doc.setDrawColor(80,130,140);doc.setLineWidth(2);doc.line(30,78,267,78);
 load.points.forEach(point=>{const x=30+237*point.x/load.width;doc.setLineWidth(.5);doc.line(x,57,x,78);doc.setFontSize(8);doc.text(point.name,x,49,{align:'center'});doc.text(point.kg===null?'Nenurodyta':f(point.kg)+' kg',x,54,{align:'center'});doc.text(f(point.x)+' m',x,86,{align:'center'});});
 autoTable(doc,{startY:94,head:[['Taškas','Vieta nuo kairiojo galo','Apkrovos dalis','Statinė apkrova']],body:load.points.map(p=>[p.name,f(p.x)+' m',load.ready?f(p.share*100)+' %':'Neskaičiuojama',p.kg===null?'Neskaičiuojama':f(p.kg)+' kg']),margin:{left:12,right:12,bottom:45},styles:{font:'OpenSans',fontStyle:'normal',fontSize:8,cellPadding:2},headStyles:{fillColor:[35,65,72],fontStyle:'normal'}});
 const end=(doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY;
 doc.setFontSize(7);doc.setTextColor(80,95,105);
 const notes=[...load.issues,supportModelNote,'Bendra komplektacijos masė laikoma tolygiai paskirstyta.',supportScopeNote];
 doc.text(doc.splitTextToSize(notes.join(' '),273),12,end+7);
 }
 const signalStart=doc.getNumberOfPages()+1;
 for(const [index,screen] of screens.entries())appendSignalPage(doc,screen,outputPlans[index]);
 const count=doc.getNumberOfPages();
 for(let i=1;i<=count;i++){doc.setPage(i);doc.setFont('OpenSans');doc.setFontSize(7);doc.setTextColor(90,105,115);if(i<signalStart)doc.text('Nurodytos komplektacijos masė ir modelio statinės apkrovos. Neįrašyta įranga ir dinaminės apkrovos neįtrauktos.',12,195);doc.text('LED Studija',12,201);doc.text(`${i} / ${count}`,285,201,{align:'right'});}
 return doc;
}
export function pdfFilename(name:string){return (name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,90)||'LED-projektas')+'-suvestine.pdf';}
