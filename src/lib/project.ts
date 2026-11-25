import {validPlan,type Plan} from './transport.ts';
import {validateMounting,equipmentKeys,type Mounting,type EquipmentWeights} from './mounting.ts';
import {validateSignalSettings,type SignalSettings} from './signal.ts';
import {validatePowerSettings,type PowerSettings} from './power.ts';
import {angleIssue} from './geometry.ts';
import {validateFoh,type FohDiagram} from './foh-diagram.ts';
import {validDrawings,type DrawingProject} from './drawing-project.ts';
import {cabinetCounts,validMixed,type MixedPanels} from './mixed-panels.ts';
export interface Panel {
 name:string; resX:number; resY:number; widthM:number; heightM:number; depthM?:number|null; frameHalfKg?:number|null; frame1Kg?:number|null;
 power:number|null; weightKg:number|null; [key:string]:unknown;
}
export interface Screen { id:string; name:string; panel:Panel; cols:number; rows:number; removed:string[]; mixed?:MixedPanels; vwxSource?:{layerId:string;wallIds:string[];folded?:boolean}; x:number; y:number; curvature?:{angleDeg:number}; mounting?:Mounting; signal?:SignalSettings; powerRouting?:PowerSettings }
export interface Project { version:1; name:string; screens:Screen[]; equipmentWeights?:EquipmentWeights; fohDiagram?:FohDiagram; transport?:Plan; drawings?:DrawingProject }
export const uid=()=>globalThis.crypto.randomUUID();
export function makeScreen(panel:Panel,index=0):Screen { return {id:uid(),name:index===0?'Pagrindinis ekranas':`Ekranas ${index+1}`,panel:structuredClone(panel),cols:8,rows:5,removed:[],x:index*5,y:0}; }
export function stats(s:Screen){
 const removed=new Set(s.removed);
 const cells=Array.from({length:s.cols*s.rows},(_,i)=>({c:i%s.cols,r:Math.floor(i/s.cols)})).filter(({c,r})=>!removed.has(c+','+r));
 const slots=cells.length,left=slots?Math.min(...cells.map(p=>p.c)):0,right=slots?Math.max(...cells.map(p=>p.c))+1:0;
 const top=slots?Math.min(...cells.map(p=>p.r)):0,bottom=slots?Math.max(...cells.map(p=>p.r))+1:0;
 const counts=cabinetCounts(s,slots),n=counts.reduce((total,entry)=>total+entry.count,0);
 function summed(field:'weightKg'|'power'){
  if(!s.mixed&&s.panel[field]===null)return null;
  let total=0;
  for(const {panel,count} of counts){
   const value=panel[field];if(value===null)return null;
   total+=value*count;
  }
  return total;
 }
 return {cells,n,left,top,width:(right-left)*s.panel.widthM,height:(bottom-top)*s.panel.heightM,
  pxW:(right-left)*s.panel.resX,pxH:(bottom-top)*s.panel.resY,pixels:slots*s.panel.resX*s.panel.resY,
  area:slots*s.panel.widthM*s.panel.heightM,weight:summed('weightKg'),power:summed('power')};
}
function validPanel(m:Panel){
 return typeof m.name==='string'&&[m.resX,m.resY].every(n=>Number.isInteger(n)&&n>0&&n<=16384)
  &&[m.widthM,m.heightM].every(n=>Number.isFinite(n)&&n>0&&n<=10)
  &&[m.power,m.weightKg].every(n=>n===null||(Number.isFinite(n)&&n>=0));
}

export function parseProject(value:unknown,catalog:Panel[]=[]):Project {
 if(!value||typeof value!=='object')throw Error('Netinkamas projekto failas.');
 const p=value as Project;
 if(p.version!==1||typeof p.name!=='string'||!Array.isArray(p.screens)||p.screens.length>50)throw Error('Nepalaikomas projekto formatas.');
 if(p.equipmentWeights!==undefined&&(!p.equipmentWeights||equipmentKeys.some(k=>p.equipmentWeights![k]!==null&&(!Number.isFinite(p.equipmentWeights![k])||p.equipmentWeights![k]!<0))))throw Error('Netinkami įrangos svoriai.');
 if(p.fohDiagram!==undefined&&!validateFoh(p.fohDiagram))throw Error('Netinkami FOH signalo schemos duomenys.');
 if(p.transport!==undefined&&!validPlan(p.transport))throw Error('Netinkamas pakrovimo planas.');
 if(p.drawings!==undefined&&!validDrawings(p.drawings))throw Error('Netinkami brėžinių duomenys.');
 const ids=new Set<string>();
 for(const s of p.screens){
 if(!s||typeof s.id!=='string'||ids.has(s.id)||typeof s.name!=='string'||!s.panel||!Array.isArray(s.removed))throw Error('Netinkami ekrano duomenys.');ids.add(s.id);
 if(![s.cols,s.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=100)||s.cols*s.rows>5000||![s.x,s.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000))throw Error('Ekrano dydis arba vieta netinkami.');
 if(s.curvature!==undefined&&(!s.curvature||typeof s.curvature!=='object'||typeof s.curvature.angleDeg!=='number'))throw Error('Netinkami geometrijos duomenys.');
 if(s.mounting!==undefined&&!validateMounting(s.mounting))throw Error('Netinkami montavimo duomenys.');
 if(s.signal!==undefined&&!validateSignalSettings(s.signal))throw Error('Netinkamos signalo komutacijos parinktys.');
 if(s.powerRouting!==undefined&&!validatePowerSettings(s.powerRouting))throw Error('Netinkamos maitinimo komutacijos parinktys.');
 if(s.vwxSource!==undefined){
  const src=s.vwxSource;
  if(!src||typeof src.layerId!=='string'||!src.layerId||!Array.isArray(src.wallIds)||!src.wallIds.length
   ||!src.wallIds.every(id=>typeof id==='string'&&!!id)||new Set(src.wallIds).size!==src.wallIds.length
   ||(src.folded!==undefined&&typeof src.folded!=='boolean'))throw Error('Netinkamos VWX ekrano sekcijos.');
 }
 if(!validPanel(s.panel))throw Error('Netinkama panelio specifikacija.');
 if(!validMixed(s,validPanel))throw Error('Netinkamas mišrių panelių išdėstymas.');
 const issue=angleIssue(s);if(issue)throw Error(issue);
 if(s.removed.some(k=>typeof k!=='string'||!/^\d+,\d+$/.test(k)||Number(k.split(',')[0])>=s.cols||Number(k.split(',')[1])>=s.rows)||new Set(s.removed).size!==s.removed.length)throw Error('Netinkamas panelių išdėstymas.');
 }
 const project=structuredClone(p);
 project.screens=project.screens.map(screen=>({...screen,panel:resolvePanelDepth(screen.panel,catalog),
  ...(screen.mixed?{mixed:{...screen.mixed,large:resolvePanelDepth(screen.mixed.large,catalog)}}:{})}));
 return project;
}

// Use the current thickness for a matching catalog model, with a saved value as fallback.
export function resolvePanelDepth(panel:Panel,catalog:Panel[]=[]):Panel {
 const model=catalog.find(model=>model.name===panel.name&&model.widthM===panel.widthM&&model.heightM===panel.heightM&&typeof model.depthM==='number'&&Number.isFinite(model.depthM)&&model.depthM>0);
 if(model&&model.depthM!==panel.depthM)return {...panel,depthM:model.depthM};
 if(typeof panel.depthM==='number'&&Number.isFinite(panel.depthM)&&panel.depthM>0)return panel;
 return panel.depthM==null?panel:{...panel,depthM:undefined};
}
