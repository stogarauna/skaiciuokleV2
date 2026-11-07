import {frameWeights} from './legacy-equipment.ts';
import {stats,type Screen} from './project.ts';
export const equipmentKeys=['truss30','trussF45','shackle','sling1','sling2','sling3'] as const;
export type EquipmentKey=typeof equipmentKeys[number];
export type EquipmentWeights=Record<EquipmentKey,number|null>;
export const emptyWeights=():EquipmentWeights=>({truss30:null,trussF45:null,shackle:null,sling1:null,sling2:null,sling3:null});
// Previous quantity fields remain readable for older JSON projects; current totals use hangingPlan.
export interface Mounting {mode:'standing'|'hanging';truss:'truss30'|'trussF45';length:number;shackles:number;sling1:number;sling2:number;sling3:number;frames:number;frameKg:number|null;frameLength?:0.5|1;slingLength?:1|2|3;frame1Kg?:number|null;frameHalfKg?:number|null}
export const catalogWeights=():EquipmentWeights=>({truss30:3.3,trussF45:14.22,shackle:.6,sling1:1.1,sling2:1.8,sling3:null});
export function frameWeight(name:string,length:0.5|1){return frameWeights[name]?.[length===.5?0:1]??null;}
export const defaultMounting=():Mounting=>({mode:'standing',truss:'truss30',length:0,shackles:0,sling1:0,sling2:0,sling3:0,frames:0,frameKg:null});
export function hangingPlan(s:Screen){
 const width=stats(s).width,halfUnits=Math.round(width*2);
 const supported=Math.abs(width*2-halfUnits)<1e-7;
 const fullFrames=supported?Math.floor(halfUnits/2):0;
 const halfFrames=supported?halfUnits%2:0;
 return {width,fullFrames,halfFrames,attachments:fullFrames*2+halfFrames,supported};
}
export function selectedSlingLength(m:Mounting):1|2|3{return m.slingLength??(m.sling3>0?3:m.sling2>0?2:1);}
export function hangingFrameWeight(s:Screen,length:0.5|1){
 const m=s.mounting;
 const override=length===1?m?.frame1Kg:m?.frameHalfKg;
 return override!==undefined?override:frameWeight(s.panel.name,length);
}
export function mountingSummary(s:Screen,weights:EquipmentWeights=catalogWeights()){
 const m=s.mounting??defaultMounting(),t=stats(s),plan=hangingPlan(s);
 const lines=[{name:'LED panelės',quantity:t.n,unit:'vnt.',kg:s.panel.weightKg}];
 const issues:string[]=[];
 if(m.mode==='hanging'){
 const sling=selectedSlingLength(m);
 if(!plan.supported)issues.push('Ekrano plotis nesidalija iš 0,5 m. Reikia patikslinti pakabinimo rėmų komplektaciją.');
 lines.push(
 {name:`Santvara ${m.truss==='truss30'?'30':'F45'}`,quantity:plan.width,unit:'m',kg:weights[m.truss]},
 {name:'Šekeliai',quantity:plan.attachments,unit:'vnt.',kg:weights.shackle},
 {name:`Stropai ${sling} m`,quantity:plan.attachments,unit:'vnt.',kg:weights[`sling${sling}`]},
 {name:'Pakabinimo rėmai 1 m',quantity:plan.fullFrames,unit:'vnt.',kg:hangingFrameWeight(s,1)},
 {name:'Pakabinimo rėmai 0,5 m',quantity:plan.halfFrames,unit:'vnt.',kg:hangingFrameWeight(s,.5)});
 }
 const active=lines.filter(l=>l.quantity>0);
 return {lines:active,total:active.reduce((sum,l)=>sum+l.quantity*(l.kg??0),0),incomplete:issues.length>0||active.some(l=>l.kg===null),mode:m.mode,issues};
}
export function validateMounting(m:Mounting){
 const optionalWeight=(v:unknown)=>v===undefined||v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);
 return !!m&&(m.slingLength===undefined||[1,2,3].includes(m.slingLength))&&optionalWeight(m.frame1Kg)&&optionalWeight(m.frameHalfKg)&&(m.frameLength===undefined||m.frameLength===.5||m.frameLength===1)&&['standing','hanging'].includes(m.mode)&&['truss30','trussF45'].includes(m.truss)&&Number.isFinite(m.length)&&m.length>=0&&m.length<=1000&&[m.shackles,m.sling1,m.sling2,m.sling3,m.frames].every(n=>Number.isInteger(n)&&n>=0&&n<=10000)&&(m.frameKg===null||(Number.isFinite(m.frameKg)&&m.frameKg>=0));
}
