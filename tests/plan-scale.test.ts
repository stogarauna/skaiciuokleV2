import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {detectPlanScale} from '../src/lib/plan-scale.ts';

// Only the 0–5 m ruler from an uploaded JPG. Each byte is one grayscale pixel.
const cropWidth=176,cropHeight=75;
const ruler=inflateSync(Buffer.from(`
eNrtmoGV2yAMhtmAETQCIzCCR2AERmAERmAERmAERmAEjeD+YCfBSey6ae6a64PmXi+WkT5+CeG73Dz/xME/Dok/alHM7yTh
b0kb/5yS4bd44Nei8edpv+fp63JSoo9PLueQ1+9SCLkPn301tSslhNSbuvccXdpS54uNEbFsCGK8RKvBjrejEZLc43UjXZOJ
kxZCXylmdiSl9AuBkkKF26SopSDPy3xBZDa6WDKLyUopbAfsq8flQsR3Oh/lMEgVSKV7dRF5WUQx0jgxXZRiMDovZZUOgY2T
V1N9b71US2BBgSj1gWiFTM0Ur3XDTmprQ9snSoRJuKOigo6IE+6uEpFY9C1EOavbmrNzpZCokYumlNUVipHMUhSVGsdKX0yf
t6pA05e9sDDfTNmokEujS6Q4CdV08sZM5AK+SsfNmgJ7ae94fbDrtSx0SVrFfichIZWXJRVA9dUfoX7zrkWcK1hXX1qZpq8R
noO41korOKljnRaQLUbyWvkIqUgIlJzvC0JRLG5xvJHfrwoUoUqe1AaKBLKHf4Jgoj43ltZCnHBLz+shVatfrrxzx4uq11bL
tpaA/1jIywbKAEO1uB5My4gt9MjrLrxS5dLrC3XXPDOWgprYdBeuwuJMnVBi7pY2LMtaMbUiNTDdeHEF+U5K1S0daZobL9d9
Aw9Y2h0vloGc+oe6brzMXOApq25DQl0LoGrChkK9XksbfSpXWeojgEX5m1uRRo0egKxn2CzmX6qNWztLDN5qikStfrm1E8+e
7CZLmBCk9uqhP6y8ycQySeukuS6xaKGtc5ywo2vrIF1uHUu6oGq+DMetWw7eGXQidhYmFdsu5Uu+VESvy8FmVtKvS8l1Y1jo
66XbJlAiv4+dw9ekB8xNCi0xXIsFoaQkiaimmqj130vkCb4MUkIzT4RS3riNyi3tw8DBrQvOpXZ0lEPtUh7eVesHxWnsAIWt
qbZ0Jbj4pNHlCAUS7sd55rs+mmOoA33Y4Y3fnG+8+GKjFrfl7iBN3Ex8Z8IJW0/QUDVP3ue1bcTCOeAr5lOPJXUvpyntnTRp
io9zeT3b3N7jA6N7PwtZgwWTN8+/vD5rnX8U4ZJ4/7Fj98jksDuL7zTfKNDr+K3PcPyWKDz//WMen7yBX/PwcT9M8lox/9mP
1vxZbvnnFMQYn/9bIf5Orjd4LDsjYxycfRk3PM5ZXvPBKfZk1jItn1wLbuadkY5mPZtQ2uuIdy9W4XxS3yPvL5mOIh+IeFrf
d/Me2V5bylk1voCXB+/gHbyDd/AO3sE7eAfv4B28g3fwDt7BO3gH7+AdvIN38H4P74tQ6eCjk/zupZz1fvB5Sw28FyC+Fuwk
bzlQI+f2So8jHnhP+yO/xLGV6ndW/tNZ7/kDiE8Y/C+pxqfpY4xxdvwCHdga1g==
`, 'base64'));

function blankPlan(){
 const width=900,height=510;
 return {width,height,pixels:new Uint8ClampedArray(width*height*4).fill(255)};
}

function placeRuler(plan:ReturnType<typeof blankPlan>,x:number,y:number,factor=1,source:Uint8Array=ruler){
 for(let row=0;row<cropHeight*factor;row++){
  for(let col=0;col<cropWidth*factor;col++){
   const gray=source[Math.floor(row/factor)*cropWidth+Math.floor(col/factor)];
   const offset=((y+row)*plan.width+x+col)*4;
   plan.pixels.fill(gray,offset,offset+3);
  }
 }
}

function readScale(plan:ReturnType<typeof blankPlan>){
 return detectPlanScale(plan.pixels,plan.width,plan.height);
}

test('a printed 0–5 m ruler supplies normalized endpoints at different positions and image sizes',()=>{
 for(const [x,y,factor] of [[180,65,1],[432,241,2]]){
  const plan=blankPlan();
  placeRuler(plan,x,y,factor);
  const scale=readScale(plan);
  assert.ok(scale);
  assert.equal(scale.metres,5);
  assert.ok(Math.abs(scale.start.x*plan.width-(x+9*factor))<=2*factor);
  assert.ok(Math.abs(scale.end.x*plan.width-(x+145*factor))<=2*factor);
  assert.ok(scale.start.y*plan.height>=y && scale.start.y*plan.height<y+cropHeight*factor);
  assert.ok(Math.abs(scale.end.y-scale.start.y)*plan.height<=factor);
 }
});

test('a blank sheet and evenly spaced marks without readable units cannot calibrate a plan',()=>{
 const plan=blankPlan();
 assert.equal(readScale(plan),undefined);
 const withoutUnit=Uint8Array.from(ruler);
 for(let y=0;y<25;y++)withoutUnit.fill(255,y*cropWidth+156,(y+1)*cropWidth);
 placeRuler(plan,200,65,1,withoutUnit);
 assert.equal(readScale(plan),undefined);

 // Replace "m" by "ft", keeping the numeric labels and all six ticks.
 const feet=Uint8Array.from(withoutUnit);
 const unit=['..###.....','.##....##.','.##....##.','####..####','.##....##.','.##....##.','.##....##.','.##....##.','.##....###'];
 unit.forEach((row,y)=>Array.from(row).forEach((pixel,x)=>{
  if(pixel==='#')feet[(y+8)*cropWidth+158+x]=24;
 }));
 placeRuler(plan,200,65,1,feet);
 assert.equal(readScale(plan),undefined);

 const geometryOnly=Uint8Array.from(ruler);
 geometryOnly.fill(255,0,cropWidth*25);
 placeRuler(plan,200,65,1,geometryOnly);
 assert.equal(readScale(plan),undefined);
});

test('two printed rulers with incompatible metres per pixel leave calibration unset',()=>{
 const plan=blankPlan();
 placeRuler(plan,100,65);
 placeRuler(plan,445,241,2);
 assert.equal(readScale(plan),undefined);
});

test('10, 20, … 50 m cannot be mistaken for 1.0, 2.0, … 5.0 m',()=>{
 const wholeNumbers=Uint8Array.from(ruler);
 for(let y=0;y<25;y++){
  for(const [start,end] of [[34,39],[61,66],[89,93],[116,120],[143,148]]){
   wholeNumbers.fill(255,y*cropWidth+start,y*cropWidth+end);
  }
 }
 const plan=blankPlan();
 placeRuler(plan,220,100,1,wholeNumbers);
 const scale=readScale(plan);
 if(scale)assert.equal(scale.metres,50);
});
