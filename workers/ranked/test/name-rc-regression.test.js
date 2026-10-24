import test from 'node:test';
import assert from 'node:assert/strict';
import {moderatePublicName, generatePublicName, generateFallbackName, generatedNameAt, generatedNameStats, safePublicName} from '../src/public-name-policy.js';

test('RC targeted handles, obfuscations, and contact shorthand are blocked',()=>{
  for(const name of ['diddy','Diddy','D1ddy','d.i.d.d.y','diddy99','xxDiddyxx','DiddyFan','P Diddy','dіddy','diiidddyyy','N1GA','niga','n1ga99','xxN1GAxx','YT: @example','IG:@example','TT: example']) {
    assert.equal(moderatePublicName(name).blocked,true,name);
    assert.notEqual(safePublicName(name,'test-account'),name);
  }
});

test('context and lexical exceptions do not become blanket exemptions',()=>{
  for(const name of ['DiddyKong','Diddy Kong Racing','Nigam','Onigashima','NightRacer','Yttrium','Igloo','Gay','TransRacer','baddie','ChildRacer','KidsTouchControls','PoopedOn','raccoon','SpicyRacer','SonicSamurai','UltraPiston']) {
    const decision=moderatePublicName(name);
    assert.equal(decision.blocked,false,name);
    assert.equal(decision.clean,name);
  }
  for(const name of ['DiddyKongDiddy','DiddyKongFuck','RaccoonCoon','SpicySpic','SamuraiCSAM','PistonRapist'])assert.equal(moderatePublicName(name).blocked,true,name);
});

test('every generated pair is unique, safe, untruncated, and reachable by the ordinal API',()=>{
  assert.deepEqual(generatedNameStats,{firstWords:384,secondWords:384,combinations:147456});
  const names=new Set();
  for(let i=0;i<generatedNameStats.combinations;i++){
    const name=generatedNameAt(i);
    assert.match(name,/^[a-z]+$/);
    assert.ok(name.length<=24,name);
    assert.equal(moderatePublicName(name).blocked,false,name);
    names.add(name);
  }
  assert.equal(names.size,147456);
  for(const i of [-1,generatedNameStats.combinations,NaN,Infinity,1.5])assert.throws(()=>generatedNameAt(i),RangeError);
});

test('seeded fallbacks are stable display aliases, not account renames',()=>{
  for(const seed of ['account-a','account-b','',null,'😀']) {
    assert.equal(generatePublicName(seed),generatePublicName(seed));
    assert.equal(moderatePublicName(generatePublicName(seed)).blocked,false);
  }
  assert.equal(safePublicName('Diddy','account-a'),generateFallbackName('account-a'));
  assert.equal(safePublicName('OrdinaryRacer','account-a'),'OrdinaryRacer');
});
