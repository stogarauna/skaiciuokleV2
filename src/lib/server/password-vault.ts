import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto';
function key(secret:string){
 if(secret.length<32)throw new Error('Slaptažodžių šifravimas nesukonfigūruotas.');
 return Buffer.from(hkdfSync('sha256',secret,'led-studija','user-password-vault-v1',32));
}
export function sealPassword(password:string,username:string,secret:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);
 cipher.setAAD(Buffer.from(username));
 const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function openPassword(value:string,username:string,secret:string){
 const [version,iv,tag,contents,...extra]=value.split('.');
 if(version!=='v1'||!iv||!tag||!contents||extra.length)throw new Error('Netinkamas slaptažodžio įrašas.');
 const cipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(iv,'base64url'));
 cipher.setAAD(Buffer.from(username));cipher.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([cipher.update(Buffer.from(contents,'base64url')),cipher.final()]).toString('utf8');
}
