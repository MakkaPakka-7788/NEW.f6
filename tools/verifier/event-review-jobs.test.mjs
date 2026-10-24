import test from 'node:test';
import assert from 'node:assert/strict';
import {eventReviewJobs} from './event-review-jobs.mjs';
import {encode} from './firestore.mjs';
const job={resultId:'a'.repeat(64),trackId:'b'.repeat(64),timeMs:48466,replayHash:'c'.repeat(64)};
const period={id:'kodub_week',trackId:job.trackId};
const run={...job,runId:job.resultId,periodId:period.id,accountId:'d'.repeat(64),receivedAt:123,
  ownerUid:'private',replay:'private'};
test('review receives exact public racer identity and order, never private ownership or replay fields',async()=>{
  let reads=0;
  const rows=await eventReviewJobs({get:async(collection,id)=>{reads++;assert.equal(collection,'0.6.2_event_runs');
    assert.equal(id,job.resultId);return {data:run};}},[job],period);
  assert.equal(reads,1);assert.equal(rows[0].accountId,run.accountId);assert.equal(rows[0].receivedAt,123);
  assert.equal(rows[0].ownerUid,undefined);assert.equal(rows[0].replay,undefined);assert.equal(job.accountId,undefined);
  const callOnly=await eventReviewJobs({call:async route=>{
    assert.equal(route,'/0.6.2_event_runs/'+job.resultId);return {fields:encode(run).mapValue.fields};
  }},[job],period);
  assert.equal(callOnly[0].accountId,run.accountId);
});
test('missing or changed metadata fails closed before similarity review and publication',async()=>{
  for(const change of [null,{periodId:'wrong'},{trackId:'f'.repeat(64)},{runId:'e'.repeat(64)},
    {accountId:'bad'},{timeMs:48467},{replayHash:'e'.repeat(64)},{receivedAt:0}]){
    await assert.rejects(eventReviewJobs({get:async()=>({data:change===null?null:{...run,...change}})},[job],period));
  }
});
test('review metadata work is bounded to one four-job event batch and propagates quota stops',async()=>{
  await assert.rejects(eventReviewJobs({get:()=>assert.fail()},Array(5).fill(job),period));
  const error=Object.assign(Error('quota'),{code:'EVENT_QUOTA_STOP'});
  await assert.rejects(eventReviewJobs({get:async()=>{throw error;}},[job],period),e=>e===error);
});
