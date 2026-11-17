import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cableIssue,diagramView,exampleFoh,fohCsv,gearCsv,validateFoh} from '../src/lib/foh-diagram.ts';
import {diagramSvg} from '../src/lib/signal-diagram-export.ts';
import {parseProject} from '../src/lib/project.ts';

test('FOH cable identifiers, zones and links survive a project JSON round trip',()=>{
 const graph=exampleFoh();
 const project=parseProject(JSON.parse(JSON.stringify({version:1,name:'Test',screens:[],fohDiagram:graph})));
 assert.deepEqual(project.fohDiagram,graph);
 assert.match(fohCsv(graph),/"C06";"LED Main · pagrindinis";"Optika \(LED\)";"FOH";"LED pagrindinis";"OPT OUT";"Scena";"Į sceną · Main A";"OPT IN"/);
});

test('the diagram rejects mismatched, reversed, occupied and dangling connections',()=>{
 const graph=exampleFoh();
 const from={device:'play-a',port:'out'},to={device:'mix',port:'in1'};
 assert.match(cableIssue(graph,from,to)??'',/jau prijungtas/);
 const empty={...graph,cables:[]};
 assert.equal(cableIssue(empty,from,to),null);
 assert.match(cableIssue(empty,to,from)??'',/išėjimą su įėjimu/);
 assert.match(cableIssue(empty,from,{device:'mix',port:'sdi'})??'',/nesuderinami/);
 assert.equal(validateFoh({...graph,devices:graph.devices.slice(1)}),false);
 assert.equal(validateFoh({...graph,cables:[...graph.cables,{id:'duplicate',name:'HDMI',from,to}]}),false);
});

test('one cross-zone cable is visible from both ends and exports the actual zone names',()=>{
 const graph=exampleFoh();
 graph.zones=[{id:'foh',name:'FOH'},{id:'stage',name:'Pagrindinė scena'},{id:'video',name:'Video zona'}];
 graph.devices=graph.devices.map(d=>d.id==='stage-a'?{...d,zone:'video'}:d);
 assert.equal(validateFoh(graph),true);
 const a=diagramView(graph,'foh');
 const b=diagramView(graph,'video');
 assert.deepEqual(b.cables.map(c=>c.id),['C06']);
 assert.equal(a.cables.find(c=>c.id==='C06'),b.cables[0]);
 assert.deepEqual(b.devices.find(d=>d.id==='led-a')?.ports.map(p=>p.id),['opt']);
 assert.match(fohCsv(graph),/"Video zona";"Į sceną · Main A"/);
 assert.match(gearCsv(graph),/"Video zona";"Perdavimas į sceną";"1"/);
 assert.equal(validateFoh({...graph,zones:graph.zones.slice(0,2)}),false);
});

test('a project keeps custom equipment and cable metadata on JSON round trip',()=>{
 const graph=exampleFoh();
 graph.templates=[{id:'custom',model:'E2 FOH',ports:[{id:'a',name:'PGM',direction:'out',signal:'HDMI'}]}];
 graph.cables[0]={...graph.cables[0],role:'backup',length:36,bend:275,notes:'CAT dėžė'};
 const restored=parseProject(JSON.parse(JSON.stringify({version:1,name:'Test',screens:[],fohDiagram:graph})));
 assert.deepEqual(restored.fohDiagram,graph);
 assert.match(fohCsv(graph),/"Atsarginis";"36";"CAT dėžė"/);
 assert.match(diagramSvg(graph,'A&B <FOH>',true,true).markup,/A&amp;B &lt;FOH&gt;/);
});
