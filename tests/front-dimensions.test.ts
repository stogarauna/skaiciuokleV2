import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectFrontScale} from '../src/lib/front-dimensions.ts';
import type {ScreenRegion} from '../src/lib/screen-regions.ts';

// Anti-aliased 17 px Liberation Sans Bold digits, as used by the fixture's CAD labels.
const font:Record<string,string>={
 '0':'05cee910 5ffdefb0 cf802ff4 ff300bf8 ff1009fa ff0009fb ff0009fb ff100afa ff300cf7 cf802ff3 4ffdffa0 05cfe810',
 '2':'18dfda20 bffdffe2 ef402ef7 00000cf8 00003ff6 0002dfc0 003efd20 04efc100 3efa0000 dfb00000 ffeeeeeb fffffffc',
 '3':'18dfda30 cffdffe2 ef303ff7 00000df7 00016ff3 009ffb40 008eff91 00002df8 000009fc ee201dfb effefff4 29dfeb40'
};
function fixture(rightLabel='3000',rightWidth=150,extensions=true){
 const width=540,height=240,data=new Uint8ClampedArray(width*height*4).fill(255);
 const regions:ScreenRegion[]=[];
 function ink(x:number,y:number,gray:number){
  const p=(y*width+x)*4;data.fill(gray,p,p+3);
 }
 for(const [left,len,label] of [[50,100,'2000'],[240,rightWidth,rightLabel]] as const){
  const right=left+len,top=100,bottom=200;
  regions.push({x:(left+right)/2/width,y:(top+bottom)/2/height,bounds:{left:left/width,right:right/width,top:top/height,bottom:bottom/height}});
  for(let x=left;x<=right;x++)ink(x,75,217);
  if(extensions)for(const x of [left,right])for(let y=71;y<=99;y++)ink(x,y,225);
  let x=Math.round((left+right)/2-19);
  for(const digit of label){
   for(const [y,line] of font[digit].split(' ').entries()){
    for(let col=0;col<line.length;col++)ink(x+col,52+y,255-17*parseInt(line[col],16));
   }
   x+=10;
  }
 }
 return {read:()=>detectFrontScale(data,width,height,regions)};
}
test('different centred millimetre dimensions give the common physical scale',()=>{
 assert.equal(fixture().read(),.02);
});
test('conflicting, unverified, and repeated dimensions leave the scale unresolved',()=>{
 assert.equal(fixture('3000',140).read(),undefined);
 assert.equal(fixture('2000',100).read(),undefined);
 assert.equal(fixture('3000',150,false).read(),undefined);
});
