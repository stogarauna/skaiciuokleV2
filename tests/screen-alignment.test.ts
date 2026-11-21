import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen} from '../src/lib/project.ts';
import {screenCentreOffset,snapScreenPosition} from '../src/lib/screen-alignment.ts';

const panel={name:'500 × 1000',widthM:0.5,heightM:1,resX:128,resY:256,weightKg:8,power:170};

test('centres use the visible panel bounds, with a usable fallback for an empty screen',()=>{
 const screen={...makeScreen(panel),cols:4,rows:2,x:12,y:-5};
 assert.deepEqual(screenCentreOffset(screen),{x:1,y:1});
 screen.removed=['0,0'];
 assert.deepEqual(screenCentreOffset(screen),{x:1,y:1});
 screen.removed=['0,0','1,0','2,0','3,0','0,1'];
 assert.deepEqual(screenCentreOffset(screen),{x:1.25,y:1.5});
 screen.removed.push('1,1','2,1','3,1');
 assert.deepEqual(screenCentreOffset(screen),{x:1,y:1});
});

test('each axis picks its nearest screen centre and keeps exact fractional positions',()=>{
 const targets=[{x:5.46,y:-3},{x:5.375,y:9},{x:-1,y:2.25}];
 const result=snapScreenPosition({x:4.66,y:1.7},{x:.75,y:.5},targets,{x:.1,y:.1});
 assert.deepEqual(result,{x:4.625,y:1.75,guides:{x:5.375,y:2.25}});
});

test('a centre remains held near the capture boundary and releases after moving farther',()=>{
 const offset={x:.75,y:.5},targets=[{x:5.375,y:8}],tolerance={x:.1,y:.05};
 const near={x:4.76,y:2.04};
 const free=snapScreenPosition(near,offset,targets,tolerance);
 assert.deepEqual(free,{x:4.8,y:2,guides:{x:null,y:null}});
 const held=snapScreenPosition(near,offset,targets,tolerance,{x:5.375,y:null});
 assert.deepEqual(held,{x:4.625,y:2,guides:{x:5.375,y:null}});
 const released=snapScreenPosition({x:4.83,y:2.04},offset,targets,tolerance,held.guides);
 assert.deepEqual(released,{x:4.8,y:2,guides:{x:null,y:null}});
});

test('free movement is bounded to the positions a project can save and reopen',()=>{
 const result=snapScreenPosition({x:1001.27,y:-1002.41},{x:.25,y:.25},[],{x:.1,y:.1});
 assert.deepEqual(result,{x:1000,y:-1000,guides:{x:null,y:null}});
});
