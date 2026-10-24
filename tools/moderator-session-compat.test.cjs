const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../polytrack_062_patch.js','utf8');
const start=source.indexOf('  function openModeratorChallenge(section){');
const end=source.indexOf('  function handleModeratorSequence(event){',start);
assert.ok(start>=0&&end>start);
const challengeSource=source.slice(start,end);
const privateFixture='46281935';

function fixture({moderator=true,denied=false}={}){
 let click,readEntered,resolveWrite,started,dbCalls=0,removed=false,attached=0;
 const calls=[],entry={textContent:''},status={textContent:''};
 const writeStarted=new Promise(resolve=>{started=resolve;});
 const challenge={querySelector:selector=>selector.includes('entry')?entry:status,
  addEventListener:(name,handler)=>{assert.equal(name,'click');click=handler;},remove:()=>{removed=true;}};
 const section={querySelector:()=>null,appendChild:value=>assert.equal(value,challenge)};
 const database={collection:name=>{assert.equal(name,'0.6.2_admin_sessions');return {doc:uid=>{
  assert.equal(uid,'staff');return {set:(payload,options)=>{
   calls.push({payload,options});started();
   return denied?Promise.reject(Error('Permission denied')):new Promise(resolve=>{resolveWrite=resolve;});
  }};
 }};}};
 const context={document:{createElement:()=>challenge},currentUserIsModerator:async()=>moderator,
  db:async()=>{dbCalls++;return database;},window:{firebase:{auth:()=>({currentUser:{uid:'staff'}})}},
  COLLECTIONS:{adminSessions:'0.6.2_admin_sessions'},Date:{now:()=>1700000000000},
  setTimeout:()=>0,activeModeratorSession:()=>true,
  attachModeratorControls:async()=>{attached++;},
  observe:value=>{readEntered=value;},
  sha256Hex:()=>assert.fail('The existing server protocol does not accept a hash'),
  console:new Proxy({}, {get:()=>()=>assert.fail('No logging')}),
  localStorage:new Proxy({}, {get:()=>()=>assert.fail('No additional storage')})};
 vm.createContext(context);
 // Observe the actual closure without changing the staged production source.
 vm.runInContext(challengeSource.replace("let entered = '';","let entered = ''; observe(()=>entered);")+
  '\nthis.open=openModeratorChallenge;',context);
 context.open(section);
 const press=key=>click({target:{closest:()=>({dataset:{key}})},preventDefault(){},stopPropagation(){}});
 return {press,entry,status,calls,writeStarted,entered:()=>readEntered(),
  complete:()=>resolveWrite(),state:()=>({dbCalls,removed,attached,active:context.adminSessionActive})};
}

test('actual revision-179 source sends only the existing session protocol and clears entered before awaited write',()=>{
 assert.match(challengeSource,/const code=entered;\s*entered='';\s*await d\.collection\(COLLECTIONS\.adminSessions\)\.doc\(uid\)\.set\(\{uid,code,createdAt,expiresAt:createdAt\+10\*60\*1000\},\{merge:false\}\)/);
 assert.doesNotMatch(challengeSource,/codeHash|sha256Hex|localStorage|sessionStorage|console\.|\blog\(/);
 assert.ok(challengeSource.indexOf('await currentUserIsModerator()')<challengeSource.indexOf('.set({uid,code,'));
});

test('actual handler preserves eight digits, exact payload keys and expiry; pending write retains no entered code',async()=>{
 const f=fixture();
 for(const digit of privateFixture.slice(0,7))await f.press(digit);
 assert.equal(f.calls.length,0);
 const pending=f.press(privateFixture[7]);await f.writeStarted;
 assert.equal(f.entered(),'');assert.ok(!f.entry.textContent.includes(privateFixture));
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls)),[{payload:{uid:'staff',code:privateFixture,
  createdAt:1700000000000,expiresAt:1700000600000},options:{merge:false}}]);
 f.complete();await pending;
 assert.equal(f.state().removed,true);assert.equal(f.state().attached,1);assert.equal(f.state().active,true);
});

test('non-moderator cannot submit even the correct private fixture code',async()=>{
 const f=fixture({moderator:false});for(const digit of privateFixture)await f.press(digit);
 assert.equal(f.calls.length,0);assert.equal(f.state().dbCalls,0);assert.equal(f.entered(),'');
 assert.equal(f.entry.textContent,'_ _ _ _ _ _ _ _');assert.equal(f.state().attached,0);
});

test('denied session write clears entry and exposes no code in error UI',async()=>{
 const f=fixture({denied:true});for(const digit of privateFixture)await f.press(digit);
 assert.equal(f.entered(),'');assert.equal(f.entry.textContent,'_ _ _ _ _ _ _ _');
 assert.equal(f.status.textContent,'Incorrect code or Firebase denied access.');
 assert.equal(f.state().attached,0);assert.equal(f.state().removed,false);
 assert.ok(!f.status.textContent.includes(privateFixture));
});
