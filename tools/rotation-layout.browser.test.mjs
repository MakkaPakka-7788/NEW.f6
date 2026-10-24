import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {tmpdir} from 'node:os';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {startResponsiveServer} from './responsive-server.mjs';
import {installNativeRankedAuditFixture} from './native-ranked-audit-fixture.mjs';
import {layoutMatrix} from './responsive-matrix.mjs';
const require=createRequire(new URL('./verifier/package.json',import.meta.url));
const engine=process.env.ROTATION_BROWSER||'chromium';const pw=require('playwright');
test('native tracks survive live rotation and intermediate viewport sizes',{timeout:360000},async t=>{
const server=await startResponsiveServer();const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )});
const directory=process.env.POLYTRACK_ROTATION_OUTPUT||await fs.mkdtemp(path.join(tmpdir(),'polytrack-rotation-'));await fs.mkdir(directory,{recursive:true});const out=pathToFileURL(path.resolve(directory)+path.sep),results=[];let page;t.diagnostic('Rotation evidence: '+directory);
try{
 page=await browser.newPage({viewport:{width:440,height:780},hasTouch:true,...(engine==='chromium'?{isMobile:true}:{})});
 await installNativeRankedAuditFixture(page,{rejectWrites:true});
 await page.route(url=>url.origin!==new URL(server.url).origin,route=>new URL(route.request().url()).pathname==='/v6/user'?route.fulfill({status:200,contentType:'application/json',body:'null'}):route.abort('blockedbyclient'));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.locator('button:visible').filter({hasText:/^\s*Exit\s*$/}).last().click({timeout:60000});
 await page.locator('.track-selection-ui:not(.hidden)').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelectorAll('.tracks-container.open .track').length===17);
 await page.waitForFunction(()=>{const img=document.querySelector('.tracks-container.open img.thumbnail');return img?.complete&&img.naturalWidth>0;});
 const matrix=process.env.POLYTRACK_FULL_MATRIX==='1'?layoutMatrix:[...[{width:440,height:780},{width:956,height:360},{width:440,height:780},{width:844,height:320},{width:390,height:720},{width:720,height:390},{width:390,height:720},{width:820,height:1180},{width:1180,height:820},{width:600,height:800},{width:800,height:600}],...[599,600,601,699,700,701].map(width=>({width,height:780}))];
 for(const {width,height}of matrix){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const row=await page.evaluate(()=>{
   const rect=n=>n?.getBoundingClientRect().toJSON();
   const menu=document.querySelector('.track-selection-ui'),scroll=menu.querySelector('.tracks-container.open');
   const cards=[...scroll.querySelectorAll('.track:not(.hidden)')].map(n=>{const image=n.querySelector('img.thumbnail');return {name:n.querySelector('.track-title')?.textContent,rect:rect(n),button:rect(n.querySelector('button')),style:n.getAttribute('style'),image:image?{src:image.getAttribute('src'),complete:image.complete,naturalWidth:image.naturalWidth,display:getComputedStyle(image).display,opacity:getComputedStyle(image).opacity,visibility:getComputedStyle(image).visibility,rect:rect(image)}:null};});
   const info=document.querySelector('.menu-ui > .info');
   const homeCreditsVisible=Boolean(info&&getComputedStyle(info).display!=='none'&&getComputedStyle(info).visibility!=='hidden'&&info.getClientRects().length);
   return {homeCreditsVisible,width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,innerWidth,innerHeight,visual:{width:visualViewport?.width,height:visualViewport?.height,scale:visualViewport?.scale},scale:getComputedStyle(document.documentElement).getPropertyValue('--ui-scale-factor'),available:document.documentElement.style.getPropertyValue('--sq-available-width'),menu:rect(menu),scroll:rect(scroll),scrollWidth:scroll.scrollWidth,clientWidth:scroll.clientWidth,cards,controls:[...menu.querySelectorAll(':scope > .bar > button,:scope > .image-button-container>button')].map(n=>({label:n.textContent,rect:rect(n)}))};
  });
  row.target={width,height};row.failures=[];
  if(Math.abs(row.width-row.menu.width)>4)row.failures.push('menu-width');
  if(row.cards.some(n=>n.rect.left < -2||n.rect.right>row.width+2))row.failures.push('track-horizontal-clipping');
  if(row.cards.some(n=>n.button.left<n.rect.left-1||n.button.right>n.rect.right+1))row.failures.push('tile-button-overflow');
  if(row.cards.length!==17)row.failures.push('missing-track');
  if(row.homeCreditsVisible)row.failures.push('home-credits-overlap');
  if(row.controls.some(n=>n.rect.left< -4||n.rect.right>row.width+4||n.rect.top< -2||n.rect.bottom>row.height+2))row.failures.push('control-clipping');
  if(row.failures.length||[440,390,601,820,1366].includes(width))await page.screenshot({path:new URL(`rotation-${engine}-${width}x${height}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  results.push(row);
 }
 await fs.writeFile(new URL(`rotation-${engine}.json`,out),JSON.stringify(results,null,2));
 assert.deepEqual(results.filter(row=>row.failures.length).map(row=>({target:row.target,failures:row.failures})),[]);
 t.diagnostic(results.length+' native viewport transitions passed');
}catch(error){console.error(error.stack);if(page){await fs.writeFile(new URL('rotation-failure.txt',out),await page.locator('body').innerText());await page.screenshot({timeout:5000,path:new URL('rotation-failure.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')}).catch(()=>{});await fs.writeFile(new URL('rotation-dom.json',out),JSON.stringify(await page.evaluate(()=>({buttons:[...document.querySelectorAll('button,a')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent,html:n.outerHTML.slice(0,250)})),error:window.__ptNativeRankedAudit})),null,2));}throw error;}finally{await browser.close();await server.close();}
});
