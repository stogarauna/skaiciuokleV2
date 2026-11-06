import {angleIssue} from './geometry.ts';
export interface Panel {
 name:string; resX:number; resY:number; widthM:number; heightM:number;
 power:number|null; weightKg:number|null; [key:string]:unknown;
}
export interface Screen { id:string; name:string; panel:Panel; cols:number; rows:number; removed:string[]; x:number; y:number; curvature?:{angleDeg:number} }
export interface Project { version:1; name:string; screens:Screen[] }
export const uid=()=>globalThis.crypto.randomUUID();
export function makeScreen(panel:Panel,index=0):Screen { return {id:uid(),name:index===0?'Pagrindinis ekranas':`Ekranas ${index+1}`,panel:structuredClone(panel),cols:8,rows:5,removed:[],x:index*5,y:0}; }
export function stats(s:Screen){
 const cells=Array.from({length:s.cols*s.rows},(_,i)=>({c:i%s.cols,r:Math.floor(i/s.cols)})).filter(({c,r})=>!s.removed.includes(`${c},${r}`));
 const n=cells.length;const left=n?Math.min(...cells.map(p=>p.c)):0;const right=n?Math.max(...cells.map(p=>p.c))+1:0;
 const top=n?Math.min(...cells.map(p=>p.r)):0;const bottom=n?Math.max(...cells.map(p=>p.r))+1:0;
 return {cells,n,left,top,width:(right-left)*s.panel.widthM,height:(bottom-top)*s.panel.heightM,pxW:(right-left)*s.panel.resX,pxH:(bottom-top)*s.panel.resY,pixels:n*s.panel.resX*s.panel.resY,area:n*s.panel.widthM*s.panel.heightM,weight:s.panel.weightKg===null?null:n*s.panel.weightKg,power:s.panel.power===null?null:n*s.panel.power};
}
export function parseProject(value:unknown):Project {
 if(!value||typeof value!=='object')throw Error('Netinkamas projekto failas.');
 const p=value as Project;
 if(p.version!==1||typeof p.name!=='string'||!Array.isArray(p.screens)||p.screens.length<1||p.screens.length>50)throw Error('Nepalaikomas projekto formatas.');
 const ids=new Set<string>();
 for(const s of p.screens){
 if(!s||typeof s.id!=='string'||ids.has(s.id)||typeof s.name!=='string'||!s.panel||!Array.isArray(s.removed))throw Error('Netinkami ekrano duomenys.');ids.add(s.id);
 if(![s.cols,s.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=100)||s.cols*s.rows>5000||![s.x,s.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000))throw Error('Ekrano dydis arba vieta netinkami.');
 if(s.curvature!==undefined&&(!s.curvature||typeof s.curvature!=='object'||typeof s.curvature.angleDeg!=='number'))throw Error('Netinkami geometrijos duomenys.');
 const m=s.panel;
 if(typeof m.name!=='string'||![m.resX,m.resY].every(n=>Number.isInteger(n)&&n>0&&n<=16384)||![m.widthM,m.heightM].every(n=>Number.isFinite(n)&&n>0&&n<=10)||![m.power,m.weightKg].every(n=>n===null||(Number.isFinite(n)&&n>=0)))throw Error('Netinkama panelio specifikacija.');
 const issue=angleIssue(s);if(issue)throw Error(issue);
 if(s.removed.some(k=>typeof k!=='string'||!/^\d+,\d+$/.test(k)||Number(k.split(',')[0])>=s.cols||Number(k.split(',')[1])>=s.rows)||new Set(s.removed).size!==s.removed.length)throw Error('Netinkamas panelių išdėstymas.');
 }
 return structuredClone(p);
}
