import {frameWeights} from './legacy-equipment.ts';
import {stats,type Screen} from './project.ts';
export const equipmentKeys=['truss30','trussF45','shackle','sling1','sling2','sling3'] as const;
export type EquipmentKey=typeof equipmentKeys[number];
export type EquipmentWeights=Record<EquipmentKey,number|null>;
export const emptyWeights=():EquipmentWeights=>({truss30:null,trussF45:null,shackle:null,sling1:null,sling2:null,sling3:null});
export interface Mounting {mode:'standing'|'hanging';truss:'truss30'|'trussF45';length:number;shackles:number;sling1:number;sling2:number;sling3:number;frames:number;frameKg:number|null;frameLength?:0.5|1}
export const catalogWeights=():EquipmentWeights=>({truss30:3.3,trussF45:14.22,shackle:.6,sling1:1.1,sling2:1.8,sling3:null});
export function frameWeight(name:string,length:0.5|1){return frameWeights[name]?.[length===.5?0:1]??null;}
export const defaultMounting=():Mounting=>({mode:'standing',truss:'truss30',length:0,shackles:0,sling1:0,sling2:0,sling3:0,frames:0,frameKg:null});
export function mountingSummary(s:Screen,weights:EquipmentWeights=catalogWeights()){
 const m=s.mounting??defaultMounting(),t=stats(s);
 const lines=[{name:'LED panelės',quantity:t.n,unit:'vnt.',kg:s.panel.weightKg}];
 if(m.mode==='hanging')lines.push(
 {name:`Santvara ${m.truss==='truss30'?'30':'F45'}`,quantity:m.length,unit:'m',kg:weights[m.truss]},
 {name:'Šekeliai',quantity:m.shackles,unit:'vnt.',kg:weights.shackle},
 ...([1,2,3] as const).map(n=>({name:`Stropai ${n} m`,quantity:m[`sling${n}`],unit:'vnt.',kg:weights[`sling${n}`]})),
 {name:`Pakabinimo rėmai ${m.frameLength??0.5} m`,quantity:m.frames,unit:'vnt.',kg:m.frameKg});
 const active=lines.filter(l=>l.quantity>0);
 return {lines:active,total:active.reduce((sum,l)=>sum+l.quantity*(l.kg??0),0),incomplete:active.some(l=>l.kg===null),mode:m.mode};
}
export function validateMounting(m:Mounting){
 return !!m&&(m.frameLength===undefined||m.frameLength===.5||m.frameLength===1)&&['standing','hanging'].includes(m.mode)&&['truss30','trussF45'].includes(m.truss)&&Number.isFinite(m.length)&&m.length>=0&&m.length<=1000&&[m.shackles,m.sling1,m.sling2,m.sling3,m.frames].every(n=>Number.isInteger(n)&&n>=0&&n<=10000)&&(m.frameKg===null||(Number.isFinite(m.frameKg)&&m.frameKg>=0));
}
