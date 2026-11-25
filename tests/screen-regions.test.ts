import assert from 'node:assert/strict';
import {test} from 'node:test';
import {screenRegions,regions} from '../src/lib/plan-recognition.ts';

function sheet(width:number,height:number,background=255){
 const data=new Uint8ClampedArray(width*height*4).fill(background);
 function rect(x:number,y:number,w:number,h:number,color:readonly number[]){
  for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)data.set(color,4*(row*width+col));
 }
 return {data,rect,read:()=>screenRegions(data,width,height)};
}
const cyan=[0,203,255,255],green=[214,255,227,255],black=[0,0,0,255];

test('a joined cross has three filled bands and separate side screens keep their bounds',()=>{
 const s=sheet(360,220);
 s.rect(20,20,16,20,cyan);s.rect(320,20,16,20,cyan);
 s.rect(168,40,24,108,cyan);s.rect(116,88,128,20,cyan);
 const [left,cross,right]=s.read().sort((a,b)=>a.x-b.x);
 assert.equal(left.bands,undefined);assert.equal(right.bands,undefined);
 assert.deepEqual(cross.bounds,{left:116/360,top:40/220,right:244/360,bottom:148/220});
 assert.deepEqual(cross.bands,[
  {left:52/128,top:0,right:76/128,bottom:48/108},
  {left:0,top:48/108,right:1,bottom:68/108},
  {left:52/128,top:68/108,right:76/128,bottom:1}
 ]);
 assert.deepEqual(regions(s.data,360,220,'screen'),s.read());
});

test('printed pale green panel cells group within each elevation, preserving space between screens',()=>{
 const s=sheet(240,180);
 for(const offset of [16,140]){
  s.rect(offset,30,45,60,green);
  for(let x=15;x<45;x+=15)s.rect(offset+x,30,1,60,black);
  for(let y=15;y<60;y+=15)s.rect(offset,30+y,45,1,black);
 }
 assert.equal(s.read().length,2);
 const photo=sheet(240,180,90);photo.rect(16,30,45,60,green);
 assert.equal(photo.read().length,0);
});

test('empty outlines and thin blue dimension lines are not filled LED screens',()=>{
 const s=sheet(240,180);
 s.rect(20,20,64,2,cyan);s.rect(20,20,2,64,cyan);
 s.rect(82,20,2,64,cyan);s.rect(20,82,64,2,cyan);
 s.rect(100,60,100,3,cyan);
 assert.deepEqual(s.read(),[]);
});
