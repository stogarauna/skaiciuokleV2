import {wireflowDevices} from './wireflow-devices.ts';
import {validSavedDevice,type Port,type SavedDevice} from './foh-diagram.ts';

const port=(id:string,name:string,direction:Port['direction'],signal:Port['signal']):Port=>({id,name,direction,signal});
const parts=(prefix:string,name:string,count:number,direction:Port['direction'],signal:Port['signal'])=>
 Array.from({length:count},(_,i)=>port(prefix+(i+1),name+' '+(i+1),direction,signal));
const control=port('control','ETHERNET · valdymas','in','Valdymo tinklas');

export const initialDevices:SavedDevice[]=[
 {id:'novastar-vx1000',model:'NovaStar VX1000 · siuntimas',ports:[
  ...parts('hdmi','HDMI 1.4 IN',2,'in','HDMI'),...parts('dvi','DVI IN',2,'in','DVI'),
  port('sdi','3G-SDI IN','in','SDI'),port('opt1','OPT 1','out','Optika (LED)'),port('opt2','OPT 2','out','Optika (LED)'),
  ...parts('led','LED OUT',10,'out','LED duomenys'),
  port('hdmi-out','HDMI OUT','out','HDMI'),port('hdmi-loop','HDMI LOOP','out','HDMI'),
  port('dvi-loop','DVI LOOP','out','DVI'),port('sdi-loop','3G-SDI LOOP','out','SDI'),control
 ]},
 {id:'novastar-mctrl4k',model:'NovaStar MCTRL4K · siuntimas',ports:[
  port('hdmi','HDMI 2.0 IN','in','HDMI'),port('dp','DP 1.2 IN','in','DisplayPort'),...parts('dvi','DUAL DVI-D',2,'in','DVI'),
  ...parts('led','LED OUT',16,'out','LED duomenys'),...parts('opt','OPT',4,'out','Optika (LED)'),control
 ]},
 {id:'novastar-cvt4ks-opt-in',model:'NovaStar CVT4K-S · OPT → LED',ports:[
  ...parts('opt','OPT',4,'in','Optika (LED)'),...parts('led','LED OUT',16,'out','LED duomenys'),control
 ]},
 {id:'novastar-cvt4ks-led-in',model:'NovaStar CVT4K-S · LED → OPT',ports:[
  ...parts('led','LED IN',16,'in','LED duomenys'),...parts('opt','OPT',4,'out','Optika (LED)'),control
 ]}
];
export function sharedDevices(stored:SavedDevice[]|undefined, presetsInstalled=false):SavedDevice[] {
 const devices=stored??initialDevices;
 if(presetsInstalled)return devices;
 const names=new Set(devices.map(d=>d.model.trim().toLowerCase()));
 const ids=new Set(devices.map(d=>d.id));
 return [...devices,...wireflowDevices.filter(d=>!ids.has(d.id)&&!names.has(d.model.toLowerCase()))];
}
export type DeviceLibrary = {folders?:string[][]; devices:SavedDevice[]; revision:string; writable:boolean};

export function cleanSharedDevice(value:unknown):SavedDevice|null {
 if(!validSavedDevice(value))return null;
 const cleanName=(s:string)=>s.trim().replace(/[\x00-\x1f\x7f]/g,'');
 const model=cleanName(value.model);
 const ports=value.ports.map(({id,name,direction,signal})=>({id,name:cleanName(name),direction,signal}));
 if(!model||ports.some(port=>!port.name))return null;
 return {id:value.id,model,ports};
}
