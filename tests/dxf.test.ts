import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cadEntities,createDXF,dxfFilename} from '../src/lib/dxf.ts';
import {makeScreen} from '../src/lib/project.ts';
import {geometry} from '../src/lib/geometry.ts';
const panel={name:'P2 YESTECH',widthM:.5,heightM:.5,resX:192,resY:192,power:145,weightKg:6.7,bendAngleMinDeg:-15,bendAngleMaxDeg:10};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('CAD panels use full physical millimetres and preserve project position and removed cells',()=>{
 const s=makeScreen(panel);s.cols=2;s.rows=2;s.x=3;s.y=1;s.removed=['1,0'];
 const entities=cadEntities([s],'Test'),panels=entities.filter(e=>e.type==='polyline');
 assert.equal(panels.length,3);
 if(panels[0].type!=='polyline')throw Error('Missing panel');
 assert.deepEqual(panels[0].points,[{x:3000,y:-1000},{x:3500,y:-1000},{x:3500,y:-1500},{x:3000,y:-1500}]);
 assert.equal(entities.filter(e=>e.type==='text'&&e.layer==='NUMERIAI'&&e.text==='2').length,1); // column label only, removed front panel omitted
 assert.ok(entities.some(e=>e.type==='text'&&e.text.replace(/\s/g,'')==='1000mm'));
});
test('top view reuses physical faceted geometry, mirrors bends and preserves empty columns',()=>{
 for(const angle of [-10,0,10]){
 const s=makeScreen(panel);s.cols=4;s.rows=2;s.curvature={angleDeg:angle};s.removed=['1,0','1,1'];
 const g=geometry(s),lines=cadEntities([s],'Test').filter(e=>e.type==='line'&&e.layer==='GEOMETRIJA');
 assert.equal(lines.length,3);
 for(const e of lines)if(e.type==='line')near(Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),500);
 const e=lines[1];if(e.type!=='line')throw Error('Missing line');
 near(e.b.x-e.a.x,(g.points[3].x-g.points[2].x)*1000);
 near(e.b.y-e.a.y,-(g.points[3].z-g.points[2].z)*1000);
 }
});
test('top view exports closed, measurable cabinet outlines with catalogue depth',()=>{
 for(const angle of [-10,0,10]){
  const s={...makeScreen({...panel,depthM:.0752}),cols:3,rows:2,curvature:{angleDeg:angle},removed:['1,0','1,1']};
  const outlines=cadEntities([s],'Test').filter(e=>e.type==='polyline'&&e.layer==='GEOMETRIJA');
  assert.equal(outlines.length,2);
  for(const outline of outlines){
   assert.equal(outline.type,'polyline');
   assert.ok(outline.closed);
   const [front,end,rearEnd,rear]=outline.points;
   near(Math.hypot(end.x-front.x,end.y-front.y),500);
   near(Math.hypot(rear.x-front.x,rear.y-front.y),75.2);
   near(Math.hypot(rearEnd.x-end.x,rearEnd.y-end.y),75.2);
   near((end.x-front.x)*(rear.x-front.x)+(end.y-front.y)*(rear.y-front.y),0);
   assert.ok(rear.y>front.y,'the cabinet extends behind the LED face');
  }
  if(angle===0)near(geometry(s).depth,.0752);
  assert.match(createDXF([s],'Test'),/0\r\nPOLYLINE\r\n8\r\nGEOMETRIJA\r\n66\r\n1\r\n70\r\n1\r\n/);
 }
});
test('R12 uses ASCII Unicode escapes and physical millimetre coordinates',()=>{
 const s=makeScreen(panel);s.name='Žąsų ekranas\n0\nEOF';const before=JSON.stringify(s);
 const dxf=createDXF([s],'Projektas');
 assert.ok(dxf.includes('visi matmenys mm'));
 assert.ok(!dxf.includes('$INSUNITS'));
 assert.ok(dxf.includes('1\r\nAC1009\r\n'));
 assert.ok(dxf.includes('\\U+017D\\U+0105s\\U+0173 ekranas 0 EOF'));
 assert.equal((dxf.match(/\r\nEOF\r\n/g)||[]).length,1);
 assert.ok(dxf.includes('2\r\nPANELES\r\n'));assert.ok(dxf.endsWith('0\r\nEOF\r\n'));
 assert.equal(JSON.stringify(s),before);
 assert.equal(dxfFilename('Ekranas / 1'),'Ekranas - 1-R12.dxf');
 assert.throws(()=>createDXF([],'Empty'));
});

test('R12 exports closed classic polylines without any modern DXF entity fields',()=>{
 const s=makeScreen(panel);s.cols=2;s.rows=2;
 const dxf=createDXF([s],'R12');
 assert.ok(!/[^\x00-\x7f]/.test(dxf),'file contains ASCII bytes only');
 const lines=dxf.split('\r\n');lines.pop();
 assert.equal(lines.length%2,0);
 const pairs:Array<[number,string]>=[];
 for(let i=0;i<lines.length;i+=2)pairs.push([Number(lines[i]),lines[i+1]]);
 assert.ok(!pairs.some(([code])=>[100,330,90].includes(code)),'no modern entity tags');
 const types=pairs.filter(([code])=>code===0).map(p=>p[1]);
 assert.equal(types.filter(t=>t==='POLYLINE').length,4);
 assert.equal(types.filter(t=>t==='VERTEX').length,16);
 assert.equal(types.filter(t=>t==='SEQEND').length,4);
 assert.ok(!types.includes('LWPOLYLINE'));
 assert.equal(types.at(-1),'EOF');
 const closed=pairs.filter(([code,value])=>code===70&&value==='1');
 assert.ok(closed.length>=4);
});

test('old null depth projects export separate thick segments and a signed angle at each joint',()=>{
 for(const angle of [-10,10]){
  const s={...makeScreen({...panel,depthM:null}),cols:4,rows:2,curvature:{angleDeg:angle}};
  const before=JSON.stringify(s);
  const entities=cadEntities([s],'Old project',[{...panel,depthM:.073}]);
  const outlines=entities.filter(e=>e.type==='polyline'&&e.layer==='GEOMETRIJA');
  assert.equal(outlines.length,4);
  for(const e of outlines){if(e.type!=='polyline')throw Error();assert.ok(e.closed);assert.equal(e.points.length,4);near(Math.hypot(e.points[3].x-e.points[0].x,e.points[3].y-e.points[0].y),73);}
  const angles=entities.filter(e=>e.type==='text'&&e.layer==='KAMPAI');
  assert.equal(angles.length,3);
  assert.ok(angles.every(e=>e.type==='text'&&e.text.replace('−','-')===`${angle}°`));
  const directions=outlines.map(e=>{if(e.type!=='polyline')throw Error();return Math.atan2(e.points[1].y-e.points[0].y,e.points[1].x-e.points[0].x);});
  for(let i=1;i<directions.length;i++)near((directions[i]-directions[i-1])*180/Math.PI,-angle);
  assert.equal(JSON.stringify(s),before);
  assert.ok(!createDXF([s],'Old project',[{...panel,depthM:.073}]).includes('\r\nARC\r\n'));
 }
});
test('joint labels do not bridge removed columns',()=>{
 const s={...makeScreen({...panel,depthM:.073}),cols:4,rows:1,removed:['1,0'],curvature:{angleDeg:10}};
 assert.equal(cadEntities([s],'Test').filter(e=>e.type==='text'&&e.layer==='KAMPAI').length,1);
});
