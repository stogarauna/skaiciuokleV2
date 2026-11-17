import type {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Place multiple route entries on each row so the drawing has room. */
export function drawRouteEntries(doc:jsPDF, startY:number, heading:string, entries:string[]) {
 const columns=3;
 const body=[];
 for(let i=0;i<entries.length;i+=columns){
  body.push(Array.from({length:columns},(_,column)=>entries[i+column]??''));
 }
 if(!body.length)return;
 autoTable(doc,{
  startY,body,
  head:[[{content:heading,colSpan:columns}]],
  margin:{top:12,left:12,right:12,bottom:14},
  styles:{font:'OpenSans',fontStyle:'normal',fontSize:8,cellPadding:1.4,cellWidth:91},
  headStyles:{fillColor:[35,65,72]},
  rowPageBreak:'avoid'
 });
}
