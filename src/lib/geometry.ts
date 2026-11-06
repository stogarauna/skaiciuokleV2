import type { Panel, Screen } from './project';
export interface BendLimits { min:number; max:number; status:'supported'|'fixed'|'unknown'; note:string }
export function bendLimits(p:Panel):BendLimits {
 if(p.bendAngleText==='Nesilenkia')return {min:0,max:0,status:'fixed',note:'Šio modelio panelės nesilenkia.'};
 const min=p.bendAngleMinDeg,max=p.bendAngleMaxDeg;
 if(typeof min==='number'&&typeof max==='number'&&Number.isFinite(min)&&Number.isFinite(max)&&min<=0&&max>=0&&min>=-90&&max<=90){return {min,max,status:min===0&&max===0?'fixed':'supported',note:'Ribos pagal panelio katalogą. Patikrinkite užraktų žingsnį ir kryptis.'};}
 return {min:0,max:0,status:'unknown',note:'Lenkimo ribos nepatikslintos. Kataloge įrašykite vieną min. ir max. kampą.'};
}
export function angleIssue(s:Screen,angle=s.curvature?.angleDeg??0):string|null{
 if(!Number.isFinite(angle))return 'Kampas turi būti skaičius.';
 if(angle===0)return null;
 if(s.cols<2)return 'Lenkimui reikia bent dviejų panelių stulpelių.';
 const limits=bendLimits(s.panel);
 if(limits.status!=='supported')return limits.note;
 if(angle<limits.min-1e-8||angle>limits.max+1e-8)return `Leistinas kampas nuo ${limits.min}° iki ${limits.max}°.`;
 if(s.cols*Math.abs(angle)>360+1e-8)return 'Lankas negali viršyti 360°. Sumažinkite kampą arba stulpelių kiekį.';
 return null;
}
export function geometry(s:Screen){
 const angle=s.curvature?.angleDeg??0,a=angle*Math.PI/180,w=s.panel.widthM;
 const vertices=[{x:0,z:0}];
 for(let i=0;i<s.cols;i++){const theta=(i-(s.cols-1)/2)*a;const p=vertices[i];vertices.push({x:p.x+w*Math.cos(theta),z:p.z+w*Math.sin(theta)});}
 const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x));
 const minZ=Math.min(...vertices.map(p=>p.z)),maxZ=Math.max(...vertices.map(p=>p.z));
 const points=vertices.map(p=>({x:p.x-(minX+maxX)/2,z:p.z}));
 const last=vertices.at(-1)!;
 return {angle,points,width:maxX-minX,depth:maxZ-minZ,chord:Math.hypot(last.x,last.z),minZ,maxZ,surfaceWidth:s.cols*w,radius:Math.abs(a)<1e-10?null:w/(2*Math.sin(Math.abs(a)/2)),turn:Math.max(0,s.cols-1)*Math.abs(angle),span:s.cols*Math.abs(angle),closed:Math.abs(s.cols*Math.abs(angle)-360)<1e-7};
}
