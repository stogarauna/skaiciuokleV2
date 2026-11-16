import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sealPassword,openPassword} from '../src/lib/server/password-vault.ts';
const secret='test-only-encryption-key-at-least-32-characters';
test('vault round trip preserves short and Unicode passwords without plaintext storage',()=>{
 for(const password of ['12','ąČ 123!']){
  const sealed=sealPassword(password,'user',secret);
  assert.equal(openPassword(sealed,'user',secret),password);
  assert.notEqual(sealed,sealPassword(password,'user',secret));
 }
});
test('vault rejects a different user, key and modified ciphertext',()=>{
 const sealed=sealPassword('test','user',secret);
 assert.throws(()=>openPassword(sealed,'other',secret));
 assert.throws(()=>openPassword(sealed,'user',secret+'other'));
 const parts=sealed.split('.');parts[3]='AAAAAA';
 assert.throws(()=>openPassword(parts.join('.'),'user',secret));
 assert.throws(()=>sealPassword('12','user','short'));
});
