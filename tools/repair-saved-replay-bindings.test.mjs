import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {encodeSnapshot} from './snapshot-package.mjs';
import {repairSavedReplayBindings} from './repair-saved-replay-bindings.mjs';
test('offline saved-byte repair is exact-bound, pending-only and never touches source',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'saved-playback-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const root=path.join(temp,'repo'),output=path.join(temp,'out'),generation=path.join(root,'public-snapshots57');await fs.mkdir(generation,{recursive:true});
 const accountId='a'.repeat(64),trackId='b'.repeat(64),recording=deflateSync(Buffer.alloc(15)).toString('base64url');
 const replayHash=createHash('sha256').update(recording).digest('hex');
 const entry={accountId,trackId,uploadId:99,frames:5000,timeMs:5000,replayHash,runVerified:false,integrityVerified:true,verified:false,verifiedState:0,ownerUid:'never export'};
 const payloads={['tracks/'+trackId+'.json']:{trackId,updatedAt:10,entries:[entry]},'recordings/12.json':{accountId,trackId,frames:5000,replayHash,recording,verifiedState:1,carStyle:''}};
 const index={generation:57,encoding:'gzip-xor-a7-v1',files:{}};
 for(const [logical,value] of Object.entries(payloads)){
  const bytes=await encodeSnapshot(value),hash=createHash('sha256').update(bytes).digest('hex');
  index.files[logical]={path:hash+'.bin',sha256:hash,decodedBytes:Buffer.byteLength(JSON.stringify(value))};await fs.writeFile(path.join(generation,hash+'.bin'),bytes);
 }
 await fs.writeFile(path.join(generation,'index.json'),JSON.stringify(index));await fs.writeFile(path.join(root,'snapshot-current.json'),JSON.stringify({currentdir:'public-snapshots57'}));
 const manifest=await repairSavedReplayBindings({root,output,includePendingPublicPlayback:true});
 assert.equal(manifest.pendingRepairs,1);assert.equal(manifest.verificationAttempts,0);assert.equal(manifest.networkRequests,0);
 const canonical=JSON.parse(await fs.readFile(path.join(output,`canonical/${trackId}/${accountId}.json`)));
 assert.equal(canonical.verified,false);assert.equal(canonical.verifiedState,0);assert.equal(canonical.ownerUid,undefined);assert.equal(canonical.eventRpEligible,false);
 await assert.rejects(fs.stat(path.join(generation,'canonical')),{code:'ENOENT'});
 await assert.rejects(repairSavedReplayBindings({root,output:path.join(root,'forbidden')}),/outside source/);
});
