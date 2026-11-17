import {supportLoads,supportScopeNote} from './support-loads.ts';
import {mountingSummary} from './mounting.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { stats, type Project } from './project.ts';
import {powerPlan,powerPlanIssue} from './power.ts';
import {signalPlan} from './signal.ts';
import {signalOutputs} from './signal-output.ts';
import {appendSignalPage,drawSignalMap} from './pdf-signal.ts';
import {appendPowerPage} from './pdf-power.ts';
const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n).replace(/\u00a0/g,' ');
export function createProjectPDF(project:Project,fontBase64:string,date=new Date()):jsPDF {
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.addFileToVFS('OpenSans.ttf',fontBase64);doc.addFont('OpenSans.ttf','OpenSans','normal');doc.setFont('OpenSans');
 doc.setProperties({title:project.name,subject:'LED ekranų brėžinys ir suvestinė',creator:'LED Studija'});
 doc.setFontSize(17);const titleLines=doc.splitTextToSize(project.name||'LED projektas',270).slice(0,2);doc.text(titleLines,12,15);
 const top=15+titleLines.length*6;
 doc.setFontSize(9);doc.setTextColor(85,100,115);doc.text(`LED ekranų suvestinė · ${date.toLocaleDateString('lt-LT',{timeZone:'Europe/Vilnius'})}`,12,top);
 const chartY=top+5,chartH=62;
 doc.setDrawColor(214,223,231);doc.setFillColor(247,250,252);doc.rect(12,chartY,273,chartH,'FD');
 const screens=project.screens;
 const outputPlans=screens.map(screen=>signalOutputs(screen));
 const powerPlans=screens.map(screen=>powerPlan(screen));
 const minX=Math.min(...screens.map(s=>s.x)),minY=Math.min(...screens.map(s=>s.y));
 const maxX=Math.max(...screens.map(s=>s.x+s.cols*s.panel.widthM)),maxY=Math.max(...screens.map(s=>s.y+s.rows*s.panel.heightM));
 const scale=Math.min(255/Math.max(.1,maxX-minX),42/Math.max(.1,maxY-minY));
 const ox=148.5-(maxX-minX)*scale/2,oy=chartY+13+(42-(maxY-minY)*scale)/2;
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
  doc.setFontSize(6);doc.setTextColor(60,75,88);doc.text(`${f(s.cols*s.panel.widthM)} × ${f(s.rows*s.panel.heightM)} m · ${t.pxW} × ${t.pxH} px · ${t.n} vnt.`,x,y+s.rows*h+4);
 }
 const equipment=new Map<string,{name:string;quantity:number;unit:string}>();
 const mountingIssues:string[][]=[];
 const hangingScreens=screens.filter(screen=>screen.mounting?.mode==='hanging');
 for(const screen of screens){
  const summary=mountingSummary(screen,project.equipmentWeights);
  for(const line of summary.lines){
   let name=line.name;
   // Cabinets and hanging frames must be picked by their compatible model.
   if(name==='LED panelės'||name.startsWith('Pakabinimo rėmai'))name+=` · ${screen.panel.name}`;
   const key=name+'\0'+line.unit;
   equipment.set(key,{name,quantity:(equipment.get(key)?.quantity??0)+line.quantity,unit:line.unit});
  }
  for(const issue of summary.issues)mountingIssues.push([`${screen.name} · ${issue}`,'']);
 }
 const quantityRows=Array.from(equipment.values(),item=>[item.name,`${f(item.quantity)} ${item.unit}`]);
 const signalCount=outputPlans.reduce((sum,output)=>sum+output.parts.reduce((count,part)=>count+part.plan.ports.length,0),0);
 const powerCount=powerPlans.reduce((sum,plan)=>sum+plan.ports.length,0);
 quantityRows.push(['Signalo portai',`${f(signalCount,0)} vnt.`],['Maitinimo grandinės',`${f(powerCount,0)} vnt.`]);
 const routingIncomplete=outputPlans.some(output=>output.issue||output.parts.some(part=>part.plan.ports.reduce((sum,port)=>sum+port.cells.length,0)<part.plan.cells.length))||powerPlans.some(powerPlanIssue);
 if(routingIncomplete)quantityRows.push(['Komutacija nepilna. Žr. ekranų brėžinius.','']);
 autoTable(doc,{
  startY:chartY+chartH+4,head:[['Reikalinga įranga ir jungtys','Kiekis']],body:[...quantityRows,...mountingIssues],
  margin:{top:12,left:12,right:12,bottom:14},
  styles:{font:'OpenSans',fontStyle:'normal',fontSize:9,cellPadding:1.25},
  headStyles:{fillColor:[35,65,72]},columnStyles:{1:{halign:'right',cellWidth:42}},
  rowPageBreak:'avoid'
 });
 let rigY=(doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+6;
 for(const screen of hangingScreens){
  const load=supportLoads(screen,project.equipmentWeights);
  doc.setFont('OpenSans');doc.setFontSize(7);
  const notes=doc.splitTextToSize([...load.issues,'Modelis: tiesi vienodo standumo santvara, tolygi apkrova, vienodo aukščio taškai vienodais tarpais.',supportScopeNote].join(' '),273) as string[];
  const title=doc.splitTextToSize(`${screen.name} · Santvaros kabinimo taškų apkrovos`,273).slice(0,2) as string[];
  const topOffset=title.length*5;
  const blockHeight=topOffset+27+notes.length*3.5;
  if(rigY+blockHeight>194){doc.addPage();rigY=14;}
  doc.setTextColor(36,67,79);doc.setFontSize(11);doc.text(title,12,rigY);
  const diagramY=rigY+topOffset;
  doc.setFontSize(8);
  doc.text(`Bendra apkrova: ${load.total===null?'nenurodyta':f(load.total)+' kg'} · Vieta nuo kairiojo galo`,12,diagramY);
  doc.setDrawColor(80,130,140);doc.setLineWidth(1);doc.line(30,diagramY+17,267,diagramY+17);
  for(const [index,point] of load.points.entries()){
   const x=load.width>0?30+237*point.x/load.width:30+237*index/(load.count-1);
   doc.setLineWidth(.4);doc.line(x,diagramY+14,x,diagramY+17);
   doc.text(point.name,x,diagramY+8,{align:'center'});
   doc.text(point.kg===null?'—':f(point.kg)+' kg',x,diagramY+13,{align:'center'});
   doc.text(f(point.x)+' m',x,diagramY+22,{align:'center'});
  }
  doc.setFontSize(7);doc.setTextColor(80,95,105);doc.text(notes,12,diagramY+27);
  rigY+=blockHeight+7;
 }
 for(const [index,screen] of screens.entries())appendSignalPage(doc,screen,outputPlans[index]);
 for(const screen of screens)appendPowerPage(doc,screen);
 const count=doc.getNumberOfPages();
 for(let i=1;i<=count;i++){doc.setPage(i);doc.setFont('OpenSans');doc.setFontSize(7);doc.setTextColor(90,105,115);doc.text('LED Studija',12,201);doc.text(`${i} / ${count}`,285,201,{align:'right'});}
 return doc;
}
export function pdfFilename(name:string){return (name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,90)||'LED-projektas')+'-suvestine.pdf';}
