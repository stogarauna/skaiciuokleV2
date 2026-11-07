import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScreen,parseProject,type Screen} from '../src/lib/project.ts';
import {defaultMounting,catalogWeights,type Mounting} from '../src/lib/mounting.ts';
import {supportLoads,supportShares,continuousBeamShares} from '../src/lib/support-loads.ts';
const screen=():Screen & {mounting:Mounting}=>({...makeScreen({name:'Test',resX:192,resY:192,widthM:.5,heightM:.5,power:100,weightKg:0}),mounting:{...defaultMounting(),mode:'hanging',frame1Kg:0,frameHalfKg:0}});
const weights={...catalogWeights(),truss30:250,shackle:0,sling1:0};
test('continuous beam matches DashMaster reference at zero overhang within its coefficient rounding',()=>{
 for(let n=2;n<=8;n++){
 const shares=continuousBeamShares(4,n,0);
 assert.ok(Math.abs(shares.reduce((sum,v)=>sum+v,0)-1)<1e-10);
 for(let i=0;i<n;i++)assert.ok(Math.abs(shares[i]-supportShares[n][i])<.001);
 }
 assert.deepEqual(continuousBeamShares(4,2,0),[.5,.5]);
 assert.deepEqual(continuousBeamShares(4,3,0),[.1875,.625,.1875]);
});
test('0.5m overhang positions and analytic three-support reactions',()=>{
 const s=screen();s.mounting.supportCount=3;s.mounting.supportOffset=.5;
 const result=supportLoads(s,weights);
 assert.equal(result.total,1000);assert.equal(result.spacing,1.5);
 assert.deepEqual(result.points.map(p=>p.x),[.5,2,3.5]);
 assert.deepEqual(result.points.map(p=>p.kg),[296.875,406.25,296.875]);
 s.mounting.supportCount=2;s.mounting.supportOffset=1;
 assert.deepEqual(supportLoads(s,weights).points.map(p=>p.x),[1,3]);
 assert.deepEqual(supportLoads(s,weights).points.map(p=>p.kg),[500,500]);
});
test('offsets change reactions without changing assembly weight; widths and catalog update loads',()=>{
 const s=screen();s.cols=12;s.mounting.supportCount=3;s.mounting.supportOffset=.5;
 const before=supportLoads(s,weights);
 s.mounting.supportOffset=1;const after=supportLoads(s,weights);
 assert.equal(before.total,1500);assert.equal(after.total,1500);assert.notEqual(before.peak,after.peak);
 assert.equal(after.spacing,2);assert.deepEqual(after.points.map(p=>p.x),[1,3,5]);
 assert.equal(supportLoads(s,{...weights,truss30:100}).total,600);
});
test('short or slack-support layouts never present valid kilograms',()=>{
 const s=screen();s.cols=2;
 let result=supportLoads(s,weights);assert.equal(result.ready,false);assert.equal(result.spacing,null);assert.deepEqual(result.points,[]);
 s.cols=8;s.mounting.supportOffset=1;s.mounting.supportCount=3;
 result=supportLoads(s,weights);assert.equal(result.total,null);assert.ok(result.issues.some(i=>i.includes('reakcijos')));assert.ok(result.points.every(p=>p.kg===null));
});
test('unknown and unsupported loads never become apparently complete kilograms',()=>{
 const s=screen();
 for(const patch of [{panel:{...s.panel,weightKg:null}},{curvature:{angleDeg:5}},{removed:['0,0']}]){
 const result=supportLoads({...s,...patch},weights);assert.equal(result.ready,false);assert.equal(result.total,null);assert.equal(result.peak,null);assert.ok(result.issues.length);assert.ok(result.points.every(p=>p.kg===null));
 }
 s.mounting.slingLength=3;assert.equal(supportLoads(s,weights).ready,false);
 s.mounting.mode='standing';assert.equal(supportLoads(s,weights).ready,false);
});
test('support count is optional for old projects, persists and rejects unsupported imports',()=>{
 const s=screen(),p={version:1,name:'Test',screens:[s]};
 assert.equal(supportLoads(s,weights).count,2);
 s.mounting.supportCount=7;s.mounting.supportOffset=1;assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))),p);
 for(const n of [0,1,9,2.5,null,'3',NaN])assert.throws(()=>parseProject({...p,screens:[{...s,mounting:{...s.mounting,supportCount:n}}]}));
});

test('offset validation rejects unsupported values',()=>{const s=screen();for(const v of [0,-1,.25,2,null,'1',NaN])assert.throws(()=>parseProject({version:1,name:'X',screens:[{...s,mounting:{...s.mounting,supportOffset:v}}]}));});

// Independent verification using assembled Euler-Bernoulli finite elements.
function femReactions(width:number,count:number,offset:number){
 const xs=[0,...Array.from({length:count},(_,i)=>offset+(width-2*offset)*i/(count-1)),width];
 const size=xs.length*2,K=Array.from({length:size},()=>Array<number>(size).fill(0)),F=Array<number>(size).fill(0);
 for(let e=0;e<xs.length-1;e++){
 const l=xs[e+1]-xs[e],local=[[12,6*l,-12,6*l],[6*l,4*l*l,-6*l,2*l*l],[-12,-6*l,12,-6*l],[6*l,2*l*l,-6*l,4*l*l]];
 const force=[-l/(2*width),-l*l/(12*width),-l/(2*width),l*l/(12*width)];
 for(let i=0;i<4;i++){F[2*e+i]+=force[i];for(let j=0;j<4;j++)K[2*e+i][2*e+j]+=local[i][j]/l**3;}
 }
 const fixed=new Set(Array.from({length:count},(_,i)=>2*(i+1))),free=Array.from({length:size},(_,i)=>i).filter(i=>!fixed.has(i));
 const A=free.map(i=>[...free.map(j=>K[i][j]),F[i]]),n=free.length;
 for(let c=0;c<n;c++){
 let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[pivot][c]))pivot=r;
 [A[c],A[pivot]]=[A[pivot],A[c]];
 for(let r=c+1;r<n;r++){const factor=A[r][c]/A[c][c];for(let j=c;j<=n;j++)A[r][j]-=factor*A[c][j];}
 }
 const u=Array<number>(size).fill(0);
 for(let r=n-1;r>=0;r--){let value=A[r][n];for(let j=r+1;j<n;j++)value-=A[r][j]*u[free[j]];u[free[r]]=value/A[r][r];}
 return [...fixed].map(i=>K[i].reduce((sum,v,j)=>sum+v*u[j],0)-F[i]);
}
test('overhang solver agrees with independent finite-element assembly for every point count',()=>{
 for(const width of [4,6,10])for(const offset of [.5,1])for(let count=2;count<=8;count++){
 const shares=continuousBeamShares(width,count,offset),independent=femReactions(width,count,offset);
 for(let i=0;i<count;i++)assert.ok(Math.abs(shares[i]-independent[i])<1e-8,`${width}m, ${offset}m, ${count} points, T${i+1}`);
 assert.ok(Math.abs(shares.reduce((a,b)=>a+b,0)-1)<1e-10);
 assert.ok(Math.abs(shares.reduce((a,b,i)=>a+b*(offset+(width-2*offset)*i/(count-1)),0)-width/2)<1e-9);
 }
});
