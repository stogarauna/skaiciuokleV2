import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPixelMap} from '../src/lib/pixel-map.ts';
import type {Screen} from '../src/lib/project.ts';

test('pixel mapping preserves the native cabinet grid and encodes the requested format', async t => {
 const screen: Screen = {
  id: 'map', name: 'Main / LED', cols: 58, rows: 18, x: 7, y: 3,
  panel: {name: 'P4', widthM: .5, heightM: .5, resX: 104, resY: 104, weightKg: null, power: null},
  removed: ['0,0', '25,12', '57,17']
 };
 const rectangles: {x:number; y:number; width:number; height:number; color:string}[] = [];
 const ctx = {
  fillStyle: '',
  fillRect(x:number, y:number, width:number, height:number) {
   rectangles.push({x,y,width,height,color:this.fillStyle});
  },
  beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fillText() {},
  measureText(text:string) {return {width:text.length * 10};}
 };
 let fallback = false;
 const encoded: {width:number; height:number; mime:string; quality?:number}[] = [];
 const canvas = {
  width: 0, height: 0,
  getContext: () => ctx,
  toBlob(callback:(image:Blob|null)=>void, mime:string, quality?:number) {
   encoded.push({width:this.width,height:this.height,mime,quality});
   callback(new Blob(['image'], {type:fallback?'image/png':mime}));
  }
 };
 const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
 Object.defineProperty(globalThis, 'document', {configurable:true,value:{createElement:()=>canvas}});
 t.after(() => {
  if (original) Object.defineProperty(globalThis, 'document', original);
  else Reflect.deleteProperty(globalThis, 'document');
 });

 const png = await createPixelMap(screen, 'png');
 const jpg = await createPixelMap(screen, 'jpg');
 assert.equal(png.filename, 'Main - LED-6032x1872.png');
 assert.equal(jpg.filename, 'Main - LED-6032x1872.jpg');
 assert.deepEqual(encoded, [
  {width:6032,height:1872,mime:'image/png',quality:undefined},
  {width:6032,height:1872,mime:'image/jpeg',quality:1}
 ]);
 function colorAt(x:number, y:number) {
  return rectangles.findLast(rect =>
   x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height)?.color;
 }
 assert.equal(colorAt(9, 90), '#000');
 assert.equal(colorAt(113, 9), '#bc5928');
 assert.equal(colorAt(217, 9), '#3b06f4');
 assert.equal(colorAt(2609, 1257), '#000');
 assert.equal(colorAt(6020, 1857), '#000');
 assert.equal(colorAt(104, 9), '#fff');
 assert.equal(canvas.width, 0);

 fallback = true;
 await assert.rejects(createPixelMap(screen, 'jpg'), /pasirinktu formatu/);
});
