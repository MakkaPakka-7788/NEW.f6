import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {generatedNameAt,generatedNameStats,generateFallbackName,generatePublicName,moderatePublicName} from '../workers/ranked/src/public-name-policy.js';

const integrationRoot = process.env.NAME_POLICY_SOURCE_ROOT
  ? pathToFileURL(process.env.NAME_POLICY_SOURCE_ROOT.replace(/\\/g, '/') + '/')
  : new URL('../', import.meta.url);
const ORIGINAL_FIRST_WORDS = Object.freeze(["swift","neon","alpha","turbo","sonic","pixel","nova","lucky","sunny","frost","ember","quantum","crystal","midnight","solar","lunar","hyper","ultra","aero","rapid","vivid","thunder","cosmic","silver","golden","shadow","arc","vector","iron","onyx","starlit","cobalt","ripple","granite","jungle","desert","arctic","magenta","scarlet","violet","teal","sable","amber","jade","ivory","obsidian","cinder","stellar","orbital","zen","rogue","prime","apex","summit","embered","misty","horizon","aurora","glitch","byte","laser","prism","halo","north","south","east","west","tempo","axle","torque","nitro","clutch","summoner","phantom","eclipse","cyclone","monsoon","titan","pegasus","raven","falcon","lynx","otter","comfy","bouncy","cheery","zippy","daring","brisk","fuzzy","mellow","witty","snappy","goofy","wobbly","noodle","waffle","jelly","marshmallow","bubble","pickled","crispy","crunchy","squishy","squeaky","sleepy","dizzy","giggly","jolly","jazzy","groovy","funky","disco","dapper","fluffy","feisty","fizzy","breezy","toasty","chilly","frosty","spicy","tangy","minty","peachy","plucky","perky","peppy","spry","sneaky","silly","quirky","wonky","wiggly","wobble","taffy","mochi","mango","banana","coconut","pineapple","popcorn","biscuit","donut","cupcake","pretzel","pancake","pudding","confetti","rainbow","sprinkles","stardust","moonlit","sunlit","twinkly","sparkly","electric","velvety","whimsical","rubbery"]);
const ORIGINAL_SECOND_WORDS = Object.freeze(["racer","drift","pulse","track","echo","comet","storm","shift","vault","spark","dash","glide","runner","rocket","flare","nexus","voyage","blaze","orbit","flux","drive","streak","zenith","quartz","radar","pilot","charger","phantom","matrix","engine","jumper","hopper","sprinter","raider","seeker","keeper","walker","slider","cruiser","strider","booster","chaser","panther","falcon","otter","fox","rhino","yak","wizard","knight","samurai","sage","ranger","captain","doctor","baron","duke","rookie","veteran","legend","maverick","stomper","breaker","spirit","beacon","anchor","vector","module","kernel","vortex","quasar","galaxy","planet","meteor","asteroid","volcano","tsunami","whirl","tempest","charge","vertex","pixel","bit","byte","gear","piston","engineer","driver","rider","climber","surfer","skater","sniper","ace","waffle","noodle","dumpling","pancake","muffin","biscuit","donut","pretzel","taco","burrito","pickle","potato","pumpkin","coconut","pineapple","mango","mochi","marshmallow","popcorn","pudding","jellybean","cupcake","bagel","crumpet","croissant","raccoon","capybara","penguin","puffin","axolotl","gecko","koala","panda","wombat","platypus","duck","goose","flamingo","pelican","toucan","alpaca","llama","narwhal","dolphin","walrus","seal","badger","hedgehog","hamster","chinchilla","squirrel","ferret","dragon","griffin","yeti","goblin","gremlin","gnome","jester","astronaut","explorer","cartographer","tinkerer","tuba","kazoo","ukulele"]);

test('existing client arrays have 8742 distinct reachable names, all preserved in the expanded vocabulary',async()=>{
  const client=await fs.readFile(new URL('polytrack_062_patch.js',integrationRoot),'utf8');
  const words=suffix=>JSON.parse(client.match(new RegExp('const PROFILE_NAME_WORD_'+suffix+' = (\\[[^;]+\\]);'))[1].replaceAll("'",'"'));
  const a=words('A'),b=words('B');
  assert.equal(a.length,93);
  assert.equal(b.length,94);
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const period=a.length*13*b.length/gcd(a.length,13*b.length);
  const before=new Set();
  for(let h=0;h<period;h++)before.add(a[h%a.length]+b[Math.floor(h/13)%b.length]);
  assert.equal(period,113646);
  assert.equal(before.size,8742);
  const after=new Set(Array.from({length:generatedNameStats.combinations},(_,i)=>generatedNameAt(i)));
  assert.equal(after.size,147456);
  for(const name of before)assert.ok(after.has(name),name);
  for(const name of before)assert.equal(moderatePublicName(name).blocked,false,name);
  const legacy=seed=>{
    const hash=Array.from(String(seed || 'racer')).reduce((acc,char)=>((acc*33)^char.charCodeAt(0))>>>0,5381);
    return a[hash%a.length]+b[Math.floor(hash/13)%b.length];
  };
  for(let i=0;i<10000;i++)assert.equal(generateFallbackName('account-'+i),legacy('account-'+i));
});

test('proposed integration keeps saved defaults and legacy fallbacks, expanding only new defaults',async()=>{
  const source=await fs.readFile(new URL('polytrack_062_patch.js',integrationRoot),'utf8');
  const begin=source.indexOf('  function getOrCreateDefaultDisplayName(');
  const end=source.indexOf('\n  async function enforceSafeDisplayName',begin);
  assert.ok(begin>=0 && end>begin);
  let getter=source.slice(begin,end);
  const original="const generated = makeFallbackName(accountId) || 'RookieRacer';";
  const replacement="const generated = globalThis.__polytrackNamePolicy?.generatePublicName?.(accountId) || makeFallbackName(accountId) || 'RookieRacer';";
  assert.ok(getter.includes(original)||getter.includes(replacement),'default callsite is recognized');
  getter=getter.replace(original,replacement);
  const run=(existing,policy)=>{
    let writes=0;
    const context=vm.createContext({__polytrackNamePolicy:policy,guestAccountId:'guest-account',LAST_ACTIVE_NAME_KEY:'name',
      sanitizeDisplayName:v=>String(v).trim(),makeFallbackName:generateFallbackName,
      localStorage:{getItem:()=>existing,setItem:()=>{writes++;}}});
    vm.runInContext(getter+';result=getOrCreateDefaultDisplayName("account-a");',context);
    return {name:context.result,writes};
  };
  assert.deepEqual(run('neonracer',{generatePublicName}),{name:'neonracer',writes:0});
  assert.deepEqual(run('Custom Handle',{generatePublicName}),{name:'Custom Handle',writes:0});
  assert.deepEqual(run('Guest',{generatePublicName}),{name:generatePublicName('account-a'),writes:1});
  assert.deepEqual(run('',undefined),{name:generateFallbackName('account-a'),writes:1});
});


test('all 160 original word indices and 25,600 base outputs remain reachable',async()=>{
  const source=await fs.readFile(new URL('../workers/ranked/src/public-name-policy.js',import.meta.url),'utf8');
  const words=letter=>JSON.parse(source.match(new RegExp('const PROFILE_NAME_WORD_'+letter+' = Object\\.freeze\\((\\[[^;]+?\\])\\);'))[1]);
  assert.deepEqual(words('A').slice(0,160),ORIGINAL_FIRST_WORDS);
  assert.deepEqual(words('B').slice(0,160),ORIGINAL_SECOND_WORDS);
  assert.equal(words('A').length,384);
  assert.equal(words('B').length,384);
  for(let a=0;a<160;a++)for(let b=0;b<160;b++)assert.equal(
    generatedNameAt(a*generatedNameStats.secondWords+b),ORIGINAL_FIRST_WORDS[a]+ORIGINAL_SECOND_WORDS[b]);
});

test('expanded output space has no exact or case-fold collisions',()=>{
  const names=new Set(),folded=new Set();
  for(let index=0;index<generatedNameStats.combinations;index++){
    const name=generatedNameAt(index);names.add(name);folded.add(name.toLowerCase());
  }
  assert.deepEqual(generatedNameStats,{firstWords:384,secondWords:384,combinations:147456});
  assert.equal(names.size,147456);
  assert.equal(folded.size,147456);
});
