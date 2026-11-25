import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneFromVwxBlocks} from '../src/lib/vwx-scene.ts';

let sequence=0;
function record(type:number, size:number, parent=0) {
 const r=Buffer.alloc(size);
 r.writeUInt32LE(size,0);
 r.writeUInt16BE(type,24);
 r.writeUInt32LE(parent,38);
 r.writeUInt32LE(++sequence,56);
 return r;
}

function layer(name:string, design:boolean) {
 const bytes=Buffer.from(name,'utf16le');
 const r=record(31,686+bytes.length);
 r.writeUInt16LE(design?1:0,322);
 r.writeUInt32LE(bytes.length,674);
 bytes.copy(r,678);
 return r;
}

function placed(parent:number,x:number,y:number,z:number) {
 const r=record(86,433,parent);
 [1000,80,500,0,0,0].forEach((v,i)=>r.writeDoubleLE(v,156+8*i));
 [1,0,0,0,1,0,0,0,1,x,y,z].forEach((v,i)=>r.writeDoubleLE(v,240+8*i));
 return r;
}

function equipment(parent:number,label:string,kind:string) {
 const fields=[label,'Modelis','','','','',kind,''].map(s=>Buffer.from(s,'utf16le'));
 const r=record(48,158+fields.reduce((s,f)=>s+f.length,0),parent);
 r.writeUInt16LE(8,84);
 let pos=158;
 fields.forEach((f,i)=>{
  r.writeUInt32LE(f.length,94+i*8);r.writeUInt32LE(pos-94,98+i*8);
  f.copy(r,pos);pos+=f.length;
 });
 return r;
}

async function* split(bytes:Buffer) {
 // Split length prefixes, data tables and large payloads across tiny blocks.
 for(let i=0;i<bytes.length;i+=37)yield bytes.subarray(i,i+37);
}

test('authored cabinet inherits its wall transform, edit copies and sheets are excluded',async()=>{
 const bytes=Buffer.concat([
  record(33,16023),
  layer('Rytinė siena',true),record(44,118,100),
  placed(100,3100,100,250),equipment(101,'','LED Wall'),
  placed(101,250,50,-100),equipment(102,'Bandomoji panelė','LED Panel'),
  record(11,204,101),record(44,118,103),placed(103,250,50,-100),equipment(104,'Dubliuota','LED Panel'),
  layer('Lapas',false),record(44,118,200),placed(200,0,0,0),equipment(201,'Kopija','LED Panel')
 ]);
 const scene=await sceneFromVwxBlocks('Test.vwx',split(bytes));
 assert.equal(scene.layers.length,1);
 assert.equal(scene.layers[0].name,'Rytinė siena');
 assert.equal(scene.panels.length,1);
 assert.equal(scene.panels[0].model,'Bandomoji panelė');
 assert.deepEqual(scene.panels[0].front[0],[3350,150,150]);
 assert.deepEqual(scene.panels[0].back[2],[4350,230,650]);
});

test('partial or invalid object fails before a scene can be committed',async()=>{
 const r=record(76,110);
 await assert.rejects(sceneFromVwxBlocks('bad.vwx',split(r.subarray(0,109))),/struktūros/);
 r.writeUInt32LE(0,0);
 await assert.rejects(sceneFromVwxBlocks('bad.vwx',split(r)),/struktūros/);
});
