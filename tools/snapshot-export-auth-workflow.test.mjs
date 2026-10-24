import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read=async name=>(await fs.readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
test('only bounded trusted snapshot step receives the single existing credential',async()=>{
  for(const file of ['publish-verified-snapshots.yml','sync-event-catalog.yml']) {
    const source=await read(file);
    assert.doesNotMatch(source,/secrets: inherit/);
    assert.match(source,/github.repository == 'StaticQuasar931\/PolyTrack-0.6.3-Ranked'/);
    assert.match(source,/github.ref == format\('refs\/heads\/\{0\}', github.event.repository.default_branch\)/);
    assert.match(source,/ref: \$\{\{ github.event.repository.default_branch \}\}/);
    const steps=source.split(/(?=^      - )/m);
    const exposed=steps.filter(step=>/secrets\./.test(step));
    assert.equal(exposed.length,1);assert.match(exposed[0],/name: Capture bounded public snapshots/);
    assert.match(exposed[0],/FIREBASE_VERIFIER_SERVICE_ACCOUNT: \$\{\{ secrets.FIREBASE_VERIFIER_SERVICE_ACCOUNT \}\}/);
    assert.match(exposed[0],/run: node tools\/update-public-snapshot.mjs --refresh-replays/);
    assert.doesNotMatch(exposed[0],/--full-public|continue-on-error/);
    assert.deepEqual([...source.matchAll(/secrets\.([A-Z_]+)/g)].map(m=>m[1]),['FIREBASE_VERIFIER_SERVICE_ACCOUNT']);
    assert.match(source,/tools\/snapshot-export-auth.test.mjs tools\/snapshot-export-auth-workflow.test.mjs/);
  }
});
test('workflow_call declares and caller explicitly forwards only the verifier service account',async()=>{
  const publisher=await read('publish-verified-snapshots.yml');
  assert.match(publisher,/workflow_call:\n    secrets:\n      FIREBASE_VERIFIER_SERVICE_ACCOUNT:\n        required: true/);
  const verifier=await read('verify-runs.yml'),call=verifier.slice(verifier.indexOf('  publish_snapshots:'));
  assert.doesNotMatch(call,/secrets: inherit/);
  assert.match(call,/    secrets:\n      FIREBASE_VERIFIER_SERVICE_ACCOUNT: \$\{\{ secrets.FIREBASE_VERIFIER_SERVICE_ACCOUNT \}\}/);
  assert.equal((call.match(/secrets\./g)||[]).length,1);
  assert.match(call,/needs.verify.result == 'success' && needs.verify.outputs.snapshot_needed == 'true'/);
  assert.doesNotMatch(publisher,/public endpoints only|no secrets inheritance/);
});
