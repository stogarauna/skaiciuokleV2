import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectRigSymbols, type RigSymbolColour} from '../src/lib/rig-symbols.ts';

const width=220, height=130;
function paper(){return new Uint8ClampedArray(width*height*4).fill(255);}
function ink(data:Uint8ClampedArray,x:number,y:number,c:RigSymbolColour){
 const i=(y*width+x)*4;
 if(c==='blue')data.set([0,24,156,255],i);
 else data.set([230,48,42,255],i);
}
function symbol(data:Uint8ClampedArray,cx:number,cy:number,r:number,c:RigSymbolColour,style:'standard'|'mirrored'|'gap'){
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const distance=Math.hypot(dx,dy);
  if(distance>r)continue;
  const quarter=style==='mirrored'?dx*dy<0:dx*dy>0;
  if(style==='gap'&&(dx===0||dy===0))continue;
  if(quarter||(style==='mirrored'&&distance>r-1))ink(data,cx+dx,cy+dy,c);
 }
}
test('separates red and blue checker circles; resolves two detached quarters to one centre',()=>{
 const data=paper();
 symbol(data,31,26,10,'blue','gap');
 symbol(data,73,44,11,'blue','standard');
 symbol(data,168,97,9,'red','mirrored');
 // A motor pictogram of the same colour touches the symbol from above.
 for(let dy=0;dy<17;dy++)for(let dx=-5;dx<=5;dx++)
  if(dy===0||dy===16||Math.abs(dx)===5)ink(data,73+dx,18+dy,'blue');
 const groups=detectRigSymbols(data,width,height);
 for(const [c,expected] of [['blue',[[31,26],[73,44]]],['red',[[168,97]]]] as const){
  assert.equal(groups[c].length,expected.length);
  for(const [x,y] of expected)assert.ok(groups[c].some(p=>Math.hypot(p.x*width-x-.5,p.y*height-y-.5)<1.55));
 }
});
test('lines, hollow rings, solid discs, rectangles and crosses are not quadrant markers',()=>{
 const data=paper();
 for(let dy=-10;dy<=10;dy++)for(let dx=-10;dx<=10;dx++){
  const distance=Math.hypot(dx,dy);
  if(distance<10&&distance>8)ink(data,22+dx,30+dy,'blue');
  if(distance<10)ink(data,62+dx,30+dy,'blue');
  if(Math.abs(dx)<5)ink(data,100+dx,30+dy,'red');
  if(Math.abs(dx)<2||Math.abs(dy)<2)ink(data,150+dx,30+dy,'red');
 }
 for(let x=6;x<210;x++)ink(data,x,80,'red');
 assert.deepEqual(detectRigSymbols(data,width,height),{blue:[],red:[]});
 assert.deepEqual(detectRigSymbols(data,width+1,height),{blue:[],red:[]});
});
test('numbers slightly uneven rows from left to right without merging consecutive small vertical offsets',()=>{
 const data=paper();
 const expected=[[80,42],[115,40],[149,41],[30,46],[180,44],[25,85],[100,83]];
 for(const [x,y] of expected)symbol(data,x,y,9,'blue','standard');
 const points=detectRigSymbols(data,width,height).blue;
 assert.equal(points.length,expected.length);
 for(const [i,[x,y]] of expected.entries()){
  assert.ok(Math.hypot(points[i].x*width-x-.5,points[i].y*height-y-.5)<1.55);
 }
});
