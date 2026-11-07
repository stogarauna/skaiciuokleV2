import {mountingSummary} from './mounting.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { stats, type Project } from './project.ts';
import { geometry } from './geometry.ts';
const f=(n:number,d=2)=>new Intl.NumberFormat('lt-LT',{maximumFractionDigits:d}).format(n).replace(/\u00a0/g,' ');
export function createProjectPDF(project:Project,fontBase64:string,date=new Date()):jsPDF {
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.addFileToVFS('OpenSans.ttf',fontBase64);doc.addFont('OpenSans.ttf','OpenSans','normal');doc.setFont('OpenSans');
 doc.setProperties({title:project.name,subject:'LED ekranų brėžinys ir suvestinė',creator:'LED Studija'});
 doc.setFontSize(17);const titleLines=doc.splitTextToSize(project.name||'LED projektas',270).slice(0,2);doc.text(titleLines,12,15);
 const top=17+titleLines.length*7;
 doc.setFontSize(9);doc.setTextColor(85,100,115);doc.text(`LED ekranų suvestinė · ${date.toLocaleDateString('lt-LT',{timeZone:'Europe/Vilnius'})}`,12,top);
 doc.setFontSize(8);doc.text('Ištiesintos ekranų išklotinės. Lenkto ekrano gabaritai pateikti lentelėje.',12,top+6);
 const chartY=top+10,chartH=70;
 doc.setDrawColor(214,223,231);doc.setFillColor(247,250,252);doc.rect(12,chartY,273,chartH,'FD');
 const screens=project.screens;
 const minX=Math.min(...screens.map(s=>s.x)),minY=Math.min(...screens.map(s=>s.y));
 const maxX=Math.max(...screens.map(s=>s.x+s.cols*s.panel.widthM)),maxY=Math.max(...screens.map(s=>s.y+s.rows*s.panel.heightM));
 const scale=Math.min(255/Math.max(.1,maxX-minX),45/Math.max(.1,maxY-minY));
 const ox=148.5-(maxX-minX)*scale/2,oy=chartY+17+(45-(maxY-minY)*scale)/2;
 for(const s of screens){
  const t=stats(s),x=ox+(s.x-minX)*scale,y=oy+(s.y-minY)*scale,w=s.panel.widthM*scale,h=s.panel.heightM*scale;
  doc.setFontSize(7);doc.setTextColor(36,67,79);doc.text(doc.splitTextToSize(s.name,Math.max(8,w*s.cols)).slice(0,2),x,y-5);
  const removed=new Set(s.removed);doc.setDrawColor(68,130,133);doc.setFillColor(208,235,230);doc.setLineWidth(.1);
  for(let r=0;r<s.rows;r++)for(let c=0;c<s.cols;c++){if(removed.has(`${c},${r}`))continue;doc.setFillColor(208,235,230);doc.rect(x+c*w,y+r*h,w,h,'FD');if(w>=5&&h>=5){doc.setFontSize(5);doc.text(String(r*s.cols+c+1),x+(c+.5)*w,y+(r+.5)*h+0.7,{align:'center'});}}
  doc.setFontSize(6);doc.setTextColor(60,75,88);doc.text(`${f(s.cols*s.panel.widthM)} × ${f(s.rows*s.panel.heightM)} m · ${t.pxW} × ${t.pxH} px`,x,y+s.rows*h+4);
 }
 const rows=screens.map(s=>{const t=stats(s),g=geometry(s);return [s.name+'\n'+s.panel.name,`${t.pxW} × ${t.pxH} px\n${f(t.pixels,0)} aktyvių px`,`${t.n}`,`${f(t.area)} m²`,t.weight===null?'Nenurodyta':`${f(t.weight)} kg`,t.power===null?'Nenurodyta':`${f(t.power/1000)} kW`,`${f(g.angle)}° / jungtis\n${f(g.width)} × ${f(g.depth)} m\nR: ${g.radius===null?'∞':f(g.radius)+' m'}`];});
 const totals=screens.map(stats).reduce((a,t)=>({n:a.n+t.n,area:a.area+t.area,weight:a.weight+(t.weight??0),power:a.power+(t.power??0),mw:a.mw||(t.n>0&&t.weight===null),mp:a.mp||(t.n>0&&t.power===null)}),{n:0,area:0,weight:0,power:0,mw:false,mp:false});
 rows.push(['VISO PROJEKTO','',String(totals.n),`${f(totals.area)} m²`,`${f(totals.weight)} kg${totals.mw?'\n(nepilna suma)':''}`,`${f(totals.power/1000)} kW${totals.mp?'\n(nepilna suma)':''}`,'']);
 autoTable(doc,{startY:chartY+chartH+6,head:[['Ekranas / modelis','Rezoliucija','Panelės','LED plotas','Panelių svoris','Galia pagal katalogą','Geometrija: plotis × gylis']],body:rows,margin:{left:12,right:12,bottom:25},styles:{font:'OpenSans',fontStyle:'normal',fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[35,65,72],fontStyle:'normal'},alternateRowStyles:{fillColor:[243,248,249]},rowPageBreak:'avoid',didParseCell:data=>{if(data.section==='body'&&data.row.index===rows.length-1)data.cell.styles.fillColor=[215,237,232];}});
 if(screens.some(s=>s.mounting?.mode==='hanging')){
 doc.addPage();doc.setFont('OpenSans');doc.setFontSize(15);doc.setTextColor(36,67,79);doc.text('Montavimas ir pakabinamas svoris',12,16);
 const mountingRows=screens.filter(s=>s.mounting?.mode==='hanging').flatMap(s=>{const summary=mountingSummary(s,project.equipmentWeights);return [...summary.lines.map(l=>[s.name,l.name,`${f(l.quantity)} ${l.unit}`,l.kg===null?'Nenurodyta':`${f(l.quantity*l.kg)} kg`]),[s.name,'IŠ VISO','',`${f(summary.total)} kg${summary.incomplete?' (nepilna suma)':''}`]];});
 autoTable(doc,{startY:23,head:[['Ekranas','Komplektacija','Kiekis','Svoris']],body:mountingRows,margin:{left:12,right:12,bottom:30},styles:{font:'OpenSans',fontStyle:'normal',fontSize:9},headStyles:{fillColor:[35,65,72],fontStyle:'normal'}});
 }
 const count=doc.getNumberOfPages();
 for(let i=1;i<=count;i++){doc.setPage(i);doc.setFont('OpenSans');doc.setFontSize(7);doc.setTextColor(90,105,115);doc.text('Nurodytos komplektacijos masė; neįrašyta įranga ir kabinimo taškų apkrovos neįtrauktos.',12,195);doc.text('LED Studija',12,201);doc.text(`${i} / ${count}`,285,201,{align:'right'});}
 return doc;
}
export function pdfFilename(name:string){return (name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,90)||'LED-projektas')+'-suvestine.pdf';}
