import test from 'node:test';
import assert from 'node:assert/strict';
import {compactRankedMode,installCompactRankedLayout} from './compact-ranked-layout.mjs';

test('compact footer follows available width and short height, not a device identity',()=>{
 for(const [width,height,expected]of [
  [320,568,'portrait'],[440,780,'portrait'],[700,900,'portrait'],
  [701,900,'desktop'],[560,500,'landscape'],[844,320,'landscape'],
  [1100,500,'landscape'],[1101,500,'desktop'],[956,501,'desktop'],
  [1366,600,'desktop'],[1920,1080,'desktop'],[3440,1440,'desktop']
 ])assert.equal(compactRankedMode(width,height),expected,`${width}x${height}`);
});
test('optional setup is safe without a browser document',()=>{
 assert.equal(typeof installCompactRankedLayout({document:null,window:null}),'function');
 installCompactRankedLayout({document:null,window:null})();
});
