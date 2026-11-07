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
export function supportLoads(screen:Screen,weights?:EquipmentWeights){
 const count=screen.mounting?.supportCount??2,shares=supportShares[count];
 if(!shares)throw Error('Pasirinkite nuo 2 iki 8 kabinimo taškų.');
 const summary=mountingSummary(screen,weights),width=hangingPlan(screen).width;
 const issues:string[]=[];
 if(summary.mode!=='hanging')issues.push('Pasirinkite kabinamą ekraną.');
 if(width<=0)issues.push('Ekrane nėra aktyvių panelių.');
 if(summary.incomplete)issues.push('Trūksta komplektacijos duomenų arba naudojamų dalių svorių.');
 if(screen.removed.length)issues.push('Šis tolygios apkrovos modelis netaikomas ekranui su išimtomis panelėmis.');
 if(screen.curvature?.angleDeg)issues.push('Šis tiesios santvaros modelis netaikomas lenktam ekranui.');
 const ready=issues.length===0,total=ready?summary.total:null;
 const points=shares.map((share,i)=>({name:`T${i+1}`,x:width*i/(count-1),share,kg:total===null?null:total*share}));
 return {count,width,total,ready,issues,points,peak:total===null?null:total*Math.max(...shares),spacing:width/(count-1)};
}
export const supportModelNote='DashMaster: tiesi vienodo standumo santvara, tolygi apkrova, vienodo aukščio taškai vienodais tarpais, kraštiniai taškai ties galais, be iškyšų.';
export const supportScopeNote='Apskaičiuotos statinės apkrovos pagal nurodytą komplektaciją. Variklių, grandinių, kabelių ir kitos neįrašytos įrangos svoris bei dinaminės apkrovos neįtraukti. Tai nėra leistinos apkrovos patikra.';
