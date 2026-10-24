'use strict';
// Opt-in, generated one-second recordings only. No database adapter or publication.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {verifyBatch} = require('./verify.cjs');
const {sha256} = require('./replay.cjs');
const policy = require('./track-geometry.json');
const root = path.resolve(__dirname, '../..');

test('official weekly, all captured weekly assets and reviewed static event code reach native validation', {timeout:180000}, async t => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'events/kodub/trusted-tracks.json')));
  const official = policy.tracks.find(row => row.name === 'tracks/official/desert1.track');
  const community = policy.tracks.find(row => row.name === 'tracks/community/la_infinita.track');
  const descriptors = [official, community].map(row => ({
    trackId: row.id, codeHash: row.hash, code: fs.readFileSync(path.join(root, row.name), 'utf8').trim(),
  })).concat(registry.map(row => ({
    trackId: row.trackId, codeHash: row.codeHash,
    code: fs.readFileSync(path.join(root, 'events/kodub', row.assetPath), 'utf8'),
  })));
  const replay = zlib.deflateSync(Buffer.alloc(15)).toString('base64url');
  const jobs = descriptors.map(row => ({resultId: `offline-${row.trackId}`, trackId: row.trackId,
    replay, replayHash: sha256(replay), timeMs: 1000}));
  const results = await verifyBatch(root, jobs, descriptors);
  for (const result of results) {
    assert.equal(result.reason, 'native_finish_mismatch', JSON.stringify(result));
    assert.equal(result.status, 'mismatch');
    assert.equal(result.deterministic, true);
    const descriptor = descriptors.find(row => row.trackId === result.trackId);
    assert.equal(result.binding.nativeTrackId, descriptor.trackId);
    assert.equal(result.binding.trackContentHash, descriptor.codeHash);
    const reviewed = policy.tracks.find(row => row.id === result.trackId);
    if (reviewed) assert.deepEqual(result.trackGeometry, {parts:reviewed.parts, spanX:reviewed.spanX, spanZ:reviewed.spanZ});
  }
  t.diagnostic(JSON.stringify(results.map(row => ({trackId:row.trackId, reason:row.reason,
    geometry:row.trackGeometry, policy:row.geometryPolicy, wallMs:row.wallMs, cpuMs:row.sampledCpuMs}))));
});
