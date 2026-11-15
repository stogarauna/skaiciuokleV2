import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openingDay,recentOpenings,recentVisits,registerVisit,summarizeVisits,usageDays,visitInterval} from '../src/lib/usage.ts';

test('refreshes are deduplicated per browser and later visits retain exact times',()=>{
 const start=Date.UTC(2026,10,15,14);
 const first='12345678-90ab-4cde-8f12-345678901234';
 const other='98765432-10ab-4cde-8f12-345678901234';
 const visits=registerVisit([],first,start)!;
 assert.equal(registerVisit(visits,first,start+visitInterval-1),null);
 const both=registerVisit(visits,other,start+10)!;
 const returned=registerVisit(both,first,start+visitInterval)!;
 assert.deepEqual(summarizeVisits(returned),[
  {code:'1234567890AB',times:[start+visitInterval,start]},
  {code:'9876543210AB',times:[start+10]}
 ]);
 assert.deepEqual(recentVisits(returned,start+usageDays*86400000+15),[returned[2]]);
});

test('opening counts use Vilnius calendar days across midnight and summer time',()=>{
 assert.equal(openingDay(Date.UTC(2026,10,14,21,59)),'2026-11-14');
 assert.equal(openingDay(Date.UTC(2026,10,14,22)),'2026-11-15');
 assert.equal(openingDay(Date.UTC(2026,6,14,21)),'2026-07-15');
 assert.deepEqual(recentOpenings({'2026-08-17':4,'2026-08-18':3,'2026-11-15':2,'2026-11-16':1},'2026-11-15'),
  {'2026-08-18':3,'2026-11-15':2});
});
