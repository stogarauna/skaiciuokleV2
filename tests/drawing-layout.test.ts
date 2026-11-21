import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutFromDrawing} from '../src/lib/drawing-layout.ts';
import {screenCentreOffset} from '../src/lib/screen-alignment.ts';
import type {DrawingPoint as Point} from '../src/lib/drawing-project.ts';
import type {Screen} from '../src/lib/project.ts';

function screen(id: string, cols = 4, rows = 2, x = 0, y = 0): Screen {
 return {id, name: id, panel: {name:'LED',widthM:1,heightM:1,resX:100,resY:100,power:100,weightKg:5},
  cols, rows, removed:[], x, y};
}

function positioned(screens: Screen[], positions: Map<string,Point>) {
 return screens.map(s => ({...s, ...positions.get(s.id)}));
}

function near(a: number, b: number) {
 assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);
}

function assertSeparate(screens: Screen[]) {
 for (const [i,a] of screens.entries()) {
  for (const b of screens.slice(i + 1)) {
   const gap = 1 - 1e-7;
   assert.ok(a.x + a.cols*a.panel.widthM + gap <= b.x || b.x + b.cols*b.panel.widthM + gap <= a.x ||
    a.y + a.rows*a.panel.heightM + gap <= b.y || b.y + b.rows*b.panel.heightM + gap <= a.y,
    `Screens ${a.id} and ${b.id} overlap`);
  }
 }
}

test('the eight arena front pins preserve centre offsets in both image axes, independent of screen sizes', () => {
 const aspect = 2048/1448;
 const screens = [screen('hall-l',10,6),screen('wing-l',4,2),screen('portrait-l',2,4),screen('upper',5,2),
  screen('main',10,5),screen('portrait-r',2,4),screen('wing-r',4,2),screen('hall-r',10,6)];
 // Centres observed on the "ISO Front far" drawing, in source pixels.
 const centres = [[394,576],[810.5,780.5],[898,786],[1056,677.5],[1056,785.5],[1214.5,786.5],[1303.5,786.5],[1753.5,571.5]];
 const pins = new Map(screens.map((s,i)=>[s.id,{x:centres[i][0]/2048,y:centres[i][1]/1448}]));
 const result = layoutFromDrawing(screens,pins,aspect);
 assert.equal(result.size,8);
 const placed = positioned(screens,result);
 assertSeparate(placed);
 const centresM = placed.map(s=>({x:s.x+s.cols/2,y:s.y+s.rows/2}));
 const metresPerPixel = (centresM[7].x-centresM[0].x)/(centres[7][0]-centres[0][0]);
 assert.ok(metresPerPixel>0);
 centresM.forEach((centre,i)=>{
  near(centre.x-centresM[0].x, (centres[i][0]-centres[0][0])*metresPerPixel);
  near(centre.y-centresM[0].y, (centres[i][1]-centres[0][1])*metresPerPixel);
 });
 assert.deepEqual(layoutFromDrawing(placed,pins,aspect),result);
});

test('previously positioned and unmarked screens are left in place and clear of the pinned group', () => {
 const fixed = screen('keep',6,4,0,0);
 const a = screen('a'), b = screen('b');
 const screens = [fixed,a,b];
 const pins = new Map([['a',{x:.25,y:.5}],['b',{x:.75,y:.5}],['keep',{x:NaN,y:.8}]]);
 const result = layoutFromDrawing(screens,pins,1.5);
 assert.deepEqual([...result.keys()],['a','b']);
 assertSeparate(positioned(screens,result));
 const placed = positioned(screens,result);
 assert.deepEqual(layoutFromDrawing(placed,pins,1.5),result);
 assert.equal(placed[1].y,placed[2].y);
 assert.ok(placed[1].x < placed[2].x);
 assert.equal(a.x,0);
});

test('crowded and coincident marks stay separate without separating distant screens by kilometres', () => {
 const screens = [screen('a'),screen('b'),screen('c'),screen('d')];
 const pins = new Map([['a',{x:.51,y:.5}],['b',{x:.51,y:.5}],['c',{x:.51000001,y:.5}],['d',{x:.85,y:.5}]]);
 const result = layoutFromDrawing(screens,pins,2);
 assert.equal(result.size,4);
 assertSeparate(positioned(screens,result));
 assert.ok(result.get('d')!.x-result.get('a')!.x<55);
 assert.deepEqual(result,layoutFromDrawing([...screens].reverse(),pins,2));
});

test('placing sparse shapes uses the centre of occupied panels and legal project coordinates', () => {
 const a = screen('a',6,2,998,-1000), b = screen('b',6,2,999,-999);
 a.removed=['0,0','0,1','1,0','1,1','2,0','2,1','3,0','3,1'];
 const pins = new Map([['a',{x:.5,y:.2}],['b',{x:.5,y:.8}]]);
 const result = layoutFromDrawing([a,b],pins,1.5);
 assert.equal(result.size,2);
 const [first,second] = positioned([a,b],result);
 near(first.x+screenCentreOffset(first).x,second.x+screenCentreOffset(second).x);
 assertSeparate([first,second]);
 for(const p of result.values())assert.ok(Math.abs(p.x)<=1000&&Math.abs(p.y)<=1000);
 assert.deepEqual(layoutFromDrawing([a],new Map([['a',{x:.5,y:.5}]]),2).get('a'),{x:998,y:-1000});
 assert.equal(layoutFromDrawing([a],pins,0).size,0);
 assert.equal(layoutFromDrawing([a],new Map(),1.5).size,0);
});

test('an arrangement that cannot fit within the project returns no partial or out-of-range placements', () => {
 const screens = ['a','b','c','d'].map(id=>{
  const s = screen(id,100,1);
  s.panel.widthM=10;
  return s;
 });
 const pins = new Map(screens.map((s,i)=>[s.id,{x:i/3,y:.5}]));
 assert.equal(layoutFromDrawing(screens,pins,1.5).size,0);
});


test('calibrated plan centres keep their physical x/y spacing even much farther apart than their sizes', () => {
 const a=screen('a'), b=screen('b',8,4), pins=new Map([['a',{x:.2,y:.4}],['b',{x:.8,y:.7}]]);
 const positions=layoutFromDrawing([a,b],pins,2,500);
 assert.equal(positions.size,2);
 const [first,second]=positioned([a,b],positions);
 near(second.x+4-(first.x+2),600);
 near(second.y+2-(first.y+1),150);
});

test('a calibrated plan keeps real narrow gaps and separates genuinely overlapping screen footprints', () => {
 const a=screen('a'), b=screen('b');
 const pins=new Map([['a',{x:.2,y:.4}],['b',{x:.242,y:.4}]]);
 const narrow=layoutFromDrawing([a,b],pins,1,100);
 near(narrow.get('b')!.x-narrow.get('a')!.x,4.2);
 pins.set('b',{x:.215,y:.4});
 const overlapping=layoutFromDrawing([a,b],pins,1,100);
 near(overlapping.get('b')!.x-overlapping.get('a')!.x,4);
 near(overlapping.get('b')!.y,overlapping.get('a')!.y);
});
