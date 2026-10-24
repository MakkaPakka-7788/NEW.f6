import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {casualRpForPlacement,readPublishedCasual,projectCasualRp} from './casual-rp-model.mjs';
const ROOT=process.env.POLYTRACK_CANONICAL_ROOT||fileURLToPath(new URL('../',import.meta.url));
const worker=await import(pathToFileURL(ROOT+'/workers/ranked/src/server-achievements.js'));
const {EXTRA_TRACK_IDS}=await import(pathToFileURL(ROOT+'/workers/ranked/src/extra-track-ids.js'));
const extra=[...EXTRA_TRACK_IDS][0];
const entry=(accountId,timeMs,weight=1)=>({accountId,timeMs,weight,runVerified:true,integrityVerified:true});
const board=(trackId,entries)=>({trackId,complete:true,totalEntries:entries.length,entries});
const project=(boards,rest={})=>projectCasualRp({accountId:'me',boards,eligibleTrackIds:['official','community',extra],
  officialTrackIds:['official'],extraTrackIds:[extra],sourceComplete:true,...rest});

test('formula matches canonical Worker exactly, including singleton, zero, weights and rounding',async()=>{
  for(let n=1;n<=30;n++)for(let rank=1;rank<=n;rank++)for(const weight of [0,.09,.375,1,2.543])
    assert.equal(casualRpForPlacement(rank,n,weight),worker.casualRpForPlacement(rank,n,weight));
  const source=await fs.readFile(ROOT+'/workers/ranked/src/server-achievements.js','utf8');
  const local=await fs.readFile(new URL('./casual-rp-model.mjs',import.meta.url),'utf8');
  const extract=s=>s.slice(s.indexOf('export function casualRpForPlacement('),s.indexOf('\n}',s.indexOf('export function casualRpForPlacement('))+2).replace(/\r/g,'');
  assert.equal(extract(local),extract(source));
});
test('known numeric zero is distinct from absent, legacy, incomplete or malformed data',()=>{
  assert.deepEqual(readPublishedCasual({serverAchievements:{casual:{scoringVersion:2,rp:0,count:0}}}),
    {known:true,value:0,count:0,source:'published-v2'});
  for(const e of [{},{casualRp:0},{serverAchievements:{casual:{scoringVersion:1,rp:0,count:0}}},
    {serverAchievements:{casual:{scoringVersion:2,rp:null,count:2}}},
    {serverAchievements:{casual:{scoringVersion:2,rp:'',count:0}}}])assert.equal(readPublishedCasual(e).known,false);
});
test('local projection exactly matches canonical aggregation for complete fields, ties and Extra cap',()=>{
  const boards=[board('official',[entry('me',10000,2),entry('rival',10000,2),entry('slow',12000,2)]),
    board('community',[entry('other',9000,1),entry('me',10000,1)]),
    board(extra,[entry('other',9000,8),entry('me',10000,8)])];
  const actual=project(boards),expected=worker.aggregateServerAchievements([{userId:'me'}],boards,new Map(),
    {eligibleTrackIds:['official','community',extra],beatOwnerTrackIds:[]}).entries[0];
  assert.equal(actual.casualRp,expected.casualRp);assert.equal(actual.casualCompletionCount,expected.casualCompletionCount);
  assert.equal(actual.officialCasualRp,200);assert.equal(actual.trackResults.find(r=>r.trackId===extra).weight,.4);
  assert.equal(actual.publicRank,null);assert.equal(actual.localPending,true);
});
test('empty complete data and singleton zero weight are real zeros; null/absent weights are unknown',()=>{
  assert.equal(project([]).casualRp,0);
  assert.equal(project([board('official',[entry('me',10000,0)])]).casualRp,0);
  for(const weight of [null,undefined,'',false,NaN]){
    const e=entry('me',10000);e.weight=weight;
    assert.equal(project([board('official',[e])]).known,false);
  }
});
test('partial catalog/board, unverified rows and vanished historical completions cannot become fake zero',()=>{
  assert.equal(project([],{sourceComplete:false}).casualRp,null);
  assert.equal(project([{...board('official',[]),complete:false}]).known,false);
  assert.equal(project([board('official',[{...entry('me',10000),runVerified:false}])]).casualRp,0);
  assert.equal(project([],{priorEntry:{casualRp:2.5}}).known,false);
  assert.equal(project([],{priorEntry:{casualCompletionCount:1,serverAchievements:{casual:{scoringVersion:2,rp:0,count:1}}}}).known,false);
});
test('slower duplicates cannot lower best placement; custom tracks excluded; source is not mutated',()=>{
  const boards=[board('official',[entry('me',10000),entry('me',15000),entry('rival',12000)]),board('custom',[entry('me',9000,100)])];
  const before=JSON.stringify(boards),result=project(boards);
  assert.equal(result.casualRp,100);assert.equal(result.casualCompletionCount,1);assert.equal(JSON.stringify(boards),before);
});
