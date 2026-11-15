import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recentVisits,registerVisit,summarizeVisits,usageDays,visitInterval} from '../src/lib/usage.ts';

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
