import {hangingPlan,mountingSummary,type EquipmentWeights} from './mounting.ts';
import type {Screen} from './project.ts';
// DashMaster.xlsx, “15. Beam Even Load Distribution”, K7:R19.
// Ideal continuous beam: uniform load, constant stiffness, equally spaced level supports,
// end supports at the beam ends, no overhang. Rounded coefficients preserved from the source.
export const supportShares:Record<number,readonly number[]>={
 2:[.5,.5],3:[.1875,.625,.1875],4:[.133,.367,.367,.133],
 5:[.098,.286,.232,.286,.098],6:[.079,.226,.195,.195,.226,.079],
 7:[.066,.189,.16,.17,.16,.189,.066],8:[.056,.162,.138,.144,.144,.138,.162,.056]
};
// Equal-span continuous Euler-Bernoulli beam, with equal uniformly loaded overhangs.
// Clapeyron: M[i-1] + 4 M[i] + M[i+1] = -q h²/2.
// End moments come from each overhang: -q a²/2. Unit total load -> reaction fractions.
export function continuousBeamShares(width:number,count:number,offset:number):number[]{
 if(!Number.isFinite(width)||!Number.isFinite(offset)||width<=0||offset<0||2*offset>=width||!Number.isInteger(count)||count<2||count>8)throw Error('Netinkama kabinimo taškų geometrija.');
 const h=(width-2*offset)/(count-1),q=1/width,end=-q*offset*offset/2;
 const moments=Array<number>(count).fill(end),unknown=count-2;
 if(unknown){
 const diagonal=Array<number>(unknown).fill(4),rhs=Array<number>(unknown).fill(-q*h*h/2);
 rhs[0]-=end;rhs[unknown-1]-=end;
 for(let i=1;i<unknown;i++){const factor=1/diagonal[i-1];diagonal[i]-=factor;rhs[i]-=factor*rhs[i-1];}
 moments[count-2]=rhs[unknown-1]/diagonal[unknown-1];
 for(let i=unknown-2;i>=0;i--)moments[i+1]=(rhs[i]-moments[i+2])/diagonal[i];
 }
 const reactions=Array<number>(count).fill(0);reactions[0]=reactions[count-1]=q*offset;
 for(let i=0;i<count-1;i++){
 const left=q*h/2+(moments[i+1]-moments[i])/h;
 reactions[i]+=left;reactions[i+1]+=q*h-left;
 }
 return reactions;
}
export function supportLoads(screen:Screen,weights?:EquipmentWeights){
 const count=screen.mounting?.supportCount??2,offset=screen.mounting?.supportOffset??0.5;
 if(!supportShares[count])throw Error('Pasirinkite nuo 2 iki 8 kabinimo taškų.');
 const summary=mountingSummary(screen,weights),width=hangingPlan(screen).width;
 const issues:string[]=[];
 if(summary.mode!=='hanging')issues.push('Pasirinkite kabinamą ekraną.');
 if(width<=0)issues.push('Ekrane nėra aktyvių panelių.');
 if(summary.incomplete)issues.push('Trūksta komplektacijos duomenų arba naudojamų dalių svorių.');
 if(screen.removed.length)issues.push('Šis tolygios apkrovos modelis netaikomas ekranui su išimtomis panelėmis.');
 if(screen.curvature?.angleDeg)issues.push('Šis tiesios santvaros modelis netaikomas lenktam ekranui.');
 const geometryValid=Number.isFinite(offset)&&offset>=0&&width>2*offset;
 if(!geometryValid)issues.push('Santvara per trumpa pasirinktam atstumui nuo kraštų. Sumažinkite atstumą arba padidinkite plotį.');
 const shares=geometryValid?continuousBeamShares(width,count,offset):[];
 if(shares.some(v=>v<=1e-10))issues.push('Šiai schemai reikia neigiamos arba nulinės taško reakcijos: ne visi pakabinimo taškai liktų įtempti. Keiskite taškų skaičių arba atstumą nuo kraštų.');
 const ready=issues.length===0,total=ready?summary.total:null;
 const points=shares.map((share,i)=>({name:`T${i+1}`,x:offset+(width-2*offset)*i/(count-1),share,kg:total===null?null:total*share}));
 return {count,width,offset,total,ready,issues,points,peak:total===null?null:total*Math.max(...shares),spacing:geometryValid?(width-2*offset)/(count-1):null};
}
export const supportModelNote='Ištisinės sijos modelis (trijų momentų lygtis): tiesi vienodo standumo santvara, tolygi apkrova per visą ilgį ir abi iškyšas, vienodo aukščio taškai vienodais tarpais, vienodas kraštinių taškų atstumas nuo galų.';
export const supportScopeNote='Apskaičiuotos statinės apkrovos pagal nurodytą komplektaciją. Variklių, grandinių, kabelių ir kitos neįrašytos įrangos svoris bei dinaminės apkrovos neįtraukti. Tai nėra leistinos apkrovos patikra.';
