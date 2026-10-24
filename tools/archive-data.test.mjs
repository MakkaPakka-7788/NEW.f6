import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=process.env.ARCHIVE_SOURCE_REPO||fileURLToPath(new URL('../',import.meta.url));
import {createHash} from 'node:crypto';
const read=async url=>JSON.parse(await fs.readFile(url,'utf8'));
test('recovered history adds only evidence-backed periods and retains canonical racer totals',async()=>{
 const source=await read(new URL('./fixtures/archive-catalog-baseline.json',import.meta.url));
 const staged=await read(new URL('../events/public-catalog.json',import.meta.url));
 const byId=new Map(staged.archives.map(period=>[period.id,period]));
 for(const period of source.archives){
  const updated=byId.get(period.id);assert.ok(updated);
  for(const field of ['trackId','kind','startsAt','endsAt','racerCount','maxRp','targetMs','scoringVersion'])assert.equal(updated[field],period[field],`${period.id} ${field}`);
 }
 const extra=staged.archives.filter(period=>!source.archives.some(row=>row.id===period.id));
 assert.equal(extra.length,1);assert.equal(extra[0].trackName,'going back in time');assert.equal(extra[0].historyOnly,true);
 assert.equal(extra[0].racerCount,undefined);assert.equal(staged.archives.filter(period=>period.kind==='kodub').length,5);
});
test('all six locally captured track identities have verified packaged import assets',async()=>{
 const selections=await read(new URL('../events/kodub/selections.json',import.meta.url));
 const trusted=await read(new URL('../events/kodub/trusted-tracks.json',import.meta.url));
 assert.equal(selections.length,6);
 for(const selection of selections){
  const entry=trusted.find(row=>row.trackId===selection.trackId);assert.ok(entry,selection.name);
  const bytes=await fs.readFile(path.join(sourceRoot,'events/kodub',entry.assetPath));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.codeHash);
 }
});
