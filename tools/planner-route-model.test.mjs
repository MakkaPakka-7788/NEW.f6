import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerPracticeEvidence,plannerEaseEstimate,plannerBenefitEaseScore,orderPlannerRoutes} from './planner-route-model.mjs';

const action={trackId:'track',currentRank:3,targetRank:2,timeMs:12000,cachedAt:100,value:10,weight:2};
const board={complete:true,totalEntries:3,serverUpdatedAt:100,entries:[
  {accountId:'first',timeMs:10000},{accountId:'second',timeMs:11000},{accountId:'me',timeMs:12000}]};
const practice={activeTimeVersion:2,activeMs:240000,legacyActiveMs:0,movingMs:180000,motionObservedMs:220000,
  attempts:12,finishes:10,recentFinishes:[{timeMs:12500},{timeMs:12400},{timeMs:12100},{timeMs:12000}]};
const route=(id,value,effortScore,weight=1)=>({trackId:id,value,weight,currentRank:5,ease:{effortScore}});

test('sparse, all-zero and pre-observer practice remain neutral, not fabricated ability',()=>{
  for(const row of [null,{}, {...practice,activeMs:0}, {...practice,attempts:2},
    {...practice,movingMs:0}, {...practice,motionObservedMs:0}, {...practice,activeTimeVersion:1},
    {...practice,legacyActiveMs:practice.activeMs}]){
    const evidence=plannerPracticeEvidence(row);assert.equal(evidence.factor,1);assert.equal(evidence.calibrated,false);assert.equal(evidence.abilityProbability,null);
  }
});
test('no tracked first finish is not treated as no lifetime ability',()=>{
  const e=plannerPracticeEvidence({...practice,finishes:0,attempts:200});
  assert.equal(e.factor,1);assert.equal(e.calibrated,false);assert.match(e.note,/absence is not evidence/);
});
test('actual active moving attempts and finish observations meaningfully change ease',()=>{
  const good=plannerEaseEstimate(action,board,'me',practice,{coverageFraction:1});
  const struggling=plannerEaseEstimate(action,board,'me',{...practice,finishes:1,recentFinishes:[]},{coverageFraction:1});
  assert.ok(good.known&&struggling.known);assert.ok(good.effortScore<struggling.effortScore);
  assert.ok(good.practice.factor>=.75&&struggling.practice.factor<=1.25);
  assert.equal(good.gapMs,1000);assert.equal(good.practice.abilityProbability,null);
});
test('partial coverage dampens hints without pretending it is complete lifetime history',()=>{
  const full=plannerPracticeEvidence(practice,{coverageFraction:1});
  const partial=plannerPracticeEvidence(practice,{coverageFraction:0});
  assert.ok(Math.abs(partial.factor-1)<Math.abs(full.factor-1));assert.equal(partial.coverageFraction,0);
  assert.match(partial.note,/partial device history/);
});
test('partial or stale fields and new tracks never get invented exact ease',()=>{
  for(const snapshot of [{...board,complete:false},{...board,totalEntries:20},
    {...board,serverUpdatedAt:50,checkedAt:99999,fetchedAt:99999},
    {...board,entries:[...board.entries.slice(0,2),board.entries[0]]}])
    assert.equal(plannerEaseEstimate(action,snapshot,'me',practice).effortScore,null);
  assert.equal(plannerEaseEstimate({...action,currentRank:0},board,'me',practice).effortScore,null);
  assert.equal(plannerEaseEstimate({...action,timeMs:11999},board,'me',practice).effortScore,null);
});
test('easiest follows observed target effort, not lowest weight or greatest gain',()=>{
  const difficult=route('heavy',100,8,.01),easy=route('easy',1,.2,100);
  assert.equal(orderPlannerRoutes([],[difficult,easy],8,'ease')[0].trackId,'easy');
  assert.equal(orderPlannerRoutes([],[difficult,easy],8,'impact')[0].trackId,'heavy');
});
test('Benefit + Ease strongly favors ease but retains significant benefit',()=>{
  assert.equal(orderPlannerRoutes([],[route('hard',10,8),route('easy',4,.1)],8,'benefit-ease')[0].trackId,'easy');
  assert.equal(orderPlannerRoutes([],[route('tiny',.0001,0),route('useful',10,1)],8,'benefit-ease')[0].trackId,'useful');
  assert.equal(orderPlannerRoutes([],[route('low',1,1),route('high',5,1)],8,'benefit-ease')[0].trackId,'high');
  assert.equal(plannerBenefitEaseScore(route('unknown',10,null),10),null);
});
test('unknown ease remains explicit; legacy practice/training modes retained; dedup and eight cap',()=>{
  const known=route('known',1,5),unknown=route('unknown',100,null);
  assert.equal(orderPlannerRoutes([],[unknown,known],8,'ease')[0].trackId,'known');
  const a={...route('a',10,3),practice:{factor:1}},b={...route('b',9,2),practice:{factor:1.2}};
  assert.equal(orderPlannerRoutes([],[a,b],8,'practice')[0].trackId,'b');
  assert.equal(orderPlannerRoutes([],[{...a,currentRank:0},b],8,'training')[0].trackId,'b');
  assert.equal(orderPlannerRoutes([a],[{...a,value:20},b]).length,2);
  assert.equal(orderPlannerRoutes([],Array.from({length:12},(_,i)=>route('t'+i,20-i,i))).length,8);
});
test('all seven planner metrics x five sorts x current/official filters x self/rival contexts',()=>{
  let combinations=0;
  for(const metric of ['overall','skill','medals','wins','podiumRate','weight','events'])
    for(const sort of ['impact','practice','ease','training','benefit-ease'])
      for(const currentOnly of [false,true])for(const officialOnly of [false,true])for(const rival of [false,true]){
        const rows=[{...route('official-played',4,1),official:true},{...route('community',3,.5),official:false},
          {...route('official-new',5,null),official:true,currentRank:0}]
          .filter(r=>(!currentOnly||r.currentRank)&&(!officialOnly||r.official));
        const result=orderPlannerRoutes(rival?rows:[],rows,8,sort);
        assert.equal(result.length,rows.length,metric+'/'+sort);assert.equal(new Set(result.map(r=>r.trackId)).size,rows.length);combinations++;
      }
  assert.equal(combinations,280);
});
