import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require('/Users/zag/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('https://ajaxpro.fans/**',async route=>{
 const url=new URL(route.request().url()),file=url.pathname==='/shirts'?path.join(root,'assets/shirt-battle/index.html'):path.join(root,url.pathname);
 try{const body=await fs.readFile(file),extension=path.extname(file);await route.fulfill({status:200,body,contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.otf':'font/otf'})[extension]||'application/octet-stream'})}catch{await route.fulfill({status:404,body:'missing'})}
});
try{
 await page.goto('https://ajaxpro.fans/shirts?reset=1');
 await page.locator('#start').click();
 let duels=0;
 for(let i=0;i<60;i++){
  if(await page.locator('.shirt-result').count())break;
  const contender=page.locator('.scene.duel .contender').first();
  await contender.waitFor({timeout:10000});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ajaxpro-concept-street')).battle.duels.length);
  await contender.evaluate(button=>button.click());
  await page.waitForFunction(previous=>document.querySelector('.shirt-result')||JSON.parse(localStorage.getItem('ajaxpro-concept-street')).battle.duels.length>previous,before);
  await page.waitForFunction(()=>document.querySelector('.shirt-result')||!game.busy);
  duels++;
 }
 await page.locator('.shirt-result .result-entry').last().waitFor({timeout:15000});
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('ajaxpro-concept-street')).battle);
 const ids=await page.locator('.shirt-result .result-entry img').evaluateAll(images=>images.map(image=>image.src.match(/cutouts\/([^/]+)\.png/)?.[1]));
 if(ids.join(',')!==[state.champion,state.second,state.third].join(','))throw new Error('Result order does not match battle state');
 if(await page.locator('#download,#link,#share,#again').count()!==4)throw new Error('Missing result actions');
 console.log('Battle finished',duels,'duels',ids.join(','));
}finally{await browser.close()}
