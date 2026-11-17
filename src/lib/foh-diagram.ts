export const signals = ['HDMI','SDI','DisplayPort','LED duomenys','Optika (LED)','Valdymo tinklas'] as const;
export type SignalKind = typeof signals[number];
export type Port = {id:string; name:string; direction:'in'|'out'; signal:SignalKind};
export type Device = {id:string; name:string; model:string; zone:'foh'|'stage'; x:number; y:number; ports:Port[]};
export type End = {device:string; port:string};
export type Cable = {id:string; name:string; from:End; to:End};
export type FohDiagram = {devices:Device[]; cables:Cable[]; nextCable:number};

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

export const zoneLabel={foh:'FOH',stage:'Scena'};
export const signalColor:Record<SignalKind,string>={HDMI:'#8cbdff',SDI:'#ffcc7a',DisplayPort:'#cbb1ff','LED duomenys':'#69dfac','Optika (LED)':'#ff99bb','Valdymo tinklas':'#91dce9'};
export function getEnd(graph:FohDiagram,end:End) {
 const device=graph.devices.find(d=>d.id===end.device);
 const port=device?.ports.find(p=>p.id===end.port);
 return device&&port?{device,port}:undefined;
}
export const sameEnd=(a:End,b:End)=>a.device===b.device&&a.port===b.port;
export function cableIssue(graph:FohDiagram,from:End,to:End) {
 const a=getEnd(graph,from),b=getEnd(graph,to);
 if(!a||!b)return 'Prievadas nerastas.';
 if(a.port.direction!=='out'||b.port.direction!=='in')return 'Sujunkite išėjimą su įėjimu.';
 if(from.device===to.device)return 'Pasirinkite kito įrenginio įėjimą.';
 if(a.port.signal!==b.port.signal)return 'Signalai nesuderinami: '+a.port.signal+' ir '+b.port.signal+'.';
 if(graph.cables.some(c=>sameEnd(c.from,from)||sameEnd(c.to,to)))return 'Vienas iš prievadų jau prijungtas.';
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
  cable('C05','Multiview','mix','mv','mv','in'),cable('C06','LED Main · pagrindinis','led-a','opt','stage-a','in'),
  cable('C07','LED Main · atsarginis','led-b','opt','stage-b','in')
 ]};
}
function object(v:unknown): v is Record<string,unknown> {return !!v&&typeof v==='object'&&!Array.isArray(v);}
function label(v:unknown):v is string {return typeof v==='string'&&v.trim().length>0&&v.length<=120;}
function coord(v:unknown):v is number {return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=4000;}
function validPort(v:unknown):v is Port {
 return object(v)&&label(v.id)&&label(v.name)&&(v.direction==='in'||v.direction==='out')&&signals.some(s=>s===v.signal);
}
function validDevice(v:unknown):v is Device {
 return object(v)&&label(v.id)&&label(v.name)&&label(v.model)&&(v.zone==='foh'||v.zone==='stage')&&coord(v.x)&&coord(v.y)
  &&Array.isArray(v.ports)&&v.ports.length<=64&&v.ports.every(validPort)&&new Set(v.ports.map(p=>p.id)).size===v.ports.length;
}
function validEnd(v:unknown):v is End {return object(v)&&label(v.device)&&label(v.port);}
export function validateFoh(v:unknown):v is FohDiagram {
 if(!object(v)||!Array.isArray(v.devices)||!Array.isArray(v.cables)||typeof v.nextCable!=='number'
  ||!Number.isSafeInteger(v.nextCable)||v.nextCable<1||v.nextCable>=Number.MAX_SAFE_INTEGER
  ||v.devices.length>100||v.cables.length>1000||!v.devices.every(validDevice)||new Set(v.devices.map(d=>d.id)).size!==v.devices.length)return false;
 const check:FohDiagram={devices:v.devices,cables:[],nextCable:v.nextCable};
 const ids=new Set<string>();
 for(const c of v.cables){
  if(!object(c)||!label(c.id)||!label(c.name)||!validEnd(c.from)||!validEnd(c.to)||ids.has(c.id)||cableIssue(check,c.from,c.to))return false;
  ids.add(c.id);
  check.cables.push({id:c.id,name:c.name,from:c.from,to:c.to});
 }
 return true;
}
export function fohCsv(graph:FohDiagram) {
 const rows=[['ID','Signalas','Tipas','Iš zonos','Iš įrenginio','Iš prievado','Į zoną','Į įrenginį','Į prievadą']];
 for(const c of graph.cables){
  const a=getEnd(graph,c.from),b=getEnd(graph,c.to);
  if(a&&b)rows.push([c.id,c.name,a.port.signal,zoneLabel[a.device.zone],a.device.name,a.port.name,zoneLabel[b.device.zone],b.device.name,b.port.name]);
 }
 return '\ufeff'+rows.map(row=>row.map(value=>'"'+(/^\s*[=+\-@]|^[\t\r]/.test(value)?"'":'')+value.replaceAll('"','""')+'"').join(';')).join('\r\n');
}