import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./client.mjs',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  async function prepareCapture(){'),source.indexOf('  return {prepareCapture,'));
test('capture awaits practice readiness before protected binding while catalog loads in parallel',async()=>{
 const order=[];let release;
 const ready=new Promise(resolve=>{release=resolve;});
 const prepare=new Function('bridge','loadCatalog','ensureCapture','tick',body+';return prepareCapture;')(
  {ready:()=>{order.push('ready');return ready;}},async()=>{order.push('catalog');},()=>{order.push('binding');},()=>{order.push('tick');});
 const pending=prepare();await Promise.resolve();assert.deepEqual(order,['catalog','ready']);
 release();await pending;assert.deepEqual(order,['catalog','ready','binding','tick']);
});
test('failed readiness must not install native binding',async()=>{
 let installs=0;
 const prepare=new Function('bridge','loadCatalog','ensureCapture','tick',body+';return prepareCapture;')(
  {ready:async()=>{throw Error('practice not ready');}},async()=>{},()=>{installs++;},()=>{});
 await assert.rejects(prepare(),/practice not ready/);assert.equal(installs,0);
});
test('all capture-installation callers gate on readiness and native binding guard stays protected',()=>{
 const calls=[...source.matchAll(/ensureCapture\(\);/g)];assert.equal(calls.length,2);
 for(const call of calls){const start=source.lastIndexOf('async function ',call.index);assert.match(source.slice(start,call.index),/await[\s\S]*bridge\.ready\(\)/);}
});
