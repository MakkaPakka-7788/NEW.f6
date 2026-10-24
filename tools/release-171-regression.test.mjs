import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../polytrack_062_patch.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
test('transaction callback read failure is not an SDK FirebaseError retry',async()=>{
  let attempts=0,noted=0;
  const context=vm.createContext({Error,noteFirebaseQuota:()=>noted++});
  vm.runInContext(section('  function runFirebaseTransaction(', '  function overallFooterLayoutCss('),context);
  const database={async runTransaction(callback){for(let i=0;i<5;i++){attempts++;try{return await callback({});}catch(error){if(error.name!=='FirebaseError'||i===4)throw error;}}}};
  const cause=new Error('Quota exhausted');cause.name='FirebaseError';cause.code='resource-exhausted';
  await assert.rejects(context.runFirebaseTransaction(database,async()=>{throw cause;}),error=>error.code===cause.code&&error.cause===cause&&error.name==='Error');
  assert.equal(attempts,1);assert.equal(noted,1);
});
test('all client transaction call sites use the callback guard',()=>{
  assert.equal((source.match(/\.runTransaction\(/g)||[]).length,1);
  assert.equal((source.match(/await runFirebaseTransaction\(/g)||[]).length,6);
});
test('temporary network failures retain normal SDK recovery',async()=>{
  const context=vm.createContext({Error,noteFirebaseQuota:()=>assert.fail('not quota')});
  vm.runInContext(section('  function runFirebaseTransaction(', '  function overallFooterLayoutCss('),context);
  const cause=new Error('Service temporarily unavailable');cause.name='FirebaseError';cause.code='unavailable';
  await assert.rejects(context.runFirebaseTransaction({runTransaction:callback=>callback({})},async()=>{throw cause;}),error=>error===cause);
});
test('PB commit retries reset per-attempt confirmation state',()=>{
  assert.ok(source.includes('saved=false;savedRow=raceRow;previousBestMs=0;nextPbCount=0;'));
});
test('a conflict followed by a faster PB does not confirm the discarded upload',async()=>{
  const start=source.indexOf('      let savedRow = raceRow;');
  const end=source.indexOf('      // A receipt is written',start);
  assert.ok(start>=0&&end>start);
  const ref={},profileRef={},raceRow={timeMs:100,uploadId:1,totalPlaytimeMs:0};
  const current={timeMs:50,uploadId:2};
  const context=vm.createContext({ref,profileRef,raceRow,d:{},timeMs:100,reconcileGuard:null,accountId:'me',ownerUid:'owner',requestedPublicName:'Racer',showPublicNameAdjustment:()=>{},name:'Racer',countryCode:'',carStyle:'car',createdAt:10,localAccountCreatedAt:1,localPbFloor:0,overallPbFloor:0,Math,Number,Date,
    canonicalRaceTimeMs:row=>row?.timeMs||0,claimCloudProfileName:async (_d,_tx,_id,_owner,_previous,name)=>name,assertCloudOwner:()=>{},window:{firebase:{firestore:{FieldValue:{serverTimestamp:()=>10}}}},
    runFirebaseTransaction:async(_database,callback)=>{for(const existing of [null,current])await callback({get:async target=>target===ref?{exists:!!existing,data:()=>existing}:{exists:true,data:()=>({accountCreatedAt:1,pbCount:2})},set:()=>{}});}});
  const result=await vm.runInContext('(async()=>{'+source.slice(start,end)+'return {saved,savedRow};})()',context);
  assert.equal(result.saved,false);assert.equal(result.savedRow.uploadId,2);
});
test('relay authentication does not initialize Firestore',()=>{
  const relay=section('  async function resolveMultiplayerIceServers(', '  async function saveMultiplayerBackupCode(');
  assert.ok(relay.includes('await ensureFirebaseAuthApp()'));
  assert.ok(!relay.includes('await db()'));
});
test('active-time formatting keeps 24 to 99 hours in hours',()=>{
  const context=vm.createContext({Number,Math});
  vm.runInContext(section('  function activeDurationLabel(', '  function snapshotCaptureTimestamp('),context);
  assert.equal(context.activeDurationLabel(60*3600000),'60h 0m');
  assert.equal(context.activeDurationLabel(100*3600000),'4.2d');
});
test('slow ranking completion can recover without reopening the menu',()=>{
  assert.ok(source.includes('pendingEntries.then(entries=>{'));
  assert.ok(source.includes("if(generation!==overallLoadGeneration||panel.style.display==='none')return;"));
});
