import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('./verifier/package.json',import.meta.url))('playwright');
test('adjusted name notice is readable, dismissible and does not intercept gameplay touches',{timeout:30000},async()=>{
  const source=await fs.readFile(new URL('../polytrack_062_patch.js',import.meta.url),'utf8');
  const start=source.indexOf('  function showPublicNameAdjustment('),end=source.indexOf('\n  const FIREBASE_QUOTA_PAUSE_KEY=',start);assert.ok(start>0&&end>start);
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    for(const [width,height]of [[320,568],[440,956],[956,320],[1366,600]]){
      await page.setViewportSize({width,height});await page.setContent('<button id="gameplay">Game control</button>');
      await page.addScriptTag({content:source.slice(start,end)});
      await page.evaluate(()=>showPublicNameAdjustment('Taken','AnExtremelyLongName-12345'));
      const notice=page.getByRole('status');await notice.waitFor({state:'visible'});
      const bounds=await notice.boundingBox(),close=page.getByRole('button',{name:'Dismiss'}),button=await close.boundingBox();
      assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height);
      assert.ok(button.height>=44&&button.width>=44);
      assert.equal(await notice.getAttribute('aria-live'),'polite');
      assert.equal(await notice.evaluate(n=>getComputedStyle(n).pointerEvents),'none');
      await close.focus();await page.keyboard.press('Enter');assert.equal(await notice.count(),0);
      await page.evaluate(()=>showPublicNameAdjustment('Same','Same'));assert.equal(await notice.count(),0);
    }
  }finally{await browser.close();}
});
