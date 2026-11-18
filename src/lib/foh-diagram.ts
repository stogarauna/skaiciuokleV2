export const signals = ['HDMI','DVI','SDI','DisplayPort','LED duomenys','Optika (LED)','Valdymo tinklas','NDI','Dante','AES3','Analoginis garsas','DMX','USB','Timecode',"1/4\" TRS","12VDC","3.5mm TRS","AES/EBU","BNC","Cam-Lock","DB-9","Edison","Fiber","GPIO","Generic","IEC","Optical","Phoenix","PowerCon","PowerCon In","PowerCon Out","RJ11","RJ45","RS-232","SPDIF","SpeakON","Thunderbolt","Wiegand","XLR"] as const;
export type SignalKind = typeof signals[number];
export type Port = {id:string; name:string; direction:'in'|'out'|'io'; signal:SignalKind};
export type Device = {id:string; name:string; model:string; zone:string; libraryId?:string; x:number; y:number; ports:Port[]};
export type End = {device:string; port:string};
export type Cable = {id:string; name:string; from:End; to:End; length?:number; notes?:string; bend?:number; role?:'main'|'backup'};
export type Zone = {id:string; name:string};
export type SavedDevice = {folder?:string[]; category?:string; id:string; model:string; ports:Port[]};
export type FohDiagram = {devices:Device[]; cables:Cable[]; nextCable:number; zones?:Zone[]; templates?:SavedDevice[]};

const port=(id:string,name:string,direction:Port['direction'],signal:SignalKind='HDMI'):Port=>({id,name,direction,signal});
type Template=Pick<Device,'model'|'zone'|'ports'>;
export const library:Template[]=[
 {model:'Atkūrimo kompiuteris',zone:'foh',ports:[port('out','HDMI OUT','out'),port('dp','DP OUT','out','DisplayPort')]},
 {model:'Vaizdo pultas',zone:'foh',ports:[port('in1','HDMI IN 1','in'),port('in2','HDMI IN 2','in'),port('sdi','SDI IN','in','SDI'),port('main','PGM OUT A','out'),port('backup','PGM OUT B','out'),port('mv','MV OUT','out')]},
 {model:'LED procesorius',zone:'foh',ports:[port('in','HDMI IN','in'),port('opt','OPT OUT','out','Optika (LED)'),port('led','LED OUT','out','LED duomenys')]},
 {model:'Peržiūros monitorius',zone:'foh',ports:[port('in','HDMI IN','in'),port('sdi','SDI IN','in','SDI')]},
 {model:'Įrašymo įrenginys',zone:'foh',ports:[port('in','HDMI IN','in'),port('sdi','SDI IN','in','SDI')]},
 {model:'Optinis LED keitiklis',zone:'foh',ports:[port('in','OPT IN','in','Optika (LED)'),port('out','LED OUT','out','LED duomenys')]},
 {model:'Perdavimas į sceną',zone:'stage',ports:[port('in','OPT IN','in','Optika (LED)'),port('led','LED IN','in','LED duomenys'),port('sdi','SDI IN','in','SDI')]},
 {model:'Savas įrenginys',zone:'foh',ports:[]}
];

export const defaultZones: Zone[] = [{id:'foh',name:'FOH'},{id:'stage',name:'Scena'}];
export const signalColor:Record<SignalKind,string>={
 HDMI:'#8cbdff',DVI:'#adadff',SDI:'#ffcc7a',DisplayPort:'#cbb1ff','LED duomenys':'#69dfac','Optika (LED)':'#ff99bb',
 'Valdymo tinklas':'#91dce9',NDI:'#65bae0',Dante:'#faa37c',AES3:'#ef9bd9','Analoginis garsas':'#d9d785',
 DMX:'#9ed583',USB:'#d3bef3',Timecode:'#ffb2a5',
 "1/4\" TRS":'#a7c7d9', "12VDC":'#a7c7d9', "3.5mm TRS":'#a7c7d9', "AES/EBU":'#a7c7d9', "BNC":'#a7c7d9', "Cam-Lock":'#a7c7d9', "DB-9":'#a7c7d9', "Edison":'#a7c7d9', "Fiber":'#a7c7d9', "GPIO":'#a7c7d9', "Generic":'#a7c7d9', "IEC":'#a7c7d9', "Optical":'#a7c7d9', "Phoenix":'#a7c7d9', "PowerCon":'#a7c7d9', "PowerCon In":'#a7c7d9', "PowerCon Out":'#a7c7d9', "RJ11":'#a7c7d9', "RJ45":'#a7c7d9', "RS-232":'#a7c7d9', "SPDIF":'#a7c7d9', "SpeakON":'#a7c7d9', "Thunderbolt":'#a7c7d9', "Wiegand":'#a7c7d9', "XLR":'#a7c7d9'
};
export const zonesFor=(graph:FohDiagram)=>graph.zones??defaultZones;
export const zoneName=(graph:FohDiagram,id:string)=>zonesFor(graph).find(zone=>zone.id===id)?.name??id;
export function getEnd(graph:FohDiagram,end:End) {
 const device=graph.devices.find(d=>d.id===end.device);
 const port=device?.ports.find(p=>p.id===end.port);
 return device&&port?{device,port}:undefined;
}
export const sameEnd=(a:End,b:End)=>a.device===b.device&&a.port===b.port;
export function cableIssue(graph:FohDiagram,from:End,to:End) {
 const a=getEnd(graph,from),b=getEnd(graph,to);
 if(!a||!b)return 'Prievadas nerastas.';
 if(a.port.direction==='in'||b.port.direction==='out')return 'Sujunkite išėjimą su įėjimu.';
 if(from.device===to.device)return 'Pasirinkite kito įrenginio įėjimą.';
 if(a.port.signal!==b.port.signal)return 'Signalai nesuderinami: '+a.port.signal+' ir '+b.port.signal+'.';
 if(graph.cables.some(c=>sameEnd(c.from,from)||sameEnd(c.to,from)||sameEnd(c.from,to)||sameEnd(c.to,to)))return 'Vienas iš prievadų jau prijungtas.';
 return null;
}
export function exampleFoh():FohDiagram {
 const device=(model:number,id:string,name:string,x:number,y:number):Device=>({...structuredClone(library[model]),id,name,x,y});
 const cable=(id:string,name:string,a:string,ap:string,b:string,bp:string):Cable=>({id,name,from:{device:a,port:ap},to:{device:b,port:bp}});
 return {nextCable:8,devices:[
  device(0,'play-a','Playback A',30,56),device(0,'play-b','Playback B',30,236),device(1,'mix','Vaizdo pultas',290,110),
  device(2,'led-a','LED pagrindinis',550,45),device(2,'led-b','LED atsarginis',550,230),device(3,'mv','FOH peržiūra',550,415),
  device(6,'stage-a','Į sceną · Main A',810,45),device(6,'stage-b','Į sceną · Main B',810,230)
 ],cables:[
  cable('C01','Playback A','play-a','out','mix','in1'),cable('C02','Playback B','play-b','out','mix','in2'),
  cable('C03','PGM pagrindinis','mix','main','led-a','in'),cable('C04','PGM atsarginis','mix','backup','led-b','in'),
  cable('C05','Multiview','mix','mv','mv','in'),{...cable('C06','LED Main · pagrindinis','led-a','opt','stage-a','in'),role:'main'},
  {...cable('C07','LED Main · atsarginis','led-b','opt','stage-b','in'),role:'backup'}
 ]};
}
function object(v:unknown): v is Record<string,unknown> {return !!v&&typeof v==='object'&&!Array.isArray(v);}
function label(v:unknown):v is string {return typeof v==='string'&&v.trim().length>0&&v.length<=120;}
function coord(v:unknown):v is number {return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=4000;}
function validPort(v:unknown):v is Port {
 return object(v)&&label(v.id)&&label(v.name)&&(v.direction==='in'||v.direction==='out'||v.direction==='io')&&signals.some(s=>s===v.signal);
}
export function validSavedDevice(v:unknown):v is SavedDevice {
 return object(v)&&label(v.id)&&label(v.model)&&(v.category===undefined||label(v.category))&&Array.isArray(v.ports)&&v.ports.length<=128
  &&v.ports.every(validPort)&&new Set(v.ports.map(p=>p.id)).size===v.ports.length;
}
function validDevice(v:unknown):v is Device {
 return object(v)&&label(v.id)&&label(v.name)&&label(v.model)&&label(v.zone)&&(v.libraryId===undefined||label(v.libraryId))&&coord(v.x)&&coord(v.y)
  &&Array.isArray(v.ports)&&v.ports.length<=128&&v.ports.every(validPort)&&new Set(v.ports.map(p=>p.id)).size===v.ports.length;
}
function validEnd(v:unknown):v is End {return object(v)&&label(v.device)&&label(v.port);}
export function validateFoh(v:unknown):v is FohDiagram {
 if(!object(v)||!Array.isArray(v.devices)||!Array.isArray(v.cables)||typeof v.nextCable!=='number'
  ||!Number.isSafeInteger(v.nextCable)||v.nextCable<1||v.nextCable>=Number.MAX_SAFE_INTEGER
  ||v.devices.length>100||v.cables.length>1000||!v.devices.every(validDevice)||new Set(v.devices.map(d=>d.id)).size!==v.devices.length)return false;
 const zones=v.zones??defaultZones;
 if(!Array.isArray(zones)||!zones.length||zones.length>50||!zones.every(z=>object(z)&&label(z.id)&&label(z.name)))return false;
 const zoneIds=new Set(zones.map(z=>z.id));
 if(zoneIds.size!==zones.length||v.devices.some(d=>!zoneIds.has(d.zone)))return false;
 if(v.templates!==undefined&&(!Array.isArray(v.templates)||v.templates.length>100
  ||!v.templates.every(validSavedDevice)
  ||new Set(v.templates.map(t=>t.id)).size!==v.templates.length))return false;
 const check:FohDiagram={devices:v.devices,cables:[],nextCable:v.nextCable};
 const ids=new Set<string>();
 for(const c of v.cables){
  if(!object(c)||!label(c.id)||!label(c.name)||!validEnd(c.from)||!validEnd(c.to)||ids.has(c.id)||cableIssue(check,c.from,c.to))return false;
  if(c.length!==undefined&&(!coord(c.length)||c.length===0))return false;
  if(c.notes!==undefined&&(typeof c.notes!=='string'||c.notes.length>400))return false;
  if(c.bend!==undefined&&!coord(c.bend))return false;
  if(c.role!==undefined&&c.role!=='main'&&c.role!=='backup')return false;
  ids.add(c.id);
  check.cables.push({id:c.id,name:c.name,from:c.from,to:c.to});
 }
 return true;
}
function csv(rows:string[][]){
 return '\ufeff'+rows.map(row=>row.map(value=>'"'+(/^\s*[=+\-@]|^[\t\r]/.test(value)?"'":'')+value.replaceAll('"','""')+'"').join(';')).join('\r\n');
}
export function fohCsv(graph:FohDiagram) {
 const rows=[['ID','Signalas','Tipas','Iš zonos','Iš įrenginio','Iš prievado','Į zoną','Į įrenginį','Į prievadą','Paskirtis','Ilgis (m)','Pastabos']];
 for(const c of graph.cables){
  const a=getEnd(graph,c.from),b=getEnd(graph,c.to);
  if(a&&b)rows.push([c.id,c.name,a.port.signal,zoneName(graph,a.device.zone),a.device.name,a.port.name,
   zoneName(graph,b.device.zone),b.device.name,b.port.name,c.role==='backup'?'Atsarginis':c.role==='main'?'Pagrindinis':'',String(c.length??''),c.notes??'']);
 }
 return csv(rows);
}
export function gearCsv(graph:FohDiagram){
 const counts=new Map<string,{zone:string;model:string;count:number}>();
 for(const device of graph.devices){
  const key=JSON.stringify([device.zone,device.model]);
  const item=counts.get(key)??{zone:zoneName(graph,device.zone),model:device.model,count:0};
  item.count++;
  counts.set(key,item);
 }
 return csv([['Zona','Modelis','Kiekis'],...[...counts.values()].map(item=>[item.zone,item.model,String(item.count)])]);
}

export function diagramView(graph:FohDiagram,zone:string):FohDiagram {
 if(!zone)return graph;
 const local=graph.devices.filter(device=>device.zone===zone);
 const localIds=new Set(local.map(device=>device.id));
 const cables=graph.cables.filter(cable=>localIds.has(cable.from.device)||localIds.has(cable.to.device));
 const remotePorts=new Map<string,Set<string>>();
 for(const cable of cables) for(const end of [cable.from,cable.to]){
  if(localIds.has(end.device))continue;
  const ports=remotePorts.get(end.device)??new Set<string>();
  ports.add(end.port);
  remotePorts.set(end.device,ports);
 }
 const x=Math.max(330,...local.map(device=>device.x+280));
 let y=42;
 const remote=graph.devices.filter(device=>remotePorts.has(device.id)).map(device=>{
  const ports=device.ports.filter(port=>remotePorts.get(device.id)?.has(port.id));
  const reference={...device,ports,x,y};
  y+=86+ports.length*30;
  return reference;
 });
 return {...graph,devices:[...local,...remote],cables};
}

export const portSide=(p:Port)=>p.direction==='in'?'in':'out';
export const cardWidth=192,headerHeight=58,rowHeight=30;
export const deviceHeight=(device:Device)=>headerHeight+Math.max(
 device.ports.filter(p=>p.direction==='in').length,device.ports.filter(p=>portSide(p)==='out').length)*rowHeight+8;
export function anchor(end:NonNullable<ReturnType<typeof getEnd>>){
 const {device,port}=end;
 const index=device.ports.filter(p=>portSide(p)===portSide(port)).findIndex(p=>p.id===port.id);
 return {x:device.x+(portSide(port)==='out'?cardWidth:0),y:device.y+headerHeight+rowHeight*(index+.5)};
}
export function cablePath(a:ReturnType<typeof anchor>,b:ReturnType<typeof anchor>,bend?:number){
 if(bend!==undefined)return 'M '+a.x+' '+a.y+' H '+bend+' V '+b.y+' H '+b.x;
 if(b.x-a.x>=24){const x=(a.x+b.x)/2;return 'M '+a.x+' '+a.y+' H '+x+' V '+b.y+' H '+b.x;}
 const y=Math.max(4,Math.min(a.y,b.y)-22);
 return 'M '+a.x+' '+a.y+' h 12 V '+y+' H '+(b.x-12)+' V '+b.y+' H '+b.x;
}
