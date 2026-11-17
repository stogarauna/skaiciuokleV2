import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cableIssue,exampleFoh,fohCsv,validateFoh} from '../src/lib/foh-diagram.ts';
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
