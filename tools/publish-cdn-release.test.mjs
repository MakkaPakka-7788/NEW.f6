import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,mkdir,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {releasePlan,checkReleaseFiles,refreshReleasePointer,publishRelease,POINTER_URL,REPOSITORY} from './publish-cdn-release.mjs';

const sha='a'.repeat(40),hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
  const payload=Buffer.from('rankings fixture'),id=hash(payload);
  const files=new Map(Object.entries({
    'index.html':'<head><meta name="polytrack-snapshot" content="./public-snapshots1/"><script src="./main.bundle.js"></script><script src="./polytrack_062_patch.js"></script></head>',
    'snapshot-current.json':JSON.stringify({currentdir:'public-snapshots1'}),
    'public-snapshots1/index.json':JSON.stringify({schemaVersion:1,generation:1,encoding:'gzip-xor-a7-v1',files:Object.fromEntries(['overall-manifest.json','overall-preview.json','overall-pages/1.json'].map(name=>[name,{path:id+'.bin',sha256:id,decodedBytes:payload.length}]))}),
    'public-snapshots1/bootstrap-fast.json':JSON.stringify({schemaVersion:1,generation:1,encoding:'gzip-xor-a7-v1',compactIndexVersion:1,partial:true,fallbackIndex:'index.json',files:Object.fromEntries(['overall-manifest.json','overall-preview.json','overall-pages/1.json'].map(name=>[name,[id,payload.length]]))}),
    'tools/public-snapshot-client.mjs':'/* reader */','tools/snapshot-metadata-recovery.mjs':'/* metadata */','events/client.mjs':'/* events */',
    ['public-snapshots1/'+id+'.bin']:payload,
    'site-version.json':'{}','main.bundle.js':'/* game */','polytrack_062_patch.js':'/* patch */','simulation_worker.bundle.js':'/* worker */','polytrack_physics.wasm':'wasm fixture'
  }).map(([k,v])=>[k,Buffer.from(v)]));
  return {files,read:async file=>{if(!files.has(file))throw Error('Missing '+file);return files.get(file);}};
}
const response=bytes=>({ok:true,async arrayBuffer(){return Buffer.from(bytes);}});

test('a release references a whole commit, including unchanged entry files', async()=>{
  const f=fixture(),first=await releasePlan({commit:sha,...f}),second=await releasePlan({commit:'b'.repeat(40),...f});
  assert.equal(first.pointer.indexSha256,second.pointer.indexSha256);
  assert.notEqual(first.pointer.commit,second.pointer.commit);
  assert.ok(first.files.some(f=>f.path.endsWith('.wasm')));
});
test('invalid commit, mismatched generation and missing rankings fail closed',async()=>{
  await assert.rejects(releasePlan({commit:'main',...fixture()}),/SHA/);
  let f=fixture();f.files.set('snapshot-current.json',Buffer.from('{"currentdir":"public-snapshots2"}'));
  await assert.rejects(releasePlan({commit:sha,...f}),/disagree/);
  f=fixture();f.files.set('public-snapshots1/index.json',Buffer.from('{"schemaVersion":1,"generation":1,"encoding":"gzip-xor-a7-v1","files":{}}'));
  await assert.rejects(releasePlan({commit:sha,...f}),/fast snapshot entry|Missing initial rankings/);
  f=fixture();f.files.set('public-snapshots1/bootstrap-fast.json',Buffer.from('{}'));
  await assert.rejects(releasePlan({commit:sha,...f}),/Invalid fast snapshot/);
});
test('bootstrap rejects malformed non-ranking entries and missing runtime fields',async()=>{
  const f=fixture(),fast=JSON.parse(await f.read('public-snapshots1/bootstrap-fast.json'));
  fast.files['track-statistics.json']=['not-a-hash',1];
  f.files.set('public-snapshots1/bootstrap-fast.json',Buffer.from(JSON.stringify(fast)));
  await assert.rejects(releasePlan({commit:sha,...f}),/Invalid fast snapshot entry/);
  delete fast.files['track-statistics.json'];delete fast.partial;
  f.files.set('public-snapshots1/bootstrap-fast.json',Buffer.from(JSON.stringify(fast)));
  await assert.rejects(releasePlan({commit:sha,...f}),/Invalid fast snapshot index/);
});
test('CDN readiness compares every boot asset to local committed bytes',async()=>{
  const f=fixture(),plan=await releasePlan({commit:sha,...f}),calls=[];
  await checkReleaseFiles(plan,{fetchImpl:async url=>{calls.push(url);const file=url.split('@'+sha+'/')[1];return response(await f.read(file));}});
  assert.equal(calls.length,plan.files.length);
  assert.ok(calls.every(u=>u.startsWith('https://cdn.jsdelivr.net/gh/'+REPOSITORY+'@'+sha+'/')));
});
test('failed or wrong CDN bytes stop publication with bounded retries',async()=>{
  let count=0;
  await assert.rejects(checkReleaseFiles({pointer:{commit:sha},files:[{path:'index.html',sha256:hash('correct')}]},{fetchImpl:async()=>{count++;return response('wrong');},sleep:async()=>{}}),/not advertised/);
  assert.equal(count,3);
});
test('only mutable pointer is purged, then its actual content is checked',async()=>{
  const expected=(await releasePlan({commit:sha,...fixture()})).pointer,calls=[];
  await refreshReleasePointer(expected,{sleep:async()=>{},fetchImpl:async url=>{calls.push(url);return response(JSON.stringify(url.includes('purge.jsdelivr.net')?{status:'finished'}:expected));}});
  assert.deepEqual(calls,[POINTER_URL.replace('://cdn.','://purge.'),POINTER_URL]);
});
test('purge success with stale pointer is not reported as success',async()=>{
  const expected=(await releasePlan({commit:sha,...fixture()})).pointer,calls=[];
  await assert.rejects(refreshReleasePointer(expected,{sleep:async()=>{},fetchImpl:async url=>{calls.push(url);return response(JSON.stringify(url.includes('purge.jsdelivr.net')?{status:'finished'}:{...expected,commit:'b'.repeat(40)}));}}),/propagation/);
  assert.equal(calls.length,6);
});
test('forks and non-default branches cannot publish',async()=>{
  for(const options of [{repository:'fork/repo',branch:'main'},{repository:REPOSITORY,branch:'dev'}])await assert.rejects(publishRelease({...options,git:()=>assert.fail('must not run git')}),/canonical/);
});
test('real local bare remote: no source changes, first publish, no-op repeat, next commit and retries',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'polytrack-cdn-release-'));
  const config=path.join(temp,'gitconfig');await writeFile(config,'');
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:config};
  const run=(cwd,args,options={})=>execFileSync('git',['-c','safe.directory='+cwd,...args],{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe'],...options,env:{...env,...options.env,GIT_CONFIG_GLOBAL:config}});
  const remote=path.join(temp,'remote.git');run(temp,['init','--bare','--initial-branch=main',remote]);
  const root=path.join(temp,'work');run(temp,['clone',remote,root]);
  run(root,['config','user.name','Release Test']);run(root,['config','user.email','test@example.invalid']);
  const f=fixture();for(const [file,bytes]of f.files){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),bytes);}
  run(root,['add','.']);run(root,['commit','-m','base']);run(root,['push','origin','main']);
  const git=(args,options)=>run(root,args,options), checks=[],purges=[];
  const options={root,branch:'main',repository:REPOSITORY,git,check:async plan=>checks.push(plan),refresh:async pointer=>purges.push(pointer)};
  const first=await publishRelease(options),pointerHead=git(['ls-remote','--heads','origin','cdn-release']).split(/\s/)[0];
  assert.equal(git(['status','--porcelain']),'');
  const tree=git(['ls-tree','--name-only',pointerHead]).trim();assert.equal(tree,'release.json');
  await publishRelease(options);
  assert.equal(git(['ls-remote','--heads','origin','cdn-release']).split(/\s/)[0],pointerHead,'repeat repairs purge without creating a commit');
  await writeFile(path.join(root,'unrelated.txt'),'another change');git(['add','unrelated.txt']);git(['commit','-m','next']);git(['push','origin','main']);
  const next=await publishRelease(options);
  assert.equal(first.pointer.indexSha256,next.pointer.indexSha256);
  assert.notEqual(first.pointer.commit,next.pointer.commit);
  assert.equal(purges.length,3);
  await assert.rejects(publishRelease({...options,check:async()=>{throw Error('CDN down');}}),/CDN down/);
  assert.equal(purges.length,3);
});
test('all file-writing workflows explicitly publish after their push, including token pushes',async()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const directory=path.join(root,'.github/workflows');
  for(const file of await readdir(directory)){
    if(!file.endsWith('.yml'))continue;
    const text=await readFile(path.join(directory,file),'utf8');
    if(text.includes('node tools/push-public-capture.mjs')){
      assert.match(text,/publish_cdn_release:[\s\S]*needs: sync[\s\S]*uses: \.\/\.github\/workflows\/publish-cdn-release\.yml/,file);
      assert.ok(text.indexOf('publish_cdn_release:')>text.indexOf('node tools/push-public-capture.mjs'),file);
    }
  }
  const publisher=await readFile(path.join(directory,'publish-cdn-release.yml'),'utf8');
  assert.match(publisher,/branches: \[main\]/);assert.match(publisher,/workflow_call:/);
  assert.ok(!publisher.includes('pull_request_target'));assert.ok(!publisher.includes('workflow_run:'));
  assert.match(publisher,/fetch-depth: 0/);
});
