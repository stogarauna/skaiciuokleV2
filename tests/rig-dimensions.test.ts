import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rigDimensionLayout,type RoofAxis} from '../src/lib/rig-dimensions.ts';

const axis:RoofAxis={orientation:'vertical',position:.5};
const center=(x:number,y:number)=>({x,y});

test('each numbered span is measured from the roof axis, including both sides and the centre',()=>{
 const w=2000,h=1400,marks=[.125,.2375,.35,.4625,.5,.5375,.65,.7625,.875].map(x=>center(x,.6));
 const result=rigDimensionLayout(w,h,.01,marks,axis);
 assert.deepEqual(result.dimensions.map(d=>d.mm),[7500,5250,3000,750,0,750,3000,5250,7500]);
 assert.deepEqual(result.axis,{x1:1000,x2:1000,y1:0,y2:1400});
 for(const [i,d] of result.dimensions.entries()){
  assert.equal(d.index,i);
  assert.equal(d.label.text,d.mm+' mm');
  const witness=d.lines[0];
  assert.equal(witness.x1,marks[i].x*w);
  assert.equal(witness.y1,marks[i].y*h);
  assert.equal(witness.x2,witness.x1);
  if(d.mm)assert.ok(d.lines.some(l=>l.x1===1000&&l.x2===witness.x1&&l.y1===l.y2));
 }
 const left=result.dimensions.filter(d=>d.index<4);
 assert.equal(new Set(left.map(d=>d.label.y)).size,4);
 assert.ok(left[0].label.y>left[1].label.y&&left[1].label.y>left[2].label.y);
});

test('independent rows stay near their marks and opposite sides can share a dimension line',()=>{
 const marks=[center(.2,.1),center(.8,.1),center(.2,.72),center(.8,.72)];
 const {dimensions}=rigDimensionLayout(1900,1050,.02,marks,axis);
 assert.equal(dimensions[0].label.y,dimensions[1].label.y);
 assert.equal(dimensions[2].label.y,dimensions[3].label.y);
 assert.ok(Math.abs(dimensions[0].label.y-105)<60);
 assert.ok(Math.abs(dimensions[2].label.y-756)<60);
 const shifted=rigDimensionLayout(1900,1050,.02,marks,{...axis,lane:.9});
 assert.ok(shifted.dimensions.every(d=>d.label.y>900));
 assert.deepEqual(shifted.dimensions.map(d=>d.mm),dimensions.map(d=>d.mm));
});

test('horizontal reference uses native height for distances and rotations, including on non-square images',()=>{
 const marks=[center(.8,.25),center(.4,.75)];
 const layout=rigDimensionLayout(2400,600,.02,marks,{orientation:'horizontal',position:.375});
 assert.deepEqual(layout.axis,{x1:0,y1:225,x2:2400,y2:225});
 assert.deepEqual(layout.dimensions.map(d=>d.mm),[1500,4500]);
 assert.ok(layout.dimensions.every(d=>d.label.angle===-90));
 assert.equal(layout.dimensions[0].lines[0].x1,.8*2400);
 assert.equal(layout.dimensions[0].lines[0].y1,.25*600);
});

test('sheet edges, zero distance and nearly coincident marks produce distinct, in-sheet callouts',()=>{
 const marks=[center(0,0),center(0,.0001),center(.0001,0),center(1,1),center(.999,1)];
 for(const orientation of ['horizontal','vertical'] as const){
  const layout=rigDimensionLayout(800,600,.01,marks,{orientation,position:0,lane:0});
  assert.equal(layout.dimensions.length,marks.length);
  assert.equal(layout.dimensions[0].mm,0);
  assert.notDeepEqual(layout.dimensions[0].label,layout.dimensions[1].label);
  for(const {label,lines} of layout.dimensions){
   const coords=[label,...lines.flatMap(l=>[center(l.x1,l.y1),center(l.x2,l.y2)])];
   assert.ok(coords.every(p=>p.x>=0&&p.y>=0&&p.x<=800&&p.y<=600));
  }
 }
});

test('a scale is required for lengths and invalid marks cannot contaminate others',()=>{
 const marks=[center(.1,.2),center(NaN,.1),center(.3,1.01),center(.9,.8)];
 assert.equal(rigDimensionLayout(1000,500,0,marks,axis).dimensions.length,0);
 assert.equal(rigDimensionLayout(1000,500,1,marks,{...axis,position:NaN}).axis,null);
 assert.equal(rigDimensionLayout(0,500,1,marks,axis).axis,null);
 const {dimensions}=rigDimensionLayout(1000,500,1,marks,axis);
 assert.deepEqual(dimensions.map(d=>d.index),[0,3]);
});
