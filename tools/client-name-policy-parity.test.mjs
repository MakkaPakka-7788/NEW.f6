import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildNamePolicy} from './build-name-policy.mjs';
import {moderatePublicName,generatePublicName,generateFallbackName,generatedNameAt,generatedNameStats} from '../workers/ranked/src/public-name-policy.js';

const integrationRoot = process.env.NAME_POLICY_SOURCE_ROOT
  ? pathToFileURL(process.env.NAME_POLICY_SOURCE_ROOT.replace(/\\/g, '/') + '/')
  : new URL('../', import.meta.url);

test('generated browser decisions match the server policy exactly', async () => {
  await buildNamePolicy({check:true});
  const context=vm.createContext({});
  vm.runInContext(await fs.readFile(new URL('../public-name-policy.js',import.meta.url),'utf8'),context);
  for(const value of ['Diddy','DiddyKong','N1GA','Nigam','YT: @example','SunsetRacer','Scunthorpe','classic','Kim-J0ng-Un99','𝖓ì𝕘ɢ𝖊𝖗','f\u200bu\u200bc\u200bk','NigerianRacer','Administrator',
    'xxfuckxx','touchmedaddy','sendnudes','kidtoucher','staticshoulddie','2girls1cup','18+ content',
    'discord.gg/teensonly','Nixxer','Dickinson','Peacock','Therapist','ScunthorpeCunt','CP Racer','Queer Racer',
    'i touch little kids','minors being touched','kids touch controls','KidTouchControls','iLoveKidRacing',
    'KidLovesDaddy','children sexual love','kill those women','men need to die','nonbinary must die',
    'paedophile','anilingus','cunnilingus']) {
    assert.deepEqual(JSON.parse(JSON.stringify(context.__polytrackNamePolicy.moderatePublicName(value))),moderatePublicName(value));
  }
});

test('the shared policy is loaded before the client patch',async()=>{
  const html=await fs.readFile(new URL('index.html',integrationRoot),'utf8');
  assert(html.indexOf('./public-name-policy.js?')>=0);
  assert(html.indexOf('./public-name-policy.js?')<html.indexOf('./polytrack_062_patch.js?'));
  const client=await fs.readFile(new URL('polytrack_062_patch.js',integrationRoot),'utf8');
  assert.match(client,/__polytrackNamePolicy\.moderatePublicName\(value\)/);
});

test('browser generated-name API matches the worker',async()=>{
  const context=vm.createContext({});
  vm.runInContext(await fs.readFile(new URL('../public-name-policy.js',import.meta.url),'utf8'),context);
  const api=context.__polytrackNamePolicy;
  assert.deepEqual(JSON.parse(JSON.stringify(api.generatedNameStats)),generatedNameStats);
  for(let i=0;i<generatedNameStats.combinations;i++)assert.equal(api.generatedNameAt(i),generatedNameAt(i));
  for(const seed of ['account-a','account-b','',null,'😀'])assert.equal(api.generatePublicName(seed),generatePublicName(seed));
  for(const seed of ['account-a','account-b','',null,'😀'])assert.equal(api.generateFallbackName(seed),generateFallbackName(seed));
});


test('browser bundle identifies exactly the shared source and keeps API fields stable',async()=>{
  const source=(await fs.readFile(new URL('../workers/ranked/src/public-name-policy.js',import.meta.url),'utf8')).replace(/\r\n?/g,'\n');
  const digest=createHash('sha256').update(source).digest('hex');
  const context=vm.createContext({});
  vm.runInContext(await fs.readFile(new URL('../public-name-policy.js',import.meta.url),'utf8'),context);
  assert.equal(context.__polytrackNamePolicy.sourceSha256,digest);
  assert.deepEqual(Object.keys(context.__polytrackNamePolicy).sort(),[
    'moderatePublicName','normalizeNameForCheck','sanitizeDisplayName','safePublicName',
    'generatePublicName','generateFallbackName','generatedNameAt','generatedNameStats','sourceSha256'
  ].sort());
});
