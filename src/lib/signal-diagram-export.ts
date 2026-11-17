import {anchor,cablePath,cardWidth,deviceHeight,getEnd,headerHeight,rowHeight,signalColor,zoneName,type FohDiagram} from './foh-diagram.ts';

const xml=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]??char));
const short=(text:string,max:number)=>text.length>max?text.slice(0,max-1)+'…':text;

export function diagramSvg(graph:FohDiagram,title:string,showLabels:boolean,showUnused:boolean){
 const width=Math.max(520,...graph.devices.map(d=>d.x+cardWidth+24),...graph.cables.map(c=>(c.bend??0)+24));
 const height=Math.max(260,...graph.devices.map(d=>d.y+deviceHeight(d)+24))+50;
 const list=[
  '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">',
  '<rect width="100%" height="100%" fill="#111923"/>',
  '<g font-family="Arial,sans-serif" fill="#edf4fb"><text x="24" y="32" font-size="20" font-weight="bold">'+xml(title)+'</text>',
  '<g transform="translate(0 50)">'
 ];
 for(const cable of graph.cables){
  const from=getEnd(graph,cable.from),to=getEnd(graph,cable.to);
  if(!from||!to)continue;
  const a=anchor(from),b=anchor(to),color=signalColor[from.port.signal];
  list.push('<path d="'+cablePath(a,b,cable.bend)+'" stroke="'+color+'" stroke-width="2" fill="none"'+(cable.role==='backup'?' stroke-dasharray="6 4"':'')+'/>');
  if(showLabels)list.push('<text x="'+(b.x-8)+'" y="'+(b.y-6)+'" text-anchor="end" font-size="11" fill="'+color+'">'+xml(cable.id)+'</text>');
 }
 const occupied=new Set(graph.cables.flatMap(cable=>[cable.from,cable.to]).map(end=>JSON.stringify([end.device,end.port])));
 for(const device of graph.devices){
  list.push('<g transform="translate('+device.x+' '+device.y+')">',
   '<rect width="'+cardWidth+'" height="'+deviceHeight(device)+'" rx="8" fill="#1c2734" stroke="#42566e"/>',
   '<rect width="'+cardWidth+'" height="'+headerHeight+'" rx="8" fill="#253549"/>',
   '<text x="10" y="24" font-size="14" font-weight="bold">'+xml(short(device.name,23))+'</text>',
   '<text x="10" y="43" font-size="11" fill="#a8bacb">'+xml(short(zoneName(graph,device.zone)+' · '+device.model,28))+'</text>');
  for(const side of ['in','out'] as const){
   const ports=device.ports.filter(p=>p.direction===side);
   for(const [index,port] of ports.entries()){
    const used=occupied.has(JSON.stringify([device.id,port.id]));
    if(!used&&!showUnused)continue;
    const x=side==='in'?0:cardWidth,y=headerHeight+rowHeight*(index+.5);
    const color=signalColor[port.signal];
    list.push('<circle cx="'+x+'" cy="'+y+'" r="4" stroke="'+color+'" fill="'+(used?color:'#1c2734')+'"/>',
     '<text x="'+(side==='in'?9:cardWidth-9)+'" y="'+(y+4)+'" text-anchor="'+(side==='in'?'start':'end')+'" font-size="10">'+xml(short(port.name,14))+'</text>');
   }
  }
  list.push('</g>');
 }
 list.push('</g></g></svg>');
 return {width,height,markup:list.join('')};
}

export async function exportDiagram(graph:FohDiagram,title:string,format:'svg'|'png'|'pdf',showLabels:boolean,showUnused:boolean){
 const {width,height,markup}=diagramSvg(graph,title,showLabels,showUnused);
 const svg=new Blob([markup],{type:'image/svg+xml;charset=utf-8'});
 if(format==='svg')return svg;
 const url=URL.createObjectURL(svg);
 try{
  const img=new Image();
  img.src=url;
  await img.decode();
  const canvas=document.createElement('canvas');
  const scale=Math.min(2,4096/Math.max(width,height));
  canvas.width=Math.max(1,Math.round(width*scale));
  canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas unavailable');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  if(format==='pdf'){
   const {jsPDF}=await import('jspdf');
   const pdf=new jsPDF({orientation:width>=height?'landscape':'portrait',format:'a3'});
   const pageWidth=pdf.internal.pageSize.getWidth(),pageHeight=pdf.internal.pageSize.getHeight();
   const ratio=Math.min((pageWidth-20)/canvas.width,(pageHeight-20)/canvas.height);
   pdf.addImage(canvas,'PNG',10,10,canvas.width*ratio,canvas.height*ratio);
   return pdf.output('blob');
  }
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG unavailable')),'image/png'));
 }finally{URL.revokeObjectURL(url);}
}
